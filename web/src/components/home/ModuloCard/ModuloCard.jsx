import { ArrowUpRight, Lock } from 'lucide-react';
import TarjetaPortada from '@/components/ui/TarjetaPortada';
import { CATEGORIAS } from '@/lib/modulos.js';

// Tarjeta de módulo: TarjetaPortada (referencia: Stacks de Dropbox Dash) con la categoría como meta y, abajo, «Abrir» para los
// activos o el candado + «Próximamente» para los de la hoja de ruta (equivale al «Private» de Dash). Es un único enlace:
// activos van a su pantalla; los próximos a /modulos/[id], que explica qué traerán.
export default function ModuloCard({ modulo, className }) {
    const { id, titulo, icono, tono, estado, href, categoria, portada } = modulo;
    const pronto = estado === 'pronto';
    const etiquetaCategoria = CATEGORIAS.find((c) => c.id === categoria)?.etiqueta ?? '';
    return (
        <TarjetaPortada
            data-modulo={id}
            href={pronto ? `/modulos/${id}` : href}
            icono={icono}
            tono={tono}
            portada={portada}
            titulo={titulo}
            meta={etiquetaCategoria}
            className={className}
            pie={
                pronto ? (
                    <>
                        <Lock aria-hidden="true" className="size-4" strokeWidth={1.5} />
                        Próximamente
                    </>
                ) : (
                    <>
                        <ArrowUpRight aria-hidden="true" className="size-4" strokeWidth={1.5} />
                        Abrir
                    </>
                )
            }
        />
    );
}
