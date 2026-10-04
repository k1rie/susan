'use client';

import { memo } from 'react';
import AnilloEstados from '@/components/ui/AnilloEstados';
import MedidorLiquido from '@/components/ui/MedidorLiquido';
import TarjetaGrafica from '@/components/ui/TarjetaGrafica';
import { CONFIG_ASISTENCIA, resumenTexto } from '@/lib/graficas.js';
import {
    CLAVES_ASISTENCIA,
    CONFIG_SESION_ABIERTA,
    centroAsistencia,
    centroInscritos,
    distribucionSesionAbierta,
    distribucionSesionCerrada,
    mismosValores,
    presentesAhora,
} from '../MonitorSesion/monitorSesion.utils.js';

// Asistencia de la sesión: en curso (anillo con «Sin registro» + medidor líquido «Presentes ahora») o cerrada (anillo con los cinco
// estados, sin medidor: el nivel «ahora» ya no cambia). `totales` = de api_sesion_monitor.
// Va memoizada por valor: el monitor sondea cada 5 s y entrega un objeto nuevo aunque no cambie nada; así ni el anillo ni el medidor se
// vuelven a renderizar sin un dato nuevo. Cuando sí cambia, ambos reciben los mismos elementos con props nuevas (no se remontan): las
// barras se desplazan y el líquido chapotea hacia el nuevo nivel en lugar de repetir la entrada.
// Disposición: lado a lado cuando la tarjeta es ancha (container query, no el ancho de pantalla: la tarjeta cabe en media columna) y
// apilada en las angostas; apilado, el medidor suma ~170 px de alto en un teléfono.
function GraficaAsistenciaSesion({ totales, cerrada = false }) {
    const estados = cerrada ? distribucionSesionCerrada(totales) : distribucionSesionAbierta(totales);
    const config = cerrada ? CONFIG_ASISTENCIA : CONFIG_SESION_ABIERTA;
    const medidor = cerrada ? null : presentesAhora(totales);
    return (
        <TarjetaGrafica titulo="Asistencia de la sesión" descripcion="Presentes y retardos sobre inscritos" resumen={resumenTexto(estados, config)}>
            <div className="@container">
                <div className="flex flex-col items-center gap-5 @min-[26rem]:flex-row @min-[26rem]:gap-6">
                    {/* El anillo es un contenedor de tamaño en línea (mide 0 sin un ancho explícito): w-full al apilar, flex-1 en fila. */}
                    <AnilloEstados
                        className="w-full min-w-0 @min-[26rem]:flex-1"
                        datos={estados}
                        config={config}
                        centro={cerrada ? centroAsistencia(totales) : centroInscritos(totales)}
                        alto={230}
                        vacio={cerrada ? 'La sesión no tuvo alumnos inscritos' : 'Aún no hay alumnos inscritos'}
                    />
                    {medidor && (
                        <MedidorLiquido
                            className="@min-[26rem]:shrink-0"
                            valor={medidor.valor}
                            tono="azul"
                            etiqueta="Presentes ahora"
                            descripcion={medidor.descripcion}
                            ancho={76}
                            alto={152}
                        />
                    )}
                </div>
            </div>
        </TarjetaGrafica>
    );
}

export default memo(
    GraficaAsistenciaSesion,
    (previo, nuevo) => previo.cerrada === nuevo.cerrada && mismosValores(previo.totales, nuevo.totales, CLAVES_ASISTENCIA),
);
