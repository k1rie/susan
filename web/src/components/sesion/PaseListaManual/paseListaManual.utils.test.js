import { describe, expect, it } from 'vitest';
import {
    completarRestantes,
    conteoMarcas,
    conteoPorEstado,
    contarCambios,
    filtrarAlumnos,
    marcasIniciales,
    primeroSinMarcar,
    registrosDeMarcas,
    textoMarcado,
} from './paseListaManual.utils.js';

const ALUMNOS = [
    { id_alumno: 1, nombre: 'Ana Pérez', matricula: 'E260001', estado: null },
    { id_alumno: 2, nombre: 'Beto Ruiz', matricula: 'E260002', estado: 'presente' },
    { id_alumno: 3, nombre: 'Carla Núñez', matricula: 'E260003', estado: 'pendiente' },
    { id_alumno: 4, nombre: 'Diego Peña', matricula: 'E260004', estado: 'ausente' },
];

describe('paseListaManual.utils', () => {
    it('cuenta los alumnos marcados y el avance', () => {
        const activos = [{ id_alumno: 1 }, { id_alumno: 2 }, { id_alumno: 3 }, { id_alumno: 4 }];
        expect(conteoMarcas(activos, { 1: 'presente', 2: '', 3: 'ausente' })).toEqual({ marcados: 2, total: 4, ancho: 50 });
    });
    it('sin alumnos o sin marcas no divide entre cero', () => {
        expect(conteoMarcas([], {})).toEqual({ marcados: 0, total: 0, ancho: 0 });
        expect(conteoMarcas(undefined, undefined)).toEqual({ marcados: 0, total: 0, ancho: 0 });
        expect(conteoMarcas([{ id_alumno: 1 }], undefined).marcados).toBe(0);
    });

    it('las marcas de partida son solo los estados editables que ya guardó el servidor', () => {
        expect(marcasIniciales(ALUMNOS)).toEqual({ 2: 'presente', 4: 'ausente' });
        expect(marcasIniciales(undefined)).toEqual({});
    });

    it('cuenta por estado y deja aparte a quien no tiene marca (un pendiente no es una marca)', () => {
        expect(conteoPorEstado(ALUMNOS, { 1: 'retardo', 2: 'presente', 4: 'ausente' })).toEqual({ presente: 1, retardo: 1, ausente: 1, sinMarcar: 1 });
        expect(conteoPorEstado([], {})).toEqual({ presente: 0, retardo: 0, ausente: 0, sinMarcar: 0 });
    });

    it('cuenta los cambios contra lo guardado: marcar, cambiar de estado y quitar una marca', () => {
        const guardadas = { 2: 'presente', 4: 'ausente' };
        expect(contarCambios(guardadas, guardadas)).toBe(0);
        expect(contarCambios({ ...guardadas, 1: 'retardo' }, guardadas)).toBe(1);
        expect(contarCambios({ 2: 'ausente', 4: 'ausente' }, guardadas)).toBe(1);
        expect(contarCambios({ 2: 'presente' }, guardadas)).toBe(1);
        // «vacío» y «sin clave» son lo mismo
        expect(contarCambios({ 1: '', 2: 'presente', 4: 'ausente' }, guardadas)).toBe(0);
        expect(contarCambios(undefined, undefined)).toBe(0);
    });

    it('«todos presentes» completa solo a los que no tienen marca y no pisa los demás', () => {
        const r = completarRestantes(ALUMNOS, { 4: 'ausente' }, 'presente');
        expect(r.afectados).toBe(3);
        expect(r.marcas).toEqual({ 1: 'presente', 2: 'presente', 3: 'presente', 4: 'ausente' });
        const otra = completarRestantes(ALUMNOS, r.marcas, 'presente');
        expect(otra.afectados).toBe(0);
    });

    it('redacta el resultado de una acción en bloque', () => {
        expect(textoMarcado(12, 'presente')).toBe('Se marcó a 12 alumnos como Presente.');
        expect(textoMarcado(1, 'retardo')).toBe('Se marcó a 1 alumno como Retardo.');
    });

    it('busca por nombre o matrícula, sin acentos, con todas las palabras', () => {
        expect(filtrarAlumnos(ALUMNOS, '').map((a) => a.id_alumno)).toEqual([1, 2, 3, 4]);
        expect(filtrarAlumnos(ALUMNOS, 'perez').map((a) => a.id_alumno)).toEqual([1]);
        expect(filtrarAlumnos(ALUMNOS, 'NUÑEZ carla').map((a) => a.id_alumno)).toEqual([3]);
        expect(filtrarAlumnos(ALUMNOS, 'e260004').map((a) => a.id_alumno)).toEqual([4]);
        expect(filtrarAlumnos(ALUMNOS, 'zzz')).toEqual([]);
        expect(filtrarAlumnos(undefined, 'a')).toEqual([]);
    });

    it('encuentra al primero sin marcar en el orden de la lista', () => {
        expect(primeroSinMarcar(ALUMNOS, { 1: 'presente' })?.id_alumno).toBe(2);
        expect(primeroSinMarcar(ALUMNOS, { 1: 'a', 2: 'a', 3: 'a', 4: 'a' })).toBeNull();
    });

    it('arma los registros del RPC solo con los alumnos que tienen estado', () => {
        expect(registrosDeMarcas({ 1: 'presente', 2: '', 3: 'ausente' })).toEqual([
            { id_alumno: 1, estado: 'presente' },
            { id_alumno: 3, estado: 'ausente' },
        ]);
        expect(registrosDeMarcas(undefined)).toEqual([]);
    });
});
