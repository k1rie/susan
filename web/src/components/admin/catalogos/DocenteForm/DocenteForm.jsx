'use client';

import { useId, useState } from 'react';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Field from '@/components/ui/Field';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { docenteCambiarEstatus, docenteGuardar } from '@/lib/api/admin.js';
import { CORREO, mensajeDeError, textoONulo } from '../comun.js';

export const ESTATUS_DOCENTE = [
    { value: 'activo', label: 'Activo' },
    { value: 'licencia', label: 'Licencia' },
    { value: 'baja', label: 'Baja' },
];
export const etiquetaEstatusDocente = (e) => ESTATUS_DOCENTE.find((x) => x.value === e)?.label ?? e ?? '';

// Alta/edición de docente (RF-01). El estatus se cambia con su propia RPC; la baja pide confirmación
// y avisa si el docente tiene grupos.
export default function DocenteForm({ item, onClose, onGuardado }) {
    const formId = useId();
    const { toast } = useToast();
    const [v, setV] = useState({
        num_empleado: item?.num_empleado ?? '',
        apellido_paterno: item?.apellido_paterno ?? '',
        apellido_materno: item?.apellido_materno ?? '',
        nombres: item?.nombres ?? '',
        correo_institucional: item?.correo_institucional ?? '',
        estatus: item?.estatus ?? 'activo',
    });
    const [errores, setErrores] = useState({});
    const [guardando, setGuardando] = useState(false);
    const [confirmarBaja, setConfirmarBaja] = useState(false);
    const cambiar = (c) => (e) => setV((p) => ({ ...p, [c]: e.target.value }));

    const validar = () => {
        const e = {};
        if (!v.num_empleado.trim()) e.num_empleado = 'El número de empleado es obligatorio.';
        if (!v.apellido_paterno.trim()) e.apellido_paterno = 'El apellido paterno es obligatorio.';
        if (!v.nombres.trim()) e.nombres = 'El nombre es obligatorio.';
        if (!CORREO.test(v.correo_institucional.trim())) e.correo_institucional = 'Escriba un correo válido.';
        return e;
    };

    const guardar = async () => {
        setGuardando(true);
        try {
            const datos = {
                ...(item ? { id_docente: item.id_docente } : {}),
                num_empleado: v.num_empleado.trim(),
                apellido_paterno: v.apellido_paterno.trim(),
                apellido_materno: textoONulo(v.apellido_materno),
                nombres: v.nombres.trim(),
                correo_institucional: v.correo_institucional.trim(),
            };
            const r = await docenteGuardar({ datos });
            if (item && v.estatus !== item.estatus) {
                await docenteCambiarEstatus({ idDocente: r.id_docente, estatus: v.estatus });
            }
            toast({ tone: 'success', title: item ? 'Docente actualizado' : 'Docente creado' });
            onGuardado?.(r);
        } catch (e) {
            toast({ tone: 'danger', title: 'No se pudo guardar el docente', message: mensajeDeError(e) });
            throw e;
        } finally {
            setGuardando(false);
        }
    };

    const enviar = (ev) => {
        ev.preventDefault();
        const e = validar();
        setErrores(e);
        if (Object.keys(e).length) return;
        if (item && v.estatus === 'baja' && item.estatus !== 'baja') {
            setConfirmarBaja(true);
            return;
        }
        guardar().catch(() => {});
    };

    const grupos = Number(item?.grupos ?? 0);
    return (
        <>
            <Modal
                open
                onClose={guardando ? undefined : onClose}
                title={item ? 'Editar docente' : 'Nuevo docente'}
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
                    <Field label="Número de empleado" required error={errores.num_empleado}>
                        <Input value={v.num_empleado} onChange={cambiar('num_empleado')} autoComplete="off" />
                    </Field>
                    <Field label="Correo institucional" required error={errores.correo_institucional}>
                        <Input type="email" value={v.correo_institucional} onChange={cambiar('correo_institucional')} autoComplete="off" />
                    </Field>
                    <Field label="Apellido paterno" required error={errores.apellido_paterno}>
                        <Input value={v.apellido_paterno} onChange={cambiar('apellido_paterno')} autoComplete="off" />
                    </Field>
                    <Field label="Apellido materno">
                        <Input value={v.apellido_materno} onChange={cambiar('apellido_materno')} autoComplete="off" />
                    </Field>
                    <Field label="Nombres" required error={errores.nombres} className="sm:col-span-2">
                        <Input value={v.nombres} onChange={cambiar('nombres')} autoComplete="off" />
                    </Field>
                    {item && (
                        <Field
                            label="Estatus"
                            hint="La baja conserva el historial y se rechaza si hay sesiones por impartir."
                            className="sm:col-span-2"
                        >
                            <Select value={v.estatus} onChange={cambiar('estatus')} options={ESTATUS_DOCENTE} />
                        </Field>
                    )}
                </form>
            </Modal>
            <ConfirmDialog
                open={confirmarBaja}
                title="Dar de baja al docente"
                message={
                    grupos > 0
                        ? `Este docente tiene ${grupos} grupo(s) asignado(s). La baja se rechaza si tiene sesiones programadas o abiertas de hoy en adelante. ¿Continuar?`
                        : 'El docente quedará de baja; su historial se conserva. ¿Continuar?'
                }
                confirmLabel="Dar de baja"
                variant="danger"
                onCancel={() => setConfirmarBaja(false)}
                onConfirm={async () => {
                    try {
                        await guardar();
                    } finally {
                        setConfirmarBaja(false);
                    }
                }}
            />
        </>
    );
}
