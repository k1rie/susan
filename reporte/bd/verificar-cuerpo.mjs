// Comprueba que cada extracto de codigo-cuerpo.sql es identico, byte a byte, al rango de lineas de su migracion.
// Sale con codigo distinto de 0 si algun extracto difiere o falta.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXTRACTOS } from './cuerpo-manifiesto.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const MIGRACIONES = join(AQUI, '..', '..', 'supabase', 'migrations');
const cuerpo = readFileSync(join(AQUI, 'codigo-cuerpo.sql'));

let fallos = 0;
let bytesTotales = 0;
EXTRACTOS.forEach((e, i) => {
    const n = i + 1;
    // Localiza las marcas en el archivo generado (trabaja con Buffer para comparar bytes reales).
    const iniMarca = cuerpo.indexOf(Buffer.from(`-- [${n}] FUENTE: `));
    const finMarca = cuerpo.indexOf(Buffer.from(`\n-- [/${n}]`));
    if (iniMarca < 0 || finMarca < 0) { console.log(`FALLA [${n}] marcas no encontradas`); fallos++; return; }
    const finLineaMarca = cuerpo.indexOf(0x0a, iniMarca);
    const bloque = cuerpo.subarray(finLineaMarca + 1, finMarca);
    // Rango de la migracion, tambien como bytes.
    const fuente = readFileSync(join(MIGRACIONES, e.archivo));
    const lineas = [];
    let pos = 0;
    while (pos <= fuente.length) {
        const nl = fuente.indexOf(0x0a, pos);
        if (nl < 0) { lineas.push(fuente.subarray(pos)); break; }
        lineas.push(fuente.subarray(pos, nl));
        pos = nl + 1;
    }
    const esperado = Buffer.concat(lineas.slice(e.desde - 1, e.hasta).flatMap((l, k, arr) => (k < arr.length - 1 ? [l, Buffer.from('\n')] : [l])));
    const nLineas = e.hasta - e.desde + 1;
    if (Buffer.compare(bloque, esperado) === 0) {
        console.log(`ok     [${String(n).padStart(2)}] ${e.archivo} ${e.desde}-${e.hasta} (${nLineas} líneas, ${bloque.length} bytes)`);
        bytesTotales += bloque.length;
    } else {
        console.log(`FALLA  [${String(n).padStart(2)}] ${e.archivo} ${e.desde}-${e.hasta}: el extracto difiere de la fuente`);
        fallos++;
    }
});
console.log(`extractos=${EXTRACTOS.length} fallos=${fallos} bytes_verificados=${bytesTotales}`);
process.exit(fallos ? 1 : 0);
