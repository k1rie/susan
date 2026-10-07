import { FileCheck2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { fechaLarga, origenConsentimiento, textoDiasRestantes } from './miRegistro.utils.js';

// Resumen del consentimiento vigente y la salida para retirarlo (el alumno puede revocar cuando quiera).
export default function TarjetaConsentimiento({ consentimiento, onRevocar }) {
    return (
        <Card title="Tu consentimiento">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                    <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-tono-verde text-tono-verde-fg">
                        <FileCheck2 className="size-5" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 text-sm">
                        <p className="font-medium">Vigente hasta el {fechaLarga(consentimiento.vigencia_hasta)}</p>
                        <p className="text-muted-foreground">
                            {origenConsentimiento(consentimiento)} · {textoDiasRestantes(consentimiento.dias_restantes)}
                        </p>
                    </div>
                </div>
                <Button variant="ghost" onClick={onRevocar}>
                    Revocar consentimiento
                </Button>
            </div>
        </Card>
    );
}
