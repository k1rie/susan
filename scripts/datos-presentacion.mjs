#!/usr/bin/env node
// Deja la base HOSPEDADA en Supabase lista para una presentacion: clases todo el dia para que el docente pueda pasar lista con la
// camara una y otra vez. Usa las cuentas que ya existen (las crea scripts/reinicio-pruebas.mjs): 1 docente y sus alumnos.
//
// Que crea (idempotente: lo que ya existe se reutiliza; volver a correrlo con otras fechas agrega sesiones):
//   - 3 materias, 3 aulas y en cada aula una camara de navegador activa (modo automatico: la camara del equipo del docente);
//   - 3 grupos del docente, uno por aula, con bloques de 1 hora de 06:00 a 23:40 desfasados 20 minutos entre grupos. El muestreo de
//     la camara dura los primeros `tolerancia_min` (20) minutos de cada sesion, asi que a cualquier hora hay una sesion en su
//     ventana de pase de lista y cada 20 minutos empieza otra;
//   - las sesiones de las fechas pedidas y la inscripcion de todos los alumnos activos en los 3 grupos.
// Todo pasa por las RPC api_* actuando como el administrador (mismas validaciones y bitacora que la interfaz).
//
// Uso:
//   node scripts/datos-presentacion.mjs [--fechas 2026-11-09,2026-11-10]            (plan, no escribe nada)
//   node scripts/datos-presentacion.mjs --ejecutar [--fechas ...] [--admin admin@susan.test] [--docente docente@susan.test]
// Sin --fechas: los proximos 2 dias de clase (lunes a sabado) a partir de manana. Lee SUPABASE_DB_URL del entorno o de supabase/.env.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'web', 'package.json'));
const { Client } = require('pg');

const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const tiene = (n) => process.argv.includes(n);
const fallar = (m) => { console.error(`\nERROR: ${m}`); process.exit(1); };

// Carga KEY=VALUE de un archivo sin pisar lo que ya este en el entorno.
function cargarEnv(archivo) {
    if (!fs.existsSync(archivo)) return;
    for (const linea of fs.readFileSync(archivo, 'utf8').split('\n')) {
        const m = linea.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (!m || process.env[m[1]] !== undefined) continue;
        process.env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
    }
}
cargarEnv(path.join(ROOT, 'supabase', '.env'));
const urlDb = process.env.SUPABASE_DB_URL;
if (!urlDb) fallar('Falta SUPABASE_DB_URL (entorno o supabase/.env).');

const EJECUTAR = tiene('--ejecutar');
const ADMIN = arg('--admin') || 'admin@susan.test';
const DOCENTE = arg('--docente') || 'docente@susan.test';

// ---- Catalogo de la presentacion ------------------------------------------------------------------------------------------------------
const CLASES = [
    { materia: { clave: 'MNU301', nombre: 'Métodos Numéricos' }, aula: 'DEMO-A', grupo: '5A', desfaseMin: 0 },
    { materia: { clave: 'ADM205', nombre: 'Administración Estratégica' }, aula: 'DEMO-B', grupo: '5B', desfaseMin: 20 },
    { materia: { clave: 'CON210', nombre: 'Contabilidad de Costos' }, aula: 'DEMO-C', grupo: '5C', desfaseMin: 40 },
];
const PRIMERA_HORA = 6; // 06:00
const FIN_DEL_DIA_MIN = 24 * 60 - 1; // ningun bloque cruza la medianoche

const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Bloques de 1 hora desde PRIMERA_HORA + desfase mientras terminen antes de la medianoche. */
function bloquesDelDia(desfaseMin) {
    const bloques = [];
    for (let inicio = PRIMERA_HORA * 60 + desfaseMin; inicio + 60 <= FIN_DEL_DIA_MIN; inicio += 60) {
        bloques.push({ hora_inicio: hhmm(inicio), hora_fin: hhmm(inicio + 60) });
    }
    return bloques;
}

