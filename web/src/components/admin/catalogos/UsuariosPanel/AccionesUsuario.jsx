'use client';

import { useId, useState } from 'react';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Field from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { usuarioActualizar } from '@/lib/api/admin.js';
import { restablecerUsuario } from '@/lib/http/admin.js';
import { mensajeDeError } from '../comun.js';
import { ROLES_USUARIO, requiereVinculo } from '../CrearUsuarioDialog/rolesUsuario.js';
import VinculoSelect from '../CrearUsuarioDialog/VinculoSelect.jsx';

// Botones por fila de la lista de usuarios. Los errores del servidor (p. ej. USUARIO_PROPIO al
// desactivarse a sí mismo) se muestran tal cual en un aviso.
export default function AccionesUsuario({ fila, refetch, onPassword }) {
    const { toast } = useToast();
    const [confirmar, setConfirmar] = useState(null); // 'restablecer' | 'estado' | null
    const [rolAbierto, setRolAbierto] = useState(false);

    const fallo = (titulo) => (e) => {
        toast({ tone: 'danger', title: titulo, message: mensajeDeError(e) });
        throw e;
    };

    const restablecer = () =>
        restablecerUsuario({ idUsuario: fila.id_usuario })
            .then((r) => {
                setConfirmar(null);
                onPassword?.({ correo: r.correo ?? fila.correo, contrasena: r.contrasena_temporal, titulo: 'Contraseña restablecida' });
            })
            .catch(fallo('No se pudo restablecer la contraseña'));

    const cambiarEstado = () =>
        usuarioActualizar({ idUsuario: fila.id_usuario, datos: { activo: !fila.activo } })
            .then(() => {
                setConfirmar(null);
                toast({ tone: 'success', title: fila.activo ? 'Cuenta desactivada' : 'Cuenta activada' });
                refetch();
            })
            .catch(fallo('No se pudo cambiar el estado de la cuenta'));

    return (
        <>
            <Button size="sm" variant="secondary" onClick={() => setRolAbierto(true)}>
                Cambiar rol
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setConfirmar('restablecer')}>
                Restablecer contraseña
            </Button>
            <Button size="sm" variant={fila.activo ? 'danger' : 'secondary'} onClick={() => setConfirmar('estado')}>
                {fila.activo ? 'Desactivar' : 'Activar'}
            </Button>
            <ConfirmDialog
                open={confirmar === 'restablecer'}
                title="Restablecer contraseña"
                message={`Se generará una contraseña temporal nueva para ${fila.correo}. La anterior dejará de funcionar.`}
                confirmLabel="Restablecer"
                onCancel={() => setConfirmar(null)}
                onConfirm={restablecer}
            />
            <ConfirmDialog
                open={confirmar === 'estado'}
                title={fila.activo ? 'Desactivar cuenta' : 'Activar cuenta'}
                message={
                    fila.activo
                        ? `${fila.correo} ya no podrá iniciar sesión. Su historial se conserva.`
                        : `${fila.correo} podrá volver a iniciar sesión.`
                }
                confirmLabel={fila.activo ? 'Desactivar' : 'Activar'}
                variant={fila.activo ? 'danger' : 'primary'}
                onCancel={() => setConfirmar(null)}
                onConfirm={cambiarEstado}
            />
            {rolAbierto && (
                <CambiarRolDialog
                    fila={fila}
                    onClose={() => setRolAbierto(false)}
                    onGuardado={() => {
                        setRolAbierto(false);
                        refetch();
                    }}
                />
            )}
        </>
    );
}

// El rol y el vínculo se cambian juntos para que la cuenta quede coherente (docente exige docente, etc.).
function CambiarRolDialog({ fila, onClose, onGuardado }) {
    const formId = useId();
    const { toast } = useToast();
    const [rol, setRol] = useState(fila.rol);
    const [vinculo, setVinculo] = useState('');
    const [error, setError] = useState('');
    const [guardando, setGuardando] = useState(false);

    const enviar = async (ev) => {
        ev.preventDefault();
        if (rol === fila.rol) {
            setError('Seleccione un rol distinto del actual.');
            return;
        }
        if (requiereVinculo(rol) && !vinculo) {
            setError(`Seleccione el ${rol} vinculado.`);
            return;
        }
        setError('');
        setGuardando(true);
        try {
            await usuarioActualizar({
                idUsuario: fila.id_usuario,
                datos: {
                    rol,
                    ...(rol === 'docente' ? { id_docente: Number(vinculo) } : {}),
                    ...(rol === 'alumno' ? { id_alumno: Number(vinculo) } : {}),
                },
            });
            toast({ tone: 'success', title: 'Rol actualizado' });
            onGuardado();
        } catch (e) {
            toast({ tone: 'danger', title: 'No se pudo cambiar el rol', message: mensajeDeError(e) });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Modal
            open
            onClose={guardando ? undefined : onClose}
            title={`Cambiar rol de ${fila.correo}`}
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
            <form id={formId} onSubmit={enviar} noValidate className="flex flex-col gap-4">
                <Field label="Rol" required error={requiereVinculo(rol) ? undefined : error}>
                    <Select
                        value={rol}
                        onChange={(e) => {
                            setRol(e.target.value);
                            setVinculo('');
                            setError('');
                        }}
                        options={ROLES_USUARIO}
                    />
                </Field>
                <VinculoSelect rol={rol} value={vinculo} onChange={setVinculo} error={error} />
                {!requiereVinculo(rol) && (
                    <p className="text-xs text-muted-foreground">Administrador y técnico no llevan docente ni alumno vinculado.</p>
                )}
            </form>
        </Modal>
    );
}
