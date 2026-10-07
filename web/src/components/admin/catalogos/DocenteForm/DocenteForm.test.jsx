// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const guardar = vi.hoisted(() => vi.fn());
const cambiarEstatus = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/admin.js', () => ({
    docenteGuardar: (...a) => guardar(...a),
    docenteCambiarEstatus: (...a) => cambiarEstatus(...a),
}));

import DocenteForm from './DocenteForm.jsx';

const creado = { id_docente: 8, num_empleado: 'D008', nombre_completo: 'López Ruiz Ana', correo_institucional: 'ana.lopez@unach.mx', estatus: 'activo', creado: true };
const item = { id_docente: 3, num_empleado: 'D003', apellido_paterno: 'Mena', apellido_materno: 'Soto', nombres: 'Rosa', correo_institucional: 'rosa.mena@unach.mx', estatus: 'activo', grupos: 2 };

async function llenarAlta(user) {
    await user.type(screen.getByLabelText(/Número de empleado/), 'd008');
    await user.type(screen.getByLabelText(/Correo institucional/), 'ana.lopez@unach.mx');
    await user.type(screen.getByLabelText(/Apellido paterno/), 'López');
    await user.type(screen.getByLabelText(/Apellido materno/), 'Ruiz');
    await user.type(screen.getByLabelText(/Nombres/), 'Ana');
}

function abrir(props = {}) {
    const onClose = vi.fn();
    const onGuardado = vi.fn();
    const onCrearCuenta = vi.fn();
    render(<DocenteForm onClose={onClose} onGuardado={onGuardado} onCrearCuenta={onCrearCuenta} {...props} />);
    return { onClose, onGuardado, onCrearCuenta };
}

beforeEach(() => {
    guardar.mockReset();
    cambiarEstatus.mockReset();
});

describe('DocenteForm: alta', () => {
    it('no tiene selector de estatus (nace activo), marca el apellido materno como opcional y declara los límites', () => {
        abrir();
        const panel = screen.getByRole('dialog', { name: 'Nuevo docente' });
        expect(within(panel).queryByText('Estatus')).toBeNull();
        expect(within(panel).queryByRole('radio')).toBeNull();
        expect(within(panel).getByText('(opcional)')).toBeInTheDocument();
        expect(within(panel).getByLabelText(/Número de empleado/)).toHaveAttribute('maxlength', '10');
        expect(within(panel).getByLabelText(/Correo institucional/)).toHaveAttribute('maxlength', '120');
        expect(within(panel).getByLabelText(/Apellido paterno/)).toHaveAttribute('maxlength', '40');
        expect(within(panel).getByLabelText(/Nombres/)).toHaveAttribute('maxlength', '60');
    });

    it('guarda en UNA sola llamada, sin estatus ni segunda llamada, con los datos normalizados', async () => {
        const user = userEvent.setup();
        guardar.mockResolvedValue(creado);
        abrir();
        await llenarAlta(user);
        await user.click(screen.getByRole('button', { name: 'Crear docente' }));
        await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1));
        expect(guardar).toHaveBeenCalledWith({
            datos: { num_empleado: 'D008', apellido_paterno: 'López', apellido_materno: 'Ruiz', nombres: 'Ana', correo_institucional: 'ana.lopez@unach.mx' },
        });
        expect(cambiarEstatus).not.toHaveBeenCalled();
    });

    it('al crear ofrece la cuenta de acceso: abre «crear cuenta» con el docente y cierra el panel', async () => {
        const user = userEvent.setup();
        guardar.mockResolvedValue(creado);
        const { onClose, onCrearCuenta } = abrir();
        await llenarAlta(user);
        await user.click(screen.getByRole('button', { name: 'Crear docente' }));
        expect(await screen.findByRole('heading', { name: 'Docente D008 creado' })).toBeInTheDocument();
        expect(screen.getByText('López Ruiz Ana · ana.lopez@unach.mx')).toBeInTheDocument();
        expect(screen.getByText('Recomendado')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /Crear cuenta de acceso/ }));
        expect(onCrearCuenta).toHaveBeenCalledWith(creado);
        expect(onClose).toHaveBeenCalled();
    });

    it('«Crear otro docente» y «Ir a la lista» están en la pantalla de éxito', async () => {
        const user = userEvent.setup();
        guardar.mockResolvedValue(creado);
        const { onClose } = abrir();
        await llenarAlta(user);
        await user.click(screen.getByRole('button', { name: 'Crear docente' }));
        await user.click(await screen.findByRole('button', { name: 'Crear otro docente' }));
        expect(screen.getByLabelText(/Número de empleado/)).toHaveValue('');
        expect(onClose).not.toHaveBeenCalled();
    });

    it('un correo repetido se pega al campo correo y un número repetido al número de empleado, sin perder lo escrito', async () => {
        const user = userEvent.setup();
        guardar.mockRejectedValueOnce({ code: 'DUPLICADO', message: 'Ya existe un docente con ese correo institucional.' });
        abrir();
        await llenarAlta(user);
        await user.click(screen.getByRole('button', { name: 'Crear docente' }));
        const correo = screen.getByLabelText(/Correo institucional/);
        await waitFor(() => expect(correo).toHaveAttribute('aria-invalid', 'true'));
        expect(correo).toHaveFocus();
        expect(screen.getByLabelText(/Número de empleado/)).toHaveValue('D008');

        guardar.mockRejectedValueOnce({ code: 'DUPLICADO', message: 'Ya existe un docente con el número de empleado D008.' });
        await user.click(screen.getByRole('button', { name: 'Crear docente' }));
        const num = screen.getByLabelText(/Número de empleado/);
        await waitFor(() => expect(num).toHaveAttribute('aria-invalid', 'true'));
        expect(num).toHaveFocus();
    });

    it('sin la función de cuenta no ofrece ese paso, pero sí las salidas', async () => {
        const user = userEvent.setup();
        guardar.mockResolvedValue(creado);
        abrir({ onCrearCuenta: undefined });
        await llenarAlta(user);
        await user.click(screen.getByRole('button', { name: 'Crear docente' }));
        await screen.findByRole('heading', { name: 'Docente D008 creado' });
        expect(screen.queryByRole('button', { name: /Crear cuenta de acceso/ })).toBeNull();
        expect(screen.getByRole('button', { name: 'Ir a la lista' })).toBeInTheDocument();
    });
});

