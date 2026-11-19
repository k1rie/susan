// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/laboratorios.js', () => ({ laboratorioResolver: (...a) => resolver(...a) }));

import { ToastProvider } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/errors.js';
import SolicitudPendiente from './SolicitudPendiente.jsx';

const solicitud = {
    id_solicitud: 7,
    estatus: 'pendiente',
    vencida: false,
    fecha: '2026-09-16',
    hora_inicio: '10:00',
    hora_fin: '12:00',
    actividad: 'Práctica de balanza',
    aula: { id_aula: 3, clave: 'LAB-1', edificio: 'C', capacidad: 30 },
    grupo: { id_grupo: 1, clave_grupo: '3A', materia_clave: 'ADM101', materia_nombre: 'Administración I', inscritos: 28 },
    docente: { id_docente: 1, nombre_completo: 'López Ruiz Ana' },
    conflicto: null,
    compite: 0,
};

function abrir(props = {}, datos = {}) {
    const onResuelta = vi.fn();
    const onRecargar = vi.fn();
    render(
        <ToastProvider>
            <SolicitudPendiente solicitud={{ ...solicitud, ...datos }} hoy="2026-09-14" onResuelta={onResuelta} onRecargar={onRecargar} {...props} />
        </ToastProvider>,
    );
    return { onResuelta, onRecargar };
}

// Con llaves: una función devuelta por beforeEach se ejecuta como limpieza, y mockReset() devuelve el propio mock.
beforeEach(() => {
    resolver.mockReset();
});

describe('SolicitudPendiente: lo que se ve', () => {
    it('muestra laboratorio, fecha, horario con duración, grupo, ocupación, docente y actividad', () => {
        abrir();
        const tarjeta = screen.getByRole('article');
        expect(within(tarjeta).getByRole('heading', { name: /LAB-1/ })).toHaveTextContent('Edificio C');
        expect(within(tarjeta).getByText('mié 16 sep')).toBeInTheDocument();
        expect(within(tarjeta).getByText('10:00 – 12:00')).toBeInTheDocument();
        expect(within(tarjeta).getByText('(2 h)')).toBeInTheDocument();
        expect(within(tarjeta).getByText(/3A · Administración I/)).toBeInTheDocument();
        expect(within(tarjeta).getByText('28 alumnos de 30 lugares')).toBeInTheDocument();
        expect(within(tarjeta).getByText('López Ruiz Ana')).toBeInTheDocument();
        expect(within(tarjeta).getByText('Práctica de balanza')).toBeInTheDocument();
        expect(within(tarjeta).getByText('Pendiente')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Aprobar' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Rechazar' })).toBeEnabled();
        // Sin problemas no hay avisos.
        expect(screen.queryByRole('alert')).toBeNull();
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('avisa cuánto compite con otras pendientes (singular y plural)', () => {
        const { unmount } = render(
            <ToastProvider>
                <SolicitudPendiente solicitud={{ ...solicitud, compite: 1 }} hoy="2026-09-14" />
            </ToastProvider>,
        );
        expect(screen.getByText('Compite con 1 solicitud pendiente por el mismo horario.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Aprobar' })).toBeEnabled();
        unmount();
        abrir({}, { compite: 3 });
        expect(screen.getByText('Compite con 3 solicitudes pendientes por el mismo horario.')).toBeInTheDocument();
    });
});

