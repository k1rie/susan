import { enteroEnRango, LIMITES, PATRONES, recortar } from '@/lib/formularios';
import { campoDeError, normalizarCodigo } from '../comun.js';

// Rangos de conveniencia del cliente. La base exige créditos > 0 (ck_materia_creditos) y horas por semana de 1 a 20;
// el tope de 99 créditos es de sensatez (la columna admite más).
export const CREDITOS_MIN = 1;
export const CREDITOS_MAX = 99;
export const HORAS_MIN = 1;
export const HORAS_MAX = 20;

export const INICIAL_MATERIA = { clave: '', nombre: '', creditos: '', horas_semana: '' };

export const materiaInicial = (item) =>
    item
        ? {
              clave: item.clave ?? '',
              nombre: item.nombre ?? '',
              creditos: item.creditos != null ? String(item.creditos) : '',
              horas_semana: item.horas_semana != null ? String(item.horas_semana) : '',
          }
        : INICIAL_MATERIA;

/** Clave en mayúsculas y solo letras y dígitos (el servidor la guarda en mayúsculas y no admite guiones ni espacios). */
export const normalizarClaveMateria = normalizarCodigo;
export const normalizarNombreMateria = (v) => recortar(v, { colapsar: true });

/** Validación de conveniencia (la real es de la base): clave de hasta 8 letras o dígitos, nombre, créditos > 0 y horas 1-20. */
export function validarMateria(v) {
    const e = {};
    const clave = normalizarClaveMateria(v.clave);
    if (!clave) e.clave = 'Escribe la clave de la materia, por ejemplo ADM101.';
    else if (!PATRONES.materia_clave.test(clave)) e.clave = 'Usa hasta 8 letras o dígitos, por ejemplo ADM101.';
    const nombre = normalizarNombreMateria(v.nombre);
    if (!nombre) e.nombre = 'Escribe el nombre de la materia, por ejemplo Administración I.';
    else if (nombre.length > LIMITES.materia_nombre) e.nombre = `El nombre admite máximo ${LIMITES.materia_nombre} caracteres.`;
    if (!enteroEnRango(v.creditos, CREDITOS_MIN, CREDITOS_MAX)) e.creditos = `Escribe los créditos: un número entero de ${CREDITOS_MIN} a ${CREDITOS_MAX} (no puede ser 0).`;
    if (!enteroEnRango(v.horas_semana, HORAS_MIN, HORAS_MAX)) e.horas_semana = `Las horas por semana deben ser un número entero de ${HORAS_MIN} a ${HORAS_MAX}.`;
    return e;
}

/** Carga útil de api_materia_guardar. */
export const datosMateria = (v, item) => ({
    ...(item ? { id_materia: item.id_materia } : {}),
    clave: normalizarClaveMateria(v.clave),
    nombre: normalizarNombreMateria(v.nombre),
    creditos: Number(v.creditos),
    horas_semana: Number(v.horas_semana),
});

export const errorDeCampoMateria = (error) =>
    campoDeError(error, [
        { codigo: 'DUPLICADO', campo: 'clave' },
        { codigo: 'VALIDACION', patron: /clave/i, campo: 'clave' },
        { codigo: 'VALIDACION', patron: /nombre/i, campo: 'nombre' },
        { codigo: 'VALIDACION', patron: /cr[ée]ditos/i, campo: 'creditos' },
        { codigo: 'VALIDACION', patron: /horas/i, campo: 'horas_semana' },
    ]);
