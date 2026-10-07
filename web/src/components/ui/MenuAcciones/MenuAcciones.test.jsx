// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Modal from '../Modal/Modal.jsx';
import MenuAcciones from './MenuAcciones.jsx';
import { indicePorLetra, moverIndice, posicionMenu } from './menuAcciones.utils.js';

const items = (extra = {}) => [
    { label: 'Cambiar rol', onClick: extra.rol ?? (() => {}) },
    { label: 'Restablecer contraseña', onClick: extra.pass ?? (() => {}), disabled: extra.passDeshabilitado },
    { label: 'Desactivar', onClick: extra.desactivar ?? (() => {}), danger: true },
];

describe('menuAcciones.utils', () => {
    const lista = [{ label: 'Álbum' }, { label: 'Beta', disabled: true }, { label: 'Casa' }, { label: 'Cobre' }];
    it('moverIndice salta deshabilitados y da la vuelta', () => {
        expect(moverIndice(lista, 0, 1)).toBe(2);
        expect(moverIndice(lista, 3, 1)).toBe(0);
        expect(moverIndice(lista, 0, -1)).toBe(3);
        expect(moverIndice(lista, -1, 1)).toBe(0);
        expect(moverIndice(lista, -1, -1)).toBe(3);
        expect(moverIndice([{ label: 'x', disabled: true }], 0, 1)).toBe(-1);
    });
    it('indicePorLetra ignora acentos, mayúsculas y deshabilitados, y avanza entre coincidencias', () => {
        expect(indicePorLetra(lista, -1, 'a')).toBe(0);
        expect(indicePorLetra(lista, -1, 'b')).toBe(-1);
        expect(indicePorLetra(lista, 0, 'c')).toBe(2);
        expect(indicePorLetra(lista, 2, 'c')).toBe(3);
        expect(indicePorLetra(lista, 3, 'c')).toBe(2);
    });
    it('posicionMenu va debajo si cabe, arriba si no, y nunca fuera de la pantalla', () => {
        const vp = { ancho: 360, alto: 640 };
        expect(posicionMenu({ top: 100, bottom: 140, left: 300, right: 340 }, { viewport: vp, altoMenu: 128 })).toEqual({ top: 144, right: 20 });
        expect(posicionMenu({ top: 560, bottom: 600, left: 300, right: 340 }, { viewport: vp, altoMenu: 128 })).toEqual({ bottom: 84, right: 20 });
        expect(posicionMenu({ top: 100, bottom: 140, left: 330, right: 355 }, { viewport: vp, altoMenu: 128, alinear: 'start' })).toEqual({ top: 144, left: 176 });
        // Un botón pegado al borde izquierdo: el menú de 176 px no puede salirse por ese lado.
        expect(posicionMenu({ top: 100, bottom: 140, left: 0, right: 20 }, { viewport: vp, altoMenu: 128 }).right).toBe(176);
    });
});

