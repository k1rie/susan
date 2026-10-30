import { LIMITES, PATRONES } from '@/lib/formularios/limites.js';
import { esCorreo, mayusculas, minusculas, recortar, soloAlfanumerico } from '@/lib/formularios/texto.js';

// Estatus del alumno (api_alumno_cambiar_estatus) con su texto en la interfaz.
export const ESTATUS_ALUMNO = [
    { value: 'activo', label: 'Activo' },
    { value: 'baja_temporal', label: 'Baja temporal' },
    { value: 'baja_definitiva', label: 'Baja definitiva' },
    { value: 'egresado', label: 'Egresado' },
];

export const etiquetaEstatus = (estatus) => ESTATUS_ALUMNO.find((e) => e.value === estatus)?.label ?? estatus ?? '';

export const VALORES_INICIALES = {
    matricula: '',
    apellido_paterno: '',
    apellido_materno: '',
    nombres: '',
    correo_institucional: '',
    estatus: 'activo',
};

// Normalizaciones de captura. Se aplican al SALIR del campo (Input `transform`) y otra vez al armar el payload, porque quien
// envía con Enter sin haber salido del campo no pasó por el blur. El servidor hace lo mismo (upper en matrícula, lower en correo).
export const normalizarMatricula = (valor) => mayusculas(soloAlfanumerico(valor));
export const normalizarNombre = (valor) => recortar(valor, { colapsar: true });
export const normalizarCorreo = (valor) => minusculas(recortar(valor));

/** Convierte la ficha del servidor en valores de formulario (sin nulos). */
export function valoresDeAlumno(alumno) {
    if (!alumno) return { ...VALORES_INICIALES };
    return {
        matricula: alumno.matricula ?? '',
        apellido_paterno: alumno.apellido_paterno ?? '',
        apellido_materno: alumno.apellido_materno ?? '',
        nombres: alumno.nombres ?? '',
        correo_institucional: alumno.correo_institucional ?? '',
        estatus: alumno.estatus ?? 'activo',
    };
}

/** Validación de conveniencia (la real es de la base). Devuelve { campo: mensaje }. */
export function validarAlumno(v) {
    const e = {};
    const matricula = mayusculas(recortar(v.matricula));
    if (!matricula) e.matricula = 'La matrícula es obligatoria.';
    else if (matricula.length > LIMITES.matricula) e.matricula = `La matrícula admite hasta ${LIMITES.matricula} caracteres.`;
    else if (!PATRONES.matricula.test(matricula)) e.matricula = 'Usa solo letras y dígitos, sin espacios ni guiones.';

    const paterno = recortar(v.apellido_paterno);
    if (!paterno) e.apellido_paterno = 'El apellido paterno es obligatorio.';
    else if (paterno.length > LIMITES.apellidos) e.apellido_paterno = `El apellido paterno admite hasta ${LIMITES.apellidos} caracteres.`;

    if (recortar(v.apellido_materno).length > LIMITES.apellidos) e.apellido_materno = `El apellido materno admite hasta ${LIMITES.apellidos} caracteres.`;

    const nombres = recortar(v.nombres);
    if (!nombres) e.nombres = 'El nombre es obligatorio.';
    else if (nombres.length > LIMITES.nombres) e.nombres = `El nombre admite hasta ${LIMITES.nombres} caracteres.`;

    const correo = recortar(v.correo_institucional);
    if (!correo) e.correo_institucional = 'El correo institucional es obligatorio.';
    else if (!esCorreo(correo)) e.correo_institucional = 'Escribe un correo válido, con la forma nombre@dominio.';
    return e;
}

/** Payload de api_alumno_guardar: apellidos y nombres siempre por separado y ya normalizados. */
export function datosAlumno(v, idAlumno) {
    return {
        ...(idAlumno ? { id_alumno: idAlumno } : {}),
        matricula: mayusculas(recortar(v.matricula)),
        apellido_paterno: normalizarNombre(v.apellido_paterno),
        apellido_materno: normalizarNombre(v.apellido_materno) || null,
        nombres: normalizarNombre(v.nombres),
        correo_institucional: normalizarCorreo(v.correo_institucional),
    };
}

/** true si los datos personales del formulario difieren de la ficha (el estatus se compara aparte). */
export function hayCambiosDeDatos(valores, alumno) {
    if (!alumno) return true;
    const nuevo = datosAlumno(valores);
    const actual = datosAlumno(valoresDeAlumno(alumno));
    return Object.keys(nuevo).some((clave) => nuevo[clave] !== actual[clave]);
}

/** Nombre completo para mostrar (apellidos primero, como en las listas oficiales). */
export function nombreCompleto(v) {
    return [normalizarNombre(v.apellido_paterno), normalizarNombre(v.apellido_materno), normalizarNombre(v.nombres)].filter(Boolean).join(' ');
}

// Campo del formulario al que apunta un mensaje de la RPC (el texto lo redactó la función SQL, ver 0201_admin_catalogos.sql).
const CAMPO_POR_TEXTO = [
    [/apellido paterno/i, 'apellido_paterno'],
    [/apellido materno/i, 'apellido_materno'],
    [/nombres?\b/i, 'nombres'],
    [/correo/i, 'correo_institucional'],
    [/matr[ií]cula/i, 'matricula'],
];

/**
 * Pega el error del servidor al campo que lo causó (`useFormulario.mapearError`): DUPLICADO a la matrícula o al correo y
 * VALIDACION al campo que nombra el mensaje. Devuelve null si el error es general (se muestra junto a los botones).
 */
export function mapearErrorAlumno(error) {
    const mensaje = String(error?.message ?? '');
    if (error?.code === 'DUPLICADO') {
        const correo = /correo/i.test(mensaje);
        const matricula = /matr[ií]cula/i.test(mensaje);
        if (correo && matricula) return { matricula: 'Esta matrícula o este correo ya están registrados.' };
        if (correo) return { correo_institucional: 'Ya existe un alumno con este correo institucional.' };
        return { matricula: 'Esta matrícula ya está registrada.' };
    }
    if (error?.code === 'VALIDACION') {
        const campo = CAMPO_POR_TEXTO.find(([patron]) => patron.test(mensaje))?.[1];
        if (campo) return { [campo]: mensaje };
    }
    return null;
}
