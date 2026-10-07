#!/usr/bin/env node
// Prueba de PUNTA A PUNTA el autoservicio del alumno (SOLO modo local): que un alumno acepte su aviso y registre su propio rostro por las
// rutas reales /api/yo/*, con rostros sintéticos (una webcam no produce los que reconoce el embedder 'fake'; con InsightFace y una
// webcam real se prueba desde la pantalla «Mi registro facial», ver docs/DEMO.md §9). Cada paso imprime «ok» o «FALLA»; sale con
// código distinto de 0 si algo falla. Deja al alumno con una cara sintética registrada por él mismo (origen = alumno).
//
// Uso (por scripts/seed-demo.sh, que levanta lo que falte):
//   scripts/seed-demo.sh --autoservicio [opciones]
//     --alumno MATRICULA   quien se registra (por omisión E260001)
//     --otro MATRICULA     otro alumno con rostro en el índice, para comprobar que su cara no se puede registrar (por omisión E260002)
//
// Qué comprueba: 1) con el consentimiento vigente, verificar tomas de una cara nueva; 2) intentar registrar la cara de OTRO alumno se rechaza
// (409 ROSTRO_YA_REGISTRADO) y no deja nada guardado; 3) registrar la cara nueva queda activa e indexada con origen alumno; 4) el otro
// alumno ya no puede registrar esa cara nueva; 5) un docente no puede usar el autoservicio; 6) el cuerpo no admite un id_alumno.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    ErrorDemo, cargarModulo, conectar, entorno, fallar, iniciarSesion, llamarWeb, log, renderizarRostros, rpcComo,
} from './lib.mjs';

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
    const opciones = { alumno: 'E260001', otro: 'E260002' };
    for (let i = 0; i < argv.length; i += 2) {
        const clave = { '--alumno': 'alumno', '--otro': 'otro' }[argv[i]];
        if (!clave || argv[i + 1] === undefined) fallar(`Opción no válida: ${argv[i]}\n\n${USO}`);
        opciones[clave] = argv[i + 1].toUpperCase();
    }
    if (opciones.alumno === opciones.otro) fallar('--alumno y --otro deben ser personas distintas.');
    return opciones;
}

let fallos = 0;
const comprobar = (condicion, texto, detalle = '') => {
    if (condicion) console.log(`  ok      ${texto}`);
    else {
        fallos += 1;
        console.log(`  FALLA   ${texto}${detalle ? ` (${detalle})` : ''}`);
    }
};
const codigo = (r) => r.cuerpo?.error?.code ?? null;
const correoDe = (matricula) => `${matricula.toLowerCase()}@susan.local`;

/** n tomas de la MISMA cara (semilla) con bytes distintos, listas para el multipart `fotos`. */
function tomas(semilla, n, carpeta) {
    const imagenes = Array.from({ length: n }, (_, i) => ({
        destino: path.join(carpeta, `s${semilla}-v${i}.jpg`), semilla, tipo: 'registro', variante: i, sobrescribir: true,
    }));
    renderizarRostros(imagenes);
    return imagenes.map((m) => m.destino);
}
function formularioFotos(rutas) {
    const form = new FormData();
    for (const ruta of rutas) form.append('fotos', new File([fs.readFileSync(ruta)], path.basename(ruta), { type: 'image/jpeg' }));
    return form;
}

