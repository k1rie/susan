#!/usr/bin/env node
// Imprime, legible, lo que un trabajador de cuadro necesita del plan v2: las reglas globales, la hoja del cuadro (spec + bloques máquina
// de cámara y sonido), las transiciones de entrada y salida y los handoffs de los cuadros vecinos.
// Uso: node scripts/plan-frame.mjs <frame_id> [--plan v2/plan.json] [--solo-reglas]
// Existe para no obligar a cada trabajador a cargar el JSON completo del plan (~200 KB).
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const iPlan = args.indexOf('--plan');
const rutaPlan = iPlan >= 0 ? resolve(args[iPlan + 1]) : join(RAIZ, 'v2/plan.json');
const plan = JSON.parse(readFileSync(rutaPlan, 'utf8'));

const salir = (msg) => {
    console.error(msg);
    process.exit(1);
};

console.log(`PLAN v2 — total ${plan.total_s} s — ${plan.resumen}\n`);
console.log('REGLAS GLOBALES (obligatorias):');
plan.reglas.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
if (args.includes('--solo-reglas')) process.exit(0);

if (!id) salir('Falta el id del cuadro (p. ej. 05-camara).');
const i = plan.frames.findIndex((f) => f.id === id);
if (i < 0) salir(`El cuadro ${id} no está en el plan. Cuadros: ${plan.frames.map((f) => f.id).join(', ')}`);
const f = plan.frames[i];
const entra = plan.transitions.find((t) => t.to === id) ?? null;
const sale = plan.transitions.find((t) => t.from === id) ?? null;
const previo = plan.frames[i - 1] ?? null;
const siguiente = plan.frames[i + 1] ?? null;

console.log(`\n==================== CUADRO ${f.id} — ${f.title} — duración ${f.duration} s ====================`);
console.log(`Cámara (resumen): ${f.camera?.verb} — ${f.camera?.summary}`);
console.log('\nTRANSICIÓN DE ENTRADA:', entra ? JSON.stringify(entra) : 'ninguna (primer cuadro)');
console.log('TRANSICIÓN DE SALIDA :', sale ? JSON.stringify(sale) : 'ninguna (último cuadro)');
console.log('\nICONOS:', JSON.stringify(f.icons ?? []));
console.log('AVATARES:', JSON.stringify(f.avatars ?? []));
console.log('READ_MARKS:', JSON.stringify(f.read_marks ?? []));
console.log('HANDOFF_IN :', JSON.stringify(f.handoff_in ?? null));
console.log('HANDOFF_OUT:', JSON.stringify(f.handoff_out ?? null));
if (previo) console.log(`(vecino anterior ${previo.id}) handoff_out: ${JSON.stringify(previo.handoff_out ?? null)}`);
if (siguiente) console.log(`(vecino siguiente ${siguiente.id}) handoff_in: ${JSON.stringify(siguiente.handoff_in ?? null)}`);
console.log('\n---------- HOJA DEL CUADRO (spec) ----------');
console.log(f.spec);
console.log('\n---------- BLOQUE MÁQUINA: cam[] ----------');
console.log(JSON.stringify(f.cam ?? [], null, 1));
console.log('\n---------- BLOQUE MÁQUINA: sfx[] ----------');
console.log(JSON.stringify(f.sfx ?? [], null, 1));
