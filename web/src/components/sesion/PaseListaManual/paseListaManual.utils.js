// Utilidades puras del pase de lista manual (P-04).

/** Avance del pase: cuántos alumnos activos ya tienen estado marcado. `marcas` = { [id_alumno]: estado }. */
export function conteoMarcas(activos, marcas) {
    const lista = Array.isArray(activos) ? activos : [];
    const marcados = lista.filter((a) => marcas?.[a.id_alumno]).length;
    return { marcados, total: lista.length, ancho: lista.length ? (marcados / lista.length) * 100 : 0 };
}
