// Genera codigo-anexo.sql: el DDL completo de las tablas de la base (esquemas public y app), tomado con
// pg_dump --schema-only de la BD viva. Se conserva el orden de dependencias de pg_dump (por eso las
// llaves foraneas e indices van como ALTER/CREATE despues de las tablas) y se quita lo que no aporta:
// propietario, privilegios (ACL), comentarios, funciones, secuencias, SET y banderas de sesion.
//
// Uso: node generar-anexo.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const BIN = process.env.PGBIN_CLIENTE || '/usr/bin';
const ENTORNO = {
    ...process.env,
    PGHOST: process.env.PGHOST || '127.0.0.1',
    PGPORT: process.env.PGPORT || '54329',
    PGUSER: process.env.PGUSER || 'postgres',
};
const BD = process.env.PGDATABASE || 'susan';

// El directorio temporal vive en la carpeta temporal de la sesion (TMPDIR) o en el del sistema.
const tmp = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'susan-anexo-'));
const volcado = join(tmp, 'susan.dump');
const run = (cmd, args, opts = {}) => execFileSync(join(BIN, cmd), args, { env: ENTORNO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });

run('pg_dump', ['-Fc', '--schema-only', '-n', 'public', '-n', 'app', '-f', volcado, BD]);
const toc = run('pg_restore', ['-l', volcado]).split('\n');

// Entradas que se conservan (esquema public o app). Se excluyen la vista de metadatos app.parametro_meta,
// las funciones, ACL y COMMENT. Las entradas SEQUENCE si se conservan: son las que emiten la clausula
// ADD GENERATED ALWAYS AS IDENTITY de cada llave.
const TIPOS = /^\d+; \d+ \d+ (TYPE|TABLE|VIEW|SEQUENCE|CONSTRAINT|FK CONSTRAINT|INDEX|TRIGGER|POLICY|ROW SECURITY) (public|app) (.+?) \S+$/;
const conservar = toc.filter((l) => {
    const m = TIPOS.exec(l);
    if (!m) return false;
    if (m[2] === 'app' && /parametro_meta/.test(m[3])) return false; // vista interna, no es tabla
    if (m[2] === 'app' && m[1] !== 'TABLE' && m[1] !== 'CONSTRAINT' && m[1] !== 'ROW SECURITY' && m[1] !== 'INDEX') return false;
    return true;
});
const listaFiltrada = join(tmp, 'filtrada.toc');
writeFileSync(listaFiltrada, conservar.join('\n') + '\n');

const crudo = run('pg_restore', ['-L', listaFiltrada, '--no-owner', '--no-privileges', '-f', '-', volcado]);

// Limpieza: quita SET, set_config, comentarios de cabecera de pg_dump y lineas en blanco repetidas.
const limpio = [];
let enBloqueIdentidad = false;
for (const linea of crudo.split('\n')) {
    if (/^SET /.test(linea)) continue;
    if (/^SELECT pg_catalog\.set_config/.test(linea)) continue;
    if (/^--/.test(linea)) continue;
    if (/^\\(un)?restrict /.test(linea)) continue; // metacomandos de psql que agrega pg_dump 16.14
    if (linea.trim() === '' && (limpio.length === 0 || limpio[limpio.length - 1] === '')) continue;
    limpio.push(linea);
}
while (limpio.length && limpio[limpio.length - 1] === '') limpio.pop();

const conteos = {
    CREATE_TYPE: limpio.filter((l) => /^CREATE TYPE /.test(l)).length,
    CREATE_TABLE: limpio.filter((l) => /^CREATE TABLE /.test(l)).length,
    CREATE_VIEW: limpio.filter((l) => /^CREATE VIEW /.test(l)).length,
    CREATE_INDEX: limpio.filter((l) => /^CREATE (UNIQUE )?INDEX /.test(l)).length,
    ADD_PK: limpio.filter((l) => /ADD CONSTRAINT \S+ PRIMARY KEY/.test(l)).length,
    ADD_UNIQUE: limpio.filter((l) => /ADD CONSTRAINT \S+ UNIQUE/.test(l)).length,
    ADD_FK: limpio.filter((l) => /ADD CONSTRAINT \S+ FOREIGN KEY/.test(l)).length,
    CREATE_TRIGGER: limpio.filter((l) => /^CREATE TRIGGER /.test(l)).length,
    IDENTIDAD: limpio.filter((l) => /ADD GENERATED ALWAYS AS IDENTITY/.test(l)).length,
    ENABLE_ALWAYS_TRIGGER: limpio.filter((l) => /ENABLE ALWAYS TRIGGER/.test(l)).length,
    ENABLE_RLS: limpio.filter((l) => /ENABLE ROW LEVEL SECURITY/.test(l)).length,
    CREATE_POLICY: limpio.filter((l) => /^CREATE POLICY /.test(l)).length,
};

const banner = `-- ============================================================================================
-- SUSAN · Anexo: DDL completo de las tablas (esquemas public y app)
-- Generado con:  pg_dump -Fc --schema-only -n public -n app susan  y  pg_restore -L <lista filtrada>
--                --no-owner --no-privileges   (script generar-anexo.mjs). Base: PostgreSQL 16, 43 migraciones.
-- Se conservan: tipos ENUM, tablas, la vista v_resumen_asistencia, PK/UNIQUE/FK (ALTER TABLE), indices,
-- disparadores, RLS y politicas. Las llaves GENERATED ALWAYS AS IDENTITY aparecen como ALTER ... ADD GENERATED.
-- Se omiten: funciones (estan en supabase/migrations), privilegios, propietarios y comentarios.
-- Los CHECK van dentro de CREATE TABLE, como los emite pg_dump. No es un script autonomo: los DEFAULT
-- y los disparadores usan funciones del esquema app que crean las migraciones.
-- ============================================================================================
`;
const salida = banner + '\n' + limpio.join('\n') + '\n';
writeFileSync(join(AQUI, 'codigo-anexo.sql'), salida);
console.log(`codigo-anexo.sql: ${salida.split('\n').length - 1} líneas`);
console.log(JSON.stringify(conteos));
// Borra el volcado temporal (contiene solo esquema, sin datos).
rmSync(tmp, { recursive: true, force: true });
