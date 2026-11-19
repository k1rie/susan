// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const agenda = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/laboratorios.js', () => ({ laboratorioAgenda: (...a) => agenda(...a) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...r }) => <a href={href} {...r}>{children}</a> }));

import { ApiError } from '@/lib/api/errors.js';
import AgendaLaboratorio from './AgendaLaboratorio.jsx';

const LABS = {
    data: { total: 2, items: [{ id_aula: 3, clave: 'LAB-1', edificio: 'C', capacidad: 30 }, { id_aula: 4, clave: 'LAB-2', edificio: 'D', capacidad: 20 }] },
};
const HOY = '2026-09-16'; // miércoles: la semana va del lunes 14 al domingo 20

const bloques = [
    { tipo: 'clase', estatus: null, fecha: '2026-09-14', hora_inicio: '07:00', hora_fin: '09:00', clave_grupo: '1A', materia_clave: 'FIN200', materia_nombre: 'Finanzas', propia: false, id_solicitud: null, docente_nombre: 'Pérez Gil Luis' },
    { tipo: 'solicitud', estatus: 'aprobada', fecha: '2026-09-16', hora_inicio: '10:00', hora_fin: '12:00', clave_grupo: '3A', materia_clave: 'ADM101', materia_nombre: 'Administración I', propia: false, id_solicitud: 7, docente_nombre: 'López Ruiz Ana' },
    { tipo: 'solicitud', estatus: 'pendiente', fecha: '2026-09-16', hora_inicio: '12:00', hora_fin: '13:00', clave_grupo: '5B', materia_clave: 'MKT300', materia_nombre: 'Mercadotecnia', propia: false, id_solicitud: 9, docente_nombre: 'Soto Rey Eva' },
];

const respuesta = (b = bloques) => ({ aula: LABS.data.items[0], desde: '2026-09-14', hasta: '2026-09-20', bloques: b });

beforeEach(() => {
    agenda.mockReset();
});

describe('AgendaLaboratorio: sin laboratorios', () => {
    it('lleva al catálogo de aulas para marcar uno', () => {
        render(<AgendaLaboratorio laboratorios={{ data: { total: 0, items: [] } }} hoy={HOY} />);
        expect(screen.getByText('Aún no hay laboratorios registrados')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Ir a aulas' })).toHaveAttribute('href', '/admin/aulas');
        expect(agenda).not.toHaveBeenCalled();
    });
});

describe('AgendaLaboratorio: semana de un laboratorio', () => {
    it('pide de lunes a domingo del primer laboratorio y escribe el tipo de cada bloque', async () => {
        agenda.mockResolvedValue(respuesta());
        render(<AgendaLaboratorio laboratorios={LABS} hoy={HOY} />);
        await screen.findByText('1 clase · 1 solicitud aprobada · 1 solicitud pendiente');
        expect(agenda).toHaveBeenCalledWith({ idAula: 3, desde: '2026-09-14', hasta: '2026-09-20' });
        expect(screen.getByText('Semana del lun 14 sep al dom 20 sep')).toBeInTheDocument();
        expect(screen.getByText('1 clase · 1 solicitud aprobada · 1 solicitud pendiente')).toBeInTheDocument();

        const lunes = screen.getByRole('heading', { name: 'lun 14 sep' }).closest('li');
        expect(within(lunes).getByText('Clase')).toBeInTheDocument();
        expect(within(lunes).getByText('07:00 – 09:00')).toBeInTheDocument();
        expect(within(lunes).getByText('1A · Finanzas')).toBeInTheDocument();
        expect(within(lunes).getByText('Docente: Pérez Gil Luis')).toBeInTheDocument();

        const miercoles = screen.getByRole('heading', { name: /mié 16 sep/ }).closest('li');
        expect(within(miercoles).getByText('Hoy')).toBeInTheDocument();
        expect(within(miercoles).getByText('Solicitud aprobada')).toBeInTheDocument();
        expect(within(miercoles).getByText('Solicitud pendiente')).toBeInTheDocument();
        expect(within(miercoles).getByText('3A · Administración I')).toBeInTheDocument();
        expect(within(miercoles).getByText('Docente: Soto Rey Eva')).toBeInTheDocument();
    });

    it('los días sin nada se dicen libres y los siete días aparecen siempre', async () => {
        agenda.mockResolvedValue(respuesta([]));
        render(<AgendaLaboratorio laboratorios={LABS} hoy={HOY} />);
        expect(await screen.findByText('Sin ocupación esta semana')).toBeInTheDocument();
        expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(7);
        expect(screen.getAllByText('Libre todo el día.')).toHaveLength(7);
    });

    it('«Semana siguiente», «Semana anterior» y «Hoy» mueven el rango', async () => {
        const user = userEvent.setup();
        agenda.mockResolvedValue(respuesta());
        render(<AgendaLaboratorio laboratorios={LABS} hoy={HOY} />);
        await screen.findByText('1 clase · 1 solicitud aprobada · 1 solicitud pendiente');
        expect(screen.getByRole('button', { name: 'Hoy' })).toBeDisabled();

        await user.click(screen.getByRole('button', { name: 'Semana siguiente' }));
        await waitFor(() => expect(agenda).toHaveBeenLastCalledWith({ idAula: 3, desde: '2026-09-21', hasta: '2026-09-27' }));
        expect(await screen.findByText('Semana del lun 21 sep al dom 27 sep')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Hoy' })).toBeEnabled();

        await user.click(screen.getByRole('button', { name: 'Semana anterior' }));
        await user.click(screen.getByRole('button', { name: 'Semana anterior' }));
        await waitFor(() => expect(agenda).toHaveBeenLastCalledWith({ idAula: 3, desde: '2026-09-07', hasta: '2026-09-13' }));

        await user.click(screen.getByRole('button', { name: 'Hoy' }));
        await waitFor(() => expect(agenda).toHaveBeenLastCalledWith({ idAula: 3, desde: '2026-09-14', hasta: '2026-09-20' }));
        expect(screen.getByRole('button', { name: 'Hoy' })).toBeDisabled();
    });

    it('cambiar de laboratorio conserva la semana', async () => {
        const user = userEvent.setup();
        agenda.mockResolvedValue(respuesta());
        render(<AgendaLaboratorio laboratorios={LABS} hoy={HOY} />);
        await screen.findByText('1 clase · 1 solicitud aprobada · 1 solicitud pendiente');
        await user.selectOptions(screen.getByLabelText('Laboratorio'), 'LAB-2 · D');
        await waitFor(() => expect(agenda).toHaveBeenLastCalledWith({ idAula: 4, desde: '2026-09-14', hasta: '2026-09-20' }));
    });

    it('si la agenda falla ofrece reintentar', async () => {
        const user = userEvent.setup();
        agenda.mockRejectedValueOnce(new ApiError({ code: 'ERROR_RED', message: 'No se pudo conectar con el servidor.', status: 503 }));
        agenda.mockResolvedValue(respuesta());
        render(<AgendaLaboratorio laboratorios={LABS} hoy={HOY} />);
        expect(await screen.findByText('No se pudo conectar con el servidor.')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Reintentar' }));
        expect(await screen.findByText('1 clase · 1 solicitud aprobada · 1 solicitud pendiente')).toBeInTheDocument();
    });

    it('mientras no se sabe la fecha del plantel no pide nada', () => {
        render(<AgendaLaboratorio laboratorios={LABS} hoy={null} />);
        expect(screen.getByText('Cargando agenda…')).toBeInTheDocument();
        expect(agenda).not.toHaveBeenCalled();
    });
});
