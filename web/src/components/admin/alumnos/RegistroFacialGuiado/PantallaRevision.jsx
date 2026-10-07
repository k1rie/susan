'use client';

import clsx from 'clsx';
import { CircleAlert, CircleCheck, Copy, ImagePlus, LoaderCircle, Plus } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import { numerarTomas } from '../CapturaGuiadaPlantilla/capturaGuiada.utils.js';
import { esServicioNoDisponible, mensajeErrorPlantilla, textoContador, textoEstadoToma, textoFotos } from '../PlantillaFacialPanel/plantillaFacial.utils.js';
import { Cuerpo, Pie } from './Estructura.jsx';
import Fotograma from './Fotograma.jsx';
import { elementosRevision } from './registroGuiado.utils.js';

// Cada estado lleva texto, ícono y color: nunca solo color.
const ESTADOS = {
    verificando: { Icono: LoaderCircle, tono: 'text-muted-foreground', aro: 'ring-border', insignia: 'bg-muted text-muted-foreground', gira: true },
    aceptada: { Icono: CircleCheck, tono: 'text-presente', aro: 'ring-presente', insignia: 'bg-presente text-primary-foreground' },
    calidad: { Icono: CircleAlert, tono: 'text-ausente', aro: 'ring-ausente', insignia: 'bg-ausente text-primary-foreground' },
    inconsistente: { Icono: CircleAlert, tono: 'text-retardo', aro: 'ring-retardo', insignia: 'bg-retardo text-primary-foreground' },
    ilegible: { Icono: CircleAlert, tono: 'text-ausente', aro: 'ring-ausente', insignia: 'bg-ausente text-primary-foreground' },
    duplicada: { Icono: Copy, tono: 'text-retardo', aro: 'ring-retardo', insignia: 'bg-retardo text-primary-foreground' },
};

function Elemento({ e, numeroDe, deshabilitado, onRepetir, onAgregar, onQuitar }) {
    const { toma } = e;
    const estado = toma ? (ESTADOS[toma.estado] ?? ESTADOS.verificando) : null;
    const desdeCamara = toma?.origen === 'camara' && e.paso != null;
    const texto = toma ? textoEstadoToma(toma, numeroDe) : e.omitido ? 'Omitida' : 'Sin tomar';
    return (
        <li aria-label={`Toma ${e.numero}, ${e.titulo}, ${texto}`} className="flex min-w-0 flex-col items-center gap-1.5 text-center">
            <div className="relative size-[4.75rem] sm:size-[5.5rem]">
                <div
                    className={clsx(
                        'size-full overflow-hidden rounded-full bg-muted',
                        toma ? clsx('ring-2 ring-offset-2 ring-offset-card', estado.aro) : 'border-2 border-dashed border-border',
                    )}
                >
                    {toma ? (
                        <Fotograma key={toma.id} blob={toma.blob} espejo={toma.origen === 'camara'} alt={`Toma ${e.numero}: ${e.titulo}`} />
                    ) : (
                        <span className="flex size-full items-center justify-center text-muted-foreground">
                            <ImagePlus aria-hidden="true" className="size-6" strokeWidth={1.5} />
                        </span>
                    )}
                </div>
                {toma && (
                    <span className={clsx('absolute -right-0.5 -bottom-0.5 flex size-6 items-center justify-center rounded-full ring-2 ring-card', estado.insignia)}>
                        <estado.Icono aria-hidden="true" className={clsx('size-3.5', estado.gira && 'motion-safe:animate-spin')} strokeWidth={2} />
                    </span>
                )}
            </div>
            <p className="w-full text-xs font-medium break-words">
                {e.numero}. {e.titulo}
            </p>
            <p className={clsx('w-full text-xs break-words', toma ? estado.tono : 'text-muted-foreground')}>{texto}</p>
            <div className="mt-auto pt-0.5">
                {toma && desdeCamara && (
                    <Button variant="ghost" size="sm" disabled={deshabilitado} aria-label={`Repetir toma ${e.numero}`} onClick={() => onRepetir(toma.id, e.paso)}>
                        Repetir
                    </Button>
                )}
                {toma && !desdeCamara && (
                    <Button variant="ghost" size="sm" disabled={deshabilitado} aria-label={`Quitar toma ${e.numero}`} onClick={() => onQuitar(toma.id)}>
                        Quitar
                    </Button>
                )}
                {!toma && e.paso != null && (
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={deshabilitado}
                        aria-label={`Agregar toma ${e.numero}`}
                        icon={<Plus aria-hidden="true" className="size-3.5" strokeWidth={1.75} />}
                        onClick={() => onAgregar(e.paso)}
                    >
                        Agregar
                    </Button>
                )}
            </div>
        </li>
    );
}

