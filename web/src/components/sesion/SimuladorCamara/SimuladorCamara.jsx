'use client';

import clsx from 'clsx';
import { FlaskConical, RotateCcw } from 'lucide-react';
import { useId } from 'react';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Checkbox from '@/components/ui/Checkbox';
import Select from '@/components/ui/Select';
import { ESCENARIOS, MINUTO_DE_INICIO_DEMO, OPCIONES_CICLOS, textoEsperado } from './simuladorCamara.utils.js';

// Interruptor accesible (role="switch"): el estado se dice también con texto («Activa» / «Apagada»), no solo con la posición ni el color.
function Interruptor({ activo, onCambio, disabled, ...rest }) {
    return (
        <span className="flex shrink-0 items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground" aria-hidden="true">{activo ? 'Activa' : 'Apagada'}</span>
            <button
                type="button"
                role="switch"
                aria-checked={activo}
                disabled={disabled}
                onClick={() => onCambio(!activo)}
                className={clsx(
                    'relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border border-transparent transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50',
                    activo ? 'bg-primary' : 'bg-input',
                )}
                {...rest}
            >
                <span aria-hidden="true" className={clsx('block size-6 rounded-full bg-card transition-transform duration-150', activo ? 'translate-x-7' : 'translate-x-1')} />
            </button>
        </span>
    );
}

// Estado de la simulación en una línea, para el aria-live del panel (cambia una vez por ciclo, no por segundo).
function lineaDeEstado(s) {
    if (!s.camaraDisponible) return 'El aula no tiene una cámara del navegador activa: sin ella no se puede simular una captura.';
    if (s.preparando) return 'Preparando el reloj de demostración…';
    if (!s.encendido) return 'Elige el escenario y activa la cámara simulada: la primera captura sale en cuanto se active.';
    if (s.fueraDeVentana) return 'La sesión está fuera de la ventana de tolerancia: no se envían fotogramas hasta que el reloj vuelva a un minuto dentro de ella.';
    if (s.terminado) return `Simulación completa: ${s.ciclo} ${s.ciclo === 1 ? 'ciclo enviado' : 'ciclos enviados'}. Reinicia los ciclos para repetirla.`;
    const limite = s.maxCiclos > 0 ? ` de ${s.maxCiclos}` : '';
    const visita = s.plan.visitantes > 0 ? ` y ${s.plan.visitantes === 1 ? 'un visitante' : `${s.plan.visitantes} visitantes`}` : '';
    return `Ciclos enviados: ${s.ciclo}${limite}. Siguiente fotograma: ${s.plan.alumnos} ${s.plan.alumnos === 1 ? 'alumno' : 'alumnos'}${visita}, en unos ${s.intervaloSeg} s.`;
}

/**
 * Controles de la cámara simulada (SOLO desarrollo local con el reloj de demostración). Es presentacional: el estado y el dibujo viven en
 * useSimuladorCamara, que quien lo monta (CapturaContinua) pasa en `simulador`. No se pinta si `simulador.habilitado` es falso, que es
 * lo que api_ahora().reloj_simulado informa: en producción esa bandera nunca es verdadera.
 * @param {{ simulador: ReturnType<typeof import('./useSimuladorCamara.js').default>, className?: string }} props
 */
export default function SimuladorCamara({ simulador: s, className }) {
    const idTitulo = useId();
    const idEscenario = useId();
    const idCiclos = useId();
    if (!s?.habilitado) return null;

    const esperado = textoEsperado({
        escenario: s.escenario,
        intervaloSeg: s.intervaloSeg,
        total: s.total,
        visitante: s.visitante,
        reloj: s.ajustarReloj,
    });

    return (
        <section aria-labelledby={idTitulo} className={clsx('flex flex-col gap-3 rounded-xl border border-dashed border-input bg-muted/40 p-4', className)}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-tono-violeta">
                        <FlaskConical aria-hidden="true" className="size-4" strokeWidth={1.75} style={{ color: 'var(--tono-violeta-fg)' }} />
                    </span>
                    <div className="min-w-0">
                        <h3 id={idTitulo} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
                            Cámara simulada (demostración)
                            <Badge tone="warning">Solo desarrollo</Badge>
                        </h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">Dibuja a tus alumnos como los reconoce el servicio de pruebas; una cámara real no puede.</p>
                    </div>
                </div>
                <Interruptor aria-labelledby={idTitulo} activo={s.encendido} onCambio={s.alternar} disabled={!s.camaraDisponible || s.preparando} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                    <label htmlFor={idEscenario} className="text-sm font-medium">Escenario</label>
                    <Select id={idEscenario} value={s.escenario} onChange={(e) => s.cambiarEscenario(e.target.value)} options={ESCENARIOS.map((e) => ({ value: e.id, label: e.etiqueta }))} />
                </div>
                <div className="flex flex-col gap-1">
                    <label htmlFor={idCiclos} className="text-sm font-medium">Detener después de</label>
                    <Select
                        id={idCiclos}
                        value={String(s.maxCiclos)}
                        onChange={(e) => s.setMaxCiclos(Number(e.target.value))}
                        options={OPCIONES_CICLOS.map((n) => ({ value: String(n), label: n > 0 ? `${n} ciclos` : 'Sin límite' }))}
                    />
                </div>
                <Checkbox label="Que pase un visitante de vez en cuando" checked={s.visitante} onChange={(e) => s.setVisitante(e.target.checked)} />
                <Checkbox
                    label={`Empezar en el minuto ${MINUTO_DE_INICIO_DEMO} de la clase`}
                    hint="Mueve el reloj si hace falta, para que cuenten como Presente."
                    checked={s.ajustarReloj}
                    onChange={(e) => s.setAjustarReloj(e.target.checked)}
                    disabled={s.encendido}
                />
            </div>

            <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Qué esperar: </span>
                {esperado}
            </p>

            <p aria-live="polite" className="text-sm font-medium">{lineaDeEstado(s)}</p>
            {s.aviso && <Alert tone={s.aviso.tono}>{s.aviso.texto}</Alert>}

            {s.encendido && (
                <div>
                    <Button variant="secondary" size="sm" onClick={s.reiniciar} icon={<RotateCcw aria-hidden="true" className="size-3.5" strokeWidth={1.75} />}>
                        Reiniciar ciclos
                    </Button>
                </div>
            )}
        </section>
    );
}
