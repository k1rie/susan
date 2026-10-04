import { describe, expect, it } from 'vitest';
import { anchoTextoEm } from '@/lib/graficas.js';
import {
    alturaPlano,
    ALTO_CIFRA,
    anchoColumnaValor,
    anchoGrupoMaximo,
    armarFilas,
    detalleFila,
    estiloSegmento,
    fuenteEtiquetas,
    hayDatos,
    MARGEN_LINEA,
    pasoEntreCifras,
    pistasDeFila,
    planCifras,
    posicionCifra,
    ranuraCategoria,
    separacionColumnas,
    tramosDePista,
    valorSerie,
} from './barrasPildora.utils.js';

describe('valorSerie', () => {
    it('devuelve el número, recorta negativos a 0 y distingue «sin dato» (null) de un 0 real', () => {
        expect(valorSerie({ v: 5 }, 'v')).toBe(5);
        expect(valorSerie({ v: '5.5' }, 'v')).toBe(5.5);
        expect(valorSerie({ v: 0 }, 'v')).toBe(0);
        expect(valorSerie({ v: -3 }, 'v')).toBe(0);
        for (const v of [null, undefined, '', 'x', NaN, Infinity, true]) expect(valorSerie({ v }, 'v')).toBeNull();
        expect(valorSerie({}, 'v')).toBeNull();
        expect(valorSerie(undefined, 'v')).toBeNull();
    });
});

describe('armarFilas / hayDatos / pistasDeFila', () => {
    const series = [{ clave: 'a' }, { clave: 'b' }];

    it('el total es la suma si se apila y el mayor si no; null si ninguna serie tiene dato', () => {
        const datos = [{ g: 'X', a: 3, b: 4 }, { g: 'Y', a: null, b: 2 }, { g: 'Z', a: null, b: undefined }, { g: 7, a: -1, b: 1 }];
        const apiladas = armarFilas({ datos, ejeX: 'g', series, apilado: true });
        expect(apiladas.map((f) => f.total)).toEqual([7, 2, null, 1]);
        const sueltas = armarFilas({ datos, ejeX: 'g', series, apilado: false });
        expect(sueltas.map((f) => f.total)).toEqual([4, 2, null, 1]);
        expect(apiladas[0].partes).toEqual([{ clave: 'a', valor: 3 }, { clave: 'b', valor: 4 }]);
        expect(apiladas[3].etiqueta).toBe('7');
        expect(armarFilas({ datos: undefined, ejeX: 'g', series, apilado: false })).toEqual([]);
    });

    it('la etiqueta ausente queda como texto vacío', () => {
        expect(armarFilas({ datos: [{ a: 1 }], ejeX: 'g', series: [{ clave: 'a' }], apilado: false })[0].etiqueta).toBe('');
    });

    it('hayDatos es falso solo si todas las filas están sin dato (un 0 sí es dato)', () => {
        expect(hayDatos(armarFilas({ datos: [{ a: null }], ejeX: 'g', series: [{ clave: 'a' }], apilado: false }))).toBe(false);
        expect(hayDatos(armarFilas({ datos: [{ a: 0 }], ejeX: 'g', series: [{ clave: 'a' }], apilado: false }))).toBe(true);
        expect(hayDatos([])).toBe(false);
    });

    it('pistasDeFila: una pista si se apila o hay una serie; una por serie si no', () => {
        const fila = armarFilas({ datos: [{ g: 'X', a: 3, b: null }], ejeX: 'g', series, apilado: false })[0];
        const separadas = pistasDeFila(fila, false);
        expect(separadas).toEqual([
            { clave: 'a', partes: [{ clave: 'a', valor: 3 }], cifra: 3 },
            { clave: 'b', partes: [{ clave: 'b', valor: null }], cifra: null },
        ]);
        const apilada = pistasDeFila(fila, true);
        expect(apilada).toHaveLength(1);
        expect(apilada[0].partes).toHaveLength(2);
        expect(apilada[0].cifra).toBe(3);
        const unica = armarFilas({ datos: [{ g: 'X', a: 3 }], ejeX: 'g', series: [{ clave: 'a' }], apilado: false })[0];
        expect(pistasDeFila(unica, false)).toHaveLength(1);
        expect(pistasDeFila(unica, false)[0].clave).toBe('a');
    });
});

