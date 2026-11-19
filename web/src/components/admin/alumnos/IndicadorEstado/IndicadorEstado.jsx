import { CircleCheck, CircleDashed } from 'lucide-react';
import Badge from '@/components/ui/Badge';

// Indicador con texto, icono y color (nunca solo color): ok -> verde con palomita, falso -> gris/ámbar según `tone`, con círculo
// punteado («pendiente»).
export default function IndicadorEstado({ ok, textoOk, textoNo, toneNo = 'neutral' }) {
    const Icono = ok ? CircleCheck : CircleDashed;
    return (
        <Badge tone={ok ? 'success' : toneNo} className="gap-1">
            <Icono aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
            {ok ? textoOk : textoNo}
        </Badge>
    );
}
