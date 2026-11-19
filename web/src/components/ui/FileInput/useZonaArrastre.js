'use client';

import { useRef, useState } from 'react';

const traeArchivos = (e) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

// Estado y manejadores de una zona donde se sueltan archivos. `dragenter`/`dragleave` se disparan también al pasar por los
// hijos, por eso se cuenta cuántos se han entrado en vez de usar un booleano directo (si no, la zona parpadea).
//   alSoltar(File[]) se llama con los archivos soltados.   deshabilitada -> ignora todo (carga en curso, campo bloqueado).
export function useZonaArrastre({ alSoltar, deshabilitada = false }) {
    const [arrastrando, setArrastrando] = useState(false);
    const entradas = useRef(0);

    const reiniciar = () => {
        entradas.current = 0;
        setArrastrando(false);
    };

    return {
        arrastrando: arrastrando && !deshabilitada,
        manejadores: {
            onDragEnter: (e) => {
                if (deshabilitada || !traeArchivos(e)) return;
                e.preventDefault();
                entradas.current += 1;
                setArrastrando(true);
            },
            onDragOver: (e) => {
                if (deshabilitada || !traeArchivos(e)) return;
                // Sin preventDefault el navegador no permite soltar.
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
            },
            onDragLeave: (e) => {
                if (deshabilitada || !traeArchivos(e)) return;
                entradas.current = Math.max(0, entradas.current - 1);
                if (entradas.current === 0) setArrastrando(false);
            },
            onDrop: (e) => {
                if (deshabilitada) return;
                e.preventDefault();
                reiniciar();
                const archivos = Array.from(e.dataTransfer?.files ?? []);
                if (archivos.length > 0) alSoltar(archivos);
            },
        },
    };
}

export default useZonaArrastre;
