import clsx from 'clsx';
import { X } from 'lucide-react';

// Piezas del armazón del asistente: cabecera fija, cuerpo con su propio scroll y pie con las acciones.
// El pie respeta el área segura del teléfono (barra de inicio) para que el botón principal nunca quede tapado.

export function Cabecera({ titulo, id, onCerrar, deshabilitado = false, children }) {
    return (
        <header className="shrink-0 px-5 pt-4 pb-3">
            <div className="flex min-h-10 items-center justify-between gap-3">
                <h1 id={id} className="text-[15px] font-semibold tracking-tight">
                    {titulo}
                </h1>
                <button
                    type="button"
                    onClick={onCerrar}
                    disabled={deshabilitado}
                    aria-label="Cerrar el registro facial"
                    className="-mr-2 flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <X aria-hidden="true" className="size-5" strokeWidth={1.75} />
                </button>
            </div>
            {children}
        </header>
    );
}

// `my-auto` (y no justify-center) centra el contenido sin recortar su parte superior cuando no cabe y hay que hacer scroll.
export function Cuerpo({ centrado = true, className, children }) {
    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 py-2">
            <div className={clsx(centrado && 'my-auto', className)}>{children}</div>
        </div>
    );
}

export function Pie({ children }) {
    return (
        <footer className="flex shrink-0 flex-col gap-2 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</footer>
    );
}
