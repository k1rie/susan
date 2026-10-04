import clsx from 'clsx';
import Badge from '@/components/ui/Badge';
import BarraSegmentada from '@/components/ui/BarraSegmentada';
import { colorGrafica, CONFIG_ASISTENCIA } from '@/lib/graficas.js';
import { distribucionAsistencia } from '../graficas';
import { claseFila, etiquetaDerecho, porcentaje } from '../reporte.utils.js';
import { desgloseCorto, faltasRestantes } from './tablaReporte.utils.js';

const TONO_DERECHO = { 'Sin derecho': 'danger', 'En el límite': 'warning', 'Con derecho': 'success' };
const TH = 'px-3 py-2.5 font-medium';

// Composición de la asistencia de un alumno (presentes, retardos, ausencias, justificadas y pendientes) en una barra de segmentos sin
// leyenda: es role="img" y su aria-label trae las cifras («Presentes 5 (83 %); Ausencias 1 (17 %)») para quien usa lector de pantalla;
// el title las muestra al pasar el cursor. Con teclado o con toque no hay hover y el color solo no basta (estado = texto + color), así que
// donde se dibuja la barra va también el desglose en texto (`desgloseCorto`). Los colores se explican una sola vez en LeyendaEstados.
function Composicion({ alumno, alto, className }) {
    return <BarraSegmentada datos={distribucionAsistencia([alumno])} config={CONFIG_ASISTENCIA} alto={alto} leyenda={false} vacio="Sin registros" className={className} />;
}

// Una sola leyenda sobre la tabla (en lugar de repetirla por fila): solo los estados que aparecen en las filas mostradas. Es decorativa
// (aria-hidden) porque cada barra ya nombra sus estados en su aria-label.
function LeyendaEstados({ items }) {
    const estados = distribucionAsistencia(items).filter((d) => d.valor > 0);
    if (!estados.length) return null;
    return (
        <ul aria-hidden="true" className="flex flex-wrap gap-x-4 gap-y-1 border-b border-border px-3 py-2 text-xs text-muted-foreground">
            {estados.map((d) => (
                <li key={d.clave} className="flex items-center gap-1.5">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorGrafica(CONFIG_ASISTENCIA[d.clave].color) }} />
                    {CONFIG_ASISTENCIA[d.clave].label}
                </li>
            ))}
        </ul>
    );
}

// Tabla por alumno con lo esencial: matrícula, alumno, % de faltas, faltas equivalentes y estado. El derecho a examen va como
// texto + color (insignia y color de fila). La composición de la asistencia es una barra de segmentos: en xl tiene su columna (sustituye
// a las cinco de cifras, pero lleva debajo el desglose en texto; el desglose completo sigue en el CSV y en la hoja impresa) y en
// pantallas menores va bajo el nombre, junto con las mismas cifras resumidas, incluidas las faltas equivalentes a 360 px y las
// restantes bajo lg; sin scroll horizontal.
export default function TablaReporte({ items = [], sinSesiones = false }) {
    return (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <LeyendaEstados items={items} />
            <table className="w-full border-collapse text-sm">
                <caption className="sr-only">Asistencia acumulada por alumno</caption>
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                        <th scope="col" className={clsx(TH, 'hidden text-left sm:table-cell')}>Matrícula</th>
                        <th scope="col" className={clsx(TH, 'text-left')}>Alumno</th>
                        <th scope="col" className={clsx(TH, 'text-right')}>% faltas</th>
                        <th scope="col" className={clsx(TH, 'hidden text-right sm:table-cell')}>Faltas eq.</th>
                        <th scope="col" className={clsx(TH, 'hidden text-left xl:table-cell')}>Composición</th>
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
                                    <Composicion alumno={a} alto={6} className="mt-2 xl:hidden" />
                                </td>
                                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{sinSesiones ? '—' : porcentaje(a.porcentaje_faltas)}</td>
                                <td className="hidden px-3 py-2.5 text-right tabular-nums sm:table-cell">{a.faltas_equivalentes}</td>
                                {/* Ancho propio: una barra de ancho 100 % no aporta tamaño a la columna y una tabla automática la dejaría en 0; el texto
                                    se parte en las comas dentro de ese mismo ancho y no ensancha la columna. */}
                                <td className="hidden px-3 py-2.5 xl:table-cell">
                                    <div className="w-44">
                                        <Composicion alumno={a} alto={8} />
                                        <span className="mt-1 block text-xs text-muted-foreground">{desgloseCorto(a)}</span>
                                    </div>
                                </td>
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
