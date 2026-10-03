'use client';

import { useId, useState } from 'react';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { crearUsuario } from '@/lib/http/admin.js';
import { CORREO, mensajeDeError } from '../comun.js';
import { ROLES_USUARIO, requiereVinculo } from './rolesUsuario.js';
import VinculoSelect from './VinculoSelect.jsx';

// Crea la cuenta (RF-01): correo + rol + vínculo. Entrega la contraseña temporal a onCreado para que
// el padre la muestre UNA sola vez; aquí no se guarda.
export default function CrearUsuarioDialog({ open, onClose, onCreado }) {
    if (!open) return null;
    return <Formulario onClose={onClose} onCreado={onCreado} />;
}

function Formulario({ onClose, onCreado }) {
    const formId = useId();
    const { toast } = useToast();
    const [correo, setCorreo] = useState('');
    const [rol, setRol] = useState('docente');
    const [vinculo, setVinculo] = useState('');
    const [errores, setErrores] = useState({});
    const [guardando, setGuardando] = useState(false);

    const enviar = async (ev) => {
        ev.preventDefault();
        const e = {};
        if (!CORREO.test(correo.trim())) e.correo = 'Escriba un correo válido.';
        if (requiereVinculo(rol) && !vinculo) e.vinculo = `Seleccione el ${rol} vinculado.`;
        setErrores(e);
        if (Object.keys(e).length) return;
        setGuardando(true);
        try {
            const r = await crearUsuario({
                correo: correo.trim(),
                rol,
                idDocente: rol === 'docente' ? Number(vinculo) : undefined,
                idAlumno: rol === 'alumno' ? Number(vinculo) : undefined,
            });
            onCreado?.(r);
        } catch (err) {
            toast({ tone: 'danger', title: 'No se pudo crear la cuenta', message: mensajeDeError(err) });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Modal
            open
            onClose={guardando ? undefined : onClose}
            title="Nueva cuenta de usuario"
            closeOnOverlay={false}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={guardando}>
                        Cancelar
                    </Button>
                    <Button type="submit" form={formId} loading={guardando}>
                        Crear cuenta
                    </Button>
                </>
            }
        >
            <form id={formId} onSubmit={enviar} noValidate className="flex flex-col gap-4">
                <Field label="Correo" required error={errores.correo} hint="Se generará una contraseña temporal.">
                    <Input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} autoComplete="off" />
                </Field>
                <Field label="Rol" required>
                    <Select
                        value={rol}
                        onChange={(e) => {
                            setRol(e.target.value);
                            setVinculo('');
                        }}
                        options={ROLES_USUARIO}
                    />
                </Field>
                <VinculoSelect rol={rol} value={vinculo} onChange={setVinculo} error={errores.vinculo} />
            </form>
        </Modal>
    );
}