describe('tramosDePista', () => {
    const partes = [{ clave: 'a', valor: 20 }, { clave: 'b', valor: 30 }];

    it('apilado: cada segmento empieza donde termina el anterior', () => {
        const [a, b] = tramosDePista(partes, [0, 100], true);
        expect(a).toMatchObject({ inicio: 0, dibujar: true });
        expect(a.largo).toBeCloseTo(0.2, 10);
        expect(b.inicio).toBeCloseTo(0.2, 10);
        expect(b.largo).toBeCloseTo(0.3, 10);
    });

    it('sin apilar: todos parten de la base', () => {
        const [a, b] = tramosDePista(partes, [0, 100], false);
        expect(a.inicio).toBe(0);
        expect(b.inicio).toBe(0);
        expect(b.largo).toBeCloseTo(0.3, 10);
    });

    it('un dominio con mínimo mayor que 0 o negativo mide desde su propio origen', () => {
        const [alto] = tramosDePista([{ clave: 'a', valor: 70 }], [50, 100], false);
        expect(alto.inicio).toBe(0);
        expect(alto.largo).toBeCloseTo(0.4, 10);
        // un valor por debajo del mínimo queda fuera de la escala y no se dibuja
        expect(tramosDePista([{ clave: 'a', valor: 30 }], [50, 100], false)[0].dibujar).toBe(false);
        const [neg] = tramosDePista([{ clave: 'a', valor: 20 }], [-10, 50], false);
        expect(neg.inicio).toBeCloseTo(10 / 60, 10);
        expect(neg.largo).toBeCloseTo(20 / 60, 10);
    });

    it('lo que rebasa el máximo se recorta y un segmento enteramente fuera no se dibuja', () => {
        const [, b] = tramosDePista([{ clave: 'a', valor: 80 }, { clave: 'b', valor: 50 }], [0, 100], true);
        expect(b.inicio).toBeCloseTo(0.8, 10);
        expect(b.largo).toBeCloseTo(0.2, 10);
        const [, fuera] = tramosDePista([{ clave: 'a', valor: 100 }, { clave: 'b', valor: 20 }], [0, 100], true);
        expect(fuera.dibujar).toBe(false);
    });

    it('null y 0 no se dibujan pero conservan su entrada', () => {
        const tramos = tramosDePista([{ clave: 'a', valor: null }, { clave: 'b', valor: 0 }, { clave: 'c', valor: 5 }], [0, 10], true);
        expect(tramos.map((t) => t.dibujar)).toEqual([false, false, true]);
        expect(tramos[2].inicio).toBe(0);
        expect(tramos).toHaveLength(3);
    });

    it('un valor minúsculo sigue marcado como dibujable (el mínimo de 4 px lo hace visible)', () => {
        expect(tramosDePista([{ clave: 'a', valor: 0.001 }], [0, 100], false)[0].dibujar).toBe(true);
    });
});

describe('estiloSegmento', () => {
    const tramo = { clave: 'a', valor: 5, inicio: 0.2, largo: 0.3, dibujar: true };

    it('filas: left/width con 1 px de margen por lado y mínimo de 4 px', () => {
        expect(estiloSegmento(tramo, true)).toEqual({ left: 'calc(20% + 1px)', width: 'calc(30% - 2px)', minWidth: 4, top: 0, bottom: 0, opacity: 1 });
    });

    it('columnas: bottom/height', () => {
        expect(estiloSegmento(tramo, false)).toEqual({ bottom: 'calc(20% + 1px)', height: 'calc(30% - 2px)', minHeight: 4, left: 0, right: 0, opacity: 1 });
    });

    it('un segmento sin dibujar queda colapsado e invisible', () => {
        const s = estiloSegmento({ ...tramo, dibujar: false }, true);
        expect(s).toMatchObject({ width: '0px', minWidth: 0, opacity: 0 });
        expect(estiloSegmento({ ...tramo, dibujar: false }, false)).toMatchObject({ height: '0px', minHeight: 0, opacity: 0 });
    });
});

describe('medidas de las columnas', () => {
    it('alturaPlano resta los márgenes de cifras y categorías', () => {
        expect(alturaPlano(260)).toBe(208);
        expect(alturaPlano(30)).toBe(0);
        expect(alturaPlano(undefined)).toBe(208);
    });

    it('separacionColumnas baja con muchas columnas', () => {
        expect(separacionColumnas(5)).toBe(12);
        expect(separacionColumnas(8)).toBe(12);
        expect(separacionColumnas(9)).toBe(8);
        expect(separacionColumnas(16)).toBe(8);
        expect(separacionColumnas(31)).toBe(4);
    });

    it('anchoGrupoMaximo: 48 px con una barra y 28 px por barra (más separación) con varias', () => {
        expect(anchoGrupoMaximo(1)).toBe(48);
        expect(anchoGrupoMaximo(2)).toBe(60);
        expect(anchoGrupoMaximo(3)).toBe(92);
    });

    it('pasoEntreCifras: centro a centro con una barra; entre barras de un grupo con varias; null sin medida', () => {
        expect(pasoEntreCifras({ ancho: 300, categorias: 5, barras: 1 })).toBeCloseTo(62.4, 5);
        expect(pasoEntreCifras({ ancho: 300, categorias: 5, barras: 2 })).toBeCloseTo((50.4 * 0.76 - 4) / 2 + 4, 5);
        expect(pasoEntreCifras({ ancho: 320, categorias: 31, barras: 1 })).toBeCloseTo(10.45, 1);
        expect(pasoEntreCifras({ ancho: null, categorias: 5, barras: 1 })).toBeNull();
        expect(pasoEntreCifras({ ancho: 0, categorias: 5, barras: 1 })).toBeNull();
        expect(pasoEntreCifras({ ancho: 300, categorias: 0, barras: 1 })).toBeNull();
    });
});

