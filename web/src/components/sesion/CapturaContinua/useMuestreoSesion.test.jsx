// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors.js';
import { enviarCaptura } from '@/lib/http/captura.js';
import useMuestreoSesion from './useMuestreoSesion.js';

vi.mock('@/lib/http/captura.js', () => ({ enviarCaptura: vi.fn() }));

const ok = { id_captura: 1, rostros: 2, validas: 1, no_atribuidas: 0, cambios: [] };
const base = { idSesion: 5, activo: true, intervaloSeg: 10, camaraNavegadorId: 2, camarasIp: [1], capturar: async () => new Blob(['x']) };

async function avanzar(ms) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
}

describe('useMuestreoSesion', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        enviarCaptura.mockReset();
    });
    afterEach(() => vi.useRealTimers());

    it('envia navegador (con imagen) e IP (sin imagen) y repite cada intervalo', async () => {
        enviarCaptura.mockResolvedValue(ok);
        const { result } = renderHook(() => useMuestreoSesion(base));
        await avanzar(1);
        expect(enviarCaptura).toHaveBeenCalledTimes(2);
        expect(enviarCaptura.mock.calls[0][0].imagen).toBeInstanceOf(Blob);
        expect(enviarCaptura.mock.calls[1][0]).toMatchObject({ idCamara: 1, imagen: null });
        expect(result.current.ultima.rostros).toBe(2);
        await avanzar(10000);
        expect(enviarCaptura).toHaveBeenCalledTimes(4);
    });

    it('no acumula envios: espera a que termine el anterior', async () => {
        let resolver;
        enviarCaptura.mockImplementation(() => new Promise((r) => { resolver = r; }));
        renderHook(() => useMuestreoSesion({ ...base, camarasIp: [] }));
        await avanzar(35000);
        expect(enviarCaptura).toHaveBeenCalledTimes(1);
        await act(async () => resolver(ok));
        await avanzar(10001);
        expect(enviarCaptura).toHaveBeenCalledTimes(2);
    });

    it('un 503 no detiene el bucle y marca servicioNoDisponible', async () => {
        enviarCaptura.mockRejectedValue(new ApiError({ code: 'SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE', message: 'caido', status: 503 }));
        const onError = vi.fn();
        const { result } = renderHook(() => useMuestreoSesion({ ...base, camarasIp: [], onError }));
        await avanzar(1);
        expect(result.current.servicioNoDisponible).toBe(true);
        await avanzar(10000);
        expect(enviarCaptura).toHaveBeenCalledTimes(2);
        expect(onError).not.toHaveBeenCalled();
    });

    it('un 409 de fin de muestreo detiene el bucle y avisa', async () => {
        enviarCaptura.mockRejectedValue(new ApiError({ code: 'FUERA_DE_VENTANA', message: 'fin', status: 409, details: { fin_muestreo: true } }));
        const onFin = vi.fn();
        const { result } = renderHook(() => useMuestreoSesion({ ...base, onFin }));
        await avanzar(1);
        await avanzar(60000);
        expect(onFin).toHaveBeenCalledTimes(1);
        expect(result.current.detenido).toBe('FUERA_DE_VENTANA');
        expect(enviarCaptura).toHaveBeenCalledTimes(1);
    });

    it('otros errores avisan y reintentan en el siguiente ciclo', async () => {
        enviarCaptura.mockRejectedValueOnce(new ApiError({ code: 'ERROR_INTERNO', message: 'x', status: 500 })).mockResolvedValue(ok);
        const onError = vi.fn();
        renderHook(() => useMuestreoSesion({ ...base, camarasIp: [], onError }));
        await avanzar(1);
        expect(onError).toHaveBeenCalledTimes(1);
        await avanzar(10000);
        expect(enviarCaptura).toHaveBeenCalledTimes(2);
    });

    it('limpia el temporizador al desmontar o desactivar', async () => {
        enviarCaptura.mockResolvedValue(ok);
        const { unmount } = renderHook(() => useMuestreoSesion({ ...base, camarasIp: [] }));
        await avanzar(1);
        unmount();
        await avanzar(60000);
        expect(enviarCaptura).toHaveBeenCalledTimes(1);
    });
});
