'use client';

import { memo } from 'react';
import GraficaDona from '@/components/ui/GraficaDona';
import TarjetaGrafica from '@/components/ui/TarjetaGrafica';
import { CONFIG_ASISTENCIA, resumenTexto } from '@/lib/graficas.js';
import {
    CLAVES_ASISTENCIA,
    CONFIG_SESION_ABIERTA,
    centroAsistencia,
    distribucionSesionAbierta,
    distribucionSesionCerrada,
    mismosValores,
} from '../MonitorSesion/monitorSesion.utils.js';

// Dona de asistencia de la sesión: en curso (con «Sin registro») o cerrada (los cinco estados). `totales` = de api_sesion_monitor.
// Va memoizada por valor: el monitor sondea cada 5 s y sin esto la dona se redibujaría con cada respuesta, aunque no cambie nada
// (GraficaDona arma arreglos nuevos en cada render, así que memorizar solo los datos desde afuera no basta).
function GraficaAsistenciaSesion({ totales, cerrada = false }) {
    const estados = cerrada ? distribucionSesionCerrada(totales) : distribucionSesionAbierta(totales);
    const config = cerrada ? CONFIG_ASISTENCIA : CONFIG_SESION_ABIERTA;
    return (
        <TarjetaGrafica titulo="Asistencia de la sesión" descripcion="Presentes y retardos sobre inscritos" resumen={resumenTexto(estados, config)}>
            <GraficaDona
                datos={estados}
                config={config}
                centro={centroAsistencia(totales)}
                alto={230}
                vacio={cerrada ? 'La sesión no tuvo alumnos inscritos' : 'Aún no hay alumnos inscritos'}
            />
        </TarjetaGrafica>
    );
}

export default memo(
    GraficaAsistenciaSesion,
    (previo, nuevo) => previo.cerrada === nuevo.cerrada && mismosValores(previo.totales, nuevo.totales, CLAVES_ASISTENCIA),
);
