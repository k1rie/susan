import clsx from 'clsx';
import { LineChart } from 'lucide-react';
import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import { porcentaje } from '../reporte.utils.js';

const TH = 'px-3 py-2.5 font-medium';

// Situación de riesgo en texto + color: nunca solo color.
function Riesgo({ g }) {
    const limite = Number(g.alumnos_en_limite) || 0;
    const sin = Number(g.alumnos_sin_derecho) || 0;
    if (!limite && !sin) return <Badge tone="success">Sin alertas</Badge>;
    return (
        <span className="flex flex-wrap gap-1">
            {sin > 0 && <Badge tone="danger">{sin} sin derecho</Badge>}
            {limite > 0 && <Badge tone="warning">{limite} en el límite</Badge>}
        </span>
    );
}

// Vista del periodo: una fila por grupo; el nombre abre el reporte del grupo y el icono su analítica.
// Se pinta con su propia tabla (no con ui/Table, cuya anchura mínima es la del contenido y obliga a desplazarla a 360 px): en
// pantallas angostas la materia y el riesgo van bajo la clave del grupo; inscritos y sesiones aparecen desde md y el docente tiene su
// propia columna desde xl (con el riel lateral abierto, a 1024 px el contenido mide menos que a 768 px y el nombre del docente se
// partiría en dos líneas). Entre sm y xl, mientras esa columna no cabe, el docente baja bajo la materia para no desaparecer.
// El detalle completo va en el CSV y en la hoja impresa. Así quedan visibles la asistencia y el acceso a la analítica sin scroll.
// Los objetivos táctiles miden 44 px (como el resto del sistema); el margen negativo evita que la fila crezca por ellos.
export default function TablaPeriodo({ items = [], onAbrirGrupo }) {
    return (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full border-collapse text-sm">
                <caption className="sr-only">Resumen por grupo del periodo</caption>
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                        <th scope="col" className={clsx(TH, 'text-left')}>Grupo</th>
                        <th scope="col" className={clsx(TH, 'hidden text-left sm:table-cell')}>Materia</th>
                        <th scope="col" className={clsx(TH, 'hidden text-left xl:table-cell')}>Docente</th>
                        <th scope="col" className={clsx(TH, 'hidden text-right md:table-cell')}>Inscritos</th>
                        <th scope="col" className={clsx(TH, 'hidden text-right md:table-cell')}>Sesiones cerradas</th>
                        <th scope="col" className={clsx(TH, 'text-right')}>Asistencia</th>
                        <th scope="col" className={clsx(TH, 'hidden text-left sm:table-cell')}>Alumnos en riesgo</th>
                        <th scope="col" className={clsx(TH, 'text-right')}><span className="sr-only">Analítica</span></th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((g) => (
                        <tr key={g.id_grupo} className="border-t border-border">
                            <td className="px-3 py-2.5">
                                <button type="button" onClick={() => onAbrirGrupo(g.id_grupo)} className="-my-2 inline-flex min-h-11 items-center rounded-md font-medium text-link underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30">
                                    {g.clave_grupo}
                                </button>
                                {/* Solo en pantallas angostas: desde sm la materia y el riesgo tienen su propia columna. */}
                                <span className="block break-words text-xs text-muted-foreground sm:hidden">{g.materia_nombre}</span>
                                <span className="mt-1.5 block sm:hidden"><Riesgo g={g} /></span>
                            </td>
                            <td className="hidden px-3 py-2.5 sm:table-cell">
                                {g.materia_nombre}
                                {/* Solo entre sm y xl: desde xl el docente tiene su columna y no se repite. */}
                                <span className="block break-words text-xs text-muted-foreground xl:hidden">{g.docente_nombre}</span>
                            </td>
                            <td className="hidden px-3 py-2.5 xl:table-cell">{g.docente_nombre}</td>
                            <td className="hidden px-3 py-2.5 text-right tabular-nums md:table-cell">{g.inscritos}</td>
                            <td className="hidden whitespace-nowrap px-3 py-2.5 text-right tabular-nums md:table-cell">{g.sesiones_cerradas} / {g.sesiones_programadas}</td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{g.asistencia_promedio == null ? '—' : porcentaje(g.asistencia_promedio)}</td>
                            <td className="hidden px-3 py-2.5 sm:table-cell"><Riesgo g={g} /></td>
                            <td className="px-3 py-2.5 text-right">
                                <Link href={`/analitica?grupo=${g.id_grupo}`} aria-label={`Ver analítica del grupo ${g.clave_grupo}`}
                                    className="-my-2 inline-flex size-11 items-center justify-center rounded-md text-link hover:bg-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30">
                                    <LineChart aria-hidden="true" className="size-4" strokeWidth={1.75} />
                                </Link>
                            </td>
                        </tr>
                    ))}
                    {items.length === 0 && (
                        <tr>
                            <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Sin resultados</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
