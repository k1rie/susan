import { describe, expect, it } from 'vitest';
import { datosDocente, docenteInicial, errorDeCampoDocente, EstatusNoCambiado, normalizarNumEmpleado, validarDocente } from './docente.utils.js';

const valido = { num_empleado: 'D001', correo_institucional: 'ana.lopez@unach.mx', apellido_paterno: 'López', apellido_materno: '', nombres: 'Ana', estatus: 'activo' };

describe('validación de docente', () => {
    it('acepta un docente con apellido materno vacío', () => {
        expect(validarDocente(valido)).toEqual({});
    });

    it('exige número de empleado alfanumérico de hasta 10', () => {
        expect(validarDocente({ ...valido, num_empleado: '' }).num_empleado).toMatch(/Escribe el número/);
        expect(validarDocente({ ...valido, num_empleado: 'D12345678901' }).num_empleado).toMatch(/hasta 10/);
        // Guiones y espacios se quitan al normalizar, así que «d-001» es válido y se envía como D001.
        expect(normalizarNumEmpleado(' d-001 ')).toBe('D001');
        expect(validarDocente({ ...valido, num_empleado: 'd-001' }).num_empleado).toBeUndefined();
    });

    it('exige correo con forma de correo y dice cómo debe verse', () => {
        expect(validarDocente({ ...valido, correo_institucional: '' }).correo_institucional).toMatch(/Escribe el correo/);
        expect(validarDocente({ ...valido, correo_institucional: 'ana@' }).correo_institucional).toMatch(/correo válido, por ejemplo/);
        expect(validarDocente({ ...valido, correo_institucional: ' ANA@UNACH.MX ' }).correo_institucional).toBeUndefined();
    });

    it('exige apellido paterno y nombres', () => {
        const e = validarDocente({ ...valido, apellido_paterno: ' ', nombres: '' });
        expect(e.apellido_paterno).toBeDefined();
        expect(e.nombres).toBeDefined();
    });
});

describe('datos de docente', () => {
    it('normaliza, manda null en el apellido materno vacío y NUNCA lleva estatus', () => {
        const datos = datosDocente({ ...valido, num_empleado: 'd-001', correo_institucional: ' ANA@UNACH.MX ', nombres: '  Ana   María ' });
        expect(datos).toEqual({
            num_empleado: 'D001',
            apellido_paterno: 'López',
            apellido_materno: null,
            nombres: 'Ana María',
            correo_institucional: 'ana@unach.mx',
        });
        expect('estatus' in datos).toBe(false);
        expect(datosDocente(valido, { id_docente: 7 }).id_docente).toBe(7);
    });

    it('el alta nace activo', () => {
        expect(docenteInicial(null).estatus).toBe('activo');
        expect(docenteInicial({ num_empleado: 'D1', estatus: 'licencia' }).estatus).toBe('licencia');
    });
});

describe('errores del servidor de docente', () => {
    it('distingue el número de empleado del correo repetido', () => {
        expect(errorDeCampoDocente({ code: 'DUPLICADO', message: 'Ya existe un docente con el número de empleado D001.' })).toEqual({
            num_empleado: 'Ya existe un docente con el número de empleado D001.',
        });
        expect(errorDeCampoDocente({ code: 'DUPLICADO', message: 'Ya existe un docente con ese correo institucional.' })).toEqual({
            correo_institucional: 'Ya existe un docente con ese correo institucional.',
        });
        // La carrera entre dos altas nombra ambos datos: va al número de empleado.
        expect(errorDeCampoDocente({ code: 'DUPLICADO', message: 'El número de empleado o el correo institucional ya existen.' })).toHaveProperty('num_empleado');
    });

    it('un cambio de estatus rechazado se dice junto al estatus y aclara que los datos sí se guardaron', () => {
        const error = new EstatusNoCambiado({ code: 'DOCENTE_CON_GRUPOS', message: 'Tiene sesiones por impartir.' }, { registro: {}, valores: {} });
        expect(error.message).toBe('Los datos se guardaron, pero el estatus no cambió: Tiene sesiones por impartir.');
        expect(error.code).toBe('DOCENTE_CON_GRUPOS');
        expect(errorDeCampoDocente(error)).toEqual({ estatus: error.message });
    });
});
