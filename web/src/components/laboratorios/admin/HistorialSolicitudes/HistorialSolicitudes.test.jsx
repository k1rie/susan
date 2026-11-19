// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listar = vi.hoisted(() => vi.fn());
const cancelar = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/laboratorios.js', () => ({
    laboratorioSolicitudesListar: (...a) => listar(...a),
    laboratorioCancelar: (...a) => cancelar(...a),
}));

import { ToastProvider } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/errors.js';
import HistorialSolicitudes from './HistorialSolicitudes.jsx';

const CONTEOS = { pendiente: 2, aprobada: 3, rechazada: 1, cancelada: 0, total: 6 };
const labs = { data: { total: 2, items: [{ id_aula: 3, clave: 'LAB-1', edificio: 'C', capacidad: 30 }, { id_aula: 4, clave: 'LAB-2', edificio: 'D', capacidad: 20 }] } };

const solicitud = (extra = {}) => ({
    id_solicitud: 7,
    estatus: 'aprobada',
    vencida: false,
    fecha: '2026-09-16',
    hora_inicio: '10:00',
    hora_fin: '12:00',
    actividad: 'Práctica de balanza',
    aula: { id_aula: 3, clave: 'LAB-1', edificio: 'C', capacidad: 30 },
    grupo: { id_grupo: 1, clave_grupo: '3A', materia_clave: 'ADM101', materia_nombre: 'Administración I', inscritos: 28 },
    docente: { id_docente: 1, nombre_completo: 'López Ruiz Ana' },
    resuelto_por: 'admin@unach.mx',
    fecha_resolucion: '2026-09-14T13:12:00+00:00',
    comentario: null,
    ...extra,
});

const respuesta = (items, total = items.length) => ({ total, conteos: CONTEOS, items });
const AHORA = { fecha: '2026-09-14', hora: '08:00' };

function abrir(props = {}) {
    const onCambio = vi.fn();
    render(
        <ToastProvider>
            <HistorialSolicitudes laboratorios={labs} hoy="2026-09-14" ahora={AHORA} onCambio={onCambio} {...props} />
        </ToastProvider>,
    );
    return { onCambio };
}

beforeEach(() => {
    listar.mockReset();
    cancelar.mockReset();
});

