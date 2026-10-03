// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StatCard from './StatCard.jsx';

afterEach(() => vi.unstubAllGlobals());

describe('StatCard', () => {
    it('muestra la cifra y la etiqueta; con href es un enlace', () => {
        render(<StatCard label="Alumnos activos" value={75} href="/admin/alumnos" />);
        expect(screen.getByRole('link')).toHaveAttribute('href', '/admin/alumnos');
        expect(screen.getByText('75')).toBeInTheDocument();
        expect(screen.getByText('Alumnos activos')).toBeInTheDocument();
    });
    it('loading muestra un guion y marca aria-busy', () => {
        const { container } = render(<StatCard label="x" value={5} loading />);
        expect(container.firstChild).toHaveAttribute('aria-busy', 'true');
        expect(screen.getByText('-')).toBeInTheDocument();
    });
    it('animated con reducir movimiento deja la cifra final (lectores de pantalla leen siempre el final)', () => {
        vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
        render(<StatCard label="Docentes" value={2} animated />);
        expect(screen.getAllByText('2').length).toBeGreaterThan(0);
        expect(screen.getAllByText('2')[0]).toHaveClass('sr-only');
    });
    it('animated con un valor no numérico lo muestra tal cual', () => {
        render(<StatCard label="Estado" value="OK" animated />);
        expect(screen.getByText('OK')).toBeInTheDocument();
    });
});
