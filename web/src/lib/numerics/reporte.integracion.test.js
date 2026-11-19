// Reporte de pruebas · IT-02: regresion por minimos cuadrados (con Gauss) -> busqueda del cruce (biseccion y Newton).
// Mismo encadenamiento que usa analizarGrupo; ningun colaborador esta simulado.
import { describe, expect, it } from 'vitest';
import { ajustePolinomial } from './regression/minimosCuadrados.js';
import { buscarCruce } from './forecast/cruce.js';

describe('IT-02 ajustePolinomial + buscarCruce', () => {
    it('una serie sintetica exactamente lineal (y = 1 + 2t) cruza el 20 % en t = 9.5, semana 10', () => {
        // Preparar: ausentismo acumulado (%) de las semanas 1 a 6
        const semanas = [1, 2, 3, 4, 5, 6];
        const acumulado = [3, 5, 7, 9, 11, 13];

        // Ejecutar: ajuste real de grado 1 y busqueda real del cruce sobre ese ajuste
        const ajuste = ajustePolinomial(semanas, acumulado, 1);
        const cruce = buscarCruce(ajuste, 20, { desde: 6, hasta: 16 });

        // Verificar: el ajuste reproduce la recta y el cruce es la solucion de 1 + 2t = 20
        expect(ajuste.r2).toBeCloseTo(1, 9);
        expect(ajuste.predecir(6)).toBeCloseTo(13, 9);
        expect(ajuste.derivada(6)).toBeCloseTo(2, 9);
        expect(cruce.estado).toBe('cruza');
        expect(cruce.t).toBeCloseTo(9.5, 6);
        expect(cruce.semana).toBe(10);
        expect(cruce.biseccion.convergio).toBe(true);
        expect(cruce.newton.raiz).toBeCloseTo(9.5, 6);
    });
});
