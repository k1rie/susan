'use client';

import { Camera } from 'lucide-react';
import { useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import CameraCapture from '@/components/ui/CameraCapture';
import GaleriaTomas from '../GaleriaTomas';
import { PASOS_TOMA, primerPasoLibre, ranurasGuiadas, textoCaptura, TOTAL_PASOS } from './capturaGuiada.utils.js';

const CAMARA_NO_LISTA = 'La cámara aún no está lista; espera un momento e inténtalo de nuevo.';

// Cámara con 5 tomas guiadas (frente, giros suaves, expresión o luz). La cámara se queda montada durante las 5
// y el obturador es propio para decidir qué paso se captura. No guarda tomas: las recibe y las entrega por props.
export default function CapturaGuiadaPlantilla({ tomas, maximo = 8, deshabilitado = false, onCapturar, onRepetir, onQuitar, botonRef }) {
    const camRef = useRef(null);
    const [preferido, setPreferido] = useState(null);
    const [error, setError] = useState(null);

    // Al repetir una toma su paso queda como el siguiente, aunque haya pasos libres anteriores.
    const paso = primerPasoLibre(tomas, preferido);
    const lleno = tomas.length >= maximo;
    const bloqueado = deshabilitado || lleno || paso === null;
    const actual = paso === null ? null : PASOS_TOMA[paso];
    const Icono = actual?.Icono ?? Camera;

    const capturar = async () => {
        if (bloqueado) return;
        try {
            const blob = await camRef.current.capture();
            setError(null);
            setPreferido(null);
            onCapturar?.(blob, paso);
        } catch {
            // ref.capture() lanza si el fotograma aún no está listo.
            setError(CAMARA_NO_LISTA);
        }
    };

    const alAccion = (id, accion) => {
        if (accion === 'repetir') {
            setPreferido(tomas.find((t) => t.id === id)?.paso ?? null);
            onRepetir?.(id);
        } else {
            onQuitar?.(id);
        }
    };

    let etiqueta = paso === null ? `Las ${TOTAL_PASOS} tomas están capturadas` : textoCaptura(paso);
    if (paso !== null && lleno) etiqueta = `Máximo de ${maximo} fotos`;

    return (
        <div className="flex flex-col gap-3">
            <p aria-live="polite" className="flex items-start gap-2 text-sm">
                <Icono aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
                <span className="min-w-0">
                    {actual ? (
                        <>
                            <span className="font-medium">{actual.titulo}.</span> {actual.indicacion}
                        </>
                    ) : (
                        'Tomas completas. Repite alguna si lo necesitas.'
                    )}
                </span>
            </p>
            <CameraCapture ovalGuide showShutter={false} ref={camRef} />
            <div>
                <Button
                    ref={botonRef}
                    onClick={capturar}
                    disabled={bloqueado}
                    icon={<Camera aria-hidden="true" className="size-4" strokeWidth={1.75} />}
                >
                    {etiqueta}
                </Button>
            </div>
            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}
            <GaleriaTomas ranuras={ranurasGuiadas(tomas, paso)} accion="repetir" onAccion={alAccion} deshabilitado={deshabilitado} />
        </div>
    );
}
