import { redirect } from 'next/navigation';
import { obtenerSesion } from '@/lib/server/auth';

// Depende de la sesion (cookies): nunca se prerenderiza.
export const dynamic = 'force-dynamic';

// La raíz solo decide a dónde ir: home del rol si hay sesión válida, /login si no.
export default async function Home() {
    const sesion = await obtenerSesion();
    redirect(sesion.estado === 'ok' ? sesion.me.home || '/login' : '/login');
}
