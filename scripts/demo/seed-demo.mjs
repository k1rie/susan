#!/usr/bin/env node
// Datos de prueba completos y reiniciables para probar SUSAN de punta a punta (SOLO modo local).
// Se invoca con scripts/seed-demo.sh, que levanta lo que falte y calcula SUSAN_LOCAL_DIR. Guía: docs/DEMO.md.
//
// Qué deja, en este orden (cada paso es idempotente: lo que ya está no se repite ni se pisa):
//   1. Documentos reales (PDF) en las rutas que la semilla solo tenía como texto: consentimientos y justificantes.
//   2. Consentimiento vigente para los 75 alumnos (ruta real POST /api/consentimientos, como el administrador).
//   3. Plantilla facial activa para los 75 (foto sintética por alumno -> api_plantilla_registrar, con la RPC real).
//   4. Índice FAISS construido y activado POR LA RUTA REAL (POST /api/indice/reconstruir, como el técnico) y cargado en
//      el servicio de reconocimiento (index_loaded = true).
//   5. Con --reset o --abierta: el escenario de hoy vuelve al inicio (reset_hoy.sql).
//   6. Dos clases de reposición cerradas del 3A con 8 asistencias 'pendiente' (detecciones y recortes coherentes) y
//      2 justificantes por resolver más: la pantalla de Revisión del docente1 trae casos reales. Se arman con las mismas
//      funciones de la aplicación (api_abrir_sesion, svc_crear_captura, svc_registrar_detecciones, cerrar_sesion).
//   7. E260001 en el límite de faltas (limites.sql).
//   8. Con --abierta: la sesión 19 queda abierta y sin registros.
//   9. Recortes de rostro y documentos que falten en el almacenamiento, y una verificación final con conteos.
//
// Opciones:  (ninguna) asegura lo anterior sin destruir lo hecho a mano
//            --reset      además deja la sesión 19 en 'programada' y limpia lo que las pruebas hayan dejado
//            --abierta    como --reset, pero la sesión 19 queda abierta y sin registros
//            --muestras   solo escribe fotos sintéticas de cada alumno para subirlas a mano en el alta de plantilla
import fs from 'node:fs';
import path from 'node:path';
import {
    BUCKET, CUENTAS, ErrorDemo, archivoRelojDemo, cargarModulo, conectar, entorno, escribirObjeto, existeObjeto, fallar, fijarReloj,
    iniciarSesion, llamarServicio, llamarWeb, log, rpcComo, renderizarRostros, RAIZ, rutaEnDisco, uuidDeterminista,
} from './lib.mjs';

const OPCIONES = new Set(['--reset', '--abierta', '--muestras']);
const argumentos = process.argv.slice(2);
const desconocidas = argumentos.filter((a) => !OPCIONES.has(a));
if (desconocidas.length > 0) {
    console.error(`Opción desconocida: ${desconocidas.join(' ')}\nUso: scripts/seed-demo.sh [--reset | --abierta | --muestras]`);
    process.exit(2);
}
const MODO = argumentos.includes('--abierta') ? 'abierta' : argumentos.includes('--reset') ? 'reset' : 'normal';
const ESTRICTO = MODO !== 'normal'; // tras un reinicio el estado es exacto; sin él puede haber trabajo hecho a mano

const FIRMA_CONSENTIMIENTO = '2026-08-01';
const VIGENCIA_CONSENTIMIENTO = '2027-09-01';

const nombreCompleto = (a) => [a.nombres, a.apellido_paterno, a.apellido_materno].filter(Boolean).join(' ');

/** Ejecuta un archivo SQL de scripts/demo con sus variables demo.* (el archivo las lee con current_setting). */
async function ejecutarSql(cliente, archivo, variables) {
    for (const [clave, valor] of Object.entries(variables)) {
        await cliente.query('SELECT set_config($1, $2, false)', [`demo.${clave}`, String(valor)]);
    }
    await cliente.query(fs.readFileSync(path.join(RAIZ, 'scripts', 'demo', archivo), 'utf8'));
}

