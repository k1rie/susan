#!/usr/bin/env node
// PROTOTIPO: hornea el sonido de una frase tecleada como UN solo wav, con una muestra de tecla por carácter colocada en el instante
// exacto de cada carácter (los tiempos salen del reloj de texto del cuadro: tabla K1/K2 o los tweens de caracteres de events.json).
// Rotación de 8 teclas distintas + variación de volumen/tono (nunca la misma muestra dos veces seguidas) y límite de polifonía.
// Salida: <lib>/typing-<id>.wav cuyo PRIMER golpe está en t=0 + ancla (ancla del baked = 0.006). Se monta como cue con t = primera tecla.
// Uso: node bake-typing.mjs <cues.json> <lib>
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
const [cuesPath, lib] = [process.argv[2], resolve(process.argv[3])];
const man = JSON.parse(readFileSync(cuesPath, 'utf8'));
const baked = [];
for (const ph of man.typing ?? []) {
    const t0 = ph.teclas[0];
    const ins = [], filtros = [];
    ph.teclas.forEach((t, i) => {
        const k = (i * 5) % 8 + 1; // 5 y 8 son coprimos: recorre las 8 teclas sin repetir consecutivas
        const ms = Math.round((t - t0) * 1000);
        ins.push('-i', join(lib, `key-${k}.wav`));
        const vol = ph.vol * (0.8 + 0.2 * ((i * 7) % 5) / 4);          // 0.8-1.0 del volumen base
        const tono = 1 + (((i * 3) % 5) - 2) * 0.012;                    // +-2.4 % de tono
        filtros.push(`[${i}:a]asetrate=${Math.round(48000 * tono)},aresample=48000,volume=${vol.toFixed(3)},adelay=${ms}|${ms}[k${i}]`);
    });
    const mezcla = ph.teclas.map((_, i) => `[k${i}]`).join('') + `amix=inputs=${ph.teclas.length}:normalize=0[o]`;
    const out = join(lib, `typing-${ph.id}.wav`);
    execFileSync('ffmpeg', ['-v', 'error', '-y', ...ins, '-filter_complex', [...filtros, mezcla].join(';'), '-map', '[o]', '-ar', '48000', '-ac', '2', out]);
    baked.push({ id: ph.id, t: t0, sfx: `typing-${ph.id}`, vol: 1, ref: ph.ref });
    console.log('horneado', out, ph.teclas.length, 'teclas');
}
// meta del horneado: ancla = ancla de la primera tecla (0.006)
const metaPath = join(lib, 'sfx-meta.json');
const meta = JSON.parse(readFileSync(metaPath, 'utf8')).filter((m) => !/^typing-/.test(m.archivo));
for (const b of baked) {
    const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(lib, `${b.sfx}.wav`)], { encoding: 'utf8' }).trim());
    meta.push({ archivo: `${b.sfx}.wav`, duracion: dur, ancla: 0.006, forma: 'horneado', golpes: [] });
}
writeFileSync(metaPath.replace('sfx-meta.json', 'sfx-meta.json'), JSON.stringify(meta, null, 2) + '\n');
man.bakedCues = baked;
writeFileSync(cuesPath, JSON.stringify(man, null, 2) + '\n');
