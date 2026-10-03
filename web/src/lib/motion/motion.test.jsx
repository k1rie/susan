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
}

afterEach(() => {
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
    it('sin IntersectionObserver considera visible el contenido', async () => {
        vi.stubGlobal('IntersectionObserver', undefined);
        const { getByTestId } = render(<Sonda />);
        await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
        expect(getByTestId('x').dataset.visto).toBe('true');
    });
});
