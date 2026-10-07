// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ConfirmDialog from './ConfirmDialog.jsx';

describe('ConfirmDialog · sin motivo (compatibilidad)', () => {
    it('onConfirm se llama sin argumentos y no hay campo de texto', async () => {
        const user = userEvent.setup();
        const onConfirm = vi.fn();
        render(<ConfirmDialog open title="Borrar" message="Seguro" confirmLabel="Sí" onConfirm={onConfirm} onCancel={() => {}} />);
        expect(screen.queryByRole('textbox')).toBeNull();
        await user.click(screen.getByText('Sí'));
        expect(onConfirm).toHaveBeenCalledWith();
    });
});

describe('ConfirmDialog · reason', () => {
    const base = { open: true, title: 'Rechazar justificante', confirmLabel: 'Rechazar', variant: 'danger' };

    it('muestra el campo con su etiqueta, recibe el foco inicial y entrega el texto sin espacios sobrantes', async () => {
        const user = userEvent.setup();
        const onConfirm = vi.fn();
        render(<ConfirmDialog {...base} reason={{ label: 'Comentario para el alumno' }} onConfirm={onConfirm} onCancel={() => {}} />);
        const campo = screen.getByLabelText(/Comentario para el alumno/);
        expect(campo).toHaveFocus();
        await user.type(campo, '  Falta el sello  ');
        await user.click(screen.getByText('Rechazar'));
        expect(onConfirm).toHaveBeenCalledWith('Falta el sello');
    });

    it('usa «Motivo» por omisión y es opcional: confirma con texto vacío', async () => {
        const user = userEvent.setup();
        const onConfirm = vi.fn();
        render(<ConfirmDialog {...base} reason={{}} onConfirm={onConfirm} onCancel={() => {}} />);
        expect(screen.getByLabelText(/Motivo/)).toBeInTheDocument();
        await user.click(screen.getByText('Rechazar'));
        expect(onConfirm).toHaveBeenCalledWith('');
    });

    it('con required no confirma sin texto: marca el campo, avisa y lo enfoca', async () => {
        const user = userEvent.setup();
        const onConfirm = vi.fn();
        render(<ConfirmDialog {...base} reason={{ required: true }} onConfirm={onConfirm} onCancel={() => {}} />);
        await user.click(screen.getByText('Rechazar'));
        expect(onConfirm).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent('Escribe el motivo para continuar.');
        expect(screen.getByLabelText(/Motivo/)).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText(/Motivo/)).toHaveFocus();
        await user.type(screen.getByLabelText(/Motivo/), 'x');
        expect(screen.queryByRole('alert')).toBeNull();
        await user.click(screen.getByText('Rechazar'));
        expect(onConfirm).toHaveBeenCalledWith('x');
    });

    it('con required fallido el Textarea queda inválido (aria-invalid, borde destructivo) y enlazado al mensaje con aria-describedby', async () => {
        const user = userEvent.setup();
        render(<ConfirmDialog {...base} reason={{ required: true }} onConfirm={() => {}} onCancel={() => {}} />);
        const campo = screen.getByLabelText(/Motivo/);
        // Antes de intentar confirmar no hay marca de error.
        expect(campo).not.toHaveAttribute('aria-invalid');
        expect(campo).not.toHaveClass('border-destructive');
        await user.click(screen.getByText('Rechazar'));
        const error = screen.getByRole('alert');
        expect(campo).toHaveAttribute('aria-invalid', 'true');
        expect(campo).toHaveClass('border-destructive');
        expect(campo.getAttribute('aria-describedby')).toContain(error.id);
        expect(campo).toHaveAccessibleDescription('Escribe el motivo para continuar.');
        // Al escribir se limpia todo.
        await user.type(campo, 'x');
        expect(campo).not.toHaveAttribute('aria-invalid');
        expect(campo).not.toHaveClass('border-destructive');
        expect(campo).not.toHaveAttribute('aria-describedby', expect.stringContaining('error'));
    });

    it('sin required, un motivo vacío no marca el campo como inválido', async () => {
        const user = userEvent.setup();
        render(<ConfirmDialog {...base} reason={{}} onConfirm={() => {}} onCancel={() => {}} />);
        await user.click(screen.getByText('Rechazar'));
        expect(screen.getByLabelText(/Motivo/)).not.toHaveAttribute('aria-invalid');
    });

    it('un motivo solo de espacios cuenta como vacío', async () => {
        const user = userEvent.setup();
        const onConfirm = vi.fn();
        render(<ConfirmDialog {...base} reason={{ required: true }} onConfirm={onConfirm} onCancel={() => {}} />);
        await user.type(screen.getByLabelText(/Motivo/), '   ');
        await user.click(screen.getByText('Rechazar'));
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('maxLength limita el texto y muestra el contador', async () => {
        const user = userEvent.setup();
        render(<ConfirmDialog {...base} reason={{ maxLength: 5 }} onConfirm={() => {}} onCancel={() => {}} />);
        await user.type(screen.getByLabelText(/Motivo/), 'abcdefgh');
        expect(screen.getByLabelText(/Motivo/)).toHaveValue('abcde');
        expect(screen.getByText('5/5')).toBeInTheDocument();
    });

    it('cada vez que se abre empieza vacío', () => {
        const props = { ...base, reason: { required: true }, onConfirm: () => {}, onCancel: () => {} };
        const { rerender } = render(<ConfirmDialog {...props} />);
        fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'algo' } });
        rerender(<ConfirmDialog {...props} open={false} />);
        rerender(<ConfirmDialog {...props} open />);
        expect(screen.getByLabelText(/Motivo/)).toHaveValue('');
    });

    it('mientras la promesa está pendiente deshabilita el campo', async () => {
        const user = userEvent.setup();
        let resolver;
        const onConfirm = vi.fn(() => new Promise((r) => { resolver = r; }));
        render(<ConfirmDialog {...base} reason={{}} onConfirm={onConfirm} onCancel={() => {}} />);
        await user.type(screen.getByLabelText(/Motivo/), 'ok');
        await user.click(screen.getByText('Rechazar'));
        expect(screen.getByLabelText(/Motivo/)).toBeDisabled();
        resolver();
        await screen.findByText('Rechazar');
    });
});