// ------------------------------------------------------------------------------------------------ 1. documentos
async function escribirDocumentos({ cfg, cliente, demo }) {
    const { rows } = await cliente.query(`
        SELECT c.objeto_documento AS ruta, 'consentimiento' AS tipo, a.matricula, a.nombres, a.apellido_paterno,
               a.apellido_materno, c.fecha_firma::text AS dato1, c.vigencia_hasta::text AS dato2, c.estatus::text AS estatus,
               NULL AS motivo
          FROM consentimiento c JOIN alumno a ON a.id_alumno = c.id_alumno
        UNION ALL
        SELECT j.objeto_documento, 'justificante', a.matricula, a.nombres, a.apellido_paterno, a.apellido_materno,
               s.fecha::text, NULL, j.estatus::text, j.motivo
          FROM justificante j JOIN alumno a ON a.id_alumno = j.id_alumno JOIN sesion_clase s ON s.id_sesion = j.id_sesion`);
    let escritos = 0;
    for (const r of rows) {
        if (existeObjeto(cfg, r.ruta)) continue;
        const esConsentimiento = r.tipo === 'consentimiento';
        const bytes = demo.pdf.pdfMinimo({
            titulo: esConsentimiento ? 'Consentimiento informado de datos biométricos' : 'Justificante de inasistencia',
            lineas: [
                'DOCUMENTO DE DEMOSTRACIÓN: datos ficticios, sin validez.',
                `Alumno: ${nombreCompleto(r)} (${r.matricula})`,
                ...(esConsentimiento
                    ? [`Fecha de firma: ${r.dato1}`, `Vigente hasta: ${r.dato2}`, `Estatus registrado: ${r.estatus}`]
                    : [`Motivo: ${r.motivo}`, `Clase del ${r.dato1}`, `Estatus registrado: ${r.estatus}`]),
            ],
        });
        if (escribirObjeto(cfg, r.ruta, bytes)) escritos += 1;
    }
    log(`documentos: ${escritos} PDF nuevos (${rows.length - escritos} ya estaban)`);
}

// ------------------------------------------------------------------------------------------------ 2. consentimientos
async function asegurarConsentimientos({ cfg, cliente, demo }) {
    const { rows } = await cliente.query(`
        SELECT a.id_alumno, a.matricula, a.nombres, a.apellido_paterno, a.apellido_materno
          FROM alumno a
         WHERE a.estatus = 'activo'
           AND NOT EXISTS (SELECT 1 FROM consentimiento c WHERE c.id_alumno = a.id_alumno AND app.consentimiento_vigente(c.id_consent))
         ORDER BY a.id_alumno`);
    if (rows.length === 0) {
        log('consentimientos: todos los alumnos activos ya tienen uno vigente');
        return;
    }
    const cookie = await iniciarSesion(cfg, CUENTAS.admin);
    for (const a of rows) {
        const bytes = demo.pdf.pdfMinimo({
            titulo: 'Consentimiento informado de datos biométricos',
            lineas: [
                'DOCUMENTO DE DEMOSTRACIÓN: datos ficticios, sin validez.',
                `Alumno: ${nombreCompleto(a)} (${a.matricula})`,
                `Fecha de firma: ${FIRMA_CONSENTIMIENTO}`,
                `Vigente hasta: ${VIGENCIA_CONSENTIMIENTO}`,
            ],
        });
        const form = new FormData();
        form.append('id_alumno', String(a.id_alumno));
        form.append('fecha_firma', FIRMA_CONSENTIMIENTO);
        form.append('vigencia_hasta', VIGENCIA_CONSENTIMIENTO);
        form.append('documento', new Blob([bytes], { type: 'application/pdf' }), 'consentimiento.pdf');
        const r = await llamarWeb(cfg, cookie, '/api/consentimientos', { metodo: 'POST', form });
        if (r.status !== 201) {
            fallar(`No se pudo registrar el consentimiento de ${a.matricula}: HTTP ${r.status} ${r.cuerpo?.error?.code ?? ''}`);
        }
    }
    log(`consentimientos: ${rows.length} nuevos por POST /api/consentimientos (${rows.map((a) => a.matricula).join(', ')})`);
}

// ------------------------------------------------------------------------------------------------ 3. plantillas
async function asegurarPlantillas({ cfg, cliente, demo }) {
    const { rows } = await cliente.query(`
        SELECT a.id_alumno, a.matricula, c.id_consent
          FROM alumno a
          JOIN LATERAL (SELECT k.id_consent FROM consentimiento k
                         WHERE k.id_alumno = a.id_alumno AND app.consentimiento_vigente(k.id_consent)
                         ORDER BY k.vigencia_hasta DESC, k.id_consent DESC LIMIT 1) c ON true
         WHERE a.estatus = 'activo'
           AND NOT EXISTS (SELECT 1 FROM plantilla_facial p WHERE p.id_alumno = a.id_alumno AND p.activa)
         ORDER BY a.id_alumno`);
    if (rows.length === 0) {
        log('plantillas: todos los alumnos activos ya tienen una plantilla activa');
        return;
    }
    const fotos = rows.map((a) => ({
        ...a,
        ruta: `registro/${a.id_alumno}/${uuidDeterminista(`susan-demo-foto-${a.id_alumno}`)}.jpg`,
    }));
    renderizarRostros(fotos.map((f) => ({
        destino: rutaEnDisco(cfg, f.ruta), semilla: demo.semillas.semillaDeAlumno(f.id_alumno), tipo: 'registro',
    })));

    // La verificación de calidad (RF-15) es la misma que hace la ruta de alta: si una foto no la pasa, no se registra nada.
    for (const f of fotos) {
        const form = new FormData();
        form.append('image', new Blob([fs.readFileSync(rutaEnDisco(cfg, f.ruta))], { type: 'image/jpeg' }), 'foto.jpg');
        const r = await llamarServicio(cfg, '/v1/photo/check', { metodo: 'POST', form });
        if (r.status !== 200 || !r.cuerpo?.un_solo_rostro || r.cuerpo?.motivo_rechazo) {
            fallar(`La foto sintética de ${f.matricula} no pasa la verificación de calidad: ${r.cuerpo?.motivo_rechazo ?? `HTTP ${r.status}`}`);
        }
    }
    for (const f of fotos) {
        await rpcComo(cliente, CUENTAS.admin, 'api_plantilla_registrar', {
            p_id_alumno: f.id_alumno, p_id_consent: f.id_consent, p_objeto_foto: f.ruta,
        });
    }
    log(`plantillas: ${fotos.length} nuevas por api_plantilla_registrar (fotos sintéticas, semillaDeAlumno)`);
}

