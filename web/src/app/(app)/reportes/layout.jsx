import { requerirSesion, ROLES_POR_AREA } from '@/lib/server/auth';

export default async function ReportesLayout({ children }) {
    await requerirSesion(ROLES_POR_AREA.reportes);
    return children;
}
