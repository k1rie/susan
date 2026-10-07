'use client';

import { KeyRound, UserCheck, UserCog, UserX } from 'lucide-react';
import { useId, useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Field from '@/components/ui/Field';
import FormActions from '@/components/ui/FormActions';
import MenuAcciones from '@/components/ui/MenuAcciones';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useFormulario } from '@/hooks/ui/useFormulario.js';
import { usuarioActualizar } from '@/lib/api/admin.js';
import { restablecerUsuario } from '@/lib/http/admin.js';
import { mensajeDeError } from '../comun.js';
import { requiereVinculo } from '../CrearUsuarioDialog/rolesUsuario.js';
import VinculoSelect from '../CrearUsuarioDialog/VinculoSelect.jsx';
import SelectorRol from '../SelectorRol';
import { argumentosCambiarRol, avisoDeVinculo, errorDeCampoCambiarRol, validarCambioRol } from './cambiarRol.utils.js';

// Acciones por fila de la lista de usuarios, reunidas en un menú «⋯» (tres botones por fila se apiñaban a 360 px). Los errores del
// servidor de estas acciones sueltas (p. ej. USUARIO_PROPIO al desactivarse a sí mismo) se muestran tal cual en un aviso.
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
            <MenuAcciones
                label={`Acciones de ${fila.correo}`}
                items={[
                    { label: 'Cambiar rol', icon: UserCog, onClick: () => setRolAbierto(true) },
                    { label: 'Restablecer contraseña', icon: KeyRound, onClick: () => setConfirmar('restablecer') },
                    {
                        label: fila.activo ? 'Desactivar cuenta' : 'Activar cuenta',
                        icon: fila.activo ? UserX : UserCheck,
                        danger: fila.activo,
                        onClick: () => setConfirmar('estado'),
                    },
                ]}
            />
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

// El rol y el vínculo se cambian juntos para que la cuenta quede coherente (docente exige docente, etc.). Pregunta de dos campos:
// Modal (pantalla completa en teléfono, porque lleva teclado) y no panel lateral.
function CambiarRolDialog({ fila, onClose, onGuardado }) {
    const formId = useId();
    const { toast } = useToast();
    const f = useFormulario({
        inicial: { rol: fila.rol, vinculo: '' },
        validar: (v) => validarCambioRol(v, fila),
        mapearError: errorDeCampoCambiarRol,
        onSubmit: async (v) => {
            await usuarioActualizar({ idUsuario: fila.id_usuario, datos: argumentosCambiarRol(v) });
            toast({ tone: 'success', title: 'Rol actualizado' });
            onGuardado();
        },
    });
    const rol = f.valores.rol;
    const aviso = avisoDeVinculo(fila, rol);
    const sinCambio = rol === fila.rol;

    return (
        <Modal
            open
            onClose={onClose}
            title={`Cambiar rol de ${fila.correo}`}
            size="full-mobile"
            showClose
            closeOnOverlay={false}
            closeDisabled={f.enviando}
            dirty={f.sucio}
            footer={({ cerrar }) => (
                <FormActions flat dirty={f.cambios} motivoBloqueo={sinCambio ? 'Elige un rol distinto del actual.' : undefined}>
                    <Button variant="secondary" onClick={cerrar} disabled={f.enviando}>
                        Cancelar
                    </Button>
                    <Button type="submit" form={formId} loading={f.enviando} disabled={sinCambio}>
                        Cambiar rol
                    </Button>
                </FormActions>
            )}
        >
            <form id={formId} onSubmit={f.enviar} noValidate className="flex flex-col gap-4">
                {f.errorEnvio && (
                    <Alert tone="danger" compact title="No se pudo cambiar el rol">
                        {mensajeDeError(f.errorEnvio)}
                    </Alert>
                )}
                <Field as="fieldset" label="Rol nuevo" required reserveError>
                    <SelectorRol
                        label="Rol nuevo"
                        name="rol"
                        value={rol}
                        actual={fila.rol}
                        onChange={(nuevo) => {
                            f.setCampo('rol', nuevo);
                            f.setCampo('vinculo', '');
                        }}
                    />
                </Field>
                {requiereVinculo(rol) && !sinCambio && (
                    <VinculoSelect rol={rol} value={f.valores.vinculo} onChange={(valor) => f.setCampo('vinculo', valor)} error={f.errores.vinculo} />
                )}
                {aviso && (
                    <Alert tone="info" compact>
                        {aviso}
                    </Alert>
                )}
            </form>
        </Modal>
    );
}
