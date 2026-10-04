#!/usr/bin/env node
// Verificador del sistema de sonido v2 (contrato de sincronia, audit/sonido/REPORT.md 7.6). Falla el build (codigo 1) si algo no cuadra.
//
// Uso:  node scripts/verify-sfx.mjs [--root <proyecto>] [--video renders/video.mp4] [--tol-ms 33.3] [--strict]
//                                   [--solo biblioteca|etiquetas|montaje|render] [--lectura-min <s>] [--plan v2/plan.json] [--out v2/verify-sfx.json]
//                                   [--eventos audit/sonido/events.json] [--sin-visible]
// Orden (cada paso solo corre si sus entradas existen; --solo corre uno):
//   (a) biblioteca  CATALOG.json + assets/sfx/derived: ancla <= 10 ms en percusivos (medida con analyze-sfx.mjs y comparada con el catalogo),
//                   pico a -6 dBFS (+-0.3), sin md5 repetidos, sin archivos mudos (< -40 dBFS), sin muestras >= 0 dBFS, sin sostenidos en 'impact'
//                   (duracion <= 1 s y energia que cae), riser que de verdad sube (>= 25 dB entre el inicio y el final), alturas crecientes en tick-1..4.
//                   Un sonido con `deprecated: true` en CATALOG.json (p. ej. sparkle-short, sustituido por sheen / sheen-s) no puede aparecer en ningun cuadro:
//                   ERROR en (b) y en (c) si algun cue lo usa (el alias antiguo que apunta a el hereda la marca).
//   (b) etiquetas<->tween  v2/sfx-cues.json (extract-events.mjs --cues): cada 'sfx:*' coincide (<= 33.3 ms) con el inicio de un tween de su cuadro
//                   (con el FIN si el anclaje es 'fin'); excepciones: teclas y whoosh/swipe (deben caer dentro de un tween, aviso) y ticks (dentro de
//                   un tween). Etiqueta huerfana = ERROR; tween 'hero' sin sonido a +-33 ms = AVISO (ERROR con --strict); marcas read: sin >= min_lectura
//                   segundos antes del corte siguiente = ERROR (min_lectura = el de SU entrada en v2/plan.json frames[].read_marks[], 0.5 si no hay plan;
//                   --lectura-min lo anula para todas solo si se pasa explicito); teclas > 14/s = ERROR; huecos > 1.0 s sin ningun sonido = AVISO.
//                   Hero de CAMARA ('<cuadro>-world', cam* de frame-helpers.snippet.js): sin sonido por diseno, se cuentan en UNA linea de nota. El resto de
//                   hero sin sonido se avisa en una linea por cuadro.
//                   'Sonido sin evento visible' (AVISO): cada tap/click/blip/soft-in/pop/check/stamp/snap/lock/shutter debe tener un tween de magnitud
//                   perceptible (opacity/transform/color/trazo, umbrales en scripts/lib/sfx-visible.mjs) que EMPIECE a +-33 ms de su etiqueta en su cuadro.
//                   Lee audit/sonido/events.json (extract-events.mjs --events): si falta o no es coherente con v2/sfx-cues.json lo regenera en una carpeta
//                   temporal; si aun asi no es coherente, el chequeo se omite con un aviso. --sin-visible lo desactiva.
//   (c) montaje     index.html + v2/sfx-mounted.json: data-start + ancla - media-start == tCue (+-1 ms), data-duration >= ancla + 0.15, archivos existentes,
//                   todos los cues montados, pico de la mezcla recalculado <= -1 dBFS, sin muestras >= 0.99, polifonia reportada.
//   (d) render      con --video: scripts/verify-sfx-sync.py (correlacion de ataque contra el MP4, tolerancia 33.3 ms; un cue tonal cuya correlacion de
//                   banda ancha se ensucia con el ruido de codec de las notas vecinas se re-mide en su propia banda de frecuencia).
// Escribe v2/verify-sfx.json.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { SR, RANGO, cargarCatalogo, db, leerWav, mezclar, opcion, picoWav, raiz, r3 } from './lib/sfx-lib.mjs';
import { ANCLA_HORNEADO, esTecla } from './bake-typing.mjs';
import { cargarPlan } from './lib/plan.mjs';
import { SONIDOS_CON_EVENTO, coherentes, evaluarCue } from './lib/sfx-visible.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const R = raiz();
const argv = process.argv;
const SOLO = opcion(argv, '--solo');
const STRICT = argv.includes('--strict');
const TOL = Number(opcion(argv, '--tol-ms', 1000 / 30)) / 1000;
// --lectura-min solo anula el min_lectura de cada marca del plan si se pasa EXPLICITO (null = usar el del plan, 0.5 si no hay plan)
const LECTURA = opcion(argv, '--lectura-min') === null ? null : Number(opcion(argv, '--lectura-min'));
const LECTURA_DEFECTO = 0.5;
const VIDEO = opcion(argv, '--video');
const quiere = (n) => !SOLO || SOLO === n;
const informe = { generado: new Date().toISOString(), proyecto: R, secciones: {} };
let fallos = 0;
const seccion = (nombre) => {
    const s = { errores: [], avisos: [], notas: [] };
    informe.secciones[nombre] = s;
    return s;
};
const cerrar = (nombre, s) => {
    s.ok = s.errores.length === 0;
    console.log(`\n== (${nombre}) ${s.ok ? 'OK' : 'FALLA'}: ${s.errores.length} errores, ${s.avisos.length} avisos`);
    for (const n of s.notas) console.log(`   ${n}`);
    for (const e of s.errores) console.log(`   ERROR  ${e}`);
    for (const a of s.avisos.slice(0, 40)) console.log(`   aviso  ${a}`);
    if (s.avisos.length > 40) console.log(`   aviso  ... y ${s.avisos.length - 40} mas (ver v2/verify-sfx.json)`);
    if (!s.ok) fallos++;
};

