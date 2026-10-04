#!/usr/bin/env node
// validate-plan.mjs - valida el esquema de v2/plan.json y las reglas globales de ritmo, camara y lectura.
//
// Uso:  node scripts/validate-plan.mjs [v2/plan.json] [--json] [--strict-files]
//   --json          informe en JSON
//   --strict-files  un id sin archivo compositions/frames/<id>.html es ERROR (por omision solo AVISO: el cuadro esta "planeado")
// Codigo de salida: 1 si hay errores (los avisos no fallan), 2 si el plan no se puede leer.
//
// Reglas globales (todas verificables):
//   - transiciones = cuadros - 1, encadenadas (from/to = ids consecutivos), tipos del vocabulario v2 y parametros por tipo
//   - duracion total 42-54 s (y igual a la suma de duraciones - suma de solapes); cada cuadro 2.6-6.2 s
//   - ningun tipo distinto de 'cut' repetido dos veces seguidas; <= 2 cortes secos seguidos (cut/match/flash); >= 6 tipos distintos
//   - verbos de camara distintos en cuadros contiguos; camera.verb != 'none' salvo justificacion (camera.justificacion)
//   - read_marks: t + min_lectura <= duracion - solape de salida; min_lectura >= 0.5
//   - 'match': handoff_out del cuadro saliente y handoff_in del entrante declarados y coincidentes (x, y, escala)
//   - iconos: nombres que existen en Lucide (scripts/lucide.mjs --check), tam >= 28; avatares existentes en assets/avatars
import { existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIPOS, DIRS, VERBOS_CAMARA, SECOS, RANGO_DUR, cargarPlan, linea } from './lib/plan.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const json = args.includes('--json');
const estricto = args.includes('--strict-files');
const rutaPlan = resolve(args.find((a) => !a.startsWith('--')) ?? join(RAIZ, 'v2/plan.json'));

const E = [], A = [];
const err = (ruta, msg) => E.push({ ruta, msg });
const avi = (ruta, msg) => A.push({ ruta, msg });
const num = (x) => typeof x === 'number' && Number.isFinite(x);
const cad = (x) => typeof x === 'string' && x.trim().length > 0;

let plan;
try { plan = cargarPlan(rutaPlan); } catch (e) { console.error(e.message); process.exit(2); }

// ---------- esquema de primer nivel ----------
if (plan.version !== 2) err('version', `debe ser 2 (es ${JSON.stringify(plan.version)})`);
if (!num(plan.total_s)) err('total_s', 'falta o no es numero');
if (!cad(plan.resumen)) err('resumen', 'falta (2-4 frases con la idea de ritmo y camara)');
else if (plan.resumen.length < 80) avi('resumen', 'muy corto: explica la idea de ritmo y camara en 2-4 frases');
if (!Array.isArray(plan.reglas) || !plan.reglas.every(cad)) err('reglas', 'debe ser una lista de textos');
if (!Array.isArray(plan.frames) || !plan.frames.length) { err('frames', 'falta la lista de cuadros'); }
if (!Array.isArray(plan.transitions)) err('transitions', 'falta la lista de transiciones');
const frames = Array.isArray(plan.frames) ? plan.frames : [];
const trans = Array.isArray(plan.transitions) ? plan.transitions : [];

