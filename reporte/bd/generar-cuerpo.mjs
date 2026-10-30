// Escribe codigo-cuerpo.sql copiando, sin modificar, rangos de lineas de las migraciones (ver cuerpo-manifiesto.mjs).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMIT, EXTRACTOS } from './cuerpo-manifiesto.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const MIGRACIONES = join(AQUI, '..', '..', 'supabase', 'migrations');

const partes = [];
partes.push(`-- ============================================================================================
-- SUSAN · Código de base de datos: extractos para el reporte de avances
-- Cada extracto va entre las marcas  "-- [n] FUENTE: ..."  y  "-- [/n]".
-- El texto entre marcas es copia LITERAL (byte a byte) de las líneas indicadas de
-- supabase/migrations/ en el commit ${COMMIT}; verificar-cuerpo.mjs lo comprueba.
-- Son fragmentos: no se ejecutan por separado (dependen de objetos que crean otras migraciones).
-- ============================================================================================
`);
EXTRACTOS.forEach((e, i) => {
    const n = i + 1;
    const lineas = readFileSync(join(MIGRACIONES, e.archivo), 'utf8').split('\n').slice(e.desde - 1, e.hasta);
    partes.push(`-- [${n}] FUENTE: supabase/migrations/${e.archivo}, líneas ${e.desde}-${e.hasta} · ${e.titulo}`);
    partes.push(lineas.join('\n'));
    partes.push(`-- [/${n}]`);
    partes.push('');
});
const texto = partes.join('\n');
writeFileSync(join(AQUI, 'codigo-cuerpo.sql'), texto);
console.log(`codigo-cuerpo.sql: ${texto.split('\n').length - 1} líneas, ${EXTRACTOS.length} extractos`);
