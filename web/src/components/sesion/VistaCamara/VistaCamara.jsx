import clsx from 'clsx';
import { FlaskConical, Pause, ScanFace, TimerOff } from 'lucide-react';

// Estado del reconocimiento en la vista de la cámara: texto + icono (nunca solo color).
const ESTADOS = {
    reconociendo: { etiqueta: 'Reconociendo', icono: ScanFace, latido: true },
    pausa: { etiqueta: 'En pausa', icono: Pause },
    fuera: { etiqueta: 'Fuera de la ventana', icono: TimerOff },
};

const CHIP = 'inline-flex max-w-full items-center gap-1.5 rounded-full bg-foreground/80 px-2.5 py-1 text-xs font-medium text-primary-foreground backdrop-blur-sm';

// Marco de la vista de cámara del pase de lista: lo que se ve (video real o el lienzo de la cámara simulada) con chips superpuestos.
//   estado         = reconociendo | pausa | fuera: el chip de arriba a la izquierda (se anuncia al cambiar: role="status")
//   etiquetaFuente = «Cámara frente» (arriba a la derecha) · simulada = la fuente es la cámara simulada (se dice con icono y texto)
//   enmarcar       = true: `children` va dentro de una caja 16:9 con esquinas redondeadas (lienzo, aviso); false: `children` ya trae su propia
//                    caja (CameraCapture, que CapturaContinua fuerza a 16:9) y aquí solo se le superponen los chips.
// Los chips no reciben clics (pointer-events-none): no tapan los controles del video.
export default function VistaCamara({ estado = 'pausa', etiquetaFuente, simulada = false, enmarcar = false, children, className }) {
    const { etiqueta, icono: Icono, latido } = ESTADOS[estado] ?? ESTADOS.pausa;
    return (
        <div className={clsx('relative', className)}>
            {enmarcar ? <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-foreground">{children}</div> : children}
            <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                <span role="status" data-estado={estado} className={CHIP}>
                    <Icono aria-hidden="true" strokeWidth={1.75} className={clsx('size-3.5 shrink-0', latido && 'motion-safe:animate-pulse')} />
                    {etiqueta}
                </span>
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
