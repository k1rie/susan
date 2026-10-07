import { esCorreo, minusculas, recortar } from '@/lib/formularios';
import { campoDeError } from '../comun.js';
import { requiereVinculo } from './rolesUsuario.js';

export const normalizarCorreoUsuario = (v) => minusculas(recortar(v));

/** Opción de Combobox de un docente: nombre arriba; número de empleado y correo abajo. Lleva el correo para prellenar la cuenta. */
export const opcionDocente = (d) => ({
    value: String(d.id_docente),
    label: d.nombre_completo,
    description: [d.num_empleado, d.correo_institucional].filter(Boolean).join(' · '),
    avatar: d.nombre_completo,
    correo: d.correo_institucional ?? '',
});

/** Opción de Combobox de un alumno: nombre arriba; matrícula y correo abajo. */
export const opcionAlumno = (a) => ({
    value: String(a.id_alumno),
    label: a.nombre_completo,
    description: [a.matricula, a.correo_institucional].filter(Boolean).join(' · '),
    avatar: a.nombre_completo,
    correo: a.correo_institucional ?? '',
});

/** Valores iniciales de «crear cuenta» desde un docente recién creado (vínculo y correo ya puestos). */
export const inicialDeDocente = (d) => ({ rol: 'docente', vinculo: opcionDocente(d) });

const SUSTANTIVO = { docente: 'docente', alumno: 'alumno' };

/** Validación de conveniencia (la real es de la base y del servidor). */
export function validarUsuario(v) {
    const e = {};
    if (requiereVinculo(v.rol) && !v.vinculo) e.vinculo = `Elige el ${SUSTANTIVO[v.rol]} al que pertenece la cuenta.`;
    const correo = normalizarCorreoUsuario(v.correo);
    if (!correo) e.correo = 'Escribe el correo con el que iniciará sesión.';
    else if (!esCorreo(correo)) e.correo = 'Escribe un correo válido, por ejemplo ana.lopez@unach.mx.';
    return e;
}

/** Argumentos de `crearUsuario` (lib/http/admin). */
export const argumentosCrearUsuario = (v) => ({
    correo: normalizarCorreoUsuario(v.correo),
    rol: v.rol,
    idDocente: v.rol === 'docente' ? Number(v.vinculo) : undefined,
    idAlumno: v.rol === 'alumno' ? Number(v.vinculo) : undefined,
});

/** Errores del servidor que pertenecen a un campo: correo repetido o reservado, y vínculo repetido o inválido. */
export const errorDeCampoUsuario = (error) =>
    campoDeError(error, [
        { codigo: 'DUPLICADO', patron: /docente|alumno/i, campo: 'vinculo' },
        { codigo: 'DUPLICADO', campo: 'correo' },
        { codigo: 'CORREO_RESERVADO', campo: 'correo' },
        { codigo: 'ROL_VINCULO_INCOHERENTE', campo: 'vinculo' },
        { codigo: 'DOCENTE_NO_ACTIVO', campo: 'vinculo' },
        { codigo: 'ALUMNO_NO_ACTIVO', campo: 'vinculo' },
        { codigo: 'NO_ENCONTRADO', patron: /docente|alumno/i, campo: 'vinculo' },
        { codigo: 'VALIDACION', patron: /correo/i, campo: 'correo' },
    ]);
