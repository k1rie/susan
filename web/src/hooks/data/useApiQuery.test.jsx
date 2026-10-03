// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors.js';
import { useApiQuery } from './useApiQuery.js';

const diferido = () => {
    let resolver; let rechazar;
    const promesa = new Promise((res, rej) => { resolver = res; rechazar = rej; });
    return { promesa, resolver, rechazar };
};

afterEach(() => vi.useRealTimers());

describe('useApiQuery', () => {
    it('loading -> data', async () => {
        const fn = vi.fn().mockResolvedValue({ total: 1 });
        const { result } = renderHook(() => useApiQuery(fn, { idGrupo: 1 }));
        expect(result.current).toMatchObject({ loading: true, data: null, error: null });
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.data).toEqual({ total: 1 });
        expect(fn).toHaveBeenCalledWith({ idGrupo: 1 });
    });

    it('expone el error como ApiError', async () => {
        const fn = vi.fn().mockRejectedValue(new ApiError({ code: 'NO_ENCONTRADO', message: 'x', status: 404 }));
        const { result } = renderHook(() => useApiQuery(fn, {}));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toMatchObject({ code: 'NO_ENCONTRADO' });
        expect(result.current.data).toBeNull();
    });

    it('no vuelve a pedir si los args tienen el mismo contenido', async () => {
        const fn = vi.fn().mockResolvedValue(1);
        const { rerender } = renderHook(({ a }) => useApiQuery(fn, a), { initialProps: { a: { x: 1 } } });
        await waitFor(() => expect(fn).toHaveBeenCalledTimes(1));
        rerender({ a: { x: 1 } });
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('refetch repite el pedido', async () => {
        const fn = vi.fn().mockResolvedValueOnce('a').mockResolvedValueOnce('b');
        const { result } = renderHook(() => useApiQuery(fn, {}));
        await waitFor(() => expect(result.current.data).toBe('a'));
        let r;
        await act(async () => { r = await result.current.refetch(); });
        expect(r).toEqual({ ok: true, data: 'b' });
        expect(result.current.data).toBe('b');
    });

    it('ignora una respuesta obsoleta al cambiar los args', async () => {
        const a = diferido(); const b = diferido();
        const fn = vi.fn((args) => (args.id === 1 ? a.promesa : b.promesa));
        const { result, rerender } = renderHook(({ id }) => useApiQuery(fn, { id }), { initialProps: { id: 1 } });
        rerender({ id: 2 });
        await act(async () => { b.resolver('segunda'); });
        await act(async () => { a.resolver('primera'); });
        await waitFor(() => expect(result.current.data).toBe('segunda'));
        expect(result.current.loading).toBe(false);
    });

    it('no actualiza tras desmontar', async () => {
        const d = diferido();
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { unmount } = renderHook(() => useApiQuery(() => d.promesa, {}));
        unmount();
        await act(async () => { d.resolver(1); });
        expect(spy).not.toHaveBeenCalled();
    });

    it('enabled=false no pide y no queda cargando', () => {
        const fn = vi.fn();
        const { result } = renderHook(() => useApiQuery(fn, {}, { enabled: false }));
        expect(fn).not.toHaveBeenCalled();
        expect(result.current).toMatchObject({ loading: false, data: null });
    });

    it('initialData se muestra sin cargando y se revalida', async () => {
        const fn = vi.fn().mockResolvedValue('nuevo');
        const { result } = renderHook(() => useApiQuery(fn, {}, { initialData: 'inicial' }));
        expect(result.current).toMatchObject({ loading: false, data: 'inicial' });
        await waitFor(() => expect(result.current.data).toBe('nuevo'));
    });

    it('StrictMode no duplica el pedido', async () => {
        const fn = vi.fn().mockResolvedValue('ok');
        const { result } = renderHook(() => useApiQuery(fn, { a: 1 }), { wrapper: StrictMode });
        await waitFor(() => expect(result.current.data).toBe('ok'));
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('sondeo con timers falsos, sin solapar y deteniéndose al desmontar', async () => {
        vi.useFakeTimers();
        const fn = vi.fn().mockResolvedValue('v');
        const { unmount } = renderHook(() => useApiQuery(fn, {}, { refetchInterval: 1000 }));
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
        expect(fn).toHaveBeenCalledTimes(1);
        await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
        expect(fn).toHaveBeenCalledTimes(2);
        await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
        expect(fn).toHaveBeenCalledTimes(3);
        unmount();
        await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
        expect(fn).toHaveBeenCalledTimes(3);
    });
});
