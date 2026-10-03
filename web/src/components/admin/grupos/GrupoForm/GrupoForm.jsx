'use client';

import { useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useApiMutation, useApiQuery } from '@/hooks/data';
import { aulasListar, docentesListar, grupoGuardar, materiasListar } from '@/lib/api/admin.js';
import { datosGrupo, validarGrupo, VALORES_INICIALES, valoresDeGrupo } from './grupoForm.utils.js';

const TODOS = { limit: 200 };

// Alta/edición de un grupo (P-09 pestaña Datos). `grupo` (de api_grupo_obtener) la pone en modo edición.
// materia + clave + periodo duplicados los rechaza el servidor y se muestra su mensaje.
export default function GrupoForm({ grupo, onSaved }) {
    const { toast } = useToast();
    const materias = useApiQuery(materiasListar, TODOS);
    const docentes = useApiQuery(docentesListar, { ...TODOS, estatus: 'activo' });
    const aulas = useApiQuery(aulasListar, TODOS);
    const guardar = useApiMutation(grupoGuardar);
    const [valores, setValores] = useState(() => (grupo ? valoresDeGrupo(grupo) : VALORES_INICIALES));
    const [errores, setErrores] = useState({});

    const cambiar = (campo) => (e) => setValores((v) => ({ ...v, [campo]: e.target.value }));
    const cargando = materias.loading || docentes.loading || aulas.loading;
    const falloCatalogo = materias.error || docentes.error || aulas.error;

    // El docente actual puede estar inactivo y no venir en el listado de activos: se conserva como opción.
    const opcionesDocente = (docentes.data?.items ?? []).map((d) => ({ value: String(d.id_docente), label: d.nombre_completo }));
    if (grupo && !opcionesDocente.some((o) => o.value === String(grupo.id_docente))) {
        opcionesDocente.push({ value: String(grupo.id_docente), label: grupo.docente_nombre ?? `Docente ${grupo.id_docente}` });
    }

    const enviar = async (e) => {
        e.preventDefault();
        const err = validarGrupo(valores);
        setErrores(err);
        if (Object.keys(err).length) return;
        try {
            const r = await guardar.run({ datos: datosGrupo(valores, grupo?.id_grupo) });
            toast({ tone: 'success', message: r.creado ? 'Grupo creado.' : 'Grupo actualizado.' });
            onSaved?.(r);
        } catch (error) {
            toast({ tone: 'danger', title: 'No se pudo guardar el grupo', message: error.message });
        }
    };

    if (cargando) {
        return (
            <div className="flex justify-center py-10">
                <Spinner />
            </div>
        );
    }

    return (
        <form onSubmit={enviar} noValidate className="grid max-w-2xl gap-4" aria-label="Datos del grupo">
            {falloCatalogo && <Alert tone="danger">No se pudieron cargar los catálogos: {falloCatalogo.message}</Alert>}
            {guardar.error && <Alert tone="danger">{guardar.error.message}</Alert>}
            <Field label="Materia" required error={errores.id_materia}>
                <Select
                    value={valores.id_materia}
                    onChange={cambiar('id_materia')}
                    placeholder="Selecciona una materia"
                    options={(materias.data?.items ?? []).map((m) => ({ value: String(m.id_materia), label: `${m.clave} - ${m.nombre}` }))}
                />
            </Field>
            <Field label="Docente" required error={errores.id_docente}>
                <Select value={valores.id_docente} onChange={cambiar('id_docente')} placeholder="Selecciona un docente" options={opcionesDocente} />
            </Field>
            <Field label="Aula" required error={errores.id_aula}>
                <Select
                    value={valores.id_aula}
                    onChange={cambiar('id_aula')}
                    placeholder="Selecciona un aula"
                    options={(aulas.data?.items ?? []).map((a) => ({ value: String(a.id_aula), label: `${a.clave} (capacidad ${a.capacidad})` }))}
                />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Clave de grupo" required error={errores.clave_grupo} hint="Hasta 8 caracteres, por ejemplo 3A">
                    <Input value={valores.clave_grupo} onChange={cambiar('clave_grupo')} maxLength={8} />
                </Field>
                <Field label="Periodo" required error={errores.periodo} hint="AAAA-S, por ejemplo 2026-2">
                    <Input value={valores.periodo} onChange={cambiar('periodo')} maxLength={6} placeholder="2026-2" />
                </Field>
            </div>
            <div>
                <Button type="submit" loading={guardar.loading}>
                    {grupo ? 'Guardar cambios' : 'Crear grupo'}
                </Button>
            </div>
        </form>
    );
}
