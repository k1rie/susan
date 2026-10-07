'use client';

import clsx from 'clsx';
import { ArrowBigUpDash, Check, Circle, Copy, Eye, EyeOff, WandSparkles } from 'lucide-react';
import { useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { emitirCambio } from '@/lib/formularios/dom.js';
import Button from '../Button/Button.jsx';
import Input from '../Input/Input.jsx';
import { evaluarReglas, generarContrasena, REGLAS_PREDETERMINADAS } from './campoPassword.utils.js';

const MS_AVISO_COPIA = 2000;

// Campo de contraseña con guía: mostrar/ocultar dentro del campo, requisitos EN VIVO con icono + texto (nunca solo color),
// «N de 3 requisitos», aviso de Bloq Mayús y, si se piden, «Generar» y «Copiar». Sin campo de confirmación: con «Mostrar» y
// la lista de requisitos sobra el doble tecleo. Reemplazo directo de auth/PasswordInput (misma firma de onChange).
//
//   value / onChange(e)  -> como un Input: e.target.value. «Generar» dispara ese mismo evento.
//   reglas               -> [{ id, texto, test: (valor) => boolean }]; por omisión las 3 de la política real. false o []: sin lista.
//   generar / copiar     -> muestran los botones «Generar» y «Copiar» (para contraseñas temporales que ve el administrador).
//   longitudGenerada     -> 16 (mínimo 12). Sin caracteres ambiguos (0/O, 1/l/I). Se muestra en claro al generarla.
//   onGenerar(valor)     -> aviso opcional.   avisoMayusculas -> «Bloq Mayús está activado» (por omisión sí).
//   autoComplete         -> 'new-password' por omisión (para entrar usa 'current-password' y reglas={false}).
//   ref                  -> apunta al <input> (se combina con el interno que usa «Generar»; no lo pisa).
//   mensajes             -> lo pone `Field` (ayuda, error, «Válido»): se pinta justo DEBAJO de la caja y antes del aviso, los botones y la
//                           lista de requisitos, así el error queda pegado al campo y no al final de toda la pieza (ver `recibeMensajes`).
export default function CampoPassword({
    value = '',
    onChange,
    reglas = REGLAS_PREDETERMINADAS,
    generar = false,
    copiar = false,
    longitudGenerada = 16,
    onGenerar,
    avisoMayusculas = true,
    autoComplete = 'new-password',
    onKeyDown,
    onKeyUp,
    onBlur,
    className,
    mensajes,
    ref,
    'aria-describedby': describedbyExterno,
    ...rest
}) {
    const inputRef = useRef(null);
    // `ref` del consumidor y ref interno a la vez: como prop entraba por `...rest` y pisaba el interno (rompía «Generar»).
    useImperativeHandle(ref, () => inputRef.current, []);
    const temporizador = useRef(null);
    const reglasId = useId();
    const [visible, setVisible] = useState(false);
    const [bloqMayus, setBloqMayus] = useState(false);
    const [copia, setCopia] = useState(null); // null | 'ok' | 'error'

    useEffect(() => () => clearTimeout(temporizador.current), []);

    const lista = reglas ? evaluarReglas(reglas, value) : [];
    const cumplidas = lista.filter((r) => r.cumple).length;
    const describedby = [describedbyExterno, lista.length ? reglasId : null].filter(Boolean).join(' ') || undefined;
    const Icono = visible ? EyeOff : Eye;

    const vigilarMayusculas = (e) => {
        if (avisoMayusculas) setBloqMayus(Boolean(e.getModifierState?.('CapsLock')));
    };

    const generarNueva = () => {
        const nueva = generarContrasena(longitudGenerada);
        emitirCambio(inputRef.current, nueva);
        // Quien la genera necesita VERLA para dictarla o copiarla.
        setVisible(true);
        onGenerar?.(nueva);
    };

    const copiarValor = async () => {
        let resultado = 'ok';
        try {
            await navigator.clipboard.writeText(value);
        } catch {
            resultado = 'error';
        }
        setCopia(resultado);
        clearTimeout(temporizador.current);
        temporizador.current = setTimeout(() => setCopia(null), MS_AVISO_COPIA);
    };

    return (
        <div className={clsx('flex flex-col gap-2', className)}>
            <Input
                ref={inputRef}
                type={visible ? 'text' : 'password'}
                value={value}
                onChange={onChange}
                autoComplete={autoComplete}
                aria-describedby={describedby}
                onKeyDown={(e) => {
                    vigilarMayusculas(e);
                    onKeyDown?.(e);
                }}
                onKeyUp={(e) => {
                    vigilarMayusculas(e);
                    onKeyUp?.(e);
                }}
                onBlur={(e) => {
                    setBloqMayus(false);
                    onBlur?.(e);
                }}
                endAdornment={
                    <button
                        type="button"
                        onClick={() => setVisible((v) => !v)}
                        aria-pressed={visible}
                        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        disabled={rest.disabled}
                        className="-mr-2 inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 disabled:opacity-50"
                    >
                        <Icono aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
                    </button>
                }
                {...rest}
            />
            {mensajes}
            {bloqMayus && (
                <p role="status" className="flex items-center gap-1.5 text-xs text-retardo">
                    <ArrowBigUpDash aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
                    Bloq Mayús está activado.
                </p>
            )}
            {(generar || copiar) && (
                <div className="flex flex-wrap items-center gap-2">
                    {generar && (
                        <Button variant="secondary" size="sm" disabled={rest.disabled} onClick={generarNueva} icon={<WandSparkles aria-hidden="true" className="size-4" strokeWidth={1.75} />}>
                            Generar
                        </Button>
                    )}
                    {copiar && (
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={rest.disabled || !value}
                            onClick={copiarValor}
                            icon={copia === 'ok' ? <Check aria-hidden="true" className="size-4" strokeWidth={2} /> : <Copy aria-hidden="true" className="size-4" strokeWidth={1.75} />}
                        >
                            {copia === 'ok' ? 'Copiada' : 'Copiar'}
                        </Button>
                    )}
                    <span role="status" className={clsx(copia === 'error' ? 'text-xs text-destructive' : 'sr-only')}>
                        {copia === 'ok' ? 'Contraseña copiada.' : copia === 'error' ? 'No se pudo copiar: selecciónala y cópiala a mano.' : ''}
                    </span>
                </div>
            )}
            {lista.length > 0 && (
                <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">
                        {cumplidas} de {lista.length} requisitos
                    </p>
                    <div aria-hidden="true" className="flex gap-1">
                        {lista.map((r) => (
                            <span key={r.id} className={clsx('h-1 flex-1 rounded-full transition-colors duration-200 motion-reduce:transition-none', r.cumple ? 'bg-presente' : 'bg-muted')} />
                        ))}
                    </div>
                    <ul id={reglasId} aria-label="Requisitos de la contraseña" className="flex flex-col gap-1.5 text-sm">
                        {lista.map((r) => (
                            <li key={r.id} className={clsx('flex items-center gap-2 transition-colors duration-200 motion-reduce:transition-none', r.cumple ? 'text-presente' : 'text-muted-foreground')}>
                                {r.cumple ? <Check aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.25} /> : <Circle aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.5} />}
                                <span>{r.texto}</span>
                                <span className="sr-only">{r.cumple ? ' (cumple)' : ' (falta)'}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

// Le dice a `Field` que este campo pinta él mismo los mensajes (ayuda, error, válido): `Field` se los pasa en `mensajes` en lugar de
// ponerlos después de toda la pieza (por debajo de la lista de requisitos).
CampoPassword.recibeMensajes = true;
