// Validación del formulario de grupo (el servidor revalida: duplicados, docente activo, etc.).
export const PERIODO_RE = /^[0-9]{4}-[12]$/;
export const CLAVE_RE = /^[A-Z0-9][A-Z0-9-]{0,7}$/;

export const VALORES_INICIALES = { id_materia: '', id_docente: '', id_aula: '', clave_grupo: '', periodo: '' };

export function validarGrupo(v) {
    const e = {};
    if (!v.id_materia) e.id_materia = 'Elige la materia.';
    if (!v.id_docente) e.id_docente = 'Elige el docente.';
    if (!v.id_aula) e.id_aula = 'Elige el aula.';
    if (!CLAVE_RE.test(String(v.clave_grupo || '').trim().toUpperCase())) {
        e.clave_grupo = 'Hasta 8 letras, dígitos o guiones.';
    }
    if (!PERIODO_RE.test(String(v.periodo || '').trim())) e.periodo = 'Usa el formato AAAA-S (S = 1 o 2), por ejemplo 2026-2.';
    return e;
}

export function datosGrupo(v, idGrupo) {
    const datos = {
        id_materia: Number(v.id_materia),
        id_docente: Number(v.id_docente),
        id_aula: Number(v.id_aula),
        clave_grupo: String(v.clave_grupo).trim().toUpperCase(),
        periodo: String(v.periodo).trim(),
    };
    if (idGrupo) datos.id_grupo = idGrupo;
    return datos;
}

export function valoresDeGrupo(g) {
    return {
        id_materia: String(g.id_materia ?? ''),
        id_docente: String(g.id_docente ?? ''),
        id_aula: String(g.id_aula ?? ''),
        clave_grupo: g.clave_grupo ?? '',
        periodo: g.periodo ?? '',
    };
}
