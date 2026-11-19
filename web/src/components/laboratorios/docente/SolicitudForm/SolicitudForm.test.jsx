// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors.js';

const api = vi.hoisted(() => ({
    solicitar: vi.fn(),
    agenda: vi.fn(),
    laboratorios: vi.fn(),
    filtros: vi.fn(),
    ahora: vi.fn(),
    parametros: vi.fn(),
}));
vi.mock('@/lib/api/laboratorios.js', () => ({
    laboratorioSolicitar: (...a) => api.solicitar(...a),
    laboratorioAgenda: (...a) => api.agenda(...a),
    laboratoriosListar: (...a) => api.laboratorios(...a),
}));
vi.mock('@/lib/api/reportes.js', () => ({ reporteFiltros: (...a) => api.filtros(...a) }));
vi.mock('@/lib/api/plataforma.js', () => ({ ahora: (...a) => api.ahora(...a), parametrosPublicos: (...a) => api.parametros(...a) }));

import SolicitudForm from './SolicitudForm.jsx';

const LAB1 = { id_aula: 3, clave: 'LAB-1', edificio: 'C', capacidad: 30, tipo: 'laboratorio' };
const LAB2 = { id_aula: 4, clave: 'LAB-2', edificio: 'C', capacidad: 25, tipo: 'laboratorio' };
const GRUPO_3A = { id_grupo: 1, clave_grupo: '3A', periodo: '2026-2', materia_clave: 'ADM101', materia_nombre: 'Administración I', inscritos: 4 };
const GRUPO_5C = { id_grupo: 2, clave_grupo: '5C', periodo: '2026-2', materia_clave: 'MAT200', materia_nombre: 'Álgebra', inscritos: 28 };

const creada = {
    id_solicitud: 7,
    estatus: 'pendiente',
    fecha: '2026-09-17',
    hora_inicio: '10:00',
    hora_fin: '12:00',
    aula: LAB1,
    grupo: GRUPO_3A,
};

beforeEach(() => {
    // Reloj de la demostración: lunes 14-sep-2026 07:12; anticipación de 24 h y horizonte de 60 días.
    api.ahora.mockResolvedValue({ fecha: '2026-09-14', hora: '07:12:00', zona: 'America/Mexico_City', reloj_simulado: true });
    api.parametros.mockResolvedValue({ lab_anticipacion_horas: 24, lab_horizonte_dias: 60 });
    api.laboratorios.mockResolvedValue({ total: 2, items: [LAB1, LAB2] });
    api.filtros.mockResolvedValue({ periodo: '2026-2', grupos: [GRUPO_3A, GRUPO_5C] });
    api.agenda.mockResolvedValue({ aula: LAB1, bloques: [] });
    api.solicitar.mockResolvedValue(creada);
});

async function abrir() {
    const onClose = vi.fn();
    const onCreada = vi.fn();
    render(<SolicitudForm onClose={onClose} onCreada={onCreada} />);
    const panel = await screen.findByRole('dialog', { name: 'Nueva solicitud de laboratorio' });
    await within(panel).findByRole('combobox', { name: /Laboratorio/ });
    return { panel, onClose, onCreada };
}

const poner = (etiqueta, valor) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });

async function llenar(user, cambios = {}) {
    const v = { laboratorio: '3', grupo: '1', fecha: '2026-09-17', inicio: '10:00', fin: '12:00', actividad: 'Práctica de balanza', ...cambios };
    await user.selectOptions(screen.getByRole('combobox', { name: /Laboratorio/ }), v.laboratorio);
    await user.selectOptions(screen.getByRole('combobox', { name: /Grupo/ }), v.grupo);
    poner(/Fecha de uso/, v.fecha);
    poner(/Hora de inicio/, v.inicio);
    poner(/Hora de fin/, v.fin);
    await user.type(screen.getByLabelText(/Actividad/), v.actividad);
}

