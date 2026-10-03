// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GraficaBarras from '@/components/ui/GraficaBarras';
import GraficaActividadSesion from './GraficaActividadSesion.jsx';

// Las barras reales, con un contador de renders para comprobar que el sondeo no las redibuja sin datos nuevos.
vi.mock('@/components/ui/GraficaBarras', async () => {
    const real = await vi.importActual('@/components/ui/GraficaBarras');
    return { default: vi.fn((props) => real.default(props)) };
});

describe('GraficaActividadSesion', () => {
    // Con llaves: una arrow que devuelve el mock haría que vitest lo ejecute como limpieza.
    beforeEach(() => {
        GraficaBarras.mockClear();
    });

    it('con actividad: texto alternativo con las tres cifras', () => {
        render(<GraficaActividadSesion totales={{ capturas: 12, detecciones: 40, detecciones_validas: 31 }} />);
        expect(screen.getByRole('group', { name: 'Actividad de reconocimiento' })).toHaveAccessibleDescription('Capturas: 12; Detecciones: 40; Det. válidas: 31');
    });

    it('sin actividad avisa en lugar de quedar vacía', () => {
        render(<GraficaActividadSesion totales={{ capturas: 0, detecciones: 0, detecciones_validas: 0 }} />);
        expect(screen.getByText('Aún sin capturas')).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Actividad de reconocimiento' })).toHaveAccessibleDescription('Aún no hay capturas ni detecciones.');
    });

    it('no redibuja con las mismas cifras y sí al llegar cifras nuevas', () => {
        const cifras = { capturas: 1, detecciones: 2, detecciones_validas: 1 };
        const { rerender } = render(<GraficaActividadSesion totales={cifras} />);
        rerender(<GraficaActividadSesion totales={{ ...cifras, inscritos: 30 }} />);
        expect(GraficaBarras).toHaveBeenCalledTimes(1);
        rerender(<GraficaActividadSesion totales={{ capturas: 5, detecciones: 9, detecciones_validas: 6 }} />);
        expect(GraficaBarras).toHaveBeenCalledTimes(2);
        expect(screen.getByRole('group', { name: 'Actividad de reconocimiento' })).toHaveAccessibleDescription('Capturas: 5; Detecciones: 9; Det. válidas: 6');
    });
});
