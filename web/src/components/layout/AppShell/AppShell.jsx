'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Sidebar from '../Sidebar/Sidebar.jsx';
import { navParaRol } from '../Sidebar/navItems.js';
import Topbar from '../Topbar/Topbar.jsx';

// Estructura de las pantallas autenticadas: Topbar fija, Sidebar y <main id="contenido">.
// No consulta datos: `me` y `onSalir` los entrega la página/layout que lo usa.
export default function AppShell({ me, relojSimulado = false, onSalir, children }) {
    const pathname = usePathname();
    const router = useRouter();
    const [menuAbierto, setMenuAbierto] = useState(false);
    const cerrarMenu = useCallback(() => setMenuAbierto(false), []);

    // El cliente HTTP emite este evento cuando el token expira sin poder renovarse.
    useEffect(() => {
        const alExpirar = () => {
            router.replace(`/login?error=sesion_expirada&next=${encodeURIComponent(pathname || '/')}`);
        };
        window.addEventListener('susan:sesion-expirada', alExpirar);
        return () => window.removeEventListener('susan:sesion-expirada', alExpirar);
    }, [router, pathname]);

    return (
        <div className="min-h-dvh">
            <a
                href="#contenido"
                className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[70] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
            >
                Saltar al contenido
            </a>
            <Topbar me={me} onMenu={() => setMenuAbierto((v) => !v)} onSalir={onSalir} />
            <Sidebar items={navParaRol(me?.rol)} pathname={pathname} open={menuAbierto} onClose={cerrarMenu} />
            <div className="pt-14 lg:pl-60">
                {relojSimulado && (
                    <Alert tone="warning" className="m-4 mb-0">
                        Reloj simulado activo (solo desarrollo)
                    </Alert>
                )}
                <main id="contenido" className="mx-auto w-full max-w-6xl p-4 md:p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
