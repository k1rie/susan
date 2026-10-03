// Utilidades puras de las alertas de asistencia (RN-11).
import { formatoPct } from '@/lib/graficas.js';

/** `sin_derecho` es el tipo del RPC de alertas; `sin_derecho_examen` es el alias histórico del panel. */
export const sinDerecho = (a) => a?.tipo === 'sin_derecho_examen' || a?.tipo === 'sin_derecho';

// Number(null) y Number('') dan 0: un dato que falta no es «0 %», es un dato que falta.
const numeroOVacio = (v) => (v == null || (typeof v === 'string' && v.trim() === '') ? Number.NaN : Number(v));

/**
 * Avance de las faltas contra el límite: la barra llena equivale a haber alcanzado el límite.
 * `excede` = ya está en o sobre el límite (cambia el color de la barra). `valido` = hay porcentaje que mostrar
 * (sin él no se dibuja la barra: una barra vacía diría «0 %»).
 */
export function progresoFaltas(porcentaje, limite) {
    const p = numeroOVacio(porcentaje);
    const l = numeroOVacio(limite);
    const valido = Number.isFinite(p);
    if (!valido || !Number.isFinite(l) || l <= 0) return { ancho: 0, excede: false, texto: valido ? formatoPct(p) : '-', valido };
    return {
        ancho: Math.min(100, Math.max(0, (p / l) * 100)),
        excede: p >= l,
        texto: `${formatoPct(p)} de ${formatoPct(l)}`,
        valido,
    };
}

/** Subtítulo de una alerta: «Materia (3A) · E123». La matrícula distingue a dos alumnos con el mismo nombre en un grupo. */
export function subtituloAlerta(a) {
    const grupo = `${a?.materia ?? '-'} (${a?.clave_grupo ?? '-'})`;
    return a?.matricula ? `${grupo} · ${a.matricula}` : grupo;
}

/** Conteos para el encabezado: cuántos ya no tienen derecho y cuántos están a una falta. */
export function conteoAlertas(alertas) {
    const lista = Array.isArray(alertas) ? alertas : [];
    const sin = lista.filter(sinDerecho).length;
    return { total: lista.length, sinDerecho: sin, enLimite: lista.length - sin };
}
