'use client';

import { memo } from 'react';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { formatearHoraIso } from '../MonitorSesion/monitorSesion.utils.js';

// Siempre texto + color: el segmentado pinta un punto del color y, al elegir, fondo y palomita.
const ESTADOS = [
    { value: 'presente', label: 'Presente', tone: 'presente' },
    { value: 'retardo', label: 'Retardo', tone: 'retardo' },
    { value: 'ausente', label: 'Ausente', tone: 'ausente' },
];

// Una fila = un alumno con su estado a UN toque (antes eran dos: abrir el select y elegir). En teléfono el nombre va arriba y el
// segmentado ocupa todo el ancho (blanco táctil de 44 px, alcanzable con el pulgar); desde `sm` quedan en la misma línea.
function FilaAlumnoPase({ alumno, marca, onMarcar }) {
    const guardado = alumno.hora_registro ? formatearHoraIso(alumno.hora_registro).slice(0, 5) : null;
    return (
        <li
            data-alumno={alumno.id_alumno}
            className="flex flex-col gap-2 border-t border-border py-2.5 first:border-t-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        >
            {/* Nombre y matrícula en la misma línea (el nombre manda; si no cabe, baja en lugar de cortarse con «…»): una fila menos alta
                significa menos desplazamiento con 30 alumnos. */}
            <p className="min-w-0 break-words text-sm sm:flex-1">
                <span className="font-medium">{alumno.nombre}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                    {' · '}
                    {alumno.matricula}
                    {/* La hora de lo ya guardado solo desde `sm`: en teléfono repetiría «Registrado 09:10» en 30 filas y alargaría cada una. */}
                    {guardado && <span className="hidden sm:inline">{` · Registrado ${guardado}`}</span>}
                </span>
            </p>
            <SegmentedControl
                label={`Estado de ${alumno.nombre}`}
                items={ESTADOS}
                value={marca ?? ''}
                onChange={(estado) => onMarcar(alumno.id_alumno, estado)}
                fullWidth
                className="sm:w-72 sm:flex-none"
            />
        </li>
    );
}

export default memo(FilaAlumnoPase);
