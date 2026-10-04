// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import VistaCamara from './VistaCamara.jsx';

describe('VistaCamara', () => {
    it.each([
        ['reconociendo', 'Reconociendo'],
        ['pausa', 'En pausa'],
        ['fuera', 'Fuera de la ventana'],
    ])('el estado %s se dice con texto «%s»', (estado, texto) => {
        render(<VistaCamara estado={estado}><video aria-label="Vista previa de la cámara" /></VistaCamara>);
        const chip = screen.getByRole('status');
        expect(chip).toHaveTextContent(texto);
        expect(chip).toHaveAttribute('data-estado', estado);
    });

    it('un estado desconocido cae en «En pausa»', () => {
        render(<VistaCamara estado="otro" />);
        expect(screen.getByRole('status')).toHaveTextContent('En pausa');
    });

    it('con enmarcar mete el contenido en una caja 16:9 redondeada', () => {
        render(<VistaCamara estado="reconociendo" enmarcar><canvas aria-label="Lienzo" role="img" /></VistaCamara>);
        const caja = screen.getByRole('img', { name: 'Lienzo' }).parentElement;
        expect(caja).toHaveClass('aspect-video', 'rounded-xl', 'overflow-hidden');
    });

    it('sin enmarcar deja el contenido tal cual (ya trae su caja)', () => {
        render(<VistaCamara><div data-testid="propia" /></VistaCamara>);
        expect(screen.getByTestId('propia').parentElement).not.toHaveClass('aspect-video');
    });

    it('muestra la cámara de origen y, simulada, lo dice con texto y no con el nombre de la cámara', () => {
        const { rerender } = render(<VistaCamara etiquetaFuente="Cámara frente" />);
        expect(screen.getByText('Cámara frente')).toBeInTheDocument();
        rerender(<VistaCamara etiquetaFuente="Cámara frente" simulada />);
        expect(screen.getByText('Cámara simulada')).toBeInTheDocument();
        expect(screen.queryByText('Cámara frente')).toBeNull();
    });

    it('los chips no estorban a los controles (no reciben clics) y sus iconos son decorativos', () => {
        const { container } = render(<VistaCamara estado="reconociendo" etiquetaFuente="Cámara frente" />);
        expect(container.querySelector('.pointer-events-none')).not.toBeNull();
        container.querySelectorAll('svg').forEach((svg) => expect(svg).toHaveAttribute('aria-hidden', 'true'));
    });
});
