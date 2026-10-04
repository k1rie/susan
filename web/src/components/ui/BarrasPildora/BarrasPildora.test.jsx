// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import BarrasPildora from './BarrasPildora.jsx';

const RANKING = [
    { alumno: 'González Campos Mauricio', faltas: 26.7 },
    { alumno: 'Mendoza Ríos Héctor', faltas: 24.4 },
    { alumno: 'Díaz Castro Miguel', faltas: 4 },
];
const CONFIG_FALTAS = { faltas: { label: 'Faltas equivalentes', color: 'var(--ausente)' } };
const GRUPOS = [
    { grupo: '3A', conDerecho: 22, enLimite: 1, sinDerecho: 1 },
    { grupo: '5C', conDerecho: 21, enLimite: 2, sinDerecho: 3 },
    { grupo: '3B', conDerecho: 24, enLimite: 0, sinDerecho: 0 },
];
const SERIES_GRUPOS = [{ clave: 'conDerecho' }, { clave: 'enLimite' }, { clave: 'sinDerecho' }];
const CONFIG_GRUPOS = {
    conDerecho: { label: 'Con derecho', color: 'var(--presente)' },
    enLimite: { label: 'En el límite', color: 'var(--retardo)' },
    sinDerecho: { label: 'Sin derecho', color: 'var(--ausente)' },
};
const SEMANA = [
    { dia: 'Lun', ausentismo: 14.9 },
    { dia: 'Mar', ausentismo: 14.6 },
    { dia: 'Mié', ausentismo: 9.8 },
    { dia: 'Jue', ausentismo: 11.2 },
    { dia: 'Vie', ausentismo: 19.7 },
];
const CONFIG_SEMANA = { ausentismo: { label: 'Ausentismo', color: 'var(--chart-1)' } };
const LIMITE = { valor: 20, etiqueta: 'Límite 20 %' };

function simularMatchMedia(coincide) {
    const mq = { matches: coincide, addEventListener: () => {}, removeEventListener: () => {} };
    vi.stubGlobal('matchMedia', () => mq);
}

class ObservadorFalso {
    static instancias = [];
    constructor(cb) {
        this.cb = cb;
        ObservadorFalso.instancias.push(this);
    }
    observe() {}
    disconnect() {}
    emitir(esVisible) { this.cb([{ isIntersecting: esVisible }]); }
}

class ObservadorTamano {
    static instancias = [];
    constructor(cb) {
        this.cb = cb;
        ObservadorTamano.instancias.push(this);
    }
    observe() {}
    disconnect() {}
    medir(ancho) { this.cb([{ contentRect: { width: ancho } }]); }
}

const filasDe = (c) => [...c.querySelectorAll('[data-fila]')];
const segmentosDe = (nodo) => [...nodo.querySelectorAll('[data-segmento]')];
const cifrasDe = (nodo) => [...nodo.querySelectorAll('[data-cifra]')];
const textos = (nodos) => nodos.map((n) => n.textContent);
// «calc(33.44% - 2px)» -> 33.44
const pctDe = (css) => Number(/([\d.]+)%/.exec(css)[1]);
const esperarEntrada = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const listaLectores = (c) => textos([...c.querySelectorAll('ul.sr-only > li')]);

afterEach(() => {
    vi.unstubAllGlobals();
    ObservadorFalso.instancias = [];
    ObservadorTamano.instancias = [];
});

describe('BarrasPildora: sin datos', () => {
    const props = { ejeX: 'alumno', series: [{ clave: 'faltas' }], config: CONFIG_FALTAS };

    it('sin filas, sin series, con datos nulos o todo sin dato muestra el aviso con el alto y el texto pedidos', () => {
        const { rerender } = render(<BarrasPildora {...props} datos={[]} />);
        expect(screen.getByText('Sin datos para graficar')).toHaveStyle({ height: '260px' });
        rerender(<BarrasPildora {...props} datos={undefined} vacio="Aún sin capturas" alto={150} />);
        expect(screen.getByText('Aún sin capturas')).toHaveStyle({ height: '150px' });
        rerender(<BarrasPildora {...props} datos={null} />);
        expect(screen.getByText('Sin datos para graficar')).toBeInTheDocument();
        rerender(<BarrasPildora {...props} datos={RANKING} series={[]} />);
        expect(screen.getByText('Sin datos para graficar')).toBeInTheDocument();
        rerender(<BarrasPildora {...props} datos={RANKING} series={undefined} />);
        expect(screen.getByText('Sin datos para graficar')).toBeInTheDocument();
        rerender(<BarrasPildora {...props} datos={[{ alumno: 'A', faltas: null }, { alumno: 'B', faltas: NaN }, { alumno: 'C' }]} />);
        expect(screen.getByText('Sin datos para graficar')).toBeInTheDocument();
    });

    it('todo en 0 NO es «sin datos»: se dibujan las pistas vacías con su «0 %»', () => {
        const { container } = render(<BarrasPildora {...props} horizontal unidad=" %" datos={[{ alumno: 'A', faltas: 0 }, { alumno: 'B', faltas: 0 }]} />);
        expect(filasDe(container)).toHaveLength(2);
        expect(textos(cifrasDe(container))).toEqual(['0 %', '0 %']);
        expect(segmentosDe(container).every((s) => s.style.opacity === '0')).toBe(true);
    });

    it('pasar de «sin datos» a «con datos» también hace la entrada', () => {
        vi.stubGlobal('IntersectionObserver', ObservadorFalso);
        const { container, rerender } = render(<BarrasPildora {...props} datos={[]} horizontal />);
        // el contenedor observado existe aun sin datos
        expect(ObservadorFalso.instancias).toHaveLength(1);
        rerender(<BarrasPildora {...props} datos={RANKING} horizontal />);
        expect(cifrasDe(container)[0].style.opacity).toBe('0');
        act(() => ObservadorFalso.instancias[0].emitir(true));
        expect(cifrasDe(container)[0].style.opacity).toBe('1');
        expect(container.querySelector('.absolute.inset-0').style.clipPath).toBe('inset(0 0 0 0 round 999px)');
    });
});

