import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Une clases condicionales (clsx) y resuelve conflictos de Tailwind (twMerge). Lo usan los componentes de shadcn y los propios. */
export function cn(...entradas) {
    return twMerge(clsx(entradas));
}
