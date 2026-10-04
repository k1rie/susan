#!/usr/bin/env node
// Genera la locución del video con ElevenLabs a partir de v2/voz-guion.json.
//
// Por cada línea: llama a /v1/text-to-speech/<voz>/with-timestamps (devuelve el audio y el instante de cada carácter), normaliza la
// sonoridad con ffmpeg (loudnorm de dos pasadas) y guarda assets/voz/<id>.wav (48 kHz mono, sin retardo de codificador: así los
// tiempos de alineación siguen valiendo al milisegundo) y v2/voz-alineacion.json.
//
// La clave NO se pasa por argumentos ni se imprime: se lee de video/susan-presentacion/.env (ELEVENLABS_API_KEY; el archivo está en
// .gitignore). Cada llamada gasta créditos (≈ 1 por carácter): las líneas ya generadas con el mismo texto y ajustes se reutilizan
// (caché en v2/voz-cache/) salvo que se pase --forzar.
//
// Uso: node scripts/generar-voz.mjs [--solo 05,06] [--forzar] [--seco] [--elegir N]
//   --elegir N (con --solo): genera N tomas por línea con semillas distintas, las califica con Speech to Text y se queda con la mejor
//   (guarda la semilla en v2/voz-guion.json, así la toma elegida se reproduce desde la caché).
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const forzar = args.includes('--forzar');
const seco = args.includes('--seco');
const iElegir = args.indexOf('--elegir');
const nElegir = iElegir >= 0 ? Number(args[iElegir + 1]) : 0;
const iSolo = args.indexOf('--solo');
const solo = iSolo >= 0 ? new Set(args[iSolo + 1].split(',')) : null;

