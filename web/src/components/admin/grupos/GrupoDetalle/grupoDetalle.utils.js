// Cifras de la cabecera del detalle de grupo, listas para pintar en <StatCard> a partir de `api_grupo_obtener`.

const entero = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * «Inscritos activos» frente a la capacidad del aula: la cifra se lee «24 / 45» (la capacidad va como unidad, no pegada al texto).
 * Aula llena = ámbar; más inscritos que lugares = rojo (no debería pasar, pero si ocurre conviene verlo). Sin capacidad conocida
 * no se inventa una unidad. Todas las tarjetas de la cabecera llevan apoyo: sin él su cifra quedaría más abajo que la de la vecina.
 */
export function tarjetaInscritos(inscritos) {
    const activos = entero(inscritos?.activos);
    const capacidad = entero(inscritos?.capacidad_aula);
    if (!capacidad) return { value: activos, unit: undefined, hint: 'Sin capacidad registrada', tone: 'neutral' };
    const unit = `/ ${capacidad}`;
    if (activos > capacidad) return { value: activos, unit, hint: 'Sobre la capacidad', tone: 'danger' };
    if (activos === capacidad) return { value: activos, unit, hint: 'Aula llena', tone: 'warning' };
    return { value: activos, unit, hint: 'Capacidad del aula', tone: 'neutral' };
}

/** «Cerradas» frente al total de sesiones del grupo («12 / 40») y qué parte del total son; sin sesiones no hay total que mostrar. */
export function tarjetaCerradas(sesiones) {
    const total = entero(sesiones?.total);
    const cerradas = entero(sesiones?.cerradas);
    if (!total) return { value: cerradas, unit: undefined, hint: 'Sin sesiones aún' };
    return { value: cerradas, unit: `/ ${total}`, hint: `${Math.round((cerradas / total) * 100)} % del total` };
}

/** Apoyo de «Bajas»: la base cuenta el cupo solo con inscripciones activas, así que las bajas no lo ocupan. */
export const APOYO_BAJAS = 'Fuera del cupo';

/** Apoyo de «Sesiones»: cuántas faltan por darse (programadas). */
export function apoyoSesiones(sesiones) {
    const programadas = entero(sesiones?.programadas);
    return `${programadas} programada${programadas === 1 ? '' : 's'}`;
}

const PESTANAS = ['datos', 'horario', 'aula', 'inscripciones'];

/** Pestaña válida a partir de `?tab=`; cualquier otro valor cae en «datos». */
export const pestanaValida = (id) => (PESTANAS.includes(id) ? id : 'datos');
