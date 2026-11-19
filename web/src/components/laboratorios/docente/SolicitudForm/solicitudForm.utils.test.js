import { describe, expect, it } from 'vitest';
import {
    argumentosAgenda,
    ATAJOS_FECHA,
    avisoCapacidad,
    avisoTraslape,
    datosSolicitud,
    errorDeCampoSolicitud,
    INICIAL_SOLICITUD,
    opcionesGrupo,
    opcionesLaboratorio,
    reglasDe,
    traslapes,
    validarSolicitud,
} from './solicitudForm.utils.js';

// Reloj de la demostración: lunes 14-sep-2026 07:12, con los parámetros del sistema por omisión (24 h y 60 días).
const RELOJ = { hoy: '2026-09-14', hora: '07:12' };
const reglas = reglasDe(RELOJ, { lab_anticipacion_horas: 24, lab_horizonte_dias: 60 });

const valida = {
    id_aula: '3',
    id_grupo: '1',
    fecha: '2026-09-17',
    hora_inicio: '10:00',
    hora_fin: '12:00',
    actividad: 'Práctica de balanza de comprobación',
};

describe('reglasDe', () => {
    it('calcula el primer instante (ahora + anticipación) y el último día (hoy + horizonte)', () => {
        expect(reglas.primero).toEqual({ fecha: '2026-09-15', hora: '07:12' });
        expect(reglas.fechaMaxima).toBe('2026-11-13');
        expect(reglas.anticipacionHoras).toBe(24);
        expect(reglas.horizonteDias).toBe(60);
    });

    it('cruza la medianoche cuando la anticipación no es múltiplo de 24 horas', () => {
        const r = reglasDe({ hoy: '2026-09-14', hora: '22:30' }, { lab_anticipacion_horas: 36, lab_horizonte_dias: 30 });
        expect(r.primero).toEqual({ fecha: '2026-09-16', hora: '10:30' });
    });

    it('sin parámetros (o con basura) usa 24 horas y 60 días', () => {
        expect(reglasDe(RELOJ, null)).toMatchObject({ anticipacionHoras: 24, horizonteDias: 60 });
        expect(reglasDe(RELOJ, { lab_anticipacion_horas: 'x', lab_horizonte_dias: -3 })).toMatchObject({ anticipacionHoras: 24, horizonteDias: 60 });
    });

    it('acepta los parámetros como texto numérico', () => {
        expect(reglasDe(RELOJ, { lab_anticipacion_horas: '48', lab_horizonte_dias: '10' })).toMatchObject({ anticipacionHoras: 48, horizonteDias: 10, fechaMaxima: '2026-09-24' });
    });
});

