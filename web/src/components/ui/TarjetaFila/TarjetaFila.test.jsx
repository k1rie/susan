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

    it('por omisión título y subtítulo van en una sola línea con «…» (truncate)', () => {
        render(<TarjetaFila titulo="Título muy largo" subtitulo="Subtítulo muy largo" />);
        expect(screen.getByText('Título muy largo')).toHaveClass('block', 'truncate');
        expect(screen.getByText('Subtítulo muy largo')).toHaveClass('block', 'truncate');
    });

    it('lineas={2} permite dos líneas con line-clamp y parte las palabras largas, sin truncate', () => {
        render(<TarjetaFila lineas={2} titulo="Registrar el consentimiento firmado" subtitulo="Adjunta el PDF para que quede en el expediente" />);
        for (const nodo of [screen.getByText('Registrar el consentimiento firmado'), screen.getByText(/Adjunta el PDF/)]) {
            expect(nodo).toHaveClass('line-clamp-2', 'break-words');
            expect(nodo).not.toHaveClass('truncate');
            // line-clamp ya fija el display: no lleva `block` (dos `display` chocarían).
            expect(nodo).not.toHaveClass('block');
        }
    });

    it('lineas 3 y «todas», y un valor desconocido vuelve a una línea', () => {
        const { rerender } = render(<TarjetaFila lineas={3} titulo="A" subtitulo="B" />);
        expect(screen.getByText('A')).toHaveClass('line-clamp-3');
        rerender(<TarjetaFila lineas="todas" titulo="A" subtitulo="B" />);
        expect(screen.getByText('A')).toHaveClass('break-words');
        expect(screen.getByText('A')).not.toHaveClass('truncate', 'line-clamp-2');
        rerender(<TarjetaFila lineas={9} titulo="A" subtitulo="B" />);
        expect(screen.getByText('A')).toHaveClass('truncate');
    });
});
