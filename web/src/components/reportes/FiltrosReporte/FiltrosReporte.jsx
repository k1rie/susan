'use client';

import Combobox from '@/components/ui/Combobox';
import Field from '@/components/ui/Field';
import Select from '@/components/ui/Select';
import FiltrosActivos from './FiltrosActivos.jsx';
import { filtrosActivos, opcionesAlumno, opcionesGrupo } from './filtrosReporte.utils.js';

// Periodo (selector corto), grupo y alumno (con búsqueda y dos líneas por opción); una columna a 360 px. Al cambiar el periodo se limpian
// grupo y alumno. Debajo, los filtros activos con «Quitar» y «Limpiar». No hay filtro por fechas: ninguna RPC de reportes lo admite
// (api_reporte_grupo / api_reporte_periodo filtran por periodo, grupo y alumno), así que un rango de fechas aquí no filtraría nada.
export default function FiltrosReporte({ periodos = [], grupos = [], alumnos = [], valor, onCambio, deshabilitado = false }) {
    const activos = filtrosActivos({ valor, grupos, alumnos });
    const quitar = (id) => {
        const filtro = activos.find((f) => f.id === id);
        if (filtro) onCambio({ ...valor, ...filtro.quitar });
    };
    return (
        <form aria-label="Filtros del reporte" onSubmit={(e) => e.preventDefault()} className="print:hidden flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_minmax(0,1fr)]">
                <Field label="Periodo">
                    <Select
                        value={valor.periodo || ''}
                        disabled={deshabilitado}
                        onChange={(e) => onCambio({ periodo: e.target.value, idGrupo: null, idAlumno: null })}
                        options={periodos.map((p) => ({ value: p, label: p }))}
                    />
                </Field>
                <Field label="Grupo">
                    <Combobox
                        options={opcionesGrupo(grupos)}
                        value={valor.idGrupo ? String(valor.idGrupo) : ''}
                        disabled={deshabilitado}
                        onChange={(v) => onCambio({ ...valor, idGrupo: v ? Number(v) : null, idAlumno: null })}
                        placeholder="Todos los grupos"
                        emptyText="Ningún grupo coincide"
                        clearable
                    />
                </Field>
                <Field label="Alumno">
                    <Combobox
                        options={opcionesAlumno(alumnos)}
                        value={valor.idAlumno ? String(valor.idAlumno) : ''}
                        disabled={deshabilitado || !valor.idGrupo}
                        onChange={(v) => onCambio({ ...valor, idAlumno: v ? Number(v) : null })}
                        placeholder={valor.idGrupo ? 'Todos los alumnos' : 'Elige un grupo primero'}
                        emptyText="Ningún alumno coincide"
                        clearable
                    />
                </Field>
            </div>
            <FiltrosActivos filtros={activos} onQuitar={quitar} onLimpiar={() => onCambio({ periodo: valor.periodo, idGrupo: null, idAlumno: null })} disabled={deshabilitado} />
        </form>
    );
}
