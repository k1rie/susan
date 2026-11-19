// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/errors.js';

const api = vi.hoisted(() => ({
    listar: vi.fn(),
    cancelar: vi.fn(),
    solicitar: vi.fn(),
    agenda: vi.fn(),
    laboratorios: vi.fn(),
    filtros: vi.fn(),
    ahora: vi.fn(),
    parametros: vi.fn(),
}));
vi.mock('@/lib/api/laboratorios.js', () => ({
    laboratorioSolicitudesListar: (...a) => api.listar(...a),
    laboratorioCancelar: (...a) => api.cancelar(...a),
    laboratorioSolicitar: (...a) => api.solicitar(...a),
    laboratorioAgenda: (...a) => api.agenda(...a),
    laboratoriosListar: (...a) => api.laboratorios(...a),
}));
vi.mock('@/lib/api/reportes.js', () => ({ reporteFiltros: (...a) => api.filtros(...a) }));
vi.mock('@/lib/api/plataforma.js', () => ({ ahora: (...a) => api.ahora(...a), parametrosPublicos: (...a) => api.parametros(...a) }));

import LaboratoriosDocente from './LaboratoriosDocente.jsx';

const LAB1 = { id_aula: 3, clave: 'LAB-1', edificio: 'C', capacidad: 30 };
const GRUPO_3A = { id_grupo: 1, clave_grupo: '3A', periodo: '2026-2', materia_clave: 'ADM101', materia_nombre: 'Administración I', inscritos: 4 };

const solicitud = (id, estatus, extra = {}) => ({
    id_solicitud: id,
    estatus,
    vencida: false,
    fecha: '2026-09-17',
    hora_inicio: '10:00',
    hora_fin: '12:00',
    actividad: `Actividad ${id}`,
    comentario: null,
    aula: LAB1,
    grupo: GRUPO_3A,
    ...extra,
});

const TODAS = [
    solicitud(1, 'pendiente'),
    solicitud(2, 'aprobada', { comentario: 'Autorizado. Pasar por las llaves.' }),
    solicitud(3, 'rechazada', { comentario: 'Mantenimiento programado.' }),
    solicitud(4, 'cancelada'),
];
const CONTEOS = { pendiente: 1, aprobada: 1, rechazada: 1, cancelada: 1, total: 4 };

// El servidor filtra por estatus; el simulacro hace lo mismo.
function responder({ estatus, limit = 50, offset = 0 } = {}) {
    const filtradas = estatus ? TODAS.filter((s) => s.estatus === estatus) : TODAS;
    return Promise.resolve({ total: filtradas.length, conteos: CONTEOS, items: filtradas.slice(offset, offset + limit) });
}

beforeEach(() => {
    api.listar.mockImplementation(responder);
    api.cancelar.mockImplementation(async ({ idSolicitud }) => ({ ...TODAS.find((s) => s.id_solicitud === idSolicitud), estatus: 'cancelada' }));
    api.ahora.mockResolvedValue({ fecha: '2026-09-15', hora: '09:00:00' });
    api.parametros.mockResolvedValue({ lab_anticipacion_horas: 24, lab_horizonte_dias: 60 });
    api.laboratorios.mockResolvedValue({ total: 1, items: [LAB1] });
    api.filtros.mockResolvedValue({ periodo: '2026-2', grupos: [GRUPO_3A] });
    api.agenda.mockResolvedValue({ aula: LAB1, bloques: [] });
    api.solicitar.mockResolvedValue(solicitud(9, 'pendiente'));
});

async function abrir() {
    render(
        <ToastProvider>
            <LaboratoriosDocente />
        </ToastProvider>,
    );
    await screen.findByText('Actividad 1');
}

const tarjetas = () => screen.getAllByRole('article');

