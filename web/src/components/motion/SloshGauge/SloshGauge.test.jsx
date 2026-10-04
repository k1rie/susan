// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SloshGauge from './SloshGauge.jsx';

// jsdom no trae matchMedia ni un requestAnimationFrame controlable: se simulan para avanzar la física cuadro a cuadro.
function conMatchMedia(reducido = false) {
    vi.stubGlobal('matchMedia', () => ({ matches: reducido, addEventListener() {}, removeEventListener() {} }));
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
        // Ejecuta `n` cuadros de `ms` ms; devuelve el nivel (top del recorte) de cada uno mediante `alCuadro`.
        avanzar(n = 1, ms = 16, alCuadro) {
            for (let i = 0; i < n; i += 1) {
                ahora += ms;
                const lote = [...cola.values()];
                cola.clear();
                lote.forEach((cb) => cb(ahora));
                alCuadro?.();
            }
        },
    };
}
// Con showValue={false} el primer hijo marcado como aria-hidden es el líquido.
const liquido = () => screen.getByRole('meter').querySelector('[aria-hidden="true"]');
// Del clip-path saca { arriba (% desde el borde superior), desnivel (px de inclinación) }.
function recorte() {
    const m = /calc\(([-\d.]+)% \+ ([-\d.]+)px\)/.exec(liquido().style.clipPath);
    return m ? { arriba: Number(m[1]), desnivel: Number(m[2]) } : null;
}

afterEach(() => vi.unstubAllGlobals());

