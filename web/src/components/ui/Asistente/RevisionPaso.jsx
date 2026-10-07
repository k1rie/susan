import clsx from 'clsx';
import { Pencil } from 'lucide-react';
import Button from '../Button/Button.jsx';
import { textoValor } from './asistente.utils.js';

function Filas({ filas, compacto = false }) {
    if (filas.length === 0) return <p className="text-sm text-muted-foreground">Sin datos todavía.</p>;
    return (
        <dl className={clsx('flex flex-col', compacto ? 'gap-1.5' : 'gap-2.5')}>
            {filas.map((f, i) => {
                const valor = textoValor(f.valor);
                return (
                    <div key={`${f.etiqueta}-${i}`} className={clsx('flex flex-col gap-0.5', !compacto && 'sm:flex-row sm:gap-4')}>
                        <dt className={clsx('text-[13px] text-muted-foreground', !compacto && 'sm:w-40 sm:shrink-0')}>{f.etiqueta}</dt>
                        <dd className={clsx('min-w-0 break-words text-sm', valor == null && 'text-muted-foreground')}>{valor ?? 'Sin especificar'}</dd>
                    </div>
                );
            })}
        </dl>
    );
}

// Paso final: una tarjeta por sección con su «Editar», que vuelve al paso exacto donde se capturó (referencia: la revisión de Stripe).
export function Revision({ secciones, onEditar }) {
    return (
        <div className="flex flex-col gap-3">
            {secciones.map((s) => (
                <section key={s.id} aria-label={s.titulo} className="rounded-xl border border-border bg-card">
                    <header className="flex items-center justify-between gap-2 px-4 pt-3">
                        <h3 className="text-sm font-semibold">{s.titulo}</h3>
                        {s.paso && (
                            <Button variant="ghost" size="sm" aria-label={`Editar ${s.titulo}`} onClick={() => onEditar(s.paso)} icon={<Pencil aria-hidden="true" className="size-3.5" strokeWidth={1.75} />}>
                                Editar
                            </Button>
                        )}
                    </header>
                    <div className="px-4 pt-2 pb-4">
                        <Filas filas={s.filas} />
                    </div>
                </section>
            ))}
        </div>
    );
}

// Resumen vivo junto al formulario (solo pantallas anchas): se llena mientras se captura.
export function ResumenLateral({ secciones }) {
    return (
        <aside aria-label="Resumen" className="hidden lg:block">
            <div className="sticky top-4 flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold">Resumen</h3>
                {secciones.map((s) => (
                    <div key={s.id} className="flex flex-col gap-1.5">
                        <p className="text-xs font-medium text-muted-foreground">{s.titulo}</p>
                        <Filas filas={s.filas} compacto />
                    </div>
                ))}
            </div>
        </aside>
    );
}
