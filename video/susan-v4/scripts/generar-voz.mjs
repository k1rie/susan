#!/usr/bin/env node
// generar-voz.mjs - genera la locucion de la v4 con ElevenLabs a partir de SCRIPT.md (una linea por cuadro, PLAYBOOK 2.1).
//
// Por linea: POST /v1/text-to-speech/<voz>/with-timestamps (audio + instante de cada caracter), con el texto vecino como contexto de
// entonacion; loudnorm de dos pasadas a -17 LUFS (pico verdadero -1.5 dB) y salida assets/voz/<NN>.wav (48 kHz mono 16 bit, sin
// retardo de codificador: la alineacion sigue valiendo al milisegundo) + datos/voz-alineacion.json (inicio/fin de cada caracter).
// Ajustes probados en la v3 (lib/voz-lib.mjs): eleven_multilingual_v2, stability 0.35, similarity 0.8, style 0.45, semilla 1037.
// Por linea se pueden cambiar en SCRIPT.md: **Seed:**, **Settings:** (stability/similarity/style), **Speed:** (atempo despues de
// generar: la API no aplico la velocidad de forma fiable en la v3), **Context:** none (sin texto vecino: inicio limpio) y **Take:**
// (fija una toma ya aprobada por su huella de la cache).
//
// Clave: ELEVENLABS_API_KEY del entorno o de <proyecto>/.env (gitignored); nunca se pasa por argumentos ni se imprime. Voz:
// **Voice id:** de SCRIPT.md > ELEVENLABS_VOICE_ID > «Antonio» de la v3 (con aviso). Cada llamada gasta creditos (~1 por caracter): lo
// generado con el mismo texto y ajustes se reutiliza desde voz-cache/ (gitignored) salvo --forzar.
// Red: api.elevenlabs.io esta bloqueado por la politica de red de esta maquina (2026-10-06); detras de un proxy, Node necesita
// NODE_USE_ENV_PROXY=1 para que fetch lo use.
//
// Uso: node scripts/generar-voz.mjs [--root <proyecto>] [--solo 01,03] [--forzar] [--seco] [--elegir N] [--fixture <carpeta>]
//   --seco        no llama a la API ni escribe: valida SCRIPT.md, muestra lo que se pediria y los creditos estimados (no necesita clave)
//   --fixture DIR modo sin red para probar el pipeline: en lugar de la API lee DIR/<NN>.json con la forma de la respuesta with-timestamps
//                 ({ alignment: { characters, character_start_times_seconds, character_end_times_seconds }, audio_base64? }); si no trae
//                 audio sintetiza un tono por caracter con esa alineacion. La cache lleva la marca 'fixture' (no pisa tomas reales).
//   --elegir N    (con --solo) genera N tomas por linea (semillas 1037, 1074, ...), las califica con Speech to Text (idioma y palabras
//                 oidas) y guarda la mejor en datos/voz-tomas.json (SCRIPT.md no se reescribe).
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { bandera, leerJson, opcion, r3, raiz, rutas } from './lib/rutas.mjs';
import { leerScript, leerStoryboard, normalizarTexto, parseAnclas } from './lib/storyboard.mjs';
import { VOZ, credenciales } from './lib/voz-lib.mjs';
import { SR, escribirWav } from './lib/sfx-lib.mjs';

const argv = process.argv;
const R = raiz(argv);
const P = rutas(R);
const FORZAR = bandera(argv, '--forzar');
const SECO = bandera(argv, '--seco');
const FIXTURE = opcion(argv, '--fixture') ? resolve(opcion(argv, '--fixture')) : null;
const N_ELEGIR = Number(opcion(argv, '--elegir', 0));
const SOLO = opcion(argv, '--solo') ? new Set(opcion(argv, '--solo').split(',').map((x) => x.trim().padStart(2, '0'))) : null;
const PALABRAS_POR_SEG = 2.6;   // ritmo de planeacion (PLAYBOOK 2.2: ~2.7 medido en la v3, con margen)

const ffmpeg = (a) => spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-y', ...a], { encoding: 'utf8' });
const morir = (msg) => { console.error(`generar-voz: ${msg}`); process.exit(1); };

