'use client';

import { CalendarCheck, CalendarDays, UserMinus, Users } from 'lucide-react';
import { useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import DataState from '@/components/ui/DataState';
import StatCard from '@/components/ui/StatCard';
import Tabs from '@/components/ui/Tabs';
import { useApiQuery } from '@/hooks/data';
import { useCambiosSinGuardar } from '@/hooks/ui/useCambiosSinGuardar.js';
import { grupoObtener, materiaObtener } from '@/lib/api/admin.js';
import AulaCamaras from '../AulaCamaras';
import GenerarSesiones from '../GenerarSesiones';
import GrupoForm from '../GrupoForm';
import HorarioEditor from '../HorarioEditor';
import InscripcionesTabla from '../InscripcionesTabla';
import { APOYO_BAJAS, apoyoSesiones, pestanaValida, tarjetaCerradas, tarjetaInscritos } from './grupoDetalle.utils.js';

const TABS = [
    { id: 'datos', label: 'Datos' },
    { id: 'horario', label: 'Horario' },
    { id: 'aula', label: 'Aula y cámaras' },
    { id: 'inscripciones', label: 'Inscripciones' },
];

const MENSAJE_PESTANA = 'Tienes cambios sin guardar en esta pestaña. Si cambias de pestaña, se perderán.';

// P-09 detalle de grupo con pestañas. La ficha se recarga tras cada cambio para mantener resúmenes al día.
// La pestaña activa vive en `?tab=` (deep links desde el éxito del alta y la lista; se conserva al recargar). Cada pestaña desmonta su
// contenido, así que los formularios avisan aquí si tienen cambios sin guardar (`onSucioChange`) y `Tabs.confirmLeave` pregunta antes de
// cambiar de pestaña; recargar o cerrar la ventana también avisa (useCambiosSinGuardar).
export default function GrupoDetalle({ idGrupo, tabInicial }) {
    const consulta = useApiQuery(grupoObtener, { idGrupo });
    const [tab, setTab] = useState(() => pestanaValida(tabInicial));
    const [inicialVisto, setInicialVisto] = useState(tabInicial);
    const [sucio, setSucio] = useState(false);
    const { confirmarSalida } = useCambiosSinGuardar(sucio);
    // Horas por semana que declara la materia, solo para comparar con el total del horario (la ficha del grupo no las trae).
    const idMateria = consulta.data?.id_materia;
    const materia = useApiQuery(materiaObtener, { idMateria }, { enabled: Boolean(idMateria) && tab === 'horario' });

    // Si la ruta llega con otra pestaña (un enlace a ?tab=…), la pantalla la sigue.
    if (tabInicial !== inicialVisto) {
        setInicialVisto(tabInicial);
        setTab(pestanaValida(tabInicial));
    }

    const cambiarTab = (id) => {
        setTab(id);
        setSucio(false);
        // La URL refleja la pestaña sin recargar ni apilar historial (replaceState se integra con el router de Next).
        const url = new URL(window.location.href);
        url.searchParams.set('tab', id);
        window.history.replaceState(null, '', url);
    };

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
                        <StatCard icon={Users} label="Inscritos activos" {...tarjetaInscritos(g.inscritos)} />
                        <StatCard icon={UserMinus} label="Bajas" value={g.inscritos?.baja ?? 0} hint={APOYO_BAJAS} />
                        <StatCard icon={CalendarDays} label="Sesiones" value={g.sesiones?.total ?? 0} hint={apoyoSesiones(g.sesiones)} />
                        <StatCard icon={CalendarCheck} label="Cerradas" {...tarjetaCerradas(g.sesiones)} />
                    </div>
                    <Tabs tabs={TABS} value={tab} onChange={cambiarTab} idPrefix="grupo" confirmLeave={() => confirmarSalida(MENSAJE_PESTANA)} />
                    <div role="tabpanel" id={`grupo-panel-${tab}`} aria-labelledby={`grupo-${tab}`}>
                        {tab === 'datos' && (
                            <Card>
                                <GrupoForm grupo={g} onSaved={consulta.refetch} onSucioChange={setSucio} />
                            </Card>
                        )}
                        {tab === 'horario' && (
                            <div className="grid gap-4">
                                <Card title="Horario semanal">
                                    <HorarioEditor idGrupo={g.id_grupo} horario={g.horario} horasMateria={materia.data?.horas_semana} onSaved={consulta.refetch} onSucioChange={setSucio} />
                                </Card>
                                <Card title="Generar sesiones">
                                    <GenerarSesiones idGrupo={g.id_grupo} horario={g.horario} sinHorario={(g.horario ?? []).length === 0} onGenerated={consulta.refetch} onNavegar={cambiarTab} />
                                </Card>
                            </div>
                        )}
                        {tab === 'aula' && <AulaCamaras idAula={g.aula?.id_aula ?? g.id_aula} inscritosActivos={g.inscritos?.activos} onChanged={consulta.refetch} onSucioChange={setSucio} />}
                        {tab === 'inscripciones' && (
                            <InscripcionesTabla idGrupo={g.id_grupo} capacidadAula={g.inscritos?.capacidad_aula} onChanged={consulta.refetch} />
                        )}
                    </div>
                </div>
            )}
        </DataState>
    );
}
