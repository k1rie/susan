import { BookOpen, GraduationCap, ShieldCheck, Wrench } from 'lucide-react';

// `value` y `label` los usan los filtros; `descripcion` e `icono` (componente de Lucide) las tarjetas de rol: cada rol explica
// qué puede hacer antes de elegirlo (referencia R05/P7: tarjetas de opción con consecuencias).
export const ROLES_USUARIO = [
    { value: 'administrador', label: 'Administrador', descripcion: 'Gestiona catálogos, cuentas y la bitácora de auditoría.', icono: ShieldCheck },
    { value: 'docente', label: 'Docente', descripcion: 'Pasa lista y revisa justificantes de sus grupos.', icono: GraduationCap },
    { value: 'alumno', label: 'Alumno', descripcion: 'Consulta su asistencia y registra justificantes.', icono: BookOpen },
    { value: 'tecnico', label: 'Técnico', descripcion: 'Opera las cámaras, los parámetros y el índice facial.', icono: Wrench },
];
export const etiquetaRol = (r) => ROLES_USUARIO.find((x) => x.value === r)?.label ?? r ?? '';
export const requiereVinculo = (rol) => rol === 'docente' || rol === 'alumno';