describe('MenuAcciones', () => {
    it('el botón anuncia el menú y no muestra nada cerrado', () => {
        render(<MenuAcciones label="Acciones de Ana" items={items()} />);
        const boton = screen.getByRole('button', { name: 'Acciones de Ana' });
        expect(boton).toHaveAttribute('aria-haspopup', 'menu');
        expect(boton).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('menu')).toBeNull();
    });

    it('usa «Más acciones» por omisión', () => {
        render(<MenuAcciones items={items()} />);
        expect(screen.getByRole('button', { name: 'Más acciones' })).toBeInTheDocument();
    });

    it('al hacer clic abre el menú y enfoca el primer elemento', async () => {
        const user = userEvent.setup();
        render(<MenuAcciones items={items()} />);
        await user.click(screen.getByRole('button', { name: 'Más acciones' }));
        expect(screen.getByRole('menu')).toBeInTheDocument();
        expect(screen.getAllByRole('menuitem')).toHaveLength(3);
        expect(screen.getByRole('menuitem', { name: 'Cambiar rol' })).toHaveFocus();
        expect(screen.getByRole('button', { name: 'Más acciones' })).toHaveAttribute('aria-expanded', 'true');
    });

    it('↓ en el botón abre en el primero y ↑ en el último; las flechas dan la vuelta y saltan deshabilitados', async () => {
        const user = userEvent.setup();
        render(<MenuAcciones items={items({ passDeshabilitado: true })} />);
        screen.getByRole('button', { name: 'Más acciones' }).focus();
        await user.keyboard('{ArrowDown}');
        expect(screen.getByRole('menuitem', { name: 'Cambiar rol' })).toHaveFocus();
        await user.keyboard('{ArrowDown}');
        expect(screen.getByRole('menuitem', { name: 'Desactivar' })).toHaveFocus();
        await user.keyboard('{ArrowDown}');
        expect(screen.getByRole('menuitem', { name: 'Cambiar rol' })).toHaveFocus();
        await user.keyboard('{ArrowUp}');
        expect(screen.getByRole('menuitem', { name: 'Desactivar' })).toHaveFocus();
        await user.keyboard('{Home}');
        expect(screen.getByRole('menuitem', { name: 'Cambiar rol' })).toHaveFocus();
        await user.keyboard('{End}');
        expect(screen.getByRole('menuitem', { name: 'Desactivar' })).toHaveFocus();
        await user.keyboard('{Escape}');
        await user.keyboard('{ArrowUp}');
        expect(screen.getByRole('menuitem', { name: 'Desactivar' })).toHaveFocus();
    });

    it('una letra salta al elemento que empieza con ella', async () => {
        const user = userEvent.setup();
        render(<MenuAcciones items={items()} />);
        await user.click(screen.getByRole('button', { name: 'Más acciones' }));
        await user.keyboard('r');
        expect(screen.getByRole('menuitem', { name: 'Restablecer contraseña' })).toHaveFocus();
        await user.keyboard('d');
        expect(screen.getByRole('menuitem', { name: 'Desactivar' })).toHaveFocus();
    });

    it('Enter activa el elemento, cierra el menú y devuelve el foco al botón', async () => {
        const user = userEvent.setup();
        const rol = vi.fn();
        render(<MenuAcciones items={items({ rol })} />);
        await user.click(screen.getByRole('button', { name: 'Más acciones' }));
        await user.keyboard('{Enter}');
        expect(rol).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('menu')).toBeNull();
        expect(screen.getByRole('button', { name: 'Más acciones' })).toHaveFocus();
    });

    it('un elemento deshabilitado no se puede activar', async () => {
        const user = userEvent.setup();
        const pass = vi.fn();
        render(<MenuAcciones items={items({ pass, passDeshabilitado: true })} />);
        await user.click(screen.getByRole('button', { name: 'Más acciones' }));
        expect(screen.getByRole('menuitem', { name: 'Restablecer contraseña' })).toBeDisabled();
        await user.click(screen.getByRole('menuitem', { name: 'Restablecer contraseña' }));
        expect(pass).not.toHaveBeenCalled();
        expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('lo destructivo se distingue del resto', async () => {
        const user = userEvent.setup();
        render(<MenuAcciones items={items()} />);
        await user.click(screen.getByRole('button', { name: 'Más acciones' }));
        expect(screen.getByRole('menuitem', { name: 'Desactivar' }).className).toContain('text-destructive');
        expect(screen.getByRole('menuitem', { name: 'Cambiar rol' }).className).not.toContain('text-destructive');
    });

    it('Esc cierra y devuelve el foco; Tab cierra; el clic fuera cierra', async () => {
        const user = userEvent.setup();
        render(
            <>
                <MenuAcciones items={items()} />
                <button>Otro</button>
            </>,
        );
        const boton = screen.getByRole('button', { name: 'Más acciones' });
        await user.click(boton);
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('menu')).toBeNull();
        expect(boton).toHaveFocus();
        await user.click(boton);
        await user.keyboard('{Tab}');
        expect(screen.queryByRole('menu')).toBeNull();
        await user.click(boton);
        fireEvent.mouseDown(screen.getByText('Otro'));
        expect(screen.queryByRole('menu')).toBeNull();
    });

    it('Esc dentro de un diálogo cierra solo el menú, no el diálogo', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(
            <Modal open onClose={onClose} title="Usuarios">
                <MenuAcciones items={items()} />
            </Modal>,
        );
        await user.click(screen.getByRole('button', { name: 'Más acciones' }));
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('menu')).toBeNull();
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog', { name: 'Usuarios' })).toBeInTheDocument();
        await user.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('se cierra cuando el botón se mueve (scroll de la página o resize), pero no con un scroll que no lo movió ni dentro del menú', async () => {
        const user = userEvent.setup();
        render(<MenuAcciones items={items()} />);
        const boton = screen.getByRole('button', { name: 'Más acciones' });
        const rect = (top) => ({ top, left: 10, right: 50, bottom: top + 40, width: 40, height: 40 });
        vi.spyOn(boton, 'getBoundingClientRect').mockReturnValue(rect(100));
        await user.click(boton);
        fireEvent.scroll(screen.getByRole('menu'));
        expect(screen.getByRole('menu')).toBeInTheDocument();
        // Un scroll del documento que no movió el botón (el navegador lo dispara a veces al enfocar) no cierra.
        fireEvent.scroll(window);
        expect(screen.getByRole('menu')).toBeInTheDocument();
        boton.getBoundingClientRect.mockReturnValue(rect(60));
        fireEvent.scroll(window);
        expect(screen.queryByRole('menu')).toBeNull();
        // resize: el target es window y no debe lanzar.
        boton.getBoundingClientRect.mockReturnValue(rect(60));
        await user.click(boton);
        boton.getBoundingClientRect.mockReturnValue(rect(80));
        fireEvent(window, new Event('resize'));
        expect(screen.queryByRole('menu')).toBeNull();
    });

    it('se dibuja en un portal fuera del contenedor (no lo recorta el scroll de una tabla)', async () => {
        const user = userEvent.setup();
        const { container } = render(<div style={{ overflow: 'auto' }}><MenuAcciones items={items()} /></div>);
        await user.click(screen.getByRole('button', { name: 'Más acciones' }));
        expect(container.contains(screen.getByRole('menu'))).toBe(false);
        expect(document.body.contains(screen.getByRole('menu'))).toBe(true);
    });
});
