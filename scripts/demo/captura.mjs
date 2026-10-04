#!/usr/bin/env node
// Simula la cámara del aula DESDE LA TERMINAL (SOLO modo local): dibuja un fotograma con los rostros sintéticos de los
// alumnos elegidos y lo envía por la ruta real POST /api/sesiones/{id}/captura, como lo haría el navegador del docente
// titular. Sirve para probar el pase de lista automático sin depender de la cámara real (una webcam no produce los
// rostros sintéticos que reconoce el embedder 'fake') y como respaldo de la sección «Cámara simulada (demostración)» de la pantalla de sesión.
//
// Uso (por scripts/seed-demo.sh, que levanta lo que falte):
//   scripts/seed-demo.sh --captura [opciones]
//     --sesion ID       sesión abierta (por omisión, la del 3A de hoy a las 07:00, o sea la 19)
//     --alumnos LISTA   ordinales del grupo (1 = primer alumno por matrícula) que aparecen ante la cámara: 1-18,20 (por
//                       omisión todos los inscritos activos)
//     --extranos N      rostros ajenos al grupo que también aparecen y nadie debe reclamar (por omisión 1)
//     --camara ID       cámara del navegador a usar (por omisión la activa de tipo navegador del aula)
//     --veces N         fotogramas a enviar (por omisión 1)
//     --cada SEG        pausa entre fotogramas (por omisión 8: el servidor exige al menos la mitad del intervalo, 7.5 s)
//     --minuto N        antes del primer fotograma fija el reloj en el minuto N de la clase y lo echa a andar: 2 = «presente»,
//                       12 = «retardo». Sin esto el reloj queda donde esté (en su valor de partida, 07:12, todos salen retardo)
//
// Con el reloj de demostración DETENIDO todos los fotogramas llevarían la misma marca de tiempo (la captura es idempotente
// por cámara + marca y solo contaría el primero): si se piden varios (--veces N) o --minuto, el script echa a andar el reloj
// (equivale a «Correr»; «Pausar» en la tarjeta lo detiene). Con un solo fotograma y el reloj detenido, repetir el comando no
// registra nada. Ver docs/DEMO-RELOJ.md.
import fs from 'node:fs';
import path from 'node:path';
import {
    ErrorDemo, cargarModulo, conectar, entorno, fallar, iniciarSesion, llamarWeb, log, renderizarRostros,
} from './lib.mjs';

// El uso es el propio comentario de cabecera: todas las líneas seguidas que empiezan con '//' tras el shebang.
const USO = (() => {
    const lineas = fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1);
    const fin = lineas.findIndex((l) => !l.startsWith('//'));
    return lineas.slice(0, fin).map((l) => l.replace(/^\/\/ ?/, '')).join('\n');
})();

function leerArgumentos(argv) {
    if (argv.includes('--help') || argv.includes('-h')) {
        console.log(USO);
        process.exit(0);
    }
    const opciones = { sesion: null, alumnos: null, extranos: 1, camara: null, veces: 1, cada: 8, minuto: null };
    const claves = {
        '--sesion': 'sesion', '--alumnos': 'alumnos', '--extranos': 'extranos', '--camara': 'camara', '--veces': 'veces', '--cada': 'cada', '--minuto': 'minuto',
    };
    for (let i = 0; i < argv.length; i += 2) {
        const clave = claves[argv[i]];
        if (!clave || argv[i + 1] === undefined) fallar(`Opción no válida: ${argv[i]}\n\n${USO}`);
        opciones[clave] = argv[i + 1];
    }
    const entero = (valor, nombre, minimo) => {
        const n = Number(valor);
        if (!Number.isInteger(n) || n < minimo) fallar(`${nombre} debe ser un entero >= ${minimo}.`);
        return n;
    };
    return {
        sesion: opciones.sesion === null ? null : entero(opciones.sesion, '--sesion', 1),
        alumnos: opciones.alumnos,
        extranos: entero(opciones.extranos, '--extranos', 0),
        camara: opciones.camara === null ? null : entero(opciones.camara, '--camara', 1),
        veces: entero(opciones.veces, '--veces', 1),
        cada: Number(opciones.cada) >= 0 ? Number(opciones.cada) : fallar('--cada debe ser >= 0.'),
        minuto: opciones.minuto === null ? null : entero(opciones.minuto, '--minuto', 0),
    };
}

