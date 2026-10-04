'use client';

import clsx from 'clsx';
import { Check, X } from 'lucide-react';
import { useId } from 'react';

// Los tres pasos de pasar lista. El 1 ya está hecho: se llega aquí con la sesión abierta.
const PASOS = {
    automatico: [
        { titulo: 'Sesión abierta', detalle: 'La clase ya está en curso.', hecho: true },
        { titulo: 'Apunta la cámara al grupo', detalle: 'Que se vean los rostros; el sistema reconoce solo.' },
        { titulo: 'Revisa y cierra', detalle: 'Al terminar la tolerancia, cierra el pase de lista.' },
    ],
    manual: [
        { titulo: 'Sesión abierta', detalle: 'La clase ya está en curso.', hecho: true },
        { titulo: 'Marca a cada alumno', detalle: 'Presente, retardo o ausente.' },
        { titulo: 'Guarda y cierra', detalle: 'Quien quede sin marcar será ausente.' },
    ],
};

// Guía corta (3 pasos) que se muestra al llegar con ?pasar-lista=1: dónde se pasa lista y qué sigue. Se puede descartar.
//   modo = automatico | manual · onDescartar = oculta la guía (el estado lo guarda quien la monta)
export default function GuiaPasarLista({ modo = 'automatico', onDescartar, className }) {
    const idTitulo = useId();
    const pasos = PASOS[modo] ?? PASOS.automatico;
    return (
        <section aria-labelledby={idTitulo} className={clsx('rounded-xl border border-border bg-card p-4 sm:p-5', className)}>
            <div className="flex items-center justify-between gap-3">
                <h2 id={idTitulo} className="text-sm font-semibold">
                    Así se pasa lista
                </h2>
                {onDescartar && (
                    <button
                        type="button"
                        onClick={onDescartar}
                        aria-label="Ocultar la guía"
                        className="-m-2 grid size-10 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                    >
                        <X aria-hidden="true" className="size-4" strokeWidth={1.75} />
                    </button>
                )}
            </div>
            <ol className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {pasos.map((paso, i) => (
                    <li key={paso.titulo} className="flex items-start gap-3">
                        <span
                            aria-hidden="true"
                            className={clsx('grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold tabular-nums', paso.hecho ? 'bg-presente-bg text-presente' : 'bg-muted text-foreground')}
                        >
                            {paso.hecho ? <Check className="size-4" strokeWidth={2} /> : i + 1}
                        </span>
                        <div className="min-w-0">
                            <p className="text-sm font-medium leading-snug">
                                <span className="sr-only">{`Paso ${i + 1}${paso.hecho ? ', hecho: ' : ': '}`}</span>
                                {paso.titulo}
                            </p>
                            <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{paso.detalle}</p>
                        </div>
                    </li>
                ))}
            </ol>
        </section>
    );
}
