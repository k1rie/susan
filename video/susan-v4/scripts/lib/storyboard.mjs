// storyboard.mjs - lectura de STORYBOARD.md y SCRIPT.md para los scripts de sonido y voz de la v4.
//
// Por que un lector propio y no el de la skill (product-launch-video/scripts/lib/storyboard.mjs): aqui solo hacen falta unas pocas
// claves (src, duration, transition_in, sfx_cues, vo_anchor, voiceover) y se quiere que el lector sea ESTRICTO como
// frame-packets (`## Frame N` en H2, claves `- clave: valor` en la columna 0, PLAYBOOK 1.3/1.5): si una clave no la ve
// frame-packets tampoco debe contar para el sonido. Las trampas que el lector tolerante aceptaria se informan como avisos.
//
// ---------------------------------------------------------------------------------------------------------------------------
// SINTAXIS DE `sfx_cues` (convencion v4; la documenta tambien scripts/README.md)
//
//   - sfx_cues: 0.40 whoosh-s; 1.55 tap -3dB; 2.10 pop-2; 2.10 sheen-s +2dB
//
//   sfx_cues  := 'none' | cue ( ';' cue )* [';']
//   cue       := tiempo ESPACIO nombre [ ESPACIO ganancia ]
//   tiempo    := segundos LOCALES del cuadro (0 = data-start de su envoltorio en index.html), decimal con punto, >= 0 y <= duration;
//                se admite el sufijo 's' (1.55s). Es el instante en que debe caer el ANCLA del sonido: el golpe en los percusivos
//                (anclaje 'hit'), el pico del barrido en los whoosh ('pico'), el final del archivo en riser/zoom-in ('fin').
//   nombre    := nombre CANONICO de assets/sfx/CATALOG.json ([a-z0-9-]). Los alias heredados (pop, whoosh, click...) y los
//                obsoletos (flash, sparkle-short, sparkle) se rechazan con el nombre canonico sugerido.
//   ganancia  := +N dB | -N dB (p. ej. -3dB, +1.5dB), relativa al volDefecto del catalogo; rango -24..+6 dB. Opcional.
//
//   Una sola linea por cuadro (las claves multilinea se pierden). El orden de los cues dentro de la linea da su id:
//   `<frame_id>#<n>` y el <audio id="sfx-<frame_id>-<n>">. Un cue en el mismo instante que otro es una capa (2-3 capas por evento).
// ---------------------------------------------------------------------------------------------------------------------------
// SINTAXIS DE LAS ANCLAS DE VOZ (STORYBOARD `vo_anchor` y SCRIPT.md `**Anchor:**`)
//
//   «palabra» @ 1.70s · «otra» @ 3.90s        (separador ';' o '·'; comillas «» "" “” '' u omitidas; 's' opcional)
//   tiempo = segundos LOCALES del cuadro en que debe sonar el inicio de esa palabra.
// ---------------------------------------------------------------------------------------------------------------------------

// Duracion por omision de cada transicion inyectable (la del registro de la skill, transitions.json). `cut`/`none` = 0.
export const DUR_TRANSICION = { crossfade: 0.5, 'blur-crossfade': 0.6, 'push-slide': 0.5, 'zoom-through': 0.4, squeeze: 0.4 };
const DUR_TRANSICION_MAX = 2.0;

export const frameIdDe = (src) => (src ? src.split('/').pop().replace(/\.html?$/i, '') : null);

