import clsx from 'clsx';

// Recuadros de rostros sobre una vista de cámara. Decorativos (aria-hidden): el recuento lo dice con texto el chip de VistaCamara.
//   marcos = [{ x, y, ancho, alto }] en fracciones (0..1) de la caja que los contiene: el padre debe ser `relative` y del tamaño de la vista.
// Solo se mueve con `transform` (corta, ~100 ms, y apagada con «reducir movimiento»): la capa exterior mide lo mismo que la vista, así que
// un translate en % la desplaza fracciones de la vista; el recuadro vive dentro y solo cambia de tamaño sin transición.
export default function MarcosRostros({ marcos = [], className }) {
    return (
        <div aria-hidden="true" className={clsx('pointer-events-none absolute inset-0 overflow-hidden', className)}>
            {marcos.map((m, i) => (
                <div
                    key={i}
                    data-marco-rostro=""
                    className="absolute inset-0 motion-safe:transition-transform motion-safe:duration-100 motion-safe:ease-linear"
                    style={{ transform: `translate(${m.x * 100}%, ${m.y * 100}%)` }}
                >
                    <div className="rounded-lg border-2 border-primary-foreground/90 bg-primary-foreground/5" style={{ width: `${m.ancho * 100}%`, height: `${m.alto * 100}%` }} />
                </div>
            ))}
        </div>
    );
}
