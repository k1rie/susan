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
import Table from '@/components/ui/Table';
import { useApiQuery } from '@/hooks/data';
import { gruposListar } from '@/lib/api/admin.js';

const COLUMNAS = [
    {
        key: 'clave_grupo',
        header: 'Grupo',
        primary: true,
        render: (g) => (
            <Link href={`/admin/grupos/${g.id_grupo}`} className="text-primary underline">
                {g.clave_grupo}
            </Link>
        ),
    },
    { key: 'periodo', header: 'Periodo' },
    { key: 'materia', header: 'Materia', render: (g) => `${g.materia_clave} - ${g.materia_nombre}` },
    { key: 'docente_nombre', header: 'Docente' },
    { key: 'aula_clave', header: 'Aula' },
    { key: 'inscritos_activos', header: 'Inscritos', align: 'right' },
    { key: 'sesiones_total', header: 'Sesiones', align: 'right' },
];

// P-09 (listado): grupos por periodo con búsqueda, inscritos y sesiones.
export default function GruposTabla() {
    const [borrador, setBorrador] = useState({ q: '', periodo: '' });
    const [filtros, setFiltros] = useState({ q: '', periodo: '' });
    const [pagina, setPagina] = useState({ limit: 25, offset: 0 });

    const consulta = useApiQuery(gruposListar, {
        q: filtros.q || undefined,
        periodo: filtros.periodo || undefined,
        limit: pagina.limit,
        offset: pagina.offset,
    });

    const buscar = (e) => {
        e.preventDefault();
        setFiltros({ q: borrador.q.trim(), periodo: borrador.periodo.trim() });
        setPagina((p) => ({ ...p, offset: 0 }));
    };

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Grupos"
                subtitle="Grupos, horarios, aulas e inscripciones"
                actions={<Button href="/admin/grupos/nuevo">Nuevo grupo</Button>}
            />
            <form onSubmit={buscar} role="search" aria-label="Buscar grupos" className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
                <Field label="Materia, docente o clave">
                    <Input type="search" value={borrador.q} onChange={(e) => setBorrador((b) => ({ ...b, q: e.target.value }))} />
                </Field>
                <Field label="Periodo" hint="AAAA-S">
                    <Input value={borrador.periodo} placeholder="2026-2" onChange={(e) => setBorrador((b) => ({ ...b, periodo: e.target.value }))} />
                </Field>
                <Button type="submit" variant="secondary">
                    Buscar
                </Button>
            </form>
            <DataState
                loading={consulta.loading}
                error={consulta.error}
                data={consulta.data}
                onRetry={consulta.refetch}
                isEmpty={(d) => !d.items || d.items.length === 0}
                empty={
                    <EmptyState
                        title="No hay grupos"
                        description="Cambia la búsqueda o crea un grupo nuevo."
                        action={<Button href="/admin/grupos/nuevo">Nuevo grupo</Button>}
                    />
                }
            >
                {(d) => (
                    <>
                        <Table columns={COLUMNAS} rows={d.items} rowKey="id_grupo" caption={`${d.total} grupo(s)`} />
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
