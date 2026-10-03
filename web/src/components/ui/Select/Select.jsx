import clsx from 'clsx';
import { CONTROL_BASE } from '../Input/Input.jsx';

// Select nativo; con placeholder agrega una primera opción vacía deshabilitada.
export default function Select({ options, placeholder, invalid, children, className, ...rest }) {
    const borde = invalid || rest['aria-invalid'] ? 'border-danger' : 'border-border';
    const controlado = rest.value !== undefined;
    return (
        <select
            className={clsx(CONTROL_BASE, borde, className)}
            {...(placeholder && !controlado && rest.defaultValue === undefined ? { defaultValue: '' } : {})}
            {...rest}
        >
            {placeholder && (
                <option value="" disabled>
                    {placeholder}
                </option>
            )}
            {options
                ? options.map((o) => (
                      <option key={o.value} value={o.value} disabled={o.disabled}>
                          {o.label}
                      </option>
                  ))
                : children}
        </select>
    );
}
