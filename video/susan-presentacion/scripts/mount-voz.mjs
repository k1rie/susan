#!/usr/bin/env node
// Monta la locución en index.html y baja los efectos de sonido mientras habla la voz (ducking).
//
// Entradas: v2/voz-guion.json (qué se dice y en qué instante LOCAL de qué cuadro debe caer cada palabra ancla; el inicio real del cuadro se lee de index.html), v2/voz-alineacion.json (instante de cada carácter,
// de scripts/generar-voz.mjs) y el bloque <!-- sfx:start/end --> que escribió scripts/mount-sfx.mjs.
// Salida: bloque <!-- voz:start/end --> con un <audio> por línea (data-start = t de la ancla − instante de la ancla dentro del clip)
// y los efectos que solapan una frase con data-volume reducido (el original queda en data-vol-orig, así que es idempotente).
// Escribe v2/voz-montada.json con el resultado.
//
// ORDEN DEL PIPELINE (la locución debe ir LO ÚLTIMO, porque build-index y mount-sfx reescriben index.html):
//   build-index -> extract-events --cues -> mount-sfx -> mount-voz -> render
// Uso: node scripts/mount-voz.mjs [--dry] [--sin-ducking]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const seco = args.includes('--dry');
const sinDucking = args.includes('--sin-ducking');

const guion = JSON.parse(readFileSync(join(RAIZ, 'v2/voz-guion.json'), 'utf8'));
const alin = JSON.parse(readFileSync(join(RAIZ, 'v2/voz-alineacion.json'), 'utf8'));
const mz = guion.mezcla;
const ruta = join(RAIZ, 'index.html');
let html = readFileSync(ruta, 'utf8');
const redondea = (n) => Math.round(n * 1000) / 1000;

// 1. Colocar cada línea para que su palabra ancla caiga en su instante visual.
const filas = [];
for (const l of guion.lineas) {
    const a = alin[l.id];
    if (!a) throw new Error(`Falta la alineación de la línea ${l.id}: corre scripts/generar-voz.mjs`);
    const texto = a.caracteres.join('');
    const i = texto.indexOf(l.ancla);
    if (i < 0) throw new Error(`La ancla "${l.ancla}" no está en "${texto}" (línea ${l.id}).`);
    const inicioCuadro = Number(new RegExp(`id="el-${l.ref}"[\\s\\S]*?data-start="([\\d.]+)"`).exec(html)?.[1]);
    if (!Number.isFinite(inicioCuadro)) throw new Error(`No hallé el cuadro ${l.ref} en index.html (línea ${l.id}).`);
    const tAbs = inicioCuadro + l.t_local;
    const inicio = tAbs - a.inicio_s[i];
    filas.push({
        id: l.id,
        frame: l.frame,
        texto: l.texto,
        archivo: a.archivo,
        inicio: redondea(inicio),
        fin: redondea(inicio + a.duracion_s),
        habla_ini: redondea(inicio + a.inicio_s[0]),
        habla_fin: redondea(inicio + a.fin_s[a.fin_s.length - 1]),
        duracion: a.duracion_s,
        ancla: { palabra: l.ancla, t: redondea(tAbs), ref: l.ref, t_local: l.t_local },
    });
}

// 2. Comprobaciones: nada antes de 0, las frases habladas no se pisan.
const problemas = [];
filas.sort((x, y) => x.habla_ini - y.habla_ini);
filas.forEach((f, k) => {
    if (f.inicio < 0) problemas.push(`${f.id}: empieza antes de 0 (${f.inicio} s)`);
    const prev = filas[k - 1];
    if (prev && f.habla_ini < prev.habla_fin + mz.separacion_minima_s) {
        problemas.push(`${f.id}: habla a ${f.habla_ini} s y la línea ${prev.id} termina a ${prev.habla_fin} s (separación < ${mz.separacion_minima_s} s)`);
    }
});
const total = Number(/id="root"[\s\S]*?data-duration="([\d.]+)"/.exec(html)?.[1] ?? 0);
for (const f of filas) if (total && f.fin > total + 0.05) problemas.push(`${f.id}: termina a ${f.fin} s, después del final del video (${total} s)`);
if (problemas.length) {
    console.error('Problemas de colocación:\n - ' + problemas.join('\n - '));
    process.exit(1);
}

