'use client';

import { useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import CapturaContinua from '../CapturaContinua';
import CierreSesionDialog from '../CierreSesionDialog';
import EstadoCamaras from '../EstadoCamaras';
import RegistroManualDialog from '../RegistroManualDialog';
import TablaAlumnosSesion from '../TablaAlumnosSesion';
import VentanaTolerancia from '../VentanaTolerancia';
import { cierreHabilitado } from './monitorSesion.utils.js';

// P-03: sesion automatica en curso. `data` = respuesta de api_sesion_monitor; `onActualizar` refresca el monitor.
export default function MonitorSesion({ data, onActualizar }) {
    const { sesion, camaras = [], alumnos = [], totales = {} } = data;
    const [manual, setManual] = useState({ abierto: false, alumno: null });
    const [cerrando, setCerrando] = useState(false);
    const abierta = sesion.estatus === 'abierta';
    const puedeCerrar = cierreHabilitado(sesion);

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Inscritos" value={totales.inscritos ?? 0} />
                <StatCard label="Presentes" value={totales.presentes ?? 0} tone="success" />
                <StatCard label="Retardos" value={totales.retardos ?? 0} tone="warning" />
                <StatCard label="Sin registro" value={totales.sin_registro ?? 0} tone="danger" />
                <StatCard label="Pendientes" value={totales.pendientes ?? 0} />
                <StatCard label="Capturas" value={totales.capturas ?? 0} />
                <StatCard label="Detecciones" value={totales.detecciones ?? 0} />
                <StatCard label="Detecciones validas" value={totales.detecciones_validas ?? 0} />
            </div>

            <VentanaTolerancia sesion={sesion} />

            {abierta && <CapturaContinua sesion={sesion} camaras={camaras} activo={sesion.en_ventana === true} onFin={onActualizar} />}

            <section aria-label="Camaras del aula" className="flex flex-col gap-2">
                <h2 className="text-base font-semibold">Cámaras del aula</h2>
                <EstadoCamaras camaras={camaras} />
            </section>

            <section aria-label="Alumnos" className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-semibold">Alumnos</h2>
                    {abierta && (
                        <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" onClick={() => setManual({ abierto: true, alumno: null })}>
                                Registrar manualmente
                            </Button>
                            <Button onClick={() => setCerrando(true)} disabled={!puedeCerrar}>
                                Cerrar sesión de clase
                            </Button>
                        </div>
                    )}
                </div>
                {abierta && !puedeCerrar && <Alert tone="info">El cierre se habilita al terminar la ventana de tolerancia ({sesion.tolerancia_min} min).</Alert>}
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
