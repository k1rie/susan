import TarjetaFila from '@/components/ui/TarjetaFila';
import { guiaParaRol } from './guia.js';

// Paso «Así funciona SUSAN para ti»: tres tarjetas de fila según el rol (sin rol conocido, una guía general).
export default function PasoGuia({ rol }) {
    const items = guiaParaRol(rol);
    return (
        <div className="flex flex-col gap-5">
            <p className="text-base text-muted-foreground">Esto es lo más importante que podrás hacer con tu cuenta.</p>
            <ul className="flex flex-col gap-3">
                {items.map(({ icono, tono, titulo, texto }, i) => (
                    <li key={titulo} className="escena-entra" style={{ '--d': `${0.1 + i * 0.1}s` }}>
                        <TarjetaFila icono={icono} tono={tono} titulo={titulo} className="items-start">
                            <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">{texto}</span>
                        </TarjetaFila>
                    </li>
                ))}
            </ul>
        </div>
    );
}
