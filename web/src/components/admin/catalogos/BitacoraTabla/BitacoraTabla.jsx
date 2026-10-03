'use client';

import { useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import DataState from '@/components/ui/DataState';
import EmptyState from '@/components/ui/EmptyState';
import Field from '@/components/ui/Field';
import Input from '@/components/ui/Input';
import Pagination from '@/components/ui/Pagination';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import { useApiQuery } from '@/hooks/data';
import { bitacoraListar } from '@/lib/api/admin.js';
import { ACCIONES_BITACORA, FILTROS_VACIOS, armarFiltros, etiquetaAccion, formatearFechaHora, jsonLegible } from './bitacora.utils.js';

function Bloque({ titulo, valor }) {
    const texto = jsonLegible(valor);
    return (
        <div>
            <p className="text-xs font-medium text-muted">{titulo}</p>
            {texto ? (
                <pre className="max-h-64 max-w-md overflow-auto rounded-md bg-surface-muted p-2 text-xs">{texto}</pre>
            ) : (
                <p className="text-xs text-muted">Sin valor</p>
            )}
        </div>
    );
}

const COLUMNAS = [
    { key: 'fecha_hora', header: 'Fecha y hora', render: (b) => formatearFechaHora(b.fecha_hora) },
    { key: 'usuario_correo', header: 'Usuario', render: (b) => b.usuario_correo ?? <span className="text-muted">Sistema</span> },
    { key: 'accion', header: 'Acción', primary: true, render: (b) => etiquetaAccion(b.accion) },
    { key: 'entidad', header: 'Entidad', render: (b) => `${b.entidad}${b.id_registro != null ? ` #${b.id_registro}` : ''}` },
    { key: 'ip_origen', header: 'IP', render: (b) => b.ip_origen ?? '-' },
    {
        key: 'detalle',
        header: 'Detalle',
        render: (b) => (
            <details>
                <summary className="min-h-9 cursor-pointer py-2 text-primary underline">Ver valores</summary>
                <div className="flex flex-col gap-2 py-2">
                    <Bloque titulo="Valor anterior" valor={b.valor_anterior} />
                    <Bloque titulo="Valor nuevo" valor={b.valor_nuevo} />
                </div>
            </details>
        ),
    },
];

// RF-20 / RNF-08: bitácora de auditoría, solo lectura, con filtros y paginación.
export default function BitacoraTabla() {
    const [borrador, setBorrador] = useState(FILTROS_VACIOS);
    const [aplicados, setAplicados] = useState({});
    const [errorFiltros, setErrorFiltros] = useState(null);
    const [pagina, setPagina] = useState({ limit: 25, offset: 0 });

    const consulta = useApiQuery(bitacoraListar, { ...aplicados, limit: pagina.limit, offset: pagina.offset });
    const cambiar = (c) => (e) => setBorrador((b) => ({ ...b, [c]: e.target.value }));

    const aplicar = (e) => {
        e.preventDefault();
        const { args, error } = armarFiltros(borrador);
        setErrorFiltros(error);
        if (error) return;
        setAplicados(args);
        setPagina((p) => ({ ...p, offset: 0 }));
    };
    const limpiar = () => {
        setBorrador(FILTROS_VACIOS);
        setAplicados({});
        setErrorFiltros(null);
        setPagina((p) => ({ ...p, offset: 0 }));
    };

    return (
        <div className="flex flex-col gap-4">
            <PageHeader title="Bitácora" subtitle="Registro de auditoría (solo lectura)" />
            <form onSubmit={aplicar} role="search" aria-label="Filtrar bitácora" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
                <Field label="Acción">
                    <Select value={borrador.accion} onChange={cambiar('accion')} options={[{ value: '', label: 'Todas' }, ...ACCIONES_BITACORA]} />
                </Field>
                <Field label="Entidad">
                    <Input value={borrador.entidad} onChange={cambiar('entidad')} autoComplete="off" />
                </Field>
                <Field label="ID de usuario">
                    <Input inputMode="numeric" value={borrador.idUsuario} onChange={cambiar('idUsuario')} autoComplete="off" />
                </Field>
                <Field label="Desde">
                    <Input type="date" value={borrador.desde} onChange={cambiar('desde')} />
                </Field>
                <Field label="Hasta">
                    <Input type="date" value={borrador.hasta} onChange={cambiar('hasta')} />
                </Field>
                <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-5">
                    <Button type="submit">Filtrar</Button>
                    <Button variant="secondary" onClick={limpiar}>
                        Limpiar
                    </Button>
                </div>
            </form>
            {errorFiltros && (
                <Alert tone="danger" aria-live="assertive">
                    {errorFiltros}
                </Alert>
            )}
            <DataState
                loading={consulta.loading}
                error={consulta.error}
                data={consulta.data}
                onRetry={consulta.refetch}
                isEmpty={(d) => !d.items?.length}
                empty={<EmptyState title="Sin movimientos" description="No hay registros de bitácora con estos filtros." />}
            >
                {(d) => (
                    <div className="flex flex-col gap-3">
                        <Table columns={COLUMNAS} rows={d.items} rowKey="id_bitacora" caption={`${d.total} movimiento(s)`} />
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
