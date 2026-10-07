import clsx from 'clsx';
import { CircleCheck, CircleDashed } from 'lucide-react';

// Qué tiene y qué le falta a este alumno, de un vistazo; cada elemento salta a su tarjeta más abajo. Siempre texto + icono + color.
export default function ResumenFicha({ items }) {
    return (
        <nav aria-label="Estado de la ficha">
            <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {items.map((i) => {
                    const Icono = i.ok ? CircleCheck : CircleDashed;
                    return (
                        <li key={i.id}>
                            <a
                                href={i.href}
                                className="flex h-full items-start gap-2.5 rounded-xl border border-border bg-card p-3 transition-colors duration-150 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                            >
                                <Icono aria-hidden="true" className={clsx('mt-0.5 size-[18px] shrink-0', i.ok ? 'text-presente' : 'text-muted-foreground')} strokeWidth={1.75} />
                                <span className="min-w-0">
                                    <span className="block text-[13px] text-muted-foreground">{i.etiqueta}</span>
                                    <span className="block text-sm font-medium">{i.texto}</span>
                                </span>
                            </a>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
