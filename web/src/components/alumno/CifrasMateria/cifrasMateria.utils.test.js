import { describe, expect, it } from 'vitest';
import { casillaRestantes, cifrasMateria } from './cifrasMateria.utils.js';

const item = {
    sesiones_programadas: 40, presentes: 30, retardos: 1, ausencias: 2, justificadas: 1, pendientes: 0,
    faltas_equivalentes: 2, faltas_maximas_permitidas: 8, faltas_restantes_antes_limite: 6, limite_pct: 20,
    supera_limite: false, en_limite: false, derecho_examen: true,
};

describe('cifrasMateria', () => {
    it('devuelve las seis casillas en orden, con la cifra y el tono de cada estado', () => {
        expect(cifrasMateria(item).map((c) => [c.clave, c.label, c.value, c.tone])).toEqual([
            ['presentes', 'Presentes', 30, 'success'],
            ['retardos', 'Retardos', 1, 'warning'],
            ['ausencias', 'Ausencias', 2, 'danger'],
            ['justificadas', 'Justificadas', 1, 'neutral'],
            ['pendientes', 'Pendientes', 0, 'neutral'],
            ['restantes', 'Faltas restantes', 6, 'success'],
        ]);
    });

    it('los pendientes avisan que aún no cuentan solo cuando hay alguno', () => {
        expect(cifrasMateria(item).find((c) => c.clave === 'pendientes').hint).toBeUndefined();
        expect(cifrasMateria({ ...item, pendientes: 2 }).find((c) => c.clave === 'pendientes')).toMatchObject({ value: 2, hint: 'Aún no cuentan' });
    });

    it('tolera datos faltantes o raros sin inventar cifras negativas', () => {
        expect(cifrasMateria({ presentes: 'x', retardos: -3, ausencias: null }).slice(0, 5).map((c) => c.value)).toEqual([0, 0, 0, 0, 0]);
        expect(cifrasMateria(undefined)).toHaveLength(6);
    });
});

describe('casillaRestantes', () => {
    it('dentro del límite: tono success y «Dentro del límite»', () => {
        expect(casillaRestantes(item)).toEqual({ clave: 'restantes', label: 'Faltas restantes', value: 6, tone: 'success', hint: 'Dentro del límite' });
    });

    it('con pocas faltas restantes usa el aviso «info» de avisoMateria (neutral, no alarma)', () => {
        expect(casillaRestantes({ ...item, faltas_restantes_antes_limite: 2 })).toMatchObject({ value: 2, tone: 'neutral', hint: 'Cerca del límite' });
    });

    it('en el límite: tono warning y lo que pasa con una falta más', () => {
        expect(casillaRestantes({ ...item, en_limite: true, faltas_restantes_antes_limite: 0 })).toMatchObject({ value: 0, tone: 'warning', hint: 'Una falta más y pierdes el derecho' });
    });

    it('límite superado: tono danger, cero faltas y sin derecho a examen', () => {
        expect(casillaRestantes({ ...item, supera_limite: true, derecho_examen: false, faltas_restantes_antes_limite: 0 })).toMatchObject({ value: 0, tone: 'danger', hint: 'Sin derecho a examen' });
    });

    it('sin sesiones programadas no hay nada que medir: «-» y no un 0 inventado', () => {
        expect(casillaRestantes({ ...item, sesiones_programadas: 0 })).toMatchObject({ value: '-', tone: 'neutral', hint: 'Aún no hay sesiones programadas' });
    });

    it('si la base no manda las faltas restantes escribe «-»', () => {
        expect(casillaRestantes({ ...item, faltas_restantes_antes_limite: undefined })).toMatchObject({ value: '-', tone: 'success' });
    });

    it('un valor negativo (no debería llegar) se recorta a 0', () => {
        expect(casillaRestantes({ ...item, faltas_restantes_antes_limite: -2, en_limite: true }).value).toBe(0);
    });
});
