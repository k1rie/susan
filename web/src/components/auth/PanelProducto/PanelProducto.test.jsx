// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PanelProducto from './PanelProducto.jsx';
import { ESCENAS } from './escenas.jsx';

function conMovimiento(reducido) {
    vi.stubGlobal('matchMedia', () => ({ matches: reducido, addEventListener() {}, removeEventListener() {} }));
}
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('PanelProducto', () => {
    it('es decoración: aria-hidden y sin elementos enfocables', () => {
        conMovimiento(false);
        const { container } = render(<PanelProducto />);
        const raiz = container.firstChild;
        expect(raiz).toHaveAttribute('aria-hidden', 'true');
        expect(raiz.querySelectorAll('a,button,input,select,textarea,[tabindex]')).toHaveLength(0);
    });

    it('rota de escena cada ~6,5 s y vuelve a la primera', () => {
        conMovimiento(false);
        vi.useFakeTimers();
        const { container } = render(<PanelProducto />);
        const titulo = () => container.querySelector('.font-display').textContent;
        expect(titulo()).toBe(ESCENAS[0].titulo);
        act(() => vi.advanceTimersByTime(6600));
        expect(titulo()).toBe(ESCENAS[1].titulo);
        act(() => vi.advanceTimersByTime(6500));
        expect(titulo()).toBe(ESCENAS[2].titulo);
        act(() => vi.advanceTimersByTime(6500));
        expect(titulo()).toBe(ESCENAS[0].titulo);
    });

    it('con "reducir movimiento" se queda en la primera escena', () => {
        conMovimiento(true);
        vi.useFakeTimers();
        const { container } = render(<PanelProducto />);
        act(() => vi.advanceTimersByTime(30000));
        expect(container.querySelector('.font-display').textContent).toBe(ESCENAS[0].titulo);
    });

    it('cada escena usa nombres ficticios y chips de estado con texto', () => {
        conMovimiento(true);
        const Vista = ESCENAS[0].Vista;
        const { container } = render(<Vista />);
        expect(container.textContent).toMatch(/Presente/);
        expect(container.textContent).toMatch(/Pendiente/);
    });
});
