'use client';

import Link from 'next/link';
import { useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import BarraFiltros from '@/components/ui/BarraFiltros';
import Button from '@/components/ui/Button';
import DataState from '@/components/ui/DataState';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import Table from '@/components/ui/Table';
import { useApiQuery } from '@/hooks/data';
import { alumnosListar } from '@/lib/api/admin.js';
import { ESTATUS_ALUMNO } from '../AlumnoForm/alumnoForm.utils.js';
import IndicadorEstado from '../IndicadorEstado';
import EstatusAlumno from '../IndicadorEstado/EstatusAlumno.jsx';
import FilaAlumno from './FilaAlumno.jsx';

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
    { key: 'estatus', header: 'Estatus', render: (a) => <EstatusAlumno estatus={a.estatus} /> },
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

const SIN_FILTROS = { q: '', estatus: '' };

// P-06 (listado): búsqueda por matrícula, nombre o correo mientras se escribe, filtro de estatus con chips de lo activo y paginación.
// En teléfono cada alumno es una tarjeta (la tabla no cabe en 360 px sin desplazarse); desde `md`, la tabla.
export default function ListadoAlumnos() {
    const [filtros, setFiltros] = useState(SIN_FILTROS);
    const [pagina, setPagina] = useState({ limit: 25, offset: 0 });

    const consulta = useApiQuery(alumnosListar, {
        q: filtros.q || undefined,
        estatus: filtros.estatus || undefined,
        limit: pagina.limit,
        offset: pagina.offset,
    });

    const aplicar = (cambio) => {
        setFiltros((f) => ({ ...f, ...cambio }));
        setPagina((p) => ({ ...p, offset: 0 }));
    };
    const limpiar = () => {
        setFiltros(SIN_FILTROS);
        setPagina((p) => ({ ...p, offset: 0 }));
    };
    const hayFiltros = Boolean(filtros.q || filtros.estatus);
    const total = consulta.data?.total;

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Alumnos"
                subtitle="Alta, consentimiento y plantilla facial"
                actions={<Button href="/admin/alumnos/nuevo">Nuevo alumno</Button>}
            />
            <BarraFiltros
                q={filtros.q}
                onQ={(q) => aplicar({ q })}
                onLimpiar={limpiar}
                label="Buscar alumnos"
                placeholder="Matrícula, nombre o correo"
                resultado={total === undefined ? undefined : `${total} ${total === 1 ? 'alumno' : 'alumnos'}`}
                filtros={[{ name: 'estatus', label: 'Estatus', options: ESTATUS_ALUMNO, value: filtros.estatus, onChange: (estatus) => aplicar({ estatus }) }]}
            />
            <DataState
                loading={consulta.loading}
                error={consulta.error}
                data={consulta.data}
                onRetry={consulta.refetch}
                isEmpty={(d) => !d.items?.length}
                empty={
                    hayFiltros ? (
                        <EmptyState
                            title="Ningún alumno coincide"
                            description="Prueba con otra matrícula o nombre, o quita los filtros."
                            action={
                                <div className="flex flex-wrap justify-center gap-2">
                                    <Button variant="secondary" onClick={limpiar}>
                                        Limpiar filtros
                                    </Button>
                                    <Button href="/admin/alumnos/nuevo">Nuevo alumno</Button>
                                </div>
                            }
                        />
                    ) : (
                        <EmptyState
                            title="Aún no hay alumnos registrados"
                            description="Da de alta al primero para registrar su consentimiento y su plantilla facial."
                            action={<Button href="/admin/alumnos/nuevo">Nuevo alumno</Button>}
                        />
                    )
                }
            >
                {(d) => (
                    <div className="flex flex-col gap-3">
                        <ul aria-label="Alumnos" className="flex flex-col gap-2 md:hidden">
                            {d.items.map((a) => (
                                <li key={a.id_alumno}>
                                    <FilaAlumno alumno={a} />
                                </li>
                            ))}
                        </ul>
                        <Table className="hidden md:block" columns={COLUMNAS} rows={d.items} rowKey="id_alumno" />
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
