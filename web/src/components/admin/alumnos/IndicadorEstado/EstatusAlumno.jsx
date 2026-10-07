import Badge from '@/components/ui/Badge';
import { etiquetaEstatus } from '../AlumnoForm/alumnoForm.utils.js';

// El estatus siempre se dice con texto; el tono solo lo refuerza (activo en verde, bajas en ámbar o rojo, egresado en azul).
const TONO = { activo: 'success', baja_temporal: 'warning', baja_definitiva: 'danger', egresado: 'info' };

export default function EstatusAlumno({ estatus }) {
    return <Badge tone={TONO[estatus] ?? 'neutral'}>{etiquetaEstatus(estatus)}</Badge>;
}
