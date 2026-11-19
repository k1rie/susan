// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ahoraApi = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/plataforma.js', () => ({ ahora: (...a) => ahoraApi(...a) }));

import { ApiError } from '@/lib/api/errors.js';
import { useAhoraNegocio } from './useAhoraNegocio.js';

beforeEach(() => {
    ahoraApi.mockReset();
});

describe('useAhoraNegocio', () => {
    it('empieza sin fecha (no adivina) y luego usa la del plantel con la hora en HH:MM', async () => {
        ahoraApi.mockResolvedValue({ fecha: '2026-09-14', hora: '07:12:30', zona: 'America/Mexico_City', reloj_simulado: true });
        const { result } = renderHook(() => useAhoraNegocio());
        expect(result.current).toEqual({ ahora: null, hoy: null, listo: false });
        await waitFor(() => expect(result.current.listo).toBe(true));
        expect(result.current.ahora).toEqual({ fecha: '2026-09-14', hora: '07:12' });
        expect(result.current.hoy).toBe('2026-09-14');
    });

    it('si la consulta falla cae al reloj del navegador para que la pantalla siga siendo usable', async () => {
        ahoraApi.mockRejectedValue(new ApiError({ code: 'ERROR_RED', message: 'sin red', status: 503 }));
        const { result } = renderHook(() => useAhoraNegocio());
        await waitFor(() => expect(result.current.listo).toBe(true));
        expect(result.current.hoy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(result.current.ahora.hora).toMatch(/^\d{2}:\d{2}$/);
    });
});
