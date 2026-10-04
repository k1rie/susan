import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Une clases condicionales (clsx) y resuelve conflictos de Tailwind (twMerge). Solo para components/shadcn: en el resto de la app se usa clsx. */
export function cn(...entradas) {
    return twMerge(clsx(entradas));
}
