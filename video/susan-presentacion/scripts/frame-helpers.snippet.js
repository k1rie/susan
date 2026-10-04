/* ============================================================================================================
   BLOQUE CANONICO v2 (sonido + camara). Se PEGA TAL CUAL dentro del <script> de cada cuadro, justo despues de crear `tl`
   (var tl = gsap.timeline({ paused: true }); window.__timelines[ID_DEL_CUADRO] = tl;). No lo edites en el cuadro: edita este archivo.
   Es idempotente: pegarlo en varios cuadros (mismo window) redefine las mismas funciones.

   POR QUE EXISTE (contrato de sincronia v2, audit/sonido/REPORT.md 7): el instante de un sonido NO se escribe a mano. Se declara
   como ETIQUETA del timeline con la MISMA variable de tiempo que el tween que acompana, y los scripts lo derivan:
       extract-events.mjs --cues  ->  v2/sfx-cues.json (tiempos absolutos)  ->  mount-sfx.mjs (data-start = t - ancla del archivo)
   Uso tipico:
       var T = 1.05 + k * 0.3;                                                    // un solo numero para tween y sonido
       tl.fromTo(bx[k], { opacity: 0, scale: 0.82 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(1.7)', data: 'hero' }, T);
       sfx(tl, T, 'ping-note' + (k + 1), 0.5);                                    // nombre del CATALOG.json; vol opcional
   Convenciones:
     - t es el instante del evento visual: inicio del tween de entrada (primer fotograma visible); para 'whoosh/swipe' el punto de
       maxima velocidad; para sonidos con anclaje 'fin' (riser, zoom-in) el instante en que ocurre el impacto/llegada (ver CATALOG.json).
     - `data: 'hero'` en un tween (entrada de un elemento principal, cambio de estado, contador, empuje de camara, trazo) le exige sonido:
       verify-sfx.mjs avisa de los hero sin etiqueta sfx a +-33 ms de su inicio. Las funciones cam* lo ponen solas.
     - Nunca llames a addLabel con nombres repetidos (GSAP sobrescribe): sfx() agrega un contador unico.
   ============================================================================================================ */
window.SFXN = window.SFXN || 0;   // contador unico de etiquetas (compartido por todos los cuadros de la pagina)
window.KEYN = window.KEYN || 0;   // rotacion de teclas (continua entre frases)

/* sfx(tl, t, nombre, vol) -> etiqueta 'sfx:<nombre>@<vol>#<n>' en el instante t. vol omitido = volDefecto del catalogo. */
function sfx(tl, t, nombre, vol) {
    tl.addLabel('sfx:' + nombre + '@' + (vol == null ? '' : vol) + '#' + (window.SFXN++), t);
    return t;
}

/* sfxType(tl, t0, tiempos, opciones) -> tiempos absolutos de las teclas que suenan.
   tiempos[i] = segundo (relativo a t0) en que se pinta el caracter i del texto (sale del mismo reloj que pinta el texto).
   opciones: texto ('Hola mundo': para detectar inicios de palabra; los espacios no suenan), vol (0.35), maxPorSeg (14),
             enter (true | segundo absoluto: agrega key-enter; true = 0.14 s tras la ultima tecla), borrados ([segundos absolutos]: key-back).
   Decima a <= 14 teclas/s: siempre suena la primera y la ultima; el acento (vol completo) va en inicios de palabra, las demas a 0.78.
   Rota key-1..8 sin repetir seguidas; una etiqueta por tecla (mount-sfx las hornea en un solo wav por frase, al milisegundo). */
