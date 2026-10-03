'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '@/components/ui/Alert/Alert.jsx';
import { modulosActivos, modulosProximos } from '@/lib/modulos.js';
import BottomNav from '../BottomNav/BottomNav.jsx';
import PaletaComandos from '../PaletaComandos/PaletaComandos.jsx';
import { construirComandos } from '../PaletaComandos/paleta.utils.js';
import { ShellContext } from '../ShellContext.jsx';
import Sidebar from '../Sidebar/Sidebar.jsx';
import { navParaRol } from '../Sidebar/navItems.js';
import TopbarMovil from '../TopbarMovil/TopbarMovil.jsx';

// Estructura de las pantallas autenticadas (referencia: Dropbox Dash): lienzo crema con el riel a la izquierda y el contenido en un
// panel blanco flotante de esquinas redondeadas que hace su propio scroll en escritorio; en móvil, barra superior + barra inferior
// y el documento hace scroll. Incluye la paleta de comandos (⌘K). No consulta datos: `me` y `onSalir` los entrega quien lo usa.
export default function AppShell({ me, relojSimulado = false, onSalir, children }) {
    const pathname = usePathname();
    const router = useRouter();
    const [menuAbierto, setMenuAbierto] = useState(false);
    const [paletaAbierta, setPaletaAbierta] = useState(false);
    const cerrarMenu = useCallback(() => setMenuAbierto(false), []);
    const abrirPaleta = useCallback(() => setPaletaAbierta(true), []);
    const cerrarPaleta = useCallback(() => setPaletaAbierta(false), []);

    const nav = useMemo(() => navParaRol(me?.rol), [me?.rol]);
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
            <div className="min-h-dvh bg-background lg:flex lg:h-dvh lg:overflow-hidden">
                <a
                    href="#contenido"
                    className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[70] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
                >
                    Saltar al contenido
                </a>
                <TopbarMovil me={me} onMenu={() => setMenuAbierto((v) => !v)} onBuscar={abrirPaleta} onSalir={onSalir} />
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
                    className="min-h-dvh min-w-0 flex-1 bg-card pb-24 pt-14 lg:m-2 lg:ml-0 lg:min-h-0 lg:overflow-y-auto lg:rounded-2xl lg:border lg:border-border/60 lg:pb-0 lg:pt-0"
                >
                    {relojSimulado && (
                        <div className="mx-auto max-w-[68rem] px-4 pt-4 lg:px-12">
                            <Alert tone="warning">Reloj simulado activo (solo desarrollo)</Alert>
                        </div>
                    )}
                    <div className="mx-auto w-full max-w-[68rem] px-4 pb-16 pt-6 lg:px-12 lg:pt-10">{children}</div>
                </main>
                <BottomNav items={nav} pathname={pathname} onMas={() => setMenuAbierto(true)} />
                <PaletaComandos open={paletaAbierta} onClose={cerrarPaleta} comandos={comandos} onSalir={onSalir} />
            </div>
        </ShellContext.Provider>
    );
}
