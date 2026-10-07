import clsx from 'clsx';
import { Glasses, ScanFace, ShieldCheck, SunMedium } from 'lucide-react';
import Button from '@/components/ui/Button';
import { TOTAL_PASOS } from '../CapturaGuiadaPlantilla/capturaGuiada.utils.js';
import AnilloRostro from './AnilloRostro.jsx';
import { Cuerpo, Pie } from './Estructura.jsx';

const CONSEJOS = [
    { Icono: SunMedium, fondo: 'bg-tono-dorado', trazo: 'text-tono-dorado-fg', titulo: 'Busca buena luz', detalle: 'De frente a una ventana o lámpara, sin contraluz.' },
    { Icono: Glasses, fondo: 'bg-tono-azul', trazo: 'text-tono-azul-fg', titulo: 'Rostro descubierto', detalle: 'Sin gorra, cubrebocas ni lentes oscuros.' },
    { Icono: ShieldCheck, fondo: 'bg-tono-verde', trazo: 'text-tono-verde-fg', titulo: 'Tu privacidad', detalle: 'Las fotos solo sirven para crear la plantilla facial.' },
];

// Portada: qué se va a hacer y cómo prepararse, antes de abrir la cámara (el permiso se pide hasta el primer paso).
export default function PantallaIntro({ nombreAlumno, propio = false, onComenzar, onSubirFotos }) {
    return (
        <>
            <Cuerpo>
                <div className="flex flex-col items-center gap-5 py-2 text-center">
                    <AnilloRostro estado="hecho" entrada tamano="w-[min(44vw,20dvh,10rem)]">
                        <div className="flex size-full items-center justify-center bg-tono-azul text-tono-azul-fg">
                            <ScanFace aria-hidden="true" className="size-1/2" strokeWidth={1.25} />
                        </div>
                    </AnilloRostro>
                    <div className="flex flex-col gap-1.5">
                        <h2 className="text-2xl font-semibold tracking-tight">Registra el rostro en {TOTAL_PASOS} tomas</h2>
                        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                            {propio ? (
                                'Mírate en la cámara y sigue las indicaciones.'
                            ) : (
                                <>
                                    {nombreAlumno ? <span className="font-medium text-foreground">{nombreAlumno}</span> : 'La persona'} se mira en la
                                    cámara y sigue las indicaciones.
                                </>
                            )}{' '}
                            La cámara toma cada foto sola cuando todo está bien; no hay que pulsar nada.
                        </p>
                    </div>
                    <ul className="flex w-full flex-col gap-2 text-left">
                        {CONSEJOS.map(({ Icono, fondo, trazo, titulo, detalle }) => (
                            <li key={titulo} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                                <span className={clsx('flex size-10 shrink-0 items-center justify-center rounded-lg', fondo)}>
                                    <Icono aria-hidden="true" className={clsx('size-5', trazo)} strokeWidth={1.75} />
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-[14.5px] leading-tight font-medium">{titulo}</span>
                                    <span className="mt-0.5 block text-[13px] text-muted-foreground">{detalle}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </Cuerpo>
            <Pie>
                <Button size="lg" fullWidth onClick={onComenzar}>
                    Comenzar
                </Button>
                {onSubirFotos && (
                    <Button variant="ghost" fullWidth onClick={onSubirFotos}>
                        Subir fotos en lugar de usar la cámara
                    </Button>
                )}
            </Pie>
        </>
    );
}
