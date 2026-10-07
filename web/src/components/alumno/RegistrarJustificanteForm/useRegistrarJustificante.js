'use client';

import { useCallback, useRef, useState } from 'react';
import { registrarJustificante } from '@/lib/api/revision.js';
import { subirDocumentoJustificante } from '@/lib/http';
import { mensajeDeError, validarFormulario } from './registrarJustificante.utils.js';

// Envío en dos pasos: sube el documento y registra el justificante. Si el paso 2 falla se conserva el
// objeto ya subido para reintentar sin volver a subir (mientras no cambien archivo ni sesión).
export default function useRegistrarJustificante({ onRegistrado, onNoJustificable } = {}) {
    const [fase, setFase] = useState('inactivo'); // inactivo | subiendo | guardando | listo | error
    const [error, setError] = useState(null);
    const [errores, setErrores] = useState({});
    const subido = useRef(null); // { archivo, idSesion, objeto }

    const enviar = useCallback(async ({ idSesion, motivo, archivo }) => {
        const v = validarFormulario({ idSesion, motivo, archivo });
        setErrores(v);
        if (Object.keys(v).length) return null;
        setError(null);
        try {
            let objeto = subido.current && subido.current.archivo === archivo && subido.current.idSesion === idSesion
                ? subido.current.objeto : null;
            if (!objeto) {
                setFase('subiendo');
                const r = await subirDocumentoJustificante({ archivo, idSesion });
                objeto = r.objeto_documento;
                subido.current = { archivo, idSesion, objeto };
            }
            setFase('guardando');
            const j = await registrarJustificante({ idSesion, motivo: motivo.trim(), objetoDocumento: objeto });
            subido.current = null;
            setFase('listo');
            // El segundo argumento dice QUÉ sesión se justificó (la respuesta puede no traerla en todas las formas): lo usa la tarjeta para
            // contar cuántas faltas quedan por justificar.
            onRegistrado?.(j, { idSesion });
            return j;
        } catch (e) {
            setFase('error');
            setError(mensajeDeError(e));
            if (e?.code === 'ESTADO_NO_JUSTIFICABLE') onNoJustificable?.();
            return null;
        }
    }, [onRegistrado, onNoJustificable]);

    const reiniciar = useCallback(() => {
        subido.current = null;
        setFase('inactivo');
        setError(null);
        setErrores({});
    }, []);

    return { fase, error, errores, enviar, reiniciar, ocupado: fase === 'subiendo' || fase === 'guardando' };
}
