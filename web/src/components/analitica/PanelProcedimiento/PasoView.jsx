'use client';

import clsx from 'clsx';
import { useId, useState } from 'react';
import { dividirTexto, fmtCelda } from '../analitica.utils.js';

function TablaSimple({ columnas = [], filas = [] }) {
    return (
        <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-max border-collapse text-xs tabular-nums">
                <thead className="bg-muted text-muted-foreground">
                    <tr>
                        {columnas.map((c, i) => (
                            <th key={i} scope="col" className="px-3 py-1.5 text-left font-medium">{c}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {filas.map((f, i) => (
                        <tr key={i} className="border-t border-border">
                            {f.map((v, j) => (
                                <td key={j} className="px-3 py-1">{fmtCelda(v)}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// Texto del paso: la primera frase a la vista y el resto tras "Más". El resto se oculta con CLASES y no con el atributo
// `hidden`: el preflight de Tailwind fija `[hidden] { display: none !important }` y ninguna utilidad (ni `print:inline`)
// le gana, así que el texto plegado desaparecería al imprimir o exportar a PDF.
export function TextoPaso({ texto }) {
    const { corto, resto } = dividirTexto(texto);
    const [mas, setMas] = useState(false);
    const id = useId();
    return (
        <p className="text-xs text-muted-foreground">
            {corto}
            {resto && (
                <>
                    <span id={id} className={clsx(!mas && 'hidden print:inline')}> {resto}</span>{' '}
                    <button type="button" aria-expanded={mas} aria-controls={id} onClick={() => setMas((m) => !m)} className="text-link underline print:hidden">
                        {mas ? 'Menos' : 'Más'}
                    </button>
                </>
            )}
        </p>
    );
}

// Pinta un paso didáctico: título, texto, valores, tabla y/o matriz.
export default function PasoView({ paso }) {
    return (
        <div className="flex flex-col gap-2">
            {paso.titulo && <h4 className="text-sm font-medium">{paso.titulo}</h4>}
            {paso.texto && <TextoPaso texto={paso.texto} />}
            {paso.valores?.length > 0 && (
                <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-[max-content_1fr]">
                    {paso.valores.map((v, i) => (
                        <div key={i} className="contents">
                            <dt className="text-muted-foreground">{v.etiqueta}</dt>
                            <dd className="break-words tabular-nums">{fmtCelda(v.valor)}</dd>
                        </div>
                    ))}
                </dl>
            )}
            {paso.tabla && <TablaSimple columnas={paso.tabla.columnas} filas={paso.tabla.filas} />}
            {paso.matriz && (
                <TablaSimple
                    columnas={(paso.matriz[0] || []).map((_, j) => `c${j + 1}`)}
                    filas={paso.matriz}
                />
            )}
        </div>
    );
}
