import { describe, expect, it } from 'vitest';
import {
    aunNoInicia,
    cambioElEstado,
    conteoTexto,
    esCancelable,
    etiquetaLaboratorio,
    formatoMomento,
    normalizarAhora,
    ocupacion,
    unirPaginas,
} from './laboratoriosAdmin.utils.js';

describe('etiquetaLaboratorio y conteoTexto', () => {
    it('une clave y edificio, y tolera datos faltantes', () => {
        expect(etiquetaLaboratorio({ clave: 'LAB-1', edificio: 'C' })).toBe('LAB-1 · C');
        expect(etiquetaLaboratorio({ clave: 'LAB-1' })).toBe('LAB-1');
        expect(etiquetaLaboratorio(null)).toBe('Laboratorio');
    });

    it('conteoTexto concuerda en singular y plural', () => {
        expect(conteoTexto(1, 'solicitud', 'solicitudes')).toBe('1 solicitud');
        expect(conteoTexto(0, 'solicitud', 'solicitudes')).toBe('0 solicitudes');
        expect(conteoTexto(3, 'solicitud', 'solicitudes')).toBe('3 solicitudes');
    });
});

describe('ocupacion', () => {
    it('escribe inscritos de lugares y marca cuando el grupo no cabe', () => {
        expect(ocupacion({ inscritos: 28 }, { capacidad: 30 })).toMatchObject({ texto: '28 alumnos de 30 lugares', excede: false });
        expect(ocupacion({ inscritos: 31 }, { capacidad: 30 }).excede).toBe(true);
        expect(ocupacion({ inscritos: 30 }, { capacidad: 30 }).excede).toBe(false);
        expect(ocupacion({ inscritos: 1 }, { capacidad: 1 }).texto).toBe('1 alumno de 1 lugar');
    });

    it('sin datos no inventa un exceso', () => {
        expect(ocupacion(null, null)).toMatchObject({ inscritos: 0, capacidad: 0, excede: false });
    });
});

describe('normalizarAhora', () => {
    it('recorta la hora a HH:MM y rechaza lo que no es una fecha de negocio', () => {
        expect(normalizarAhora({ fecha: '2026-09-14', hora: '07:12:00' })).toEqual({ fecha: '2026-09-14', hora: '07:12' });
        expect(normalizarAhora({ fecha: '2026-09-14', hora: 'x' })).toEqual({ fecha: '2026-09-14', hora: null });
        expect(normalizarAhora({ fecha: 'mañana', hora: '07:12' })).toBeNull();
        expect(normalizarAhora(null)).toBeNull();
    });
});

describe('aunNoInicia y esCancelable', () => {
    const ahora = { fecha: '2026-09-14', hora: '10:00' };

    it('compara fecha y luego hora: empezó si el inicio es menor o igual al ahora', () => {
        expect(aunNoInicia('2026-09-15', '07:00', ahora)).toBe(true);
        expect(aunNoInicia('2026-09-13', '23:00', ahora)).toBe(false);
        expect(aunNoInicia('2026-09-14', '10:30', ahora)).toBe(true);
        expect(aunNoInicia('2026-09-14', '10:00', ahora)).toBe(false);
        expect(aunNoInicia('2026-09-14', '09:00', ahora)).toBe(false);
    });

    it('sin reloj conocido deja decidir al servidor', () => {
        expect(aunNoInicia('2020-01-01', '07:00', null)).toBe(true);
        expect(aunNoInicia('2026-09-14', '07:00', { fecha: '2026-09-14', hora: null })).toBe(true);
    });

    it('solo una aprobada que no ha iniciado se puede cancelar', () => {
        const base = { fecha: '2026-09-15', hora_inicio: '08:00' };
        expect(esCancelable({ ...base, estatus: 'aprobada' }, ahora)).toBe(true);
        expect(esCancelable({ ...base, estatus: 'pendiente' }, ahora)).toBe(false);
        expect(esCancelable({ ...base, estatus: 'rechazada' }, ahora)).toBe(false);
        expect(esCancelable({ ...base, estatus: 'cancelada' }, ahora)).toBe(false);
        expect(esCancelable({ estatus: 'aprobada', fecha: '2026-09-14', hora_inicio: '09:00' }, ahora)).toBe(false);
        expect(esCancelable(null, ahora)).toBe(false);
    });
});

describe('unirPaginas', () => {
    it('conserva el orden y no repite una solicitud que aparece en dos páginas', () => {
        const a = { id_solicitud: 1 };
        const b = { id_solicitud: 2 };
        const c = { id_solicitud: 3 };
        expect(unirPaginas([a, b], [b, c])).toEqual([a, b, c]);
        expect(unirPaginas(undefined, undefined)).toEqual([]);
    });
});

describe('formatoMomento', () => {
    it('muestra el instante en la zona de la sede, no en la del navegador', () => {
        // 13:12 UTC son las 07:12 en la Ciudad de México (UTC-6, sin horario de verano desde 2022).
        expect(formatoMomento('2026-09-14T13:12:00+00:00')).toBe('lun 14 sep, 07:12');
        // 03:30 UTC del 15 aún es el 14 por la noche en la sede.
        expect(formatoMomento('2026-09-15T03:30:00Z')).toBe('lun 14 sep, 21:30');
    });

    it('agrega el año cuando no es el actual y tolera valores vacíos o inválidos', () => {
        expect(formatoMomento('2027-01-04T18:00:00Z', '2026-12-30')).toBe('lun 4 ene 2027, 12:00');
        expect(formatoMomento(null)).toBe('—');
        expect(formatoMomento('basura')).toBe('—');
    });
});

describe('cambioElEstado', () => {
    it('reconoce los errores que piden recargar y no los de captura', () => {
        for (const code of ['LAB_OCUPADO', 'SOLICITUD_VENCIDA', 'SOLICITUD_YA_RESUELTA', 'LAB_CAPACIDAD_INSUFICIENTE', 'NO_ENCONTRADO']) {
            expect(cambioElEstado({ code })).toBe(true);
        }
        expect(cambioElEstado({ code: 'VALIDACION' })).toBe(false);
        expect(cambioElEstado({ code: 'ERROR_RED' })).toBe(false);
        expect(cambioElEstado(null)).toBe(false);
    });
});
