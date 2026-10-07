import { describe, expect, it } from 'vitest';
import {
    datosAlumno, hayCambiosDeDatos, mapearErrorAlumno, nombreCompleto, normalizarCorreo, normalizarMatricula, normalizarNombre,
    validarAlumno, VALORES_INICIALES, valoresDeAlumno,
} from './alumnoForm.utils.js';

const valido = { ...VALORES_INICIALES, matricula: 'E260099', apellido_paterno: 'Soto', nombres: 'Carla', correo_institucional: 'e260099@dominio.mx' };

describe('normalizaciones de captura', () => {
    it('matrícula: mayúsculas y solo letras y dígitos', () => {
        expect(normalizarMatricula(' e26-00 99 ')).toBe('E260099');
        expect(normalizarMatricula('a001')).toBe('A001');
    });
    it('nombres: sin espacios sobrantes (extremos e interior)', () => {
        expect(normalizarNombre('  Ana   María ')).toBe('Ana María');
        expect(normalizarNombre('')).toBe('');
    });
    it('correo: sin espacios y en minúsculas', () => {
        expect(normalizarCorreo('  Ana@Dominio.MX ')).toBe('ana@dominio.mx');
    });
});

describe('validarAlumno', () => {
    it('un alumno completo no tiene errores', () => {
        expect(validarAlumno(valido)).toEqual({});
    });

    it('matrícula: vacía, con símbolos o demasiado larga', () => {
        expect(validarAlumno({ ...valido, matricula: '  ' }).matricula).toMatch(/obligatoria/);
        expect(validarAlumno({ ...valido, matricula: 'E26-0099' }).matricula).toMatch(/letras y dígitos/);
        expect(validarAlumno({ ...valido, matricula: 'E2600999999' }).matricula).toMatch(/hasta 10/);
        // la minúscula no es error: el servidor y el campo la pasan a mayúsculas
        expect(validarAlumno({ ...valido, matricula: 'e260099' }).matricula).toBeUndefined();
    });

    it('límites reales de la base en apellidos y nombres', () => {
        expect(validarAlumno({ ...valido, apellido_paterno: 'x'.repeat(41) }).apellido_paterno).toMatch(/hasta 40/);
        expect(validarAlumno({ ...valido, apellido_materno: 'x'.repeat(41) }).apellido_materno).toMatch(/hasta 40/);
        expect(validarAlumno({ ...valido, nombres: 'x'.repeat(61) }).nombres).toMatch(/hasta 60/);
        expect(validarAlumno({ ...valido, apellido_paterno: 'x'.repeat(40), nombres: 'x'.repeat(60) })).toEqual({});
    });

    it('correo: formato y largo, sin inventar ningún dominio', () => {
        expect(validarAlumno({ ...valido, correo_institucional: '' }).correo_institucional).toMatch(/obligatorio/);
        expect(validarAlumno({ ...valido, correo_institucional: 'sin-arroba' }).correo_institucional).toMatch(/válido/);
        expect(validarAlumno({ ...valido, correo_institucional: `${'a'.repeat(116)}@x.mx` }).correo_institucional).toMatch(/válido/);
        expect(validarAlumno({ ...valido, correo_institucional: 'cualquiera@otro.dominio' })).toEqual({});
    });
});

describe('datosAlumno y cambios', () => {
    it('arma el payload normalizado y el apellido materno vacío va como null', () => {
        const d = datosAlumno({ ...valido, matricula: ' e260099 ', apellido_paterno: '  De   la Cruz ', correo_institucional: 'E260099@Dominio.MX ' }, 7);
        expect(d).toEqual({
            id_alumno: 7, matricula: 'E260099', apellido_paterno: 'De la Cruz', apellido_materno: null, nombres: 'Carla', correo_institucional: 'e260099@dominio.mx',
        });
        expect(datosAlumno(valido).id_alumno).toBeUndefined();
    });

    it('hayCambiosDeDatos compara ya normalizado y no cuenta el estatus', () => {
        const ficha = { id_alumno: 1, matricula: 'E260099', apellido_paterno: 'Soto', apellido_materno: null, nombres: 'Carla', correo_institucional: 'e260099@dominio.mx', estatus: 'activo' };
        expect(hayCambiosDeDatos(valoresDeAlumno(ficha), ficha)).toBe(false);
        expect(hayCambiosDeDatos({ ...valoresDeAlumno(ficha), nombres: '  Carla  ', matricula: 'e260099' }, ficha)).toBe(false);
        expect(hayCambiosDeDatos({ ...valoresDeAlumno(ficha), estatus: 'baja_temporal' }, ficha)).toBe(false);
        expect(hayCambiosDeDatos({ ...valoresDeAlumno(ficha), nombres: 'Carlota' }, ficha)).toBe(true);
        expect(hayCambiosDeDatos(valido, null)).toBe(true);
    });

    it('nombreCompleto pone los apellidos primero', () => {
        expect(nombreCompleto({ apellido_paterno: 'Soto', apellido_materno: '', nombres: 'Carla  María' })).toBe('Soto Carla María');
    });
});

describe('mapearErrorAlumno', () => {
    const err = (code, message) => ({ code, message });
    it('DUPLICADO: matrícula, correo o ambos', () => {
        expect(mapearErrorAlumno(err('DUPLICADO', 'Ya existe un alumno con la matrícula E1.'))).toEqual({ matricula: 'Esta matrícula ya está registrada.' });
        expect(mapearErrorAlumno(err('DUPLICADO', 'Ya existe un alumno con ese correo institucional.'))).toEqual({ correo_institucional: 'Ya existe un alumno con este correo institucional.' });
        expect(Object.keys(mapearErrorAlumno(err('DUPLICADO', 'La matrícula o el correo institucional ya existen.')))).toEqual(['matricula']);
    });

    it('VALIDACION se pega al campo que nombra el mensaje (los redactó la RPC)', () => {
        expect(Object.keys(mapearErrorAlumno(err('VALIDACION', 'La matrícula es obligatoria: hasta 10 letras o dígitos.')))).toEqual(['matricula']);
        expect(Object.keys(mapearErrorAlumno(err('VALIDACION', 'El apellido paterno es obligatorio (máximo 40 caracteres).')))).toEqual(['apellido_paterno']);
        expect(Object.keys(mapearErrorAlumno(err('VALIDACION', 'El apellido materno admite máximo 40 caracteres.')))).toEqual(['apellido_materno']);
        expect(Object.keys(mapearErrorAlumno(err('VALIDACION', 'Los nombres son obligatorios (máximo 60 caracteres).')))).toEqual(['nombres']);
        expect(Object.keys(mapearErrorAlumno(err('VALIDACION', 'El correo institucional no es válido.')))).toEqual(['correo_institucional']);
    });

    it('lo demás es un error general (null)', () => {
        expect(mapearErrorAlumno(err('NO_AUTORIZADO', 'No tienes permiso.'))).toBeNull();
        expect(mapearErrorAlumno(err('VALIDACION', 'Algo raro.'))).toBeNull();
        expect(mapearErrorAlumno(null)).toBeNull();
    });
});
