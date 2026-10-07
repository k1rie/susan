'use client';

import { FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import Button from '../Button/Button.jsx';
import { esImagen, formatearBytes } from './fileInput.utils.js';

const FICHA = 'inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground';

// Miniatura de una imagen elegida (o el icono de documento). Usa FileReader (la carga termina en un callback) en lugar de
// URL.createObjectURL: no hay nada que revocar y es seguro con el doble montaje del modo estricto. La CSP ya admite data:.
export function Miniatura({ file, imagen }) {
    const [src, setSrc] = useState(null);
    useEffect(() => {
        if (!imagen || !esImagen(file) || typeof FileReader === 'undefined') return undefined;
        const lector = new FileReader();
        lector.onload = () => setSrc(typeof lector.result === 'string' ? lector.result : null);
        lector.readAsDataURL(file);
        return () => {
            lector.onload = null;
            if (lector.readyState === 1) lector.abort();
        };
    }, [file, imagen]);

    if (src) {
        // eslint-disable-next-line @next/next/no-img-element -- vista previa local (data:), next/image no aplica
        return <img src={src} alt="" className="size-10 shrink-0 rounded-md object-cover" />;
    }
    return (
        <span aria-hidden="true" className={FICHA}>
            <FileText className="size-5" strokeWidth={1.5} />
        </span>
    );
}

// Fila de un archivo elegido: miniatura o icono, nombre, tamaño y «Quitar».
export default function ArchivoElegido({ file, preview, onQuitar, disabled, etiquetaQuitar }) {
    return (
        <li className="flex items-center gap-3 rounded-lg border border-border bg-background p-2">
            <Miniatura file={file} imagen={preview === 'imagen'} />
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{file.name}</span>
                <span className="block text-xs text-muted-foreground">{formatearBytes(file.size)}</span>
            </span>
            <Button variant="ghost" size="sm" onClick={onQuitar} disabled={disabled} aria-label={etiquetaQuitar}>
                Quitar
            </Button>
        </li>
    );
}