describe('BarrasPildora: filas (horizontal)', () => {
    const base = { horizontal: true, datos: RANKING, ejeX: 'alumno', series: [{ clave: 'faltas' }], config: CONFIG_FALTAS, unidad: ' %' };

    it('una fila por dato con nombre, barra y cifra con unidad', () => {
        const { container } = render(<BarrasPildora {...base} />);
        const filas = filasDe(container);
        expect(filas).toHaveLength(3);
        expect(textos(cifrasDe(container))).toEqual(['26.7 %', '24.4 %', '4 %']);
        expect(filas[0]).toHaveTextContent('González Campos Mauricio');
        expect(filas[0]).toHaveAttribute('title', 'González Campos Mauricio: 26.7 %');
    });

    it('un nombre largo ocupa 2 líneas como máximo y su title trae el nombre completo', () => {
        const { container } = render(<BarrasPildora {...base} />);
        const nombre = filasDe(container)[0].querySelector('.line-clamp-2');
        expect(nombre).toHaveAttribute('title', 'González Campos Mauricio');
        expect(nombre).toHaveTextContent('González Campos Mauricio');
    });

    it('el ancho de cada barra es proporcional al dominio automático (incluye el límite y deja aire)', () => {
        const { container } = render(<BarrasPildora {...base} limite={LIMITE} />);
        const [a, b, c] = filasDe(container).map((f) => segmentosDe(f)[0]);
        // dominio [0, 26.7 x 1.12]
        expect(pctDe(a.style.width)).toBeCloseTo((26.7 / (26.7 * 1.12)) * 100, 2);
        expect(pctDe(b.style.width)).toBeCloseTo((24.4 / (26.7 * 1.12)) * 100, 2);
        expect(pctDe(c.style.width)).toBeCloseTo((4 / (26.7 * 1.12)) * 100, 2);
        expect(a.style.background).toContain('var(--g-ausente)');
    });

    it('con límite dibuja la línea en su posición y la etiqueta sobre la primera fila', () => {
        const { container } = render(<BarrasPildora {...base} limite={LIMITE} />);
        const linea = container.querySelector('[data-limite]');
        expect(pctDe(linea.style.left)).toBeCloseTo((20 / (26.7 * 1.12)) * 100, 2);
        expect(linea.parentElement).toHaveTextContent('Límite 20 %');
        // en filas la etiqueta va sobre la línea, no en la leyenda
        expect(container.querySelector('[data-leyenda-limite]')).toBeNull();
        // un límite mayor que todos los datos amplía el dominio: las barras no llenan la pista
        const { container: c2 } = render(<BarrasPildora {...base} limite={{ valor: 80, etiqueta: 'Mínimo 80 %' }} />);
        expect(pctDe(segmentosDe(c2)[0].style.width)).toBeLessThan(40);
        expect(pctDe(c2.querySelector('[data-limite]').style.left)).toBeCloseTo((80 / (80 * 1.12)) * 100, 2);
    });

    it('con dominio fijo [0, 100] la escala es exacta y el límite cae donde toca', () => {
        const { container } = render(<BarrasPildora {...base} dominio={[0, 100]} limite={LIMITE} />);
        expect(pctDe(segmentosDe(container)[0].style.width)).toBeCloseTo(26.7, 2);
        expect(pctDe(container.querySelector('[data-limite]').style.left)).toBeCloseTo(20, 2);
    });

    it('con dominio [0, auto] calcula el máximo a partir de los datos', () => {
        const { container } = render(<BarrasPildora {...base} dominio={[0, 'auto']} />);
        expect(pctDe(segmentosDe(container)[0].style.width)).toBeCloseTo((26.7 / (26.7 * 1.12)) * 100, 2);
    });

    it('un límite fuera de la escala fija no se dibuja pegado al borde: se avisa en la leyenda', () => {
        const { container } = render(<BarrasPildora {...base} dominio={[0, 100]} limite={{ valor: 150, etiqueta: 'Tope 150 %' }} />);
        expect(container.querySelector('[data-limite]')).toBeNull();
        expect(container.querySelector('[data-leyenda-limite]')).toHaveTextContent('Tope 150 % (fuera de escala)');
        // y no se repite en el texto para lectores
        expect(listaLectores(container)).toHaveLength(3);
        const { container: c2 } = render(<BarrasPildora {...base} dominio={[10, 100]} limite={{ valor: 5 }} />);
        expect(c2.querySelector('[data-limite]')).toBeNull();
        expect(c2.querySelector('[data-leyenda-limite]')).toHaveTextContent('Límite 5 % (fuera de escala)');
    });

    it('un límite sin etiqueta dibuja solo la línea y se lee en el texto para lectores', () => {
        const { container } = render(<BarrasPildora {...base} limite={{ valor: 20 }} />);
        expect(container.querySelector('[data-limite]')).toBeInTheDocument();
        expect(container.querySelector('[data-limite]').className).toContain('top-0');
        expect(listaLectores(container)).toContain('Límite 20 %');
    });

    it('valores 0, negativos, NaN y null: no dibujan barra; la cifra es «0 %» o «-»', () => {
        const datos = [
            { alumno: 'A', faltas: 0 },
            { alumno: 'B', faltas: -5 },
            { alumno: 'C', faltas: NaN },
            { alumno: 'D', faltas: null },
            { alumno: 'E', faltas: 10 },
        ];
        const { container } = render(<BarrasPildora {...base} datos={datos} />);
        const filas = filasDe(container);
        expect(textos(cifrasDe(container))).toEqual(['0 %', '0 %', '-', '-', '10 %']);
        for (const i of [0, 1, 2, 3]) {
            const s = segmentosDe(filas[i])[0];
            expect(s.style.opacity).toBe('0');
            expect(s.style.width).toBe('0px');
        }
        expect(segmentosDe(filas[4])[0].style.opacity).toBe('1');
        expect(filas[3]).toHaveAttribute('title', 'D: sin datos');
        expect(cifrasDe(filas[3])[0]).toHaveClass('text-muted-foreground');
        // un valor positivo minúsculo sí se ve (mínimo 4 px)
        const { container: c2 } = render(<BarrasPildora {...base} datos={[{ alumno: 'A', faltas: 0.01 }, { alumno: 'B', faltas: 100 }]} />);
        expect(segmentosDe(c2)[0].style.opacity).toBe('1');
        expect(segmentosDe(c2)[0].style.minWidth).toBe('4px');
    });

    it('apilado: los segmentos se suceden dentro de una sola pista con una sola cifra (el total)', () => {
        const { container } = render(<BarrasPildora horizontal apilado datos={GRUPOS} ejeX="grupo" series={SERIES_GRUPOS} config={CONFIG_GRUPOS} dominio={[0, 100]} />);
        const fila = filasDe(container)[1]; // 21 + 2 + 3
        const [a, b, c] = segmentosDe(fila);
        expect(fila.querySelectorAll('.bg-muted')).toHaveLength(1);
        expect(textos(cifrasDe(fila))).toEqual(['26']);
        expect(pctDe(a.style.left)).toBeCloseTo(0, 2);
        expect(pctDe(a.style.width)).toBeCloseTo(21, 2);
        expect(pctDe(b.style.left)).toBeCloseTo(21, 2);
        expect(pctDe(c.style.left)).toBeCloseTo(23, 2);
        expect(fila).toHaveAttribute('title', '5C: Con derecho 21 · En el límite 2 · Sin derecho 3 · total 26');
        // el segmento en 0 se conserva, colapsado e invisible
        const ultima = segmentosDe(filasDe(container)[2]);
        expect(ultima).toHaveLength(3);
        expect(ultima[1].style.opacity).toBe('0');
    });

    it('apilado en filas: con más de un segmento con valor, la cifra de cada uno se escribe bajo la pista, con el color de su serie', () => {
        const { container } = render(<BarrasPildora horizontal apilado datos={GRUPOS} ejeX="grupo" series={SERIES_GRUPOS} config={CONFIG_GRUPOS} dominio={[0, 100]} />);
        const [a, b, c] = filasDe(container);
        // 5C: 21 + 2 + 3 -> tres cifras, una por segmento
        const desglose = b.querySelector('[data-desglose]');
        expect(desglose).toBeInTheDocument();
        expect(textos([...desglose.children])).toEqual(['21', '2', '3']);
        // el punto de cada cifra es del mismo color que su segmento en la barra
        const colores = [...desglose.children].map((n) => n.firstElementChild.style.background);
        expect(colores).toEqual(['var(--g-presente)', 'var(--g-retardo)', 'var(--g-ausente)']);
        expect(colores).toEqual(segmentosDe(b).map((s) => s.style.background));
        // 3A: 22 + 1 + 1 -> también; 3B: 24 + 0 + 0 -> un solo segmento con valor, la cifra de la fila ya lo dice todo
        expect(textos([...a.querySelector('[data-desglose]').children])).toEqual(['22', '1', '1']);
        expect(c.querySelector('[data-desglose]')).toBeNull();
        // la cifra de la fila sigue siendo solo el total y el desglose queda dentro de lo aria-hidden (los lectores usan la lista oculta)
        expect(textos(cifrasDe(b))).toEqual(['26']);
        expect(container.querySelector('[aria-hidden="true"]')).toContainElement(desglose);
        expect(listaLectores(container)[1]).toBe('5C: Con derecho 21 · En el límite 2 · Sin derecho 3 · total 26');
    });

    it('el desglose respeta formatoValor, omite los segmentos sin dato o en 0 y no aparece sin apilar', () => {
        const { container } = render(<BarrasPildora horizontal apilado formatoValor={(v) => `${v} al.`} datos={[{ g: 'X', a: 4, b: null, c: 0, d: 2 }]} ejeX="g" series={[{ clave: 'a' }, { clave: 'b' }, { clave: 'c' }, { clave: 'd' }]} />);
        expect(textos([...container.querySelector('[data-desglose]').children])).toEqual(['4 al.', '2 al.']);
        const { container: c2 } = render(<BarrasPildora horizontal datos={GRUPOS} ejeX="grupo" series={SERIES_GRUPOS} config={CONFIG_GRUPOS} />);
        expect(c2.querySelector('[data-desglose]')).toBeNull();
        // en columnas (sin espacio para texto extra) tampoco
        const { container: c3 } = render(<BarrasPildora apilado datos={GRUPOS} ejeX="grupo" series={SERIES_GRUPOS} config={CONFIG_GRUPOS} />);
        expect(c3.querySelector('[data-desglose]')).toBeNull();
    });

    it('apilado con dominio fijo recorta lo que rebasa el máximo', () => {
        const { container } = render(<BarrasPildora horizontal apilado datos={[{ g: 'X', a: 80, b: 50 }, { g: 'Y', a: 100, b: 20 }]} ejeX="g" series={[{ clave: 'a' }, { clave: 'b' }]} dominio={[0, 100]} />);
        const [x, y] = filasDe(container).map((f) => segmentosDe(f));
        expect(pctDe(x[1].style.left)).toBeCloseTo(80, 2);
        expect(pctDe(x[1].style.width)).toBeCloseTo(20, 2);
        // el segmento que cae del todo fuera de la escala no se dibuja
        expect(y[1].style.opacity).toBe('0');
    });

    it('varias series SIN apilar van cada una en su pista y con su cifra (antes se solapaban desde 0)', () => {
        const datos = [{ g: '3A', a: 12, b: 20 }, { g: '5C', a: 8, b: null }];
        const { container } = render(<BarrasPildora horizontal datos={datos} ejeX="g" series={[{ clave: 'a' }, { clave: 'b' }]} config={{ a: { label: 'Parcial 1' }, b: { label: 'Parcial 2' } }} dominio={[0, 20]} />);
        const [f1, f2] = filasDe(container);
        expect(f1.querySelectorAll('.bg-muted')).toHaveLength(2);
        const [s1, s2] = segmentosDe(f1);
        expect(s1.parentElement).not.toBe(s2.parentElement);
        expect(pctDe(s1.style.left)).toBeCloseTo(0, 2);
        expect(pctDe(s2.style.left)).toBeCloseTo(0, 2);
        expect(pctDe(s1.style.width)).toBeCloseTo(60, 2);
        expect(pctDe(s2.style.width)).toBeCloseTo(100, 2);
        expect(textos(cifrasDe(f1))).toEqual(['12', '20']);
        expect(textos(cifrasDe(f2))).toEqual(['8', '-']);
        expect(f1).toHaveAttribute('title', '3A: Parcial 1 12 · Parcial 2 20');
        // la serie sin dato no se lista
        expect(f2).toHaveAttribute('title', '5C: Parcial 1 8');
        // varias series: leyenda por defecto
        expect(screen.getByText('Parcial 1')).toBeInTheDocument();
        expect(screen.getByText('Parcial 2')).toBeInTheDocument();
    });

    it('formatoValor reemplaza cifra y unidad (y no se llama con valores sin dato); la columna de cifras se ensancha si hace falta', () => {
        const formato = vi.fn((v) => `${v} de 45`);
        const { container } = render(<BarrasPildora {...base} unidad=" %" formatoValor={formato} datos={[{ alumno: 'A', faltas: 12 }, { alumno: 'B', faltas: null }]} />);
        expect(textos(cifrasDe(container))).toEqual(['12 de 45', '-']);
        expect(formato).not.toHaveBeenCalledWith(null);
        const rejilla = container.querySelector('.grid');
        expect(rejilla.style.getPropertyValue('--ancho-valor')).toBe('max(2.5rem, 9ch)');
        const { container: c2 } = render(<BarrasPildora {...base} formatoValor={() => 'x'.repeat(40)} />);
        expect(c2.querySelector('.grid').style.getPropertyValue('--ancho-valor')).toBe('max(2.5rem, 16ch)');
    });

    it('anchoEjeY fija el ancho de la columna de nombres (como mucho el 42 % del ancho)', () => {
        const { container } = render(<BarrasPildora {...base} anchoEjeY={150} />);
        expect(container.querySelector('.grid').style.getPropertyValue('--ancho-nombres')).toBe('min(150px, 42%)');
        expect(container.querySelector('.grid').style.gridTemplateColumns).toContain('var(--ancho-nombres)');
    });
});

