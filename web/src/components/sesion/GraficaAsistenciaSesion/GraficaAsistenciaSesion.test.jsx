// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GraficaDona from '@/components/ui/GraficaDona';
import GraficaAsistenciaSesion from './GraficaAsistenciaSesion.jsx';

// La dona real, pero con un contador de renders para comprobar que el sondeo no la redibuja sin datos nuevos.
vi.mock('@/components/ui/GraficaDona', async () => {
    const real = await vi.importActual('@/components/ui/GraficaDona');
    return { default: vi.fn((props) => real.default(props)) };
});

const totales = { inscritos: 4, presentes: 2, retardos: 1, sin_registro: 1, ausentes: 0, justificados: 0, pendientes: 0 };

describe('GraficaAsistenciaSesion', () => {
    // Con llaves: una arrow que devuelve el mock haría que vitest lo ejecute como limpieza.
    beforeEach(() => {
        GraficaDona.mockClear();
    });

    it('sesión en curso: dona con «Sin registro» y texto alternativo', () => {
        render(<GraficaAsistenciaSesion totales={totales} />);
        expect(screen.getByRole('group', { name: 'Asistencia de la sesión' })).toHaveAccessibleDescription(
            'Presentes: 2 (50 %); Retardos: 1 (25 %); Sin registro: 1 (25 %); Pendientes: 0 (0 %)',
        );
    });

    it('sesión cerrada: los cinco estados', () => {
        render(<GraficaAsistenciaSesion totales={{ ...totales, sin_registro: 0, ausentes: 1 }} cerrada />);
        expect(screen.getByRole('group', { name: 'Asistencia de la sesión' })).toHaveAccessibleDescription(
            'Presentes: 2 (50 %); Retardos: 1 (25 %); Ausencias: 1 (25 %); Justificadas: 0 (0 %); Pendientes: 0 (0 %)',
        );
    });

    it('sin inscritos avisa en lugar de dejar un hueco', () => {
        render(<GraficaAsistenciaSesion totales={{}} />);
        expect(screen.getByText('Aún no hay alumnos inscritos')).toBeInTheDocument();
    });

    it('un sondeo con los mismos valores no vuelve a dibujar; uno con cifras nuevas sí', () => {
        const { rerender } = render(<GraficaAsistenciaSesion totales={totales} />);
        expect(GraficaDona).toHaveBeenCalledTimes(1);
        rerender(<GraficaAsistenciaSesion totales={{ ...totales }} />);
        expect(GraficaDona).toHaveBeenCalledTimes(1);
        rerender(<GraficaAsistenciaSesion totales={{ ...totales, presentes: 3, sin_registro: 0 }} />);
        expect(GraficaDona).toHaveBeenCalledTimes(2);
        expect(screen.getByRole('group', { name: 'Asistencia de la sesión' })).toHaveAccessibleDescription(/Presentes: 3 \(75 %\)/);
    });
});
