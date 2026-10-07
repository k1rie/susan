import { FileSignature, KeyRound, ScanFace, UsersRound } from 'lucide-react';
import { mayusculas, recortar } from '@/lib/formularios/texto.js';
import { normalizarCorreo, normalizarMatricula, normalizarNombre, validarAlumno } from '../AlumnoForm/alumnoForm.utils.js';

// Pasos del alta: Identidad -> Contacto y acceso -> Revisión (la pone el Asistente).
export const CAMPOS_POR_PASO = {
    identidad: ['matricula', 'apellido_paterno', 'apellido_materno', 'nombres'],
    contacto: ['correo_institucional'],
};

// El alta no pide estatus (el alumno nace activo): `crearCuenta` solo decide si, después de crearlo, se genera su cuenta de acceso.
export const VALORES_ALTA = {
    matricula: '',
    apellido_paterno: '',
    apellido_materno: '',
    nombres: '',
    correo_institucional: '',
    crearCuenta: false,
};

/** Paso al que pertenece un campo (para volver a él cuando el servidor rechaza ese dato). */
export function pasoDeCampo(campo) {
    return Object.keys(CAMPOS_POR_PASO).find((paso) => CAMPOS_POR_PASO[paso].includes(campo)) ?? 'identidad';
}

/** Validación del alta: la del alumno más «ya existe» si la comprobación remota encontró esa matrícula (`duplicada` = el alumno hallado). */
export function validarAlta(valores, duplicada) {
    const errores = validarAlumno(valores);
    if (!errores.matricula && duplicada && mayusculas(recortar(valores.matricula)) === duplicada.matricula) {
        errores.matricula = 'Esta matrícula ya está registrada.';
    }
    return errores;
}

/** Secciones de la revisión (y del resumen vivo): cada una vuelve a su paso con «Editar». */
export function resumenAlta(v) {
    return [
        {
            id: 'identidad',
            titulo: 'Identidad',
            paso: 'identidad',
            filas: [
                { etiqueta: 'Matrícula', valor: normalizarMatricula(v.matricula) },
                { etiqueta: 'Nombres', valor: normalizarNombre(v.nombres) },
                { etiqueta: 'Apellido paterno', valor: normalizarNombre(v.apellido_paterno) },
                { etiqueta: 'Apellido materno', valor: normalizarNombre(v.apellido_materno) },
            ],
        },
        {
            id: 'contacto',
            titulo: 'Contacto y acceso',
            paso: 'contacto',
            filas: [
                { etiqueta: 'Correo institucional', valor: normalizarCorreo(v.correo_institucional) },
                { etiqueta: 'Cuenta de acceso', valor: v.crearCuenta ? 'Se creará con una contraseña temporal' : 'Más tarde, desde su ficha' },
            ],
        },
    ];
}

/**
 * Siguientes pasos de la pantalla de éxito (SuccessState). Títulos de hasta 25 y descripciones de hasta 30 caracteres a propósito: la
 * tarjeta los trunca en una sola línea y a 360 px no caben más.
 *   alumno       lo que devolvió api_alumno_guardar
 *   cuenta       { correo } si la cuenta ya existe; errorCuenta: texto si falló al crearla
 *   onCrearCuenta  se llama desde el paso «Crear su cuenta» (o su reintento)
 */
export function pasosDeExito({ alumno, cuenta, errorCuenta, onCrearCuenta }) {
    const ficha = `/admin/alumnos/${alumno.id_alumno}`;
    const pasos = [
        {
            id: 'consentimiento',
            label: 'Registrar consentimiento',
            description: 'Lo pide la plantilla facial',
            href: `${ficha}#consentimiento`,
            icon: FileSignature,
            recommended: true,
        },
        {
            id: 'plantilla',
            label: 'Tomar plantilla facial',
            description: 'Para reconocerlo con cámara',
            href: `${ficha}#plantilla`,
            icon: ScanFace,
        },
        {
            id: 'grupo',
            label: 'Inscribirlo en un grupo',
            description: 'Búscalo por su matrícula',
            href: '/admin/grupos',
            icon: UsersRound,
        },
    ];
    if (cuenta) {
        pasos.push({ id: 'cuenta', label: 'Cuenta de acceso creada', description: cuenta.correo, done: true });
    } else {
        pasos.push({
            id: 'cuenta',
            label: errorCuenta ? 'Reintentar la cuenta' : 'Crear su cuenta de acceso',
            description: errorCuenta ? 'Falló; inténtalo otra vez' : 'Para que vea su asistencia',
            onClick: onCrearCuenta,
            icon: KeyRound,
        });
    }
    return pasos;
}

/** Texto de la pantalla de éxito. */
export function descripcionDeExito(alumno, cuenta) {
    return `${alumno.nombre_completo ?? alumno.matricula} (${alumno.matricula}) ya está activo${cuenta ? ' y tiene su cuenta de acceso' : ''}.`;
}
