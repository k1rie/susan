// @vitest-environment jsdom
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
    acotarFecha,
    compararFechas,
    diasEntre,
    emitirCambio,
    enteroEnRango,
    esCorreo,
    esFechaISO,
    formatearFechaCorta,
    formatearFechaLarga,
    hoyLocal,
    LIMITES,
    mayusculas,
    minusculas,
    normalizarBusqueda,
    partesFecha,
    PATRONES,
    recortar,
    sinAcentos,
    soloAlfanumerico,
    soloDigitos,
    sumarAnios,
    sumarDias,
    sumarMeses,
} from './index.js';

describe('texto', () => {
    it('sinAcentos conserva mayúsculas y quita diacríticos', () => {
        expect(sinAcentos('Analítica Álgebra Peña')).toBe('Analitica Algebra Pena');
        expect(sinAcentos(null)).toBe('');
        expect(sinAcentos(42)).toBe('42');
    });

    it('normalizarBusqueda baja a minúsculas y recorta', () => {
        expect(normalizarBusqueda('  ÁLGEBRA Lineal ')).toBe('algebra lineal');
    });

    it('mayusculas y minusculas toleran nulos', () => {
        expect(mayusculas('a-12')).toBe('A-12');
        expect(minusculas('Ana@UNACH.mx')).toBe('ana@unach.mx');
        expect(mayusculas(undefined)).toBe('');
        expect(minusculas(null)).toBe('');
    });

    it('recortar quita extremos y, si se pide, colapsa espacios internos', () => {
        expect(recortar('  Ana   María ')).toBe('Ana   María');
        expect(recortar('  Ana   María ', { colapsar: true })).toBe('Ana María');
        expect(recortar(undefined)).toBe('');
    });

    it('soloDigitos y soloAlfanumerico limpian lo pegado', () => {
        expect(soloDigitos(' 12-3 45a')).toBe('12345');
        expect(soloAlfanumerico('E26-0099 ñ!')).toBe('E260099');
    });

    it('esCorreo acepta la forma de la base y rechaza lo demás', () => {
        expect(esCorreo('a001@unach.mx')).toBe(true);
        expect(esCorreo('  a001@unach.mx ')).toBe(true);
        expect(esCorreo('a001@unach')).toBe(false);
        expect(esCorreo('a 001@unach.mx')).toBe(false);
        expect(esCorreo('a@@unach.mx')).toBe(false);
        expect(esCorreo('')).toBe(false);
        expect(esCorreo(null)).toBe(false);
        expect(esCorreo(`${'a'.repeat(112)}@unach.mx`)).toBe(false); // 121 caracteres: 120 es el máximo de la columna
        expect(esCorreo(`${'a'.repeat(111)}@unach.mx`)).toBe(true); // 120 exactos
    });

    it('enteroEnRango exige solo dígitos y los extremos son inclusivos', () => {
        expect(enteroEnRango('1', 1, 20)).toBe(true);
        expect(enteroEnRango('20', 1, 20)).toBe(true);
        expect(enteroEnRango('0', 1, 20)).toBe(false);
        expect(enteroEnRango('21', 1, 20)).toBe(false);
        expect(enteroEnRango('3.5', 1, 20)).toBe(false);
        expect(enteroEnRango('-2', -5, 5)).toBe(false);
        expect(enteroEnRango(' 7 ', 1, 20)).toBe(true);
        expect(enteroEnRango(7, 1, 20)).toBe(true);
        expect(enteroEnRango('', 1, 20)).toBe(false);
        expect(enteroEnRango(null, 1, 20)).toBe(false);
    });
});

