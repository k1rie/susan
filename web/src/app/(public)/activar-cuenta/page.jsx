import Onboarding from '@/components/auth/Onboarding';

export const metadata = { title: 'Activar cuenta' };

// Destino del enlace de invitación (/auth/confirm?type=invite): el administrador creó la cuenta y la persona la activa con un
// asistente de 4 pasos (contraseña → estilo → guía de su rol → privacidad). Pública a propósito, igual que /cambiar-contrasena:
// la sesión la establece /auth/confirm y el primer paso comprueba que exista.
export default function ActivarCuentaPage() {
    return <Onboarding modo="activar" />;
}
