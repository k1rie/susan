'use client';

import clsx from 'clsx';
import { ChevronDown, CircleAlert } from 'lucide-react';
import { useId, useState } from 'react';

// Rejilla por ancho del CONTENEDOR (no de la pantalla): un panel lateral de 28 rem sigue en una columna aunque el monitor sea ancho.
const COLUMNAS = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 @md:grid-cols-2',
    3: 'grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-3',
};

// Grupo de campos con título y ayuda: <fieldset> + <legend> (los lectores de pantalla anuncian el grupo al entrar en él).
//   title / description   encabezado y una línea de ayuda (se enlaza con aria-describedby).
//   optional              agrega «(opcional)» al título (convención de SUSAN: se rotula lo opcional, no lo obligatorio).
//   columns               1 | 2 | 3, según el ancho disponible del contenedor; en 360 px siempre una. Un campo ancho usa `@md:col-span-2`.
//   collapsible           el título pasa a ser un botón que pliega el contenido (que sigue montado: no se pierde lo capturado).
//   defaultOpen           estado inicial si es plegable (true por omisión).
//   summary               texto bajo el título mientras está plegada («Lun y Mié 08:00-10:00»).
//   error                 hay un error dentro: marca «Revisar» y abre la sección al aparecer, para que el foco al primer error alcance el campo.
export default function FormSection({ title, description, optional = false, columns = 1, collapsible = false, defaultOpen = true, summary, error = false, children, className }) {
    const id = useId();
    const [abierto, setAbierto] = useState(defaultOpen);
    const [errorAntes, setErrorAntes] = useState(error);
    if (error !== errorAntes) {
        setErrorAntes(error);
        if (error) setAbierto(true);
    }
    const visible = !collapsible || abierto;
    const descId = description ? `${id}-desc` : undefined;
    const contenidoId = `${id}-contenido`;

    const encabezado = (
        <>
            <span className="text-[15px] font-semibold tracking-tight">{title}</span>
            {optional && <span className="ml-1.5 text-[13px] font-normal text-muted-foreground">(opcional)</span>}
        </>
    );

    return (
        <fieldset aria-describedby={descId} className={clsx('m-0 min-w-0 border-0 p-0', className)}>
            <legend className="mb-3 w-full p-0">
                {collapsible ? (
                    <button
                        type="button"
                        aria-expanded={abierto}
                        aria-controls={contenidoId}
                        onClick={() => setAbierto((v) => !v)}
                        className="-mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-md px-2 text-left transition-colors duration-150 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                    >
                        <span className="min-w-0">
                            <span className="block">{encabezado}</span>
                            {!abierto && summary && <span className="mt-0.5 block truncate text-[13px] font-normal text-muted-foreground">{summary}</span>}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                            {error && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-ausente-bg px-2 py-0.5 text-xs font-medium text-ausente">
                                    <CircleAlert aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
                                    Revisar
                                </span>
                            )}
                            <ChevronDown aria-hidden="true" className={clsx('size-4 text-muted-foreground transition-transform duration-200', abierto && 'rotate-180')} strokeWidth={1.75} />
                        </span>
                    </button>
                ) : (
                    encabezado
                )}
            </legend>
            {description && (
                <p id={descId} className="-mt-2 mb-3 text-[13px] text-muted-foreground">
                    {description}
                </p>
            )}
            <div id={contenidoId} hidden={!visible} className="@container">
                <div className={clsx('grid gap-x-4 gap-y-4', COLUMNAS[columns] || COLUMNAS[1])}>{children}</div>
            </div>
        </fieldset>
    );
}
