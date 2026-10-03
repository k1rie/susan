import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { SpotlightCard } from '@/components/motion';
import Badge from '@/components/ui/Badge';
import clsx from 'clsx';

// Color base de la ilustración por tono: siempre derivado de tokens (sigue el tema).
const TONO = {
    azul: 'var(--primary)',
    dorado: 'var(--brand-gold)',
    verde: 'var(--presente)',
    violeta: 'var(--chart-5)',
};

// Tarjeta de módulo (componente firma): zona de ilustración duotono con grano y un icono grande, título,
// descripción de dos líneas y pie ("Abrir" con flecha circular, o la insignia "Pronto"). Es un único enlace:
// activos van a su pantalla; los próximos a /modulos/[id], que explica qué traerán.
export default function ModuloCard({ modulo, className }) {
    const { id, titulo, descripcion, icono: Icono, tono, estado, href } = modulo;
    const pronto = estado === 'pronto';
    const destino = pronto ? `/modulos/${id}` : href;
    const color = TONO[tono] || TONO.azul;

    return (
        <SpotlightCard className={clsx('h-full rounded-3xl', className)}>
            <Link
                href={destino}
                data-modulo={id}
                className="group/mod flex h-full flex-col gap-3 p-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40"
            >
                <div
                    className={clsx('textura-grano relative flex h-28 items-center justify-center overflow-hidden rounded-2xl', pronto && 'opacity-80')}
                    style={{ background: `linear-gradient(135deg, color-mix(in oklab, ${color} 10%, var(--card)), color-mix(in oklab, ${color} 34%, var(--card)))` }}
                >
                    <Icono aria-hidden="true" className="size-12 transition-transform duration-500 group-hover/mod:scale-110 group-hover/mod:-rotate-3" strokeWidth={1.4} style={{ color }} />
                    {pronto && <Badge tone="gold" className="absolute right-2.5 top-2.5 bg-card/90">Pronto</Badge>}
                </div>
                <div className="flex flex-1 flex-col gap-1 px-1.5">
                    <h3 className="text-[15px] font-semibold tracking-tight">{titulo}</h3>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{descripcion}</p>
                </div>
                <div className="flex items-center justify-between px-1.5 pb-1.5 pt-1 text-sm font-medium">
                    <span className={pronto ? 'text-muted-foreground' : 'text-primary'}>{pronto ? 'Ver qué traerá' : 'Abrir'}</span>
                    <span
                        aria-hidden="true"
                        className="flex size-7 items-center justify-center rounded-full bg-accent text-accent-foreground transition-transform duration-200 group-hover/mod:translate-x-0.5"
                    >
                        <ArrowRight className="size-4" strokeWidth={1.75} />
                    </span>
                </div>
            </Link>
        </SpotlightCard>
    );
}
