// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const docentesListar = vi.hoisted(() => vi.fn());
const alumnosListar = vi.hoisted(() => vi.fn());
const crearUsuario = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/admin.js', () => ({ docentesListar: (...a) => docentesListar(...a), alumnosListar: (...a) => alumnosListar(...a) }));
vi.mock('@/lib/http/admin.js', () => ({ crearUsuario: (...a) => crearUsuario(...a) }));

import CrearUsuarioDialog from './CrearUsuarioDialog.jsx';

const docentes = {
    total: 2,
    items: [
        { id_docente: 1, num_empleado: 'D001', nombre_completo: 'Lopez Ruiz Ana', correo_institucional: 'ana.lopez@unach.mx' },
        { id_docente: 2, num_empleado: 'D002', nombre_completo: 'Mena Soto Rosa', correo_institucional: 'rosa.mena@unach.mx' },
    ],
};

function abrir(props = {}) {
    const onClose = vi.fn();
    const onCreado = vi.fn();
    render(<CrearUsuarioDialog open onClose={onClose} onCreado={onCreado} {...props} />);
    return { onClose, onCreado };
}

async function elegirDocente(user, nombre) {
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: new RegExp(nombre) }));
}

beforeEach(() => {
    docentesListar.mockReset().mockResolvedValue(docentes);
    alumnosListar.mockReset().mockResolvedValue({ total: 0, items: [] });
    crearUsuario.mockReset();
});

describe('CrearUsuarioDialog', () => {
    it('cerrado no pinta nada', () => {
        render(<CrearUsuarioDialog open={false} onClose={() => {}} onCreado={() => {}} />);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('es un panel lateral con tarjetas de rol que explican qué puede hacer cada uno', () => {
        abrir();
        const panel = screen.getByRole('dialog', { name: 'Nueva cuenta de usuario' });
        expect(within(panel).getByRole('radio', { name: 'Docente' })).toBeChecked();
        expect(within(panel).getByText('Gestiona catálogos, cuentas y la bitácora de auditoría.')).toBeInTheDocument();
        expect(within(panel).getByText(/contraseña temporal/)).toBeInTheDocument();
    });

    it('al elegir el docente prellena el correo con el institucional y lo dice (editable)', async () => {
        const user = userEvent.setup();
        abrir();
        const correo = screen.getByLabelText(/Correo de acceso/);
        expect(correo).toHaveValue('');
        await elegirDocente(user, 'Mena Soto Rosa');
        expect(correo).toHaveValue('rosa.mena@unach.mx');
        expect(screen.getByText('Tomado del correo institucional de Mena Soto Rosa. Puedes cambiarlo.')).toBeInTheDocument();
        expect(docentesListar).toHaveBeenCalledWith(expect.objectContaining({ estatus: 'activo' }));
    });

    it('un correo escrito a mano no se pisa al elegir otro vínculo', async () => {
        const user = userEvent.setup();
        abrir();
        await user.type(screen.getByLabelText(/Correo de acceso/), 'propio@unach.mx');
        await elegirDocente(user, 'Mena Soto Rosa');
        expect(screen.getByLabelText(/Correo de acceso/)).toHaveValue('propio@unach.mx');
    });

    it('cambiar a un rol sin vínculo oculta el selector y quita el correo sugerido', async () => {
        const user = userEvent.setup();
        abrir();
        await elegirDocente(user, 'Lopez Ruiz Ana');
        await user.click(screen.getByRole('radio', { name: 'Técnico' }));
        expect(screen.queryByRole('combobox')).toBeNull();
        expect(screen.getByLabelText(/Correo de acceso/)).toHaveValue('');
    });

    it('sin vínculo no envía: lo dice junto al selector y enfoca el primer error', async () => {
        const user = userEvent.setup();
        abrir();
        await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
        expect(crearUsuario).not.toHaveBeenCalled();
        expect(screen.getByText('Elige el docente al que pertenece la cuenta.')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole('combobox')).toHaveFocus());
    });

    it('crea la cuenta con el id del vínculo y entrega la respuesta (con la contraseña temporal) a quien la muestra', async () => {
        const user = userEvent.setup();
        const respuesta = { id_usuario: 11, correo: 'rosa.mena@unach.mx', rol: 'docente', contrasena_temporal: 'Abc-123-xyz' };
        crearUsuario.mockResolvedValue(respuesta);
        const { onCreado } = abrir();
        await elegirDocente(user, 'Mena Soto Rosa');
        await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
        await waitFor(() => expect(onCreado).toHaveBeenCalledWith(respuesta));
        expect(crearUsuario).toHaveBeenCalledWith({ correo: 'rosa.mena@unach.mx', rol: 'docente', idDocente: 2, idAlumno: undefined });
    });

    it('abre con el vínculo y el correo ya puestos cuando viene de un docente recién creado', async () => {
        const user = userEvent.setup();
        crearUsuario.mockResolvedValue({ id_usuario: 12, correo: 'ana.lopez@unach.mx', rol: 'docente', contrasena_temporal: 'x' });
        const vinculo = { value: '1', label: 'Lopez Ruiz Ana', description: 'D001 · ana.lopez@unach.mx', correo: 'ana.lopez@unach.mx' };
        const { onCreado } = abrir({ inicial: { rol: 'docente', vinculo } });
        expect(screen.getByRole('combobox')).toHaveValue('Lopez Ruiz Ana');
        expect(screen.getByLabelText(/Correo de acceso/)).toHaveValue('ana.lopez@unach.mx');
        await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
        await waitFor(() => expect(onCreado).toHaveBeenCalled());
        expect(crearUsuario).toHaveBeenCalledWith(expect.objectContaining({ idDocente: 1, correo: 'ana.lopez@unach.mx' }));
    });

    it('un correo que ya tiene cuenta se pega al campo correo; un docente que ya tiene cuenta, al vínculo', async () => {
        const user = userEvent.setup();
        crearUsuario.mockRejectedValueOnce({ code: 'DUPLICADO', message: 'Ya existe una cuenta con ese correo.' });
        abrir();
        await elegirDocente(user, 'Mena Soto Rosa');
        await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
        const correo = screen.getByLabelText(/Correo de acceso/);
        await waitFor(() => expect(correo).toHaveAttribute('aria-invalid', 'true'));
        expect(correo).toHaveFocus();
        expect(screen.getAllByText('Ya existe una cuenta con ese correo.').length).toBeGreaterThan(0);

        crearUsuario.mockRejectedValueOnce({ code: 'DUPLICADO', message: 'Ese docente ya tiene una cuenta.' });
        await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
        await waitFor(() => expect(screen.getAllByText('Ese docente ya tiene una cuenta.').length).toBeGreaterThan(0));
    });

    it('para alumnos busca de forma remota a partir de 2 caracteres', async () => {
        const user = userEvent.setup();
        alumnosListar.mockResolvedValue({ total: 1, items: [{ id_alumno: 5, matricula: 'E260005', nombre_completo: 'Ramos Diaz Beatriz', correo_institucional: 'e260005@unach.mx' }] });
        abrir();
        await user.click(screen.getByRole('radio', { name: 'Alumno' }));
        const caja = screen.getByRole('combobox');
        await user.click(caja);
        await user.type(caja, 'ram');
        await user.click(await screen.findByRole('option', { name: /Ramos Diaz Beatriz/ }));
        expect(alumnosListar).toHaveBeenCalledWith(expect.objectContaining({ q: 'ram', estatus: 'activo' }));
        expect(screen.getByLabelText(/Correo de acceso/)).toHaveValue('e260005@unach.mx');
    });
});
