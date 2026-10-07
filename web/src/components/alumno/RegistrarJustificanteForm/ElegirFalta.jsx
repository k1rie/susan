'use client';

import { CalendarX2, Clock } from 'lucide-react';
import Combobox from '@/components/ui/Combobox';
import Field from '@/components/ui/Field';
import StatusChip from '@/components/ui/StatusChip';
import TarjetaOpcion from '@/components/ui/TarjetaOpcion';
import EtiquetaPaso from './EtiquetaPaso.jsx';
import { MAX_TARJETAS, datosFalta } from './registrarJustificante.utils.js';

const ETIQUETA_ESTADO = { ausente: 'Ausente', retardo: 'Retardo' };
const ETIQUETA = 'Falta o retardo a justificar';

// Contenido de una opción del selector: materia y grupo arriba; fecha, estado (texto y color) y rechazo previo debajo.
function DetalleOpcion({ falta }) {
    return (
        <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{falta.titulo}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>{falta.fecha}</span>
                <StatusChip kind="asistencia" value={falta.estado} size="sm" />
                {falta.rechazado && (
                    <span className="inline-flex items-center gap-1">
                        Justificante anterior <StatusChip kind="justificante" value="rechazado" size="sm" />
                    </span>
                )}
            </span>
        </span>
    );
}

// Paso 1: qué se justifica. Con pocas faltas se ven TODAS como tarjetas (un toque, sin abrir nada; el estado va con texto y color);
// con muchas, un selector con búsqueda por materia o fecha. Si una falta ya tuvo un justificante rechazado, se dice en la propia opción
// (api_mis_justificables trae `tiene_rechazado`).
export default function ElegirFalta({ registros, value, onChange, error }) {
    const faltas = registros.map(datosFalta);
    const etiqueta = (
        <EtiquetaPaso n={1} hecho={Boolean(value)}>
            {ETIQUETA}
        </EtiquetaPaso>
    );

    if (faltas.length > MAX_TARJETAS) {
        return (
            <Field label={etiqueta} required error={error}>
                <Combobox
                    // La etiqueta empieza con la fecha: es lo que queda escrito en el campo al elegir (varias faltas de la misma materia se
                    // distinguen por el día) y, a 360 px, lo que se alcanza a leer antes de que el texto se corte. La opción se dibuja con el
                    // estado en texto y color y el aviso de rechazo.
                    options={faltas.map((f) => ({
                        value: f.value,
                        label: `${f.fecha} · ${f.titulo}`,
                        description: `${ETIQUETA_ESTADO[f.estado] ?? f.estado}${f.rechazado ? ' · Justificante anterior rechazado' : ''}`,
                        falta: f,
                    }))}
                    renderOption={(o) => <DetalleOpcion falta={o.falta} />}
                    value={value}
                    onChange={(valor) => onChange(valor)}
                    placeholder="Busca por materia o fecha"
                    emptyText="Ninguna falta coincide"
                    invalid={Boolean(error)}
                />
            </Field>
        );
    }

    return (
        <Field as="fieldset" label={etiqueta} required error={error}>
            <TarjetaOpcion
                columnas={1}
                value={value}
                onChange={onChange}
                invalid={Boolean(error)}
                required
                opciones={faltas.map((f) => ({
                    value: f.value,
                    titulo: f.titulo,
                    icono: f.estado === 'retardo' ? Clock : CalendarX2,
                    descripcion: (
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span>{f.fecha}</span>
                            <StatusChip kind="asistencia" value={f.estado} size="sm" />
                            {f.rechazado && (
                                <span className="inline-flex items-center gap-1">
                                    Justificante anterior <StatusChip kind="justificante" value="rechazado" size="sm" />
                                </span>
                            )}
                        </span>
                    ),
                }))}
            />
        </Field>
    );
}
