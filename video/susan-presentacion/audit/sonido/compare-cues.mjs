#!/usr/bin/env node
// Compara los <audio> reales de index.html contra los eventos visuales GSAP (audit/sonido/events.json) y los transientes de sfx-meta.json.
//
//   golpeReal   = data-start + ancla(archivo)              (instante en que se OYE el golpe, si el recorte data-duration no lo corta)
//   visual      = tiempo ABSOLUTO del evento visual al que debe acompañar (selector explícito por cue, abajo)
//   error       = golpeReal - visual                       (+ = el sonido llega tarde; - = adelantado)
//   desglose    = (cue - visual)  [causa (a): el cue del storyboard no sale del tween]  +  (ancla)  [causa (b): el golpe no está al inicio del mp3]
//                 (c) se comprueba aparte: data-start == inicioDelCuadro + cueLocal
//
// Para referencias de tipo "ventana" (whoosh sobre una transición) el error es 0 si el pico del whoosh cae dentro de [inicio, fin] y, si no,
// la distancia al borde más cercano.
//
// Uso: node audit/sonido/compare-cues.mjs     -> escribe audit/sonido/cues.json y audit/sonido/cues-tabla.md y resume por consola
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const events = JSON.parse(readFileSync(join(RAIZ, 'audit/sonido/events.json'), 'utf8'));
const meta = Object.fromEntries(JSON.parse(readFileSync(join(RAIZ, 'assets/sfx/sfx-meta.json'), 'utf8')).map((m) => [m.archivo, m]));
const html = readFileSync(join(RAIZ, 'index.html'), 'utf8');
const storyboard = readFileSync(join(RAIZ, 'STORYBOARD.md'), 'utf8');
const r3 = (x) => Math.round(x * 1000) / 1000;