describe('SolicitudPendiente: Aprobar se bloquea con el motivo a la vista', () => {
    it('con conflicto: el botón queda apagado, el motivo se lee y Rechazar sigue disponible', () => {
        abrir({}, { conflicto: 'el grupo 5B de FIN200 tiene aprobado el laboratorio de 11:00 a 13:00' });
        expect(screen.getByText('No se puede aprobar: el grupo 5B de FIN200 tiene aprobado el laboratorio de 11:00 a 13:00.')).toBeInTheDocument();
        const aprobar = screen.getByRole('button', { name: 'Aprobar' });
        expect(aprobar).toBeDisabled();
        // El motivo también describe al botón para quien navega con lector de pantalla.
        expect(aprobar).toHaveAccessibleDescription(/No se puede aprobar: el grupo 5B/);
        expect(screen.getByRole('button', { name: 'Rechazar' })).toBeEnabled();
    });

    it('vencida: se ve «Vencida», se explica y no se puede aprobar', () => {
        abrir({}, { vencida: true });
        expect(screen.getByText('Vencida')).toBeInTheDocument();
        expect(screen.getByText(/No se puede aprobar: la hora de inicio ya pasó/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Aprobar' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Rechazar' })).toBeEnabled();
    });

    it('si el grupo no cabe lo dice en la ocupación y bloquea', () => {
        abrir({}, { grupo: { ...solicitud.grupo, inscritos: 34 } });
        expect(screen.getByText('(excede la capacidad)')).toBeInTheDocument();
        expect(screen.getByText('No se puede aprobar: el grupo tiene 34 alumnos y el laboratorio admite 30.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Aprobar' })).toBeDisabled();
    });

    it('un clic en el botón apagado no abre nada ni llama al servidor', async () => {
        const user = userEvent.setup();
        abrir({}, { conflicto: 'ocupado' });
        await user.click(screen.getByRole('button', { name: 'Aprobar' }));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(resolver).not.toHaveBeenCalled();
    });
});

