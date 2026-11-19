import { formatoFechaCorta, lunesDeSemana, sumarDias } from '../../laboratorios.utils.js';
import { conteoTexto } from '../laboratoriosAdmin.utils.js';

/** Tipo visible de un bloque de la agenda: 'clase' | 'aprobada' | 'pendiente' (las solicitudes llevan su estatus). */
export function tipoDeBloque(bloque) {
    if (bloque?.tipo === 'clase') return 'clase';
    return bloque?.estatus === 'pendiente' ? 'pendiente' : 'aprobada';
}

/**
 * El tipo SIEMPRE se escribe (no depende del color ni del borde): una clase del grupo, una solicitud aprobada o una pendiente.
 * `estilo` es el refuerzo visual: relleno suave para la clase, color de aprobada, y borde discontinuo para la pendiente (aún no es firme).
 */
export const TIPOS_BLOQUE = {
    clase: { etiqueta: 'Clase', tono: 'neutral', estilo: 'border-border bg-muted/50' },
    aprobada: { etiqueta: 'Solicitud aprobada', tono: 'success', estilo: 'border-success/40 bg-presente-bg/40' },
    pendiente: { etiqueta: 'Solicitud pendiente', tono: 'warning', estilo: 'border-dashed border-warning/60 bg-retardo-bg/40' },
};

/** Rango que se pide a la RPC para la semana que empieza en `lunes`: de lunes a domingo (7 días, bajo el máximo de 42). */
export const rangoSemana = (lunes) => ({ desde: lunes, hasta: sumarDias(lunes, 6) });

/** 'Semana del lun 14 sep al dom 20 sep' (con el año en la fecha que no cae en el año actual). */
export function etiquetaSemana(lunes, hoy = null) {
    const { desde, hasta } = rangoSemana(lunes);
    return `Semana del ${formatoFechaCorta(desde, hoy)} al ${formatoFechaCorta(hasta, hoy)}`;
}

/** Los siete días de la semana con sus bloques (ya en el orden del servidor: por hora). */
export function agruparPorDia(bloques, lunes) {
    const lista = Array.isArray(bloques) ? bloques : [];
    return Array.from({ length: 7 }, (_, i) => {
        const fecha = sumarDias(lunes, i);
        return { fecha, bloques: lista.filter((b) => b.fecha === fecha) };
    });
}

/** '2 clases · 1 solicitud aprobada · 1 solicitud pendiente'; 'Sin ocupación esta semana' si no hay nada. */
export function resumenSemana(bloques) {
    const lista = Array.isArray(bloques) ? bloques : [];
    const n = { clase: 0, aprobada: 0, pendiente: 0 };
    for (const b of lista) n[tipoDeBloque(b)] += 1;
    const partes = [];
    if (n.clase) partes.push(conteoTexto(n.clase, 'clase', 'clases'));
    if (n.aprobada) partes.push(conteoTexto(n.aprobada, 'solicitud aprobada', 'solicitudes aprobadas'));
    if (n.pendiente) partes.push(conteoTexto(n.pendiente, 'solicitud pendiente', 'solicitudes pendientes'));
    return partes.length ? partes.join(' · ') : 'Sin ocupación esta semana';
}

/** ¿La semana elegida es la que contiene a `hoy`? */
export const esSemanaActual = (lunes, hoy) => Boolean(hoy) && lunes === lunesDeSemana(hoy);
