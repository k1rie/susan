// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { useCierreContenedor } from '@/hooks/ui/useCierreContenedor.js';
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

describe('Modal · DOM por defecto', () => {
    it('sin las ampliaciones no agrega botón de cerrar ni pregunta nada', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<Modal open onClose={onClose} title="T" footer={<button>Fin</button>}><input aria-label="campo" /></Modal>);
        expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Fin']);
        await user.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(screen.getAllByRole('dialog')).toHaveLength(1);
    });
});

describe('Modal · botón cerrar y pantalla completa', () => {
    it('showClose agrega una X con nombre accesible, al final del DOM para que el foco inicial caiga en el primer campo', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<Modal open onClose={onClose} title="T" showClose footer={<button>Fin</button>}><input aria-label="campo" /></Modal>);
        const cerrar = screen.getByRole('button', { name: 'Cerrar' });
        expect(screen.getByLabelText('campo')).toHaveFocus();
        const botones = screen.getAllByRole('button');
        expect(botones[botones.length - 1]).toBe(cerrar);
        await user.click(cerrar);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('size="full-mobile" muestra la X y marca el diálogo como pantalla completa en teléfono', () => {
        render(<Modal open onClose={() => {}} title="T" size="full-mobile" footer={<button>Fin</button>}>x</Modal>);
        expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
        expect(screen.getByRole('dialog').className).toContain('h-dvh');
        expect(screen.getByRole('dialog').className).toContain('sm:max-w-lg');
    });

    it('fullMobile conserva el tamaño pedido en pantallas anchas', () => {
        render(<Modal open onClose={() => {}} title="T" size="lg" fullMobile>x</Modal>);
        expect(screen.getByRole('dialog').className).toContain('h-dvh');
        expect(screen.getByRole('dialog').className).toContain('sm:max-w-3xl');
    });

    it('el pie puede ser una función que recibe cerrar', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<Modal open onClose={onClose} title="T" footer={({ cerrar }) => <button onClick={cerrar}>Cancelar</button>}>x</Modal>);
        await user.click(screen.getByText('Cancelar'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});

describe('Modal · cambios sin guardar (dirty)', () => {
    function Caso({ dirty = true, onDiscard, onClose = () => {} }) {
        const [abierto, setAbierto] = useState(true);
        return (
            <>
                <button>Fuera</button>
                <Modal
                    open={abierto}
                    dirty={dirty}
                    onDiscard={onDiscard}
                    onClose={() => { onClose(); setAbierto(false); }}
                    title="Nueva aula"
                    showClose
                    footer={({ cerrar }) => <button onClick={cerrar}>Cancelar</button>}
                >
                    <input aria-label="Clave" />
                </Modal>
            </>
        );
    }

    it('Esc pide confirmar; «Seguir editando» conserva el modal y no llama a onClose', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<Caso onClose={onClose} />);
        await user.keyboard('{Escape}');
        const confirmacion = screen.getByRole('dialog', { name: '¿Descartar los cambios?' });
        expect(within(confirmacion).getByText('Seguir editando')).toHaveFocus();
        await user.click(within(confirmacion).getByText('Seguir editando'));
        expect(screen.queryByRole('dialog', { name: '¿Descartar los cambios?' })).toBeNull();
        expect(screen.getByRole('dialog', { name: 'Nueva aula' })).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('al confirmar el descarte llama a onDiscard y luego a onClose', async () => {
        const user = userEvent.setup();
        const orden = [];
        render(<Caso onDiscard={() => orden.push('descartar')} onClose={() => orden.push('cerrar')} />);
        await user.keyboard('{Escape}');
        await user.click(screen.getByText('Descartar cambios'));
        expect(orden).toEqual(['descartar', 'cerrar']);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('el clic en el fondo, la X y Cancelar piden confirmar igual que Esc', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<Caso onClose={onClose} />);
        // Fondo.
        fireEvent.mouseDown(screen.getByRole('dialog', { name: 'Nueva aula' }).parentElement);
        expect(screen.getByRole('dialog', { name: '¿Descartar los cambios?' })).toBeInTheDocument();
        await user.click(screen.getByText('Seguir editando'));
        // X.
        await user.click(screen.getByRole('button', { name: 'Cerrar' }));
        expect(screen.getByRole('dialog', { name: '¿Descartar los cambios?' })).toBeInTheDocument();
        await user.click(screen.getByText('Seguir editando'));
        // Cancelar del pie.
        await user.click(screen.getByText('Cancelar'));
        expect(screen.getByRole('dialog', { name: '¿Descartar los cambios?' })).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('Esc dentro de la confirmación cierra solo la confirmación', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<Caso onClose={onClose} />);
        await user.keyboard('{Escape}');
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog', { name: '¿Descartar los cambios?' })).toBeNull();
        expect(screen.getByRole('dialog', { name: 'Nueva aula' })).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('con la confirmación abierta Tab recorre sus dos botones sin saltar al formulario', async () => {
        const user = userEvent.setup();
        render(<Caso />);
        await user.keyboard('{Escape}');
        expect(screen.getByText('Seguir editando')).toHaveFocus();
        await user.tab();
        expect(screen.getByText('Descartar cambios')).toHaveFocus();
        await user.tab();
        expect(screen.getByText('Seguir editando')).toHaveFocus();
        await user.tab({ shift: true });
        expect(screen.getByText('Descartar cambios')).toHaveFocus();
    });

    it('sin dirty cierra directo', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<Caso dirty={false} onClose={onClose} />);
        await user.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('¿Descartar los cambios?')).toBeNull();
    });

    it('closeDisabled ignora Esc, fondo, X y Cancelar', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(
            <Modal open onClose={onClose} closeDisabled showClose title="T" footer={({ cerrar }) => <button onClick={cerrar}>Cancelar</button>}>
                x
            </Modal>,
        );
        await user.keyboard('{Escape}');
        await user.click(screen.getByRole('button', { name: 'Cerrar' }));
        await user.click(screen.getByText('Cancelar'));
        fireEvent.mouseDown(screen.getByRole('dialog').parentElement);
        expect(onClose).not.toHaveBeenCalled();
    });

    it('el contenido puede cerrar por la misma ruta con useCierreContenedor', async () => {
        const user = userEvent.setup();
        function Interno() {
            const { enContenedor, cerrar } = useCierreContenedor();
            return <button onClick={cerrar}>{enContenedor ? 'Salir' : 'Sin contenedor'}</button>;
        }
        render(<Modal open dirty onClose={() => {}} title="T"><Interno /></Modal>);
        await user.click(screen.getByText('Salir'));
        expect(screen.getByRole('dialog', { name: '¿Descartar los cambios?' })).toBeInTheDocument();
    });

    it('una confirmación pendiente no reaparece al reabrir el modal', async () => {
        const user = userEvent.setup();
        function Reabrir() {
            const [abierto, setAbierto] = useState(true);
            return (
                <>
                    <button onClick={() => setAbierto(true)}>Abrir</button>
                    <Modal open={abierto} dirty onClose={() => setAbierto(false)} title="T">x</Modal>
                    <button onClick={() => setAbierto(false)}>Cerrar por fuera</button>
                </>
            );
        }
        render(<Reabrir />);
        await user.keyboard('{Escape}');
        expect(screen.getByRole('dialog', { name: '¿Descartar los cambios?' })).toBeInTheDocument();
        fireEvent.click(screen.getByText('Cerrar por fuera'));
        fireEvent.click(screen.getByText('Abrir'));
        expect(screen.queryByRole('dialog', { name: '¿Descartar los cambios?' })).toBeNull();
        expect(screen.getByRole('dialog', { name: 'T' })).toBeInTheDocument();
    });
});