describe('SolicitudPendiente: aprobar', () => {
    it('abre un diálogo con el resumen, sin exigir comentario, y aprueba', async () => {
        const user = userEvent.setup();
        resolver.mockResolvedValue({ ...solicitud, estatus: 'aprobada' });
        const { onResuelta } = abrir();
        await user.click(screen.getByRole('button', { name: 'Aprobar' }));
        const dialogo = screen.getByRole('dialog', { name: 'Aprobar solicitud' });
        expect(within(dialogo).getByText(/Se reservará LAB-1 · C, mié 16 sep de 10:00 – 12:00, grupo 3A/)).toBeInTheDocument();
        expect(within(dialogo).getByText('(opcional)')).toBeInTheDocument();
        await user.click(within(dialogo).getByRole('button', { name: 'Aprobar solicitud' }));
        await waitFor(() => expect(resolver).toHaveBeenCalledWith({ idSolicitud: 7, aprobar: true, comentario: undefined }));
        await waitFor(() => expect(onResuelta).toHaveBeenCalled());
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(screen.getByText('Solicitud aprobada')).toBeInTheDocument();
    });

    it('manda el comentario cuando lo hay', async () => {
        const user = userEvent.setup();
        resolver.mockResolvedValue({ ...solicitud, estatus: 'aprobada' });
        abrir();
        await user.click(screen.getByRole('button', { name: 'Aprobar' }));
        await user.type(screen.getByLabelText(/Comentario para el docente/), ' Lleva tu propio material ');
        await user.click(screen.getByRole('button', { name: 'Aprobar solicitud' }));
        await waitFor(() => expect(resolver).toHaveBeenCalledWith({ idSolicitud: 7, aprobar: true, comentario: 'Lleva tu propio material' }));
    });

    it('LAB_OCUPADO: muestra el mensaje del servidor, cierra el diálogo y recarga', async () => {
        const user = userEvent.setup();
        resolver.mockRejectedValue(new ApiError({ code: 'LAB_OCUPADO', message: 'El laboratorio no está disponible en ese horario: el grupo 5B tiene clase.', status: 409 }));
        const { onRecargar, onResuelta } = abrir();
        await user.click(screen.getByRole('button', { name: 'Aprobar' }));
        await user.click(screen.getByRole('button', { name: 'Aprobar solicitud' }));
        expect(await screen.findByText('El laboratorio no está disponible en ese horario: el grupo 5B tiene clase.')).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(onRecargar).toHaveBeenCalled();
        expect(onResuelta).not.toHaveBeenCalled();
    });

    it('SOLICITUD_VENCIDA también recarga en lugar de dejar el diálogo abierto', async () => {
        const user = userEvent.setup();
        resolver.mockRejectedValue(new ApiError({ code: 'SOLICITUD_VENCIDA', message: 'La hora de inicio de la solicitud ya pasó; no se puede aprobar.', status: 409 }));
        const { onRecargar } = abrir();
        await user.click(screen.getByRole('button', { name: 'Aprobar' }));
        await user.click(screen.getByRole('button', { name: 'Aprobar solicitud' }));
        expect(await screen.findByText('La hora de inicio de la solicitud ya pasó; no se puede aprobar.')).toBeInTheDocument();
        expect(onRecargar).toHaveBeenCalled();
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('un error de red deja el diálogo abierto con el mensaje, sin recargar', async () => {
        const user = userEvent.setup();
        resolver.mockRejectedValue(new ApiError({ code: 'ERROR_RED', message: 'No se pudo conectar con el servidor.', status: 503 }));
        const { onRecargar } = abrir();
        await user.click(screen.getByRole('button', { name: 'Aprobar' }));
        await user.click(screen.getByRole('button', { name: 'Aprobar solicitud' }));
        const dialogo = screen.getByRole('dialog', { name: 'Aprobar solicitud' });
        expect(await within(dialogo).findByText('No se pudo conectar con el servidor.')).toBeInTheDocument();
        expect(onRecargar).not.toHaveBeenCalled();
    });
});

describe('SolicitudPendiente: rechazar', () => {
    it('exige un motivo de al menos 3 caracteres: sin él no llama al servidor', async () => {
        const user = userEvent.setup();
        abrir();
        await user.click(screen.getByRole('button', { name: 'Rechazar' }));
        const dialogo = screen.getByRole('dialog', { name: 'Rechazar solicitud' });
        expect(within(dialogo).getByText(/Rechazarás la solicitud de López Ruiz Ana/)).toBeInTheDocument();
        await user.click(within(dialogo).getByRole('button', { name: 'Rechazar solicitud' }));
        expect(within(dialogo).getByText('Escribe el motivo: mínimo 3 caracteres.')).toBeInTheDocument();
        await user.type(within(dialogo).getByLabelText(/Motivo del rechazo/), 'no');
        await user.click(within(dialogo).getByRole('button', { name: 'Rechazar solicitud' }));
        expect(resolver).not.toHaveBeenCalled();
    });

    it('con motivo rechaza, avisa y recarga', async () => {
        const user = userEvent.setup();
        resolver.mockResolvedValue({ ...solicitud, estatus: 'rechazada' });
        const { onResuelta } = abrir();
        await user.click(screen.getByRole('button', { name: 'Rechazar' }));
        await user.type(screen.getByLabelText(/Motivo del rechazo/), 'Cruce con examen departamental');
        await user.click(screen.getByRole('button', { name: 'Rechazar solicitud' }));
        await waitFor(() =>
            expect(resolver).toHaveBeenCalledWith({ idSolicitud: 7, aprobar: false, comentario: 'Cruce con examen departamental' }),
        );
        await waitFor(() => expect(onResuelta).toHaveBeenCalled());
        expect(screen.getByText('Solicitud rechazada')).toBeInTheDocument();
    });

    it('una vencida o con conflicto sí se puede rechazar', async () => {
        const user = userEvent.setup();
        resolver.mockResolvedValue({ ...solicitud, estatus: 'rechazada' });
        abrir({}, { vencida: true, conflicto: 'ocupado' });
        await user.click(screen.getByRole('button', { name: 'Rechazar' }));
        await user.type(screen.getByLabelText(/Motivo del rechazo/), 'Ya pasó la fecha');
        await user.click(screen.getByRole('button', { name: 'Rechazar solicitud' }));
        await waitFor(() => expect(resolver).toHaveBeenCalledWith({ idSolicitud: 7, aprobar: false, comentario: 'Ya pasó la fecha' }));
    });
});
