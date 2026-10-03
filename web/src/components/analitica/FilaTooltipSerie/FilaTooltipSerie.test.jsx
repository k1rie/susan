// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CONFIG_SERIE } from '../analitica.utils.js';
import FilaTooltipSerie, { formatterSerie } from './index.js';

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
});

describe('formatterSerie', () => {
    const formatear = formatterSerie(CONFIG_SERIE);
    it('con un número usa la etiqueta de la configuración y la forma de la serie', () => {
        const { container } = render(formatear(14.3, 'proyeccion', { dataKey: 'proyeccion', color: 'rojo' }));
        expect(screen.getByText('Proyección')).toBeInTheDocument();
        expect(screen.getByText('14.3 %')).toBeInTheDocument();
        expect(container.querySelector('[data-forma]')).toHaveAttribute('data-forma', 'discontinua');
    });
    it('con un arreglo arma el rango [inferior, superior] de la banda', () => {
        render(formatear([10, 18], 'banda', { dataKey: 'banda' }));
        expect(screen.getByText('Intervalo 95 %')).toBeInTheDocument();
        expect(screen.getByText('10.0 % a 18.0 %')).toBeInTheDocument();
    });
    it('con un nulo muestra guion y con una serie desconocida usa el nombre y el color del item', () => {
        const { container } = render(formatear(null, 'otra', { dataKey: 'otra', color: 'var(--chart-2)' }));
        expect(screen.getByText('otra')).toBeInTheDocument();
        expect(screen.getByText('-')).toBeInTheDocument();
        expect(container.querySelector('[data-forma]').style.backgroundColor).toBe('var(--chart-2)');
    });
    it('sin item tampoco revienta', () => {
        render(formatear(5, 'x'));
        expect(screen.getByText('5.0 %')).toBeInTheDocument();
    });
});
