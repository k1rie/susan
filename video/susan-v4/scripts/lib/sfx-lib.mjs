// sfx-lib.mjs - utilidades compartidas por los scripts de sonido de la v4 (mount-sfx, verify-sfx, build-sfx-catalog, mount-voz).
// Portado de video/susan-presentacion/scripts/lib/sfx-lib.mjs. Cambios de la v4:
//   - se RETIRAN `AJUSTES_CUE` y `EXTRA_TECLEO_DB` (ventanas absolutas y tecleo calibrados para la v3; LECCIONES-V3 2.3.3):
//     en la v4 el ajuste fino de un cue es su ganancia en `sfx_cues` (p. ej. `1.55 tap -3dB`);
//   - `resolverSonido` rechaza alias heredados y obsoletos (SINTESIS regla 22);
//   - `nivelesPorSegundo` mide el nivel percibido de cada segundo (RMS maximo en ventanas de 100 ms) para la regla de saltos.
// GANANCIA_DB, RANGO y VOL_MAX_CUE se conservan tal cual porque CATALOG.json ya los incorpora (volDefecto, rango, gananciaDb):
// cambiarlos aqui sin regenerar el catalogo (bash scripts/derive-sfx.sh) lo dejaria incoherente.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { raiz as raizComun, opcion as opcionComun } from './rutas.mjs';

export const SR = 48000;
export const r3 = (x) => Math.round(x * 1000) / 1000;
export const db = (x) => 20 * Math.log10(Math.max(x, 1e-9));
export const lineal = (dB) => 10 ** (dB / 20);
export const raiz = raizComun;
export const opcion = opcionComun;

// Jerarquia para la regla de polifonia: si hay mas de 4 sonidos a la vez se atenuan los de menor rango.
export const RANGO = { impact: 10, riser: 8, snap: 8, chime: 7, check: 7, alert: 7, zoom: 6, whoosh: 6, sparkle: 5, ping: 5, pop: 5, click: 4, ui: 4, tick: 3, texture: 2, key: 2 };
// Ganancia de mezcla por categoria (v2.1 de la v3; el catalogo la lleva incorporada en volDefecto).
export const GANANCIA_DB = { tick: 6, pop: 6, ping: 6, key: 6, texture: 6, whoosh: 6, zoom: 6, riser: 4, sparkle: 6, chime: 6, check: 2, ui: 6, alert: 6, click: 3, snap: 2, impact: 0 };
// Ningun cue pasa de este volumen por su propia ganancia (data-volume <= 0.80: mas arriba un solo cue domina la mezcla).
export const VOL_MAX_CUE = 0.8;
export const volConGanancia = (vol, entrada) => Math.min(VOL_MAX_CUE, vol * lineal(entrada.gananciaDb ?? GANANCIA_DB[entrada.categoria] ?? 0));

// Categorias "de golpe fuerte" (SINTESIS regla 22: transitorios fuertes solo en los huecos de la voz).
export const CATEGORIAS_FUERTES = new Set(['impact', 'snap', 'alert', 'chime', 'check']);

