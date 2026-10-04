'use client';

import { CircleCheck, Clock, UserX, Users } from 'lucide-react';
import { useState } from 'react';
import StatCard from '@/components/ui/StatCard';
import CapturaContinua from '../CapturaContinua';
import CierreSesionDialog from '../CierreSesionDialog';
import EstadoCamaras from '../EstadoCamaras';
import GraficaActividadSesion from '../GraficaActividadSesion';
import GraficaAsistenciaSesion from '../GraficaAsistenciaSesion';
import GuiaPasarLista from '../GuiaPasarLista';
import RegistroManualDialog from '../RegistroManualDialog';
import TablaAlumnosSesion from '../TablaAlumnosSesion';
import VentanaTolerancia from '../VentanaTolerancia';

// P-03: sesion automatica en curso. El PANEL DE PASE DE LISTA va primero (es a lo que se viene); debajo, las cifras, las graficas, las
// camaras y la tabla de alumnos. `data` = respuesta de api_sesion_monitor; `onActualizar` refresca el monitor.
//   guia = se llego a pasar lista (?pasar-lista=1 o recien abierta): muestra la guia de 3 pasos y enfoca el panel
//   onDescartarGuia = oculta la guia (el estado vive en SesionClase, que tambien la usa en el pase manual)
//   simulado = api_ahora().reloj_simulado: habilita la camara simulada (solo desarrollo local)
export default function MonitorSesion({ data, onActualizar, guia = false, onDescartarGuia, simulado = false }) {
    const { sesion, camaras = [], alumnos = [], totales = {} } = data;
    const [manual, setManual] = useState({ abierto: false, alumno: null });
    const [cerrando, setCerrando] = useState(false);
    const abierta = sesion.estatus === 'abierta';

    return (
        <div className="flex flex-col gap-4">
            {guia && abierta && <GuiaPasarLista onDescartar={onDescartarGuia} />}

            {abierta && (
                <CapturaContinua
                    sesion={sesion}
                    camaras={camaras}
                    alumnos={alumnos}
                    totales={totales}
                    activo={sesion.en_ventana === true}
                    simulado={simulado}
                    enfocar={guia}
                    onFin={onActualizar}
                    onCerrar={() => setCerrando(true)}
                    onRegistrarManual={() => setManual({ abierto: true, alumno: null })}
                />
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Inscritos" value={totales.inscritos ?? 0} icon={Users} animated />
                <StatCard label="Presentes" value={totales.presentes ?? 0} tone="success" icon={CircleCheck} animated />
                <StatCard label="Retardos" value={totales.retardos ?? 0} tone="warning" icon={Clock} animated />
                <StatCard label="Sin registro" value={totales.sin_registro ?? 0} tone="danger" icon={UserX} animated />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
                <GraficaAsistenciaSesion totales={totales} />
                <div className="flex flex-col gap-4">
                    <VentanaTolerancia sesion={sesion} />
                    <GraficaActividadSesion totales={totales} />
                </div>
            </div>

            <section aria-label="Camaras del aula" className="flex flex-col gap-2">
                <h2 className="text-base font-semibold">Cámaras del aula</h2>
                <EstadoCamaras camaras={camaras} />
            </section>

            <section aria-label="Alumnos" className="flex flex-col gap-2">
                <h2 className="text-base font-semibold">Alumnos</h2>
                <TablaAlumnosSesion alumnos={alumnos} puedeRegistrar={abierta} onRegistrar={(a) => setManual({ abierto: true, alumno: a })} />
            </section>

            {manual.abierto && (
                <RegistroManualDialog
                    open
                    sesion={sesion}
                    alumnos={alumnos}
                    alumno={manual.alumno}
                    onClose={() => setManual({ abierto: false, alumno: null })}
                    onGuardado={onActualizar}
                />
            )}
            <CierreSesionDialog
                open={cerrando}
                idSesion={sesion.id_sesion}
                totales={totales}
                onCancel={() => setCerrando(false)}
                onCerrada={() => {
                    setCerrando(false);
                    onActualizar?.();
                }}
            />
        </div>
    );
}
