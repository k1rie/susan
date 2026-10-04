// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CONFIG_ACUMULADO, CONFIG_SERIE } from '../analitica.utils.js';
import FilaTooltipSerie, { renderFilaSerie } from './index.js';

describe('FilaTooltipSerie', () => {
    it('un número se muestra como porcentaje con un decimal', () => {
        render(<FilaTooltipSerie etiqueta="Ajuste" valor={12.5} color="var(--chart-1)" forma="linea" />);
        expect(screen.getByText('Ajuste')).toBeInTheDocument();
        expect(screen.getByText('12.5 %')).toBeInTheDocument();
    });
    it('un arreglo (banda) se muestra como rango y un nulo como guion', () => {
        const { rerender } = render(<FilaTooltipSerie etiqueta="Intervalo 95 %" valor={[8, 12.25]} />);
        expect(screen.getByText('8.0 % a 12.3 %')).toBeInTheDocument();
        rerender(<FilaTooltipSerie etiqueta="Proyección" valor={null} />);
        expect(screen.getByText('-')).toBeInTheDocument();
    });
    it('el valor no se parte en dos líneas (se parte la etiqueta antes)', () => {
        render(<FilaTooltipSerie etiqueta="Intervalo 95 %" valor={[8, 12.25]} />);
        expect(screen.getByText('8.0 % a 12.3 %').className).toContain('whitespace-nowrap');
    });
});

describe('renderFilaSerie (renderFila de GraficaLinea)', () => {
    const renderFila = renderFilaSerie(CONFIG_SERIE);
    // `serie` es el objeto que recibe GraficaLinea por props: clave, etiqueta y el token de color.
    const serie = (clave, config = CONFIG_SERIE) => ({ clave, etiqueta: config[clave].label, color: config[clave].color });

    it('con un número usa la etiqueta de la serie y la forma de la configuración', () => {
        const { container } = render(renderFila({ serie: serie('proyeccion'), valor: 14.3, fila: {} }));
        expect(screen.getByText('Proyección')).toBeInTheDocument();
        expect(screen.getByText('14.3 %')).toBeInTheDocument();
        expect(container.querySelector('[data-forma]')).toHaveAttribute('data-forma', 'discontinua');
    });
    it('la muestra lleva el mismo color con el que la gráfica pinta la serie (tono vivo de gráfica)', () => {
        const { container } = render(renderFila({ serie: serie('ajuste'), valor: 10, fila: {} }));
        expect(container.querySelector('[data-forma]').style.backgroundColor).toBe('var(--g-azul)');
    });
    it('con un arreglo arma el rango [inferior, superior] de la banda', () => {
        render(renderFila({ serie: serie('banda'), valor: [10, 18], fila: {} }));
        expect(screen.getByText('Intervalo 95 %')).toBeInTheDocument();
        expect(screen.getByText('10.0 % a 18.0 %')).toBeInTheDocument();
    });
    it('con un nulo muestra guion; una serie que la configuración no conoce usa su propia etiqueta y color', () => {
        const { container } = render(renderFila({ serie: { clave: 'otra', etiqueta: 'Otra', color: 'var(--chart-2)' }, valor: null, fila: {} }));
        expect(screen.getByText('Otra')).toBeInTheDocument();
        expect(screen.getByText('-')).toBeInTheDocument();
        expect(container.querySelector('[data-forma]').style.backgroundColor).toBe('var(--g-dorado)');
    });
    it('sin serie tampoco revienta, y el acumulado reutiliza las formas', () => {
        render(renderFila({ serie: undefined, valor: 5 }));
        expect(screen.getByText('5.0 %')).toBeInTheDocument();
        const { container } = render(renderFilaSerie(CONFIG_ACUMULADO)({ serie: serie('acumulado', CONFIG_ACUMULADO), valor: 3, fila: {} }));
        expect(container.querySelector('[data-forma]')).toHaveAttribute('data-forma', 'punto');
    });
});
