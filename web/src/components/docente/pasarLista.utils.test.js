import { describe, expect, it } from 'vitest';
import {
    aMinutos,
    detalleSesion,
    elegirProtagonista,
    esCandidata,
    faseSesion,
    hhmm,
    mensajeAperturaFallida,
    motivoSinCandidatas,
    ordenarSesiones,
    sesionesCandidatas,
    textoCamara,
    textoVentana,
    tituloSesion,
    urlPasarLista,
    urlSesion,
} from './pasarLista.utils.js';

const ses = (id, extra = {}) => ({
    id_sesion: id, materia: 'Finanzas', clave_grupo: '3A', aula: 'A-101', hora_inicio: '07:00:00', hora_fin: '08:00:00',
    estatus: 'programada', modo_previsto: 'automatico', camaras_activas: 1, abrible: false, ...extra,
});

describe('rutas del contrato', () => {
    it('urlSesion añade ?pasar-lista=1 solo cuando se llega a pasar lista', () => {
        expect(urlSesion(19)).toBe('/docente/sesiones/19');
        expect(urlSesion(19, { pasarLista: true })).toBe('/docente/sesiones/19?pasar-lista=1');
    });
    it('urlPasarLista lleva la sesión en ?sesion=', () => {
        expect(urlPasarLista(115)).toBe('/docente/pasar-lista?sesion=115');
    });
});

describe('formato', () => {
    it('hhmm recorta segundos y tolera vacíos', () => {
        expect(hhmm('07:00:00')).toBe('07:00');
        expect(hhmm(null)).toBe('-');
    });
    it('aMinutos lee HH:MM y HH:MM:SS; lo ilegible es null', () => {
        expect(aMinutos('07:12:00')).toBe(432);
        expect(aMinutos('7:05')).toBe(425);
        expect(aMinutos('')).toBeNull();
        expect(aMinutos(undefined)).toBeNull();
        expect(aMinutos('xx')).toBeNull();
    });
    it('título y detalle de la sesión', () => {
        expect(tituloSesion(ses(1))).toBe('Finanzas (3A)');
        expect(detalleSesion(ses(1))).toBe('07:00 - 08:00 · Aula A-101');
    });
});

describe('faseSesion', () => {
    it('abierta, cerrada y suspendida salen del estatus (una abierta trae abrible=false y sigue siendo abierta)', () => {
        expect(faseSesion(ses(1, { estatus: 'abierta', abrible: false }))).toBe('abierta');
        expect(faseSesion(ses(1, { estatus: 'cerrada' }))).toBe('cerrada');
        expect(faseSesion(ses(1, { estatus: 'suspendida' }))).toBe('suspendida');
    });
    it('programada: abrible, aún no (espera) o ya pasó (vencida)', () => {
        expect(faseSesion(ses(1, { abrible: true }), '07:12:00')).toBe('abrible');
        expect(faseSesion(ses(1), '06:30:00')).toBe('espera');
        expect(faseSesion(ses(1), '08:00:00')).toBe('vencida'); // la ventana es [inicio, fin): a las 08:00 ya no
        expect(faseSesion(ses(1), '09:15')).toBe('vencida');
    });
    it('sin hora del plantel, una programada no abrible se trata como «espera» (no se sabe si ya pasó)', () => {
        expect(faseSesion(ses(1))).toBe('espera');
        expect(faseSesion(ses(1), 'xx')).toBe('espera');
    });
});

describe('candidatas', () => {
    it('solo abierta o programada abrible; ordenadas por hora', () => {
        const lista = [
            ses(3, { hora_inicio: '09:00:00', hora_fin: '10:00:00', abrible: true }),
            ses(1, { estatus: 'cerrada' }),
            ses(2, { estatus: 'abierta', hora_inicio: '08:00:00', hora_fin: '09:00:00' }),
            ses(4, { hora_inicio: '12:00:00', hora_fin: '13:00:00' }),
        ];
        expect(sesionesCandidatas(lista, '09:10').map((s) => s.id_sesion)).toEqual([2, 3]);
        expect(esCandidata(lista[1])).toBe(false);
        expect(esCandidata(lista[2])).toBe(true);
    });
    it('ordenarSesiones no muta, desempata por id y tolera valores no lista', () => {
        const lista = [ses(5), ses(2)];
        expect(ordenarSesiones(lista).map((s) => s.id_sesion)).toEqual([2, 5]);
        expect(lista.map((s) => s.id_sesion)).toEqual([5, 2]);
        expect(ordenarSesiones(undefined)).toEqual([]);
    });
});

