// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FormActions from './FormActions.jsx';
import { textoCambios } from './formActions.utils.js';

describe('textoCambios', () => {
    it('booleano, número y texto propio', () => {
        expect(textoCambios(false)).toBeNull();
        expect(textoCambios(0)).toBeNull();
        expect(textoCambios(true)).toBe('Cambios sin guardar');
        expect(textoCambios(1)).toBe('1 cambio sin guardar');
        expect(textoCambios(3)).toBe('3 cambios sin guardar');
        expect(textoCambios(true, 'Borrador sin enviar')).toBe('Borrador sin enviar');
        expect(textoCambios(false, 'Borrador sin enviar')).toBeNull();
    });
});

describe('FormActions', () => {
    it('muestra los botones y no escribe estado cuando no hay nada que decir', () => {
        render(
            <FormActions>
                <button>Cancelar</button>
                <button>Guardar</button>
            </FormActions>,
        );
        expect(screen.getByText('Cancelar')).toBeInTheDocument();
        expect(screen.getByText('Guardar')).toBeInTheDocument();
        expect(screen.queryByText(/sin guardar/)).toBeNull();
    });

    it('indica los cambios sin guardar (booleano o conteo) con texto, no solo con color', () => {
        const { rerender } = render(<FormActions dirty><button>Guardar</button></FormActions>);
        expect(screen.getByText('Cambios sin guardar')).toBeInTheDocument();
        rerender(<FormActions dirty={2}><button>Guardar</button></FormActions>);
        expect(screen.getByText('2 cambios sin guardar')).toBeInTheDocument();
        rerender(<FormActions dirty dirtyText="Hay cambios"><button>Guardar</button></FormActions>);
        expect(screen.getByText('Hay cambios')).toBeInTheDocument();
        rerender(<FormActions dirty={false}><button>Guardar</button></FormActions>);
        expect(screen.queryByText(/cambios/i)).toBeNull();
    });

    it('repite junto al botón el motivo por el que no se puede guardar, en una región aria-live', () => {
        render(
            <FormActions motivoBloqueo="Falta la matrícula del alumno">
                <button disabled>Crear alumno</button>
            </FormActions>,
        );
        const motivo = screen.getByText('Falta la matrícula del alumno');
        expect(motivo.closest('[aria-live="polite"]')).not.toBeNull();
        expect(screen.getByText('Crear alumno')).toBeDisabled();
    });

    it('la región aria-live existe aunque no haya estado, para que el primer mensaje se anuncie', () => {
        const { container } = render(<FormActions><button>Guardar</button></FormActions>);
        expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
    });

    it('muestra el resumen de lo que va a pasar', () => {
        render(
            <FormActions summary="Se inscribirán 3 alumnos">
                <button>Inscribir 3 alumnos</button>
            </FormActions>,
        );
        expect(screen.getByText('Se inscribirán 3 alumnos')).toBeInTheDocument();
    });

    it('sticky: por omisión en móvil sobre la barra inferior; contenedor, false y flat cambian el pegado', () => {
        const { container, rerender } = render(<FormActions><button>Guardar</button></FormActions>);
        expect(container.firstChild.className).toContain('sticky');
        expect(container.firstChild.className).toContain('safe-area-inset-bottom');
        expect(container.firstChild.className).toContain('lg:static');
        rerender(<FormActions sticky="contenedor"><button>Guardar</button></FormActions>);
        expect(container.firstChild.className).toContain('sticky bottom-0');
        rerender(<FormActions sticky={false}><button>Guardar</button></FormActions>);
        expect(container.firstChild.className).not.toContain('sticky');
        rerender(<FormActions flat><button>Guardar</button></FormActions>);
        expect(container.firstChild.className).not.toContain('sticky');
        expect(container.firstChild.className).not.toContain('border-t');
    });

    it('align controla dónde quedan los botones en pantallas anchas', () => {
        const { container, rerender } = render(<FormActions><button>Guardar</button></FormActions>);
        expect(container.firstChild.className).toContain('sm:justify-end');
        rerender(<FormActions align="start"><button>Guardar</button></FormActions>);
        expect(container.firstChild.className).toContain('sm:justify-start');
        rerender(<FormActions align="between"><button>Guardar</button></FormActions>);
        expect(container.firstChild.className).toContain('sm:justify-between');
    });

    it('stacked apila el estado sobre los botones en cualquier ancho (sin fila desde sm)', () => {
        const { container, rerender } = render(<FormActions dirty={2}><button>Guardar</button></FormActions>);
        const raiz = () => container.firstChild;
        const estado = () => container.querySelector('[aria-live="polite"]');
        expect(raiz().className).toContain('sm:flex-row');
        expect(estado().className).toContain('sm:flex-1');
        rerender(<FormActions dirty={2} stacked><button>Guardar</button></FormActions>);
        expect(raiz().className).toContain('flex-col');
        expect(raiz().className).not.toContain('sm:flex-row');
        expect(raiz().className).not.toContain('sm:justify-end');
        expect(estado().className).not.toContain('sm:flex-1');
        // Los botones conservan el reparto de ancho también desde sm.
        expect(raiz().lastChild.className).toContain('[&>*]:flex-1');
        expect(raiz().lastChild.className).not.toContain('sm:[&>*]:flex-none');
        expect(screen.getByText('2 cambios sin guardar')).toBeInTheDocument();
    });

    it('sin stacked la fila se parte sola cuando el estado no cabe: flex-wrap y un ancho mínimo para el estado', () => {
        const { container } = render(<FormActions dirty={12}><button>Guardar</button></FormActions>);
        expect(container.firstChild.className).toContain('sm:flex-wrap');
        expect(container.querySelector('[aria-live="polite"]').className).toContain('sm:min-w-40');
    });

    it('el texto de cambios se parte por palabras (nunca letra a letra): min-w-0, whitespace-normal, text-balance y sin break-all', () => {
        const { container } = render(<FormActions dirty={12}><button>Guardar</button></FormActions>);
        const texto = screen.getByText('12 cambios sin guardar');
        expect(texto).toHaveClass('min-w-0', 'text-balance');
        const estado = container.querySelector('[aria-live="polite"]');
        expect(estado).toHaveClass('min-w-0', 'whitespace-normal', 'break-words');
        expect(container.innerHTML).not.toContain('break-all');
    });
});
