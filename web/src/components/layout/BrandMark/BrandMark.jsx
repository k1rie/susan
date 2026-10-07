import clsx from 'clsx';

// Marca: «SUSAN» en la grotesca de la interfaz (peso 600, como «Dash»); en "full" añade el subtítulo.
export default function BrandMark({ variant = 'full', className }) {
    const completo = variant === 'full';
    return (
        <div className={clsx('leading-none', className)}>
            <p className="text-[22px] font-semibold tracking-tight">SUSAN</p>
            {completo && <p className="mt-1 text-xs text-muted-foreground">Registro de asistencia</p>}
        </div>
    );
}
