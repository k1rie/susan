'use client';

import { useMemo } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import FormActions from '@/components/ui/FormActions';
import FormSection from '@/components/ui/FormSection';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useApiMutation } from '@/hooks/data';
import { useFormulario } from '@/hooks/ui/useFormulario.js';
import { grupoGuardar } from '@/lib/api/admin.js';
import { useAvisarSucio } from '../compartido/useAvisarSucio.js';
import { CampoCatalogo, CampoClave, CampoPeriodo } from './CamposGrupo.jsx';
import { datosGrupo, identidadBloqueada, mapearErrorGrupo, validarGrupo, valoresDeGrupo } from './grupoForm.utils.js';
import { useCatalogosGrupo } from './useCatalogosGrupo.js';

const AVISO_HISTORIAL = 'No se puede cambiar: el grupo ya tiene inscripciones o sesiones.';

// Edición de los datos de un grupo (pestaña Datos). El alta es un asistente aparte (NuevoGrupo). Mismo contenido de campos, agrupado en
// secciones, con la barra «Cambios sin guardar» y el error del servidor pegado al campo que lo causó (un solo aviso, no alerta + toast).
// `onSucioChange` avisa al detalle del grupo para preguntar antes de cambiar de pestaña.
export default function GrupoForm({ grupo, onSaved, onSucioChange }) {
    const { toast } = useToast();
    const guardar = useApiMutation(grupoGuardar);
    const catalogos = useCatalogosGrupo();
    const bloqueada = identidadBloqueada(grupo);

    const f = useFormulario({
        inicial: valoresDeGrupo(grupo),
        validar: validarGrupo,
        mapearError: mapearErrorGrupo,
        onSubmit: async (v) => {
            const r = await guardar.run({ datos: datosGrupo(v, grupo.id_grupo) });
            toast({ tone: 'success', message: 'Grupo actualizado.' });
            onSaved?.(r);
        },
    });
    useAvisarSucio(f.sucio, onSucioChange);

    // El docente actual puede estar inactivo y no venir en el listado de activos: se conserva como opción para no perderlo al guardar.
    const comboDocente = useMemo(() => {
        const base = catalogos.docentes.comboProps;
        if (!base.options || base.options.some((o) => o.value === String(grupo.id_docente))) return base;
        const actual = { value: String(grupo.id_docente), label: grupo.docente_nombre ?? `Docente ${grupo.id_docente}`, description: 'Actual (ya no está activo)' };
        return { options: [...base.options, actual] };
    }, [catalogos.docentes.comboProps, grupo.id_docente, grupo.docente_nombre]);

    const actuales = {
        id_materia: { value: String(grupo.id_materia), label: grupo.materia_nombre ?? grupo.materia_clave },
        id_docente: { value: String(grupo.id_docente), label: grupo.docente_nombre ?? `Docente ${grupo.id_docente}` },
        id_aula: { value: String(grupo.id_aula), label: grupo.aula_clave },
    };

    return (
        <form onSubmit={f.enviar} noValidate className="flex max-w-2xl flex-col gap-6" aria-label="Datos del grupo">
            {catalogos.error && (
                <Alert tone="danger" compact>
                    No se pudieron cargar los catálogos: {catalogos.error.message}
                </Alert>
            )}
            <FormSection title="Materia y docente" description="Qué se imparte y quién lo imparte." columns={2}>
                <CampoCatalogo f={f} nombre="id_materia" label="Materia" catalogo={catalogos.materias} placeholder="Busca por nombre o clave" selected={actuales.id_materia} disabled={bloqueada} hint={bloqueada ? AVISO_HISTORIAL : undefined} />
                <CampoCatalogo f={f} nombre="id_docente" label="Docente" catalogo={catalogos.docentes} comboProps={comboDocente} placeholder="Busca por nombre o empleado" selected={actuales.id_docente} />
            </FormSection>
            <FormSection title="Identificación del grupo" description="La clave y el periodo, junto con la materia, identifican al grupo." columns={2}>
                <CampoClave f={f} />
                {bloqueada ? (
                    <Field label="Periodo" hint={AVISO_HISTORIAL}>
                        <Input value={grupo.periodo} disabled readOnly />
                    </Field>
                ) : (
                    <CampoPeriodo f={f} />
                )}
            </FormSection>
            <FormSection title="Aula" description="Al cambiar de aula se vuelve a validar el horario contra los grupos de la nueva aula.">
                <CampoCatalogo f={f} nombre="id_aula" label="Aula" catalogo={catalogos.aulas} placeholder="Busca por clave o edificio" selected={actuales.id_aula} />
            </FormSection>

            {f.errorEnvio && (
                <Alert tone="danger" compact title="No se pudo guardar el grupo">
                    {f.errorEnvio.message}
                </Alert>
            )}
            <FormActions dirty={f.cambios} sticky={false} motivoBloqueo={f.sucio ? undefined : 'Aún no hay cambios que guardar.'}>
                {f.sucio && (
                    <Button variant="secondary" onClick={() => f.reiniciar()} disabled={f.enviando}>
                        Descartar cambios
                    </Button>
                )}
                <Button type="submit" loading={f.enviando} disabled={!f.sucio}>
                    Guardar cambios
                </Button>
            </FormActions>
        </form>
    );
}
