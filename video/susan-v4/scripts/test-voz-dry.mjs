#!/usr/bin/env node
// test-voz-dry.mjs - prueba SIN RED del pipeline de voz de la v4 (generar-voz.mjs + mount-voz.mjs) en el proyecto de juguete.
//
// ElevenLabs no se puede llamar desde esta maquina (sin clave y api.elevenlabs.io bloqueado por la politica de red), asi que la prueba
// usa una alineacion FALSA con la forma exacta de la respuesta /with-timestamps (scripts/test-fixtures/toy-sfx/voz-falsa/NN.json) y
// recorre todo lo demas de verdad: lectura de SCRIPT.md, cache por huella, loudnorm a -17 LUFS, datos/voz-alineacion.json, colocacion
// por anclas, ducking, idempotencia, interaccion con mount-sfx y verify-sfx, y los errores que deben detener el montaje.
// Con render (por omision) tambien comprueba que verify-sfx --video sigue midiendo los SFX con la voz y el ducking en la mezcla.
// Uso: node scripts/test-voz-dry.mjs [--dir <carpeta de trabajo>] [--sin-render]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { CLI_VERSION, DIR_SCRIPTS, opcion } from './lib/rutas.mjs';
import { crearPasos, pasosEnsamblado, prepararJuguete, sh } from './lib/juguete.mjs';
import { leerIndice, quitarBloque } from './lib/indice.mjs';
import { leerWav, lufsIntegrado, picoWav } from './lib/sfx-lib.mjs';
import { derivarRealce } from './lib/voz-lib.mjs';
import { leerStoryboard, normalizarTexto } from './lib/storyboard.mjs';

const D = resolve(opcion(process.argv, '--dir', join(tmpdir(), 'susan-v4-toy-voz')));
const SIN_RENDER = process.argv.includes('--sin-render');
const FIX = join(D, 'voz-falsa');
const env = { ...process.env };
delete env.ELEVENLABS_API_KEY;
delete env.ELEVENLABS_VOICE_ID;
const nodeS = (s, ...a) => sh('node', [join(DIR_SCRIPTS, s), '--root', D, ...a], { env });
const { paso, resumen } = crearPasos();
const afirmar = (titulo, ok, detalle = '') => paso(titulo, { status: ok ? 0 : 1, stdout: detalle });
const leer = (r) => readFileSync(join(D, r), 'utf8');

// ---- 1. juguete ensamblado con sus SFX
prepararJuguete(D);
console.log(`juguete en ${D}`);
for (const [titulo, f] of pasosEnsamblado(D)) paso(titulo, f());
paso('mount-sfx.mjs', nodeS('mount-sfx.mjs'));
const indiceSinVoz = leer('index.html');

// ---- 2. generar-voz sin red
paso('generar-voz --seco sin clave: valida y estima creditos sin escribir', nodeS('generar-voz.mjs', '--seco'), { patron: /se generarian 69 caracteres/ });
afirmar('--seco no escribe nada', !existsSync(join(D, 'datos/voz-alineacion.json')) && !existsSync(join(D, 'assets/voz')));
paso('CONTROL generar-voz sin clave ni --fixture se niega (no llama a la API)', nodeS('generar-voz.mjs'), { debeFallar: true, patron: /falta ELEVENLABS_API_KEY.*\.env/ });
paso('generar-voz --fixture (alineacion falsa, sin red)', nodeS('generar-voz.mjs', '--fixture', FIX), { patron: /3 generadas, 0 reutilizadas/ });
const alin = JSON.parse(leer('datos/voz-alineacion.json'));
afirmar('voz-alineacion.json: 3 lineas con caracteres, inicios, fines y marca fixture', ['01', '02', '03'].every((id) => alin[id]?.fixture && alin[id].caracteres.length === alin[id].inicio_s.length && alin[id].fin_s.length === alin[id].inicio_s.length), JSON.stringify(Object.keys(alin)));
const lufs = ['01', '02', '03'].map((id) => { const w = leerWav(join(D, `assets/voz/${id}.wav`)); return { id, sr: w.sr, canales: w.canales, lufs: lufsIntegrado([w.ch[0], w.ch[0]]) - 3.01 }; });
afirmar('assets/voz/NN.wav: 48 kHz mono a -17 LUFS (+-0.5)', lufs.every((x) => x.sr === 48000 && x.canales === 1 && Math.abs(x.lufs + 17) <= 0.5), JSON.stringify(lufs.map((x) => ({ ...x, lufs: Math.round(x.lufs * 100) / 100 }))));
paso('generar-voz --fixture otra vez: todo sale de voz-cache/', nodeS('generar-voz.mjs', '--fixture', FIX), { patron: /0 generadas, 3 reutilizadas/ });
// realce por linea (voz-lib.derivarRealce, lo usa mount-voz con VOZ.mezcla.realce_por_linea): sube el nivel, el limitador respeta su techo,
// sale PCM 16 bit mono a 48 kHz y volver a derivar da el mismo archivo byte a byte (git no ve cambios al re-ejecutar)
{
    const origen = join(D, 'assets/voz/03.wav'), r = { db: 4, limite: 0.8, ataque_ms: 2, relajacion_ms: 40 };
    const dos = [join(D, 'realce-prueba/a.wav'), join(D, 'realce-prueba/b.wav')];
    for (const d of dos) derivarRealce(origen, d, r);
    const w0 = leerWav(origen), w1 = leerWav(dos[0]);
    const lufs = (w) => lufsIntegrado([w.ch[0], w.ch[0]]) - 3.01;
    afirmar('derivarRealce: sube el nivel, pico <= limite, 48 kHz mono 16 bit', w1.sr === 48000 && w1.canales === 1 && w1.frames === w0.frames && lufs(w1) > lufs(w0) + 0.5 && picoWav(w1) <= r.limite + 0.01,
        JSON.stringify({ lufs0: Math.round(lufs(w0) * 100) / 100, lufs1: Math.round(lufs(w1) * 100) / 100, pico: Math.round(picoWav(w1) * 1000) / 1000, frames: [w0.frames, w1.frames] }));
    afirmar('derivarRealce: determinista (mismos bytes al repetir)', readFileSync(dos[0]).equals(readFileSync(dos[1])));
}