// ---------- audios reales ----------
const audios = [...html.matchAll(/<audio id="([^"]+)" src="assets\/sfx\/([^"]+)" data-start="([\d.]+)" data-duration="([\d.]+)" data-track-index="(\d+)" data-volume="([\d.]+)"/g)].map((m) => ({
    id: m[1], archivo: m[2], start: +m[3], dur: +m[4], pista: +m[5], vol: +m[6], cuadro: m[1].replace(/^sfx-/, '').replace(/-\d+$/, ''), n: +m[1].match(/-(\d+)$/)[1],
}));
const inicioCuadro = (c) => events.cuadros[c].start;
// cue local del storyboard (para comprobar la causa c)
const cueLocal = {};
for (const b of storyboard.split(/^## Frame /m).slice(1)) {
    const src = /^- src:\s*compositions\/frames\/([\w-]+)\.html/m.exec(b)?.[1];
    const sfx = /^- sfx:\s*(.+)$/m.exec(b)?.[1];
    if (src && sfx) cueLocal[src] = sfx.split(';').map((s) => s.trim()).filter(Boolean).map((s) => { const [t, n] = s.split(/\s+/); return { t: +t, n }; });
}

// ---------- helpers de eventos ----------
const idOf = (e) => e.objetivos[0]?.id || e.objetivos[0]?.clase || e.objetivos[0]?.tag || '';
const evs = (cuadro, re, filtro = () => true) => events.eventos.filter((e) => e.cuadro === cuadro && re.test(idOf(e)) && filtro(e)).sort((a, b) => a.inicioAbsoluto - b.inicioAbsoluto);
const entra = (e) => e.desde && (e.desde.opacity === 0 || e.desde.scale < 1 || e.desde.scaleX === 0 || e.desde.scaleY === 0 || e.desde.y !== undefined || e.desde.x !== undefined || e.desde.strokeDashoffset !== undefined);
function E(cuadro, re, nth = 0, filtro = () => true, campo = 'inicioAbsoluto') {
    const l = evs(cuadro, re, filtro);
    if (!l[nth]) throw new Error(`Sin evento ${cuadro} ${re} #${nth}`);
    return { t: l[nth][campo], desc: `${idOf(l[nth])} (${l[nth].tipo} ${Object.keys(l[nth].propiedades).join('/')}, ${l[nth].ease})` };
}
// el evento de entrada del grupo más cercano a un tiempo local dado (cuando varios elementos escalonados comparten selector)
function cercano(cuadro, re, tLocal, filtro = entra) {
    const base = inicioCuadro(cuadro);
    const l = evs(cuadro, re, filtro);
    l.sort((a, b) => Math.abs(a.inicioAbsoluto - base - tLocal) - Math.abs(b.inicioAbsoluto - base - tLocal));
    return { t: l[0].inicioAbsoluto, desc: `${idOf(l[0])} (escalonado, el más cercano a ${tLocal})` };
}
// transición del cuadro: tweens de `main` sobre #el-<cuadro> que ENTRAN (fromTo)
function transicion(cuadro) {
    const l = events.eventos.filter((e) => e.cuadro === 'main' && e.objetivos[0]?.id === `el-${cuadro}` && e.tipo === 'fromTo');
    const e = l[0];
    return { win: [e.inicioAbsoluto, e.finAbsoluto], t: (e.inicioAbsoluto + e.finAbsoluto) / 2, desc: `transición de entrada de ${cuadro} (${Object.keys(e.propiedades).join('/')}, ${e.ease}) ${e.inicioAbsoluto}-${e.finAbsoluto}` };
}
const L = (cuadro, tLocal, desc) => ({ t: inicioCuadro(cuadro) + tLocal, desc });

// teclas visuales del cuadro 1 (tablas K1/K2 y ENTER del propio archivo)
const f1 = readFileSync(join(RAIZ, 'compositions/frames/01-hook.html'), 'utf8');
const tabla = (n) => eval(new RegExp(`var ${n} = (\\[[\\s\\S]*?\\n            \\]);`).exec(f1)[1]);
const K1 = tabla('K1'), K2 = tabla('K2');
const ENTER = +/var ENTER = ([\d.]+)/.exec(f1)[1];
const barra = E('01-hook', /01-hook-bar$/, 0, () => true);
// ráfagas del cuadro 1: primera tecla de cada tramo que cubre un cue de typing
const k1 = K1.map((k) => k[0]);

// teclas visuales de los demás cuadros: tweens instantáneos sobre la clase de caracteres
const CLASE_TECLAS = { '04-intro': /04-intro-c$/, '05-camara': /05-camara-ch\d*$/, '07-revision': /07-revision-ch$/, '09-analitica': /09-analitica-ch$/, '10-alumno': /10-alumno-ch$/, '11-confianza': /11-confianza-ch$/ };
export function teclasVisuales(cuadro) {
    if (cuadro === '01-hook') return [...K1.map((k) => k[0]), ...K2.map((k) => k[0])];
    const re = CLASE_TECLAS[cuadro];
    if (!re) return [];
    const base = inicioCuadro(cuadro);
    const ts = events.eventos.filter((e) => e.cuadro === cuadro && re.test(e.objetivos[0]?.clase || e.objetivos[0]?.id || '') && e.duracion < 0.01).map((e) => r3(e.inicioAbsoluto - base)).filter((t) => t > 0.001);
    return [...new Set(ts)].sort((a, b) => a - b);
}

// ---------- referencias visuales por cue (id -> {t|win, desc}) ----------
const R = {};
const R1 = '01-hook', R2 = '02-minutos', R3 = '03-tarde', R4 = '04-intro', R5 = '05-camara', R6 = '06-vivo', R7 = '07-revision', R8 = '08-reportes', R9 = '09-analitica', R10 = '10-alumno', R11 = '11-confianza', R12 = '12-cierre';
R['sfx-01-hook-1'] = L(R1, K1[0][0], `primera tecla "P" de la línea 1 (tabla K1)`);
R['sfx-01-hook-2'] = L(R1, K1.find((k) => k[1] === 'q')[0], `primera tecla de la palabra equivocada "quita" (K1)`);
R['sfx-01-hook-3'] = L(R1, ENTER, `Enter: el caret cae a la 2ª línea (ENTER)`);
R['sfx-01-hook-4'] = L(R1, K2[0][0], `primera tecla "c" de "cada clase." (K2)`);
R['sfx-01-hook-5'] = { t: barra.t + 0.42, desc: `marcador azul termina de dibujarse (01-hook-bar 3.55+0.42)` };
R['sfx-02-minutos-1'] = transicion(R2);
R['sfx-02-minutos-2'] = E(R2, /02-minutos-icon$/, 0);
R['sfx-02-minutos-3'] = E(R2, /02-minutos-chip1$/, 0);
R['sfx-02-minutos-4'] = E(R2, /02-minutos-chip2$/, 0);
R['sfx-02-minutos-5'] = E(R2, /02-minutos-numrow$/, 0, (e) => e.propiedades.scale === 1.16);
R['sfx-02-minutos-6'] = E(R2, /02-minutos-numrow$/, 0, (e) => e.propiedades.scale === 1.16);
R['sfx-03-tarde-1'] = E(R3, /03-tarde-card$/, 0);
R['sfx-03-tarde-2'] = E(R3, /03-tarde-ln$/, 0);
R['sfx-03-tarde-3'] = E(R3, /03-tarde-fill$/, 0, (e) => e.tipo === 'set');
R['sfx-03-tarde-4'] = E(R3, /03-tarde-chip$/, 0);
R['sfx-04-intro-1'] = transicion(R4);
R['sfx-04-intro-2'] = { ...E(R4, /04-intro-word$/, 0, () => true), desc: 'el riser debe TERMINAR en el impacto del wordmark (04-intro-word 1.90)', fin: true };
R['sfx-04-intro-3'] = E(R4, /04-intro-word$/, 0, () => true);
R['sfx-04-intro-4'] = E(R4, /04-intro-sp1$/, 0);
R['sfx-04-intro-5'] = E(R4, /04-intro-badge$/, 0);
R['sfx-04-intro-6'] = L(R4, teclasVisuales(R4)[0], 'primera letra de la tagline tecleada (04-intro-c)');
R['sfx-05-camara-1'] = transicion(R5);
const bx = evs(R5, /05-camara-bx\d+$/, entra);
for (let i = 0; i < 8; i++) R[`sfx-05-camara-${i + 2}`] = { t: bx[i].inicioAbsoluto, desc: `bracket #${i + 1} se traba (${idOf(bx[i])} scale 0.82->1 back.out)` };
R['sfx-05-camara-10'] = E(R5, /05-camara-glow$/, 0);
R['sfx-05-camara-11'] = E(R5, /05-camara-rb$/, 0);
R['sfx-05-camara-12'] = L(R5, teclasVisuales(R5)[0], 'primera letra del titular tecleado (05-camara-ch0)');
R['sfx-06-vivo-1'] = transicion(R6);
for (let i = 0; i < 4; i++) R[`sfx-06-vivo-${i + 2}`] = E(R6, new RegExp(`06-vivo-pill-${i + 1}$`), 0);
R['sfx-06-vivo-6'] = E(R6, /06-vivo-lg-warn$/, 0);
R['sfx-06-vivo-7'] = E(R6, /06-vivo-lg-bad$/, 0);
R['sfx-06-vivo-8'] = E(R6, /06-vivo-glint$/, 0);
R['sfx-06-vivo-9'] = E(R6, /06-vivo-r-p$/, 0);
R['sfx-07-revision-1'] = transicion(R7);
R['sfx-07-revision-2'] = E(R7, /07-revision-cursor$/, 0, (e) => e.propiedades.scale === 0.84);
R['sfx-07-revision-3'] = E(R7, /07-revision-prim$/, 0, (e) => e.propiedades.backgroundColor);
R['sfx-07-revision-4'] = E(R7, /07-revision-st-ok$/, 0);
R['sfx-07-revision-5'] = E(R7, /07-revision-count-col$/, 0, () => true);
R['sfx-08-reportes-1'] = transicion(R8);
const rows = evs(R8, /08-reportes-row-\d+$/, (e) => e.desde && e.desde.y === 42);
for (let i = 0; i < 5; i++) R[`sfx-08-reportes-${i + 2}`] = { t: rows[i].inicioAbsoluto, desc: `fila ${i + 1} del reporte entra (${idOf(rows[i])} y 42->0)` };
R['sfx-08-reportes-7'] = E(R8, /08-reportes-cu$/, 0, (e) => e.propiedades.scale === 0.85);
R['sfx-08-reportes-8'] = E(R8, /08-reportes-ti$/, 0);
R['sfx-09-analitica-1'] = transicion(R9);
R['sfx-09-analitica-2'] = E(R9, /09-analitica-chl$/, 0);
const pts = evs(R9, /09-analitica-pt\d*$/, entra);
[0, 2, 4, 6].forEach((p, i) => { R[`sfx-09-analitica-${i + 3}`] = { t: pts[p].inicioAbsoluto, desc: `punto observado S${p + 1} (${idOf(pts[p])}); los otros 4 puntos no tienen sonido` }; });
R['sfx-09-analitica-7'] = { ...E(R9, /09-analitica-core$/, 0), desc: 'el riser debe TERMINAR en el cruce del límite (09-analitica-core 3.08)', fin: true };
R['sfx-09-analitica-8'] = E(R9, /09-analitica-core$/, 0);
R['sfx-09-analitica-9'] = E(R9, /09-analitica-chx$/, 0);
R['sfx-09-analitica-10'] = E(R9, /09-analitica-sp-1$/, 0);
R['sfx-09-analitica-11'] = E(R9, /09-analitica-sp-2$/, 0);
R['sfx-09-analitica-12'] = L(R9, teclasVisuales(R9)[0], 'primera letra del titular tecleado (09-analitica-ch)');
R['sfx-10-alumno-1'] = transicion(R10);
R['sfx-10-alumno-2'] = E(R10, /10-alumno-hero$/, 0);
R['sfx-10-alumno-3'] = E(R10, /10-alumno-cal$/, 0);
R['sfx-10-alumno-4'] = cercano(R10, /10-alumno-ce$|10-alumno-ce-?\d+$/, 1.9, (e) => e.desde && e.desde.scale === 0);
R['sfx-10-alumno-5'] = cercano(R10, /10-alumno-ce$|10-alumno-ce-?\d+$/, 2.1, (e) => e.desde && e.desde.scale === 0);
R['sfx-10-alumno-6'] = E(R10, /10-alumno-ok$/, 0);
R['sfx-10-alumno-7'] = E(R10, /10-alumno-rc$/, 0);
R['sfx-10-alumno-8'] = E(R10, /10-alumno-star$/, 0);
R['sfx-10-alumno-9'] = L(R10, teclasVisuales(R10)[0], 'primera letra del titular tecleado (10-alumno-ch)');
R['sfx-11-confianza-1'] = { ...E(R11, /11-confianza-bd$/, 0), desc: 'cue 0.3 sin evento exacto; el más cercano es el trazo del cuerpo del candado (11-confianza-bd 0.42); el icono entra en 0.00 (disc)' };
for (let i = 0; i < 3; i++) R[`sfx-11-confianza-${i + 2}`] = E(R11, new RegExp(`11-confianza-pill-${i + 1}$`), 0);
R['sfx-12-cierre-1'] = transicion(R12);
R['sfx-12-cierre-2'] = E(R12, /12-cierre-l2$/, 0);
R['sfx-12-cierre-3'] = E(R12, /12-cierre-mesh$/, 0);
R['sfx-12-cierre-4'] = E(R12, /12-cierre-unach$/, 0);
R['sfx-12-cierre-5'] = E(R12, /12-cierre-gloss$/, 0);

// ---------- tipo de sonido por archivo ----------
const tipoDe = (a) => ({ 'typing.mp3': 'typing', 'key-press.mp3': 'key', 'click-soft.mp3': 'click', 'click.mp3': 'click', 'whoosh.mp3': 'whoosh', 'whoosh-short.mp3': 'whoosh', 'pop.mp3': 'pop', 'ping.mp3': 'ping', 'sparkle.mp3': 'sparkle', 'riser-1s.mp3': 'riser', 'impact-bass-1.mp3': 'impact', 'impact-bass-2.mp3': 'impact', 'chime.mp3': 'chime', 'notification.mp3': 'notif', 'error.mp3': 'error' }[a]);

const filas = audios.map((a) => {
    const m = meta[a.archivo];
    const ref = R[a.id];
    if (!ref) throw new Error(`Sin referencia visual para ${a.id}`);
    const tipo = tipoDe(a.archivo);
    const silencioso = /SILENCIO/.test(m.forma);
    // causa (c): data-start esperado = inicio del cuadro + cue local del storyboard
    const cl = cueLocal[a.cuadro][a.n - 1];
    const dc = r3(a.start - (inicioCuadro(a.cuadro) + cl.t));
    // dónde se oye el golpe
    const ancla = silencioso ? null : m.ancla;
    const golpe = silencioso ? null : r3(a.start + ancla);
    const cortado = !silencioso && a.dur < ancla - 0.002; // el recorte data-duration termina antes del golpe -> no se oye
    let error = null, errorVentana = null;
    if (!silencioso) {
        if (ref.win) {
            const [w0, w1] = ref.win;
            errorVentana = golpe < w0 ? golpe - w0 : golpe > w1 ? golpe - w1 : 0;
            error = errorVentana;
        } else error = r3(golpe - ref.t);
    }
    // para risers: dónde termina el sonido frente al impacto
    const finArchivo = r3(a.start + Math.min(a.dur, m.duracion));
    const errorFinRiser = ref.fin ? r3(finArchivo - ref.t) : null;
    const cueVsVisual = ref.win ? null : r3(a.start - ref.t); // (a)
    const A = cueVsVisual === null ? 0 : Math.abs(cueVsVisual * 1000), B = ancla === null || ref.win ? 0 : ancla * 1000;
    const causa = silencioso ? 'archivo silencioso' : cortado ? 'recorte data-duration < ancla (+ b)' : A > 40 && B > 40 ? 'a+b' : B > 40 ? 'b (golpe no está al inicio del mp3)' : A > 40 ? 'a (cue escrito a ojo)' : 'ok (<= 40 ms)';
    return {
        causa,
        id: a.id, cuadro: a.cuadro, archivo: a.archivo, tipo, dataStart: a.start, dataDuration: a.dur, volumen: a.vol,
        cueStoryboardLocal: cl.t, desfaseCausaC_s: dc,
        anclaArchivo: ancla, golpeReal: golpe, visual: ref.win ? null : r3(ref.t), ventanaVisual: ref.win ?? null, visualDesc: ref.desc,
        errorMs: error === null ? null : Math.round(error * 1000),
        causaA_cueVsVisual_ms: cueVsVisual === null ? null : Math.round(cueVsVisual * 1000),
        causaB_anclaArchivo_ms: ancla === null ? null : Math.round(ancla * 1000),
        cortadoAntesDelGolpe: cortado, silencioso, errorFinRiser_ms: errorFinRiser === null ? null : Math.round(errorFinRiser * 1000),
    };
});

// ---------- estadística ----------
const medibles = filas.filter((f) => f.errorMs !== null && !f.cortadoAntesDelGolpe && f.tipo !== 'riser');
const abs = (f) => Math.abs(f.errorMs);
const cuenta = (l, u) => l.filter((f) => abs(f) > u).length;
const mediana = (l) => { const s = [...l].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const resumen = {
    total: filas.length, silenciosos: filas.filter((f) => f.silencioso).length, cortadosAntesDelGolpe: filas.filter((f) => f.cortadoAntesDelGolpe).length,
    medibles: medibles.length,
    mayor40: cuenta(medibles, 40), mayor80: cuenta(medibles, 80), mayor150: cuenta(medibles, 150), mayor300: cuenta(medibles, 300),
    medianaAbsMs: mediana(medibles.map(abs)), medianaSignedMs: mediana(medibles.map((f) => f.errorMs)),
    // si se contaran también los cortados como fallo total
    fallosTotales: filas.filter((f) => f.silencioso || f.cortadoAntesDelGolpe).length,
    porTipo: {},
};
for (const f of medibles) { (resumen.porTipo[f.tipo] ||= []).push(f.errorMs); }
for (const [k, v] of Object.entries(resumen.porTipo)) resumen.porTipo[k] = { n: v.length, medianaMs: mediana(v), minMs: Math.min(...v), maxMs: Math.max(...v) };
// causa dominante
const dom = medibles.map((f) => ({ id: f.id, a: f.causaA_cueVsVisual_ms, b: f.causaB_anclaArchivo_ms, e: f.errorMs })).filter((x) => x.a !== null);
resumen.causa = {
    cuesConDesfaseCueVsTween_mayor40ms: dom.filter((x) => Math.abs(x.a) > 40).length,
    cuesConAnclaArchivo_mayor40ms: dom.filter((x) => x.b > 40).length,
    cuesConAmbos: dom.filter((x) => Math.abs(x.a) > 40 && x.b > 40).length,
    cuesSoloCausaA: dom.filter((x) => Math.abs(x.a) > 40 && x.b <= 40).length,
    cuesSoloCausaB: dom.filter((x) => Math.abs(x.a) <= 40 && x.b > 40).length,
    desfaseCausaC_maxAbsMs: Math.max(...filas.map((f) => Math.abs(f.desfaseCausaC_s * 1000))),
};
resumen.peores20 = [...medibles].sort((a, b) => abs(b) - abs(a)).slice(0, 20).map((f) => ({ id: f.id, archivo: f.archivo, errorMs: f.errorMs, a: f.causaA_cueVsVisual_ms, b: f.causaB_anclaArchivo_ms, causa: f.causa, visual: f.visualDesc }));

// ---------- eventos visuales sin sonido ----------
const usados = new Set(filas.map((f) => f.visual).filter((t) => t !== null));
const importantes = [
    ['02-minutos', /02-minutos-chip/, 'chip multiplicador'], ['03-tarde', /03-tarde-card$/, 'tarjeta'], ['04-intro', /04-intro-pill$/, 'pill UNACH · FCA C-I'],
    ['05-camara', /05-camara-row\d*$/, 'fila de pase de lista (se solapa con ping)'], ['05-camara', /05-camara-chip$/, 'chip "listo en 6 s"'],
    ['06-vivo', /06-vivo-chip$/, 'chip "Sesión en curso"'], ['06-vivo', /06-vivo-stat$/, 'tarjetas de estadística'], ['06-vivo', /06-vivo-liq$/, 'tanque líquido'],
    ['08-reportes', /08-reportes-chip-\d$/, 'chips "En el límite" / "Sin derecho"'], ['08-reportes', /08-reportes-mk$/, 'marcador 20 %'],
    ['09-analitica', /09-analitica-pt\d*$/, 'puntos observados (8 puntos, solo 4 pops)'], ['09-analitica', /09-analitica-sc-\d$/, 'tarjetas de cifras (cuenta 24.6 %)'], ['09-analitica', /09-analitica-fit$/, 'línea de ajuste dibujándose'],
    ['10-alumno', /10-alumno-chip-\d$/, 'chips "Aviso de límite" / "Proyección"'], ['10-alumno', /10-alumno-eb$/, 'etiqueta "Vista del alumno"'],
    ['11-confianza', /11-confianza-kh$/, 'ojo de cerradura / cierre del candado'], ['11-confianza', /11-confianza-ring$/, 'anillo de pulso del candado'],
    ['12-cierre', /12-cierre-l1$/, 'slam de "Pasa lista en"'], ['12-cierre', /12-cierre-c\d$/, 'cascada de letras de SUSAN'], ['12-cierre', /12-cierre-pill$/, 'pill UNACH · FCA C-I'],
    ['07-revision', /07-revision-hl$/, 'subrayado azul del titular'],
];
const sinSonido = [];
for (const [c, re, desc] of importantes) {
    for (const e of evs(c, re, entra)) {
        const t = e.inicioAbsoluto;
        const cerca = filas.some((f) => f.dataStart + (f.anclaArchivo ?? 0) > t - 0.12 && f.dataStart + (f.anclaArchivo ?? 0) < t + 0.12 && f.cuadro === c);
        const cerca2 = filas.some((f) => f.cuadro === c && f.visual !== null && Math.abs(f.visual - t) < 0.12);
        if (!cerca && !cerca2 && !sinSonido.some((x) => x.cuadro === c && x.objetivo === idOf(e))) sinSonido.push({ cuadro: c, abs: r3(t), local: r3(t - inicioCuadro(c)), que: desc, objetivo: idOf(e) });
    }
}
// typing: teclas visuales vs golpes de audio
const typing = [];
for (const c of ['01-hook', '04-intro', '05-camara', '07-revision', '09-analitica', '10-alumno', '11-confianza']) {
    const vis = teclasVisuales(c).map((t) => inicioCuadro(c) + t);
    if (!vis.length) continue;
    const aud = [];
    for (const a of audios.filter((x) => x.cuadro === c && (x.archivo === 'typing.mp3' || x.archivo === 'key-press.mp3'))) {
        const m = meta[a.archivo];
        for (const g of (m.golpes.length ? m.golpes : [m.hit])) if (g < a.dur) aud.push(a.start + g);
    }
    aud.sort((x, y) => x - y);
    const err = vis.map((t) => (aud.length ? Math.min(...aud.map((g) => Math.abs(g - t))) : Infinity));
    typing.push({
        cuadro: c, teclasVisuales: vis.length, primeraVisual: r3(vis[0] - inicioCuadro(c)), ultimaVisual: r3(vis.at(-1) - inicioCuadro(c)), golpesAudio: aud.length,
        primerGolpeAudio: aud.length ? r3(aud[0] - inicioCuadro(c)) : null, ultimoGolpeAudio: aud.length ? r3(aud.at(-1) - inicioCuadro(c)) : null,
        teclasConGolpeA40ms: err.filter((e) => e <= 0.04).length, teclasConGolpeA80ms: err.filter((e) => e <= 0.08).length,
        medianaDistanciaMs: aud.length ? Math.round(mediana(err.map((e) => e * 1000))) : null,
    });
}

const salida = { resumen, typing, sinSonido, filas };
writeFileSync(join(RAIZ, 'audit/sonido/cues.json'), JSON.stringify(salida, null, 1) + '\n');

// tabla markdown
const f = (x) => (x === null || x === undefined ? '—' : x);
let md = '| # | cue | archivo | data-start | ancla | golpe real | visual | error (ms) | (a) cue−visual | (b) ancla | causa | evento visual |\n|--|--|--|--|--|--|--|--|--|--|--|--|\n';
filas.forEach((x, i) => {
    const nota = x.silencioso ? 'ARCHIVO SILENCIOSO' : x.cortadoAntesDelGolpe ? `CORTADO antes del golpe (dur ${x.dataDuration}s < ancla)` : '';
    md += `| ${i + 1} | ${x.id.replace('sfx-', '')} | ${x.archivo} | ${x.dataStart} | ${f(x.anclaArchivo)} | ${f(x.golpeReal)} | ${x.visual ?? `${x.ventanaVisual[0]}-${x.ventanaVisual[1]}`} | ${f(x.errorMs)} | ${f(x.causaA_cueVsVisual_ms)} | ${f(x.causaB_anclaArchivo_ms)} | ${x.causa}${nota ? ' — ' + nota : ''} | ${x.visualDesc} |\n`;
});
writeFileSync(join(RAIZ, 'audit/sonido/cues-tabla.md'), md);

console.log(JSON.stringify(resumen, null, 1));
console.log('TYPING', JSON.stringify(typing, null, 0));
console.log('SIN SONIDO', sinSonido.length, JSON.stringify(sinSonido.slice(0, 60)));