describe('LIMITES y PATRONES', () => {
    it('trae los límites acordados en forma plana y anidada', () => {
        expect(LIMITES).toMatchObject({
            matricula: 10,
            num_empleado: 10,
            nombres: 60,
            apellidos: 40,
            correo: 120,
            clave_grupo: 8,
            periodo: 6,
            materia_clave: 8,
            materia_nombre: 80,
            aula_clave: 10,
            aula_edificio: 40,
        });
        expect(LIMITES.materia).toEqual({ clave: LIMITES.materia_clave, nombre: LIMITES.materia_nombre });
        expect(LIMITES.aula).toEqual({ clave: LIMITES.aula_clave, edificio: LIMITES.aula_edificio });
        expect(Object.isFrozen(LIMITES)).toBe(true);
    });

    it('los patrones respetan el largo de su límite', () => {
        expect(PATRONES.matricula.test('E260099')).toBe(true);
        expect(PATRONES.matricula.test('E2600990000')).toBe(false); // 11
        expect(PATRONES.matricula.test('e260099')).toBe(false); // se evalúa ya en mayúsculas
        expect(PATRONES.materia_clave.test('ADM101')).toBe(true);
        expect(PATRONES.materia_clave.test('ADM101234')).toBe(false);
        expect(PATRONES.aula_clave.test('A-12')).toBe(true);
        expect(PATRONES.aula_clave.test('-A12')).toBe(false);
        expect(PATRONES.clave_grupo.test('3A')).toBe(true);
        expect(PATRONES.clave_grupo.test('3A-12345')).toBe(true); // 8 exactos
        expect(PATRONES.clave_grupo.test('3A-123456')).toBe(false); // 9
        expect(PATRONES.periodo.test('2026-2')).toBe(true);
        expect(PATRONES.periodo.test('2026-3')).toBe(false);
        expect('2026-2'.length).toBe(LIMITES.periodo);
    });

    // Guarda contra deriva: lee el DDL real y compara cada varchar(N) con LIMITES.
    const ruta = path.resolve(import.meta.dirname, '../../../../supabase/migrations/0003_tablas_academico.sql');
    const rutaSeg = path.resolve(import.meta.dirname, '../../../../supabase/migrations/0004_tablas_seguridad.sql');
    it.skipIf(!existsSync(ruta) || !existsSync(rutaSeg))('coincide con los varchar de las migraciones', () => {
        const ddl = readFileSync(ruta, 'utf8');
        const seg = readFileSync(rutaSeg, 'utf8');
        const tabla = (nombre) => {
            const m = new RegExp(`CREATE TABLE[^(]*\\b${nombre}\\s*\\(([\\s\\S]*?)\\n\\);`).exec(ddl);
            if (!m) throw new Error(`No se encontró la tabla ${nombre}`);
            return m[1];
        };
        const largo = (cuerpo, columna) => {
            const m = new RegExp(`\\b${columna}\\s+varchar\\((\\d+)\\)`).exec(cuerpo);
            if (!m) throw new Error(`No se encontró la columna ${columna}`);
            return Number(m[1]);
        };
        const alumno = tabla('alumno');
        const docente = tabla('docente');
        const materia = tabla('materia');
        const aula = tabla('aula');
        const grupo = tabla('grupo');
        expect(largo(alumno, 'matricula')).toBe(LIMITES.matricula);
        expect(largo(docente, 'num_empleado')).toBe(LIMITES.num_empleado);
        expect(largo(alumno, 'nombres')).toBe(LIMITES.nombres);
        expect(largo(alumno, 'apellido_paterno')).toBe(LIMITES.apellidos);
        expect(largo(docente, 'apellido_materno')).toBe(LIMITES.apellidos);
        expect(largo(alumno, 'correo_institucional')).toBe(LIMITES.correo);
        expect(largo(grupo, 'clave_grupo')).toBe(LIMITES.clave_grupo);
        expect(largo(materia, 'clave')).toBe(LIMITES.materia_clave);
        expect(largo(materia, 'nombre')).toBe(LIMITES.materia_nombre);
        expect(largo(aula, 'clave')).toBe(LIMITES.aula_clave);
        expect(largo(aula, 'edificio')).toBe(LIMITES.aula_edificio);
        expect(/correo\s+varchar\(120\)/.test(seg)).toBe(true);
        // El periodo cabe en varchar(10) pero el CHECK lo deja en AAAA-S.
        expect(largo(grupo, 'periodo')).toBeGreaterThanOrEqual(LIMITES.periodo);
        expect(ddl).toContain("periodo ~ '^[0-9]{4}-[12]$'");
    });
});

