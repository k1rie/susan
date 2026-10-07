// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebounce } from './useDebounce.js';

describe('useDebounce', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('devuelve el valor inicial al instante', () => {
        const { result } = renderHook(() => useDebounce('a', 300));
        expect(result.current).toBe('a');
    });

    it('solo actualiza cuando el valor deja de cambiar durante el retraso', () => {
        const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), { initialProps: { v: 'a' } });
        rerender({ v: 'ab' });
        act(() => vi.advanceTimersByTime(200));
        rerender({ v: 'abc' });
        act(() => vi.advanceTimersByTime(200));
        expect(result.current).toBe('a');
        act(() => vi.advanceTimersByTime(100));
        expect(result.current).toBe('abc');
    });

    it('usa 300 ms por omisión', () => {
        const { result, rerender } = renderHook(({ v }) => useDebounce(v), { initialProps: { v: 1 } });
        rerender({ v: 2 });
        act(() => vi.advanceTimersByTime(299));
        expect(result.current).toBe(1);
        act(() => vi.advanceTimersByTime(1));
        expect(result.current).toBe(2);
    });
});
