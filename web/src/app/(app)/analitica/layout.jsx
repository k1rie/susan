import { requerirSesion, ROLES_POR_AREA } from '@/lib/server/auth';

export default async function AnaliticaLayout({ children }) {
    await requerirSesion(ROLES_POR_AREA.analitica);
    return children;
}
