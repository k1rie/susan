// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DataState from './DataState.jsx';
import { vacioPorDefecto } from './dataState.utils.js';

const hijos = (d) => <p>datos: {d.length ?? d.items.length}</p>;

describe('DataState', () => {
    it('error sin datos muestra ErrorState con mensaje y reintento', () => {
        render(<DataState error={{ message: 'Falló' }} data={null} onRetry={() => {}}>{hijos}</DataState>);
        expect(screen.getByRole('alert')).toHaveTextContent('Falló');
        expect(screen.getByText('Reintentar')).toBeInTheDocument();
    });

    it('cargando sin datos muestra el fallback', () => {
        render(<DataState loading data={undefined}>{hijos}</DataState>);
        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('datos vacíos muestran el estado vacío', () => {
        render(<DataState data={[]}>{hijos}</DataState>);
        expect(screen.getByText('Sin resultados')).toBeInTheDocument();
        expect(vacioPorDefecto({ items: [] })).toBe(true);
        expect(vacioPorDefecto({ total: 1 })).toBe(false);
    });

    it('con datos renderiza children, incluso refrescando o con error previo', () => {
        const { rerender } = render(<DataState data={[1, 2]}>{hijos}</DataState>);
        expect(screen.getByText('datos: 2')).toBeInTheDocument();
        rerender(<DataState data={[1, 2]} loading error={{ message: 'x' }}>{hijos}</DataState>);
        expect(screen.getByText('datos: 2')).toBeInTheDocument();
    });

    it('NO_AUTENTICADO ofrece iniciar sesión', () => {
        render(<DataState error={{ code: 'NO_AUTENTICADO', message: 'Sesión' }} data={null}>{hijos}</DataState>);
        expect(screen.getByText('Iniciar sesión')).toHaveAttribute('href', '/login');
    });
});
