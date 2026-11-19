import { ShieldAlert } from 'lucide-react';
import Badge from '@/components/ui/Badge';

// Marca de la detección de vida: alguna lectura VÁLIDA del caso salió «no viva» (posible foto frente a la cámara). Es solo una
// pista para el docente: no cambia el estado ni las lecturas (la decisión sigue siendo suya). Texto + icono, nunca solo color.
export default function EtiquetaSospechosa({ lecturasNoVivas, className }) {
    const n = Number(lecturasNoVivas) || 0;
    const detalle = n > 0 ? `${n} ${n === 1 ? 'lectura válida marcada' : 'lecturas válidas marcadas'} como no viva` : 'Lectura marcada como no viva';
    return (
        <Badge tone="danger" title={detalle} className={className}>
            <ShieldAlert aria-hidden="true" className="mr-1 size-3.5 shrink-0" strokeWidth={1.75} />
            Sospechosa
        </Badge>
    );
}
