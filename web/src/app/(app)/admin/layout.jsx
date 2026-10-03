import { redirect } from 'next/navigation';
import { requerirSesion } from '@/lib/server/auth';

// Área de administración. El técnico entra a la aplicación pero su único espacio es /tecnico:
// aquí se le devuelve a su inicio (la RPC además le niega los datos).
export default async function AdminLayout({ children }) {
    const me = await requerirSesion(['administrador', 'tecnico']);
    if (me.rol === 'tecnico') redirect('/tecnico');
    return children;
}
