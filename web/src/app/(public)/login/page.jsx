import { redirect } from 'next/navigation';
import AuthCard from '@/components/auth/AuthCard/AuthCard.jsx';
import LoginForm from '@/components/auth/LoginForm/LoginForm.jsx';
import { rutaSegura } from '@/components/auth/LoginForm/rutaSegura.js';
import { MENSAJES_INFO } from '@/components/auth/LoginForm/login.utils.js';
import { obtenerSesion } from '@/lib/server/auth';

export const metadata = { title: 'Iniciar sesión' };

export default async function LoginPage({ searchParams }) {
    const { next, error, msg } = await searchParams;
    const sesion = await obtenerSesion();
    if (sesion.estado === 'ok') redirect(rutaSegura(next, sesion.me.home) || '/');
    const estado = sesion.estado === 'inactiva' ? 'cuenta_inactiva' : sesion.estado === 'sin_cuenta' ? 'sin_cuenta' : null;
    const candidato = estado ?? (typeof error === 'string' ? error : null) ?? (typeof msg === 'string' ? msg : null);
    const mensaje = Object.hasOwn(MENSAJES_INFO, candidato) ? candidato : null;
    return (
        <AuthCard title="Iniciar sesión" subtitle="Usa tu cuenta institucional.">
            <LoginForm next={rutaSegura(next)} mensaje={mensaje} />
        </AuthCard>
    );
}
