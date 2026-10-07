'use client';

import { Info } from 'lucide-react';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import Textarea from '@/components/ui/Textarea';
import { ETIQUETAS, MAX_COMENTARIO, estadosOfrecidos, normalizarComentario, sugerenciaValida } from './resolverComo.utils.js';

// «Resolver como»: un clic en el estado ejecuta la decisión (sin diálogo; es reversible dentro del plazo). El comentario es opcional y
// se escribe ANTES de elegir porque el clic ya ejecuta: por eso la ayuda dice a dónde va.
export default function ResolverComo({
    estadoActual = 'pendiente',
    estadoSugerido,
    deshabilitado = false,
    motivoDeshabilitado,
    cargando = false,
    onResolver,
}) {
    const [comentario, setComentario] = useState('');
    const sugerido = sugerenciaValida(estadoSugerido);

    return (
        <div className="flex flex-col gap-3">
            <Field label="Comentario" optional hint="Queda en el historial de correcciones del caso.">
                <Textarea
                    rows={2}
                    maxLength={MAX_COMENTARIO}
                    showCount
                    value={comentario}
                    disabled={deshabilitado || cargando}
                    onChange={(e) => setComentario(e.target.value)}
                />
            </Field>
            <div role="group" aria-label="Resolver como" className="flex flex-col gap-2 sm:flex-row">
                {estadosOfrecidos(estadoActual).map((estado) => (
                    <Button
                        key={estado}
                        variant={estado === sugerido ? 'primary' : 'secondary'}
                        disabled={deshabilitado || cargando}
                        onClick={() => onResolver(estado, normalizarComentario(comentario))}
                        className="w-full sm:w-auto"
                    >
                        Resolver como {ETIQUETAS[estado]}
                        {estado === sugerido && <span className="text-xs font-normal">(Sugerido)</span>}
                    </Button>
                ))}
            </div>
            {deshabilitado && motivoDeshabilitado && (
                <p className="flex items-start gap-1.5 text-sm text-ausente">
                    <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
                    {motivoDeshabilitado}
                </p>
            )}
        </div>
    );
}
