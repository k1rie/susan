'use client';

import { useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import Button from '@/components/ui/Button';
import Combobox from '@/components/ui/Combobox';
import DataState from '@/components/ui/DataState';
import EmptyState from '@/components/ui/EmptyState';
import Field from '@/components/ui/Field';
import Pagination from '@/components/ui/Pagination';
import RangoFechas from '@/components/ui/RangoFechas';
import { rangoUltimosDias } from '@/components/ui/RangoFechas/rangoFechas.utils.js';
import Table from '@/components/ui/Table';
import { useApiQuery } from '@/hooks/data';
import { bitacoraListar, usuariosListar } from '@/lib/api/admin.js';
import { etiquetaRol } from '../CrearUsuarioDialog/rolesUsuario.js';
import {
    ACCIONES_BITACORA,
    armarFiltros,
    ENTIDADES_BITACORA,
    etiquetaAccion,
    etiquetaEntidad,
    FILTROS_VACIOS,
    formatearFechaHora,
    hayFiltros,
    jsonLegible,
} from './bitacora.utils.js';

function Bloque({ titulo, valor }) {
    const texto = jsonLegible(valor);
    return (
        <div>
            <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
            {texto ? (
                <pre className="max-h-64 max-w-md overflow-auto rounded-xl bg-muted p-2 text-xs">{texto}</pre>
            ) : (
                <p className="text-xs text-muted-foreground">Sin valor</p>
            )}
        </div>
    );
}

const COLUMNAS = [
    { key: 'fecha_hora', header: 'Fecha y hora', render: (b) => formatearFechaHora(b.fecha_hora) },
    { key: 'usuario_correo', header: 'Usuario', render: (b) => b.usuario_correo ?? <span className="text-muted-foreground">Sistema</span> },
    { key: 'accion', header: 'Acción', primary: true, render: (b) => etiquetaAccion(b.accion) },
    { key: 'entidad', header: 'Entidad', hideBelow: 'sm', render: (b) => `${etiquetaEntidad(b.entidad)}${b.id_registro != null ? ` #${b.id_registro}` : ''}` },
    { key: 'ip_origen', header: 'IP', hideBelow: 'md', render: (b) => b.ip_origen ?? '-' },
    {
        key: 'detalle',
        header: 'Detalle',
        render: (b) => (
            <details>
                <summary className="min-h-9 cursor-pointer py-2 text-link underline">Ver valores</summary>
                <div className="flex flex-col gap-2 py-2">
                    <Bloque titulo="Valor anterior" valor={b.valor_anterior} />
                    <Bloque titulo="Valor nuevo" valor={b.valor_nuevo} />
                </div>
            </details>
        ),
    },
];

// Atajos del rango («Hoy», «7 días», «30 días»); el rango de bitácora no tiene límites de periodo.
const ATAJOS = [
    { label: 'Hoy', valor: ({ hoy }) => ({ desde: hoy, hasta: hoy }) },
    rangoUltimosDias(7, '7 días'),
    rangoUltimosDias(30, '30 días'),
];

// El usuario se busca por correo o nombre (el servidor filtra); la opción dice el rol y el nombre debajo del correo.
const cargarUsuarios = async (q) => {
    const r = await usuariosListar({ q, limit: 15 });
    return (r?.items ?? []).map((u) => ({
        value: String(u.id_usuario),
        label: u.correo,
        description: [etiquetaRol(u.rol), u.nombre].filter(Boolean).join(' · '),
        avatar: u.nombre ?? u.correo,
    }));
};

// RF-20 / RNF-08: bitácora de auditoría, solo lectura. Los filtros se aplican al cambiarlos (sin botón «Filtrar»); un rango de fechas
// inválido no se aplica (RangoFechas lo explica) y la lista conserva el último filtro válido.
export default function BitacoraTabla() {
    const [filtros, setFiltros] = useState(FILTROS_VACIOS);
    const [aplicados, setAplicados] = useState({});
    const [pagina, setPagina] = useState({ limit: 25, offset: 0 });

    const consulta = useApiQuery(bitacoraListar, { ...aplicados, limit: pagina.limit, offset: pagina.offset });

    const cambiar = (parcial) => {
        const siguiente = { ...filtros, ...parcial };
        setFiltros(siguiente);
        const { args, error } = armarFiltros(siguiente);
        if (error) return;
        setAplicados(args);
        setPagina((p) => ({ ...p, offset: 0 }));
    };
    const limpiar = () => {
        setFiltros(FILTROS_VACIOS);
        setAplicados({});
        setPagina((p) => ({ ...p, offset: 0 }));
    };

    return (
        <div className="flex flex-col gap-4">
            <PageHeader title="Bitácora" subtitle="Registro de auditoría (solo lectura)" />
            <div role="search" aria-label="Filtrar bitácora" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Acción">
                        <Combobox
                            options={ACCIONES_BITACORA.map((a) => ({ value: a.value, label: a.label }))}
                            value={filtros.accion}
                            onChange={(valor) => cambiar({ accion: valor })}
                            placeholder="Todas las acciones"
                            clearable
                        />
                    </Field>
                    <Field label="Entidad">
                        <Combobox
                            options={ENTIDADES_BITACORA}
                            value={filtros.entidad}
                            onChange={(valor) => cambiar({ entidad: valor })}
                            placeholder="Todas las entidades"
                            clearable
                        />
                    </Field>
                    <Field label="Usuario" className="sm:col-span-2 lg:col-span-1">
                        <Combobox
                            loadOptions={cargarUsuarios}
                            value={filtros.idUsuario}
                            onChange={(valor) => cambiar({ idUsuario: valor })}
                            placeholder="Correo o nombre"
                            hintText="Escribe al menos 2 caracteres del correo o del nombre."
                            emptyText="Ninguna cuenta coincide."
                            clearable
                        />
                    </Field>
                </div>
                <RangoFechas
                    label="Periodo"
                    desde={filtros.desde}
                    hasta={filtros.hasta}
                    onChange={({ desde, hasta }) => cambiar({ desde, hasta })}
                    atajos={ATAJOS}
                />
                {hayFiltros(filtros) && (
                    <div>
                        <Button variant="ghost" size="sm" onClick={limpiar}>
                            Limpiar filtros
                        </Button>
                    </div>
                )}
            </div>
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
