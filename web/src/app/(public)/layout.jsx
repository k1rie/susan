import { ToastProvider } from '@/components/ui/Toast/Toast.jsx';

// Las pantallas públicas comparten el proveedor de avisos (el aviso sobrevive al paso de /cambiar-contrasena a /login).
export default function PublicLayout({ children }) {
    return <ToastProvider>{children}</ToastProvider>;
}
