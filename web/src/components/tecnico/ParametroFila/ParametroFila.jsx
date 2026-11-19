'use client';

import { CircleAlert, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Input from '@/components/ui/Input';
import {
    AVISOS_CRITICOS,
    aNumero,
    esCritico,
    llevaDeslizador,
    mismoValor,
    nombreParametro,
    pasoDeslizador,
    textoDeDeslizador,
    textoModificacion,
    textoRango,
    unidadLegible,
    validarCoherencia,
    validarValor,
    valorDeFabrica,
    valorParaEnviar,
} from './parametros.utils.js';

// Una fila editable: nombre legible (con la clave técnica en mono), unidad, rango válido y valor de fábrica a la vista; valida en línea
// (tipo, rango y coherencia con otros parámetros), confirma y delega el guardado en onGuardar(clave, valor).
//   todos     los parámetros (para las reglas entre ellos: el límite de «presente» debe ser menor que la tolerancia).
//   onSucio   (clave, sucio) => void: avisa si la fila tiene cambios sin guardar (el editor los cuenta y protege la salida).
export default function ParametroFila({ parametro, todos = [], soloLectura = false, onGuardar, onSucio }) {
    const [texto, setTexto] = useState(parametro.valor ?? '');
    const [confirmando, setConfirmando] = useState(false);
    const [errorServidor, setErrorServidor] = useState(null);
    const [avisos, setAvisos] = useState([]);
    const campo = useRef(null);
    const [pedidosDeFoco, setPedidosDeFoco] = useState(0);

    const nombre = nombreParametro(parametro.clave);
    const unidad = unidadLegible(parametro.unidad);
    const defecto = valorDeFabrica(parametro);
    const errorLocal = validarValor(parametro, texto) ?? validarCoherencia(parametro, texto, todos);
    const cambio = !mismoValor(parametro, texto);
    const id = `param-${parametro.clave}`;
    // El error local solo se muestra tras cambiar el valor: una fila intacta nunca nace con un aviso.
    const error = errorServidor || (cambio ? errorLocal : null);
    const critico = esCritico(parametro.clave);
    const nuevo = valorParaEnviar(texto);
    const conUnidad = (v) => (unidad ? `${v} ${unidad}` : v);

    useEffect(() => {
        onSucio?.(parametro.clave, cambio);
        return () => onSucio?.(parametro.clave, false);
    }, [onSucio, parametro.clave, cambio]);

    // El diálogo devuelve el foco al botón que lo abrió al cerrarse; este efecto corre después de esa limpieza y lleva el foco al campo con error.
    useEffect(() => {
        if (pedidosDeFoco > 0) campo.current?.focus();
    }, [pedidosDeFoco]);

    const confirmar = async () => {
        try {
            const r = await onGuardar(parametro.clave, nuevo);
            setAvisos(r?.advertencias ?? []);
            setErrorServidor(null);
            setConfirmando(false);
        } catch (e) {
            setErrorServidor(e.message);
            setConfirmando(false);
            setPedidosDeFoco((n) => n + 1);
        }
    };

    const cambiarTexto = (nuevoTexto) => {
        setTexto(nuevoTexto);
        setErrorServidor(null);
    };

    const describedby = [parametro.descripcion ? `${id}-desc` : null, `${id}-ayuda`, error ? `${id}-error` : null].filter(Boolean).join(' ');

    return (
        <li className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
                <label htmlFor={id} className="text-sm font-semibold">
                    {nombre}
                </label>
                {critico && <Badge tone="warning">Crítico</Badge>}
                {cambio && !soloLectura && (
                    <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium">
                        <span aria-hidden="true" className="size-2 rounded-full bg-retardo" />
                        Sin guardar
                    </span>
                )}
            </div>
            <p className="mt-0.5 break-all font-mono text-xs text-muted-foreground">{parametro.clave}</p>
            {parametro.descripcion && (
                <p id={`${id}-desc`} className="mt-1 text-[13px] text-muted-foreground">
                    {parametro.descripcion}
                </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                    <div className="w-32">
                        <Input
                            ref={campo}
                            id={id}
                            inputMode="decimal"
                            autoComplete="off"
                            value={texto}
                            disabled={soloLectura}
                            invalid={Boolean(error)}
                            aria-describedby={describedby}
                            onChange={(e) => cambiarTexto(e.target.value)}
                        />
                    </div>
                    {unidad && <span className="text-sm text-muted-foreground">{unidad}</span>}
                </div>
                {!soloLectura && (
                    <div className="ml-auto flex items-center gap-2">
                        {cambio && (
                            <Button variant="ghost" onClick={() => cambiarTexto(String(parametro.valor ?? ''))}>
                                Descartar
                            </Button>
                        )}
                        <Button disabled={!cambio || Boolean(errorLocal)} onClick={() => setConfirmando(true)}>
                            Guardar
                        </Button>
                    </div>
                )}
            </div>
            {!soloLectura && llevaDeslizador(parametro) && (
                <div className="mt-3">
                    <input
                        type="range"
                        aria-label={`Deslizador de ${nombre.toLowerCase()}`}
                        min={parametro.minimo}
                        max={parametro.maximo}
                        step={pasoDeslizador(parametro)}
                        value={aNumero(texto) ?? Number(parametro.valor)}
                        onChange={(e) => cambiarTexto(textoDeDeslizador(e.target.value))}
                        className="h-6 w-full cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                    />
                    <div aria-hidden="true" className="flex justify-between font-mono text-[11px] text-muted-foreground">
                        <span>{parametro.minimo}</span>
                        <span>{parametro.maximo}</span>
                    </div>
                </div>
            )}
            {error && (
                <p id={`${id}-error`} role="alert" className="mt-2 flex items-start gap-1.5 text-sm text-destructive">
                    <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
                    {error}
                </p>
            )}
            <p id={`${id}-ayuda`} className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span>Rango válido: {textoRango(parametro)}</span>
                {defecto != null && (
                    <span>
                        De fábrica: <span className="font-mono">{defecto}</span>
                        {unidad ? ` ${unidad}` : ''}
                    </span>
                )}
                {!soloLectura && defecto != null && !mismoValor(parametro, texto, defecto) && (
                    <button
                        type="button"
                        onClick={() => cambiarTexto(defecto)}
                        className="-my-1 inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 font-medium text-link underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                    >
                        <RotateCcw aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
                        Usar valor de fábrica
                    </button>
                )}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{textoModificacion(parametro)}</p>
            {avisos.length > 0 && (
                <Alert tone="warning" className="mt-2" onClose={() => setAvisos([])}>
                    <ul className="list-disc pl-5">{avisos.map((a) => <li key={a}>{a}</li>)}</ul>
                </Alert>
            )}
            <ConfirmDialog
                open={confirmando}
                title={`Cambiar «${nombre}»`}
                message={`Se cambiará el valor de ${conUnidad(String(parametro.valor ?? ''))} a ${conUnidad(nuevo)}.`}
                confirmLabel="Guardar cambio"
                variant={critico ? 'danger' : 'primary'}
                onConfirm={confirmar}
                onCancel={() => setConfirmando(false)}
            >
                {critico && (
                    <Alert tone="warning" className="mt-3">{AVISOS_CRITICOS[parametro.clave]}</Alert>
                )}
                <p className="mt-3 text-xs text-muted-foreground">El cambio queda en bitácora con el valor anterior.</p>
            </ConfirmDialog>
        </li>
    );
}