// ---------- cuadros ----------
const avatares = existsSync(join(RAIZ, 'assets/avatars')) ? new Set(readdirSync(join(RAIZ, 'assets/avatars'))) : new Set();
const nombresIconos = new Set();
const vistos = new Set();
frames.forEach((f, i) => {
    const r = `frames[${i}]${f?.id ? `(${f.id})` : ''}`;
    if (!f || typeof f !== 'object') { err(r, 'no es un objeto'); return; }
    if (!cad(f.id) || !/^\d\d-[a-z0-9-]+$/.test(f.id)) err(`${r}.id`, 'debe ser NN-nombre (minusculas y guiones), igual al archivo compositions/frames/<id>.html');
    else {
        if (vistos.has(f.id)) err(`${r}.id`, 'id repetido');
        vistos.add(f.id);
        if (!existsSync(join(RAIZ, 'compositions/frames', `${f.id}.html`))) (estricto ? err : avi)(`${r}.id`, `aun no existe compositions/frames/${f.id}.html (cuadro planeado)`);
    }
    if (!cad(f.title)) err(`${r}.title`, 'falta');
    if (!num(f.duration)) err(`${r}.duration`, 'falta o no es numero');
    else if (f.duration < 2.6 || f.duration > 6.2) err(`${r}.duration`, `${f.duration} s fuera de 2.6-6.2 s`);
    // camara
    if (!f.camera || typeof f.camera !== 'object') err(`${r}.camera`, 'falta {verb, summary}');
    else {
        if (!VERBOS_CAMARA.includes(f.camera.verb)) err(`${r}.camera.verb`, `"${f.camera.verb}" no es uno de ${VERBOS_CAMARA.join('|')}`);
        if (!cad(f.camera.summary)) err(`${r}.camera.summary`, 'falta: que hace la camara, cuando y cuanto');
        if (f.camera.verb === 'none' && !cad(f.camera.justificacion)) err(`${r}.camera.verb`, "'none' requiere camera.justificacion (por que este cuadro no lleva camara)");
    }
    // iconos
    if (!Array.isArray(f.icons)) err(`${r}.icons`, 'debe ser una lista (puede ir vacia)');
    else f.icons.forEach((ic, j) => {
        const rr = `${r}.icons[${j}]`;
        if (!cad(ic?.name)) { err(`${rr}.name`, 'falta el nombre Lucide'); return; }
        nombresIconos.add(ic.name);
        if (!cad(ic.uso)) avi(`${rr}.uso`, 'falta: donde se usa');
        if (!cad(ic.tile)) avi(`${rr}.tile`, 'falta el tono del tile');
        if (!num(ic.tam)) err(`${rr}.tam`, 'falta el tamano en px');
        else if (ic.tam < 24) err(`${rr}.tam`, `${ic.tam} px es demasiado pequeno (la queja de la v1: iconos minusculos); minimo 28 px`);
        else if (ic.tam < 28) avi(`${rr}.tam`, `${ic.tam} px < 28 px: poco legible a 1080p`);
    });
    // avatares
    if (!Array.isArray(f.avatars)) err(`${r}.avatars`, 'debe ser una lista (puede ir vacia)');
    else f.avatars.forEach((a, j) => {
        const nombre = String(a).replace(/^assets\/avatars\//, '');
        if (!avatares.has(nombre)) err(`${r}.avatars[${j}]`, `"${a}" no existe en assets/avatars/`);
    });
    // handoff
    for (const k of ['handoff_in', 'handoff_out']) {
        const h = f[k];
        if (h === undefined) err(`${r}.${k}`, 'falta (null si no hay handoff)');
        else if (h !== null) {
            if (typeof h !== 'object' || !cad(h.elemento) || !num(h.x) || !num(h.y) || !num(h.escala)) err(`${r}.${k}`, 'debe ser null o {elemento, x, y, escala, nota}');
        }
    }
    // marcas de lectura
    if (!Array.isArray(f.read_marks)) err(`${r}.read_marks`, 'debe ser una lista (puede ir vacia)');
    else {
        const solapeSalida = i < frames.length - 1 && trans[i] ? Number(trans[i].dur) || 0 : 0;
        f.read_marks.forEach((m, j) => {
            const rr = `${r}.read_marks[${j}]`;
            if (!cad(m?.frase) || !num(m.t) || !num(m.min_lectura)) { err(rr, 'debe ser {frase, t, min_lectura}'); return; }
            if (m.min_lectura < 0.5) err(`${rr}.min_lectura`, `${m.min_lectura} s < 0.5 s`);
            if (num(f.duration) && m.t + m.min_lectura > f.duration - solapeSalida + 1e-9) err(rr, `"${m.frase}": t ${m.t} + lectura ${m.min_lectura} = ${(m.t + m.min_lectura).toFixed(2)} s pasa del final util (${(f.duration - solapeSalida).toFixed(2)} s = duracion ${f.duration} - solape de salida ${solapeSalida})`);
            if (m.t < 0) err(`${rr}.t`, 'negativo');
        });
    }
    if (!cad(f.spec)) err(`${r}.spec`, 'falta la hoja de beats del cuadro');
    else if (f.spec.length < 200) avi(`${r}.spec`, `solo ${f.spec.length} caracteres: la hoja de beats debe llevar tiempos locales exactos, camara con parametros, golpes de sonido y estado final`);
});

// ---------- transiciones ----------
if (frames.length && trans.length !== frames.length - 1) err('transitions', `debe haber exactamente ${frames.length - 1} (hay ${trans.length})`);
trans.forEach((t, i) => {
    const r = `transitions[${i}]`;
    if (!t || typeof t !== 'object') { err(r, 'no es un objeto'); return; }
    const a = frames[i]?.id, b = frames[i + 1]?.id;
    if (a && t.from !== a) err(`${r}.from`, `esperaba "${a}" (cuadro ${i}), es "${t.from}"`);
    if (b && t.to !== b) err(`${r}.to`, `esperaba "${b}" (cuadro ${i + 1}), es "${t.to}"`);
    if (!TIPOS.includes(t.type)) { err(`${r}.type`, `"${t.type}" no es del vocabulario: ${TIPOS.join('|')}`); return; }
    if (!num(t.dur)) err(`${r}.dur`, 'falta o no es numero');
    else {
        const [mn, mx] = RANGO_DUR[t.type];
        if (t.dur < mn - 1e-9 || t.dur > mx + 1e-9) err(`${r}.dur`, `${t.dur} s fuera del rango de '${t.type}' (${mn}-${mx} s)`);
    }
    if (['push', 'whip', 'wipe'].includes(t.type) && !DIRS.includes(t.dir)) err(`${r}.dir`, `'${t.type}' requiere dir ${DIRS.join('|')}`);
    if (t.type === 'zoom' && !['in', 'out'].includes(t.dir)) err(`${r}.dir`, "'zoom' requiere dir in|out");
    if (t.type === 'push') {
        if (!num(t.dist) || t.dist < 0.15 || t.dist > 1) err(`${r}.dist`, "'push' requiere dist entre 0.15 y 1.0");
        if (t.fade !== null && t.fade !== undefined && typeof t.fade !== 'boolean') err(`${r}.fade`, 'debe ser true|false|null');
    }
    if (t.type === 'iris') {
        if (!Array.isArray(t.origin) || t.origin.length !== 2 || !t.origin.every((x) => num(x) && x >= 0 && x <= 1)) err(`${r}.origin`, "'iris' requiere origin [x,y] en fracciones 0-1");
    }
    if (t.ease != null && !cad(t.ease)) err(`${r}.ease`, 'debe ser un nombre de ease de GSAP o null');
    if (t.sfx == null) avi(`${r}.sfx`, 'sin sonido de transicion');
    else if (!cad(t.sfx.name) || !num(t.sfx.vol) || !num(t.sfx.peak)) err(`${r}.sfx`, 'debe ser {name, vol, peak}');
    else {
        if (t.sfx.vol < 0 || t.sfx.vol > 1) err(`${r}.sfx.vol`, 'fuera de 0-1');
        if (t.sfx.peak < 0 || t.sfx.peak > 1) err(`${r}.sfx.peak`, 'fuera de 0-1 (fraccion de dur)');
    }
    // handoff para 'match'
    const fo = frames[i]?.handoff_out, fi = frames[i + 1]?.handoff_in;
    if (t.type === 'match') {
        if (!fo) err(`${r}`, `'match' requiere handoff_out en ${a}`);
        if (!fi) err(`${r}`, `'match' requiere handoff_in en ${b}`);
        if (fo && fi) {
            if (Math.abs(fo.x - fi.x) > 2 || Math.abs(fo.y - fi.y) > 2 || Math.abs(fo.escala - fi.escala) > 0.02) err(`${r}`, `el handoff no coincide: ${a} termina en (${fo.x}, ${fo.y}, x${fo.escala}) y ${b} empieza en (${fi.x}, ${fi.y}, x${fi.escala})`);
        }
        if (!cad(t.note)) avi(`${r}.note`, "documenta en 'note' que elemento conserva posicion/escala");
    } else if (fo || fi) avi(`${r}`, `hay handoff declarado pero la transicion es '${t.type}', no 'match'`);
});

// ---------- reglas globales ----------
if (frames.length && trans.length === frames.length - 1) {
    const L = linea(plan);
    if (num(plan.total_s) && Math.abs(L.total - plan.total_s) > 0.05) err('total_s', `dice ${plan.total_s} s pero suma ${L.total} s (suma de duraciones - suma de solapes)`);
    if (L.total < 42 || L.total > 54) err('total_s', `${L.total} s fuera de 42-54 s`);
    L.cuadros.forEach((c) => {
        if (c.solapeEntrada + c.solapeSalida > c.duracion - 1.0) err(`frames[${c.i}](${c.id})`, `solapes de entrada (${c.solapeEntrada}) + salida (${c.solapeSalida}) dejan menos de 1 s propio de ${c.duracion} s`);
    });
    // repeticiones
    let secos = 0;
    trans.forEach((t, i) => {
        if (i > 0 && t.type !== 'cut' && t.type === trans[i - 1].type) err(`transitions[${i}]`, `'${t.type}' repetido dos veces seguidas (con ${trans[i - 1].from}->${trans[i - 1].to}); alterna tipos`);
        if (i > 0 && t.type === 'cut' && trans[i - 1].type === 'cut') { /* permitido, lo limita la regla de secos */ }
        secos = SECOS.has(t.type) ? secos + 1 : 0;
        if (secos > 2) err(`transitions[${i}]`, `mas de 2 cortes secos seguidos (cut/match/flash)`);
    });
    const empujes = trans.map((t, i) => ({ t, i })).filter((x) => x.t.type === 'push');
    empujes.forEach((x, k) => { if (k > 0 && x.t.dir === empujes[k - 1].t.dir) avi(`transitions[${x.i}]`, `push en la misma direccion (${x.t.dir}) que el push anterior; alterna`); });
    const tipos = new Set(trans.map((t) => t.type));
    if (tipos.size < 6) err('transitions', `solo ${tipos.size} tipos distintos (${[...tipos].join(', ')}); se piden >= 6`);
    // camara
    frames.forEach((f, i) => {
        if (i > 0 && f.camera?.verb && f.camera.verb === frames[i - 1].camera?.verb) err(`frames[${i}](${f.id}).camera.verb`, `'${f.camera.verb}' igual al del cuadro anterior (${frames[i - 1].id}); contiguos deben diferir`);
    });
}

// ---------- iconos Lucide ----------
if (nombresIconos.size) {
    const r = spawnSync('node', [join(RAIZ, 'scripts/lucide.mjs'), '--check', ...nombresIconos], { encoding: 'utf8' });
    for (const l of (r.stdout || '').split('\n')) {
        const m = /^FALTA\s+(\S+)\s*(.*)$/.exec(l.trim());
        if (m) err('icons', `"${m[1]}" no existe en Lucide ${m[2] ? m[2].trim() : ''}`);
    }
    if (r.status === 2) err('icons', `lucide.mjs fallo: ${(r.stderr || '').trim()}`);
}

// ---------- salida ----------
const ok = E.length === 0;
if (json) console.log(JSON.stringify({ plan: rutaPlan, ok, errores: E, avisos: A, total: frames.length && trans.length === frames.length - 1 ? linea(plan).total : null }, null, 1));
else {
    console.log(`Plan: ${rutaPlan}  (${frames.length} cuadros, ${trans.length} transiciones${frames.length && trans.length === frames.length - 1 ? `, ${linea(plan).total} s` : ''})`);
    for (const e of E) console.log(`  ERROR  ${e.ruta}: ${e.msg}`);
    for (const a of A) console.log(`  AVISO  ${a.ruta}: ${a.msg}`);
    console.log(ok ? `OK: plan valido (${A.length} aviso(s))` : `FALLA: ${E.length} error(es), ${A.length} aviso(s)`);
}
process.exit(ok ? 0 : 1);
