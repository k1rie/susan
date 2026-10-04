// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { enfocarPanel } from './enfocarPanel.js';

const panel = () => {
    const el = document.createElement('section');
    el.tabIndex = -1;
    document.body.appendChild(el);
    el.scrollIntoView = vi.fn();
    return el;
};

describe('enfocarPanel', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.unstubAllGlobals();
    });

    it('da el foco sin saltar y solo desplaza si hace falta (nearest), suave por omisión', () => {
        const el = panel();
        const enfocar = vi.spyOn(el, 'focus');
        vi.stubGlobal('matchMedia', () => ({ matches: false }));
        enfocarPanel(el);
        expect(enfocar).toHaveBeenCalledWith({ preventScroll: true });
        expect(el).toHaveFocus();
        expect(el.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });
    });

    it('con «reducir movimiento» el desplazamiento es inmediato', () => {
        const el = panel();
        vi.stubGlobal('matchMedia', () => ({ matches: true }));
        enfocarPanel(el);
        expect(el.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' });
    });

    it('sin matchMedia ni scrollIntoView no falla', () => {
        const el = panel();
        el.scrollIntoView = undefined;
        vi.stubGlobal('matchMedia', undefined);
        expect(() => enfocarPanel(el)).not.toThrow();
        expect(el).toHaveFocus();
    });

    it('sin elemento no hace nada', () => {
        expect(() => enfocarPanel(null)).not.toThrow();
    });
});
