import { describe, expect, it } from 'vitest';
import { CONFIG_ASISTENCIA, formatoPct, pct, resumenTexto, sumar } from './graficas.js';

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
    it('formatoPct usa es-MX y tolera valores raros', () => {
        expect(formatoPct(82.35)).toMatch(/^82[.,][34]/);
        expect(formatoPct(100)).toBe('100 %');
        expect(formatoPct(undefined)).toBe('-');
    });
    it('la configuración de asistencia cubre los 5 estados con tokens', () => {
        expect(Object.keys(CONFIG_ASISTENCIA)).toEqual(['presente', 'retardo', 'ausente', 'justificado', 'pendiente']);
        for (const c of Object.values(CONFIG_ASISTENCIA)) expect(c.color).toMatch(/^var\(--/);
    });
});
