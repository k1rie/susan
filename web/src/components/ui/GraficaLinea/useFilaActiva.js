'use client';

import { useState } from 'react';
import { indiceMasCercano } from '@/lib/graficasGeometria.js';

// Fila activa de la gráfica (índice o null) y los manejadores del contenedor que la mueven: puntero (la más cercana en x) y teclado
// (← → Home End; Esc cierra). `posiciones` = x en píxeles de cada fila, medida desde el borde izquierdo del contenedor.
export default function useFilaActiva(posiciones) {
    const n = posiciones.length;
    const [elegido, setElegido] = useState(null);
    // Si los datos se acortan, un índice que ya no existe equivale a "nada activo".
    const activo = elegido !== null && elegido < n ? elegido : null;

    const alPuntero = (evento) => {
        if (n === 0) return;
        const caja = evento.currentTarget.getBoundingClientRect();
        setElegido(indiceMasCercano(posiciones, evento.clientX - caja.left));
    };

    // El ratón se va -> se cierra. En táctil el dedo se levanta tras tocar: la fila se queda hasta tocar fuera (blur) o pulsar Esc.
    const alSalir = (evento) => {
        if (evento.pointerType !== 'touch') setElegido(null);
    };

    const alDesenfocar = (evento) => {
        if (!evento.currentTarget.contains(evento.relatedTarget)) setElegido(null);
    };

    const alTeclado = (evento) => {
        if (n === 0) return;
        switch (evento.key) {
            case 'ArrowRight':
                setElegido((previo) => (previo === null || previo >= n ? 0 : Math.min(n - 1, previo + 1)));
                break;
            case 'ArrowLeft':
                setElegido((previo) => (previo === null || previo >= n ? n - 1 : Math.max(0, previo - 1)));
                break;
            case 'Home':
                setElegido(0);
                break;
            case 'End':
                setElegido(n - 1);
                break;
            case 'Escape':
                // Con algo abierto, Esc solo lo cierra (no debe cerrar además un modal que contenga la gráfica).
                if (activo === null) return;
                evento.stopPropagation();
                setElegido(null);
                break;
            default:
                return;
        }
        evento.preventDefault();
    };

    return { activo, manejadores: { onPointerMove: alPuntero, onPointerDown: alPuntero, onPointerLeave: alSalir, onKeyDown: alTeclado, onBlur: alDesenfocar } };
}