describe('BarrasPildora: columnas', () => {
    const base = { datos: SEMANA, ejeX: 'dia', series: [{ clave: 'ausentismo' }], config: CONFIG_SEMANA, unidad: ' %' };

    it('una columna por dato con su cifra y su categoría debajo, y un alto igual al pedido', () => {
        const { container } = render(<BarrasPildora {...base} alto={240} />);
        expect(filasDe(container)).toHaveLength(5);
        expect(textos(cifrasDe(container))).toEqual(['14.9 %', '14.6 %', '9.8 %', '11.2 %', '19.7 %']);
        expect(container.querySelector('[style*="height: 240px"]')).toBeInTheDocument();
        expect(screen.getAllByText('Lun').length).toBeGreaterThan(0);
        expect(container.querySelector('.truncate[title="Vie"]')).toBeInTheDocument();
    });

    it('la altura de cada barra es proporcional al dominio', () => {
        const { container } = render(<BarrasPildora {...base} dominio={[0, 100]} />);
        const s = filasDe(container).map((f) => segmentosDe(f)[0]);
        expect(pctDe(s[0].style.height)).toBeCloseTo(14.9, 2);
        expect(pctDe(s[4].style.height)).toBeCloseTo(19.7, 2);
        expect(s[0].style.bottom).toBe('calc(0% + 1px)');
    });

    it('con límite: línea sobre el área de trazado y su etiqueta en la leyenda (no sobre la barra)', () => {
        const { container } = render(<BarrasPildora {...base} limite={LIMITE} />);
        expect(container.querySelector('[data-limite]')).toBeInTheDocument();
        expect(container.querySelector('[data-leyenda-limite]')).toHaveTextContent('Límite 20 %');
        // el texto para lectores no lo repite
        expect(listaLectores(container)).toHaveLength(5);
    });

    it('apilado: los segmentos se suman en una barra y la cifra es el total', () => {
        const datos = [{ dia: 'Lun', normal: 14.9, critico: null }, { dia: 'Vie', normal: null, critico: 19.7 }, { dia: 'Sáb', normal: null, critico: null }];
        const { container } = render(<BarrasPildora datos={datos} ejeX="dia" series={[{ clave: 'normal' }, { clave: 'critico' }]} config={{ normal: { label: 'Ausentismo', color: 'var(--chart-1)' }, critico: { label: 'Día crítico', color: 'var(--ausente)' } }} apilado unidad=" %" />);
        expect(textos(cifrasDe(container))).toEqual(['14.9 %', '19.7 %', '-']);
        const [lun, vie, sab] = filasDe(container);
        expect(segmentosDe(lun)[0].style.opacity).toBe('1');
        expect(segmentosDe(lun)[1].style.opacity).toBe('0');
        expect(segmentosDe(vie)[1].style.opacity).toBe('1');
        expect(segmentosDe(sab).every((s) => s.style.opacity === '0')).toBe(true);
        expect(sab).toHaveAttribute('title', 'Sáb: sin datos');
        // leyenda por defecto con varias series
        expect(screen.getByText('Día crítico')).toBeInTheDocument();
    });

    it('apilado con varias series con dato: las barras se suceden desde la base y el title suma el total', () => {
        const { container } = render(<BarrasPildora apilado datos={GRUPOS} ejeX="grupo" series={SERIES_GRUPOS} config={CONFIG_GRUPOS} dominio={[0, 100]} />);
        const fila = filasDe(container)[1];
        const [a, b, c] = segmentosDe(fila);
        expect(pctDe(a.style.height)).toBeCloseTo(21, 2);
        expect(pctDe(b.style.bottom)).toBeCloseTo(21, 2);
        expect(pctDe(c.style.bottom)).toBeCloseTo(23, 2);
        expect(textos(cifrasDe(fila))).toEqual(['26']);
        expect(fila.querySelectorAll('[data-cifra]')).toHaveLength(1);
    });

    it('varias series SIN apilar van lado a lado dentro de cada categoría, cada una desde la base y con su cifra', () => {
        const datos = [{ g: '3A', a: 12, b: 20 }, { g: '5C', a: 8, b: 15 }];
        const { container } = render(<BarrasPildora datos={datos} ejeX="g" series={[{ clave: 'a' }, { clave: 'b' }]} config={{ a: { label: 'Parcial 1' }, b: { label: 'Parcial 2' } }} dominio={[0, 20]} />);
        const [f1] = filasDe(container);
        const [s1, s2] = segmentosDe(f1);
        // cada serie en su propia pista (hermanas), no una encima de otra
        expect(s1.parentElement.parentElement).not.toBe(s2.parentElement.parentElement);
        expect(s1.parentElement.parentElement.parentElement).toBe(s2.parentElement.parentElement.parentElement);
        expect(pctDe(s1.style.bottom)).toBeCloseTo(0, 2);
        expect(pctDe(s2.style.bottom)).toBeCloseTo(0, 2);
        expect(pctDe(s1.style.height)).toBeCloseTo(60, 2);
        expect(pctDe(s2.style.height)).toBeCloseTo(100, 2);
        expect(textos(cifrasDe(f1))).toEqual(['12', '20']);
        // el grupo es más ancho que el de una sola serie, con barras más delgadas
        expect(f1.firstChild.style.maxWidth).toBe('60px');
        expect(f1.firstChild.style.columnGap).toBe('4px');
    });

    it('los valores nulos, 0 y negativos no dibujan barra', () => {
        const datos = [{ d: 'A', v: 0 }, { d: 'B', v: -3 }, { d: 'C', v: null }, { d: 'D', v: 'x' }, { d: 'E', v: 8 }];
        const { container } = render(<BarrasPildora datos={datos} ejeX="d" series={[{ clave: 'v' }]} />);
        expect(textos(cifrasDe(container))).toEqual(['0', '0', '-', '-', '8']);
        expect(filasDe(container).map((f) => segmentosDe(f)[0].style.opacity)).toEqual(['0', '0', '0', '0', '1']);
    });

    it('dominio fijo [0, 100] con límite en 80 y datos bajos (LecturasCaso: apilado, 170 px)', () => {
        const datos = [{ lectura: '1', valida: 92, no_valida: null }, { lectura: '2', valida: null, no_valida: 41 }];
        const { container } = render(<BarrasPildora datos={datos} ejeX="lectura" series={[{ clave: 'valida' }, { clave: 'no_valida' }]} config={{ valida: { label: 'Válida', color: 'var(--presente)' }, no_valida: { label: 'No válida', color: 'var(--ausente)' } }} apilado unidad=" %" dominio={[0, 100]} alto={170} leyenda limite={{ valor: 80, etiqueta: 'Mínimo 80 %' }} />);
        expect(textos(cifrasDe(container))).toEqual(['92 %', '41 %']);
        expect(pctDe(container.querySelector('[data-limite]').style.bottom)).toBeCloseTo(80, 2);
    });

    it('un límite fuera de la escala fija no se dibuja y se explica en la leyenda', () => {
        const { container } = render(<BarrasPildora {...base} dominio={[0, 30]} limite={{ valor: 45, etiqueta: 'Límite 45 %' }} />);
        expect(container.querySelector('[data-limite]')).toBeNull();
        expect(container.querySelector('[data-leyenda-limite]')).toHaveTextContent('Límite 45 % (fuera de escala)');
    });

    it('un límite sin etiqueta solo se lee en el texto para lectores', () => {
        const { container } = render(<BarrasPildora {...base} limite={{ valor: 20 }} />);
        expect(container.querySelector('[data-limite]')).toBeInTheDocument();
        expect(container.querySelector('[data-leyenda-limite]')).toBeNull();
        expect(listaLectores(container)).toContain('Límite 20 %');
    });

    it('cada cifra aparece con su barra (nunca antes) y la de una columna que sube a la vez acompaña su punta', () => {
        vi.stubGlobal('IntersectionObserver', ObservadorFalso);
        const { container } = render(<BarrasPildora {...base} />);
        expect(cifrasDe(container).every((c) => c.style.opacity === '0')).toBe(true);
        expect(filasDe(container)[0].querySelector('.absolute.inset-0').style.clipPath).toContain('100%');
        act(() => ObservadorFalso.instancias[0].emitir(true));
        const cifras = cifrasDe(container);
        expect(cifras.every((c) => c.style.opacity === '1')).toBe(true);
        // la cifra espera a que la barra haya subido (retraso de entrada + 450 ms) y luego sigue su punta con `bottom`
        expect(cifras[0].style.transition).toMatch(/opacity 0\.4s ease 450ms/);
        expect(cifras[1].style.transition).toMatch(/opacity 0\.4s ease 510ms/);
        expect(cifras[0].style.transition).toContain('bottom 0.5s');
    });

    it('la cifra de una barra que acaba justo bajo el límite se aparta de la línea en lugar de ser atravesada', () => {
        const datos = [{ d: 'A', v: 19 }, { d: 'B', v: 5 }];
        const { container } = render(<BarrasPildora datos={datos} ejeX="d" series={[{ clave: 'v' }]} unidad=" %" limite={LIMITE} alto={260} />);
        const alturaPlano = 260 - 52;
        const linea = (pctDe(container.querySelector('[data-limite]').style.bottom) / 100) * alturaPlano;
        const [a, b] = cifrasDe(container).map((c) => parseFloat(c.style.bottom));
        // A: su lugar natural quedaba sobre la línea; la cifra se coloca justo encima
        expect(a).toBeGreaterThan(linea + 3);
        expect(a).toBeCloseTo(linea + 4, 0);
        // B: lejos de la línea, queda 6 px sobre su punta
        expect(b).toBeCloseTo((5 / (20 * 1.12)) * alturaPlano + 6, 0);
    });
});

