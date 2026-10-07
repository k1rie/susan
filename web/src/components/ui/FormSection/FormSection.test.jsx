// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import FormSection from './FormSection.jsx';

describe('FormSection', () => {
    it('es un grupo (fieldset) nombrado por su título y descrito por la ayuda', () => {
        render(
            <FormSection title="Identidad" description="Datos con los que se reconoce al alumno">
                <input aria-label="Matrícula" />
            </FormSection>,
        );
        const grupo = screen.getByRole('group', { name: 'Identidad' });
        expect(grupo.tagName).toBe('FIELDSET');
        expect(grupo).toHaveAccessibleDescription('Datos con los que se reconoce al alumno');
        expect(screen.getByLabelText('Matrícula')).toBeInTheDocument();
    });

    it('rotula lo opcional con la palabra, no con asterisco', () => {
        render(<FormSection title="Contacto" optional><input aria-label="Teléfono" /></FormSection>);
        expect(screen.getByText('(opcional)')).toBeInTheDocument();
    });

    it('columns define la rejilla según el ancho del contenedor (1 columna en el más angosto)', () => {
        const { container, rerender } = render(<FormSection title="A"><input aria-label="x" /></FormSection>);
        const rejilla = () => container.querySelector('.grid');
        expect(rejilla().className).toContain('grid-cols-1');
        expect(rejilla().className).not.toContain('@md:grid-cols-2');
        rerender(<FormSection title="A" columns={2}><input aria-label="x" /></FormSection>);
        expect(rejilla().className).toContain('@md:grid-cols-2');
        rerender(<FormSection title="A" columns={3}><input aria-label="x" /></FormSection>);
        expect(rejilla().className).toContain('@2xl:grid-cols-3');
        expect(container.querySelector('.\\@container')).not.toBeNull();
    });

    it('plegable: el botón pliega y despliega sin desmontar los campos (no se pierde lo capturado)', async () => {
        const user = userEvent.setup();
        render(
            <FormSection title="Avanzado" collapsible defaultOpen={false} summary="Sin cambios">
                <input aria-label="Observaciones" defaultValue="texto previo" />
            </FormSection>,
        );
        const boton = screen.getByRole('button', { name: /Avanzado/ });
        expect(boton).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getByText('Sin cambios')).toBeInTheDocument();
        expect(screen.getByLabelText('Observaciones', { hidden: true })).not.toBeVisible();
        await user.click(boton);
        expect(boton).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByLabelText('Observaciones')).toBeVisible();
        expect(screen.getByLabelText('Observaciones')).toHaveValue('texto previo');
        expect(screen.queryByText('Sin cambios')).toBeNull();
        await user.click(boton);
        expect(screen.getByLabelText('Observaciones', { hidden: true })).toHaveValue('texto previo');
    });

    it('si aparece un error dentro de una sección plegada se abre y marca «Revisar»', () => {
        const { rerender } = render(
            <FormSection title="Avanzado" collapsible defaultOpen={false}>
                <input aria-label="Observaciones" />
            </FormSection>,
        );
        expect(screen.getByLabelText('Observaciones', { hidden: true })).not.toBeVisible();
        rerender(
            <FormSection title="Avanzado" collapsible defaultOpen={false} error>
                <input aria-label="Observaciones" />
            </FormSection>,
        );
        expect(screen.getByLabelText('Observaciones')).toBeVisible();
        expect(screen.getByText('Revisar')).toBeInTheDocument();
    });
});