describe('SolicitudForm: carga', () => {
    it('muestra los laboratorios con edificio y capacidad y los grupos con sus inscritos', async () => {
        await abrir();
        expect(screen.getByRole('option', { name: 'LAB-1 · Edificio C · 30 lugares' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'LAB-2 · Edificio C · 25 lugares' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Administración I (3A) · 4 alumnos' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Álgebra (5C) · 28 alumnos' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Enviar solicitud' })).toBeEnabled();
        expect(api.filtros).toHaveBeenCalled();
    });

    it('lleva el foco al primer campo por llenar cuando llegan los catálogos', async () => {
        await abrir();
        await waitFor(() => expect(screen.getByRole('combobox', { name: /Laboratorio/ })).toHaveFocus());
    });

    it('con grupo y laboratorio únicos el foco salta a la fecha', async () => {
        api.laboratorios.mockResolvedValue({ total: 1, items: [LAB1] });
        api.filtros.mockResolvedValue({ periodo: '2026-2', grupos: [GRUPO_3A] });
        await abrir();
        await waitFor(() => expect(screen.getByLabelText(/Fecha de uso/)).toHaveFocus());
    });

    it('la fecha admite desde mañana (24 h de anticipación) hasta 60 días y ofrece atajos', async () => {
        await abrir();
        const fecha = screen.getByLabelText(/Fecha de uso/);
        expect(fecha).toHaveAttribute('min', '2026-09-15');
        expect(fecha).toHaveAttribute('max', '2026-11-13');
        expect(screen.getByRole('button', { name: 'Mañana' })).toBeInTheDocument();
        expect(screen.getByText(/al menos 24 horas de anticipación y hasta 60 días antes/)).toBeInTheDocument();
    });

    it('con un solo grupo y un solo laboratorio los deja elegidos y sin «cambios sin guardar»', async () => {
        api.laboratorios.mockResolvedValue({ total: 1, items: [LAB1] });
        api.filtros.mockResolvedValue({ periodo: '2026-2', grupos: [GRUPO_3A] });
        await abrir();
        await waitFor(() => expect(screen.getByRole('combobox', { name: /Grupo/ })).toHaveValue('1'));
        expect(screen.getByRole('combobox', { name: /Laboratorio/ })).toHaveValue('3');
        expect(screen.queryByText(/cambio.* sin guardar/)).toBeNull();
    });

    it('si no se pueden cargar los catálogos muestra el error y deja reintentar', async () => {
        const user = userEvent.setup();
        api.laboratorios.mockRejectedValueOnce(new ApiError({ code: 'ERROR_INTERNO', message: 'Sin conexión con el servidor.', status: 500 }));
        render(<SolicitudForm onClose={vi.fn()} onCreada={vi.fn()} />);
        expect(await screen.findByText('Sin conexión con el servidor.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Enviar solicitud' })).toBeDisabled();
        await user.click(screen.getByRole('button', { name: 'Reintentar' }));
        expect(await screen.findByRole('combobox', { name: /Laboratorio/ })).toBeInTheDocument();
    });

    it('sin laboratorios o sin grupos lo dice y no deja enviar', async () => {
        api.laboratorios.mockResolvedValue({ total: 0, items: [] });
        await abrir();
        expect(screen.getByText(/Todavía no hay laboratorios registrados/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Enviar solicitud' })).toBeDisabled();
        expect(screen.getByText('No hay laboratorios registrados.')).toBeInTheDocument();
    });
});

describe('SolicitudForm: validación en el cliente', () => {
    it('con el formulario vacío no envía, muestra los errores y enfoca el primero', async () => {
        const user = userEvent.setup();
        await abrir();
        await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
        expect(api.solicitar).not.toHaveBeenCalled();
        expect(screen.getByText('Elige el laboratorio.')).toBeInTheDocument();
        expect(screen.getByText('Elige el grupo.')).toBeInTheDocument();
        expect(screen.getByText('Elige la fecha de uso.')).toBeInTheDocument();
        expect(screen.getByText('Elige la hora de inicio.')).toBeInTheDocument();
        expect(screen.getByText('Elige la hora de fin.')).toBeInTheDocument();
        expect(screen.getByText('Describe la actividad que harán en el laboratorio.')).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: /Laboratorio/ })).toHaveFocus();
        expect(screen.getByText('Revisa los campos marcados.')).toBeInTheDocument();
    });

    it('rechaza una fecha dentro de las 24 h, una hora de fin anterior y una actividad corta', async () => {
        const user = userEvent.setup();
        await abrir();
        await llenar(user, { fecha: '2026-09-14', inicio: '10:00', fin: '09:00', actividad: 'ab' });
        await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
        expect(screen.getByText('Solicita el laboratorio con al menos 24 horas de anticipación.')).toBeInTheDocument();
        expect(screen.getByText('La hora de fin debe ser posterior a la de inicio.')).toBeInTheDocument();
        expect(screen.getByText('Describe la actividad con al menos 3 caracteres.')).toBeInTheDocument();
        expect(api.solicitar).not.toHaveBeenCalled();
    });

    it('el día límite de la anticipación dice desde qué hora se puede empezar', async () => {
        const user = userEvent.setup();
        await abrir();
        await llenar(user, { fecha: '2026-09-15', inicio: '06:00', fin: '08:00' });
        await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
        expect(screen.getByText(/Ese día solo puedes empezar desde las 07:12/)).toBeInTheDocument();
    });

    it('muestra la duración elegida y el contador de la actividad', async () => {
        const user = userEvent.setup();
        await abrir();
        await llenar(user, { inicio: '10:00', fin: '11:30', actividad: 'Práctica' });
        expect(screen.getByText(/Duración: 1 h 30 min/)).toBeInTheDocument();
        expect(screen.getByText('8/200')).toBeInTheDocument();
    });
});

describe('SolicitudForm: avisos antes de enviar', () => {
    it('avisa (sin bloquear) cuando el grupo tiene más alumnos que el laboratorio', async () => {
        const user = userEvent.setup();
        await abrir();
        await user.selectOptions(screen.getByRole('combobox', { name: /Laboratorio/ }), '4');
        await user.selectOptions(screen.getByRole('combobox', { name: /Grupo/ }), '2');
        expect(screen.getByText('El grupo no cabe en este laboratorio')).toBeInTheDocument();
        expect(screen.getByText(/El grupo 5C tiene 28 alumnos activos y LAB-2 admite 25/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Enviar solicitud' })).toBeEnabled();
        await user.selectOptions(screen.getByRole('combobox', { name: /Laboratorio/ }), '3');
        expect(screen.queryByText('El grupo no cabe en este laboratorio')).toBeNull();
    });

    it('consulta la disponibilidad del día y la lista con su tipo', async () => {
        const user = userEvent.setup();
        api.agenda.mockResolvedValue({
            aula: LAB1,
            bloques: [
                { tipo: 'clase', estatus: null, fecha: '2026-09-17', hora_inicio: '08:00', hora_fin: '10:00', clave_grupo: '1B', materia_clave: 'MAT100', materia_nombre: 'Matemáticas', propia: false },
                { tipo: 'solicitud', estatus: 'aprobada', fecha: '2026-09-17', hora_inicio: '12:00', hora_fin: '14:00', clave_grupo: '3B', materia_clave: 'ADM101', materia_nombre: 'Administración I', propia: false },
            ],
        });
        await abrir();
        expect(screen.getByText(/Elige el laboratorio y una fecha disponible/)).toBeInTheDocument();
        await user.selectOptions(screen.getByRole('combobox', { name: /Laboratorio/ }), '3');
        poner(/Fecha de uso/, '2026-09-17');
        const lista = await screen.findByRole('list', { name: 'Bloques ocupados' });
        expect(api.agenda).toHaveBeenCalledWith({ idAula: 3, desde: '2026-09-17', hasta: '2026-09-17' });
        expect(within(lista).getAllByRole('listitem')).toHaveLength(2);
        expect(within(lista).getByText('Clase')).toBeInTheDocument();
        expect(within(lista).getByText('Aprobada')).toBeInTheDocument();
    });

    it('no consulta fechas que no se pueden solicitar', async () => {
        const user = userEvent.setup();
        await abrir();
        await user.selectOptions(screen.getByRole('combobox', { name: /Laboratorio/ }), '3');
        poner(/Fecha de uso/, '2026-09-14');
        await new Promise((r) => setTimeout(r, 400));
        expect(api.agenda).not.toHaveBeenCalled();
    });

    it('avisa antes de enviar si el horario se traslapa, pero deja enviar (el servidor decide)', async () => {
        const user = userEvent.setup();
        api.agenda.mockResolvedValue({
            aula: LAB1,
            bloques: [{ tipo: 'solicitud', estatus: 'aprobada', fecha: '2026-09-17', hora_inicio: '11:00', hora_fin: '13:00', clave_grupo: '3B', materia_clave: 'ADM101', materia_nombre: 'Administración I', propia: false }],
        });
        await abrir();
        await llenar(user);
        expect(await screen.findByText('El laboratorio está ocupado en este horario')).toBeInTheDocument();
        expect(screen.getByText(/11:00 – 13:00, solicitud aprobada de 3B/)).toBeInTheDocument();
        expect(screen.getByText('Se traslapa con tu horario')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Enviar solicitud' })).toBeEnabled();
        // Un horario libre quita el aviso.
        poner(/Hora de inicio/, '13:00');
        poner(/Hora de fin/, '14:00');
        await waitFor(() => expect(screen.queryByText('El laboratorio está ocupado en este horario')).toBeNull());
    });

    it('una solicitud pendiente de otro docente solo informa: no bloquea', async () => {
        const user = userEvent.setup();
        api.agenda.mockResolvedValue({
            aula: LAB1,
            bloques: [{ tipo: 'solicitud', estatus: 'pendiente', fecha: '2026-09-17', hora_inicio: '11:00', hora_fin: '13:00', clave_grupo: '5C', materia_clave: 'MAT200', materia_nombre: 'Álgebra', propia: false }],
        });
        await abrir();
        await llenar(user);
        expect(await screen.findByText('Hay otra solicitud pendiente en este horario')).toBeInTheDocument();
    });
});

describe('SolicitudForm: envío', () => {
    it('envía los datos convertidos, avisa a la pantalla y deja claro que queda pendiente', async () => {
        const user = userEvent.setup();
        const { onCreada } = await abrir();
        await llenar(user, { actividad: '  Práctica de balanza  ' });
        await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
        await waitFor(() =>
            expect(api.solicitar).toHaveBeenCalledWith({
                datos: { id_aula: 3, id_grupo: 1, fecha: '2026-09-17', hora_inicio: '10:00', hora_fin: '12:00', actividad: 'Práctica de balanza' },
            }),
        );
        expect(onCreada).toHaveBeenCalledWith(creada);
        expect(await screen.findByRole('heading', { name: 'Solicitud enviada' })).toBeInTheDocument();
        expect(screen.getByText(/Queda pendiente hasta que el administrador la revise/)).toBeInTheDocument();
        expect(screen.getByText(/LAB-1, jue 17 sep, 10:00 – 12:00, grupo 3A/)).toBeInTheDocument();
    });

    it('«Hacer otra solicitud» vuelve al formulario conservando laboratorio y grupo', async () => {
        const user = userEvent.setup();
        await abrir();
        await llenar(user);
        await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
        await user.click(await screen.findByRole('button', { name: 'Hacer otra solicitud' }));
        expect(screen.getByRole('combobox', { name: /Laboratorio/ })).toHaveValue('3');
        expect(screen.getByRole('combobox', { name: /Grupo/ })).toHaveValue('1');
        expect(screen.getByLabelText(/Fecha de uso/)).toHaveValue('');
        expect(screen.getByLabelText(/Actividad/)).toHaveValue('');
    });

    it('«Ver mis solicitudes» cierra el panel', async () => {
        const user = userEvent.setup();
        const { onClose } = await abrir();
        await llenar(user);
        await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
        await user.click(await screen.findByRole('button', { name: 'Ver mis solicitudes' }));
        expect(onClose).toHaveBeenCalled();
    });

    it('un error del servidor se muestra pegado a su campo con el mensaje tal cual y se conserva lo capturado', async () => {
        const user = userEvent.setup();
        api.solicitar.mockRejectedValue(new ApiError({ code: 'LAB_OCUPADO', message: 'El laboratorio no está disponible en ese horario: el grupo 3B de ADM101 tiene aprobado el laboratorio de 11:00 a 13:00.', status: 400 }));
        const { onCreada } = await abrir();
        await llenar(user);
        await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
        const mensaje = await screen.findByText(/El laboratorio no está disponible en ese horario: el grupo 3B de ADM101/);
        expect(mensaje).toHaveAttribute('role', 'alert');
        expect(screen.getByLabelText(/Hora de inicio/)).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText(/Hora de inicio/)).toHaveFocus();
        expect(screen.getByLabelText(/Actividad/)).toHaveValue('Práctica de balanza');
        expect(onCreada).not.toHaveBeenCalled();
        // Cambiar el horario deja de ser cierto el error y lo quita.
        poner(/Hora de fin/, '13:00');
        await waitFor(() => expect(screen.queryByText(/El laboratorio no está disponible en ese horario/)).toBeNull());
    });

    it.each([
        ['LAB_CAPACIDAD_INSUFICIENTE', 'El grupo 5C tiene 28 alumnos activos y el laboratorio LAB-2 admite 25.', () => screen.getByRole('combobox', { name: /Laboratorio/ })],
        ['SOLICITUD_DUPLICADA', 'Ese grupo ya tiene una solicitud pendiente o aprobada que se traslapa en esa fecha y horario.', () => screen.getByRole('combobox', { name: /Grupo/ })],
        ['LAB_FUERA_DE_PLAZO', 'Solo se puede solicitar con hasta 60 días de anticipación.', () => screen.getByLabelText(/Fecha de uso/)],
    ])('%s cae en su campo', async (code, message, campo) => {
        const user = userEvent.setup();
        api.solicitar.mockRejectedValue(new ApiError({ code, message, status: 400 }));
        await abrir();
        await llenar(user);
        await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
        expect(await screen.findByText(message)).toBeInTheDocument();
        expect(campo()).toHaveAttribute('aria-invalid', 'true');
    });

    it('un error que no es de un campo se muestra en un aviso del formulario', async () => {
        const user = userEvent.setup();
        api.solicitar.mockRejectedValue(new ApiError({ code: 'DOCENTE_NO_ACTIVO', message: 'Tu cuenta de docente no está activa; no puedes solicitar laboratorios.', status: 400 }));
        await abrir();
        await llenar(user);
        await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
        const aviso = await screen.findByText('Tu cuenta de docente no está activa; no puedes solicitar laboratorios.');
        expect(aviso.closest('[role="alert"]')).toHaveTextContent('No se pudo enviar la solicitud');
    });
});
