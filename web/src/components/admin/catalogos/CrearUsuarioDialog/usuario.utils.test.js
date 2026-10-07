import { describe, expect, it } from 'vitest';
import { argumentosCrearUsuario, errorDeCampoUsuario, inicialDeDocente, opcionAlumno, opcionDocente, validarUsuario } from './usuario.utils.js';

describe('opciones de vínculo', () => {
    it('un docente se ve con nombre arriba y número de empleado y correo debajo, y lleva su correo', () => {
        const o = opcionDocente({ id_docente: 4, num_empleado: 'D004', nombre_completo: 'Mena Soto Rosa', correo_institucional: 'rosa@unach.mx' });
        expect(o).toMatchObject({ value: '4', label: 'Mena Soto Rosa', description: 'D004 · rosa@unach.mx', correo: 'rosa@unach.mx' });
    });

    it('un alumno se ve con matrícula y correo', () => {
        const o = opcionAlumno({ id_alumno: 9, matricula: 'E260009', nombre_completo: 'Ramos Diaz Beatriz', correo_institucional: 'e260009@unach.mx' });
        expect(o).toMatchObject({ value: '9', description: 'E260009 · e260009@unach.mx', correo: 'e260009@unach.mx' });
    });

    it('«crear cuenta» desde un docente recién creado arranca con su vínculo y su correo', () => {
        const inicial = inicialDeDocente({ id_docente: 8, num_empleado: 'D008', nombre_completo: 'López Ruiz Ana', correo_institucional: 'ana@unach.mx' });
        expect(inicial.rol).toBe('docente');
        expect(inicial.vinculo).toMatchObject({ value: '8', correo: 'ana@unach.mx' });
    });
});

describe('validación de la cuenta', () => {
    it('docente y alumno exigen vínculo; administrador y técnico no', () => {
        expect(validarUsuario({ rol: 'docente', vinculo: '', correo: 'a@b.mx' }).vinculo).toMatch(/Elige el docente/);
        expect(validarUsuario({ rol: 'alumno', vinculo: '', correo: 'a@b.mx' }).vinculo).toMatch(/Elige el alumno/);
        expect(validarUsuario({ rol: 'administrador', vinculo: '', correo: 'a@b.mx' })).toEqual({});
        expect(validarUsuario({ rol: 'tecnico', vinculo: '', correo: 'a@b.mx' })).toEqual({});
    });

    it('el correo es obligatorio y debe ser válido', () => {
        expect(validarUsuario({ rol: 'tecnico', vinculo: '', correo: '' }).correo).toMatch(/Escribe el correo/);
        expect(validarUsuario({ rol: 'tecnico', vinculo: '', correo: 'sin-arroba' }).correo).toMatch(/correo válido/);
    });
});

describe('argumentos y errores', () => {
    it('manda el vínculo que corresponde al rol, en número, y el correo normalizado', () => {
        expect(argumentosCrearUsuario({ rol: 'docente', vinculo: '8', correo: ' ANA@UNACH.MX ' })).toEqual({ correo: 'ana@unach.mx', rol: 'docente', idDocente: 8, idAlumno: undefined });
        expect(argumentosCrearUsuario({ rol: 'alumno', vinculo: '9', correo: 'a@b.mx' })).toMatchObject({ idDocente: undefined, idAlumno: 9 });
        expect(argumentosCrearUsuario({ rol: 'tecnico', vinculo: '', correo: 'a@b.mx' })).toMatchObject({ idDocente: undefined, idAlumno: undefined });
    });

    it('pega al campo correcto el correo repetido y el vínculo que ya tiene cuenta', () => {
        expect(errorDeCampoUsuario({ code: 'DUPLICADO', message: 'Ya existe una cuenta con ese correo.' })).toEqual({ correo: 'Ya existe una cuenta con ese correo.' });
        expect(errorDeCampoUsuario({ code: 'DUPLICADO', message: 'Ese docente ya tiene una cuenta.' })).toEqual({ vinculo: 'Ese docente ya tiene una cuenta.' });
        expect(errorDeCampoUsuario({ code: 'CORREO_RESERVADO', message: 'La cuenta de servicio del sistema está reservada.' })).toHaveProperty('correo');
        expect(errorDeCampoUsuario({ code: 'DOCENTE_NO_ACTIVO', message: 'No se crea cuenta para un docente dado de baja.' })).toHaveProperty('vinculo');
        expect(errorDeCampoUsuario({ code: 'ERROR_RED', message: 'Sin red' })).toBeNull();
    });
});
