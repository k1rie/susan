'use client';

import Field from '@/components/ui/Field';
import Select from '@/components/ui/Select';

// Periodo y grupo. Al cambiar el periodo se limpia el grupo.
export default function SelectorGrupo({ periodos = [], grupos = [], valor, onCambio, deshabilitado = false }) {
    const opcionesGrupo = [
        { value: '', label: 'Elige un grupo', disabled: true },
        ...grupos.map((g) => ({ value: String(g.id_grupo), label: `${g.materia_nombre} · ${g.clave_grupo}` })),
    ];
    return (
        <form
            aria-label="Selección de grupo a analizar"
            onSubmit={(e) => e.preventDefault()}
            className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2"
        >
            <Field label="Periodo">
                <Select
                    value={valor.periodo || ''}
                    disabled={deshabilitado}
                    onChange={(e) => onCambio({ periodo: e.target.value, idGrupo: null })}
                    options={periodos.map((p) => ({ value: p, label: p }))}
                />
            </Field>
            <Field label="Grupo">
                <Select
                    value={valor.idGrupo ? String(valor.idGrupo) : ''}
                    disabled={deshabilitado}
                    onChange={(e) => onCambio({ ...valor, idGrupo: e.target.value ? Number(e.target.value) : null })}
                    options={opcionesGrupo}
                />
            </Field>
        </form>
    );
}
