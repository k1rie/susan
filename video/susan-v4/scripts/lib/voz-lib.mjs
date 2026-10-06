// voz-lib.mjs - ajustes de ElevenLabs probados en la v3, lectura de la clave y ducking de los SFX bajo la voz.
// Lo comparten generar-voz.mjs, mount-voz.mjs y mount-sfx.mjs (que reaplica el ducking si la voz ya esta montada).
import { existsSync, readFileSync } from 'node:fs';

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
        ducking_sfx: { factor: 0.3, factor_impactos: 0.6, antes_s: 0.1, despues_s: 0.18, categorias_impacto: ['impact'] },
        separacion_minima_s: 0.12,   // entre el final de una frase y el inicio de la siguiente (error si es menor)
        costura_s: 0.3,              // silencio deseado en cada costura (SINTESIS 2; aviso)
        holgura_ancla_s: 0.3,        // tolerancia de cada palabra ancla respecto a su t (SINTESIS 4)
        silencio_inicial_s: 1.0,     // 1.0-1.5 s sin voz al abrir (aviso)
        silencio_final_s: 1.5,       // >= 1.5 s sin voz al cerrar (aviso)
    },
};

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
