import { describe, expect, it } from 'vitest';
import {
    actividadReconocimiento,
    centroAsistencia,
    centroInscritos,
    cierreHabilitado,
    distribucionSesionAbierta,
    distribucionSesionCerrada,
    CLAVES_ACTIVIDAD,
    CLAVES_ASISTENCIA,
    estadoMostrado,
    formatearFecha,
    formatearHora,
    LECTURAS_REQUERIDAS,
    minutosParaCierre,
    mismosValores,
    motivoCierre,
    motivoRegistroManual,
    porcentajeAsistencia,
    presentesAhora,
    requiereRegistroManual,
    resumenActividad,
    sugerirEstado,
    textoHace,
} from './monitorSesion.utils.js';

describe('monitorSesion.utils', () => {
    it('formatea hora y fecha', () => {
        expect(formatearHora('07:00:00')).toBe('07:00');
        expect(formatearFecha('2026-09-14')).toBe('14 sep 2026');
    });
    it('sin registro muestra sin_lecturas', () => {
        expect(estadoMostrado({ estado: null })).toBe('sin_lecturas');
        expect(estadoMostrado({ estado: 'pendiente' })).toBe('pendiente');
    });
    it('registro manual solo sin consentimiento o sin lecturas validas', () => {
        expect(requiereRegistroManual({ inscripcion: 'activa', consentimiento_vigente: true, lecturas_validas: 3 })).toBe(false);
        expect(requiereRegistroManual({ inscripcion: 'activa', consentimiento_vigente: true, lecturas_validas: 0 })).toBe(true);
        expect(requiereRegistroManual({ inscripcion: 'activa', consentimiento_vigente: false, lecturas_validas: 3 })).toBe(true);
        expect(requiereRegistroManual({ inscripcion: 'baja', consentimiento_vigente: false, lecturas_validas: 0 })).toBe(false);
    });
    it('el motivo del registro manual prioriza el consentimiento y es null si no se ofrece', () => {
        expect(motivoRegistroManual({ inscripcion: 'activa', consentimiento_vigente: false, lecturas_validas: 0 })).toBe('Sin consentimiento vigente');
        expect(motivoRegistroManual({ inscripcion: 'activa', consentimiento_vigente: false, lecturas_validas: 3 })).toBe('Sin consentimiento vigente');
        expect(motivoRegistroManual({ inscripcion: 'activa', consentimiento_vigente: true, lecturas_validas: 0 })).toBe('Sin lecturas válidas');
        expect(motivoRegistroManual({ inscripcion: 'activa', consentimiento_vigente: true, lecturas_validas: 3 })).toBeNull();
        expect(motivoRegistroManual({ inscripcion: 'baja', consentimiento_vigente: false, lecturas_validas: 0 })).toBeNull();
        expect(motivoRegistroManual({ estado: 'presente', origen: 'manual', consentimiento_vigente: false })).toBeNull();
    });
    it('sugiere por minuto', () => {
        const s = { limite_presente_min: 10, tolerancia_min: 20 };
        expect(sugerirEstado({ ...s, minuto_actual: 5 })).toBe('presente');
        expect(sugerirEstado({ ...s, minuto_actual: 15 })).toBe('retardo');
        expect(sugerirEstado({ ...s, minuto_actual: 25 })).toBe('ausente');
    });
    it('cierre al terminar la ventana', () => {
        expect(cierreHabilitado({ estatus: 'abierta', en_ventana: true })).toBe(false);
        expect(cierreHabilitado({ estatus: 'abierta', en_ventana: false })).toBe(true);
        expect(cierreHabilitado({ estatus: 'cerrada', en_ventana: false })).toBe(false);
    });

    describe('comparacion de totales entre sondeos', () => {
        it('objetos distintos con los mismos valores son iguales; cualquier cifra distinta no', () => {
            const a = { inscritos: 30, presentes: 20, retardos: 4, sin_registro: 5, pendientes: 1 };
            expect(mismosValores(a, a, CLAVES_ASISTENCIA)).toBe(true);
            expect(mismosValores(a, { ...a }, CLAVES_ASISTENCIA)).toBe(true);
            expect(mismosValores(a, { ...a, presentes: 21 }, CLAVES_ASISTENCIA)).toBe(false);
        });
        it('solo cuentan las claves de cada gráfica', () => {
            const a = { presentes: 20, capturas: 12 };
            expect(mismosValores(a, { ...a, presentes: 25 }, CLAVES_ACTIVIDAD)).toBe(true);
            expect(mismosValores(a, { ...a, capturas: 13 }, CLAVES_ACTIVIDAD)).toBe(false);
        });
        it('tolera totales ausentes', () => {
            expect(mismosValores(undefined, {}, CLAVES_ASISTENCIA)).toBe(true);
            expect(mismosValores(undefined, { presentes: 1 }, CLAVES_ASISTENCIA)).toBe(false);
        });
    });

    describe('graficas de la sesion', () => {
        const totales = { inscritos: 30, presentes: 20, retardos: 4, sin_registro: 5, pendientes: 1, capturas: 12, detecciones: 40, detecciones_validas: 31 };
        it('distribuye los estados de la sesion abierta en orden fijo', () => {
            expect(distribucionSesionAbierta(totales)).toEqual([
                { clave: 'presente', valor: 20 },
                { clave: 'retardo', valor: 4 },
                { clave: 'sin_registro', valor: 5 },
                { clave: 'pendiente', valor: 1 },
            ]);
        });
        it('distribuye los estados de la sesion cerrada', () => {
            const d = distribucionSesionCerrada({ presentes: 10, retardos: 2, ausentes: 3, justificados: 1, pendientes: 0 });
            expect(d.map((x) => x.valor)).toEqual([10, 2, 3, 1, 0]);
            expect(d.map((x) => x.clave)).toEqual(['presente', 'retardo', 'ausente', 'justificado', 'pendiente']);
        });
        it('sin totales o con valores raros todo es cero', () => {
            expect(distribucionSesionAbierta(undefined).every((d) => d.valor === 0)).toBe(true);
            expect(distribucionSesionCerrada({ presentes: 'x', retardos: -3 }).every((d) => d.valor === 0)).toBe(true);
        });
        it('calcula el porcentaje de asistencia con retardos y sin dividir entre cero', () => {
            expect(porcentajeAsistencia(totales)).toBe(80);
            expect(porcentajeAsistencia({ inscritos: 0, presentes: 3 })).toBe(0);
            expect(porcentajeAsistencia(undefined)).toBe(0);
            expect(centroAsistencia(totales)).toEqual({ valor: '80 %', etiqueta: 'asistencia' });
        });
        it('el medidor «Presentes ahora» cuenta presentes y retardos sobre inscritos, con su línea de apoyo', () => {
            expect(presentesAhora(totales)).toEqual({ valor: 80, asistentes: 24, inscritos: 30, descripcion: '24 de 30 inscritos' });
            expect(presentesAhora({ inscritos: 3, presentes: 1 })).toMatchObject({ valor: 33, descripcion: '1 de 3 inscritos' });
        });
        it('sin inscritos (o con totales ausentes o raros) no hay medidor', () => {
            expect(presentesAhora(undefined)).toBeNull();
            expect(presentesAhora({})).toBeNull();
            expect(presentesAhora({ inscritos: 0, presentes: 3 })).toBeNull();
            expect(presentesAhora({ inscritos: 'x', presentes: 3 })).toBeNull();
        });
        it('el medidor nunca pasa de 100 aunque los totales lleguen inconsistentes', () => {
            expect(presentesAhora({ inscritos: 4, presentes: 4, retardos: 2 }).valor).toBe(100);
        });
        it('el centro del anillo en curso lleva los inscritos (el % lo dice el medidor)', () => {
            expect(centroInscritos(totales)).toEqual({ valor: 30, etiqueta: 'Inscritos' });
            expect(centroInscritos(undefined)).toEqual({ valor: 0, etiqueta: 'Inscritos' });
        });
        it('arma la actividad de reconocimiento y devuelve vacio sin actividad', () => {
            const f = actividadReconocimiento(totales);
            expect(f).toEqual([{ etapa: 'Capturas', cantidad: 12 }, { etapa: 'Detecciones', cantidad: 40 }, { etapa: 'Det. válidas', cantidad: 31 }]);
            expect(resumenActividad(f)).toBe('Capturas: 12; Detecciones: 40; Det. válidas: 31');
            expect(actividadReconocimiento({ capturas: 0, detecciones: 0 })).toEqual([]);
            expect(resumenActividad([])).toBe('Aún no hay capturas ni detecciones.');
        });
    });

    describe('cierre de la sesión', () => {
        const abierta = { estatus: 'abierta', en_ventana: true, tolerancia_min: 20, minuto_actual: 5.5 };
        it('los minutos que faltan se redondean hacia arriba y nunca bajan de 1', () => {
            expect(minutosParaCierre(abierta)).toBe(15);
            expect(minutosParaCierre({ ...abierta, minuto_actual: 19.99 })).toBe(1);
            expect(minutosParaCierre({ ...abierta, minuto_actual: 25 })).toBe(1);
        });
        it('sin minuto o sin tolerancia no se inventa una cuenta (null no es el minuto 0)', () => {
            expect(minutosParaCierre({ ...abierta, minuto_actual: null })).toBeNull();
            expect(minutosParaCierre({ ...abierta, minuto_actual: undefined })).toBeNull();
            expect(minutosParaCierre({ ...abierta, tolerancia_min: null })).toBeNull();
            expect(minutosParaCierre(undefined)).toBeNull();
        });
        it('el motivo dice cuánto falta; en singular con 1 min', () => {
            expect(motivoCierre(abierta)).toBe('El cierre se habilita al terminar la tolerancia: faltan 15 min.');
            expect(motivoCierre({ ...abierta, minuto_actual: 19.5 })).toBe('El cierre se habilita al terminar la tolerancia: falta 1 min.');
        });
        it('sin minuto conocido el motivo cita la tolerancia; sin ella, solo la regla', () => {
            expect(motivoCierre({ ...abierta, minuto_actual: null })).toBe('El cierre se habilita al terminar la tolerancia (20 min).');
            expect(motivoCierre({ ...abierta, minuto_actual: null, tolerancia_min: null })).toBe('El cierre se habilita al terminar la tolerancia.');
        });
        it('no hay motivo cuando ya se puede cerrar ni cuando la sesión no está abierta', () => {
            expect(motivoCierre({ ...abierta, en_ventana: false })).toBeNull();
            expect(motivoCierre({ ...abierta, estatus: 'cerrada' })).toBeNull();
            expect(motivoCierre({ ...abierta, estatus: 'programada' })).toBeNull();
        });
        it('el mínimo de lecturas que confirman es el del servidor', () => {
            expect(LECTURAS_REQUERIDAS).toBe(3);
        });
    });

    describe('textoHace', () => {
        it('segundos, minutos y horas; un reloj atrasado no da negativos', () => {
            expect(textoHace(0)).toBe('hace 0 s');
            expect(textoHace(8.9)).toBe('hace 8 s');
            expect(textoHace(59)).toBe('hace 59 s');
            expect(textoHace(60)).toBe('hace 1 min');
            expect(textoHace(185)).toBe('hace 3 min');
            expect(textoHace(7300)).toBe('hace 2 h');
            expect(textoHace(-4)).toBe('hace 0 s');
            expect(textoHace(undefined)).toBe('hace 0 s');
        });
    });
});