describe('DocenteForm: edición', () => {
    it('muestra el estatus como control segmentado con el actual elegido', () => {
        abrir({ item });
        expect(screen.getByRole('dialog', { name: 'Editar docente' })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'Activo' })).toBeChecked();
        expect(screen.getByRole('radio', { name: 'Licencia' })).not.toBeChecked();
        expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    });

    it('guardar datos y cambiar el estatus son dos llamadas, la segunda solo si el estatus cambió', async () => {
        const user = userEvent.setup();
        guardar.mockResolvedValue({ ...creado, id_docente: 3, num_empleado: 'D003', creado: false });
        cambiarEstatus.mockResolvedValue({ cambio: true });
        const { onClose, onGuardado } = abrir({ item });
        await user.click(screen.getByRole('radio', { name: 'Licencia' }));
        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(cambiarEstatus).toHaveBeenCalledWith({ idDocente: 3, estatus: 'licencia' });
        expect(onGuardado).toHaveBeenCalled();
    });

    it('si la segunda llamada falla, los datos YA se guardaron: lo dice junto al estatus y el formulario no vuelve a crear nada', async () => {
        const user = userEvent.setup();
        guardar.mockResolvedValue({ ...creado, id_docente: 3, num_empleado: 'D003', creado: false });
        cambiarEstatus.mockRejectedValueOnce({ code: 'DOCENTE_CON_GRUPOS', message: 'Tiene sesiones por impartir.' });
        const { onClose, onGuardado } = abrir({ item });
        const nombres = screen.getByLabelText(/Nombres/);
        await user.clear(nombres);
        await user.type(nombres, 'Rosa María');
        await user.click(screen.getByRole('radio', { name: 'Licencia' }));
        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
        expect(await screen.findByText('Los datos se guardaron, pero el estatus no cambió: Tiene sesiones por impartir.')).toBeInTheDocument();
        // La lista se refresca (los datos sí cambiaron), el panel sigue abierto y no dice «No se pudo guardar».
        expect(onGuardado).toHaveBeenCalledTimes(1);
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.queryByText('No se pudo guardar el docente')).toBeNull();
        // El estatus vuelve al que de verdad tiene el docente y ya no quedan cambios por guardar.
        expect(screen.getByRole('radio', { name: 'Activo' })).toBeChecked();
        expect(screen.getByLabelText(/Nombres/)).toHaveValue('Rosa María');
        expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    });

    it('la baja pide confirmar (con los grupos que tiene) antes de guardar nada', async () => {
        const user = userEvent.setup();
        guardar.mockResolvedValue({ ...creado, id_docente: 3, num_empleado: 'D003', creado: false });
        cambiarEstatus.mockResolvedValue({ cambio: true });
        const { onClose } = abrir({ item });
        await user.click(screen.getByRole('radio', { name: 'Baja' }));
        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
        expect(guardar).not.toHaveBeenCalled();
        const dialogo = await screen.findByRole('dialog', { name: 'Dar de baja al docente' });
        expect(within(dialogo).getByText(/tiene 2 grupo\(s\) asignado\(s\)/)).toBeInTheDocument();
        await user.click(within(dialogo).getByRole('button', { name: 'Dar de baja' }));
        await waitFor(() => expect(cambiarEstatus).toHaveBeenCalledWith({ idDocente: 3, estatus: 'baja' }));
        await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it('con datos inválidos la baja no pregunta: se muestran los errores', async () => {
        const user = userEvent.setup();
        abrir({ item });
        const correo = screen.getByLabelText(/Correo institucional/);
        await user.clear(correo);
        await user.click(screen.getByRole('radio', { name: 'Baja' }));
        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
        expect(screen.queryByRole('dialog', { name: 'Dar de baja al docente' })).toBeNull();
        expect(screen.getByText(/Escribe el correo institucional/)).toBeInTheDocument();
    });
});