describe('BarrasPildora: cifras de columnas muy juntas (ResizeObserver)', () => {
    const muchas = (n, valor = 88.8) => Array.from({ length: n }, (_, i) => ({ d: `D${i + 1}`, v: valor }));
    const props = (n, valor) => ({ datos: muchas(n, valor), ejeX: 'd', series: [{ clave: 'v' }], unidad: ' %', dominio: [0, 100] });
    const medir = (ancho) => act(() => ObservadorTamano.instancias[0].medir(ancho));

    it('sin medida (servidor, primera pintura, sin ResizeObserver) las cifras llevan el tamaño normal', () => {
        const { container } = render(<BarrasPildora {...props(12)} />);
        expect(ObservadorTamano.instancias).toHaveLength(0);
        expect(cifrasDe(container)[0].style.fontSize).toBe('12px');
        expect(cifrasDe(container)[0]).toHaveTextContent('88.8 %');
    });

    it('con espacio de sobra se queda en 12 px con la unidad', () => {
        vi.stubGlobal('ResizeObserver', ObservadorTamano);
        const { container } = render(<BarrasPildora {...props(5)} />);
        medir(600);
        expect(cifrasDe(container)[0].style.fontSize).toBe('12px');
        expect(cifrasDe(container)[0]).toHaveTextContent('88.8 %');
    });

    it('si no caben con la unidad, se reducen o se abrevian (sin unidad) antes de solaparse', () => {
        vi.stubGlobal('ResizeObserver', ObservadorTamano);
        const { container } = render(<BarrasPildora {...props(12)} />);
        medir(320);
        const cifras = cifrasDe(container);
        expect(cifras).toHaveLength(12);
        expect(cifras[0].textContent).toBe('88.8');
        expect(parseFloat(cifras[0].style.fontSize)).toBeLessThan(12);
        expect(parseFloat(cifras[0].style.fontSize)).toBeGreaterThanOrEqual(9);
    });

    it('si ni abreviadas caben todas, se muestra una de cada varias; con muy poco ancho se omiten (siguen en el title)', () => {
        vi.stubGlobal('ResizeObserver', ObservadorTamano);
        const { container } = render(<BarrasPildora {...props(31, 88)} />);
        medir(320);
        const alternas = cifrasDe(container);
        expect(alternas.length).toBeGreaterThan(5);
        expect(alternas.length).toBeLessThan(31);
        expect(alternas[0].style.fontSize).toBe('9px');
        medir(60);
        expect(cifrasDe(container)).toHaveLength(0);
        expect(filasDe(container)[0]).toHaveAttribute('title', 'D1: 88 %');
        expect(listaLectores(container)).toHaveLength(31);
    });

    it('el aire entre columnas baja cuando hay muchas, para que quepan en 360 px', () => {
        vi.stubGlobal('ResizeObserver', ObservadorTamano);
        const { container } = render(<BarrasPildora {...props(30)} />);
        expect(container.querySelector('.absolute.inset-0.flex').style.columnGap).toBe('4px');
        const { container: c2 } = render(<BarrasPildora {...props(5)} />);
        expect(c2.querySelector('.absolute.inset-0.flex').style.columnGap).toBe('12px');
    });

    it('los nombres de categoría reducen su letra (10 px como mínimo) cuando la ranura es angosta y no cambian con espacio de sobra', () => {
        vi.stubGlobal('ResizeObserver', ObservadorTamano);
        const datos = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].map((d, i) => ({ d, v: 10 + i }));
        const { container } = render(<BarrasPildora datos={datos} ejeX="d" series={[{ clave: 'v' }]} />);
        const etiqueta = () => container.querySelector('.truncate[title="Miércoles"]');
        expect(etiqueta().style.fontSize).toBe('12px');
        medir(900);
        expect(etiqueta().style.fontSize).toBe('12px');
        medir(260);
        expect(parseFloat(etiqueta().style.fontSize)).toBeLessThan(12);
        expect(parseFloat(etiqueta().style.fontSize)).toBeGreaterThanOrEqual(10);
        // y el nombre completo sigue en el title aunque se corte
        expect(etiqueta()).toHaveAttribute('title', 'Miércoles');
    });

    it('en filas no mide el contenedor', () => {
        vi.stubGlobal('ResizeObserver', ObservadorTamano);
        render(<BarrasPildora {...props(5)} horizontal />);
        expect(ObservadorTamano.instancias).toHaveLength(0);
    });
});

