// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
    listar: vi.fn(),
    laboratorios: vi.fn(),
    agenda: vi.fn(),
    resolver: vi.fn(),
    cancelar: vi.fn(),
    ahora: vi.fn(),
}));
vi.mock('@/lib/api/laboratorios.js', () => ({
    laboratorioSolicitudesListar: (...a) => api.listar(...a),
    laboratoriosListar: (...a) => api.laboratorios(...a),
    laboratorioAgenda: (...a) => api.agenda(...a),
    laboratorioResolver: (...a) => api.resolver(...a),
    laboratorioCancelar: (...a) => api.cancelar(...a),
}));
vi.mock('@/lib/api/plataforma.js', () => ({ ahora: (...a) => api.ahora(...a) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...r }) => <a href={href} {...r}>{children}</a> }));

import { ToastProvider } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/errors.js';
import SolicitudesLaboratorio from './SolicitudesLaboratorio.jsx';

const lab = { id_aula: 3, clave: 'LAB-1', edificio: 'C', capacidad: 30 };
const pendiente = (id, extra = {}) => ({
    id_solicitud: id,
    estatus: 'pendiente',
    vencida: false,
    fecha: '2026-09-16',
    hora_inicio: '10:00',
    hora_fin: '12:00',
    actividad: `Actividad ${id}`,
    aula: lab,
    grupo: { id_grupo: id, clave_grupo: `${id}A`, materia_clave: 'ADM101', materia_nombre: 'Administración I', inscritos: 20 },
    docente: { id_docente: 1, nombre_completo: 'López Ruiz Ana' },
    conflicto: null,
    compite: 0,
    ...extra,
});
const conteos = (pendientes) => ({ pendiente: pendientes, aprobada: 2, rechazada: 1, cancelada: 0, total: pendientes + 3 });
const bandeja = (items) => ({ total: items.length, conteos: conteos(items.length), items });

beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    api.ahora.mockResolvedValue({ fecha: '2026-09-14', hora: '08:00:00', zona: 'America/Mexico_City', reloj_simulado: true });
    api.laboratorios.mockResolvedValue({ total: 1, items: [lab] });
    api.agenda.mockResolvedValue({ aula: lab, desde: '2026-09-14', hasta: '2026-09-20', bloques: [] });
    api.listar.mockImplementation(async ({ estatus }) => (estatus === 'pendiente' ? bandeja([pendiente(1), pendiente(2)]) : { total: 0, conteos: conteos(2), items: [] }));
});

function abrir(props = {}) {
    return render(
        <ToastProvider>
            <SolicitudesLaboratorio {...props} />
        </ToastProvider>,
    );
}

