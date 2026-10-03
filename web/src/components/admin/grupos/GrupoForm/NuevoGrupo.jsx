'use client';

import { useRouter } from 'next/navigation';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import GrupoForm from './GrupoForm.jsx';

// Alta de grupo: al guardar se va a su ficha para capturar horario e inscripciones.
export default function NuevoGrupo() {
    const router = useRouter();
    return (
        <div className="flex flex-col gap-4">
            <PageHeader title="Nuevo grupo" backHref="/admin/grupos" backLabel="Volver a grupos" />
            <Card>
                <GrupoForm onSaved={(r) => router.push(`/admin/grupos/${r.id_grupo}`)} />
            </Card>
        </div>
    );
}
