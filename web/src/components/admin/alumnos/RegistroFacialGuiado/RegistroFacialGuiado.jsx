'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCameraCapture } from '@/components/ui/CameraCapture';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useDialog } from '@/hooks/ui/useDialog.js';
import { PASOS_TOMA, TOTAL_PASOS } from '../CapturaGuiadaPlantilla/capturaGuiada.utils.js';
import BarraPasos from './BarraPasos.jsx';
import { Cabecera } from './Estructura.jsx';
import PantallaArchivo from './PantallaArchivo.jsx';
import PantallaCaptura from './PantallaCaptura.jsx';
import PantallaIntro from './PantallaIntro.jsx';
import PantallaRevision from './PantallaRevision.jsx';
import { PantallaGuardando, PantallaListo } from './PantallaRegistro.jsx';
import { estadosDePasos, RITMO_AUTOMATICO } from './registroGuiado.utils.js';
import useRegistroGuiado from './useRegistroGuiado.js';

// Asistente de registro facial, paso por paso (como la configuración de Face ID): portada con consejos, cinco tomas guiadas con
// el aro de progreso y verificación al instante, revisión y registro. En el teléfono ocupa toda la pantalla; en escritorio es un
// diálogo de tamaño fijo para que no «salte» entre pasos. No guarda nada: opera sobre el estado de usePlantillaFacial (`p`).
// `propio`: el alumno se registra a sí mismo (autoservicio). Solo cámara (sin la salida «Subir fotos»: el rostro se toma en el momento y con
// su propia cámara) y textos en segunda persona.
export default function RegistroFacialGuiado({ p, nombreAlumno, onClose, ritmo: ajustes, depuracion, propio = false }) {
    const w = useRegistroGuiado(p);
    // `ritmo` solo se usa para ajustar tiempos (pruebas); por omisión es RITMO_AUTOMATICO.
    const ritmo = useMemo(() => ({ ...RITMO_AUTOMATICO, ...ajustes }), [ajustes]);
    const [dispositivo, setDispositivo] = useState(undefined);
    const [confirmando, setConfirmando] = useState(false);
    const raiz = useRef(null);
    const tituloId = useId();
    // La cámara solo está encendida durante las tomas: el resto del asistente no la necesita (y su luz no debe quedar prendida).
    // Se desestructura (no se pasa el objeto entero): lleva el ref del <video> y el compilador de React no permite leerlo al renderizar.
    const { videoRef, capture, restart, estado, error, dispositivos } = useCameraCapture({ active: w.pantalla === 'captura', facingMode: 'user', deviceId: dispositivo });

    const guardando = w.pantalla === 'registrando';
    // Cerrar descarta las tomas: son fotos de una persona y no deben quedar en memoria si ya no se van a usar.
    const cerrar = () => {
        setConfirmando(false);
        p.limpiar();
        onClose();
    };
    const pedirCierre = () => {
        if (guardando) return;
        if (p.tomas.length > 0) setConfirmando(true);
        else cerrar();
    };
    useDialog(raiz, pedirCierre, !confirmando, { initialFocusRef: raiz });

    const enCaptura = w.pantalla === 'captura';
    const conProgreso = enCaptura || (w.pantalla === 'revision' && p.modo === 'camara');
    const estados = estadosDePasos({ tomas: p.tomas, omitidos: w.omitidos, actual: enCaptura ? w.paso : -1 });

    return createPortal(
        <div className="fixed inset-0 z-50 flex animate-in items-stretch justify-center bg-foreground/40 duration-200 fade-in-0 sm:items-center sm:p-4">
            <div
                ref={raiz}
                role="dialog"
                aria-modal="true"
                aria-labelledby={tituloId}
                tabIndex={-1}
                className="flex h-dvh w-full animate-in flex-col bg-card text-foreground outline-none duration-300 fade-in-0 slide-in-from-bottom-4 sm:h-[min(46rem,94dvh)] sm:max-w-xl sm:rounded-2xl sm:shadow-lift sm:zoom-in-95 sm:slide-in-from-bottom-0"
            >
                <Cabecera titulo="Registro facial" id={tituloId} onCerrar={pedirCierre} deshabilitado={guardando}>
                    {conProgreso && (
                        <div className="mt-1 flex flex-col gap-2">
                            <BarraPasos estados={estados} />
                            <p className="flex items-center justify-between text-xs text-muted-foreground">
                                {enCaptura ? (
                                    <>
                                        <span>
                                            Toma {w.paso + 1} de {TOTAL_PASOS}
                                        </span>
                                        {PASOS_TOMA[w.paso].opcional && <span>Opcional</span>}
                                    </>
                                ) : (
                                    <span>Revisión de las tomas</span>
                                )}
                            </p>
                        </div>
                    )}
                </Cabecera>

                <div key={w.pantalla} className="flex min-h-0 flex-1 animate-in flex-col duration-200 fade-in-0">
                    {w.pantalla === 'intro' && <PantallaIntro nombreAlumno={nombreAlumno} propio={propio} onComenzar={w.comenzar} onSubirFotos={propio ? undefined : w.irAArchivo} />}
                    {w.pantalla === 'captura' && (
                        <PantallaCaptura
                            p={p}
                            paso={w.paso}
                            omitidos={w.omitidos}
                            videoRef={videoRef}
                            capturar={capture}
                            reiniciar={restart}
                            estadoCamara={estado}
                            errorCamara={error}
                            dispositivos={dispositivos}
                            ritmo={ritmo}
                            depuracion={depuracion}
                            dispositivo={dispositivo}
                            onDispositivo={setDispositivo}
                            onPasoListo={w.pasoListo}
                            onOmitir={w.omitirPaso}
                            onIrAArchivo={propio ? undefined : w.irAArchivo}
                        />
                    )}
                    {w.pantalla === 'archivo' && <PantallaArchivo p={p} onVolver={w.volverAIntro} onContinuar={w.irARevision} />}
                    {w.pantalla === 'revision' && (
                        <PantallaRevision
                            p={p}
                            omitidos={w.omitidos}
                            onRetomar={w.retomarPaso}
                            onQuitar={p.quitarToma}
                            onEmpezarDeNuevo={w.empezarDeNuevo}
                            onAgregarFotos={w.irAArchivo}
                            onRegistrar={w.registrar}
                        />
                    )}
                    {guardando && <PantallaGuardando total={p.tomas.length} />}
                    {w.pantalla === 'listo' && <PantallaListo registro={p.registro} onTerminar={cerrar} />}
                </div>
            </div>
            <ConfirmDialog
                open={confirmando}
                title="¿Salir del registro facial?"
                message="Se descartarán las tomas que llevas; no se guarda nada."
                confirmLabel="Salir y descartar"
                variant="danger"
                onConfirm={cerrar}
                onCancel={() => setConfirmando(false)}
            />
        </div>,
        document.body,
    );
}
