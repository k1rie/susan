import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { CONTROL_BASE, CONTROL_INVALIDO } from '../Input/Input.jsx';
import { repartirClases } from './select.utils.js';

const Opcion = ({ o }) => (
    <option value={o.value} disabled={o.disabled}>
        {o.label}
    </option>
);

// Select nativo (conserva el selector del sistema operativo, lo mejor en teléfonos) con el mismo aspecto en todas las
// plataformas: appearance-none + chevron de Lucide. Con placeholder agrega una primera opción vacía deshabilitada.
//   options -> [{ value, label, disabled? }]      groups -> [{ label, options: [...] }] (<optgroup>), tras las options sueltas
//   Para listas largas o con identidad (alumnos, materias…) usa ui/Combobox.
export default function Select({ options, groups, placeholder, invalid, children, className, ...rest }) {
    const borde = invalid || rest['aria-invalid'] ? CONTROL_INVALIDO : 'border-input';
    const controlado = rest.value !== undefined;
    const { envoltura, control } = repartirClases(className);
    // Un <select multiple> (o con size > 1) es una lista, no un desplegable: no lleva chevron.
    const esLista = Boolean(rest.multiple) || Number(rest.size) > 1;
    return (
        <div className={clsx('relative w-full', envoltura)}>
            <select
                className={clsx(CONTROL_BASE, 'peer', !esLista && 'appearance-none pr-9', borde, control)}
                {...(placeholder && !controlado && rest.defaultValue === undefined ? { defaultValue: '' } : {})}
                aria-invalid={invalid ? true : undefined}
                {...rest}
            >
                {placeholder && (
                    <option value="" disabled>
                        {placeholder}
                    </option>
                )}
                {options ? options.map((o) => <Opcion key={o.value} o={o} />) : children}
                {groups?.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                        {g.options.map((o) => (
                            <Opcion key={o.value} o={o} />
                        ))}
                    </optgroup>
                ))}
            </select>
            {!esLista && (
                <ChevronDown
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground peer-disabled:opacity-50"
                    strokeWidth={1.75}
                />
            )}
        </div>
    );
}
