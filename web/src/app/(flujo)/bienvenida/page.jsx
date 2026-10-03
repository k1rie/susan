import Onboarding from '@/components/auth/Onboarding';

export const metadata = { title: 'Bienvenida' };

// Recorrido de bienvenida de una cuenta ya activa (estilo del perfil, guía por rol y aviso de privacidad). Se abre desde el menú
// de cuenta; la activación inicial (con contraseña) vive en /activar-cuenta.
export default function BienvenidaPage() {
    return <Onboarding modo="bienvenida" />;
}
