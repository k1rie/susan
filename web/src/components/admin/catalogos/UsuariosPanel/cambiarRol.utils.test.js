import { describe, expect, it } from 'vitest';
import { argumentosCambiarRol, avisoDeVinculo, errorDeCampoCambiarRol, validarCambioRol } from './cambiarRol.utils.js';

const fila = { id_usuario: 3, correo: 'docente1@susan.local', rol: 'docente', vinculo: 'D0001', nombre: 'Ortega Salinas Patricia' };

describe('cambiar rol', () => {
    it('exige un rol distinto del actual y el vínculo del rol nuevo', () => {
        expect(validarCambioRol({ rol: 'docente', vinculo: '' }, fila).rol).toMatch(/distinto del actual/);
        expect(validarCambioRol({ rol: 'alumno', vinculo: '' }, fila).vinculo).toMatch(/Elige el alumno/);
        expect(validarCambioRol({ rol: 'alumno', vinculo: '5' }, fila)).toEqual({});
        expect(validarCambioRol({ rol: 'tecnico', vinculo: '' }, fila)).toEqual({});
    });

    it('manda solo el vínculo que corresponde al rol nuevo', () => {
        expect(argumentosCambiarRol({ rol: 'alumno', vinculo: '5' })).toEqual({ rol: 'alumno', id_alumno: 5 });
        expect(argumentosCambiarRol({ rol: 'docente', vinculo: '2' })).toEqual({ rol: 'docente', id_docente: 2 });
        expect(argumentosCambiarRol({ rol: 'administrador', vinculo: '' })).toEqual({ rol: 'administrador' });
    });

    it('avisa qué pasa con el vínculo actual antes de guardar', () => {
        expect(avisoDeVinculo(fila, 'alumno')).toMatch(/se reemplazará por el nuevo/);
        expect(avisoDeVinculo(fila, 'tecnico')).toMatch(/se quitará ese vínculo/);
        expect(avisoDeVinculo(fila, 'tecnico')).toContain('Ortega Salinas Patricia (D0001)');
        expect(avisoDeVinculo(fila, 'docente')).toBeNull();
        expect(avisoDeVinculo({ ...fila, vinculo: null }, 'tecnico')).toBeNull();
    });

    it('pega al vínculo los errores de coherencia del servidor', () => {
        expect(errorDeCampoCambiarRol({ code: 'ROL_VINCULO_INCOHERENTE', message: 'El rol alumno requiere id_alumno.' })).toHaveProperty('vinculo');
        expect(errorDeCampoCambiarRol({ code: 'USUARIO_PROPIO', message: 'No puedes quitarte el rol.' })).toBeNull();
    });
});
