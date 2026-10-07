'use client';

import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import CapturaContinua from '../CapturaContinua';
import CierreSesionDialog from '../CierreSesionDialog';
import PasosPaseLista from '../PasosPaseLista';
import RegistroManualDialog from '../RegistroManualDialog';
import RevisionCierre from '../RevisionCierre';

// P-03: sesion automatica en curso, en DOS vistas que se alternan con la franja de pasos de arriba (PasosPaseLista):
//   captura   (paso 2) = SOLO el panel de pase de lista (CapturaContinua): camara, cifra «N de M presentes» y la accion «Revisar y cerrar»
//   revision  (paso 3) = RevisionCierre: la decision de cierre, las cifras, quien falta y, plegado, el detalle
// La captura NO se desmonta al revisar (solo se oculta): la camara sigue muestreando mientras dure la tolerancia, y volver a ella no la
// reinicia. `data` = respuesta de api_sesion_monitor; `onActualizar` refresca el monitor.
//   enfocar = se llego a pasar lista (?pasar-lista=1 o recien abierta): el panel de captura recibe el foco al montarse
//   simulado = api_ahora().reloj_simulado: habilita la camara simulada (solo desarrollo local)
export default function MonitorSesion({ data, onActualizar, enfocar = false, simulado = false }) {
    const { sesion, camaras = [], alumnos = [], totales = {} } = data;
    const [manual, setManual] = useState({ abierto: false, alumno: null });
    const [cerrando, setCerrando] = useState(false);
    const [vista, setVista] = useState('captura');
    const abierta = sesion.estatus === 'abierta';
    const revisando = vista === 'revision';
    const pasosRef = useRef(null);
    const primeraVista = useRef(true);

    // Al cambiar de vista la franja de pasos vuelve a quedar a la vista (si no, en teléfono se aterriza a media pantalla de la otra vista).
    useEffect(() => {
        if (primeraVista.current) {
            primeraVista.current = false;
            return;
        }
        pasosRef.current?.scrollIntoView?.({ block: 'start' });
    }, [vista]);

    return (
        <div className="flex flex-col gap-4">
            {abierta && (
                <div ref={pasosRef} className="scroll-mt-20">
                    <PasosPaseLista modo="automatico" actual={revisando ? 3 : 2} onIrA={(paso) => setVista(paso === 3 ? 'revision' : 'captura')} />
                </div>
            )}

            {abierta && (
                <div className={clsx(revisando && 'hidden')}>
                    <CapturaContinua
                        sesion={sesion}
                        camaras={camaras}
                        alumnos={alumnos}
                        totales={totales}
                        activo={sesion.en_ventana === true}
                        simulado={simulado}
                        enfocar={enfocar}
                        onFin={onActualizar}
                        onRevisar={() => setVista('revision')}
                        onRegistrarManual={() => setManual({ abierto: true, alumno: null })}
                    />
                </div>
            )}

            {abierta && revisando && (
                <RevisionCierre data={data} onVolver={() => setVista('captura')} onCerrar={() => setCerrando(true)} onRegistrar={(a) => setManual({ abierto: true, alumno: a })} />
            )}

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
