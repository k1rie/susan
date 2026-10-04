// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MuestraSerie from './index.js';

describe('MuestraSerie', () => {
    it('cada forma se distingue sin depender del color y se oculta a los lectores de pantalla', () => {
        const { container } = render(
            <>
                <MuestraSerie forma="linea" color="var(--chart-1)" />
                <MuestraSerie forma="discontinua" color="var(--chart-1)" />
                <MuestraSerie forma="banda" color="var(--chart-1)" />
                <MuestraSerie forma="punto" color="var(--chart-1)" />
                <MuestraSerie forma="inexistente" color="var(--chart-1)" />
            </>,
        );
        const muestras = [...container.querySelectorAll('[data-forma]')];
        expect(muestras.map((m) => m.dataset.forma)).toEqual(['linea', 'discontinua', 'banda', 'punto', 'punto']);
        muestras.forEach((m) => expect(m).toHaveAttribute('aria-hidden', 'true'));
        expect(muestras[1].className).toContain('border-dashed');
        expect(muestras[2].className).toContain('opacity-30');
        // el color solo viene de un token (nunca hex)
        expect(muestras[0].style.backgroundColor).toBe('var(--chart-1)');
        expect(muestras[1].style.borderColor).toBe('var(--chart-1)');
    });
    it('mide lo mismo que las muestras de la leyenda de GraficaLinea (punto de 10 px)', () => {
        const { container } = render(<MuestraSerie forma="punto" color="var(--foreground)" className="extra" />);
        expect(container.firstChild.className).toContain('size-2.5');
        expect(container.firstChild.className).toContain('extra');
    });
});
