// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserPlus } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import SuccessState from './SuccessState.jsx';

describe('SuccessState', () => {
    it('muestra título y descripción, y enfoca el título al aparecer', () => {
        render(<SuccessState title="Grupo 3A creado" description="Ya puedes inscribir alumnos." />);
        const titulo = screen.getByRole('heading', { name: 'Grupo 3A creado' });
        expect(titulo).toHaveFocus();
        expect(screen.getByText('Ya puedes inscribir alumnos.')).toBeInTheDocument();
    });

    it('focusOnMount=false no roba el foco y se anuncia como status', () => {
        render(<SuccessState title="Listo" focusOnMount={false} />);
        expect(screen.getByRole('heading', { name: 'Listo' })).not.toHaveFocus();
        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('lleva el icono de éxito de Lucide como decoración por omisión', () => {
        const { container } = render(<SuccessState title="Listo" />);
        const svg = container.querySelector('svg');
        expect(svg).not.toBeNull();
        expect(svg.closest('[aria-hidden="true"]')).not.toBeNull();
    });

    it('acepta el icono como componente o como nodo', () => {
        const { container, rerender } = render(<SuccessState title="Listo" icon={UserPlus} />);
        expect(container.querySelector('svg')).not.toBeNull();
        rerender(<SuccessState title="Listo" icon={<span data-testid="mio">!</span>} />);
        expect(screen.getByTestId('mio')).toBeInTheDocument();
    });

    it('steps: tarjetas con enlace, con onClick y marcadas como recomendadas o hechas', async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();
        render(
            <SuccessState
                title="Alumno creado"
                steps={[
                    { label: 'Tomar fotos de la plantilla', description: 'Para reconocerlo en el aula', href: '/admin/alumnos/7', recommended: true },
                    { label: 'Inscribirlo a un grupo', onClick },
                    { label: 'Registrar datos', done: true },
                ]}
            />,
        );
        const lista = screen.getByRole('list');
        expect(lista).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Tomar fotos de la plantilla/ })).toHaveAttribute('href', '/admin/alumnos/7');
        expect(screen.getByText('Recomendado')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /Inscribirlo a un grupo/ }));
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Hecho')).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /Registrar datos/ })).toBeNull();
        expect(screen.queryByRole('button', { name: /Registrar datos/ })).toBeNull();
    });

    it('actions: la primera es primaria; admite href y onClick', async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();
        render(
            <SuccessState
                title="Listo"
                actions={[
                    { label: 'Ir a la lista', href: '/admin/alumnos' },
                    { label: 'Crear otro', onClick },
                ]}
            />,
        );
        expect(screen.getByRole('link', { name: 'Ir a la lista' })).toHaveAttribute('href', '/admin/alumnos');
        expect(screen.getByRole('link', { name: 'Ir a la lista' }).className).toContain('bg-primary');
        const otro = screen.getByRole('button', { name: 'Crear otro' });
        expect(otro.className).not.toContain('bg-primary');
        await user.click(otro);
        expect(onClick).toHaveBeenCalled();
    });

    it('sin steps ni actions no dibuja listas ni botones vacíos', () => {
        render(<SuccessState title="Listo" />);
        expect(screen.queryByRole('list')).toBeNull();
        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.queryByRole('link')).toBeNull();
    });

    it('por omisión recorta título y descripción de cada paso a una línea', () => {
        render(<SuccessState title="Listo" steps={[{ label: 'Registrar el consentimiento firmado', description: 'Adjunta el PDF firmado', href: '/x' }]} />);
        expect(screen.getByText('Registrar el consentimiento firmado')).toHaveClass('truncate');
        expect(screen.getByText('Adjunta el PDF firmado')).toHaveClass('truncate');
    });

    it('wrap permite dos líneas (line-clamp-2) en las tarjetas de siguientes pasos; el paso puede decidir por sí mismo', () => {
        render(
            <SuccessState
                title="Listo"
                wrap
                steps={[
                    { label: 'Registrar el consentimiento firmado', description: 'Adjunta el PDF firmado', href: '/x' },
                    { label: 'Paso corto', description: 'Una línea', href: '/y', wrap: false },
                ]}
            />,
        );
        expect(screen.getByText('Registrar el consentimiento firmado')).toHaveClass('line-clamp-2', 'break-words');
        expect(screen.getByText('Adjunta el PDF firmado')).toHaveClass('line-clamp-2');
        expect(screen.getByText('Paso corto')).toHaveClass('truncate');
    });
});
