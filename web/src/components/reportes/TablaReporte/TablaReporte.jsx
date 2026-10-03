import clsx from 'clsx';
import Badge from '@/components/ui/Badge';
import { claseFila, etiquetaDerecho, porcentaje } from '../reporte.utils.js';
import { desgloseCorto, faltasRestantes } from './tablaReporte.utils.js';

const TONO_DERECHO = { 'Sin derecho': 'danger', 'En el límite': 'warning', 'Con derecho': 'success' };
const TH = 'px-3 py-2.5 font-medium';
// Columnas secundarias: solo en pantallas amplias (el desglose completo también va en el CSV y en la hoja impresa).
const DESGLOSE = [['Presentes', 'presentes'], ['Retardos', 'retardos'], ['Ausencias', 'ausencias'], ['Justificadas', 'justificadas'], ['Pendientes', 'pendientes']];

// Tabla por alumno con lo esencial: matrícula, alumno, % de faltas, faltas equivalentes y estado. El derecho a examen va como
// texto + color (insignia y color de fila). Mientras las columnas del desglose no caben (menos de xl) las mismas cifras van
// resumidas bajo el nombre, incluidas las faltas equivalentes a 360 px y las restantes bajo lg; sin scroll horizontal.
export default function TablaReporte({ items = [], sinSesiones = false }) {
    return (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full border-collapse text-sm">
                <caption className="sr-only">Asistencia acumulada por alumno</caption>
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                        <th scope="col" className={clsx(TH, 'hidden text-left sm:table-cell')}>Matrícula</th>
                        <th scope="col" className={clsx(TH, 'text-left')}>Alumno</th>
                        <th scope="col" className={clsx(TH, 'text-right')}>% faltas</th>
                        <th scope="col" className={clsx(TH, 'hidden text-right sm:table-cell')}>Faltas eq.</th>
                        {DESGLOSE.map(([c]) => <th key={c} scope="col" className={clsx(TH, 'hidden text-right xl:table-cell')}>{c}</th>)}
                        <th scope="col" className={clsx(TH, 'hidden text-right lg:table-cell')}>Restantes</th>
                        <th scope="col" className={clsx(TH, 'text-left')}>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((a) => {
                        const derecho = etiquetaDerecho(a);
                        const restantes = faltasRestantes(a);
                        return (
                            <tr key={a.id_alumno} className={clsx('border-t border-border', claseFila(a))}>
                                <td className="hidden px-3 py-2.5 font-mono sm:table-cell">{a.matricula}</td>
                                <td className="px-3 py-2.5">
                                    <span className="block">{a.nombre_completo}</span>
                                    <span className="block text-xs text-muted-foreground xl:hidden">
                                        <span className="sm:hidden">{a.matricula} · </span>
                                        {desgloseCorto(a)}
                                        <span className="sm:hidden">{' '}<span className="whitespace-nowrap">· faltas eq.&nbsp;{a.faltas_equivalentes}</span></span>
                                        {restantes !== null && <span className="hidden sm:inline lg:hidden">{' '}<span className="whitespace-nowrap">· {restantes}&nbsp;faltas restantes</span></span>}
                                    </span>
                                </td>
                                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{sinSesiones ? '—' : porcentaje(a.porcentaje_faltas)}</td>
                                <td className="hidden px-3 py-2.5 text-right tabular-nums sm:table-cell">{a.faltas_equivalentes}</td>
                                {DESGLOSE.map(([c, campo]) => <td key={c} className="hidden px-3 py-2.5 text-right tabular-nums xl:table-cell">{a[campo]}</td>)}
                                <td className="hidden px-3 py-2.5 text-right tabular-nums lg:table-cell">{a.faltas_restantes_antes_limite ?? '—'}</td>
                                <td className="px-3 py-2.5"><Badge tone={TONO_DERECHO[derecho]} className="whitespace-nowrap">{derecho}</Badge></td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
