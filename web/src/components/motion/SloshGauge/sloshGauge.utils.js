// Funciones puras del medidor líquido: física del chapoteo y geometría del recorte. Sin DOM, para poder probarlas sin navegador.
// Adaptadas de React Bits (reactbits.dev, componente «Slosh Gauge»); ver la cabecera de SloshGauge.jsx.

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Paso fijo de integración (120 Hz) y tope del tiempo entre cuadros: si la pestaña estuvo en segundo plano no se simula un salto enorme.
export const PASO_FIJO = 1 / 120;
export const DT_MAX = 0.05;
const TILT_GAIN = 0.07;
const TILT_MAX = 30;
// Umbrales para dar el líquido por quieto (posición en puntos de nivel, velocidad en puntos por segundo).
const REST_POS = 0.05;
const REST_VEL = 2;

/** Nivel 0-100 a partir de cualquier entrada; lo que no sea un número finito cae en `respaldo`. */
export function nivelValido(v, respaldo = 0) {
    if (v === null || v === undefined || v === '') return respaldo;
    const n = Number(v);
    return Number.isFinite(n) ? clamp(n, 0, 100) : respaldo;
}

/**
 * Avanza `dt` segundos la física del líquido (resorte amortiguado con rebote en las paredes). Muta `s = { x, v, L }`:
 * x = nivel actual, v = velocidad, L = nivel objetivo. Devuelve true cuando está en reposo (se puede aparcar el rAF).
 * Con `reducido` (o viscosidad 0) no hay resorte: el nivel salta al objetivo y no chapotea.
 */
export function avanzarFisica(s, dt, { viscosity, splash, reducido = false }) {
    if (reducido || !(viscosity > 0)) {
        s.x = s.L;
        s.v = 0;
        return true;
    }
    const k = 1224 - 1044 * viscosity;
    const c = 2 * (0.26 - 0.17 * viscosity) * Math.sqrt(k);
    for (let n = Math.ceil(dt / PASO_FIJO), h = dt / n; n > 0; n -= 1) {
        s.v = s.v * Math.exp(-c * h) + k * (s.L - s.x) * h;
        s.x += s.v * h;
        if (s.x > 100) {
            s.x = 100;
            s.v = -s.v * splash;
        } else if (s.x < 0) {
            s.x = 0;
            s.v = -s.v * splash;
        }
    }
    if (Math.abs(s.L - s.x) < REST_POS && Math.abs(s.v) < REST_VEL) {
        s.x = s.L;
        s.v = 0;
    }
    return s.x === s.L && s.v === 0;
}

/** Desnivel (px) entre el borde izquierdo y el centro de la superficie: el líquido se inclina según su velocidad. Con `reducido` es 0. */
export function desnivelSuperficie(v, tilt, ancho, reducido = false) {
    const grados = reducido ? 0 : clamp(tilt * v * TILT_GAIN, -TILT_MAX, TILT_MAX);
    return (Math.tan((grados * Math.PI) / 180) * ancho) / 2;
}

const redondear = (n) => (Number.isFinite(n) ? Number(n.toFixed(3)) : 0);

/** `clip-path` que deja visible el líquido: superficie a (100 - x) % de la altura, inclinada ±`desnivel` px. */
export function recorteLiquido(x, desnivel = 0) {
    const arriba = redondear(100 - x);
    const d = redondear(desnivel);
    return `polygon(0 calc(${arriba}% + ${d}px), 100% calc(${arriba}% - ${d}px), 100% 100%, 0 100%)`;
}
