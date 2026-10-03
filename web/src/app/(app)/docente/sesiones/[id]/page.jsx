import { notFound } from 'next/navigation';
import SesionClase from '@/components/sesion/SesionClase';

export const metadata = { title: 'Sesión de clase | SUSAN' };

export default async function PaginaSesion({ params }) {
    const { id } = await params;
    const idSesion = Number(id);
    if (!Number.isInteger(idSesion) || idSesion <= 0) notFound();
    return <SesionClase idSesion={idSesion} />;
}
