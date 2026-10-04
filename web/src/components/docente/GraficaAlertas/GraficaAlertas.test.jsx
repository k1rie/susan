// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import GraficaAlertas from './GraficaAlertas.jsx';

const A = (nombre, pct, extra = {}) => ({ nombre, porcentaje_faltas: pct, limite_pct: 20, tipo: 'en_limite', ...extra });

const filasDe = (c) => [...c.querySelectorAll('[data-fila]')];
const cifrasDe = (nodo) => [...nodo.querySelectorAll('[data-cifra]')].map((n) => n.textContent);
// «calc(25.5% - 2px)» -> 25.5
const anchoDe = (fila) => Number(/([\d.]+)%/.exec(fila.querySelector('[data-segmento]').style.width)[1]);

describe('GraficaAlertas', () => {
    it('sin alertas no pinta nada', () => {
        const { container } = render(<GraficaAlertas alertas={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('sin alertas con porcentaje tampoco pinta nada', () => {
        const { container } = render(<GraficaAlertas alertas={[A('Ana', null), A('Beto', '')]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('con alertas pinta la tarjeta con texto alternativo y una fila por alumno, de mayor a menor', () => {
        const { container } = render(<GraficaAlertas alertas={[A('Beto', 18), A('Ana', 25)]} />);
        const grupo = screen.getByRole('group', { name: 'Faltas vs límite' });
        expect(grupo).toHaveAccessibleDescription(/límite 20 %.*Ana: 25 %.*Beto: 18 %/);
        const filas = filasDe(container);
        expect(filas.map((f) => f.dataset.fila)).toEqual(['Ana', 'Beto']);
        // La cifra lleva la unidad: ya no hay tooltip que la explique.
        expect(cifrasDe(filas[0])).toEqual(['25 %']);
        expect(cifrasDe(filas[1])).toEqual(['18 %']);
        // Es una gráfica hecha a mano (SVG/CSS): no monta el contenedor `data-slot="chart"` de la librería anterior.
        expect(container.querySelector('[data-slot="chart"]')).toBeNull();
    });

    it('dibuja la línea del límite con su etiqueta y el dominio la deja dentro de la gráfica', () => {
        const { container } = render(<GraficaAlertas alertas={[A('Ana', 25), A('Beto', 18)]} />);
        // Una vez como etiqueta sobre la línea (dibujada, aria-hidden) y otra en la lista oculta para lectores de pantalla.
        expect(screen.getAllByText('Límite 20 %')).toHaveLength(2);
        expect(container.querySelector('[data-limite]')).toBeInTheDocument();
        // Dominio [0, 29]: la barra más larga es la de más faltas y ninguna rebasa la pista.
        const [ana, beto] = filasDe(container);
        expect(anchoDe(ana)).toBeGreaterThan(anchoDe(beto));
        expect(anchoDe(ana)).toBeLessThanOrEqual(100);
    });

    it('un límite mayor que las faltas igual queda dentro de la escala (no se avisa «fuera de escala»)', () => {
        const { container } = render(<GraficaAlertas alertas={[A('Ana', 5)]} />);
        expect(container.querySelector('[data-limite]')).toBeInTheDocument();
        expect(screen.queryByText(/fuera de escala/)).toBeNull();
    });

    it('sin límite en las alertas no hay línea ni etiqueta', () => {
        const { container } = render(<GraficaAlertas alertas={[{ nombre: 'Ana', porcentaje_faltas: 30 }]} />);
        expect(container.querySelector('[data-limite]')).toBeNull();
        expect(screen.queryByText(/Límite/)).toBeNull();
        expect(screen.getByRole('group', { name: 'Faltas vs límite' })).not.toHaveAccessibleDescription(/límite/);
    });

    it('un nombre largo se acorta en la etiqueta y la clave del grupo se conserva', () => {
        const { container } = render(<GraficaAlertas alertas={[A('Hernández Villalobos Fernanda Sofía', 30, { clave_grupo: '3A' })]} />);
        const [fila] = filasDe(container);
        expect(fila.dataset.fila.endsWith('\u00A0·\u00A03A')).toBe(true);
        expect(fila.dataset.fila).toContain('…');
        // El title de la etiqueta trae el texto de la fila para quien no la lee entera.
        expect(fila.querySelector('span[title]')).toHaveAttribute('title', fila.dataset.fila);
    });

    it('a 360 px no desborda: la pista se encoge (minmax(0, 1fr)) y la columna de nombres se limita al 42 %', () => {
        const { container } = render(<GraficaAlertas alertas={[A('Ana', 25)]} />);
        const rejilla = container.querySelector('[data-fila]').parentElement;
        expect(rejilla.style.getPropertyValue('--ancho-nombres')).toBe('min(150px, 42%)');
        expect(rejilla.style.gridTemplateColumns).toContain('minmax(0, 1fr)');
    });

    it('avisa cuando hay más alertas que barras', () => {
        const muchas = Array.from({ length: 10 }, (_, i) => A(`Alumno ${i}`, 10 + i));
        const { container } = render(<GraficaAlertas alertas={muchas} />);
        expect(screen.getByText('Se muestran los 8 con más faltas.')).toBeInTheDocument();
        expect(filasDe(container)).toHaveLength(8);
    });

    it('el aviso solo cuenta alertas graficables: las que no tienen porcentaje no lo disparan', () => {
        const nueve = Array.from({ length: 9 }, (_, i) => A(`Alumno ${i}`, 10 + i));
        // 7 con porcentaje + 3 sin él: caben las 7, no hay nada que avisar.
        const conHuecos = [...nueve.slice(0, 7), A('Sin dato 1', null), A('Sin dato 2', null), A('Sin dato 3', null)];
        const { container } = render(<GraficaAlertas alertas={conHuecos} />);
        expect(screen.queryByText(/Se muestran los/)).toBeNull();
        expect(filasDe(container)).toHaveLength(7);
    });

    it('un refetch con datos nuevos actualiza cifras y texto alternativo sin remontar las filas', () => {
        const { container, rerender } = render(<GraficaAlertas alertas={[A('Ana', 25), A('Beto', 18)]} />);
        const [anaAntes, betoAntes] = filasDe(container);
        // Mismos datos en arreglos nuevos: los mismos nodos, nada se reinicia.
        rerender(<GraficaAlertas alertas={[A('Ana', 25), A('Beto', 18)]} />);
        expect(filasDe(container)[0]).toBe(anaAntes);
        // Ana sube: se actualiza su fila (mismo nodo, para que la barra se desplace en lugar de reanimarse desde 0).
        rerender(<GraficaAlertas alertas={[A('Ana', 27), A('Beto', 18)]} />);
        const [anaDespues, betoDespues] = filasDe(container);
        expect(anaDespues).toBe(anaAntes);
        expect(betoDespues).toBe(betoAntes);
        expect(cifrasDe(anaDespues)).toEqual(['27 %']);
        expect(screen.getByRole('group', { name: 'Faltas vs límite' })).toHaveAccessibleDescription(/Ana: 27 %/);
    });

    it('si todas las alertas desaparecen en un refetch, la tarjeta se retira', () => {
        const { container, rerender } = render(<GraficaAlertas alertas={[A('Ana', 25)]} />);
        expect(filasDe(container)).toHaveLength(1);
        rerender(<GraficaAlertas alertas={[]} />);
        expect(container).toBeEmptyDOMElement();
    });
});
