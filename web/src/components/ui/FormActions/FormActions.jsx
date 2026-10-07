import clsx from 'clsx';
import { Info } from 'lucide-react';
import { ALINEACION, PEGADO, textoCambios } from './formActions.utils.js';

// Barra de acciones de un formulario (referencias de Mobbin: pie fijo de fal y Square, barra «cambios sin guardar» de Shopify y DoorDash,
// motivo del bloqueo junto al botón de Customer.io). Los botones van como hijos; en el teléfono se reparten el ancho.
//
//   dirty          booleano o número de cambios (`useFormulario().cambios`): muestra «Cambios sin guardar» / «3 cambios sin guardar».
//   dirtyText      texto propio para el indicador.
//   summary        qué va a pasar al confirmar («Se inscribirán 3 alumnos»); a la izquierda.
//   motivoBloqueo  por qué no se puede guardar (el primer error); se escribe junto al botón en vez de dejarlo apagado sin explicar.
//   sticky         'movil' (por omisión) | 'contenedor' | false; ver formActions.utils.js. OJO: `sticky` solo se pega mientras ningún ancestro
//                  entre la barra y quien desplaza sea un contenedor de scroll propio (`overflow-x: hidden` en `html, body` lo era; ahora
//                  son `clip`). Dentro de `AppShell` (el panel desplaza) siempre funciona; ver PRIMITIVAS-contenedores.md.
//   flat           sin borde, relleno ni pegado: para el pie de un Modal o PanelLateral, que ya es fijo.
//   align          'end' (por omisión) | 'start' | 'center' | 'between'.
//   stacked        apila el estado (resumen, «N cambios sin guardar», motivo) SOBRE los botones, que se reparten el ancho, en cualquier
//                  ancho de pantalla: para pies estrechos (tarjetas de ~290 px, paneles de 28 rem) donde estado y botones no caben en fila.
//                  Sin `stacked`, en pantallas ≥ 640 px la fila ya se parte sola (los botones pasan debajo) cuando el estado quedaría en
//                  menos de 10 rem.
// La zona de estado es una región aria-live fija: los cambios de texto (el motivo que aparece o desaparece) se anuncian.
export default function FormActions({
    children,
    dirty = false,
    dirtyText,
    summary,
    motivoBloqueo,
    sticky = 'movil',
    flat = false,
    align = 'end',
    stacked = false,
    className,
    ...rest
}) {
    const textoSucio = textoCambios(dirty, dirtyText);
    const hayEstado = Boolean(summary || textoSucio || motivoBloqueo);
    const pegado = flat ? null : sticky === 'contenedor' ? PEGADO.contenedor : sticky === 'movil' ? PEGADO.movil : PEGADO.ninguno;

    return (
        <div
            className={clsx(
                'flex w-full flex-col gap-3',
                // `sm:flex-wrap` + el ancho mínimo del estado: si estado y botones no caben juntos, los botones bajan en vez de dejar el
                // texto en una columna de 80 px.
                !stacked && ['sm:flex-row sm:flex-wrap sm:items-center', ALINEACION[align] || ALINEACION.end],
                pegado,
                className,
            )}
            {...rest}
        >
            <div
                aria-live="polite"
                className={clsx(hayEstado ? clsx('flex min-w-0 flex-col gap-0.5 whitespace-normal break-words text-sm', !stacked && 'sm:min-w-40 sm:flex-1') : 'sr-only')}
            >
                {summary && <div className="text-foreground">{summary}</div>}
                {textoSucio && (
                    <p className="flex items-start gap-1.5 text-[13px] font-medium text-foreground">
                        <span aria-hidden="true" className="mt-[0.4rem] size-2 shrink-0 rounded-full bg-retardo" />
                        <span className="min-w-0 text-balance">{textoSucio}</span>
                    </p>
                )}
                {motivoBloqueo && (
                    <p className="flex items-start gap-1.5 text-[13px] text-muted-foreground">
                        <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
                        <span className="min-w-0">{motivoBloqueo}</span>
                    </p>
                )}
            </div>
            <div className={clsx('flex flex-wrap items-center justify-end gap-2 [&>*]:flex-1', !stacked && 'sm:[&>*]:flex-none')}>{children}</div>
        </div>
    );
}
