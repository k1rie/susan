import { describe, expect, it } from 'vitest';
import { esCritico, resumenLista, resumenParametro, textoRango, validarValor } from './parametros.utils.js';

const p = { clave: 'tolerancia_min', tipo: 'entero', unidad: 'min', minimo: '0', maximo: '60' };

describe('parametros.utils', () => {
    it('validarValor exige número entero dentro de rango', () => {
        expect(validarValor(p, '25')).toBeNull();
        expect(validarValor(p, '2.5')).toBe('Debe ser un número entero.');
        expect(validarValor(p, '61')).toMatch(/Fuera de rango/);
        expect(validarValor(p, '  ')).toBe('El valor no puede estar en blanco.');
    });
    it('textoRango cubre mínimo, máximo, ambos y ninguno', () => {
        expect(textoRango(p)).toBe('de 0 a 60 min');
        expect(textoRango({ minimo: '1' })).toBe('mínimo 1');
        expect(textoRango({ maximo: '9', unidad: 's' })).toBe('máximo 9 s');
        expect(textoRango({})).toBe('sin rango');
    });
    it('resumenParametro une tipo y rango y añade la última modificación solo si existe', () => {
        expect(resumenParametro(p)).toBe('entero · de 0 a 60 min');
        const r = resumenParametro({ ...p, fecha_actualizacion: '2026-03-12T10:00:00Z', actualizado_por: { correo: 'ana@x.mx' } });
        expect(r).toMatch(/^entero · de 0 a 60 min · modificado .+ por ana@x\.mx$/);
        expect(resumenParametro({ ...p, fecha_actualizacion: 'no-es-fecha' })).toBe('entero · de 0 a 60 min');
    });
    it('resumenLista cuenta parámetros y críticos', () => {
        expect(esCritico('umbral_similitud')).toBe(true);
        expect(resumenLista([{ clave: 'umbral_similitud' }, { clave: 'tolerancia_min' }, { clave: 'dimension_vector' }])).toBe('3 parámetros, 2 críticos');
        expect(resumenLista([{ clave: 'x' }])).toBe('1 parámetro');
        expect(resumenLista([])).toBe('0 parámetros');
    });
});
