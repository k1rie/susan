import clsx from 'clsx';

const TAMANOS = { sm: 'h-4 w-4 border-2', md: 'h-6 w-6 border-2', lg: 'h-10 w-10 border-4' };

// Indicador de carga; el texto accesible va en sr-only para lectores de pantalla.
export default function Spinner({ size = 'md', label = 'Cargando', className, ...rest }) {
    return (
        <span role="status" className={clsx('inline-flex items-center', className)} {...rest}>
            <span
                aria-hidden="true"
                className={clsx('inline-block animate-spin rounded-full border-current border-t-transparent', TAMANOS[size] || TAMANOS.md)}
            />
            <span className="sr-only">{label}</span>
        </span>
    );
}