describe('BarrasPildora: leyenda', () => {
    it('por defecto solo con varias series; se puede forzar o quitar', () => {
        const { rerender } = render(<BarrasPildora horizontal datos={RANKING} ejeX="alumno" series={[{ clave: 'faltas' }]} config={CONFIG_FALTAS} />);
        expect(screen.queryByText('Faltas equivalentes')).toBeNull();
        rerender(<BarrasPildora horizontal datos={RANKING} ejeX="alumno" series={[{ clave: 'faltas' }]} config={CONFIG_FALTAS} leyenda />);
        expect(screen.getByText('Faltas equivalentes')).toBeInTheDocument();
        rerender(<BarrasPildora horizontal apilado datos={GRUPOS} ejeX="grupo" series={SERIES_GRUPOS} config={CONFIG_GRUPOS} />);
        expect(screen.getByText('Con derecho')).toBeInTheDocument();
        expect(screen.getByText('Sin derecho')).toBeInTheDocument();
        rerender(<BarrasPildora horizontal apilado datos={GRUPOS} ejeX="grupo" series={SERIES_GRUPOS} config={CONFIG_GRUPOS} leyenda={false} />);
        expect(screen.queryByText('Con derecho')).toBeNull();
    });

    it('sin configuración usa la clave como nombre y el azul de gráfica', () => {
        const { container } = render(<BarrasPildora horizontal datos={[{ a: 'X', k: 3 }]} ejeX="a" series={[{ clave: 'k' }]} leyenda />);
        expect(screen.getByText('k')).toBeInTheDocument();
        expect(segmentosDe(container)[0].style.background).toContain('var(--g-azul)');
    });
});

