// Utilidades de presentación del portal del alumno (solo formato y textos; las reglas viven en la base).

export const UMBRAL_AVISO_FALTAS = 2;

export function fechaCorta(valor) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor || ''));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

export const horaCorta = (valor) => String(valor || '').slice(0, 5);

export const nombreMateria = (m) => (m && typeof m === 'object' ? m.nombre : m) || '';
export const claveGrupo = (g) => (g && typeof g === 'object' ? g.clave_grupo : g) || '';

/** Aviso previo a perder el derecho a examen según el resumen de la materia; null si no hay nada que avisar. */
export function avisoMateria(item) {
    if (!item) return null;
    if (item.supera_limite || item.derecho_examen === false) {
        return { tone: 'danger', texto: 'Superaste el límite de faltas: sin derecho a examen.' };
    }
    if (item.en_limite) {
        return { tone: 'warning', texto: 'Estás en el límite: una falta más y pierdes el derecho a examen.' };
    }
    const r = item.faltas_restantes_antes_limite;
    if (typeof r === 'number' && r <= UMBRAL_AVISO_FALTAS) {
        return { tone: 'info', texto: `Te quedan ${r} falta${r === 1 ? '' : 's'} antes del límite.` };
    }
    return null;
}