describe('validarSolicitud', () => {
    it('una solicitud completa y dentro de las reglas no tiene errores', () => {
        expect(validarSolicitud(valida, reglas)).toEqual({});
    });

    it('un formulario vacío pide todo', () => {
        const e = validarSolicitud(INICIAL_SOLICITUD, reglas);
        expect(Object.keys(e).sort()).toEqual(['actividad', 'fecha', 'hora_fin', 'hora_inicio', 'id_aula', 'id_grupo']);
        expect(e.id_aula).toBe('Elige el laboratorio.');
        expect(e.id_grupo).toBe('Elige el grupo.');
    });

    it('rechaza una fecha pasada, la de hoy (por la anticipación) y la que excede el horizonte', () => {
        expect(validarSolicitud({ ...valida, fecha: '2026-09-10' }, reglas).fecha).toBe('La fecha ya pasó.');
        expect(validarSolicitud({ ...valida, fecha: '2026-09-14' }, reglas).fecha).toBe('Solicita el laboratorio con al menos 24 horas de anticipación.');
        expect(validarSolicitud({ ...valida, fecha: '2026-11-14' }, reglas).fecha).toBe('Solo se puede solicitar con hasta 60 días de anticipación.');
        expect(validarSolicitud({ ...valida, fecha: '2026-11-13' }, reglas).fecha).toBeUndefined();
        expect(validarSolicitud({ ...valida, fecha: '2026-02-31' }, reglas).fecha).toBe('La fecha no es válida.');
    });

    it('el día límite de la anticipación dice desde qué hora se puede empezar', () => {
        const e = validarSolicitud({ ...valida, fecha: '2026-09-15', hora_inicio: '07:00', hora_fin: '09:00' }, reglas);
        expect(e.hora_inicio).toBe('Ese día solo puedes empezar desde las 07:12 (se pide con al menos 24 horas de anticipación).');
        const ok = validarSolicitud({ ...valida, fecha: '2026-09-15', hora_inicio: '07:12', hora_fin: '09:00' }, reglas);
        expect(ok.hora_inicio).toBeUndefined();
    });

    it('la hora de fin debe ser posterior y la duración, de 30 minutos a 8 horas', () => {
        expect(validarSolicitud({ ...valida, hora_fin: '10:00' }, reglas).hora_fin).toBe('La hora de fin debe ser posterior a la de inicio.');
        expect(validarSolicitud({ ...valida, hora_fin: '09:00' }, reglas).hora_fin).toBe('La hora de fin debe ser posterior a la de inicio.');
        expect(validarSolicitud({ ...valida, hora_fin: '10:20' }, reglas).hora_fin).toBe('El uso del laboratorio debe durar al menos 30 minutos.');
        expect(validarSolicitud({ ...valida, hora_fin: '10:30' }, reglas).hora_fin).toBeUndefined();
        expect(validarSolicitud({ ...valida, hora_fin: '18:00' }, reglas).hora_fin).toBeUndefined();
        expect(validarSolicitud({ ...valida, hora_fin: '18:01' }, reglas).hora_fin).toBe('El uso del laboratorio no puede pasar de 8 horas.');
    });

    it('la actividad lleva de 3 a 200 caracteres sin contar los espacios de los extremos', () => {
        expect(validarSolicitud({ ...valida, actividad: '   ' }, reglas).actividad).toBe('Describe la actividad que harán en el laboratorio.');
        expect(validarSolicitud({ ...valida, actividad: ' ab ' }, reglas).actividad).toBe('Describe la actividad con al menos 3 caracteres.');
        expect(validarSolicitud({ ...valida, actividad: 'abc' }, reglas).actividad).toBeUndefined();
        expect(validarSolicitud({ ...valida, actividad: 'a'.repeat(200) }, reglas).actividad).toBeUndefined();
        expect(validarSolicitud({ ...valida, actividad: 'a'.repeat(201) }, reglas).actividad).toBe('La actividad admite hasta 200 caracteres.');
    });

    it('no pide corregir la hora por el plazo cuando la fecha ya está mal', () => {
        const e = validarSolicitud({ ...valida, fecha: '2026-09-10', hora_inicio: '07:00' }, reglas);
        expect(e.fecha).toBeDefined();
        expect(e.hora_inicio).toBeUndefined();
    });
});

describe('datosSolicitud', () => {
    it('convierte los ids a número y recorta la actividad', () => {
        expect(datosSolicitud({ ...valida, actividad: '  Práctica  ' })).toEqual({
            id_aula: 3,
            id_grupo: 1,
            fecha: '2026-09-17',
            hora_inicio: '10:00',
            hora_fin: '12:00',
            actividad: 'Práctica',
        });
    });
});

