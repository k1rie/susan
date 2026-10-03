export const ROLES_USUARIO = [
    { value: 'administrador', label: 'Administrador' },
    { value: 'docente', label: 'Docente' },
    { value: 'alumno', label: 'Alumno' },
    { value: 'tecnico', label: 'Técnico' },
];
export const etiquetaRol = (r) => ROLES_USUARIO.find((x) => x.value === r)?.label ?? r ?? '';
export const requiereVinculo = (rol) => rol === 'docente' || rol === 'alumno';
