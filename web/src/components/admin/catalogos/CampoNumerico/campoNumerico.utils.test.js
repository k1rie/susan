import { describe, expect, it } from 'vitest';
import { limpiarDigitos, pasarValor } from './campoNumerico.utils.js';

describe('campo numérico', () => {
    it('limpia a dígitos y respeta el largo máximo', () => {
        expect(limpiarDigitos('  1 2a0 ')).toBe('120');
        expect(limpiarDigitos('123456', 4)).toBe('1234');
        expect(limpiarDigitos(null)).toBe('');
    });

    it('suma y resta dentro de los límites', () => {
        expect(pasarValor('10', 1, { min: 1, max: 20 })).toBe('11');
        expect(pasarValor('10', -1, { min: 1, max: 20 })).toBe('9');
        expect(pasarValor('20', 1, { min: 1, max: 20 })).toBe('20');
        expect(pasarValor('1', -1, { min: 1, max: 20 })).toBe('1');
    });

    it('un campo vacío arranca en el mínimo (o en el valor de inicio con «+»)', () => {
        expect(pasarValor('', 1, { min: 1, max: 20 })).toBe('1');
        expect(pasarValor('', -1, { min: 1, max: 20 })).toBe('1');
        expect(pasarValor('', 1, { min: 1, max: 1000, inicio: 30 })).toBe('30');
    });

    it('un valor por encima del máximo baja al máximo', () => {
        expect(pasarValor('500', -1, { min: 1, max: 20 })).toBe('20');
    });
});
