'use client';

import { useMemo } from 'react';

// Devuelve la MISMA referencia mientras el contenido de `datos` no cambie. Las pantallas que sondean al servidor (la sesión en vivo
// cada 5 s) recalculan los arreglos de las gráficas en cada render; sin esto recharts los ve como datos nuevos y reinicia su animación.
// `datos` debe ser JSON-serializable (números, textos, listas, objetos).
export default function useDatosEstables(datos) {
    const clave = JSON.stringify(datos ?? null);
    return useMemo(() => JSON.parse(clave), [clave]);
}
