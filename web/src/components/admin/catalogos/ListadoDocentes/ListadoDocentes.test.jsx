// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const docentesListar = vi.hoisted(() => vi.fn());
const docenteGuardar = vi.hoisted(() => vi.fn());
const crearUsuario = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/admin.js', () => ({
    docentesListar: (...a) => docentesListar(...a),
    docenteGuardar: (...a) => docenteGuardar(...a),
    docenteCambiarEstatus: vi.fn(),
    alumnosListar: vi.fn(),
}));
vi.mock('@/lib/http/admin.js', () => ({ crearUsuario: (...a) => crearUsuario(...a) }));

import ListadoDocentes from './ListadoDocentes.jsx';

const existente = { id_docente: 1, num_empleado: 'D0001', nombre_completo: 'Ortega Salinas Patricia', correo_institucional: 'docente1@susan.local', estatus: 'activo', grupos: 3 };
const nuevo = { id_docente: 8, num_empleado: 'D008', nombre_completo: 'López Ruiz Ana', correo_institucional: 'ana.lopez@unach.mx', estatus: 'activo', creado: true };

beforeEach(() => {
    docentesListar.mockReset().mockResolvedValue({ total: 1, items: [existente] });
    docenteGuardar.mockReset().mockResolvedValue(nuevo);
    crearUsuario.mockReset().mockResolvedValue({ id_usuario: 20, correo: 'ana.lopez@unach.mx', rol: 'docente', contrasena_temporal: 'Temp-Clave-123' });
});

describe('ListadoDocentes', () => {
    it('lista con el número y el estatus bajo el nombre para el teléfono, y «Editar» a la vista', async () => {
        render(<ListadoDocentes />);
        expect(await screen.findAllByText('Ortega Salinas Patricia')).not.toHaveLength(0);
        expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
        expect(screen.getByRole('searchbox', { name: 'Número de empleado o nombre' })).toBeInTheDocument();
    });

    it('del alta del docente a su cuenta: abre «crear cuenta» con vínculo y correo puestos y luego muestra la contraseña una vez', async () => {
        const user = userEvent.setup();
        render(<ListadoDocentes />);
        await screen.findAllByText('Ortega Salinas Patricia');
        await user.click(screen.getAllByRole('button', { name: 'Nuevo docente' })[0]);
        const alta = screen.getByRole('dialog', { name: 'Nuevo docente' });
        await user.type(within(alta).getByLabelText(/Número de empleado/), 'D008');
        await user.type(within(alta).getByLabelText(/Correo institucional/), 'ana.lopez@unach.mx');
        await user.type(within(alta).getByLabelText(/Apellido paterno/), 'López');
        await user.type(within(alta).getByLabelText(/Nombres/), 'Ana');
        await user.click(within(alta).getByRole('button', { name: 'Crear docente' }));
        // La lista de detrás se refrescó con el alta (sin cerrar el panel de éxito).
        await screen.findByRole('heading', { name: 'Docente D008 creado' });
        expect(docentesListar.mock.calls.length).toBeGreaterThan(1);

        await user.click(screen.getByRole('button', { name: /Crear cuenta de acceso/ }));
        const panel = await screen.findByRole('dialog', { name: 'Nueva cuenta de usuario' });
        expect(screen.queryByRole('dialog', { name: 'Nuevo docente' })).toBeNull();
        expect(within(panel).getByRole('combobox')).toHaveValue('López Ruiz Ana');
        expect(within(panel).getByLabelText(/Correo de acceso/)).toHaveValue('ana.lopez@unach.mx');

        await user.click(within(panel).getByRole('button', { name: 'Crear cuenta' }));
        await waitFor(() => expect(crearUsuario).toHaveBeenCalledWith({ correo: 'ana.lopez@unach.mx', rol: 'docente', idDocente: 8, idAlumno: undefined }));
        const modal = await screen.findByRole('dialog', { name: 'Cuenta creada' });
        expect(within(modal).getByDisplayValue('Temp-Clave-123')).toBeInTheDocument();
        expect(screen.queryByRole('dialog', { name: 'Nueva cuenta de usuario' })).toBeNull();

        await user.click(within(modal).getByRole('button', { name: /Ya la copié/ }));
        expect(screen.queryByDisplayValue('Temp-Clave-123')).toBeNull();
    });
});
