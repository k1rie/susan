// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import JustificanteCard from './JustificanteCard.jsx';
import { resolverJustificante } from '@/lib/api/revision.js';

vi.mock('@/lib/api/revision.js', () => ({ resolverJustificante: vi.fn() }));
vi.mock('@/lib/http/revision.js', () => ({ obtenerDocumentoJustificante: vi.fn() }));
const alMontarLecturas = vi.hoisted(() => vi.fn());
vi.mock('../LecturasCaso', () => ({
    default: function LecturasSimuladas() {
        // Montar LecturasCaso = pedir las lecturas al servidor (y quedar en la bitácora de consulta).
        useEffect(() => {
            alMontarLecturas();
        }, []);
        return <div>Lecturas simuladas</div>;
    },
}));

const j = {
    id_justificante: 3,
    id_asistencia: 9,
    alumno: { nombre_completo: 'Beto Ruiz', matricula: 'E9' },
    materia: { nombre: 'Finanzas' },
    grupo: { clave_grupo: '3A' },
    sesion: { fecha: '2026-09-14' },
    estado_asistencia: 'ausente',
    registrado_por_rol: 'alumno',
    fecha_registro: '2026-09-15T15:00:00Z',
    motivo: 'Cita médica',
};

describe('JustificanteCard', () => {
    it('muestra el caso compacto, el motivo y las lecturas plegadas', () => {
        render(<JustificanteCard justificante={j} />);
        expect(screen.getByText('E9 · Finanzas · 3A')).toBeInTheDocument();
        expect(screen.getByText('Cita médica')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Ver lecturas del reconocimiento' })).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getByRole('button', { name: 'Ver documento' })).toBeInTheDocument();
    });

    it('las lecturas no se piden hasta abrirlas y al ocultarlas no se vuelven a pedir', async () => {
        alMontarLecturas.mockClear();
        render(<JustificanteCard justificante={j} />);
        expect(screen.queryByText('Lecturas simuladas')).toBeNull();
        expect(alMontarLecturas).not.toHaveBeenCalled();

        await userEvent.click(screen.getByRole('button', { name: 'Ver lecturas del reconocimiento' }));
        expect(screen.getByText('Lecturas simuladas')).toBeVisible();
        expect(alMontarLecturas).toHaveBeenCalledTimes(1);
        const boton = screen.getByRole('button', { name: 'Ocultar lecturas del reconocimiento' });
        expect(boton).toHaveAttribute('aria-expanded', 'true');

        await userEvent.click(boton);
        expect(screen.getByText('Lecturas simuladas')).not.toBeVisible();
        await userEvent.click(screen.getByRole('button', { name: 'Ver lecturas del reconocimiento' }));
        expect(screen.getByText('Lecturas simuladas')).toBeVisible();
        expect(alMontarLecturas).toHaveBeenCalledTimes(1);
    });

    it('aprobar pide confirmación y luego resuelve', async () => {
        resolverJustificante.mockResolvedValue({ id_justificante: 3 });
        const alResolver = vi.fn();
        render(<JustificanteCard justificante={j} onResuelto={alResolver} />);
        await userEvent.click(screen.getByRole('button', { name: 'Aprobar' }));
        expect(await screen.findByText('Aprobar justificante')).toBeInTheDocument();
        await userEvent.click(screen.getAllByRole('button', { name: 'Aprobar' }).at(-1));
        await waitFor(() => expect(alResolver).toHaveBeenCalledWith({ id_justificante: 3 }, true));
        expect(resolverJustificante).toHaveBeenCalledWith(expect.objectContaining({ idJustificante: 3, aprobar: true }));
    });
});
