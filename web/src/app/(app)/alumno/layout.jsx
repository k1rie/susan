import { requerirSesion, ROLES_POR_AREA } from '@/lib/server/auth';

export default async function AlumnoLayout({ children }) {
    await requerirSesion(ROLES_POR_AREA.alumno);
    return children;
}
