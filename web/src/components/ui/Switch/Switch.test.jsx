// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import Field from '../Field/Field.jsx';
import Switch from './Switch.jsx';

function Controlado(props) {
    const [activo, setActivo] = useState(false);
    return <Switch checked={activo} onChange={setActivo} {...props} />;
}

describe('Switch', () => {
    it('es role="switch" con aria-checked y el nombre de su etiqueta', () => {
        render(<Switch label="Reconstrucción completa" checked={false} onChange={() => {}} />);
        const interruptor = screen.getByRole('switch', { name: 'Reconstrucción completa' });
        expect(interruptor).toHaveAttribute('aria-checked', 'false');
    });

    it('al pulsar llama a onChange con el valor nuevo (booleano, no evento)', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const { rerender } = render(<Switch label="Activo" checked={false} onChange={onChange} />);
        await user.click(screen.getByRole('switch'));
        expect(onChange).toHaveBeenLastCalledWith(true);
        rerender(<Switch label="Activo" checked onChange={onChange} />);
        await user.click(screen.getByRole('switch'));
        expect(onChange).toHaveBeenLastCalledWith(false);
    });

    it('pulsar el texto alterna y Espacio/Enter también', async () => {
        const user = userEvent.setup();
        render(<Controlado label="Notificar" />);
        const interruptor = screen.getByRole('switch');
        await user.click(screen.getByText('Notificar'));
        expect(interruptor).toHaveAttribute('aria-checked', 'true');
        interruptor.focus();
        await user.keyboard(' ');
        expect(interruptor).toHaveAttribute('aria-checked', 'false');
        await user.keyboard('{Enter}');
        expect(interruptor).toHaveAttribute('aria-checked', 'true');
    });

    it('escribe el estado con texto (no solo color) y admite textos propios', () => {
        const { rerender } = render(<Switch label="Estatus" checked={false} onChange={() => {}} />);
        expect(screen.getByText('Desactivado')).toBeInTheDocument();
        rerender(<Switch label="Estatus" checked onChange={() => {}} onLabel="Activa" offLabel="Inactiva" />);
        expect(screen.getByText('Activa')).toBeInTheDocument();
        rerender(<Switch label="Estatus" checked onChange={() => {}} showState={false} />);
        expect(screen.queryByText('Activado')).toBeNull();
    });

    it('hint se enlaza como descripción', () => {
        render(<Switch label="Cámara" hint="Deja de capturar mientras esté apagada" checked onChange={() => {}} />);
        expect(screen.getByRole('switch')).toHaveAccessibleDescription('Deja de capturar mientras esté apagada');
    });

    it('deshabilitado no responde', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Switch label="Bloqueado" disabled checked={false} onChange={onChange} />);
        await user.click(screen.getByText('Bloqueado'));
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByRole('switch')).toBeDisabled();
    });

    it('name agrega un campo oculto con true/false', () => {
        const { container, rerender } = render(<Switch label="A" name="activo" checked={false} onChange={() => {}} />);
        expect(container.querySelector('input[type="hidden"][name="activo"]')).toHaveValue('false');
        rerender(<Switch label="A" name="activo" checked onChange={() => {}} />);
        expect(container.querySelector('input[type="hidden"][name="activo"]')).toHaveValue('true');
    });

    it('sin etiqueta acepta aria-label y funciona dentro de Field', () => {
        render(<Switch aria-label="Modo prueba" checked={false} onChange={() => {}} />);
        expect(screen.getByRole('switch', { name: 'Modo prueba' })).toBeInTheDocument();
        render(
            <Field label="Cámara frontal">
                <Switch checked={false} onChange={() => {}} />
            </Field>,
        );
        expect(screen.getByLabelText('Cámara frontal')).toHaveAttribute('role', 'switch');
    });
});
