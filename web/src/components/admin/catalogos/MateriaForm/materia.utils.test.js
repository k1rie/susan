import { describe, expect, it } from 'vitest';
import { datosMateria, errorDeCampoMateria, INICIAL_MATERIA, materiaInicial, normalizarClaveMateria, validarMateria } from './materia.utils.js';

const valida = { clave: 'ADM101', nombre: 'Administración I', creditos: '8', horas_semana: '4' };

describe('validación de materia', () => {
    it('acepta una materia completa', () => {
        expect(validarMateria(valida)).toEqual({});
    });

    it('los créditos deben ser mayores que 0 (la base exige creditos > 0)', () => {
        expect(validarMateria({ ...valida, creditos: '0' }).creditos).toMatch(/no puede ser 0/);
        expect(validarMateria({ ...valida, creditos: '1' }).creditos).toBeUndefined();
        expect(validarMateria({ ...valida, creditos: '99' }).creditos).toBeUndefined();
        expect(validarMateria({ ...valida, creditos: '100' }).creditos).toBeDefined();
        expect(validarMateria({ ...valida, creditos: '' }).creditos).toBeDefined();
        expect(validarMateria({ ...valida, creditos: '2.5' }).creditos).toBeDefined();
    });

    it('las horas por semana van de 1 a 20', () => {
        expect(validarMateria({ ...valida, horas_semana: '0' }).horas_semana).toBeDefined();
        expect(validarMateria({ ...valida, horas_semana: '1' }).horas_semana).toBeUndefined();
        expect(validarMateria({ ...valida, horas_semana: '20' }).horas_semana).toBeUndefined();
        expect(validarMateria({ ...valida, horas_semana: '21' }).horas_semana).toBeDefined();
    });

    it('la clave son hasta 8 letras o dígitos, en mayúsculas y sin acentos ni guiones', () => {
        expect(normalizarClaveMateria(' adm-101 ')).toBe('ADM101');
        expect(validarMateria({ ...valida, clave: '' }).clave).toMatch(/Escribe la clave/);
        expect(validarMateria({ ...valida, clave: 'ABCDEFGHI' }).clave).toMatch(/hasta 8/);
        expect(validarMateria({ ...valida, clave: 'adm-101' }).clave).toBeUndefined();
    });

    it('el nombre es obligatorio y admite 80 caracteres', () => {
        expect(validarMateria({ ...valida, nombre: '   ' }).nombre).toMatch(/Escribe el nombre/);
        expect(validarMateria({ ...valida, nombre: 'x'.repeat(81) }).nombre).toMatch(/80/);
        expect(validarMateria({ ...valida, nombre: 'x'.repeat(80) }).nombre).toBeUndefined();
    });
});

describe('datos de materia', () => {
    it('arma la carga útil normalizada, con el id solo al editar', () => {
        expect(datosMateria({ clave: ' adm 101', nombre: '  Administración   I ', creditos: '8', horas_semana: '4' })).toEqual({
            clave: 'ADM101',
            nombre: 'Administración I',
            creditos: 8,
            horas_semana: 4,
        });
        expect(datosMateria(valida, { id_materia: 3 }).id_materia).toBe(3);
    });

    it('parte vacío en el alta y de lo guardado en la edición', () => {
        expect(materiaInicial(null)).toEqual(INICIAL_MATERIA);
        expect(materiaInicial({ clave: 'ADM101', nombre: 'Adm', creditos: 8, horas_semana: 4 })).toEqual({ clave: 'ADM101', nombre: 'Adm', creditos: '8', horas_semana: '4' });
    });

    it('pega al campo los errores del servidor', () => {
        expect(errorDeCampoMateria({ code: 'DUPLICADO', message: 'Ya existe una materia con la clave ADM101.' })).toEqual({ clave: 'Ya existe una materia con la clave ADM101.' });
        expect(errorDeCampoMateria({ code: 'VALIDACION', message: 'Los créditos deben ser un entero positivo.' })).toEqual({ creditos: 'Los créditos deben ser un entero positivo.' });
        expect(errorDeCampoMateria({ code: 'ERROR_RED', message: 'Sin red' })).toBeNull();
    });
});
