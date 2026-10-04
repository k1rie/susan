// Utilidades compartidas por las gráficas hechas a mano (SVG/CSS) de components/ui. Los colores salen SIEMPRE de tokens de
// globals.css; `colorGrafica` traduce los de texto a los más vivos de gráfica (--g-*).

// Configuración de series para los estados de asistencia (misma paleta que StatusChip).
export const CONFIG_ASISTENCIA = {
    presente: { label: 'Presentes', color: 'var(--presente)' },
    retardo: { label: 'Retardos', color: 'var(--retardo)' },
    ausente: { label: 'Ausencias', color: 'var(--ausente)' },
    justificado: { label: 'Justificadas', color: 'var(--justificado)' },
    pendiente: { label: 'Pendientes', color: 'var(--pendiente)' },
};

// Serie neutra / de marca para cifras sin estado (azul de gráfica, dorado, verde, violeta).
export const COLORES_SERIE = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-5)', 'var(--chart-4)'];

// Los componentes de gráfica reciben colores de TEXTO (--presente, --ausente…, oscuros para leerse como texto) desde las pantallas.
// Para pintar áreas se cambian por los de GRÁFICA (--g-*, más vivos): así las pantallas no cambian al cambiar el estilo.
const COLOR_DE_GRAFICA = {
    'var(--presente)': 'var(--g-presente)',
    'var(--retardo)': 'var(--g-retardo)',
    'var(--ausente)': 'var(--g-ausente)',
    'var(--justificado)': 'var(--g-justificado)',
    'var(--pendiente)': 'var(--g-pendiente)',
    'var(--chart-1)': 'var(--g-azul)',
    'var(--chart-2)': 'var(--g-dorado)',
    'var(--chart-3)': 'var(--g-presente)',
    'var(--chart-4)': 'var(--g-ausente)',
    'var(--chart-5)': 'var(--g-violeta)',
};

/** Color para pintar una serie/segmento: traduce los tokens de texto a los de gráfica y deja pasar cualquier otro valor. */
export function colorGrafica(color) {
    return COLOR_DE_GRAFICA[color] ?? color;
}

/** Porcentaje (0-100) de `parte` sobre `total` con `dec` decimales; 0 si el total es 0 o no es válido. */
export function pct(parte, total, dec = 1) {
    const t = Number(total);
    const p = Number(parte);
    if (!Number.isFinite(t) || !Number.isFinite(p) || t <= 0) return 0;
    return Number(((p * 100) / t).toFixed(dec));
}

/** Suma de los `valor` de una lista de datos (ignora no numéricos). */
export function sumar(datos) {
    return datos.reduce((a, d) => a + (Number.isFinite(Number(d.valor)) ? Number(d.valor) : 0), 0);
}

/**
 * Texto para lectores de pantalla que resume una gráfica: "Presentes: 12 (60 %); Ausencias: 8 (40 %)". Usa textoPct, así que un valor
 * pequeño se dice «<1 %» igual que en la leyenda de AnilloEstados (un «0 %» junto a una cifra mayor que 0 engaña).
 * `datos` = [{ clave, valor }], `config` = { clave: { label, color } } (de ahí salen las etiquetas).
 */
export function resumenTexto(datos, config = {}) {
    const total = sumar(datos);
    return datos
        .map((d) => `${config[d.clave]?.label ?? d.clave}: ${d.valor}${total > 0 ? ` (${textoPct(d.valor, total)})` : ''}`)
        .join('; ');
}

/**
 * Número finito o null. null, undefined, '', booleanos, NaN e Infinity -> null («sin dato»); los textos numéricos ('3') se convierten.
 * Distingue «sin dato» (null) de un 0 real: un día sin sesiones no es un día con 0 % de ausentismo.
 */
export function numeroOpcional(valor) {
    if (valor == null || valor === '' || typeof valor === 'boolean') return null;
    const n = Number(valor);
    return Number.isFinite(n) ? n : null;
}

/** Valor para dibujar: lo no numérico cuenta como 0 y los negativos se recortan a 0 (una barra o un arco no pueden ser negativos). */
export function valorNoNegativo(valor) {
    return Math.max(0, numeroOpcional(valor) ?? 0);
}

const FORMATO_NUMERO = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });

/** Cifra para etiquetas: 26.74 -> "26.7" (es-MX, hasta 1 decimal, sin ceros de relleno); sin dato -> "-". */
export function formatoNumero(valor) {
    const n = numeroOpcional(valor);
    return n === null ? '-' : FORMATO_NUMERO.format(n);
}

/** Porcentaje entero para leyendas: un valor positivo que redondea a 0 se escribe «<1 %» (un «0 %» junto a una cifra mayor que 0 engaña). */
export function textoPct(parte, total) {
    const entero = pct(parte, total, 0);
    if (entero === 0 && Number(parte) > 0 && Number(total) > 0) return '<1 %';
    return `${entero} %`;
}

// Avance aproximado (en «em», múltiplos del tamaño de la fuente) de cada tipo de carácter de la interfaz, calibrado contra una grotesca
// de interfaz (cifras tabulares ~0,61 em, «%» ~0,93 em) y redondeado hacia ARRIBA. Es una ESTIMACIÓN holgada para decidir cuándo
// reducir, abreviar o cortar un texto antes de que choque con el vecino; no mide el texto real, así que sirve en el servidor y no obliga
// a medir el DOM.
const EM_DIGITO = 0.63;
const EM_SEPARADOR = 0.3;
const EM_ESPACIO = 0.3;
const EM_PORCENTAJE = 0.95;
const EM_GUION = 0.45;
const EM_ESTRECHA = 0.3; // i, l, j, I, ! | '
const EM_MEDIA = 0.4; // f, t, r
const EM_ANCHA = 0.92; // m, w, M, W
const EM_MAYUSCULA = 0.7;
const EM_OTRO = 0.6;

function emDeCaracter(c) {
    if (c >= '0' && c <= '9') return EM_DIGITO;
    if (c === '.' || c === ',') return EM_SEPARADOR;
    if (/\s/.test(c)) return EM_ESPACIO;
    if (c === '%') return EM_PORCENTAJE;
    if (c === '-' || c === '–' || c === '−') return EM_GUION;
    // Las letras acentuadas miden como su letra base (é -> e).
    const base = c.normalize('NFD')[0];
    if ('iIlj!|\''.includes(base)) return EM_ESTRECHA;
    if ('ftr'.includes(base)) return EM_MEDIA;
    if ('mwMW'.includes(base)) return EM_ANCHA;
    if (base >= 'A' && base <= 'Z') return EM_MAYUSCULA;
    return EM_OTRO;
}

/** Ancho estimado de un texto en «em»: multiplícalo por el tamaño de fuente en px para obtener px. */
export function anchoTextoEm(texto) {
    let em = 0;
    for (const c of String(texto ?? '')) em += emDeCaracter(c);
    return em;
}

/** Formatea un porcentaje para ejes y tooltips: 82.35 -> "82,4 %" (es-MX, 1 decimal). */
export function formatoPct(valor, decimales = 1) {
    const n = Number(valor);
    if (!Number.isFinite(n)) return '-';
    return `${new Intl.NumberFormat('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: decimales }).format(n)} %`;
}
