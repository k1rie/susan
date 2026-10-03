import { fmtCelda } from '../analitica.utils.js';

function TablaSimple({ columnas = [], filas = [] }) {
    return (
        <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-max border-collapse text-sm tabular-nums">
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

// Pinta un paso didáctico: título, texto, valores, tabla y/o matriz.
export default function PasoView({ paso }) {
    return (
        <div className="flex flex-col gap-2">
            {paso.titulo && <h4 className="text-sm font-semibold">{paso.titulo}</h4>}
            {paso.texto && <p className="text-sm text-muted-foreground">{paso.texto}</p>}
            {paso.valores?.length > 0 && (
                <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
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
