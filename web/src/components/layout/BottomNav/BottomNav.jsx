'use client';

import clsx from 'clsx';
import { Ellipsis, Search } from 'lucide-react';
import Link from 'next/link';
import { alNavegarProtegido } from '@/hooks/ui/useCambiosSinGuardar.js';
import { itemActivo } from '../Sidebar/navItems.js';

// Lugares a los lados del botón central, «Más» incluido.
const MAX_DESTINOS = 4;

const BASE_DESTINO =
    'group flex min-h-[3.25rem] w-full flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30';

// El aro del color de la píldora (ring-card) recorta el botón del fondo; al enfocar con teclado el aro pasa a ser el de foco.
const FICHA_CENTRAL = 'grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lift ring-[5px] ring-card transition-colors';

// Barra inferior para teléfonos (< 1024 px), flotante como la de «Fitness» de Mobbin: una píldora separada de los bordes, con sombra y
// desenfoque, y un botón redondo en el centro que sobresale. El destino activo lleva un fondo suave, el icono más grueso y la etiqueta
// en negrita (no solo color). Respeta el área segura de iOS.
//
// «Más» (`onMas`) abre el cajón del riel, que en teléfono es el único lugar de la búsqueda, los módulos y la cuenta (no hay barra
// superior), así que con `onMas` siempre está, a la derecha, y los destinos se recortan a (MAX_DESTINOS - 1). Con un solo destino la
// barra solo se muestra si tiene «Más»; sin él no aporta.
//
// Botón central (`accionCentral`, se configura por rol en Sidebar/navItems.js):
//   { href, label, icon }  enlace con el icono y la etiqueta VISIBLE debajo (p. ej. «Pasar lista» del docente); no se repite como
//                          destino lateral y se marca con aria-current cuando la ruta actual es la suya o cuelga de ella.
//   sin accionCentral      botón por omisión «Buscar o ir a» (abre la paleta de comandos), solo si hay `onBuscar`.
// Sin acción ni `onBuscar` no hay botón central y la píldora queda solo con los destinos.
export default function BottomNav({ items, pathname, onMas, onBuscar, accionCentral = null }) {
    if (!items || items.length === 0 || (items.length < 2 && !onMas)) return null;
    const ruta = pathname || '';
    const central = accionCentral ?? (onBuscar ? { label: 'Buscar o ir a', icon: Search, onClick: onBuscar } : null);
    const centralEnlace = Boolean(central?.href);
    const centralActiva = centralEnlace && (ruta === central.href || ruta.startsWith(`${central.href}/`));

    // Si la acción central ya es un destino de la navegación, no se repite a los lados.
    const laterales = centralEnlace ? items.filter((i) => i.href !== central.href) : items;
    const hayMas = Boolean(onMas);
    const directos = laterales.slice(0, hayMas ? MAX_DESTINOS - 1 : MAX_DESTINOS);
    // En la ruta del botón central no se enciende ningún destino lateral (por ejemplo «Panel», que comparte prefijo).
    const activo = centralActiva ? null : itemActivo(laterales, ruta);
    const activoOculto = Boolean(activo) && !directos.some((i) => i.href === activo);

    // «Más» siempre cierra la derecha; el botón central reparte los destinos por mitades (la izquierda se queda con el que sobre).
    const destinos = [...directos.map((it) => ({ clave: it.href, it })), ...(hayMas ? [{ clave: '__mas__', mas: true }] : [])];
    const corte = central ? Math.ceil(destinos.length / 2) : destinos.length;

    const pintar = (d) => {
        if (d.mas) {
            return (
                <li key={d.clave} className="min-w-0 flex-1">
                    <button type="button" onClick={onMas} className={clsx(BASE_DESTINO, activoOculto ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                        <Ellipsis aria-hidden="true" className="size-5" strokeWidth={activoOculto ? 2 : 1.75} />
                        <span className={clsx('text-[11px] leading-tight', activoOculto ? 'font-semibold' : 'font-medium')}>Más</span>
                    </button>
                </li>
            );
        }
        const { href, label, icon: Icono } = d.it;
        const esActivo = href === activo;
        return (
            <li key={d.clave} className="min-w-0 flex-1">
                <Link href={href} onNavigate={alNavegarProtegido} aria-current={esActivo ? 'page' : undefined} className={clsx(BASE_DESTINO, esActivo ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                    {Icono && <Icono aria-hidden="true" className="size-5" strokeWidth={esActivo ? 2 : 1.75} />}
                    <span className={clsx('max-w-full truncate text-[11px] leading-tight', esActivo ? 'font-semibold' : 'font-medium')}>{label}</span>
                </Link>
            </li>
        );
    };

    const IconoCentral = central?.icon;

    return (
        <nav aria-label="Navegación inferior" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
            <ul className="pointer-events-auto mx-auto flex max-w-md items-stretch gap-0.5 rounded-[1.75rem] border border-border/70 bg-card/90 p-1.5 shadow-lift backdrop-blur-xl">
                {destinos.slice(0, corte).map(pintar)}
                {central && (
                    // El botón vive en la lista, entre las dos mitades, para que el orden del teclado sea el de la vista; sobresale de la píldora.
                    <li className="relative w-[4.25rem] shrink-0">
                        {centralEnlace ? (
                            // La etiqueta visible cuelga del círculo (dentro de la píldora): quien no conoce el icono sabe qué hace.
                            <Link
                                href={central.href}
                                onNavigate={alNavegarProtegido}
                                aria-current={centralActiva ? 'page' : undefined}
                                className="group absolute left-1/2 top-0 flex -translate-x-1/2 -translate-y-5 flex-col items-center gap-0.5 focus-visible:outline-none"
                            >
                                <span className={clsx(FICHA_CENTRAL, 'group-hover:bg-primary-hover group-focus-visible:ring-ring/40')}>
                                    {IconoCentral && <IconoCentral aria-hidden="true" className="size-6" strokeWidth={1.75} />}
                                </span>
                                <span className="whitespace-nowrap text-[11px] font-semibold leading-tight text-foreground">{central.label}</span>
                            </Link>
                        ) : (
                            <button
                                type="button"
                                onClick={central.onClick}
                                aria-label={central.label}
                                className={clsx(FICHA_CENTRAL, 'absolute left-1/2 top-0 -translate-x-1/2 -translate-y-5 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-ring/40')}
                            >
                                {IconoCentral && <IconoCentral aria-hidden="true" className="size-5" strokeWidth={1.75} />}
                            </button>
                        )}
                    </li>
                )}
                {destinos.slice(corte).map(pintar)}
            </ul>
        </nav>
    );
}