describe('errorDeCampoSolicitud', () => {
    const e = (code, message) => errorDeCampoSolicitud({ code, message });

    it('pega cada código al campo que lo causa y conserva el mensaje del servidor', () => {
        expect(e('LAB_OCUPADO', 'El laboratorio no está disponible en ese horario: x.')).toEqual({ hora_inicio: 'El laboratorio no está disponible en ese horario: x.' });
        expect(e('LAB_CAPACIDAD_INSUFICIENTE', 'El grupo 3A tiene 35...')).toEqual({ id_aula: 'El grupo 3A tiene 35...' });
        expect(e('SOLICITUD_DUPLICADA', 'Ese grupo ya tiene...')).toEqual({ id_grupo: 'Ese grupo ya tiene...' });
        expect(e('LAB_NO_ES_LABORATORIO', 'El aula A-1 no es un laboratorio.')).toEqual({ id_aula: 'El aula A-1 no es un laboratorio.' });
    });

    it('LAB_FUERA_DE_PLAZO va a la hora si habla de horas de anticipación y a la fecha si no', () => {
        expect(e('LAB_FUERA_DE_PLAZO', 'Solicita el laboratorio con al menos 24 horas de anticipación.')).toHaveProperty('hora_inicio');
        expect(e('LAB_FUERA_DE_PLAZO', 'Solo se puede solicitar con hasta 60 días de anticipación.')).toHaveProperty('fecha');
        expect(e('LAB_FUERA_DE_PLAZO', 'La fecha y la hora de inicio ya pasaron.')).toHaveProperty('fecha');
    });

    it('HORA_INVALIDA y VALIDACION se reparten por el contenido del mensaje', () => {
        expect(e('HORA_INVALIDA', 'hora_inicio es obligatoria y debe ser HH:MM.')).toHaveProperty('hora_inicio');
        expect(e('HORA_INVALIDA', 'La hora de fin debe ser posterior a la de inicio.')).toHaveProperty('hora_fin');
        expect(e('VALIDACION', 'El uso del laboratorio debe durar entre 30 minutos y 8 horas.')).toHaveProperty('hora_fin');
        expect(e('VALIDACION', 'Describe la actividad (de 3 a 200 caracteres).')).toHaveProperty('actividad');
        expect(e('VALIDACION', 'La fecha no existe en el calendario.')).toHaveProperty('fecha');
    });

    it('NO_ENCONTRADO distingue grupo y laboratorio', () => {
        expect(e('NO_ENCONTRADO', 'El grupo no existe o no es tuyo.')).toHaveProperty('id_grupo');
        expect(e('NO_ENCONTRADO', 'El laboratorio no existe.')).toHaveProperty('id_aula');
    });

    it('lo que no es de un campo queda como error general (null)', () => {
        expect(e('DOCENTE_NO_ACTIVO', 'Tu cuenta de docente no está activa.')).toBeNull();
        expect(e('VALIDACION', 'Indica el laboratorio y el grupo.')).toBeNull();
        expect(e('ERROR_INTERNO', 'Algo falló')).toBeNull();
        expect(errorDeCampoSolicitud(null)).toBeNull();
    });
});

describe('opciones y avisos de capacidad', () => {
    it('describe laboratorios con clave, edificio y lugares', () => {
        expect(opcionesLaboratorio([{ id_aula: 3, clave: 'LAB-1', edificio: 'C', capacidad: 30 }, { id_aula: 4, clave: 'LAB-2', edificio: 'Edificio D', capacidad: 25 }])).toEqual([
            { value: '3', label: 'LAB-1 · Edificio C · 30 lugares' },
            { value: '4', label: 'LAB-2 · Edificio D · 25 lugares' },
        ]);
    });

    it('describe grupos con materia, clave e inscritos', () => {
        expect(opcionesGrupo([{ id_grupo: 1, clave_grupo: '3A', materia_nombre: 'Administración I', inscritos: 4 }, { id_grupo: 2, clave_grupo: '5C', materia_nombre: 'Álgebra', inscritos: 1 }])).toEqual([
            { value: '1', label: 'Administración I (3A) · 4 alumnos' },
            { value: '2', label: 'Álgebra (5C) · 1 alumno' },
        ]);
    });

    it('avisa solo cuando el grupo excede la capacidad', () => {
        const lab = { clave: 'LAB-1', capacidad: 30 };
        expect(avisoCapacidad({ clave_grupo: '3A', inscritos: 35 }, lab)).toContain('El grupo 3A tiene 35 alumnos activos y LAB-1 admite 30.');
        expect(avisoCapacidad({ clave_grupo: '3A', inscritos: 30 }, lab)).toBeNull();
        expect(avisoCapacidad(null, lab)).toBeNull();
        expect(avisoCapacidad({ clave_grupo: '3A', inscritos: 35 }, null)).toBeNull();
    });
});