// ------------------------------------------------------------------------------------------------ (a) biblioteca
function dominante(x, desde, n) {
    // frecuencia dominante (Hz) de x[desde, desde+n) con un barrido de Goertzel de 200 a 8000 Hz (paso 10 Hz)
    let mejor = 0, f0 = 0;
    for (let f = 200; f <= 8000; f += 10) {
        const k = 2 * Math.cos((2 * Math.PI * f) / SR);
        let s1 = 0, s2 = 0;
        for (let i = 0; i < n; i++) { const s = x[desde + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))) + k * s1 - s2; s2 = s1; s1 = s; }
        const p = s1 * s1 + s2 * s2 - k * s1 * s2;
        if (p > mejor) { mejor = p; f0 = f; }
    }
    return f0;
}
function biblioteca() {
    const s = seccion('biblioteca');
    const cat = cargarCatalogo(R);
    const unicos = Object.entries(cat).filter(([, e]) => !e.alias);
    for (const [a, e] of Object.entries(cat)) if (e.alias && !cat[e.alias]) s.errores.push(`alias ${a} -> ${e.alias} no existe`);
    // medicion independiente con analyze-sfx.mjs sobre la carpeta de la biblioteca
    const tmp = join(tmpdir(), `susan-analisis-${process.pid}.json`);
    const dir = join(R, 'assets/sfx/derived');
    execFileSync('node', [join(AQUI, 'analyze-sfx.mjs'), '--dir', dir, '--out', tmp], { stdio: 'ignore', maxBuffer: 1 << 28 });
    const meta = Object.fromEntries(JSON.parse(readFileSync(tmp, 'utf8')).map((m) => [m.archivo.replace(/\.wav$/, ''), m]));
    const md5 = {};
    for (const [n, e] of unicos) {
        const ruta = join(R, e.file);
        if (!existsSync(ruta)) { s.errores.push(`${n}: no existe ${e.file}`); continue; }
        const buf = readFileSync(ruta);
        const h = createHash('md5').update(buf).digest('hex');
        (md5[h] ??= []).push(n);
        const w = leerWav(ruta), m = meta[n];
        const pk = db(picoWav(w));
        if (w.sr !== SR) s.errores.push(`${n}: ${w.sr} Hz (se exigen ${SR})`);
        if (pk < -40) s.errores.push(`${n}: archivo mudo (pico ${r3(pk)} dBFS)`);
        if (Math.abs(pk - -6) > 0.3) s.errores.push(`${n}: pico ${r3(pk)} dBFS (se exigen -6 +-0.3)`);
        if (picoWav(w) >= 0.999) s.errores.push(`${n}: muestras a escala completa (saturacion)`);
        if (Math.abs(Math.abs(e.picoDbFS) - Math.abs(pk)) > 0.05) s.errores.push(`${n}: CATALOG picoDbFS ${e.picoDbFS} != medido ${r3(pk)} (regenera el catalogo)`);
        if (!m) { s.errores.push(`${n}: sin medicion de analyze-sfx`); continue; }
        // ancla: percusivos <= 10 ms y el catalogo debe coincidir con la medicion
        const esperado = e.anclaje === 'hit' ? m.ancla : e.anclaje === 'pico' ? m.pico : e.anclaje === 'inicio' ? m.onset : w.dur;
        if (Math.abs(e.anclaMs - esperado * 1000) > 1.5) s.errores.push(`${n}: anclaMs ${e.anclaMs} != medido ${r3(esperado * 1000)} (anclaje ${e.anclaje}; regenera el catalogo)`);
        if ((e.anclaje === 'hit' || e.anclaje === 'inicio') && e.anclaMs > 10) s.errores.push(`${n}: ancla ${e.anclaMs} ms > 10 ms (recorta el inicio en derive-sfx.sh)`);
        if (Math.abs(e.duracionMs - w.dur * 1000) > 1.5) s.errores.push(`${n}: duracionMs ${e.duracionMs} != ${r3(w.dur * 1000)}`);
        for (const k of ['categoria', 'anclaje', 'volDefecto', 'uso', 'file', 'rango']) if (e[k] === undefined) s.errores.push(`${n}: falta el campo ${k} en CATALOG.json`);
        if (e.rango !== RANGO[e.categoria]) s.errores.push(`${n}: rango ${e.rango} no coincide con la categoria ${e.categoria}`);
        // impactos: sin sostenidos
        if (e.categoria === 'impact') {
            if (e.duracionMs > 1000) s.errores.push(`${n}: impacto de ${e.duracionMs} ms (> 1000: drone sostenido)`);
            if (m.sostenido > 0.5) s.errores.push(`${n}: impacto sostenido (${r3(m.sostenido * 100)} % del archivo a <= 6 dB del maximo)`);
        }
        // riser: debe subir de verdad
        if (e.categoria === 'riser') {
            const rms = (a, b) => { let t = 0; for (let i = a; i < b; i++) t += w.ch[0][i] ** 2; return db(Math.sqrt(t / Math.max(1, b - a))); };
            const ini = rms(0, Math.round(0.1 * SR)), fin = rms(w.frames - Math.round(0.15 * SR), w.frames);
            s.notas.push(`${n}: RMS primeros 100 ms ${r3(ini)} dBFS -> ultimos 150 ms ${r3(fin)} dBFS (sube ${r3(fin - ini)} dB)`);
            if (fin - ini < 25) s.errores.push(`${n}: el riser sube solo ${r3(fin - ini)} dB (< 25)`);
            if (fin < -30) s.errores.push(`${n}: el final del riser es inaudible (${r3(fin)} dBFS)`);
        }
        // algo debe sonar: energia > -40 dBFS RMS en algun tramo de 50 ms
        let mx = -200;
        const v = Math.round(0.05 * SR);
        for (let i = 0; i + v <= w.frames; i += v) { let t = 0; for (let j = i; j < i + v; j++) t += w.ch[0][j] ** 2; mx = Math.max(mx, db(Math.sqrt(t / v))); }
        if (mx < -40) s.errores.push(`${n}: RMS maximo ${r3(mx)} dBFS (silencio)`);
    }
    for (const [h, ns] of Object.entries(md5)) if (ns.length > 1) s.errores.push(`archivos duplicados (md5 ${h.slice(0, 8)}): ${ns.join(', ')}`);
    // alturas crecientes
    const subida = (prefijo, n, desdeMs, durMs, nivel) => {
        const fs = [];
        for (let i = 1; i <= n; i++) {
            const e = cat[`${prefijo}${i}`];
            if (!e) { s.errores.push(`falta ${prefijo}${i}`); return; }
            const w = leerWav(join(R, e.file));
            fs.push(dominante(w.ch[0], 0, Math.round((durMs / 1000) * SR)));
        }
        const ok = fs.every((f, i) => i === 0 || f > fs[i - 1]);
        s.notas.push(`${prefijo}1..${n}: frecuencia dominante ${fs.join(' < ')} Hz`);
        if (!ok) (nivel === 'error' ? s.errores : s.avisos).push(`${prefijo}1..${n}: las alturas no crecen (${fs.join(', ')} Hz)`);
    };
    subida('tick-', 4, 0, 40, 'error');
    subida('ping-note', 8, 0, 40, 'aviso');
    subida('pop-', 4, 0, 30, 'aviso');
    s.notas.push(`${unicos.length} archivos unicos, ${Object.keys(cat).length - unicos.length} alias`);
    cerrar('a: biblioteca', s);
}


