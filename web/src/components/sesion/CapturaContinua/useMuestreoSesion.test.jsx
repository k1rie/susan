// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTO_RELOJ_CAMBIO } from '@/hooks/data/eventos.js';
import { ApiError } from '@/lib/api/errors.js';
import { enviarCaptura } from '@/lib/http/captura.js';
import useMuestreoSesion, { esErrorDeReloj, esFinMuestreo, esLimiteDeCapturas, esServicioNoDisponible } from './useMuestreoSesion.js';

vi.mock('@/lib/http/captura.js', () => ({ enviarCaptura: vi.fn() }));

const ok = { id_captura: 1, rostros: 2, validas: 1, no_atribuidas: 0, cambios: [] };
const base = { idSesion: 5, activo: true, intervaloSeg: 10, camaraNavegadorId: 2, camarasIp: [1], capturar: async () => new Blob(['x']) };
const marcaFutura = () => new ApiError({ code: 'MARCA_FUTURA', message: 'La marca de tiempo de la captura está en el futuro.', status: 400 });

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

    it('NO manda la hora del equipo: la estampa el servidor con la hora de negocio', async () => {
        enviarCaptura.mockResolvedValue(ok);
        renderHook(() => useMuestreoSesion(base));
        await avanzar(1);
        for (const [args] of enviarCaptura.mock.calls) expect(args).not.toHaveProperty('marcaTiempo');
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

    it('si la ventana vuelve a abrirse tras un fin de muestreo, el aviso «detenido» se limpia al reanudar', async () => {
        enviarCaptura.mockRejectedValueOnce(new ApiError({ code: 'FUERA_DE_VENTANA', message: 'fin', status: 409, details: { fin_muestreo: true } })).mockResolvedValue(ok);
        const { result, rerender } = renderHook((p) => useMuestreoSesion({ ...base, camarasIp: [], activo: p.activo }), { initialProps: { activo: true } });
        await avanzar(1);
        expect(result.current.detenido).toBe('FUERA_DE_VENTANA');
        rerender({ activo: false }); // el monitor ya vio que la ventana terminó
        rerender({ activo: true }); // y el reloj volvió a un minuto dentro de ella
        await avanzar(1);
        expect(result.current.detenido).toBeNull();
        expect(result.current.ultima.rostros).toBe(2);
    });

    it('un envío en camino cuando el bucle se apaga no deja «enviando» encendido', async () => {
        enviarCaptura.mockImplementation(() => new Promise(() => {}));
        const { result, rerender } = renderHook((p) => useMuestreoSesion({ ...base, camarasIp: [], activo: p.activo }), { initialProps: { activo: true } });
        await avanzar(1);
        expect(result.current.enviando).toBe(true);
        rerender({ activo: false });
        expect(result.current.enviando).toBe(false);
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

    it('un error igual al anterior seguido no se avisa otra vez; uno distinto, o tras un éxito, sí', async () => {
        const e500 = () => new ApiError({ code: 'ERROR_INTERNO', message: 'x', status: 500 });
        enviarCaptura
            .mockRejectedValueOnce(e500())
            .mockRejectedValueOnce(e500())
            .mockRejectedValueOnce(new ApiError({ code: 'CAMARA_INACTIVA', message: 'y', status: 409 }))
            .mockResolvedValueOnce(ok)
            .mockRejectedValueOnce(e500());
        const onError = vi.fn();
        renderHook(() => useMuestreoSesion({ ...base, camarasIp: [], onError }));
        await avanzar(1); // 500: avisa
        await avanzar(10000); // 500 de nuevo: no se repite
        expect(onError).toHaveBeenCalledTimes(1);
        await avanzar(10000); // otro error: avisa
        expect(onError).toHaveBeenCalledTimes(2);
        await avanzar(10000); // éxito: limpia la racha
        await avanzar(10000); // 500 tras el éxito: avisa
        expect(onError).toHaveBeenCalledTimes(3);
    });

    it('MARCA_FUTURA: un solo aviso claro, sin reintento en bucle ni aviso repetido', async () => {
        enviarCaptura.mockRejectedValue(marcaFutura());
        const onError = vi.fn();
        const { result } = renderHook(() => useMuestreoSesion({ ...base, camarasIp: [1], onError }));
        await avanzar(1);
        expect(result.current.problemaReloj).toEqual({ code: 'MARCA_FUTURA', message: 'La marca de tiempo de la captura está en el futuro.' });
        // Se detuvo en la primera cámara: no se insiste con la IP ni en los ciclos siguientes.
        await avanzar(120000);
        expect(enviarCaptura).toHaveBeenCalledTimes(1);
        expect(onError).not.toHaveBeenCalled();
        expect(result.current.enviando).toBe(false);
        expect(result.current.detenido).toBeNull();
    });

    it('reanudar() limpia el aviso y vuelve a intentar; si sigue fallando, el aviso vuelve a salir una vez', async () => {
        enviarCaptura.mockRejectedValueOnce(marcaFutura()).mockResolvedValue(ok);
        const { result } = renderHook(() => useMuestreoSesion({ ...base, camarasIp: [] }));
        await avanzar(1);
        expect(result.current.problemaReloj).not.toBeNull();
        act(() => result.current.reanudar());
        await avanzar(1);
        expect(result.current.problemaReloj).toBeNull();
        expect(enviarCaptura).toHaveBeenCalledTimes(2);
        expect(result.current.ultima.rostros).toBe(2);
        await avanzar(10000);
        expect(enviarCaptura).toHaveBeenCalledTimes(3);
    });

    it('un cambio del reloj de demostración reintenta solo, y solo mientras hay un problema de hora', async () => {
        enviarCaptura.mockRejectedValueOnce(marcaFutura()).mockResolvedValue(ok);
        const { result } = renderHook(() => useMuestreoSesion({ ...base, camarasIp: [] }));
        // Sin problema, el evento no hace nada.
        act(() => { window.dispatchEvent(new CustomEvent(EVENTO_RELOJ_CAMBIO)); });
        await avanzar(1);
        expect(enviarCaptura).toHaveBeenCalledTimes(1);
        expect(result.current.problemaReloj).not.toBeNull();
        act(() => { window.dispatchEvent(new CustomEvent(EVENTO_RELOJ_CAMBIO)); });
        await avanzar(1);
        expect(enviarCaptura).toHaveBeenCalledTimes(2);
        expect(result.current.problemaReloj).toBeNull();
    });

    it('un 429 no avisa ni detiene: marca limitado y sigue en el siguiente ciclo', async () => {
        enviarCaptura.mockRejectedValueOnce(new ApiError({ code: 'DEMASIADOS_INTENTOS', message: 'espera', status: 429 })).mockResolvedValue(ok);
        const onError = vi.fn();
        const { result } = renderHook(() => useMuestreoSesion({ ...base, camarasIp: [], onError }));
        await avanzar(1);
        expect(result.current.limitado).toBe(true);
        expect(onError).not.toHaveBeenCalled();
        await avanzar(10000);
        expect(result.current.limitado).toBe(false);
        expect(enviarCaptura).toHaveBeenCalledTimes(2);
    });

    it('cuenta las capturas seguidas que el servidor ya tenía (reloj detenido) y la racha se corta con una nueva', async () => {
        enviarCaptura
            .mockResolvedValueOnce({ ...ok, ya_procesada: false })
            .mockResolvedValueOnce({ ...ok, ya_procesada: true })
            .mockResolvedValueOnce({ ...ok, ya_procesada: true })
            .mockResolvedValueOnce({ ...ok, ya_procesada: false });
        const { result } = renderHook(() => useMuestreoSesion({ ...base, camarasIp: [] }));
        await avanzar(1);
        expect(result.current.repetidas).toBe(0);
        await avanzar(10000);
        await avanzar(10000);
        expect(result.current.repetidas).toBe(2);
        await avanzar(10000);
        expect(result.current.repetidas).toBe(0);
    });

    it('si capturar() no devuelve fotograma, se omite el ciclo sin enviar ni fallar', async () => {
        const capturar = vi.fn().mockResolvedValueOnce(null).mockResolvedValue(new Blob(['x']));
        enviarCaptura.mockResolvedValue(ok);
        renderHook(() => useMuestreoSesion({ ...base, camarasIp: [], capturar }));
        await avanzar(1);
        expect(enviarCaptura).not.toHaveBeenCalled();
        await avanzar(10000);
        expect(enviarCaptura).toHaveBeenCalledTimes(1);
    });

    it('limpia el temporizador al desmontar o desactivar', async () => {
        enviarCaptura.mockResolvedValue(ok);
        const { unmount } = renderHook(() => useMuestreoSesion({ ...base, camarasIp: [] }));
        await avanzar(1);
        unmount();
        await avanzar(60000);
        expect(enviarCaptura).toHaveBeenCalledTimes(1);
    });

    it('con activo=false no muestrea', async () => {
        enviarCaptura.mockResolvedValue(ok);
        renderHook(() => useMuestreoSesion({ ...base, activo: false }));
        await avanzar(60000);
        expect(enviarCaptura).not.toHaveBeenCalled();
    });

    it('cambiar el intervalo (cámara simulada) reprograma el bucle con el nuevo ritmo', async () => {
        enviarCaptura.mockResolvedValue(ok);
        const { rerender } = renderHook((p) => useMuestreoSesion({ ...base, camarasIp: [], intervaloSeg: p.intervaloSeg }), { initialProps: { intervaloSeg: 60 } });
        await avanzar(1);
        expect(enviarCaptura).toHaveBeenCalledTimes(1);
        rerender({ intervaloSeg: 9 });
        await avanzar(1); // al cambiar el ritmo se toma una muestra enseguida
        expect(enviarCaptura).toHaveBeenCalledTimes(2);
        await avanzar(9000);
        expect(enviarCaptura).toHaveBeenCalledTimes(3);
    });
});

describe('clasificación de errores', () => {
    it('reconoce cada familia', () => {
        expect(esErrorDeReloj({ code: 'MARCA_FUTURA' })).toBe(true);
        expect(esErrorDeReloj({ code: 'RELOJ_NO_ACTIVO' })).toBe(true);
        expect(esErrorDeReloj({ code: 'ERROR_INTERNO' })).toBe(false);
        expect(esErrorDeReloj(null)).toBe(false);
        expect(esLimiteDeCapturas({ status: 429 })).toBe(true);
        expect(esLimiteDeCapturas({ code: 'DEMASIADOS_INTENTOS' })).toBe(true);
        expect(esLimiteDeCapturas({ status: 500 })).toBe(false);
        expect(esServicioNoDisponible({ status: 503 })).toBe(true);
        expect(esFinMuestreo({ status: 409, details: { fin_muestreo: true } })).toBe(true);
        expect(esFinMuestreo({ status: 409, code: 'FUERA_DE_VENTANA' })).toBe(true);
        expect(esFinMuestreo({ status: 400, code: 'FUERA_DE_VENTANA' })).toBe(false);
    });
});
