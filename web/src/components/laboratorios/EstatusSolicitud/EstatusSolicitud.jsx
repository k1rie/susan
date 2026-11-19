import Badge from '@/components/ui/Badge';
import { ETIQUETA_ESTATUS, estatusVisible } from '../laboratorios.utils.js';

// Tono por estatus: siempre con el texto (nunca solo color). «Vencida» es una pendiente cuya hora de inicio ya pasó.
const TONO = {
    pendiente: 'warning',
    aprobada: 'success',
    rechazada: 'danger',
    cancelada: 'neutral',
    vencida: 'neutral',
};

// Etiqueta del estatus de una solicitud de laboratorio. Recibe la solicitud completa (para detectar «vencida») o,
// con `estatus`, solo el valor.
export default function EstatusSolicitud({ solicitud, estatus, className }) {
    const valor = estatus ?? estatusVisible(solicitud);
    return (
        <Badge tone={TONO[valor] ?? 'neutral'} className={className}>
            {ETIQUETA_ESTATUS[valor] ?? valor}
        </Badge>
    );
}
