// voz-lib.mjs - ajustes de ElevenLabs probados en la v3, lectura de la clave y ducking de los SFX bajo la voz.
// Lo comparten generar-voz.mjs, mount-voz.mjs y mount-sfx.mjs (que reaplica el ducking si la voz ya esta montada).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

// Ajustes de la v3 (LECCIONES-V3 5, SINTESIS regla 3). Por linea se pueden cambiar en SCRIPT.md (**Seed:**, **Settings:**, **Speed:**).
export const VOZ = {
    modelo: 'eleven_multilingual_v2',
    ajustes: { stability: 0.35, similarity_boost: 0.8, style: 0.45, use_speaker_boost: true },
    semilla: 1037,
    idioma: 'es',
    formato: 'mp3_44100_128',
    // «Antonio» (v3). Exige plan de pago por API; la voz de la v4 esta por decidir (SINTESIS 4.3): ELEVENLABS_VOICE_ID o **Voice id:**.
    vozV3: 'htFfPSZGJwjBv1CL0aMD',
    mezcla: {
        objetivo_lufs_por_linea: -17,
        pico_verdadero_db: -1.5,
        volumen_voz: 0.95,
        // Realce por linea: mount-voz monta una COPIA derivada (assets/voz/derived/NN.wav) con `db` de ganancia y un limitador de pico
        // (`limite` lineal, ataque/relajacion en ms); el WAV de assets/voz no se toca y la colocacion por anclas y el habla (ducking,
        // silencio final) se miden sobre el original, asi que ningun tiempo cambia. Solo para lineas cuyo loudnorm por linea no llega a
        // -17 LUFS porque un unico transitorio frena la ganancia lineal (a la v4 le paso a la linea 8: el golpe de la «P» de «Pasa»,
        // pico -1.5 dBFS, la dejo en -22.6 LUFS, ~5 LU por debajo de las demas; con +5 dB y limite 0.84 queda en -17.8 LUFS y pico -1.5).
        realce_por_linea: {
            '08': { db: 5, limite: 0.84, ataque_ms: 2, relajacion_ms: 40 },
        },
        ducking_sfx: { factor: 0.3, factor_impactos: 0.6, antes_s: 0.1, despues_s: 0.18, categorias_impacto: ['impact'] },
        separacion_minima_s: 0.12,   // entre el final de una frase y el inicio de la siguiente (error si es menor)
        costura_s: 0.3,              // silencio deseado en cada costura (SINTESIS 2; aviso)
        holgura_ancla_s: 0.3,        // tolerancia de cada palabra ancla respecto a su t (SINTESIS 4)
        silencio_inicial_s: 1.0,     // 1.0-1.5 s sin voz al abrir (aviso)
        silencio_final_s: 1.5,       // >= 1.5 s sin voz al cerrar (aviso)
    },
};

// Deriva la copia realzada de una linea (ganancia + limitador de pico) con ffmpeg. Salida PCM 16 bit mono a 48 kHz, sin metadatos ni
// version del codificador (bitexact), de modo que volver a derivar produce el mismo archivo byte a byte y git no ve cambios.
export function derivarRealce(origen, destino, realce) {
    const { db, limite, ataque_ms: ataque, relajacion_ms: relajacion } = realce;
    mkdirSync(dirname(destino), { recursive: true });
    const filtro = `volume=${db}dB,alimiter=limit=${limite}:level=disabled:attack=${ataque}:release=${relajacion}`;
    const p = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', origen, '-af', filtro, '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact',
        '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '1', destino], { encoding: 'utf8' });
    if (p.status !== 0) throw new Error(`ffmpeg no pudo derivar el realce de ${origen}: ${(p.stderr || p.error?.message || '').slice(-300)}`);
}

// .env minimo (CLAVE=valor). No se imprime ni se exporta nada.
export function leerEnv(ruta) {
    const env = {};
    if (!existsSync(ruta)) return env;
    for (const l of readFileSync(ruta, 'utf8').split('\n')) {
        const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(l);
        if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return env;
}

// Clave y voz: primero el entorno del proceso, despues <proyecto>/.env (gitignored por el .gitignore raiz).
export function credenciales(rutaEnv) {
    const env = leerEnv(rutaEnv);
    return {
        clave: process.env.ELEVENLABS_API_KEY || env.ELEVENLABS_API_KEY || null,
        vozId: process.env.ELEVENLABS_VOICE_ID || env.ELEVENLABS_VOICE_ID || null,
    };
}

// Baja los <audio id="sfx-..."> que suenan durante una frase (la parte audible: los primeros 0.6 s desde data-start). El volumen
// original queda en data-vol-orig, asi que es idempotente (siempre se parte del original). Los impactos bajan menos (x0.6): un golpe
// fuerte bajo la voz es un error de diseno (SINTESIS 22) y verify-sfx lo marca; el ducking solo lo suaviza.
// `filas`: [{ habla_ini, habla_fin }] absolutas; `cues`: registros de sfx-montado.json (para la categoria de cada audio).
export function aplicarDucking(html, filas, mezcla = {}, cues = []) {
    const d = { ...VOZ.mezcla.ducking_sfx, ...(mezcla.ducking_sfx ?? {}) };
    const ventanas = filas.map((f) => [f.habla_ini - d.antes_s, f.habla_fin + d.despues_s]);
    const categoria = Object.fromEntries(cues.map((c) => [c.audioId ?? `sfx-${c.id}`, c.categoria]));
    const impacto = new Set(d.categorias_impacto);
    const detalle = [];
    const r3 = (x) => Math.round(x * 1000) / 1000;
    const nuevo = html.replace(/<audio id="(sfx-[^"]+)"([^>]*)>/g, (todo, id, resto) => {
        const ini = Number(/data-start="([\d.]+)"/.exec(resto)?.[1]);
        const dur = Number(/data-duration="([\d.]+)"/.exec(resto)?.[1]);
        const vol = Number(/data-volume="([\d.]+)"/.exec(resto)?.[1]);
        const orig = Number(/data-vol-orig="([\d.]+)"/.exec(resto)?.[1] ?? vol);
        const fin = ini + Math.min(dur, 0.6);
        const choca = ventanas.some(([a, b]) => ini < b && fin > a);
        const base = resto.replace(/\s*data-vol-orig="[\d.]+"/, '').replace(/data-volume="[\d.]+"/, `data-volume="${orig}"`);
        if (!choca) return `<audio id="${id}"${base}>`;
        const factor = impacto.has(categoria[id]) ? d.factor_impactos : d.factor;
        const v = r3(orig * factor);
        detalle.push({ id, categoria: categoria[id] ?? null, t: ini, de: orig, a: v });
        return `<audio id="${id}"${base.replace(/data-volume="[\d.]+"/, `data-volume="${v}" data-vol-orig="${orig}"`)}>`;
    });
    return { html: nuevo, detalle };
}
