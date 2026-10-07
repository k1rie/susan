import clsx from 'clsx';

const CLASE = {
    hecho: 'bg-foreground',
    verificando: 'bg-link motion-safe:animate-pulse',
    error: 'bg-ausente',
    actual: 'bg-foreground/40',
    omitido: 'bg-border opacity-50',
    pendiente: 'bg-border',
};

// Progreso segmentado de las tomas (una píldora por paso), como el de los flujos de verificación de identidad.
// Decorativo: el número de toma va siempre en texto junto a la barra.
export default function BarraPasos({ estados }) {
    return (
        <div aria-hidden="true" className="flex gap-1.5">
            {estados.map((estado, i) => (
                <span key={i} className={clsx('h-1.5 flex-1 rounded-full transition-colors duration-300', CLASE[estado] ?? CLASE.pendiente)} />
            ))}
        </div>
    );
}
