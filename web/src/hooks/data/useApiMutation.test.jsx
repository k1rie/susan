// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors.js';
import { useApiMutation } from './useApiMutation.js';

describe('useApiMutation', () => {
    it('run devuelve el resultado y maneja loading', async () => {
        const fn = vi.fn().mockResolvedValue({ id: 1 });
        const { result } = renderHook(() => useApiMutation(fn));
        let r;
        await act(async () => { r = await result.current.run({ a: 1 }); });
        expect(r).toEqual({ id: 1 });
        expect(fn).toHaveBeenCalledWith({ a: 1 });
        expect(result.current).toMatchObject({ loading: false, error: null, data: { id: 1 } });
    });

    it('run lanza y guarda el error; reset lo limpia', async () => {
        const fn = vi.fn().mockRejectedValue(new ApiError({ code: 'DUPLICADO', message: 'dup', status: 409 }));
        const { result } = renderHook(() => useApiMutation(fn));
        await act(async () => { await expect(result.current.run({})).rejects.toMatchObject({ code: 'DUPLICADO' }); });
        expect(result.current.error).toMatchObject({ code: 'DUPLICADO' });
        act(() => result.current.reset());
        expect(result.current.error).toBeNull();
    });

    it('una segunda llamada en curso devuelve la misma promesa', async () => {
        let resolver;
        const fn = vi.fn(() => new Promise((r) => { resolver = r; }));
        const { result } = renderHook(() => useApiMutation(fn));
        let p1; let p2;
        act(() => { p1 = result.current.run({}); p2 = result.current.run({}); });
        expect(p1).toBe(p2);
        expect(fn).toHaveBeenCalledTimes(1);
        await act(async () => { resolver('ok'); await p1; });
    });
});