// ------------------------------------------------------------------------------------------------ 4. índice
async function asegurarIndice({ cfg }) {
    const cookie = await iniciarSesion(cfg, CUENTAS.tecnico);
    let r;
    for (let intento = 0; intento < 6; intento += 1) {
        r = await llamarWeb(cfg, cookie, '/api/indice/reconstruir', { metodo: 'POST', json: {} });
        if (r.status !== 409 || r.cuerpo?.error?.code !== 'RECONSTRUCCION_EN_CURSO') break;
        await new Promise((ok) => setTimeout(ok, 5000)); // otro proceso (p. ej. el job) lo está reconstruyendo
    }
    if (r.status !== 200) {
        fallar(`No se pudo reconstruir el índice: HTTP ${r.status} ${r.cuerpo?.error?.code ?? ''} ${JSON.stringify(r.cuerpo?.error?.details ?? {})}`);
    }
    log(`índice: ${r.cuerpo.estado} (${r.cuerpo.version ?? 'sin versión'}, ${r.cuerpo.total_vectores} vectores)`);

    let estado = await llamarWeb(cfg, cookie, '/api/indice');
    if (estado.status === 200 && estado.cuerpo.sincronizado === false && estado.cuerpo.servicio?.disponible) {
        const s = await llamarWeb(cfg, cookie, '/api/indice/sincronizar', { metodo: 'POST', json: {} });
        if (s.status !== 200) fallar(`No se pudo cargar el índice en el servicio: HTTP ${s.status} ${s.cuerpo?.error?.code ?? ''}`);
        log(`índice: servicio sincronizado con ${s.cuerpo.version}`);
        estado = await llamarWeb(cfg, cookie, '/api/indice');
    }
    if (estado.status !== 200 || estado.cuerpo.sincronizado !== true) {
        fallar('El servicio de reconocimiento no quedó sincronizado con el índice en uso (¿está arriba? scripts/dev-all.sh).');
    }
}

// ------------------------------------------------------------------------------------------------ 5-6. escenario
async function fechaDeHoy(cliente) {
    const { rows } = await cliente.query("SELECT (app.now() AT TIME ZONE app.tz())::date::text AS hoy");
    return rows[0].hoy;
}

/** Quita las carpetas de recortes que ninguna detección referencia (sesiones borradas o reiniciadas). */
async function limpiarRecortesHuerfanos({ cfg, cliente }) {
    const base = path.join(cfg.raizStorage, 'recortes');
    if (!fs.existsSync(base)) return;
    const { rows } = await cliente.query(
        "SELECT DISTINCT split_part(objeto_recorte, '/', 2) AS sesion FROM deteccion WHERE objeto_recorte LIKE 'recortes/%'");
    const referenciadas = new Set(rows.map((r) => r.sesion));
    let quitadas = 0;
    for (const nombre of fs.readdirSync(base)) {
        if (!/^\d+$/.test(nombre) || referenciadas.has(nombre)) continue;
        fs.rmSync(path.join(base, nombre), { recursive: true, force: true });
        quitadas += 1;
    }
    if (quitadas > 0) log(`recortes: ${quitadas} carpeta(s) de sesiones reiniciadas eliminadas del almacenamiento`);
}

async function borrarSesion(cliente, idSesion) {
    await cliente.query('DELETE FROM justificante WHERE id_sesion = $1', [idSesion]);
    await cliente.query(
        'DELETE FROM deteccion WHERE id_captura IN (SELECT id_captura FROM captura WHERE id_sesion = $1)', [idSesion]);
    await cliente.query('DELETE FROM captura WHERE id_sesion = $1', [idSesion]);
    await cliente.query('DELETE FROM asistencia WHERE id_sesion = $1', [idSesion]);
    await cliente.query('DELETE FROM sesion_clase WHERE id_sesion = $1', [idSesion]);
}

