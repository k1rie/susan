// Opciones de los filtros del reporte y de la analítica (puras, para probarlas sin pantalla).

/** «Finanzas · 3A»: lo que se lee en el campo una vez elegido el grupo. */
export function etiquetaGrupo(g) {
    return `${g.materia_nombre} · ${g.clave_grupo}`;
}

/** Opciones del selector de grupo: nombre y clave arriba; docente e inscritos debajo (la segunda línea desambigua grupos de la misma materia). */
export function opcionesGrupo(grupos) {
    return (grupos ?? []).map((g) => {
        const detalle = [g.docente_nombre, g.inscritos != null ? `${g.inscritos} inscritos` : null].filter(Boolean).join(' · ');
        return { value: String(g.id_grupo), label: etiquetaGrupo(g), description: detalle || undefined };
    });
}

// El hook del reporte arma «Ana Pérez (E260001)»: se separa para mostrar el nombre arriba y la matrícula debajo.
const NOMBRE_CON_MATRICULA = /^(.*\S)\s*\(([^()]+)\)\s*$/;

/** Opciones del selector de alumno a partir de [{ idAlumno, nombreCompleto }]. */
export function opcionesAlumno(alumnos) {
    return (alumnos ?? []).map((a) => {
        const partes = NOMBRE_CON_MATRICULA.exec(a.nombreCompleto ?? '');
        return partes
            ? { value: String(a.idAlumno), label: partes[1], description: partes[2], avatar: partes[1] }
            : { value: String(a.idAlumno), label: a.nombreCompleto ?? '', avatar: a.nombreCompleto ?? '' };
    });
}

/**
 * Filtros activos como chips: solo los OPCIONALES (grupo y alumno); el periodo siempre tiene valor y ya está a la vista en su campo.
 * Cada uno sabe cómo quitarse sin tocar a los demás, salvo que quitar el grupo también quita el alumno (el alumno depende del grupo).
 */
export function filtrosActivos({ valor, grupos, alumnos }) {
    const lista = [];
    // Sin la lista cargada todavía (o con un id que ya no existe) no se inventa un nombre: el chip espera a conocerlo.
    const g = valor?.idGrupo ? (grupos ?? []).find((x) => x.id_grupo === valor.idGrupo) : null;
    if (g) lista.push({ id: 'grupo', nombre: 'Grupo', texto: etiquetaGrupo(g), quitar: { idGrupo: null, idAlumno: null } });
    const a = valor?.idAlumno ? opcionesAlumno((alumnos ?? []).filter((x) => x.idAlumno === valor.idAlumno))[0] : null;
    if (a) lista.push({ id: 'alumno', nombre: 'Alumno', texto: a.label, quitar: { idAlumno: null } });
    return lista;
}
