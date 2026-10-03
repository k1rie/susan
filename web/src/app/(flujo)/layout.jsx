import { ToastProvider } from '@/components/ui/Toast/Toast.jsx';
import { requerirSesion } from '@/lib/server/auth';

// Flujos a pantalla completa para personas con sesión (sin riel ni barra): hoy, la bienvenida.
export default async function FlujoLayout({ children }) {
    await requerirSesion();
    return <ToastProvider>{children}</ToastProvider>;
}
