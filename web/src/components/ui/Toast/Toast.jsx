'use client';

import clsx from 'clsx';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const MAX_VISIBLES = 3;
const TONOS = {
    info: 'border-info/40',
    success: 'border-success/40',
    warning: 'border-warning/50',
    danger: 'border-destructive/40',
};

const ToastContext = createContext(null);

// Sin proveedor el hook no rompe la pantalla: simplemente no muestra nada.
const SIN_PROVEEDOR = { toast: () => null, dismiss: () => {} };

export function useToast() {
    return useContext(ToastContext) ?? SIN_PROVEEDOR;
}

// Región aria-live fija abajo. Máximo 3 visibles; los errores duran el doble antes de cerrarse solos.
export function ToastProvider({ children }) {
    const [items, setItems] = useState([]);
    const timers = useRef(new Map());
    const contador = useRef(0);

    const dismiss = useCallback((id) => {
        clearTimeout(timers.current.get(id));
        timers.current.delete(id);
        setItems((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const toast = useCallback(
        ({ tone = 'info', title, message, durationMs = 5000 }) => {
            contador.current += 1;
            const id = contador.current;
            setItems((prev) => {
                const siguiente = [...prev, { id, tone, title, message }];
                // Los más antiguos se descartan; también se cancela su temporizador.
                while (siguiente.length > MAX_VISIBLES) {
                    const viejo = siguiente.shift();
                    clearTimeout(timers.current.get(viejo.id));
                    timers.current.delete(viejo.id);
                }
                return siguiente;
            });
            const espera = tone === 'danger' ? durationMs * 2 : durationMs;
            timers.current.set(id, setTimeout(() => dismiss(id), espera));
            return id;
        },
        [dismiss],
    );

    useEffect(() => {
        const mapa = timers.current;
        return () => mapa.forEach((t) => clearTimeout(t));
    }, []);

    const valor = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

    return (
        <ToastContext.Provider value={valor}>
            {children}
            <div
                aria-live="polite"
                className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2 md:left-auto md:right-4 md:translate-x-0"
            >
                {items.map((t) => (
                    <div
                        key={t.id}
                        className={clsx('pointer-events-auto flex animate-in items-start gap-3 rounded-xl border bg-card p-3.5 text-sm shadow-lift duration-300 fade-in-0 slide-in-from-bottom-2', TONOS[t.tone] || TONOS.info)}
                    >
                        <div className="min-w-0 flex-1">
                            {t.title && <p className="font-semibold">{t.title}</p>}
                            <p>{t.message}</p>
                        </div>
                        <button type="button" onClick={() => dismiss(t.id)} className="min-h-9 shrink-0 rounded-md px-3 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40">
                            Cerrar
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export default ToastProvider;
