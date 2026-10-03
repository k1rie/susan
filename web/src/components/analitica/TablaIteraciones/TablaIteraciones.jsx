import { columnasTraza, fmtCelda } from '../analitica.utils.js';

// Traza de un método iterativo (bisección, Newton...): columnas = claves del primer elemento.
export default function TablaIteraciones({ traza = [], caption }) {
    const columnas = columnasTraza(traza);
    if (columnas.length === 0) return <p className="text-sm text-muted-foreground">Sin iteraciones registradas.</p>;
    return (
        <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-max border-collapse text-sm tabular-nums">
                {caption && <caption className="px-3 py-2 text-left text-xs text-muted-foreground">{caption}</caption>}
                <thead className="bg-muted text-muted-foreground">
                    <tr>
                        {columnas.map((c) => (
                            <th key={c.key} scope="col" className="px-3 py-1.5 text-right font-medium">{c.header}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {traza.map((fila, i) => (
                        <tr key={i} className="border-t border-border">
                            {columnas.map((c) => (
                                <td key={c.key} className="px-3 py-1 text-right">{fmtCelda(fila[c.key])}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
