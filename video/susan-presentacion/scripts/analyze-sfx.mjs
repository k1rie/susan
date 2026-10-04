#!/usr/bin/env node
// Analiza cada mp3 de assets/sfx y escribe assets/sfx/sfx-meta.json.
//
// Por qué existe: los efectos se montaban SIEMPRE con el inicio del archivo en el cue del storyboard, pero cada archivo tiene su
// golpe (transiente) en un instante distinto (riser: al final; impact-bass: tras una cola; typing: bucle de varias teclas).
// Este script mide ese instante para que el montaje pueda hacer  data-start = tiempoDelGolpeVisual - hit.
//
// Método (todo con ventanas de 5 ms sobre PCM mono f32 a 44.1 kHz decodificado con ffmpeg):
//   silencio : primer instante con RMS > -45 dBFS (el hiss de -60 dBFS de pop/chime/ping no cuenta como sonido)
//   onset    : primer cruce de -30 dBFS (ataque audible). Si el archivo nunca llega a -30 dBFS se usa pico-20 dB y se marca umbralRelativo
//   hit      : instante de la mayor subida de energía (flujo RMS positivo), afinado a nivel de muestra
//   pico     : instante de la muestra de mayor valor absoluto
//   fin90    : instante en que se ha acumulado el 90 % de la energía del archivo (duración útil)
//   golpes   : todos los transientes (máximos locales del flujo >= 25 % del máximo, separados >= 40 ms) -> p. ej. cada tecla de typing
//   ancla    : instante del archivo que debe coincidir con el evento visual (hit; para whoosh y riser = pico)
//   forma    : percusivo | riser (pico tardío) | swell | bucle | tonal con cola
//
// Uso: node scripts/analyze-sfx.mjs [--ascii] [--png <ruta.png>] [--dir <carpeta con mp3/wav>] [--out <json>]   (la envolvente ASCII sale por consola con --ascii)
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv;
const optDir = argv.indexOf('--dir') > 0 ? resolve(argv[argv.indexOf('--dir') + 1]) : null;
const optOut = argv.indexOf('--out') > 0 ? resolve(argv[argv.indexOf('--out') + 1]) : null;
const DIR = optDir ?? join(RAIZ, 'assets/sfx');
const SR = 44100;
const VENT = Math.round(SR * 0.005); // 5 ms
const r3 = (x) => Math.round(x * 1000) / 1000;
const db = (x) => 20 * Math.log10(Math.max(x, 1e-9));

function decodificar(archivo) {
    // Se decodifica a mono 44.1 kHz (promedio de canales). Antes se comprueba por canal que un mp3 estéreo en contrafase no se cancele al mezclar.
    const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', join(DIR, archivo), '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], {
        maxBuffer: 256 * 1024 * 1024,
    });
    return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

function picoPorCanal(archivo) {
    const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', join(DIR, archivo), '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 256 * 1024 * 1024 });
    const f = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    const canales = ffprobe(archivo).canales;
    const pk = Array(canales).fill(0);
    for (let i = 0; i < f.length; i++) pk[i % canales] = Math.max(pk[i % canales], Math.abs(f[i]));
    return Math.max(...pk);
}

function ffprobe(archivo) {
    const j = JSON.parse(
        execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', join(DIR, archivo)], { encoding: 'utf8' }),
    );
    const s = j.streams[0];
    return { duracion: Number(j.format.duration), inicioContenedor: Number(s.start_time ?? 0), muestreo: Number(s.sample_rate), canales: s.channels };
}

