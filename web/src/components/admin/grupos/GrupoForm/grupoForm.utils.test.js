import { describe, expect, it } from 'vitest';
import { franjaVacia } from '../HorarioSemanal/horarioSemanal.utils.js';
import {
    armarResumenGrupo,
    datosGrupo,
    desplazarPeriodo,
    identidadBloqueada,
    mapearErrorGrupo,
    opcionAula,
    opcionDocente,
    opcionMateria,
    periodoSugerido,
    periodosCercanos,
    validarGrupo,
    valoresDeGrupo,
} from './grupoForm.utils.js';

describe('periodo', () => {
    it('sugiere AAAA-S según la fecha: enero a junio es 1 y julio a diciembre es 2', () => {
        expect(periodoSugerido('2026-01-15')).toBe('2026-1');
        expect(periodoSugerido('2026-06-30')).toBe('2026-1');
        expect(periodoSugerido('2026-07-01')).toBe('2026-2');
        expect(periodoSugerido('2026-12-31')).toBe('2026-2');
        expect(periodoSugerido('no es fecha')).toBe('');
    });
    it('desplaza semestres cruzando el año', () => {
        expect(desplazarPeriodo('2026-2', 1)).toBe('2027-1');
        expect(desplazarPeriodo('2026-1', -1)).toBe('2025-2');
        expect(desplazarPeriodo('malo', 1)).toBe('');
    });
    it('ofrece el siguiente, el vigente y tres anteriores, de más reciente a más antiguo', () => {
        expect(periodosCercanos('2026-10-06')).toEqual(['2027-1', '2026-2', '2026-1', '2025-2', '2025-1']);
    });
});

describe('validarGrupo', () => {
    const bueno = { id_materia: '1', id_docente: '2', id_aula: '3', clave_grupo: '3a', periodo: '2026-2' };
    it('acepta un grupo completo (la clave se valida ya en mayúsculas)', () => {
        expect(validarGrupo(bueno)).toEqual({});
    });
    it('dice qué falta con ejemplos', () => {
        const e = validarGrupo({ id_materia: '', id_docente: '', id_aula: '', clave_grupo: '', periodo: '' });
        expect(Object.keys(e).sort()).toEqual(['clave_grupo', 'id_aula', 'id_docente', 'id_materia', 'periodo']);
        expect(e.clave_grupo).toMatch(/por ejemplo 3A/);
        expect(e.periodo).toMatch(/2026-2/);
    });
    it('rechaza claves y periodos con mal formato', () => {
        expect(validarGrupo({ ...bueno, clave_grupo: 'MUY LARGA 123' }).clave_grupo).toMatch(/hasta 8/);
        expect(validarGrupo({ ...bueno, periodo: '2026-3' }).periodo).toMatch(/AAAA-S/);
        expect(validarGrupo({ ...bueno, periodo: '26-2' }).periodo).toMatch(/AAAA-S/);
    });
    it('el horario del alta es opcional pero, si se captura, debe ser coherente', () => {
        expect(validarGrupo({ ...bueno, franjas: [] })).toEqual({});
        const ok = franjaVacia({ dias: ['1'], hora_inicio: '07:00', hora_fin: '08:00' });
        expect(validarGrupo({ ...bueno, franjas: [ok] })).toEqual({});
        const mala = franjaVacia({ dias: [], hora_inicio: '09:00', hora_fin: '08:00' });
        expect(validarGrupo({ ...bueno, franjas: [mala] }).franjas).toMatch(/Revisa las franjas/);
    });
});

describe('datos del grupo', () => {
    it('arma el payload de siempre (con id_grupo solo al editar) y la clave en mayúsculas', () => {
        const v = { id_materia: '1', id_docente: '2', id_aula: '3', clave_grupo: ' 3a ', periodo: ' 2026-2 ' };
        expect(datosGrupo(v)).toEqual({ id_materia: 1, id_docente: 2, id_aula: 3, clave_grupo: '3A', periodo: '2026-2' });
        expect(datosGrupo(v, 9).id_grupo).toBe(9);
    });
    it('convierte la ficha en valores del formulario', () => {
        expect(valoresDeGrupo({ id_materia: 1, id_docente: 2, id_aula: 3, clave_grupo: '3A', periodo: '2026-2' })).toEqual({
            id_materia: '1', id_docente: '2', id_aula: '3', clave_grupo: '3A', periodo: '2026-2',
        });
    });
    it('con inscripciones o sesiones no se cambian la materia ni el periodo', () => {
        expect(identidadBloqueada({ inscritos: { activos: 0, baja: 0 }, sesiones: { total: 0 } })).toBe(false);
        expect(identidadBloqueada({ inscritos: { activos: 3, baja: 0 }, sesiones: { total: 0 } })).toBe(true);
        expect(identidadBloqueada({ inscritos: { activos: 0, baja: 1 }, sesiones: { total: 0 } })).toBe(true);
        expect(identidadBloqueada({ inscritos: {}, sesiones: { total: 2 } })).toBe(true);
        expect(identidadBloqueada(undefined)).toBe(false);
    });
});

