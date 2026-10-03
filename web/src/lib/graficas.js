// Utilidades compartidas por las gráficas (shadcn/ui chart sobre recharts). Los colores salen SIEMPRE de tokens de globals.css:
// ChartContainer expone cada `color` de la configuración como --color-<clave> dentro de la gráfica.

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
 * Texto para lectores de pantalla que resume una gráfica: "Presentes: 12 (60 %); Ausencias: 8 (40 %)".
 * `datos` = [{ clave, valor }], `config` = configuración de ChartContainer (para las etiquetas).
 */
export function resumenTexto(datos, config = {}) {
    const total = sumar(datos);
    return datos
        .map((d) => `${config[d.clave]?.label ?? d.clave}: ${d.valor}${total > 0 ? ` (${pct(d.valor, total, 0)} %)` : ''}`)
        .join('; ');
}

/** Formatea un porcentaje para ejes y tooltips: 82.35 -> "82,4 %" (es-MX, 1 decimal). */
export function formatoPct(valor, decimales = 1) {
    const n = Number(valor);
    if (!Number.isFinite(n)) return '-';
    return `${new Intl.NumberFormat('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: decimales }).format(n)} %`;
}
