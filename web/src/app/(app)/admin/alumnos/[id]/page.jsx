import { notFound } from 'next/navigation';
import DetalleAlumno from '@/components/admin/alumnos/DetalleAlumno';

export const metadata = { title: 'Ficha del alumno | SUSAN' };

export default async function PaginaAlumno({ params }) {
    const { id } = await params;
    const idAlumno = Number(id);
    if (!Number.isInteger(idAlumno) || idAlumno <= 0) notFound();
    return <DetalleAlumno idAlumno={idAlumno} />;
}
