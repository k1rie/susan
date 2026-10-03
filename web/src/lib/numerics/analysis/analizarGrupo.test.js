import { describe, expect, it } from 'vitest';
import { analizarGrupo } from './index.js';

const LUNES0 = Date.UTC(2026, 7, 17); // 2026-08-17 es lunes
const fechaDe = (semana, dia) => new Date(LUNES0 + ((semana - 1) * 7 + (dia - 1)) * 86400000).toISOString().slice(0, 10);

/** 3 sesiones por semana (lun, mié, vie); `ausentesPorSemana(w)` ausentes por sesión. */
function serieSintetica(semanas, ausentesPorSemana, inscritos = 100, retardos = 0) {
    const items = [];
    for (let w = 1; w <= semanas; w += 1) {
        for (const dia of [1, 3, 5]) {
            items.push({
                id_sesion: items.length + 1, fecha: fechaDe(w, dia), semana_iso: 34 + w - 1, dia_semana: dia, inscritos,
                presentes: inscritos - ausentesPorSemana(w) - retardos, retardos, ausentes: ausentesPorSemana(w), justificados: 0, pendientes: 0,
                tasa_ausentismo: ausentesPorSemana(w) / inscritos,
            });
        }
    }
    return items;
}

describe('analizarGrupo: tendencia creciente', () => {
    // tasa semanal = 0.10 + 0.03 (w - 1); acumulado % = 0.09375 w² + 0.53125 w (48 sesiones programadas)
    const serie = serieSintetica(6, (w) => 10 + 3 * (w - 1));
    const a = analizarGrupo({ serie, limitePct: 20, sesionesProgramadas: 48, retardosPorAusencia: 3 });

    it('estima la pendiente y la dirección', () => {
        expect(a.resumen.suficiente).toBe(true);
        expect(a.tendencia.pendientePuntosPorSemana).toBeCloseTo(3, 6);
        expect(a.tendencia.direccion).toBe('alza');
        expect(a.resumen.tasaActual).toBeCloseTo(25, 8);
        expect(a.resumen.variacionPP).toBeCloseTo(3, 8);
    });

    it('la proyección cruza el 20 % en la semana esperada', () => {
        const raiz = (-0.53125 + Math.sqrt(0.53125 ** 2 + 4 * 0.09375 * 20)) / (2 * 0.09375);
        expect(a.cruceLimite.estado).toBe('cruza');
        expect(a.cruceLimite.t).toBeCloseTo(raiz, 5);
        expect(a.cruceLimite.semana).toBe(Math.ceil(raiz - 1e-6));
        expect(a.cruceLimite.mensaje).toBe(`Semana ${a.cruceLimite.semana} (estimada)`);
        expect(a.cruceLimite.grado).toBe(2);
        expect(a.alertas.some((x) => x.codigo === 'TENDENCIA_AL_ALZA')).toBe(true);
        expect(a.alertas.some((x) => x.codigo === 'CRUCE_PROYECTADO')).toBe(true);
    });

    it('proyecta con intervalo y entrega procedimientos con trazas', () => {
        expect(a.proyeccion.disponible).toBe(true);
        expect(a.proyeccion.puntos.length).toBe(10);
        const ultimo = a.proyeccion.puntos.at(-1);
        expect(ultimo.valor).toBeCloseTo(0.55, 4);
        const ids = a.procedimientos.map((p) => p.id);
        expect(ids).toEqual(expect.arrayContaining(['regresion', 'suavizado', 'proyeccion', 'cruce-biseccion', 'cruce-newton', 'riesgo']));
        const bis = a.procedimientos.find((p) => p.id === 'cruce-biseccion');
        expect(Object.keys(bis.traza[0])).toEqual(['iter', 'x', 'fx', 'error']);
        expect(a.suavizado.sma.length).toBe(6);
    });

    it('es JSON serializable y determinista', () => {
        const otra = analizarGrupo({ serie, limitePct: 20, sesionesProgramadas: 48, retardosPorAusencia: 3 });
        expect(JSON.stringify(otra)).toBe(JSON.stringify(a));
    });
});

describe('analizarGrupo: serie plana', () => {
    const serie = serieSintetica(8, () => 3);
    const a = analizarGrupo({ serie, sesionesProgramadas: 48 });

    it('no cruza el límite y la tendencia es estable', () => {
        expect(a.cruceLimite.estado).toBe('no_cruza');
        expect(a.cruceLimite.mensaje).toBe('No cruza dentro del periodo');
        expect(a.tendencia.direccion).toBe('estable');
        expect(a.tendencia.pendientePuntosPorSemana).toBeCloseTo(0, 8);
        expect(a.cambios.semanaCambio).toBeNull();
        expect(a.alertas.some((x) => x.codigo === 'CRUCE_PROYECTADO')).toBe(false);
    });
});

describe('analizarGrupo: cruce con tasa constante', () => {
    it('25 % semanal con 3 sesiones por semana cruza en la semana 13', () => {
        const a = analizarGrupo({ serie: serieSintetica(8, () => 25), sesionesProgramadas: 48 });
        // acumulado = 1.5625 % por semana -> 20 % en t = 12.8
        expect(a.cruceLimite.t).toBeCloseTo(12.8, 5);
        expect(a.cruceLimite.semana).toBe(13);
    });

    it('detecta el límite ya superado', () => {
        const a = analizarGrupo({ serie: serieSintetica(6, () => 60), sesionesProgramadas: 48 });
        expect(a.cruceLimite.estado).toBe('superado');
        expect(a.cruceLimite.mensaje).toBe('Ya superado');
        expect(a.alertas[0].nivel).toBe('alta');
    });
});

