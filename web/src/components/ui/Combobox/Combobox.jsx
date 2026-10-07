'use client';

import clsx from 'clsx';
import { Check, ChevronDown, LoaderCircle, X } from 'lucide-react';
import { useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Avatar from '../Avatar/Avatar.jsx';
import { CONTROL_BASE, CONTROL_INVALIDO } from '../Input/Input.jsx';
import { agruparOpciones, calcularPosicionLista, filtrarOpciones, mismoValor, primeraHabilitada, siguienteHabilitada } from './combobox.utils.js';
import { useOpcionesRemotas } from './useOpcionesRemotas.js';

function ContenidoOpcion({ opcion }) {
    return (
        <>
            {opcion.avatar && <Avatar nombre={opcion.avatar} size="sm" />}
            <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{opcion.label}</span>
                {opcion.description && <span className="block truncate text-xs text-muted-foreground">{opcion.description}</span>}
            </span>
        </>
    );
}

const igualesPosiciones = (a, b) => a && b && Object.keys(a).every((k) => a[k] === b[k]);

// Selector con búsqueda (sin acentos ni mayúsculas) para listas largas o con identidad: alumnos, materias, docentes, aulas.
// Patrón ARIA 1.2 combobox editable con lista (como la paleta ⌘K): el foco se queda en el campo, las flechas mueven la opción
// activa (aria-activedescendant), Enter elige, Esc cierra (sin cerrar el diálogo que lo contiene). Cada opción mide ≥ 44 px.
// La lista se dibuja en un portal con posición fija: no la recorta el scroll de un modal y nunca se sale de la pantalla
// (en el teléfono se ajusta al área visible, incluso con el teclado abierto).
//
//   options       -> [{ value, label, description?, group?, disabled?, avatar? }]  (filtra en memoria)
//   loadOptions   -> (q, { signal }) => Promise<options[]>  (remoto; espera debounceMs 250 y minChars 2, cancela lo anterior)
//   loadKey       -> al cambiar invalida lo cargado (p. ej. el periodo elegido en otro campo)
//   value         -> valor elegido ('' = ninguno). onChange(value, opcion); al limpiar: onChange('', null). Compara por texto: 3 == '3'.
//   selected      -> { value, label } con la etiqueta de lo ya elegido cuando las opciones aún no están cargadas (modo remoto).
//   clearable     -> botón «Quitar selección».   renderOption(opcion, { activa, seleccionada }) -> nodo del contenido de la opción.
//   emptyText / loadingText / errorText / hintText -> mensajes de la lista (hintText: «Escribe al menos N caracteres…»).
//   name          -> agrega un <input type="hidden"> con el valor para formularios nativos y marca el contenedor con `data-campo-nombre`
//                    (así `useFormulario` encuentra el campo de texto para llevarle el foco al primer error).
//   id, aria-*, required, invalid -> para que ui/Field lo etiquete (aplican al campo de texto).
//   onBlur(e)     -> la persona salió del CONJUNTO campo + botones (quitar selección) + lista; mover el foco del campo a «Quitar selección»
//                    no cuenta. Es el `onBlur` que espera `useFormulario().campo(...).props` para validar al salir.
//   ref           -> el <input> de texto (para `.focus()`); se combina con el interno.
//   autoFocus     -> enfoca el campo de texto al montar.
export default function Combobox({
    options,
    loadOptions,
    loadKey,
    debounceMs = 250,
    minChars = 2,
    value,
    defaultValue = '',
    onChange,
    selected,
    placeholder,
    clearable = false,
    disabled = false,
    invalid = false,
    required = false,
    emptyText = 'Sin resultados',
    loadingText = 'Buscando…',
    errorText = 'No se pudieron cargar los resultados.',
    hintText,
    renderOption,
    onBlur,
    ref,
    autoFocus = false,
    id,
    name,
    className,
    'aria-label': ariaLabel,
    'aria-labelledby': labelledby,
    'aria-describedby': describedby,
    'aria-invalid': ariaInvalid,
}) {
    const generado = useId();
    const listaId = `${generado}-lista`;
    const inputRef = useRef(null);
    useImperativeHandle(ref, () => inputRef.current, []);
    const cajaRef = useRef(null);
    const popupRef = useRef(null);
    const [abierto, setAbierto] = useState(false);
    const [consulta, setConsulta] = useState(null); // null = la persona aún no ha escrito: se ve la etiqueta elegida
    const [indiceActivo, setIndiceActivo] = useState(-1);
    const [posicion, setPosicion] = useState(null);
    const [interno, setInterno] = useState(defaultValue);
    const [recordada, setRecordada] = useState(null); // última opción elegida (en modo remoto no está en `options`)

    const modoRemoto = typeof loadOptions === 'function';
    const valor = value !== undefined ? value : interno;
    const hayValor = valor !== '' && valor !== null && valor !== undefined;

    const opcionActual = !hayValor
        ? null
        : ((options ?? []).find((o) => mismoValor(o.value, valor)) ??
          (recordada && mismoValor(recordada.value, valor) ? recordada : null) ??
          (selected && mismoValor(selected.value, valor) ? selected : null));

    const q = consulta ?? '';
    const remoto = useOpcionesRemotas({ loadOptions, consulta: q, activo: abierto && modoRemoto, debounceMs, minChars, loadKey });
    const faltanCaracteres = modoRemoto && q.trim().length < minChars;
    const visibles = modoRemoto ? (faltanCaracteres ? [] : remoto.opciones) : filtrarOpciones(options ?? [], q);
    const { grupos, planas } = agruparOpciones(visibles);
    const activoEfectivo =
        indiceActivo >= 0 && indiceActivo < planas.length && !planas[indiceActivo].disabled ? indiceActivo : primeraHabilitada(planas);
    const idOpcion = (indice) => `${listaId}-op-${indice}`;

    const textoCampo = abierto && consulta !== null ? consulta : (opcionActual?.label ?? '');
    const limpiable = clearable && !disabled && hayValor;
    const invalido = Boolean(invalid || ariaInvalid);

    const medir = useCallback(() => {
        const caja = cajaRef.current;
        if (!caja || typeof window === 'undefined') return;
        const vv = window.visualViewport;
        const arriba = vv?.offsetTop ?? 0;
        const izquierda = vv?.offsetLeft ?? 0;
        const nueva = calcularPosicionLista({
            rect: caja.getBoundingClientRect(),
            limites: {
                arriba,
                abajo: arriba + (vv?.height ?? window.innerHeight),
                izquierda,
                derecha: izquierda + (vv?.width ?? window.innerWidth),
            },
            altoVentana: window.innerHeight,
        });
        setPosicion((previa) => (igualesPosiciones(previa, nueva) ? previa : nueva));
    }, []);

    // Mientras está abierta se re-mide si cambia la ventana, el teclado del teléfono o se desplaza algún contenedor
    // (el scroll de la propia lista se ignora para no re-dibujar en cada gesto).
    useEffect(() => {
        if (!abierto) return undefined;
        const alDesplazar = (e) => {
            if (popupRef.current?.contains(e.target)) return;
            medir();
        };
        const vv = window.visualViewport;
        window.addEventListener('resize', medir);
        window.addEventListener('scroll', alDesplazar, true);
        vv?.addEventListener('resize', medir);
        vv?.addEventListener('scroll', medir);
        return () => {
            window.removeEventListener('resize', medir);
            window.removeEventListener('scroll', alDesplazar, true);
            vv?.removeEventListener('resize', medir);
            vv?.removeEventListener('scroll', medir);
        };
    }, [abierto, medir]);

    useEffect(() => {
        if (!abierto || activoEfectivo < 0) return;
        document.getElementById(`${listaId}-op-${activoEfectivo}`)?.scrollIntoView?.({ block: 'nearest' });
    }, [abierto, activoEfectivo, listaId]);

    const cerrar = () => {
        setAbierto(false);
        setConsulta(null);
        setIndiceActivo(-1);
    };

    const abrir = () => {
        if (disabled || abierto) return;
        medir();
        setAbierto(true);
        setConsulta(null);
        // Al abrir sin escribir se ve todo el catálogo con la opción elegida resaltada.
        const completa = modoRemoto ? [] : agruparOpciones(options ?? []).planas;
        setIndiceActivo(hayValor ? completa.findIndex((o) => mismoValor(o.value, valor)) : -1);
    };

    const elegir = (opcion) => {
        if (!opcion || opcion.disabled) return;
        setRecordada(opcion);
        if (value === undefined) setInterno(opcion.value);
        onChange?.(opcion.value, opcion);
        cerrar();
    };

    const limpiar = () => {
        setRecordada(null);
        if (value === undefined) setInterno('');
        onChange?.('', null);
        cerrar();
        inputRef.current?.focus();
    };

    const mover = (paso) => {
        const desde = activoEfectivo >= 0 ? activoEfectivo : paso > 0 ? -1 : 0;
        const destino = siguienteHabilitada(planas, desde, paso);
        if (destino >= 0) setIndiceActivo(destino);
    };

    const alTeclear = (e) => {
        if (e.nativeEvent?.isComposing) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!abierto) abrir();
            else if (!(e.altKey && e.key === 'ArrowDown')) mover(e.key === 'ArrowDown' ? 1 : -1);
        } else if (e.key === 'Enter') {
            // Con la lista abierta Enter ELIGE (y no envía el formulario); cerrada, se comporta como siempre.
            if (!abierto) return;
            e.preventDefault();
            elegir(planas[activoEfectivo]);
        } else if (e.key === 'Escape' && abierto) {
            // Solo cierra la lista: sin stopPropagation el Esc llegaría al diálogo que contiene el campo y lo cerraría.
            e.preventDefault();
            e.stopPropagation();
            cerrar();
        }
    };

    const alEscribir = (e) => {
        if (!abierto) {
            medir();
            setAbierto(true);
        }
        setConsulta(e.target.value);
        setIndiceActivo(-1);
    };

    const alternar = () => {
        inputRef.current?.focus();
        if (abierto) cerrar();
        else abrir();
    };

    // Estado del pie de la lista: una sola cosa a la vez, en este orden de prioridad.
    const pie = remoto.cargando ? 'cargando' : remoto.error ? 'error' : faltanCaracteres ? 'pista' : planas.length === 0 ? 'vacio' : null;
    const textoPie = {
        cargando: loadingText,
        error: errorText,
        pista: hintText ?? `Escribe al menos ${minChars} caracteres para buscar.`,
        vacio: emptyText,
    }[pie];
    // Lo que se anuncia a los lectores de pantalla (región polite que existe siempre; solo tiene texto con la lista abierta).
    const anuncio = !abierto ? '' : (textoPie ?? `${planas.length} ${planas.length === 1 ? 'opción disponible' : 'opciones disponibles'}.`);

    // `blur` burbuja en React (focusout): cubre el campo y «Quitar selección». Si el foco pasa a otro control del conjunto (o a la lista, que va
    // en un portal pero es hija en el árbol de React) no se avisa; sin `relatedTarget` (clic en un área sin foco, otra ventana) sí.
    const alSalirDelConjunto = (e) => {
        const destino = e.relatedTarget;
        if (destino && (e.currentTarget.contains(destino) || popupRef.current?.contains(destino))) return;
        onBlur?.(e);
    };

    return (
        <div className={clsx('relative', className)} data-campo-nombre={name || undefined} onBlur={alSalirDelConjunto}>
            <div ref={cajaRef} className="relative">
                <input
                    ref={inputRef}
                    id={id}
                    type="text"
                    role="combobox"
                    aria-expanded={abierto}
                    aria-controls={abierto ? listaId : undefined}
                    aria-haspopup="listbox"
                    aria-autocomplete="list"
                    aria-activedescendant={abierto && activoEfectivo >= 0 ? idOpcion(activoEfectivo) : undefined}
                    aria-label={ariaLabel}
                    aria-labelledby={labelledby}
                    aria-describedby={describedby}
                    aria-invalid={invalido ? true : undefined}
                    aria-busy={abierto && remoto.cargando ? true : undefined}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder={placeholder}
                    value={textoCampo}
                    disabled={disabled}
                    required={required}
                    autoFocus={autoFocus}
                    onChange={alEscribir}
                    onKeyDown={alTeclear}
                    onClick={abrir}
                    // Al enfocar se selecciona todo: escribir reemplaza la etiqueta elegida en vez de añadirse a ella.
                    onFocus={(e) => e.target.select()}
                    onBlur={cerrar}
                    className={clsx(CONTROL_BASE, invalido ? CONTROL_INVALIDO : 'border-input', limpiable ? 'pr-[4.75rem]' : 'pr-10')}
                />
                <span className="absolute inset-y-0 right-1 flex items-center gap-0.5 text-muted-foreground">
                    {limpiable && (
                        <button
                            type="button"
                            onClick={limpiar}
                            aria-label="Quitar selección"
                            className="inline-flex size-8 items-center justify-center rounded-full transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                        >
                            <X aria-hidden="true" className="size-4" strokeWidth={1.75} />
                        </button>
                    )}
                    <button
                        type="button"
                        tabIndex={-1}
                        disabled={disabled}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={alternar}
                        aria-label={abierto ? 'Ocultar opciones' : 'Mostrar opciones'}
                        className="inline-flex size-8 items-center justify-center rounded-full transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                    >
                        <ChevronDown
                            aria-hidden="true"
                            className={clsx('size-4 transition-transform duration-150 motion-reduce:transition-none', abierto && 'rotate-180')}
                            strokeWidth={1.75}
                        />
                    </button>
                </span>
            </div>
            {name && <input type="hidden" name={name} value={hayValor ? String(valor) : ''} />}
            <span role="status" className="sr-only">
                {anuncio}
            </span>
            {abierto &&
                posicion &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div
                        ref={popupRef}
                        // Sin esto, pulsar una opción quitaría el foco del campo y el blur cerraría la lista antes del clic.
                        onMouseDown={(e) => e.preventDefault()}
                        style={{
                            position: 'fixed',
                            left: posicion.izquierda,
                            width: posicion.ancho,
                            maxHeight: posicion.maxAlto,
                            ...(posicion.arriba ? { bottom: posicion.bottom } : { top: posicion.top }),
                        }}
                        className="z-[70] flex animate-in flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lift duration-100 fade-in-0"
                    >
                        <div id={listaId} role="listbox" aria-label="Opciones" aria-busy={remoto.cargando || undefined} className={clsx('min-h-0 flex-1 overflow-y-auto overscroll-contain', planas.length > 0 && 'p-1')}
                        >
                            {grupos.map(({ titulo, opciones: lista }) => {
                                const filas = lista.map(({ opcion, indice }) => {
                                    const activa = indice === activoEfectivo;
                                    const seleccionada = hayValor && mismoValor(opcion.value, valor);
                                    return (
                                        <div
                                            key={`${opcion.value}-${indice}`}
                                            id={idOpcion(indice)}
                                            role="option"
                                            aria-selected={seleccionada}
                                            aria-disabled={opcion.disabled || undefined}
                                            onMouseMove={() => {
                                                if (!opcion.disabled && indice !== activoEfectivo) setIndiceActivo(indice);
                                            }}
                                            onClick={() => elegir(opcion)}
                                            className={clsx(
                                                'flex min-h-11 items-center gap-3 rounded-lg px-3 py-1.5 text-sm',
                                                opcion.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                                                activa && 'bg-accent text-accent-foreground',
                                            )}
                                        >
                                            {renderOption ? renderOption(opcion, { activa, seleccionada }) : <ContenidoOpcion opcion={opcion} />}
                                            {seleccionada && <Check aria-hidden="true" className="size-4 shrink-0 text-foreground" strokeWidth={2} />}
                                        </div>
                                    );
                                });
                                if (titulo === null) return filas;
                                return (
                                    <div key={titulo} role="group" aria-label={titulo}>
                                        <p aria-hidden="true" className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            {titulo}
                                        </p>
                                        {filas}
                                    </div>
                                );
                            })}
                        </div>
                        {pie && (
                            <div
                                className={clsx(
                                    'flex items-center justify-center gap-2 px-3 py-3 text-sm',
                                    planas.length > 0 && 'border-t border-border',
                                    pie === 'error' ? 'text-destructive' : 'text-muted-foreground',
                                )}
                            >
                                {pie === 'cargando' && (
                                    <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin motion-reduce:animate-none" strokeWidth={1.75} />
                                )}
                                <span className="text-center">{textoPie}</span>
                                {pie === 'error' && (
                                    <button
                                        type="button"
                                        onClick={remoto.reintentar}
                                        className="rounded-md px-2 py-1 text-sm font-medium text-link underline underline-offset-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                                    >
                                        Reintentar
                                    </button>
                                )}
                            </div>
                        )}
                    </div>,
                    document.body,
                )}
        </div>
    );
}