describe('errores del servidor', () => {
    it('cada código se pega al campo que lo causa; lo demás es un error general', () => {
        expect(mapearErrorGrupo({ code: 'DUPLICADO', message: 'Ya existe el grupo 3A.' })).toEqual({ clave_grupo: 'Ya existe el grupo 3A.' });
        expect(mapearErrorGrupo({ code: 'PERIODO_INVALIDO' })).toHaveProperty('periodo');
        expect(mapearErrorGrupo({ code: 'DOCENTE_NO_ACTIVO' })).toHaveProperty('id_docente');
        expect(mapearErrorGrupo({ code: 'HORARIO_CHOQUE', message: 'choca' })).toEqual({ id_aula: 'choca' });
        expect(mapearErrorGrupo({ code: 'NO_ENCONTRADO' })).toBeNull();
        expect(mapearErrorGrupo(undefined)).toBeNull();
    });
});

describe('opciones de dos líneas', () => {
    it('materia: nombre arriba; clave, horas y créditos debajo', () => {
        expect(opcionMateria({ id_materia: 1, clave: 'ADM101', nombre: 'Administración I', creditos: 8, horas_semana: 4 })).toMatchObject({
            value: '1', label: 'Administración I', description: 'ADM101 · 4 h por semana · 8 créditos',
        });
        expect(opcionMateria({ id_materia: 2, clave: 'X', nombre: 'Y', creditos: 1 }).description).toBe('X · 1 crédito');
    });
    it('docente: nombre con número de empleado y correo', () => {
        expect(opcionDocente({ id_docente: 4, nombre_completo: 'López Ana', num_empleado: 'D001', correo_institucional: 'a@u.mx' })).toMatchObject({
            value: '4', label: 'López Ana', description: 'D001 · a@u.mx', avatar: 'López Ana',
        });
    });
    it('aula: clave con edificio, capacidad y cámaras activas (sin repetir «Edificio»)', () => {
        expect(opcionAula({ id_aula: 2, clave: 'A-12', edificio: 'A', capacidad: 40, camaras_activas: 1 }).description).toBe('Edificio A · 40 lugares · 1 cámara activa');
        expect(opcionAula({ id_aula: 2, clave: 'A-12', edificio: 'Edificio A', capacidad: 40, camaras_activas: 0 }).description).toBe('Edificio A · 40 lugares · sin cámaras activas');
    });
});

describe('resumen del alta', () => {
    it('arma las tres secciones con el «Editar» de cada una apuntando a su paso', () => {
        const secciones = armarResumenGrupo(
            { clave_grupo: '3a', periodo: '2026-2', franjas: [franjaVacia({ dias: ['1', '3'], hora_inicio: '07:00', hora_fin: '08:00' })] },
            { id_materia: { label: 'Administración I' }, id_docente: { label: 'López Ana' }, id_aula: { label: 'A-12', datos: { capacidad: 40, camaras_activas: 0 } } },
        );
        expect(secciones.map((s) => [s.id, s.paso])).toEqual([['datos', 'datos'], ['aula', 'aula'], ['horario', 'aula']]);
        expect(secciones[0].filas.find((f) => f.etiqueta === 'Clave del grupo').valor).toBe('3A');
        expect(secciones[1].filas.find((f) => f.etiqueta === 'Cámaras activas').valor).toMatch(/Ninguna/);
        expect(secciones[2].filas[0]).toEqual({ etiqueta: 'Lun y Mié', valor: '07:00–08:00' });
        expect(secciones[2].filas[1]).toEqual({ etiqueta: 'Total por semana', valor: '2 h' });
    });
    it('sin franjas lo dice con todas sus letras', () => {
        const [, , horario] = armarResumenGrupo({ franjas: [] }, {});
        expect(horario.filas[0].valor).toMatch(/Sin horario por ahora/);
    });
});
