import clsx from 'clsx';
import { iniciales, tinteDe } from './avatar.utils.js';

const TAMANOS = { sm: 'size-7 text-[11px]', md: 'size-9 text-xs', lg: 'size-14 text-lg' };

// Avatar de iniciales en círculo de color sólido con texto blanco (como los "SL"/"AS" de Dash). Decorativo por defecto:
// el nombre ya aparece como texto; con `label` se anuncia a lectores de pantalla. `tinte` fuerza el color (preferencia de perfil).
export default function Avatar({ nombre, size = 'md', label, tinte, className, style, ...rest }) {
    const color = tinte || tinteDe(nombre);
    return (
        <span
            role={label ? 'img' : undefined}
            aria-label={label}
            aria-hidden={label ? undefined : 'true'}
            className={clsx('inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white', TAMANOS[size] || TAMANOS.md, className)}
            style={{ background: color, ...style }}
            {...rest}
        >
            {iniciales(nombre)}
        </span>
    );
}
