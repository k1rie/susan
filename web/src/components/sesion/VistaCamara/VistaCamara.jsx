import clsx from 'clsx';
import { FlaskConical, LoaderCircle, Pause, ScanFace, ScanSearch, TimerOff } from 'lucide-react';
import MarcosRostros from '@/components/ui/MarcosRostros';
import { textoDeteccion } from '@/components/ui/DeteccionRostros';

// Estado del reconocimiento en la vista de la cámara: texto + icono (nunca solo color).
const ESTADOS = {
    reconociendo: { etiqueta: 'Reconociendo', icono: ScanFace, latido: true },
    pausa: { etiqueta: 'En pausa', icono: Pause },
    fuera: { etiqueta: 'Fuera de la ventana', icono: TimerOff },
};

const CHIP = 'inline-flex max-w-full items-center gap-1.5 rounded-full bg-foreground/80 px-2.5 py-1 text-xs font-medium text-primary-foreground backdrop-blur-sm';

// Chip de detección en vivo (bajo el de estado): dice cuántos rostros ve la cámara ahora. Es independiente del chip de estado:
// «Reconociendo» habla del muestreo hacia el servidor (cada varios segundos); este habla de lo que se ve en este instante.
function iconoDeteccion({ estado, cantidad }) {
    if (estado === 'cargando') return { Icono: LoaderCircle, girar: true };
    if (estado === 'listo' && cantidad > 0) return { Icono: ScanFace };
    return { Icono: ScanSearch };
}

// Marco de la vista de cámara del pase de lista: lo que se ve (video real o el lienzo de la cámara simulada) con chips superpuestos.
//   estado         = reconociendo | pausa | fuera: el chip de arriba a la izquierda (se anuncia al cambiar: role="status")
//   etiquetaFuente = «Cámara frente» (arriba a la derecha) · simulada = la fuente es la cámara simulada (se dice con icono y texto)
//   enmarcar       = true: `children` va dentro de una caja 16:9 con esquinas redondeadas (lienzo, aviso); false: `children` ya trae su propia
//                    caja (CameraCapture, que CapturaContinua fuerza a 16:9) y aquí solo se le superponen los chips.
//   deteccion      = { estado: 'cargando' | 'listo' | 'no-disponible' | 'inactivo', cantidad } -> chip bajo el de estado; null/'inactivo' = sin chip
//   marcos         = recuadros en fracciones (0..1) para dibujar sobre `children` (solo con enmarcar: la cámara real los dibuja ella misma,
//                    porque es quien conoce el recorte y el espejo del video)
// Los chips no reciben clics (pointer-events-none): no tapan los controles del video.
export default function VistaCamara({ estado = 'pausa', etiquetaFuente, simulada = false, enmarcar = false, deteccion = null, marcos, children, className }) {
    const { etiqueta, icono: Icono, latido } = ESTADOS[estado] ?? ESTADOS.pausa;
    const verDeteccion = deteccion != null && deteccion.estado !== 'inactivo';
    const { Icono: IconoDeteccion, girar } = verDeteccion ? iconoDeteccion(deteccion) : {};
    return (
        <div className={clsx('relative', className)}>
            {enmarcar ? (
                <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-foreground">
                    {children}
                    {marcos?.length > 0 && <MarcosRostros marcos={marcos} />}
                </div>
            ) : (
                children
            )}
            <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col items-start gap-1.5">
                    <span role="status" data-estado={estado} className={CHIP}>
                        <Icono aria-hidden="true" strokeWidth={1.75} className={clsx('size-3.5 shrink-0', latido && 'motion-safe:animate-pulse')} />
                        {etiqueta}
                    </span>
                    {verDeteccion && (
                        <span data-deteccion={deteccion.estado} data-rostros={deteccion.cantidad ?? 0} className={CHIP}>
                            <IconoDeteccion aria-hidden="true" strokeWidth={1.75} className={clsx('size-3.5 shrink-0', girar && 'motion-safe:animate-spin')} />
                            {textoDeteccion(deteccion)}
                        </span>
                    )}
                </div>
                {(simulada || etiquetaFuente) && (
                    <span className={clsx(CHIP, 'truncate')}>
                        {simulada && <FlaskConical aria-hidden="true" strokeWidth={1.75} className="size-3.5 shrink-0" />}
                        <span className="truncate">{simulada ? 'Cámara simulada' : etiquetaFuente}</span>
                    </span>
                )}
            </div>
        </div>
    );
}
