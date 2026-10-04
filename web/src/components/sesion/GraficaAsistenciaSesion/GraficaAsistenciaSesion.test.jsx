// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AnilloEstados from '@/components/ui/AnilloEstados';
import MedidorLiquido from '@/components/ui/MedidorLiquido';
import GraficaAsistenciaSesion from './GraficaAsistenciaSesion.jsx';

// El anillo y el medidor reales, pero con un contador de renders para comprobar que el sondeo no los renderiza sin datos nuevos.
vi.mock('@/components/ui/AnilloEstados', async () => {
    const real = await vi.importActual('@/components/ui/AnilloEstados');
    return { default: vi.fn((props) => real.default(props)) };
});
vi.mock('@/components/ui/MedidorLiquido', async () => {
    const real = await vi.importActual('@/components/ui/MedidorLiquido');
    return { default: vi.fn((props) => real.default(props)) };
});

const totales = { inscritos: 4, presentes: 2, retardos: 1, sin_registro: 1, ausentes: 0, justificados: 0, pendientes: 0 };
const tarjeta = () => screen.getByRole('group', { name: 'Asistencia de la sesión' });
const arcos = () => [...tarjeta().querySelectorAll('svg circle')].slice(1); // el primero es la pista
const filasLeyenda = () => within(tarjeta()).getAllByRole('listitem').map((li) => li.textContent);

describe('GraficaAsistenciaSesion', () => {
    // Con llaves: una arrow que devuelve el mock haría que vitest lo ejecute como limpieza.
    beforeEach(() => {
        AnilloEstados.mockClear();
        MedidorLiquido.mockClear();
        // «Reducir movimiento»: el medidor salta a su nivel sin física ni cuadros pendientes.
        vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('sesión en curso: anillo con «Sin registro», total de inscritos al centro y texto alternativo', () => {
        render(<GraficaAsistenciaSesion totales={totales} />);
        expect(tarjeta()).toHaveAccessibleDescription('Presentes: 2 (50 %); Retardos: 1 (25 %); Sin registro: 1 (25 %); Pendientes: 0 (0 %)');
        expect(filasLeyenda()).toEqual(['Presentes250 %', 'Retardos125 %', 'Sin registro125 %', 'Pendientes00 %']);
        // El centro lleva los inscritos: el % de asistencia lo dice el medidor (no se repite la misma cifra dos veces).
        expect(within(tarjeta()).getByText('Inscritos')).toBeInTheDocument();
        expect(within(tarjeta()).getByText('4', { selector: 'span.tabular-nums' })).toBeInTheDocument();
    });

    it('sesión en curso: medidor «Presentes ahora» con (presentes + retardos) sobre inscritos', () => {
        render(<GraficaAsistenciaSesion totales={totales} />);
        const medidor = screen.getByRole('meter', { name: 'Presentes ahora: 75 %' });
        expect(medidor).toHaveAttribute('aria-valuenow', '75');
        expect(medidor).toHaveAccessibleDescription('3 de 4 inscritos');
        expect(tarjeta()).toContainElement(medidor);
        // El medidor es la única marca de «asistencia %»: el centro del anillo no la repite.
        expect(within(tarjeta()).queryByText('asistencia')).toBeNull();
    });

    it('sesión cerrada: los cinco estados, % de asistencia al centro y sin medidor', () => {
        render(<GraficaAsistenciaSesion totales={{ ...totales, sin_registro: 0, ausentes: 1 }} cerrada />);
        expect(tarjeta()).toHaveAccessibleDescription(
            'Presentes: 2 (50 %); Retardos: 1 (25 %); Ausencias: 1 (25 %); Justificadas: 0 (0 %); Pendientes: 0 (0 %)',
        );
        expect(screen.queryByRole('meter')).toBeNull();
        expect(MedidorLiquido).not.toHaveBeenCalled();
        expect(within(tarjeta()).getByText('75 %')).toBeInTheDocument();
        expect(within(tarjeta()).getByText('asistencia')).toBeInTheDocument();
    });

    it('sin inscritos avisa en lugar de dejar un hueco y no pinta un medidor en 0 %', () => {
        render(<GraficaAsistenciaSesion totales={{}} />);
        expect(screen.getByText('Aún no hay alumnos inscritos')).toBeInTheDocument();
        expect(screen.queryByRole('meter')).toBeNull();
    });

    it('sesión cerrada sin inscritos: aviso propio', () => {
        render(<GraficaAsistenciaSesion totales={{}} cerrada />);
        expect(screen.getByText('La sesión no tuvo alumnos inscritos')).toBeInTheDocument();
    });

    it('un sondeo con los mismos valores no renderiza de nuevo; uno con cifras nuevas sí', () => {
        const { rerender } = render(<GraficaAsistenciaSesion totales={totales} />);
        expect(AnilloEstados).toHaveBeenCalledTimes(1);
        expect(MedidorLiquido).toHaveBeenCalledTimes(1);
        rerender(<GraficaAsistenciaSesion totales={{ ...totales }} />);
        expect(AnilloEstados).toHaveBeenCalledTimes(1);
        expect(MedidorLiquido).toHaveBeenCalledTimes(1);
        rerender(<GraficaAsistenciaSesion totales={{ ...totales, presentes: 3, sin_registro: 0 }} />);
        expect(AnilloEstados).toHaveBeenCalledTimes(2);
        expect(MedidorLiquido).toHaveBeenCalledTimes(2);
        expect(tarjeta()).toHaveAccessibleDescription(/Presentes: 3 \(75 %\)/);
    });

    it('con datos nuevos el anillo y el medidor son LOS MISMOS elementos (no se remontan ni reinician la entrada)', () => {
        const { rerender } = render(<GraficaAsistenciaSesion totales={totales} />);
        const medidor = screen.getByRole('meter');
        const antes = arcos();
        expect(antes).toHaveLength(4);
        rerender(<GraficaAsistenciaSesion totales={{ ...totales, presentes: 3, sin_registro: 0 }} />);
        expect(screen.getByRole('meter')).toBe(medidor);
        expect(medidor).toHaveAttribute('aria-valuenow', '100');
        expect(medidor).toHaveAccessibleName('Presentes ahora: 100 %');
        const despues = arcos();
        expect(despues).toHaveLength(4);
        despues.forEach((arco, i) => expect(arco).toBe(antes[i]));
        // «Sin registro» pasó de 1 a 0: su arco sigue en el DOM (se encoge) y la leyenda lo conserva con 0.
        expect(filasLeyenda()).toContain('Sin registro00 %');
    });

    it('el primer registro llega a un anillo que estaba vacío y aparece con su medidor', () => {
        const { rerender } = render(<GraficaAsistenciaSesion totales={{}} />);
        expect(screen.queryByRole('meter')).toBeNull();
        rerender(<GraficaAsistenciaSesion totales={totales} />);
        expect(screen.getByRole('meter', { name: 'Presentes ahora: 75 %' })).toBeInTheDocument();
        expect(arcos()).toHaveLength(4);
    });
});
