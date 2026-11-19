// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import DisponibilidadDia from './DisponibilidadDia.jsx';

const aula = { clave: 'LAB-1', edificio: 'C', capacidad: 30 };
const clase = { tipo: 'clase', estatus: null, fecha: '2026-09-17', hora_inicio: '08:00', hora_fin: '10:00', clave_grupo: '1B', materia_clave: 'MAT100', materia_nombre: 'Matemáticas', propia: false };
const aprobada = { tipo: 'solicitud', estatus: 'aprobada', fecha: '2026-09-17', hora_inicio: '12:00', hora_fin: '14:00', clave_grupo: '3B', materia_clave: 'ADM101', materia_nombre: 'Administración I', propia: true };
const pendiente = { tipo: 'solicitud', estatus: 'pendiente', fecha: '2026-09-17', hora_inicio: '15:00', hora_fin: '16:00', clave_grupo: '5C', materia_clave: 'MAT200', materia_nombre: 'Álgebra', propia: false };

const listo = (bloques) => ({ data: { bloques }, loading: false, error: null, refetch: vi.fn() });

function montar(props = {}) {
    return render(<DisponibilidadDia aula={aula} fecha="2026-09-17" consultable consulta={listo([])} {...props} />);
}

describe('DisponibilidadDia', () => {
    it('sin laboratorio o fecha invita a elegirlos', () => {
        montar({ consultable: false, consulta: null });
        expect(screen.getByRole('heading', { name: 'Disponibilidad ese día' })).toBeInTheDocument();
        expect(screen.getByText(/Elige el laboratorio y una fecha disponible/)).toBeInTheDocument();
    });

    it('mientras consulta avisa con texto', () => {
        montar({ consulta: { data: null, loading: true, error: null } });
        expect(screen.getByText('Consultando la disponibilidad')).toBeInTheDocument();
    });

    it('un día sin bloques dice que el laboratorio está libre', () => {
        montar();
        expect(screen.getByText('Sin clases ni solicitudes ese día: el laboratorio está libre.')).toBeInTheDocument();
        expect(screen.getByText(/LAB-1 · Edificio C · jue 17 sep · Libre todo el día/)).toBeInTheDocument();
    });

    it('lista los bloques ordenados con su tipo, grupo y si son del docente', () => {
        montar({ consulta: listo([pendiente, aprobada, clase]) });
        const filas = within(screen.getByRole('list', { name: 'Bloques ocupados' })).getAllByRole('listitem');
        expect(filas).toHaveLength(3);
        expect(filas[0]).toHaveTextContent('08:00 – 10:00');
        expect(filas[0]).toHaveTextContent('Clase');
        expect(filas[0]).toHaveTextContent('1B · Matemáticas');
        expect(filas[1]).toHaveTextContent('12:00 – 14:00');
        expect(filas[1]).toHaveTextContent('Aprobada');
        expect(filas[1]).toHaveTextContent('(tuya)');
        expect(filas[2]).toHaveTextContent('Pendiente');
        expect(screen.getByText(/3 bloques ocupados/)).toBeInTheDocument();
    });

    it('ignora los bloques de otra fecha (pueden ser de la consulta anterior)', () => {
        montar({ consulta: listo([{ ...clase, fecha: '2026-09-18' }]) });
        expect(screen.getByText(/el laboratorio está libre/)).toBeInTheDocument();
    });

    it('marca con texto las filas que chocan con el horario elegido', () => {
        const consulta = listo([clase, aprobada, pendiente]);
        const choques = [
            { bloque: consulta.data.bloques[1], nivel: 'bloquea' },
            { bloque: consulta.data.bloques[2], nivel: 'compite' },
        ];
        montar({ consulta, choques });
        expect(screen.getByText('Se traslapa con tu horario')).toBeInTheDocument();
        expect(screen.getByText('Se traslapa; decide el administrador')).toBeInTheDocument();
    });

    it('si la consulta falla lo dice, deja enviar y ofrece reintentar', async () => {
        const user = userEvent.setup();
        const refetch = vi.fn();
        montar({ consulta: { data: null, loading: false, error: new Error('x'), refetch } });
        expect(screen.getByText(/No se pudo consultar la disponibilidad\. Puedes enviar la solicitud/)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Reintentar' }));
        expect(refetch).toHaveBeenCalled();
    });
});
