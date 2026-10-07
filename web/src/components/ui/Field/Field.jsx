import clsx from 'clsx';
import { Check, CircleAlert } from 'lucide-react';
import { cloneElement, useId } from 'react';

const YA_TRAE_PREFIJO = /^ej(emplo)?\.?\s/i;

// Envuelve un único control: genera el id, enlaza hint/error con aria-describedby y marca aria-invalid.
//
// Ampliaciones (todas opcionales; sin ellas el DOM es el de siempre salvo el icono del error):
//   optional      -> añade «(opcional)» a la etiqueta (convención del producto: no se marcan asteriscos en lo opcional).
//   valid         -> true o texto: palomita (Lucide) + «Válido». Solo para datos que la persona no puede comprobar a ojo
//                    (matrícula, correo, periodo). Si hay error, no se muestra.
//   example       -> «Ej. X» al final de la ayuda ('E260099' o 'Ej. E260099').
//   counter       -> { actual, max, desde? } contador «n/max»; con desde (0-1) aparece al llegar a esa fracción del máximo.
//   labelAction   -> nodo a la derecha de la etiqueta (p. ej. «¿Olvidaste tu contraseña?»).
//   reserveError  -> reserva el alto de una línea para error/válido, así el formulario no salta al validar.
//   as="fieldset" -> para grupos (radios, segmentados, tarjetas): <fieldset> con <legend>; no clona el hijo.
// Un hijo compuesto (p. ej. CampoPassword, que lleva debajo de la caja una lista de requisitos) puede declarar `Componente.recibeMensajes = true`:
// entonces Field NO pinta la ayuda/el error/«Válido» después de él, se los pasa en la prop `mensajes` y el hijo los coloca justo bajo su caja.
export default function Field({
    label,
    hint,
    error,
    required = false,
    optional = false,
    valid = false,
    example,
    counter,
    labelAction,
    reserveError = false,
    as = 'div',
    htmlFor,
    children,
    className,
}) {
    const generado = useId();
    const esGrupo = as === 'fieldset';
    const delegaMensajes = !esGrupo && children?.type?.recibeMensajes === true;
    const propsHijo = !esGrupo ? children?.props ?? {} : {};
    const id = htmlFor || propsHijo.id || generado;
    const hintId = hint || example ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const validoTexto = valid && !error ? (valid === true ? 'Válido' : String(valid)) : null;
    const validId = validoTexto ? `${id}-valid` : undefined;
    const describedby = [propsHijo['aria-describedby'], hintId, errorId, validId].filter(Boolean).join(' ') || undefined;

    const etiqueta = (
        <>
            {label}
            {required && <span aria-hidden="true" className="text-destructive"> *</span>}
            {optional && !required && <span className="font-normal text-muted-foreground"> (opcional)</span>}
        </>
    );

    const ayuda = (hint || example) && (
        <p id={hintId} className="text-xs text-muted-foreground">
            {hint}
            {hint && example ? ' ' : ''}
            {example && (YA_TRAE_PREFIJO.test(example) ? example : `Ej. ${example}`)}
        </p>
    );

    const estado = error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            {error}
        </p>
    ) : validoTexto ? (
        <p id={validId} role="status" className="flex items-center gap-1.5 text-sm text-presente">
            <Check aria-hidden="true" className="size-4 shrink-0" strokeWidth={2} />
            {validoTexto}
        </p>
    ) : null;
    const ranura = reserveError ? <div className="min-h-5">{estado}</div> : estado;

    const excede = counter && counter.max != null && counter.actual > counter.max;
    const alLimite = counter && counter.max != null && counter.actual >= counter.max;
    const contadorVisible = counter && counter.max != null && counter.actual >= counter.max * (counter.desde ?? 0);
    const contador = contadorVisible && (
        <>
            <span className={clsx('shrink-0 pt-0.5 text-xs tabular-nums', excede ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                {counter.actual}/{counter.max}
            </span>
            {/* Solo se anuncia el límite, no cada tecla: el atributo maxlength ya lo dice al enfocar. */}
            <span role="status" className="sr-only">
                {alLimite ? `Límite de ${counter.max} caracteres alcanzado.` : ''}
            </span>
        </>
    );
    const mensajes = contador ? (
        <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                {ayuda}
                {ranura}
            </div>
            {contador}
        </div>
    ) : (
        <>
            {ayuda}
            {ranura}
        </>
    );

    if (esGrupo) {
        return (
            <fieldset aria-describedby={describedby} className={clsx('m-0 flex min-w-0 flex-col gap-1 border-0 p-0', className)}>
                <legend className="mb-1 w-full p-0 text-sm font-medium">
                    {labelAction ? (
                        <span className="flex items-end justify-between gap-2">
                            <span className="min-w-0">{etiqueta}</span>
                            <span className="shrink-0 text-xs font-normal">{labelAction}</span>
                        </span>
                    ) : (
                        etiqueta
                    )}
                </legend>
                {children}
                {mensajes}
            </fieldset>
        );
    }

    const rotulo = (
        <label htmlFor={id} className="text-sm font-medium">
            {etiqueta}
        </label>
    );

    return (
        <div className={clsx('flex flex-col gap-1', className)}>
            {labelAction ? (
                <div className="flex items-end justify-between gap-2">
                    {rotulo}
                    <span className="shrink-0 text-xs">{labelAction}</span>
                </div>
            ) : (
                rotulo
            )}
            {cloneElement(children, {
                id,
                'aria-describedby': describedby,
                'aria-invalid': error ? true : undefined,
                required: required || propsHijo.required,
                ...(delegaMensajes ? { mensajes } : null),
            })}
            {!delegaMensajes && mensajes}
        </div>
    );
}
