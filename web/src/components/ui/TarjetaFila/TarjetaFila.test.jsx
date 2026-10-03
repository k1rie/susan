// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { Check, Users } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import TarjetaFila from './TarjetaFila.jsx';

describe('TarjetaFila', () => {
    it('muestra título, subtítulo, contenido extra y la acción', () => {
        render(
            <TarjetaFila icono={Users} tono="azul" titulo="Matemáticas (5C)" subtitulo="Aula B-04" accion={<button type="button" aria-label="Abrir"><Check /></button>}>
                <span>extra</span>
            </TarjetaFila>,
        );
        expect(screen.getByText('Matemáticas (5C)')).toBeInTheDocument();
        expect(screen.getByText('Aula B-04')).toBeInTheDocument();
        expect(screen.getByText('extra')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Abrir' })).toBeInTheDocument();
    });
    it('con href toda la fila es un enlace; sin href es un contenedor', () => {
        const { rerender } = render(<TarjetaFila titulo="Fila" href="/destino" />);
        expect(screen.getByRole('link')).toHaveAttribute('href', '/destino');
        rerender(<TarjetaFila titulo="Fila" />);
        expect(screen.queryByRole('link')).toBeNull();
    });
    it('un tono desconocido usa el neutro y no rompe', () => {
        const { container } = render(<TarjetaFila icono={Users} tono="nada" titulo="x" />);
        expect(container.querySelector('.bg-tono-azul')).toBeNull();
    });
});