/** Datos del grupo 3A que necesita el guion: ordinal -> alumno, cámaras del aula y faiss_id de cada plantilla. */
async function contextoDelGrupo(cliente) {
    const { rows: [grupo] } = await cliente.query(
        "SELECT id_grupo, id_aula FROM grupo WHERE clave_grupo = '3A' AND periodo = '2026-2'");
    if (!grupo) fallar('No existe el grupo 3A del periodo 2026-2 (¿se aplicó la semilla?).');
    const { rows: alumnos } = await cliente.query(`
        SELECT i.id_alumno, row_number() OVER (ORDER BY i.id_alumno)::int AS ordinal, a.correo_institucional AS correo
          FROM inscripcion i JOIN alumno a ON a.id_alumno = i.id_alumno WHERE i.id_grupo = $1 ORDER BY i.id_alumno`, [grupo.id_grupo]);
    const { rows: camaras } = await cliente.query(
        'SELECT id_camara, posicion::text AS posicion FROM camara WHERE id_aula = $1', [grupo.id_aula]);
    const { rows: faiss } = await cliente.query(`
        SELECT p.id_alumno, p.faiss_id::int AS faiss_id
          FROM plantilla_facial p JOIN indice_faiss f ON f.id_indice = p.id_indice AND f.en_uso WHERE p.activa`);
    return {
        idGrupo: grupo.id_grupo,
        idAula: grupo.id_aula,
        alumnoDe: new Map(alumnos.map((a) => [a.ordinal, a])),
        ordinalDe: new Map(alumnos.map((a) => [a.id_alumno, a.ordinal])),
        camara: new Map(camaras.map((c) => [c.posicion, c.id_camara])),
        faissDe: new Map(faiss.map((f) => [f.id_alumno, f.faiss_id])),
    };
}

/** Arma una clase de reposición completa pasando por las funciones reales de la aplicación. */
async function construirSesionDemo({ cfg, cliente, demo }, grupo, plan) {
    const { rows: [{ inicio }] } = await cliente.query(
        'SELECT app.instante_clase($1::date, $2::time) AS inicio', [plan.fecha, plan.horaInicio]);
    const { rows: [{ fin }] } = await cliente.query(
        'SELECT app.instante_clase($1::date, $2::time) AS fin', [plan.fecha, plan.horaFin]);
    const t0 = new Date(inicio).getTime();

    // Mismos valores que api_generar_sesiones: los parámetros vigentes se copian a la sesión.
    const { rows: [sesion] } = await cliente.query(`
        INSERT INTO sesion_clase (id_grupo, fecha, hora_inicio, hora_fin, tolerancia_min, limite_presente_min,
                                  intervalo_muestreo_seg, modo_registro, estatus)
        VALUES ($1, $2, $3, $4, app.param_num('tolerancia_min')::smallint, app.param_num('limite_presente_min')::smallint,
                app.param_num('intervalo_muestreo_seg')::smallint, 'automatico', 'programada')
        RETURNING id_sesion`, [grupo.idGrupo, plan.fecha, plan.horaInicio, plan.horaFin]);
    const idSesion = sesion.id_sesion;

    // 1. Abrir con la RPC del docente, dentro del horario de la clase (RF-03, RN-06).
    await rpcComo(cliente, CUENTAS.docente1, 'api_abrir_sesion', { p_id_sesion: idSesion }, { ahora: new Date(t0 + 60_000).toISOString() });

    // 2. Cada captura: svc_crear_captura + svc_registrar_detecciones, con el reloj en el instante de la captura.
    let rostros = 0;
    for (const captura of plan.capturas) {
        const marca = new Date(t0 + captura.segundo * 1000);
        const idCamara = grupo.camara.get(captura.camara);
        if (!idCamara) fallar(`El aula A-12 no tiene la cámara '${captura.camara}' (¿se editó el catálogo de cámaras? usa --reset o revisa la semilla).`);
        await fijarReloj(cliente, marca.toISOString());
        const { rows: [{ id_captura: idCaptura }] } = await cliente.query(
            'SELECT public.svc_crear_captura(p_id_sesion => $1, p_id_camara => $2, p_marca_tiempo => $3, p_rostros => $4) AS id_captura',
            [idSesion, idCamara, marca.toISOString(), captura.rostros.length]);
        const detecciones = captura.rostros.map((r, i) => {
            const alumno = r.ordinal === undefined ? null : grupo.alumnoDe.get(r.ordinal);
            if (r.ordinal !== undefined && !alumno) fallar(`El 3A no tiene el ordinal ${r.ordinal}.`);
            return {
                faiss_id: alumno ? grupo.faissDe.get(alumno.id_alumno) ?? null : null,
                score: alumno ? r.score : null,
                // Mismo esquema que la captura real: recortes/{id_sesion}/{id_camara}-{epochMs}/{n}.jpg
                objeto_recorte: `recortes/${idSesion}/${idCamara}-${marca.getTime()}/${i + 1}.jpg`,
            };
        });
        await cliente.query('SELECT public.svc_registrar_detecciones(p_id_captura => $1, p_detecciones => $2::jsonb)',
            [idCaptura, JSON.stringify(detecciones)]);
        rostros += detecciones.length;
    }

    // 3. Cierre por el programador de tareas (cuenta de servicio): consolida, crea los ausentes y deja los pendientes.
    await fijarReloj(cliente, new Date(fin).toISOString());
    await cliente.query('SELECT app.cerrar_sesion($1, false)', [idSesion]);
    await fijarReloj(cliente, cfg.ahora);

    // 4. Lo que la base produjo debe ser lo que dice el guion.
    const { rows: estados } = await cliente.query('SELECT id_alumno, estado::text AS estado FROM asistencia WHERE id_sesion = $1', [idSesion]);
    const real = { presente: [], retardo: [], pendiente: [], ausente: [] };
    for (const e of estados) real[e.estado]?.push(grupo.ordinalDe.get(e.id_alumno));
    const esperado = demo.casos.resumenEsperado(plan);
    for (const estado of Object.keys(real)) {
        const a = JSON.stringify([...real[estado]].sort((x, y) => x - y));
        const b = JSON.stringify(esperado[estado]);
        if (a !== b) fallar(`La sesión ${plan.clave} salió distinta al guion en '${estado}': base ${a} / guion ${b}`);
    }
    log(`casos: ${plan.clave} (sesión ${idSesion}): ${plan.capturas.length} capturas, ${rostros} rostros, `
        + `${esperado.presente.length} presentes, ${esperado.retardo.length} retardos, ${esperado.pendiente.length} pendientes, `
        + `${esperado.ausente.length} ausentes`);
    return idSesion;
}

