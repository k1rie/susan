// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { useCierreContenedor } from '@/hooks/ui/useCierreContenedor.js';
import PanelLateral from './PanelLateral.jsx';

function Caso({ dirty = false, onDiscard, onClose = () => {}, ...resto }) {
    const [abierto, setAbierto] = useState(false);
    return (
        <>
            <button onClick={() => setAbierto(true)}>Nueva aula</button>
            <PanelLateral
                open={abierto}
                dirty={dirty}
                onDiscard={onDiscard}
                onClose={() => {
                    onClose();
                    setAbierto(false);
                }}
                title="Nueva aula"
                description="Registra el aula y su capacidad"
                footer={({ cerrar }) => (
                    <>
                        <button onClick={cerrar}>Cancelar</button>
                        <button>Crear aula</button>
                    </>
                )}
                {...resto}
            >
                <input aria-label="Clave" />
                <input aria-label="Edificio" />
            </PanelLateral>
        </>
    );
}

describe('PanelLateral', () => {
    it('cerrado no renderiza nada', () => {
        render(<PanelLateral open={false} onClose={() => {}} title="T">x</PanelLateral>);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('abierto es un diálogo modal con título, descripción, cuerpo con scroll y pie', () => {
        render(<PanelLateral open onClose={() => {}} title="Nueva aula" description="Registra el aula" footer={<button>Crear aula</button>}><input aria-label="Clave" /></PanelLateral>);
        const dialogo = screen.getByRole('dialog', { name: 'Nueva aula' });
        expect(dialogo).toHaveAttribute('aria-modal', 'true');
        expect(dialogo).toHaveAccessibleDescription('Registra el aula');
        expect(within(dialogo).getByLabelText('Clave')).toBeInTheDocument();
        expect(within(dialogo).getByRole('button', { name: 'Crear aula' })).toBeInTheDocument();
        expect(dialogo.className).toContain('h-dvh');
        expect(dialogo.className).toContain('sm:max-w-lg');
        expect(dialogo.querySelector('footer').className).toContain('safe-area-inset-bottom');
    });

    it('el foco inicial va al primer campo (no a la X) y vuelve al botón que lo abrió', async () => {
        const user = userEvent.setup();
        render(<Caso />);
        const abrir = screen.getByText('Nueva aula', { selector: 'button' });
        await user.click(abrir);
        expect(screen.getByLabelText('Clave')).toHaveFocus();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(abrir).toHaveFocus();
    });

    it('atrapa el foco con Tab (incluida la X, que es lo último del DOM)', async () => {
        const user = userEvent.setup();
        render(<Caso />);
        await user.click(screen.getByText('Nueva aula', { selector: 'button' }));
        await user.tab();
        expect(screen.getByLabelText('Edificio')).toHaveFocus();
        await user.tab();
        expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
        await user.tab();
        expect(screen.getByRole('button', { name: 'Crear aula' })).toHaveFocus();
        await user.tab();
        expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
        await user.tab();
        expect(screen.getByLabelText('Clave')).toHaveFocus();
    });

    it('la X, el fondo, Esc y Cancelar cierran cuando no hay cambios', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<Caso onClose={onClose} />);
        const abrir = () => user.click(screen.getByText('Nueva aula', { selector: 'button' }));
        await abrir();
        await user.click(screen.getByRole('button', { name: 'Cerrar' }));
        await abrir();
        fireEvent.mouseDown(screen.getByRole('dialog').parentElement);
        await abrir();
        await user.click(screen.getByRole('button', { name: 'Cancelar' }));
        await abrir();
        await user.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledTimes(4);
    });

    it('showClose={false} oculta la X; closeOnOverlay={false} ignora el fondo', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<PanelLateral open onClose={onClose} title="T" showClose={false} closeOnOverlay={false}>x</PanelLateral>);
        expect(screen.queryByRole('button', { name: 'Cerrar' })).toBeNull();
        fireEvent.mouseDown(screen.getByRole('dialog').parentElement);
        expect(onClose).not.toHaveBeenCalled();
        await user.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('size cambia el ancho en escritorio', () => {
        const { rerender } = render(<PanelLateral open onClose={() => {}} title="T" size="sm">x</PanelLateral>);
        expect(screen.getByRole('dialog').className).toContain('sm:max-w-md');
        rerender(<PanelLateral open onClose={() => {}} title="T" size="lg">x</PanelLateral>);
        expect(screen.getByRole('dialog').className).toContain('sm:max-w-2xl');
    });
});