// ---- Fechas ----------------------------------------------------------------------------------------------------------------------------
/** Dia ISO (1 = lunes .. 7 = domingo) de una fecha AAAA-MM-DD. */
const diaIso = (fecha) => { const d = new Date(`${fecha}T12:00:00Z`).getUTCDay(); return d === 0 ? 7 : d; };

function fechasPorOmision(hoy) {
    const fechas = [];
    const d = new Date(`${hoy}T12:00:00Z`);
    while (fechas.length < 2) {
        d.setUTCDate(d.getUTCDate() + 1);
        const f = d.toISOString().slice(0, 10);
        if (diaIso(f) <= 6) fechas.push(f);
    }
    return fechas;
}

const periodoDe = (fecha) => `${fecha.slice(0, 4)}-${Number(fecha.slice(5, 7)) <= 6 ? 1 : 2}`;

// ---- RPC como una cuenta (mismas reglas que la app: rol authenticated + claims) -------------------------------------------------------
async function rpcComo(cliente, correo, funcion, args = {}) {
    if (!/^api_[a-z0-9_]+$/.test(funcion)) fallar(`Funcion no permitida: ${funcion}`);
    const llaves = Object.keys(args);
    // READ WRITE explicito: el pooler de Supabase reutiliza conexiones y una sesion anterior pudo dejarlas en solo lectura.
    await cliente.query('BEGIN READ WRITE');
    try {
        const { rows } = await cliente.query('SELECT auth_uid::text AS uid FROM usuario WHERE correo = $1', [correo]);
        if (!rows[0]) fallar(`No existe la cuenta ${correo}.`);
        const claims = { sub: rows[0].uid, role: 'authenticated', aud: 'authenticated', email: correo };
        await cliente.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
        await cliente.query('SET LOCAL ROLE authenticated');
        const asignaciones = llaves.map((k, i) => `${k} => $${i + 1}`).join(', ');
        const { rows: salida } = await cliente.query(`SELECT public.${funcion}(${asignaciones}) AS r`, llaves.map((k) => args[k]));
        await cliente.query('COMMIT');
        return salida[0].r;
    } catch (e) {
        await cliente.query('ROLLBACK');
        throw e;
    }
}

const cliente = new Client({ connectionString: urlDb, ssl: { rejectUnauthorized: false } });
await cliente.connect();
await cliente.query('SET default_transaction_read_only = off');
const uno = async (sql, params = []) => (await cliente.query(sql, params)).rows[0];

