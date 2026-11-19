import { Ban } from 'lucide-react';
import Button from '@/components/ui/Button';
import DatosSolicitud from '../DatosSolicitud';
import { esCancelable } from '../laboratoriosAdmin.utils.js';
import { etiquetaComentario, lineaResolucion } from './historialSolicitudes.utils.js';

// Tarjeta de una solicitud ya resuelta: sus datos, quién la resolvió y el comentario. Una aprobada que aún no inicia ofrece «Cancelar».
export default function FilaHistorial({ solicitud, hoy, ahora, onCancelar }) {
    return (
        <article
            aria-label={`Solicitud de ${solicitud.aula?.clave}, ${solicitud.estatus}`}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:p-5"
        >
            <DatosSolicitud solicitud={solicitud} hoy={hoy} />
            <div className="flex flex-col gap-1 border-t border-border pt-3 text-sm">
                <p className="text-muted-foreground">{lineaResolucion(solicitud, hoy)}</p>
                {solicitud.comentario && (
                    <p className="break-words">
                        <span className="font-medium">{etiquetaComentario(solicitud.estatus)}:</span> {solicitud.comentario}
                    </p>
                )}
            </div>
            {esCancelable(solicitud, ahora) && (
                <div>
                    <Button variant="secondary" size="sm" icon={<Ban aria-hidden="true" className="size-4" strokeWidth={1.75} />} onClick={() => onCancelar(solicitud)}>
                        Cancelar aprobación
                    </Button>
                </div>
            )}
        </article>
    );
}
