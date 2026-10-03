import { CircleCheck } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/layout/PageHeader';

const COLOR = { azul: 'var(--primary)', dorado: 'var(--brand-gold)', verde: 'var(--presente)', violeta: 'var(--chart-5)' };

// Página de un módulo de la hoja de ruta (/modulos/[id] con estado 'pronto'): qué es, qué incluirá y cómo volver.
// Componente de servidor: recibe la entrada del registro completa (con su icono).
export default function ModuloProximamente({ modulo }) {
    const { titulo, descripcion, icono: Icono, tono, queIncluye = [] } = modulo;
    const color = COLOR[tono] || COLOR.azul;
    return (
        <div>
            <PageHeader title={titulo} subtitle={descripcion} backHref="/modulos" backLabel="Todos los módulos" />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <div
                    className="textura-grano relative flex min-h-56 items-center justify-center overflow-hidden rounded-3xl border border-border shadow-soft"
                    style={{ background: `linear-gradient(135deg, color-mix(in oklab, ${color} 10%, var(--card)), color-mix(in oklab, ${color} 36%, var(--card)))` }}
                >
                    <Icono aria-hidden="true" className="size-24" strokeWidth={1.2} style={{ color }} />
                    <Badge tone="gold" className="absolute left-4 top-4 bg-card/90">Pronto</Badge>
                </div>
                <section aria-labelledby="que-incluira" className="rounded-3xl border border-border bg-card p-6 shadow-soft">
                    <h2 id="que-incluira" className="text-lg font-semibold tracking-tight">Qué incluirá</h2>
                    <ul className="mt-3 flex flex-col gap-2.5">
                        {queIncluye.map((punto) => (
                            <li key={punto} className="flex items-start gap-3 text-sm">
                                <CircleCheck aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-brand-gold" strokeWidth={1.75} />
                                <span>{punto}</span>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-5 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                        Esta función todavía no está disponible. Cuando llegue aparecerá aquí y en tu menú, sin cambiar la forma en que ya usas SUSAN.
                    </p>
                    <div className="mt-5">
                        <Button href="/" variant="secondary" arrow>Volver al inicio</Button>
                    </div>
                </section>
            </div>
        </div>
    );
}