describe('LaboratoriosDocente: lista', () => {
    it('abre con el encabezado, la acción principal, las píldoras con contadores y las tarjetas', async () => {
        await abrir();
        expect(screen.getByRole('heading', { level: 1, name: 'Laboratorios' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Nueva solicitud' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 2, name: 'Mis solicitudes' })).toBeInTheDocument();
        const filtros = screen.getByRole('group', { name: 'Filtrar solicitudes por estatus' });
        expect(within(filtros).getByRole('button', { name: /Todas/ })).toHaveTextContent('4');
        expect(within(filtros).getByRole('button', { name: /Pendientes/ })).toHaveTextContent('1');
        expect(within(filtros).getByRole('button', { name: /Todas/ })).toHaveAttribute('aria-pressed', 'true');
        expect(tarjetas()).toHaveLength(4);
        expect(screen.getByText('Autorizado. Pasar por las llaves.')).toBeInTheDocument();
        expect(screen.getByText('Mantenimiento programado.')).toBeInTheDocument();
    });

    it('filtra por estatus en el servidor y conserva los contadores', async () => {
        const user = userEvent.setup();
        await abrir();
        await user.click(screen.getByRole('button', { name: /Aprobadas/ }));
        await waitFor(() => expect(api.listar).toHaveBeenLastCalledWith({ estatus: 'aprobada', limit: 50 }));
        await waitFor(() => expect(tarjetas()).toHaveLength(1));
        expect(screen.getByText('Actividad 2')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Rechazadas/ })).toHaveTextContent('1');
        expect(screen.getByRole('button', { name: /Aprobadas/ })).toHaveAttribute('aria-pressed', 'true');
    });

    it('sin solicitudes explica y ofrece crear la primera, sin píldoras', async () => {
        api.listar.mockResolvedValue({ total: 0, conteos: { pendiente: 0, aprobada: 0, rechazada: 0, cancelada: 0, total: 0 }, items: [] });
        render(<LaboratoriosDocente />);
        expect(await screen.findByText('Todavía no has solicitado laboratorios')).toBeInTheDocument();
        expect(screen.queryByRole('group', { name: 'Filtrar solicitudes por estatus' })).toBeNull();
        expect(screen.getAllByRole('button', { name: 'Nueva solicitud' })).toHaveLength(2);
    });

    it('un filtro sin resultados ofrece volver a ver todas', async () => {
        const user = userEvent.setup();
        api.listar.mockImplementation(({ estatus }) =>
            Promise.resolve(estatus ? { total: 0, conteos: CONTEOS, items: [] } : { total: 4, conteos: CONTEOS, items: TODAS }),
        );
        await abrir();
        await user.click(screen.getByRole('button', { name: /Canceladas/ }));
        expect(await screen.findByText('No tienes solicitudes canceladas')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Ver todas las solicitudes' }));
        expect(await screen.findByText('Actividad 1')).toBeInTheDocument();
    });

    it('si no carga muestra el error del servidor y deja reintentar', async () => {
        const user = userEvent.setup();
        api.listar.mockRejectedValueOnce(new ApiError({ code: 'ERROR_INTERNO', message: 'Sin conexión con el servidor.', status: 500 }));
        render(<LaboratoriosDocente />);
        expect(await screen.findByText('Sin conexión con el servidor.')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Reintentar' }));
        expect(await screen.findByText('Actividad 1')).toBeInTheDocument();
    });

    it('«Ver más» pide la página siguiente y la agrega sin repetir', async () => {
        const user = userEvent.setup();
        const muchas = Array.from({ length: 60 }, (_, i) => solicitud(i + 1, 'cancelada'));
        api.listar.mockImplementation(({ limit = 50, offset = 0 }) =>
            Promise.resolve({ total: 60, conteos: { ...CONTEOS, cancelada: 60, total: 60 }, items: muchas.slice(offset, offset + limit) }),
        );
        render(<LaboratoriosDocente />);
        await screen.findByText('Actividad 1');
        expect(tarjetas()).toHaveLength(50);
        expect(screen.getByText('Mostrando 50 de 60 solicitudes')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Ver más' }));
        await waitFor(() => expect(tarjetas()).toHaveLength(60));
        expect(api.listar).toHaveBeenLastCalledWith({ estatus: undefined, limit: 50, offset: 50 });
        expect(screen.queryByRole('button', { name: 'Ver más' })).toBeNull();
    });
});

describe('LaboratoriosDocente: cancelar', () => {
    const botonCancelar = (n) => screen.getAllByRole('button', { name: /^Cancelar la solicitud de/ })[n];

    it('solo ofrece cancelar las pendientes y las aprobadas que no han iniciado', async () => {
        await abrir();
        // Pendiente (1) y aprobada (2) sí; rechazada (3) y cancelada (4) no.
        expect(screen.getAllByRole('button', { name: /^Cancelar la solicitud de/ })).toHaveLength(2);
    });

    it('una aprobada que ya inició no se puede cancelar (reloj del plantel)', async () => {
        api.ahora.mockResolvedValue({ fecha: '2026-09-17', hora: '10:30:00' });
        await abrir();
        await waitFor(() => expect(screen.getAllByRole('button', { name: /^Cancelar la solicitud de/ })).toHaveLength(1));
        const tarjeta = screen.getByText('Actividad 2').closest('article');
        expect(within(tarjeta).queryByRole('button', { name: /Cancelar/ })).toBeNull();
    });

    it('confirma con un motivo opcional, avisa y refresca la lista', async () => {
        const user = userEvent.setup();
        await abrir();
        await user.click(botonCancelar(0));
        const dialogo = await screen.findByRole('dialog', { name: 'Cancelar la solicitud' });
        expect(within(dialogo).getByText(/¿Cancelar la solicitud de LAB-1, jue 17 sep, 10:00 – 12:00\?/)).toBeInTheDocument();
        await user.type(within(dialogo).getByLabelText(/Motivo/), 'Ya no lo necesito');
        const llamadas = api.listar.mock.calls.length;
        await user.click(within(dialogo).getByRole('button', { name: 'Cancelar solicitud' }));
        await waitFor(() => expect(api.cancelar).toHaveBeenCalledWith({ idSolicitud: 1, comentario: 'Ya no lo necesito' }));
        expect(await screen.findByText('Solicitud cancelada')).toBeInTheDocument();
        await waitFor(() => expect(api.listar.mock.calls.length).toBeGreaterThan(llamadas));
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Cancelar la solicitud' })).toBeNull());
    });

    it('sin motivo no manda comentario', async () => {
        const user = userEvent.setup();
        await abrir();
        await user.click(botonCancelar(0));
        const dialogo = await screen.findByRole('dialog', { name: 'Cancelar la solicitud' });
        await user.click(within(dialogo).getByRole('button', { name: 'Cancelar solicitud' }));
        await waitFor(() => expect(api.cancelar).toHaveBeenCalledWith({ idSolicitud: 1, comentario: undefined }));
    });

    it('una aprobada avisa que el laboratorio queda libre', async () => {
        const user = userEvent.setup();
        await abrir();
        await user.click(botonCancelar(1));
        expect(await screen.findByText(/Ya está aprobada: al cancelarla el laboratorio queda libre/)).toBeInTheDocument();
    });

    it('«Conservarla» cierra sin cancelar', async () => {
        const user = userEvent.setup();
        await abrir();
        await user.click(botonCancelar(0));
        await user.click(await screen.findByRole('button', { name: 'Conservarla' }));
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Cancelar la solicitud' })).toBeNull());
        expect(api.cancelar).not.toHaveBeenCalled();
    });

    it('si el servidor la rechaza muestra su mensaje en el diálogo y refresca la lista', async () => {
        const user = userEvent.setup();
        api.cancelar.mockRejectedValue(new ApiError({ code: 'SOLICITUD_VENCIDA', message: 'La solicitud aprobada ya inició o pasó; no se puede cancelar.', status: 400 }));
        await abrir();
        await user.click(botonCancelar(1));
        const dialogo = await screen.findByRole('dialog', { name: 'Cancelar la solicitud' });
        const llamadas = api.listar.mock.calls.length;
        await user.click(within(dialogo).getByRole('button', { name: 'Cancelar solicitud' }));
        expect(await within(dialogo).findByText('La solicitud aprobada ya inició o pasó; no se puede cancelar.')).toBeInTheDocument();
        expect(within(dialogo).getByText('No se pudo cancelar')).toBeInTheDocument();
        await waitFor(() => expect(api.listar.mock.calls.length).toBeGreaterThan(llamadas));
        expect(screen.getByRole('dialog', { name: 'Cancelar la solicitud' })).toBeInTheDocument();
    });
});

describe('LaboratoriosDocente: nueva solicitud', () => {
    async function enviarNueva(user) {
        await user.click(screen.getByRole('button', { name: 'Nueva solicitud' }));
        const panel = await screen.findByRole('dialog', { name: 'Nueva solicitud de laboratorio' });
        await within(panel).findByRole('combobox', { name: /Laboratorio/ });
        // Laboratorio y grupo únicos: ya vienen elegidos.
        await waitFor(() => expect(within(panel).getByRole('combobox', { name: /Grupo/ })).toHaveValue('1'));
        fireEvent.change(within(panel).getByLabelText(/Fecha de uso/), { target: { value: '2026-09-18' } });
        fireEvent.change(within(panel).getByLabelText(/Hora de inicio/), { target: { value: '10:00' } });
        fireEvent.change(within(panel).getByLabelText(/Hora de fin/), { target: { value: '12:00' } });
        await user.type(within(panel).getByLabelText(/Actividad/), 'Práctica de balanza');
        await user.click(within(panel).getByRole('button', { name: 'Enviar solicitud' }));
        return panel;
    }

    it('abre el panel, envía, avisa que queda pendiente y refresca la lista de detrás', async () => {
        const user = userEvent.setup();
        await abrir();
        const llamadas = api.listar.mock.calls.length;
        await enviarNueva(user);
        await waitFor(() => expect(api.solicitar).toHaveBeenCalledTimes(1));
        expect(await screen.findByText('Queda pendiente hasta que el administrador la revise.')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Solicitud enviada' })).toBeInTheDocument();
        await waitFor(() => expect(api.listar.mock.calls.length).toBeGreaterThan(llamadas));
    });

    it('si el filtro activo ocultaría la solicitud nueva, pasa a «Pendientes»', async () => {
        const user = userEvent.setup();
        await abrir();
        await user.click(screen.getByRole('button', { name: /Aprobadas/ }));
        await waitFor(() => expect(tarjetas()).toHaveLength(1));
        await enviarNueva(user);
        await waitFor(() => expect(api.solicitar).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.getByRole('button', { name: /Pendientes/ })).toHaveAttribute('aria-pressed', 'true'));
        expect(api.listar).toHaveBeenLastCalledWith({ estatus: 'pendiente', limit: 50 });
    });
});
