'use client';

import clsx from 'clsx';
import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Button from '../Button/Button.jsx';
import Field from '../Field/Field.jsx';
import Input from '../Input/Input.jsx';
import Pills from '../Pills/Pills.jsx';
import Select from '../Select/Select.jsx';
import { chipsActivos, esVacio, valorSinElegir, valorVacio } from './barraFiltros.utils.js';

// Barra de búsqueda y filtros de los listados (sustituye la copia de ListadoAlumnos, GruposTabla y CatalogoTabla). Referencias: los
// chips de filtros activos de Shopify y fal y el «Limpiar» de las tablas de DoorDash. Sin botón «Buscar»: se busca mientras se escribe.
//
//   q, onQ          texto de búsqueda APLICADO (controlado por la pantalla) y su cambio. `onQ` se llama 300 ms después de la última tecla,
//                   con Enter al instante, y al instante también si el texto queda vacío (borrar no debe esperar).
//   placeholder     qué se busca («Matrícula o nombre»); también es el nombre accesible del campo.
//   filtros         [{ name, label, options: [{ value, label }], value, onChange(value), tipo?: 'select' | 'pills', multiple?, todosLabel? }]
//                   `select` (por omisión) agrega «Todos» con valor ''. `multiple` (solo pills) usa arreglos.
//   resultado       texto de cuántos resultados hay («12 alumnos»); es una región aria-live.
//   onLimpiar       limpia texto y filtros; sin él se limpian por `onQ('')` y el `onChange` de cada filtro activo.
export default function BarraFiltros({
    q = '',
    onQ,
    placeholder = 'Buscar',
    label = 'Buscar y filtrar',
    debounceMs = 300,
    filtros = [],
    resultado,
    onLimpiar,
    limpiarLabel = 'Limpiar',
    className,
}) {
    const inputRef = useRef(null);
    const [texto, setTexto] = useState(q);
    const [qVisto, setQVisto] = useState(q);
    const [emitido, setEmitido] = useState(q);
    const emitidoRef = useRef(q);
    const temporizador = useRef(null);
    const onQRef = useRef(onQ);

    // Los refs se ponen al día después de pintar (nunca durante el render): el temporizador siempre lee lo último.
    useEffect(() => {
        onQRef.current = onQ;
        emitidoRef.current = emitido;
    });
    useEffect(() => () => clearTimeout(temporizador.current), []);

    // Si la pantalla cambia `q` por su cuenta (Limpiar, la URL, otro filtro) el campo lo refleja. Un `q` que es eco de lo que esta barra
    // acaba de emitir NO se copia al campo: si la persona ya siguió escribiendo, se perderían sus teclas (típico con estado en la URL).
    if (q !== qVisto) {
        setQVisto(q);
        if (q !== emitido) {
            setEmitido(q);
            setTexto(q);
        }
    }

    const emitir = (valor) => {
        clearTimeout(temporizador.current);
        if (valor === emitidoRef.current) return;
        emitidoRef.current = valor;
        setEmitido(valor);
        onQRef.current?.(valor);
    };

    const alEscribir = (e) => {
        const valor = e.target.value;
        setTexto(valor);
        clearTimeout(temporizador.current);
        if (valor.trim() === '') {
            emitir('');
            return;
        }
        temporizador.current = setTimeout(() => emitir(valor.trim()), debounceMs);
    };

    const borrarTexto = () => {
        setTexto('');
        emitir('');
        inputRef.current?.focus();
    };

    const limpiarTodo = () => {
        clearTimeout(temporizador.current);
        setTexto('');
        if (onLimpiar) {
            emitidoRef.current = '';
            setEmitido('');
            onLimpiar();
        } else {
            emitir('');
            for (const f of filtros) if (!esVacio(f.value)) f.onChange?.(valorVacio(f));
        }
    };

    const chips = chipsActivos(filtros);
    const hayAlgo = chips.length > 0 || texto.trim() !== '' || Boolean(q);
    const filtrosSelect = filtros.filter((f) => (f.tipo ?? 'select') === 'select');
    const filtrosPills = filtros.filter((f) => f.tipo === 'pills');

    return (
        <div role="search" aria-label={label} className={clsx('flex flex-col gap-3', className)}>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    emitir(texto.trim());
                }}
                className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
                <div className="relative sm:flex-1">
                    <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
                    <Input
                        ref={inputRef}
                        type="search"
                        value={texto}
                        onChange={alEscribir}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape' && texto !== '') {
                                e.stopPropagation();
                                borrarTexto();
                            }
                        }}
                        placeholder={placeholder}
                        aria-label={placeholder}
                        enterKeyHint="search"
                        autoComplete="off"
                        className="pr-10 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
                    />
                    {texto !== '' && (
                        <button
                            type="button"
                            onClick={borrarTexto}
                            aria-label="Borrar búsqueda"
                            className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/30 focus-visible:outline-none"
                        >
                            <X aria-hidden="true" className="size-4" strokeWidth={1.75} />
                        </button>
                    )}
                </div>
                {filtrosSelect.map((f) => (
                    <Field key={f.name} label={f.label} className="sm:w-48">
                        <Select
                            name={f.name}
                            value={f.value ?? ''}
                            onChange={(e) => f.onChange?.(e.target.value)}
                            options={[{ value: '', label: f.todosLabel ?? 'Todos' }, ...(f.options ?? [])]}
                        />
                    </Field>
                ))}
            </form>

            {filtrosPills.map((f) => (
                <Pills
                    key={f.name}
                    label={f.label}
                    multiple={f.multiple}
                    value={f.multiple ? (f.value ?? []) : (f.value ?? '')}
                    onChange={(v) => f.onChange?.(v)}
                    items={[...(f.multiple ? [] : [{ id: '', label: f.todosLabel ?? 'Todos' }]), ...(f.options ?? []).map((o) => ({ id: o.value, label: o.label, count: o.count }))]}
                />
            ))}

            {(chips.length > 0 || hayAlgo || resultado !== undefined) && (
                <div className="flex flex-wrap items-center gap-2">
                    {chips.length > 0 && (
                        <ul aria-label="Filtros activos" className="flex flex-wrap items-center gap-2">
                            {chips.map((c) => (
                                <li key={c.clave} className="inline-flex min-h-8 items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-3 text-[13px]">
                                    <span className="text-muted-foreground">{c.filtro.label}:</span>
                                    <span className="font-medium">{c.texto}</span>
                                    <button
                                        type="button"
                                        onClick={() => c.filtro.onChange?.(c.filtro.multiple || Array.isArray(c.filtro.value) ? valorSinElegir(c.filtro, c.valor) : '')}
                                        aria-label={`Quitar filtro ${c.filtro.label}: ${c.texto}`}
                                        className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/30 focus-visible:outline-none"
                                    >
                                        <X aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    {hayAlgo && (
                        <Button variant="ghost" size="sm" onClick={limpiarTodo}>
                            {limpiarLabel}
                        </Button>
                    )}
                    {resultado !== undefined && (
                        <p role="status" aria-live="polite" className="ml-auto text-[13px] text-muted-foreground">
                            {resultado}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
