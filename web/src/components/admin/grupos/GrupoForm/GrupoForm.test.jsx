// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
    materiasListar: vi.fn(),
    docentesListar: vi.fn(),
    aulasListar: vi.fn(),
    grupoGuardar: vi.fn(),
}));
vi.mock('@/lib/api/admin.js', () => api);
import { ApiError } from '@/lib/api/errors.js';
import GrupoForm from './GrupoForm.jsx';

const GRUPO = {
    id_grupo: 7, id_materia: 1, id_docente: 4, id_aula: 2, clave_grupo: '3A', periodo: '2026-2',
    materia_clave: 'ADM101', materia_nombre: 'Administración I', docente_nombre: 'López Ruiz Ana', aula_clave: 'A-12',
    inscritos: { activos: 0, baja: 0 }, sesiones: { total: 0 },
};

beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    api.materiasListar.mockResolvedValue({ total: 1, items: [{ id_materia: 1, clave: 'ADM101', nombre: 'Administración I', creditos: 8, horas_semana: 3 }] });
    api.docentesListar.mockResolvedValue({ total: 1, items: [{ id_docente: 4, nombre_completo: 'López Ruiz Ana', num_empleado: 'D001', correo_institucional: 'a@u.mx' }] });
    api.aulasListar.mockResolvedValue({ total: 1, items: [{ id_aula: 2, clave: 'A-12', edificio: 'A', capacidad: 40, camaras_activas: 1 }] });
    api.grupoGuardar.mockResolvedValue({ ...GRUPO, creado: false });
});

const clave = () => screen.getByLabelText(/Clave del grupo/);

