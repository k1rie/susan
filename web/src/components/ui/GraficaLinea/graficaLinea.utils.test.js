import { describe, expect, it } from 'vitest';
import { cajasSeSolapan } from '@/lib/graficasGeometria.js';
import { construirModelo, descripcionPorDefecto, estimarAnchoTexto, formaDeSerie, formatoNumero, prepararFilas, textoValor, valorSerie } from './graficaLinea.utils.js';

const pct = (v) => `${v} %`;
const SERIES = [
    { clave: 'observada', tipo: 'puntos', color: 'var(--foreground)', etiqueta: 'Observada' },
    { clave: 'ajuste', tipo: 'linea', color: 'var(--chart-1)', etiqueta: 'Ajuste' },
    { clave: 'proyeccion', tipo: 'linea', discontinua: true, color: 'var(--chart-1)', etiqueta: 'Proyección' },
    { clave: 'banda', tipo: 'banda', color: 'var(--chart-1)', etiqueta: 'Intervalo 95 %' },
];

function modeloDe(extra = {}) {
    const datos = extra.datos ?? [{ semana: 1, observada: 12 }, { semana: 2, observada: 18 }, { semana: 3, observada: 19.7 }];
    return construirModelo({
        filas: prepararFilas(datos, 'semana'),
        series: extra.series ?? SERIES,
        ejeX: 'semana',
        limite: extra.limite,
        marcaX: extra.marcaX,
        dominioY: extra.dominioY ?? [0, 'auto'],
        ancho: extra.ancho ?? 600,
        alto: extra.alto ?? 280,
        formatoX: (x) => `S${x}`,
        formatoY: pct,
        leyendaExplicaLimite: extra.leyendaExplicaLimite ?? true,
    });
}

describe('datos y textos', () => {
    it('prepararFilas descarta filas sin x numérico y ordena sin tocar la entrada', () => {
        const entrada = [{ x: 3 }, { x: 1 }, { x: null }, { y: 5 }, null, { x: 'a' }, { x: 2 }];
        expect(prepararFilas(entrada, 'x').map((f) => f.x)).toEqual([1, 2, 3]);
        expect(entrada[0].x).toBe(3);
        expect(prepararFilas(undefined, 'x')).toEqual([]);
    });
    it('valorSerie: número, hueco (null/undefined/NaN) y banda ordenada; una banda con un extremo nulo es un hueco', () => {
        expect(valorSerie({ a: 5 }, { clave: 'a', tipo: 'linea' })).toBe(5);
        expect(valorSerie({ a: null }, { clave: 'a', tipo: 'linea' })).toBeNull();
        expect(valorSerie({}, { clave: 'a', tipo: 'puntos' })).toBeNull();
        expect(valorSerie({ a: NaN }, { clave: 'a', tipo: 'linea' })).toBeNull();
        expect(valorSerie({ b: [9, 3] }, { clave: 'b', tipo: 'banda' })).toEqual([3, 9]);
        expect(valorSerie({ b: [null, 3] }, { clave: 'b', tipo: 'banda' })).toBeNull();
        expect(valorSerie({ b: 4 }, { clave: 'b', tipo: 'banda' })).toBeNull();
    });
    it('formaDeSerie distingue punto, línea, discontinua y banda', () => {
        expect(formaDeSerie({ tipo: 'puntos' })).toBe('punto');
        expect(formaDeSerie({ tipo: 'linea' })).toBe('linea');
        expect(formaDeSerie({ tipo: 'linea', discontinua: true })).toBe('discontinua');
        expect(formaDeSerie({ tipo: 'banda' })).toBe('banda');
        expect(formaDeSerie({})).toBe('linea');
    });
    it('textoValor: número, rango de banda y guion en huecos', () => {
        expect(textoValor(12.5, pct)).toBe('12.5 %');
        expect(textoValor([10, 15], pct)).toBe('10 % a 15 %');
        expect(textoValor(null, pct)).toBe('-');
        expect(textoValor(undefined, pct)).toBe('-');
    });
    it('descripcionPorDefecto omite los huecos y avisa si no hay ningún valor', () => {
        const fila = { semana: 2, observada: 18, ajuste: null, banda: [10, 20] };
        expect(descripcionPorDefecto({ fila, titulo: 'S2', series: SERIES, formatoY: pct })).toBe('S2. Observada: 18 %; Intervalo 95 %: 10 % a 20 %');
        expect(descripcionPorDefecto({ fila: { semana: 9 }, titulo: 'S9', series: SERIES, formatoY: pct })).toBe('S9. Sin valores.');
    });
    it('formatoNumero usa es-MX con hasta 2 decimales', () => {
        expect(formatoNumero(19.7)).toBe('19.7');
        expect(formatoNumero(1 / 3)).toBe('0.33');
    });
});

