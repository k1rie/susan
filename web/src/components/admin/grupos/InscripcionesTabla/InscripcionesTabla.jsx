'use client';

import { useState } from 'react';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import DataState from '@/components/ui/DataState';
import EmptyState from '@/components/ui/EmptyState';
import Table from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { useApiMutation, useApiQuery } from '@/hooks/data';
import { bajaInscripcion, inscritos } from '@/lib/api/admin.js';
import ImportarCsv from '../ImportarCsv';
import InscribirAlumno from '../InscribirAlumno';

// P-09 pestaña Inscripciones: lista con estatus, alta y consentimiento; inscribir, dar de baja e importar CSV.
export default function InscripcionesTabla({ idGrupo, capacidadAula, onChanged }) {
    const { toast } = useToast();
    const consulta = useApiQuery(inscritos, { idGrupo });
    const baja = useApiMutation(bajaInscripcion);
    const [aBaja, setABaja] = useState(null);

    const items = consulta.data?.items ?? [];
    const activos = items.filter((i) => i.estatus === 'activa');
    const recargar = async () => {
        await consulta.refetch();
        onChanged?.();
    };

    const confirmarBaja = async () => {
        try {
            await baja.run({ idInscripcion: aBaja.id_inscripcion });
            toast({ tone: 'success', message: `Baja registrada: ${aBaja.nombre_completo}.` });
            setABaja(null);
            await recargar();
        } catch (error) {
            toast({ tone: 'danger', title: 'No se pudo dar de baja', message: error.message });
            throw error;
        }
    };

    const columnas = [
        { key: 'matricula', header: 'Matrícula', primary: true },
        { key: 'nombre_completo', header: 'Nombre' },
        { key: 'estatus', header: 'Estatus', render: (i) => <Badge tone={i.estatus === 'activa' ? 'success' : 'neutral'}>{i.estatus === 'activa' ? 'Activa' : 'Baja'}</Badge> },
        { key: 'fecha_alta', header: 'Alta' },
        {
            key: 'consentimiento_vigente',
            header: 'Consentimiento',
            render: (i) => (i.consentimiento_vigente ? 'Vigente' : 'Sin consentimiento vigente'),
        },
        {
            key: 'acciones',
            header: 'Acciones',
            render: (i) => (i.estatus === 'activa' ? (
                <Button size="sm" variant="ghost" aria-label={`Dar de baja a ${i.nombre_completo}`} onClick={() => setABaja(i)}>
                    Dar de baja
                </Button>
            ) : null),
        },
    ];

    const excede = capacidadAula != null && activos.length > capacidadAula;
    const llena = capacidadAula != null && activos.length === capacidadAula;

    return (
        <div className="grid gap-4">
            {capacidadAula != null && (
                <p className="text-sm text-muted">
                    Inscritos activos: {activos.length} de {capacidadAula} lugares del aula.
                </p>
            )}
            {excede && <Alert tone="danger">El grupo supera la capacidad del aula ({capacidadAula}). Amplía la capacidad o cambia de aula.</Alert>}
            {llena && <Alert tone="warning">El aula está al límite de su capacidad; una inscripción más la superaría.</Alert>}
            <Card title="Inscribir alumno">
                <InscribirAlumno idGrupo={idGrupo} inscritosActivos={activos.map((i) => i.id_alumno)} onInscrito={recargar} />
            </Card>
            <Card title="Importar desde CSV">
                <ImportarCsv idGrupo={idGrupo} onImported={recargar} />
            </Card>
            <DataState
                loading={consulta.loading}
                error={consulta.error}
                data={consulta.data}
                onRetry={consulta.refetch}
                isEmpty={(d) => !d.items || d.items.length === 0}
                empty={<EmptyState title="Sin inscripciones" description="Inscribe alumnos manualmente o importa un CSV." />}
            >
                {() => <Table columns={columnas} rows={items} rowKey="id_inscripcion" caption={`${items.length} inscripcion(es)`} />}
            </DataState>
            <ConfirmDialog
                open={!!aBaja}
                title="Dar de baja la inscripción"
                message={aBaja ? `Se dará de baja a ${aBaja.nombre_completo} (${aBaja.matricula}). Se conserva su historial.` : ''}
                confirmLabel="Dar de baja"
                variant="danger"
                onConfirm={confirmarBaja}
                onCancel={() => setABaja(null)}
            />
        </div>
    );
}