describe('HistorialSolicitudes: lista y filtros', () => {
    it('abre en aprobadas, con contadores por estatus, y pide la primera página', async () => {
        listar.mockResolvedValue(respuesta([solicitud()]));
        abrir();
        expect(await screen.findByText('Práctica de balanza')).toBeInTheDocument();
        expect(listar).toHaveBeenCalledWith({ estatus: 'aprobada', limit: 10, offset: 0 });
        const aprobadas = screen.getByRole('button', { name: /Aprobadas/ });
        expect(aprobadas).toHaveAttribute('aria-pressed', 'true');
        expect(aprobadas).toHaveTextContent('3');
        expect(screen.getByRole('button', { name: /Rechazadas/ })).toHaveTextContent('1');
        expect(screen.getByRole('button', { name: /Canceladas/ })).toHaveTextContent('0');
        // No hay píldora de pendientes: viven en su pestaña.
        expect(screen.queryByRole('button', { name: /Pendientes/ })).toBeNull();
    });

    it('muestra quién resolvió, cuándo y el comentario con su rótulo', async () => {
        listar.mockResolvedValue(
            respuesta([solicitud({ id_solicitud: 8, estatus: 'rechazada', comentario: 'Cruce con examen departamental' })]),
        );
        abrir();
        expect(await screen.findByText('Rechazada por admin@unach.mx · lun 14 sep, 07:12')).toBeInTheDocument();
        expect(screen.getByText('Motivo del rechazo:')).toBeInTheDocument();
        expect(screen.getByText(/Cruce con examen departamental/)).toBeInTheDocument();
    });

    it('cambiar de píldora vuelve a la primera página con el nuevo estatus y conserva los contadores', async () => {
        const user = userEvent.setup();
        listar.mockResolvedValue(respuesta([solicitud()]));
        abrir();
        await screen.findByText('Práctica de balanza');
        listar.mockResolvedValue(respuesta([solicitud({ id_solicitud: 9, estatus: 'rechazada', comentario: 'No hay material' })]));
        await user.click(screen.getByRole('button', { name: /Rechazadas/ }));
        await waitFor(() => expect(listar).toHaveBeenLastCalledWith({ estatus: 'rechazada', limit: 10, offset: 0 }));
        expect(await screen.findByText(/No hay material/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Rechazadas/ })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: /Aprobadas/ })).toHaveTextContent('3');
    });

    it('filtra por laboratorio con el id del aula', async () => {
        const user = userEvent.setup();
        listar.mockResolvedValue(respuesta([solicitud()]));
        abrir();
        await screen.findByText('Práctica de balanza');
        await user.selectOptions(screen.getByLabelText('Laboratorio'), 'LAB-2 · D');
        await waitFor(() => expect(listar).toHaveBeenLastCalledWith({ estatus: 'aprobada', idAula: 4, limit: 10, offset: 0 }));
    });

    it('sin laboratorios cargados no ofrece el filtro de laboratorio', async () => {
        listar.mockResolvedValue(respuesta([solicitud()]));
        abrir({ laboratorios: { data: null } });
        await screen.findByText('Práctica de balanza');
        expect(screen.queryByLabelText('Laboratorio')).toBeNull();
    });

    it('pagina con «Siguiente»', async () => {
        const user = userEvent.setup();
        listar.mockResolvedValue(respuesta([solicitud()], 25));
        abrir();
        await screen.findByText('Práctica de balanza');
        expect(screen.getByText('Mostrando 1-10 de 25')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Siguiente' }));
        await waitFor(() => expect(listar).toHaveBeenLastCalledWith({ estatus: 'aprobada', limit: 10, offset: 10 }));
    });

    it('sin resultados lo dice según el estatus', async () => {
        listar.mockResolvedValue(respuesta([]));
        abrir();
        expect(await screen.findByText('Aún no hay solicitudes aprobadas.')).toBeInTheDocument();
    });

    it('si falla la carga ofrece reintentar', async () => {
        const user = userEvent.setup();
        listar.mockRejectedValueOnce(new ApiError({ code: 'ERROR_RED', message: 'No se pudo conectar con el servidor.', status: 503 }));
        listar.mockResolvedValue(respuesta([solicitud()]));
        abrir();
        expect(await screen.findByText('No se pudo conectar con el servidor.')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Reintentar' }));
        expect(await screen.findByText('Práctica de balanza')).toBeInTheDocument();
    });
});

