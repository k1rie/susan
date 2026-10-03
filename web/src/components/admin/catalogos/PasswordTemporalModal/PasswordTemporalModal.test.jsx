// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PasswordTemporalModal from './PasswordTemporalModal.jsx';

describe('PasswordTemporalModal', () => {
    it('muestra la contraseña y el aviso de una sola vez', () => {
        render(<PasswordTemporalModal open correo="a@b.mx" contrasena="Abc-123-xyz" onClose={() => {}} />);
        expect(screen.getByDisplayValue('Abc-123-xyz')).toBeInTheDocument();
        expect(screen.getByText('Se muestra una sola vez')).toBeInTheDocument();
        expect(screen.getByText('a@b.mx')).toBeInTheDocument();
    });

    it('no deja la contraseña en el DOM cuando está cerrado o sin valor', () => {
        const { rerender } = render(<PasswordTemporalModal open={false} contrasena="Secreta-1" onClose={() => {}} />);
        expect(screen.queryByDisplayValue('Secreta-1')).toBeNull();
        rerender(<PasswordTemporalModal open contrasena={null} onClose={() => {}} />);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('copia al portapapeles y avisa', async () => {
        const user = userEvent.setup();
        const writeText = vi.fn().mockResolvedValue();
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        render(<PasswordTemporalModal open contrasena="Abc-123-xyz" onClose={() => {}} />);
        await user.click(screen.getByRole('button', { name: 'Copiar' }));
        expect(writeText).toHaveBeenCalledWith('Abc-123-xyz');
        await waitFor(() => expect(screen.getByText('Copiada al portapapeles.')).toBeInTheDocument());
    });

    it('cerrar llama a onClose', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<PasswordTemporalModal open contrasena="Abc-123-xyz" onClose={onClose} />);
        await user.click(screen.getByRole('button', { name: /cerrar/i }));
        expect(onClose).toHaveBeenCalled();
    });
});