describe('argumentosAgenda', () => {
    it('arma la consulta de un solo día dentro de la ventana de la solicitud', () => {
        expect(argumentosAgenda({ idAula: '3', fecha: '2026-09-17' }, reglas)).toEqual({ idAula: 3, desde: '2026-09-17', hasta: '2026-09-17' });
    });

    it('no consulta si falta algo o la fecha no se puede solicitar', () => {
        expect(argumentosAgenda({ idAula: '', fecha: '2026-09-17' }, reglas)).toBeNull();
        expect(argumentosAgenda({ idAula: '3', fecha: '' }, reglas)).toBeNull();
        expect(argumentosAgenda({ idAula: '3', fecha: '0002-09-17' }, reglas)).toBeNull();
        expect(argumentosAgenda({ idAula: '3', fecha: '2026-09-14' }, reglas)).toBeNull();
        expect(argumentosAgenda({ idAula: '3', fecha: '2027-01-01' }, reglas)).toBeNull();
    });
});

describe('traslapes y avisoTraslape', () => {
    const grupo = { clave_grupo: '3A', materia_clave: 'ADM101' };
    const clase = { tipo: 'clase', estatus: null, hora_inicio: '10:00', hora_fin: '11:00', clave_grupo: '1B', materia_clave: 'MAT100', propia: false };
    const aprobada = { tipo: 'solicitud', estatus: 'aprobada', hora_inicio: '12:00', hora_fin: '14:00', clave_grupo: '3B', materia_clave: 'ADM101', propia: false };
    const pendiente = { tipo: 'solicitud', estatus: 'pendiente', hora_inicio: '15:00', hora_fin: '17:00', clave_grupo: '5C', materia_clave: 'MAT200', propia: false };
    const propiaMismoGrupo = { tipo: 'solicitud', estatus: 'pendiente', hora_inicio: '18:00', hora_fin: '19:00', clave_grupo: '3A', materia_clave: 'ADM101', propia: true };
    const claseDelMismoGrupo = { tipo: 'clase', estatus: null, hora_inicio: '08:00', hora_fin: '09:00', clave_grupo: '3A', materia_clave: 'ADM101', propia: true };
    const bloques = [clase, aprobada, pendiente, propiaMismoGrupo, claseDelMismoGrupo];

    it('clasifica cada bloque que se traslapa', () => {
        expect(traslapes(bloques, '10:30', '12:30', grupo).map((c) => c.nivel)).toEqual(['bloquea', 'bloquea']);
        expect(traslapes(bloques, '16:00', '16:30', grupo).map((c) => c.nivel)).toEqual(['compite']);
        expect(traslapes(bloques, '18:30', '19:30', grupo).map((c) => c.nivel)).toEqual(['duplicada']);
    });

    it('tocar el borde no es traslape y la clase del propio grupo no cuenta', () => {
        expect(traslapes(bloques, '11:00', '12:00', grupo)).toEqual([]);
        expect(traslapes(bloques, '08:00', '09:00', grupo)).toEqual([]);
    });

    it('sin horario válido no hay traslapes', () => {
        expect(traslapes(bloques, '', '12:00', grupo)).toEqual([]);
        expect(traslapes(bloques, '12:00', '10:00', grupo)).toEqual([]);
    });

    it('avisa lo más grave primero y lista los bloques de ese nivel', () => {
        const aviso = avisoTraslape(traslapes(bloques, '10:30', '12:30', grupo));
        expect(aviso.tono).toBe('warning');
        expect(aviso.titulo).toBe('El laboratorio está ocupado en este horario');
        expect(aviso.detalle).toContain('10:00 – 11:00, clase de 1B');
        expect(aviso.detalle).toContain('12:00 – 14:00, solicitud aprobada de 3B');
        expect(avisoTraslape(traslapes(bloques, '16:00', '16:30', grupo))).toMatchObject({ tono: 'info', titulo: 'Hay otra solicitud pendiente en este horario' });
        expect(avisoTraslape(traslapes(bloques, '18:30', '19:30', grupo))).toMatchObject({ tono: 'warning', titulo: 'Ese grupo ya tiene una solicitud en este horario' });
        expect(avisoTraslape([])).toBeNull();
    });
});

describe('ATAJOS_FECHA', () => {
    it('ofrece mañana y en una semana a partir de «hoy» del plantel', () => {
        expect(ATAJOS_FECHA.map((a) => a.valor({ hoy: '2026-09-14' }))).toEqual(['2026-09-15', '2026-09-21']);
    });
});
