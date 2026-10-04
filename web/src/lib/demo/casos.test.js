import { describe, expect, it } from 'vitest';
import {
    ALUMNOS_ACTIVOS,
    JUSTIFICANTES_DEMO,
    PARAMETROS_DEMO,
    SESIONES_DEMO,
    lecturasValidas,
    resultadoEsperado,
    resumenEsperado,
} from './casos.js';

const [sabado, domingo] = SESIONES_DEMO;
const bySesion = (clave) => SESIONES_DEMO.find((s) => s.clave === clave);

describe('guion de las clases de reposición', () => {
    it('tiene dos sesiones del 3A, en orden cronológico y con plazo de corrección todavía vigente', () => {
        expect(SESIONES_DEMO.map((s) => s.clave)).toEqual(['reposicion-sabado', 'reposicion-domingo']);
        for (const s of SESIONES_DEMO) expect(s.grupo).toBe('3A');
        expect(sabado.fecha < domingo.fecha).toBe(true);
        // Reloj de la demostración: lunes 14-sep-2026 07:12 (-06:00). Plazo = hora_fin + 48 h (RN-08).
        const ahora = Date.parse('2026-09-14T07:12:00-06:00');
        for (const s of SESIONES_DEMO) {
            const vence = Date.parse(`${s.fecha}T${s.horaFin}:00-06:00`) + 48 * 3600 * 1000;
            expect(vence).toBeGreaterThan(ahora);
        }
    });

    it('todas las capturas caen dentro de la ventana de tolerancia y no se repiten instantes', () => {
        for (const s of SESIONES_DEMO) {
            const instantes = s.capturas.map((c) => c.segundo);
            expect(new Set(instantes).size).toBe(instantes.length);
            expect([...instantes].sort((a, b) => a - b)).toEqual(instantes);
            for (const c of s.capturas) {
                expect(c.segundo).toBeGreaterThan(0);
                expect(c.segundo).toBeLessThanOrEqual(PARAMETROS_DEMO.toleranciaMin * 60);
            }
        }
    });

    it('alterna las cámaras frente y fondo', () => {
        for (const s of SESIONES_DEMO) {
            expect(new Set(s.capturas.map((c) => c.camara))).toEqual(new Set(['frente', 'fondo']));
            s.capturas.forEach((c, i) => expect(c.camara).toBe(i % 2 === 0 ? 'frente' : 'fondo'));
        }
    });

    it('ningún alumno sale dos veces en la misma captura y todos son ordinales válidos', () => {
        for (const s of SESIONES_DEMO) {
            for (const c of s.capturas) {
                const ordinales = c.rostros.filter((r) => r.ordinal !== undefined).map((r) => r.ordinal);
                expect(new Set(ordinales).size).toBe(ordinales.length);
                for (const o of ordinales) {
                    expect(o).toBeGreaterThanOrEqual(1);
                    expect(o).toBeLessThanOrEqual(ALUMNOS_ACTIVOS);
                }
            }
        }
    });

    it('los scores están entre 0 y 1 y el orden de los rostros es estable (alumnos y luego extraños)', () => {
        for (const s of SESIONES_DEMO) {
            for (const c of s.capturas) {
                for (const r of c.rostros) {
                    if (r.score !== undefined) {
                        expect(r.score).toBeGreaterThan(0);
                        expect(r.score).toBeLessThanOrEqual(1);
                    }
                }
                const primerExtrano = c.rostros.findIndex((r) => r.extrano !== undefined);
                if (primerExtrano >= 0) {
                    expect(c.rostros.slice(primerExtrano).every((r) => r.extrano !== undefined)).toBe(true);
                }
            }
        }
    });

    it('es determinista', () => {
        expect(JSON.stringify(SESIONES_DEMO)).toBe(JSON.stringify(SESIONES_DEMO));
        expect(resumenEsperado(sabado)).toEqual(resumenEsperado(sabado));
    });
});

