// Rótulos de laboratorio y grupo que comparten la lista de solicitudes y el formulario del docente.

/** 'C' -> 'Edificio C'; si el dato ya empieza con «Edificio» no se repite la palabra. */
export function rotuloEdificio(edificio) {
    const e = String(edificio ?? '').trim();
    if (!e) return 'Sin edificio';
    return /^edificio\b/i.test(e) ? e : `Edificio ${e}`;
}

/** 1 -> '1 alumno', 30 -> '30 alumnos'. */
export function textoAlumnos(n) {
    const total = Number(n) || 0;
    return `${total} ${total === 1 ? 'alumno' : 'alumnos'}`;
}

/** 'Administración I (3A)' a partir del grupo de una solicitud o de api_reporte_filtros. */
export function rotuloGrupo(grupo) {
    if (!grupo) return '—';
    return `${grupo.materia_nombre ?? grupo.materia_clave ?? 'Grupo'} (${grupo.clave_grupo ?? '—'})`;
}
