// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CasoPendiente from './CasoPendiente.jsx';
import { corregirAsistencia } from '@/lib/api/revision.js';

vi.mock('@/lib/api/revision.js', () => ({ corregirAsistencia: vi.fn() }));
vi.mock('../LecturasCaso', () => ({ default: () => <div>Lecturas simuladas</div> }));

const caso = {
    id_asistencia: 7,
    alumno: { nombre_completo: 'Ana Perez', matricula: 'E123' },
    materia: { nombre: 'Finanzas' },
    grupo: { clave_grupo: '3A' },
    sesion: { fecha: '2026-09-14', hora_inicio: '07:00:00', hora_fin: '08:00:00' },
    segundos_restantes: 7200,
    vence_en: '2026-09-16T09:00:00-06:00',
    estado_sugerido: 'presente',
    vencido: false,
};

describe('CasoPendiente', () => {
    it('encabezado compacto con plazo, lecturas y resolución con un clic', async () => {
        corregirAsistencia.mockResolvedValue({ id_asistencia: 7 });
        const alResolver = vi.fn();
        render(<CasoPendiente caso={caso} onResuelto={alResolver} />);
        expect(screen.getByRole('heading', { name: 'Ana Perez' })).toBeInTheDocument();
        expect(screen.getByText('E123 · Finanzas · 3A')).toBeInTheDocument();
        expect(screen.getByText('Quedan 2 h 0 min')).toBeInTheDocument();
        expect(screen.getByText('Lecturas simuladas')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /Resolver como Presente/ }));
        await waitFor(() => expect(alResolver).toHaveBeenCalled());
        expect(corregirAsistencia).toHaveBeenCalledWith(expect.objectContaining({ idAsistencia: 7, estado: 'presente' }));
    });

    it('la bitácora va plegada en Detalles y solo si hay historial', () => {
        const { rerender } = render(<CasoPendiente caso={caso} />);
        expect(screen.queryByRole('button', { name: /Bitácora del caso/ })).toBeNull();
        rerender(<CasoPendiente caso={caso} historial={[{ id_bitacora: 1, estado_anterior: 'pendiente', estado_nuevo: 'presente', usuario: { rol: 'docente' }, fecha_hora: '2026-09-15T15:00:00Z' }]} />);
        const boton = screen.getByRole('button', { name: /Bitácora del caso/ });
        expect(boton).toHaveAttribute('aria-expanded', 'false');
        expect(boton).toHaveTextContent('1 cambio');
    });

    it('con el plazo vencido deshabilita la resolución y lo explica', () => {
        render(<CasoPendiente caso={{ ...caso, vencido: true, segundos_restantes: 0 }} />);
        expect(screen.getByText('El plazo venció; el sistema lo resolverá como ausente.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Resolver como Presente/ })).toBeDisabled();
    });
});
