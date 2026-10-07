import { describe, expect, it } from 'vitest';
import { agruparOpciones, calcularPosicionLista, filtrarOpciones, mismoValor, primeraHabilitada, siguienteHabilitada } from './combobox.utils.js';

const OPCIONES = [
    { value: 1, label: 'Álgebra Lineal', description: 'ALG101', group: 'Matemáticas' },
    { value: 2, label: 'Cálculo Diferencial', description: 'CAL101', group: 'Matemáticas' },
    { value: 3, label: 'Administración I', description: 'ADM101', group: 'Administración' },
    { value: 4, label: 'Contabilidad Básica', description: 'Álgebra requerida', group: 'Administración' },
];

describe('mismoValor', () => {
    it('compara por texto y no confunde vacío con cero', () => {
        expect(mismoValor(3, '3')).toBe(true);
        expect(mismoValor('a', 'a')).toBe(true);
        expect(mismoValor(0, '0')).toBe(true);
        expect(mismoValor('', 0)).toBe(false);
        expect(mismoValor(null, null)).toBe(false);
        expect(mismoValor(undefined, '3')).toBe(false);
    });
});

describe('filtrarOpciones', () => {
    it('consulta vacía devuelve todas en su orden', () => {
        expect(filtrarOpciones(OPCIONES, '')).toBe(OPCIONES);
        expect(filtrarOpciones(OPCIONES, '   ')).toBe(OPCIONES);
    });

    it('ignora acentos y mayúsculas en ambos lados', () => {
        expect(filtrarOpciones(OPCIONES, 'algebra').map((o) => o.value)).toEqual([1, 4]);
        expect(filtrarOpciones(OPCIONES, 'ÁLGEBRA').map((o) => o.value)).toEqual([1, 4]);
        expect(filtrarOpciones(OPCIONES, 'calculo').map((o) => o.value)).toEqual([2]);
    });

    it('exige todas las palabras, en cualquier orden', () => {
        expect(filtrarOpciones(OPCIONES, 'diferencial calculo').map((o) => o.value)).toEqual([2]);
        expect(filtrarOpciones(OPCIONES, 'calculo zzz')).toEqual([]);
    });

    it('busca también en la descripción y en el grupo', () => {
        expect(filtrarOpciones(OPCIONES, 'adm101').map((o) => o.value)).toEqual([3]);
        expect(filtrarOpciones(OPCIONES, 'matematicas').map((o) => o.value)).toEqual([1, 2]);
    });

    it('prioriza el título que empieza con la consulta y luego el que la contiene', () => {
        // «ad»: Administración empieza con «ad»; Cálculo Diferencial no (la descripción de 4 no cuenta como título)
        const orden = filtrarOpciones(OPCIONES, 'al').map((o) => o.value);
        expect(orden[0]).toBe(1); // «Álgebra» empieza con «al»
        expect(orden).toContain(4); // aparece por su descripción, al final
        expect(orden.indexOf(4)).toBeGreaterThan(orden.indexOf(1));
    });

    it('es estable dentro de la misma puntuación', () => {
        const iguales = [
            { value: 'a', label: 'Grupo 3A' },
            { value: 'b', label: 'Grupo 3B' },
            { value: 'c', label: 'Grupo 3C' },
        ];
        expect(filtrarOpciones(iguales, 'grupo').map((o) => o.value)).toEqual(['a', 'b', 'c']);
    });

    it('tolera opciones sin descripción ni grupo', () => {
        expect(filtrarOpciones([{ value: 1, label: 'Solo título' }], 'solo')).toHaveLength(1);
    });
});

describe('agruparOpciones', () => {
    it('agrupa por orden de aparición y numera en orden visual', () => {
        const mezcladas = [
            { value: 1, label: 'A', group: 'X' },
            { value: 2, label: 'B', group: 'Y' },
            { value: 3, label: 'C', group: 'X' },
            { value: 4, label: 'D' },
        ];
        const { grupos, planas } = agruparOpciones(mezcladas);
        expect(grupos.map((g) => g.titulo)).toEqual(['X', 'Y', null]);
        expect(planas.map((o) => o.value)).toEqual([1, 3, 2, 4]); // el teclado sigue el orden que se ve
        expect(grupos[0].opciones.map((x) => x.indice)).toEqual([0, 1]);
        expect(grupos[1].opciones[0].indice).toBe(2);
    });

    it('sin grupos todo cae en un bloque sin título', () => {
        const { grupos } = agruparOpciones([{ value: 1, label: 'A' }, { value: 2, label: 'B' }]);
        expect(grupos).toHaveLength(1);
        expect(grupos[0].titulo).toBeNull();
        expect(agruparOpciones([])).toEqual({ grupos: [], planas: [] });
    });
});