async function main() {
    const opciones = leerArgumentos(process.argv.slice(2));
    const cfg = entorno();
    const semillas = await cargarModulo('semillas.js');
    const db = await conectar(cfg);
    const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'susan-autoservicio-'));
    try {
        const idDe = async (matricula) => {
            const { rows } = await db.query('SELECT id_alumno FROM alumno WHERE matricula = $1', [matricula]);
            if (!rows[0]) fallar(`No existe el alumno ${matricula}.`);
            return rows[0].id_alumno;
        };
        const idAlumno = await idDe(opciones.alumno);
        const idOtro = await idDe(opciones.otro);
        const cookie = await iniciarSesion(cfg, correoDe(opciones.alumno));
        const cookieOtro = await iniciarSesion(cfg, correoDe(opciones.otro));
        const cookieDocente = await iniciarSesion(cfg, 'docente1@susan.local');

        const caraNueva = semillas.semillaDeExtrano(5); // nadie la tiene registrada
        const caraDelOtro = semillas.semillaDeAlumno(idOtro); // la del otro alumno, que está en el índice
        const activas = async () => (await db.query('SELECT count(*)::int AS n FROM plantilla_facial WHERE id_alumno = $1', [idAlumno])).rows[0].n;

        log(`autoservicio de ${opciones.alumno} (otro alumno con rostro: ${opciones.otro})`);

        console.log('\n1. Consentimiento');
        const estado = await rpcComo(db, correoDe(opciones.alumno), 'api_mi_registro');
        if (estado?.consentimiento) {
            console.log('  (ya tiene un consentimiento vigente: se usa; para probar la aceptación, revócalo desde «Mi registro facial»)');
        } else {
            const acepta = await llamarWeb(cfg, cookie, '/api/yo/consentimiento', { metodo: 'POST', json: { version_aviso: '2026-10', acepto: true } });
            comprobar(acepta.status === 201 && acepta.cuerpo?.origen === 'alumno', 'aceptar el aviso queda como consentimiento de origen alumno', `${acepta.status} ${codigo(acepta) ?? ''}`);
        }

        console.log('\n2. Verificar tomas de una cara nueva');
        const verif = await llamarWeb(cfg, cookie, '/api/yo/plantilla/verificar', { metodo: 'POST', form: formularioFotos(tomas(caraNueva, 5, carpeta)) });
        comprobar(verif.status === 200 && verif.cuerpo?.suficiente === true, '5 tomas de una cara nueva son suficientes', `${verif.status} ${codigo(verif) ?? ''}`);

        console.log('\n3. La cara de OTRO alumno se rechaza');
        const antes = await activas();
        const robo = await llamarWeb(cfg, cookie, '/api/yo/plantilla', { metodo: 'POST', form: formularioFotos(tomas(caraDelOtro, 5, carpeta)) });
        comprobar(robo.status === 409 && codigo(robo) === 'ROSTRO_YA_REGISTRADO', `registrar la cara de ${opciones.otro} da 409 ROSTRO_YA_REGISTRADO`, `${robo.status} ${codigo(robo) ?? ''}`);
        comprobar((await activas()) === antes, 'el rechazo no deja ninguna plantilla guardada');
        comprobar(!JSON.stringify(robo.cuerpo ?? {}).match(/matr|E26\d{4}|score|faiss/i), 'el mensaje no revela de quién es el rostro');

        console.log('\n4. Registrar la cara nueva');
        const alta = await llamarWeb(cfg, cookie, '/api/yo/plantilla', { metodo: 'POST', form: formularioFotos(tomas(caraNueva, 5, carpeta)) });
        comprobar(alta.status === 201 && alta.cuerpo?.n_fotos === 5, 'registrar 5 tomas da 201', `${alta.status} ${codigo(alta) ?? ''}`);
        const { rows } = await db.query('SELECT origen, id_indice IS NOT NULL AS indexada FROM plantilla_facial WHERE id_alumno = $1 AND activa', [idAlumno]);
        comprobar(rows[0]?.origen === 'alumno' && rows[0]?.indexada === true, 'la plantilla activa es de origen alumno y ya está en el índice', JSON.stringify(rows[0] ?? null));

        console.log('\n5. El otro alumno no puede registrar esa cara nueva');
        const repetida = await llamarWeb(cfg, cookieOtro, '/api/yo/plantilla', { metodo: 'POST', form: formularioFotos(tomas(caraNueva, 5, carpeta)) });
        comprobar(repetida.status === 409 && codigo(repetida) === 'ROSTRO_YA_REGISTRADO', `${opciones.otro} no puede registrar la cara que acaba de registrar ${opciones.alumno}`, `${repetida.status} ${codigo(repetida) ?? ''}`);

        console.log('\n6. Límites de seguridad');
        const docente = await llamarWeb(cfg, cookieDocente, '/api/yo/plantilla', { metodo: 'POST', form: formularioFotos(tomas(caraNueva, 3, carpeta)) });
        comprobar(docente.status === 403, 'un docente no puede usar el autoservicio (403)', String(docente.status));
        const conId = await llamarWeb(cfg, cookie, '/api/yo/consentimiento', { metodo: 'POST', json: { version_aviso: '2026-10', acepto: true, id_alumno: idOtro } });
        comprobar(conId.status === 422, 'el cuerpo no admite un id_alumno (422)', String(conId.status));

        console.log(fallos === 0 ? '\nTodo en orden.' : `\n${fallos} comprobación(es) fallaron.`);
    } finally {
        fs.rmSync(carpeta, { recursive: true, force: true });
        await db.end();
    }
    process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
    console.error(e instanceof ErrorDemo ? `[demo] ERROR: ${e.message}` : e);
    process.exit(1);
});
