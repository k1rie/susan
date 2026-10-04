import { describe, expect, it } from 'vitest';
import { ordinalesDeLista } from './listas.js';

describe('ordinalesDeLista', () => {
    it('expande rangos y valores sueltos, sin repetir y en orden', () => {
        expect(ordinalesDeLista('1-3,5', 24)).toEqual([1, 2, 3, 5]);
        expect(ordinalesDeLista('20, 3-4 ,3', 24)).toEqual([3, 4, 20]);
        expect(ordinalesDeLista('7', 24)).toEqual([7]);
    });

    it('acepta el grupo completo', () => {
        expect(ordinalesDeLista('1-24', 24)).toHaveLength(24);
    });

    it('rechaza formatos inválidos', () => {
        for (const malo of ['', 'a', '1-', '-3', '1,,2', '3-1', '1.5']) {
            expect(() => ordinalesDeLista(malo, 24), malo).toThrow(RangeError);
        }
    });

    it('rechaza ordinales fuera de 1..maximo', () => {
        expect(() => ordinalesDeLista('0', 24)).toThrow(RangeError);
        expect(() => ordinalesDeLista('25', 24)).toThrow(RangeError);
        expect(() => ordinalesDeLista('20-30', 24)).toThrow(/entre 1 y 24/);
    });
});
