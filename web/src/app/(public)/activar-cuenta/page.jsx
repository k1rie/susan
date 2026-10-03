import AuthCard from '@/components/auth/AuthCard/AuthCard.jsx';
import CambiarContrasenaForm from '@/components/auth/CambiarContrasenaForm/CambiarContrasenaForm.jsx';

export const metadata = { title: 'Activar cuenta' };

// Destino del enlace de invitación (/auth/confirm?type=invite): el administrador creó la cuenta y la persona define su
// primera contraseña. Pública a propósito, igual que /cambiar-contrasena: la sesión la establece /auth/confirm.
export default function ActivarCuentaPage() {
    return (
        <AuthCard title="Activa tu cuenta" resaltar="cuenta" subtitle="Crea tu contraseña para empezar a usar SUSAN con tu correo institucional.">
            <CambiarContrasenaForm modo="activar" />
        </AuthCard>
    );
}
