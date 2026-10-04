import { describe, expect, it } from 'vitest';
import {
    COLOR_MARCO,
    GROSOR_MARCO,
    LADO_MINIMO,
    cssRgb,
    posicionesDeRostros,
    rectangulosDeRostro,
} from './rostro.js';
import { colorDeSemilla, semillaDeAlumno } from './semillas.js';

describe('rectangulosDeRostro', () => {
    it('pinta un marco magenta y un interior inscrito con el color de la semilla', () => {
        const semilla = semillaDeAlumno(7);
        const { marco, interior } = rectangulosDeRostro(semilla, { x: 10, y: 20, lado: 100 });
        expect(marco).toEqual({ x: 10, y: 20, ancho: 100, alto: 100, rgb: [...COLOR_MARCO] });
        expect(interior.x).toBe(10 + GROSOR_MARCO);
        expect(interior.y).toBe(20 + GROSOR_MARCO);
        expect(interior.ancho).toBe(100 - 2 * GROSOR_MARCO);
        expect(interior.alto).toBe(100 - 2 * GROSOR_MARCO);
        expect(interior.rgb).toEqual(colorDeSemilla(semilla));
    });

    it('rechaza lados que el detector descartaría como ruido', () => {
        expect(() => rectangulosDeRostro(0, { x: 0, y: 0, lado: LADO_MINIMO - 1 })).toThrow(RangeError);
        expect(() => rectangulosDeRostro(0, { x: 0, y: 0, lado: Number.NaN })).toThrow(TypeError);
    });

    it('no comparte el arreglo del color del marco (no se puede alterar la constante)', () => {
        const { marco } = rectangulosDeRostro(0, { x: 0, y: 0, lado: 40 });
        marco.rgb[0] = 0;
        expect(COLOR_MARCO[0]).toBe(255);
    });
});

describe('cssRgb', () => {
    it('arma la cadena para fillStyle', () => {
        expect(cssRgb([72, 80, 88])).toBe('rgb(72, 80, 88)');
    });
});

describe('posicionesDeRostros', () => {
    const solapan = (a, b, lado, hueco) => Math.abs(a.x - b.x) < lado + hueco && Math.abs(a.y - b.y) < lado + hueco;

    it('devuelve vacío para cero rostros', () => {
        expect(posicionesDeRostros(0, 640, 480, 80)).toEqual([]);
    });

    it('coloca 24 rostros dentro del encuadre y sin tocarse', () => {
        const lado = 64;
        const hueco = 16;
        const pos = posicionesDeRostros(24, 960, 540, lado, hueco);
        expect(pos).toHaveLength(24);
        for (const p of pos) {
            expect(p.x).toBeGreaterThanOrEqual(hueco);
            expect(p.y).toBeGreaterThanOrEqual(hueco);
            expect(p.x + lado).toBeLessThanOrEqual(960 - hueco);
            expect(p.y + lado).toBeLessThanOrEqual(540 - hueco);
        }
        for (let i = 0; i < pos.length; i += 1) {
            for (let j = i + 1; j < pos.length; j += 1) expect(solapan(pos[i], pos[j], lado, hueco)).toBe(false);
        }
    });

    it('es determinista', () => {
        expect(posicionesDeRostros(5, 640, 480, 80)).toEqual(posicionesDeRostros(5, 640, 480, 80));
    });

    it('avisa cuando no caben', () => {
        expect(() => posicionesDeRostros(50, 320, 240, 80)).toThrow(RangeError);
        expect(() => posicionesDeRostros(-1, 640, 480, 80)).toThrow(TypeError);
    });
});
