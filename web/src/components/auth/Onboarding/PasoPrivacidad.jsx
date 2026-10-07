import { ScanFace, ShieldCheck } from 'lucide-react';
import AvisoPrivacidad from '../AvisoPrivacidad/AvisoPrivacidad.jsx';
import Checkbox from '@/components/ui/Checkbox';

// Paso «Tu privacidad»: el aviso (provisional hasta la revisión jurídica) y un acuse de lectura. El acuse NO sustituye al
// consentimiento para usar el rostro: la persona alumna lo otorga aparte en «Mi registro facial» (o lo registra la coordinación).
export default function PasoPrivacidad({ aviso, onAviso, modo }) {
    return (
        <div className="flex flex-col gap-5">
            <div className="flex gap-3 rounded-xl bg-muted p-4">
                <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                <AvisoPrivacidad />
            </div>
            <div className="flex gap-3 rounded-xl border border-border p-4 text-sm">
                <ScanFace aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                <p className="text-muted-foreground">
                    Este acuse solo confirma que leíste el aviso. El <strong className="font-medium text-foreground">consentimiento para usar tu rostro</strong> se otorga aparte, en «Mi registro facial», y puedes revocarlo cuando quieras.
                </p>
            </div>
            {modo === 'activar' && (
                <Checkbox checked={aviso} onChange={(e) => onAviso(e.target.checked)} label="He leído el aviso de privacidad" />
            )}
        </div>
    );
}
