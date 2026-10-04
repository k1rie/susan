'use client';

import { ImagePlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import { ordenarTomas, PASOS_TOMA } from '../CapturaGuiadaPlantilla/capturaGuiada.utils.js';
import GaleriaTomas from '../GaleriaTomas';
import { normalizarFoto, ranurasLista, textoCupo, validarArchivoFoto } from './subidaFotos.utils.js';

// Subir de 3 a 8 fotos ya tomadas. Cada archivo se valida y se re-codifica en el navegador antes de entrar al
// conjunto; ui/FileInput no admite `multiple`, por eso el input va aquí y el Button es su único disparador.
export default function SubidaFotosPlantilla({ tomas, minimo = 3, maximo = 8, deshabilitado = false, onAgregar, onQuitar, botonRef }) {
    const inputRef = useRef(null);
    const montado = useRef(true);
    const [errores, setErrores] = useState([]);
    const [procesando, setProcesando] = useState(false);

    useEffect(() => {
        montado.current = true;
        return () => {
            montado.current = false;
        };
    }, []);

    const alElegir = async (e) => {
        const archivos = Array.from(e.target.files ?? []);
        // Permite volver a elegir el mismo archivo después de quitarlo o rechazarlo.
        e.target.value = '';
        if (archivos.length === 0) return;

        const mensajes = [];
        const validos = [];
        archivos.forEach((a) => {
            const motivo = validarArchivoFoto(a);
            if (motivo) mensajes.push(motivo);
            else validos.push(a);
        });
        const caben = Math.max(0, maximo - tomas.length);
        if (validos.length > caben) mensajes.push(textoCupo(caben, maximo));

        setErrores(mensajes);
        setProcesando(true);
        for (const archivo of validos.slice(0, caben)) {
            try {
                const blob = await normalizarFoto(archivo);
                onAgregar?.(blob, { nombre: archivo.name });
            } catch {
                // Nunca se sube el original: podría llevar EXIF con la ubicación.
                mensajes.push(`No se pudo preparar «${archivo.name || 'la foto'}».`);
                if (montado.current) setErrores([...mensajes]);
            }
        }
        if (montado.current) setProcesando(false);
    };

    const ordenadas = ordenarTomas(tomas);
    const titulos = Object.fromEntries(ordenadas.filter((t) => t.paso != null).map((t) => [t.id, PASOS_TOMA[t.paso].titulo]));
    const lleno = tomas.length >= maximo;

    return (
        <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
                Elige de {minimo} a {maximo} fotos distintas del mismo alumno.
            </p>
            <input ref={inputRef} type="file" hidden multiple accept="image/jpeg" disabled={deshabilitado} onChange={alElegir} data-testid="input-fotos" />
            <div>
                <Button
                    ref={botonRef}
                    variant="secondary"
                    icon={<ImagePlus aria-hidden="true" className="size-4" strokeWidth={1.75} />}
                    disabled={deshabilitado || lleno}
                    loading={procesando}
                    onClick={() => inputRef.current?.click()}
                >
                    Agregar fotos (JPG)
                </Button>
            </div>
            {errores.length > 0 && (
                <ul role="alert" className="flex flex-col gap-1 text-sm text-destructive">
                    {errores.map((m, i) => (
                        <li key={`${i}-${m}`}>{m}</li>
                    ))}
                </ul>
            )}
            {ordenadas.length > 0 && (
                <GaleriaTomas ranuras={ranurasLista(ordenadas, titulos)} accion="quitar" onAccion={(id) => onQuitar?.(id)} deshabilitado={deshabilitado} />
            )}
        </div>
    );
}
