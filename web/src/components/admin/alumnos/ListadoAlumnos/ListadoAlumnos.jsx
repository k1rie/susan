'use client';

import Link from 'next/link';
import { useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import Button from '@/components/ui/Button';
import DataState from '@/components/ui/DataState';
import EmptyState from '@/components/ui/EmptyState';
import Field from '@/components/ui/Field';
import Input from '@/components/ui/Input';
import Pagination from '@/components/ui/Pagination';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import { useApiQuery } from '@/hooks/data';
import { alumnosListar } from '@/lib/api/admin.js';
import { ESTATUS_ALUMNO, etiquetaEstatus } from '../AlumnoForm/alumnoForm.utils.js';
import IndicadorEstado from '../IndicadorEstado';

const COLUMNAS = [
    {
        key: 'matricula',
        header: 'Matrícula',
        primary: true,
        render: (a) => (
            <Link href={`/admin/alumnos/${a.id_alumno}`} className="text-link underline">
                {a.matricula}
            </Link>
        ),
    },
    { key: 'nombre_completo', header: 'Nombre' },
    { key: 'estatus', header: 'Estatus', render: (a) => etiquetaEstatus(a.estatus) },
    {
        key: 'consentimiento_vigente',
        header: 'Consentimiento',
        render: (a) => <IndicadorEstado ok={a.consentimiento_vigente} textoOk="Vigente" textoNo="Sin consentimiento" toneNo="warning" />,
    },
    {
        key: 'plantilla_activa',
        header: 'Plantilla facial',
        render: (a) => <IndicadorEstado ok={a.plantilla_activa} textoOk="Activa" textoNo="Sin plantilla" />,
    },
];

// P-06 (listado): búsqueda por matrícula o nombre, filtro de estatus y paginación.
export default function ListadoAlumnos() {
    const [borrador, setBorrador] = useState('');
    const [filtros, setFiltros] = useState({ q: '', estatus: '' });
    const [pagina, setPagina] = useState({ limit: 25, offset: 0 });

    const consulta = useApiQuery(alumnosListar, {
        q: filtros.q || undefined,
        estatus: filtros.estatus || undefined,
        limit: pagina.limit,
        offset: pagina.offset,
    });

    const buscar = (e) => {
        e.preventDefault();
        setFiltros((f) => ({ ...f, q: borrador.trim() }));
        setPagina((p) => ({ ...p, offset: 0 }));
    };

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Alumnos"
                subtitle="Alta, consentimiento y plantilla facial"
                actions={<Button href="/admin/alumnos/nuevo">Nuevo alumno</Button>}
            />
            <form onSubmit={buscar} role="search" aria-label="Buscar alumnos" className="grid gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
                <Field label="Matrícula o nombre">
                    <Input type="search" value={borrador} onChange={(e) => setBorrador(e.target.value)} />
                </Field>
                <Field label="Estatus">
                    <Select
                        value={filtros.estatus}
                        onChange={(e) => {
                            setFiltros((f) => ({ ...f, estatus: e.target.value }));
                            setPagina((p) => ({ ...p, offset: 0 }));
                        }}
                        options={[{ value: '', label: 'Todos' }, ...ESTATUS_ALUMNO]}
                    />
                </Field>
                <Button type="submit">Buscar</Button>
            </form>
            <DataState
                loading={consulta.loading}
                error={consulta.error}
                data={consulta.data}
                onRetry={consulta.refetch}
                isEmpty={(d) => !d.items?.length}
                empty={
                    <EmptyState
                        title="No hay alumnos que coincidan"
                        description="Pruebe con otra búsqueda o dé de alta un alumno nuevo."
                        action={<Button href="/admin/alumnos/nuevo">Nuevo alumno</Button>}
                    />
                }
            >
                {(d) => (
                    <div className="flex flex-col gap-3">
                        <Table columns={COLUMNAS} rows={d.items} rowKey="id_alumno" caption={`${d.total} alumno(s)`} />
                        <Pagination
                            total={d.total}
                            limit={pagina.limit}
                            offset={pagina.offset}
                            onChange={({ offset }) => setPagina((p) => ({ ...p, offset }))}
                            onLimitChange={(limit) => setPagina({ limit, offset: 0 })}
                        />
                    </div>
                )}
            </DataState>
        </div>
    );
}
