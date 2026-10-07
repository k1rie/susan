// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ alumnosListar: vi.fn(), inscribir: vi.fn() }));
vi.mock('@/lib/api/admin.js', () => api);
import { ApiError } from '@/lib/api/errors.js';
import InscribirAlumno from './InscribirAlumno.jsx';
import { estadoCapacidad, opcionAlumno, resumenLote } from './inscribirAlumno.utils.js';

const ALUMNOS = [
    { id_alumno: 10, matricula: 'E260010', nombre_completo: 'Ramos Ana', estatus: 'activo', consentimiento_vigente: true, plantilla_activa: true },
    { id_alumno: 11, matricula: 'E260011', nombre_completo: 'Soto Luis', estatus: 'activo', consentimiento_vigente: false, plantilla_activa: true },
    { id_alumno: 12, matricula: 'E260012', nombre_completo: 'Mena Rosa', estatus: 'activo', consentimiento_vigente: true, plantilla_activa: false },
];

beforeEach(() => {
    api.alumnosListar.mockReset();
    api.inscribir.mockReset();
    api.alumnosListar.mockResolvedValue({ total: 3, items: ALUMNOS });
    api.inscribir.mockImplementation(async ({ idAlumno }) => ({ id_inscripcion: idAlumno, estatus: 'activa', reinscrita: false }));
});

// Busca y elige a un alumno por su nombre (el Combobox espera 250 ms antes de consultar).
async function agregar(user, texto, nombre) {
    const campo = screen.getByRole('combobox', { name: /Buscar alumno/ });
    await user.click(campo);
    await user.type(campo, texto);
    await user.click(await screen.findByRole('option', { name: new RegExp(nombre) }, { timeout: 2000 }));
}

describe('opciones y capacidad (utilidades)', () => {
    it('la opción trae nombre, matrícula y lo que impide o complica inscribir', () => {
        expect(opcionAlumno(ALUMNOS[0]).description).toBe('E260010 · Activo');
        expect(opcionAlumno(ALUMNOS[1]).description).toBe('E260011 · Activo · sin consentimiento vigente');
        expect(opcionAlumno(ALUMNOS[2]).description).toBe('E260012 · Activo · sin plantilla facial');
        expect(opcionAlumno(ALUMNOS[0], { yaInscrito: true })).toMatchObject({ disabled: true, description: 'E260010 · Ya inscrito en este grupo' });
        expect(opcionAlumno(ALUMNOS[0], { enLista: true })).toMatchObject({ disabled: true, description: 'E260010 · Ya está en la lista' });
    });
    it('avisa de lugares libres, de aula llena y de exceso con la lista', () => {
        expect(estadoCapacidad({ capacidad: undefined, activos: 3 }).texto).toBeNull();
        expect(estadoCapacidad({ capacidad: 40, activos: 28 }).texto).toBe('Quedan 12 lugares libres en el aula (28 de 40).');
        expect(estadoCapacidad({ capacidad: 40, activos: 39, enLista: 1 }).texto).toMatch(/Con la lista actual quedarían 0 lugares libres/);
        expect(estadoCapacidad({ capacidad: 40, activos: 40 })).toMatchObject({ tono: 'warning', texto: expect.stringMatching(/aula está llena/) });
        const exceso = estadoCapacidad({ capacidad: 40, activos: 38, enLista: 5 });
        expect(exceso).toMatchObject({ tono: 'warning', exceso: 3 });
        expect(exceso.texto).toMatch(/tendría 43 inscritos y el aula solo tiene 40 lugares/);
    });
    it('resume el lote', () => {
        expect(resumenLote({ ok: 2, reinscritos: 1, fallidos: 0 })).toBe('2 alumnos inscritos (1 reinscrito).');
        expect(resumenLote({ ok: 1, reinscritos: 0, fallidos: 1 })).toBe('1 alumno inscrito. 1 alumno no se pudo inscribir: revisa la lista.');
    });
});