// 3. Bloque de audio de la voz (pistas 40/41 alternas: dos líneas contiguas pueden solapar sus colas).
const lineasAudio = filas.map((f, k) => {
    const pista = 40 + (k % 2);
    return `      <audio id="voz-${f.id}" src="${f.archivo}" data-start="${f.inicio}" data-duration="${redondea(f.duracion + 0.02)}" data-track-index="${pista}" data-volume="${mz.volumen_voz}"></audio>`;
});
const bloqueVoz = `      <!-- voz:start (generado por scripts/mount-voz.mjs desde v2/voz-guion.json: data-start = t de la palabra ancla − su instante en el clip; NO editar a mano) -->\n${lineasAudio.join('\n')}\n      <!-- voz:end -->`;

html = html.replace(/\n?[ \t]*<!-- voz:start[^>]*-->[\s\S]*?<!-- voz:end -->[ \t]*/g, '');
const finSfx = html.indexOf('<!-- sfx:end -->');
if (finSfx < 0) throw new Error('No hay bloque sfx en index.html: corre scripts/mount-sfx.mjs antes.');
const corte = finSfx + '<!-- sfx:end -->'.length;
html = html.slice(0, corte) + '\n' + bloqueVoz + html.slice(corte);

// 4. Ducking: los efectos que solapan una frase (con holgura) bajan de volumen; los de impacto, menos.
const ventanas = filas.map((f) => [f.habla_ini - mz.ducking_sfx.antes_s, f.habla_fin + mz.ducking_sfx.despues_s]);
const impacto = new Set(mz.ducking_sfx.categorias_impacto);
let atenuados = 0;
const detalle = [];
if (!sinDucking) {
    html = html.replace(/<audio id="(sfx-[^"]+)"([^>]*)>/g, (todo, id, resto) => {
        const ini = Number(/data-start="([\d.]+)"/.exec(resto)?.[1]);
        const dur = Number(/data-duration="([\d.]+)"/.exec(resto)?.[1]);
        const vol = Number(/data-volume="([\d.]+)"/.exec(resto)?.[1]);
        const orig = Number(/data-vol-orig="([\d.]+)"/.exec(resto)?.[1] ?? vol);
        const archivo = /src="[^"]*\/([^"/]+?)\.wav"/.exec(resto)?.[1] ?? '';
        // Solo cuenta la parte audible del efecto (los clips llevan holgura de duración).
        const fin = ini + Math.min(dur, 0.6);
        const choca = ventanas.some(([a, b]) => ini < b && fin > a);
        const base = resto.replace(/\s*data-vol-orig="[\d.]+"/, '').replace(/data-volume="[\d.]+"/, `data-volume="${orig}"`);
        if (!choca) return `<audio id="${id}"${base}>`;
        const factor = impacto.has(archivo) ? mz.ducking_sfx.factor_impactos : mz.ducking_sfx.factor;
        const nuevo = redondea(orig * factor);
        atenuados++;
        detalle.push({ id, archivo, t: ini, de: orig, a: nuevo });
        return `<audio id="${id}"${base.replace(/data-volume="[\d.]+"/, `data-volume="${nuevo}" data-vol-orig="${orig}"`)}>`;
    });
}

console.log(`Voz: ${filas.length} líneas colocadas (primera ${filas[0].inicio} s, última termina a ${filas[filas.length - 1].habla_fin} s); ${atenuados} efectos atenuados.`);
if (seco) {
    for (const f of filas) console.log(`  ${f.id}  clip ${f.inicio}–${f.fin}  habla ${f.habla_ini}–${f.habla_fin}  ancla "${f.ancla.palabra}"@${f.ancla.t}  ${f.texto}`);
} else {
    writeFileSync(ruta, html);
    writeFileSync(join(RAIZ, 'v2/voz-montada.json'), JSON.stringify({ lineas: filas, ducking: detalle, volumen_voz: mz.volumen_voz }, null, 1));
    console.log('index.html actualizado; detalle en v2/voz-montada.json');
}
