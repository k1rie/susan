import { CONFIG_ASISTENCIA } from '@/lib/graficas.js';
import { construirCalendario, contarEstados, rachaAsistencia } from '@/components/ui/CalendarioAsistencia/calendarioAsistencia.utils.js';

// Textos y cifras de la tarjeta «Calendario de asistencia». La cuadrícula y la racha las calcula ui/CalendarioAsistencia; aquí solo se
// arman las frases (en español, con singular y plural) y el texto alternativo para quien no ve el dibujo.

/** Semanas que dibuja el calendario (media carrera de un periodo; con más sesiones se muestran las más recientes). */
export const SEMANAS_CALENDARIO = 26;

// Orden de lectura de los estados y su etiqueta en plural; «sin registro» y «suspendidas» van al final porque no son un registro.
const ORDEN = ['presente', 'retardo', 'ausente', 'justificado', 'pendiente', 'sin_registro', 'suspendida'];
const ETIQUETA = {
    ...Object.fromEntries(Object.entries(CONFIG_ASISTENCIA).map(([clave, c]) => [clave, c.label])),
    sin_registro: 'Sin registro',
    suspendida: 'Suspendidas',
};

const sesiones = (n) => `${n} ${n === 1 ? 'sesión' : 'sesiones'}`;
const entero = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.trunc(Number(v))) : 0);

/** «Racha de 5 sesiones» / «Racha de 1 sesión» / «Sin racha activa» (la última sesión fue falta o aún no hay asistencias seguidas). */
export function textoRacha(actual) {
    const n = entero(actual);
    return n > 0 ? `Racha de ${sesiones(n)}` : 'Sin racha activa';
}

/** «Mejor racha 9»; null si nunca hubo una (no se escribe «mejor racha 0»). */
export function textoMejorRacha(mejor) {
    const n = entero(mejor);
    return n > 0 ? `Mejor racha ${n}` : null;
}

/**
 * Cifras de la tarjeta a partir de los `items` de `api_alumno_historial` (fecha, estado —null = sin registro— y estatus_sesion).
 * `vacio` = ninguna sesión con fecha válida. La racha cuenta sobre las sesiones recibidas (el portal pide el máximo que admite la RPC).
 */
export function datosCalendario(items = []) {
    const { total, recortado, semanas } = construirCalendario(items, { maxSemanas: SEMANAS_CALENDARIO });
    const racha = rachaAsistencia(items);
    return { vacio: total === 0, recortado, semanas: semanas.length, racha, cuentas: contarEstados(items) };
}

// Lado máximo de una casilla del calendario (1.75 rem = 28 px) y separación entre casillas (la del componente: gap-[3px]) y columna de
// días (1.75 rem).
const LADO_CASILLA = '1.75rem';
const SEPARACION = '3px';

/**
 * Ancho máximo del calendario para que las casillas no pasen de ~28 px. El componente reparte el ancho que le den en fracciones y las
 * casillas son cuadradas: con pocas semanas (una materia que apenas empieza) y una pantalla ancha cada casilla saldría de cientos de
 * píxeles. Es solo un tope: en el teléfono el ancho disponible manda y las casillas se encogen.
 */
export function anchoMaximoCalendario(semanas) {
    const n = Math.max(1, Math.trunc(Number(semanas)) || 1);
    return `calc(${LADO_CASILLA} + ${n} * (${LADO_CASILLA} + ${SEPARACION}))`;
}

/** Descripción corta bajo el título. */
export function descripcionCalendario({ vacio, recortado }) {
    if (vacio) return 'Una casilla por cada sesión de la materia';
    return recortado ? `Cada cuadro es una sesión · últimas ${SEMANAS_CALENDARIO} semanas` : 'Cada cuadro es una sesión';
}

/**
 * Texto alternativo de la tarjeta (lo lee el lector de pantalla en lugar del dibujo): cuántas sesiones hay de cada estado, la racha
 * actual y la mejor. «Álgebra» se agrega si se conoce la materia.
 */
export function resumenCalendario({ materia, vacio, recortado, racha, cuentas }) {
    const de = materia ? ` de ${materia}` : '';
    if (vacio) return `Calendario de asistencia${de}: aún no hay sesiones registradas.`;
    const total = Object.values(cuentas).reduce((a, n) => a + n, 0);
    const porEstado = ORDEN.filter((clave) => cuentas[clave]).map((clave) => `${ETIQUETA[clave]} ${cuentas[clave]}`).join(', ');
    const mejor = textoMejorRacha(racha.mejor);
    return [
        `Calendario de asistencia${de}: ${sesiones(total)} (${porEstado}).`,
        `${textoRacha(racha.actual)}.`,
        mejor ? `${mejor}.` : null,
        recortado ? `Se muestran las últimas ${SEMANAS_CALENDARIO} semanas.` : null,
    ].filter(Boolean).join(' ');
}

/** Cómo se cuenta la racha (va plegado en «Cómo se cuenta la racha»). */
export const NOTA_RACHA =
    'La racha cuenta las sesiones seguidas en las que estuviste presente o con retardo, de la más reciente hacia atrás. Una ausencia, o una clase ya cerrada sin registro, la reinicia; las justificadas, las pendientes de revisión y las suspendidas no la cortan.';
