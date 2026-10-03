// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const resumen = vi.hoisted(() => vi.fn());
const historial = vi.hoisted(() => vi.fn());
const justificantes = vi.hoisted(() => vi.fn());
const justificables = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/reportes.js', () => ({ alumnoResumen: (...a) => resumen(...a), alumnoHistorial: (...a) => historial(...a) }));
vi.mock('@/lib/api/revision.js', () => ({
    misJustificantes: (...a) => justificantes(...a),
    misJustificables: (...a) => justificables(...a),
    registrarJustificante: vi.fn(),
}));
vi.mock('@/lib/http', () => ({ subirDocumentoJustificante: vi.fn() }));

import PortalAlumno from './PortalAlumno.jsx';

const materia = (id, nombre, extra = {}) => ({
    id_grupo: id, clave_grupo: `G${id}`, docente_nombre: 'Ana Pérez', materia: { nombre }, sesiones_programadas: 40,
    faltas_equivalentes: 2, faltas_maximas_permitidas: 8, faltas_restantes_antes_limite: 6, porcentaje_faltas: 5, limite_pct: 20,
    supera_limite: false, en_limite: false, presentes: 30, retardos: 1, ausencias: 2, justificadas: 0, pendientes: 0, ...extra,
});

beforeEach(() => {
    resumen.mockReset();
    historial.mockReset();
    justificantes.mockResolvedValue({ total: 0, items: [] });
    justificables.mockResolvedValue({ total: 1, items: [{ id_sesion: 9, estado: 'ausente', fecha: '2026-09-10', materia: { nombre: 'Álgebra' }, grupo: { clave_grupo: 'G1' } }] });
    historial.mockResolvedValue({
        total: 20, grupo: { materia: { nombre: 'Álgebra' } },
        items: [{ id_sesion: 9, fecha: '2026-09-10', hora_inicio: '08:00:00', estado: 'ausente', origen: 'automatico', puede_justificar: true }],
    });
});

describe('PortalAlumno', () => {
    it('con varias materias: gráficas arriba, tarjetas compactas, historial con resumen y justificantes en tarjetas propias', async () => {
        resumen.mockResolvedValue({ periodo: '2026-2', periodos_disponibles: ['2026-2'], items: [materia(1, 'Álgebra'), materia(2, 'Cálculo')] });
        const { container } = render(<PortalAlumno encabezado={false} />);
        expect(await screen.findByRole('group', { name: 'Mi asistencia' })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Faltas frente al límite' })).toBeInTheDocument();
        expect(container.querySelectorAll('[data-slot="chart"]').length).toBe(2);
        expect(await screen.findByText('20 sesiones · 2 ausencias')).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Registrar justificante' })).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Mis justificantes' })).toBeInTheDocument();
        // Una sola tarjeta de formulario: sin Card envolviendo otra tarjeta.
        expect(screen.getAllByRole('heading', { name: 'Registrar justificante' })).toHaveLength(1);
    });

    it('Justificar preselecciona la sesión en el formulario', async () => {
        resumen.mockResolvedValue({ periodo: '2026-2', periodos_disponibles: ['2026-2'], items: [materia(1, 'Álgebra')] });
        render(<PortalAlumno encabezado={false} />);
        await userEvent.click(await screen.findByRole('button', { name: 'Justificar' }));
        const tarjeta = screen.getByRole('region', { name: 'Registrar justificante' });
        expect(await within(tarjeta).findByLabelText(/Falta o retardo/)).toHaveValue('9');
    });

    it('sin materias muestra el aviso', async () => {
        resumen.mockResolvedValue({ periodo: '2026-2', periodos_disponibles: [], items: [] });
        render(<PortalAlumno encabezado={false} />);
        expect(await screen.findByText('No tienes materias inscritas en este periodo.')).toBeInTheDocument();
    });
});