describe('analizarGrupo: cambio de nivel', () => {
    it('detecta un salto de la tasa semanal', () => {
        const ruido = [0, 1, -1, 1, 0, -1, 1, 0, -1, 0, 1, -1];
        const serie = serieSintetica(12, (w) => (w <= 6 ? 5 : 15) + ruido[w - 1], 200);
        const a = analizarGrupo({ serie, sesionesProgramadas: 48 });
        expect(a.cambios.disponible).toBe(true);
        expect(a.cambios.direccion).toBe('alza');
        expect(a.cambios.semanaCambio).toBeGreaterThanOrEqual(6);
        expect(a.cambios.semanaCambio).toBeLessThanOrEqual(8);
        expect(a.procedimientos.some((p) => p.id === 'cambio-nivel')).toBe(true);
    });
});

describe('analizarGrupo: robustez', () => {
    it('serie corta (< 4 semanas) degrada con aviso y no lanza', () => {
        const a = analizarGrupo({ serie: serieSintetica(3, () => 5), sesionesProgramadas: 48 });
        expect(a.resumen.suficiente).toBe(false);
        expect(a.alertas[0].codigo).toBe('DATOS_INSUFICIENTES');
        expect(a.cruceLimite.estado).toBe('insuficiente');
        expect(a.cruceLimite.mensaje).toBe('Datos insuficientes');
        expect(a.proyeccion.disponible).toBe(false);
        expect(a.proyeccion.mensaje).toMatch(/al menos 4 semanas/);
        expect(a.patronSemanal.dias.length).toBe(3);
    });

    it('entradas vacías o raras no lanzan', () => {
        for (const serie of [[], null, undefined, 'x', { sesiones: [] }]) {
            const a = analizarGrupo({ serie });
            expect(a.resumen.suficiente).toBe(false);
            expect(a.alumnosEnRiesgo).toEqual([]);
        }
        expect(analizarGrupo({}).alertas.length).toBeGreaterThan(0);
    });

    it('grupo sin ausencias', () => {
        const a = analizarGrupo({ serie: serieSintetica(6, () => 0), sesionesProgramadas: 48 });
        expect(a.resumen.tasaActual).toBe(0);
        expect(a.cruceLimite.estado).toBe('no_cruza');
        expect(a.patronSemanal.diaCritico).toBeNull();
        expect(a.alertas.some((x) => x.codigo === 'SIN_AUSENCIAS')).toBe(true);
    });

    it('semana sin clase (hueco) se rellena y se avisa; sesiones inválidas se descartan', () => {
        const base = serieSintetica(6, (w) => 5 + w).filter((s) => !(s.fecha >= fechaDe(3, 1) && s.fecha <= fechaDe(3, 7)));
        base.push({ fecha: 'mala', inscritos: 10, ausentes: 1 }, { fecha: fechaDe(2, 2), inscritos: null, ausentes: 1 });
        const a = analizarGrupo({ serie: base, sesionesProgramadas: 48 });
        expect(a.suavizado.rellenadas).toEqual([3]);
        expect(a.tendencia.tasas[2]).toBeNull();
        expect(a.suavizado.tasasRellenas[2]).not.toBeNull();
        expect(a.alertas.some((x) => x.codigo === 'DATOS_FALTANTES')).toBe(true);
        expect(a.resumen.semanasConDatos).toBe(5);
    });

    it('acepta opciones.retardosPorAusencia (forma de la pantalla) y objeto con items', () => {
        const items = serieSintetica(5, () => 2, 100, 3);
        const a = analizarGrupo({ serie: { items }, sesionesProgramadas: 48, opciones: { retardosPorAusencia: 2 } });
        expect(a.resumen.retardosPorAusencia).toBe(2);
        // retardos: (2 + 3/2)/100 por sesión
        expect(a.resumen.acumuladoActualPct).toBeCloseTo((100 * 15 * 0.035) / 48, 8);
    });

    it('argumentos inválidos lanzan error', () => {
        expect(() => analizarGrupo(null)).toThrow(TypeError);
        expect(() => analizarGrupo({ serie: [], limitePct: 0 })).toThrow(RangeError);
        expect(() => analizarGrupo({ serie: [], retardosPorAusencia: 0 })).toThrow(RangeError);
    });

    it('analiza el riesgo de la matriz y el patrón por día', () => {
        const serie = serieSintetica(2, () => 10);
        const fechas = serie.map((s) => s.fecha);
        const matriz = {
            fechas,
            alumnos: [
                { id_alumno: 1, matricula: 'A1', nombre: 'Ana', estados: fechas.map(() => 'presente') },
                { id_alumno: 2, matricula: 'A2', nombre: 'Beto', estados: fechas.map((_, i) => (i >= 2 ? 'ausente' : 'presente')) },
                { id_alumno: 3, matricula: 'A3', nombre: 'Carla', estados: fechas.map((_, i) => (i === 0 ? null : 'presente')) },
            ],
        };
        const a = analizarGrupo({ serie, matriz, sesionesProgramadas: 12 });
        expect(a.alumnosEnRiesgo.length).toBe(1);
        expect(a.alumnosEnRiesgo[0].nombre).toBe('Beto');
        expect(a.alumnosEnRiesgo[0].idAlumno).toBe(2);
        expect(a.resumen.alumnosSuperanLimite).toBe(1);
        expect(a.alertas.some((x) => x.codigo === 'ALUMNOS_SUPERAN_LIMITE')).toBe(true);
        expect(a.alumnosEnRiesgo[0].pasos[0].tabla.filas.length).toBe(7);
    });
});
