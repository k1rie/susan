// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ReporteAsistencia from './ReporteAsistencia.jsx';

const api = vi.hoisted(() => ({
    reporteFiltros: vi.fn(), reporteGrupo: vi.fn(), reportePeriodo: vi.fn(), impactoTiempo: vi.fn(),
}));
vi.mock('@/lib/api/reportes.js', () => api);
vi.mock('next/link', () => ({ default: ({ href, children, ...r }) => <a href={href} {...r}>{children}</a> }));

const fila = (o) => ({ id_alumno: 1, matricula: 'E1', nombre_completo: 'Ana Pérez', presentes: 5, retardos: 0, ausencias: 1, justificadas: 0,
    pendientes: 0, faltas_equivalentes: 1, porcentaje_faltas: 2.22, faltas_restantes_antes_limite: 8, derecho_examen: true, en_limite: false, supera_limite: false, ...o });

describe('ReporteAsistencia', () => {
    it('con grupo muestra indicadores, impacto como estimación y resalta sin derecho', async () => {
        api.reporteFiltros.mockResolvedValue({ periodo_actual: '2026-2', periodos: ['2026-2'],
            grupos: [{ id_grupo: 1, clave_grupo: '3A', materia_nombre: 'Finanzas' }] });
        api.reporteGrupo.mockResolvedValue({ generado_en: '2026-09-14T13:00:00Z', total: 2,
            grupo: { id_grupo: 1, clave_grupo: '3A', materia_nombre: 'Finanzas', docente_nombre: 'Doc' },
            kpis: { sesiones_programadas: 45, sesiones_cerradas: 17, asistencia_promedio: 82.35, alumnos_en_limite: 0, alumnos_sin_derecho: 1 },
            items: [fila({}), fila({ id_alumno: 2, matricula: 'E2', nombre_completo: 'Luis Gómez', derecho_examen: false, supera_limite: true })] });
        api.impactoTiempo.mockResolvedValue({ minutos_recuperados: 85, horas_recuperadas: 1.42, sesiones_automaticas: 17, sesiones_manuales: 0, sesiones_cerradas: 17, minutos_pase_lista_base: 5 });
        render(<ReporteAsistencia filtrosIniciales={{ periodo: '2026-2', idGrupo: 1 }} />);
        expect((await screen.findAllByText('Luis Gómez')).length).toBeGreaterThan(0);
        expect(screen.getAllByText('Sin derecho').length).toBeGreaterThan(0);
        expect(screen.getByText('82.35 %')).toBeInTheDocument();
        expect(await screen.findByText(/Estimación, no una medición/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeEnabled();
    });
});