describe('elegirProtagonista: abierta > programada abrible > siguiente programada > última cerrada', () => {
    const cerrada = ses(1, { estatus: 'cerrada', hora_inicio: '07:00:00', hora_fin: '08:00:00' });
    const abierta = ses(2, { estatus: 'abierta', hora_inicio: '08:00:00', hora_fin: '09:00:00' });
    const abrible = ses(3, { abrible: true, hora_inicio: '09:00:00', hora_fin: '10:00:00' });
    const futura = ses(4, { hora_inicio: '11:00:00', hora_fin: '12:00:00' });
    const futura2 = ses(5, { hora_inicio: '13:00:00', hora_fin: '14:00:00' });

    it('sin sesiones: null', () => {
        expect(elegirProtagonista([], '08:00')).toBeNull();
        expect(elegirProtagonista(undefined, '08:00')).toBeNull();
    });
    it('la abierta gana a todo', () => {
        expect(elegirProtagonista([cerrada, futura, abrible, abierta], '09:05').id_sesion).toBe(2);
    });
    it('sin abierta, la programada abrible', () => {
        expect(elegirProtagonista([cerrada, futura, abrible], '09:05').id_sesion).toBe(3);
    });
    it('sin abierta ni abrible, la SIGUIENTE programada (la más próxima)', () => {
        expect(elegirProtagonista([futura2, cerrada, futura], '07:30').id_sesion).toBe(4);
    });
    it('si todo cerró, la última cerrada del día', () => {
        const otra = ses(6, { estatus: 'cerrada', hora_inicio: '10:00:00', hora_fin: '11:00:00' });
        expect(elegirProtagonista([cerrada, otra], '15:00').id_sesion).toBe(6);
    });
    it('una programada vencida no es «siguiente»: gana la última cerrada; sin cerradas, la última del día', () => {
        const vencida = ses(7, { hora_inicio: '07:00:00', hora_fin: '08:00:00' });
        expect(elegirProtagonista([vencida, ses(8, { estatus: 'cerrada', hora_inicio: '06:00:00', hora_fin: '06:50:00' })], '09:00').id_sesion).toBe(8);
        expect(elegirProtagonista([vencida], '09:00').id_sesion).toBe(7);
        expect(elegirProtagonista([ses(9, { estatus: 'suspendida' })], '09:00').id_sesion).toBe(9);
    });
});

describe('textoCamara', () => {
    it('programada: depende de las cámaras activas del aula', () => {
        expect(textoCamara(ses(1, { camaras_activas: 2 }))).toEqual({ conCamara: true, texto: 'Cámara del aula lista' });
        expect(textoCamara(ses(1, { camaras_activas: 0 }))).toEqual({ conCamara: false, texto: 'Sin cámara activa: se pasa lista a mano' });
    });
    it('abierta: depende del modo con el que se abrió', () => {
        expect(textoCamara(ses(1, { estatus: 'abierta', modo_previsto: 'automatico', camaras_activas: 0 })).conCamara).toBe(true);
        expect(textoCamara(ses(1, { estatus: 'abierta', modo_previsto: 'manual', camaras_activas: 3 })).conCamara).toBe(false);
    });
    it('cerrada o suspendida: no aplica', () => {
        expect(textoCamara(ses(1, { estatus: 'cerrada' }))).toBeNull();
        expect(textoCamara(ses(1, { estatus: 'suspendida' }))).toBeNull();
    });
});

