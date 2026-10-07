import { describe, expect, it } from 'vitest';
import { reglasContrasena, validarContrasena } from '@/components/auth/CambiarContrasenaForm/contrasena.utils.js';
import { aleatorioSeguro, evaluarReglas, generarContrasena, LONGITUD_MINIMA_GENERADA, REGLAS_PREDETERMINADAS } from './campoPassword.utils.js';

describe('reglas', () => {
    it('evaluarReglas devuelve id, texto y si cumple', () => {
        expect(evaluarReglas(REGLAS_PREDETERMINADAS, 'abc').map((r) => [r.id, r.cumple])).toEqual([
            ['largo', false],
            ['letra', true],
            ['numero', false],
        ]);
        expect(evaluarReglas(REGLAS_PREDETERMINADAS, undefined).every((r) => !r.cumple)).toBe(true);
    });

    // Guarda contra deriva: la política real vive en auth/. Si cambia allá, esta copia debe cambiar con ella.
    it('coincide con la política real de auth/ (mismo texto y mismo veredicto)', () => {
        const real = reglasContrasena('abcdefghij1').filter((r) => r.id !== 'coincide');
        expect(REGLAS_PREDETERMINADAS.map((r) => [r.id, r.texto])).toEqual(real.map((r) => [r.id, r.texto]));
        for (const clave of ['', 'abc', 'abcdefghijk', '1234567890', 'abcdefghij1', 'ñandú12345', 'Ab1']) {
            const mia = evaluarReglas(REGLAS_PREDETERMINADAS, clave).every((r) => r.cumple);
            const valida = Object.keys(validarContrasena(clave, clave)).length === 0;
            expect(mia, `CampoPassword se desalineó de validarContrasena con «${clave}»`).toBe(valida);
        }
    });
});

describe('generarContrasena', () => {
    it('cumple siempre la política y trae las cuatro clases', () => {
        for (let i = 0; i < 50; i += 1) {
            const clave = generarContrasena(16);
            expect(clave).toHaveLength(16);
            expect(/[A-Z]/.test(clave) && /[a-z]/.test(clave) && /\d/.test(clave) && /[!@#$%&*+=?-]/.test(clave)).toBe(true);
            expect(evaluarReglas(REGLAS_PREDETERMINADAS, clave).every((r) => r.cumple)).toBe(true);
        }
    });

    it('en modo legible no usa caracteres ambiguos', () => {
        for (let i = 0; i < 100; i += 1) expect(generarContrasena(24)).not.toMatch(/[0OoIl1]/);
    });

    it('el largo mínimo es 12 aunque se pida menos', () => {
        expect(generarContrasena(4)).toHaveLength(LONGITUD_MINIMA_GENERADA);
    });

    it('legible: false admite todos los caracteres', () => {
        let visto = false;
        for (let i = 0; i < 400 && !visto; i += 1) visto = /[0OoIl1]/.test(generarContrasena(40, { legible: false }));
        expect(visto).toBe(true);
    });

    it('usa el generador inyectado (determinista en pruebas)', () => {
        const a = generarContrasena(12, { aleatorio: () => 0 });
        const b = generarContrasena(12, { aleatorio: () => 0 });
        expect(a).toBe(b);
        expect(a).toHaveLength(12);
    });

    it('aleatorioSeguro queda en el rango y reparte', () => {
        const vistos = new Set();
        for (let i = 0; i < 500; i += 1) {
            const n = aleatorioSeguro(7);
            expect(n).toBeGreaterThanOrEqual(0);
            expect(n).toBeLessThan(7);
            vistos.add(n);
        }
        expect(vistos.size).toBe(7);
    });
});