// .env mínimo (CLAVE=valor); no se exporta nada al entorno del proceso hijo salvo lo estrictamente necesario.
function leerEnv() {
    const ruta = join(RAIZ, '.env');
    if (!existsSync(ruta)) throw new Error('Falta video/susan-presentacion/.env con ELEVENLABS_API_KEY.');
    const env = {};
    for (const l of readFileSync(ruta, 'utf8').split('\n')) {
        const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(l);
        if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return env;
}

const env = leerEnv();
const CLAVE = env.ELEVENLABS_API_KEY;
if (!CLAVE) throw new Error('ELEVENLABS_API_KEY está vacía en .env.');
const guion = JSON.parse(readFileSync(join(RAIZ, 'v2/voz-guion.json'), 'utf8'));
const VOZ = env.ELEVENLABS_VOICE_ID || guion.voz;
const DIR_VOZ = join(RAIZ, 'assets/voz');
const DIR_CACHE = join(RAIZ, 'v2/voz-cache');
mkdirSync(DIR_VOZ, { recursive: true });
mkdirSync(DIR_CACHE, { recursive: true });

const ffmpeg = (a, opts = {}) => spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-y', ...a], { encoding: 'utf8', ...opts });

// loudnorm de dos pasadas hacia el objetivo de la mezcla (los clips son cortos: la 1.ª pasada mide, la 2.ª aplica lineal).
function normalizar(entrada, salida, objetivo, picoDb) {
    const p1 = ffmpeg(['-i', entrada, '-af', `loudnorm=I=${objetivo}:TP=${picoDb}:LRA=7:print_format=json`, '-f', 'null', '-']);
    const json = /\{[\s\S]*"target_offset"[\s\S]*?\}/.exec(p1.stderr)?.[0];
    if (!json) throw new Error('loudnorm no devolvió mediciones: ' + p1.stderr.slice(-300));
    const m = JSON.parse(json);
    const filtro = `loudnorm=I=${objetivo}:TP=${picoDb}:LRA=7:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
    const p2 = ffmpeg(['-i', entrada, '-af', filtro, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', salida]);
    if (p2.status !== 0) throw new Error('ffmpeg falló al normalizar: ' + p2.stderr.slice(-300));
    return { entrada_lufs: Number(m.input_i), entrada_pico_db: Number(m.input_tp) };
}


// Califica una toma con Speech to Text: idioma detectado (español) y si se oyen exactamente las palabras del guion (ni faltan ni sobran).
// Sirve porque no siempre hay quien escuche: una toma con acento extraño o con una palabra inventada se delata en la transcripción.
const normaliza = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]/g, ' ').split(/\s+/).filter(Boolean);
async function calificar(mp3, texto) {
    const fd = new FormData();
    fd.append('model_id', 'scribe_v1');
    fd.append('file', new Blob([readFileSync(mp3)], { type: 'audio/mpeg' }), 'toma.mp3');
    const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': CLAVE }, body: fd });
    if (!r.ok) throw new Error(`Speech to Text respondió ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const d = await r.json();
    const esp = normaliza(texto);
    const oido = normaliza(d.text || '');
    const faltan = esp.filter((w) => !oido.includes(w)).length;
    const sobran = oido.filter((w) => !esp.includes(w)).length;
    const prob = d.language_code === 'spa' ? d.language_probability : 0;
    return { puntaje: prob - 0.35 * (faltan + sobran), prob, idioma: d.language_code, oido: d.text, faltan, sobran };
}

const lineas = guion.lineas;
const alineacion = existsSync(join(RAIZ, 'v2/voz-alineacion.json')) ? JSON.parse(readFileSync(join(RAIZ, 'v2/voz-alineacion.json'), 'utf8')) : {};
let caracteres = 0;

for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    if (solo && !solo.has(l.id)) continue;
    // La velocidad NO se pide a la API (con eleven_multilingual_v2 no se aplicó de forma fiable): se estira con ffmpeg (atempo) y se
    // reescala la alineación, así la línea sin velocidad sigue usando la misma caché.
    const ajustes = { ...guion.ajustes, ...(l.ajustes || {}) };
    const cuerpo = {
        text: l.texto,
        model_id: guion.modelo,
        language_code: 'es',
        voice_settings: ajustes,
        // Con contexto la entonación encadena mejor, pero en frases que continúan la anterior ("y pasa lista...") el modelo puede arrancar
        // a media palabra: 'sin_contexto' genera la frase con un inicio limpio.
        previous_text: l.sin_contexto ? undefined : lineas[i - 1]?.texto ?? undefined,
        next_text: l.sin_contexto ? undefined : lineas[i + 1]?.texto ?? undefined,
        ...(Number.isInteger(l.semilla) ? { seed: l.semilla } : {}),
    };
    if (nElegir > 0 && solo && solo.has(l.id)) {
        const tomas = [];
        for (let k = 1; k <= nElegir; k++) {
            const sem = 1000 + k * 37;
            const c = { ...cuerpo, seed: sem };
            const hc = createHash('sha256').update(JSON.stringify([VOZ, c])).digest('hex').slice(0, 16);
            const rc = join(DIR_CACHE, `${l.id}-${hc}.json`);
            let resp;
            if (existsSync(rc)) resp = JSON.parse(readFileSync(rc, 'utf8'));
            else {
                const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOZ}/with-timestamps?output_format=mp3_44100_128`, {
                    method: 'POST', headers: { 'xi-api-key': CLAVE, 'Content-Type': 'application/json' }, body: JSON.stringify(c),
                });
                if (!res.ok) throw new Error(`ElevenLabs respondió ${res.status} en la línea ${l.id}: ${(await res.text()).slice(0, 300)}`);
                resp = await res.json();
                writeFileSync(rc, JSON.stringify(resp));
                caracteres += l.texto.length;
            }
            const m = join(DIR_CACHE, `${l.id}-${hc}.mp3`);
            writeFileSync(m, Buffer.from(resp.audio_base64, 'base64'));
            const nota = await calificar(m, l.texto);
            tomas.push({ sem, ...nota });
            console.log(`[voz] ${l.id} toma ${k} (semilla ${sem}): ${nota.idioma} ${nota.prob.toFixed(2)} | oído: "${nota.oido}" | faltan ${nota.faltan} sobran ${nota.sobran} -> ${nota.puntaje.toFixed(2)}`);
        }
        tomas.sort((a, b) => b.puntaje - a.puntaje);
        l.semilla = tomas[0].sem;
        cuerpo.seed = l.semilla;
        writeFileSync(join(RAIZ, 'v2/voz-guion.json'), JSON.stringify(guion, null, 4));
        console.log(`[voz] ${l.id}: elegida la semilla ${l.semilla}`);
    }
    const huella = createHash('sha256').update(JSON.stringify([VOZ, cuerpo])).digest('hex').slice(0, 16);
    const rutaCache = join(DIR_CACHE, `${l.id}-${huella}.json`);
    let respuesta;
    // 'toma' fija una toma ya aprobada (huella de la caché): así cambiar el texto de una frase vecina no regenera ni altera esta.
    const rutaFija = l.toma ? join(DIR_CACHE, `${l.id}-${l.toma}.json`) : null;
    if (rutaFija && existsSync(rutaFija)) {
        respuesta = JSON.parse(readFileSync(rutaFija, 'utf8'));
        console.log(`[voz] ${l.id}: toma fijada (${l.toma})`);
    } else if (!forzar && existsSync(rutaCache)) {
        respuesta = JSON.parse(readFileSync(rutaCache, 'utf8'));
        console.log(`[voz] ${l.id}: reutilizada (caché ${huella})`);
    } else {
        if (seco) { console.log(`[voz] ${l.id}: se generaría (${l.texto.length} caracteres)`); continue; }
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOZ}/with-timestamps?output_format=mp3_44100_128`, {
            method: 'POST',
            headers: { 'xi-api-key': CLAVE, 'Content-Type': 'application/json' },
            body: JSON.stringify(cuerpo),
        });
        if (!res.ok) throw new Error(`ElevenLabs respondió ${res.status} en la línea ${l.id}: ${(await res.text()).slice(0, 300)}`);
        respuesta = await res.json();
        writeFileSync(rutaCache, JSON.stringify(respuesta));
        caracteres += l.texto.length;
        console.log(`[voz] ${l.id}: generada (${l.texto.length} caracteres)`);
    }
    const huellaUsada = rutaFija && existsSync(rutaFija) ? l.toma : huella;
    const mp3 = join(DIR_CACHE, `${l.id}-${huellaUsada}.mp3`);
    writeFileSync(mp3, Buffer.from(respuesta.audio_base64, 'base64'));
    const wav = join(DIR_VOZ, `${l.id}.wav`);
    const vel = l.velocidad && l.velocidad !== 1 ? l.velocidad : 1;
    let entrada = mp3;
    if (vel !== 1) {
        entrada = join(DIR_CACHE, `${l.id}-${huella}-x${vel}.wav`);
        const r = ffmpeg(['-i', mp3, '-af', `atempo=${vel}`, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', entrada]);
        if (r.status !== 0) throw new Error('ffmpeg falló con atempo: ' + r.stderr.slice(-300));
    }
    const medida = normalizar(entrada, wav, guion.mezcla.objetivo_lufs_por_linea, guion.mezcla.pico_verdadero_db);
    const al = respuesta.alignment || respuesta.normalized_alignment;
    {
        const pcm = spawnSync('ffmpeg', ['-v', 'error', '-i', wav, '-f', 's16le', '-ac', '1', '-ar', '48000', '-t', '0.012', '-'], { encoding: 'buffer' }).stdout;
        let pico = 0;
        for (let k = 0; k + 1 < pcm.length; k += 2) pico = Math.max(pico, Math.abs(pcm.readInt16LE(k)));
        const db = 20 * Math.log10(pico / 32768 + 1e-9);
        if (db > -40) console.warn(`[voz] AVISO ${l.id}: el audio empieza con voz a ${db.toFixed(1)} dBFS en los primeros 12 ms (inicio cortado). Prueba "sin_contexto": true en esa línea.`);
    }
    const dur = Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav], { encoding: 'utf8' }).stdout.trim());
    alineacion[l.id] = {
        texto: l.texto,
        archivo: `assets/voz/${l.id}.wav`,
        duracion_s: dur,
        caracteres: al.characters,
        inicio_s: al.character_start_times_seconds.map((t) => t / vel),
        fin_s: al.character_end_times_seconds.map((t) => t / vel),
        velocidad: vel,
        medida_origen: medida,
        huella: huellaUsada,
    };
}

if (!seco) {
    writeFileSync(join(RAIZ, 'v2/voz-alineacion.json'), JSON.stringify(alineacion));
    console.log(`[voz] listo. Caracteres facturados en esta corrida: ${caracteres}. Alineación en v2/voz-alineacion.json`);
}
