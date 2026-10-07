// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors.js';
import ListadoAlumnos from './ListadoAlumnos.jsx';

const mocks = vi.hoisted(() => ({ alumnosListar: vi.fn() }));
vi.mock('@/lib/api/admin.js', () => ({ alumnosListar: mocks.alumnosListar }));

const ALUMNO = (n, extra) => ({
    id_alumno: n, matricula: `E26000${n}`, apellido_paterno: 'Ramos', apellido_materno: 'Díaz', nombres: `Alumno${n}`, nombre_completo: `Ramos Díaz Alumno${n}`,
    correo_institucional: `a${n}@dominio.mx`, estatus: 'activo', consentimiento_vigente: true, plantilla_activa: true, ...extra,
});
const PAGINA = { total: 2, items: [ALUMNO(1), ALUMNO(2, { estatus: 'baja_temporal', consentimiento_vigente: false, plantilla_activa: false })] };

beforeEach(() => {
    mocks.alumnosListar.mockReset().mockResolvedValue(PAGINA);
});

describe('ListadoAlumnos', () => {
    it('lista los alumnos con matrícula enlazada, estatus y los estados con texto', async () => {
        render(<ListadoAlumnos />);
        const tabla = await screen.findByRole('table');
        expect(within(tabla).getByRole('link', { name: 'E260001' })).toHaveAttribute('href', '/admin/alumnos/1');
        expect(within(tabla).getByText('Baja temporal')).toBeInTheDocument();
        expect(within(tabla).getByText('Sin consentimiento')).toBeInTheDocument();
        expect(within(tabla).getByText('Sin plantilla')).toBeInTheDocument();
        expect(within(tabla).getAllByText('Vigente')).toHaveLength(1);
        expect(screen.getByRole('status')).toHaveTextContent('2 alumnos');
        expect(mocks.alumnosListar).toHaveBeenCalledWith({ q: undefined, estatus: undefined, limit: 25, offset: 0 });
    });

    it('para teléfono hay una tarjeta por alumno (la tabla no cabe en 360 px) que solo dice el estatus si no es activo', async () => {
        render(<ListadoAlumnos />);
        const lista = await screen.findByRole('list', { name: 'Alumnos' });
        const filas = within(lista).getAllByRole('link');
        expect(filas).toHaveLength(2);
        expect(filas[0]).toHaveAttribute('href', '/admin/alumnos/1');
        expect(within(filas[0]).queryByText('Activo')).not.toBeInTheDocument();
        expect(within(filas[1]).getByText('Baja temporal')).toBeInTheDocument();
    });

    it('busca mientras se escribe (con retraso), muestra el chip del filtro y «Limpiar» deja todo como estaba', async () => {
        const user = userEvent.setup();
        render(<ListadoAlumnos />);
        await screen.findByRole('table');
        await user.type(screen.getByRole('searchbox', { name: 'Matrícula, nombre o correo' }), 'ramos');
        await waitFor(() => expect(mocks.alumnosListar).toHaveBeenLastCalledWith({ q: 'ramos', estatus: undefined, limit: 25, offset: 0 }), { timeout: 2000 });

        await user.selectOptions(screen.getByLabelText('Estatus'), 'baja_temporal');
        await waitFor(() => expect(mocks.alumnosListar).toHaveBeenLastCalledWith({ q: 'ramos', estatus: 'baja_temporal', limit: 25, offset: 0 }));
        const chips = screen.getByRole('list', { name: 'Filtros activos' });
        expect(within(chips).getByText('Baja temporal')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Limpiar' }));
        await waitFor(() => expect(mocks.alumnosListar).toHaveBeenLastCalledWith({ q: undefined, estatus: undefined, limit: 25, offset: 0 }));
        expect(screen.getByRole('searchbox', { name: 'Matrícula, nombre o correo' })).toHaveValue('');
        expect(screen.queryByRole('list', { name: 'Filtros activos' })).not.toBeInTheDocument();
    });

    it('al cambiar un filtro vuelve a la primera página', async () => {
        mocks.alumnosListar.mockResolvedValue({ total: 60, items: [ALUMNO(1)] });
        const user = userEvent.setup();
        render(<ListadoAlumnos />);
        await screen.findByRole('table');
        await user.click(screen.getByRole('button', { name: 'Siguiente' }));
        await waitFor(() => expect(mocks.alumnosListar).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 25 })));
        await user.selectOptions(screen.getByLabelText('Estatus'), 'egresado');
        await waitFor(() => expect(mocks.alumnosListar).toHaveBeenLastCalledWith(expect.objectContaining({ estatus: 'egresado', offset: 0 })));
    });

    it('sin alumnos registrados invita a dar de alta el primero', async () => {
        mocks.alumnosListar.mockResolvedValue({ total: 0, items: [] });
        render(<ListadoAlumnos />);
        expect(await screen.findByText('Aún no hay alumnos registrados')).toBeInTheDocument();
        expect(screen.getAllByRole('link', { name: 'Nuevo alumno' }).length).toBeGreaterThan(0);
        expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
    });

    it('sin coincidencias con un filtro activo ofrece limpiarlo', async () => {
        const user = userEvent.setup();
        render(<ListadoAlumnos />);
        await screen.findByRole('table');
        mocks.alumnosListar.mockResolvedValue({ total: 0, items: [] });
        await user.selectOptions(screen.getByLabelText('Estatus'), 'egresado');
        expect(await screen.findByText('Ningún alumno coincide')).toBeInTheDocument();
        mocks.alumnosListar.mockResolvedValue(PAGINA);
        await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
        expect(await screen.findByRole('table')).toBeInTheDocument();
    });

    it('un error de carga se explica y deja reintentar', async () => {
        mocks.alumnosListar.mockRejectedValueOnce(new ApiError({ code: 'ERROR_RED', message: 'No se pudo conectar con el servidor.', status: 503 }));
        const user = userEvent.setup();
        render(<ListadoAlumnos />);
        expect(await screen.findByText(/No se pudo conectar/)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /Reintentar/ }));
        expect(await screen.findByRole('table')).toBeInTheDocument();
    });
});