describe('ranuraCategoria y fuenteEtiquetas', () => {
    it('ranuraCategoria reparte el ancho entre las categorías descontando la separación; null sin medida', () => {
        expect(ranuraCategoria({ ancho: 300, categorias: 5 })).toBeCloseTo(50.4, 5);
        expect(ranuraCategoria({ ancho: 320, categorias: 31 })).toBeCloseTo(200 / 31, 5);
        expect(ranuraCategoria({ ancho: null, categorias: 5 })).toBeNull();
        expect(ranuraCategoria({ ancho: 0, categorias: 5 })).toBeNull();
        expect(ranuraCategoria({ ancho: 300, categorias: 0 })).toBeNull();
    });

    it('fuenteEtiquetas: 12 px si caben, hasta 10 px si no; nunca por debajo (se cortarán con puntos suspensivos)', () => {
        expect(fuenteEtiquetas({ ranura: null, etiquetas: ['Lunes'] })).toBe(12);
        expect(fuenteEtiquetas({ ranura: 90, etiquetas: ['Lun', 'Mar'] })).toBe(12);
        const media = fuenteEtiquetas({ ranura: 40, etiquetas: ['Miércoles'] });
        expect(media).toBeLessThan(12);
        expect(media).toBeGreaterThanOrEqual(10);
        expect(fuenteEtiquetas({ ranura: 10, etiquetas: ['Miércoles'] })).toBe(10);
        expect(fuenteEtiquetas({ ranura: 50, etiquetas: [] })).toBe(12);
        expect(fuenteEtiquetas({ ranura: 50, etiquetas: [''] })).toBe(12);
    });

    it('el nombre más ancho manda: una categoría larga reduce la letra de todas (tamaño uniforme)', () => {
        const corto = fuenteEtiquetas({ ranura: 45, etiquetas: ['Lun', 'Mar'] });
        const largo = fuenteEtiquetas({ ranura: 45, etiquetas: ['Lun', 'Miércoles'] });
        expect(largo).toBeLessThan(corto);
    });
});

describe('planCifras', () => {
    const completos = ['88.8 %', '12.5 %'];
    const cortos = ['88.8', '12.5'];

    it('sin medida usa el tamaño normal', () => {
        expect(planCifras({ paso: null, completos, cortos })).toEqual({ modo: 'completo', fuente: 12, cada: 1 });
    });

    it('con espacio de sobra: texto completo a 12 px', () => {
        expect(planCifras({ paso: 62.4, completos, cortos })).toEqual({ modo: 'completo', fuente: 12, cada: 1 });
    });

    it('con menos espacio reduce la fuente del texto completo antes de abreviar', () => {
        const p = planCifras({ paso: 40, completos, cortos });
        expect(p.modo).toBe('completo');
        expect(p.fuente).toBeLessThan(12);
        expect(p.fuente).toBeGreaterThanOrEqual(9);
    });

    it('si ni con 9 px cabe con unidad, abrevia (sin unidad)', () => {
        const p = planCifras({ paso: 27.3, completos, cortos });
        expect(p).toEqual({ modo: 'corto', fuente: 10.5, cada: 1 });
    });

    it('si ni abreviado cabe, alterna columnas con 9 px; sin remedio, oculta', () => {
        expect(planCifras({ paso: 10.45, completos: ['88'], cortos: ['88'] })).toEqual({ modo: 'corto', fuente: 9, cada: 2 });
        expect(planCifras({ paso: 3, completos: ['88'], cortos: ['88'] }).modo).toBe('oculto');
    });

    it('lo que decide nunca solapa: el texto más ancho cabe en paso - margen con el tamaño elegido', () => {
        // el ancho de cada texto, estimado con anchoTextoEm (ver lib/graficas.js), es el que se compara
        const emMayor = (textos) => Math.max(...textos.map((t) => anchoTextoEm(t)));
        for (const paso of [20, 28, 35, 45, 60, 90]) {
            const p = planCifras({ paso, completos, cortos });
            if (p.modo === 'oculto') continue;
            const em = emMayor(p.modo === 'completo' ? completos : cortos);
            expect(em * p.fuente).toBeLessThanOrEqual(paso * p.cada - 4 + 1e-9);
        }
    });

    it('sin textos no falla', () => {
        expect(planCifras({ paso: 30, completos: [], cortos: [] }).modo).toBe('completo');
    });
});

