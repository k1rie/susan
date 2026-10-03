import Alert from '@/components/ui/Alert';
import BarraFaltas from '../BarraFaltas';
import { avisoMateria } from '../alumno.utils.js';

function Tarjeta({ item, seleccionada, onSeleccionar }) {
    const aviso = avisoMateria(item);
    const sinSesiones = !item.sesiones_programadas;
    const nombre = item.materia?.nombre || 'Materia';
    return (
        <li className={`rounded-3xl border bg-card p-5 shadow-soft ${seleccionada ? 'border-primary' : 'border-border'}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                    <h3 className="font-semibold">{nombre}</h3>
                    <p className="text-sm text-muted-foreground">Grupo {item.clave_grupo} · {item.docente_nombre}</p>
                </div>
                <button
                    type="button"
                    onClick={() => onSeleccionar(item.id_grupo)}
                    aria-pressed={seleccionada}
                    className="min-h-11 rounded-full border border-border px-4 text-sm font-medium hover:bg-muted"
                >
                    {seleccionada ? 'Viendo historial' : 'Ver historial'}
                </button>
            </div>
            <div className="mt-3">
                {sinSesiones ? (
                    <p className="text-sm text-muted-foreground">Aún no hay sesiones programadas: el porcentaje se calculará al generar el horario.</p>
                ) : (
                    <BarraFaltas porcentaje={item.porcentaje_faltas} limitePct={item.limite_pct} superaLimite={item.supera_limite} enLimite={item.en_limite} />
                )}
            </div>
            <p className="mt-2 text-sm">
                Faltas equivalentes: <strong>{item.faltas_equivalentes}</strong> de {item.faltas_maximas_permitidas} permitidas
                {!sinSesiones && <> · te quedan <strong>{Math.max(0, item.faltas_restantes_antes_limite ?? 0)}</strong></>}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
                Presentes {item.presentes} · Retardos {item.retardos} · Ausencias {item.ausencias} · Justificadas {item.justificadas} · Pendientes {item.pendientes}
            </p>
            {aviso && <Alert tone={aviso.tone} className="mt-3">{aviso.texto}</Alert>}
        </li>
    );
}

// Resumen por materia. Los registros pendientes de revisión no cuentan (nota fija, Tabla 44).
export default function ResumenMaterias({ items = [], idGrupoSeleccionado, onSeleccionar }) {
    return (
        <div>
            <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {items.map((it) => (
                    <Tarjeta key={it.id_grupo} item={it} seleccionada={it.id_grupo === idGrupoSeleccionado} onSeleccionar={onSeleccionar} />
                ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">Los registros pendientes de revisión no cuentan hasta que el docente los resuelva.</p>
        </div>
    );
}
