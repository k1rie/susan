// Comprueba que el cuerpo de cada funcion citada en codigo-cuerpo.sql es el que corre en la BD viva
// (pg_proc.prosrc debe aparecer, tal cual, dentro del extracto).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { consultaJson } from './bd-lib.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const cuerpo = readFileSync(join(AQUI, 'codigo-cuerpo.sql'), 'utf8');
const funciones = ['app.cerrar_sesion', 'public.api_cerrar_sesion', 'app.estado_por_minuto', 'app.trg_asistencia_rn01',
    'app.trg_bitacora_sin_cambios', 'app.trg_bitacora_sin_truncate'];
let fallos = 0;
for (const f of funciones) {
    const [esquema, nombre] = f.split('.');
    const filas = consultaJson(`select coalesce(json_agg(prosrc), '[]'::json) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = '${esquema}' and p.proname = '${nombre}'`);
    const ok = filas.length === 1 && cuerpo.includes(filas[0]);
    console.log(`${ok ? 'ok    ' : 'FALLA '} ${f}  (versiones en la BD: ${filas.length})`);
    if (!ok) fallos++;
}
process.exit(fallos ? 1 : 0);
