'use client';

import { useId, useState } from 'react';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { aulaGuardar } from '@/lib/api/admin.js';
import { enteroEnRango, mensajeDeError } from '../comun.js';

// Alta/edición de aula (RF-01). El servidor rechaza una capacidad menor que los inscritos de un grupo.
export default function AulaForm({ item, onClose, onGuardado }) {
    const formId = useId();
    const { toast } = useToast();
    const [v, setV] = useState({
        clave: item?.clave ?? '',
        edificio: item?.edificio ?? '',
        capacidad: item?.capacidad != null ? String(item.capacidad) : '',
    });
    const [errores, setErrores] = useState({});
    const [guardando, setGuardando] = useState(false);
    const cambiar = (c) => (e) => setV((p) => ({ ...p, [c]: e.target.value }));

    const enviar = async (ev) => {
        ev.preventDefault();
        const e = {};
        if (!v.clave.trim()) e.clave = 'La clave es obligatoria.';
        else if (v.clave.trim().length > 10) e.clave = 'Máximo 10 caracteres.';
        if (!v.edificio.trim()) e.edificio = 'El edificio es obligatorio.';
        if (!enteroEnRango(v.capacidad, 1, 1000)) e.capacidad = 'La capacidad debe ser un entero mayor que 0.';
        setErrores(e);
        if (Object.keys(e).length) return;
        setGuardando(true);
        try {
            const r = await aulaGuardar({
                datos: {
                    ...(item ? { id_aula: item.id_aula } : {}),
                    clave: v.clave.trim(),
                    edificio: v.edificio.trim(),
                    capacidad: Number(v.capacidad),
                },
            });
            toast({ tone: 'success', title: item ? 'Aula actualizada' : 'Aula creada' });
            onGuardado?.(r);
        } catch (err) {
            toast({ tone: 'danger', title: 'No se pudo guardar el aula', message: mensajeDeError(err) });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Modal
            open
            onClose={guardando ? undefined : onClose}
            title={item ? 'Editar aula' : 'Nueva aula'}
            closeOnOverlay={false}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={guardando}>
                        Cancelar
                    </Button>
                    <Button type="submit" form={formId} loading={guardando}>
                        Guardar
                    </Button>
                </>
            }
        >
            <form id={formId} onSubmit={enviar} noValidate className="grid gap-4 sm:grid-cols-3">
                <Field label="Clave" required error={errores.clave}>
                    <Input value={v.clave} onChange={cambiar('clave')} maxLength={10} autoComplete="off" />
                </Field>
                <Field label="Edificio" required error={errores.edificio}>
                    <Input value={v.edificio} onChange={cambiar('edificio')} autoComplete="off" />
                </Field>
                <Field label="Capacidad" required error={errores.capacidad}>
                    <Input type="number" inputMode="numeric" min={1} value={v.capacidad} onChange={cambiar('capacidad')} />
                </Field>
            </form>
        </Modal>
    );
}
