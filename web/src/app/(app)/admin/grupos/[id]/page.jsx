import { notFound } from 'next/navigation';
import GrupoDetalle from '@/components/admin/grupos/GrupoDetalle';

export const metadata = { title: 'Grupo | SUSAN' };

export default async function PaginaGrupo({ params }) {
    const { id } = await params;
    const idGrupo = Number(id);
    if (!Number.isInteger(idGrupo) || idGrupo <= 0) notFound();
    return <GrupoDetalle idGrupo={idGrupo} />;
}