// ------------------------------------------------------------------------------------------------ sonido sin evento visible
function cargarEventos(s, d) {
    const ruta = resolve(R, opcion(argv, '--eventos', 'audit/sonido/events.json'));
    const leer = (r) => { try { return JSON.parse(readFileSync(r, 'utf8')).eventos ?? null; } catch { return null; } };
    let eventos = existsSync(ruta) ? leer(ruta) : null;
    let coh = eventos ? coherentes(eventos, d.tweens) : null;
    if (!eventos || !coh.ok) {
        // events.json falta o es de otra version del video: se regenera en una carpeta temporal con el mismo extract-events.mjs
        const tmp = join(tmpdir(), `susan-events-${process.pid}.json`);
        const r = spawnSync('node', [join(AQUI, 'extract-events.mjs'), '--events', '--out', tmp, '--root', R], { encoding: 'utf8', maxBuffer: 1 << 26 });
        eventos = r.status === 0 ? leer(tmp) : null;
        coh = eventos ? coherentes(eventos, d.tweens) : null;
        if (eventos && coh.ok) s.notas.push(`events.json ${existsSync(ruta) ? 'incoherente con sfx-cues.json' : 'ausente'}: regenerado con extract-events.mjs --events`);
    }
    if (!eventos || !coh.ok) {
        s.avisos.push(`sonido sin evento visible: OMITIDO, no hay events.json coherente con v2/sfx-cues.json (${coh ? `${coh.faltan} tweens de ${coh.tweens} sin pareja` : 'no se pudo extraer'}): node scripts/extract-events.mjs --cues --events`);
        return null;
    }
    return eventos;
}
function sinEventoVisible(s, d, cues) {
    const eventos = cargarEventos(s, d);
    if (!eventos) return;
    const revisados = cues.filter((c) => SONIDOS_CON_EVENTO.test(c.nombre));
    const sin = [];
    for (const c of revisados) {
        const r = evaluarCue(c, eventos, d.cuadros, TOL);
        if (!r.visible) sin.push({ id: c.id, nombre: c.nombre, t: c.t, cuadro: c.cuadro, candidatos: r.candidatos });
    }
    s.notas.push(`sonido sin evento visible: ${revisados.length} cues de golpe revisados (tap/click/blip/soft-in/pop/check/stamp/snap/lock/shutter), ${sin.length} sin cambio perceptible a +-${r3(TOL * 1000)} ms`);
    s.sinEventoVisible = sin;
    for (const x of sin) {
        const cand = x.candidatos.length ? `solo hay: ${x.candidatos.slice(0, 3).join(' | ')}${x.candidatos.length > 3 ? ` (+${x.candidatos.length - 3})` : ''}, todos por debajo del umbral` : 'ningun tween empieza en ese fotograma';
        s.avisos.push(`sonido sin evento visible: ${x.id} (${x.nombre} @${x.t} s): ${cand}. Eliminalo, re-anclalo a un evento real (misma variable T) o agrega un cambio visible`);
    }
}

