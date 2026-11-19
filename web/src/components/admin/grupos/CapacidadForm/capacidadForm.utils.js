// Validación de la capacidad del aula. La base exige un entero > 0; el servidor además rechaza una capacidad menor que los inscritos
// activos de CUALQUIER grupo del aula. Aquí solo se conoce el grupo que se está viendo: se usa para avisar antes, no para decidir.
export const CAPACIDAD_MAXIMA = 1000;

export function validarCapacidad({ capacidad }, { inscritosActivos } = {}) {
    const e = {};
    const n = Number(capacidad);
    if (String(capacidad ?? '').trim() === '' || !Number.isInteger(n) || n < 1) e.capacidad = 'La capacidad debe ser un número entero mayor que 0.';
    else if (n > CAPACIDAD_MAXIMA) e.capacidad = `La capacidad máxima es ${CAPACIDAD_MAXIMA}.`;
    else if (inscritosActivos != null && n < inscritosActivos) {
        e.capacidad = `Este grupo ya tiene ${inscritosActivos} inscritos activos: la capacidad no puede ser menor.`;
    }
    return e;
}

/** Ocupación del grupo frente a la capacidad: { porcentaje, tono, texto } para la barra y el texto. */
export function ocupacion({ inscritosActivos, capacidad }) {
    const cap = Number(capacidad);
    if (inscritosActivos == null || !Number.isFinite(cap) || cap <= 0) return null;
    const porcentaje = Math.min(Math.round((inscritosActivos / cap) * 100), 100);
    const tono = inscritosActivos > cap ? 'danger' : inscritosActivos === cap ? 'warning' : 'neutral';
    const texto = `${inscritosActivos} de ${cap} lugares ocupados por este grupo`;
    return { porcentaje, tono, texto, estado: tono === 'danger' ? 'Sobre la capacidad' : tono === 'warning' ? 'Aula llena' : null };
}