describe('construirModelo', () => {
    it('sin filas o sin ancho medido no hay modelo', () => {
        expect(modeloDe({ datos: [] })).toBeNull();
        expect(modeloDe({ ancho: 0 })).toBeNull();
    });
    it('el dominio Y incluye el límite aunque los datos sean menores, y su línea queda dentro del trazado', () => {
        const m = modeloDe({ datos: [{ semana: 1, observada: 3 }, { semana: 2, observada: 8 }], limite: { valor: 20, etiqueta: 'Límite 20 %' } });
        expect(m.dom[1]).toBeGreaterThanOrEqual(20);
        expect(m.limite.y).toBeGreaterThanOrEqual(m.arriba);
        expect(m.limite.y).toBeLessThanOrEqual(m.abajo);
        // y las marcas del eje llegan hasta 20
        expect(m.marcasY.map((t) => t.valor)).toContain(20);
    });
    it('con tope automático, un dato por debajo del mínimo amplía el dominio y nada se dibuja bajo la línea base', () => {
        const datos = [{ semana: 1, ajuste: -3 }, { semana: 2, ajuste: 5 }, { semana: 3, ajuste: 12 }];
        const m = modeloDe({ datos, series: [SERIES[1]], dominioY: [0, 'auto'] });
        expect(m.dom[0]).toBe(-3);
        expect(m.series[0].puntos.every((p) => p.y <= m.abajo)).toBe(true);
        // el punto más bajo cae exactamente sobre la línea base y las marcas del eje siguen dentro del trazado
        expect(m.series[0].puntos[0].y).toBeCloseTo(m.abajo, 5);
        expect(m.marcasY.every((t) => t.y <= m.abajo && t.y >= m.arriba)).toBe(true);
    });
    it('la banda de una proyección que baja de 0 tampoco se sale por debajo del eje', () => {
        const datos = [{ semana: 1, banda: [-0.6, 2] }, { semana: 2, banda: [1, 4] }];
        const m = modeloDe({ datos, series: [SERIES[3]] });
        expect(m.dom[0]).toBe(-0.6);
        expect(m.series[0].puntos.every((p) => p.yInf <= m.abajo && p.ySup <= m.abajo)).toBe(true);
    });
    it('con un dominio fijado en ambos extremos el comportamiento no cambia: se respeta aunque dejen datos fuera', () => {
        const datos = [{ semana: 1, ajuste: -3 }, { semana: 2, ajuste: 50 }];
        const m = modeloDe({ datos, series: [SERIES[1]], dominioY: [0, 100] });
        expect(m.dom).toEqual([0, 100]);
        // el dato negativo queda fuera del trazado (no se falsea apilándolo en el borde)
        expect(m.series[0].puntos[0].y).toBeGreaterThan(m.abajo);
    });
    it('sin dato por debajo del mínimo el dominio automático no cambia', () => {
        const m = modeloDe({ dominioY: [0, 'auto'] });
        expect(m.dom[0]).toBe(0);
    });
    it('un dominio fijo que dejaba el límite fuera se amplía', () => {
        const m = modeloDe({ dominioY: [0, 10], limite: { valor: 20 } });
        expect(m.dom[1]).toBeGreaterThanOrEqual(20);
    });
    it('caso límite 20 % y último punto 19.7 %: la etiqueta del límite no pisa el punto ni el borde', () => {
        const m = modeloDe({ limite: { valor: 20, etiqueta: 'Límite 20 %' } });
        expect(m.limite.caja).not.toBeNull();
        const ultimo = m.series[0].puntos.at(-1);
        // el punto (radio 4 + aro de 2) y su aro quedan a la izquierda del margen reservado a la etiqueta
        const punto = { x: ultimo.x - 6, y: ultimo.y - 6, width: 12, height: 12 };
        expect(cajasSeSolapan(m.limite.caja, punto, 4)).toBe(false);
        expect(m.limite.caja.x).toBeGreaterThanOrEqual(m.der);
        expect(m.limite.caja.x + m.limite.caja.width).toBeLessThanOrEqual(m.ancho);
        // y la línea del límite está a 3 px del punto: justo la cercanía que antes hacía chocar la etiqueta
        expect(Math.abs(m.limite.y - ultimo.y)).toBeLessThan(6);
    });
    it('en ancho angosto la etiqueta del límite pasa a la leyenda; si la leyenda no la explica, se queda dentro', () => {
        const angosto = modeloDe({ ancho: 300, limite: { valor: 20, etiqueta: 'Límite 20 %' } });
        expect(angosto.limite.caja).toBeNull();
        expect(angosto.limiteEnLeyenda).toBe(true);
        const forzada = modeloDe({ ancho: 300, limite: { valor: 20, etiqueta: 'Límite 20 %' }, leyendaExplicaLimite: false });
        expect(forzada.limite.caja).not.toBeNull();
        expect(forzada.limiteEnLeyenda).toBe(false);
        const ancho = modeloDe({ ancho: 700, limite: { valor: 20, etiqueta: 'Límite 20 %' } });
        expect(ancho.limiteEnLeyenda).toBe(false);
    });
    it('sin etiqueta no hay caja ni entrada de leyenda, pero la línea del límite existe', () => {
        const m = modeloDe({ limite: { valor: 20 } });
        expect(m.limite.caja).toBeNull();
        expect(m.limiteEnLeyenda).toBe(false);
    });
    it('la marca vertical entra en el dominio X y su etiqueta no se sale del lienzo ni pisa la del límite', () => {
        const m = modeloDe({ datos: [{ semana: 1, observada: 5 }, { semana: 4, observada: 6 }], marcaX: { valor: 8, etiqueta: 'S8' }, limite: { valor: 20, etiqueta: 'Límite 20 %' } });
        expect(m.marca.x).toBeCloseTo(m.xFin, 5); // la marca es el extremo derecho del dominio X
        expect(m.marca.caja.x).toBeGreaterThanOrEqual(0);
        expect(m.marca.caja.x + m.marca.caja.width).toBeLessThanOrEqual(m.ancho);
        expect(cajasSeSolapan(m.marca.caja, m.limite.caja)).toBe(false);
    });
    it('un límite pegado al tope del dominio tampoco roza la etiqueta de la marca', () => {
        const m = modeloDe({ dominioY: [0, 20], marcaX: { valor: 3, etiqueta: 'S3' }, limite: { valor: 20, etiqueta: 'Límite 20 %' } });
        expect(cajasSeSolapan(m.marca.caja, m.limite.caja)).toBe(false);
    });
    it('los huecos se unen por encima: los puntos de la serie son solo los valores presentes', () => {
        const datos = [{ semana: 1, ajuste: 1 }, { semana: 2, ajuste: null }, { semana: 3 }, { semana: 4, ajuste: 4 }];
        const m = modeloDe({ datos, series: [SERIES[1]] });
        expect(m.series[0].puntos.map((p) => p.indice)).toEqual([0, 3]);
        expect(m.series[0].trazo.match(/M/g)).toHaveLength(1);
        expect(m.series[0].trazo.match(/L/g)).toHaveLength(1);
    });
    it('las líneas son rectas entre datos: el trazo no tiene curvas', () => {
        const m = modeloDe({ datos: [{ semana: 1, ajuste: 1 }, { semana: 2, ajuste: 9 }, { semana: 3, ajuste: 2 }], series: [SERIES[1]] });
        expect(m.series[0].trazo).not.toMatch(/[CQSA]/);
    });
    it('la banda cierra el polígono y su borde superior queda sobre el inferior', () => {
        const datos = [{ semana: 1, banda: [10, 14] }, { semana: 2, banda: [11, 16] }];
        const m = modeloDe({ datos, series: [SERIES[3]] });
        const [a, b] = m.series[0].puntos;
        expect(m.series[0].trazo.endsWith('Z')).toBe(true);
        expect(a.ySup).toBeLessThan(a.yInf);
        expect(b.ySup).toBeLessThan(b.yInf);
    });
    it('las marcas del eje X se adelgazan con muchas semanas pero conservan la primera y la última', () => {
        const datos = Array.from({ length: 30 }, (_, i) => ({ semana: i + 1, observada: i }));
        const m = modeloDe({ datos, ancho: 340 });
        expect(m.marcasX.length).toBeLessThan(30);
        expect(m.marcasX[0].texto).toBe('S1');
        expect(m.marcasX.at(-1).texto).toBe('S30');
        for (let i = 1; i < m.marcasX.length; i += 1) expect(m.marcasX[i].x - m.marcasX[i - 1].x).toBeGreaterThanOrEqual(estimarAnchoTexto('S30'));
    });
    it('a 360 px el eje Y ocupa lo mínimo y nada se sale del lienzo', () => {
        const m = modeloDe({ ancho: 300, datos: Array.from({ length: 12 }, (_, i) => ({ semana: i + 1, observada: i * 2 })), limite: { valor: 20 } });
        expect(m.izq).toBeLessThan(60);
        expect(m.series[0].puntos.every((p) => p.x >= m.izq && p.x <= m.ancho)).toBe(true);
        expect(m.marcasX.every((t) => t.x >= 0 && t.x <= m.ancho)).toBe(true);
    });
    it('un solo valor de x queda centrado y una sola fila no rompe nada', () => {
        const m = modeloDe({ datos: [{ semana: 5, observada: 7 }] });
        expect(m.posiciones).toHaveLength(1);
        expect(m.posiciones[0]).toBeCloseTo((m.xIni + m.xFin) / 2, 5);
        expect(Number.isFinite(m.series[0].puntos[0].y)).toBe(true);
    });
    it('colores: tokens traducidos con colorGrafica, sin hex', () => {
        const m = modeloDe();
        expect(m.series[1].color).toBe('var(--g-azul)');
        expect(m.series.every((s) => !s.color.startsWith('#'))).toBe(true);
    });
});
