// Decimales a mostrar: el máximo de los que traen `from` y `to` (2.50 -> 1; 3 -> 0). Sin ceros colgantes.
export function decimalesDe(...numeros) {
    return Math.max(
        0,
        ...numeros.map((n) => {
            const [, fraccion = ''] = String(n).split('.');
            return Number(fraccion) === 0 ? 0 : fraccion.length;
        }),
    );
}

// Formatea con separador de miles según el idioma (es-MX por defecto) y un número fijo de decimales.
export function formatearNumero(valor, { decimales = 0, locale = 'es-MX', separador = true } = {}) {
    return new Intl.NumberFormat(locale, {
        useGrouping: separador,
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales,
    }).format(valor);
}
