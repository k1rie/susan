import clsx from 'clsx';
import Image from 'next/image';

// Espacio fijo de logotipo: escudo UNACH + nombre; en "full" añade subtítulo y escudo de la FCA.
// width/height fijos reservan el espacio y evitan saltos de layout.
export default function BrandMark({ variant = 'full', showFca, className }) {
    const completo = variant === 'full';
    const mostrarFca = showFca ?? completo;
    return (
        <div className={clsx('flex items-center gap-2', className)}>
            <Image src="/brand/unach-escudo.png" alt="Escudo de la UNACH" width={40} height={40} className="h-10 w-10 object-contain" />
            <div className="leading-tight">
                <p className="text-lg font-bold tracking-wide">SUSAN</p>
                {completo && <p className="text-xs text-muted">Registro de asistencia</p>}
            </div>
            {mostrarFca && (
                <Image src="/brand/fca-escudo.png" alt="Escudo de la FCA C-I" width={40} height={40} className="h-10 w-10 object-contain" />
            )}
        </div>
    );
}
