'use client';

import Field from '@/components/ui/Field';
import FormSection from '@/components/ui/FormSection';
import Input from '@/components/ui/Input';
import { aulaGuardar } from '@/lib/api/admin.js';
import { LIMITES, PATRONES } from '@/lib/formularios';
import CampoNumerico from '../CampoNumerico';
import PanelCatalogo from '../PanelCatalogo';
import { useAltaCatalogo } from '../PanelCatalogo/useAltaCatalogo.js';
import {
    aulaInicial,
    CAPACIDAD_MAX,
    CAPACIDAD_MIN,
    CAPACIDAD_SUGERIDA,
    datosAula,
    errorDeCampoAula,
    INICIAL_AULA,
    normalizarClaveAula,
    normalizarEdificio,
    validarAula,
} from './aula.utils.js';

// Alta/edición de aula (RF-01) en panel lateral. El servidor rechaza una capacidad menor que los inscritos de un grupo
// (se muestra junto al campo). Las cámaras no se configuran aquí: se hace desde un grupo que use el aula (pestaña «Aula y cámaras»),
// por eso el siguiente paso tras crear es un grupo.
export default function AulaForm({ item, onClose, onGuardado }) {
    const editando = Boolean(item);
    const { f, campo, formId, enviar, pedirOtro, exito, crearOtra } = useAltaCatalogo({
        editando,
        inicial: aulaInicial(item),
        // Las aulas se dan de alta en serie y casi siempre comparten edificio: se conserva y se limpia lo demás.
        inicialOtra: (v) => ({ ...INICIAL_AULA, edificio: v.edificio }),
        validar: validarAula,
        mapearError: errorDeCampoAula,
        guardar: (v) => aulaGuardar({ datos: datosAula(v, item) }),
        onGuardado,
        onClose,
        mensajeEditado: (r) => `Aula ${r.clave} actualizada`,
        mensajeOtra: (r) => `Aula ${r.clave} creada`,
    });

    const clave = campo('clave');
    const edificio = campo('edificio');
    const capacidad = campo('capacidad');
    // La palomita «Válido» solo sale en lo que la persona cambió: en la edición, lo ya guardado no necesita aprobación.
    const claveValida = !clave.error && f.valores.clave !== (item?.clave ?? '') && PATRONES.aula_clave.test(normalizarClaveAula(f.valores.clave));

    return (
        <PanelCatalogo
            f={f}
            formId={formId}
            onEnviar={enviar}
            onClose={onClose}
            onOtra={pedirOtro}
            editando={editando}
            title={editando ? 'Editar aula' : 'Nueva aula'}
            description={editando ? 'Cambia la clave, el edificio o la capacidad del aula.' : 'Registra el aula y cuántos alumnos caben.'}
            etiquetaCrear="Crear aula"
            etiquetaOtra="Crear y agregar otra"
            tituloError="No se pudo guardar el aula"
            exito={
                exito && {
                    title: `Aula ${exito.clave} creada`,
                    description: `${exito.edificio} · capacidad ${exito.capacidad}.`,
                    steps: [
                        {
                            label: 'Crear un grupo en esta aula',
                            description: 'Ahí armas el horario y configuras las cámaras.',
                            href: '/admin/grupos/nuevo',
                            recommended: true,
                        },
                    ],
                    actions: [
                        { label: 'Crear otra aula', onClick: crearOtra },
                        { label: 'Ir a la lista', onClick: onClose, variant: 'secondary' },
                    ],
                }
            }
        >
            <FormSection title="Identificación" columns={2}>
                <Field label="Clave" required error={clave.error} valid={claveValida} hint="Letras, dígitos y guiones." example="A-12" reserveError>
                    <Input {...clave.props} maxLength={LIMITES.aula_clave} showCount transform={normalizarClaveAula} autoComplete="off" />
                </Field>
                <Field label="Edificio" required error={edificio.error} example="Edificio A" reserveError>
                    <Input {...edificio.props} maxLength={LIMITES.aula_edificio} transform={normalizarEdificio} autoComplete="off" />
                </Field>
            </FormSection>
            <FormSection title="Cupo">
                <Field label="Capacidad" required error={capacidad.error} hint="Máximo de alumnos que caben sentados." reserveError>
                    <CampoNumerico {...capacidad.props} min={CAPACIDAD_MIN} max={CAPACIDAD_MAX} inicio={CAPACIDAD_SUGERIDA} nombre="capacidad" />
                </Field>
            </FormSection>
        </PanelCatalogo>
    );
}
