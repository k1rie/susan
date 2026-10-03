import AuthCard from '@/components/auth/AuthCard/AuthCard.jsx';
import RecuperarForm from '@/components/auth/RecuperarForm/RecuperarForm.jsx';

export const metadata = { title: 'Recuperar contraseña' };

export default function RecuperarPage() {
    return (
        <AuthCard title="Recuperar contraseña" subtitle="Te enviaremos un enlace para restablecerla.">
            <RecuperarForm />
        </AuthCard>
    );
}
