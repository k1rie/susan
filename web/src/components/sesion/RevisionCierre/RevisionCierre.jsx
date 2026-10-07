'use client';

import { Camera, CircleCheck, ClipboardCheck, Clock, UserX, Users } from 'lucide-react';
import Detalles from '@/components/ui/Detalles';
import StatCard from '@/components/ui/StatCard';
import AccionesPaseLista from '../AccionesPaseLista';
import EstadoCamaras from '../EstadoCamaras';
import GraficaActividadSesion from '../GraficaActividadSesion';
import GraficaAsistenciaSesion from '../GraficaAsistenciaSesion';
import ListaAlumnosSesion from '../ListaAlumnosSesion';
import { sinRegistro } from '../ListaAlumnosSesion/listaAlumnosSesion.utils.js';
import TablaAlumnosSesion from '../TablaAlumnosSesion';
import VentanaTolerancia from '../VentanaTolerancia';
import { decisionCierre } from './revisionCierre.utils.js';

// Paso 3 del pase de lista con cámara: «Revisar y cerrar». Lo primero es la decisión (qué falta y el botón de cierre), luego las cifras,
// quién falta y, plegado, el detalle que solo hace falta a veces (tolerancia, actividad del reconocimiento, cámaras y lecturas por alumno).
//   data = respuesta de api_sesion_monitor · onVolver = regresa a la cámara · onCerrar = abre la confirmación de cierre
//   onRegistrar(alumno) = abre el registro manual de ese alumno
export default function RevisionCierre({ data, onVolver, onCerrar, onRegistrar }) {
    const { sesion, camaras = [], alumnos = [], totales = {} } = data;
    const abierta = sesion.estatus === 'abierta';
    const faltan = alumnos.filter(sinRegistro).length;
    const { titulo, nota, puedeCerrar } = decisionCierre(sesion, faltan);

    return (
        <div className="flex flex-col gap-4">
            <section aria-label="Cierre del pase de lista" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
                <h2 className="text-lg font-semibold leading-tight tracking-tight">{titulo}</h2>
                <AccionesPaseLista
                    primaria={{ etiqueta: 'Cerrar pase de lista', onClick: onCerrar, disabled: !puedeCerrar, icono: <ClipboardCheck aria-hidden="true" className="size-5" strokeWidth={1.75} /> }}
                    secundarias={[{ etiqueta: 'Volver a la cámara', onClick: onVolver, icono: <Camera aria-hidden="true" className="size-5" strokeWidth={1.75} /> }]}
                    nota={nota}
                />
            </section>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
                <GraficaAsistenciaSesion totales={totales} />
                <div className="grid grid-cols-2 gap-3">
                    <StatCard label="Inscritos" value={totales.inscritos ?? 0} icon={Users} animated />
                    <StatCard label="Presentes" value={totales.presentes ?? 0} tone="success" icon={CircleCheck} animated />
                    <StatCard label="Retardos" value={totales.retardos ?? 0} tone="warning" icon={Clock} animated />
                    <StatCard label="Sin registro" value={totales.sin_registro ?? 0} tone="danger" icon={UserX} animated />
                </div>
            </div>

            <section aria-label="Alumnos" className="flex flex-col gap-2">
                <h2 className="text-base font-semibold">Alumnos</h2>
                <ListaAlumnosSesion alumnos={alumnos} puedeRegistrar={abierta} onRegistrar={onRegistrar} />
            </section>

            <Detalles plano montarAlAbrir titulo="Más detalle de la sesión" resumen="Tolerancia, cámaras y lecturas por alumno">
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
                        <VentanaTolerancia sesion={sesion} />
                        <GraficaActividadSesion totales={totales} />
                    </div>
                    <section aria-label="Cámaras del aula" className="flex flex-col gap-2">
                        <h3 className="text-sm font-semibold">Cámaras del aula</h3>
                        <EstadoCamaras camaras={camaras} />
                    </section>
                    <section aria-label="Lecturas por alumno" className="flex flex-col gap-2">
                        <h3 className="text-sm font-semibold">Lecturas por alumno</h3>
                        <TablaAlumnosSesion alumnos={alumnos} puedeRegistrar={abierta} onRegistrar={onRegistrar} />
                    </section>
                </div>
            </Detalles>
        </div>
    );
}
