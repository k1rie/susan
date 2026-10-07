'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { modulosActivos, modulosProximos } from '@/lib/modulos.js';
import BottomNav from '../BottomNav/BottomNav.jsx';
import { construirComandos } from '../PaletaComandos/paleta.utils.js';
import { ShellContext } from '../ShellContext.jsx';
import Sidebar from '../Sidebar/Sidebar.jsx';
import { accionCentralParaRol, navParaRol } from '../Sidebar/navItems.js';

// Carga diferida (presupuesto de JS inicial de /docente, docs/DECISIONS.md): la paleta solo hace falta al abrirla y el reloj de
// demostración solo existe en modo local. React.lazy en vez de next/dynamic: no suma el runtime de next/dynamic al shell.
const cargarPaleta = () => import('../PaletaComandos/PaletaComandos.jsx');
const PaletaComandos = lazy(cargarPaleta);
const RelojDemo = lazy(() => import('../RelojDemo/RelojDemo.jsx'));

// Estructura de las pantallas autenticadas (referencia: Dropbox Dash): lienzo crema con el riel a la izquierda y el contenido en un
// panel blanco flotante de esquinas redondeadas que hace su propio scroll en escritorio; en móvil, solo la barra inferior (su «Más»
// abre el cajón con búsqueda, módulos y cuenta) y el documento hace scroll. Incluye la paleta de comandos (⌘K). No consulta datos: `me` y `onSalir` los entrega quien lo usa.
export default function AppShell({ me, relojSimulado = false, onSalir, children }) {
    const pathname = usePathname();
    const router = useRouter();
    const [menuAbierto, setMenuAbierto] = useState(false);
    const [paletaAbierta, setPaletaAbierta] = useState(false);
    const abrirMenu = useCallback(() => setMenuAbierto(true), []);
    const cerrarMenu = useCallback(() => setMenuAbierto(false), []);
    const abrirPaleta = useCallback(() => setPaletaAbierta(true), []);
    const cerrarPaleta = useCallback(() => setPaletaAbierta(false), []);

    const nav = useMemo(() => navParaRol(me?.rol), [me?.rol]);
    // Botón central de la barra inferior móvil: la acción principal del rol (docente: «Pasar lista»); null = búsqueda por omisión.
    const accionCentral = useMemo(() => accionCentralParaRol(me?.rol), [me?.rol]);
    const activos = useMemo(() => modulosActivos(me?.rol), [me?.rol]);
    const proximos = useMemo(() => modulosProximos(me?.rol), [me?.rol]);
    const comandos = useMemo(() => construirComandos({ nav, activos, proximos }), [nav, activos, proximos]);
    const contexto = useMemo(() => ({ me, abrirPaleta }), [me, abrirPaleta]);

    // El cliente HTTP emite este evento cuando el token expira sin poder renovarse.
    useEffect(() => {
        const alExpirar = () => {
            router.replace(`/login?error=sesion_expirada&next=${encodeURIComponent(pathname || '/')}`);
        };
        window.addEventListener('susan:sesion-expirada', alExpirar);
        return () => window.removeEventListener('susan:sesion-expirada', alExpirar);
    }, [router, pathname]);

    // Precarga la paleta cuando el navegador queda libre, para que el primer ⌘K abra sin esperar la descarga.
    // Si la precarga falla (sin red) no pasa nada: la paleta se vuelve a pedir al abrirla.
    useEffect(() => {
        const precargar = () => cargarPaleta().catch(() => {});
        if (typeof window.requestIdleCallback === 'function') {
            const id = window.requestIdleCallback(precargar);
            return () => window.cancelIdleCallback?.(id);
        }
        const id = window.setTimeout(precargar, 2000);
        return () => window.clearTimeout(id);
    }, []);

    // ⌘K / Ctrl+K abre la paleta desde cualquier pantalla.
    useEffect(() => {
        const alTeclear = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setPaletaAbierta((v) => !v);
            }
        };
        document.addEventListener('keydown', alTeclear);
        return () => document.removeEventListener('keydown', alTeclear);
    }, []);

    return (
        <ShellContext.Provider value={contexto}>
            {/* `relative` es lo que mantiene el scroll de la página en cero en escritorio: los `sr-only` (position: absolute) del riel y del contenido
                toman como bloque contenedor el primer ancestro con `position`; sin él, escapan del overflow del panel y del riel, quedan
                en su posición natural bajo el pliegue y alargan el documento (la página hacía un segundo scroll y asomaba el crema). */}
            <div className="relative min-h-dvh bg-background lg:flex lg:h-dvh lg:overflow-hidden">
                <a
                    href="#contenido"
                    className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[70] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
                >
                    Saltar al contenido
                </a>
                <Sidebar
                    items={nav}
                    proximos={proximos.slice(0, 4)}
                    pathname={pathname}
                    open={menuAbierto}
                    onClose={cerrarMenu}
                    me={me}
                    onSalir={onSalir}
                    onBuscar={abrirPaleta}
                />
                <main
                    id="contenido"
                    className="min-h-dvh min-w-0 flex-1 bg-card pb-24 lg:m-2 lg:ml-0 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:rounded-2xl lg:border lg:border-border/60 lg:pb-0"
                >
                    {relojSimulado && (
                        // Reloj de demostración (solo desarrollo local): muestra la hora simulada y deja adelantarla para probar el ciclo de una sesión.
                        <div className="mx-auto max-w-[68rem] px-4 pt-3 lg:px-12">
                            <Suspense fallback={null}>
                                <RelojDemo />
                            </Suspense>
                        </div>
                    )}
                    <div className="mx-auto w-full max-w-[68rem] px-4 pb-16 pt-6 lg:px-12 lg:pt-10">{children}</div>
                </main>
                <BottomNav items={nav} pathname={pathname} onMas={abrirMenu} onBuscar={abrirPaleta} accionCentral={accionCentral} />
                {paletaAbierta && (
                    <Suspense fallback={null}>
                        <PaletaComandos open onClose={cerrarPaleta} comandos={comandos} onSalir={onSalir} />
                    </Suspense>
                )}
            </div>
        </ShellContext.Provider>
    );
}
