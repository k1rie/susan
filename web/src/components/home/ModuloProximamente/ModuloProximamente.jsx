import { CircleCheck, Lock } from 'lucide-react';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/layout/PageHeader';

// Página de un módulo de la hoja de ruta (/modulos/[id] con estado 'pronto'): qué es, qué incluirá y cómo volver.
// Componente de servidor: recibe la entrada del registro completa (con su icono).
export default function ModuloProximamente({ modulo }) {
    const { titulo, descripcion, icono: Icono, tono, queIncluye = [] } = modulo;
    return (
        <div>
            <PageHeader title={titulo} subtitle={descripcion} backHref="/modulos" backLabel="Todos los módulos" />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <div className="relative flex min-h-56 items-center justify-center rounded-xl border border-border" style={{ background: `var(--tono-${tono})` }}>
                    <span className="flex size-20 items-center justify-center rounded-2xl border border-black/5 bg-card shadow-[0_1px_2px_rgba(30,25,25,0.08)]">
                        <Icono aria-hidden="true" className="size-9" strokeWidth={1.5} style={{ color: `var(--tono-${tono}-fg)` }} />
                    </span>
                    <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                        <Lock aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
                        Próximamente
                    </span>
                </div>
                <section aria-labelledby="que-incluira" className="rounded-xl border border-border bg-card p-6">
                    <h2 id="que-incluira" className="text-lg font-semibold tracking-tight">Qué incluirá</h2>
                    <ul className="mt-3 flex flex-col gap-2.5">
                        {queIncluye.map((punto) => (
                            <li key={punto} className="flex items-start gap-3 text-sm">
                                <CircleCheck aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-brand-gold" strokeWidth={1.5} />
                                <span>{punto}</span>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-5 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
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
