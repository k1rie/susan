// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GraficaBarras from '@/components/ui/GraficaBarras';
import GraficaAlertas from './GraficaAlertas.jsx';

// Las barras reales, con un contador de renders para comprobar que un refetch idéntico no las redibuja.
vi.mock('@/components/ui/GraficaBarras', async () => {
    const real = await vi.importActual('@/components/ui/GraficaBarras');
    return { default: vi.fn((props) => real.default(props)) };
});

const A = (nombre, pct) => ({ nombre, porcentaje_faltas: pct, limite_pct: 20, tipo: 'en_limite' });

describe('GraficaAlertas', () => {
    // Con llaves: una arrow que devuelve el mock haría que vitest lo ejecute como limpieza.
    beforeEach(() => {
        GraficaBarras.mockClear();
    });

    it('sin alertas no pinta nada', () => {
        const { container } = render(<GraficaAlertas alertas={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('con alertas pinta la tarjeta con texto alternativo', () => {
        const { container } = render(<GraficaAlertas alertas={[A('Ana', 25), A('Beto', 18)]} />);
        const grupo = screen.getByRole('group', { name: 'Faltas vs límite' });
        expect(grupo).toHaveAccessibleDescription(/límite 20 %.*Ana: 25 %.*Beto: 18 %/);
        expect(container.querySelector('[data-slot="chart"]')).toBeInTheDocument();
    });

    it('avisa cuando hay más alertas que barras', () => {
        const muchas = Array.from({ length: 10 }, (_, i) => A(`Alumno ${i}`, 10 + i));
        render(<GraficaAlertas alertas={muchas} />);
        expect(screen.getByText('Se muestran los 8 con más faltas.')).toBeInTheDocument();
    });

    it('el aviso solo cuenta alertas graficables: las que no tienen porcentaje no lo disparan', () => {
        const nueve = Array.from({ length: 9 }, (_, i) => A(`Alumno ${i}`, 10 + i));
        // 7 con porcentaje + 3 sin él: caben las 7, no hay nada que avisar.
        const conHuecos = [...nueve.slice(0, 7), A('Sin dato 1', null), A('Sin dato 2', null), A('Sin dato 3', null)];
        render(<GraficaAlertas alertas={conHuecos} />);
        expect(screen.queryByText(/Se muestran los/)).toBeNull();
    });

    it('un refetch con los mismos datos no redibuja; con datos nuevos sí', () => {
        const alertas = [A('Ana', 25), A('Beto', 18)];
        const { rerender } = render(<GraficaAlertas alertas={alertas} />);
        rerender(<GraficaAlertas alertas={alertas.map((a) => ({ ...a }))} />);
        expect(GraficaBarras).toHaveBeenCalledTimes(1);
        rerender(<GraficaAlertas alertas={[A('Ana', 27), A('Beto', 18)]} />);
        expect(GraficaBarras).toHaveBeenCalledTimes(2);
        expect(screen.getByRole('group', { name: 'Faltas vs límite' })).toHaveAccessibleDescription(/Ana: 27 %/);
    });
});
