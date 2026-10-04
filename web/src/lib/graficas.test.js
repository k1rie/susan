import { describe, expect, it } from 'vitest';
import {
    anchoTextoEm,
    colorGrafica,
    CONFIG_ASISTENCIA,
    formatoNumero,
    formatoPct,
    numeroOpcional,
    pct,
    resumenTexto,
    sumar,
    textoPct,
    valorNoNegativo,
} from './graficas.js';

describe('graficas utils', () => {
    it('pct es seguro con totales 0 o inválidos', () => {
        expect(pct(1, 4)).toBe(25);
        expect(pct(1, 3)).toBe(33.3);
        expect(pct(1, 3, 0)).toBe(33);
        expect(pct(5, 0)).toBe(0);
        expect(pct('x', 10)).toBe(0);
        expect(pct(5, undefined)).toBe(0);
    });
    it('sumar ignora valores no numéricos', () => {
        expect(sumar([{ valor: 2 }, { valor: '3' }, { valor: null }, { valor: 'a' }])).toBe(5);
    });
    it('resumenTexto usa las etiquetas de la configuración y porcentajes enteros', () => {
        const t = resumenTexto([{ clave: 'presente', valor: 3 }, { clave: 'ausente', valor: 1 }], CONFIG_ASISTENCIA);
        expect(t).toBe('Presentes: 3 (75 %); Ausencias: 1 (25 %)');
        expect(resumenTexto([{ clave: 'x', valor: 0 }], {})).toBe('x: 0');
    });
    it('resumenTexto dice «<1 %» para un valor positivo que redondea a 0, como la leyenda del anillo', () => {
        const t = resumenTexto([{ clave: 'presente', valor: 300 }, { clave: 'ausente', valor: 1 }, { clave: 'retardo', valor: 0 }], CONFIG_ASISTENCIA);
        expect(t).toBe('Presentes: 300 (100 %); Ausencias: 1 (<1 %); Retardos: 0 (0 %)');
    });
    it('formatoPct usa es-MX y tolera valores raros', () => {
        expect(formatoPct(82.35)).toMatch(/^82[.,][34]/);
        expect(formatoPct(100)).toBe('100 %');
        expect(formatoPct(undefined)).toBe('-');
    });
    it('la configuración de asistencia cubre los 5 estados con tokens', () => {
        expect(Object.keys(CONFIG_ASISTENCIA)).toEqual(['presente', 'retardo', 'ausente', 'justificado', 'pendiente']);
        for (const c of Object.values(CONFIG_ASISTENCIA)) expect(c.color).toMatch(/^var\(--/);
    });
    it('colorGrafica traduce los tokens de texto a los de gráfica y deja pasar cualquier otro valor', () => {
        expect(colorGrafica('var(--presente)')).toBe('var(--g-presente)');
        expect(colorGrafica('var(--chart-1)')).toBe('var(--g-azul)');
        expect(colorGrafica('var(--g-violeta)')).toBe('var(--g-violeta)');
        expect(colorGrafica('var(--foreground)')).toBe('var(--foreground)');
        expect(colorGrafica(undefined)).toBeUndefined();
    });
});

describe('numeroOpcional y valorNoNegativo', () => {
    it('numeroOpcional distingue «sin dato» (null) de un 0 real', () => {
        expect(numeroOpcional(0)).toBe(0);
        expect(numeroOpcional(-2.5)).toBe(-2.5);
        expect(numeroOpcional('7')).toBe(7);
        for (const v of [null, undefined, '', 'x', NaN, Infinity, -Infinity, true, false]) expect(numeroOpcional(v)).toBeNull();
    });

    it('valorNoNegativo recorta negativos a 0 y trata lo no numérico como 0', () => {
        expect(valorNoNegativo(4)).toBe(4);
        expect(valorNoNegativo('4')).toBe(4);
        expect(valorNoNegativo(-4)).toBe(0);
        for (const v of [null, undefined, '', 'x', NaN, Infinity]) expect(valorNoNegativo(v)).toBe(0);
    });
});

describe('formatoNumero', () => {
    it('usa es-MX con hasta 1 decimal y sin ceros de relleno', () => {
        expect(formatoNumero(26.74)).toBe('26.7');
        expect(formatoNumero(12)).toBe('12');
        expect(formatoNumero(0)).toBe('0');
        expect(formatoNumero(0.1 + 0.2)).toBe('0.3');
        expect(formatoNumero('3')).toBe('3');
        expect(formatoNumero(12345)).toBe('12,345');
    });

    it('un valor sin dato se escribe «-»', () => {
        for (const v of [null, undefined, '', 'x', NaN]) expect(formatoNumero(v)).toBe('-');
    });
});

describe('textoPct', () => {
    it('entero con «%»; un positivo que redondea a 0 se escribe «<1 %»', () => {
        expect(textoPct(1, 4)).toBe('25 %');
        expect(textoPct(2, 3)).toBe('67 %');
        expect(textoPct(0, 10)).toBe('0 %');
        expect(textoPct(1, 400)).toBe('<1 %');
        expect(textoPct(0.2, 100)).toBe('<1 %');
        expect(textoPct(5, 5)).toBe('100 %');
    });

    it('con total 0 o inválido no marca «<1 %»', () => {
        expect(textoPct(3, 0)).toBe('0 %');
        expect(textoPct(3, undefined)).toBe('0 %');
        expect(textoPct('x', 10)).toBe('0 %');
    });
});

describe('anchoTextoEm', () => {
    it('suma el avance de cada carácter; vacío o indefinido mide 0', () => {
        expect(anchoTextoEm('')).toBe(0);
        expect(anchoTextoEm(undefined)).toBe(0);
        expect(anchoTextoEm(null)).toBe(0);
        expect(anchoTextoEm('88')).toBeCloseTo(2 * anchoTextoEm('8'), 10);
        expect(anchoTextoEm('26.7 %')).toBeCloseTo(['2', '6', '.', '7', ' ', '%'].reduce((a, c) => a + anchoTextoEm(c), 0), 10);
    });

    it('está calibrada con holgura sobre una grotesca de interfaz (cifras ~0,61 em, «%» ~0,93 em)', () => {
        expect(anchoTextoEm('8')).toBeGreaterThanOrEqual(0.61);
        expect(anchoTextoEm('%')).toBeGreaterThanOrEqual(0.93);
        // medidas de referencia en SF Pro 12 px: «88.8 %» 3,45 em · «Dom» 2,19 em · «Miércoles» 4,56 em · «Lun» 1,74 em
        expect(anchoTextoEm('88.8 %')).toBeGreaterThanOrEqual(3.4);
        expect(anchoTextoEm('Dom')).toBeGreaterThanOrEqual(2.19);
        expect(anchoTextoEm('Miércoles')).toBeGreaterThanOrEqual(4.56);
        expect(anchoTextoEm('Lun')).toBeGreaterThanOrEqual(1.74);
        // y sin pasarse: no más de un 15 % por encima de lo medido
        expect(anchoTextoEm('88.8 %')).toBeLessThanOrEqual(3.45 * 1.15);
        expect(anchoTextoEm('Miércoles')).toBeLessThanOrEqual(4.56 * 1.15);
    });

    it('distingue letras estrechas, anchas y mayúsculas, y las acentuadas miden como su letra base', () => {
        expect(anchoTextoEm('ill')).toBeLessThan(anchoTextoEm('mmm'));
        expect(anchoTextoEm('M')).toBeGreaterThan(anchoTextoEm('E'));
        expect(anchoTextoEm('E')).toBeGreaterThan(anchoTextoEm('e'));
        expect(anchoTextoEm('é')).toBe(anchoTextoEm('e'));
        expect(anchoTextoEm('Í')).toBe(anchoTextoEm('I'));
    });

    it('un texto más largo mide más y el espacio duro cuenta como espacio', () => {
        expect(anchoTextoEm('100 %')).toBeGreaterThan(anchoTextoEm('10 %'));
        expect(anchoTextoEm('1\u00a0%')).toBeCloseTo(anchoTextoEm('1 %'), 10);
        expect(anchoTextoEm('1\u202f%')).toBeCloseTo(anchoTextoEm('1 %'), 10);
    });
});
