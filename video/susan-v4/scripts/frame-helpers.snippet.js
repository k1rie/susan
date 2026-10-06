/* ============================================================================================================
   BLOQUE CANONICO v4 (lectura + camara + pose 3D). Opcional: se PEGA TAL CUAL dentro del <script> de un cuadro, despues de crear
   `tl` (var tl = gsap.timeline({ paused: true });) y antes de registrarlo. No lo edites en el cuadro: edita este archivo.
   Es idempotente: pegarlo en varios cuadros (mismo window) redefine las mismas funciones.

   Cambios respecto a la v3 (video/susan-presentacion/scripts/frame-helpers.snippet.js):
     - SIN sfx()/sfxType()/sfxCount(): en la v4 el sonido se declara en `sfx_cues` de STORYBOARD.md y lo monta mount-sfx.mjs; el
       cuadro solo tiene que mover algo en ese instante (frame-check.mjs y verify-sfx.mjs lo comprueban). Usa el MISMO numero en el
       cuadro y en sfx_cues (p. ej. var T = { chip: 1.30 } y "1.30 pop-3").
     - SIN camTilt (giro en el plano: vetado, SINTESIS 14). Pose 3D con camPose/camPlano, con los topes de la v4: |rotationX| <= 8,
       |rotationY| <= 10 (lanza un error si se piden mas), y plano (0, 0) en cada lectura de cifra y en cada borde de cuadro.
   ============================================================================================================ */
window.SFXN = window.SFXN || 0;   // contador unico de etiquetas (compartido por todos los cuadros de la pagina)

/* readMark(tl, t, 'frase') -> etiqueta 'read:frase#n' en el instante en que una cifra o frase clave queda COMPLETA y legible.
   frame-check.mjs y verify-sfx.mjs exigen >= 1.2 s hasta el corte (SINTESIS 5) y la pose plana en ese instante. */
function readMark(tl, t, frase) {
    tl.addLabel('read:' + frase + '#' + (window.SFXN++), t);
    return t;
}

/* ---- CAMARA (seek-safe). Cada helper hace un fromTo desde el estado que recuerda en el elemento (el estado se encadena en el orden de
   las llamadas) con `immediateRender: false` SIEMPRE: sin eso el segundo fromTo sobre el mismo objetivo aplica su `from` en el
   fotograma 0 (bug del cuadro 6 de la v1). `el`: elemento o selector (el rig: posiciona y anima un padre SIN zoom, frame.md 1).
   Opciones: dur, ease, foco [cx, cy] (punto que queda en el centro), x, y (px, pisan a foco), W, H (lienzo, 1920x1080).
   La camara escala <= 1.3 (frame.md): para leer de cerca sube E, no la escala. Todos los tweens llevan data: 'hero'. ---- */
function camInit(el, escala, x, y) {
    var e = typeof el === 'string' ? document.querySelector(el) : el;
    e.__cam = { s: escala == null ? 1 : escala, x: x || 0, y: y || 0 };
    gsap.set(e, { transformOrigin: '50% 50%', scale: e.__cam.s, x: e.__cam.x, y: e.__cam.y });
}
function camTo(tl, el, t, a, o, dur0, ease0) {
    o = o || {};
    var e = typeof el === 'string' ? document.querySelector(el) : el;
    if (!e.__cam) camInit(e, 1, 0, 0);
    var c = e.__cam, dur = o.dur == null ? dur0 : o.dur, W = o.W || 1920, H = o.H || 1080;
    var s = a.s == null ? c.s : a.s, x = a.x == null ? c.x : a.x, y = a.y == null ? c.y : a.y;
    if (s > 1.3 + 1e-9) throw new Error('camara: escala ' + s + ' > 1.3 (frame.md: sube E en lugar de escalar)');
    if (o.foco) { x = (W / 2 - o.foco[0]) * s; y = (H / 2 - o.foco[1]) * s; }
    if (o.x != null) x = o.x;
    if (o.y != null) y = o.y;
    tl.fromTo(e, { scale: c.s, x: c.x, y: c.y }, { scale: s, x: x, y: y, duration: dur, ease: o.ease || ease0, immediateRender: false, data: 'hero' }, t);
    e.__cam = { s: s, x: x, y: y };
    return t + dur;
}
/* camSnap: salto de zoom corto con ataque. camPush: empuje (acercar). camPull: alejar (por omision a 1). camPan: desplazamiento RELATIVO. */
function camSnap(tl, el, t, escala, o) { return camTo(tl, el, t, { s: escala }, o, 0.18, 'power4.out'); }
function camPush(tl, el, t, escala, o) { return camTo(tl, el, t, { s: escala }, o, 0.8, 'power3.inOut'); }
function camPull(tl, el, t, escala, o) { return camTo(tl, el, t, { s: escala == null ? 1 : escala }, o, 0.7, 'power3.inOut'); }
function camPan(tl, el, t, dx, dy, o) {
    var e = typeof el === 'string' ? document.querySelector(el) : el;
    var c = e.__cam || { x: 0, y: 0 };
    return camTo(tl, el, t, { x: c.x + (dx || 0), y: c.y + (dy || 0) }, o, 0.6, 'power3.inOut');
}

/* ---- POSE 3D del objeto de escenario (BRIEF 2026-10-06, SINTESIS 14). El padre del objeto debe tener `perspective` y el objeto
   `transform-style: preserve-3d` sin filter/opacity < 1/overflow en sus ancestros (aplanan el 3D). ----
   camPose(tl, el, t, { rx, ry }, { dur, ease })  -> inclina a (rx, ry) grados; lanza un error si |rx| > 8 o |ry| > 10.
   camPlano(tl, el, t, { dur, ease })              -> vuelve a (0, 0): antes de leer una cifra y antes del corte (handoff plano). */
function camPose(tl, el, t, a, o) {
    o = o || {};
    var e = typeof el === 'string' ? document.querySelector(el) : el;
    var p = e.__pose || { rx: 0, ry: 0 };
    var rx = a.rx == null ? p.rx : a.rx, ry = a.ry == null ? p.ry : a.ry;
    if (Math.abs(rx) > 8 + 1e-9 || Math.abs(ry) > 10 + 1e-9) throw new Error('camPose: |rotationX| <= 8 y |rotationY| <= 10 (pedido ' + rx + ', ' + ry + ')');
    var dur = o.dur == null ? 0.8 : o.dur;
    tl.fromTo(e, { rotationX: p.rx, rotationY: p.ry }, { rotationX: rx, rotationY: ry, duration: dur, ease: o.ease || 'power3.inOut', immediateRender: false, data: 'hero' }, t);
    e.__pose = { rx: rx, ry: ry };
    return t + dur;
}
function camPlano(tl, el, t, o) { return camPose(tl, el, t, { rx: 0, ry: 0 }, o || { dur: 0.5, ease: 'power3.out' }); }
/* ============================ fin del bloque canonico v4 ============================ */