// ------------------------------------------------------------------------------------------------ (b) etiquetas <-> tween
function etiquetas() {
    const s = seccion('etiquetas');
    const rutaCues = join(R, 'v2/sfx-cues.json');
    if (!existsSync(rutaCues)) { s.errores.push(`falta v2/sfx-cues.json: node scripts/extract-events.mjs --cues`); return cerrar('b: etiquetas<->tween', s); }
    const cat = cargarCatalogo(R);
    const d = JSON.parse(readFileSync(rutaCues, 'utf8'));
    const { cues, tweens, lecturas = [] } = d;
    const por = {};
    for (const t of tweens) (por[t.cuadro] ??= []).push(t);
    const enTween = (c, margen) => (por[c.cuadro] ?? []).some((t) => c.t >= t.t0 - margen && c.t <= t.t1 + margen);
    let exactos = 0, ventana = 0;
    for (const c of cues) {
        const e = cat[c.nombre];
        if (!e) { s.errores.push(`${c.id}: "${c.nombre}" no esta en CATALOG.json`); continue; }
        // un sonido retirado (deprecated en CATALOG.json) no puede volver a un cuadro: es ERROR aunque el tiempo cuadre
        if (e.deprecated) s.errores.push(`${c.id} (${c.cuadro} @${c.t} s): "${c.nombre}" esta marcado como obsoleto en CATALOG.json${e.alias ? ` (alias de ${e.alias})` : ''}: ${e.deprecadoRazon ?? 'sin razon'}`);
        if (c.t < -1e-6 || c.t > d.duracion + 1e-6) { s.errores.push(`${c.id}: t=${c.t} fuera del video (0-${d.duracion})`); continue; }
        if (esTecla(c.nombre)) { ventana++; continue; }
        if (e.categoria === 'whoosh') {
            if (!enTween(c, 0.066)) s.avisos.push(`${c.id} (${c.nombre} @${c.t}): el whoosh no cae dentro de ningun tween de ${c.cuadro}`);
            ventana++; continue;
        }
        if (e.categoria === 'tick') {
            if (!enTween(c, TOL)) s.errores.push(`${c.id} (${c.nombre} @${c.t}): tick huerfano (ningun tween activo en ${c.cuadro})`);
            ventana++; continue;
        }
        const ts = por[c.cuadro] ?? [];
        // un corte seco o un match cut (dur 0) no genera ningun tween en main: su etiqueta es legitima si cae en el fotograma
        // en que empieza el cuadro entrante (data-start), que es el evento visual real del corte
        const enCorte = c.cuadro === 'main' && Object.values(d.cuadros ?? {}).some((q) => Math.abs(q.start - c.t) <= TOL + 1e-9);
        const ok = enCorte || ts.some((t) => Math.abs(t.t0 - c.t) <= TOL + 1e-9 || ((e.anclaje === 'fin' || e.categoria === 'zoom') && Math.abs(t.t1 - c.t) <= TOL + 1e-9));
        if (ok) exactos++;
        else {
            const cerca = ts.reduce((m, t) => (Math.abs(t.t0 - c.t) < Math.abs(m - c.t) ? t.t0 : m), Infinity);
            s.errores.push(`${c.id} (${c.nombre} @${c.t} s, etiqueta huerfana): ningun tween de ${c.cuadro} empieza a <= ${r3(TOL * 1000)} ms${Number.isFinite(cerca) ? ` (el mas cercano empieza a ${r3(cerca)}: ${r3((c.t - cerca) * 1000)} ms)` : ''}`);
        }
    }
    s.notas.push(`${cues.length} cues: ${exactos} a <= ${r3(TOL * 1000)} ms del inicio de un tween, ${ventana} por ventana (teclas/whoosh/ticks)`);
    // tweens hero sin sonido (agrupados por cuadro e inicio a +-33 ms). Los de CAMARA ('<cuadro>-world') no suenan por diseno: una sola nota.
    // El resto se avisa en UNA linea por cuadro (el detalle completo queda en v2/verify-sfx.json).
    const esCamara = (t) => /-world$/.test(t.obj ?? '');
    const vistos = [];
    for (const t of tweens.filter((x) => x.hero).sort((a, b) => a.t0 - b.t0)) {
        if (vistos.some((v) => v.cuadro === t.cuadro && Math.abs(v.t0 - t.t0) <= TOL)) continue;
        vistos.push(t);
    }
    const sinSonido = vistos.filter((t) => !cues.some((c) => (c.cuadro === t.cuadro || c.cuadro === 'main') && Math.abs(c.t - t.t0) <= TOL + 1e-9));
    const camara = sinSonido.filter(esCamara), otros = sinSonido.filter((t) => !esCamara(t));
    s.notas.push(`${vistos.length} tweens hero distintos; ${sinSonido.length} sin sonido: ${camara.length} de camara (por diseno, no se avisan) y ${otros.length} de otros elementos`);
    s.heroSinSonido = { camara: camara.length, otros: otros.map((t) => ({ cuadro: t.cuadro, t: t.t0, obj: t.obj ?? null })) };
    const porCuadroHero = {};
    for (const t of otros) (porCuadroHero[t.cuadro] ??= []).push(t);
    for (const [cuadro, ts] of Object.entries(porCuadroHero)) {
        const txt = ts.slice(0, 8).map((t) => `${t.obj ?? 'objeto'}@${t.t0}`).join(', ') + (ts.length > 8 ? ` y ${ts.length - 8} mas` : '');
        (STRICT ? s.errores : s.avisos).push(`${ts.length} tween(s) hero sin sonido en ${cuadro}: ${txt}`);
    }
    // densidad de teclas: <= 14/s en ventanas de 1 s [t, t+1)
    const teclas = cues.filter((c) => esTecla(c.nombre) && c.nombre !== 'key-enter' && c.nombre !== 'key-back').map((c) => c.t).sort((a, b) => a - b);
    let maxVentana = 0;
    for (let i = 0; i < teclas.length; i++) maxVentana = Math.max(maxVentana, teclas.filter((t) => t >= teclas[i] && t < teclas[i] + 1).length);
    s.notas.push(`teclas: ${teclas.length}, maximo ${maxVentana} en una ventana de 1 s`);
    if (maxVentana > 14) s.errores.push(`tecleo a ${maxVentana} teclas/s (> 14): usa sfxType, que decima`);
    // lectura: el corte al cuadro siguiente debe llegar >= min_lectura s despues de que la frase queda completa. min_lectura es el de SU marca en el
    // plan (frames[].read_marks[]: decision de ritmo ya aceptada, 0.6-0.85 s); --lectura-min explicito lo anula; sin plan, 0.5 s.
    let plan = null;
    const rutaPlan = resolve(R, opcion(argv, '--plan', 'v2/plan.json'));
    if (existsSync(rutaPlan)) { try { plan = cargarPlan(rutaPlan); } catch (e) { s.avisos.push(`plan ilegible (${e.message}): min_lectura = ${LECTURA ?? LECTURA_DEFECTO} s para todas`); } }
    const norm = (x) => String(x ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
    const minLectura = (l) => {
        if (LECTURA !== null) return { min: LECTURA, origen: '--lectura-min' };
        const marcas = plan?.frames?.find((f) => f.id === l.cuadro)?.read_marks ?? [];
        const m = marcas.find((x) => norm(x.frase) === norm(l.frase)) ?? marcas.find((x) => Math.abs(Number(x.t) - l.tLocal) <= 0.05);
        return m && Number.isFinite(Number(m.min_lectura)) ? { min: Number(m.min_lectura), origen: 'plan' } : { min: LECTURA_DEFECTO, origen: plan ? 'defecto (la marca no esta en el plan)' : 'defecto (sin plan)' };
    };
    const cuadros = Object.entries(d.cuadros ?? {}).map(([id, v]) => ({ id, ini: v.start, fin: v.start + v.duration })).sort((a, b) => a.ini - b.ini);
    const usados = [];
    for (const l of lecturas) {
        const propio = cuadros.find((y) => y.id === l.cuadro);
        const sig = cuadros.find((x) => x.ini > (propio?.ini ?? Infinity));
        // ultimo cuadro: no hay corte siguiente, la lectura debe caber antes del fin del video
        const limite = sig ? sig.ini : propio ? d.duracion : null;
        if (limite === null) continue;
        const { min, origen } = minLectura(l);
        usados.push({ min, origen });
        const margen = limite - l.t;
        if (margen < min - 1e-9) s.errores.push(`lectura corta: "${l.frase}" (${l.cuadro}) queda completa en ${l.t} s y ${sig ? 'el corte empieza' : 'el video termina'} en ${r3(limite)} s (${r3(margen)} s < ${min} s, min_lectura de ${origen})`);
    }
    const minimos = usados.map((u) => u.min);
    s.notas.push(`${lecturas.length} marcas read:, ${usados.filter((u) => u.origen === 'plan').length} comparadas con el min_lectura de su entrada del plan${minimos.length ? ` (${Math.min(...minimos)}-${Math.max(...minimos)} s)` : ''}${LECTURA !== null ? `; --lectura-min ${LECTURA} anula el plan` : ''}`);
    // sonido sin evento visible: cada efecto "de golpe" necesita un cambio de imagen perceptible que empiece en su fotograma
    if (!argv.includes('--sin-visible')) sinEventoVisible(s, d, cues);
    // huecos de silencio > 1.0 s (ventana audible = [t - min(ancla, 0.6), t + min(cola, 0.5)])
    const iv = cues.filter((c) => cat[c.nombre]).map((c) => { const e = cat[c.nombre]; return [c.t - Math.min(e.anclaMs / 1000, 0.6), c.t + Math.min(e.colaMs / 1000, 0.5)]; }).sort((a, b) => a[0] - b[0]);
    let fin = 0;
    for (const [a, b] of iv) { if (a - fin > 1.0) s.avisos.push(`hueco sin sonido de ${r3(a - fin)} s (${r3(fin)} - ${r3(a)} s): agrega una textura (soft-in, fill, scan, tick)`); fin = Math.max(fin, b); }
    if (d.duracion - fin > 1.0) s.avisos.push(`hueco sin sonido de ${r3(d.duracion - fin)} s al final (${r3(fin)} - ${d.duracion} s)`);
    cerrar('b: etiquetas<->tween', s);
}

// ------------------------------------------------------------------------------------------------ (c) montaje
function montaje() {
    const s = seccion('montaje');
    const rutaM = join(R, 'v2/sfx-mounted.json');
    if (!existsSync(rutaM)) { s.errores.push('falta v2/sfx-mounted.json: node scripts/mount-sfx.mjs'); return cerrar('c: montaje', s); }
    const cat = cargarCatalogo(R);
    const m = JSON.parse(readFileSync(rutaM, 'utf8'));
    const html = readFileSync(join(R, m.html ?? 'index.html'), 'utf8');
    const bloque = /<!-- sfx:start[^>]*-->([\s\S]*?)<!-- sfx:end -->/.exec(html)?.[1] ?? '';
    const tags = {};
    for (const t of bloque.matchAll(/<audio\b([^>]*)>/g)) {
        const at = Object.fromEntries([...t[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]]));
        tags[at.id] = at;
    }
    s.notas.push(`${Object.keys(tags).length} <audio> en el bloque sfx de ${m.html}; ${m.cues.length} cues en sfx-mounted.json`);
    if (Object.keys(tags).length !== m.cues.length) s.errores.push(`el HTML tiene ${Object.keys(tags).length} <audio> y sfx-mounted.json ${m.cues.length}: re-ejecuta mount-sfx.mjs`);
    let maxErr = 0;
    const items = [];
    for (const c of m.cues) {
        const a = tags[c.audioId];
        if (!a) { s.errores.push(`${c.id}: no hay <audio id="${c.audioId}"> en el HTML`); continue; }
        const ds = Number(a['data-start']), ms = Number(a['data-media-start'] ?? 0), dd = Number(a['data-duration']), vol = Number(a['data-volume']);
        const horneado = !!c.horneado;
        const e = horneado ? { anclaMs: ANCLA_HORNEADO * 1000, duracionMs: null } : cat[c.sfx];
        if (!e) { s.errores.push(`${c.id}: "${c.sfx}" no esta en el catalogo`); continue; }
        if (e.deprecated) s.errores.push(`${c.id}: "${c.sfx}" esta marcado como obsoleto en el catalogo (${e.deprecadoRazon ?? 'sin razon'})`);
        const ancla = e.anclaMs / 1000;
        const err = (ds + ancla - ms - c.tCue) * 1000;
        maxErr = Math.max(maxErr, Math.abs(err));
        if (Math.abs(err) > 1.0 + 1e-6) s.errores.push(`${c.id}: data-start ${ds} + ancla ${ancla} - media-start ${ms} = ${r3(ds + ancla - ms)} != tCue ${c.tCue} (error ${r3(err)} ms)`);
        // mount-sfx limita el hueco al largo real del archivo (un tick de 70 ms no necesita 150 ms): el minimo exigido es ancla + 0.15 o, si el archivo es mas corto, el archivo entero
        const largoArchivo = e.duracionMs != null ? e.duracionMs / 1000 - ms : Infinity;
        if (dd < Math.min(ancla - ms + 0.15, largoArchivo) - 2e-3) s.errores.push(`${c.id}: data-duration ${dd} < ancla + 0.15 (el golpe se cortaria)`);
        if (ds < 0) s.errores.push(`${c.id}: data-start negativo (${ds}); debe usarse data-media-start`);
        if (Math.abs(ds - c.dataStart) > 1e-6 || Math.abs(dd - c.dataDuration) > 1e-6 || Math.abs(vol - c.volume) > 1e-6) s.errores.push(`${c.id}: el HTML no coincide con sfx-mounted.json (re-ejecuta mount-sfx.mjs)`);
        if (a.src !== c.file) s.errores.push(`${c.id}: src "${a.src}" != "${c.file}"`);
        if (!existsSync(join(R, c.file))) { s.errores.push(`${c.id}: no existe ${c.file}`); continue; }
        if (!horneado && cat[c.sfx].picoDbFS < -40) s.errores.push(`${c.id}: ${c.sfx} esta mudo`);
        if (!(vol > 0 && vol <= 1)) s.errores.push(`${c.id}: data-volume ${vol} fuera de (0,1]`);
        items.push({ wav: leerWav(join(R, c.file)), dataStart: ds, mediaStart: ms, dataDuration: dd, vol, ...c });
    }
    s.notas.push(`aritmetica de montaje: error maximo ${r3(maxErr)} ms (tolerancia 1 ms); ${m.cues.filter((c) => c.mediaStart).length} con data-media-start`);
    // cobertura respecto a sfx-cues.json
    const rutaC = join(R, 'v2/sfx-cues.json');
    if (existsSync(rutaC)) {
        const d = JSON.parse(readFileSync(rutaC, 'utf8'));
        const normales = d.cues.filter((c) => !esTecla(c.nombre));
        for (const c of normales) {
            const x = m.cues.find((y) => y.id === c.id);
            if (!x) s.errores.push(`el cue ${c.id} (${c.nombre} @${c.t}) no esta montado: re-ejecuta mount-sfx.mjs`);
            else if (Math.abs(x.tCue - c.t) > 0.0006) s.errores.push(`${c.id}: tCue ${x.tCue} != etiqueta ${c.t} (montaje desactualizado)`);
        }
        const nTeclas = d.cues.length - normales.length, enHorneado = m.cues.reduce((a, c) => a + (c.horneado?.teclas ?? 0), 0);
        if (nTeclas !== enHorneado) s.errores.push(`${nTeclas} teclas en sfx-cues.json pero ${enHorneado} horneadas`);
        s.notas.push(`${normales.length} cues normales y ${nTeclas} teclas (${m.cues.filter((c) => c.horneado).length} frases horneadas) cubiertos`);
    }
    // mezcla recalculada desde el HTML (independiente del montador)
    const mz = mezclar(items, m.duracion);
    const pk = db(mz.pico);
    let saturadas = 0;
    for (const ch of mz.ch) for (let i = 0; i < ch.length; i++) if (Math.abs(ch[i]) >= 0.99) saturadas++;
    s.notas.push(`mezcla recalculada: pico ${r3(pk)} dBFS en t=${r3(mz.picoT)} s (tope -1), ${saturadas} muestras >= 0.99`);
    if (pk > -1 + 0.05) s.errores.push(`pico de la mezcla ${r3(pk)} dBFS > -1 dBFS (t=${r3(mz.picoT)} s)`);
    if (saturadas) s.errores.push(`${saturadas} muestras >= 0.99 (saturacion)`);
    // polifonia maxima
    const vent = (c) => { const e = cat[c.sfx]; const cola = c.horneado ? 0.15 : e.colaMs / 1000; return [c.tCue - Math.min(c.ancla, 0.6), c.tCue + cola]; };
    let maxPoli = 0, tPoli = 0;
    for (const c of m.cues) {
        const [a] = vent(c);
        const n = m.cues.filter((o) => { const [x, y] = vent(o); return x <= a + 1e-9 && y > a; }).length;
        if (n > maxPoli) { maxPoli = n; tPoli = a; }
    }
    s.notas.push(`polifonia maxima ${maxPoli} simultaneos (t=${r3(tPoli)} s); ${m.cues.filter((c) => c.atenuadoPorPolifonia).length} cues atenuados por la regla`);
    s.notas.push(`nivel: RMS maximo por segundo ${m.mezcla?.rmsMax1sDbFS} dBFS, salto maximo entre segundos ${m.mezcla?.saltoMax1sDb} dB`);
    if ((m.mezcla?.rmsMax1sDbFS ?? -99) > -12) s.avisos.push(`RMS de un segundo ${m.mezcla.rmsMax1sDbFS} dBFS > -12 dBFS`);
    if ((m.mezcla?.saltoMax1sDb ?? 0) > 12) s.avisos.push(`salto de nivel de ${m.mezcla.saltoMax1sDb} dB entre segundos contiguos (> 12 dB)`);
    cerrar('c: montaje', s);
}