function sfxType(tl, t0, tiempos, op) {
    op = op || {};
    var txt = op.texto || '', vol = op.vol == null ? 0.35 : op.vol, gap = 1 / (op.maxPorSeg || 14), k = [], i, c, p;
    var ult = -1;
    for (i = 0; i < tiempos.length; i++) if (!txt || txt.charAt(i) !== ' ') ult = i;
    for (i = 0; i < tiempos.length; i++) {
        if (txt && txt.charAt(i) === ' ') continue;
        c = { t: t0 + tiempos[i], ini: !!txt && (i === 0 || txt.charAt(i - 1) === ' '), ult: i === ult };
        p = k[k.length - 1];
        if (!p || c.t - p.t >= gap) k.push(c);
        else if (k.length > 1 && (c.ult || (c.ini && !p.ini))) k[k.length - 1] = c;   // la ultima y las iniciales desplazan a una tecla normal
        else if (c.ult) k.push(c);                                                       // solo hay una tecla antes: ambas suenan
    }
    var out = [];
    k.forEach(function (q, j) {
        var acento = j === 0 || q.ini || j === k.length - 1;
        sfx(tl, q.t, 'key-' + ((window.KEYN++ * 5) % 8 + 1), +(vol * (acento ? 1 : 0.78)).toFixed(3));
        out.push(q.t);
    });
    if (op.enter && k.length) sfx(tl, op.enter === true ? k[k.length - 1].t + 0.14 : op.enter, 'key-enter', +(vol * 1.1).toFixed(3));
    (op.borrados || []).forEach(function (tb) { sfx(tl, tb, 'key-back', vol); });
    return out;
}

/* sfxCount(tl, t0, t1, desde, hasta, opciones) -> tiempos absolutos de los 'tick'. Un tick por cambio de entero (el contador muestra
   Math.round(valor)), <= 12/s, 4 alturas crecientes (tick-1..4 segun el avance), el ultimo con acento (tick-4 a vol x1.5).
   opciones: ease ('power1.out': la MISMA ease del tween del contador; debe ser monotona), paso (1: valor entre ticks), vol (0.4), maxPorSeg (12). */
function sfxCount(tl, t0, t1, desde, hasta, op) {
    op = op || {};
    var ease = gsap.parseEase(op.ease || 'power1.out'), paso = op.paso || 1, vol = op.vol == null ? 0.4 : op.vol, gap = 1 / (op.maxPorSeg || 12);
    var span = Math.abs(hasta - desde), n = Math.floor(span / paso + 1e-9), ts = [], s, lo, hi, m, it;
    for (s = 1; s <= n; s++) {                       // instante en que el valor cruza (s - 0.5) pasos: se invierte la ease por biseccion
        lo = 0; hi = 1;
        for (it = 0; it < 32; it++) { m = (lo + hi) / 2; if (ease(m) * span < (s - 0.5) * paso) lo = m; else hi = m; }
        ts.push(t0 + hi * (t1 - t0));
    }
    var k = [];
    ts.forEach(function (t, j) {
        var p = k[k.length - 1];
        if (p === undefined || t - p >= gap) k.push(t);
        else if (j === ts.length - 1 && k.length > 1) k[k.length - 1] = t;           // el ultimo siempre suena
        else if (j === ts.length - 1) k.push(t);
    });
    k.forEach(function (t, j) {
        var ultimo = j === k.length - 1;
        sfx(tl, t, 'tick-' + (ultimo ? 4 : Math.min(3, Math.floor(4 * j / k.length)) + 1), +Math.min(1, vol * (ultimo ? 1.5 : 1)).toFixed(3));
    });
    return k;
}

/* readMark(tl, t, 'frase') -> etiqueta 'read:frase' en el instante en que una frase clave queda COMPLETA y legible. El director/verificador
   exige que el corte a otro cuadro llegue >= 0.9 s despues (tiempo de lectura). */
function readMark(tl, t, frase) {
    tl.addLabel('read:' + frase + '#' + (window.SFXN++), t);   // no se lee tl.labels: el compilador de render ejecuta el script con un timeline proxy sin esa propiedad
    return t;
}

