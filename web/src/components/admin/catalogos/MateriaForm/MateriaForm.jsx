'use client';

import Field from '@/components/ui/Field';
import FormSection from '@/components/ui/FormSection';
import Input from '@/components/ui/Input';
import { materiaGuardar } from '@/lib/api/admin.js';
import { LIMITES, PATRONES } from '@/lib/formularios';
import CampoNumerico from '../CampoNumerico';
import PanelCatalogo from '../PanelCatalogo';
import { useAltaCatalogo } from '../PanelCatalogo/useAltaCatalogo.js';
import {
    CREDITOS_MAX,
    CREDITOS_MIN,
    datosMateria,
    errorDeCampoMateria,
    HORAS_MAX,
    HORAS_MIN,
    INICIAL_MATERIA,
    materiaInicial,
    normalizarClaveMateria,
    normalizarNombreMateria,
    validarMateria,
} from './materia.utils.js';

// Alta/edición de materia (RF-01) en panel lateral. Tras crear, el siguiente paso natural es un grupo con esa materia.
export default function MateriaForm({ item, onClose, onGuardado }) {
    const editando = Boolean(item);
    const { f, campo, formId, enviar, pedirOtro, exito, crearOtra } = useAltaCatalogo({
        editando,
        inicial: materiaInicial(item),
        inicialOtra: () => INICIAL_MATERIA,
        validar: validarMateria,
        mapearError: errorDeCampoMateria,
        guardar: (v) => materiaGuardar({ datos: datosMateria(v, item) }),
        onGuardado,
        onClose,
        mensajeEditado: (r) => `Materia ${r.clave} actualizada`,
        mensajeOtra: (r) => `Materia ${r.clave} creada`,
    });

    const clave = campo('clave');
    const nombre = campo('nombre');
    const creditos = campo('creditos');
    const horas = campo('horas_semana');
    // La palomita «Válido» solo sale en lo que la persona cambió: en la edición, lo ya guardado no necesita aprobación.
    const claveValida = !clave.error && f.valores.clave !== (item?.clave ?? '') && PATRONES.materia_clave.test(normalizarClaveMateria(f.valores.clave));

    return (
        <PanelCatalogo
            f={f}
            formId={formId}
            onEnviar={enviar}
            onClose={onClose}
            onOtra={pedirOtro}
            editando={editando}
            title={editando ? 'Editar materia' : 'Nueva materia'}
            description={editando ? 'Cambia la clave, el nombre o la carga de la materia.' : 'Registra la materia con su clave, nombre y carga.'}
            etiquetaCrear="Crear materia"
            etiquetaOtra="Crear y agregar otra"
            tituloError="No se pudo guardar la materia"
            exito={
                exito && {
                    title: `Materia ${exito.clave} creada`,
                    description: `${exito.nombre} · ${exito.creditos} ${exito.creditos === 1 ? 'crédito' : 'créditos'} · ${exito.horas_semana} h por semana.`,
                    steps: [
                        {
                            label: 'Crear un grupo con esta materia',
                            description: 'Elige docente, aula y periodo.',
                            href: '/admin/grupos/nuevo',
                            recommended: true,
                        },
                    ],
                    actions: [
                        { label: 'Crear otra materia', onClick: crearOtra },
                        { label: 'Ir a la lista', onClick: onClose, variant: 'secondary' },
                    ],
                }
            }
        >
            <FormSection title="Identificación">
                <Field label="Clave" required error={clave.error} valid={claveValida} hint="Letras y dígitos, sin guiones." example="ADM101" reserveError>
                    <Input {...clave.props} maxLength={LIMITES.materia_clave} showCount transform={normalizarClaveMateria} autoComplete="off" />
                </Field>
                <Field label="Nombre" required error={nombre.error} example="Administración I" counter={{ actual: f.valores.nombre.length, max: LIMITES.materia_nombre, desde: 0.8 }} reserveError>
                    <Input {...nombre.props} maxLength={LIMITES.materia_nombre} transform={normalizarNombreMateria} autoComplete="off" />
                </Field>
            </FormSection>
            <FormSection title="Carga académica" columns={2}>
                <Field label="Créditos" required error={creditos.error} hint="De 1 a 99; no puede ser 0." reserveError>
                    <CampoNumerico {...creditos.props} min={CREDITOS_MIN} max={CREDITOS_MAX} maxDigitos={2} nombre="créditos" />
                </Field>
                <Field label="Horas por semana" required error={horas.error} hint="De 1 a 20 horas." reserveError>
                    <CampoNumerico {...horas.props} min={HORAS_MIN} max={HORAS_MAX} maxDigitos={2} nombre="horas por semana" />
                </Field>
            </FormSection>
        </PanelCatalogo>
    );
}
