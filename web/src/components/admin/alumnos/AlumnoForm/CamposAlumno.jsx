'use client';

import Link from 'next/link';
import { useState } from 'react';
import Field from '@/components/ui/Field';
import Input from '@/components/ui/Input';
import { LIMITES } from '@/lib/formularios/limites.js';
import { normalizarCorreo, normalizarMatricula, normalizarNombre, validarAlumno } from './alumnoForm.utils.js';

// Campos de captura del alumno, compartidos por la edición de la ficha (AlumnoForm, con FormSection) y los pasos del alta
// (NuevoAlumno, con Asistente). Cada grupo devuelve solo sus campos: el contenedor decide la rejilla.
//   f  resultado de useFormulario con los valores del alumno.
// Matrícula y correo reservan el alto del mensaje (tienen «válido», «disponible» o «ya existe»); los nombres no, para que el formulario
// no quede holgado en el teléfono.
// La palomita «válido» solo sale en los datos que la persona no puede comprobar a ojo (matrícula y correo) y solo después de
// salir del campo: marcar válida una «E» recién escrita sería ruido.
function useVistos() {
    const [vistos, setVistos] = useState({});
    return [vistos, (nombre) => setVistos((v) => (v[nombre] ? v : { ...v, [nombre]: true }))];
}

const contador = (valor, max) => ({ actual: String(valor ?? '').length, max, desde: 0.8 });

/**
 * Matrícula y nombre.
 * `matricula` (opcional) es el resultado de comprobar si ya existe: { estado: 'idle'|'comprobando'|'libre'|'duplicada', alumno }.
 */
export function CamposIdentidad({ f, matricula: existencia }) {
    const [vistos, ver] = useVistos();
    const errs = validarAlumno(f.valores);
    const cMatricula = f.campo('matricula');
    const cNombres = f.campo('nombres');
    const cPaterno = f.campo('apellido_paterno');
    const cMaterno = f.campo('apellido_materno');
    const alSalir = (nombre, c) => () => {
        ver(nombre);
        c.onBlur();
    };
    const comprobando = existencia?.estado === 'comprobando';
    const libre = existencia?.estado === 'libre';
    const matriculaValida = vistos.matricula && !cMatricula.error && !errs.matricula && cMatricula.value !== '' && existencia?.estado !== 'duplicada';

    return (
        <>
            <div className="flex min-w-0 flex-col gap-1">
                <Field
                    label="Matrícula"
                    required
                    example="E260099"
                    hint={comprobando ? 'Comprobando si ya existe…' : 'Hasta 10 letras o dígitos, sin espacios ni guiones.'}
                    error={cMatricula.error}
                    valid={matriculaValida ? (libre ? 'Matrícula disponible' : true) : false}
                    counter={contador(cMatricula.value, LIMITES.matricula)}
                    reserveError
                >
                    <Input
                        {...cMatricula.props}
                        onBlur={alSalir('matricula', cMatricula)}
                        maxLength={LIMITES.matricula}
                        transform={normalizarMatricula}
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                    />
                </Field>
                {existencia?.estado === 'duplicada' && existencia.alumno && (
                    <Link href={`/admin/alumnos/${existencia.alumno.id_alumno}`} className="text-[13px] font-medium text-link underline-offset-2 hover:underline">
                        Ver la ficha de {existencia.alumno.nombre_completo}
                    </Link>
                )}
            </div>
            <Field label="Nombres" required error={cNombres.error} counter={contador(cNombres.value, LIMITES.nombres)}>
                <Input
                    {...cNombres.props}
                    maxLength={LIMITES.nombres}
                    transform={normalizarNombre}
                    autoComplete="off"
                    autoCapitalize="words"
                />
            </Field>
            <Field label="Apellido paterno" required error={cPaterno.error} counter={contador(cPaterno.value, LIMITES.apellidos)}>
                <Input
                    {...cPaterno.props}
                    maxLength={LIMITES.apellidos}
                    transform={normalizarNombre}
                    autoComplete="off"
                    autoCapitalize="words"
                />
            </Field>
            <Field label="Apellido materno" optional error={cMaterno.error} counter={contador(cMaterno.value, LIMITES.apellidos)}>
                <Input
                    {...cMaterno.props}
                    maxLength={LIMITES.apellidos}
                    transform={normalizarNombre}
                    autoComplete="off"
                    autoCapitalize="words"
                />
            </Field>
        </>
    );
}

/** Correo institucional (no se completa solo: el dominio lo asigna la universidad y aquí no está configurado). */
export function CamposContacto({ f }) {
    const [vistos, ver] = useVistos();
    const errs = validarAlumno(f.valores);
    const cCorreo = f.campo('correo_institucional');
    const correoValido = vistos.correo_institucional && !cCorreo.error && !errs.correo_institucional && cCorreo.value !== '';

    return (
        <Field
            label="Correo institucional"
            required
            hint="Escribe el correo completo que la universidad asignó al alumno."
            error={cCorreo.error}
            valid={Boolean(correoValido)}
            counter={contador(cCorreo.value, LIMITES.correo)}
            reserveError
            className="@md:col-span-2"
        >
            <Input
                {...cCorreo.props}
                onBlur={() => {
                    ver('correo_institucional');
                    cCorreo.onBlur();
                }}
                type="email"
                inputMode="email"
                maxLength={LIMITES.correo}
                transform={normalizarCorreo}
                autoComplete="off"
                spellCheck={false}
            />
        </Field>
    );
}
