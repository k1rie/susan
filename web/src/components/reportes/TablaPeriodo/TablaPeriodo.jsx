import { porcentaje } from '../reporte.utils.js';

// Vista del periodo: una fila por grupo; al pulsar el nombre se abre el reporte del grupo.
export default function TablaPeriodo({ items = [], onAbrirGrupo }) {
    return (
        <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-soft">
            <table className="w-full min-w-max border-collapse text-sm">
                <caption className="sr-only">Resumen por grupo del periodo</caption>
                <thead className="bg-muted text-muted-foreground">
                    <tr>
                        {['Grupo', 'Materia', 'Docente', 'Inscritos', 'Sesiones cerradas', 'Asistencia promedio', 'En el límite', 'Sin derecho'].map((c, i) => (
                            <th key={c} scope="col" className={`px-3 py-2 font-medium ${i < 3 ? 'text-left' : 'text-right'}`}>{c}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {items.map((g) => (
                        <tr key={g.id_grupo} className="border-t border-border">
                            <td className="px-3 py-1">
                                <button type="button" onClick={() => onAbrirGrupo(g.id_grupo)} className="min-h-11 font-medium text-primary underline">
                                    {g.clave_grupo}
                                </button>
                            </td>
                            <td className="px-3 py-2">{g.materia_nombre}</td>
                            <td className="px-3 py-2">{g.docente_nombre}</td>
                            <td className="px-3 py-2 text-right">{g.inscritos}</td>
                            <td className="px-3 py-2 text-right">{g.sesiones_cerradas} / {g.sesiones_programadas}</td>
                            <td className="px-3 py-2 text-right">{g.asistencia_promedio == null ? '—' : porcentaje(g.asistencia_promedio)}</td>
                            <td className="px-3 py-2 text-right">{g.alumnos_en_limite}</td>
                            <td className="px-3 py-2 text-right">{g.alumnos_sin_derecho}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