// ---- 3. montaje por anclas
paso('mount-voz --dry no escribe', nodeS('mount-voz.mjs', '--dry'));
afirmar('index.html intacto tras --dry', leer('index.html') === indiceSinVoz);
paso('mount-voz.mjs', nodeS('mount-voz.mjs'));
const conVoz = leer('index.html');
const i0 = leerIndice(indiceSinVoz), i1 = leerIndice(conVoz);
afirmar('ningun cuadro cambia (duracion y envoltorios identicos)', JSON.stringify([i0.duracion, i0.cuadros]) === JSON.stringify([i1.duracion, i1.cuadros]));
const normalVol = (h) => quitarBloque(h, 'voz').replace(/ data-volume="[\d.]+" data-vol-orig="([\d.]+)"/g, ' data-volume="$1"');
afirmar('fuera del bloque de voz y del ducking, el indice es identico', normalVol(conVoz) === indiceSinVoz);
// cada palabra ancla, medida de forma independiente: data-start del <audio> + instante de la palabra en el clip == inicio del cuadro + t local
const sb = leerStoryboard(leer('STORYBOARD.md'));
const anclasEsperadas = [['01', 1, 'tarjeta', 0.6], ['02', 2, 'línea', 0.8], ['02', 2, 'dibuja', 1.25], ['03', 3, 'todo', 0.4]];
const medidas = anclasEsperadas.map(([id, frame, palabra, t]) => {
    const a = alin[id], texto = a.caracteres.join('');
    const k = normalizarTexto(texto).split(' ').indexOf(normalizarTexto(palabra));
    const idx = texto.split(' ').slice(0, k).join(' ').length + (k > 0 ? 1 : 0);
    const audio = i1.voz.find((x) => x.id === `voz-${id}`);
    const cuadro = i1.cuadros.find((c) => c.id === sb.frames.find((f) => f.numero === frame).frameId);
    return { id, palabra, objetivo: cuadro.start + t, real: Math.round((audio.start + a.inicio_s[idx]) * 1000) / 1000 };
});
const err = medidas.map((m) => Math.abs(m.real - m.objetivo));
afirmar('anclas unicas exactas (<= 1 ms) y dobles dentro de la holgura (<= 0.3 s)', err[0] <= 0.001 && err[3] <= 0.001 && err[1] <= 0.3 && err[2] <= 0.3, JSON.stringify(medidas));
const vm = JSON.parse(leer('datos/voz-montada.json'));
const thud = i1.sfx.find((x) => x.id === 'sfx-s01-tarjeta-7'), cierre = i1.sfx.find((x) => x.id === 'sfx-s03-cierre-3');
afirmar('ducking: SFX bajo la voz x0.3, impactos x0.6, los de fuera intactos', vm.ducking.length > 0 && thud.volOrig === 0.75 && Math.abs(thud.volume - 0.45) < 1e-9 && cierre.volOrig === null && i1.sfx.filter((x) => x.volOrig !== null).every((x) => Math.abs(x.volume - x.volOrig * (x.id === 'sfx-s01-tarjeta-7' ? 0.6 : 0.3)) < 0.0011), JSON.stringify(vm.ducking.slice(0, 4)));
paso('mount-voz otra vez', nodeS('mount-voz.mjs'));
afirmar('idempotencia de mount-voz', leer('index.html') === conVoz);
paso('mount-sfx despues de la voz (reaplica el ducking)', nodeS('mount-sfx.mjs'), { patron: /ducking reaplicado/ });
afirmar('mount-sfx + ducking reaplicado deja el mismo indice', leer('index.html') === conVoz);
paso('verify-sfx --solo montaje (ducking coherente, pico SFX + voz <= -1 dBFS)', nodeS('verify-sfx.mjs', '--solo', 'montaje'), { patron: /SFX \+ voz/ });
paso('verify-sfx --solo cues con las ventanas REALES de la voz', nodeS('verify-sfx.mjs', '--solo', 'cues'), { patron: /voz montada/ });

