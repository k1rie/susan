'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import BarraFiltros from '@/components/ui/BarraFiltros';
import Button from '@/components/ui/Button';
import DataState from '@/components/ui/DataState';
import EmptyState from '@/components/ui/EmptyState';
import MenuAcciones from '@/components/ui/MenuAcciones';
import Pagination from '@/components/ui/Pagination';
import Table from '@/components/ui/Table';
import { useApiQuery } from '@/hooks/data';
import { gruposListar } from '@/lib/api/admin.js';
import { plural } from '../compartido/grupos.utils.js';
import { useHoyNegocio } from '../compartido/useHoyNegocio.js';
import { opcionesPeriodo } from './gruposTabla.utils.js';

// El menú de acciones va junto a la clave del grupo (primera columna): en 360 px la tabla se desplaza en horizontal y una columna de acciones
// al final quedaría fuera de pantalla.
const columnas = (router) => [
    {
        key: 'clave_grupo',
        header: 'Grupo',
        primary: true,
        render: (g) => (
            <span className="flex items-center gap-1">
                <Link href={`/admin/grupos/${g.id_grupo}`} className="text-link underline">
                    {g.clave_grupo}
                </Link>
                <MenuAcciones
                    label={`Acciones del grupo ${g.clave_grupo}`}
                    items={[
                        { label: 'Abrir grupo', onClick: () => router.push(`/admin/grupos/${g.id_grupo}`) },
                        { label: 'Editar horario', onClick: () => router.push(`/admin/grupos/${g.id_grupo}?tab=horario`) },
                        { label: 'Inscribir alumnos', onClick: () => router.push(`/admin/grupos/${g.id_grupo}?tab=inscripciones`) },
                    ]}
                />
            </span>
        ),
    },
    { key: 'periodo', header: 'Periodo' },
    { key: 'materia', header: 'Materia', render: (g) => `${g.materia_clave} - ${g.materia_nombre}` },
    { key: 'docente_nombre', header: 'Docente' },
    { key: 'aula_clave', header: 'Aula' },
    { key: 'inscritos_activos', header: 'Inscritos', align: 'right' },
    { key: 'sesiones_total', header: 'Sesiones', align: 'right' },
];

// P-09 (listado): grupos por periodo con búsqueda mientras se escribe (BarraFiltros: retraso, chips de filtros activos y «Limpiar»), el
// periodo como selector y un menú de acciones por fila que lleva directo a la pestaña de horario o de inscripciones.
export default function GruposTabla() {
    const router = useRouter();
    const { hoy } = useHoyNegocio();
    const [filtros, setFiltros] = useState({ q: '', periodo: '' });
    const [pagina, setPagina] = useState({ limit: 25, offset: 0 });

    const consulta = useApiQuery(gruposListar, {
        q: filtros.q || undefined,
        periodo: filtros.periodo || undefined,
        limit: pagina.limit,
        offset: pagina.offset,
    });

    const filtrar = (cambio) => {
        setFiltros((f) => ({ ...f, ...cambio }));
        setPagina((p) => ({ ...p, offset: 0 }));
    };
    const hayFiltros = Boolean(filtros.q || filtros.periodo);
    const periodos = opcionesPeriodo({ hoy, actual: filtros.periodo, items: consulta.data?.items });

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Grupos"
                subtitle="Grupos, horarios, aulas e inscripciones"
                actions={<Button href="/admin/grupos/nuevo">Nuevo grupo</Button>}
            />
            <BarraFiltros
                q={filtros.q}
                onQ={(q) => filtrar({ q })}
                placeholder="Materia, docente o clave"
                label="Buscar grupos"
                resultado={consulta.data ? plural(consulta.data.total, 'grupo') : undefined}
                filtros={[
                    {
                        name: 'periodo',
                        label: 'Periodo',
                        todosLabel: 'Todos los periodos',
                        options: periodos.map((p) => ({ value: p, label: p })),
                        value: filtros.periodo,
                        onChange: (periodo) => filtrar({ periodo }),
                    },
                ]}
            />
            <DataState
                loading={consulta.loading}
                error={consulta.error}
                data={consulta.data}
                onRetry={consulta.refetch}
                isEmpty={(d) => !d.items || d.items.length === 0}
                empty={
                    <EmptyState
                        title="No hay grupos"
                        description={hayFiltros ? 'Ningún grupo coincide con la búsqueda. Cambia los filtros o crea un grupo nuevo.' : 'Aún no hay grupos registrados. Crea el primero.'}
                        action={<Button href="/admin/grupos/nuevo">Nuevo grupo</Button>}
                    />
                }
            >
                {(d) => (
                    <>
                        <Table columns={columnas(router)} rows={d.items} rowKey="id_grupo" caption={`${d.total} grupo(s)`} />
                        <Pagination
                            total={d.total}
                            limit={pagina.limit}
                            offset={pagina.offset}
                            onChange={(c) => setPagina((p) => ({ ...p, ...c }))}
                            onLimitChange={(limit) => setPagina({ limit, offset: 0 })}
                        />
                    </>
                )}
            </DataState>
        </div>
    );
}
