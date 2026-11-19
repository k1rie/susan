'use client';

import clsx from 'clsx';
import { CircleAlert } from 'lucide-react';
import { useId } from 'react';
import CampoFecha from '../CampoFecha/CampoFecha.jsx';
import { useHoy } from '../CampoFecha/useHoy.js';
import { ATAJOS_RANGO, resolverAtajosRango, resumenDelRango, validarRango } from './rangoFechas.utils.js';

// Par «desde / hasta» con validación cruzada (desde ≤ hasta), límites, tope de largo y atajos de rango. Es un grupo
// (<fieldset>): `label` es su leyenda. Los dos campos son CampoFecha, así que `onChange` recibe el par ya armado.
//
//   desde / hasta         -> 'AAAA-MM-DD' | ''
//   onChange({desde, hasta})
//   min / max             -> límites de ambos campos.   maxDias -> tope de largo del rango (p. ej. 366).
//   atajos                -> [{ label, valor: { desde, hasta } | ({ actual, hoy }) => { desde, hasta } }]. Por omisión
//                            «Últimos 7 días» y «Últimos 30 días»; atajos={[]} los quita. Builders en ./rangoFechas.utils.js.
//   labelDesde/labelHasta -> 'Desde' / 'Hasta'.   resumen -> escribe «1 oct 2026 al 30 oct 2026 · 30 días» (por omisión sí).
//   error                 -> mensaje externo (p. ej. del servidor); si falta, se muestra el de la validación cruzada.
export default function RangoFechas({
    desde = '',
    hasta = '',
    onChange,
    min,
    max,
    maxDias,
    atajos = ATAJOS_RANGO,
    hoy,
    label,
    labelDesde = 'Desde',
    labelHasta = 'Hasta',
    resumen = true,
    required = false,
    disabled = false,
    error,
    id,
    className,
    'aria-describedby': describedbyExterno,
}) {
    const generado = useId();
    const base = id || generado;
    const idDesde = `${base}-desde`;
    const idHasta = `${base}-hasta`;
    const idError = `${base}-error`;
    const referencia = useHoy(hoy);

    const problemas = validarRango({ desde, hasta }, { min, max, maxDias });
    const mensaje = error || problemas.rango || problemas.desde || problemas.hasta;
    const textoResumen = resumen && !mensaje ? resumenDelRango(desde, hasta) : '';
    const visibles = resolverAtajosRango(atajos, { hoy: referencia, actual: { desde, hasta }, min, max });
    const describedby = [describedbyExterno, mensaje ? idError : null].filter(Boolean).join(' ') || undefined;

    const cambiar = (campo, valor) => onChange?.({ desde, hasta, [campo]: valor });
    // Los límites nativos también acotan el selector: no se puede elegir un «desde» posterior al «hasta» ya puesto.
    const topeDesde = hasta && (!max || hasta < max) ? hasta : max;
    const pisoHasta = desde && (!min || desde > min) ? desde : min;
    const marcaInvalida = (campo) => Boolean(error || problemas.rango || problemas[campo]);

    const etiqueta = (htmlFor, texto) => (
        <label htmlFor={htmlFor} className="text-sm font-medium">
            {texto}
            {required && (
                <span aria-hidden="true" className="text-destructive">
                    {' '}
                    *
                </span>
            )}
        </label>
    );

    return (
        <fieldset aria-describedby={describedby} className={clsx('m-0 flex min-w-0 flex-col gap-2 border-0 p-0', className)}>
            {label && <legend className="mb-1 w-full p-0 text-sm font-medium">{label}</legend>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-1">
                    {etiqueta(idDesde, labelDesde)}
                    <CampoFecha
                        id={idDesde}
                        value={desde}
                        onChange={(e) => cambiar('desde', e.target.value)}
                        min={min}
                        max={topeDesde}
                        atajos={[]}
                        mostrarTexto={false}
                        required={required}
                        disabled={disabled}
                        invalid={marcaInvalida('desde')}
                    />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                    {etiqueta(idHasta, labelHasta)}
                    <CampoFecha
                        id={idHasta}
                        value={hasta}
                        onChange={(e) => cambiar('hasta', e.target.value)}
                        min={pisoHasta}
                        max={max}
                        atajos={[]}
                        mostrarTexto={false}
                        required={required}
                        disabled={disabled}
                        invalid={marcaInvalida('hasta')}
                    />
                </div>
            </div>
            {visibles.length > 0 && (
                <div role="group" aria-label="Atajos de rango" className="flex flex-wrap gap-2">
                    {visibles.map((a) => {
                        const activo = a.rango.desde === desde && a.rango.hasta === hasta;
                        return (
                            <button
                                key={a.label}
                                type="button"
                                aria-pressed={activo}
                                disabled={disabled}
                                onClick={() => onChange?.({ desde: a.rango.desde, hasta: a.rango.hasta })}
                                className={clsx(
                                    'inline-flex min-h-9 items-center rounded-full px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50',
                                    activo ? 'bg-foreground text-background' : 'bg-muted text-foreground hover:bg-accent',
                                )}
                            >
                                {a.label}
                            </button>
                        );
                    })}
                </div>
            )}
            {mensaje ? (
                <p id={idError} role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
                    <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
                    {mensaje}
                </p>
            ) : (
                <p aria-live="polite" className="min-h-4 text-xs text-muted-foreground">
                    {textoResumen}
                </p>
            )}
        </fieldset>
    );
}