describe('BarrasPildora: accesibilidad', () => {
    it('lo dibujado es aria-hidden y un texto oculto lista cada fila con todas sus series', () => {
        const { container } = render(<BarrasPildora horizontal apilado datos={GRUPOS} ejeX="grupo" series={SERIES_GRUPOS} config={CONFIG_GRUPOS} />);
        expect(container.querySelector('[aria-hidden="true"]')).toContainElement(filasDe(container)[0]);
        expect(listaLectores(container)).toEqual([
            '3A: Con derecho 22 · En el límite 1 · Sin derecho 1 · total 24',
            '5C: Con derecho 21 · En el límite 2 · Sin derecho 3 · total 26',
            '3B: Con derecho 24 · En el límite 0 · Sin derecho 0 · total 24',
        ]);
        expect(container.querySelector('[tabindex]')).toBeNull();
        expect(screen.queryByRole('img')).toBeNull();
    });

    it('en columnas pasa lo mismo y el límite se anuncia una sola vez', () => {
        const { container } = render(<BarrasPildora datos={SEMANA} ejeX="dia" series={[{ clave: 'ausentismo' }]} config={CONFIG_SEMANA} unidad=" %" limite={LIMITE} />);
        expect(container.querySelector('[aria-hidden="true"]')).toContainElement(filasDe(container)[0]);
        expect(listaLectores(container).slice(0, 2)).toEqual(['Lun: 14.9 %', 'Mar: 14.6 %']);
        expect(container.querySelector('[tabindex]')).toBeNull();
    });
});