/** Justificantes por resolver del guion (registro con la RPC real, como el alumno o como el docente). */
async function asegurarJustificantesDemo({ cfg, cliente, demo }, grupo) {
    let creados = 0;
    for (const j of demo.casos.JUSTIFICANTES_DEMO) {
        const plan = demo.casos.SESIONES_DEMO.find((s) => s.clave === j.sesion);
        const { rows: [s] } = await cliente.query(
            'SELECT id_sesion FROM sesion_clase WHERE id_grupo = $1 AND fecha = $2 AND hora_inicio = $3', [grupo.idGrupo, plan.fecha, plan.horaInicio]);
        const alumno = grupo.alumnoDe.get(j.ordinal);
        if (!s || !alumno) continue;
        const { rows: previos } = await cliente.query(
            'SELECT 1 FROM justificante WHERE id_sesion = $1 AND id_alumno = $2', [s.id_sesion, alumno.id_alumno]);
        if (previos.length > 0) continue; // ya existe (o ya se resolvió a mano): no se vuelve a crear
        const ruta = `justificantes/${alumno.id_alumno}/${uuidDeterminista(`susan-demo-justificante-${j.sesion}-${alumno.id_alumno}`)}.pdf`;
        escribirObjeto(cfg, ruta, demo.pdf.pdfMinimo({
            titulo: 'Justificante de inasistencia',
            lineas: ['DOCUMENTO DE DEMOSTRACIÓN: datos ficticios, sin validez.', `Alumno: ${alumno.correo}`, `Motivo: ${j.motivo}`, `Clase del ${plan.fecha}`],
        }));
        const esAlumno = j.registradoPor === 'alumno';
        await rpcComo(cliente, esAlumno ? alumno.correo : CUENTAS.docente1, 'api_registrar_justificante', {
            p_id_sesion: s.id_sesion,
            p_motivo: j.motivo,
            p_objeto_documento: ruta,
            ...(esAlumno ? {} : { p_id_alumno: alumno.id_alumno }),
        }, { ahora: j.instante });
        creados += 1;
    }
    log(`justificantes: ${creados} nuevos del guion (más los de la semilla del docente1)`);
}

/**
 * Las capturas históricas salieron de las dos cámaras del A-12 y svc_crear_captura exige cámara activa: se activan solo
 * mientras se arma el guion y se devuelven a su estatus (en la demostración la IP queda en mantenimiento, ver reset_hoy.sql).
 */
async function conCamarasActivas(cliente, idAula, fn) {
    const { rows: previas } = await cliente.query('SELECT id_camara, estatus::text AS estatus FROM camara WHERE id_aula = $1', [idAula]);
    await cliente.query("UPDATE camara SET estatus = 'activa' WHERE id_aula = $1 AND estatus <> 'activa'", [idAula]);
    try {
        return await fn();
    } finally {
        for (const c of previas) {
            await cliente.query('UPDATE camara SET estatus = $2::estatus_camara WHERE id_camara = $1 AND estatus::text <> $2', [c.id_camara, c.estatus]);
        }
    }
}

async function asegurarCasosRevision(ctx) {
    const { cliente, demo } = ctx;
    const grupo = await contextoDelGrupo(cliente);
    let armadas = 0;
    for (const plan of demo.casos.SESIONES_DEMO) {
        const { rows: [existente] } = await cliente.query(
            'SELECT id_sesion, estatus::text AS estatus FROM sesion_clase WHERE id_grupo = $1 AND fecha = $2 AND hora_inicio = $3',
            [grupo.idGrupo, plan.fecha, plan.horaInicio]);
        if (existente && MODO === 'normal' && existente.estatus === 'cerrada') {
            log(`casos: ${plan.clave} ya existe (sesión ${existente.id_sesion}); se respeta lo hecho a mano`);
            continue;
        }
        if (existente) await borrarSesion(cliente, existente.id_sesion); // reinicio o armado a medias
        await conCamarasActivas(cliente, grupo.idAula, () => construirSesionDemo(ctx, grupo, plan));
        armadas += 1;
    }
    await asegurarJustificantesDemo(ctx, grupo);
    if (armadas > 0) {
        // Las clases nuevas cuentan en el denominador de faltas del grupo: se recalcula el derecho a examen.
        await cliente.query('BEGIN');
        await cliente.query('SELECT app.asumir_cuenta_servicio()');
        await cliente.query('SELECT app.recalcular_grupo($1)', [grupo.idGrupo]);
        await cliente.query('COMMIT');
    }
}

