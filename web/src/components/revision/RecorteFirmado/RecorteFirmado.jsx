'use client';

import { UserRound } from 'lucide-react';
import { useState } from 'react';
import Button from '@/components/ui/Button';

// Recorte por URL firmada (vence en 5 min). Sin URL: silueta con leyenda; si el navegador no puede cargarla
// (URL vencida) ofrece volver a pedirla. La URL solo vive en memoria.
export default function RecorteFirmado({ url = null, purgado = false, alt, onExpirada, className = '' }) {
    const [fallo, setFallo] = useState({ url: null });
    const vencida = Boolean(url) && fallo.url === url;

    if (!url || vencida) {
        return (
            <div
                className={`flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-muted p-1 text-center text-[11px] text-muted-foreground ${className}`}
            >
                <UserRound aria-hidden="true" className="size-7 opacity-50" strokeWidth={1.5} />
                {vencida ? (
                    <>
                        <span>Enlace vencido</span>
                        {onExpirada && (
                            <Button size="sm" variant="ghost" className="!min-h-6 !px-1 text-[11px] underline" onClick={onExpirada}>
                                Volver a cargar
                            </Button>
                        )}
                    </>
                ) : (
                    <span>{purgado ? 'Recorte eliminado por retención' : 'Sin recorte'}</span>
                )}
            </div>
        );
    }
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={url}
            alt={alt}
            loading="lazy"
            onError={() => setFallo({ url })}
            className={`h-20 w-20 shrink-0 rounded-xl border border-border object-cover ${className}`}
        />
    );
}
