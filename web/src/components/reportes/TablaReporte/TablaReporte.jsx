import { claseFila, etiquetaDerecho, porcentaje } from '../reporte.utils.js';

const COLS = ['Matrícula', 'Alumno', 'Presentes', 'Retardos', 'Ausencias', 'Justificadas', 'Pendientes', 'Faltas eq.', '% faltas', 'Restantes', 'Derecho a examen'];

// Tabla por alumno. El derecho a examen va como texto (+ color de fila); scroll horizontal en pantallas angostas.
export default function TablaReporte({ items = [], sinSesiones = false }) {
    return (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full min-w-max border-collapse text-sm">
                <caption className="sr-only">Asistencia acumulada por alumno</caption>
                <thead className="bg-surface-muted text-muted">
                    <tr>
                        {COLS.map((c, i) => (
                            <th key={c} scope="col" className={`px-3 py-2 font-medium ${i < 2 || i === 10 ? 'text-left' : 'text-right'}`}>{c}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {items.map((a) => (
                        <tr key={a.id_alumno} className={`border-t border-border ${claseFila(a)}`}>
                            <td className="px-3 py-2 font-mono">{a.matricula}</td>
                            <td className="px-3 py-2">{a.nombre_completo}</td>
                            <td className="px-3 py-2 text-right">{a.presentes}</td>
                            <td className="px-3 py-2 text-right">{a.retardos}</td>
                            <td className="px-3 py-2 text-right">{a.ausencias}</td>
                            <td className="px-3 py-2 text-right">{a.justificadas}</td>
                            <td className="px-3 py-2 text-right">{a.pendientes}</td>
                            <td className="px-3 py-2 text-right">{a.faltas_equivalentes}</td>
                            <td className="px-3 py-2 text-right">{sinSesiones ? '—' : porcentaje(a.porcentaje_faltas)}</td>
                            <td className="px-3 py-2 text-right">{a.faltas_restantes_antes_limite ?? '—'}</td>
                            <td className="px-3 py-2 font-medium">{etiquetaDerecho(a)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
