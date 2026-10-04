'use client';

import clsx from 'clsx';
import { CalendarClock, Clock, FastForward, Pause, Play, RotateCcw } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import Button from '@/components/ui/Button/Button.jsx';
import Input from '@/components/ui/Input/Input.jsx';
import {
    SALTOS_MIN,
    fijarDesdeInput,
    formatearFecha,
    formatearHora,
    formatearIso,
    leerIso,
    partesEnZona,
    valorParaInput,
} from './relojDemo.utils.js';
import useRelojDemo from './useRelojDemo.js';

const icono = (Componente) => <Componente aria-hidden="true" className="size-3.5" strokeWidth={1.75} />;

// Tarjeta del reloj de demostracion (solo desarrollo local): muestra la fecha y hora simuladas y permite adelantarlas,
// detenerlas/echarlas a andar, fijarlas o volver al valor inicial, para probar el ciclo de una sesion (presente,
// retardo, cierre) sin esperar. Se monta dentro del AppShell cuando el reloj simulado esta activo; si el servidor dice
// que no existe (produccion / sin modo local) no pinta nada. Una sola vez por pantalla.
export default function RelojDemo({ className }) {
    const reloj = useRelojDemo();
    const [fijando, setFijando] = useState(false);
    const [valor, setValor] = useState('');
    const idPanel = useId();
    const idCampo = useId();
    const refFijar = useRef(null);

    if (reloj.apagado) return null;

    const { estado, mostrado, error, pendiente } = reloj;
    const partes = mostrado ? partesEnZona(mostrado.ms, mostrado.offsetMin) : null;
    const corre = estado?.corre === true;
    // Un boton enfocado que se deshabilita pierde el foco (document.activeElement pasa a body) y quien usa teclado o lector de pantalla
    // tendria que recorrer la pagina otra vez tras cada salto de reloj, que es una accion muy repetida. Durante la peticion se usa
    // aria-disabled (el boton sigue enfocado) y se descarta el clic; `disabled` solo mientras no hay estado, cuando aun nada tiene el foco.
    const ejecutar = (accion) => () => {
        if (!pendiente) accion();
    };

    const inicial = estado?.inicial ? leerIso(estado.inicial) : null;
    const textoInicial = inicial
        ? `${formatearFecha(partesEnZona(inicial.ms, inicial.offsetMin))} ${formatearHora(partesEnZona(inicial.ms, inicial.offsetMin), { segundos: false })}`
        : null;

    const alternarFijar = () => {
        // El campo arranca en la hora simulada de ese momento.
        if (!fijando && estado) setValor(valorParaInput(estado.ahora));
        setFijando((abierto) => !abierto);
    };
    const enviarFijar = async (evento) => {
        evento.preventDefault();
        if (pendiente) return;
        const texto = fijarDesdeInput(valor);
        // El formulario se desmonta al fijar: el foco pasa antes al boton «Fijar hora» (siempre montado) para no caer en <body>.
        if (texto && (await reloj.fijar(texto))) {
            setFijando(false);
            refFijar.current?.focus();
        }
    };

    return (
        <section
            aria-label="Reloj de demostración"
            className={clsx('rounded-xl border border-warning/30 bg-retardo-bg px-3 py-2.5 text-foreground', className)}
        >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex min-w-0 items-center gap-2.5">
                    <Clock aria-hidden="true" className="size-[18px] shrink-0 text-retardo" strokeWidth={1.75} />
                    <div className="min-w-0">
                        <p className="text-xs font-medium">Reloj de demostración (solo desarrollo)</p>
                        {/* Detenido: se anuncia cada cambio. Corriendo: avanza solo y no se anuncia segundo a segundo. */}
                        <time
                            dateTime={mostrado ? formatearIso(mostrado.ms, mostrado.offsetMin) : undefined}
                            aria-live={corre ? 'off' : 'polite'}
                            aria-atomic="true"
                            aria-busy={!estado}
                            className="block text-sm font-semibold tabular-nums text-foreground"
                        >
                            <span className="sr-only">Hora simulada: </span>
                            {partes ? `${formatearFecha(partes)} · ${formatearHora(partes)}` : 'Cargando…'}
                            {estado && (
                                <>
                                    {' '}
                                    <span className="ml-2 text-xs font-medium text-muted-foreground">{corre ? 'en marcha' : 'detenido'}</span>
                                </>
                            )}
                        </time>
                    </div>
                </div>

                <div role="group" aria-label="Mover el reloj" className="flex flex-wrap items-center gap-1.5 sm:ml-auto sm:justify-end">
                    {SALTOS_MIN.map((min) => (
                        <Button
                            key={min}
                            variant="secondary"
                            size="sm"
                            icon={icono(FastForward)}
                            disabled={!estado}
                            aria-disabled={pendiente || undefined}
                            onClick={ejecutar(() => reloj.avanzar(min))}
                        >
                            <span className="sr-only">Adelantar el reloj</span> +{min} min
                        </Button>
                    ))}
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={icono(corre ? Pause : Play)}
                        disabled={!estado}
                        aria-disabled={pendiente || undefined}
                        onClick={ejecutar(reloj.alternarCorrer)}
                    >
                        {corre ? 'Pausar' : 'Correr'}
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={icono(RotateCcw)}
                        disabled={!estado}
                        aria-disabled={pendiente || undefined}
                        onClick={ejecutar(reloj.restablecer)}
                        title={textoInicial ? `Volver a ${textoInicial}` : undefined}
                    >
                        Restablecer
                    </Button>
                    <Button
                        ref={refFijar}
                        variant="secondary"
                        size="sm"
                        icon={icono(CalendarClock)}
                        disabled={!estado}
                        aria-expanded={fijando}
                        aria-controls={idPanel}
                        onClick={alternarFijar}
                    >
                        Fijar hora
                    </Button>
                </div>
            </div>

            {fijando && (
                <form id={idPanel} onSubmit={enviarFijar} className="mt-2.5 flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                        <label htmlFor={idCampo} className="mb-1 block text-xs font-medium">
                            Fecha y hora simuladas (hora de la sede)
                        </label>
                        <Input id={idCampo} type="datetime-local" required value={valor} onChange={(e) => setValor(e.target.value)} />
                    </div>
                    <Button type="submit" disabled={!fijarDesdeInput(valor)} aria-disabled={pendiente || undefined}>
                        Fijar
                    </Button>
                </form>
            )}

            {error && (
                <p role="alert" className="mt-2 text-xs font-medium text-destructive">
                    {error.message || 'No se pudo cambiar el reloj.'}
                </p>
            )}
        </section>
    );
}