// ------------------------------------------------------------------------------------------------ 8. sesión abierta
async function abrirSesionDeHoy({ cfg, cliente, hoy }) {
    const { rows: [s] } = await cliente.query(`
        SELECT s.id_sesion FROM sesion_clase s JOIN grupo g ON g.id_grupo = s.id_grupo
         WHERE g.clave_grupo = '3A' AND g.periodo = '2026-2' AND s.fecha = $1 AND s.hora_inicio = TIME '07:00'`, [hoy]);
    if (!s) fallar(`No existe la sesión del 3A de ${hoy} 07:00.`);
    try {
        await rpcComo(cliente, CUENTAS.docente1, 'api_abrir_sesion', { p_id_sesion: s.id_sesion }, { ahora: cfg.ahora });
    } catch (e) {
        fallar(`No se pudo abrir la sesión ${s.id_sesion} con el reloj en ${cfg.ahora}: ${e.message}`);
    }
    log(`sesión ${s.id_sesion} (3A, hoy 07:00) abierta y sin registros`);
}

// ------------------------------------------------------------------------------------------------ 9. archivos
async function escribirRecortes({ cfg, cliente, demo }) {
    const { rows } = await cliente.query(`
        SELECT d.id_deteccion, d.objeto_recorte AS ruta, d.es_valida, p.id_alumno
          FROM deteccion d LEFT JOIN plantilla_facial p ON p.id_plantilla = d.id_plantilla
         WHERE d.objeto_recorte IS NOT NULL ORDER BY d.id_deteccion`);
    const faltan = rows.filter((r) => !existeObjeto(cfg, r.ruta));
    const imagenes = faltan.map((r) => ({
        destino: rutaEnDisco(cfg, r.ruta),
        tipo: 'recorte',
        // Lectura válida = el alumno atribuido; sin candidato o por debajo del umbral = una persona ajena (otra semilla).
        semilla: r.es_valida && r.id_alumno
            ? demo.semillas.semillaDeAlumno(r.id_alumno)
            : demo.semillas.semillaDeExtrano((r.id_deteccion * 7) % demo.semillas.SEMILLAS_EXTRANO),
    }));
    const { escritas } = renderizarRostros(imagenes);
    log(`recortes: ${escritas} imagen(es) de rostro nuevas (${rows.length - faltan.length} ya estaban)`);
}

// ------------------------------------------------------------------------------------------------ --muestras
async function escribirMuestras({ cfg, cliente, demo }) {
    const carpeta = path.join(cfg.dirLocal, 'demo', 'rostros');
    const { rows } = await cliente.query('SELECT id_alumno, matricula FROM alumno ORDER BY id_alumno');
    const { escritas } = renderizarRostros(rows.map((a) => ({
        destino: path.join(carpeta, `${a.matricula}.jpg`), semilla: demo.semillas.semillaDeAlumno(a.id_alumno), tipo: 'registro',
    })));
    log(`muestras: ${escritas} foto(s) nuevas en ${carpeta} (una por matrícula; pasan la verificación de calidad)`);
}

