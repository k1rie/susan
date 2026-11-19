import { notFound } from 'next/navigation';
import GrupoDetalle from '@/components/admin/grupos/GrupoDetalle';

export const metadata = { title: 'Grupo | SUSAN' };

// Deep links: ?tab=datos|horario|aula|inscripciones (los pasos del éxito del alta y de las acciones de la lista llegan así).
export default async function PaginaGrupo({ params, searchParams }) {
    const { id } = await params;
    const { tab } = await searchParams;
    const idGrupo = Number(id);
    if (!Number.isInteger(idGrupo) || idGrupo <= 0) notFound();
    return <GrupoDetalle idGrupo={idGrupo} tabInicial={typeof tab === 'string' ? tab : undefined} />;
}
