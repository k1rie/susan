// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import DialogoMotivo from './DialogoMotivo.jsx';

function abrir(props = {}) {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
        <DialogoMotivo
            titulo="Rechazar solicitud"
            mensaje="Rechazarás la solicitud de Ana."
            etiqueta="Motivo del rechazo"
            obligatorio
            etiquetaConfirmar="Rechazar solicitud"
            onConfirm={onConfirm}
            onClose={onClose}
            {...props}
        />,
    );
    return { onConfirm, onClose };
}

describe('DialogoMotivo obligatorio (rechazar y cancelar)', () => {
    it('abre con el foco en el campo, el contador en 0/300 y el mensaje de contexto', () => {
        abrir();
        expect(screen.getByRole('dialog', { name: 'Rechazar solicitud' })).toBeInTheDocument();
        expect(screen.getByLabelText(/Motivo del rechazo/)).toHaveFocus();
        expect(screen.getByLabelText(/Motivo del rechazo/)).toHaveAttribute('maxlength', '300');
        expect(screen.getByText('0/300')).toBeInTheDocument();
        expect(screen.getByText('Rechazarás la solicitud de Ana.')).toBeInTheDocument();
    });

    it('sin motivo no confirma: marca el campo, explica el mínimo y deja el foco en él', async () => {
        const user = userEvent.setup();
        const { onConfirm } = abrir();
        await user.click(screen.getByRole('button', { name: 'Rechazar solicitud' }));
        expect(onConfirm).not.toHaveBeenCalled();
        expect(screen.getByText('Escribe el motivo: mínimo 3 caracteres.')).toBeInTheDocument();
        expect(screen.getByLabelText(/Motivo del rechazo/)).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText(/Motivo del rechazo/)).toHaveFocus();
    });

    it('con dos caracteres tampoco confirma; con tres sí, y manda el texto recortado', async () => {
        const user = userEvent.setup();
        const { onConfirm } = abrir();
        const campo = screen.getByLabelText(/Motivo del rechazo/);
        await user.type(campo, '  ab ');
        await user.click(screen.getByRole('button', { name: 'Rechazar solicitud' }));
        expect(onConfirm).not.toHaveBeenCalled();
        await user.type(campo, 'c');
        // El error desaparece en cuanto el texto es válido.
        expect(screen.queryByText('Escribe el motivo: mínimo 3 caracteres.')).toBeNull();
        await user.click(screen.getByRole('button', { name: 'Rechazar solicitud' }));
        await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('ab c'));
    });

    it('pasar de largo por el campo vacío no lo pinta de rojo; el contador sigue lo escrito', async () => {
        const user = userEvent.setup();
        abrir();
        await user.tab();
        expect(screen.queryByText('Escribe el motivo: mínimo 3 caracteres.')).toBeNull();
        await user.type(screen.getByLabelText(/Motivo del rechazo/), 'Cruce con examen');
        expect(screen.getByText('16/300')).toBeInTheDocument();
    });

    it('si el servidor rechaza, muestra su mensaje, sigue abierto y conserva lo escrito', async () => {
        const user = userEvent.setup();
        const onConfirm = vi.fn().mockRejectedValue(new Error('No se pudo conectar con el servidor.'));
        const { onClose } = abrir({ onConfirm });
        await user.type(screen.getByLabelText(/Motivo del rechazo/), 'Cruce con examen');
        await user.click(screen.getByRole('button', { name: 'Rechazar solicitud' }));
        expect(await screen.findByText('No se pudo conectar con el servidor.')).toBeInTheDocument();
        expect(screen.getByLabelText(/Motivo del rechazo/)).toHaveValue('Cruce con examen');
        expect(onClose).not.toHaveBeenCalled();
    });

    it('«Cancelar» cierra sin confirmar', async () => {
        const user = userEvent.setup();
        const { onConfirm, onClose } = abrir();
        await user.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(onClose).toHaveBeenCalled();
        expect(onConfirm).not.toHaveBeenCalled();
    });
});

describe('DialogoMotivo opcional (aprobar)', () => {
    it('el campo se rotula opcional y confirma vacío', async () => {
        const user = userEvent.setup();
        const { onConfirm } = abrir({ titulo: 'Aprobar solicitud', etiqueta: 'Comentario para el docente', obligatorio: false, etiquetaConfirmar: 'Aprobar solicitud' });
        expect(screen.getByText('(opcional)')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Aprobar solicitud' }));
        await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(''));
    });
});
