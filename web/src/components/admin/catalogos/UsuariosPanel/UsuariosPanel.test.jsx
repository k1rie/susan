// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const usuariosListar = vi.hoisted(() => vi.fn());
const crearUsuario = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/admin.js', () => ({
    usuariosListar: (...a) => usuariosListar(...a),
    usuarioActualizar: vi.fn(),
    docentesListar: vi.fn().mockResolvedValue({ total: 0, items: [] }),
    alumnosListar: vi.fn().mockResolvedValue({ total: 0, items: [] }),
}));
vi.mock('@/lib/http/admin.js', () => ({ crearUsuario: (...a) => crearUsuario(...a), restablecerUsuario: vi.fn() }));

import UsuariosPanel from './UsuariosPanel.jsx';

const cuenta = { id_usuario: 5, correo: 'tecnico@susan.local', rol: 'tecnico', activo: true, vinculo: null, nombre: null };

beforeEach(() => {
    usuariosListar.mockReset().mockResolvedValue({ total: 1, items: [cuenta] });
    crearUsuario.mockReset().mockResolvedValue({ id_usuario: 9, correo: 'zz.admin@unach.test', rol: 'administrador', contrasena_temporal: 'Secreta-9988' });
});

describe('UsuariosPanel', () => {
    it('lista las cuentas con un menú de acciones por fila y sin botón «Editar»', async () => {
        render(<UsuariosPanel />);
        expect(await screen.findAllByText('tecnico@susan.local')).not.toHaveLength(0);
        expect(screen.getByRole('button', { name: 'Acciones de tecnico@susan.local' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Restablecer contraseña' })).toBeNull();
    });

    it('filtra por rol con la barra de filtros', async () => {
        const user = userEvent.setup();
        render(<UsuariosPanel />);
        await screen.findAllByText('tecnico@susan.local');
        await user.selectOptions(screen.getByLabelText('Rol'), 'tecnico');
        await waitFor(() => expect(usuariosListar).toHaveBeenLastCalledWith({ rol: 'tecnico', limit: 25, offset: 0 }));
    });

    it('crear una cuenta cierra el panel, refresca la lista y muestra la contraseña temporal una sola vez', async () => {
        const user = userEvent.setup();
        render(<UsuariosPanel />);
        await screen.findAllByText('tecnico@susan.local');
        await user.click(screen.getAllByRole('button', { name: 'Nueva cuenta' })[0]);
        const panel = await screen.findByRole('dialog', { name: 'Nueva cuenta de usuario' });
        await user.click(within(panel).getByRole('radio', { name: 'Administrador' }));
        await user.type(within(panel).getByLabelText(/Correo de acceso/), 'ZZ.Admin@unach.test');
        await user.click(within(panel).getByRole('button', { name: 'Crear cuenta' }));
        await waitFor(() => expect(crearUsuario).toHaveBeenCalledWith({ correo: 'zz.admin@unach.test', rol: 'administrador', idDocente: undefined, idAlumno: undefined }));
        const modal = await screen.findByRole('dialog', { name: 'Cuenta creada' });
        expect(within(modal).getByDisplayValue('Secreta-9988')).toBeInTheDocument();
        expect(screen.queryByRole('dialog', { name: 'Nueva cuenta de usuario' })).toBeNull();
        expect(usuariosListar.mock.calls.length).toBeGreaterThan(1);
    });
});
