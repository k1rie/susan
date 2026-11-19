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

    describe('detección en vivo', () => {
        it('dice con texto cuántos rostros se ven, en singular y plural', () => {
            const { rerender } = render(<VistaCamara estado="reconociendo" deteccion={{ estado: 'listo', cantidad: 1 }} />);
            expect(screen.getByText('1 rostro detectado')).toBeInTheDocument();
            rerender(<VistaCamara estado="reconociendo" deteccion={{ estado: 'listo', cantidad: 3 }} />);
            expect(screen.getByText('3 rostros detectados')).toBeInTheDocument();
        });

        it('con el detector listo y nadie a la vista lo dice (no se queda mudo)', () => {
            render(<VistaCamara deteccion={{ estado: 'listo', cantidad: 0 }} />);
            expect(screen.getByText('Sin rostros a la vista')).toHaveAttribute('data-rostros', '0');
        });

        it('avisa mientras prepara el detector y si no está disponible', () => {
            const { rerender } = render(<VistaCamara deteccion={{ estado: 'cargando', cantidad: 0 }} />);
            expect(screen.getByText('Preparando detección…')).toBeInTheDocument();
            rerender(<VistaCamara deteccion={{ estado: 'no-disponible', cantidad: 0 }} />);
            expect(screen.getByText('Detección en vivo no disponible')).toBeInTheDocument();
        });

        it('sin detección, o con la cámara apagada, no hay chip', () => {
            const { container, rerender } = render(<VistaCamara />);
            expect(container.querySelector('[data-deteccion]')).toBeNull();
            rerender(<VistaCamara deteccion={{ estado: 'inactivo', cantidad: 0 }} />);
            expect(container.querySelector('[data-deteccion]')).toBeNull();
        });

        it('no añade otro role="status": el único sigue siendo el del estado del reconocimiento', () => {
            render(<VistaCamara estado="reconociendo" deteccion={{ estado: 'listo', cantidad: 2 }} />);
            expect(screen.getAllByRole('status')).toHaveLength(1);
        });

        it('con enmarcar dibuja los recuadros sobre el contenido (lienzo simulado)', () => {
            const { container } = render(
                <VistaCamara enmarcar marcos={[{ x: 0.1, y: 0.1, ancho: 0.1, alto: 0.2 }]} deteccion={{ estado: 'listo', cantidad: 1 }}>
                    <canvas role="img" aria-label="Lienzo" />
                </VistaCamara>,
            );
            expect(container.querySelectorAll('[data-marco-rostro]')).toHaveLength(1);
        });

        it('los iconos del chip son decorativos', () => {
            const { container } = render(<VistaCamara deteccion={{ estado: 'cargando', cantidad: 0 }} />);
            container.querySelectorAll('svg').forEach((svg) => expect(svg).toHaveAttribute('aria-hidden', 'true'));
        });
    });
});
