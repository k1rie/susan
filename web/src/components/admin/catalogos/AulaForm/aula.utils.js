import { campoDeError } from '../comun.js';
import { enteroEnRango, LIMITES, mayusculas, PATRONES, recortar } from '@/lib/formularios';

export const CAPACIDAD_MIN = 1;
// Tope de sensatez del cliente (la base admite hasta 32767): un aula de más de mil lugares casi siempre es un dedazo.
export const CAPACIDAD_MAX = 1000;
// Aula típica del plantel: el primer «+» en un campo vacío arranca aquí en lugar de en 1.
export const CAPACIDAD_SUGERIDA = 30;

export const INICIAL_AULA = { clave: '', edificio: '', capacidad: '' };

/** Valores del formulario a partir del registro (alta: vacío). Todo texto, como lo entregan los campos. */
export const aulaInicial = (item) =>
    item ? { clave: item.clave ?? '', edificio: item.edificio ?? '', capacidad: item.capacidad != null ? String(item.capacidad) : '' } : INICIAL_AULA;

export const normalizarClaveAula = (v) => mayusculas(recortar(v));
export const normalizarEdificio = (v) => recortar(v, { colapsar: true });

/** Validación de conveniencia (la real es de la base): clave de hasta 10 letras, dígitos o guiones; edificio; capacidad 1-1000. */
export function validarAula(v) {
    const e = {};
    const clave = normalizarClaveAula(v.clave);
    if (!clave) e.clave = 'Escribe la clave del aula, por ejemplo A-12.';
    else if (!PATRONES.aula_clave.test(clave)) e.clave = 'Usa hasta 10 letras, dígitos o guiones, por ejemplo A-12.';
    const edificio = normalizarEdificio(v.edificio);
    if (!edificio) e.edificio = 'Escribe el edificio, por ejemplo Edificio A.';
    else if (edificio.length > LIMITES.aula_edificio) e.edificio = `El edificio admite máximo ${LIMITES.aula_edificio} caracteres.`;
    if (!enteroEnRango(v.capacidad, CAPACIDAD_MIN, CAPACIDAD_MAX)) e.capacidad = `Escribe la capacidad: un número entero de ${CAPACIDAD_MIN} a ${CAPACIDAD_MAX}.`;
    return e;
}

/** Carga útil de api_aula_guardar (en edición lleva el id; el servidor pasa la clave a mayúsculas, aquí ya va normalizada). */
export const datosAula = (v, item) => ({
    ...(item ? { id_aula: item.id_aula } : {}),
    clave: normalizarClaveAula(v.clave),
    edificio: normalizarEdificio(v.edificio),
    capacidad: Number(v.capacidad),
});

/** Errores del servidor que pertenecen a un campo (el resto va al aviso del formulario). */
export const errorDeCampoAula = (error) =>
    campoDeError(error, [
        { codigo: 'DUPLICADO', campo: 'clave' },
        { codigo: 'AULA_CAPACIDAD_INSUFICIENTE', campo: 'capacidad' },
        { codigo: 'VALIDACION', patron: /clave/i, campo: 'clave' },
        { codigo: 'VALIDACION', patron: /edificio/i, campo: 'edificio' },
        { codigo: 'VALIDACION', patron: /capacidad/i, campo: 'capacidad' },
    ]);
