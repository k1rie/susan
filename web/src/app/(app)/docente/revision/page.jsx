import ColaRevision from '@/components/revision/ColaRevision';

export const metadata = { title: 'Revisión | SUSAN' };

// Deep links: ?pestana=pendientes|justificantes|correcciones&caso=<id>
export default async function PaginaRevision({ searchParams }) {
    const sp = await searchParams;
    return <ColaRevision pestanaInicial={sp.pestana} casoInicial={Number(sp.caso) || null} />;
}
