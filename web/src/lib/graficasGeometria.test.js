import { describe, expect, it } from 'vitest';
import {
    adelgazarMarcas,
    arcosAnillo,
    cajaEtiquetaLimite,
    cajaEtiquetaMarca,
    cajasSeSolapan,
    dominioAuto,
    dominioConLimite,
    dominioFinal,
    fraccionEnDominio,
    indiceMasCercano,
    posicionTooltip,
    puntosSerie,
    ticksAmigables,
    trazoBanda,
    trazoPoligonal,
    trazoSuave,
} from './graficasGeometria.js';
import { colorGrafica } from './graficas.js';

describe('arcosAnillo', () => {
    it('reparte la circunferencia en proporción, con hueco entre segmentos y sin los de valor 0', () => {
        const a = arcosAnillo([{ clave: 'a', valor: 3 }, { clave: 'b', valor: 0 }, { clave: 'c', valor: 1 }], 100, 4);
        expect(a.map((x) => x.clave)).toEqual(['a', 'c']);
        expect(a[0].fraccion).toBe(0.75);
        expect(a[0].largo).toBe(71); // 75 - hueco
        expect(a[0].inicio).toBe(2); // medio hueco
        expect(a[1].inicio).toBe(77); // 75 + medio hueco
        expect(a[1].largo).toBe(21);
    });
    it('un solo segmento ocupa todo sin hueco; sin datos válidos -> []', () => {
        const [uno] = arcosAnillo([{ clave: 'a', valor: 5 }], 100, 8);
        expect(uno.largo).toBe(100);
        expect(uno.inicio).toBe(0);
        expect(arcosAnillo([], 100, 4)).toEqual([]);
        expect(arcosAnillo([{ clave: 'a', valor: 0 }], 100, 4)).toEqual([]);
        expect(arcosAnillo(undefined, 100, 4)).toEqual([]);
    });
    it('un segmento menor que el hueco nunca tiene largo <= 0', () => {
        const a = arcosAnillo([{ clave: 'a', valor: 1000 }, { clave: 'b', valor: 1 }], 100, 10);
        expect(a[1].largo).toBeGreaterThan(0);
    });
});

describe('dominios y escala', () => {
    it('fraccionEnDominio recorta y tolera dominios o valores inválidos', () => {
        expect(fraccionEnDominio(5, [0, 10])).toBe(0.5);
        expect(fraccionEnDominio(-3, [0, 10])).toBe(0);
        expect(fraccionEnDominio(99, [0, 10])).toBe(1);
        expect(fraccionEnDominio('x', [0, 10])).toBe(0);
        expect(fraccionEnDominio(5, [10, 10])).toBe(0);
    });
    it('dominioAuto incluye el límite y deja holgura', () => {
        expect(dominioAuto([5, 8], 20)[1]).toBeCloseTo(22.4, 5);
        expect(dominioAuto([30], 20)[1]).toBeCloseTo(33.6, 5);
        expect(dominioAuto([], null)).toEqual([0, 1]);
    });
    it('dominioFinal respeta uno válido, completa [0,"auto"] y cae al automático', () => {
        expect(dominioFinal([0, 100], [5], 20)).toEqual([0, 100]);
        expect(dominioFinal([0, 'auto'], [50], null)[1]).toBeCloseTo(56, 5);
        expect(dominioFinal(undefined, [10], null)[1]).toBeCloseTo(11.2, 5);
        expect(dominioFinal([5, 5], [10], null)[0]).toBe(0);
    });
});

describe('trazos de serie', () => {
    it('trazoSuave: vacío, un punto y una curva que pasa por todos los puntos', () => {
        expect(trazoSuave([])).toBe('');
        expect(trazoSuave([[1, 2]])).toBe('M1 2');
        const d = trazoSuave([[0, 10], [10, 0], [20, 5]]);
        expect(d.startsWith('M0 10')).toBe(true);
        expect(d.match(/C/g)).toHaveLength(2);
        expect(d.endsWith('20 5')).toBe(true);
    });
    it('trazoSuave no se pasa de los datos (monótona): con puntos planos las tangentes son 0', () => {
        const d = trazoSuave([[0, 5], [10, 5], [20, 5]]);
        expect(d).toBe('M0 5 C3.33 5 6.67 5 10 5 C13.33 5 16.67 5 20 5');
    });
    it('puntosSerie escala a y invertida con margen; un solo valor queda a la izquierda', () => {
        const p = puntosSerie([0, 10], 100, 50, { margen: 0 });
        expect(p).toEqual([[0, 50], [100, 0]]);
        expect(puntosSerie([5], 100, 50)[0][0]).toBe(2);
        expect(puntosSerie([], 100, 50)).toEqual([]);
        expect(puntosSerie([3, 3, 3], 100, 50, { margen: 0 }).every((q) => Number.isFinite(q[1]))).toBe(true);
    });
});

