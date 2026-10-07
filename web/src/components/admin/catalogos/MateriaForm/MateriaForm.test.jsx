// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const guardar = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/admin.js', () => ({ materiaGuardar: (...a) => guardar(...a) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...r }) => <a href={href} {...r}>{children}</a> }));

import MateriaForm from './MateriaForm.jsx';

const creada = { id_materia: 5, clave: 'ADM101', nombre: 'Administración I', creditos: 8, horas_semana: 4, creado: true };

async function llenar(user, { clave = 'adm101', nombre = 'Administración I', creditos = '8', horas = '4' } = {}) {
    await user.type(screen.getByLabelText(/Clave/), clave);
    await user.type(screen.getByLabelText(/Nombre/), nombre);
    await user.type(screen.getByLabelText(/Créditos/), creditos);
    await user.type(screen.getByLabelText(/Horas por semana/), horas);
}

function abrir(props = {}) {
    const onClose = vi.fn();
    const onGuardado = vi.fn();
    render(<MateriaForm onClose={onClose} onGuardado={onGuardado} {...props} />);
    return { onClose, onGuardado };
}

beforeEach(() => guardar.mockReset());

describe('MateriaForm', () => {
    it('declara los límites de la base: clave 8, nombre 80, y ejemplos dentro del campo', () => {
        abrir();
        const panel = screen.getByRole('dialog', { name: 'Nueva materia' });
        expect(within(panel).getByLabelText(/Clave/)).toHaveAttribute('maxlength', '8');
        expect(within(panel).getByLabelText(/Nombre/)).toHaveAttribute('maxlength', '80');
        expect(within(panel).getByText(/Ej\. ADM101/)).toBeInTheDocument();
        expect(within(panel).getByText(/Ej\. Administración I/)).toBeInTheDocument();
    });

    it('créditos en 0 no pasan: se dice junto al campo y no se envía (la base exige > 0)', async () => {
        const user = userEvent.setup();
        abrir();
        await llenar(user, { creditos: '0' });
        await user.click(screen.getByRole('button', { name: 'Crear materia' }));
        expect(guardar).not.toHaveBeenCalled();
        expect(screen.getByText(/Escribe los créditos: un número entero de 1 a 99 \(no puede ser 0\)/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Créditos/)).toHaveFocus();
    });

    it('normaliza la clave al salir del campo y envía los datos en números', async () => {
        const user = userEvent.setup();
        guardar.mockResolvedValue(creada);
        abrir();
        await llenar(user, { clave: 'adm-101' });
        expect(screen.getByLabelText(/Clave/)).toHaveValue('ADM101');
        await user.click(screen.getByRole('button', { name: 'Crear materia' }));
        await waitFor(() => expect(guardar).toHaveBeenCalledWith({ datos: { clave: 'ADM101', nombre: 'Administración I', creditos: 8, horas_semana: 4 } }));
    });

    it('al crear ofrece crear un grupo con la materia y crear otra', async () => {
        const user = userEvent.setup();
        guardar.mockResolvedValue(creada);
        abrir();
        await llenar(user);
        await user.click(screen.getByRole('button', { name: 'Crear materia' }));
        expect(await screen.findByRole('heading', { name: 'Materia ADM101 creada' })).toBeInTheDocument();
        expect(screen.getByText('Administración I · 8 créditos · 4 h por semana.')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Crear un grupo con esta materia/ })).toHaveAttribute('href', '/admin/grupos/nuevo');
        await user.click(screen.getByRole('button', { name: 'Crear otra materia' }));
        expect(screen.getByLabelText(/Clave/)).toHaveValue('');
    });

    it('«Crear y agregar otra» limpia el formulario y deja el foco en la clave', async () => {
        const user = userEvent.setup();
        guardar.mockResolvedValue(creada);
        abrir();
        await llenar(user);
        await user.click(screen.getByRole('button', { name: 'Crear y agregar otra' }));
        await waitFor(() => expect(screen.getByLabelText(/Nombre/)).toHaveValue(''));
        expect(screen.getByLabelText(/Clave/)).toHaveFocus();
        expect(screen.queryByText(/sin guardar/)).toBeNull();
    });

    it('una clave repetida se pega al campo clave', async () => {
        const user = userEvent.setup();
        guardar.mockRejectedValueOnce({ code: 'DUPLICADO', message: 'Ya existe una materia con la clave ADM101.' });
        abrir();
        await llenar(user);
        await user.click(screen.getByRole('button', { name: 'Crear materia' }));
        await waitFor(() => expect(screen.getByLabelText(/Clave/)).toHaveAttribute('aria-invalid', 'true'));
        expect(screen.getByLabelText(/Clave/)).toHaveFocus();
        expect(screen.getByLabelText(/Nombre/)).toHaveValue('Administración I');
    });

    it('edita con el id y cierra el panel al guardar', async () => {
        const user = userEvent.setup();
        guardar.mockResolvedValue({ ...creada, nombre: 'Administración II' });
        const { onClose } = abrir({ item: creada });
        expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
        const nombre = screen.getByLabelText(/Nombre/);
        await user.clear(nombre);
        await user.type(nombre, 'Administración II');
        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(guardar).toHaveBeenCalledWith({ datos: { id_materia: 5, clave: 'ADM101', nombre: 'Administración II', creditos: 8, horas_semana: 4 } });
    });
});
