'use client';

import { useId, useRef, useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import Textarea from '@/components/ui/Textarea';
import { LIMITE_MOTIVO } from '../laboratoriosAdmin.utils.js';
import { normalizarMotivo, validarMotivo } from './dialogoMotivo.utils.js';

// Diálogo con un campo de texto para resolver una solicitud: comentario opcional al aprobar y motivo obligatorio (3 a 300 caracteres)
// al rechazar o cancelar. Quien lo usa lo monta solo mientras está abierto (así cada vez empieza con el campo vacío).
//
//   titulo / mensaje       encabezado y una línea que dice qué se va a hacer y sobre qué solicitud.
//   etiqueta / ayuda       rótulo y ayuda del campo.
//   obligatorio            true: el motivo es requerido y se valida (el contador avisa al llegar al máximo).
//   etiquetaConfirmar      texto del botón principal; `variante` 'primary' | 'danger'.
//   etiquetaVolver         texto del botón que cierra sin hacer nada (en «Cancelar solicitud» no puede llamarse «Cancelar»).
//   onConfirm(texto)       Promise. Si resuelve, quien lo usa cierra el diálogo; si lanza, el mensaje del error se muestra aquí
//                          mismo y el diálogo sigue abierto con lo escrito.
//   onClose                cierra sin confirmar.
export default function DialogoMotivo({
    titulo,
    mensaje,
    etiqueta = 'Comentario',
    ayuda,
    obligatorio = false,
    etiquetaConfirmar = 'Confirmar',
    etiquetaVolver = 'Cancelar',
    variante = 'primary',
    onConfirm,
    onClose,
}) {
    const formId = useId();
    const areaRef = useRef(null);
    const [texto, setTexto] = useState('');
    const [salio, setSalio] = useState(false);
    const [intentado, setIntentado] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [errorServidor, setErrorServidor] = useState(null);

    const falla = validarMotivo(texto, { obligatorio });
    // El error aparece al enviar o al salir del campo habiendo escrito algo: pasar de largo por un campo vacío no lo pinta de rojo.
    const error = intentado || (salio && texto !== '') ? falla : null;

    const enviar = async (evento) => {
        evento.preventDefault();
        if (enviando) return;
        setIntentado(true);
        if (falla) {
            areaRef.current?.focus();
            return;
        }
        setEnviando(true);
        setErrorServidor(null);
        try {
            await onConfirm?.(normalizarMotivo(texto));
        } catch (e) {
            setErrorServidor(e?.message || 'No se pudo completar la acción.');
        } finally {
            setEnviando(false);
        }
    };

    return (
        <Modal
            open
            onClose={onClose}
            closeDisabled={enviando}
            title={titulo}
            showClose
            closeOnOverlay={false}
            initialFocusRef={areaRef}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={enviando}>
                        {etiquetaVolver}
                    </Button>
                    <Button type="submit" form={formId} variant={variante} loading={enviando}>
                        {etiquetaConfirmar}
                    </Button>
                </>
            }
        >
            <form id={formId} onSubmit={enviar} noValidate className="flex flex-col gap-3">
                {mensaje && <p className="text-sm text-muted-foreground">{mensaje}</p>}
                <Field
                    label={etiqueta}
                    required={obligatorio}
                    optional={!obligatorio}
                    hint={ayuda}
                    error={error}
                    counter={{ actual: texto.length, max: LIMITE_MOTIVO.max, desde: 0 }}
                >
                    <Textarea
                        ref={areaRef}
                        rows={4}
                        value={texto}
                        maxLength={LIMITE_MOTIVO.max}
                        readOnly={enviando}
                        invalid={Boolean(error)}
                        onChange={(e) => {
                            setTexto(e.target.value);
                            setErrorServidor(null);
                        }}
                        onBlur={() => setSalio(true)}
                    />
                </Field>
                {errorServidor && (
                    <Alert tone="danger" compact>
                        {errorServidor}
                    </Alert>
                )}
            </form>
        </Modal>
    );
}
