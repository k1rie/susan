import SolicitudesLaboratorio from '@/components/laboratorios/admin/SolicitudesLaboratorio';

export const metadata = { title: 'Solicitudes de laboratorio | SUSAN' };

// Deep link: ?pestana=pendientes|agenda|historial
export default async function PaginaSolicitudesLaboratorio({ searchParams }) {
    const sp = await searchParams;
    return <SolicitudesLaboratorio pestanaInicial={typeof sp.pestana === 'string' ? sp.pestana : undefined} />;
}
