// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BarraFaltas from './BarraFaltas.jsx';
import { calcularBarra, nivelBarra } from './barraFaltas.utils.js';

describe('geometría de la barra', () => {
    it('la marca del límite queda en 2/3 con escala 1.5x', () => {
        const b = calcularBarra(10, 20);
        expect(b.marca).toBeCloseTo(66.67, 1);
        expect(b.relleno).toBeCloseTo(33.33, 1);
    });
    it('si supera el límite la escala crece y el relleno llega al 100 %', () => {
        const b = calcularBarra(40, 20);
        expect(b.relleno).toBe(100);
        expect(b.marca).toBe(50);
    });
    it('nivel según banderas de la base o, en su defecto, el porcentaje', () => {
        expect(nivelBarra(10, 20, { superaLimite: false, enLimite: true })).toBe('limite');
        expect(nivelBarra(25, 20, { superaLimite: true })).toBe('excedido');
        expect(nivelBarra(20, 20, {})).toBe('ok');
        expect(nivelBarra(21, 20, {})).toBe('excedido');
    });
});

describe('BarraFaltas', () => {
    it('muestra porcentaje, marca del límite y estado como texto', () => {
        render(<BarraFaltas porcentaje={18.75} limitePct={20} enLimite superaLimite={false} />);
        const barra = screen.getByRole('progressbar');
        expect(barra).toHaveAttribute('data-nivel', 'limite');
        expect(screen.getByTestId('marca-limite')).toBeInTheDocument();
        expect(screen.getByText(/18\.75 % de faltas · límite 20 %/)).toHaveTextContent('En el límite');
    });
    it('indica límite superado', () => {
        render(<BarraFaltas porcentaje={25} limitePct={20} superaLimite />);
        expect(screen.getByRole('progressbar')).toHaveAttribute('data-nivel', 'excedido');
        expect(screen.getByText(/Límite superado/)).toBeInTheDocument();
    });
});