describe('PanelLateral · cambios sin guardar', () => {
    it('con dirty pide confirmar por cualquier vía de cierre; «Seguir editando» conserva el panel', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<Caso dirty onClose={onClose} />);
        await user.click(screen.getByText('Nueva aula', { selector: 'button' }));
        await user.keyboard('{Escape}');
        expect(screen.getByRole('dialog', { name: '¿Descartar los cambios?' })).toBeInTheDocument();
        await user.click(screen.getByText('Seguir editando'));
        await user.click(screen.getByRole('button', { name: 'Cerrar' }));
        expect(screen.getByRole('dialog', { name: '¿Descartar los cambios?' })).toBeInTheDocument();
        await user.click(screen.getByText('Seguir editando'));
        await user.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(screen.getByRole('dialog', { name: '¿Descartar los cambios?' })).toBeInTheDocument();
        await user.click(screen.getByText('Seguir editando'));
        fireEvent.mouseDown(screen.getByRole('dialog', { name: 'Nueva aula' }).parentElement);
        expect(screen.getByRole('dialog', { name: '¿Descartar los cambios?' })).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('al descartar llama a onDiscard y luego a onClose', async () => {
        const user = userEvent.setup();
        const orden = [];
        render(<Caso dirty onDiscard={() => orden.push('descartar')} onClose={() => orden.push('cerrar')} />);
        await user.click(screen.getByText('Nueva aula', { selector: 'button' }));
        await user.keyboard('{Escape}');
        await user.click(screen.getByText('Descartar cambios'));
        expect(orden).toEqual(['descartar', 'cerrar']);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('closeDisabled bloquea el cierre mientras se guarda', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<PanelLateral open onClose={onClose} closeDisabled title="T">x</PanelLateral>);
        await user.keyboard('{Escape}');
        await user.click(screen.getByRole('button', { name: 'Cerrar' }));
        expect(onClose).not.toHaveBeenCalled();
    });

    it('useCierreContenedor entrega el cierre del panel al contenido', async () => {
        const user = userEvent.setup();
        function Interno() {
            const { enContenedor, cerrar } = useCierreContenedor();
            return <button onClick={cerrar}>{enContenedor ? 'Salir del panel' : 'x'}</button>;
        }
        render(<PanelLateral open dirty onClose={() => {}} title="T"><Interno /></PanelLateral>);
        await user.click(screen.getByText('Salir del panel'));
        expect(screen.getByRole('dialog', { name: '¿Descartar los cambios?' })).toBeInTheDocument();
    });
});

describe('PanelLateral · portal a document.body', () => {
    it('abierto desde una celda de tabla se dibuja en el body y no hereda su alineación', async () => {
        const user = userEvent.setup();
        function EnTabla() {
            const [abierto, setAbierto] = useState(false);
            return (
                <table>
                    <tbody>
                        <tr>
                            <td data-testid="celda" style={{ textAlign: 'right' }}>
                                <button onClick={() => setAbierto(true)}>Editar</button>
                                <PanelLateral open={abierto} onClose={() => setAbierto(false)} title="Editar aula">
                                    <input aria-label="clave" />
                                </PanelLateral>
                            </td>
                        </tr>
                    </tbody>
                </table>
            );
        }
        const { container } = render(<EnTabla />);
        await user.click(screen.getByText('Editar'));
        const panel = screen.getByRole('dialog', { name: 'Editar aula' });
        expect(container.contains(panel)).toBe(false);
        expect(panel.parentElement.parentElement).toBe(document.body);
        expect(screen.getByLabelText('clave')).toHaveFocus();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(screen.getByText('Editar')).toHaveFocus();
    });

    it('en el servidor (y al hidratar) no dibuja nada', () => {
        expect(renderToString(<PanelLateral open onClose={() => {}} title="T">contenido</PanelLateral>)).toBe('');
    });

    it('en Strict Mode, un panel que se monta ya abierto NO abre con el primer campo «tocado» (sin blur al abrir)', async () => {
        const user = userEvent.setup();
        const onBlur = vi.fn();
        function Panel() {
            const [abierto, setAbierto] = useState(false);
            return (
                <>
                    <button onClick={() => setAbierto(true)}>Abrir</button>
                    {abierto && (
                        <PanelLateral open onClose={() => setAbierto(false)} title="Nueva aula">
                            <input aria-label="clave" onBlur={onBlur} />
                        </PanelLateral>
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
        expect(screen.getByLabelText('clave')).toHaveFocus();
        expect(onBlur).not.toHaveBeenCalled();
        await user.keyboard('{Escape}');
        expect(screen.getByText('Abrir')).toHaveFocus();
    });
});
