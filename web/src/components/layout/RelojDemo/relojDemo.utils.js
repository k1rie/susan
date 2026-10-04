// Funciones puras del reloj de demostracion: leer el ISO con zona que entrega el servidor y darle formato en
// espanol sin depender de Intl (la salida es igual en el servidor, en el navegador y en las pruebas).

/** Saltos relativos que ofrece la tarjeta, en minutos. */
export const SALTOS_MIN = [5, 10, 30];

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const RE_ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/;

const dos = (n) => String(n).padStart(2, '0');

/**
 * ISO 8601 con zona ('2026-09-14T07:12:00-06:00') -> { ms (UTC), offsetMin }, o null si no es de esa forma.
 * @param {string} iso
 */
export function leerIso(iso) {
    const m = typeof iso === 'string' ? RE_ISO.exec(iso) : null;
    if (!m) return null;
    const zona = m[8];
    const offsetMin = zona === 'Z' ? 0 : (zona[0] === '-' ? -1 : 1) * (Number(zona.slice(1, 3)) * 60 + Number(zona.slice(4, 6)));
    const local = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]), Number((m[7] ?? '0').padEnd(3, '0')));
    return Number.isFinite(local) ? { ms: local - offsetMin * 60_000, offsetMin } : null;
}

/** Instante UTC (ms) -> partes de calendario en la zona dada. */
export function partesEnZona(ms, offsetMin) {
    const d = new Date(ms + offsetMin * 60_000);
    return {
        anio: d.getUTCFullYear(),
        mes: d.getUTCMonth() + 1,
        dia: d.getUTCDate(),
        hora: d.getUTCHours(),
        min: d.getUTCMinutes(),
        seg: d.getUTCSeconds(),
        diaSemana: d.getUTCDay(),
    };
}

/** 'lun 14 sep 2026' */
export const formatearFecha = (p) => `${DIAS[p.diaSemana]} ${p.dia} ${MESES[p.mes - 1]} ${p.anio}`;

/** '07:12:00' (o '07:12' sin segundos) */
export const formatearHora = (p, { segundos = true } = {}) => `${dos(p.hora)}:${dos(p.min)}${segundos ? `:${dos(p.seg)}` : ''}`;

/** Valor de <input type="datetime-local"> ('2026-09-14T07:12') en la hora de la sede del ISO dado. */
export function valorParaInput(iso) {
    const leido = leerIso(iso);
    if (!leido) return '';
    const p = partesEnZona(leido.ms, leido.offsetMin);
    return `${p.anio}-${dos(p.mes)}-${dos(p.dia)}T${dos(p.hora)}:${dos(p.min)}`;
}

/** Instante UTC (ms) + desfase -> ISO 8601 con zona ('2026-09-14T07:12:04-06:00'), para el atributo datetime del <time>. */
export function formatearIso(ms, offsetMin) {
    const p = partesEnZona(ms, offsetMin);
    const abs = Math.abs(offsetMin);
    const zona = offsetMin === 0 ? 'Z' : `${offsetMin < 0 ? '-' : '+'}${dos(Math.floor(abs / 60))}:${dos(abs % 60)}`;
    return `${p.anio}-${dos(p.mes)}-${dos(p.dia)}T${dos(p.hora)}:${dos(p.min)}:${dos(p.seg)}${zona}`;
}

/** Valor del input -> cuerpo `fijar` del servidor ('2026-09-14 07:12'); null si esta vacio o no es de esa forma. */
export function fijarDesdeInput(valor) {
    return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(valor) ? valor.replace('T', ' ') : null;
}

/**
 * Instante que se muestra: si el reloj corre, el del servidor mas lo transcurrido desde que llego la respuesta.
 * @param {{ ahora: string, corre: boolean, recibidoEn?: number }} estado
 * @param {number} ahoraRealMs reloj del navegador (solo se usa para medir lo transcurrido)
 */
export function instanteMostrado(estado, ahoraRealMs) {
    const leido = leerIso(estado?.ahora);
    if (!leido) return null;
    const transcurrido = estado.corre && Number.isFinite(estado.recibidoEn) ? Math.max(0, ahoraRealMs - estado.recibidoEn) : 0;
    return { ms: leido.ms + transcurrido, offsetMin: leido.offsetMin };
}
