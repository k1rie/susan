'use client';

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

/**
 * Tabla genérica de catálogo: búsqueda por texto, filtros opcionales (selects), paginación, estados y
 * formulario modal para alta/edición.
 * - listar: función de lib/api con { q, limit, offset, ...filtros } -> { total, items }.
 * - Formulario: componente con props { item, onClose, onGuardado } (item = null en altas).
 * - permitirEditar=false oculta el botón de edición por fila; formularioProps se pasa tal cual al Formulario.
 * - acciones: (fila, { refetch }) => nodo con botones por fila (columna "Acciones").
 */
export default function CatalogoTabla({
    titulo,
    subtitulo,
    listar,
    columnas,
    rowKey,
    Formulario,
    nuevoLabel = 'Nuevo',
    editarLabel = 'Editar',
    acciones,
    filtros = [],
    busquedaLabel = 'Buscar',
    unidad = 'registro(s)',
    vacioTitulo = 'No hay registros que coincidan',
    permitirEditar = true,
    formularioProps,
}) {
    const [borrador, setBorrador] = useState('');
    const [q, setQ] = useState('');
    const [valoresFiltro, setValoresFiltro] = useState({});
    const [pagina, setPagina] = useState({ limit: 25, offset: 0 });
    const [formulario, setFormulario] = useState({ abierto: false, item: null });

    const args = { q: q || undefined, limit: pagina.limit, offset: pagina.offset };
    for (const f of filtros) args[f.name] = valoresFiltro[f.name] || undefined;
    const consulta = useApiQuery(listar, args);

    const buscar = (e) => {
        e.preventDefault();
        setQ(borrador.trim());
        setPagina((p) => ({ ...p, offset: 0 }));
    };
    const abrir = (item = null) => setFormulario({ abierto: true, item });
    const cerrar = () => setFormulario({ abierto: false, item: null });

    const columnasFinal = [
        ...columnas,
        {
            key: '_acciones',
            header: 'Acciones',
            sortable: false,
            render: (fila) => (
                <div className="flex flex-wrap gap-2">
                    {Formulario && permitirEditar && (
                        <Button size="sm" variant="secondary" onClick={() => abrir(fila)}>
                            {editarLabel}
                        </Button>
                    )}
                    {acciones?.(fila, { refetch: consulta.refetch })}
                </div>
            ),
        },
    ];

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title={titulo}
                subtitle={subtitulo}
                actions={Formulario ? <Button onClick={() => abrir(null)}>{nuevoLabel}</Button> : null}
            />
            <form
                onSubmit={buscar}
                role="search"
                aria-label={`Buscar en ${titulo.toLowerCase()}`}
                className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
                <Field label={busquedaLabel} className="sm:flex-1">
                    <Input type="search" value={borrador} onChange={(e) => setBorrador(e.target.value)} />
                </Field>
                {filtros.map((f) => (
                    <Field key={f.name} label={f.label} className="sm:w-48">
                        <Select
                            value={valoresFiltro[f.name] ?? ''}
                            onChange={(e) => {
                                setValoresFiltro((v) => ({ ...v, [f.name]: e.target.value }));
                                setPagina((p) => ({ ...p, offset: 0 }));
                            }}
                            options={[{ value: '', label: 'Todos' }, ...f.options]}
                        />
                    </Field>
                ))}
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
                        title={vacioTitulo}
                        description="Pruebe con otra búsqueda o agregue un registro nuevo."
                        action={Formulario ? <Button onClick={() => abrir(null)}>{nuevoLabel}</Button> : undefined}
                    />
                }
            >
                {(d) => (
                    <div className="flex flex-col gap-3">
                        <Table columns={columnasFinal} rows={d.items} rowKey={rowKey} caption={`${d.total} ${unidad}`} />
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
            {Formulario && formulario.abierto && (
                <Formulario
                    {...formularioProps}
                    item={formulario.item}
                    onClose={cerrar}
                    onGuardado={() => {
                        cerrar();
                        consulta.refetch();
                    }}
                />
            )}
        </div>
    );
}
