#!/usr/bin/env node
// test-sfx-toy.mjs - PRUEBA REAL de la maquina de sonido de la v4 en un proyecto de juguete (NO toca el proyecto del video).
//
// Copia scripts/test-fixtures/toy-sfx (3 cuadros de 960x540, STORYBOARD.md con sfx_cues y SCRIPT.md) a una carpeta de trabajo, le agrega
// la biblioteca derivada (assets/sfx/CATALOG.json + derived/) y GSAP local del proyecto, y corre la cadena real de la v4:
//   assemble-index.mjs (skill) -> localizar-gsap.mjs -> transitions.mjs inject + verify (skill) -> mount-sfx.mjs (x2: idempotente)
//   -> hyperframes lint (0.8.134) -> verify-sfx.mjs (biblioteca, cues, montaje) -> CONTROLES NEGATIVOS (deben fallar)
//   -> hyperframes render (0.8.134) -> verify-sfx.mjs --video -> CONTROLES de desfase sobre el MP4 (+-5/20 ms pasan, +40/+-80 ms fallan).
// Uso: node scripts/test-sfx-toy.mjs [--dir <carpeta de trabajo>] [--sin-render]
// Sale con codigo 1 si cualquier paso positivo falla o si un control negativo NO falla.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { CLI_VERSION, DIR_SCRIPTS, opcion } from './lib/rutas.mjs';
import { SKILL, crearPasos, pasosEnsamblado, prepararJuguete, sh } from './lib/juguete.mjs';

const D = resolve(opcion(process.argv, '--dir', join(tmpdir(), 'susan-v4-toy-sfx')));
const SIN_RENDER = process.argv.includes('--sin-render');
const nodeS = (s, ...a) => sh('node', [join(DIR_SCRIPTS, s), '--root', D, ...a]);
const { paso, resumen } = crearPasos();

// ---- 1-2. proyecto de juguete y ensamblado real (scripts de la skill) + GSAP local + transiciones
prepararJuguete(D);
console.log(`juguete en ${D}`);
for (const [titulo, f] of pasosEnsamblado(D)) paso(titulo, f());

// ---- 3. montaje de SFX (dos veces: el indice debe quedar identico)
paso('mount-sfx.mjs', nodeS('mount-sfx.mjs'));
const tras1 = readFileSync(join(D, 'index.html'), 'utf8');
paso('mount-sfx.mjs (segunda corrida)', nodeS('mount-sfx.mjs'));
const idem = readFileSync(join(D, 'index.html'), 'utf8') === tras1;
paso('idempotencia: index.html identico tras dos corridas', { status: idem ? 0 : 1, stdout: idem ? 'identico' : 'CAMBIO entre corridas' });
paso('transitions.mjs verify (el bloque sfx no rompe los envoltorios)', sh('node', [join(SKILL, 'transitions.mjs'), 'verify', '--storyboard', './STORYBOARD.md', '--index', './index.html'], { cwd: D }));
const lint = sh('npx', ['--yes', `hyperframes@${CLI_VERSION}`, 'lint', '--json'], { cwd: D });
let nErr = -1;
try { nErr = JSON.parse(lint.stdout).errorCount; } catch { /* salida no JSON */ }
paso(`hyperframes@${CLI_VERSION} lint (0 errores con el bloque sfx)`, { status: nErr === 0 ? 0 : 1, stdout: nErr === 0 ? `0 errores` : `${lint.stdout}\n${lint.stderr}` });
paso('verify-sfx.mjs (biblioteca, cues, montaje)', nodeS('verify-sfx.mjs'));

