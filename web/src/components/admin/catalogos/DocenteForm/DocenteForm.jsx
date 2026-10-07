'use client';

import { useState } from 'react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Field from '@/components/ui/Field';
import FormSection from '@/components/ui/FormSection';
import Input from '@/components/ui/Input';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { docenteCambiarEstatus, docenteGuardar } from '@/lib/api/admin.js';
import { esCorreo, LIMITES, PATRONES } from '@/lib/formularios';
import PanelCatalogo from '../PanelCatalogo';
import { useAltaCatalogo } from '../PanelCatalogo/useAltaCatalogo.js';
import {
    datosDocente,
    docenteInicial,
    ESTATUS_DOCENTE,
    errorDeCampoDocente,
    EstatusNoCambiado,
    INICIAL_DOCENTE,
    normalizarCorreo,
    normalizarNombre,
    normalizarNumEmpleado,
    validarDocente,
} from './docente.utils.js';

// Alta/edición de docente (RF-01) en panel lateral.
//  - El alta es UNA llamada (el docente nace activo): ya no hay selector de estatus ni segunda llamada que pueda fallar a medias.
//  - La edición puede cambiar el estatus con su propia RPC; si esa segunda llamada falla los datos ya se guardaron, y el error se
//    dice junto al campo Estatus (sin mentir con «No se pudo guardar») y deja el formulario listo para reintentar.
//  - Tras crear, el siguiente paso es la cuenta de acceso: `onCrearCuenta(docente)` la abre con vínculo y correo prellenados.
export default function DocenteForm({ item, onClose, onGuardado, onCrearCuenta }) {
    const editando = Boolean(item);
    const [confirmarBaja, setConfirmarBaja] = useState(false);

    const { f, campo, formId, enviar, pedirOtro, exito, crearOtra } = useAltaCatalogo({
        editando,
        inicial: docenteInicial(item),
        inicialOtra: () => INICIAL_DOCENTE,
        validar: validarDocente,
        mapearError: errorDeCampoDocente,
        guardar: async (v) => {
            const r = await docenteGuardar({ datos: datosDocente(v, item) });
            if (editando && v.estatus !== item.estatus) {
                try {
                    await docenteCambiarEstatus({ idDocente: r.id_docente, estatus: v.estatus });
                } catch (causa) {
                    // Lo guardado = los datos nuevos con el estatus de antes (el que de verdad tiene el docente).
                    throw new EstatusNoCambiado(causa, { registro: r, valores: { ...v, estatus: item.estatus } });
                }
            }
            return { ...r, estatus: v.estatus };
        },
        onGuardado,
        onClose,
        mensajeEditado: (r) => `Docente ${r.num_empleado} actualizado`,
        mensajeOtra: (r) => `Docente ${r.num_empleado} creado`,
    });

    const num = campo('num_empleado');
    const correo = campo('correo_institucional');
    const paterno = campo('apellido_paterno');
    const materno = campo('apellido_materno');
    const nombres = campo('nombres');

    // La palomita «Válido» solo sale en lo que la persona cambió: en la edición, lo ya guardado no necesita aprobación.
    const inicial = docenteInicial(item);
    const numValido = !num.error && f.valores.num_empleado !== inicial.num_empleado && PATRONES.num_empleado.test(normalizarNumEmpleado(f.valores.num_empleado));
    const correoValido = !correo.error && f.valores.correo_institucional !== inicial.correo_institucional && esCorreo(f.valores.correo_institucional);

    const grupos = Number(item?.grupos ?? 0);
    const pideBaja = editando && f.valores.estatus === 'baja' && item.estatus !== 'baja';
    // La baja se confirma ANTES de guardar; con datos inválidos no se pregunta nada: el envío normal muestra los errores.
    const alEnviar = (evento) => {
        if (pideBaja && f.valido) {
            evento.preventDefault();
            setConfirmarBaja(true);
            return undefined;
        }
        return enviar(evento);
    };

    const ayudaEstatus =
        f.valores.estatus === 'baja'
            ? `La baja conserva el historial y se rechaza si hay sesiones por impartir${grupos > 0 ? ` (tiene ${grupos} ${grupos === 1 ? 'grupo asignado' : 'grupos asignados'})` : ''}.`
            : f.valores.estatus === 'licencia'
              ? 'En licencia conserva sus grupos pero no se le pueden abrir sesiones nuevas.'
              : 'Activo: puede tener grupos y pasar lista.';

    return (
        <>
            <PanelCatalogo
                f={f}
                formId={formId}
                onEnviar={alEnviar}
                onClose={onClose}
                onOtra={pedirOtro}
                editando={editando}
                title={editando ? 'Editar docente' : 'Nuevo docente'}
                description={editando ? 'Cambia sus datos o su estatus.' : 'Registra al docente; después puedes darle una cuenta de acceso.'}
                etiquetaCrear="Crear docente"
                etiquetaOtra="Crear y agregar otro"
                tituloError="No se pudo guardar el docente"
                exito={
                    exito && {
                        title: `Docente ${exito.num_empleado} creado`,
                        description: `${exito.nombre_completo} · ${exito.correo_institucional}`,
                        steps: onCrearCuenta
                            ? [
                                  {
                                      label: 'Crear cuenta de acceso',
                                      description: 'Para que inicie sesión.',
                                      onClick: () => {
                                          onCrearCuenta(exito);
                                          onClose?.();
                                      },
                                      recommended: true,
                                  },
                              ]
                            : [],
                        actions: [
                            { label: 'Crear otro docente', onClick: crearOtra },
                            { label: 'Ir a la lista', onClick: onClose, variant: 'secondary' },
                        ],
                    }
                }
            >
                <FormSection title="Identificación">
                    <Field label="Número de empleado" required error={num.error} valid={numValido} hint="Letras y dígitos, sin guiones." example="D001" reserveError>
                        <Input {...num.props} maxLength={LIMITES.num_empleado} showCount transform={normalizarNumEmpleado} autoComplete="off" />
                    </Field>
                    <Field label="Correo institucional" required error={correo.error} valid={correoValido} example="ana.lopez@unach.mx" reserveError>
                        <Input {...correo.props} type="email" inputMode="email" maxLength={LIMITES.correo} transform={normalizarCorreo} autoComplete="off" />
                    </Field>
                </FormSection>
                <FormSection title="Nombre" columns={2}>
                    <Field label="Apellido paterno" required error={paterno.error} reserveError>
                        <Input {...paterno.props} maxLength={LIMITES.apellidos} transform={normalizarNombre} autoComplete="off" />
                    </Field>
                    <Field label="Apellido materno" optional error={materno.error} reserveError>
                        <Input {...materno.props} maxLength={LIMITES.apellidos} transform={normalizarNombre} autoComplete="off" />
                    </Field>
                    <Field label="Nombres" required error={nombres.error} className="@md:col-span-2" reserveError>
                        <Input {...nombres.props} maxLength={LIMITES.nombres} transform={normalizarNombre} autoComplete="off" />
                    </Field>
                </FormSection>
                {editando && (
                    <FormSection title="Situación laboral">
                        <Field as="fieldset" label="Estatus" hint={ayudaEstatus} error={f.errores.estatus} reserveError>
                            <SegmentedControl
                                label="Estatus del docente"
                                items={ESTATUS_DOCENTE}
                                value={f.valores.estatus}
                                onChange={(valor) => f.setCampo('estatus', valor)}
                                fullWidth
                                name="estatus"
                                aria-invalid={f.errores.estatus ? true : undefined}
                            />
                        </Field>
                    </FormSection>
                )}
            </PanelCatalogo>
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
                    setConfirmarBaja(false);
                    await enviar();
                }}
            />
        </>
    );
}
