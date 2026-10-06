// sfx-visible.mjs - "este sonido, tiene un evento visible?" (chequeo 'sonido sin evento visible' de verify-sfx.mjs).
// Portado tal cual de la v3 (video/susan-presentacion/scripts/lib/sfx-visible.mjs) salvo evaluarCue/coherentes, que en la v4 resuelve
// verify-sfx.mjs con eventos.json (extract-events.mjs) y aceptando el inicio O el final de un tween (llegada).
//
// Un cue de efecto (tap, blip, soft-in, pop, check, stamp, click, snap, lock, shutter) solo se justifica si en el MISMO fotograma
// de la etiqueta (+-33 ms) EMPIEZA un cambio de imagen que se vea a 1920x1080. El revisor de la v2.1 encontro 4 cues que sonaban sobre imagen
// quieta (10-alumno-19, 12-cierre-2, 03-tarde-23, 04-intro-17): sus tweens eran un hundimiento de 4 px, un respiro de opacidad .15 -> .42 sobre una
// linea fina, un rebote de escala 1.03 y un destello de .14: todos "existen" para el codigo y ninguno se ve. Por eso aqui no basta con que haya un
// tween: se mide la MAGNITUD de cada propiedad animada (events.json de extract-events.mjs: propiedades + desde) contra umbrales de percepcion.
//
// Umbrales (una propiedad por encima de su umbral basta para que el tween cuente; se eligieron con los 4 casos conocidos como limite):
//   opacity / fillOpacity  |Delta| >= 0.30. Sin valor de partida (tween 'to'): solo cuenta si el destino es 0 o 1 (aparece/desaparece del todo);
//                          un destino intermedio (0.42, 0.34) es un "respiro" cuyo tamano no se conoce y NO cuenta.
//   x, y                   |Delta| >= 12 px (sin partida: |destino| >= 12).
//   scale, scaleX, scaleY  |Delta| >= 0.30 (sin partida: contra 1). Un rebote de 1.03 o 1.16 en un icono o chip pequeno no se ve; las entradas
//                          reales (0 -> 1, 0.5 -> 1.12) los superan de sobra o traen opacity.
//   rotation               |Delta| >= 45 grados (un giro de 6-20 grados de un brillo o una llama no se ve).
//   color, backgroundColor, borderColor, fill, stroke, clipPath, filter, backgroundPosition, strokeDash*, width, height, v, t, value, innerText:
//                          cualquier cambio (cambio de color, de recorte, de desenfoque, trazo que se dibuja, contador o texto que cambia).
// Limite conocido: sin el tamano en pantalla del elemento (events.json no lo trae) los umbrales de escala/traslacion son de tamano medio; un
// elemento enorme que escala 1.1 se vera aunque aqui no cuente (falso AVISO, nunca falso OK) y uno diminuto con 0.3 se vera poco.
//
// Tambien cuentan como evento visible: un tween de `main` (transicion entre cuadros) que empieza o termina a +-TOL, y el fotograma en que
// entra un cuadro nuevo (corte seco / match cut: cuadros[x].start).

export const SONIDOS_CON_EVENTO = /^(tap|click(-[\w-]+)?|blip|soft-in|pop(-\d)?|check|stamp|snap|lock|shutter)$/;

export const UMBRAL = { opacidad: 0.3, traslacionPx: 12, escala: 0.3, giroGrados: 45 };
const CAMBIO_LIBRE = /color|Color|^fill$|^stroke$|^clipPath$|^filter$|^backgroundPosition$|^strokeDash|^v$|^t$|^value$|^innerText$|^width$|^height$/;

const num = (v) => (typeof v === 'number' ? v : Number.parseFloat(v));
const fmt = (v) => (typeof v === 'number' ? String(Math.round(v * 1000) / 1000) : String(v));

// Propiedades de un evento (de events.json) cuyo cambio es perceptible. Devuelve [{ prop, de, a }] (vacio = no se ve).
export function propiedadesVisibles(ev) {
    const P = ev.propiedades ?? {}, D = ev.desde ?? {};
    const vis = [];
    for (const k of Object.keys(P)) {
        const a = P[k], de = D[k];
        let ok = false;
        if (k === 'opacity' || k === 'fillOpacity') {
            const n = num(a);
            ok = de !== undefined ? Math.abs(n - num(de)) >= UMBRAL.opacidad - 1e-9 : n <= 0.02 || n >= 0.98;
        } else if (k === 'x' || k === 'y') {
            ok = Math.abs(num(a) - (de !== undefined ? num(de) : 0)) >= UMBRAL.traslacionPx - 1e-9;
        } else if (/^scale(X|Y)?$/.test(k)) {
            ok = Math.abs(num(a) - (de !== undefined ? num(de) : 1)) >= UMBRAL.escala - 1e-9;
        } else if (k === 'rotation') {
            ok = Math.abs(num(a) - (de !== undefined ? num(de) : 0)) >= UMBRAL.giroGrados - 1e-9;
        } else if (CAMBIO_LIBRE.test(k)) {
            ok = de === undefined || String(de) !== String(a);
        }
        if (ok) vis.push({ prop: k, de: de === undefined ? null : de, a });
    }
    return vis;
}

// Resumen corto de un evento para el aviso: "10-alumno-cb y 0>4".
export function describirEvento(ev) {
    const o = ev.objetivos?.[0];
    const nombre = o ? o.id ?? o.clase ?? o.tag : 'objeto';
    const props = Object.keys(ev.propiedades ?? {}).filter((k) => !/^(onUpdateParams|snap|transformOrigin)$/.test(k))
        .map((k) => `${k} ${ev.desde?.[k] !== undefined ? fmt(ev.desde[k]) : '?'}>${fmt(ev.propiedades[k])}`).join(', ');
    return `${nombre} ${props || '(sin propiedades)'}`;
}
