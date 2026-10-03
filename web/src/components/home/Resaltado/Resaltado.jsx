import { cn } from '@/lib/utils';

// Palabra clave con subrayado dorado "dibujado a mano" que se traza una sola vez (firma visual de SUSAN, ver
// docs/design/SISTEMA.md). El trazo es un SVG decorativo: el texto sigue siendo texto normal para lectores de pantalla.
export default function Resaltado({ children, className }) {
    return (
        <span className={cn('relative inline-block', className)}>
            <span className="relative z-10">{children}</span>
            <svg
                aria-hidden="true"
                viewBox="0 0 100 12"
                preserveAspectRatio="none"
                className="pointer-events-none absolute -bottom-[0.12em] left-0 h-[0.32em] w-full overflow-visible"
            >
                <path
                    d="M2 8 C 22 3, 40 10, 60 5 S 90 4, 98 7"
                    pathLength="1"
                    fill="none"
                    stroke="var(--brand-gold)"
                    strokeOpacity="0.75"
                    strokeWidth="4"
                    strokeLinecap="round"
                    className="resaltado-trazo"
                />
            </svg>
        </span>
    );
}
