import { describe, expect, it } from 'vitest';
import {
    SEMILLAS_ALUMNO,
    SEMILLAS_EXTRANO,
    TOTAL_SEMILLAS,
    colorDeSemilla,
    esSemillaDeAlumno,
    semillaDeAlumno,
    semillaDeColor,
    semillaDeExtrano,
} from './semillas.js';

// Misma regla que el detector del servicio (fake.py): marco magenta = R > 180, G < 80, B > 180.
const parecidoAlMagenta = ([r, g, b]) => r > 180 && g < 80 && b > 180;

describe('semillaDeAlumno', () => {
    it('es determinista y cabe en 12 bits', () => {
        expect(semillaDeAlumno(1)).toBe(semillaDeAlumno(1));
        for (let id = 1; id <= 75; id += 1) {
            const s = semillaDeAlumno(id);
            expect(Number.isInteger(s)).toBe(true);
            expect(s).toBeGreaterThanOrEqual(0);
            expect(s).toBeLessThan(TOTAL_SEMILLAS);
        }
    });

    it('no repite semillas para ningún id_alumno válido (biyección)', () => {
        const vistas = new Set();
        for (let id = 1; id <= SEMILLAS_ALUMNO; id += 1) vistas.add(semillaDeAlumno(id));
        expect(vistas.size).toBe(SEMILLAS_ALUMNO);
    });

    it('rechaza ids fuera de rango o que no son enteros', () => {
        expect(() => semillaDeAlumno(0)).toThrow(RangeError);
        expect(() => semillaDeAlumno(SEMILLAS_ALUMNO + 1)).toThrow(RangeError);
        expect(() => semillaDeAlumno(1.5)).toThrow(TypeError);
        expect(() => semillaDeAlumno('3')).toThrow(TypeError);
    });

    it('queda en el rango reservado a alumnos', () => {
        for (let id = 1; id <= SEMILLAS_ALUMNO; id += 1) expect(esSemillaDeAlumno(semillaDeAlumno(id))).toBe(true);
    });
});

describe('semillaDeExtrano', () => {
    it('queda fuera del rango de alumnos y no repite', () => {
        const vistas = new Set();
        for (let n = 0; n < SEMILLAS_EXTRANO; n += 1) {
            const s = semillaDeExtrano(n);
            expect(s).toBeGreaterThanOrEqual(SEMILLAS_ALUMNO);
            expect(s).toBeLessThan(TOTAL_SEMILLAS);
            expect(esSemillaDeAlumno(s)).toBe(false);
            vistas.add(s);
        }
        expect(vistas.size).toBe(SEMILLAS_EXTRANO);
    });

    it('rechaza ordinales fuera de rango', () => {
        expect(() => semillaDeExtrano(-1)).toThrow(RangeError);
        expect(() => semillaDeExtrano(SEMILLAS_EXTRANO)).toThrow(RangeError);
    });
});

describe('colorDeSemilla / semillaDeColor', () => {
    it('coincide con seed_to_color de recognition-service/app/embedders/fake.py', () => {
        expect(colorDeSemilla(0)).toEqual([64, 64, 64]);
        expect(colorDeSemilla(0x123)).toEqual([72, 80, 88]);
        expect(colorDeSemilla(0xabc)).toEqual([144, 152, 160]);
        expect(colorDeSemilla(4095)).toEqual([184, 184, 184]);
    });

    it('ida y vuelta exacta para las 4096 semillas', () => {
        for (let s = 0; s < TOTAL_SEMILLAS; s += 1) expect(semillaDeColor(colorDeSemilla(s))).toBe(s);
    });

    it('tolera el ruido de la compresión (+-3 por canal)', () => {
        const color = colorDeSemilla(semillaDeAlumno(42));
        expect(semillaDeColor(color.map((c) => c + 3))).toBe(semillaDeAlumno(42));
        expect(semillaDeColor(color.map((c) => c - 3))).toBe(semillaDeAlumno(42));
    });

    it('ningún alumno ni extraño tiene un interior que el detector confunda con el marco', () => {
        for (let id = 1; id <= SEMILLAS_ALUMNO; id += 1) expect(parecidoAlMagenta(colorDeSemilla(semillaDeAlumno(id)))).toBe(false);
        for (let n = 0; n < SEMILLAS_EXTRANO; n += 1) expect(parecidoAlMagenta(colorDeSemilla(semillaDeExtrano(n)))).toBe(false);
    });

    it('rechaza semillas fuera de 0..4095', () => {
        expect(() => colorDeSemilla(-1)).toThrow(RangeError);
        expect(() => colorDeSemilla(TOTAL_SEMILLAS)).toThrow(RangeError);
        expect(() => colorDeSemilla(0.5)).toThrow(TypeError);
    });
});
