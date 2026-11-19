'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import BarraFiltros from '@/components/ui/BarraFiltros';
import Button from '@/components/ui/Button';
import DataState from '@/components/ui/DataState';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import Table from '@/components/ui/Table';
import { useApiQuery } from '@/hooks/data';

const ICONO_NUEVO = <Plus aria-hidden="true" className="size-4" strokeWidth={1.75} />;

/**
 * Tabla genérica de catálogo: búsqueda por texto mientras se escribe (BarraFiltros), filtros opcionales con chips de filtros
 * activos, paginación, estados y formulario en panel lateral para alta/edición.
 * - listar: función de lib/api con { q, limit, offset, ...filtros } -> { total, items }.
 * - Formulario: componente con props { item, onClose, onGuardado } (item = null en altas) más `formularioProps`.
 *   `onGuardado(registro)` solo REFRESCA la lista de detrás; cerrar el panel es cosa del formulario (`onClose`), porque tras un alta
 *   el panel se queda en la pantalla de éxito con el siguiente paso.
 * - permitirEditar=false oculta el botón de edición por fila.
 * - acciones: (fila, { refetch }) => nodo con las acciones por fila (columna «Acciones»); con 3 o más, usa MenuAcciones.
 * - filtros: [{ name, label, options }]; cada uno agrega «Todos» y se manda a `listar` con su `name`.
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
    const [q, setQ] = useState('');
    const [valoresFiltro, setValoresFiltro] = useState({});
    const [pagina, setPagina] = useState({ limit: 25, offset: 0 });
    const [formulario, setFormulario] = useState({ abierto: false, item: null });

    const args = { q: q || undefined, limit: pagina.limit, offset: pagina.offset };
    for (const f of filtros) args[f.name] = valoresFiltro[f.name] || undefined;
    const consulta = useApiQuery(listar, args);

    const alInicio = () => setPagina((p) => ({ ...p, offset: 0 }));
    const abrir = (item = null) => setFormulario({ abierto: true, item });
    const cerrar = () => setFormulario({ abierto: false, item: null });

    const columnasFinal = [
        ...columnas,
        {
            key: '_acciones',
            header: 'Acciones',
            sortable: false,
            align: 'right',
            render: (fila) => (
                // `text-left`: los diálogos de las acciones (cambiar rol, confirmar) se pintan dentro de esta celda alineada a la derecha y
                // heredarían su `text-align`.
                <div className="flex items-center justify-end gap-2 text-left">
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
                actions={Formulario ? <Button icon={ICONO_NUEVO} onClick={() => abrir(null)}>{nuevoLabel}</Button> : null}
            />
            <BarraFiltros
                q={q}
                onQ={(texto) => {
                    setQ(texto);
                    alInicio();
                }}
                placeholder={busquedaLabel}
                label={`Buscar en ${titulo.toLowerCase()}`}
                filtros={filtros.map((f) => ({
                    name: f.name,
                    label: f.label,
                    options: f.options,
                    value: valoresFiltro[f.name] ?? '',
                    onChange: (valor) => {
                        setValoresFiltro((v) => ({ ...v, [f.name]: valor }));
                        alInicio();
                    },
                }))}
            />
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
                        action={Formulario ? <Button icon={ICONO_NUEVO} onClick={() => abrir(null)}>{nuevoLabel}</Button> : undefined}
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
                <Formulario {...formularioProps} item={formulario.item} onClose={cerrar} onGuardado={() => consulta.refetch()} />
            )}
        </div>
    );
}
