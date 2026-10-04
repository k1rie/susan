// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BarrasPildora from '@/components/ui/BarrasPildora';
import GraficaActividadSesion from './GraficaActividadSesion.jsx';

// Las barras reales, con un contador de renders para comprobar que el sondeo no las renderiza sin datos nuevos.
vi.mock('@/components/ui/BarrasPildora', async () => {
    const real = await vi.importActual('@/components/ui/BarrasPildora');
    return { default: vi.fn((props) => real.default(props)) };
});

const filas = (contenedor) => [...contenedor.querySelectorAll('[data-fila]')];
const cifras = (contenedor) => [...contenedor.querySelectorAll('[data-cifra]')].map((n) => n.textContent);

describe('GraficaActividadSesion', () => {
    // Con llaves: una arrow que devuelve el mock haría que vitest lo ejecute como limpieza.
    beforeEach(() => {
        BarrasPildora.mockClear();
    });

    it('con actividad: una fila por etapa con su cifra y texto alternativo con las tres', () => {
        const { container } = render(<GraficaActividadSesion totales={{ capturas: 12, detecciones: 40, detecciones_validas: 31 }} />);
        expect(screen.getByRole('group', { name: 'Actividad de reconocimiento' })).toHaveAccessibleDescription('Capturas: 12; Detecciones: 40; Det. válidas: 31');
        expect(filas(container).map((f) => f.getAttribute('data-fila'))).toEqual(['Capturas', 'Detecciones', 'Det. válidas']);
        expect(cifras(container)).toEqual(['12', '40', '31']);
        // Una sola serie: sin leyenda de colores que repita lo que dicen los nombres de las filas.
        expect(container.querySelector('[data-leyenda-limite]')).toBeNull();
    });

    it('sin actividad avisa en lugar de quedar vacía', () => {
        render(<GraficaActividadSesion totales={{ capturas: 0, detecciones: 0, detecciones_validas: 0 }} />);
        expect(screen.getByText('Aún sin capturas')).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Actividad de reconocimiento' })).toHaveAccessibleDescription('Aún no hay capturas ni detecciones.');
    });

    it('no renderiza de nuevo con las mismas cifras y sí al llegar cifras nuevas', () => {
        const base = { capturas: 1, detecciones: 2, detecciones_validas: 1 };
        const { rerender } = render(<GraficaActividadSesion totales={base} />);
        rerender(<GraficaActividadSesion totales={{ ...base, inscritos: 30 }} />);
        expect(BarrasPildora).toHaveBeenCalledTimes(1);
        rerender(<GraficaActividadSesion totales={{ capturas: 5, detecciones: 9, detecciones_validas: 6 }} />);
        expect(BarrasPildora).toHaveBeenCalledTimes(2);
        expect(screen.getByRole('group', { name: 'Actividad de reconocimiento' })).toHaveAccessibleDescription('Capturas: 5; Detecciones: 9; Det. válidas: 6');
    });

    it('con cifras nuevas las MISMAS filas cambian su cifra (no se remontan: la barra se mueve, no repite la entrada)', () => {
        const { container, rerender } = render(<GraficaActividadSesion totales={{ capturas: 1, detecciones: 2, detecciones_validas: 1 }} />);
        const antes = filas(container);
        rerender(<GraficaActividadSesion totales={{ capturas: 5, detecciones: 9, detecciones_validas: 6 }} />);
        const despues = filas(container);
        despues.forEach((fila, i) => expect(fila).toBe(antes[i]));
        expect(cifras(container)).toEqual(['5', '9', '6']);
    });

    it('la primera captura llega a una tarjeta vacía y las barras aparecen', () => {
        const { container, rerender } = render(<GraficaActividadSesion totales={{ capturas: 0, detecciones: 0, detecciones_validas: 0 }} />);
        expect(filas(container)).toHaveLength(0);
        rerender(<GraficaActividadSesion totales={{ capturas: 1, detecciones: 0, detecciones_validas: 0 }} />);
        expect(filas(container)).toHaveLength(3);
        expect(cifras(container)).toEqual(['1', '0', '0']);
        expect(screen.queryByText('Aún sin capturas')).toBeNull();
    });
});
