import { requerirSesion } from '@/lib/server/auth';

// Guarda del area docente (cubre /docente, /docente/sesiones/* y /docente/revision): solo el rol docente.
export default async function DocenteLayout({ children }) {
    await requerirSesion(['docente']);
    return children;
}