function quitarComillas(v) {
    if (v.length >= 2 && ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'"))) return v.slice(1, -1);
    return v;
}

// transition_in -> { tipo, dur, dir } o null (corte seco). Misma regla que transitions.mjs de la skill.
export function parseTransicion(raw) {
    const s = (raw ?? '').trim();
    if (['', 'cut', 'none'].includes(s.toLowerCase())) return null;
    const partes = s.split(/\s+/);
    const t = { tipo: partes[0].toLowerCase(), dur: null, dir: null };
    for (const p of partes.slice(1)) {
        const m = /^(\d+(?:\.\d+)?)s?$/.exec(p);
        if (m) t.dur = Number(m[1]);
        else t.dir = p.toUpperCase();
    }
    t.conocida = t.tipo in DUR_TRANSICION;
    t.dur = Math.min(t.dur ?? DUR_TRANSICION[t.tipo] ?? DUR_TRANSICION['blur-crossfade'], DUR_TRANSICION_MAX);
    return t;
}

const RE_CUE = /^(\d+(?:\.\d+)?)s?\s+(\S+)(?:\s+([+-]\d+(?:\.\d+)?)\s*db)?$/i;
export const GANANCIA_CUE_MIN = -24;
export const GANANCIA_CUE_MAX = 6;

// `sfx_cues` crudo -> { cues: [{ n, t, nombre, gananciaDb, texto }], errores: [texto] }. No consulta el catalogo.
export function parseSfxCues(raw) {
    const cues = [], errores = [];
    const s = (raw ?? '').trim();
    if (!s || /^(none|ninguno)$/i.test(s)) return { cues, errores };
    const items = s.split(';').map((x) => x.trim()).filter(Boolean);
    items.forEach((texto) => {
        const m = RE_CUE.exec(texto);
        if (!m) {
            const pista = /\d,\d/.test(texto) ? ' (usa punto decimal: 1.55, no 1,55)' : /@/.test(texto) ? ' (la ganancia va como -3dB, no con @)' : '';
            errores.push(`cue mal formado "${texto}": se espera "<segundos> <nombre> [+-NdB]"${pista}`);
            return;
        }
        const nombre = m[2];
        if (!/^[a-z0-9][a-z0-9-]*$/.test(nombre)) { errores.push(`cue "${texto}": el nombre "${nombre}" debe ir en minusculas como en CATALOG.json ([a-z0-9-])`); return; }
        const g = m[3] == null ? 0 : Number(m[3]);
        if (g < GANANCIA_CUE_MIN || g > GANANCIA_CUE_MAX) { errores.push(`cue "${texto}": ganancia ${g} dB fuera de ${GANANCIA_CUE_MIN}..+${GANANCIA_CUE_MAX} dB`); return; }
        cues.push({ n: cues.length + 1, t: Number(m[1]), nombre, gananciaDb: g, texto });
    });
    return { cues, errores };
}

const RE_ANCLA = /^[«"“'‘]?\s*(.+?)\s*[»"”'’]?\s*@\s*(\d+(?:\.\d+)?)\s*s?$/;
// «palabra» @ 1.70s · «otra» @ 3.90s -> { anclas: [{ palabra, t }], errores }
export function parseAnclas(raw) {
    const anclas = [], errores = [];
    for (const parte of (raw ?? '').split(/[;·]/).map((x) => x.trim()).filter(Boolean)) {
        const m = RE_ANCLA.exec(parte);
        if (!m) { errores.push(`ancla mal formada "${parte}": se espera «palabra» @ 1.70s`); continue; }
        anclas.push({ palabra: m[1], t: Number(m[2]) });
    }
    return { anclas, errores };
}

// ------------------------------------------------------------------------------------------------ STORYBOARD.md
const RE_FRAME = /^## Frame\s+(\d+)\b\s*[—–:.-]*\s*(.*)$/;
const RE_CLAVE = /^-\s+([A-Za-z_][\w-]*):\s*(.+?)\s*$/;
const CLAVES_UNICAS = new Set(['src', 'duration', 'transition_in', 'transition', 'sfx_cues', 'vo_anchor', 'voiceover', 'status']);

export function leerStoryboard(texto) {
    const lineas = texto.split(/\r?\n/);
    const globals = {}, frames = [], errores = [], avisos = [];
    let i = 0;
    // frontmatter plano
    while (i < lineas.length && !lineas[i].trim()) i++;
    if (lineas[i]?.trim() === '---') {
        let j = i + 1;
        for (; j < lineas.length && lineas[j].trim() !== '---'; j++) {
            const k = lineas[j].indexOf(':');
            if (k > 0) globals[lineas[j].slice(0, k).trim().toLowerCase()] = quitarComillas(lineas[j].slice(k + 1).trim());
        }
        i = j + 1;
    }
    let actual = null;
    const numeros = new Set();
    for (let n = i; n < lineas.length; n++) {
        const l = lineas[n];
        const f = RE_FRAME.exec(l);
        if (f) {
            actual = { numero: Number(f[1]), titulo: f[2].trim(), linea: n + 1, campos: {}, narrativa: [] };
            if (numeros.has(actual.numero)) errores.push(`linea ${n + 1}: "## Frame ${actual.numero}" repetido (los numeros de cuadro deben ser unicos)`);
            numeros.add(actual.numero);
            frames.push(actual);
            continue;
        }
        if (/^#{1,2}\s/.test(l)) {
            if (/^#{2}\s+(frame|beat|scene)\b/i.test(l)) avisos.push(`linea ${n + 1}: "${l.trim()}" no es "## Frame N — Titulo": frame-packets no lo ve como cuadro`);
            actual = null;
            continue;
        }
        if (!actual) continue;
        if (/^###\s+(frame|beat|scene)\b/i.test(l)) avisos.push(`linea ${n + 1}: "${l.trim()}" abre un cuadro nuevo en el lector tolerante de la skill (PLAYBOOK 1.5 trampa 2); escribelo como parrafo`);
        const c = RE_CLAVE.exec(l);
        if (c) {
            const clave = c[1].toLowerCase();
            if (clave in actual.campos) {
                (CLAVES_UNICAS.has(clave) ? errores : avisos).push(`Frame ${actual.numero}: la clave "${clave}" aparece dos veces (frame-packets toma la primera y el lector de la skill la ultima)`);
                continue;
            }
            actual.campos[clave] = c[2];
            continue;
        }
        if (/^\s+[-*]\s+(sfx_cues|vo_anchor|duration|src|transition_in):/i.test(l) || /^\*\s+(sfx_cues|vo_anchor|duration|src|transition_in):/i.test(l)) {
            avisos.push(`Frame ${actual.numero}, linea ${n + 1}: "${l.trim()}" no esta en la columna 0 con "- ": frame-packets no la lee`);
        }
        if (/^-\s+sfx_cues:\s*$/i.test(l)) avisos.push(`Frame ${actual.numero}: "- sfx_cues:" vacio (escribe "none" si el cuadro no lleva sonido)`);
        actual.narrativa.push(l);
    }
    for (const f of frames) {
        const k = f.campos;
        f.src = k.src ?? null;
        f.frameId = frameIdDe(f.src);
        const d = /(\d+(?:\.\d+)?)/.exec(k.duration ?? '');
        f.duracion = d ? Number(d[1]) : null;
        f.transicion = parseTransicion(k.transition_in ?? k.transition ?? '');
        f.sfxCuesCrudo = k.sfx_cues ?? null;
        f.voAnchorCrudo = k.vo_anchor ?? null;
        f.voiceover = k.voiceover != null ? quitarComillas(k.voiceover) : null;
        f.status = k.status ?? 'outline';
        f.narrativa = f.narrativa.join('\n').trim();
    }
    return { globals, frames, errores, avisos };
}

// ------------------------------------------------------------------------------------------------ SCRIPT.md
// Formato (PLAYBOOK 2.1): una linea por cuadro
//   ## Line 5 — Quién empieza a faltar (Frame 5)
//   **Time:** 0.5 – 4.2s            ventana LOCAL estimada de la frase (sirve para reservar huecos de SFX antes de tener voz)
//   **Anchor:** «faltar» @ 1.70s · «tarde» @ 3.90s
//   **Delivery:** ...               (ignorado por los scripts)
//       Ves quién empieza a faltar… antes de que sea tarde.      <- solo el texto con sangria de 4 espacios o tabulador va al TTS
// Opciones por linea (tambien `**`, las ignora el parseScript de la skill): **Seed:** 1101 · **Settings:** stability 0.45 · style 0.3
// · **Speed:** 1.1 (atempo despues de generar) · **Context:** none (sin texto vecino) · **Take:** <huella de la cache>.
// Cabecera (antes de la primera linea): **Voice id:** <id de ElevenLabs> (si no, ELEVENLABS_VOICE_ID del entorno o de .env).
const RE_LINEA = /^#{2,3}\s+(.*?)\(\s*frame\s+(\d+)\s*\)\s*$/i;
const RE_OPC = /^\*\*\s*([^*:]+?)\s*:\s*\*\*\s*(.*?)\s*$/;

function parseAjustes(v) {
    const out = {};
    const nombres = { stability: 'stability', estabilidad: 'stability', similarity: 'similarity_boost', similarity_boost: 'similarity_boost', similitud: 'similarity_boost', style: 'style', estilo: 'style' };
    for (const p of v.split(/[·;,]/).map((x) => x.trim()).filter(Boolean)) {
        const m = /^([a-z_]+)\s*[:=]?\s*(\d+(?:\.\d+)?)$/i.exec(p);
        if (m && nombres[m[1].toLowerCase()]) out[nombres[m[1].toLowerCase()]] = Number(m[2]);
    }
    return out;
}

export function leerScript(texto) {
    const cabecera = {}, lineas = [], errores = [], avisos = [];
    let actual = null;
    texto.split(/\r?\n/).forEach((l, n) => {
        const h = RE_LINEA.exec(l);
        if (h) {
            const num = /line\s+(\d+)/i.exec(h[1]);
            const etiqueta = h[1].replace(/^line\s+\d+\s*[—–:.-]*\s*/i, '').trim();
            actual = { numero: num ? Number(num[1]) : lineas.length + 1, frame: Number(h[2]), etiqueta, lineaMd: n + 1, partes: [], anclas: [], ventana: null, opciones: {} };
            actual.id = String(actual.numero).padStart(2, '0');
            lineas.push(actual);
            return;
        }
        if (/^#{1,3}\s/.test(l)) { if (actual && /^##\s/.test(l)) actual = null; return; }
        const o = RE_OPC.exec(l.trim());
        if (o && !/^(?: {4,}|\t)/.test(l)) {
            const clave = o[1].toLowerCase(), v = o[2];
            if (!actual) {
                if (clave === 'voice id' || clave === 'voz id' || clave === 'voice_id') cabecera.vozId = v.replace(/[`"']/g, '').trim();
                else cabecera[clave] = v;
                return;
            }
            if (clave === 'anchor' || clave === 'ancla' || clave === 'anchors') {
                const r = parseAnclas(v);
                actual.anclas.push(...r.anclas);
                errores.push(...r.errores.map((e) => `Line ${actual.numero}: ${e}`));
            } else if (clave === 'time' || clave === 'tiempo' || clave === 'window') {
                const m = /(\d+(?:\.\d+)?)\s*s?\s*[–—-]+\s*(\d+(?:\.\d+)?)/.exec(v);
                if (m) actual.ventana = { desde: Number(m[1]), hasta: Number(m[2]) };
                else avisos.push(`Line ${actual.numero}: **Time:** ilegible ("${v}"), se espera "0.5 – 4.2s"`);
            } else if (clave === 'seed' || clave === 'semilla') {
                if (/^\d+$/.test(v)) actual.opciones.semilla = Number(v);
                else errores.push(`Line ${actual.numero}: **Seed:** debe ser un entero ("${v}")`);
            } else if (clave === 'settings' || clave === 'ajustes') {
                actual.opciones.ajustes = parseAjustes(v);
            } else if (clave === 'speed' || clave === 'velocidad') {
                const x = Number(v.replace(/[^\d.]/g, ''));
                if (x >= 0.7 && x <= 1.3) actual.opciones.velocidad = x;
                else errores.push(`Line ${actual.numero}: **Speed:** fuera de 0.7..1.3 ("${v}")`);
            } else if (clave === 'context' || clave === 'contexto') {
                actual.opciones.sinContexto = /^(none|no|sin|ninguno)$/i.test(v.trim());
            } else if (clave === 'take' || clave === 'toma') {
                actual.opciones.toma = v.replace(/[`"']/g, '').trim();
            }
            return;
        }
        if (!actual) return;
        const t = /^(?: {4,}|\t)(.+)$/.exec(l);
        if (t) actual.partes.push(t[1].trim());
    });
    const ids = new Set(), porFrame = {};
    for (const l of lineas) {
        l.texto = l.partes.join(' ').replace(/\s+/g, ' ').trim();
        delete l.partes;
        if (!l.texto) errores.push(`Line ${l.numero} (Frame ${l.frame}): sin texto con sangria de 4 espacios (el texto sin sangria no llega al TTS)`);
        if (!l.anclas.length) errores.push(`Line ${l.numero} (Frame ${l.frame}): falta **Anchor:** («palabra» @ t local del cuadro)`);
        if (ids.has(l.id)) errores.push(`Line ${l.numero} repetida`);
        ids.add(l.id);
        (porFrame[l.frame] ??= []).push(l.numero);
    }
    for (const [f, ns] of Object.entries(porFrame)) if (ns.length > 1) avisos.push(`Frame ${f} tiene ${ns.length} lineas (${ns.join(', ')}): SINTESIS regla 2 pide una sola por cuadro (el audio.mjs de la skill solo conservaria la ultima; mount-voz si las monta todas)`);
    return { cabecera, lineas, errores, avisos };
}

// Normaliza texto para comparar voz y storyboard (sin acentos, sin puntuacion, minusculas).
export const normalizarTexto = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
