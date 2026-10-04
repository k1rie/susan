// @vitest-environment jsdom
import { act, render, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DURACION, EASE, salidaCubica, useEnVista, usePrefersReducedMotion } from './index.js';

function simularMatchMedia(coincide) {
    const oyentes = new Set();
    const mq = { matches: coincide, addEventListener: (_, f) => oyentes.add(f), removeEventListener: (_, f) => oyentes.delete(f) };
    vi.stubGlobal('matchMedia', () => mq);
    return { cambiar(valor) { mq.matches = valor; oyentes.forEach((f) => f()); } };
}

class ObservadorFalso {
    static instancias = [];
    constructor(cb) { this.cb = cb; this.desconectado = false; ObservadorFalso.instancias.push(this); }
    observe() {}
    disconnect() { this.desconectado = true; }
    emitir(esVisible) { this.cb([{ isIntersecting: esVisible }]); }
    // Varias entradas en un solo aviso (la tarea de notificación se retrasó): la última es el estado actual.
    emitirVarias(...estados) { this.cb(estados.map((isIntersecting) => ({ isIntersecting }))); }
}

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    ObservadorFalso.instancias = [];
});

describe('easing', () => {
    it('salidaCubica va de 0 a 1, es creciente y se recorta fuera de rango', () => {
        expect(salidaCubica(0)).toBe(0);
        expect(salidaCubica(1)).toBe(1);
        expect(salidaCubica(0.5)).toBeGreaterThan(0.5);
        expect(salidaCubica(-3)).toBe(0);
        expect(salidaCubica(7)).toBe(1);
    });
    it('expone curvas y duraciones', () => {
        expect(EASE.salida).toMatch(/^cubic-bezier\(/);
        expect(DURACION.rapida).toBeLessThan(DURACION.lenta);
    });
});

describe('usePrefersReducedMotion', () => {
    it('refleja la preferencia y reacciona a cambios', () => {
        const mm = simularMatchMedia(true);
        const { result } = renderHook(() => usePrefersReducedMotion());
        expect(result.current).toBe(true);
        act(() => mm.cambiar(false));
        expect(result.current).toBe(false);
    });
    it('sin matchMedia devuelve false', () => {
        vi.stubGlobal('matchMedia', undefined);
        const { result } = renderHook(() => usePrefersReducedMotion());
        expect(result.current).toBe(false);
    });
    it('con un matchMedia antiguo (solo addListener/removeListener) también reacciona y se desuscribe', () => {
        const oyentes = new Set();
        const mq = { matches: true, addListener: (f) => oyentes.add(f), removeListener: (f) => oyentes.delete(f) };
        vi.stubGlobal('matchMedia', () => mq);
        const { result, unmount } = renderHook(() => usePrefersReducedMotion());
        expect(result.current).toBe(true);
        expect(oyentes.size).toBe(1);
        act(() => { mq.matches = false; oyentes.forEach((f) => f()); });
        expect(result.current).toBe(false);
        unmount();
        expect(oyentes.size).toBe(0);
    });
    it('con un matchMedia sin ningún método de suscripción no falla', () => {
        vi.stubGlobal('matchMedia', () => ({ matches: true }));
        const { result } = renderHook(() => usePrefersReducedMotion());
        expect(result.current).toBe(true);
    });
});

describe('useEnVista', () => {
    function Sonda(props) {
        const ref = useRef(null);
        const visto = useEnVista(ref, props);
        return <div ref={ref} data-testid="x" data-visto={String(visto)} />;
    }
    it('pasa a true al intersectar y se desconecta con once', () => {
        vi.stubGlobal('IntersectionObserver', ObservadorFalso);
        const { getByTestId } = render(<Sonda />);
        expect(getByTestId('x').dataset.visto).toBe('false');
        act(() => ObservadorFalso.instancias[0].emitir(true));
        expect(getByTestId('x').dataset.visto).toBe('true');
        expect(ObservadorFalso.instancias[0].desconectado).toBe(true);
    });
    it('sin once vuelve a false al salir', () => {
        vi.stubGlobal('IntersectionObserver', ObservadorFalso);
        const { getByTestId } = render(<Sonda once={false} />);
        act(() => ObservadorFalso.instancias[0].emitir(true));
        act(() => ObservadorFalso.instancias[0].emitir(false));
        expect(getByTestId('x').dataset.visto).toBe('false');
    });
    it('desactivado no observa', () => {
        vi.stubGlobal('IntersectionObserver', ObservadorFalso);
        render(<Sonda desactivado />);
        expect(ObservadorFalso.instancias).toHaveLength(0);
    });
    describe('avisos con varias entradas', () => {
        it('manda la entrada más reciente: [fuera, dentro] revela y desconecta', () => {
            vi.stubGlobal('IntersectionObserver', ObservadorFalso);
            const { getByTestId } = render(<Sonda />);
            act(() => ObservadorFalso.instancias[0].emitirVarias(false, true));
            expect(getByTestId('x').dataset.visto).toBe('true');
            expect(ObservadorFalso.instancias[0].desconectado).toBe(true);
        });
        it('sin once, [dentro, fuera] termina oculto (visto sigue a la presencia actual)', () => {
            vi.stubGlobal('IntersectionObserver', ObservadorFalso);
            const { getByTestId } = render(<Sonda once={false} />);
            act(() => ObservadorFalso.instancias[0].emitirVarias(true, false));
            expect(getByTestId('x').dataset.visto).toBe('false');
        });
    });
    describe('impresión', () => {
        // Al imprimir / guardar PDF el observador nunca avisa: sin esto, lo que quedó bajo el pliegue saldría oculto en el papel.
        it('beforeprint revela lo que el observador nunca llegó a ver y lo hace de forma síncrona (antes de maquetar la impresión)', () => {
            vi.stubGlobal('IntersectionObserver', ObservadorFalso);
            const { getByTestId } = render(<Sonda />);
            expect(getByTestId('x').dataset.visto).toBe('false');
            let alImprimir;
            act(() => {
                window.dispatchEvent(new Event('beforeprint'));
                // Sin flushSync el estado esperaría a que termine act y aquí seguiría en 'false'.
                alImprimir = getByTestId('x').dataset.visto;
            });
            expect(alImprimir).toBe('true');
            expect(ObservadorFalso.instancias[0].desconectado).toBe(true);
        });
        it('cancela el respaldo pendiente y no deja temporizadores', () => {
            vi.useFakeTimers();
            vi.stubGlobal('IntersectionObserver', ObservadorFalso);
            render(<Sonda />);
            act(() => ObservadorFalso.instancias[0].emitir(false));
            expect(vi.getTimerCount()).toBe(1);
            act(() => { window.dispatchEvent(new Event('beforeprint')); });
            expect(vi.getTimerCount()).toBe(0);
        });
        it('sin once, beforeprint también revela y no desconecta el observador', () => {
            vi.stubGlobal('IntersectionObserver', ObservadorFalso);
            const { getByTestId } = render(<Sonda once={false} />);
            act(() => { window.dispatchEvent(new Event('beforeprint')); });
            expect(getByTestId('x').dataset.visto).toBe('true');
            expect(ObservadorFalso.instancias[0].desconectado).toBe(false);
        });
        it('desactivado no registra el oyente y al desmontar lo quita', () => {
            vi.stubGlobal('IntersectionObserver', ObservadorFalso);
            const agregar = vi.spyOn(window, 'addEventListener');
            const quitar = vi.spyOn(window, 'removeEventListener');
            const llamadasA = (espia) => espia.mock.calls.filter(([tipo]) => tipo === 'beforeprint');
            render(<Sonda desactivado />);
            expect(llamadasA(agregar)).toHaveLength(0);
            const { unmount } = render(<Sonda />);
            expect(llamadasA(agregar)).toHaveLength(1);
            unmount();
            expect(llamadasA(quitar)).toHaveLength(1);
            expect(llamadasA(quitar)[0][1]).toBe(llamadasA(agregar)[0][1]);
            agregar.mockRestore();
            quitar.mockRestore();
        });
    });
    describe('respaldo del margen inferior', () => {
        // jsdom no hace layout: la caja del elemento y el alto del viewport (768 por defecto) se simulan.
        function simularCaja(caja) {
            vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, right: 300, width: 300, height: 40, ...caja });
        }
        it('un elemento que el observador da por fuera (bajo el margen) pero que se ve entero se revela tras un instante', () => {
            vi.useFakeTimers();
            vi.stubGlobal('IntersectionObserver', ObservadorFalso);
            simularCaja({ top: 700, bottom: 740 });
            const { getByTestId } = render(<Sonda />);
            act(() => ObservadorFalso.instancias[0].emitir(false));
            act(() => { vi.advanceTimersByTime(300); });
            expect(getByTestId('x').dataset.visto).toBe('false');
            act(() => { vi.advanceTimersByTime(400); });
            expect(getByTestId('x').dataset.visto).toBe('true');
            expect(ObservadorFalso.instancias[0].desconectado).toBe(true);
        });
        it('no revela lo que está fuera del viewport, a medias cortado o sin caja', () => {
            vi.useFakeTimers();
            vi.stubGlobal('IntersectionObserver', ObservadorFalso);
            const { getByTestId } = render(<Sonda />);
            act(() => ObservadorFalso.instancias[0].emitir(false));
            for (const caja of [{ top: 900, bottom: 940 }, { top: 740, bottom: 800 }, { top: -20, bottom: 20 }, { top: 0, bottom: 0, width: 0, height: 0 }]) {
                simularCaja(caja);
                act(() => { vi.advanceTimersByTime(1000); });
                expect(getByTestId('x').dataset.visto).toBe('false');
                act(() => ObservadorFalso.instancias[0].emitir(false));
            }
        });
        it('si el observador lo revela antes, cancela el respaldo; al desmontar tampoco queda ningún temporizador', () => {
            vi.useFakeTimers();
            vi.stubGlobal('IntersectionObserver', ObservadorFalso);
            simularCaja({ top: 700, bottom: 740 });
            const { getByTestId, unmount } = render(<Sonda />);
            act(() => ObservadorFalso.instancias[0].emitir(false));
            act(() => ObservadorFalso.instancias[0].emitir(true));
            expect(getByTestId('x').dataset.visto).toBe('true');
            expect(vi.getTimerCount()).toBe(0);
            unmount();
            const { unmount: desmontar } = render(<Sonda />);
            act(() => ObservadorFalso.instancias[1].emitir(false));
            expect(vi.getTimerCount()).toBe(1);
            desmontar();
            expect(vi.getTimerCount()).toBe(0);
        });
        it('sin once no hay respaldo: visto sigue a la presencia', () => {
            vi.useFakeTimers();
            vi.stubGlobal('IntersectionObserver', ObservadorFalso);
            simularCaja({ top: 700, bottom: 740 });
            const { getByTestId } = render(<Sonda once={false} />);
            act(() => ObservadorFalso.instancias[0].emitir(false));
            expect(vi.getTimerCount()).toBe(0);
            act(() => { vi.advanceTimersByTime(2000); });
            expect(getByTestId('x').dataset.visto).toBe('false');
        });
    });
    it('sin IntersectionObserver considera visible el contenido', async () => {
        vi.stubGlobal('IntersectionObserver', undefined);
        const { getByTestId } = render(<Sonda />);
        await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
        expect(getByTestId('x').dataset.visto).toBe('true');
    });
});
