'use client';

import { CalendarPlus, Camera, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import CampoFecha from '@/components/ui/CampoFecha';
import Field from '@/components/ui/Field';
import FormActions from '@/components/ui/FormActions';
import RangoFechas from '@/components/ui/RangoFechas';
import SuccessState from '@/components/ui/SuccessState';
import { useApiMutation } from '@/hooks/data';
import { generarSesiones } from '@/lib/api/admin.js';
import { formatearFechaCorta, sumarDias } from '@/lib/formularios/fechas.js';
import { plural } from '../compartido/grupos.utils.js';
import { useHoyNegocio } from '../compartido/useHoyNegocio.js';
import { etiquetaDias } from '../HorarioSemanal/horarioSemanal.utils.js';
import { agregarFechaOmitida, ATAJOS_SESIONES, contarSesiones, MAX_DIAS_RANGO, validarGeneracion } from './generarSesiones.utils.js';

// Genera sesiones programadas a partir del horario entre dos fechas; es idempotente (lo existente se omite) y no se pueden borrar desde
// aquí, por eso el botón dice cuántas se van a crear (vista previa con el horario). Valores por defecto: desde hoy (el «hoy» del plantel)
// y cuatro semanas; atajos de rango; las fechas a omitir son una lista con chips, no texto libre. `horario` (bloques de la API) activa
// la vista previa; sin él se genera igual. `onNavegar(pestaña)` lleva a los siguientes pasos del resultado.
export default function GenerarSesiones({ idGrupo, horario, sinHorario = false, onGenerated, onNavegar }) {
    const { hoy } = useHoyNegocio();
    const generar = useApiMutation(generarSesiones);
    // `null` = «el valor por omisión» (hoy y cuatro semanas): sigue a `hoy` y no se confunde con un campo que la persona vació.
    const [rango, setRango] = useState({ desde: null, hasta: null });
    const [omitir, setOmitir] = useState([]);
    const [pendiente, setPendiente] = useState('');
    const [intentado, setIntentado] = useState(false);
    const [resumen, setResumen] = useState(null);

    const desde = rango.desde ?? hoy;
    const hasta = rango.hasta ?? sumarDias(desde, 27);
    const validacion = validarGeneracion({ desde, hasta, omitir: omitir.join(' ') });
    const errorFecha = intentado ? validacion.errores.desde || validacion.errores.hasta : undefined;
    const errorOmitir = pendiente && intentado ? 'Pulsa «Agregar» para incluir esa fecha, o bórrala.' : undefined;

    const conHorario = Array.isArray(horario) && horario.length > 0;
    const previa = conHorario && validacion.valido ? contarSesiones({ horario, desde, hasta, omitir }) : null;
    const sinClases = previa != null && previa.total === 0;

    const agregarPendiente = () => {
        setOmitir((lista) => agregarFechaOmitida(lista, pendiente));
        setPendiente('');
    };

    const enviar = async (e) => {
        e.preventDefault();
        setIntentado(true);
        if (!validacion.valido || pendiente || sinClases) return;
        try {
            const r = await generar.run({ idGrupo, desde, hasta, omitirFechas: validacion.omitirFechas });
            setResumen(r);
            onGenerated?.(r);
        } catch {
            // El error queda en `generar.error` y se muestra junto al botón.
            setResumen(null);
        }
    };

    const otraVez = () => {
        setResumen(null);
        setIntentado(false);
        setOmitir([]);
        // Lo natural es seguir donde se quedó: desde el día siguiente al último generado.
        setRango({ desde: sumarDias(hasta, 1), hasta: null });
    };

    if (resumen) {
        const manual = resumen.modo_registro !== 'automatico';
        const pasos = onNavegar
            ? [
                  { label: 'Inscribir alumnos', description: 'Las sesiones ya existen: falta quién las toma.', icon: UserPlus, onClick: () => onNavegar('inscripciones'), recommended: true },
                  { label: 'Revisar las cámaras del aula', description: manual ? 'El aula no tiene cámaras activas: el pase de lista será manual.' : 'El pase de lista usará la cámara del aula.', icon: Camera, onClick: () => onNavegar('aula') },
              ]
            : [];
        return (
            <SuccessState
                title={resumen.creadas === 0 ? 'No se creó ninguna sesión nueva' : `${plural(resumen.creadas, 'sesión creada', 'sesiones creadas')}`}
                description={`Creadas: ${resumen.creadas}. Omitidas: ${resumen.omitidas} (${resumen.omitidas_por_fecha} por fecha omitida, ${resumen.ya_existentes} ya existentes). Modo de registro: ${manual ? 'manual' : 'automático'}.`}
                icon={CalendarPlus}
                steps={pasos}
                actions={[{ label: 'Generar más sesiones', onClick: otraVez, variant: 'secondary' }]}
            />
        );
    }

    return (
        <form onSubmit={enviar} noValidate className="flex flex-col gap-4" aria-label="Generar sesiones">
            {sinHorario && <Alert tone="warning">Guarda primero el horario del grupo para poder generar sesiones.</Alert>}

            <RangoFechas
                label="Rango de fechas"
                desde={desde}
                hasta={hasta}
                onChange={({ desde: d, hasta: h }) => setRango({ desde: d, hasta: h })}
                maxDias={MAX_DIAS_RANGO}
                hoy={hoy}
                atajos={ATAJOS_SESIONES}
                required
                error={errorFecha}
            />

            <div className="flex flex-col gap-2">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,16rem)_auto] sm:items-start">
                    <Field label="Fecha a omitir" optional hint="Días festivos o suspensiones; no se crea la clase de ese día." error={errorOmitir}>
                        <CampoFecha
                            value={pendiente}
                            onChange={(e) => setPendiente(e.target.value)}
                            min={desde}
                            max={hasta}
                            atajos={[]}
                            mostrarTexto={false}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && pendiente) {
                                    e.preventDefault();
                                    agregarPendiente();
                                }
                            }}
                        />
                    </Field>
                    <Button variant="secondary" disabled={!pendiente} onClick={agregarPendiente} className="sm:mt-6">
                        Agregar fecha
                    </Button>
                </div>
                {omitir.length > 0 && (
                    <ul aria-label="Fechas a omitir" className="flex flex-wrap gap-2">
                        {omitir.map((fecha) => {
                            const fuera = fecha < desde || fecha > hasta;
                            return (
                                <li key={fecha} className="inline-flex min-h-8 items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-3 text-[13px]">
                                    <span className="font-medium">{formatearFechaCorta(fecha)}</span>
                                    {fuera && <span className="text-muted-foreground">(fuera del rango)</span>}
                                    <button
                                        type="button"
                                        onClick={() => setOmitir((lista) => lista.filter((x) => x !== fecha))}
                                        aria-label={`Quitar la fecha ${formatearFechaCorta(fecha)}`}
                                        className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/30 focus-visible:outline-none"
                                    >
                                        <X aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {previa && !sinClases && (
                <div aria-live="polite" className="rounded-xl bg-muted/50 p-3 text-sm">
                    <p className="font-medium">Se crearán hasta {plural(previa.total, 'sesión', 'sesiones')}</p>
                    <p className="text-[13px] text-muted-foreground">
                        {etiquetaDias(previa.dias.map(String))}, del {formatearFechaCorta(desde)} al {formatearFechaCorta(hasta)}
                        {previa.porFechas > 0 ? `, sin ${plural(previa.porFechas, 'clase', 'clases')} de las fechas omitidas` : ''}. Las que ya existan se omiten.
                    </p>
                </div>
            )}
            {sinClases && (
                <Alert tone="warning" compact>
                    En ese rango no cae ninguna clase del horario. Amplía las fechas o revisa los días del horario.
                </Alert>
            )}
            {generar.error && (
                <Alert tone="danger" compact title="No se pudieron generar las sesiones">
                    {generar.error.message}
                </Alert>
            )}

            <FormActions sticky={false} motivoBloqueo={sinClases ? 'No hay clases en ese rango.' : undefined}>
                <Button type="submit" loading={generar.loading} disabled={sinHorario || sinClases}>
                    {previa && previa.total > 0 ? `Generar ${plural(previa.total, 'sesión', 'sesiones')}` : 'Generar sesiones'}
                </Button>
            </FormActions>
        </form>
    );
}