const PAD = 0.03; // s de silencio añadidos al inicio solo para el análisis (el flujo mira 20 ms atrás: sin esto no se ve un golpe en t < 20 ms)
export function analizar(archivo) {
    const x0 = decodificar(archivo);
    const info = ffprobe(archivo);
    const PADN = Math.round(PAD * SR);
    const x = new Float32Array(x0.length + PADN);
    x.set(x0, PADN);
    const n = x.length;
    const nv = Math.floor(n / VENT);
    const rms = new Float64Array(nv);
    for (let w = 0; w < nv; w++) {
        let s = 0;
        for (let i = w * VENT; i < (w + 1) * VENT; i++) s += x[i] * x[i];
        rms[w] = Math.sqrt(s / VENT);
    }
    const dbs = Array.from(rms, db);
    const t = (w) => (w * VENT) / SR - PAD;

    // pico global a nivel de muestra
    let pk = 0, pkI = 0;
    for (let i = 0; i < n; i++) {
        const a = Math.abs(x[i]);
        if (a > pk) { pk = a; pkI = i; }
    }
    const picoDb = db(pk);

    const primero = (umbral) => dbs.findIndex((d) => d > umbral);
    const wSil = primero(-45);
    let umbral = -30, relativo = false;
    if (picoDb < -18) { umbral = picoDb - 20; relativo = true; }
    const wOn = primero(umbral);

    // flujo positivo (subida de RMS lineal entre ventanas contiguas)
    const flujo = new Float64Array(nv);
    // flujo = media de 2 ventanas (10 ms) menos media de las 4 anteriores (20 ms): evita falsos golpes por el rizado de graves de 40-100 Hz
    for (let w = 4; w < nv - 1; w++) flujo[w] = Math.max(0, (rms[w] + rms[w + 1]) / 2 - (rms[w - 1] + rms[w - 2] + rms[w - 3] + rms[w - 4]) / 4);
    let mf = 0, wHit = 0;
    for (let w = 4; w < nv - 1; w++) if (flujo[w] > mf) { mf = flujo[w]; wHit = w; }
    // afinado a nivel de muestra: primera muestra de [ventana-1, ventana+1) que supera el 35 % del máximo local
    const refinar = (w) => {
        const a = Math.max(0, (w - 1) * VENT), b = Math.min(n, (w + 1) * VENT);
        let m = 0;
        for (let i = a; i < b; i++) m = Math.max(m, Math.abs(x[i]));
        for (let i = a; i < b; i++) if (Math.abs(x[i]) > 0.35 * m) return i / SR - PAD;
        return t(w);
    };
    let hit = Math.max(0, refinar(wHit));

    // todos los transientes
    const golpes = [];
    const minSep = Math.round(0.04 / 0.005);
    for (let w = 5; w < nv - 2; w++) {
        // además de ser un máximo local del flujo, la subida debe ser >= 9.5 dB (x3) sobre la media previa (descarta el rizado de una nota sostenida)
        const previo = (rms[w - 1] + rms[w - 2] + rms[w - 3] + rms[w - 4]) / 4;
        if (flujo[w] >= 0.25 * mf && flujo[w] >= flujo[w - 1] && flujo[w] >= flujo[w + 1] && (rms[w] + rms[w + 1]) / 2 > 3 * previo) {
            const prev = golpes.at(-1);
            if (prev && w - prev.w < minSep) { if (flujo[w] > prev.f) { prev.w = w; prev.f = flujo[w]; } }
            else golpes.push({ w, f: flujo[w] });
        }
    }
    const golpesT = golpes.map((g) => r3(Math.max(0, refinar(g.w))));

    // energía acumulada
    let total = 0;
    for (let i = 0; i < n; i++) total += x[i] * x[i];
    let acc = 0, fin90 = 0, fin99 = 0;
    for (let i = 0; i < n; i++) {
        acc += x[i] * x[i];
        if (!fin90 && acc >= 0.9 * total) fin90 = i / SR - PAD;
        if (!fin99 && acc >= 0.99 * total) { fin99 = i / SR - PAD; break; }
    }
    // centroide temporal de energía
    let cm = 0;
    for (let i = 0; i < n; i++) cm += (i / SR) * x[i] * x[i];
    const centroide = cm / total - PAD;

    const dur = x0.length / SR;
    const tPico = pkI / SR - PAD;
    const tOn = wOn >= 0 ? t(wOn) : 0;
    // fracción del archivo con RMS a <= 6 dB del máximo RMS (drones / booms sostenidos)
    const maxDb = Math.max(...dbs);
    const sostenido = dbs.filter((d) => d > maxDb - 6).length / dbs.length;
    let forma;
    const pFrac = tPico / dur;
    const pkCanal = picoPorCanal(archivo);
    if (picoDb < -80 || db(pkCanal) < -80) forma = 'SILENCIO (archivo defectuoso: pico < -80 dBFS)';
    else if (sostenido > 0.5) { forma = 'sostenido (boom/drone)'; hit = tOn; }
    else if (golpesT.length >= 4) forma = 'bucle';
    else if (pFrac > 0.65 && centroide / dur > 0.55) forma = 'riser (pico tardío)';
    else if (tPico - tOn < 0.04 && centroide / dur < 0.35 && fin90 - tOn < 0.5) forma = 'percusivo';
    else if (tPico - tOn >= 0.04 && fin90 - tOn < 0.5) forma = 'swell (ataque lento ~' + Math.round((tPico - tOn) * 1000) + ' ms)';
    else forma = 'tonal con cola';
    // ancla: el instante del archivo que debe coincidir con el evento visual (data-start = tiempoVisual - ancla)
    const silencioso = forma.startsWith('SILENCIO');
    const ancla = silencioso ? null : /whoosh/.test(archivo) || forma.startsWith('riser') ? tPico : golpesT.length ? Math.min(hit, golpesT[0]) : hit;
    if (silencioso) hit = null;
    return {
        archivo,
        duracion: r3(info.duracion),
        muestras: x0.length,
        inicioContenedor: r3(info.inicioContenedor),
        silencio: wSil >= 0 ? r3(t(wSil)) : null,
        onset: silencioso ? null : r3(tOn),
        umbralRelativo: relativo,
        hit: hit === null ? null : r3(hit),
        pico: silencioso ? null : r3(tPico),
        picoDbFS: r3(picoDb),
        sostenido: r3(sostenido),
        fin90: silencioso ? null : r3(fin90),
        fin99: silencioso ? null : r3(fin99),
        centroide: r3(centroide),
        golpes: golpesT,
        ancla: ancla === null ? null : r3(ancla),
        forma,
        _dbs: dbs.slice(Math.round(PAD / 0.005)),
    };
}