// ---- 4. controles que deben fallar
const sbOrig = leer('STORYBOARD.md'), scOrig = leer('SCRIPT.md');
const con = (archivo, original, de, a, accion) => {
    if (!original.includes(de)) { console.log(`PRUEBA FALLIDA: el control no encuentra "${de}" en ${archivo}`); process.exit(1); }
    writeFileSync(join(D, archivo), original.replace(de, a));
    try { accion(); } finally { writeFileSync(join(D, archivo), original); }
};
con('STORYBOARD.md', sbOrig, '1.60 impact-lite -6dB; 1.60 check', '0.90 check', () => {
    paso('mount-sfx con un check dentro de la frase 03', nodeS('mount-sfx.mjs'));
    paso('CONTROL verify-sfx: golpe fuerte dentro de una frase REAL = ERROR', nodeS('verify-sfx.mjs', '--solo', 'cues'), { debeFallar: true, patron: /s03-cierre-\d \(check, check\).*dentro de la frase 03/ });
});
paso('mount-sfx restaurado', nodeS('mount-sfx.mjs'));
con('SCRIPT.md', scOrig, '«tarjeta» @ 0.60s', '«carta» @ 0.60s', () => paso('CONTROL mount-voz: palabra ancla que no esta en la frase', nodeS('mount-voz.mjs', '--dry'), { debeFallar: true, patron: /"carta" no esta/ }));
con('SCRIPT.md', scOrig, '«dibuja» @ 1.25s', '«dibuja» @ 2.10s', () => paso('CONTROL mount-voz: anclas incompatibles (> holgura 0.3 s; no se estira nada)', nodeS('mount-voz.mjs', '--dry'), { debeFallar: true, patron: /holgura 0\.3 s/ }));
con('SCRIPT.md', scOrig, '«tarjeta» @ 0.60s', '«tarjeta» @ 2.00s', () => paso('CONTROL mount-voz: dos frases que se pisan', nodeS('mount-voz.mjs', '--dry'), { debeFallar: true, patron: /separacion/ }));
con('SCRIPT.md', scOrig, '«todo» @ 0.40s', '«todo» @ 2.90s', () => paso('CONTROL mount-voz: frase que pasa del final del video', nodeS('mount-voz.mjs', '--dry'), { debeFallar: true, patron: /despues del final del video/ }));
con('SCRIPT.md', scOrig, 'Y todo cuadra.', 'Y todo encaja.', () => paso('CONTROL mount-voz: el texto cambio y la voz no se regenero', nodeS('mount-voz.mjs', '--dry'), { debeFallar: true, patron: /el texto cambio/ }));
afirmar('los controles no tocaron el indice', leer('index.html') === conVoz);

if (SIN_RENDER) { console.log(`\n${resumen.join('\n')}\n\nPRUEBA DE VOZ COMPLETA (sin render)`); process.exit(0); }

// ---- 5. render con voz + ducking y verificacion de los SFX sobre el MP4 (la voz entra como fondo de la mezcla ideal)
mkdirSync(join(D, 'renders'), { recursive: true });
paso(`hyperframes@${CLI_VERSION} render --quality draft (con voz)`, sh('npx', ['--yes', `hyperframes@${CLI_VERSION}`, 'render', '--quality', 'draft', '--output', 'renders/toy-voz.mp4'], { cwd: D }));
paso('verify-sfx --video con voz y ducking (los SFX siguen a <= 33.3 ms)', nodeS('verify-sfx.mjs', '--solo', 'render', '--video', join(D, 'renders/toy-voz.mp4')), { patron: /17\/17 cues dentro/ });
console.log(`\n${resumen.join('\n')}\n\nPRUEBA DE VOZ COMPLETA (juguete en ${D})`);