async function main() {
    const opciones = leerArgumentos(process.argv.slice(2));
    const cfg = entorno();
    const cliente = await conectar(cfg);
    let sesion;
    let alumnos;
    let idCamara;
    try {
        const { rows: [hoy] } = await cliente.query("SELECT (app.now() AT TIME ZONE app.tz())::date::text AS hoy");
        const { rows } = await cliente.query(`
            SELECT s.id_sesion, s.estatus::text AS estatus, s.modo_registro::text AS modo, g.id_grupo, g.id_aula, g.clave_grupo,
                   s.fecha::text AS fecha, s.hora_inicio::text AS hora_inicio, d.correo_institucional AS docente
              FROM sesion_clase s JOIN grupo g ON g.id_grupo = s.id_grupo JOIN docente d ON d.id_docente = g.id_docente
             WHERE ${opciones.sesion === null
        ? "g.clave_grupo = '3A' AND g.periodo = '2026-2' AND s.fecha = $1::date AND s.hora_inicio = TIME '07:00'"
        : 's.id_sesion = $1::int'}`, [opciones.sesion ?? hoy.hoy]);
        sesion = rows[0];
        if (!sesion) fallar(opciones.sesion === null ? 'No hay sesión del 3A hoy a las 07:00.' : `No existe la sesión ${opciones.sesion}.`);
        if (sesion.estatus !== 'abierta') fallar(`La sesión ${sesion.id_sesion} está '${sesion.estatus}': ábrela primero (panel del docente o scripts/seed-demo.sh --abierta).`);
        if (sesion.modo !== 'automatico') fallar(`La sesión ${sesion.id_sesion} es de pase manual: no admite capturas.`);
        ({ rows: alumnos } = await cliente.query(
            "SELECT id_alumno FROM inscripcion WHERE id_grupo = $1 AND estatus = 'activa' ORDER BY id_alumno", [sesion.id_grupo]));
        idCamara = opciones.camara;
        if (idCamara === null) {
            const { rows: [c] } = await cliente.query(
                "SELECT id_camara FROM camara WHERE id_aula = $1 AND tipo = 'navegador' AND estatus = 'activa' ORDER BY id_camara LIMIT 1", [sesion.id_aula]);
            if (!c) fallar('El aula no tiene una cámara de navegador activa (consola técnica).');
            idCamara = c.id_camara;
        }
    } finally {
        await cliente.end();
    }

    const semillas = await cargarModulo('semillas.js');
    const { ordinalesDeLista } = await cargarModulo('listas.js');
    let ordinales;
    try {
        ordinales = opciones.alumnos === null ? alumnos.map((_, i) => i + 1) : ordinalesDeLista(opciones.alumnos, alumnos.length);
    } catch (e) {
        fallar(e.message);
    }
    const rostros = [
        ...ordinales.map((o) => semillas.semillaDeAlumno(alumnos[o - 1].id_alumno)),
        ...Array.from({ length: opciones.extranos }, (_, i) => semillas.semillaDeExtrano(i)),
    ];
    if (rostros.length === 0) fallar('No hay rostros que dibujar (--alumnos y --extranos vacíos).');

    const cookie = await iniciarSesion(cfg, sesion.docente);
    let reloj = (await llamarWeb(cfg, cookie, '/api/_local/reloj')).cuerpo;
    if (opciones.minuto !== null) {
        if (reloj?.activo) {
            // Minuto N de la clase = hora de inicio + N (hora de la sede, el formato de `fijar`); sin pasar de las 23:59.
            const [hh, mm] = sesion.hora_inicio.split(':').map(Number);
            const t = Math.min(23 * 60 + 59, hh * 60 + mm + opciones.minuto);
            const fijar = `${sesion.fecha} ${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
            const r = await llamarWeb(cfg, cookie, '/api/_local/reloj', { metodo: 'POST', json: { fijar } });
            if (r.status !== 200) fallar(`No se pudo fijar el reloj de demostración en ${fijar} (HTTP ${r.status}).`);
            reloj = r.cuerpo;
            log(`reloj de demostración fijado en ${fijar} (minuto ${opciones.minuto} de la clase)`);
        } else {
            log('el reloj de demostración no está activo: --minuto no tiene efecto (rige la hora real)');
        }
    }
    if (reloj?.activo && !reloj.corre && (opciones.veces > 1 || opciones.minuto !== null)) {
        const r = await llamarWeb(cfg, cookie, '/api/_local/reloj', { metodo: 'POST', json: { correr: true } });
        if (r.status === 200) {
            reloj = r.cuerpo;
            log('el reloj de demostración estaba detenido: ahora corre (cada fotograma lleva su marca de tiempo; «Pausar» en la tarjeta lo detiene)');
        }
    }
    if (reloj?.activo && !reloj.corre) {
        log('el reloj de demostración está detenido: repetir este comando con la misma marca no registra nada (usa --veces N o pulsa «Correr»)');
    }

    const destino = path.join(cfg.dirLocal, 'demo', 'fotograma.jpg');
    renderizarRostros([{ destino, tipo: 'cuadro', semillas: rostros, sobrescribir: true }]);
    const bytes = fs.readFileSync(destino);
    log(`sesión ${sesion.id_sesion} (${sesion.clave_grupo}) · cámara ${idCamara} · ${ordinales.length} alumno(s) + ${opciones.extranos} ajeno(s) · ${opciones.veces} fotograma(s)`);

    let falla = false;
    for (let i = 1; i <= opciones.veces; i += 1) {
        const form = new FormData();
        form.append('id_camara', String(idCamara));
        // Con el reloj simulado activo la ruta ignora esta marca y estampa la hora de negocio; sin él, usa la nuestra.
        form.append('marca_tiempo', reloj?.activo ? reloj.ahora : new Date().toISOString());
        form.append('image', new Blob([bytes], { type: 'image/jpeg' }), 'fotograma.jpg');
        const r = await llamarWeb(cfg, cookie, `/api/sesiones/${sesion.id_sesion}/captura`, { metodo: 'POST', form, timeoutMs: 60_000 });
        if (r.status === 200) {
            const porEstado = {};
            for (const c of r.cuerpo.cambios ?? []) porEstado[c.estado] = (porEstado[c.estado] ?? 0) + 1;
            const resumen = Object.entries(porEstado).map(([e, n]) => `${n} ${e}`).join(', ') || 'sin cambios';
            log(`fotograma ${i}/${opciones.veces}: ${r.cuerpo.rostros} rostros · ${r.cuerpo.validas} reconocidos · ${r.cuerpo.no_atribuidas} sin atribuir · marca ${r.cuerpo.marca_tiempo} · ${resumen}`);
        } else {
            const e = r.cuerpo?.error ?? {};
            console.error(`[demo] fotograma ${i}/${opciones.veces}: HTTP ${r.status} ${e.code ?? ''} ${e.message ?? ''}`);
            falla = true;
            if (e.details?.fin_muestreo) break; // la ventana de tolerancia terminó: no tiene caso seguir
        }
        if (i < opciones.veces) await new Promise((ok) => setTimeout(ok, opciones.cada * 1000));
    }
    if (falla) process.exit(1);
}

main().catch((e) => {
    if (e instanceof ErrorDemo) console.error(`\n[demo] ERROR: ${e.message}`);
    else console.error('\n[demo] ERROR inesperado:', e);
    process.exit(1);
});