// ---- envolvente en texto ----
function ascii(m, cols = 100) {
    const dbs = m._dbs;
    const por = Math.max(1, Math.ceil(dbs.length / cols));
    const filas = [];
    const niveles = [0, -6, -12, -18, -24, -30, -40, -50];
    const col = [];
    for (let c = 0; c * por < dbs.length; c++) col.push(Math.max(...dbs.slice(c * por, (c + 1) * por)));
    for (const nv of niveles) filas.push(`${String(nv).padStart(4)} |${col.map((d) => (d > nv - 3 ? '#' : ' ')).join('')}`);
    const marca = (tt) => Math.round(tt / (por * 0.005));
    const eje = Array(col.length).fill('-');
    const pon = (tt, ch) => { const c = marca(tt); if (c >= 0 && c < eje.length) eje[c] = ch; };
    pon(m.onset, 'o');
    for (const g of m.golpes) pon(g, 'g');
    pon(m.hit, 'H');
    pon(m.pico, 'P');
    pon(m.fin90, '9');
    return `${m.archivo}  dur=${m.duracion}s  forma=${m.forma}  (1 col = ${r3(por * 0.005)} s)\n${filas.join('\n')}\n     +${eje.join('')}\n     o=onset g=golpe H=hit P=pico 9=fin90`;
}

