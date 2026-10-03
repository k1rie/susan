'use client';

import { useId, useState } from 'react';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { materiaGuardar } from '@/lib/api/admin.js';
import { enteroEnRango, mensajeDeError } from '../comun.js';

/** Validación de conveniencia (la real es de la base): clave, nombre, créditos >= 0 y horas por semana 1-20. */
export function validarMateria(v) {
    const e = {};
    if (!v.clave.trim()) e.clave = 'La clave es obligatoria.';
    if (!v.nombre.trim()) e.nombre = 'El nombre es obligatorio.';
    if (!enteroEnRango(v.creditos, 0, 99)) e.creditos = 'Escriba los créditos (entero de 0 a 99).';
    if (!enteroEnRango(v.horas_semana, 1, 20)) e.horas_semana = 'Las horas por semana deben ser de 1 a 20.';
    return e;
}

// Alta/edición de materia (RF-01).
export default function MateriaForm({ item, onClose, onGuardado }) {
    const formId = useId();
    const { toast } = useToast();
    const [v, setV] = useState({
        clave: item?.clave ?? '',
        nombre: item?.nombre ?? '',
        creditos: item?.creditos != null ? String(item.creditos) : '',
        horas_semana: item?.horas_semana != null ? String(item.horas_semana) : '',
    });
    const [errores, setErrores] = useState({});
    const [guardando, setGuardando] = useState(false);
    const cambiar = (c) => (e) => setV((p) => ({ ...p, [c]: e.target.value }));

    const enviar = async (ev) => {
        ev.preventDefault();
        const e = validarMateria(v);
        setErrores(e);
        if (Object.keys(e).length) return;
        setGuardando(true);
        try {
            const r = await materiaGuardar({
                datos: {
                    ...(item ? { id_materia: item.id_materia } : {}),
                    clave: v.clave.trim(),
                    nombre: v.nombre.trim(),
                    creditos: Number(v.creditos),
                    horas_semana: Number(v.horas_semana),
                },
            });
            toast({ tone: 'success', title: item ? 'Materia actualizada' : 'Materia creada' });
            onGuardado?.(r);
        } catch (err) {
            toast({ tone: 'danger', title: 'No se pudo guardar la materia', message: mensajeDeError(err) });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Modal
            open
            onClose={guardando ? undefined : onClose}
            title={item ? 'Editar materia' : 'Nueva materia'}
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
            <form id={formId} onSubmit={enviar} noValidate className="grid gap-4 sm:grid-cols-2">
                <Field label="Clave" required error={errores.clave}>
                    <Input value={v.clave} onChange={cambiar('clave')} autoComplete="off" />
                </Field>
                <Field label="Nombre" required error={errores.nombre}>
                    <Input value={v.nombre} onChange={cambiar('nombre')} autoComplete="off" />
                </Field>
                <Field label="Créditos" required error={errores.creditos}>
                    <Input type="number" inputMode="numeric" min={0} max={99} value={v.creditos} onChange={cambiar('creditos')} />
                </Field>
                <Field label="Horas por semana" required hint="De 1 a 20." error={errores.horas_semana}>
                    <Input type="number" inputMode="numeric" min={1} max={20} value={v.horas_semana} onChange={cambiar('horas_semana')} />
                </Field>
            </form>
        </Modal>
    );
}
