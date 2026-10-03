'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell.jsx';
import { ToastProvider } from '@/components/ui/Toast/Toast.jsx';
import { cerrarSesion } from '@/lib/api/auth.js';

// Envoltorio cliente del shell: cablea "Salir" y aporta el proveedor de avisos. El evento de sesión
// expirada ya lo escucha AppShell.
export default function AppShellCliente({ me, relojSimulado = false, children }) {
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
        </ToastProvider>
    );
}
