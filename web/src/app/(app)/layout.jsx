import AppShellCliente from '@/components/auth/AppShellCliente/AppShellCliente.jsx';
import { ahora } from '@/lib/api/plataforma';
import { asistenteDisponible } from '@/lib/server/asistente';
import { requerirSesion } from '@/lib/server/auth';
import { getServerBackend } from '@/lib/backend';

// Cada área añade su propio layout con la guarda de rol; la autoridad real son RLS y las RPC.
export default async function AppLayout({ children }) {
    const me = await requerirSesion();
    const reloj = await ahora({}, { backend: await getServerBackend() }).catch(() => null);
    // Asistente de IA: por ahora solo el docente. Solo viaja al cliente si hay clave (un booleano; la clave nunca sale del servidor).
    const asistenteIA = me?.rol === 'docente' ? { disponible: asistenteDisponible() } : null;
    return (
        <AppShellCliente me={me} relojSimulado={reloj?.reloj_simulado === true} asistenteIA={asistenteIA}>
            {children}
        </AppShellCliente>
    );
}
