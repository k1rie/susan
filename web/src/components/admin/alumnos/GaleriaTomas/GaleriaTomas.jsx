'use client';

import clsx from 'clsx';
import { CircleAlert, CircleCheck, Copy, LoaderCircle, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import { textoEstadoToma } from '../PlantillaFacialPanel/plantillaFacial.utils.js';

// Cada estado lleva texto, ícono y color: nunca solo color (accesibilidad).
const ESTADOS = {
    verificando: { Icono: LoaderCircle, tono: 'text-muted-foreground', gira: true },
    aceptada: { Icono: CircleCheck, tono: 'text-presente' },
    calidad: { Icono: CircleAlert, tono: 'text-ausente' },
    inconsistente: { Icono: CircleAlert, tono: 'text-retardo' },
    ilegible: { Icono: CircleAlert, tono: 'text-ausente' },
    duplicada: { Icono: Copy, tono: 'text-retardo' },
};

// La URL de objeto se crea una vez por miniatura (el llamador usa key = id de la toma) y se libera al quitar,
// repetir, limpiar o desmontar. La liberación se difiere un instante y el montaje la cancela: así sobrevive al
// doble montaje de efectos de StrictMode sin dejar la imagen rota.
function Miniatura({ blob, alt }) {
    const [url] = useState(() => URL.createObjectURL(blob));
    const liberacion = useRef(null);
    useEffect(() => {
        clearTimeout(liberacion.current);
        return () => {
            liberacion.current = setTimeout(() => URL.revokeObjectURL(url), 0);
        };
    }, [url]);
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={alt} className="aspect-[4/3] w-full rounded-lg border border-border object-cover" />;
}

/**
 * Rejilla de ranuras y miniaturas compartida por la captura guiada y la subida de archivos.
 * ranuras: [{ clave, numero, titulo, toma|null, destacada, Icono?, accion? }]. `accion` ('repetir'|'quitar')
 * rige para todas salvo que la ranura traiga la suya. onAccion(id, accionEfectiva).
 * 2 columnas bajo 480 px, 3 desde 480 y 5 desde sm; el estado va como texto bajo la miniatura y la acción
 * lleva texto corto (ui/Button no se puede ensanchar de forma fiable) con el nombre completo en aria-label.
 */
export default function GaleriaTomas({ ranuras, accion = 'quitar', onAccion, deshabilitado = false }) {
    const total = ranuras.length;
    const numeroPorId = new Map(ranuras.filter((r) => r.toma).map((r) => [r.toma.id, r.numero]));
    const numeroDe = (id) => numeroPorId.get(id) ?? null;

    return (
        <ul className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3 sm:grid-cols-5">
            {ranuras.map((r) => {
                const { toma } = r;
                const rotulo = `${r.numero}. ${r.titulo}`;
                if (!toma) {
                    return (
                        <li
                            key={r.clave}
                            aria-label={`Toma ${r.numero} de ${total}, ${r.titulo}, pendiente`}
                            aria-current={r.destacada ? 'step' : undefined}
                            className={clsx(
                                'flex min-w-0 flex-col gap-1.5 rounded-xl border p-1.5',
                                r.destacada ? 'border-foreground bg-accent' : 'border-dashed border-border',
                            )}
                        >
                            <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                {r.Icono ? <r.Icono aria-hidden="true" className="size-6" strokeWidth={1.5} /> : null}
                            </div>
                            <p className="text-xs font-medium break-words">{rotulo}</p>
                            <p className="text-xs break-words text-muted-foreground">{r.destacada ? 'Siguiente toma' : 'Pendiente'}</p>
                        </li>
                    );
                }
                const e = ESTADOS[toma.estado] ?? ESTADOS.verificando;
                const EstadoIcono = e.Icono;
                const texto = textoEstadoToma(toma, numeroDe);
                const modo = r.accion ?? accion;
                const Accion = modo === 'repetir' ? RotateCcw : Trash2;
                const verbo = modo === 'repetir' ? 'Repetir' : 'Quitar';
                return (
                    <li
                        key={r.clave}
                        aria-label={`Toma ${r.numero} de ${total}, ${r.titulo}, ${texto}`}
                        className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-border bg-card p-1.5"
                    >
                        <Miniatura key={toma.id} blob={toma.blob} alt={`Toma ${r.numero}: ${r.titulo}`} />
                        <p className="text-xs font-medium break-words">{rotulo}</p>
                        <p className={clsx('flex items-start gap-1 text-xs break-words', e.tono)}>
                            <EstadoIcono
                                aria-hidden="true"
                                className={clsx('mt-px size-3.5 shrink-0', e.gira && 'motion-safe:animate-spin')}
                                strokeWidth={1.75}
                            />
                            <span className="min-w-0">{texto}</span>
                        </p>
                        <Button
                            variant="secondary"
                            size="sm"
                            fullWidth
                            icon={<Accion aria-hidden="true" className="size-3.5" strokeWidth={1.75} />}
                            aria-label={`${verbo} toma ${r.numero}`}
                            disabled={deshabilitado}
                            onClick={() => onAccion?.(toma.id, modo)}
                        >
                            {verbo}
                        </Button>
                    </li>
                );
            })}
        </ul>
    );
}
