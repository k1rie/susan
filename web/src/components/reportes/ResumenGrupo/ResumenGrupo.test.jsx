// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ResumenGrupo from './ResumenGrupo.jsx';

// La dona se sustituye por un espía: el centro se pinta dentro de un SVG de recharts que jsdom no dimensiona.
vi.mock('@/components/ui/GraficaDona', () => ({
    default: ({ centro }) => <div data-testid="dona" data-centro={centro ? JSON.stringify(centro) : ''} />,
}));

const reporte = {
    limite_pct: 20,
    kpis: { sesiones_programadas: 45, sesiones_cerradas: 17, asistencia_promedio: 82.35, alumnos_en_limite: 0, alumnos_sin_derecho: 1 },
};
const fila = { id_alumno: 2, matricula: 'E2', nombres: 'Luis', apellido_paterno: 'Gómez', nombre_completo: 'Luis Gómez', presentes: 5, retardos: 0,
    ausencias: 1, justificadas: 0, pendientes: 0, faltas_equivalentes: 1, porcentaje_faltas: 24 };

describe('ResumenGrupo', () => {
    it('grupo completo: el centro de la dona lleva la asistencia promedio del grupo', () => {
        render(<ResumenGrupo reporte={reporte} filas={[fila]} />);
        expect(JSON.parse(screen.getByTestId('dona').dataset.centro)).toEqual({ valor: '82 %', etiqueta: 'Asistencia' });
    });

    it('con un alumno seleccionado la dona no usa la cifra del grupo', () => {
        render(<ResumenGrupo reporte={reporte} filas={[fila]} nombreAlumno="Luis Gómez" />);
        expect(screen.getByTestId('dona').dataset.centro).toBe('');
        expect(screen.getByText('Registros de Luis Gómez')).toBeInTheDocument();
    });

    it('sin sesiones programadas no hay centro', () => {
        render(<ResumenGrupo reporte={{ ...reporte, kpis: { ...reporte.kpis, sesiones_programadas: 0, asistencia_promedio: null } }} filas={[fila]} />);
        expect(screen.getByTestId('dona').dataset.centro).toBe('');
    });
});
