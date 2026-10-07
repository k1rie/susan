#!/usr/bin/env node
// Reinicia la base HOSPEDADA en Supabase para una ronda de pruebas con el equipo: borra todos los datos (tablas, cuentas de Auth y archivos
// del bucket) y deja solo 1 administrador, 1 docente y 6 alumnos con contraseña temporal. Conserva el esquema, los valores de
// `parametro_sistema` y la cuenta de servicio (`servicio@susan.local`), que el programador de tareas necesita.
//
// IRREVERSIBLE. Por eso:
//   - sin `--ejecutar` solo muestra el plan y cuántos registros borraría; no escribe nada;
//   - `--ejecutar` exige `--confirmar <referencia>` (el subdominio de SUPABASE_URL, escrito a mano) y `--borrar-bitacora`: la bitácora de
//     auditoría es de solo inserción (RNF-08) y vaciarla obliga a desactivar sus dos triggers dentro de la transacción (vaciar.sql los reactiva).
//
// Uso:
//   node scripts/reinicio-pruebas.mjs [--dominio susan.test] [--password 'Clave-Comun-123']            (plan, no borra nada)
//   node scripts/reinicio-pruebas.mjs --ejecutar --confirmar <referencia> --borrar-bitacora [mismas opciones]
// Lee SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y SUPABASE_DB_URL del entorno o, si faltan, de supabase/.env. No imprime ningún secreto.
// Sin --password cada cuenta recibe una contraseña aleatoria, que se muestra UNA vez al final.
// Si algo falla a medias basta volver a correrlo con --ejecutar: empieza de nuevo desde el vaciado.
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'web', 'package.json'));
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

const BUCKET = 'susan-private';
const TABLAS = [
    'alumno', 'docente', 'usuario', 'aula', 'camara', 'materia', 'grupo', 'horario_grupo', 'inscripcion', 'sesion_clase', 'asistencia',
    'captura', 'deteccion', 'justificante', 'consentimiento', 'plantilla_facial', 'plantilla_foto', 'indice_faiss', 'bitacora_auditoria',
];

const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const tiene = (n) => process.argv.includes(n);
const fallar = (m) => { console.error(`\nERROR: ${m}`); process.exit(1); };

// Carga KEY=VALUE de un archivo sin pisar lo que ya esté en el entorno.
function cargarEnv(archivo) {
    if (!fs.existsSync(archivo)) return;
    for (const linea of fs.readFileSync(archivo, 'utf8').split('\n')) {
        const m = linea.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (!m || process.env[m[1]] !== undefined) continue;
        process.env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
    }
}
cargarEnv(path.join(ROOT, 'supabase', '.env'));

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
const urlDb = process.env.SUPABASE_DB_URL;
if (!url || !llave || !urlDb) fallar('Faltan SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o SUPABASE_DB_URL (entorno o supabase/.env).');
const referencia = new URL(url).hostname.split('.')[0];

// ---- Cuentas que quedan ---------------------------------------------------------------------------------------------------------------
const DOMINIO = (arg('--dominio') || 'susan.test').replace(/^@/, '');
const sinAcentos = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
const ALUMNOS = ['Ades', 'Gaby', 'Alan', 'Josue', 'Diego', 'Peña'];
const CUENTAS = [
    { rol: 'administrador', correo: `admin@${DOMINIO}` },
    { rol: 'docente', correo: `docente@${DOMINIO}`, numEmpleado: 'PRUEBA00', nombres: 'Docente', apellido: 'Prueba' },
    ...ALUMNOS.map((nombres, i) => ({
        rol: 'alumno',
        correo: `${sinAcentos(nombres).toLowerCase()}@${DOMINIO}`,
        matricula: `PRUEBA${String(i + 1).padStart(2, '0')}`,
        nombres,
        apellido: 'Prueba',
    })),
];

const fija = arg('--password');
// La política de Supabase puede exigir letra y número: se reintenta hasta que la aleatoria los traiga.
function generarContrasena() {
    for (;;) {
        const c = randomBytes(15).toString('base64url');
        if (/[A-Za-z]/.test(c) && /\d/.test(c)) return c;
    }
}
if (fija && (fija.length < 10 || !/[A-Za-z]/.test(fija) || !/\d/.test(fija))) {
    fallar('--password debe tener al menos 10 caracteres, una letra y un número.');
}

