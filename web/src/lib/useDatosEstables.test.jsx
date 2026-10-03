// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import useDatosEstables from './useDatosEstables.js';

describe('useDatosEstables', () => {
    it('conserva la referencia mientras el contenido no cambia y la renueva cuando cambia', () => {
        const { result, rerender } = renderHook(({ d }) => useDatosEstables(d), { initialProps: { d: [{ clave: 'a', valor: 1 }] } });
        const primera = result.current;
        rerender({ d: [{ clave: 'a', valor: 1 }] });
        expect(result.current).toBe(primera);
        rerender({ d: [{ clave: 'a', valor: 2 }] });
        expect(result.current).not.toBe(primera);
        expect(result.current[0].valor).toBe(2);
    });
    it('tolera null y undefined', () => {
        const { result } = renderHook(() => useDatosEstables(undefined));
        expect(result.current).toBeNull();
    });
});