describe('SolicitudesLaboratorio', () => {
    it('título, tres pestañas y el contador de pendientes', async () => {
        abrir();
        expect(screen.getByRole('heading', { level: 1, name: 'Solicitudes de laboratorio' })).toBeInTheDocument();
        const tabs = screen.getAllByRole('tab');
        expect(tabs.map((t) => t.textContent.replace(/\s+/g, ' ').trim())).toEqual(['Pendientes', 'Agenda', 'Historial']);
        expect(await screen.findByRole('tab', { name: /Pendientes\s*\(2\)/ })).toHaveAttribute('aria-selected', 'true');
        expect(await screen.findAllByRole('article')).toHaveLength(2);
        expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'lab-pendientes');
    });

    it('con la bandeja vacía celebra sin exagerar y el contador dice 0', async () => {
        api.listar.mockResolvedValue(bandeja([]));
        abrir();
        expect(await screen.findByText('Todo al día')).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /Pendientes\s*\(0\)/ })).toBeInTheDocument();
    });

    it('aprobar una solicitud recarga la bandeja y el contador', async () => {
        const user = userEvent.setup();
        api.resolver.mockResolvedValue({ ...pendiente(1), estatus: 'aprobada' });
        abrir();
        const tarjetas = await screen.findAllByRole('article');
        await user.click(within(tarjetas[0]).getByRole('button', { name: 'Aprobar' }));
        api.listar.mockResolvedValue(bandeja([pendiente(2)]));
        await user.click(screen.getByRole('button', { name: 'Aprobar solicitud' }));
        await waitFor(() => expect(api.resolver).toHaveBeenCalledWith({ idSolicitud: 1, aprobar: true, comentario: undefined }));
        expect(await screen.findByRole('tab', { name: /Pendientes\s*\(1\)/ })).toBeInTheDocument();
        expect(screen.getAllByRole('article')).toHaveLength(1);
        expect(screen.getByText('Solicitud aprobada')).toBeInTheDocument();
    });

    it('si otra persona ya ocupó el laboratorio, muestra el mensaje y recarga con el conflicto nuevo', async () => {
        const user = userEvent.setup();
        api.resolver.mockRejectedValue(new ApiError({ code: 'LAB_OCUPADO', message: 'El laboratorio no está disponible en ese horario: el grupo 9Z tiene aprobado el laboratorio.', status: 409 }));
        abrir();
        const tarjetas = await screen.findAllByRole('article');
        await user.click(within(tarjetas[0]).getByRole('button', { name: 'Aprobar' }));
        api.listar.mockResolvedValue(bandeja([pendiente(1, { conflicto: 'el grupo 9Z tiene aprobado el laboratorio de 10:00 a 12:00' }), pendiente(2)]));
        await user.click(screen.getByRole('button', { name: 'Aprobar solicitud' }));
        expect(await screen.findByText('El laboratorio no está disponible en ese horario: el grupo 9Z tiene aprobado el laboratorio.')).toBeInTheDocument();
        expect(await screen.findByText('No se puede aprobar: el grupo 9Z tiene aprobado el laboratorio de 10:00 a 12:00.')).toBeInTheDocument();
        expect(within(screen.getAllByRole('article')[0]).getByRole('button', { name: 'Aprobar' })).toBeDisabled();
    });

    it('«Ver más» agrega la siguiente página sin repetir', async () => {
        const user = userEvent.setup();
        api.listar.mockImplementation(async ({ offset = 0 }) => ({
            total: 3,
            conteos: conteos(3),
            items: offset === 0 ? [pendiente(1), pendiente(2)] : [pendiente(2), pendiente(3)],
        }));
        abrir();
        await screen.findAllByRole('article');
        await user.click(screen.getByRole('button', { name: 'Ver más (1 restantes)' }));
        await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3));
        expect(api.listar).toHaveBeenLastCalledWith({ estatus: 'pendiente', limit: 50, offset: 2 });
        expect(screen.queryByRole('button', { name: /Ver más/ })).toBeNull();
    });

    it('la pestaña Agenda muestra la semana del laboratorio y el contador sigue visible', async () => {
        const user = userEvent.setup();
        abrir();
        await screen.findAllByRole('article');
        await user.click(screen.getByRole('tab', { name: 'Agenda' }));
        expect(await screen.findByText('Semana del lun 14 sep al dom 20 sep')).toBeInTheDocument();
        expect(api.agenda).toHaveBeenCalledWith({ idAula: 3, desde: '2026-09-14', hasta: '2026-09-20' });
        expect(screen.getByRole('tab', { name: /Pendientes\s*\(2\)/ })).toBeInTheDocument();
        expect(screen.queryByRole('article')).toBeNull();
    });

    it('la pestaña Historial pide las aprobadas', async () => {
        const user = userEvent.setup();
        abrir();
        await screen.findAllByRole('article');
        await user.click(screen.getByRole('tab', { name: 'Historial' }));
        await waitFor(() => expect(api.listar).toHaveBeenCalledWith({ estatus: 'aprobada', limit: 10, offset: 0 }));
        expect(await screen.findByText('Aún no hay solicitudes aprobadas.')).toBeInTheDocument();
    });

    it('un enlace con ?pestana=historial abre directamente el historial', async () => {
        abrir({ pestanaInicial: 'historial' });
        expect(screen.getByRole('tab', { name: 'Historial' })).toHaveAttribute('aria-selected', 'true');
        expect(await screen.findByText('Aún no hay solicitudes aprobadas.')).toBeInTheDocument();
    });

    it('si la bandeja no carga ofrece reintentar', async () => {
        const user = userEvent.setup();
        api.listar.mockRejectedValueOnce(new ApiError({ code: 'ERROR_RED', message: 'No se pudo conectar con el servidor.', status: 503 }));
        abrir();
        expect(await screen.findByText('No se pudo conectar con el servidor.')).toBeInTheDocument();
        api.listar.mockResolvedValue(bandeja([pendiente(1)]));
        await user.click(screen.getByRole('button', { name: 'Reintentar' }));
        expect(await screen.findAllByRole('article')).toHaveLength(1);
    });
});