const sb = createClient(url, llave, { auth: { persistSession: false, autoRefreshToken: false } });
// El pooler de Supabase usa un certificado que Node no trae en su almacén de confianza: se cifra la conexión pero sin validar la cadena.
const db = new Client({ connectionString: urlDb, ssl: { rejectUnauthorized: false } });

// ---- Lectura del estado actual (solo lectura) ---------------------------------------------------------------------------------------
async function usuariosDeAuth() {
    const todos = [];
    for (let pagina = 1; ; pagina += 1) {
        const { data, error } = await sb.auth.admin.listUsers({ page: pagina, perPage: 1000 });
        if (error) throw new Error(`No se pudo listar Auth: ${error.message}`);
        todos.push(...data.users);
        if (data.users.length < 1000) return todos;
    }
}

async function objetosDelBucket(prefijo = '') {
    const rutas = [];
    for (let offset = 0; ; offset += 1000) {
        const { data, error } = await sb.storage.from(BUCKET).list(prefijo, { limit: 1000, offset });
        if (error) throw new Error(`No se pudo listar el bucket ${BUCKET}: ${error.message}`);
        for (const e of data) {
            const ruta = prefijo ? `${prefijo}/${e.name}` : e.name;
            // Las carpetas vienen sin id: se recorren; lo demás es un objeto.
            if (e.id === null) rutas.push(...await objetosDelBucket(ruta));
            else rutas.push(ruta);
        }
        if (data.length < 1000) return rutas;
    }
}

async function contarFilas() {
    const cuentas = {};
    for (const t of TABLAS) {
        const { rows } = await db.query(`SELECT count(*)::int AS n FROM public.${t}`);
        cuentas[t] = rows[0].n;
    }
    return cuentas;
}

// ---- Pasos destructivos -------------------------------------------------------------------------------------------------------------
// Antes de borrar nada se comprueba que Auth acepta el dominio de los correos: si lo rechazara, la base quedaría vacía y sin cuentas.
async function probarDominio() {
    const correo = `preflight-${randomBytes(4).toString('hex')}@${DOMINIO}`;
    const { data, error } = await sb.auth.admin.createUser({ email: correo, password: generarContrasena(), email_confirm: true });
    if (error) fallar(`Auth rechaza el dominio @${DOMINIO} (${error.message}). Nada se borró; prueba con --dominio <otro>.`);
    await sb.auth.admin.deleteUser(data.user.id);
}

async function vaciarBase() {
    const sql = fs.readFileSync(path.join(ROOT, 'scripts', 'reinicio-pruebas', 'vaciar.sql'), 'utf8');
    await db.query('BEGIN');
    try {
        await db.query(sql);
        await db.query('COMMIT');
    } catch (e) {
        await db.query('ROLLBACK');
        throw e;
    }
}

async function vaciarBucket(rutas) {
    for (let i = 0; i < rutas.length; i += 100) {
        const { error } = await sb.storage.from(BUCKET).remove(rutas.slice(i, i + 100));
        if (error) throw new Error(`No se pudo borrar del bucket: ${error.message}`);
    }
}

async function borrarUsuariosDeAuth(usuarios) {
    for (const u of usuarios) {
        const { error } = await sb.auth.admin.deleteUser(u.id);
        if (error) throw new Error(`No se pudo borrar una cuenta de Auth: ${error.message}`);
    }
}

