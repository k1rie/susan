import { describe, expect, it } from 'vitest';
import { partirLista } from './panelDocente.utils.js';

describe('panelDocente.utils', () => {
    it('parte la lista en visibles y resto', () => {
        expect(partirLista([1, 2, 3, 4], 2)).toEqual({ visibles: [1, 2], resto: [3, 4] });
        expect(partirLista([1], 5)).toEqual({ visibles: [1], resto: [] });
    });
    it('tolera listas vacías, nulas y topes inválidos', () => {
        expect(partirLista([], 3)).toEqual({ visibles: [], resto: [] });
        expect(partirLista(undefined, 3)).toEqual({ visibles: [], resto: [] });
        expect(partirLista([1, 2], 0)).toEqual({ visibles: [], resto: [1, 2] });
        expect(partirLista([1, 2], 'x')).toEqual({ visibles: [], resto: [1, 2] });
    });
});