describe('BarrasPildora: entrada y movimiento', () => {
    const base = { horizontal: true, datos: RANKING, ejeX: 'alumno', series: [{ clave: 'faltas' }], config: CONFIG_FALTAS, unidad: ' %' };
    const envoltura = (fila) => segmentosDe(fila)[0].parentElement;

    it('oculto antes de entrar en vista (igual que en el servidor) y se revela, escalonado, al intersectar', () => {
        vi.stubGlobal('IntersectionObserver', ObservadorFalso);
        const { container } = render(<BarrasPildora {...base} />);
        const filas = filasDe(container);
        expect(envoltura(filas[0]).style.clipPath).toBe('inset(0 100% 0 0 round 999px)');
        expect(cifrasDe(container)[0].style.opacity).toBe('0');
        act(() => ObservadorFalso.instancias[0].emitir(true));
        expect(envoltura(filas[0]).style.clipPath).toBe('inset(0 0 0 0 round 999px)');
        expect(envoltura(filas[2]).style.transition).toContain('120ms');
        expect(cifrasDe(container)[0].style.opacity).toBe('1');
    });

    it('con «reducir movimiento» todo se ve de inmediato, sin transiciones ni observador', () => {
        simularMatchMedia(true);
        vi.stubGlobal('IntersectionObserver', ObservadorFalso);
        const { container } = render(<BarrasPildora {...base} limite={LIMITE} />);
        expect(envoltura(filasDe(container)[0]).style.clipPath).toBe('inset(0 0 0 0 round 999px)');
        expect(segmentosDe(container).every((s) => s.style.transition === '')).toBe(true);
        expect(cifrasDe(container).every((c) => c.style.opacity === '1' && c.style.transition === '')).toBe(true);
        expect(ObservadorFalso.instancias).toHaveLength(0);
        // y lo mismo en columnas
        const { container: columnas } = render(<BarrasPildora datos={SEMANA} ejeX="dia" series={[{ clave: 'ausentismo' }]} />);
        expect(segmentosDe(columnas).every((s) => s.style.transition === '')).toBe(true);
        expect(cifrasDe(columnas).every((c) => c.style.opacity === '1' && c.style.transition === '')).toBe(true);
    });

    it('sin IntersectionObserver no se queda oculto', async () => {
        const { container } = render(<BarrasPildora {...base} />);
        await esperarEntrada();
        expect(envoltura(filasDe(container)[0]).style.clipPath).toBe('inset(0 0 0 0 round 999px)');
    });

    it('filas: al cambiar los datos NO reinicia la entrada y las barras se mueven con una transición de left/width propia', async () => {
        vi.stubGlobal('IntersectionObserver', ObservadorFalso);
        const { container, rerender } = render(<BarrasPildora {...base} dominio={[0, 100]} />);
        act(() => ObservadorFalso.instancias[0].emitir(true));
        const antes = segmentosDe(container);
        expect(pctDe(antes[0].style.width)).toBeCloseTo(26.7, 2);
        rerender(<BarrasPildora {...base} dominio={[0, 100]} datos={RANKING.map((r, i) => (i === 0 ? { ...r, faltas: 40 } : r))} />);
        const despues = segmentosDe(container);
        despues.forEach((s, i) => expect(s).toBe(antes[i]));
        expect(pctDe(despues[0].style.width)).toBeCloseTo(40, 2);
        expect(textos(cifrasDe(container))[0]).toBe('40 %');
        // la entrada queda hecha: el clip-path sigue abierto y la transición del segmento es aparte (no la incluye)
        expect(despues[0].parentElement.style.clipPath).toBe('inset(0 0 0 0 round 999px)');
        expect(despues[0].style.transition).toMatch(/left 0\.5s/);
        expect(despues[0].style.transition).toMatch(/width 0\.5s/);
        expect(despues[0].style.transition).not.toContain('clip-path');
        expect(despues[0].parentElement.style.transition).toContain('clip-path');
        expect(ObservadorFalso.instancias).toHaveLength(1);
    });

    it('columnas: al cambiar los datos la barra se mueve con bottom/height y la cifra sigue su punta', async () => {
        const { container, rerender } = render(<BarrasPildora datos={SEMANA} ejeX="dia" series={[{ clave: 'ausentismo' }]} dominio={[0, 100]} />);
        await esperarEntrada();
        const barra = segmentosDe(container)[0];
        const cifra = cifrasDe(container)[0];
        const antes = parseFloat(cifra.style.bottom);
        rerender(<BarrasPildora datos={SEMANA.map((d, i) => (i === 0 ? { ...d, ausentismo: 60 } : d))} ejeX="dia" series={[{ clave: 'ausentismo' }]} dominio={[0, 100]} />);
        expect(segmentosDe(container)[0]).toBe(barra);
        expect(cifrasDe(container)[0]).toBe(cifra);
        expect(pctDe(barra.style.height)).toBeCloseTo(60, 2);
        expect(parseFloat(cifra.style.bottom)).toBeGreaterThan(antes);
        expect(barra.style.transition).toMatch(/bottom 0\.5s/);
        expect(barra.style.transition).toMatch(/height 0\.5s/);
        expect(cifra.style.opacity).toBe('1');
    });

    it('una serie que pasa de sin dato a tener valor conserva su segmento y se desvanece en lugar de aparecer de golpe', async () => {
        const datos = (v) => [{ dia: 'Lun', normal: 10, critico: v }];
        const props = { ejeX: 'dia', series: [{ clave: 'normal' }, { clave: 'critico' }], apilado: true, dominio: [0, 100] };
        const { container, rerender } = render(<BarrasPildora {...props} datos={datos(null)} />);
        await esperarEntrada();
        const critico = segmentosDe(container)[1];
        expect(critico.style.opacity).toBe('0');
        rerender(<BarrasPildora {...props} datos={datos(30)} />);
        expect(segmentosDe(container)[1]).toBe(critico);
        expect(critico.style.opacity).toBe('1');
        expect(pctDe(critico.style.height)).toBeCloseTo(30, 2);
        expect(pctDe(critico.style.bottom)).toBeCloseTo(10, 2);
    });

    it('filas que cambian de orden o número se recomponen sin error y sin volver a ocultarse', async () => {
        const { container, rerender } = render(<BarrasPildora {...base} />);
        await esperarEntrada();
        rerender(<BarrasPildora {...base} datos={[RANKING[2], RANKING[0]]} />);
        expect(filasDe(container)).toHaveLength(2);
        expect(envoltura(filasDe(container)[0]).style.clipPath).toBe('inset(0 0 0 0 round 999px)');
        expect(textos(cifrasDe(container))).toEqual(['4 %', '26.7 %']);
    });
});