describe('colorGrafica', () => {
    it('traduce los tokens de texto a los de gráfica y deja pasar el resto', () => {
        expect(colorGrafica('var(--ausente)')).toBe('var(--g-ausente)');
        expect(colorGrafica('var(--chart-1)')).toBe('var(--g-azul)');
        expect(colorGrafica('var(--g-presente)')).toBe('var(--g-presente)');
        expect(colorGrafica('red')).toBe('red');
    });
});

describe('ticksAmigables', () => {
    it('da marcas redondas dentro del rango, con el paso más cercano al ideal', () => {
        expect(ticksAmigables(0, 22.4, 5)).toEqual([0, 5, 10, 15, 20]);
        expect(ticksAmigables(0, 11.2, 5)).toEqual([0, 2, 4, 6, 8, 10]);
        expect(ticksAmigables(0, 56, 5)).toEqual([0, 10, 20, 30, 40, 50]);
        expect(ticksAmigables(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
        expect(ticksAmigables(3, 17, 4)).toEqual([5, 10, 15]);
    });
    it('no arrastra error de coma flotante con pasos decimales', () => {
        const marcas = ticksAmigables(0, 0.9, 4);
        expect(marcas).toEqual([0, 0.2, 0.4, 0.6, 0.8]);
        expect(ticksAmigables(0, 0.03, 4)).toEqual([0, 0.01, 0.02, 0.03]);
    });
    it('soporta rangos grandes y negativos, y es estrictamente creciente', () => {
        expect(ticksAmigables(0, 1200, 5)).toEqual([0, 200, 400, 600, 800, 1000, 1200]);
        expect(ticksAmigables(0, 2000, 5)).toEqual([0, 500, 1000, 1500, 2000]);
        expect(ticksAmigables(-10, 10, 5)).toEqual([-10, -5, 0, 5, 10]);
        const m = ticksAmigables(0, 97.3, 6);
        expect(m.every((v, i) => i === 0 || v > m[i - 1])).toBe(true);
        expect(m.every((v) => v >= 0 && v <= 97.3)).toBe(true);
    });
    it('rango vacío o entradas inválidas', () => {
        expect(ticksAmigables(5, 5)).toEqual([5]);
        expect(ticksAmigables(8, 2)).toEqual([8]);
        expect(ticksAmigables(NaN, 3)).toEqual([]);
        expect(ticksAmigables(0, Infinity)).toEqual([]);
        expect(ticksAmigables(0, 10, 0).length).toBeGreaterThan(0);
    });
});

describe('adelgazarMarcas', () => {
    const cada = (n, paso) => Array.from({ length: n }, (_, i) => i * paso);
    it('si caben todas, las deja todas', () => {
        expect(adelgazarMarcas(cada(5, 50), 30)).toEqual([0, 1, 2, 3, 4]);
        expect(adelgazarMarcas([], 30)).toEqual([]);
        expect(adelgazarMarcas([10], 30)).toEqual([0]);
        expect(adelgazarMarcas([10, 11], 30)).toEqual([0, 1]);
    });
    it('siempre conserva la primera y la última, con paso regular y sin pisarse', () => {
        const pos = cada(12, 20);
        const idx = adelgazarMarcas(pos, 30);
        expect(idx[0]).toBe(0);
        expect(idx[idx.length - 1]).toBe(11);
        expect(idx).toEqual([0, 2, 4, 6, 8, 11]);
        expect(idx.every((v, k) => k === 0 || pos[v] - pos[idx[k - 1]] >= 30)).toBe(true);
    });
    it('si ni así caben, deja solo los extremos', () => {
        expect(adelgazarMarcas(cada(6, 5), 100)).toEqual([0, 5]);
    });
});

describe('indiceMasCercano', () => {
    it('elige la posición más cercana, a la izquierda en empates, y -1 sin posiciones', () => {
        const pos = [10, 50, 90];
        expect(indiceMasCercano(pos, 0)).toBe(0);
        expect(indiceMasCercano(pos, 48)).toBe(1);
        expect(indiceMasCercano(pos, 70)).toBe(1);
        expect(indiceMasCercano(pos, 71)).toBe(2);
        expect(indiceMasCercano(pos, 500)).toBe(2);
        expect(indiceMasCercano([], 5)).toBe(-1);
        expect(indiceMasCercano(undefined, 5)).toBe(-1);
    });
});

describe('trazos rectos', () => {
    it('trazoPoligonal une con segmentos rectos y redondea a 2 decimales', () => {
        expect(trazoPoligonal([[0, 10], [10.456, 5], [20, 7.004]])).toBe('M0 10 L10.46 5 L20 7');
        expect(trazoPoligonal([[1, 2]])).toBe('M1 2');
        expect(trazoPoligonal([])).toBe('');
        expect(trazoPoligonal(undefined)).toBe('');
    });
    it('trazoBanda recorre el borde superior y regresa por el inferior; con menos de 2 puntos o largos distintos no hay banda', () => {
        expect(trazoBanda([[0, 2], [10, 1]], [[0, 8], [10, 9]])).toBe('M0 2 L10 1 L10 9 L0 8 Z');
        expect(trazoBanda([[0, 2]], [[0, 8]])).toBe('');
        expect(trazoBanda([[0, 2], [10, 1]], [[0, 8]])).toBe('');
        expect(trazoBanda(undefined, undefined)).toBe('');
    });
});

describe('dominioConLimite', () => {
    it('el dominio automático ya incluye el límite aunque los datos sean menores', () => {
        const [a, b] = dominioConLimite([0, 'auto'], [3, 5, 7], 20);
        expect(a).toBe(0);
        expect(b).toBeGreaterThanOrEqual(20);
    });
    it('amplía un dominio numérico que dejaba el límite fuera y respeta uno que ya lo contiene', () => {
        expect(dominioConLimite([0, 10], [3], 20)[1]).toBeCloseTo(22.4, 5);
        expect(dominioConLimite([0, 100], [3], 20)).toEqual([0, 100]);
        expect(dominioConLimite([5, 10], [6], 2)[0]).toBeLessThanOrEqual(2);
    });
    it('un mínimo mayor que el tope automático no invierte el rango', () => {
        const [a, b] = dominioConLimite([5, 'auto'], [1, 2], undefined);
        expect(a).toBe(5);
        expect(b).toBeGreaterThan(a);
    });
    it('sin límite se comporta como dominioFinal', () => {
        expect(dominioConLimite([0, 'auto'], [50], undefined)).toEqual(dominioFinal([0, 'auto'], [50], undefined));
        expect(dominioConLimite(undefined, [], null)).toEqual([0, 1]);
    });
});

describe('posicionTooltip', () => {
    const base = { x: 100, y: 10, ancho: 400, alto: 280, anchoTooltip: 150, altoTooltip: 100 };
    it('a la derecha de la guía cuando cabe', () => {
        expect(posicionTooltip(base)).toEqual({ left: 114, top: 10, lado: 'derecha' });
    });
    it('se voltea a la izquierda cerca del borde derecho', () => {
        const p = posicionTooltip({ ...base, x: 350 });
        expect(p.lado).toBe('izquierda');
        expect(p.left).toBe(350 - 14 - 150);
    });
    it('nunca se sale del contenedor, ni cuando es más grande que él', () => {
        const justo = posicionTooltip({ ...base, x: 5, anchoTooltip: 390 });
        expect(justo.left).toBeGreaterThanOrEqual(4);
        expect(justo.left + 390).toBeLessThanOrEqual(400 - 4 + 1e-9);
        const enorme = posicionTooltip({ ...base, anchoTooltip: 900, altoTooltip: 900 });
        expect(enorme.left).toBe(4);
        expect(enorme.top).toBe(4);
        expect(posicionTooltip({ ...base, y: 250 }).top).toBe(280 - 100 - 4);
        expect(posicionTooltip({ ...base, y: -30 }).top).toBe(4);
    });
});

describe('etiquetas del límite y de la marca', () => {
    it('la etiqueta del límite queda pegada al borde derecho, centrada en la línea y dentro del lienzo', () => {
        expect(cajaEtiquetaLimite({ y: 100, anchoEtiqueta: 80, altoEtiqueta: 20, anchoTotal: 600, altoTotal: 280 })).toEqual({ x: 518, y: 90, width: 80, height: 20 });
        expect(cajaEtiquetaLimite({ y: 3, anchoEtiqueta: 80, altoEtiqueta: 20, anchoTotal: 600, altoTotal: 280 }).y).toBe(0);
        expect(cajaEtiquetaLimite({ y: 279, anchoEtiqueta: 80, altoEtiqueta: 20, anchoTotal: 600, altoTotal: 280 }).y).toBe(260);
    });
    it('la etiqueta de la marca se centra en x pero no se sale por los lados', () => {
        expect(cajaEtiquetaMarca({ x: 100, anchoEtiqueta: 40, altoEtiqueta: 20, anchoTotal: 500 })).toEqual({ x: 80, y: 0, width: 40, height: 20 });
        expect(cajaEtiquetaMarca({ x: 5, anchoEtiqueta: 40, altoEtiqueta: 20, anchoTotal: 500 }).x).toBe(0);
        expect(cajaEtiquetaMarca({ x: 495, anchoEtiqueta: 40, altoEtiqueta: 20, anchoTotal: 500 }).x).toBe(460);
    });
    it('cajasSeSolapan: pisarse sí, rozarse no, con holgura exigida', () => {
        const a = { x: 0, y: 0, width: 10, height: 10 };
        expect(cajasSeSolapan(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
        expect(cajasSeSolapan(a, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
        expect(cajasSeSolapan(a, { x: 12, y: 0, width: 10, height: 10 }, 4)).toBe(true);
        expect(cajasSeSolapan(a, { x: 20, y: 0, width: 10, height: 10 }, 4)).toBe(false);
    });
});
