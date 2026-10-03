'use client';

import Field from '@/components/ui/Field';
import Select from '@/components/ui/Select';

// Tres selectores (periodo, grupo, alumno). Al cambiar el periodo se limpian grupo y alumno.
// Una sola columna a 360 px.
export default function FiltrosReporte({ periodos = [], grupos = [], alumnos = [], valor, onCambio, deshabilitado = false }) {
    const opcionesGrupo = [
        { value: '', label: 'Todos los grupos del periodo' },
        ...grupos.map((g) => ({ value: String(g.id_grupo), label: `${g.materia_nombre} · ${g.clave_grupo}` })),
    ];
    const opcionesAlumno = [
        { value: '', label: 'Todos los alumnos' },
        ...alumnos.map((a) => ({ value: String(a.idAlumno), label: a.nombreCompleto })),
    ];
    return (
        <form
            aria-label="Filtros del reporte"
            onSubmit={(e) => e.preventDefault()}
            className="print:hidden grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-3"
        >
            <Field label="Periodo">
                <Select
                    value={valor.periodo || ''}
                    disabled={deshabilitado}
                    onChange={(e) => onCambio({ periodo: e.target.value, idGrupo: null, idAlumno: null })}
                    options={periodos.map((p) => ({ value: p, label: p }))}
                />
            </Field>
            <Field label="Grupo">
                <Select
                    value={valor.idGrupo ? String(valor.idGrupo) : ''}
                    disabled={deshabilitado}
                    onChange={(e) => onCambio({ ...valor, idGrupo: e.target.value ? Number(e.target.value) : null, idAlumno: null })}
                    options={opcionesGrupo}
                />
            </Field>
            <Field label="Alumno" hint={valor.idGrupo ? undefined : 'Elige un grupo para filtrar por alumno.'}>
                <Select
                    value={valor.idAlumno ? String(valor.idAlumno) : ''}
                    disabled={deshabilitado || !valor.idGrupo}
                    onChange={(e) => onCambio({ ...valor, idAlumno: e.target.value ? Number(e.target.value) : null })}
                    options={opcionesAlumno}
                />
            </Field>
        </form>
    );
}