describe('BarrasPildora: contenedor e hidratación', () => {
    it('className va al contenedor, también sin datos y en las dos orientaciones', () => {
        const props = { datos: SEMANA, ejeX: 'dia', series: [{ clave: 'ausentismo' }], className: 'mi-clase' };
        const { container, rerender } = render(<BarrasPildora {...props} />);
        expect(container.firstChild).toHaveClass('mi-clase');
        rerender(<BarrasPildora {...props} horizontal />);
        expect(container.firstChild).toHaveClass('mi-clase');
        rerender(<BarrasPildora {...props} datos={[]} />);
        expect(container.firstChild).toHaveClass('mi-clase');
    });

    it('formatoValor también rige las cifras de las columnas', () => {
        const { container } = render(<BarrasPildora datos={[{ d: 'A', v: 3 }, { d: 'B', v: null }, { d: 'C', v: 5 }]} ejeX="d" series={[{ clave: 'v' }]} formatoValor={(v) => `${v} u.`} />);
        expect(textos(cifrasDe(container))).toEqual(['3 u.', '-', '5 u.']);
        expect(filasDe(container)[0]).toHaveAttribute('title', 'A: 3 u.');
    });

    it.each([
        ['columnas', {}],
        ['filas', { horizontal: true }],
        ['columnas apiladas con límite', { apilado: true, limite: LIMITE }],
    ])('el HTML del servidor se hidrata sin diferencias (%s)', async (_nombre, extra) => {
        const jsx = <BarrasPildora datos={GRUPOS} ejeX="grupo" series={SERIES_GRUPOS} config={CONFIG_GRUPOS} unidad=" %" {...extra} />;
        const anfitrion = document.createElement('div');
        anfitrion.innerHTML = renderToString(jsx);
        document.body.appendChild(anfitrion);
        // el HTML del servidor llega oculto: la entrada solo ocurre en el cliente, al entrar en vista
        expect(cifrasDe(anfitrion)[0].style.opacity).toBe('0');
        const errores = [];
        const consola = vi.spyOn(console, 'error').mockImplementation((...a) => errores.push(a.join(' ')));
        await act(async () => {
            hydrateRoot(anfitrion, jsx, { onRecoverableError: (e) => errores.push(String(e)) });
        });
        consola.mockRestore();
        expect(errores).toEqual([]);
        anfitrion.remove();
    });
});
