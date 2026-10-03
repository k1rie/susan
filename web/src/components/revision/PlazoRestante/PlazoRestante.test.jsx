// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PlazoRestante from './PlazoRestante.jsx';
import { formatearPlazo, segundosActuales } from './plazoRestante.utils.js';

describe('plazo restante', () => {
    it('formatea horas y minutos', () => {
        expect(formatearPlazo(31 * 3600 + 12 * 60)).toBe('Quedan 31 h 12 min');
        expect(formatearPlazo(42 * 60)).toBe('Quedan 42 min');
        expect(formatearPlazo(10)).toBe('Quedan 1 min');
    });
    it('vence en cero o negativo', () => {
        expect(formatearPlazo(0)).toBe('Plazo vencido');
        expect(formatearPlazo(-5)).toBe('Plazo vencido');
        expect(formatearPlazo(NaN)).toBe('Plazo vencido');
    });
    it('descuenta el tiempo local transcurrido', () => {
        expect(segundosActuales(600, 1000, 1000 + 120000)).toBe(480);
        expect(segundosActuales(60, 0, 120000)).toBe(-60);
    });
    it('el componente muestra Plazo vencido', () => {
        render(<PlazoRestante venceEn="2026-09-16T09:00:00-06:00" segundosRestantes={0} />);
        expect(screen.getByText('Plazo vencido')).toBeInTheDocument();
    });
});
