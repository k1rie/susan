// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlurText, CountUp, Reveal, SpotlightCard, StaggerList } from './index.js';
import { decimalesDe, formatearNumero } from './CountUp/countUp.utils.js';

class ObservadorFalso {
    static instancias = [];
    constructor(cb) { this.cb = cb; ObservadorFalso.instancias.push(this); }
    observe() {}
    disconnect() {}
    emitir() { this.cb([{ isIntersecting: true }]); }
}
function conMovimiento(reducido = false) {
    vi.stubGlobal('matchMedia', () => ({ matches: reducido, addEventListener() {}, removeEventListener() {} }));
    vi.stubGlobal('IntersectionObserver', ObservadorFalso);
}
afterEach(() => {
    vi.unstubAllGlobals();
    ObservadorFalso.instancias = [];
});

describe('Reveal', () => {
    it('empieza oculto y se muestra al entrar al viewport', () => {
        conMovimiento();
        render(<Reveal data-testid="r">hola</Reveal>);
        expect(screen.getByTestId('r')).toHaveAttribute('data-reveal', 'oculto');
        expect(screen.getByTestId('r').style.opacity).toBe('0');
        act(() => ObservadorFalso.instancias[0].emitir());
        expect(screen.getByTestId('r')).toHaveAttribute('data-reveal', 'visible');
        expect(screen.getByTestId('r').style.opacity).toBe('1');
    });
    it('immediate: la primera pasada sale oculta (coincide con el servidor) y se muestra en el siguiente fotograma', async () => {
        conMovimiento();
        render(<Reveal immediate data-testid="r">hola</Reveal>);
        expect(screen.getByTestId('r')).toHaveAttribute('data-reveal', 'oculto');
        await act(async () => { await new Promise((r) => requestAnimationFrame(() => r())); });
        expect(screen.getByTestId('r')).toHaveAttribute('data-reveal', 'visible');
        expect(ObservadorFalso.instancias).toHaveLength(0);
    });
    it('con reducir movimiento nunca oculta ni anima', () => {
        conMovimiento(true);
        render(<Reveal data-testid="r">hola</Reveal>);
        expect(screen.getByTestId('r')).toHaveAttribute('data-reveal', 'visible');
        expect(screen.getByTestId('r').style.transition).toBe('');
        expect(ObservadorFalso.instancias).toHaveLength(0);
    });
    it('respeta la etiqueta (as) y los atributos extra', () => {
        conMovimiento(true);
        render(<Reveal as="section" aria-label="bloque">x</Reveal>);
        expect(screen.getByLabelText('bloque').tagName).toBe('SECTION');
    });
});

describe('BlurText', () => {
    it('expone el texto completo a lectores de pantalla y parte en palabras', () => {
        conMovimiento(true);
        const { container } = render(<BlurText text="Pasa lista en segundos" />);
        expect(screen.getByText('Pasa lista en segundos')).toHaveClass('sr-only');
        expect(container.querySelector('span[aria-hidden="true"]').children).toHaveLength(4);
    });
    it('puede animar por letras', () => {
        conMovimiento(true);
        const { container } = render(<BlurText text="SUSAN" animateBy="letters" />);
        expect(container.querySelector('span[aria-hidden="true"]').children).toHaveLength(5);
    });
    it('escalona el retraso por segmento', () => {
        conMovimiento();
        const { container } = render(<BlurText text="uno dos tres" delay={100} />);
        const [a, , c] = container.querySelector('span[aria-hidden="true"]').children;
        expect(a.style.transition).toContain(' 0s');
        expect(c.style.transition).toContain(' 0.2s');
    });
});

describe('CountUp', () => {
    it('con reducir movimiento muestra el valor final con formato es-MX', () => {
        conMovimiento(true);
        render(<CountUp to={12345} suffix=" faltas" />);
        expect(screen.getAllByText(/12[,\s]345 faltas/)[0]).toHaveClass('sr-only');
    });
    it('antes de entrar al viewport muestra el inicial y al terminar el final', async () => {
        conMovimiento();
        let tiempo = 0;
        vi.stubGlobal('requestAnimationFrame', (f) => setTimeout(() => { tiempo += 1000; f(tiempo); }, 0));
        vi.stubGlobal('cancelAnimationFrame', (id) => clearTimeout(id));
        const { container } = render(<CountUp to={80} from={0} duration={1} />);
        const nodo = container.querySelector('[aria-hidden="true"]');
        expect(nodo.textContent).toBe('0');
        act(() => ObservadorFalso.instancias[0].emitir());
        await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
        expect(nodo.textContent).toBe('80');
    });
    it('utilidades: decimales y formato', () => {
        expect(decimalesDe(0, 3)).toBe(0);
        expect(decimalesDe(0, 2.5)).toBe(1);
        expect(decimalesDe(1.25, 3)).toBe(2);
        expect(decimalesDe(2.0, 4)).toBe(0);
        expect(formatearNumero(1234.5, { decimales: 1, locale: 'en-US' })).toBe('1,234.5');
        expect(formatearNumero(1234, { separador: false, locale: 'en-US' })).toBe('1234');
    });
});

describe('SpotlightCard', () => {
    it('escribe la posición del ratón en variables CSS y no con táctil', () => {
        const { container } = render(<SpotlightCard data-testid="s">contenido</SpotlightCard>);
        const tarjeta = screen.getByTestId('s');
        tarjeta.getBoundingClientRect = () => ({ left: 10, top: 20 });
        fireEvent.pointerMove(tarjeta, { clientX: 60, clientY: 90, pointerType: 'mouse' });
        expect(tarjeta.style.getPropertyValue('--x')).toBe('50px');
        expect(tarjeta.style.getPropertyValue('--y')).toBe('70px');
        fireEvent.pointerMove(tarjeta, { clientX: 200, clientY: 200, pointerType: 'touch' });
        expect(tarjeta.style.getPropertyValue('--x')).toBe('50px');
        expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    });
});

describe('StaggerList', () => {
    it('renderiza un li por hijo con retraso creciente y tope', () => {
        conMovimiento();
        render(
            <StaggerList step={0.1} max={0.25}>
                <span>a</span><span>b</span><span>c</span><span>d</span>
            </StaggerList>,
        );
        const items = screen.getAllByRole('listitem');
        expect(items).toHaveLength(4);
        expect(items[0].style.transition).toContain(' 0s');
        expect(items[1].style.transition).toContain(' 0.1s');
        expect(items[3].style.transition).toContain(' 0.25s');
        expect(items[0].style.opacity).toBe('0');
        act(() => ObservadorFalso.instancias[0].emitir());
        expect(items[0].style.opacity).toBe('1');
    });
    it('con reducir movimiento todo visible desde el inicio', () => {
        conMovimiento(true);
        render(<StaggerList><span>a</span></StaggerList>);
        expect(screen.getByRole('listitem').style.opacity).toBe('1');
    });
});
