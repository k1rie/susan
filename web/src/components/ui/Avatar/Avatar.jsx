import clsx from 'clsx';
import { iniciales, tinteDe } from './avatar.utils.js';

const TAMANOS = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg' };

// Avatar de iniciales (sin fotos de rostros en pantallas de trabajo). Decorativo por defecto: el nombre ya aparece
// como texto; con `label` se anuncia a lectores de pantalla.
export default function Avatar({ nombre, size = 'md', label, className, ...rest }) {
    const color = tinteDe(nombre);
    return (
        <span
            role={label ? 'img' : undefined}
            aria-label={label}
            aria-hidden={label ? undefined : 'true'}
            className={clsx('inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold', TAMANOS[size] || TAMANOS.md, className)}
            style={{ color, background: `color-mix(in oklab, ${color} 14%, var(--card))`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 22%, transparent)` }}
            {...rest}
        >
            {iniciales(nombre)}
        </span>
    );
}
