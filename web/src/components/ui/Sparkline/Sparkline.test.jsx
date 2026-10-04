// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Sparkline from './Sparkline.jsx';

class ObservadorFalso {
    static instancias = [];
    constructor(cb) {
        this.cb = cb;
        ObservadorFalso.instancias.push(this);
    }
    observe() {}
    disconnect() {}
    emitir() {
        this.cb([{ isIntersecting: true }]);
    }
}
function preparar(reducido = false) {
    vi.stubGlobal('matchMedia', () => ({ matches: reducido, addEventListener() {}, removeEventListener() {} }));
    vi.stubGlobal('IntersectionObserver', ObservadorFalso);
}
afterEach(() => {
    vi.unstubAllGlobals();
    ObservadorFalso.instancias = [];
});

// Coordenadas y de los extremos de cada tramo "C…" del trazo (el último par de cada curva) + el primer punto "M".
const ys = (d) => [...d.matchAll(/(?:M|\s)(-?[\d.]+) (-?[\d.]+)(?=\s*(?:C|$))/g)].map((m) => Number(m[2]));
const trazoDe = (c) => c.querySelectorAll('path')[1].getAttribute('d');
const curvas = (d) => (d.match(/C/g) ?? []).length;

describe('Sparkline', () => {
    it('dibuja un svg decorativo con área, trazo y punto final', () => {
        preparar(true);
        const { container } = render(<Sparkline valores={[3, 5, 4, 9]} />);
        const svg = container.querySelector('svg');
        expect(svg).toHaveAttribute('aria-hidden', 'true');
        expect(svg).toHaveAttribute('viewBox', '0 0 120 36');
        expect(container.querySelectorAll('path')).toHaveLength(2);
        expect(container.querySelectorAll('circle')).toHaveLength(1);
        expect(curvas(trazoDe(container))).toBe(3);
    });

    it('menos de 2 puntos reales no dibuja nada (null)', () => {
        preparar(true);
        for (const valores of [[], [5], [null, NaN, 4], [undefined], undefined, null, 'abc']) {
            const { container, unmount } = render(<Sparkline valores={valores} />);
            expect(container).toBeEmptyDOMElement();
            unmount();
        }
    });

    it('descarta NaN, null, undefined y no numéricos y dibuja con el resto', () => {
        preparar(true);
        const { container } = render(<Sparkline valores={[1, null, NaN, 3, undefined, '', '2', 'x']} />);
        // 1, 3 y '2' -> 3 puntos -> 2 curvas
        expect(curvas(trazoDe(container))).toBe(2);
    });

    it('valores iguales: línea plana al centro del lienzo', () => {
        preparar(true);
        const { container } = render(<Sparkline valores={[7, 7, 7, 7]} ancho={100} alto={40} />);
        const d = trazoDe(container);
        expect(new Set(ys(d))).toEqual(new Set([20]));
        expect(container.querySelector('circle')).toHaveAttribute('cy', '20');
    });

    it('sin min/max usa el rango de los datos: el mínimo abajo y el máximo arriba (con margen)', () => {
        preparar(true);
        const { container } = render(<Sparkline valores={[10, 30]} ancho={100} alto={40} />);
        const y = ys(trazoDe(container));
        expect(y[0]).toBe(37);
        expect(y.at(-1)).toBe(3);
    });

    it('min/max fijos: el eje no depende de los datos (sirve para comparar series)', () => {
        preparar(true);
        const a = render(<Sparkline valores={[50, 50]} min={0} max={100} ancho={100} alto={40} />);
        expect(cyFinal(a)).toBe('20');
        a.unmount();
        const b = render(<Sparkline valores={[0, 100]} min={0} max={200} ancho={100} alto={40} />);
        // 100 sobre un dominio 0-200 queda en el centro, no arriba.
        expect(cyFinal(b)).toBe('20');
        b.unmount();
        const c = render(<Sparkline valores={[0, 400]} min={0} max={200} ancho={100} alto={40} />);
        // Un valor fuera de rango se pega al borde en vez de salirse del lienzo.
        expect(cyFinal(c)).toBe('3');
    });

    it('ids únicos por instancia, válidos dentro de url(#...) y referenciados por el relleno', () => {
        preparar(true);
        const { container } = render(
            <>
                <Sparkline valores={[1, 2, 3]} />
                <Sparkline valores={[3, 2, 1]} />
            </>,
        );
        const ids = [...container.querySelectorAll('linearGradient')].map((g) => g.id);
        expect(ids).toHaveLength(2);
        expect(new Set(ids).size).toBe(2);
        ids.forEach((id) => expect(id).toMatch(/^[A-Za-z_][\w-]*$/));
        const rellenos = [...container.querySelectorAll('svg')].map((s) => s.querySelector('path').getAttribute('fill'));
        expect(rellenos).toEqual(ids.map((id) => `url(#${id})`));
    });

    it('el color se traduce del token de texto al de gráfica y se pasa como currentColor', () => {
        preparar(true);
        const { container } = render(<Sparkline valores={[1, 2]} color="var(--ausente)" />);
        expect(container.querySelector('svg').style.color).toBe('var(--g-ausente)');
        expect(container.querySelectorAll('path')[1]).toHaveAttribute('stroke', 'currentColor');
    });

    it('reducir movimiento: dibujado de inmediato, sin transiciones y sin observador', () => {
        preparar(true);
        const { container } = render(<Sparkline valores={[1, 4, 2]} />);
        const trazo = container.querySelectorAll('path')[1];
        expect(trazo).toHaveAttribute('stroke-dashoffset', '0');
        expect(trazo.style.opacity).toBe('1');
        expect(trazo.style.transition).toBe('');
        expect(container.querySelector('circle').style.opacity).toBe('1');
        expect(ObservadorFalso.instancias).toHaveLength(0);
    });

    it('con movimiento: oculto hasta entrar en vista y luego se dibuja (una vez)', () => {
        preparar(false);
        const { container } = render(<Sparkline valores={[1, 4, 2]} />);
        const trazo = container.querySelectorAll('path')[1];
        expect(trazo).toHaveAttribute('stroke-dashoffset', '1');
        expect(trazo.style.opacity).toBe('0');
        expect(trazo.style.transition).toContain('stroke-dashoffset');
        act(() => ObservadorFalso.instancias[0].emitir());
        expect(trazo).toHaveAttribute('stroke-dashoffset', '0');
        expect(trazo.style.opacity).toBe('1');
    });

    it('si la serie llega después (de <2 puntos a 2 o más) también se dibuja al entrar en vista', () => {
        preparar(false);
        const { container, rerender } = render(<Sparkline valores={[]} />);
        expect(container).toBeEmptyDOMElement();
        rerender(<Sparkline valores={[2, 5, 3]} />);
        expect(container.querySelector('svg')).toBeInTheDocument();
        act(() => ObservadorFalso.instancias.at(-1).emitir());
        expect(container.querySelectorAll('path')[1]).toHaveAttribute('stroke-dashoffset', '0');
    });

    it('sin IntersectionObserver (navegadores viejos) no deja la línea oculta', async () => {
        vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
        const { container } = render(<Sparkline valores={[1, 2, 3]} />);
        await act(async () => {
            await new Promise((r) => setTimeout(r, 5));
        });
        expect(container.querySelectorAll('path')[1]).toHaveAttribute('stroke-dashoffset', '0');
    });

    it('className y tamaño van al svg', () => {
        preparar(true);
        const { container } = render(<Sparkline valores={[1, 2]} ancho={80} alto={28} className="h-auto w-full" />);
        const svg = container.querySelector('svg');
        expect(svg).toHaveClass('h-auto', 'w-full');
        expect(svg).toHaveAttribute('width', '80');
        expect(svg).toHaveAttribute('height', '28');
    });
});

// cy del punto final de la serie renderizada.
function cyFinal(r) {
    return r.container.querySelector('circle').getAttribute('cy');
}
