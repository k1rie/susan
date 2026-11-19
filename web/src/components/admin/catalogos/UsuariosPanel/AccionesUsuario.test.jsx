// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const usuarioActualizar = vi.hoisted(() => vi.fn());
const restablecerUsuario = vi.hoisted(() => vi.fn());
const docentesListar = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/admin.js', () => ({
    usuarioActualizar: (...a) => usuarioActualizar(...a),
    docentesListar: (...a) => docentesListar(...a),
    alumnosListar: vi.fn().mockResolvedValue({ total: 0, items: [] }),
}));
vi.mock('@/lib/http/admin.js', () => ({ restablecerUsuario: (...a) => restablecerUsuario(...a) }));

import AccionesUsuario from './AccionesUsuario.jsx';

const fila = { id_usuario: 3, correo: 'docente1@susan.local', rol: 'docente', activo: true, vinculo: 'D0001', nombre: 'Ortega Salinas Patricia' };

function abrir(props = {}) {
    const refetch = vi.fn();
    const onPassword = vi.fn();
    render(<AccionesUsuario fila={fila} refetch={refetch} onPassword={onPassword} {...props} />);
    return { refetch, onPassword };
}

async function abrirMenu(user) {
    await user.click(screen.getByRole('button', { name: 'Acciones de docente1@susan.local' }));
    return screen.findByRole('menu');
}

beforeEach(() => {
    usuarioActualizar.mockReset().mockResolvedValue({});
    restablecerUsuario.mockReset();
    docentesListar.mockReset().mockResolvedValue({ total: 0, items: [] });
});

describe('AccionesUsuario', () => {
    it('reúne las tres acciones en un solo botón de menú, con la de desactivar en rojo y escrita', async () => {
        const user = userEvent.setup();
        abrir();
        expect(screen.queryByRole('button', { name: 'Cambiar rol' })).toBeNull();
        const menu = await abrirMenu(user);
        const items = within(menu).getAllByRole('menuitem').map((i) => i.textContent);
        expect(items).toEqual(['Cambiar rol', 'Restablecer contraseña', 'Desactivar cuenta']);
        expect(within(menu).getByRole('menuitem', { name: 'Desactivar cuenta' })).toHaveClass('text-destructive');
    });

    it('una cuenta inactiva ofrece «Activar cuenta»', async () => {
        const user = userEvent.setup();
        abrir({ fila: { ...fila, activo: false } });
        const menu = await abrirMenu(user);
        expect(within(menu).getByRole('menuitem', { name: 'Activar cuenta' })).not.toHaveClass('text-destructive');
    });

    it('desactivar pide confirmación con la consecuencia, y al confirmar refresca la lista', async () => {
        const user = userEvent.setup();
        const { refetch } = abrir();
        const menu = await abrirMenu(user);
        await user.click(within(menu).getByRole('menuitem', { name: 'Desactivar cuenta' }));
        const dialogo = await screen.findByRole('dialog', { name: 'Desactivar cuenta' });
        expect(within(dialogo).getByText(/ya no podrá iniciar sesión/)).toBeInTheDocument();
        await user.click(within(dialogo).getByRole('button', { name: 'Desactivar' }));
        await waitFor(() => expect(usuarioActualizar).toHaveBeenCalledWith({ idUsuario: 3, datos: { activo: false } }));
        await waitFor(() => expect(refetch).toHaveBeenCalled());
    });

    it('restablecer entrega la contraseña temporal a quien la muestra', async () => {
        const user = userEvent.setup();
        restablecerUsuario.mockResolvedValue({ id_usuario: 3, correo: 'docente1@susan.local', contrasena_temporal: 'Nueva-123' });
        const { onPassword } = abrir();
        const menu = await abrirMenu(user);
        await user.click(within(menu).getByRole('menuitem', { name: 'Restablecer contraseña' }));
        await user.click(await screen.findByRole('button', { name: 'Restablecer' }));
        await waitFor(() => expect(onPassword).toHaveBeenCalledWith({ correo: 'docente1@susan.local', contrasena: 'Nueva-123', titulo: 'Contraseña restablecida' }));
    });
});

describe('Cambiar rol', () => {
    async function abrirCambioDeRol(user) {
        const menu = await abrirMenu(user);
        await user.click(within(menu).getByRole('menuitem', { name: 'Cambiar rol' }));
        return screen.findByRole('dialog', { name: 'Cambiar rol de docente1@susan.local' });
    }

    it('parte sin cambios: el botón está apagado y dice por qué, y el rol actual se rotula', async () => {
        const user = userEvent.setup();
        abrir();
        const dialogo = await abrirCambioDeRol(user);
        expect(within(dialogo).getByRole('radio', { name: /Docente \(rol actual\)/ })).toBeChecked();
        expect(within(dialogo).getByRole('button', { name: 'Cambiar rol' })).toBeDisabled();
        expect(within(dialogo).getByText('Elige un rol distinto del actual.')).toBeInTheDocument();
    });

    it('a un rol sin vínculo avisa que se quitará el actual y guarda solo el rol', async () => {
        const user = userEvent.setup();
        const { refetch } = abrir();
        const dialogo = await abrirCambioDeRol(user);
        await user.click(within(dialogo).getByRole('radio', { name: 'Técnico' }));
        expect(within(dialogo).getByText(/se quitará ese vínculo/)).toBeInTheDocument();
        expect(within(dialogo).queryByRole('combobox')).toBeNull();
        await user.click(within(dialogo).getByRole('button', { name: 'Cambiar rol' }));
        await waitFor(() => expect(usuarioActualizar).toHaveBeenCalledWith({ idUsuario: 3, datos: { rol: 'tecnico' } }));
        await waitFor(() => expect(refetch).toHaveBeenCalled());
        expect(screen.queryByRole('dialog', { name: /Cambiar rol de/ })).toBeNull();
    });

    it('a alumno pide el vínculo (selector con búsqueda) antes de guardar', async () => {
        const user = userEvent.setup();
        abrir();
        const dialogo = await abrirCambioDeRol(user);
        await user.click(within(dialogo).getByRole('radio', { name: 'Alumno' }));
        await user.click(within(dialogo).getByRole('button', { name: 'Cambiar rol' }));
        expect(usuarioActualizar).not.toHaveBeenCalled();
        expect(within(dialogo).getByText('Elige el alumno al que pertenece la cuenta.')).toBeInTheDocument();
    });
});
