'use client';

import { useRouter } from 'next/navigation';
import { Suspense, lazy, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell.jsx';
import { ToastProvider } from '@/components/ui/Toast/Toast.jsx';
import { cerrarSesion } from '@/lib/api/auth.js';

// Carga diferida: el asistente de IA no suma al JS inicial de /docente (presupuesto de docs/DECISIONS.md).
const AsistenteIA = lazy(() => import('@/components/asistente/AsistenteIA/AsistenteIA.jsx'));

// Envoltorio cliente del shell: cablea "Salir" y aporta el proveedor de avisos. El evento de sesión
// expirada ya lo escucha AppShell. `asistenteIA` (del layout del servidor): null = sin asistente para este rol; { disponible } = botón
// flotante del asistente de IA (desactivado con aviso si falta la clave de la Claude API).
export default function AppShellCliente({ me, relojSimulado = false, asistenteIA = null, children }) {
    const router = useRouter();
    const salir = useCallback(async () => {
        await cerrarSesion();
        router.replace('/login?msg=sesion_cerrada');
        router.refresh();
    }, [router]);
    return (
        <ToastProvider>
            <AppShell me={me} relojSimulado={relojSimulado} onSalir={salir}>
                {children}
            </AppShell>
            {asistenteIA && (
                <Suspense fallback={null}>
                    <AsistenteIA disponible={asistenteIA.disponible} />
                </Suspense>
            )}
        </ToastProvider>
    );
}
