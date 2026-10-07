'use client';

import clsx from 'clsx';
import { CircleAlert, Upload } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import Button from '../Button/Button.jsx';
import ArchivoElegido, { Miniatura } from './ArchivoElegido.jsx';
import { claveArchivo, describirReglas, formatearBytes, procesarSeleccion } from './fileInput.utils.js';
import { useZonaArrastre } from './useZonaArrastre.js';

// Selector de archivo con validación inmediata de tipo y tamaño; el control nativo queda oculto.
//
//   variant="boton" (por omisión): botón + nombre + «Quitar».
//   variant="zona": zona para arrastrar y soltar, con clic en cualquier parte y teclado (el <input> nativo, oculto solo a
//                   la vista, recibe el foco; Enter o Espacio abren el selector).
//
//   value / onSelect   -> un archivo (File | null). Con `multiple`: arreglo de File; onSelect recibe la lista completa.
//   maxFiles           -> tope de archivos en modo `multiple`.
//   hint               -> reglas visibles antes de elegir. Si se omite, la zona las deduce de accept/maxBytes/maxFiles
//                         («PDF. Máximo 10 MB.»); `hint={false}` las oculta.
//   progress           -> 0-100 mientras sube (bloquea elegir y soltar); null/undefined = sin subida.
//   preview            -> 'imagen' dibuja miniatura de las imágenes; 'nombre' (por omisión) solo icono y nombre.
//   id, aria-labelledby, aria-describedby, aria-invalid, required -> para que ui/Field lo etiquete y lo valide.
export default function FileInput({
    value = null,
    onSelect,
    accept,
    maxBytes,
    capture,
    label,
    error,
    disabled = false,
    className,
    variant = 'boton',
    multiple = false,
    maxFiles,
    hint,
    progress = null,
    preview = 'nombre',
    id,
    required,
    'aria-labelledby': labelledby,
    'aria-describedby': describedbyExterno,
    'aria-invalid': ariaInvalid,
}) {
    const inputRef = useRef(null);
    const generado = useId();
    const inputId = id || `${generado}-archivo`;
    const errorId = `${generado}-error`;
    const hintId = `${generado}-hint`;
    const progresoId = `${generado}-progreso`;
    const [erroresLocales, setErroresLocales] = useState(null);

    const lista = multiple ? (value ?? []) : value ? [value] : [];
    const subiendo = progress != null;
    const bloqueado = disabled || subiendo;
    const mensajes = [...(error ? [error] : []), ...(erroresLocales ?? [])];
    const reglas = hint === false ? '' : (hint ?? (variant === 'zona' ? describirReglas({ accept, maxBytes, maxFiles: multiple ? maxFiles : undefined }) : ''));
    const lleno = multiple && maxFiles != null && lista.length >= maxFiles;
    const invalido = Boolean(mensajes.length || ariaInvalid);

    const describedby =
        [describedbyExterno, reglas ? hintId : null, mensajes.length ? errorId : null, subiendo ? progresoId : null].filter(Boolean).join(' ') || undefined;

    const aplicar = (candidatos) => {
        if (candidatos.length === 0) return;
        const { aceptados, errores } = procesarSeleccion(candidatos, { accept, maxBytes, multiple, maxFiles, actuales: lista });
        setErroresLocales(errores.length ? errores : null);
        if (multiple) {
            if (aceptados.length) onSelect([...lista, ...aceptados]);
        } else {
            // Un rechazo vacía la selección: así no queda un archivo válido anterior junto a un error.
            onSelect(aceptados[0] ?? null);
        }
    };

    const alElegir = (e) => {
        const archivos = Array.from(e.target.files ?? []);
        // Permite volver a elegir el mismo archivo después de quitarlo o rechazarlo.
        e.target.value = '';
        aplicar(archivos);
    };

    const quitar = (file) => {
        setErroresLocales(null);
        onSelect(multiple ? lista.filter((f) => f !== file) : null);
    };

    const { arrastrando, manejadores } = useZonaArrastre({ alSoltar: aplicar, deshabilitada: bloqueado || lleno });

    const avisoDeError = mensajes.length > 0 && (
        <div id={errorId} role="alert" className="flex flex-col gap-0.5 text-sm text-destructive">
            {mensajes.map((m, i) => (
                <p key={`${i}-${m}`} className="flex items-start gap-1.5">
                    <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
                    {m}
                </p>
            ))}
        </div>
    );

    const barraDeProgreso = subiendo && (
        <div id={progresoId} className="flex flex-col gap-1">
            <div
                role="progressbar"
                aria-label="Progreso de la subida"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(Math.min(100, Math.max(0, progress)))}
                className="h-2 overflow-hidden rounded-full bg-muted"
            >
                <div
                    className="h-full origin-left rounded-full bg-primary transition-transform duration-200 motion-reduce:transition-none"
                    style={{ transform: `scaleX(${Math.min(100, Math.max(0, progress)) / 100})` }}
                />
            </div>
            {/* El texto fijo se anuncia una vez; el porcentaje es solo visual para no saturar al lector de pantalla. */}
            <p role="status" className="text-xs text-muted-foreground">
                Subiendo…{' '}
                <span aria-hidden="true" className="tabular-nums">
                    {Math.round(progress)} %
                </span>
            </p>
        </div>
    );

    if (variant === 'zona') {
        const enlace = label ?? (multiple ? 'selecciona archivos' : 'selecciona un archivo');
        const frase = arrastrando
            ? 'Suelta para agregar'
            : lista.length === 0
              ? 'Arrastra y suelta aquí, o'
              : multiple
                ? 'Arrastra más archivos, o'
                : 'Arrastra otro archivo para reemplazarlo, o';
        return (
            <div className={clsx('flex flex-col gap-2', className)}>
                <div
                    {...manejadores}
                    data-estado={subiendo ? 'cargando' : arrastrando ? 'arrastrando' : invalido ? 'error' : lista.length ? 'listo' : 'vacio'}
                    className={clsx(
                        'relative flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-colors duration-150 motion-reduce:transition-none',
                        'has-[input:focus-visible]:ring-4 has-[input:focus-visible]:ring-ring/30',
                        arrastrando ? 'border-solid border-ring bg-accent' : clsx('border-dashed', invalido ? 'border-destructive bg-card' : 'border-input bg-card hover:bg-accent/40'),
                        bloqueado && 'opacity-60',
                        subiendo && 'cursor-progress',
                    )}
                >
                    {!lleno && (
                        // El ::after de la etiqueta cubre toda la zona: un clic en cualquier parte abre el selector,
                        // y la lista de archivos (z-10) queda por encima para que «Quitar» siga funcionando.
                        <label
                            htmlFor={inputId}
                            className={clsx(
                                'flex flex-col items-center gap-1 text-center text-sm after:absolute after:inset-0 after:content-[""]',
                                bloqueado ? 'cursor-not-allowed' : 'cursor-pointer',
                            )}
                        >
                            <input
                                ref={inputRef}
                                id={inputId}
                                type="file"
                                className="sr-only"
                                accept={accept}
                                capture={capture}
                                multiple={multiple}
                                disabled={bloqueado}
                                onChange={alElegir}
                                aria-labelledby={labelledby}
                                aria-describedby={describedby}
                                aria-invalid={invalido ? true : undefined}
                                aria-required={required ? true : undefined}
                                data-testid="file-input"
                            />
                            <Upload aria-hidden="true" className="size-6 text-muted-foreground" strokeWidth={1.5} />
                            <span>
                                {frase}{' '}
                                {!arrastrando && <span className="font-medium text-link underline underline-offset-2">{enlace}</span>}
                            </span>
                        </label>
                    )}
                    {reglas && (
                        <p id={hintId} className="text-center text-xs text-muted-foreground">
                            {reglas}
                        </p>
                    )}
                    {lleno && (
                        <p className="text-center text-xs text-muted-foreground">Llegaste al máximo de {maxFiles} archivos. Quita uno para agregar otro.</p>
                    )}
                    {lista.length > 0 && (
                        <ul className="relative z-10 flex w-full flex-col gap-2">
                            {lista.map((file) => (
                                <ArchivoElegido
                                    key={claveArchivo(file)}
                                    file={file}
                                    preview={preview}
                                    disabled={disabled || subiendo}
                                    etiquetaQuitar={multiple ? `Quitar ${file.name}` : undefined}
                                    onQuitar={() => quitar(file)}
                                />
                            ))}
                        </ul>
                    )}
                    {barraDeProgreso && <div className="relative z-10 w-full">{barraDeProgreso}</div>}
                </div>
                {avisoDeError}
            </div>
        );
    }

    // Variante «boton»: el <input> nativo sigue oculto del todo; id/aria-* van al botón, que es lo enfocable.
    return (
        <div className={clsx('flex flex-col gap-2', className)}>
            <input
                ref={inputRef}
                type="file"
                hidden
                accept={accept}
                capture={capture}
                multiple={multiple}
                disabled={bloqueado}
                onChange={alElegir}
                data-testid="file-input"
            />
            <div className="flex flex-wrap items-center gap-2">
                <Button
                    id={id}
                    variant="secondary"
                    disabled={bloqueado}
                    onClick={() => inputRef.current?.click()}
                    aria-labelledby={labelledby}
                    aria-describedby={describedby}
                    aria-invalid={invalido ? true : undefined}
                    aria-required={required ? true : undefined}
                >
                    {label ?? (multiple ? 'Seleccionar archivos' : 'Seleccionar archivo')}
                </Button>
                {!multiple && value && (
                    <>
                        {preview === 'imagen' && <Miniatura file={value} imagen />}
                        <span className="min-w-0 truncate text-sm">
                            {value.name} ({formatearBytes(value.size)})
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => quitar(value)} disabled={disabled || subiendo}>
                            Quitar
                        </Button>
                    </>
                )}
            </div>
            {multiple && lista.length > 0 && (
                <ul className="flex flex-col gap-2">
                    {lista.map((file) => (
                        <ArchivoElegido
                            key={claveArchivo(file)}
                            file={file}
                            preview={preview}
                            disabled={disabled || subiendo}
                            etiquetaQuitar={`Quitar ${file.name}`}
                            onQuitar={() => quitar(file)}
                        />
                    ))}
                </ul>
            )}
            {reglas && (
                <p id={hintId} className="text-xs text-muted-foreground">
                    {reglas}
                </p>
            )}
            {barraDeProgreso}
            {avisoDeError}
        </div>
    );
}