// ---- 1. guion y coherencia con el storyboard
if (!existsSync(P.script)) morir(`falta ${P.script}`);
const sc = leerScript(readFileSync(P.script, 'utf8'));
const sb = existsSync(P.storyboard) ? leerStoryboard(readFileSync(P.storyboard, 'utf8')) : { frames: [] };
const avisos = [...sc.avisos];
if (sc.errores.length) morir(`SCRIPT.md con errores:\n  ${sc.errores.join('\n  ')}`);
if (!sc.lineas.length) morir('SCRIPT.md no tiene lineas "## Line N — ... (Frame N)"');
for (const l of sc.lineas) {
    const f = sb.frames.find((x) => x.numero === l.frame);
    if (!f) { avisos.push(`Line ${l.numero}: el Frame ${l.frame} no esta en STORYBOARD.md`); continue; }
    if (f.voiceover && normalizarTexto(f.voiceover) !== normalizarTexto(l.texto)) avisos.push(`Line ${l.numero}: el texto no coincide con voiceover del Frame ${l.frame} ("${f.voiceover}")`);
    const va = parseAnclas(f.voAnchorCrudo ?? '').anclas;
    const igual = va.length === l.anclas.length && va.every((a, i) => normalizarTexto(a.palabra) === normalizarTexto(l.anclas[i].palabra) && Math.abs(a.t - l.anclas[i].t) < 1e-6);
    if (!igual) avisos.push(`Line ${l.numero}: **Anchor:** no coincide con vo_anchor del Frame ${l.frame} (manda SCRIPT.md)`);
    if (/\bSUSAN\b/.test(l.texto)) avisos.push(`Line ${l.numero}: "SUSAN" en mayusculas: ElevenLabs lo deletrea; escribe "susan" (SINTESIS 3)`);
    if (/\d/.test(l.texto)) avisos.push(`Line ${l.numero}: cifras con digitos ("${l.texto}"): escribelas con letra ("veinte por ciento", SINTESIS 3)`);
    const palabras = l.texto.split(/\s+/).filter(Boolean).length;
    l.palabras = palabras;
    if (l.ventana) {
        const est = palabras / PALABRAS_POR_SEG, hueco = l.ventana.hasta - l.ventana.desde;
        if (est > hueco + 0.3) avisos.push(`Line ${l.numero}: ${palabras} palabras ~ ${r3(est)} s a ${PALABRAS_POR_SEG} p/s y **Time:** da ${r3(hueco)} s: recorta el texto (no se estiran cuadros)`);
    }
}
const total = sc.lineas.reduce((a, l) => a + l.palabras, 0);
console.log(`[voz] SCRIPT.md: ${sc.lineas.length} lineas, ${total} palabras (SINTESIS 2: 95-105, tope 110), ${sc.lineas.reduce((a, l) => a + l.texto.length, 0)} caracteres`);
if (total > 110) avisos.push(`${total} palabras > 110 (SINTESIS 2)`);

// ---- 2. credenciales y voz
const cred = credenciales(P.env);
const VOZ_ID = sc.cabecera.vozId || cred.vozId || VOZ.vozV3;
if (!sc.cabecera.vozId && !cred.vozId) avisos.push(`sin **Voice id:** ni ELEVENLABS_VOICE_ID: se usa «Antonio» de la v3 (${VOZ.vozV3}); exige plan de pago por API`);
if (!SECO && !FIXTURE && !cred.clave) morir(`falta ELEVENLABS_API_KEY: ponla en el entorno o en ${P.env} (gitignored) como ELEVENLABS_API_KEY=...; para probar sin red usa --fixture <carpeta> o --seco`);
for (const a of avisos) console.log(`[voz] AVISO ${a}`);

const tomasRuta = P.vozTomas;
const tomas = leerJson(tomasRuta) ?? {};
mkdirSync(P.vozCache, { recursive: true });
if (!SECO) mkdirSync(P.vozDir, { recursive: true });

