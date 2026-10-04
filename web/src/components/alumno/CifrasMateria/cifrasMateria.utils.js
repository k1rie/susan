import { avisoMateria } from '../alumno.utils.js';

// Cifras de la materia elegida para las casillas (StatCard). Solo presentación: los contadores y el límite los dicta la base
// (`api_alumno_resumen`); aquí únicamente se escogen, se etiquetan y se les da el tono que ya calcula `avisoMateria`.

const entero = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.trunc(Number(v))) : 0);

// StatCard solo conoce neutral | success | warning | danger: el aviso «info» (te quedan pocas faltas, aún con derecho) es neutral.
const TONO_DE_AVISO = { danger: 'danger', warning: 'warning', info: 'neutral' };

/**
 * Casilla «Faltas restantes»: cuántas faltas equivalentes le quedan antes del límite, con el estado en el texto de apoyo (no solo en el
 * color). Sin sesiones programadas no hay nada que medir: se escribe «-» y no un 0 inventado.
 */
export function casillaRestantes(item) {
    const base = { clave: 'restantes', label: 'Faltas restantes' };
    if (!(Number(item?.sesiones_programadas) > 0)) {
        return { ...base, value: '-', tone: 'neutral', hint: 'Aún no hay sesiones programadas' };
    }
    const r = item.faltas_restantes_antes_limite;
    const value = typeof r === 'number' && Number.isFinite(r) ? Math.max(0, r) : '-';
    const aviso = avisoMateria(item);
    if (!aviso) return { ...base, value, tone: 'success', hint: 'Dentro del límite' };
    return { ...base, value, tone: TONO_DE_AVISO[aviso.tone] ?? 'neutral', hint: aviso.corto };
}

/**
 * Las seis casillas de la materia, en el orden en que se leen: los cinco estados del registro y lo que queda antes del límite.
 * Los pendientes de revisión no cuentan hasta que el docente los resuelva, y la casilla lo dice cuando hay alguno.
 */
export function cifrasMateria(item) {
    const pendientes = entero(item?.pendientes);
    return [
        { clave: 'presentes', label: 'Presentes', value: entero(item?.presentes), tone: 'success' },
        { clave: 'retardos', label: 'Retardos', value: entero(item?.retardos), tone: 'warning' },
        { clave: 'ausencias', label: 'Ausencias', value: entero(item?.ausencias), tone: 'danger' },
        { clave: 'justificadas', label: 'Justificadas', value: entero(item?.justificadas), tone: 'neutral' },
        { clave: 'pendientes', label: 'Pendientes', value: pendientes, tone: 'neutral', hint: pendientes > 0 ? 'Aún no cuentan' : undefined },
        casillaRestantes(item),
    ];
}