// ------------------------------------------------------------------------------------------------ verificación
async function verificar({ cfg, cliente, demo, hoy }) {
    const fallos = [];
    const comprobar = (ok, texto, estricto = true) => {
        console.log(`  ${ok ? 'ok     ' : estricto ? 'FALLA  ' : 'aviso  '} ${texto}`);
        if (!ok && estricto) fallos.push(texto);
    };
    const uno = async (sql, params = []) => (await cliente.query(sql, params)).rows[0];
    console.log('\n== Verificación ==');

    const alumnos = await uno("SELECT count(*)::int AS n FROM alumno WHERE estatus = 'activo'");
    const consent = await uno(`SELECT count(DISTINCT c.id_alumno)::int AS n FROM consentimiento c
                                 WHERE app.consentimiento_vigente(c.id_consent)`);
    comprobar(consent.n === alumnos.n, `consentimiento vigente: ${consent.n}/${alumnos.n} alumnos`);
    const pl = await uno(`SELECT count(*) FILTER (WHERE activa)::int AS activas,
                                 count(*) FILTER (WHERE activa AND id_indice IS NOT NULL)::int AS indexadas FROM plantilla_facial`);
    comprobar(pl.activas === alumnos.n && pl.indexadas === alumnos.n, `plantilla facial activa e indexada: ${pl.indexadas}/${alumnos.n}`);

    const indice = await uno('SELECT version, total_vectores FROM indice_faiss WHERE en_uso');
    comprobar(Boolean(indice) && indice.total_vectores >= alumnos.n, `índice en uso: ${indice?.version ?? 'ninguno'} con ${indice?.total_vectores ?? 0} vectores`);
    const salud = await llamarServicio(cfg, '/health');
    comprobar(salud.cuerpo?.index_loaded === true, `servicio de reconocimiento: index_loaded=${salud.cuerpo?.index_loaded}`);
    const info = await llamarServicio(cfg, '/v1/index');
    comprobar(info.cuerpo?.version === indice?.version && info.cuerpo?.ntotal === indice?.total_vectores,
        `servicio sincronizado con la base: ${info.cuerpo?.version} / ${info.cuerpo?.ntotal} vectores`);

    // Humo de punta a punta: seis alumnos "se paran" ante la cámara y el servicio debe devolver SU plantilla (score ~1).
    const muestra = (await cliente.query(`SELECT a.id_alumno, p.faiss_id::int AS faiss_id FROM alumno a JOIN plantilla_facial p
                                            ON p.id_alumno = a.id_alumno AND p.activa ORDER BY a.id_alumno LIMIT 6`)).rows;
    if (muestra.length === 6 && salud.cuerpo?.index_loaded) {
        const destino = path.join(cfg.dirLocal, 'demo', 'humo.jpg');
        renderizarRostros([{
            destino, tipo: 'cuadro', semillas: muestra.map((m) => demo.semillas.semillaDeAlumno(m.id_alumno)), sobrescribir: true,
        }]);
        const form = new FormData();
        form.append('image', new Blob([fs.readFileSync(destino)], { type: 'image/jpeg' }), 'humo.jpg');
        form.append('allowed_faiss_ids', JSON.stringify(muestra.map((m) => m.faiss_id)));
        const r = await llamarServicio(cfg, '/v1/recognize', { metodo: 'POST', form });
        const vistos = (r.cuerpo?.faces ?? []).map((f) => f.candidate?.faiss_id).sort((a, b) => a - b);
        const esperados = muestra.map((m) => m.faiss_id).sort((a, b) => a - b);
        const mejor = Math.min(...(r.cuerpo?.faces ?? []).map((f) => f.candidate?.score ?? 0));
        comprobar(JSON.stringify(vistos) === JSON.stringify(esperados) && mejor >= 0.99,
            `reconocimiento de punta a punta: 6 rostros sintéticos -> 6 plantillas correctas (score mínimo ${mejor})`);
    }

    // Escenario de hoy.
    const sesiones = (await cliente.query(`
        SELECT s.id_sesion, g.clave_grupo, s.fecha::text AS fecha, s.hora_inicio::text AS hora, s.estatus::text AS estatus,
               (SELECT count(*)::int FROM captura c WHERE c.id_sesion = s.id_sesion) AS capturas,
               (SELECT count(*)::int FROM asistencia a WHERE a.id_sesion = s.id_sesion) AS asistencias
          FROM sesion_clase s JOIN grupo g ON g.id_grupo = s.id_grupo
         WHERE (g.clave_grupo = '3A' AND s.fecha = $1 AND s.hora_inicio = TIME '07:00')
            OR (g.clave_grupo = '5C' AND s.fecha = $1 AND s.hora_inicio = TIME '09:00')
            OR (g.clave_grupo = '3B' AND s.fecha = $1::date + 1 AND s.hora_inicio = TIME '09:00')
         ORDER BY s.fecha, s.hora_inicio`, [hoy])).rows;
    const esperadoSesion19 = MODO === 'abierta' ? 'abierta' : 'programada';
    for (const s of sesiones) {
        const es19 = s.clave_grupo === '3A';
        const esperado = es19 ? esperadoSesion19 : 'programada';
        comprobar(s.estatus === esperado && s.capturas === 0 && s.asistencias === 0,
            `sesión ${s.id_sesion} (${s.clave_grupo} ${s.fecha} ${s.hora.slice(0, 5)}): ${s.estatus}, ${s.capturas} capturas, ${s.asistencias} asistencias`,
            ESTRICTO);
    }

    // Lo que ve el docente1 en Revisión y el panel.
    const cola = await rpcComo(cliente, CUENTAS.docente1, 'api_cola_revision', { p_limit: 50 });
    const { pendientes, justificantes } = cola.contadores;
    comprobar(pendientes >= 6 && pendientes <= 8,
        `Revisión del docente1: ${pendientes} asistencias pendientes (esperadas entre 6 y 8)`, ESTRICTO);
    comprobar(justificantes >= 3 && justificantes <= 4,
        `Revisión del docente1: ${justificantes} justificantes por resolver (esperados entre 3 y 4)`, ESTRICTO);
    const conLecturas = cola.pendientes.filter((p) => p.total_lecturas > 0).length;
    comprobar(conLecturas === cola.pendientes.length, `todos los pendientes traen lecturas del reconocimiento (${conLecturas}/${cola.pendientes.length})`);

    // Alumnos con aviso.
    const resumen = async (correo) => (await rpcComo(cliente, correo, 'api_alumno_resumen', {})).items[0];
    const r1 = await resumen('e260001@susan.local');
    comprobar(r1.en_limite === true, `e260001: ${r1.faltas_equivalentes}/${r1.faltas_maximas_permitidas} faltas, en_limite=${r1.en_limite}, derecho_examen=${r1.derecho_examen}`, ESTRICTO);
    const r14 = await resumen('e260014@susan.local');
    comprobar(r14.derecho_examen === false, `e260014: sin derecho a examen (${r14.faltas_equivalentes} faltas, límite ${r14.faltas_maximas_permitidas})`);
    const r25 = await resumen('e260025@susan.local');
    comprobar(r25.estatus_inscripcion === 'baja', `e260025: inscripción en ${r25.estatus_inscripcion} (historial hasta la sesión 8)`);

    // Técnico.
    const idx = await rpcComo(cliente, CUENTAS.tecnico, 'api_indice_estado', { p_limit: 5 });
    comprobar(idx.en_uso?.total_vectores > 0 && idx.requiere_reconstruccion === false,
        `técnico: índice ${idx.en_uso?.version} con ${idx.en_uso?.total_vectores} vectores, requiere_reconstruccion=${idx.requiere_reconstruccion}`);
    const cams = await rpcComo(cliente, CUENTAS.tecnico, 'api_camaras_estado', { p_limit: 10 });
    comprobar(cams.items.some((c) => c.tipo === 'navegador' && c.estatus === 'activa'),
        `técnico: ${cams.total} cámaras; la del navegador del A-12 está activa`);

    // Archivos referenciados.
    const docs = (await cliente.query('SELECT objeto_documento AS ruta FROM consentimiento UNION ALL SELECT objeto_documento FROM justificante')).rows;
    const sinDoc = docs.filter((d) => !existeObjeto(cfg, d.ruta)).length;
    comprobar(sinDoc === 0, `documentos PDF presentes: ${docs.length - sinDoc}/${docs.length}`);
    const crops = (await cliente.query('SELECT objeto_recorte AS ruta FROM deteccion WHERE objeto_recorte IS NOT NULL')).rows;
    const sinCrop = crops.filter((d) => !existeObjeto(cfg, d.ruta)).length;
    comprobar(sinCrop === 0, `recortes de rostro presentes: ${crops.length - sinCrop}/${crops.length}`);

    if (fallos.length > 0) fallar(`${fallos.length} comprobación(es) fallaron.`);
    console.log('\nTodo listo. Guía: docs/DEMO.md\n');
}

