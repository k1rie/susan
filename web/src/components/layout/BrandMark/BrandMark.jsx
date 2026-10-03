import clsx from 'clsx';
import Image from 'next/image';

// Espacio fijo de logotipo: escudo UNACH + nombre en la serif de marca; en "full" añade subtítulo y escudo de la FCA.
// width/height fijos reservan el espacio y evitan saltos de layout.
export default function BrandMark({ variant = 'full', showFca, className }) {
    const completo = variant === 'full';
    const mostrarFca = showFca ?? completo;
    return (
        <div className={clsx('flex items-center gap-2.5', className)}>
            <Image src="/brand/unach-escudo.png" alt="Escudo de la UNACH" width={40} height={40} className="h-9 w-9 object-contain" />
            <div className="leading-none">
                <p className="font-display text-[1.7rem] tracking-wide">SUSAN</p>
                {completo && <p className="mt-1 text-xs text-muted-foreground">Registro de asistencia</p>}
            </div>
            {mostrarFca && (
                <Image src="/brand/fca-escudo.png" alt="Escudo de la FCA C-I" width={40} height={40} className="h-9 w-9 object-contain" />
            )}
        </div>
    );
}