// ------------------------------------------------------------------------------------------------ (d) render
function render() {
    const s = seccion('render');
    const mp4 = resolve(R, VIDEO);
    if (!existsSync(mp4)) { s.errores.push(`no existe ${mp4}`); return cerrar('d: render', s); }
    const r = spawnSync('python3', [join(AQUI, 'verify-sfx-sync.py'), join(R, 'v2/sfx-mounted.json'), mp4, '--root', R, '--tol-ms', String(TOL * 1000)], { encoding: 'utf8', maxBuffer: 1 << 26 });
    const lineas = (r.stdout || '').trim().split('\n');
    s.notas.push(...lineas.slice(-1));
    for (const l of lineas) if (/FALLA/.test(l)) s.errores.push(l.trim());
    if (r.status !== 0 && !s.errores.length) s.errores.push(`verify-sfx-sync.py termino con codigo ${r.status}: ${(r.stderr || '').trim().split('\n').slice(-3).join(' | ')}`);
    console.log((r.stdout || '').trim());
    const rutaJ = join(R, 'v2/verify-sfx-sync.json');
    if (existsSync(rutaJ)) {
        const j = JSON.parse(readFileSync(rutaJ, 'utf8'));
        s.detalle = j.resumen;
        // cues que la banda ancha no confirmo (cola tonal de las notas vecinas) y se decidieron en su propia banda: se listan para que no pasen en silencio
        const enBanda = (j.cues ?? []).filter((c) => /banda/.test(c.modo ?? ''));
        for (const c of enBanda) s.notas.push(`${c.id}: decidido en su banda (${c.modo.replace('correlacion-banda ', '')}): ${c.ok ? 'OK' : 'FALLA'}, error ${c.errorMs} ms, rho ${c.rho}, ganancia ${c.ganancia} (banda ancha: rho ${c.ancho?.rho}, ganancia ${c.ancho?.ganancia})`);
    }
    cerrar('d: render', s);
}

