'use client';

import { useCallback, useEffect, useState } from 'react';

const PASO_MS = 250;

// Cuenta atrás para un botón que no debe poder repetirse de inmediato (reenviar el enlace de recuperación). Se calcula contra la hora
// real (no restando 1 por tick), así que sigue exacta si la pestaña estuvo en segundo plano y el temporizador se retrasó.
//   restante  segundos que faltan (0 = ya se puede)
//   activo    restante > 0
//   iniciar   arranca (o reinicia) la espera
export default function useEnfriamiento(segundos) {
    const [fin, setFin] = useState(null);
    const [ahora, setAhora] = useState(0);

    useEffect(() => {
        if (fin == null) return undefined;
        const id = setInterval(() => {
            const t = Date.now();
            setAhora(t);
            if (t >= fin) clearInterval(id);
        }, PASO_MS);
        return () => clearInterval(id);
    }, [fin]);

    const iniciar = useCallback(() => {
        const t = Date.now();
        setAhora(t);
        setFin(t + segundos * 1000);
    }, [segundos]);

    const restante = fin == null ? 0 : Math.max(0, Math.ceil((fin - ahora) / 1000));
    return { restante, activo: restante > 0, iniciar };
}