// ---- 4. CONTROLES NEGATIVOS (cada uno sobre una copia del storyboard; el original se restaura)
const sbRuta = join(D, 'STORYBOARD.md');
const sbOriginal = readFileSync(sbRuta, 'utf8');
const conStoryboard = (titulo, de, a, accion) => {
    if (!sbOriginal.includes(de)) { console.log(`PRUEBA FALLIDA: el control "${titulo}" no encuentra "${de}"`); process.exit(1); }
    writeFileSync(sbRuta, sbOriginal.replace(de, a));
    try { accion(); } finally { writeFileSync(sbRuta, sbOriginal); }
};
conStoryboard('obsoleto', '2.20 sheen-s', '2.20 sparkle-short', () => paso('CONTROL mount-sfx rechaza un obsoleto (sparkle-short)', nodeS('mount-sfx.mjs', '--dry'), { debeFallar: true, patron: /obsoleto/ }));
conStoryboard('alias', '1.00 pop-1', '1.00 pop', () => paso('CONTROL mount-sfx rechaza un alias heredado (pop -> pop-2)', nodeS('mount-sfx.mjs', '--dry'), { debeFallar: true, patron: /alias heredado.*"pop-2"/ }));
conStoryboard('desconocido', '1.90 tap', '1.90 boom', () => paso('CONTROL mount-sfx rechaza un nombre que no existe', nodeS('mount-sfx.mjs', '--dry'), { debeFallar: true, patron: /no esta en assets\/sfx\/CATALOG\.json/ }));
conStoryboard('sintaxis', '1.90 tap', '1,90 tap', () => paso('CONTROL mount-sfx rechaza la coma decimal', nodeS('mount-sfx.mjs', '--dry'), { debeFallar: true, patron: /punto decimal/ }));
conStoryboard('fuera', '2.50 thud', '3.40 thud', () => paso('CONTROL mount-sfx rechaza un cue fuera de la duracion del cuadro', nodeS('mount-sfx.mjs', '--dry'), { debeFallar: true, patron: /pasa de la duracion/ }));
conStoryboard('ganancia', '1.90 tap', '1.90 tap +9dB', () => paso('CONTROL mount-sfx rechaza una ganancia fuera de -24..+6 dB', nodeS('mount-sfx.mjs', '--dry'), { debeFallar: true, patron: /fuera de -24/ }));
const remontar = () => { const r = nodeS('mount-sfx.mjs'); if (r.status !== 0) { console.log(r.stdout, r.stderr); process.exit(1); } };
conStoryboard('desfase 80 ms', '1.90 tap', '1.98 tap', () => { remontar(); paso('CONTROL verify-sfx detecta un cue 80 ms tarde (huerfano)', nodeS('verify-sfx.mjs', '--solo', 'cues'), { debeFallar: true, patron: /s01-tarjeta-5 .*ningun tween/ }); });
conStoryboard('ticks por entero', '1.60 tick-2; 1.75 tick-4', '1.62 tick-1; 1.66 tick-2; 1.70 tick-3; 1.74 tick-4; 1.78 tick-1', () => { remontar(); paso('CONTROL verify-sfx rechaza ticks por entero', nodeS('verify-sfx.mjs', '--solo', 'cues'), { debeFallar: true, patron: /ticks por entero/ }); });
conStoryboard('whoosh-rev', '- sfx_cues: 0.30 soft-in;', '- sfx_cues: 0.25 whoosh-rev; 0.30 soft-in;', () => { remontar(); paso('CONTROL verify-sfx rechaza whoosh-rev en el cierre', nodeS('verify-sfx.mjs', '--solo', 'cues'), { debeFallar: true, patron: /whoosh-rev en el cierre/ }); });
conStoryboard('salto de nivel', '0.30 soft-in; 0.90 fill -3dB; 1.60 impact-lite -6dB', '0.30 soft-in -24dB; 0.90 fill -24dB; 1.60 impact-lite +6dB', () => { remontar(); paso('CONTROL verify-sfx rechaza una subida de nivel > 12 dB entre segundos', nodeS('verify-sfx.mjs', '--solo', 'montaje'), { debeFallar: true, patron: /subida de nivel de/ }); });
conStoryboard('golpe en la voz', '1.60 impact-lite -6dB; 1.60 check', '0.90 check', () => {
    remontar();
    const r = paso('CONTROL golpe fuerte dentro de una frase estimada (**Time:**): aviso, no error', nodeS('verify-sfx.mjs', '--solo', 'cues'));
    if (!/dentro de la frase 03/.test(r.stdout)) { console.log('PRUEBA FALLIDA: no se aviso del check dentro de la frase 03'); process.exit(1); }
});
remontar();
paso('verify-sfx.mjs tras restaurar el storyboard', nodeS('verify-sfx.mjs', '--solo', 'cues'));

