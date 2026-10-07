'use client';

import Combobox from '@/components/ui/Combobox';
import Field from '@/components/ui/Field';
import Input from '@/components/ui/Input';
import { LIMITES } from '@/lib/formularios/limites.js';
import { CLAVE_RE, PERIODO_RE } from './grupoForm.utils.js';

// Campos del grupo que comparten el alta (asistente) y la edición (pestaña Datos). Cada uno recibe el `f` de useFormulario.

// Combobox de un catálogo (materia, docente, aula) con su error pegado al campo. El «blur» del Combobox marca el campo como tocado para
// que el error aparezca al salir de él (el Combobox no expone onBlur, por eso se escucha en un contenedor sin caja propia).
export function CampoCatalogo({ f, nombre, label, catalogo, comboProps, placeholder, hint, disabled = false, selected, onElegir, emptyText }) {
    const c = f.campo(nombre);
    const props = comboProps ?? catalogo.comboProps;
    return (
        <div onBlur={c.onBlur} data-campo={nombre} className="contents">
            <Field label={label} required error={c.error} hint={hint}>
                <Combobox
                    {...props}
                    value={c.value}
                    selected={selected}
                    invalid={c.invalid}
                    disabled={disabled || catalogo.cargando}
                    placeholder={catalogo.cargando ? 'Cargando…' : placeholder}
                    emptyText={emptyText}
                    onChange={(valor, opcion) => {
                        c.onChange(valor);
                        onElegir?.(nombre, opcion);
                    }}
                />
            </Field>
        </div>
    );
}

export function CampoClave({ f }) {
    const c = f.campo('clave_grupo');
    const valida = CLAVE_RE.test(String(c.value).trim().toUpperCase());
    return (
        <Field label="Clave del grupo" required error={c.error} hint="Hasta 8 caracteres; se guarda en mayúsculas." example="3A" valid={valida && !c.error} reserveError>
            <Input {...c.props} maxLength={LIMITES.clave_grupo} showCount transform="upper" autoComplete="off" autoCapitalize="characters" placeholder="3A" />
        </Field>
    );
}

export function CampoPeriodo({ f, sugerido }) {
    const c = f.campo('periodo');
    const valido = PERIODO_RE.test(String(c.value).trim());
    const sugerir = sugerido && String(c.value).trim() !== sugerido;
    return (
        <Field
            label="Periodo"
            required
            error={c.error}
            hint="Formato AAAA-S, donde S es el semestre (1 o 2)."
            example={sugerido || '2026-2'}
            valid={valido && !c.error}
            reserveError
            labelAction={
                sugerir ? (
                    <button type="button" onClick={() => f.setCampo('periodo', sugerido)} className="rounded-sm text-link underline focus-visible:ring-4 focus-visible:ring-ring/30 focus-visible:outline-none">
                        Usar {sugerido}
                    </button>
                ) : undefined
            }
        >
            <Input {...c.props} maxLength={LIMITES.periodo} showCount autoComplete="off" placeholder={sugerido || '2026-2'} />
        </Field>
    );
}
