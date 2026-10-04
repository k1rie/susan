// Utilidades compartidas por los scripts de sonido v2 (derive/catalogo, bake-typing, mount-sfx, verify-sfx).
// No se ejecuta solo. Exporta: raiz del proyecto, lectura/escritura de WAV, catalogo, jerarquia de categorias y mezclador de referencia.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SR = 48000;
export const r3 = (x) => Math.round(x * 1000) / 1000;
export const db = (x) => 20 * Math.log10(Math.max(x, 1e-9));

// Raiz del proyecto: --root <dir> o la carpeta que contiene scripts/. Permite probar los mismos scripts en un proyecto de juguete.
export function raiz(argv = process.argv) {
    const i = argv.indexOf('--root');
    if (i > 0) return resolve(argv[i + 1]);
    return resolve(dirname(fileURLToPath(import.meta.url)), '../..');
}
export const opcion = (argv, nombre, defecto = null) => (argv.indexOf(nombre) > 0 ? argv[argv.indexOf(nombre) + 1] : defecto);

// Jerarquia para la regla de polifonia: si hay mas de 4 sonidos a la vez se atenuan los de menor rango.
export const RANGO = { impact: 10, riser: 8, snap: 8, chime: 7, check: 7, alert: 7, zoom: 6, whoosh: 6, sparkle: 5, ping: 5, pop: 5, click: 4, ui: 4, tick: 3, texture: 2, key: 2 };

// ---------------------------------------------------------------------------------------------------------------------------------------
// Ganancia de mezcla por categoria (v2.1). Los cues llevan su volumen en la etiqueta (sfx(tl, t, nombre, vol)) como NIVEL RELATIVO entre
// sonidos; el nivel absoluto de la mezcla se fija aqui, en el montaje, y no en los 12 cuadros. El revisor midio -23.7 LUFS y -5.6 dBFS de pico:
// demasiado bajo para un video de solo efectos. Con +4 dB en las capas no percusivas (lo pedido) el mezclador de referencia daba -21.0 LUFS, fuera del
// objetivo -20..-18 (los topes de 0.80 por cue se comen parte de la subida en los ticks de 0.6): se sube a +6 dB en ticks, pops, pings, teclas, texturas,
// whooshes, zooms, sparkles, chimes y ui; el riser se queda en +4 (su energia sube hacia el impacto y agrandaria el salto previo al slam); el check
// (muy energetico: 92 % de la energia de su segundo) y click/snap (transitorios) suben poco; los impactos no se tocan.
// El catalogo repite este numero en `gananciaDb` y sube `volDefecto` en la misma medida (para un cue sin volumen en la etiqueta):
// `gananciaDb` solo se aplica al volumen de ETIQUETA; volDefecto ya la lleva incorporada.
// ---------------------------------------------------------------------------------------------------------------------------------------
export const GANANCIA_DB = { tick: 6, pop: 6, ping: 6, key: 6, texture: 6, whoosh: 6, zoom: 6, riser: 4, sparkle: 6, chime: 6, check: 2, ui: 6, alert: 6, click: 3, snap: 2, impact: 0 };
// Ningun cue pasa de este volumen despues de la ganancia (data-volume <= 0.80: mas arriba un solo cue domina la mezcla).
export const VOL_MAX_CUE = 0.8;
// Extra solo para el tecleo horneado del gancho (01-hook): es la parte que debe enganchar y era la mas debil (-35.8/-40.8 dBFS RMS por segundo).
// +2 dB sobre los +6 de la categoria key = +8 dB en total respecto a la v2.0 (se pidieron +6: el gancho sigue en -29/-33 dBFS RMS por segundo, lejos del
// objetivo del revisor de >= -26, porque son teclas sueltas con huecos).
export const EXTRA_TECLEO_DB = { '01-hook': 2 };
export const lineal = (dB) => 10 ** (dB / 20);
// Volumen final de un cue con volumen de etiqueta `vol`: etiqueta x ganancia de su categoria, con tope VOL_MAX_CUE.
export const volConGanancia = (vol, entrada) => Math.min(VOL_MAX_CUE, vol * lineal(entrada.gananciaDb ?? GANANCIA_DB[entrada.categoria] ?? 0));

