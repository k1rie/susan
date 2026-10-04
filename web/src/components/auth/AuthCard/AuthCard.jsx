import BrandMark from '@/components/layout/BrandMark/BrandMark.jsx';
import BlurText from '@/components/motion/BlurText';
import Resaltado from '@/components/home/Resaltado';
import PanelProducto from '../PanelProducto';

// Contenedor de las pantallas públicas (pantalla dividida, patrón de SchoolAI): a la izquierda marca, titular y
// formulario; a la derecha (>= 1024 px) un panel que muestra el producto en movimiento. Debajo de 1024 px solo queda
// la columna del formulario.
//   title      titular (serif); `resaltar` = palabra del titular que lleva el subrayado dorado
export default function AuthCard({ title, resaltar, subtitle, children, footer }) {
    const i = resaltar ? title.indexOf(resaltar) : -1;
    const antes = i >= 0 ? title.slice(0, i).trim() : title;
    const despues = i >= 0 ? title.slice(i + resaltar.length).trim() : '';

    return (
        <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-6 lg:p-5">
            <div className="flex min-h-dvh flex-col px-5 py-6 sm:px-10 lg:min-h-0 lg:px-8 lg:py-4">
                <BrandMark variant="full" />
                <main className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center gap-7 py-10">
                    <div>
                        <h1 className="flex flex-wrap items-baseline gap-x-3 font-display text-[2.6rem] leading-[1.05] tracking-tight sm:text-5xl">
                            {antes && <BlurText as="span" text={antes} delay={70} />}
                            {i >= 0 && <Resaltado>{resaltar}</Resaltado>}
                            {despues && <BlurText as="span" text={despues} delay={70} />}
                        </h1>
                        {subtitle && <p className="mt-3 text-base text-muted-foreground">{subtitle}</p>}
                    </div>
                    <div>{children}</div>
                    {footer && <div className="text-sm text-muted-foreground">{footer}</div>}
                </main>
            </div>
            <PanelProducto />
        </div>
    );
}
