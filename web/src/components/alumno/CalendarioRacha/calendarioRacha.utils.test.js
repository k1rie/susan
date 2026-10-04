import { describe, expect, it } from 'vitest';
import { SEMANAS_CALENDARIO, anchoMaximoCalendario, datosCalendario, descripcionCalendario, resumenCalendario, textoMejorRacha, textoRacha } from './calendarioRacha.utils.js';

const s = (fecha, estado, estatus_sesion = 'cerrada') => ({ fecha, estado, estatus_sesion });

// Como llegan de api_alumno_historial: la más reciente primero.
const ITEMS = [
    s('2026-10-02', 'presente'),
    s('2026-09-30', 'retardo'),
    s('2026-09-28', 'presente'),
    s('2026-09-25', 'ausente'),
    s('2026-09-23', 'presente'),
    s('2026-09-21', 'presente'),
    s('2026-09-18', 'justificado'),
    s('2026-09-16', 'presente'),
    s('2026-09-14', 'presente'),
];

describe('textoRacha / textoMejorRacha', () => {
    it('singular, plural y sin racha', () => {
        expect(textoRacha(1)).toBe('Racha de 1 sesión');
        expect(textoRacha(12)).toBe('Racha de 12 sesiones');
        expect(textoRacha(0)).toBe('Sin racha activa');
        expect(textoRacha(undefined)).toBe('Sin racha activa');
        expect(textoRacha(-4)).toBe('Sin racha activa');
    });
    it('«Mejor racha N» solo si hubo alguna', () => {
        expect(textoMejorRacha(9)).toBe('Mejor racha 9');
        expect(textoMejorRacha(0)).toBeNull();
        expect(textoMejorRacha(null)).toBeNull();
    });
});

describe('datosCalendario', () => {
    it('calcula racha actual y mejor con sesiones reales (la justificada no corta ni suma)', () => {
        const d = datosCalendario(ITEMS);
        expect(d.vacio).toBe(false);
        expect(d.racha).toEqual({ actual: 3, mejor: 4 });
        expect(d.cuentas).toEqual({ presente: 6, retardo: 1, ausente: 1, justificado: 1 });
        expect(d.recortado).toBe(false);
    });
    it('sin sesiones es vacío', () => {
        expect(datosCalendario([]).vacio).toBe(true);
        expect(datosCalendario(undefined).vacio).toBe(true);
        expect(datosCalendario([{ fecha: 'no-es-fecha', estado: 'presente' }]).vacio).toBe(true);
    });
    it('una clase abierta sin registro ni suspendida corta la racha, una cerrada sin registro sí', () => {
        const abierta = [s('2026-10-05', null, 'abierta'), s('2026-10-02', 'presente'), s('2026-09-30', 'presente')];
        expect(datosCalendario(abierta).racha.actual).toBe(2);
        const suspendida = [s('2026-10-05', null, 'suspendida'), s('2026-10-02', 'presente')];
        expect(datosCalendario(suspendida).racha.actual).toBe(1);
        const cerradaSinRegistro = [s('2026-10-05', null, 'cerrada'), s('2026-10-02', 'presente')];
        expect(datosCalendario(cerradaSinRegistro).racha.actual).toBe(0);
    });
    it('con más de 26 semanas marca el recorte', () => {
        const largo = [s('2026-01-05', 'presente'), s('2026-10-02', 'presente')];
        expect(datosCalendario(largo).recortado).toBe(true);
        expect(SEMANAS_CALENDARIO).toBe(26);
    });
});

describe('anchoMaximoCalendario', () => {
    it('limita cada casilla a ~28 px: columna de días + semanas x (casilla + separación)', () => {
        expect(anchoMaximoCalendario(16)).toBe('calc(1.75rem + 16 * (1.75rem + 3px))');
    });
    it('con un valor raro cuenta al menos una semana', () => {
        expect(anchoMaximoCalendario(0)).toBe('calc(1.75rem + 1 * (1.75rem + 3px))');
        expect(anchoMaximoCalendario(undefined)).toBe('calc(1.75rem + 1 * (1.75rem + 3px))');
        expect(anchoMaximoCalendario(3.9)).toBe('calc(1.75rem + 3 * (1.75rem + 3px))');
    });
    it('datosCalendario trae las semanas dibujadas', () => {
        expect(datosCalendario(ITEMS).semanas).toBe(3);
        expect(datosCalendario([]).semanas).toBe(0);
    });
});

describe('descripcionCalendario', () => {
    it('dice lo que es cada cuadro y, si se recortó, las semanas que se ven', () => {
        expect(descripcionCalendario({ vacio: false, recortado: false })).toBe('Cada cuadro es una sesión');
        expect(descripcionCalendario({ vacio: false, recortado: true })).toBe('Cada cuadro es una sesión · últimas 26 semanas');
        expect(descripcionCalendario({ vacio: true, recortado: false })).toMatch(/casilla por cada sesión/);
    });
});

describe('resumenCalendario', () => {
    it('texto alternativo con cada estado, la racha y la mejor racha', () => {
        expect(resumenCalendario({ materia: 'Álgebra', ...datosCalendario(ITEMS) })).toBe(
            'Calendario de asistencia de Álgebra: 9 sesiones (Presentes 6, Retardos 1, Ausencias 1, Justificadas 1). Racha de 3 sesiones. Mejor racha 4.',
        );
    });
    it('sin racha activa lo dice, y sin materia no la nombra', () => {
        const items = [s('2026-10-02', 'ausente'), s('2026-09-30', 'presente')];
        expect(resumenCalendario(datosCalendario(items))).toBe('Calendario de asistencia: 2 sesiones (Presentes 1, Ausencias 1). Sin racha activa. Mejor racha 1.');
    });
    it('incluye sin registro y suspendidas al final y el aviso del recorte', () => {
        const items = [s('2026-01-05', 'presente'), s('2026-09-30', null), s('2026-10-02', null, 'suspendida')];
        const texto = resumenCalendario(datosCalendario(items));
        expect(texto).toContain('(Presentes 1, Sin registro 1, Suspendidas 1)');
        expect(texto).toContain('Se muestran las últimas 26 semanas.');
    });
    it('vacío: lo dice en una frase', () => {
        expect(resumenCalendario({ materia: 'Álgebra', ...datosCalendario([]) })).toBe('Calendario de asistencia de Álgebra: aún no hay sesiones registradas.');
    });
});