describe('posicionCifra', () => {
    const H = 208;

    it('sin límite queda 6 px sobre la punta', () => {
        expect(posicionCifra({ fraccion: 0.5, fraccionLimite: null, alturaPlano: H })).toBe(110);
        expect(posicionCifra({ fraccion: 0, fraccionLimite: undefined, alturaPlano: H })).toBe(6);
    });

    it('si el lugar natural choca con la línea, la cifra se coloca justo encima de ella', () => {
        const fraccion = 0.45; // natural: 99.6; la línea (104) cruzaría el texto
        expect(posicionCifra({ fraccion, fraccionLimite: 0.5, alturaPlano: H })).toBe(108);
    });

    it('si no choca, se queda donde estaba (línea bajo la cifra o muy por encima)', () => {
        expect(posicionCifra({ fraccion: 0.52, fraccionLimite: 0.5, alturaPlano: H })).toBeCloseTo(0.52 * H + 6, 1);
        expect(posicionCifra({ fraccion: 0.1, fraccionLimite: 0.9, alturaPlano: H })).toBeCloseTo(0.1 * H + 6, 1);
    });

    it('barrido: la línea nunca queda dentro del cuadro de la cifra (ni a menos de 3 px)', () => {
        for (let k = 0; k <= 100; k += 1) {
            const fraccion = k / 100;
            for (const fraccionLimite of [0, 0.2, 0.5, 0.893, 1]) {
                const b = posicionCifra({ fraccion, fraccionLimite, alturaPlano: H });
                const linea = fraccionLimite * H;
                const dentro = linea > b - MARGEN_LINEA && linea < b + ALTO_CIFRA + MARGEN_LINEA;
                expect(dentro).toBe(false);
            }
        }
    });

    it('la cifra desplazada cabe en el margen superior del gráfico (24 px)', () => {
        const b = posicionCifra({ fraccion: 0.99, fraccionLimite: 1, alturaPlano: H });
        expect(b + ALTO_CIFRA).toBeLessThanOrEqual(H + 24);
    });
});

describe('anchoColumnaValor', () => {
    it('mínimo de 2,5 rem y crece con el texto más largo hasta un tope de 16 ch', () => {
        expect(anchoColumnaValor(0)).toBe('max(2.5rem, 1ch)');
        expect(anchoColumnaValor(1)).toBe('max(2.5rem, 2ch)');
        expect(anchoColumnaValor(6)).toBe('max(2.5rem, 7ch)');
        expect(anchoColumnaValor(40)).toBe('max(2.5rem, 16ch)');
        expect(anchoColumnaValor(undefined)).toBe('max(2.5rem, 1ch)');
    });
});

describe('detalleFila', () => {
    const mostrar = (v) => `${v} %`;
    const nombreSerie = (c) => c.toUpperCase();

    it('una serie: «etiqueta: valor»', () => {
        const fila = armarFilas({ datos: [{ g: 'X', a: 3 }], ejeX: 'g', series: [{ clave: 'a' }], apilado: false })[0];
        expect(detalleFila(fila, { apilado: false, mostrar, nombreSerie })).toBe('X: 3 %');
    });

    it('sin dato: «sin datos»', () => {
        const fila = armarFilas({ datos: [{ g: 'X', a: null }], ejeX: 'g', series: [{ clave: 'a' }], apilado: false })[0];
        expect(detalleFila(fila, { apilado: false, mostrar, nombreSerie })).toBe('X: sin datos');
    });

    it('varias series: lista las que tienen dato y, apiladas, añade el total', () => {
        const series = [{ clave: 'a' }, { clave: 'b' }, { clave: 'c' }];
        const fila = armarFilas({ datos: [{ g: 'X', a: 1, b: null, c: 2 }], ejeX: 'g', series, apilado: true })[0];
        expect(detalleFila(fila, { apilado: true, mostrar, nombreSerie })).toBe('X: A 1 % · C 2 % · total 3 %');
        expect(detalleFila(fila, { apilado: false, mostrar, nombreSerie })).toBe('X: A 1 % · C 2 %');
        const una = armarFilas({ datos: [{ g: 'X', a: 1, b: null, c: null }], ejeX: 'g', series, apilado: true })[0];
        expect(detalleFila(una, { apilado: true, mostrar, nombreSerie })).toBe('X: A 1 %');
    });
});
