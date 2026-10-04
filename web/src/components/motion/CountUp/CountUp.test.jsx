// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CountUp from './CountUp.jsx';

// IntersectionObserver, matchMedia, rAF y temporizadores controlables (jsdom no trae los dos primeros).
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
function relojDeCuadros() {
    let id = 0;
    let ahora = 0;
    const cola = new Map();
    vi.stubGlobal('requestAnimationFrame', (cb) => {
        id += 1;
        cola.set(id, cb);
        return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (i) => {
        cola.delete(i);
    });
    return {
        pendientes: () => cola.size,
        avanzar(n = 1, ms = 100) {
            for (let i = 0; i < n; i += 1) {
                ahora += ms;
                const lote = [...cola.values()];
                cola.clear();
                lote.forEach((cb) => cb(ahora));
            }
        },
    };
}
function preparar(reducido = false) {
    vi.stubGlobal('matchMedia', () => ({ matches: reducido, addEventListener() {}, removeEventListener() {} }));
    vi.stubGlobal('IntersectionObserver', ObservadorFalso);
    return relojDeCuadros();
}
const entrar = () => act(() => ObservadorFalso.instancias.at(-1).emitir());
// Deja correr el setTimeout(…, espera) con el que CountUp arranca cada animación.
const esperar = (ms = 0) => act(() => vi.advanceTimersByTime(ms));
const visible = (c) => c.querySelector('[aria-hidden="true"]');
const numero = (c) => Number(visible(c).textContent.replace(/[^\d.-]/g, ''));

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    ObservadorFalso.instancias = [];
});

describe('CountUp: primera animación', () => {
    it('muestra `from` hasta entrar en vista, sube de forma creciente y termina exactamente en `to`', () => {
        const reloj = preparar();
        const { container } = render(<CountUp to={80} duration={1} />);
        expect(visible(container).textContent).toBe('0');
        entrar();
        esperar();
        const vistos = [];
        for (let i = 0; i < 12; i += 1) {
            reloj.avanzar(1, 100);
            vistos.push(numero(container));
        }
        expect(vistos).toEqual([...vistos].sort((a, b) => a - b));
        expect(vistos[0]).toBe(0);
        expect(vistos.at(-1)).toBe(80);
        expect(reloj.pendientes()).toBe(0);
    });

    it('respeta `from` y aplica `delay` solo a la primera animación', () => {
        const reloj = preparar();
        const { container, rerender } = render(<CountUp to={50} from={10} duration={1} delay={1} />);
        entrar();
        esperar(500);
        expect(reloj.pendientes()).toBe(0);
        expect(visible(container).textContent).toBe('10');
        esperar(500);
        expect(reloj.pendientes()).toBe(1);
        reloj.avanzar(15, 100);
        expect(numero(container)).toBe(50);
        // Segunda animación: sin esperar otro segundo.
        rerender(<CountUp to={90} from={10} duration={1} delay={1} />);
        esperar(0);
        expect(reloj.pendientes()).toBe(1);
    });
});

describe('CountUp: cuando `to` cambia (datos en vivo)', () => {
    it('sigue desde la cifra anterior hacia la nueva: no reinicia desde 0 ni salta al final', () => {
        const reloj = preparar();
        const { container, rerender } = render(<CountUp to={40} duration={1} />);
        entrar();
        esperar();
        reloj.avanzar(15, 100);
        expect(numero(container)).toBe(40);

        rerender(<CountUp to={80} duration={1} />);
        // Justo tras el cambio la cifra visible sigue siendo la anterior (el final nuevo solo está en el texto para lectores de pantalla).
        expect(numero(container)).toBe(40);
        expect(container.querySelector('.sr-only').textContent).toBe('80');
        esperar();
        const vistos = [];
        for (let i = 0; i < 15; i += 1) {
            reloj.avanzar(1, 100);
            vistos.push(numero(container));
        }
        expect(Math.min(...vistos)).toBeGreaterThanOrEqual(40);
        expect(vistos).toEqual([...vistos].sort((a, b) => a - b));
        expect(vistos.at(-1)).toBe(80);
    });

    it('también hacia abajo', () => {
        const reloj = preparar();
        const { container, rerender } = render(<CountUp to={90} duration={1} />);
        entrar();
        esperar();
        reloj.avanzar(15, 100);
        rerender(<CountUp to={30} duration={1} />);
        esperar();
        const vistos = [];
        for (let i = 0; i < 15; i += 1) {
            reloj.avanzar(1, 100);
            vistos.push(numero(container));
        }
        expect(Math.max(...vistos)).toBeLessThanOrEqual(90);
        expect(vistos).toEqual([...vistos].sort((a, b) => b - a));
        expect(vistos.at(-1)).toBe(30);
    });

    it('si cambia a mitad de una animación continúa desde la cifra que se ve en ese momento', () => {
        const reloj = preparar();
        const { container, rerender } = render(<CountUp to={100} duration={1} />);
        entrar();
        esperar();
        reloj.avanzar(4, 100);
        const aMedias = numero(container);
        expect(aMedias).toBeGreaterThan(0);
        expect(aMedias).toBeLessThan(100);

        rerender(<CountUp to={20} duration={1} />);
        expect(numero(container)).toBe(aMedias);
        esperar();
        reloj.avanzar(1, 100);
        expect(numero(container)).toBeLessThanOrEqual(aMedias);
        reloj.avanzar(15, 100);
        expect(numero(container)).toBe(20);
    });

    it('si cambia antes de entrar en vista no anima: espera en `from` y al entrar sube hasta el valor nuevo', () => {
        const reloj = preparar();
        const { container, rerender } = render(<CountUp to={40} duration={1} />);
        rerender(<CountUp to={70} duration={1} />);
        expect(visible(container).textContent).toBe('0');
        entrar();
        esperar();
        reloj.avanzar(15, 100);
        expect(numero(container)).toBe(70);
    });

    it('con reducir movimiento el texto pasa al valor nuevo sin animar', () => {
        const reloj = preparar(true);
        const { container, rerender } = render(<CountUp to={40} />);
        expect(visible(container).textContent).toBe('40');
        rerender(<CountUp to={75} />);
        expect(visible(container).textContent).toBe('75');
        expect(reloj.pendientes()).toBe(0);
    });

    it('al desmontar a mitad de la animación no deja cuadros ni temporizadores pendientes', () => {
        const reloj = preparar();
        const { unmount } = render(<CountUp to={100} duration={1} />);
        entrar();
        esperar();
        reloj.avanzar(2, 100);
        expect(reloj.pendientes()).toBe(1);
        unmount();
        expect(reloj.pendientes()).toBe(0);
    });
});
