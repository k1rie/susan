import { describe, expect, it } from 'vitest';
import { filasParaApi, MAX_FILAS, parsearCsvInscripciones } from './importarCsv.utils.js';

describe('parsearCsvInscripciones', () => {
    it('lee columnas del formato, con BOM, CRLF y comillas', () => {
        const csv = '﻿matricula,apellido_paterno,apellido_materno,nombres,correo\r\ne260010,Ramos,,"Ana, María",ANA@u.mx\r\n';
        const r = parsearCsvInscripciones(csv);
        expect(r.erroresGlobales).toEqual([]);
        expect(r.filas).toHaveLength(1);
        expect(r.filas[0]).toMatchObject({ matricula: 'E260010', nombres: 'Ana, María', correo: 'ana@u.mx', linea: 2 });
        expect(filasParaApi(r.filas)[0]).toEqual({ matricula: 'E260010', apellido_paterno: 'Ramos', nombres: 'Ana, María', correo: 'ana@u.mx' });
    });
    it('acepta punto y coma, alias correo_institucional y solo matrícula', () => {
        const r = parsearCsvInscripciones('Matrícula;correo_institucional\nA1;a@u.mx\nA2;');
        expect(r.filas.map((f) => f.matricula)).toEqual(['A1', 'A2']);
        expect(r.filas[0].correo).toBe('a@u.mx');
    });
    it('descarta filas malas con su línea', () => {
        const r = parsearCsvInscripciones('matricula,correo\n,x@u.mx\nA1,no-correo\nA2,a@u.mx\nA2,b@u.mx');
        expect(r.filas.map((f) => f.matricula)).toEqual(['A2']);
        expect(r.errores.map((e) => [e.linea, e.mensaje])).toEqual([
            [2, 'Falta la matrícula.'],
            [3, 'El correo no es válido.'],
            [5, 'Matrícula repetida en el archivo.'],
        ]);
    });
    it('reporta archivo vacío, sin columna matricula y exceso de filas', () => {
        expect(parsearCsvInscripciones('').erroresGlobales[0]).toMatch(/vacío/);
        expect(parsearCsvInscripciones('nombre\nx').erroresGlobales[0]).toMatch(/matricula/);
        const grande = `matricula\n${Array.from({ length: MAX_FILAS + 1 }, (_, i) => `M${i}`).join('\n')}`;
        expect(parsearCsvInscripciones(grande).erroresGlobales[0]).toMatch(/Máximo 500/);
    });
});
