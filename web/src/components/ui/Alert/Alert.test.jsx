// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Alert from './Alert.jsx';

describe('Alert', () => {
    it('danger y warning se anuncian como alert; info y success como status', () => {
        const { rerender } = render(<Alert tone="danger">Falló</Alert>);
        expect(screen.getByRole('alert')).toHaveTextContent('Falló');
        rerender(<Alert tone="warning">Ojo</Alert>);
        expect(screen.getByRole('alert')).toBeInTheDocument();
        rerender(<Alert tone="info">Dato</Alert>);
        expect(screen.getByRole('status')).toBeInTheDocument();
        rerender(<Alert tone="success">Listo</Alert>);
        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('muestra el título y el botón Cerrar', async () => {
        const onClose = vi.fn();
        render(<Alert title="Título" onClose={onClose}>Cuerpo</Alert>);
        expect(screen.getByText('Título')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('compact reduce el relleno y el icono sin cambiar el contenido ni los roles', () => {
        const { rerender } = render(<Alert tone="danger" title="T">x</Alert>);
        const normal = screen.getByRole('alert').className;
        expect(normal).toContain('p-3.5');
        rerender(<Alert tone="danger" title="T" compact>x</Alert>);
        const compacta = screen.getByRole('alert');
        expect(compacta.className).toContain('p-2.5');
        expect(compacta.className).not.toContain('p-3.5');
        expect(compacta).toHaveTextContent('Tx');
        expect(compacta.querySelector('svg').getAttribute('class')).toContain('size-4');
    });
});
