// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MarcosRostros from './MarcosRostros.jsx';

describe('MarcosRostros', () => {
    it('dibuja un recuadro por rostro, colocado con translate en % y medido en % de la vista', () => {
        const { container } = render(<MarcosRostros marcos={[{ x: 0.25, y: 0.1, ancho: 0.2, alto: 0.4 }, { x: 0.6, y: 0.5, ancho: 0.1, alto: 0.2 }]} />);
        const capas = container.querySelectorAll('[data-marco-rostro]');
        expect(capas).toHaveLength(2);
        expect(capas[0].style.transform).toBe('translate(25%, 10%)');
        expect(capas[0].firstElementChild.style.width).toBe('20%');
        expect(capas[0].firstElementChild.style.height).toBe('40%');
        expect(capas[1].style.transform).toBe('translate(60%, 50%)');
    });

    it('es decorativo, no recibe clics y su movimiento se apaga con «reducir movimiento»', () => {
        const { container } = render(<MarcosRostros marcos={[{ x: 0, y: 0, ancho: 0.5, alto: 0.5 }]} />);
        expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
        expect(container.firstElementChild).toHaveClass('pointer-events-none');
        const capa = container.querySelector('[data-marco-rostro]');
        expect(capa).toHaveClass('motion-safe:transition-transform');
        expect(capa.className).not.toMatch(/(^|\s)transition-transform/);
    });

    it('sin rostros no dibuja nada', () => {
        const { container } = render(<MarcosRostros />);
        expect(container.querySelectorAll('[data-marco-rostro]')).toHaveLength(0);
    });
});