describe('InscribirAlumno', () => {
    it('busca a partir de 2 caracteres con el estatus activo y muestra a quien ya está inscrito como no disponible', async () => {
        const user = userEvent.setup();
        render(<InscribirAlumno idGrupo={3} inscritosActivos={[10]} />);
        const campo = screen.getByRole('combobox', { name: /Buscar alumno/ });
        await user.click(campo);
        await user.type(campo, 'e26');
        const opcionYa = await screen.findByRole('option', { name: /Ramos Ana/ }, { timeout: 2000 });
        expect(opcionYa).toHaveAttribute('aria-disabled', 'true');
        expect(within(opcionYa).getByText('E260010 · Ya inscrito en este grupo')).toBeTruthy();
        expect(api.alumnosListar).toHaveBeenCalledWith({ q: 'e26', estatus: 'activo', limit: 10 });
    });

    it('cada alumno elegido se suma a la lista, el campo queda libre y un botón inscribe a todos', async () => {
        const onInscrito = vi.fn();
        const user = userEvent.setup();
        render(<InscribirAlumno idGrupo={3} inscritosActivos={[10]} capacidadAula={5} onInscrito={onInscrito} />);
        expect(screen.getByText('Quedan 4 lugares libres en el aula (1 de 5).')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Inscribir alumnos' })).toBeDisabled();
        expect(screen.getByText('Elige al menos un alumno para inscribir.')).toBeTruthy();

        await agregar(user, 'soto', 'Soto Luis');
        expect(screen.getByRole('combobox', { name: /Buscar alumno/ })).toHaveValue('');
        expect(screen.getByText('Se inscribirán 1 alumno en este grupo.')).toBeTruthy();
        await agregar(user, 'mena', 'Mena Rosa');
        const lista = screen.getByRole('list', { name: 'Alumnos por inscribir' });
        expect(within(lista).getAllByRole('listitem')).toHaveLength(2);
        expect(screen.getByText(/Con la lista actual quedarían 2 lugares libres/)).toBeTruthy();

        await user.click(screen.getByRole('button', { name: 'Inscribir 2 alumnos' }));
        await waitFor(() => expect(onInscrito).toHaveBeenCalledTimes(1));
        expect(api.inscribir).toHaveBeenCalledWith({ idGrupo: 3, idAlumno: 11 });
        expect(api.inscribir).toHaveBeenCalledWith({ idGrupo: 3, idAlumno: 12 });
        expect(await screen.findByText('2 alumnos inscritos.')).toBeTruthy();
        expect(screen.queryByRole('list', { name: 'Alumnos por inscribir' })).toBeNull();
    });

    it('no ofrece dos veces al mismo alumno y se puede quitar de la lista', async () => {
        const user = userEvent.setup();
        render(<InscribirAlumno idGrupo={3} />);
        await agregar(user, 'soto', 'Soto Luis');
        const campo = screen.getByRole('combobox', { name: /Buscar alumno/ });
        await user.click(campo);
        await user.type(campo, 'soto');
        // Mientras llega la nueva búsqueda puede verse la lista anterior un instante: se espera a que quede marcada.
        await waitFor(() => expect(screen.getByRole('option', { name: /Soto Luis/ })).toHaveAttribute('aria-disabled', 'true'), { timeout: 2000 });
        expect(within(screen.getByRole('option', { name: /Soto Luis/ })).getByText('E260011 · Ya está en la lista')).toBeTruthy();
        await user.click(screen.getByRole('button', { name: 'Quitar a Soto Luis de la lista' }));
        expect(screen.queryByRole('list', { name: 'Alumnos por inscribir' })).toBeNull();
    });

    it('si uno falla se queda en la lista con su motivo y el aviso lo dice; los demás ya están inscritos', async () => {
        api.inscribir.mockImplementation(async ({ idAlumno }) => {
            if (idAlumno === 12) throw new ApiError({ code: 'ALUMNO_NO_ACTIVO', message: 'El alumno no está activo.', status: 409 });
            return { id_inscripcion: idAlumno, reinscrita: idAlumno === 11 };
        });
        const onInscrito = vi.fn();
        const user = userEvent.setup();
        render(<InscribirAlumno idGrupo={3} onInscrito={onInscrito} />);
        await agregar(user, 'soto', 'Soto Luis');
        await agregar(user, 'mena', 'Mena Rosa');
        await user.click(screen.getByRole('button', { name: 'Inscribir 2 alumnos' }));
        expect(await screen.findByText('El alumno no está activo.')).toBeTruthy();
        expect(screen.getByText('1 alumno inscrito (1 reinscrito). 1 alumno no se pudo inscribir: revisa la lista.')).toBeTruthy();
        const lista = screen.getByRole('list', { name: 'Alumnos por inscribir' });
        expect(within(lista).getAllByRole('listitem')).toHaveLength(1);
        expect(within(lista).getByText('Mena Rosa')).toBeTruthy();
        expect(onInscrito).toHaveBeenCalledTimes(1);
    });

    it('con el aula llena lo avisa (sin impedir inscribir)', () => {
        render(<InscribirAlumno idGrupo={3} inscritosActivos={[1, 2]} capacidadAula={2} />);
        expect(screen.getByText(/El aula está llena \(2 de 2 lugares\)/)).toBeTruthy();
    });
});
