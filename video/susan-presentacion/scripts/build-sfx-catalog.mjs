#!/usr/bin/env node
// Genera assets/sfx/CATALOG.json a partir de assets/sfx/derived/*.wav + derived/sfx-meta.json (scripts/analyze-sfx.mjs).
// Es lo que consultan los trabajadores de cuadro, el montador (mount-sfx.mjs) y el verificador (verify-sfx.mjs).
//
// Uso: node scripts/build-sfx-catalog.mjs [--root <proyecto>]      (lo llama scripts/derive-sfx.sh)
// Sale con codigo 1 si un wav no tiene ficha en la tabla de abajo o una ficha no tiene wav.
//
// Campos por nombre:
//   file        ruta relativa al proyecto (la que va en <audio src>)
//   anclaMs     instante del archivo que debe coincidir con el evento visual (el montaje hace data-start = t - ancla)
//   picoMs      instante de la muestra mas fuerte; duracionMs; colaMs = del ancla al 90 % de la energia (duracion "util")
//   picoDbFS    pico real por canal (la medicion de analyze-sfx.mjs esta +3 dB por el downmix a mono; esta no)
//   categoria   pop|click|ping|key|tick|whoosh|zoom|riser|impact|snap|chime|alert|check|sparkle|texture|ui
//   anclaje     'hit'    el golpe (ataque) del archivo es el evento; ancla <= 10 ms
//               'inicio' el sonido arranca con el tween (textura de ataque suave); ancla = primer instante audible
//               'pico'   el maximo del swell cae en el evento (whoosh, swipe): t = punto de maxima velocidad del movimiento
//               'fin'    el archivo TERMINA en el evento (riser, zoom-in): t = instante del impacto/llegada
//   volDefecto  data-volume por defecto (los picos estan a -6 dBFS: el volumen es la mezcla relativa). La tabla de abajo lo da SIN ganancia; el catalogo
//               lo publica con la ganancia de su categoria ya incorporada: min(VOL_MAX_CUE, vol x 10^(gananciaDb/20)), con 2 decimales
//   gananciaDb  ganancia de mezcla de la categoria (sfx-lib GANANCIA_DB); solo se aplica al volumen de ETIQUETA (sfx(tl, t, nombre, vol))
//   deprecated  (opcional) true = sonido retirado: verify-sfx.mjs da ERROR si un cuadro lo usa; `deprecadoRazon` dice por que y con que sustituirlo
//   rango       jerarquia para la regla de polifonia (> 4 a la vez: se atenuan los de menor rango)
//   uso         texto corto: cuando usarlo
//   alias       (opcional) nombre antiguo/storyboard que resuelve a este archivo
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { GANANCIA_DB, RANGO, VOL_MAX_CUE, db, leerWav, lineal, picoWav, raiz, r3 } from './lib/sfx-lib.mjs';

const R = raiz();
const DIR = join(R, 'assets/sfx/derived');

// nombre -> [categoria, anclaje, volDefecto, uso]
const T = {};
const def = (nombres, cat, anclaje, vol, uso) => nombres.forEach((n, i) => { T[n] = [cat, anclaje, vol, typeof uso === 'function' ? uso(n, i) : uso]; });
const rango = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

