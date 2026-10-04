import clsx from 'clsx';
import Alert from '@/components/ui/Alert';
import BarraSegmentada from '@/components/ui/BarraSegmentada';
import Detalles from '@/components/ui/Detalles';
import { CONFIG_ASISTENCIA } from '@/lib/graficas.js';
import BarraFaltas from '../BarraFaltas';
import { avisoMateria, composicionRegistros } from '../alumno.utils.js';

// Tarjeta de materia: solo lo que decide el derecho a examen (faltas usadas, barra frente al límite y el aviso) y el botón que elige la
// materia. Las cifras por estado ya no van en cajas propias aquí: la materia elegida las muestra en casillas (StatCard, alumno/CifrasMateria)
// junto a su calendario, y el desglose de abajo trae todas las materias.
function Tarjeta({ item, seleccionada, onSeleccionar }) {
    const aviso = avisoMateria(item);
    const sinSesiones = !item.sesiones_programadas;
    const nombre = item.materia?.nombre || 'Materia';
    return (
        <li className={`rounded-xl border bg-card p-5 ${seleccionada ? 'border-primary' : 'border-border'}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                    <h3 className="font-semibold">{nombre}</h3>
                    <p className="text-sm text-muted-foreground">Grupo {item.clave_grupo} · {item.docente_nombre}</p>
                </div>
                <button
                    type="button"
                    onClick={() => onSeleccionar(item.id_grupo)}
                    aria-pressed={seleccionada}
                    className="min-h-10 rounded-md border border-border px-4 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                >
                    {seleccionada ? 'Viendo historial' : 'Ver historial'}
                </button>
            </div>
            {sinSesiones ? (
                <p className="mt-3 text-sm text-muted-foreground">Aún no hay sesiones programadas.</p>
            ) : (
                <>
                    <p className="mt-3 flex items-baseline gap-1.5">
                        <strong className="text-2xl font-semibold leading-none tabular-nums">{item.faltas_equivalentes}</strong>
                        <span className="text-sm text-muted-foreground">de {item.faltas_maximas_permitidas} faltas permitidas</span>
                    </p>
                    <BarraFaltas className="mt-2" porcentaje={item.porcentaje_faltas} limitePct={item.limite_pct} superaLimite={item.supera_limite} enLimite={item.en_limite} />
                </>
            )}
            {aviso && <Alert tone={aviso.tone} className="mt-3">{aviso.texto}</Alert>}
        </li>
    );
}

const celda = 'px-3 py-2';

// Desglose completo de todas las materias en una tabla plegada (una por materia sería un muro de números). La barra segmentada de cada
// fila resume de un vistazo la mezcla de registros resueltos; va en la última columna para no empujar las cifras exactas fuera de la
// vista en un teléfono (la tabla se desplaza dentro de su caja, no la página).
function Desglose({ items }) {
    return (
        <Detalles titulo="Desglose por materia" resumen={`${items.length} materia${items.length === 1 ? '' : 's'}`}>
            <div className="overflow-x-auto">
                <table className="w-full min-w-max text-left text-sm">
                    <thead className="text-xs text-muted-foreground">
                        <tr>
                            <th scope="col" className={`${celda} font-medium`}>Materia</th>
                            <th scope="col" className={`${celda} text-right font-medium`}>Presentes</th>
                            <th scope="col" className={`${celda} text-right font-medium`}>Retardos</th>
                            <th scope="col" className={`${celda} text-right font-medium`}>Ausencias</th>
                            <th scope="col" className={`${celda} text-right font-medium`}>Justificadas</th>
                            <th scope="col" className={`${celda} text-right font-medium`}>Pendientes</th>
                            <th scope="col" className={`${celda} text-right font-medium`}>Faltas eq.</th>
                            <th scope="col" className={`${celda} text-right font-medium`}>Te quedan</th>
                            <th scope="col" className={`${celda} font-medium`}>Distribución</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((it) => (
                            <tr key={it.id_grupo} className="border-t border-border tabular-nums">
                                <th scope="row" className={`${celda} font-medium`}>
                                    {it.materia?.nombre || 'Materia'} <span className="font-normal text-muted-foreground">· {it.clave_grupo}</span>
                                </th>
                                <td className={`${celda} text-right`}>{it.presentes}</td>
                                <td className={`${celda} text-right`}>{it.retardos}</td>
                                <td className={`${celda} text-right`}>{it.ausencias}</td>
                                <td className={`${celda} text-right`}>{it.justificadas}</td>
                                <td className={`${celda} text-right`}>{it.pendientes}</td>
                                <td className={`${celda} text-right`}>{it.faltas_equivalentes} / {it.faltas_maximas_permitidas}</td>
                                <td className={`${celda} text-right`}>{it.sesiones_programadas ? Math.max(0, it.faltas_restantes_antes_limite ?? 0) : '-'}</td>
                                <td className={`${celda} min-w-32`}>
                                    <BarraSegmentada datos={composicionRegistros(it)} config={CONFIG_ASISTENCIA} alto={8} leyenda={false} vacio="Sin registros" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Los pendientes de revisión no cuentan hasta que el docente los resuelva.</p>
        </Detalles>
    );
}

// Resumen por materia: tarjetas compactas (faltas usadas, barra y aviso) y el desglose completo plegado.
export default function ResumenMaterias({ items = [], idGrupoSeleccionado, onSeleccionar }) {
    return (
        <div className="flex flex-col gap-3">
            {/* Con una sola materia la tarjeta ocupa toda la columna (el portal ya la pone junto a las gráficas): dos columnas la dejarían a media
                columna y más angosta que el desglose de abajo. */}
            <ul className={clsx('grid grid-cols-1 gap-3', items.length > 1 && 'lg:grid-cols-2')}>
                {items.map((it) => (
                    <Tarjeta key={it.id_grupo} item={it} seleccionada={it.id_grupo === idGrupoSeleccionado} onSeleccionar={onSeleccionar} />
                ))}
            </ul>
            <Desglose items={items} />
        </div>
    );
}