// Revisión antes de guardar: las tomas con su resultado, lo que falta y el botón de registrar. Es la misma para cámara y archivo.
export default function PantallaRevision({ p, omitidos, onRetomar, onQuitar, onEmpezarDeNuevo, onAgregarFotos, onRegistrar }) {
    const total = p.tomas.length;
    const marcadas = p.tomas.filter((t) => t.estado !== 'aceptada' && t.estado !== 'verificando').length;
    const numeros = numerarTomas(p.tomas, p.modo);
    const elementos = elementosRevision({ tomas: p.tomas, omitidos, numeros, modo: p.modo });
    const resultado = p.verificacion.resultado;
    const enviando = p.envio.cargando;
    const texto = textoContador({ total, aceptadas: p.aceptadas, marcadas, minimo: p.minimo });
    // Los textos de botón deben caber en ~286 px (360 px de pantalla): ui/Button no parte líneas (whitespace-nowrap).
    const textoRegistrar = `${p.activa ? 'Reemplazar plantilla' : 'Registrar plantilla'} con ${textoFotos(total)}`;

    return (
        <>
            <Cuerpo centrado={false}>
                <div className="flex flex-col gap-5 py-2">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-xl font-semibold tracking-tight">Revisa tus tomas</h2>
                        <p className="text-sm text-muted-foreground">{texto}</p>
                        <div role="status" aria-live="polite" className="sr-only">
                            {p.anuncio} {texto}
                        </div>
                    </div>

                    <ul className="grid grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-5 sm:gap-x-3">
                        {elementos.map((e) => (
                            <Elemento
                                key={e.clave}
                                e={e}
                                numeroDe={(id) => numeros.get(id)}
                                deshabilitado={enviando}
                                onRepetir={onRetomar}
                                onAgregar={(paso) => onRetomar(null, paso)}
                                onQuitar={onQuitar}
                            />
                        ))}
                    </ul>

                    {p.verificacion.error && (
                        <Alert tone="danger" title="No se pudieron verificar las fotos">
                            {mensajeErrorPlantilla(p.verificacion.error)}
                            <div className="mt-2">
                                <Button variant="secondary" size="sm" onClick={p.verificacion.reintentar}>
                                    Reintentar verificación
                                </Button>
                            </div>
                        </Alert>
                    )}
                    {resultado?.ambiguo && <Alert tone="warning">Las tomas no coinciden entre sí. Revisa que todas sean de la misma persona.</Alert>}
                    {resultado?.advertencias?.includes('DIVERSIDAD_BAJA') && (
                        <Alert tone="info">Las tomas son casi idénticas; varía el ángulo, la expresión o la luz.</Alert>
                    )}
                    {p.envio.error && (
                        <Alert tone="danger" title="No se pudo registrar la plantilla">
                            {mensajeErrorPlantilla(p.envio.error)}
                            {esServicioNoDisponible(p.envio.error) && (
                                <div className="mt-2">
                                    <Button variant="secondary" size="sm" onClick={p.reintentarEnvio}>
                                        Reintentar
                                    </Button>
                                </div>
                            )}
                        </Alert>
                    )}
                </div>
            </Cuerpo>
            <Pie>
                <Button size="lg" fullWidth onClick={() => onRegistrar(false)} disabled={!p.puedeRegistrar} loading={p.verificacion.cargando}>
                    {textoRegistrar}
                </Button>
                {p.puedeRegistrarUna && (
                    <Button variant="ghost" fullWidth onClick={() => onRegistrar(true)} disabled={enviando}>
                        Registrar con una sola foto
                    </Button>
                )}
                {p.modo === 'archivo' ? (
                    <Button variant="ghost" fullWidth onClick={onAgregarFotos} disabled={enviando}>
                        Agregar o cambiar fotos
                    </Button>
                ) : (
                    <Button variant="ghost" fullWidth onClick={onEmpezarDeNuevo} disabled={enviando}>
                        Empezar de nuevo
                    </Button>
                )}
                {(p.activa || p.puedeRegistrarUna) && (
                    <p className="text-center text-xs break-words text-muted-foreground">
                        {p.activa && 'La plantilla anterior se archivará al reemplazarla. '}
                        {p.puedeRegistrarUna && 'Con una sola foto el reconocimiento es menos preciso que con 3 a 8 tomas.'}
                    </p>
                )}
            </Pie>
        </>
    );
}
