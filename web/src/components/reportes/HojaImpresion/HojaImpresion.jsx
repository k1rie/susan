import { fechaHora, porcentaje } from '../reporte.utils.js';
import { etiquetaDerecho } from '../reporte.utils.js';

// Hoja para papel/PDF: oculta en pantalla, visible al imprimir; muestra los filtros aplicados.
export default function HojaImpresion({ reporte, tipo = 'grupo', filtros = {} }) {
    if (!reporte) return null;
    const g = reporte.grupo;
    return (
        <section className="hidden print:block" aria-hidden="true">
            <h1 className="text-xl font-semibold">SUSAN · Reporte de asistencia</h1>
            <p className="text-sm">
                Periodo: {filtros.periodo || reporte.periodo || g?.periodo || '—'}
                {tipo === 'grupo' && g ? ` · Grupo: ${g.materia_nombre} ${g.clave_grupo}` : ' · Todos los grupos'}
                {filtros.alumno ? ` · Alumno: ${filtros.alumno}` : ''}
            </p>
            <p className="mb-2 text-xs">Generado: {fechaHora(reporte.generado_en)}</p>
            <table className="w-full border-collapse text-xs">
                <thead>
                    <tr>
                        {(tipo === 'periodo'
                            ? ['Grupo', 'Materia', 'Docente', 'Inscritos', 'Cerradas', 'Asist. prom.', 'Límite', 'Sin derecho']
                            : ['Matrícula', 'Alumno', 'Pres.', 'Ret.', 'Aus.', 'Just.', 'Pend.', 'Faltas eq.', '% faltas', 'Derecho']
                        ).map((c) => <th key={c} className="border border-border px-1 py-0.5 text-left">{c}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {(reporte.items || []).map((a) => (
                        <tr key={a.id_alumno ?? a.id_grupo}>
                            {(tipo === 'periodo'
                                ? [a.clave_grupo, a.materia_nombre, a.docente_nombre, a.inscritos, `${a.sesiones_cerradas}/${a.sesiones_programadas}`,
                                    a.asistencia_promedio == null ? '—' : porcentaje(a.asistencia_promedio), a.alumnos_en_limite, a.alumnos_sin_derecho]
                                : [a.matricula, a.nombre_completo, a.presentes, a.retardos, a.ausencias, a.justificadas, a.pendientes,
                                    a.faltas_equivalentes, porcentaje(a.porcentaje_faltas), etiquetaDerecho(a)]
                            ).map((v, i) => <td key={i} className="border border-border px-1 py-0.5">{v}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
    );
}