// ---- PNG con Chrome (opcional) ----
async function png(metas, ruta) {
    const { createRequire } = await import('node:module');
    const dirNpx = join(process.env.HOME, '.npm/_npx');
    const cand = readdirSync(dirNpx).map((d) => join(dirNpx, d, 'node_modules/puppeteer-core')).find((p) => existsSync(p));
    const puppeteer = createRequire(import.meta.url)(process.env.PUPPETEER_CORE ?? cand);
    const chrome = process.env.CHROME ?? `${process.env.HOME}/.cache/hyperframes/chrome/chrome-headless-shell`;
    const exe = execFileSync('bash', ['-c', `find ${chrome} -type f -name chrome-headless-shell | head -1`], { encoding: 'utf8' }).trim();
    const browser = await puppeteer.launch({ executablePath: exe, headless: 'shell', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const alto = 110;
    await page.setViewport({ width: 1400, height: alto * metas.length + 20 });
    await page.setContent('<body style="margin:0;background:#fff;font:12px monospace"><canvas id=c width=1400 height=' + (alto * metas.length + 20) + '></canvas></body>');
    await page.evaluate((datos, alto) => {
        const c = document.getElementById('c').getContext('2d');
        datos.forEach((m, k) => {
            const y0 = k * alto + 14, h = alto - 24, w = 1200, x0 = 150;
            c.fillStyle = '#000'; c.fillText(`${m.archivo}  ${m.forma}`, 4, y0 + 12);
            c.fillText(`dur ${m.duracion}`, 4, y0 + 28); c.fillText(`hit ${m.hit}`, 4, y0 + 44); c.fillText(`pico ${m.pico}`, 4, y0 + 60);
            c.strokeStyle = '#ddd'; c.strokeRect(x0, y0, w, h);
            const N = m.dbs.length;
            c.beginPath(); c.strokeStyle = '#0061fe';
            m.dbs.forEach((d, i) => { const v = Math.max(0, (d + 60) / 60); const X = x0 + (i / N) * w, Y = y0 + h - v * h; i ? c.lineTo(X, Y) : c.moveTo(X, Y); });
            c.stroke();
            const lin = (tt, col, txt) => { const X = x0 + (tt / m.duracion) * w; c.strokeStyle = col; c.beginPath(); c.moveTo(X, y0); c.lineTo(X, y0 + h); c.stroke(); c.fillStyle = col; c.fillText(txt, X + 2, y0 + 10); };
            lin(m.onset, '#0a0', 'on'); lin(m.hit, '#d00', 'HIT'); lin(m.pico, '#a0a', 'pk'); lin(m.fin90, '#888', '90%');
            m.golpes.forEach((g) => lin(g, '#fa0', ''));
        });
    }, metas.map((m) => ({ ...m, dbs: m._dbs })), alto);
    await page.screenshot({ path: ruta });
    await browser.close();
}

const archivos = readdirSync(DIR).filter((f) => /\.(mp3|wav)$/.test(f)).sort();
const metas = archivos.map(analizar);
const limpio = metas.map(({ _dbs, ...m }) => m);
writeFileSync(optOut ?? join(DIR, 'sfx-meta.json'), JSON.stringify(limpio, null, 2) + '\n');
console.log('archivo'.padEnd(20), 'dur'.padStart(6), 'cont0'.padStart(6), 'sil'.padStart(6), 'onset'.padStart(6), 'hit'.padStart(6), 'pico'.padStart(6), 'fin90'.padStart(6), 'pkdB'.padStart(6), 'golpes', 'forma');
for (const m of limpio) {
    console.log(m.archivo.padEnd(20), String(m.duracion).padStart(6), String(m.inicioContenedor).padStart(6), String(m.silencio).padStart(6), String(m.onset).padStart(6), String(m.hit).padStart(6), String(m.pico).padStart(6), String(m.fin90).padStart(6), String(m.picoDbFS).padStart(6), m.golpes.length, m.forma);
}
if (process.argv.includes('--ascii')) for (const m of metas) console.log('\n' + ascii(m));
const i = process.argv.indexOf('--png');
if (i > 0) { await png(metas, process.argv[i + 1]); console.log('PNG', process.argv[i + 1]); }
