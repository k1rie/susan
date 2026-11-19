'use client';

import Combobox from '@/components/ui/Combobox';
import Field from '@/components/ui/Field';
import { alumnosListar, docentesListar } from '@/lib/api/admin.js';
import { opcionAlumno, opcionDocente } from './usuario.utils.js';

const MAX_RESULTADOS = 20;

// Búsqueda remota: el servidor filtra por `q` (número de empleado, matrícula o nombre), así que el selector no carga 200 filas de golpe.
const cargarDocentes = async (q) => {
    const r = await docentesListar({ q: q || undefined, estatus: 'activo', limit: MAX_RESULTADOS });
    return (r?.items ?? []).map(opcionDocente);
};
const cargarAlumnos = async (q) => {
    const r = await alumnosListar({ q, estatus: 'activo', limit: MAX_RESULTADOS });
    return (r?.items ?? []).map(opcionAlumno);
};

/**
 * Elige el docente o alumno al que se vincula una cuenta (solo para los roles docente y alumno; para los demás no pinta nada).
 * Es un Combobox con búsqueda remota y opciones de dos líneas (nombre arriba; clave y correo abajo). `onChange(valor, opcion)`
 * entrega la opción completa: lleva el correo institucional, con el que el formulario prellena el de la cuenta.
 *   value      id elegido como texto ('' = ninguno).
 *   selected   { value, label } de lo ya elegido al abrir el formulario (p. ej. el docente recién creado).
 */
export default function VinculoSelect({ rol, value, selected, onChange, error, ...rest }) {
    if (rol !== 'docente' && rol !== 'alumno') return null;
    const esDocente = rol === 'docente';

    return (
        <Field
            label={esDocente ? 'Docente vinculado' : 'Alumno vinculado'}
            required
            error={error}
            hint={esDocente ? 'Solo docentes activos. La cuenta se enlaza a su ficha.' : 'Solo alumnos activos. La cuenta se enlaza a su ficha.'}
            reserveError
        >
            <Combobox
                // Un Combobox por rol: al cambiar de docente a alumno no debe heredar la búsqueda ni lo cargado.
                key={rol}
                value={value ?? ''}
                selected={selected}
                onChange={onChange}
                loadOptions={esDocente ? cargarDocentes : cargarAlumnos}
                loadKey={rol}
                // Con pocos docentes conviene ver la lista al abrir; los alumnos son muchos y exigen escribir.
                minChars={esDocente ? 0 : 2}
                placeholder={esDocente ? 'Busca por nombre o número de empleado' : 'Busca por matrícula o nombre'}
                hintText="Escribe al menos 2 caracteres de la matrícula o del nombre."
                emptyText={esDocente ? 'Ningún docente activo coincide.' : 'Ningún alumno activo coincide.'}
                clearable
                {...rest}
            />
        </Field>
    );
}
