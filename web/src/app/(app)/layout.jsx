import AppShellCliente from '@/components/auth/AppShellCliente/AppShellCliente.jsx';
import { ahora } from '@/lib/api/plataforma';
import { requerirSesion } from '@/lib/server/auth';
import { getServerBackend } from '@/lib/backend';

// Cada área añade su propio layout con la guarda de rol; la autoridad real son RLS y las RPC.
export default async function AppLayout({ children }) {
    const me = await requerirSesion();
    const reloj = await ahora({}, { backend: await getServerBackend() }).catch(() => null);
    return (
        <AppShellCliente me={me} relojSimulado={reloj?.reloj_simulado === true}>
            {children}
        </AppShellCliente>
    );
}
