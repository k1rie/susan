// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useAnchoElemento from './useAnchoElemento.js';

class ObservadorTamano {
    static instancias = [];
    constructor(cb) {
        this.cb = cb;
        this.observados = [];
        this.desconectado = false;
        ObservadorTamano.instancias.push(this);
    }
    observe(nodo) { this.observados.push(nodo); }
    disconnect() { this.desconectado = true; }
    medir(ancho) { this.cb([{ contentRect: { width: ancho } }]); }
}

function Sonda(props) {
    const ref = useRef(null);
    const ancho = useAnchoElemento(ref, props);
    return <div ref={ref} data-testid="x" data-ancho={String(ancho)} />;
}

afterEach(() => {
    vi.unstubAllGlobals();
    ObservadorTamano.instancias = [];
});

describe('useAnchoElemento', () => {
    it('sin ResizeObserver devuelve null (no inventa una medida)', () => {
        const { getByTestId } = render(<Sonda />);
        expect(getByTestId('x').dataset.ancho).toBe('null');
    });

    it('empieza en null, devuelve el ancho entero que mide el observador y reacciona a cambios', () => {
        vi.stubGlobal('ResizeObserver', ObservadorTamano);
        const { getByTestId } = render(<Sonda />);
        expect(getByTestId('x').dataset.ancho).toBe('null');
        expect(ObservadorTamano.instancias[0].observados).toEqual([getByTestId('x')]);
        act(() => ObservadorTamano.instancias[0].medir(320.4));
        expect(getByTestId('x').dataset.ancho).toBe('320');
        act(() => ObservadorTamano.instancias[0].medir(480));
        expect(getByTestId('x').dataset.ancho).toBe('480');
    });

    it('desactivado no observa nada', () => {
        vi.stubGlobal('ResizeObserver', ObservadorTamano);
        render(<Sonda desactivado />);
        expect(ObservadorTamano.instancias).toHaveLength(0);
    });

    it('se desconecta al desmontar', () => {
        vi.stubGlobal('ResizeObserver', ObservadorTamano);
        const { unmount } = render(<Sonda />);
        unmount();
        expect(ObservadorTamano.instancias[0].desconectado).toBe(true);
    });
});
