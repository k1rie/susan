// Reporte de pruebas · UT-03 a UT-06. Funciones reales importadas de su modulo; esperados tomados de las reglas.
import { describe, expect, it } from 'vitest';
import { resumirAsistencia } from './risk/riesgo.js';
import { buscarCruce } from './forecast/cruce.js';

describe('resumirAsistencia (RN-10: tres retardos = una falta; justificado y pendiente no cuentan)', () => {
    it('UT-03 caso normal: 1 ausencia + 3 retardos = 2 faltas equivalentes', () => {
        // Preparar
        const estados = ['presente', 'ausente', 'retardo', 'retardo', 'retardo', 'justificado', 'pendiente', null];
        // Ejecutar
        const r = resumirAsistencia(estados, 3);
        // Verificar
        expect(r).toMatchObject({ ausentes: 1, retardos: 3, justificados: 1, faltasEq: 2 });
    });

    it.each([
        [2, 0], // dos retardos aun no forman una falta
        [5, 1], // cinco retardos: una falta completa, sobran dos
    ])('UT-04 caso limite: %i retardos -> %i falta(s) equivalente(s)', (retardos, esperado) => {
        const estados = Array(retardos).fill('retardo');
        const r = resumirAsistencia(estados, 3);
        expect(r.faltasEq).toBe(esperado);
    });
});

describe('buscarCruce (semana en que el ausentismo acumulado alcanza el limite)', () => {
    // Doble de prueba: un modelo lineal conocido f(t) = 2t sustituye al ajuste de regresion.
    const modelo = { predecir: (t) => 2 * t, derivada: () => 2 };

    it('UT-05 caso normal: f(t) = 2t alcanza 20 % en t = 10 (semana 10)', () => {
        const r = buscarCruce(modelo, 20, { desde: 0, hasta: 16 });
        expect(r.estado).toBe('cruza');
        expect(r.t).toBeCloseTo(10, 6);
        expect(r.semana).toBe(10);
        expect(r.newton.raiz).toBeCloseTo(10, 6);
    });

    it('UT-06 caso invalido: horizonte con hasta <= desde lanza RangeError', () => {
        expect(() => buscarCruce(modelo, 20, { desde: 8, hasta: 8 }))
            .toThrow(new RangeError('Se requiere hasta > desde y paso > 0.'));
    });
});
