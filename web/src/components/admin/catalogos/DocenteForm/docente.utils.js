import { esCorreo, minusculas, PATRONES, recortar } from '@/lib/formularios';
import { campoDeError, mensajeDeError, normalizarCodigo, textoONulo } from '../comun.js';

export const ESTATUS_DOCENTE = [
    { value: 'activo', label: 'Activo' },
    { value: 'licencia', label: 'Licencia' },
    { value: 'baja', label: 'Baja' },
];
export const etiquetaEstatusDocente = (e) => ESTATUS_DOCENTE.find((x) => x.value === e)?.label ?? e ?? '';

// El alta NO lleva estatus (el docente nace activo); el estatus solo se elige al editar y se aplica con su propia RPC.
export const INICIAL_DOCENTE = {
    num_empleado: '',
    correo_institucional: '',
    apellido_paterno: '',
    apellido_materno: '',
    nombres: '',
    estatus: 'activo',
};

export const docenteInicial = (item) =>
    item
        ? {
              num_empleado: item.num_empleado ?? '',
              correo_institucional: item.correo_institucional ?? '',
              apellido_paterno: item.apellido_paterno ?? '',
              apellido_materno: item.apellido_materno ?? '',
              nombres: item.nombres ?? '',
              estatus: item.estatus ?? 'activo',
          }
        : INICIAL_DOCENTE;

export const normalizarNumEmpleado = normalizarCodigo;
export const normalizarCorreo = (v) => minusculas(recortar(v));
export const normalizarNombre = (v) => recortar(v, { colapsar: true });

/** Validación de conveniencia (la real es de la base). */
export function validarDocente(v) {
    const e = {};
    const num = normalizarNumEmpleado(v.num_empleado);
    if (!num) e.num_empleado = 'Escribe el número de empleado, por ejemplo D001.';
    else if (!PATRONES.num_empleado.test(num)) e.num_empleado = 'Usa hasta 10 letras o dígitos, por ejemplo D001.';
    if (!normalizarCorreo(v.correo_institucional)) e.correo_institucional = 'Escribe el correo institucional, por ejemplo ana.lopez@unach.mx.';
    else if (!esCorreo(v.correo_institucional)) e.correo_institucional = 'Escribe un correo válido, por ejemplo ana.lopez@unach.mx.';
    if (!normalizarNombre(v.apellido_paterno)) e.apellido_paterno = 'Escribe el apellido paterno.';
    if (!normalizarNombre(v.nombres)) e.nombres = 'Escribe el nombre o los nombres.';
    return e;
}

/** Carga útil de api_docente_guardar. No lleva estatus: el alta nace activo y el cambio va por api_docente_cambiar_estatus. */
export const datosDocente = (v, item) => ({
    ...(item ? { id_docente: item.id_docente } : {}),
    num_empleado: normalizarNumEmpleado(v.num_empleado),
    apellido_paterno: normalizarNombre(v.apellido_paterno),
    apellido_materno: textoONulo(normalizarNombre(v.apellido_materno)),
    nombres: normalizarNombre(v.nombres),
    correo_institucional: normalizarCorreo(v.correo_institucional),
});

/**
 * Los datos ya se guardaron y falló el cambio de estatus (p. ej. DOCENTE_CON_GRUPOS). Es un error de campo (Estatus) y lleva
 * `guardadoParcial` para que el formulario tome los datos como guardados; reintentar es seguro porque la edición lleva el id
 * (no crea un duplicado). El mensaje lo dice con claridad: lo guardado, lo que falló y por qué.
 */
export class EstatusNoCambiado extends Error {
    constructor(causa, parcial) {
        super(`Los datos se guardaron, pero el estatus no cambió: ${mensajeDeError(causa)}`);
        this.name = 'EstatusNoCambiado';
        this.code = causa?.code;
        this.guardadoParcial = parcial;
    }
}

/** Errores del servidor que pertenecen a un campo. El «DUPLICADO» del servidor distingue número de empleado y correo por su texto. */
export const errorDeCampoDocente = (error) => {
    if (error instanceof EstatusNoCambiado) return { estatus: error.message };
    return campoDeError(error, [
        // La carrera entre dos altas devuelve un texto que nombra ambos datos: se pega al número de empleado (el primero).
        { codigo: 'DUPLICADO', patron: /n[úu]mero de empleado/i, campo: 'num_empleado' },
        { codigo: 'DUPLICADO', patron: /correo/i, campo: 'correo_institucional' },
        { codigo: 'DUPLICADO', campo: 'num_empleado' },
        { codigo: 'VALIDACION', patron: /n[úu]mero de empleado/i, campo: 'num_empleado' },
        { codigo: 'VALIDACION', patron: /apellido paterno/i, campo: 'apellido_paterno' },
        { codigo: 'VALIDACION', patron: /apellido materno/i, campo: 'apellido_materno' },
        { codigo: 'VALIDACION', patron: /nombres/i, campo: 'nombres' },
        { codigo: 'VALIDACION', patron: /correo/i, campo: 'correo_institucional' },
    ]);
};