// loudnorm de dos pasadas (clips cortos: la 1.a mide, la 2.a aplica lineal)
function normalizar(entrada, salida) {
    const { objetivo_lufs_por_linea: I, pico_verdadero_db: TP } = VOZ.mezcla;
    const p1 = ffmpeg(['-i', entrada, '-af', `loudnorm=I=${I}:TP=${TP}:LRA=7:print_format=json`, '-f', 'null', '-']);
    const json = /\{[\s\S]*"target_offset"[\s\S]*?\}/.exec(p1.stderr)?.[0];
    if (!json) throw new Error('loudnorm no devolvio mediciones: ' + p1.stderr.slice(-300));
    const m = JSON.parse(json);
    const filtro = `loudnorm=I=${I}:TP=${TP}:LRA=7:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
    const p2 = ffmpeg(['-i', entrada, '-af', filtro, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', salida]);
    if (p2.status !== 0) throw new Error('ffmpeg fallo al normalizar: ' + p2.stderr.slice(-300));
    return { entrada_lufs: Number(m.input_i), entrada_pico_db: Number(m.input_tp) };
}

// Audio de prueba para --fixture: un tono (fundamental + 2 armonicos) por cada caracter que no es espacio, con la alineacion dada.
function sintetizar(al, ruta) {
    const fin = Math.max(...al.character_end_times_seconds) + 0.15;
    const n = Math.ceil(fin * SR), x = new Float32Array(n);
    al.characters.forEach((ch, i) => {
        if (/\s/.test(ch)) return;
        const a = Math.round(al.character_start_times_seconds[i] * SR), b = Math.round(al.character_end_times_seconds[i] * SR);
        const f0 = 140 + 12 * (i % 5), fade = Math.round(0.006 * SR);
        for (let k = a; k < b && k < n; k++) {
            const env = Math.min(1, (k - a) / fade, (b - k) / fade);
            const t = k / SR;
            x[k] += 0.3 * env * (Math.sin(2 * Math.PI * f0 * t) + 0.5 * Math.sin(4 * Math.PI * f0 * t) + 0.25 * Math.sin(6 * Math.PI * f0 * t));
        }
    });
    escribirWav(ruta, [x], SR);
}

async function llamarApi(cuerpo, id) {
    let res;
    try {
        res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOZ_ID}/with-timestamps?output_format=${VOZ.formato}`, {
            method: 'POST', headers: { 'xi-api-key': cred.clave, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
        });
    } catch (e) {
        throw new Error(`no se pudo llegar a api.elevenlabs.io (${e.cause?.code ?? e.message}): ¿politica de red o proxy? (detras de un proxy: NODE_USE_ENV_PROXY=1)`);
    }
    if (!res.ok) throw new Error(`ElevenLabs respondio ${res.status} en la linea ${id}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
}

// Califica una toma con Speech to Text: idioma detectado y si se oyen exactamente las palabras del guion.
async function calificar(audio, texto) {
    const fd = new FormData();
    fd.append('model_id', 'scribe_v1');
    fd.append('file', new Blob([readFileSync(audio)], { type: 'audio/mpeg' }), 'toma.mp3');
    const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': cred.clave }, body: fd });
    if (!r.ok) throw new Error(`Speech to Text respondio ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const d = await r.json();
    const esp = normalizarTexto(texto).split(' '), oido = normalizarTexto(d.text || '').split(' ').filter(Boolean);
    const faltan = esp.filter((w) => !oido.includes(w)).length, sobran = oido.filter((w) => !esp.includes(w)).length;
    const prob = d.language_code === 'spa' ? d.language_probability : 0;
    return { puntaje: prob - 0.35 * (faltan + sobran), prob, idioma: d.language_code, oido: d.text, faltan, sobran };
}

