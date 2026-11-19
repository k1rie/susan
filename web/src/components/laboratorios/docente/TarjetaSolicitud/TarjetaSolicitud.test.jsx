// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TarjetaSolicitud from './TarjetaSolicitud.jsx';

const solicitud = {
    id_solicitud: 7,
    estatus: 'pendiente',
    vencida: false,
    fecha: '2026-09-17',
    hora_inicio: '10:00',
    hora_fin: '12:00',
    actividad: 'Práctica de balanza de comprobación',
    comentario: null,
    aula: { id_aula: 3, clave: 'LAB-1', edificio: 'C', capacidad: 30 },
    grupo: { id_grupo: 1, clave_grupo: '3A', materia_clave: 'ADM101', materia_nombre: 'Administración I', inscritos: 4 },
};
const ANTES = { hoy: '2026-09-15', hora: '09:00' };
const DESPUES = { hoy: '2026-09-17', hora: '11:00' };

function montar(cambios = {}, reloj = ANTES) {
    const onCancelar = vi.fn();
    render(<TarjetaSolicitud solicitud={{ ...solicitud, ...cambios }} reloj={reloj} onCancelar={onCancelar} />);
    return { onCancelar };
}

describe('TarjetaSolicitud', () => {
    it('muestra laboratorio con edificio, fecha, horario, grupo con materia, actividad y estatus', () => {
        montar();
        expect(screen.getByRole('heading', { name: 'LAB-1' })).toBeInTheDocument();
        expect(screen.getByText('Edificio C')).toBeInTheDocument();
        expect(screen.getByText('jue 17 sep')).toBeInTheDocument();
        expect(screen.getByText(/10:00 – 12:00/)).toBeInTheDocument();
        expect(screen.getByText(/2 h/)).toBeInTheDocument();
        expect(screen.getByText(/Administración I \(3A\)/)).toBeInTheDocument();
        expect(screen.getByText(/4 alumnos/)).toBeInTheDocument();
        expect(screen.getByText('Práctica de balanza de comprobación')).toBeInTheDocument();
        expect(screen.getByText('Pendiente')).toBeInTheDocument();
        expect(screen.getByText('Esperando la revisión del administrador.')).toBeInTheDocument();
    });

    it('una pendiente se puede cancelar', async () => {
        const user = userEvent.setup();
        const { onCancelar } = montar();
        await user.click(screen.getByRole('button', { name: /Cancelar la solicitud de LAB-1/ }));
        expect(onCancelar).toHaveBeenCalledWith(expect.objectContaining({ id_solicitud: 7 }));
    });

    it('una pendiente vencida se ve «Vencida», explica por qué y solo se puede cancelar', () => {
        montar({ vencida: true }, DESPUES);
        expect(screen.getByText('Vencida')).toBeInTheDocument();
        expect(screen.getByText('La hora de inicio ya pasó sin que se resolviera. Solo puedes cancelarla.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Cancelar/ })).toBeInTheDocument();
    });

    it('una aprobada que no ha iniciado se puede cancelar y una que ya inició, no', () => {
        const { unmount } = render(<TarjetaSolicitud solicitud={{ ...solicitud, estatus: 'aprobada' }} reloj={ANTES} />);
        expect(screen.getByText('Aprobada')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Cancelar/ })).toBeInTheDocument();
        unmount();
        render(<TarjetaSolicitud solicitud={{ ...solicitud, estatus: 'aprobada' }} reloj={DESPUES} />);
        expect(screen.getByText('Aprobada')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Cancelar/ })).toBeNull();
    });

    it.each([
        ['rechazada', 'Rechazada', 'Motivo del rechazo'],
        ['cancelada', 'Cancelada', 'Motivo de la cancelación'],
    ])('una %s muestra el comentario del administrador y no se cancela', (estatus, etiqueta, rotulo) => {
        montar({ estatus, comentario: 'El laboratorio estará en mantenimiento.' });
        expect(screen.getByText(etiqueta)).toBeInTheDocument();
        expect(screen.getByText(rotulo)).toBeInTheDocument();
        expect(screen.getByText('El laboratorio estará en mantenimiento.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Cancelar/ })).toBeNull();
    });

    it('una aprobada con nota la muestra como comentario del administrador', () => {
        montar({ estatus: 'aprobada', comentario: 'Autorizado. Pasar por las llaves.' });
        expect(screen.getByText('Comentario del administrador')).toBeInTheDocument();
        expect(screen.getByText('Autorizado. Pasar por las llaves.')).toBeInTheDocument();
    });
});