try {
    if (quiere('biblioteca')) biblioteca();
    if (quiere('etiquetas')) { if (SOLO || existsSync(join(R, 'v2/sfx-cues.json'))) etiquetas(); else console.log('\n(b) etiquetas<->tween: OMITIDO, no existe v2/sfx-cues.json (node scripts/extract-events.mjs --cues)'); }
    if (quiere('montaje')) { if (SOLO || existsSync(join(R, 'v2/sfx-mounted.json'))) montaje(); else console.log('\n(c) montaje: OMITIDO, no existe v2/sfx-mounted.json (node scripts/mount-sfx.mjs)'); }
    if ((quiere('render') && VIDEO) || SOLO === 'render') render();
    else if (!SOLO) console.log('\n(d) render: OMITIDO, pasa --video renders/video.mp4');
} catch (e) {
    console.error(`verify-sfx: excepcion: ${e.stack || e}`);
    process.exit(1);
}
informe.ok = fallos === 0;
mkdirSync(join(R, 'v2'), { recursive: true });
if (!SOLO) writeFileSync(join(R, opcion(argv, '--out', 'v2/verify-sfx.json')), JSON.stringify(informe, null, 1) + '\n');
console.log(`\nverify-sfx: ${informe.ok ? 'TODO OK' : `FALLO (${fallos} secciones)`}`);
process.exit(informe.ok ? 0 : 1);
