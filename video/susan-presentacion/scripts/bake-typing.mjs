#!/usr/bin/env node
// Hornea el sonido de cada frase tecleada como UN solo wav, con una muestra de tecla por etiqueta `sfx:key-*` colocada
// (a la muestra: 1/48000 s) en el instante exacto de su etiqueta. Evita 40 <audio> por frase y garantiza la rotacion de teclas.
//
// Uso (CLI):  node scripts/bake-typing.mjs [--root <proyecto>] [--cues v2/sfx-cues.json] [--gap-frase 0.6]
//   Lee los cues key-1..8 / key-enter / key-back de v2/sfx-cues.json, agrupa por cuadro (una frase = teclas con huecos <= gap-frase s)
//   y escribe assets/sfx/baked/<cuadro>-<n>.wav. Lo llama mount-sfx.mjs; usalo solo para depurar.
// API: import { agruparTeclas, hornearFrase } from './bake-typing.mjs'
//
// Cada tecla del horneado: muestra key-N (catalogo) con tono +-2.4 % (remuestreo lineal) y volumen = vol de su etiqueta x 0.94-1.0, de modo que
// nunca suenan dos iguales seguidas. Ganancia de mezcla (v2.1): +6 dB en todas las teclas y +8 dB en el gancho (ver sfx-lib.mjs). El horneado empieza 10 ms antes de la primera tecla: ANCLA_HORNEADO = 0.010 s (la primera tecla cae en 10 ms).
import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXTRA_TECLEO_DB, SR, cargarCatalogo, escribirWav, leerWav, lineal, opcion, raiz, r3, volConGanancia } from './lib/sfx-lib.mjs';

export const ANCLA_HORNEADO = 0.01;
export const esTecla = (nombre) => /^key-(\d|enter|back)$/.test(nombre);

// cues: lista de { id, cuadro, nombre, vol, t }. Devuelve [{ cuadro, n, teclas:[cue...] }] ordenado por tiempo.
export function agruparTeclas(cues, gapFrase = 0.6) {
    const por = {};
    for (const c of cues.filter((x) => esTecla(x.nombre)).sort((a, b) => a.t - b.t)) (por[c.cuadro] ??= []).push(c);
    const frases = [];
    for (const [cuadro, lista] of Object.entries(por)) {
        let n = 0, actual = null;
        for (const c of lista) {
            if (!actual || c.t - actual.teclas.at(-1).t > gapFrase) { actual = { cuadro, n: ++n, teclas: [] }; frases.push(actual); }
            actual.teclas.push(c);
        }
    }
    return frases.sort((a, b) => a.teclas[0].t - b.teclas[0].t);
}

// Mezcla las teclas de una frase. Devuelve { ch:[L,R], dur, ancla, pico } (sin escribir nada).
export function hornearFrase(R, cat, frase) {
    const t0 = frase.teclas[0].t;
    const cache = {};
    const piezas = frase.teclas.map((c, i) => {
        const e = cat[c.nombre];
        if (!e) throw new Error(`bake-typing: "${c.nombre}" no esta en CATALOG.json`);
        const w = (cache[e.file] ??= leerWav(join(R, e.file)));
        const tono = 1 + (((i * 3) % 5) - 2) * 0.012;
        // ganancia de mezcla v2.1: +6 dB de la categoria key (volConGanancia, con el tope de 0.80) y, solo en el gancho, +2 dB mas (EXTRA_TECLEO_DB).
        // Un cue sin volumen en la etiqueta usa volDefecto, que ya trae la ganancia incorporada.
        const base = c.vol != null ? volConGanancia(c.vol, e) : e.volDefecto;
        const vol = base * lineal(EXTRA_TECLEO_DB[frase.cuadro] ?? 0) * (0.94 + 0.06 * (((i * 7) % 5) / 4));
        // el golpe de la tecla (ancla) queda en ANCLA + (t - t0): el remuestreo con rate=tono lo mueve a ancla/tono dentro de la muestra
        const aSamp = (e.anclaMs / 1000 / tono) * SR;
        const inicio = Math.round((ANCLA_HORNEADO + (c.t - t0)) * SR - aSamp);
        return { w, tono, vol, inicio, len: Math.ceil((w.frames - 1) / tono) };
    });
    const total = Math.max(...piezas.map((p) => p.inicio + p.len)) + Math.round(0.02 * SR);
    const out = [new Float32Array(total), new Float32Array(total)];
    for (const p of piezas) {
        for (let k = 0; k < p.len; k++) {
            const pos = k * p.tono, i0 = Math.floor(pos), f = pos - i0, idx = p.inicio + k;
            if (idx < 0 || idx >= total) continue;
            for (let c = 0; c < 2; c++) {
                const s = p.w.ch[Math.min(c, p.w.canales - 1)];
                out[c][idx] += (s[i0] * (1 - f) + (s[i0 + 1] ?? 0) * f) * p.vol;
            }
        }
    }
    const pico = Math.max(...out.map((c) => c.reduce((m, v) => Math.max(m, Math.abs(v)), 0)));
    return { ch: out, dur: total / SR, ancla: ANCLA_HORNEADO, pico };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const R = raiz();
    const cues = JSON.parse(readFileSync(join(R, opcion(process.argv, '--cues', 'v2/sfx-cues.json')), 'utf8')).cues;
    const cat = cargarCatalogo(R);
    const frases = agruparTeclas(cues, Number(opcion(process.argv, '--gap-frase', 0.6)));
    const dir = join(R, 'assets/sfx/baked');
    mkdirSync(dir, { recursive: true });
    for (const f of readdirSync(dir)) if (f.endsWith('.wav')) rmSync(join(dir, f));
    for (const f of frases) {
        const b = hornearFrase(R, cat, f);
        const ruta = join(dir, `${f.cuadro}-${f.n}.wav`);
        escribirWav(ruta, b.ch);
        console.log(`horneado ${ruta}: ${f.teclas.length} teclas, ${r3(f.teclas.at(-1).t - f.teclas[0].t)} s, pico ${b.pico.toFixed(3)}`);
    }
    if (!frases.length) console.log('sin teclas que hornear');
}