describe('resultado esperado al cerrar', () => {
    it('deja entre 6 y 8 pendientes en total, todos con 1 o 2 lecturas válidas', () => {
        const pendientes = SESIONES_DEMO.flatMap((s) => resumenEsperado(s).pendiente.map((o) => ({ s, o })));
        expect(pendientes.length).toBeGreaterThanOrEqual(6);
        expect(pendientes.length).toBeLessThanOrEqual(8);
        for (const { s, o } of pendientes) {
            const r = resultadoEsperado(s, o);
            expect(r.lecturasValidas).toBeGreaterThanOrEqual(1);
            expect(r.lecturasValidas).toBeLessThan(PARAMETROS_DEMO.minDetecciones);
        }
    });

    it('reparte presentes, retardos, pendientes y ausentes sin dejar a nadie fuera', () => {
        for (const s of SESIONES_DEMO) {
            const r = resumenEsperado(s);
            const total = r.presente.length + r.retardo.length + r.pendiente.length + r.ausente.length;
            expect(total).toBe(ALUMNOS_ACTIVOS);
            expect(r.presente.length).toBeGreaterThan(10);
            expect(r.retardo.length).toBe(2);
            expect(r.ausente.length).toBe(3);
            expect(r.pendiente.length).toBe(4);
        }
    });

    it('los confirmados tienen al menos 3 lecturas válidas y los ausentes ninguna', () => {
        for (const s of SESIONES_DEMO) {
            const r = resumenEsperado(s);
            for (const o of [...r.presente, ...r.retardo]) {
                expect(lecturasValidas(s, o).length).toBeGreaterThanOrEqual(PARAMETROS_DEMO.minDetecciones);
            }
            for (const o of r.ausente) expect(lecturasValidas(s, o)).toHaveLength(0);
        }
    });

    it('el estado lo decide la primera lectura válida, con el límite en 9:59 / 10:00 (RN-03)', () => {
        const dom = bySesion('reposicion-domingo');
        expect(resultadoEsperado(dom, 15)).toMatchObject({ estado: 'pendiente', primeraLecturaSeg: 599 });
        expect(resultadoEsperado(dom, 21)).toMatchObject({ estado: 'pendiente', primeraLecturaSeg: 600 });
        // Si esos dos alumnos completaran las lecturas, uno sería presente y el otro retardo.
        const completar = (ordinal, desde) => ({
            ...dom,
            capturas: dom.capturas.map((c, i) => (i >= desde && !c.rostros.some((r) => r.ordinal === ordinal)
                ? { ...c, rostros: [...c.rostros, { ordinal, score: 0.95 }] }
                : c)),
        });
        expect(resultadoEsperado(completar(15, 3), 15).estado).toBe('presente');
        expect(resultadoEsperado(completar(21, 4), 21).estado).toBe('retardo');
    });

    it('una lectura bajo el umbral no cuenta como válida', () => {
        const sab = bySesion('reposicion-sabado');
        // Ordinal 8: una lectura con 0.79 (no válida) y una con 0.874 (válida) -> 1 sola lectura válida.
        expect(sab.capturas.flatMap((c) => c.rostros).filter((r) => r.ordinal === 8)).toHaveLength(2);
        expect(resultadoEsperado(sab, 8)).toMatchObject({ estado: 'pendiente', lecturasValidas: 1 });
    });

    it('incluye rostros ajenos que ninguna plantilla reclama', () => {
        for (const s of SESIONES_DEMO) {
            expect(s.capturas.some((c) => c.rostros.some((r) => r.extrano !== undefined))).toBe(true);
        }
    });
});

describe('justificantes del guion', () => {
    it('apuntan a una falta o un retardo de la propia sesión del guion', () => {
        for (const j of JUSTIFICANTES_DEMO) {
            const s = bySesion(j.sesion);
            expect(s).toBeDefined();
            expect(['ausente', 'retardo']).toContain(resultadoEsperado(s, j.ordinal).estado);
            expect(['alumno', 'docente']).toContain(j.registradoPor);
            expect(j.motivo.length).toBeGreaterThan(0);
            expect(j.motivo.length).toBeLessThanOrEqual(200);
        }
    });

    it('un alumno registra solo los suyos: el ordinal debe tener cuenta (1..25)', () => {
        for (const j of JUSTIFICANTES_DEMO.filter((x) => x.registradoPor === 'alumno')) {
            expect(j.ordinal).toBeLessThanOrEqual(25);
        }
    });
});
