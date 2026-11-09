'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { preguntarAsistente } from '@/lib/http/asistente';
import { MAX_TEXTO, historialParaEnviar } from './asistenteIA.utils.js';

let siguienteId = 0;
const nuevoId = () => `m${(siguienteId += 1)}`;

/**
 * Estado de la conversación con el asistente: mensajes, el que se está escribiendo en streaming y la consulta en curso.
 *   mensajes: [{ id, rol: 'usuario' | 'asistente', texto, error?: boolean }]
 *   estado:   'listo' | 'pensando' | 'escribiendo'
 *   consultando: etiqueta de la herramienta en curso («Buscando alumnos en riesgo») o null
 */
export function useAsistenteIA() {
    const [mensajes, setMensajes] = useState([]);
    const [estado, setEstado] = useState('listo');
    const [consultando, setConsultando] = useState(null);
    const controlador = useRef(null);
    const mensajesRef = useRef(mensajes);
    useEffect(() => {
        mensajesRef.current = mensajes;
    }, [mensajes]);

    // Al desmontar (cerrar sesión, cambiar de área) se corta la petición: el servidor deja de pagar tokens.
    useEffect(() => () => controlador.current?.abort(), []);

    const actualizarRespuesta = useCallback((id, cambio) => {
        setMensajes((lista) => lista.map((m) => (m.id === id ? { ...m, ...cambio(m) } : m)));
    }, []);

    const enviar = useCallback(async (textoCrudo) => {
        const texto = String(textoCrudo ?? '').trim().slice(0, MAX_TEXTO);
        if (!texto || controlador.current) return;
        const pregunta = { id: nuevoId(), rol: 'usuario', texto };
        const respuesta = { id: nuevoId(), rol: 'asistente', texto: '' };
        const historial = historialParaEnviar([...mensajesRef.current, pregunta]);
        setMensajes((lista) => [...lista, pregunta, respuesta]);
        setEstado('pensando');
        setConsultando(null);

        const abort = new AbortController();
        controlador.current = abort;
        try {
            await preguntarAsistente(historial, {
                signal: abort.signal,
                onEvento: (ev) => {
                    if (ev.tipo === 'texto' && typeof ev.texto === 'string') {
                        setConsultando(null);
                        setEstado('escribiendo');
                        actualizarRespuesta(respuesta.id, (m) => ({ texto: m.texto + ev.texto }));
                    } else if (ev.tipo === 'herramienta') {
                        setConsultando(typeof ev.etiqueta === 'string' ? ev.etiqueta : 'Consultando tus datos');
                    } else if (ev.tipo === 'error') {
                        actualizarRespuesta(respuesta.id, () => ({ texto: ev.message || 'El asistente no pudo responder.', error: true }));
                    }
                },
            });
            actualizarRespuesta(respuesta.id, (m) => (m.texto.trim() ? {} : { texto: 'El asistente no devolvió respuesta. Inténtalo de nuevo.', error: true }));
        } catch (e) {
            if (e?.name === 'AbortError') {
                actualizarRespuesta(respuesta.id, (m) => (m.texto.trim() ? {} : { texto: 'Consulta detenida.', error: true }));
            } else {
                actualizarRespuesta(respuesta.id, () => ({ texto: e?.message || 'El asistente no pudo responder.', error: true }));
            }
        } finally {
            controlador.current = null;
            setEstado('listo');
            setConsultando(null);
        }
    }, [actualizarRespuesta]);

    const detener = useCallback(() => controlador.current?.abort(), []);

    const reiniciar = useCallback(() => {
        controlador.current?.abort();
        setMensajes([]);
    }, []);

    return { mensajes, estado, consultando, ocupado: estado !== 'listo', enviar, detener, reiniciar };
}
