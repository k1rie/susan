// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
    materiasListar: vi.fn(),
    docentesListar: vi.fn(),
    aulasListar: vi.fn(),
    grupoGuardar: vi.fn(),
    horarioGuardar: vi.fn(),
}));
const ahoraMock = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/admin.js', () => api);
vi.mock('@/lib/api/plataforma.js', () => ({ ahora: (...a) => ahoraMock(...a) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
import { ApiError } from '@/lib/api/errors.js';
import NuevoGrupo from './NuevoGrupo.jsx';

const MATERIAS = { total: 1, items: [{ id_materia: 1, clave: 'ADM101', nombre: 'Administración I', creditos: 8, horas_semana: 3 }] };
const DOCENTES = { total: 1, items: [{ id_docente: 4, nombre_completo: 'López Ruiz Ana', num_empleado: 'D001', correo_institucional: 'ana@unach.test' }] };
const AULAS = { total: 1, items: [{ id_aula: 2, clave: 'A-12', edificio: 'A', capacidad: 40, camaras_total: 1, camaras_activas: 0 }] };
const GRUPO = { id_grupo: 5, clave_grupo: '3A', periodo: '2026-2', aula_clave: 'A-12', creado: true };

beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    ahoraMock.mockReset();
    push.mockReset();
    ahoraMock.mockResolvedValue({ fecha: '2026-09-14' });
    api.materiasListar.mockResolvedValue(MATERIAS);
    api.docentesListar.mockResolvedValue(DOCENTES);
    api.aulasListar.mockResolvedValue(AULAS);
    api.grupoGuardar.mockResolvedValue(GRUPO);
    api.horarioGuardar.mockResolvedValue({ bloques: [{ dia_semana: 1, hora_inicio: '07:00:00', hora_fin: '08:00:00' }] });
});

// Elige una opción de un Combobox escribiendo parte de su texto.
async function elegir(user, nombreCampo, texto, opcion) {
    const campo = await screen.findByRole('combobox', { name: nombreCampo });
    await waitFor(() => expect(campo).toBeEnabled());
    await user.click(campo);
    await user.type(campo, texto);
    await user.click(await screen.findByRole('option', { name: opcion }));
}

async function llenarPasoUno(user, { clave = '3a' } = {}) {
    await elegir(user, 'Materia', 'admin', /Administración I/);
    await elegir(user, 'Docente', 'lópez', /López Ruiz Ana/);
    await user.type(screen.getByLabelText(/Clave del grupo/), clave);
    await user.tab();
}

async function llenarPasoDos(user, { franja = true } = {}) {
    await elegir(user, 'Aula', 'a-1', /A-12/);
    if (franja) {
        await user.click(screen.getByRole('button', { name: 'Lun, Mié y Vie' }));
        fireEvent.change(screen.getByLabelText('Hora de inicio de la franja 1'), { target: { value: '07:00' } });
    }
}

describe('NuevoGrupo (asistente de 3 pasos)', () => {
    it('abre en el paso 1 con el periodo sugerido según el día del plantel y la clave en mayúsculas al salir', async () => {
        const user = userEvent.setup();
        render(<NuevoGrupo />);
        expect(await screen.findByRole('heading', { name: 'Materia y docente' })).toBeTruthy();
        expect(screen.getAllByText(/Paso 1 de 3/).length).toBeGreaterThan(0);
        expect(screen.getByLabelText(/Periodo/)).toHaveValue('2026-2');
        await user.type(screen.getByLabelText(/Clave del grupo/), '3a');
        await user.tab();
        expect(screen.getByLabelText(/Clave del grupo/)).toHaveValue('3A');
    });

    it('con el paso incompleto no avanza y marca los campos', async () => {
        const user = userEvent.setup();
        render(<NuevoGrupo />);
        await screen.findByRole('heading', { name: 'Materia y docente' });
        await user.click(screen.getByRole('button', { name: /Siguiente/ }));
        // Cada error sale bajo su campo y, además, en el resumen del paso que arma el asistente.
        expect((await screen.findAllByText('Elige la materia.')).length).toBeGreaterThan(0);
        expect(screen.getAllByText('Elige el docente.').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Escribe la clave del grupo, por ejemplo 3A.').length).toBeGreaterThan(0);
        expect(screen.getByText('Revisa este paso antes de continuar')).toBeTruthy();
        expect(api.grupoGuardar).not.toHaveBeenCalled();
        expect(screen.getByRole('heading', { name: 'Materia y docente' })).toBeTruthy();
    });

    it('recorre los pasos, revisa y crea el grupo con las mismas RPC y llega a un éxito con siguientes pasos', async () => {
        const user = userEvent.setup();
        render(<NuevoGrupo />);
        await llenarPasoUno(user);
        await user.click(screen.getByRole('button', { name: /Siguiente/ }));
        await screen.findByRole('heading', { name: 'Aula y horario' });
        await llenarPasoDos(user);
        await user.click(screen.getByRole('button', { name: /Siguiente/ }));

        // Revisión: una tarjeta por sección con su «Editar».
        await screen.findByRole('heading', { name: 'Revisión' });
        expect(screen.getByText('Administración I')).toBeTruthy();
        expect(screen.getByText('López Ruiz Ana')).toBeTruthy();
        expect(screen.getByText('Lun, Mié y Vie')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Editar Horario' })).toBeTruthy();

        await user.click(screen.getByRole('button', { name: 'Crear grupo' }));
        expect(await screen.findByRole('heading', { name: 'Grupo 3A creado' })).toBeTruthy();
        expect(api.grupoGuardar).toHaveBeenCalledTimes(1);
        expect(api.grupoGuardar).toHaveBeenCalledWith({ datos: { id_materia: 1, id_docente: 4, id_aula: 2, clave_grupo: '3A', periodo: '2026-2' } });
        expect(api.horarioGuardar).toHaveBeenCalledWith({
            idGrupo: 5,
            bloques: [
                { dia_semana: 1, hora_inicio: '07:00', hora_fin: '08:00' },
                { dia_semana: 3, hora_inicio: '07:00', hora_fin: '08:00' },
                { dia_semana: 5, hora_inicio: '07:00', hora_fin: '08:00' },
            ],
        });
        // Siguientes pasos reales, con enlaces a la pestaña correcta (no a Datos).
        const pasos = within(screen.getByRole('region', { name: 'Siguientes pasos' }));
        expect(pasos.getByRole('link', { name: /Generar las sesiones/ })).toHaveAttribute('href', '/admin/grupos/5?tab=horario');
        expect(pasos.getByRole('link', { name: /Inscribir alumnos/ })).toHaveAttribute('href', '/admin/grupos/5?tab=inscripciones');
        expect(pasos.getByRole('link', { name: /Configurar la cámara del aula/ })).toHaveAttribute('href', '/admin/grupos/5?tab=aula');
    });

    it('el horario es opcional: sin franjas solo crea el grupo y recomienda armar el horario', async () => {
        const user = userEvent.setup();
        render(<NuevoGrupo />);
        await llenarPasoUno(user);
        await user.click(screen.getByRole('button', { name: /Siguiente/ }));
        await screen.findByRole('heading', { name: 'Aula y horario' });
        await llenarPasoDos(user, { franja: false });
        await user.click(screen.getByRole('button', { name: /Siguiente/ }));
        await screen.findByRole('heading', { name: 'Revisión' });
        expect(screen.getByText(/Sin horario por ahora/)).toBeTruthy();
        await user.click(screen.getByRole('button', { name: 'Crear grupo' }));
        await screen.findByRole('heading', { name: 'Grupo 3A creado' });
        expect(api.horarioGuardar).not.toHaveBeenCalled();
        expect(screen.getByRole('link', { name: /Armar el horario/ })).toHaveAttribute('href', '/admin/grupos/5?tab=horario');
    });

    it('si el horario falla el grupo ya existe: lo explica y al reintentar NO lo crea de nuevo (lo actualiza por su id)', async () => {
        api.horarioGuardar.mockRejectedValueOnce(new ApiError({ code: 'HORARIO_CHOQUE', message: 'El bloque 1 choca en el aula con el grupo 3B de ADM101 (07:00-08:00).', status: 409 }));
        const user = userEvent.setup();
        render(<NuevoGrupo />);
        await llenarPasoUno(user);
        await user.click(screen.getByRole('button', { name: /Siguiente/ }));
        await screen.findByRole('heading', { name: 'Aula y horario' });
        await llenarPasoDos(user);
        await user.click(screen.getByRole('button', { name: /Siguiente/ }));
        await screen.findByRole('heading', { name: 'Revisión' });
        await user.click(screen.getByRole('button', { name: 'Crear grupo' }));

        const aviso = await screen.findByText(/El grupo 3A ya se creó, pero su horario no se guardó/);
        expect(aviso.textContent).toMatch(/choca en el aula con el grupo 3B/);
        expect(aviso.textContent).toMatch(/no se creará otro grupo/);
        // El botón ahora dice lo que hará: guardar el horario, no crear otro grupo.
        expect(screen.queryByRole('button', { name: 'Crear grupo' })).toBeNull();
        await user.click(screen.getByRole('button', { name: 'Guardar horario' }));
        expect(await screen.findByRole('heading', { name: 'Grupo 3A creado' })).toBeTruthy();
        expect(api.grupoGuardar).toHaveBeenCalledTimes(2);
        expect(api.grupoGuardar.mock.calls[0][0].datos.id_grupo).toBeUndefined();
        expect(api.grupoGuardar.mock.calls[1][0].datos.id_grupo).toBe(5);
        expect(api.horarioGuardar).toHaveBeenCalledTimes(2);
    });

    it('un grupo duplicado se dice una vez, queda pegado a la clave y se corrige con «Editar»', async () => {
        api.grupoGuardar.mockRejectedValueOnce(new ApiError({ code: 'DUPLICADO', message: 'Ya existe el grupo 3A de esa materia en el periodo 2026-2.', status: 409 }));
        const user = userEvent.setup();
        render(<NuevoGrupo />);
        await llenarPasoUno(user);
        await user.click(screen.getByRole('button', { name: /Siguiente/ }));
        await screen.findByRole('heading', { name: 'Aula y horario' });
        await llenarPasoDos(user, { franja: false });
        await user.click(screen.getByRole('button', { name: /Siguiente/ }));
        await screen.findByRole('heading', { name: 'Revisión' });
        await user.click(screen.getByRole('button', { name: 'Crear grupo' }));
        expect(await screen.findByText(/Ya existe el grupo 3A de esa materia en el periodo 2026-2\. Corrígelo con «Editar»/)).toBeTruthy();
        // Al volver al paso, el error está en el campo de la clave.
        await user.click(screen.getByRole('button', { name: 'Editar Materia y docente' }));
        expect(await screen.findByText('Ya existe el grupo 3A de esa materia en el periodo 2026-2.')).toBeTruthy();
        expect(screen.getByLabelText(/Clave del grupo/)).toHaveAttribute('aria-invalid', 'true');
    });

    it('avisa si faltan catálogos y enlaza a donde crearlos', async () => {
        api.aulasListar.mockResolvedValue({ total: 0, items: [] });
        render(<NuevoGrupo />);
        await screen.findByRole('heading', { name: 'Materia y docente' });
        expect(await screen.findByText('Faltan datos para crear un grupo')).toBeTruthy();
        expect(screen.getByRole('link', { name: 'aulas' })).toHaveAttribute('href', '/admin/aulas');
    });

    describe('preselección con ?materia= y ?aula=', () => {
        it('con una materia que existe abre con ella elegida, el foco en el docente y el resumen al día', async () => {
            render(<NuevoGrupo materiaInicial={1} />);
            const materia = await screen.findByRole('combobox', { name: 'Materia' });
            expect(materia).toHaveValue('Administración I');
            await waitFor(() => expect(screen.getByRole('combobox', { name: 'Docente' })).toHaveFocus());
            expect(screen.getByRole('combobox', { name: 'Docente' })).toHaveValue('');
            // La revisión (y el resumen lateral) ya traen la materia sin haberla tocado.
            expect(screen.getAllByText('Administración I').length).toBeGreaterThan(0);
        });

        it('con un aula que existe la deja elegida en el paso 2, con su capacidad en la revisión', async () => {
            const user = userEvent.setup();
            render(<NuevoGrupo aulaInicial={2} />);
            await llenarPasoUno(user);
            await user.click(screen.getByRole('button', { name: /Siguiente/ }));
            await screen.findByRole('heading', { name: 'Aula y horario' });
            expect(screen.getByRole('combobox', { name: 'Aula' })).toHaveValue('A-12');
            await user.click(screen.getByRole('button', { name: /Siguiente/ }));
            await screen.findByRole('heading', { name: 'Revisión' });
            expect(screen.getByText('40 lugares')).toBeTruthy();
        });

        it('un id que no existe en el catálogo se ignora sin error: abre vacío y sin mover el foco', async () => {
            render(<NuevoGrupo materiaInicial={999} aulaInicial={888} />);
            const materia = await screen.findByRole('combobox', { name: 'Materia' });
            expect(materia).toHaveValue('');
            expect(screen.getByRole('combobox', { name: 'Docente' })).not.toHaveFocus();
            expect(screen.queryByRole('alert')).toBeNull();
        });

        it('espera a que carguen los catálogos antes de mostrar el formulario (no parpadea vacío)', async () => {
            let resolver;
            api.materiasListar.mockReturnValue(new Promise((r) => { resolver = r; }));
            render(<NuevoGrupo materiaInicial={1} />);
            await waitFor(() => expect(api.materiasListar).toHaveBeenCalled());
            expect(screen.queryByRole('combobox', { name: 'Materia' })).toBeNull();
            resolver(MATERIAS);
            expect(await screen.findByRole('combobox', { name: 'Materia' })).toHaveValue('Administración I');
        });

        it('crea el grupo con la materia preseleccionada como si la hubiera elegido a mano', async () => {
            const user = userEvent.setup();
            render(<NuevoGrupo materiaInicial={1} />);
            await screen.findByRole('combobox', { name: 'Materia' });
            await elegir(user, 'Docente', 'lópez', /López Ruiz Ana/);
            await user.type(screen.getByLabelText(/Clave del grupo/), '3a');
            await user.click(screen.getByRole('button', { name: /Siguiente/ }));
            await screen.findByRole('heading', { name: 'Aula y horario' });
            await llenarPasoDos(user, { franja: false });
            await user.click(screen.getByRole('button', { name: /Siguiente/ }));
            await screen.findByRole('heading', { name: 'Revisión' });
            await user.click(screen.getByRole('button', { name: 'Crear grupo' }));
            await screen.findByRole('heading', { name: 'Grupo 3A creado' });
            expect(api.grupoGuardar).toHaveBeenCalledWith({ datos: { id_materia: 1, id_docente: 4, id_aula: 2, clave_grupo: '3A', periodo: '2026-2' } });
        });
    });
});