describe('Modal · portal a document.body', () => {
    it('se dibuja fuera del árbol DOM de quien lo declara: dentro de una celda de tabla no hereda su alineación', async () => {
        const user = userEvent.setup();
        function EnTabla() {
            const [abierto, setAbierto] = useState(false);
            return (
                <table>
                    <tbody>
                        <tr>
                            <td data-testid="celda" style={{ textAlign: 'right' }}>
                                <button onClick={() => setAbierto(true)}>Cambiar rol</button>
                                <Modal open={abierto} onClose={() => setAbierto(false)} title="Cambiar rol">
                                    <input aria-label="campo" />
                                </Modal>
                            </td>
                        </tr>
                    </tbody>
                </table>
            );
        }
        const { container } = render(<EnTabla />);
        await user.click(screen.getByText('Cambiar rol'));
        const dialogo = screen.getByRole('dialog', { name: 'Cambiar rol' });
        expect(container.contains(dialogo)).toBe(false);
        expect(screen.getByTestId('celda').contains(dialogo)).toBe(false);
        expect(dialogo.closest('body')).toBe(document.body);
        // La capa (fondo + diálogo) es hija directa del body: ningún ancestro de la página le pasa estilos heredables.
        expect(dialogo.parentElement.parentElement).toBe(document.body);
        // Sigue siendo accesible y funcional.
        expect(screen.getByLabelText('campo')).toHaveFocus();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(screen.getByText('Cambiar rol')).toHaveFocus();
    });

    it('limpia el portal al cerrar y al desmontar (no deja capas huérfanas en el body)', async () => {
        const { rerender, unmount } = render(<Modal open onClose={() => {}} title="T">x</Modal>);
        expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(1);
        rerender(<Modal open={false} onClose={() => {}} title="T">x</Modal>);
        expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(0);
        rerender(<Modal open onClose={() => {}} title="T">x</Modal>);
        unmount();
        expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    });

    it('los eventos y el contexto siguen el árbol de React: un clic dentro llega al onClick del padre y Esc cierra solo el de arriba', async () => {
        const user = userEvent.setup();
        const alClicPadre = vi.fn();
        render(
            <div onClick={alClicPadre}>
                <Modal open dirty onClose={() => {}} title="T"><button>Dentro</button></Modal>
            </div>,
        );
        await user.click(screen.getByText('Dentro'));
        expect(alClicPadre).toHaveBeenCalled();
        await user.keyboard('{Escape}');
        // El descarte (otro portal, encima) atiende el Esc siguiente y el modal de abajo sigue abierto.
        expect(screen.getAllByRole('dialog')).toHaveLength(2);
        const dialogos = Array.from(document.body.querySelectorAll('[role="dialog"]'));
        expect(dialogos[dialogos.length - 1]).toHaveAccessibleName('¿Descartar los cambios?');
    });

    it('en el servidor (y al hidratar) no dibuja nada: sin document no hay portal', () => {
        expect(renderToString(<Modal open onClose={() => {}} title="T">contenido</Modal>)).toBe('');
    });

    it('en Strict Mode abre una sola vez, con el foco en el primer campo y sin blur', async () => {
        const user = userEvent.setup();
        const onBlur = vi.fn();
        function Panel() {
            const [abierto, setAbierto] = useState(false);
            return (
                <>
                    <button onClick={() => setAbierto(true)}>Abrir</button>
                    {abierto && (
                        <Modal open onClose={() => setAbierto(false)} title="T">
                            <input aria-label="primero" onBlur={onBlur} />
                        </Modal>
                    )}
                </>
            );
        }
        render(
            <StrictMode>
                <Panel />
            </StrictMode>,
        );
        await user.click(screen.getByText('Abrir'));
        expect(screen.getAllByRole('dialog')).toHaveLength(1);
        expect(screen.getByLabelText('primero')).toHaveFocus();
        expect(onBlur).not.toHaveBeenCalled();
    });
});
