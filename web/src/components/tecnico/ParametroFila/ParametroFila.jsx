'use client';

import { useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Input from '@/components/ui/Input';
import { AVISOS_CRITICOS, esCritico, textoRango, validarValor } from './parametros.utils.js';

const fecha = (iso) => (iso ? new Date(iso).toLocaleString('es-MX') : null);

// Una fila editable: valida el rango en cliente, confirma y delega el guardado en onGuardar(clave, valor).
export default function ParametroFila({ parametro, soloLectura = false, onGuardar }) {
    const [texto, setTexto] = useState(parametro.valor ?? '');
    const [confirmando, setConfirmando] = useState(false);
    const [errorServidor, setErrorServidor] = useState(null);
    const [avisos, setAvisos] = useState([]);

    const errorLocal = validarValor(parametro, texto);
    const cambio = texto.trim() !== String(parametro.valor ?? '');
    const id = `param-${parametro.clave}`;
    const error = errorServidor || (cambio ? errorLocal : null);
    const critico = esCritico(parametro.clave);

    const confirmar = async () => {
        try {
            const r = await onGuardar(parametro.clave, texto.trim());
            setAvisos(r?.advertencias ?? []);
            setErrorServidor(null);
            setConfirmando(false);
        } catch (e) {
            setErrorServidor(e.message);
            setConfirmando(false);
        }
    };

    return (
        <li className="rounded-3xl border border-border bg-card shadow-soft p-5">
            <label htmlFor={id} className="block text-sm font-semibold">{parametro.clave}</label>
            {parametro.descripcion && <p className="text-sm text-muted-foreground">{parametro.descripcion}</p>}
            <p id={`${id}-ayuda`} className="mt-1 text-xs text-muted-foreground">
                Tipo: {parametro.tipo} · Rango: {textoRango(parametro)}
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
                <div className="flex-1">
                    <Input
                        id={id}
                        inputMode="decimal"
                        value={texto}
                        disabled={soloLectura}
                        invalid={Boolean(error)}
                        aria-describedby={`${id}-ayuda${error ? ` ${id}-error` : ''}`}
                        onChange={(e) => { setTexto(e.target.value); setErrorServidor(null); }}
                    />
                    {error && <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-ausente">{error}</p>}
                </div>
                {!soloLectura && (
                    <Button disabled={!cambio || Boolean(errorLocal)} onClick={() => setConfirmando(true)}>Guardar</Button>
                )}
            </div>
            {parametro.fecha_actualizacion && (
                <p className="mt-2 text-xs text-muted-foreground">
                    Última modificación: {fecha(parametro.fecha_actualizacion)}
                    {parametro.actualizado_por?.correo ? `, por ${parametro.actualizado_por.correo}` : ''}
                </p>
            )}
            {avisos.length > 0 && (
                <Alert tone="warning" className="mt-2" onClose={() => setAvisos([])}>
                    <ul className="list-disc pl-5">{avisos.map((a) => <li key={a}>{a}</li>)}</ul>
                </Alert>
            )}
            <ConfirmDialog
                open={confirmando}
                title={`Cambiar ${parametro.clave}`}
                message={`Se cambiará el valor de ${parametro.valor} a ${texto.trim()}.`}
                confirmLabel="Guardar cambio"
                variant={critico ? 'danger' : 'primary'}
                onConfirm={confirmar}
                onCancel={() => setConfirmando(false)}
            >
                {critico && (
                    <Alert tone="warning" className="mt-3">{AVISOS_CRITICOS[parametro.clave]}</Alert>
                )}
                <p className="mt-3 text-xs text-muted-foreground">Cada cambio queda en bitácora con el valor anterior.</p>
            </ConfirmDialog>
        </li>
    );
}
