import clsx from 'clsx';
import { CalendarDays, Flame } from 'lucide-react';
import CalendarioAsistencia from '@/components/ui/CalendarioAsistencia';
import Detalles from '@/components/ui/Detalles';
import EmptyState from '@/components/ui/EmptyState';
import TarjetaGrafica from '@/components/ui/TarjetaGrafica';
import {
    NOTA_RACHA,
    SEMANAS_CALENDARIO,
    anchoMaximoCalendario,
    datosCalendario,
    descripcionCalendario,
    resumenCalendario,
    textoMejorRacha,
    textoRacha,
} from './calendarioRacha.utils.js';

// La racha es la pieza destacada de la tarjeta (como la «Listening Streak» de Mobbin): llama grande en dorado de marca mientras dura
// y gris cuando no hay racha activa. El dorado es el de la marca, no un color de estado: «retardo» (ámbar) significaría otra cosa.
function PiezaRacha({ actual, mejor }) {
    const activa = actual > 0;
    const textoMejor = textoMejorRacha(mejor);
    return (
        <span data-racha={actual} className={clsx('flex items-center gap-2.5 rounded-xl px-3 py-2', activa ? 'bg-brand-gold-soft' : 'bg-muted')}>
            <Flame aria-hidden="true" strokeWidth={1.75} className={clsx('size-6 shrink-0', activa ? 'text-brand-gold' : 'text-muted-foreground')} />
            <span className="flex flex-col">
                <span className="text-sm font-semibold leading-tight text-foreground">{textoRacha(actual)}</span>
                {textoMejor && <span className="mt-0.5 text-xs leading-tight text-muted-foreground">{textoMejor}</span>}
            </span>
        </span>
    );
}

// Calendario de asistencia de la materia elegida: una casilla por sesión (últimas 26 semanas), coloreada por su estado, y la racha en
// las acciones de la tarjeta. Va entre las casillas de cifras y el historial por sesión.
//   items = los de `api_alumno_historial` ({ fecha, estado | null, estatus_sesion }); materia = nombre, solo para el texto alternativo
export default function CalendarioRacha({ items = [], materia, className }) {
    const datos = datosCalendario(items);
    return (
        <TarjetaGrafica
            className={className}
            titulo="Calendario de asistencia"
            descripcion={descripcionCalendario(datos)}
            acciones={!datos.vacio && <PiezaRacha actual={datos.racha.actual} mejor={datos.racha.mejor} />}
            resumen={resumenCalendario({ materia, ...datos })}
            pie={!datos.vacio && (
                <Detalles plano titulo="Cómo se cuenta la racha">
                    <p>{NOTA_RACHA}</p>
                </Detalles>
            )}
        >
            {datos.vacio ? (
                <EmptyState
                    className="py-6"
                    icon={<CalendarDays strokeWidth={1.75} className="size-5" />}
                    title="Tu calendario empieza con la primera clase"
                    description="Cuando haya sesiones en esta materia verás aquí cada una con su estado y tu racha de asistencia."
                />
            ) : (
                // etiqueta="" porque el resumen de la tarjeta ya dice lo mismo (estados y racha): sin esto el lector lo leería dos veces.
                // El tope de ancho evita casillas gigantes en pantallas anchas con pocas semanas de historial.
                <div style={{ maxWidth: anchoMaximoCalendario(datos.semanas) }}>
                    <CalendarioAsistencia sesiones={items} maxSemanas={SEMANAS_CALENDARIO} etiqueta="" />
                </div>
            )}
        </TarjetaGrafica>
    );
}