describe('fechas', () => {
    it('partesFecha y esFechaISO rechazan fechas imposibles', () => {
        expect(partesFecha('2026-10-06')).toEqual({ anio: 2026, mes: 10, dia: 6 });
        expect(esFechaISO('2026-02-30')).toBe(false);
        expect(esFechaISO('2024-02-29')).toBe(true);
        expect(esFechaISO('2026-2-3')).toBe(false);
        expect(esFechaISO('')).toBe(false);
        expect(esFechaISO(null)).toBe(false);
    });

    it('hoyLocal usa la fecha local, no UTC', () => {
        expect(hoyLocal(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
        expect(hoyLocal(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31');
    });

    it('sumarDias cruza meses y años', () => {
        expect(sumarDias('2026-10-06', 7)).toBe('2026-10-13');
        expect(sumarDias('2026-12-30', 3)).toBe('2027-01-02');
        expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
        expect(sumarDias('basura', 1)).toBe('');
    });

    it('sumarMeses y sumarAnios acotan al último día del mes', () => {
        expect(sumarMeses('2026-01-31', 1)).toBe('2026-02-28');
        expect(sumarMeses('2026-11-15', 3)).toBe('2027-02-15');
        expect(sumarMeses('2026-03-15', -4)).toBe('2025-11-15');
        expect(sumarAnios('2024-02-29', 1)).toBe('2025-02-28');
        expect(sumarAnios('2026-08-01', 1)).toBe('2027-08-01');
        expect(sumarAnios('2026-08-01', 2)).toBe('2028-08-01');
    });

    it('compararFechas, diasEntre y acotarFecha', () => {
        expect(compararFechas('2026-01-01', '2026-01-02')).toBe(-1);
        expect(compararFechas('2026-01-02', '2026-01-02')).toBe(0);
        expect(compararFechas('2026-01-03', '2026-01-02')).toBe(1);
        expect(compararFechas('', '2026-01-02')).toBe(0);
        expect(diasEntre('2026-10-01', '2026-10-31')).toBe(30);
        expect(diasEntre('2026-10-31', '2026-10-01')).toBe(-30);
        expect(diasEntre('x', '2026-10-01')).toBeNull();
        expect(acotarFecha('2026-01-01', { min: '2026-02-01' })).toBe('2026-02-01');
        expect(acotarFecha('2026-03-01', { max: '2026-02-01' })).toBe('2026-02-01');
        expect(acotarFecha('2026-01-15', { min: '2026-01-01', max: '2026-01-31' })).toBe('2026-01-15');
        expect(acotarFecha('', { min: '2026-01-01' })).toBe('');
    });

    it('formatea en español sin desfase de zona', () => {
        expect(formatearFechaLarga('2026-10-05')).toBe('lunes, 5 de octubre de 2026');
        expect(formatearFechaCorta('2026-10-05')).toBe('5 oct 2026');
        expect(formatearFechaLarga('nada')).toBe('');
        expect(formatearFechaCorta('')).toBe('');
    });
});

describe('emitirCambio', () => {
    it('dispara un evento input que burbujea con el valor nuevo', () => {
        const input = document.createElement('input');
        document.body.appendChild(input);
        const oyente = vi.fn((e) => e.target.value);
        document.addEventListener('input', oyente);
        expect(emitirCambio(input, 'hola')).toBe(true);
        expect(input.value).toBe('hola');
        expect(oyente).toHaveBeenCalledTimes(1);
        document.removeEventListener('input', oyente);
        input.remove();
    });

    it('funciona con textarea y devuelve false sin elemento', () => {
        const area = document.createElement('textarea');
        expect(emitirCambio(area, 'x')).toBe(true);
        expect(area.value).toBe('x');
        expect(emitirCambio(null, 'x')).toBe(false);
    });
});