describe('textoVentana (regla de api_abrir_sesion: solo dentro del horario)', () => {
    it('aún no es hora: «Disponible a las HH:MM» y la regla con la ventana', () => {
        expect(textoVentana(ses(1), '06:30:00')).toEqual({
            etiqueta: 'Disponible a las 07:00',
            regla: 'La sesión solo puede abrirse dentro de su horario, de 07:00 a 08:00.',
        });
    });
    it('ya pasó: «Terminó a las HH:MM»', () => {
        expect(textoVentana(ses(1), '08:30:00').etiqueta).toBe('Terminó a las 08:00');
    });
    it('sin hora del plantel: no afirma si es antes o después', () => {
        expect(textoVentana(ses(1), null).etiqueta).toBe('Disponible de 07:00 a 08:00');
    });
});

describe('motivoSinCandidatas', () => {
    it('sin sesiones hoy', () => {
        expect(motivoSinCandidatas([], '08:00')).toMatchObject({ clave: 'sin_clases', titulo: 'Hoy no tienes clases programadas' });
        expect(motivoSinCandidatas(undefined, '08:00').clave).toBe('sin_clases');
    });
    it('fuera de horario: aún no es hora, con la ventana de la siguiente', () => {
        const m = motivoSinCandidatas([ses(1, { hora_inicio: '11:00:00', hora_fin: '12:00:00' })], '07:12');
        expect(m.clave).toBe('fuera_de_horario');
        expect(m.descripcion).toContain('Finanzas (3A)');
        expect(m.descripcion).toContain('de 11:00 a 12:00');
    });
    it('horario vencido: no se abrió y ya no puede abrirse', () => {
        const m = motivoSinCandidatas([ses(1)], '09:00');
        expect(m.clave).toBe('vencida');
        expect(m.descripcion).toContain('ya no puede abrirse');
    });
    it('todo cerrado y solo suspendidas', () => {
        expect(motivoSinCandidatas([ses(1, { estatus: 'cerrada' })], '15:00').clave).toBe('todo_cerrado');
        expect(motivoSinCandidatas([ses(1, { estatus: 'suspendida' })], '15:00').clave).toBe('suspendidas');
    });
    it('precedencia: lo que viene después pesa más que lo vencido o cerrado', () => {
        const lista = [ses(1, { estatus: 'cerrada' }), ses(2, { hora_inicio: '05:00:00', hora_fin: '06:00:00' }), ses(3, { hora_inicio: '13:00:00', hora_fin: '14:00:00' })];
        expect(motivoSinCandidatas(lista, '07:00').clave).toBe('fuera_de_horario');
    });
});

describe('mensajeAperturaFallida', () => {
    it('FUERA_DE_HORARIO conserva el mensaje del servidor (trae la ventana) y se puede reintentar', () => {
        const m = mensajeAperturaFallida({ code: 'FUERA_DE_HORARIO', message: 'La sesión solo puede abrirse de 07:00 a 08:00 del 2026-09-14 (hora del plantel).' });
        expect(m).toMatchObject({ reintentable: true, verSesion: null });
        expect(m.descripcion).toContain('07:00 a 08:00');
    });
    it('SESION_CERRADA y SESION_SUSPENDIDA ofrecen ir a la sesión y no reintentar', () => {
        expect(mensajeAperturaFallida({ code: 'SESION_CERRADA', message: 'x' })).toMatchObject({ reintentable: false, verSesion: 'Ver resultados' });
        expect(mensajeAperturaFallida({ code: 'SESION_SUSPENDIDA', message: 'x' })).toMatchObject({ reintentable: false, verSesion: 'Ver sesión' });
    });
    it('NO_ENCONTRADO / NO_AUTORIZADO no se reintentan', () => {
        expect(mensajeAperturaFallida({ code: 'NO_AUTORIZADO', message: 'Sin permiso.' })).toMatchObject({ reintentable: false, descripcion: 'Sin permiso.' });
        expect(mensajeAperturaFallida({ code: 'NO_ENCONTRADO', message: 'No existe.' }).reintentable).toBe(false);
    });
    it('cualquier otro error (red, interno) se puede reintentar y siempre hay texto', () => {
        expect(mensajeAperturaFallida({ code: 'ERROR_RED', message: 'Sin conexión.' })).toMatchObject({ reintentable: true, descripcion: 'Sin conexión.' });
        const sinNada = mensajeAperturaFallida(null);
        expect(sinNada.reintentable).toBe(true);
        expect(sinNada.descripcion.length).toBeGreaterThan(10);
    });
});
