'use client';

import { useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import DataState from '@/components/ui/DataState';
import StatCard from '@/components/ui/StatCard';
import Tabs from '@/components/ui/Tabs';
import { useApiQuery } from '@/hooks/data';
import { grupoObtener } from '@/lib/api/admin.js';
import AulaCamaras from '../AulaCamaras';
import GenerarSesiones from '../GenerarSesiones';
import GrupoForm from '../GrupoForm';
import HorarioEditor from '../HorarioEditor';
import InscripcionesTabla from '../InscripcionesTabla';

const TABS = [
    { id: 'datos', label: 'Datos' },
    { id: 'horario', label: 'Horario' },
    { id: 'aula', label: 'Aula y cámaras' },
    { id: 'inscripciones', label: 'Inscripciones' },
];

// P-09 detalle de grupo con pestañas. La ficha se recarga tras cada cambio para mantener resúmenes al día.
export default function GrupoDetalle({ idGrupo }) {
    const consulta = useApiQuery(grupoObtener, { idGrupo });
    const [tab, setTab] = useState('datos');

    return (
        <DataState loading={consulta.loading} error={consulta.error} data={consulta.data} onRetry={consulta.refetch} isEmpty={() => false}>
            {(g) => (
                <div className="flex flex-col gap-4">
                    <PageHeader
                        backHref="/admin/grupos"
                        backLabel="Volver a grupos"
                        title={`Grupo ${g.clave_grupo} - ${g.materia_nombre ?? g.materia_clave}`}
                        subtitle={`Periodo ${g.periodo} · ${g.docente_nombre} · Aula ${g.aula_clave}`}
                    />
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <StatCard label="Inscritos activos" value={g.inscritos?.activos ?? 0} hint={`Capacidad ${g.inscritos?.capacidad_aula ?? '-'}`} />
                        <StatCard label="Bajas" value={g.inscritos?.baja ?? 0} />
                        <StatCard label="Sesiones" value={g.sesiones?.total ?? 0} hint={`${g.sesiones?.programadas ?? 0} programadas`} />
                        <StatCard label="Cerradas" value={g.sesiones?.cerradas ?? 0} />
                    </div>
                    <Tabs tabs={TABS} value={tab} onChange={setTab} idPrefix="grupo" />
                    <div role="tabpanel" id={`grupo-panel-${tab}`} aria-labelledby={`grupo-${tab}`}>
                        {tab === 'datos' && (
                            <Card>
                                <GrupoForm grupo={g} onSaved={consulta.refetch} />
                            </Card>
                        )}
                        {tab === 'horario' && (
                            <div className="grid gap-4">
                                <Card title="Horario semanal">
                                    <HorarioEditor idGrupo={g.id_grupo} horario={g.horario} onSaved={consulta.refetch} />
                                </Card>
                                <Card title="Generar sesiones">
                                    <GenerarSesiones idGrupo={g.id_grupo} sinHorario={(g.horario ?? []).length === 0} onGenerated={consulta.refetch} />
                                </Card>
                            </div>
                        )}
                        {tab === 'aula' && <AulaCamaras idAula={g.aula?.id_aula ?? g.id_aula} onChanged={consulta.refetch} />}
                        {tab === 'inscripciones' && (
                            <InscripcionesTabla idGrupo={g.id_grupo} capacidadAula={g.inscritos?.capacidad_aula} onChanged={consulta.refetch} />
                        )}
                    </div>
                </div>
            )}
        </DataState>
    );
}