describe('navegación', () => {
    const planas = [{ value: 1, disabled: true }, { value: 2 }, { value: 3, disabled: true }, { value: 4 }];

    it('primeraHabilitada salta las deshabilitadas', () => {
        expect(primeraHabilitada(planas)).toBe(1);
        expect(primeraHabilitada([{ disabled: true }])).toBe(-1);
        expect(primeraHabilitada([])).toBe(-1);
    });

    it('siguienteHabilitada salta, da la vuelta y avisa si no hay ninguna', () => {
        expect(siguienteHabilitada(planas, 1, 1)).toBe(3);
        expect(siguienteHabilitada(planas, 3, 1)).toBe(1);
        expect(siguienteHabilitada(planas, 1, -1)).toBe(3);
        expect(siguienteHabilitada(planas, -1, 1)).toBe(1);
        expect(siguienteHabilitada([{ disabled: true }], 0, 1)).toBe(-1);
        expect(siguienteHabilitada([], 0, 1)).toBe(-1);
    });
});

describe('calcularPosicionLista', () => {
    const pantalla = { arriba: 0, abajo: 800, izquierda: 0, derecha: 360 };

    it('abre hacia abajo con el ancho del campo cuando hay sitio', () => {
        const p = calcularPosicionLista({ rect: { top: 100, bottom: 140, left: 16, width: 328 }, limites: pantalla, altoVentana: 800 });
        expect(p.arriba).toBe(false);
        expect(p.top).toBe(144);
        expect(p.izquierda).toBe(16);
        expect(p.ancho).toBe(328);
        expect(p.maxAlto).toBe(320);
    });

    it('abre hacia arriba si abajo no cabe y arriba hay más espacio', () => {
        const p = calcularPosicionLista({ rect: { top: 600, bottom: 640, left: 16, width: 328 }, limites: { ...pantalla, abajo: 700 }, altoVentana: 800 });
        expect(p.arriba).toBe(true);
        expect(p.bottom).toBe(204); // 800 - 600 + 4
        expect(p.maxAlto).toBe(320);
    });

    it('con el teclado del teléfono abierto la región visible es más baja y la lista cambia de lado', () => {
        const campo = { top: 300, bottom: 340, left: 16, width: 328 };
        const sinTeclado = calcularPosicionLista({ rect: campo, limites: pantalla, altoVentana: 800 });
        const conTeclado = calcularPosicionLista({ rect: campo, limites: { ...pantalla, abajo: 420 }, altoVentana: 800 });
        expect(sinTeclado.arriba).toBe(false);
        expect(conTeclado.arriba).toBe(true);
        expect(conTeclado.maxAlto).toBeLessThanOrEqual(300 - 4 - 8);
    });

    it('no abre hacia arriba si tampoco ahí hay más espacio', () => {
        const p = calcularPosicionLista({ rect: { top: 60, bottom: 100, left: 16, width: 328 }, limites: { ...pantalla, abajo: 220 }, altoVentana: 800 });
        expect(p.arriba).toBe(false);
        expect(p.maxAlto).toBe(Math.max(220 - 100 - 4 - 8, 80));
    });

    it('en 360 px nunca se sale por los lados: corre el borde y acota el ancho', () => {
        const justoAlBorde = calcularPosicionLista({ rect: { top: 0, bottom: 40, left: 300, width: 60 }, limites: pantalla, altoVentana: 800 });
        expect(justoAlBorde.ancho).toBe(220); // ancho mínimo
        expect(justoAlBorde.izquierda + justoAlBorde.ancho).toBeLessThanOrEqual(360 - 8);
        const enorme = calcularPosicionLista({ rect: { top: 0, bottom: 40, left: 0, width: 900 }, limites: pantalla, altoVentana: 800 });
        expect(enorme.ancho).toBe(344); // 360 - 2 × 8
        expect(enorme.izquierda).toBe(8);
        const aLaIzquierda = calcularPosicionLista({ rect: { top: 0, bottom: 40, left: -50, width: 200 }, limites: pantalla, altoVentana: 800 });
        expect(aLaIzquierda.izquierda).toBe(8);
    });

    it('respeta el desplazamiento del visualViewport', () => {
        const p = calcularPosicionLista({
            rect: { top: 100, bottom: 140, left: 120, width: 200 },
            limites: { arriba: 0, abajo: 800, izquierda: 100, derecha: 460 },
            altoVentana: 800,
        });
        expect(p.izquierda).toBeGreaterThanOrEqual(108);
        expect(p.izquierda + p.ancho).toBeLessThanOrEqual(452);
    });

    it('con muy poco espacio garantiza una altura mínima legible', () => {
        const p = calcularPosicionLista({ rect: { top: 10, bottom: 50, left: 0, width: 300 }, limites: { arriba: 0, abajo: 80, izquierda: 0, derecha: 360 }, altoVentana: 800 });
        expect(p.maxAlto).toBe(80);
    });
});
