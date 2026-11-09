'use client';

import clsx from 'clsx';
import { Sparkles } from 'lucide-react';
import { useEffect, useRef } from 'react';
import Alert from '@/components/ui/Alert';
import Spinner from '@/components/ui/Spinner';
import usePrefersReducedMotion from '@/lib/motion/usePrefersReducedMotion.js';

// Cuerpo del panel del asistente: aviso si no está configurado, sugerencias de inicio y la conversación (role="log": los lectores de
// pantalla anuncian lo nuevo). Las respuestas son texto plano con saltos de línea: no se interpreta Markdown ni HTML.
export default function ConversacionAsistente({ mensajes, estado, consultando, sugerencias = [], disponible = true, onSugerencia }) {
    const fin = useRef(null);
    const reducir = usePrefersReducedMotion();
    const ultimoTexto = mensajes.at(-1)?.texto;

    useEffect(() => {
        fin.current?.scrollIntoView?.({ block: 'end', behavior: reducir ? 'auto' : 'smooth' });
    }, [mensajes.length, ultimoTexto, consultando, reducir]);

    if (!disponible) {
        return (
            <Alert tone="warning" title="Asistente no disponible">
                Falta configurar la clave de la Claude API en el servidor. Avisa al administrador del sistema; mientras tanto, consulta tus
                datos en Reportes y Analítica.
            </Alert>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {mensajes.length === 0 && (
                <section aria-labelledby="asistente-sugerencias" className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                        Pregunta sobre la asistencia de tus grupos. Respondo con tus datos reales; no cambio nada.
                    </p>
                    <h3 id="asistente-sugerencias" className="text-[13px] font-medium text-muted-foreground">
                        Prueba con
                    </h3>
                    <ul className="flex flex-col gap-2">
                        {sugerencias.map((s) => (
                            <li key={s}>
                                <button
                                    type="button"
                                    onClick={() => onSugerencia?.(s)}
                                    className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-left text-sm transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                                >
                                    {s}
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <ol role="log" aria-live="polite" aria-label="Conversación con el asistente" className="flex flex-col gap-3">
                {mensajes.map((m) => {
                    const delUsuario = m.rol === 'usuario';
                    if (!delUsuario && !m.texto) return null;
                    return (
                        <li key={m.id} className={clsx('flex', delUsuario ? 'justify-end' : 'justify-start gap-2')}>
                            {!delUsuario && <Sparkles aria-hidden="true" className="mt-1 size-4 shrink-0 text-brand-gold" strokeWidth={1.75} />}
                            <p
                                className={clsx(
                                    'min-w-0 whitespace-pre-wrap break-words text-sm',
                                    delUsuario && 'max-w-[85%] rounded-xl bg-muted px-3 py-2',
                                    m.error && 'text-destructive',
                                )}
                            >
                                <span className="sr-only">{delUsuario ? 'Tú: ' : 'Asistente: '}</span>
                                {m.texto}
                            </p>
                        </li>
                    );
                })}
            </ol>

            {estado === 'pensando' || consultando ? (
                <p role="status" className="flex items-center gap-2 text-[13px] text-muted-foreground">
                    <Spinner size="sm" label="" role="presentation" aria-hidden="true" />
                    {consultando ?? 'Pensando…'}
                </p>
            ) : null}
            <div ref={fin} />
        </div>
    );
}