describe('HistorialSolicitudes: cancelar una aprobada', () => {
    it('solo una aprobada que aún no inicia ofrece «Cancelar aprobación»', async () => {
        listar.mockResolvedValue(
            respuesta([
                solicitud({ id_solicitud: 1, fecha: '2026-09-16' }),
                solicitud({ id_solicitud: 2, fecha: '2026-09-14', hora_inicio: '07:00', hora_fin: '09:00' }),
                solicitud({ id_solicitud: 3, fecha: '2026-09-12' }),
            ]),
        );
        abrir();
        await screen.findAllByRole('article');
        // Solo la primera (16 sep) no ha iniciado; la del 14 a las 07:00 ya empezó (son las 08:00) y la del 12 ya pasó.
        expect(screen.getAllByRole('button', { name: 'Cancelar aprobación' })).toHaveLength(1);
    });

    it('rechazadas y canceladas no ofrecen cancelar', async () => {
        const user = userEvent.setup();
        listar.mockResolvedValue(respuesta([solicitud({ estatus: 'rechazada', comentario: 'No hay material' })]));
        abrir();
        await screen.findByText(/No hay material/);
        expect(screen.queryByRole('button', { name: 'Cancelar aprobación' })).toBeNull();
        await user.click(screen.getByRole('button', { name: /Canceladas/ }));
        expect(screen.queryByRole('button', { name: 'Cancelar aprobación' })).toBeNull();
    });

    it('el motivo es obligatorio: sin él no llama al servidor', async () => {
        const user = userEvent.setup();
        listar.mockResolvedValue(respuesta([solicitud()]));
        abrir();
        await user.click(await screen.findByRole('button', { name: 'Cancelar aprobación' }));
        const dialogo = screen.getByRole('dialog', { name: 'Cancelar solicitud aprobada' });
        expect(within(dialogo).getByText(/Se liberará LAB-1 · C, mié 16 sep de 10:00 – 12:00/)).toBeInTheDocument();
        await user.click(within(dialogo).getByRole('button', { name: 'Cancelar solicitud' }));
        expect(within(dialogo).getByText('Escribe el motivo: mínimo 3 caracteres.')).toBeInTheDocument();
        expect(cancelar).not.toHaveBeenCalled();
    });

    it('con motivo cancela, avisa, recarga el historial y notifica a la bandeja', async () => {
        const user = userEvent.setup();
        cancelar.mockResolvedValue(solicitud({ estatus: 'cancelada' }));
        listar.mockResolvedValue(respuesta([solicitud()]));
        const { onCambio } = abrir();
        await user.click(await screen.findByRole('button', { name: 'Cancelar aprobación' }));
        await user.type(screen.getByLabelText(/Motivo de la cancelación/), 'Mantenimiento del laboratorio');
        listar.mockResolvedValue(respuesta([], 0));
        await user.click(screen.getByRole('button', { name: 'Cancelar solicitud' }));
        await waitFor(() => expect(cancelar).toHaveBeenCalledWith({ idSolicitud: 7, comentario: 'Mantenimiento del laboratorio' }));
        expect(await screen.findByText('Solicitud cancelada')).toBeInTheDocument();
        await waitFor(() => expect(onCambio).toHaveBeenCalled());
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(await screen.findByText('Aún no hay solicitudes aprobadas.')).toBeInTheDocument();
    });

    it('SOLICITUD_VENCIDA: muestra el mensaje, cierra el diálogo y recarga', async () => {
        const user = userEvent.setup();
        cancelar.mockRejectedValue(new ApiError({ code: 'SOLICITUD_VENCIDA', message: 'La solicitud aprobada ya inició o pasó; no se puede cancelar.', status: 409 }));
        listar.mockResolvedValue(respuesta([solicitud()]));
        const { onCambio } = abrir();
        await user.click(await screen.findByRole('button', { name: 'Cancelar aprobación' }));
        await user.type(screen.getByLabelText(/Motivo de la cancelación/), 'Mantenimiento');
        await user.click(screen.getByRole('button', { name: 'Cancelar solicitud' }));
        expect(await screen.findByText('La solicitud aprobada ya inició o pasó; no se puede cancelar.')).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).toBeNull();
        await waitFor(() => expect(onCambio).toHaveBeenCalled());
        expect(listar.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('un error de red deja el diálogo abierto con el motivo escrito', async () => {
        const user = userEvent.setup();
        cancelar.mockRejectedValue(new ApiError({ code: 'ERROR_RED', message: 'No se pudo conectar con el servidor.', status: 503 }));
        listar.mockResolvedValue(respuesta([solicitud()]));
        abrir();
        await user.click(await screen.findByRole('button', { name: 'Cancelar aprobación' }));
        await user.type(screen.getByLabelText(/Motivo de la cancelación/), 'Mantenimiento');
        await user.click(screen.getByRole('button', { name: 'Cancelar solicitud' }));
        const dialogo = screen.getByRole('dialog', { name: 'Cancelar solicitud aprobada' });
        expect(await within(dialogo).findByText('No se pudo conectar con el servidor.')).toBeInTheDocument();
        expect(within(dialogo).getByLabelText(/Motivo de la cancelación/)).toHaveValue('Mantenimiento');
    });

    it('«Volver» cierra sin cancelar nada', async () => {
        const user = userEvent.setup();
        listar.mockResolvedValue(respuesta([solicitud()]));
        abrir();
        await user.click(await screen.findByRole('button', { name: 'Cancelar aprobación' }));
        await user.click(screen.getByRole('button', { name: 'Volver' }));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(cancelar).not.toHaveBeenCalled();
    });
});
