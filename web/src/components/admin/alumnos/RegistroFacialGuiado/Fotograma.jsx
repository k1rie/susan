'use client';

import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';

// Imagen de una toma. La URL de objeto se crea una vez por componente (el llamador usa key = id de la toma) y se libera al
// desmontar. La liberación se difiere un instante y el montaje la cancela: así sobrevive al doble montaje de efectos de
// StrictMode sin dejar la imagen rota. `espejo` repite lo que se vio en la vista previa de la cámara frontal.
export default function Fotograma({ blob, espejo = false, alt, className }) {
    const [url] = useState(() => URL.createObjectURL(blob));
    const liberacion = useRef(null);
    useEffect(() => {
        clearTimeout(liberacion.current);
        return () => {
            liberacion.current = setTimeout(() => URL.revokeObjectURL(url), 0);
        };
    }, [url]);
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={alt} className={clsx('size-full object-cover', espejo && '-scale-x-100', className)} />;
}
