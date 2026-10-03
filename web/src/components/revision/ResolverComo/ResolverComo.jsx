'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import Textarea from '@/components/ui/Textarea';
import { ETIQUETAS, MAX_COMENTARIO, estadosOfrecidos, normalizarComentario, sugerenciaValida } from './resolverComo.utils.js';

// «Resolver como»: un clic en el estado ejecuta la decisión (sin diálogo; es reversible dentro del plazo).
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
            <Field label="Comentario (opcional)">
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
            {deshabilitado && motivoDeshabilitado && <p className="text-sm text-ausente">{motivoDeshabilitado}</p>}
        </div>
    );
}