// Cuenta de Auth + fila de docente/alumno + fila de usuario (por la misma función que usa la app). Si algo falla, se deshace la cuenta de Auth.
async function crearCuenta(c, contrasena) {
    const { data, error } = await sb.auth.admin.createUser({ email: c.correo, password: contrasena, email_confirm: true });
    if (error) throw new Error(`No se pudo crear ${c.correo} en Auth: ${error.message}`);
    const uid = data.user.id;
    try {
        let idDocente = null;
        let idAlumno = null;
        if (c.rol === 'docente') {
            const r = await db.query(
                'INSERT INTO public.docente (num_empleado, apellido_paterno, nombres, correo_institucional) VALUES ($1, $2, $3, $4) RETURNING id_docente',
                [c.numEmpleado, c.apellido, c.nombres, c.correo],
            );
            idDocente = r.rows[0].id_docente;
        }
        if (c.rol === 'alumno') {
            const r = await db.query(
                'INSERT INTO public.alumno (matricula, apellido_paterno, nombres, correo_institucional) VALUES ($1, $2, $3, $4) RETURNING id_alumno',
                [c.matricula, c.apellido, c.nombres, c.correo],
            );
            idAlumno = r.rows[0].id_alumno;
        }
        await db.query('SELECT public.svc_usuario_crear($1::text, $2::text, $3::int, $4::int, $5::uuid)', [c.correo, c.rol, idDocente, idAlumno, uid]);
    } catch (e) {
        await sb.auth.admin.deleteUser(uid).catch(() => {});
        throw e;
    }
}

// ---- Programa -----------------------------------------------------------------------------------------------------------------------
const ejecutar = tiene('--ejecutar');
try {
    await db.connect();
    const filas = await contarFilas();
    const usuarios = await usuariosDeAuth();
    const objetos = await objetosDelBucket().catch((e) => { console.warn(`Aviso: ${e.message}`); return []; });

    console.log(`Proyecto Supabase: ${referencia}`);
    console.log(`\nSe BORRARÁ (${ejecutar ? 'modo ejecución' : 'solo plan, no se borra nada'}):`);
    for (const [t, n] of Object.entries(filas)) console.log(`  ${t.padEnd(20)} ${n} filas`);
    console.log(`  ${'cuentas de Auth'.padEnd(20)} ${usuarios.length}`);
    console.log(`  ${`bucket ${BUCKET}`.padEnd(20)} ${objetos.length} archivos`);
    console.log('\nSe CONSERVA: el esquema, los valores de parametro_sistema y la cuenta de servicio (servicio@susan.local).');
    console.log(`\nSe CREARÁ (dominio @${DOMINIO}):`);
    for (const c of CUENTAS) console.log(`  ${c.rol.padEnd(14)} ${c.correo}`);

    if (!ejecutar) {
        console.log('\nNo se modificó nada. Para ejecutar de verdad, agrega: --ejecutar --confirmar <referencia del proyecto> --borrar-bitacora');
        process.exit(0);
    }
    if (arg('--confirmar') !== referencia) fallar(`--confirmar debe ser exactamente la referencia del proyecto (${referencia.length} caracteres, la de arriba).`);
    if (!tiene('--borrar-bitacora')) fallar('Falta --borrar-bitacora: confirma que aceptas vaciar la bitácora de auditoría (solo inserción) y reactivar sus triggers.');

    console.log('\n1/5 Comprobando que Auth acepta el dominio...');
    await probarDominio();
    console.log('2/5 Vaciando la base (una transacción)...');
    await vaciarBase();
    console.log('3/5 Vaciando el bucket...');
    await vaciarBucket(objetos);
    console.log('4/5 Borrando cuentas de Auth...');
    await borrarUsuariosDeAuth(usuarios);

    console.log('5/5 Creando cuentas...');
    const entregadas = [];
    for (const c of CUENTAS) {
        const contrasena = fija || generarContrasena();
        await crearCuenta(c, contrasena);
        entregadas.push({ rol: c.rol, correo: c.correo, contrasena });
        console.log(`  ✓ ${c.correo}`);
    }

    console.log('\nCuentas listas (las contraseñas se muestran UNA sola vez; guárdalas y cámbialas en /cambiar-contrasena):');
    console.log('rol            correo                          contraseña');
    for (const e of entregadas) console.log(`${e.rol.padEnd(14)} ${e.correo.padEnd(31)} ${e.contrasena}`);
    console.log('\nPendiente a mano: reiniciar o sincronizar el servicio de reconocimiento (su índice en memoria aún trae los rostros anteriores) y crear aula, materia y grupo desde /admin.');
} catch (e) {
    fallar(e.message);
} finally {
    await db.end().catch(() => {});
}