// ------------------------------------------------------------------------------------------------ principal
async function main() {
    const cfg = entorno();
    const cliente = await conectar(cfg);
    try {
        const demo = {
            semillas: await cargarModulo('semillas.js'),
            casos: await cargarModulo('casos.js'),
            pdf: await cargarModulo('pdf.js'),
        };
        const ctx = { cfg, cliente, demo, hoy: await fechaDeHoy(cliente) };
        log(`modo: ${MODO} · hoy de la demostración: ${ctx.hoy} · ${BUCKET} en ${cfg.raizStorage}`);

        if (argumentos.includes('--muestras')) {
            await escribirMuestras(ctx);
            return;
        }

        await escribirDocumentos(ctx);
        await asegurarConsentimientos(ctx);
        await asegurarPlantillas(ctx);
        await asegurarIndice(ctx);
        if (MODO !== 'normal') {
            await ejecutarSql(cliente, 'reset_hoy.sql', { hoy: ctx.hoy });
            log('escenario de hoy reiniciado (sesiones 19, 115 y 67 en programada, sin registros)');
            // La sesión de las 07:00 solo se abre con el reloj de la web en su hora de partida: si alguien lo adelantó
            // probando, se restablece (equivale al botón «Restablecer» de la tarjeta del reloj).
            const reloj = archivoRelojDemo(ctx.cfg);
            if (fs.existsSync(reloj)) {
                fs.rmSync(reloj, { force: true });
                log('reloj de demostración de la web restablecido a LOCAL_FAKE_NOW');
            }
        }
        await asegurarCasosRevision(ctx);
        await ejecutarSql(cliente, 'limites.sql', { hoy: ctx.hoy });
        if (MODO === 'abierta') await abrirSesionDeHoy(ctx);
        if (MODO !== 'normal') await limpiarRecortesHuerfanos(ctx);
        await escribirDocumentos(ctx);
        await escribirRecortes(ctx);
        await verificar(ctx);
    } finally {
        await cliente.end();
    }
}

main().catch((e) => {
    if (e instanceof ErrorDemo) console.error(`\n[demo] ERROR: ${e.message}`);
    else console.error('\n[demo] ERROR inesperado:', e);
    process.exit(1);
});