try {
    const { hoy } = await uno("SELECT (now() AT TIME ZONE 'America/Mexico_City')::date::text AS hoy");
    const fechas = arg('--fechas') ? arg('--fechas').split(',').map((s) => s.trim()) : fechasPorOmision(hoy);
    for (const f of fechas) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) fallar(`Fecha invalida: ${f}`);
        if (diaIso(f) === 7) fallar(`${f} es domingo: el horario solo admite lunes a sabado.`);
    }
    const periodos = new Set(fechas.map(periodoDe));
    if (periodos.size !== 1) fallar('Todas las fechas deben caer en el mismo periodo (ene-jun o jul-dic).');
    const periodo = [...periodos][0];
    const dias = [...new Set(fechas.map(diaIso))].sort();

    const docente = await uno('SELECT id_docente FROM usuario WHERE correo = $1 AND rol = $2', [DOCENTE, 'docente']);
    if (!docente?.id_docente) fallar(`${DOCENTE} no es una cuenta de docente vinculada.`);
    const { rows: alumnos } = await cliente.query(
        "SELECT a.id_alumno, u.correo FROM alumno a JOIN usuario u ON u.id_alumno = a.id_alumno WHERE a.estatus = 'activo' ORDER BY u.correo",
    );

    console.log(`Fechas: ${fechas.join(', ')} (periodo ${periodo}, dias ${dias.join(',')})`);
    console.log(`Docente: ${DOCENTE} · alumnos activos: ${alumnos.map((a) => a.correo).join(', ') || 'ninguno'}`);
    for (const c of CLASES) {
        const b = bloquesDelDia(c.desfaseMin);
        console.log(`  ${c.grupo} ${c.materia.nombre} en ${c.aula}: ${b.length} bloques/dia, ${b[0].hora_inicio}-${b.at(-1).hora_fin}`);
    }
    if (dias.length * bloquesDelDia(0).length > 42) fallar('Demasiados dias: el horario de un grupo admite 42 bloques (maximo 2 dias).');
    if (!EJECUTAR) {
        console.log('\nPlan solamente. Agrega --ejecutar para escribir en la base.');
        process.exit(0);
    }

    const json = (o) => JSON.stringify(o);
    for (const c of CLASES) {
        let materia = await uno('SELECT id_materia FROM materia WHERE clave = $1', [c.materia.clave]);
        materia ??= await rpcComo(cliente, ADMIN, 'api_materia_guardar', {
            p: json({ ...c.materia, creditos: 6, horas_semana: 4 }),
        });

        let aula = await uno('SELECT id_aula FROM aula WHERE clave = $1', [c.aula]);
        aula ??= await rpcComo(cliente, ADMIN, 'api_aula_guardar', {
            p: json({ clave: c.aula, edificio: 'Demostración', capacidad: 40 }),
        });

        // Camara de navegador activa: la sesion nace en modo automatico y usa la camara del equipo del docente (la Raspberry).
        const camara = await uno("SELECT id_camara FROM camara WHERE id_aula = $1 AND tipo = 'navegador' AND estatus = 'activa'", [aula.id_aula]);
        if (!camara) {
            await rpcComo(cliente, ADMIN, 'api_camara_guardar', {
                p: json({ id_aula: aula.id_aula, posicion: 'frente', tipo: 'navegador', estatus: 'activa' }),
            });
        }

        let grupo = await uno('SELECT id_grupo FROM grupo WHERE id_materia = $1 AND clave_grupo = $2 AND periodo = $3', [
            materia.id_materia, c.grupo, periodo,
        ]);
        grupo ??= await rpcComo(cliente, ADMIN, 'api_grupo_guardar', {
            p: json({ id_materia: materia.id_materia, id_docente: docente.id_docente, id_aula: aula.id_aula, clave_grupo: c.grupo, periodo }),
        });

        const bloques = dias.flatMap((dia) => bloquesDelDia(c.desfaseMin).map((b) => ({ dia_semana: dia, ...b })));
        await rpcComo(cliente, ADMIN, 'api_horario_guardar', { p_id_grupo: grupo.id_grupo, p_bloques: json(bloques) });

        const desde = [...fechas].sort()[0];
        const hasta = [...fechas].sort().at(-1);
        const omitir = [];
        for (let d = new Date(`${desde}T12:00:00Z`); d.toISOString().slice(0, 10) <= hasta; d.setUTCDate(d.getUTCDate() + 1)) {
            const f = d.toISOString().slice(0, 10);
            if (!fechas.includes(f)) omitir.push(f);
        }
        const sesiones = await rpcComo(cliente, ADMIN, 'api_generar_sesiones', {
            p_id_grupo: grupo.id_grupo, p_desde: desde, p_hasta: hasta, p_omitir_fechas: omitir,
        });

        let inscritos = 0;
        for (const a of alumnos) {
            const ya = await uno("SELECT 1 FROM inscripcion WHERE id_grupo = $1 AND id_alumno = $2 AND estatus = 'activa'", [grupo.id_grupo, a.id_alumno]);
            if (ya) continue;
            await rpcComo(cliente, ADMIN, 'api_inscribir', { p_id_grupo: grupo.id_grupo, p_id_alumno: a.id_alumno });
            inscritos += 1;
        }
        console.log(`  ${c.grupo} (id ${grupo.id_grupo}): sesiones creadas ${sesiones.creadas}, ya existentes ${sesiones.ya_existentes}, `
            + `modo ${sesiones.modo_registro}; inscritos nuevos ${inscritos}`);
    }
    console.log('\nListo.');
} finally {
    await cliente.end();
}
