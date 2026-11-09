'use client';

import { SendHorizontal, Square } from 'lucide-react';
import { useId, useState } from 'react';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import { MAX_TEXTO } from '../AsistenteIA/asistenteIA.utils.js';

// Campo de la pregunta en el pie del panel. Enter envía y Mayús+Enter salta de línea; mientras el asistente responde, el botón
// pasa a «Detener». `ref` llega al área de texto (React 19) para que el panel la enfoque al abrir.
export default function CampoPregunta({ onEnviar, onDetener, ocupado = false, deshabilitado = false, ref }) {
    const [texto, setTexto] = useState('');
    const idAyuda = useId();
    const limpio = texto.trim();

    const enviar = () => {
        if (!limpio || ocupado || deshabilitado) return;
        onEnviar(limpio);
        setTexto('');
    };

    return (
        <form
            className="flex w-full items-end gap-2"
            onSubmit={(e) => {
                e.preventDefault();
                enviar();
            }}
        >
            <label className="sr-only" htmlFor={`${idAyuda}-campo`}>
                Pregunta al asistente
            </label>
            {/* Textarea trae su propio contenedor: el ancho flexible va en este envoltorio. */}
            <div className="min-w-0 flex-1">
                <Textarea
                    id={`${idAyuda}-campo`}
                    ref={ref}
                    rows={1}
                    maxRows={5}
                    autoGrow
                    maxLength={MAX_TEXTO}
                    value={texto}
                    disabled={deshabilitado}
                    placeholder={deshabilitado ? 'Asistente no disponible' : 'Pregunta sobre tus grupos…'}
                    aria-describedby={idAyuda}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            enviar();
                        }
                    }}
                />
            </div>
            <span id={idAyuda} className="sr-only">
                Enter envía; Mayús más Enter agrega una línea.
            </span>
            {ocupado ? (
                <Button
                    variant="secondary"
                    onClick={onDetener}
                    aria-label="Detener respuesta"
                    icon={<Square aria-hidden="true" className="size-4" strokeWidth={1.75} />}
                    className="shrink-0 px-3"
                />
            ) : (
                <Button
                    type="submit"
                    disabled={deshabilitado || !limpio}
                    aria-label="Enviar pregunta"
                    icon={<SendHorizontal aria-hidden="true" className="size-4" strokeWidth={1.75} />}
                    className="shrink-0 px-3"
                />
            )}
        </form>
    );
}