// Ajustes puntuales de mezcla por cue, para suavizar saltos de nivel entre segundos SIN tocar los cuadros. Se buscan por nombre del sonido
// y ventana de tiempo ABSOLUTA (no por id: el numero de orden cambia si un cuadro agrega o quita una etiqueta; la ventana tolera el desplazamiento
// de +-0.1 s de los cues 'asent'). `vol` = volumen FINAL (data-volume, ya con ganancia); `db` = relativo al ya calculado. Lo aplica mount-sfx.
export const AJUSTES_CUE = [
    // 02-minutos, 5.0-7.0 s: el slam (impact-hit a 6.40 s) llegaba 14.6 dB por encima del segundo anterior. Se baja el impacto a 0.60 (pedido del revisor),
    // y la textura previa (el riser que sube hacia el golpe y el whoosh de 5.53 s) se sube para que el segundo 5-6 no quede tan hundido.
    { nombre: 'impact-hit', desde: 6.3, hasta: 6.5, vol: 0.6, motivo: 'slam de 02-minutos' },
    { nombre: 'riser-1s', desde: 6.3, hasta: 6.5, vol: 0.7, motivo: 'textura previa al slam de 02-minutos' },
    { nombre: 'whoosh-m', desde: 5.45, hasta: 5.65, vol: 0.6, motivo: 'textura previa al slam de 02-minutos' },
    // 09-analitica, 30-32 s: mismo patron (riser + impact-hit a 31.27 s, 10.9 dB por encima del segundo anterior).
    { nombre: 'impact-hit', desde: 31.2, hasta: 31.4, vol: 0.6, motivo: 'slam de 09-analitica' },
    { nombre: 'draw', desde: 29.95, hasta: 30.1, vol: 0.7, motivo: 'textura previa al slam de 09-analitica' },
    { nombre: 'tick-2', desde: 30.7, hasta: 30.8, vol: 0.6, motivo: 'cuenta previa al slam de 09-analitica' },
    { nombre: 'tick-3', desde: 30.95, hasta: 31.05, vol: 0.6, motivo: 'cuenta previa al slam de 09-analitica' },
];

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

// Mezclador de referencia (lineal, igual que el motor: suma de pistas sin compensacion). `items`: [{ wav, dataStart, mediaStart, dataDuration, vol }]
// Devuelve { ch:[L,R], pico, picoT }.  El motor redondea data-start al milisegundo: se replica.
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

// ---------------------------------------------------------------------------------------------------------------------------------------
// Medicion de referencia de la mezcla (estimada ANTES de renderizar; el render real se mide con ffmpeg ebur128).
// ---------------------------------------------------------------------------------------------------------------------------------------

// Sonoridad integrada ITU-R BS.1770-4 / EBU R128 (ponderacion K a 48 kHz, bloques de 400 ms cada 100 ms, compuertas -70 LUFS y -10 LU).
// `ch` = [L, R] a SR. Devuelve LUFS (o -Infinity si todo es silencio). Se valido contra `ffmpeg -af ebur128` (ver informe de la mezcla).
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

// Pico verdadero estimado (sobremuestreo x4 con sinc ventaneada de 16 puntos por fase, como pide BS.1770 Anexo 2). Devuelve amplitud lineal.
export function picoVerdadero(ch) {
    const FASES = 4, PUNTOS = 16, mitad = PUNTOS / 2;
    const h = Array.from({ length: FASES }, (_, f) => Array.from({ length: PUNTOS }, (_, j) => {
        const x = j - mitad + 1 - f / FASES;
        const sinc = Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
        return sinc * (0.5 + 0.5 * Math.cos((Math.PI * x) / mitad));   // ventana de Hann
    }));
    let pico = 0;
    for (const c of ch) {
        for (let i = 0; i < c.length; i++) {
            const v = Math.abs(c[i]);
            if (v < pico * 0.7) continue;   // atajo: una muestra muy por debajo del pico actual no puede generar un pico entre muestras mayor
            for (let f = 0; f < FASES; f++) {
                let s = 0;
                for (let j = 0; j < PUNTOS; j++) { const k = i + j - mitad + 1; if (k >= 0 && k < c.length) s += c[k] * h[f][j]; }
                if (Math.abs(s) > pico) pico = Math.abs(s);
            }
        }
    }
    return pico;
}
