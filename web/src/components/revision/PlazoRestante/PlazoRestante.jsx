'use client';

import { useEffect, useState } from 'react';
import { formatearFechaLimite, formatearPlazo, segundosActuales } from './plazoRestante.utils.js';

// Plazo restante. Descuenta localmente el tiempo desde que llegó el dato (no depende del reloj absoluto del
// navegador) y se refresca cada 60 s. El padre debe poner `key` ligada a segundosRestantes para reiniciar la base.
export default function PlazoRestante({ venceEn, segundosRestantes }) {
    const [recibido] = useState(() => Date.now());
    const [ahora, setAhora] = useState(recibido);

    useEffect(() => {
        const id = setInterval(() => setAhora(Date.now()), 60000);
        return () => clearInterval(id);
    }, []);

    const segundos = segundosActuales(segundosRestantes, recibido, ahora);
    const vencido = segundos <= 0;
    const limite = formatearFechaLimite(venceEn);
    return (
        <span className={vencido ? 'text-ausente' : 'text-muted'}>
            <span className="font-medium">{formatearPlazo(segundos)}</span>
            {limite && <span className="text-xs"> (límite: {limite})</span>}
        </span>
    );
}
