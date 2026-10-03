import AuthCard from '@/components/auth/AuthCard/AuthCard.jsx';
import CambiarContrasenaForm from '@/components/auth/CambiarContrasenaForm/CambiarContrasenaForm.jsx';

export const metadata = { title: 'Cambiar contraseña' };

// Ruta pública a propósito (ver proxy.js): la sesión de recuperación se establece en el navegador.
export default function CambiarContrasenaPage() {
    return (
        <AuthCard title="Nueva contraseña" resaltar="contraseña" subtitle="Elige una contraseña que no uses en otros sitios.">
            <CambiarContrasenaForm />
        </AuthCard>
    );
}