describe('SloshGauge', () => {
    it('sin matchMedia (jsdom / navegadores viejos) monta, anima y se desmonta sin lanzar', () => {
        vi.stubGlobal('matchMedia', undefined);
        const reloj = relojDeCuadros();
        const { rerender, unmount } = render(<SloshGauge value={0} showValue={false} ariaLabel="Nivel" />);
        rerender(<SloshGauge value={70} showValue={false} ariaLabel="Nivel" />);
        reloj.avanzar(200);
        expect(recorte()).toEqual({ arriba: 30, desnivel: 0 });
        expect(() => unmount()).not.toThrow();
    });

    it('expone role meter con nombre y aria-valuenow, y los actualiza cuando cambia el valor', () => {
        conMatchMedia();
        relojDeCuadros();
        const { rerender } = render(<SloshGauge value={40} showValue={false} ariaLabel="Presentes: 40 %" />);
        const meter = screen.getByRole('meter', { name: 'Presentes: 40 %' });
        expect(meter).toHaveAttribute('aria-valuenow', '40');
        expect(meter).toHaveAttribute('aria-valuemin', '0');
        expect(meter).toHaveAttribute('aria-valuemax', '100');
        rerender(<SloshGauge value={65} showValue={false} ariaLabel="Presentes: 65 %" />);
        expect(screen.getByRole('meter', { name: 'Presentes: 65 %' })).toBe(meter);
        expect(meter).toHaveAttribute('aria-valuenow', '65');
    });

    it('ariaValue manda sobre el nivel visual y ariaDescribedBy se enlaza', () => {
        conMatchMedia();
        relojDeCuadros();
        render(
            <>
                <p id="apoyo">Mínimo 80 %</p>
                <SloshGauge value={0} ariaValue={82} ariaDescribedBy="apoyo" showValue={false} ariaLabel="Nivel" />
            </>,
        );
        const meter = screen.getByRole('meter');
        expect(meter).toHaveAttribute('aria-valuenow', '82');
        expect(meter).toHaveAccessibleDescription('Mínimo 80 %');
    });

    it('al subir chapotea: se pasa del nivel, la superficie se inclina mientras se mueve y acaba plana en el nivel', () => {
        conMatchMedia();
        const reloj = relojDeCuadros();
        const { rerender } = render(<SloshGauge value={0} showValue={false} viscosity={0.2} tilt={0.35} splash={0.3} ariaLabel="Nivel" />);
        expect(recorte()).toEqual({ arriba: 100, desnivel: 0 });
        rerender(<SloshGauge value={80} showValue={false} viscosity={0.2} tilt={0.35} splash={0.3} ariaLabel="Nivel" />);
        let minArriba = 100;
        let hubo = false;
        reloj.avanzar(60, 16, () => {
            const r = recorte();
            minArriba = Math.min(minArriba, r.arriba);
            if (r.desnivel !== 0) hubo = true;
        });
        expect(hubo).toBe(true);
        expect(minArriba).toBeLessThan(20);
        reloj.avanzar(400);
        expect(recorte()).toEqual({ arriba: 20, desnivel: 0 });
    });

    it('la física se detiene al llegar al reposo: no queda ningún cuadro pendiente', () => {
        conMatchMedia();
        const reloj = relojDeCuadros();
        const { rerender } = render(<SloshGauge value={10} showValue={false} ariaLabel="Nivel" />);
        rerender(<SloshGauge value={90} showValue={false} ariaLabel="Nivel" />);
        expect(reloj.pendientes()).toBe(1);
        reloj.avanzar(400);
        expect(reloj.pendientes()).toBe(0);
        reloj.avanzar(5);
        expect(reloj.pendientes()).toBe(0);
        expect(recorte().arriba).toBe(10);
    });

    it('cancela el cuadro pendiente al desmontar', () => {
        conMatchMedia();
        const reloj = relojDeCuadros();
        const { rerender, unmount } = render(<SloshGauge value={0} showValue={false} ariaLabel="Nivel" />);
        rerender(<SloshGauge value={60} showValue={false} ariaLabel="Nivel" />);
        reloj.avanzar(2);
        expect(reloj.pendientes()).toBe(1);
        unmount();
        expect(reloj.pendientes()).toBe(0);
    });

    it('con StrictMode (montaje doble) la animación sigue despertando: el id de rAF no queda colgado', () => {
        conMatchMedia();
        const reloj = relojDeCuadros();
        const { rerender } = render(
            <StrictMode>
                <SloshGauge value={0} showValue={false} ariaLabel="Nivel" />
            </StrictMode>,
        );
        rerender(
            <StrictMode>
                <SloshGauge value={60} showValue={false} ariaLabel="Nivel" />
            </StrictMode>,
        );
        expect(reloj.pendientes()).toBe(1);
        reloj.avanzar(400);
        expect(recorte().arriba).toBe(40);
    });

    it('un valor nuevo no reinicia el líquido ni remonta: parte del nivel en que estaba', () => {
        conMatchMedia();
        const reloj = relojDeCuadros();
        const { rerender } = render(<SloshGauge value={50} showValue={false} ariaLabel="Nivel" />);
        const antes = screen.getByRole('meter');
        expect(recorte().arriba).toBe(50);
        rerender(<SloshGauge value={20} showValue={false} ariaLabel="Nivel" />);
        expect(screen.getByRole('meter')).toBe(antes);
        expect(antes).toHaveAttribute('aria-valuenow', '20');
        reloj.avanzar(1);
        // Bajó un poco desde el 50 % (no saltó a vacío ni a 0): la superficie está entre el 50 % y el 70 % de arriba.
        expect(recorte().arriba).toBeGreaterThanOrEqual(50);
        expect(recorte().arriba).toBeLessThan(70);
        reloj.avanzar(400);
        expect(recorte().arriba).toBe(80);
    });

    it('con reducir movimiento no hay chapoteo, inclinación ni cuadros: el nivel salta al instante', () => {
        conMatchMedia(true);
        const reloj = relojDeCuadros();
        const { rerender } = render(<SloshGauge value={0} showValue={false} tilt={0.9} ariaLabel="Nivel" />);
        rerender(<SloshGauge value={80} showValue={false} tilt={0.9} ariaLabel="Nivel" />);
        expect(reloj.pendientes()).toBe(0);
        expect(recorte()).toEqual({ arriba: 20, desnivel: 0 });
        rerender(<SloshGauge value={35} showValue={false} tilt={0.9} ariaLabel="Nivel" />);
        expect(reloj.pendientes()).toBe(0);
        expect(recorte()).toEqual({ arriba: 65, desnivel: 0 });
        expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '35');
    });

    it('si se activa reducir movimiento a mitad de la animación, el líquido se asienta en su nivel', () => {
        const escuchas = new Set();
        let reducido = false;
        vi.stubGlobal('matchMedia', () => ({
            get matches() {
                return reducido;
            },
            addEventListener: (_, f) => escuchas.add(f),
            removeEventListener: (_, f) => escuchas.delete(f),
        }));
        const reloj = relojDeCuadros();
        const { rerender } = render(<SloshGauge value={0} showValue={false} ariaLabel="Nivel" />);
        rerender(<SloshGauge value={90} showValue={false} ariaLabel="Nivel" />);
        reloj.avanzar(3);
        expect(recorte().arriba).not.toBe(10);
        reducido = true;
        act(() => escuchas.forEach((f) => f()));
        expect(recorte()).toEqual({ arriba: 10, desnivel: 0 });
    });

    it('valores no numéricos no rompen: caen en 0 y un valor fuera de rango se acota', () => {
        conMatchMedia(true);
        relojDeCuadros();
        const { rerender } = render(<SloshGauge value={NaN} showValue={false} ariaLabel="Nivel" />);
        expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '0');
        rerender(<SloshGauge value={250} showValue={false} ariaLabel="Nivel" />);
        expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '100');
        expect(recorte().arriba).toBe(0);
    });

    it('es solo un medidor: no es un slider ni se puede enfocar, y el teclado no cambia el nivel', () => {
        conMatchMedia(true);
        relojDeCuadros();
        render(<SloshGauge value={50} showValue={false} ariaLabel="Nivel" />);
        expect(screen.queryByRole('slider')).toBeNull();
        const meter = screen.getByRole('meter');
        expect(meter).not.toHaveAttribute('tabindex');
        fireEvent.keyDown(meter, { key: 'End' });
        expect(meter).toHaveAttribute('aria-valuenow', '50');
        expect(recorte().arriba).toBe(50);
    });

    it('los colores van por token (sin hex): el texto sobre el líquido usa --primary-foreground por defecto', () => {
        conMatchMedia();
        relojDeCuadros();
        render(<SloshGauge value={30} ariaLabel="Nivel" />);
        const meter = screen.getByRole('meter');
        expect(meter.style.getPropertyValue('--sg-liquid')).toBe('var(--primary)');
        expect(meter.style.getPropertyValue('--sg-on-liquid')).toBe('var(--primary-foreground)');
    });
});