if (SIN_RENDER) { console.log(`\n--sin-render: fin\n\n${resumen.join('\n')}\n\nPRUEBA COMPLETA (sin render)`); process.exit(0); }

// ---- 5. render real y verificacion sobre el MP4
mkdirSync(join(D, 'renders'), { recursive: true });
paso(`hyperframes@${CLI_VERSION} render --quality draft`, sh('npx', ['--yes', `hyperframes@${CLI_VERSION}`, 'render', '--quality', 'draft', '--output', 'renders/toy.mp4'], { cwd: D }));
paso('verify-sfx.mjs --video (correlacion de ataque, tolerancia 33.3 ms)', nodeS('verify-sfx.mjs', '--solo', 'render', '--video', join(D, 'renders/toy.mp4')));

// ---- 6. CONTROLES sobre el MP4: el manifiesto declara un cue (pop-3) desplazado respecto a su sonido real.
//   +-5 y +-20 ms (dentro de un fotograma): deben PASAR y el error medido debe ser el desplazamiento (< 1 ms de diferencia).
//   +40 y +-80 ms (fuera de 33.3 ms): DEBEN FALLAR.
const efectivo = JSON.parse(readFileSync(join(D, 'datos/sfx-efectivo.json'), 'utf8'));
const objetivo = efectivo.cues.find((x) => x.sfx === 'pop-3');
const py = process.env.SUSAN_PYTHON || 'python3';
const filas = [];
for (const [desp, debeFallar] of [[5, false], [-5, false], [20, false], [-20, false], [40, true], [80, true], [-80, true]]) {
    const malo = JSON.parse(JSON.stringify(efectivo));
    const c = malo.cues.find((x) => x.id === objetivo.id);
    c.tCue = Math.round((c.tCue + desp / 1000) * 1000) / 1000;
    const ruta = join(D, `datos/efectivo-desp${desp}.json`), out = join(D, `datos/sync-desp${desp}.json`);
    writeFileSync(ruta, JSON.stringify(malo));
    const r = sh(py, [join(DIR_SCRIPTS, 'verify-sfx-sync.py'), ruta, join(D, 'renders/toy.mp4'), '--root', D, '--out', out]);
    const j = JSON.parse(readFileSync(out, 'utf8'));
    const fila = j.cues.find((x) => x.id === objetivo.id);
    const otros = j.cues.filter((x) => x.id !== objetivo.id && !x.ok).length;
    const bien = debeFallar ? fila.ok === false && r.status === 1 : fila.ok && Math.abs(fila.errorMs + desp) < 1.0 && otros === 0;
    filas.push({ desp, debeFallar, fila, otros, bien });
}
console.log('\n=== CONTROLES de desfase sobre el MP4 (cue pop-3)');
for (const f of filas) console.log(`  ${String(f.desp).padStart(4)} ms: esperado ${f.debeFallar ? 'FALLA' : 'PASA '} obtenido ${f.fila.ok ? 'PASA ' : 'FALLA'} (error medido ${f.fila.errorMs} ms, rho ${f.fila.rho}, ganancia ${f.fila.ganancia}; otros cues con fallo: ${f.otros}) ${f.bien ? 'OK' : 'MAL'}`);
const malos = filas.filter((f) => !f.bien);
resumen.push(`${malos.length ? 'FALLO' : 'OK   '} CONTROLES de desfase sobre el MP4 (${filas.length - malos.length}/${filas.length})`);
if (malos.length) { console.log('PRUEBA FALLIDA en los controles de desfase'); process.exit(1); }
console.log(`\n${resumen.join('\n')}\n\nPRUEBA COMPLETA: montaje idempotente, 0 cues desfasados en el render, controles negativos detectados (juguete en ${D})`);
if (existsSync(join(D, 'renders/toy.mp4'))) console.log(`render: ${join(D, 'renders/toy.mp4')}`);
