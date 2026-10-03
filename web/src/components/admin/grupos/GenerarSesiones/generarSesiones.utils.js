// Validación de los datos de "Generar sesiones" (el servidor aplica las reglas de fondo).
export const MAX_DIAS_RANGO = 366;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** true si la cadena AAAA-MM-DD es una fecha real. */
export function esFechaValida(s) {
    if (!FECHA_RE.test(s)) return false;
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Texto libre (comas, espacios o saltos de línea) -> { fechas únicas ordenadas, invalidas }. */
export function parsearFechasOmitir(texto) {
    const piezas = String(texto ?? '').split(/[\s,;]+/).filter(Boolean);
    const fechas = [];
    const invalidas = [];
    for (const p of piezas) {
        if (!esFechaValida(p)) invalidas.push(p);
        else if (!fechas.includes(p)) fechas.push(p);
    }
    return { fechas: fechas.sort(), invalidas };
}

export function validarGeneracion({ desde, hasta, omitir }) {
    const e = {};
    if (!esFechaValida(desde)) e.desde = 'Indica la fecha inicial.';
    if (!esFechaValida(hasta)) e.hasta = 'Indica la fecha final.';
    if (!e.desde && !e.hasta) {
        if (hasta < desde) e.hasta = 'La fecha final no puede ser anterior a la inicial.';
        else {
            const dias = (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000 + 1;
            if (dias > MAX_DIAS_RANGO) e.hasta = `El rango no puede pasar de ${MAX_DIAS_RANGO} días.`;
        }
    }
    const { fechas, invalidas } = parsearFechasOmitir(omitir);
    if (invalidas.length) e.omitir = `Fechas no válidas (usa AAAA-MM-DD): ${invalidas.join(', ')}.`;
    return { errores: e, omitirFechas: fechas, valido: Object.keys(e).length === 0 };
}