export function leerWav(ruta) {
    const b = readFileSync(ruta);
    if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${ruta}: no es WAV`);
    let p = 12, fmt = null, datos = null;
    while (p + 8 <= b.length) {
        const id = b.toString('ascii', p, p + 4);
        const n = b.readUInt32LE(p + 4);
        if (id === 'fmt ') fmt = { tipo: b.readUInt16LE(p + 8), canales: b.readUInt16LE(p + 10), sr: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
        if (id === 'data') { datos = b.subarray(p + 8, p + 8 + Math.min(n, b.length - p - 8)); break; }
        p += 8 + n + (n % 2);
    }
    if (!fmt || !datos) throw new Error(`${ruta}: WAV sin fmt/data`);
    const { canales, bits, tipo, sr } = fmt;
    const bytes = bits / 8, frames = Math.floor(datos.length / (bytes * canales));
    const ch = Array.from({ length: canales }, () => new Float32Array(frames));
    for (let i = 0; i < frames; i++) {
        for (let c = 0; c < canales; c++) {
            const o = (i * canales + c) * bytes;
            ch[c][i] = tipo === 3 ? datos.readFloatLE(o) : bits === 16 ? datos.readInt16LE(o) / 32768 : bits === 24 ? datos.readIntLE(o, 3) / 8388608 : (datos.readUInt8(o) - 128) / 128;
        }
    }
    return { sr, canales, frames, ch, dur: frames / sr };
}

// Escribe PCM 16 bit (con recorte duro a +-1: el llamador debe garantizar que no se alcance).
export function escribirWav(ruta, ch, sr = SR) {
    const canales = ch.length, frames = ch[0].length;
    const b = Buffer.alloc(44 + frames * canales * 2);
    b.write('RIFF', 0); b.writeUInt32LE(36 + frames * canales * 2, 4); b.write('WAVEfmt ', 8);
    b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(canales, 22); b.writeUInt32LE(sr, 24);
    b.writeUInt32LE(sr * canales * 2, 28); b.writeUInt16LE(canales * 2, 32); b.writeUInt16LE(16, 34);
    b.write('data', 36); b.writeUInt32LE(frames * canales * 2, 40);
    for (let i = 0; i < frames; i++) for (let c = 0; c < canales; c++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(ch[c][i] * 32767))), 44 + (i * canales + c) * 2);
    writeFileSync(ruta, b);
}

export const picoWav = (w) => Math.max(...w.ch.map((c) => c.reduce((m, v) => Math.max(m, Math.abs(v)), 0)));

export function cargarCatalogo(R) {
    const ruta = join(R, 'assets/sfx/CATALOG.json');
    if (!existsSync(ruta)) throw new Error(`Falta ${ruta}: ejecuta  bash scripts/derive-sfx.sh`);
    return JSON.parse(readFileSync(ruta, 'utf8'));
}
export const buscar = (cat, nombre) => cat[nombre] ?? null;

// Resuelve un nombre de `sfx_cues` contra el catalogo. Devuelve { entrada } o { error }.
// Solo valen nombres CANONICOS: un alias heredado (pop -> pop-2, whoosh -> whoosh-s, ...) se rechaza con su nombre canonico
// y un obsoleto (`deprecated: true`: flash, sparkle-short, sparkle) se rechaza siempre (LECCIONES-V3 2.1, SINTESIS 22).
export function resolverSonido(cat, nombre) {
    const e = cat[nombre];
    if (!e) {
        const parecidos = Object.keys(cat).filter((k) => !cat[k].alias && !cat[k].deprecated && (k.startsWith(nombre.split('-')[0]) || nombre.startsWith(k.split('-')[0]))).slice(0, 6);
        return { error: `"${nombre}" no esta en assets/sfx/CATALOG.json${parecidos.length ? ` (parecidos: ${parecidos.join(', ')})` : ''}` };
    }
    if (e.deprecated) return { error: `"${nombre}" esta marcado como obsoleto en CATALOG.json: ${e.deprecadoRazon ?? e.uso ?? 'sin razon'}` };
    if (e.alias) return { error: `"${nombre}" es un alias heredado de la v3: usa el nombre canonico "${e.alias}"` };
    return { entrada: e };
}

// Mezclador de referencia (lineal, igual que el motor: suma de pistas sin compensacion). `items`: [{ wav, dataStart, mediaStart, dataDuration, vol }]
// Devuelve { ch:[L,R], pico, picoT }. El motor redondea data-start al milisegundo: se replica.
export function mezclar(items, duracionTotal) {
    const n = Math.ceil(duracionTotal * SR) + SR;
    const out = [new Float32Array(n), new Float32Array(n)];
    for (const it of items) {
        const w = it.wav, off = Math.round(Math.round(it.dataStart * 1000) / 1000 * SR);
        const m0 = Math.round((it.mediaStart || 0) * SR), len = Math.min(w.frames - m0, Math.round(it.dataDuration * SR));
        for (let c = 0; c < 2; c++) {
            const src = w.ch[Math.min(c, w.canales - 1)], dst = out[c];
            for (let i = 0; i < len; i++) { const k = off + i; if (k >= 0 && k < n) dst[k] += src[m0 + i] * it.vol; }
        }
    }
    let pico = 0, picoI = 0;
    for (let c = 0; c < 2; c++) for (let i = 0; i < n; i++) { const a = Math.abs(out[c][i]); if (a > pico) { pico = a; picoI = i; } }
    return { ch: out, pico, picoT: picoI / SR };
}

// Nivel de cada segundo [s, s+1) de la mezcla: RMS maximo (dBFS) en ventanas de 100 ms con paso de 50 ms (piso -60 dBFS).
// Por que no el RMS de 1 s de la v3: con 1-2 SFX/s el RMS de un segundo depende sobre todo de CUANTO dura el sonido (un tap de
// 80 ms y un whoosh de 470 ms al mismo pico difieren > 12 dB) y no de lo fuerte que se oye; la ventana corta mide el golpe.
// Tambien devuelve el RMS de 1 s (metrica de la v3) solo como referencia.
export function nivelesPorSegundo(ch, duracion) {
    const nSeg = Math.floor(duracion + 1e-9);
    const vent = Math.round(0.1 * SR), paso = Math.round(0.05 * SR);
    const max100 = [], rms1 = [];
    for (let s = 0; s < nSeg; s++) {
        const a0 = s * SR, a1 = Math.min((s + 1) * SR, ch[0].length);
        let mx = 0, tot = 0;
        for (let i = a0; i < a1; i++) tot += (ch[0][i] ** 2 + ch[1][i] ** 2) / 2;
        for (let w = a0; w + vent <= a1; w += paso) {
            let e = 0;
            for (let i = w; i < w + vent; i++) e += (ch[0][i] ** 2 + ch[1][i] ** 2) / 2;
            mx = Math.max(mx, e / vent);
        }
        max100.push(Math.max(-60, db(Math.sqrt(mx))));
        rms1.push(Math.max(-60, db(Math.sqrt(tot / Math.max(1, a1 - a0)))));
    }
    return { max100, rms1 };
}

// Saltos de nivel entre segundos contiguos. Para la regla (<= 12 dB) solo cuentan las SUBIDAS entre dos segundos que suenan
// (>= `piso` dBFS): un golpe que llega muy por encima del segundo anterior (el defecto medido en la v3: slam 14.6 dB sobre el segundo
// previo). Pasar de silencio a un sonido, o la cola que se apaga tras un golpe, no son saltos de mezcla.
export function saltosDeNivel(niveles, piso = -45) {
    const saltos = [];
    for (let i = 1; i < niveles.length; i++) {
        const a = niveles[i - 1], b = niveles[i];
        saltos.push({ de: i - 1, a: i, db: Math.abs(b - a), sube: b > a, activos: a >= piso && b >= piso, cuenta: b > a && a >= piso && b >= piso, niveles: [a, b] });
    }
    return saltos.sort((x, y) => y.db - x.db);
}

// Sonoridad integrada ITU-R BS.1770-4 / EBU R128 (ponderacion K a 48 kHz, bloques de 400 ms cada 100 ms, compuertas -70 LUFS y -10 LU).
// Validada en la v3 contra `ffmpeg -af ebur128`.
export function lufsIntegrado(ch, sr = SR) {
    const biquad = (x, b, a) => {
        const y = new Float64Array(x.length);
        let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
        for (let i = 0; i < x.length; i++) {
            const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
            x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
        }
        return y;
    };
    const k = ch.map((c) => biquad(biquad(c, [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]),
        [1, -2, 1], [1, -1.99004745483398, 0.99007225036621]));
    const bloque = Math.round(0.4 * sr), paso = Math.round(0.1 * sr);
    const potencias = [];
    for (let s = 0; s + bloque <= k[0].length; s += paso) {
        let suma = 0;
        for (const c of k) { let a = 0; for (let i = s; i < s + bloque; i++) a += c[i] * c[i]; suma += a / bloque; }
        potencias.push(suma);
    }
    const lufs = (z) => -0.691 + 10 * Math.log10(z);
    const validos = potencias.filter((z) => z > 0 && lufs(z) > -70);
    if (!validos.length) return -Infinity;
    const media = (v) => v.reduce((a, z) => a + z, 0) / v.length;
    const umbral = lufs(media(validos)) - 10;
    const finales = validos.filter((z) => lufs(z) > umbral);
    return finales.length ? lufs(media(finales)) : -Infinity;
}

// Pico verdadero estimado (sobremuestreo x4 con sinc ventaneada de 16 puntos por fase, BS.1770 Anexo 2). Devuelve amplitud lineal.
export function picoVerdadero(ch) {
    const FASES = 4, PUNTOS = 16, mitad = PUNTOS / 2;
    const h = Array.from({ length: FASES }, (_, f) => Array.from({ length: PUNTOS }, (_, j) => {
        const x = j - mitad + 1 - f / FASES;
        const sinc = Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
        return sinc * (0.5 + 0.5 * Math.cos((Math.PI * x) / mitad));
    }));
    let pico = 0;
    for (const c of ch) {
        for (let i = 0; i < c.length; i++) {
            const v = Math.abs(c[i]);
            if (v < pico * 0.7) continue;   // una muestra muy por debajo del pico actual no puede generar un pico entre muestras mayor
            for (let f = 0; f < FASES; f++) {
                let s = 0;
                for (let j = 0; j < PUNTOS; j++) { const k = i + j - mitad + 1; if (k >= 0 && k < c.length) s += c[k] * h[f][j]; }
                if (Math.abs(s) > pico) pico = Math.abs(s);
            }
        }
    }
    return pico;
}