// ---- 3. lineas
const alineacion = leerJson(P.vozAlineacion) ?? {};
let caracteres = 0, generadas = 0, reutilizadas = 0;
const lineas = sc.lineas;
const cuerpoDe = (l, i, semilla) => ({
    text: l.texto, model_id: VOZ.modelo, language_code: VOZ.idioma,
    voice_settings: { ...VOZ.ajustes, ...(l.opciones.ajustes ?? {}) },
    previous_text: l.opciones.sinContexto ? undefined : lineas[i - 1]?.texto ?? undefined,
    next_text: l.opciones.sinContexto ? undefined : lineas[i + 1]?.texto ?? undefined,
    seed: semilla,
});
const huellaDe = (cuerpo) => createHash('sha256').update(JSON.stringify(FIXTURE ? ['fixture', VOZ_ID, cuerpo] : [VOZ_ID, cuerpo])).digest('hex').slice(0, 16);

for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    if (SOLO && !SOLO.has(l.id)) continue;
    let semilla = l.opciones.semilla ?? tomas[l.id]?.semilla ?? VOZ.semilla;
    if (N_ELEGIR > 0) {
        if (!SOLO) morir('--elegir necesita --solo (cada toma gasta creditos)');
        if (SECO || FIXTURE) morir('--elegir necesita la API real (Speech to Text)');
        const pruebas = [];
        for (let k = 0; k < N_ELEGIR; k++) {
            const sem = VOZ.semilla + k * 37;
            const c = cuerpoDe(l, i, sem), h = huellaDe(c), rc = join(P.vozCache, `${l.id}-${h}.json`);
            const resp = existsSync(rc) ? JSON.parse(readFileSync(rc, 'utf8')) : await llamarApi(c, l.id);
            if (!existsSync(rc)) { writeFileSync(rc, JSON.stringify(resp)); caracteres += l.texto.length; }
            const mp3 = join(P.vozCache, `${l.id}-${h}.mp3`);
            writeFileSync(mp3, Buffer.from(resp.audio_base64, 'base64'));
            const nota = await calificar(mp3, l.texto);
            pruebas.push({ sem, h, ...nota });
            console.log(`[voz] ${l.id} toma ${k + 1} (semilla ${sem}): ${nota.idioma} ${nota.prob.toFixed(2)} | oido: "${nota.oido}" | faltan ${nota.faltan} sobran ${nota.sobran} -> ${nota.puntaje.toFixed(2)}`);
        }
        pruebas.sort((a, b) => b.puntaje - a.puntaje);
        semilla = pruebas[0].sem;
        tomas[l.id] = { semilla, toma: pruebas[0].h, puntaje: r3(pruebas[0].puntaje), elegida: new Date().toISOString() };
        mkdirSync(P.datos, { recursive: true });
        writeFileSync(tomasRuta, JSON.stringify(tomas, null, 1) + '\n');
        console.log(`[voz] ${l.id}: elegida la semilla ${semilla} (datos/voz-tomas.json)`);
    }
    const cuerpo = cuerpoDe(l, i, semilla);
    const huella = huellaDe(cuerpo);
    const fija = l.opciones.toma ?? (tomas[l.id]?.semilla === semilla ? tomas[l.id]?.toma : null);
    const rutaFija = fija ? join(P.vozCache, `${l.id}-${fija}.json`) : null;
    const rutaCache = join(P.vozCache, `${l.id}-${huella}.json`);
    let respuesta, huellaUsada = huella;
    if (rutaFija && existsSync(rutaFija) && !FIXTURE) {
        respuesta = JSON.parse(readFileSync(rutaFija, 'utf8')); huellaUsada = fija;
        console.log(`[voz] ${l.id}: toma fijada (${fija})`); reutilizadas++;
    } else if (!FORZAR && existsSync(rutaCache)) {
        respuesta = JSON.parse(readFileSync(rutaCache, 'utf8'));
        console.log(`[voz] ${l.id}: reutilizada (cache ${huella})`); reutilizadas++;
    } else if (SECO) {
        console.log(`[voz] ${l.id} (Frame ${l.frame}): se generaria con ${VOZ.modelo}, semilla ${semilla}, ajustes ${JSON.stringify(cuerpo.voice_settings)}${cuerpo.previous_text || cuerpo.next_text ? '' : ', sin contexto'}: "${l.texto}" (${l.texto.length} caracteres)`);
        caracteres += l.texto.length;
        continue;
    } else if (FIXTURE) {
        const f = join(FIXTURE, `${l.id}.json`);
        if (!existsSync(f)) morir(`--fixture: falta ${f}`);
        respuesta = JSON.parse(readFileSync(f, 'utf8'));
        const al = respuesta.alignment;
        if (!al || al.characters.join('') !== l.texto) morir(`--fixture ${l.id}: la alineacion no corresponde al texto de SCRIPT.md ("${al?.characters?.join('')}" vs "${l.texto}")`);
        if (!respuesta.audio_base64) {
            const tmp = join(P.vozCache, `${l.id}-${huella}.sint.wav`);
            sintetizar(al, tmp);
            respuesta = { ...respuesta, audio_base64: readFileSync(tmp).toString('base64'), _formato: 'wav', _fixture: true };
        }
        writeFileSync(rutaCache, JSON.stringify(respuesta));
        console.log(`[voz] ${l.id}: generada SIN RED desde ${f} (fixture)`); generadas++;
    } else {
        respuesta = await llamarApi(cuerpo, l.id);
        writeFileSync(rutaCache, JSON.stringify(respuesta));
        caracteres += l.texto.length; generadas++;
        console.log(`[voz] ${l.id}: generada (${l.texto.length} caracteres)`);
    }
    if (SECO) continue;
    const ext = respuesta._formato === 'wav' ? 'wav' : 'mp3';
    const crudo = join(P.vozCache, `${l.id}-${huellaUsada}.${ext}`);
    writeFileSync(crudo, Buffer.from(respuesta.audio_base64, 'base64'));
    const vel = l.opciones.velocidad && l.opciones.velocidad !== 1 ? l.opciones.velocidad : 1;
    let entrada = crudo;
    if (vel !== 1) {
        entrada = join(P.vozCache, `${l.id}-${huellaUsada}-x${vel}.wav`);
        const r = ffmpeg(['-i', crudo, '-af', `atempo=${vel}`, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', entrada]);
        if (r.status !== 0) morir('ffmpeg fallo con atempo: ' + r.stderr.slice(-300));
    }
    const wav = join(P.vozDir, `${l.id}.wav`);
    const medida = normalizar(entrada, wav);
    {   // inicio cortado: voz audible en los primeros 12 ms
        const pcm = spawnSync('ffmpeg', ['-v', 'error', '-i', wav, '-f', 's16le', '-ac', '1', '-ar', '48000', '-t', '0.012', '-'], { encoding: 'buffer' }).stdout;
        let pico = 0;
        for (let k = 0; k + 1 < pcm.length; k += 2) pico = Math.max(pico, Math.abs(pcm.readInt16LE(k)));
        const dbI = 20 * Math.log10(pico / 32768 + 1e-9);
        if (dbI > -40) console.warn(`[voz] AVISO ${l.id}: el audio empieza con voz a ${dbI.toFixed(1)} dBFS en los primeros 12 ms (inicio cortado): prueba **Context:** none en esa linea`);
    }
    const al = respuesta.alignment || respuesta.normalized_alignment;
    const dur = Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav], { encoding: 'utf8' }).stdout.trim());
    alineacion[l.id] = {
        texto: l.texto, frame: l.frame, archivo: `assets/voz/${l.id}.wav`, duracion_s: dur, caracteres: al.characters,
        inicio_s: al.character_start_times_seconds.map((t) => t / vel), fin_s: al.character_end_times_seconds.map((t) => t / vel),
        velocidad: vel, semilla, voz: VOZ_ID, medida_origen: medida, huella: huellaUsada, ...(FIXTURE ? { fixture: true } : {}),
    };
}

if (SECO) {
    console.log(`[voz] --seco: nada escrito; se generarian ${caracteres} caracteres (~${caracteres} creditos) con la voz ${VOZ_ID}`);
} else {
    mkdirSync(P.datos, { recursive: true });
    writeFileSync(P.vozAlineacion, JSON.stringify(alineacion) + '\n');
    console.log(`[voz] listo: ${generadas} generadas, ${reutilizadas} reutilizadas; caracteres facturados en esta corrida: ${caracteres}. Alineacion en datos/voz-alineacion.json`);
}
