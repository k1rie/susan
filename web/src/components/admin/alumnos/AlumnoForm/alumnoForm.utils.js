// Estatus del alumno (api_alumno_cambiar_estatus) con su texto en la interfaz.
export const ESTATUS_ALUMNO = [
    { value: 'activo', label: 'Activo' },
    { value: 'baja_temporal', label: 'Baja temporal' },
    { value: 'baja_definitiva', label: 'Baja definitiva' },
    { value: 'egresado', label: 'Egresado' },
];

export const etiquetaEstatus = (estatus) => ESTATUS_ALUMNO.find((e) => e.value === estatus)?.label ?? estatus ?? '';

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const VALORES_INICIALES = {
    matricula: '',
    apellido_paterno: '',
    apellido_materno: '',
    nombres: '',
    correo_institucional: '',
    estatus: 'activo',
};

/** Convierte la ficha del servidor en valores de formulario (sin nulos). */
export function valoresDeAlumno(alumno) {
    if (!alumno) return { ...VALORES_INICIALES };
    return {
        matricula: alumno.matricula ?? '',
        apellido_paterno: alumno.apellido_paterno ?? '',
        apellido_materno: alumno.apellido_materno ?? '',
        nombres: alumno.nombres ?? '',
        correo_institucional: alumno.correo_institucional ?? '',
        estatus: alumno.estatus ?? 'activo',
    };
}

/** Validación de conveniencia (la real es de la base). Devuelve { campo: mensaje }. */
export function validarAlumno(v) {
    const e = {};
    if (!v.matricula.trim()) e.matricula = 'La matrícula es obligatoria.';
    if (!v.apellido_paterno.trim()) e.apellido_paterno = 'El apellido paterno es obligatorio.';
    if (!v.nombres.trim()) e.nombres = 'El nombre es obligatorio.';
    const correo = v.correo_institucional.trim();
    if (!correo) e.correo_institucional = 'El correo institucional es obligatorio.';
    else if (!CORREO.test(correo)) e.correo_institucional = 'Escriba un correo válido.';
    return e;
}

/** Payload de api_alumno_guardar: apellidos y nombres siempre por separado. */
export function datosAlumno(v, idAlumno) {
    return {
        ...(idAlumno ? { id_alumno: idAlumno } : {}),
        matricula: v.matricula.trim(),
        apellido_paterno: v.apellido_paterno.trim(),
        apellido_materno: v.apellido_materno.trim() || null,
        nombres: v.nombres.trim(),
        correo_institucional: v.correo_institucional.trim().toLowerCase(),
    };
}
