// Utilidades de presentación del portal del alumno (solo formato y textos; las reglas viven en la base).

export const UMBRAL_AVISO_FALTAS = 2;

export function fechaCorta(valor) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor || ''));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

export const horaCorta = (valor) => String(valor || '').slice(0, 5);

export const nombreMateria = (m) => (m && typeof m === 'object' ? m.nombre : m) || '';
export const claveGrupo = (g) => (g && typeof g === 'object' ? g.clave_grupo : g) || '';

/**
 * Aviso previo a perder el derecho a examen según el resumen de la materia; null si no hay nada que avisar.
 * `texto` es la frase completa (para el Alert de la tarjeta) y `corto` la versión de una línea para la casilla de cifras: las dos
 * salen de las mismas condiciones, así la tarjeta y la casilla nunca se contradicen.
 */
export function avisoMateria(item) {
    if (!item) return null;
    if (item.supera_limite || item.derecho_examen === false) {
        return { tone: 'danger', texto: 'Superaste el límite de faltas: sin derecho a examen.', corto: 'Sin derecho a examen' };
    }
    if (item.en_limite) {
        return { tone: 'warning', texto: 'Estás en el límite: una falta más y pierdes el derecho a examen.', corto: 'Una falta más y pierdes el derecho' };
    }
    const r = item.faltas_restantes_antes_limite;
    if (typeof r === 'number' && r <= UMBRAL_AVISO_FALTAS) {
        return { tone: 'info', texto: `Te quedan ${r} falta${r === 1 ? '' : 's'} antes del límite.`, corto: 'Cerca del límite' };
    }
    return null;
}

const ORIGEN = { automatico: 'Automático', manual: 'Manual', correccion: 'Corrección' };

/** "Automático · 08:03" (origen y hora de registro); cadena vacía si no hay ninguno. */
export function lineaRegistro(s) {
    const origen = s?.origen ? ORIGEN[s.origen] || s.origen : '';
    const hora = s?.hora_registro ? horaCorta(String(s.hora_registro).slice(11)) : '';
    return [origen, hora].filter(Boolean).join(' · ');
}

/** Texto gris del historial plegable: "32 sesiones · 12 ausencias". */
export function resumenHistorial(total, item) {
    const n = Number(total) || 0;
    const partes = [n === 1 ? '1 sesión' : `${n} sesiones`];
    if (item && Number.isFinite(Number(item.ausencias))) {
        const a = Number(item.ausencias);
        partes.push(`${a} ausencia${a === 1 ? '' : 's'}`);
    }
    return partes.join(' · ');
}

/** Mezcla de registros resueltos de una materia para la barra segmentada: [{ clave, valor }] en el orden del anillo (los pendientes no cuentan). */
export function composicionRegistros(item) {
    const n = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0);
    return [
        { clave: 'presente', valor: n(item?.presentes) },
        { clave: 'retardo', valor: n(item?.retardos) },
        { clave: 'ausente', valor: n(item?.ausencias) },
        { clave: 'justificado', valor: n(item?.justificadas) },
    ];
}
