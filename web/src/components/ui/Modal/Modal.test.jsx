// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog.jsx';
import Modal from './Modal.jsx';

describe('Modal', () => {
    it('no renderiza cerrado y expone role dialog con título', () => {
        const { rerender } = render(<Modal open={false} onClose={() => {}} title="Hola">x</Modal>);
        expect(screen.queryByRole('dialog')).toBeNull();
        rerender(<Modal open onClose={() => {}} title="Hola">x</Modal>);
        expect(screen.getByRole('dialog', { name: 'Hola' })).toBeInTheDocument();
    });

    it('enfoca el primer control, cierra con Escape y devuelve el foco', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        function Caso() {
            const [abierto, setAbierto] = useState(false);
            return (
                <>
                    <button onClick={() => setAbierto(true)}>Abrir</button>
                    <Modal open={abierto} onClose={() => { onClose(); setAbierto(false); }} title="T">
                        <input aria-label="campo" />
                    </Modal>
                </>
            );
        }
        render(<Caso />);
        const abrir = screen.getByText('Abrir');
        await user.click(abrir);
        expect(screen.getByLabelText('campo')).toHaveFocus();
        await user.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(abrir).toHaveFocus();
    });

    it('atrapa el foco con Tab', async () => {
        const user = userEvent.setup();
        render(<Modal open onClose={() => {}} title="T" footer={<button>Fin</button>}><input aria-label="uno" /></Modal>);
        expect(screen.getByLabelText('uno')).toHaveFocus();
        await user.tab();
        expect(screen.getByText('Fin')).toHaveFocus();
        await user.tab();
        expect(screen.getByLabelText('uno')).toHaveFocus();
    });
});

describe('ConfirmDialog', () => {
    it('foco inicial en Cancelar si es danger', () => {
        render(<ConfirmDialog open title="Borrar" variant="danger" onConfirm={() => {}} onCancel={() => {}} />);
        expect(screen.getByText('Cancelar')).toHaveFocus();
    });

    it('Escape llama onCancel', async () => {
        const user = userEvent.setup();
        const onCancel = vi.fn();
        render(<ConfirmDialog open title="X" onConfirm={() => {}} onCancel={onCancel} />);
        await user.keyboard('{Escape}');
        expect(onCancel).toHaveBeenCalled();
    });

    it('con promesa pendiente muestra loading y no cancela', async () => {
        const user = userEvent.setup();
        let resolver;
        const onConfirm = vi.fn(() => new Promise((r) => { resolver = r; }));
        const onCancel = vi.fn();
        render(<ConfirmDialog open title="X" confirmLabel="Si" onConfirm={onConfirm} onCancel={onCancel} />);
        await user.click(screen.getByText('Si').closest('button'));
        expect(screen.getByText('Si').closest('button')).toHaveAttribute('aria-busy', 'true');
        await user.keyboard('{Escape}');
        expect(onCancel).not.toHaveBeenCalled();
        resolver();
        await screen.findByText('Si');
    });
});
