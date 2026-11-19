import { Camera, ScanFace } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { TOTAL_PASOS } from '@/components/admin/alumnos/CapturaGuiadaPlantilla/capturaGuiada.utils.js';
import { registrosRestantes } from './miRegistro.utils.js';

// Paso 2: con el consentimiento vigente, el alumno toma su propio rostro con la cámara de su dispositivo (sin subir archivos).
export default function PasoRostro({ registro, onRegistrar }) {
    const sinCupo = registrosRestantes(registro) === 0;
    return (
        <Card title="Registra tu rostro">
            <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                    <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-tono-azul text-tono-azul-fg">
                        <ScanFace className="size-5" strokeWidth={1.75} />
                    </span>
                    <p className="text-sm text-muted-foreground">
                        Son {TOTAL_PASOS} tomas guiadas con la cámara de tu dispositivo y tardan cerca de un minuto. Hazlo tú, en un lugar con buena luz y
                        sin cubrebocas, gorra ni lentes oscuros. No se pueden subir fotos: el rostro se toma en el momento.
                    </p>
                </div>
                {sinCupo && (
                    <Alert tone="warning" title="Llegaste al límite de hoy">
                        Puedes registrar tu rostro {registro.limite_registros_24h} veces al día. Inténtalo mañana o acude a tu coordinación.
                    </Alert>
                )}
                <div className="flex justify-end">
                    <Button onClick={onRegistrar} disabled={sinCupo} icon={<Camera aria-hidden="true" className="size-4" strokeWidth={1.75} />}>
                        Registrar mi rostro
                    </Button>
                </div>
            </div>
        </Card>
    );
}
