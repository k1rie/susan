// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { alNavegarProtegido, confirmarNavegacion, hayCambiosSinGuardar, MENSAJE_CAMBIOS, useCambiosSinGuardar } from './useCambiosSinGuardar.js';

function disparar() {
    const evento = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(evento);
    return evento;
}

describe('useCambiosSinGuardar', () => {
    it('sin cambios no frena beforeunload ni pregunta', () => {
        const confirmar = vi.spyOn(window, 'confirm');
        const { result } = renderHook(() => useCambiosSinGuardar(false));
        expect(disparar().defaultPrevented).toBe(false);
        expect(result.current.confirmarSalida()).toBe(true);
        expect(confirmar).not.toHaveBeenCalled();
        expect(hayCambiosSinGuardar()).toBe(false);
    });

    it('con cambios frena beforeunload y lo retira al quedar limpio o desmontar', () => {
        const { rerender, unmount } = renderHook(({ s }) => useCambiosSinGuardar(s), { initialProps: { s: true } });
        expect(disparar().defaultPrevented).toBe(true);
        expect(hayCambiosSinGuardar()).toBe(true);
        rerender({ s: false });
        expect(disparar().defaultPrevented).toBe(false);
        expect(hayCambiosSinGuardar()).toBe(false);
        rerender({ s: true });
        expect(hayCambiosSinGuardar()).toBe(true);
        unmount();
        expect(disparar().defaultPrevented).toBe(false);
        expect(hayCambiosSinGuardar()).toBe(false);
    });

    it('confirmarSalida respeta la respuesta de la persona y acepta un texto propio', () => {
        const confirmar = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
        const { result } = renderHook(() => useCambiosSinGuardar(true));
        expect(result.current.confirmarSalida()).toBe(false);
        expect(confirmar).toHaveBeenLastCalledWith(MENSAJE_CAMBIOS);
        expect(result.current.confirmarSalida('Otro texto')).toBe(true);
        expect(confirmar).toHaveBeenLastCalledWith('Otro texto');
    });

    it('alNavegar cancela la navegación de Link (onNavigate) si la persona se queda', () => {
        vi.spyOn(window, 'confirm').mockReturnValue(false);
        const { result } = renderHook(() => useCambiosSinGuardar(true));
        const evento = { preventDefault: vi.fn() };
        result.current.alNavegar(evento);
        expect(evento.preventDefault).toHaveBeenCalledTimes(1);
    });

    it('alNavegar deja pasar si la persona confirma', () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        const { result } = renderHook(() => useCambiosSinGuardar(true));
        const evento = { preventDefault: vi.fn() };
        result.current.alNavegar(evento);
        expect(evento.preventDefault).not.toHaveBeenCalled();
    });

    it('el registro global sirve a enlaces ajenos al formulario (riel lateral)', () => {
        const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
        expect(confirmarNavegacion()).toBe(true);
        const { unmount } = renderHook(() => useCambiosSinGuardar(true));
        const evento = { preventDefault: vi.fn() };
        alNavegarProtegido(evento);
        expect(confirmar).toHaveBeenCalledWith(MENSAJE_CAMBIOS);
        expect(evento.preventDefault).toHaveBeenCalled();
        unmount();
        expect(confirmarNavegacion()).toBe(true);
    });
});
