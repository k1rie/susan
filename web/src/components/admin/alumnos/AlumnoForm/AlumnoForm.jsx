'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { datosAlumno, ESTATUS_ALUMNO, validarAlumno, valoresDeAlumno } from './alumnoForm.utils.js';

// Datos del alumno (RF-01). onSubmit({ datos, estatus }) puede devolver una promesa; los errores del
// servidor los muestra quien llama (toast) y el formulario conserva lo escrito.
export default function AlumnoForm({ alumno, onSubmit, loading = false, submitLabel = 'Guardar' }) {
    const [valores, setValores] = useState(() => valoresDeAlumno(alumno));
    const [errores, setErrores] = useState({});

    const cambiar = (campo) => (e) => setValores((v) => ({ ...v, [campo]: e.target.value }));

    const enviar = async (e) => {
        e.preventDefault();
        const encontrados = validarAlumno(valores);
        setErrores(encontrados);
        if (Object.keys(encontrados).length > 0) return;
        await onSubmit?.({ datos: datosAlumno(valores, alumno?.id_alumno), estatus: valores.estatus });
    };

    return (
        <form onSubmit={enviar} noValidate className="grid gap-4 sm:grid-cols-2" aria-label="Datos del alumno">
            <Field label="Matrícula" required error={errores.matricula}>
                <Input value={valores.matricula} onChange={cambiar('matricula')} autoComplete="off" />
            </Field>
            <Field label="Correo institucional" required error={errores.correo_institucional}>
                <Input type="email" value={valores.correo_institucional} onChange={cambiar('correo_institucional')} autoComplete="off" />
            </Field>
            <Field label="Apellido paterno" required error={errores.apellido_paterno}>
                <Input value={valores.apellido_paterno} onChange={cambiar('apellido_paterno')} autoComplete="off" />
            </Field>
            <Field label="Apellido materno" error={errores.apellido_materno}>
                <Input value={valores.apellido_materno} onChange={cambiar('apellido_materno')} autoComplete="off" />
            </Field>
            <Field label="Nombres" required error={errores.nombres}>
                <Input value={valores.nombres} onChange={cambiar('nombres')} autoComplete="off" />
            </Field>
            <Field label="Estatus" hint={alumno ? 'Un estatus distinto de activo da de baja sus inscripciones activas.' : undefined}>
                <Select value={valores.estatus} onChange={cambiar('estatus')} options={ESTATUS_ALUMNO} />
            </Field>
            <div className="sm:col-span-2">
                <Button type="submit" loading={loading}>
                    {submitLabel}
                </Button>
            </div>
        </form>
    );
}