def(rango(1, 4).map((i) => `pop-${i}`), 'pop', 'hit', 0.5, (n, i) => `chip/tarjeta/punto que aparece; ${['grave y lento', 'medio', 'agudo', 'muy agudo y corto'][i]}. Alterna alturas para no repetir`);
def(rango(1, 8).map((i) => `ping-note${i}`), 'ping', 'hit', 0.45, (n, i) => `bracket/rostro que se traba; escala pentatonica nota ${i + 1}/8 (usalas en orden ascendente para una secuencia)`);
def(rango(1, 8).map((i) => `key-${i}`), 'key', 'hit', 0.35, 'tecla suelta; NO se usa a mano: la emite sfxType y el montador la hornea en un wav por frase');
def(['key-enter'], 'key', 'hit', 0.4, 'Enter al final de una frase tecleada (sfxType opcion enter)');
def(['key-back'], 'key', 'hit', 0.35, 'borrado/correccion al teclear (sfxType opcion back)');
def(['type-enter'], 'key', 'hit', 0.45, 'Enter marcado (clic agudo + golpe grave): enviar/confirmar una busqueda o formulario');
def(rango(1, 4).map((i) => `tick-${i}`), 'tick', 'hit', 0.4, (n, i) => `contador: cambio de entero, altura ${i + 1}/4 (creciente; la emite sfxCount, el ultimo es el acento)`);
def(['tick'], 'tick', 'hit', 0.4, 'tic grave y seco suelto (conmutador, paso de un selector)');
def(['click-hard'], 'click', 'hit', 0.5, 'pulsacion de boton/cursor, seca y definida');
def(['click-soft2'], 'click', 'hit', 0.45, 'pulsacion suave (chip seleccionado, tab)');
def(['tap'], 'click', 'hit', 0.45, 'toque mate de interfaz (tarjeta tocada, fila marcada)');
def(['shutter'], 'click', 'hit', 0.45, 'obturador de camara (dos clics): captura de rostros / foto');
def(['lock'], 'click', 'hit', 0.55, 'candado que cierra (clic metalico + golpe grave): cuadro de confianza/privacidad');
def(['blip'], 'ui', 'hit', 0.45, 'aviso corto de interfaz, tonal (badge, indicador que cambia)');
def(['whoosh-s'], 'whoosh', 'pico', 0.5, 'corte rapido / elemento que cruza; t = instante de maxima velocidad (pico a 0.10 s del archivo)');
def(['whoosh-m'], 'whoosh', 'pico', 0.5, 'desplazamiento medio (push-slide corto, panel que entra desde un lado)');
def(['whoosh-l'], 'whoosh', 'pico', 0.5, 'desplazamiento largo y grave con eco (cambio de seccion, zoom-through)');
def(['whoosh-rev'], 'whoosh', 'pico', 0.45, 'whoosh invertido: el swell CRECE hacia el corte (precede un impacto/snap a 0.18 s)');
def(['swipe'], 'whoosh', 'pico', 0.5, 'barrido estereo rapido y agudo: whip pan / elemento que pasa de lado a lado');
def(['zoom-in'], 'zoom', 'fin', 0.45, 'empuje de camara: el archivo TERMINA cuando el zoom llega a su escala (t = fin del tween)');
def(['zoom-out'], 'zoom', 'hit', 0.45, 'tiron de camara hacia atras: ataque inmediato con el inicio del tween');
def(['riser-1s'], 'riser', 'fin', 0.55, 'subida de tension de 1 s que TERMINA en el impacto (t = instante del impacto; nunca antes)');
def(['riser-s'], 'riser', 'fin', 0.5, 'subida de 0.6 s para impactos mas cercanos');
def(['impact-hit'], 'impact', 'hit', 0.8, 'slam/titular que cae: golpe con sub-grave y cola de 0.85 s');
def(['impact-lite'], 'impact', 'hit', 0.65, 'golpe ligero sin sub (segundo impacto, remate)');
def(['thud'], 'impact', 'hit', 0.75, 'golpe grave corto (peso: tarjeta que cae, tope)');
def(['stamp'], 'impact', 'hit', 0.7, 'sello mate (aprobado/validado, etiqueta que se estampa)');
def(['snap'], 'snap', 'hit', 0.7, 'golpe seco corto para snap-zoom de camara (camSnap lo pone por defecto)');
def(['chime-trim'], 'chime', 'hit', 0.4, 'cambio de estado positivo / logro (campana con cola de 1.8 s)');
def(['notification-trim'], 'chime', 'hit', 0.4, 'aviso de dos notas (alerta, notificacion que llega)');
def(['error-trim'], 'alert', 'hit', 0.4, 'zumbido de error/rechazo (estado ausente, limite superado)');
def(['check'], 'check', 'hit', 0.5, 'palomita / confirmado (dos notas ascendentes)');
def(['sparkle-short'], 'sparkle', 'hit', 0.4, 'OBSOLETO (usa sheen / sheen-s): destello brillante con cola corta, derivado de un sparkle de libreria');
def(['flash'], 'sparkle', 'hit', 0.4, 'OBSOLETO (usa flash-soft): flash blanco / destello de camara (rafaga aguda + tintineo)');
def(['flash-soft'], 'snap', 'hit', 0.45, 'corte con destello crema de 3 fotogramas: golpe seco corto con cuerpo y aire de banda media (sin tintineo ni energia > 9 kHz)');
def(['draw'], 'texture', 'hit', 0.4, 'trazo SVG que se dibuja (anillos, lineas, curvas): arranca con el tween del trazo');
def(['fill'], 'texture', 'inicio', 0.4, 'liquido que sube (tanques, barras que se llenan), 1.2 s con el volumen creciente');
def(['scan'], 'texture', 'hit', 0.35, 'barrido fino de escaneo (linea que recorre la camara)');
def(['sheen'], 'texture', 'hit', 0.28, 'barrido de luz sobre un elemento; se ancla al primer fotograma en que el brillo es visible');
def(['sheen-s'], 'texture', 'hit', 0.22, 'barrido de luz sobre un elemento; se ancla al primer fotograma en que el brillo es visible (variante corta, 0.26 s, para destellos pequenos)');
def(['soft-in'], 'texture', 'hit', 0.4, 'entrada suave de panel/tarjeta grande (soplo grave corto)');

// Sonidos retirados: no se borran (el alias antiguo y la pista que ya los use siguen resolviendo y el md5 no cambia), pero verify-sfx.mjs falla si un
// cuadro los emplea. nombre -> razon
const DEPRECATED = {
    flash: 'rafaga de ruido > 4.5 kHz + tintineo de 3.2 kHz (centroide ~9 kHz, casi toda la energia por encima de 9 kHz): el sonido mas agudo y aspero del video y el ultimo "brillito". Para el corte con destello crema (flash 06 -> 07) usa flash-soft (golpe seco con cuerpo, sin energia > 9 kHz)',
    'sparkle-short': 'sonaba aspero y generico (sparkle de libreria: centroide ~5 kHz, energia por encima de 9 kHz a -15 dB del pico). Para brillos y barridos de luz usa sheen (0.44 s) o sheen-s (0.26 s)',
};