describe('GrupoForm (edición)', () => {
    it('empieza sin cambios: el botón de guardar está apagado y dice por qué', async () => {
        render(<GrupoForm grupo={GRUPO} />);
        expect(await screen.findByText('Aún no hay cambios que guardar.')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
        expect(screen.queryByText(/cambio sin guardar/)).toBeNull();
        expect(clave()).toHaveValue('3A');
        expect(screen.getByRole('combobox', { name: /Materia/ })).toHaveValue('Administración I');
        expect(screen.getByRole('combobox', { name: /Aula/ })).toHaveValue('A-12');
    });

    it('al editar muestra «1 cambio sin guardar», avisa al contenedor y se puede descartar', async () => {
        const onSucioChange = vi.fn();
        const user = userEvent.setup();
        render(<GrupoForm grupo={GRUPO} onSucioChange={onSucioChange} />);
        await screen.findByText('Aún no hay cambios que guardar.');
        await user.clear(clave());
        await user.type(clave(), '3b');
        await user.tab();
        expect(clave()).toHaveValue('3B');
        expect(screen.getByText('1 cambio sin guardar')).toBeTruthy();
        expect(onSucioChange).toHaveBeenLastCalledWith(true);
        expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
        await user.click(screen.getByRole('button', { name: 'Descartar cambios' }));
        expect(clave()).toHaveValue('3A');
        expect(onSucioChange).toHaveBeenLastCalledWith(false);
    });

    it('guarda con el mismo payload (con id_grupo) y avisa al contenedor', async () => {
        const onSaved = vi.fn();
        const user = userEvent.setup();
        render(<GrupoForm grupo={GRUPO} onSaved={onSaved} />);
        await screen.findByText('Aún no hay cambios que guardar.');
        await user.clear(clave());
        await user.type(clave(), '3b');
        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
        await waitFor(() => expect(onSaved).toHaveBeenCalled());
        expect(api.grupoGuardar).toHaveBeenCalledWith({ datos: { id_grupo: 7, id_materia: 1, id_docente: 4, id_aula: 2, clave_grupo: '3B', periodo: '2026-2' } });
        // Lo guardado ya no es «cambio sin guardar».
        expect(screen.queryByText(/cambio sin guardar/)).toBeNull();
    });

    it('un duplicado se dice UNA vez, pegado a la clave, sin perder lo escrito', async () => {
        api.grupoGuardar.mockRejectedValueOnce(new ApiError({ code: 'DUPLICADO', message: 'Ya existe el grupo 3B de esa materia en el periodo 2026-2.', status: 409 }));
        const user = userEvent.setup();
        render(<GrupoForm grupo={GRUPO} />);
        await screen.findByText('Aún no hay cambios que guardar.');
        await user.clear(clave());
        await user.type(clave(), '3b');
        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
        expect(await screen.findAllByText('Ya existe el grupo 3B de esa materia en el periodo 2026-2.')).toHaveLength(1);
        expect(clave()).toHaveAttribute('aria-invalid', 'true');
        expect(clave()).toHaveValue('3B');
        expect(screen.queryByText('No se pudo guardar el grupo')).toBeNull();
    });

    it('un error sin campo (p. ej. historial) sale una vez en un aviso general', async () => {
        api.grupoGuardar.mockRejectedValueOnce(new ApiError({ code: 'GRUPO_CON_HISTORIAL', message: 'El grupo ya tiene inscripciones o sesiones.', status: 409 }));
        const user = userEvent.setup();
        render(<GrupoForm grupo={GRUPO} />);
        await screen.findByText('Aún no hay cambios que guardar.');
        await user.clear(clave());
        await user.type(clave(), '3b');
        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
        expect(await screen.findByText('No se pudo guardar el grupo')).toBeTruthy();
        expect(screen.getAllByText('El grupo ya tiene inscripciones o sesiones.')).toHaveLength(1);
    });

    it('con inscripciones no deja cambiar la materia ni el periodo y lo explica', async () => {
        render(<GrupoForm grupo={{ ...GRUPO, inscritos: { activos: 3, baja: 0 } }} />);
        await screen.findByRole('combobox', { name: /Materia/ });
        expect(screen.getByRole('combobox', { name: /Materia/ })).toBeDisabled();
        expect(screen.getByLabelText('Periodo')).toBeDisabled();
        expect(screen.getAllByText('No se puede cambiar: el grupo ya tiene inscripciones o sesiones.')).toHaveLength(2);
    });

    it('conserva al docente actual aunque ya no esté activo (no viene en la lista de activos)', async () => {
        api.docentesListar.mockResolvedValue({ total: 1, items: [{ id_docente: 9, nombre_completo: 'Otra Docente', num_empleado: 'D009', correo_institucional: 'o@u.mx' }] });
        render(<GrupoForm grupo={GRUPO} />);
        await waitFor(() => expect(screen.getByRole('combobox', { name: /Docente/ })).toHaveValue('López Ruiz Ana'));
        fireEvent.click(screen.getByRole('combobox', { name: /Docente/ }));
        expect(await screen.findByRole('option', { name: /López Ruiz Ana/ })).toBeTruthy();
    });

    it('si el catálogo trae más de 200 registros pasa a búsqueda remota por texto', async () => {
        api.materiasListar.mockImplementation(async (args) =>
            args.q ? { total: 1, items: [{ id_materia: 5, clave: 'MAT501', nombre: 'Matemáticas', creditos: 6, horas_semana: 3 }] } : { total: 450, items: [{ id_materia: 1, clave: 'ADM101', nombre: 'Administración I', creditos: 8, horas_semana: 3 }] },
        );
        const user = userEvent.setup();
        render(<GrupoForm grupo={GRUPO} />);
        const campo = await screen.findByRole('combobox', { name: /Materia/ });
        await waitFor(() => expect(campo).toBeEnabled());
        await user.click(campo);
        fireEvent.change(campo, { target: { value: 'mate' } });
        expect(await screen.findByRole('option', { name: /Matemáticas/ })).toBeTruthy();
        expect(api.materiasListar).toHaveBeenCalledWith(expect.objectContaining({ q: 'mate', limit: 20 }));
    });
});