/* ---- CAMARA con GSAP puro (seek-safe). Cada helper hace un fromTo con los valores de partida que recuerda en el elemento (el estado
   se encadena en el orden de las llamadas) e `immediateRender: false` SIEMPRE: sin eso el segundo fromTo sobre el mismo objetivo
   aplica su `from` en el fotograma 0 y pisa al primero (bug del cuadro 6: entraba a 1.6 y saltaba a 1.0). Devuelven el fin del tween.
   `el`: elemento o selector. Opciones comunes: dur, ease, foco [cx, cy] (punto de 1920x1080 que queda en el centro), x, y (px, pisan a foco),
   W, H (tamano de escena, 1920x1080), sfx (nombre del catalogo o false), vol. Todos los tweens llevan data: 'hero'. ---- */
function camInit(el, escala, x, y) {
    var e = typeof el === 'string' ? document.querySelector(el) : el;
    e.__cam = { s: escala == null ? 1 : escala, x: x || 0, y: y || 0, r: 0 };
    gsap.set(e, { transformOrigin: '50% 50%', scale: e.__cam.s, x: e.__cam.x, y: e.__cam.y, rotation: 0 });
}
function camTo(tl, el, t, a, o, dur0, ease0, sfx0) {
    o = o || {};
    var e = typeof el === 'string' ? document.querySelector(el) : el;
    if (!e.__cam) camInit(e, 1, 0, 0);
    var c = e.__cam, dur = o.dur == null ? dur0 : o.dur, W = o.W || 1920, H = o.H || 1080;
    var s = a.s == null ? c.s : a.s, x = a.x == null ? c.x : a.x, y = a.y == null ? c.y : a.y, r = a.r == null ? c.r : a.r;
    if (o.foco) { x = (W / 2 - o.foco[0]) * s; y = (H / 2 - o.foco[1]) * s; }
    if (o.x != null) x = o.x;
    if (o.y != null) y = o.y;
    tl.fromTo(e, { scale: c.s, x: c.x, y: c.y, rotation: c.r },
        { scale: s, x: x, y: y, rotation: r, duration: dur, ease: o.ease || ease0, immediateRender: false, data: 'hero' }, t);
    e.__cam = { s: s, x: x, y: y, r: r };
    var snd = o.sfx === undefined ? sfx0 : o.sfx;
    if (snd) sfx(tl, t, snd, o.vol);
    return t + dur;
}
/* camSnap: salto de zoom en ~0.18 s con ataque (snap-zoom). Suena 'snap' por defecto (sfx: false lo apaga). */
function camSnap(tl, el, t, escala, o) { return camTo(tl, el, t, { s: escala }, o, 0.18, 'power4.out', 'snap'); }
/* camPush: empuje lento (acercar). Sonido opcional: sfx(tl, fin, 'zoom-in') (anclaje 'fin': t = fin del tween). */
function camPush(tl, el, t, escala, o) { return camTo(tl, el, t, { s: escala }, o, 1.1, 'power2.inOut', null); }
/* camPull: alejar (escala por defecto 1) en ~0.7 s. */
function camPull(tl, el, t, escala, o) { return camTo(tl, el, t, { s: escala == null ? 1 : escala }, o, 0.7, 'power3.inOut', null); }
/* camPan: desplazamiento RELATIVO (dx, dy en px) respecto a la posicion actual, ~0.6 s. */
function camPan(tl, el, t, dx, dy, o) {
    var e = typeof el === 'string' ? document.querySelector(el) : el;
    var c = e.__cam || { x: 0, y: 0 };
    return camTo(tl, el, t, { x: c.x + (dx || 0), y: c.y + (dy || 0) }, o, 0.6, 'power3.inOut', null);
}
/* camTilt: inclinacion (rotacion en grados, absoluta) ~0.5 s; camTilt(tl, el, t, 0) la endereza. */
function camTilt(tl, el, t, grados, o) { return camTo(tl, el, t, { r: grados }, o, 0.5, 'power2.inOut', null); }
/* ============================ fin del bloque canonico v2 ============================ */