// Nombres antiguos (storyboard / frames de la v1) -> archivo nuevo, para que sfx(tl,t,'pop') siga resolviendo
const ALIAS = {
    pop: 'pop-2', ping: 'ping-note3', click: 'click-hard', 'click-soft': 'click-soft2', 'key-press': 'key-enter', whoosh: 'whoosh-s', 'whoosh-short': 'whoosh-s',
    'impact-bass-1': 'impact-hit', 'impact-bass-2': 'impact-lite', riser: 'riser-1s', sparkle: 'sparkle-short', chime: 'chime-trim', error: 'error-trim', notification: 'notification-trim',
};

const meta = Object.fromEntries(JSON.parse(readFileSync(join(DIR, 'sfx-meta.json'), 'utf8')).map((m) => [m.archivo.replace(/\.wav$/, ''), m]));
const archivos = readdirSync(DIR).filter((f) => f.endsWith('.wav')).map((f) => f.replace(/\.wav$/, '')).sort();
const errores = [];
for (const n of archivos) if (!T[n]) errores.push(`derived/${n}.wav no tiene ficha en la tabla de build-sfx-catalog.mjs`);
for (const n of Object.keys(T)) if (!archivos.includes(n)) errores.push(`la ficha "${n}" no tiene derived/${n}.wav (re-ejecuta derive-sfx.sh)`);

const cat = {};
for (const n of archivos.filter((x) => T[x])) {
    const [categoria, anclaje, vol, uso] = T[n];
    const m = meta[n];
    const w = leerWav(join(DIR, `${n}.wav`));
    const dur = w.dur;
    let ancla;
    if (anclaje === 'hit') ancla = m.ancla;
    else if (anclaje === 'pico') ancla = m.pico;
    else if (anclaje === 'inicio') ancla = m.onset;
    else ancla = dur; // 'fin'
    // cola: del ancla al 90 % de la energia (sobre el canal izquierdo, sin remuestrear)
    const x = w.ch[0];
    let tot = 0; for (let i = 0; i < x.length; i++) tot += x[i] * x[i];
    let acc = 0, fin90 = dur;
    for (let i = 0; i < x.length; i++) { acc += x[i] * x[i]; if (acc >= 0.9 * tot) { fin90 = i / w.sr; break; } }
    cat[n] = {
        file: `assets/sfx/derived/${n}.wav`,
        anclaMs: Math.round(ancla * 10000) / 10,
        picoMs: Math.round(m.pico * 10000) / 10,
        duracionMs: Math.round(dur * 10000) / 10,
        colaMs: Math.round(Math.max(0, fin90 - ancla) * 10000) / 10,
        picoDbFS: Math.round(db(picoWav(w)) * 100) / 100,
        categoria,
        anclaje,
        volDefecto: Math.round(Math.min(VOL_MAX_CUE, vol * lineal(GANANCIA_DB[categoria] ?? 0)) * 100) / 100,
        gananciaDb: GANANCIA_DB[categoria] ?? 0,
        rango: RANGO[categoria],
        uso,
        ...(DEPRECATED[n] ? { deprecated: true, deprecadoRazon: DEPRECATED[n] } : {}),
        md5: createHash('md5').update(readFileSync(join(DIR, `${n}.wav`))).digest('hex').slice(0, 12),
    };
    if (RANGO[categoria] === undefined) errores.push(`categoria sin rango: ${categoria}`);
}
for (const [a, n] of Object.entries(ALIAS)) {
    if (!cat[n]) { errores.push(`alias ${a} -> ${n}: no existe`); continue; }
    cat[a] = { ...cat[n], alias: n };
}
for (const n of Object.keys(DEPRECATED)) if (!cat[n]) errores.push(`DEPRECATED: ${n} no existe`);
if (errores.length) { console.error('build-sfx-catalog: ' + errores.join('\n  ')); process.exit(1); }
writeFileSync(join(R, 'assets/sfx/CATALOG.json'), JSON.stringify(cat, null, 1) + '\n');
console.log(`CATALOG.json: ${archivos.length} sonidos + ${Object.keys(ALIAS).length} alias`);
console.log('nombre'.padEnd(20), 'categoria'.padEnd(8), 'anclaje'.padEnd(7), 'anclaMs'.padStart(8), 'picoMs'.padStart(8), 'durMs'.padStart(7), 'colaMs'.padStart(7), 'pico dBFS'.padStart(9), 'vol');
for (const [n, e] of Object.entries(cat)) if (!e.alias) console.log(n.padEnd(20), e.categoria.padEnd(8), e.anclaje.padEnd(7), String(e.anclaMs).padStart(8), String(e.picoMs).padStart(8), String(e.duracionMs).padStart(7), String(e.colaMs).padStart(7), String(e.picoDbFS).padStart(9), e.volDefecto);
