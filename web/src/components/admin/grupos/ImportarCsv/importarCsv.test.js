import { describe, expect, it } from 'vitest';
import { aCsv, agruparPorCausa, filasParaApi, MAX_FILAS, parsearCsvInscripciones, plantillaCsv, rangoDeFilas, reporteDeFallidos, revisarAnalisis } from './importarCsv.utils.js';

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

describe('apoyo del flujo en pasos', () => {
    it('la plantilla descargable se lee con el mismo parser: un alumno nuevo completo y uno con solo la matrícula', () => {
        const r = parsearCsvInscripciones(plantillaCsv());
        expect(r.erroresGlobales).toEqual([]);
        expect(r.filas.map((f) => f.matricula)).toEqual(['EJEMPLO1', 'EJEMPLO2']);
        expect(r.filas[0]).toMatchObject({ apellido_paterno: 'Ramírez', nombres: 'Ana María', correo: 'ejemplo1@unach.test' });
        expect(r.filas[1].nombres).toBeUndefined();
    });

    it('resume rangos de filas: rachas de tres o más con «a», lo demás en lista', () => {
        expect(rangoDeFilas([5])).toBe('5');
        expect(rangoDeFilas([5, 6])).toBe('5 y 6');
        expect(rangoDeFilas([5, 9, 12, 13, 14])).toBe('5, 9 y 12 a 14');
        expect(rangoDeFilas([14, 12, 13, 5, 9, 5])).toBe('5, 9 y 12 a 14');
        expect(rangoDeFilas([2, 4, 6, 8, 10, 12, 14, 16, 18, 20])).toBe('2, 4, 6, 8, 10, 12 y 4 más');
        expect(rangoDeFilas([])).toBe('');
    });

    it('agrupa los errores por causa, las más frecuentes primero, con sus filas', () => {
        const grupos = agruparPorCausa([
            { linea: 3, mensaje: 'El correo no es válido.' },
            { linea: 5, mensaje: 'Matrícula repetida en el archivo.' },
            { linea: 6, mensaje: 'Matrícula repetida en el archivo.' },
            { linea: 7, mensaje: 'Matrícula repetida en el archivo.' },
        ]);
        expect(grupos).toEqual([
            { mensaje: 'Matrícula repetida en el archivo.', lineas: [5, 6, 7], cantidad: 3, filas: '5 a 7' },
            { mensaje: 'El correo no es válido.', lineas: [3], cantidad: 1, filas: '3' },
        ]);
    });

    it('la revisión separa lo que se envía, lo ya inscrito, las filas con solo matrícula y las descartadas', () => {
        const analisis = parsearCsvInscripciones('matricula,nombres,apellido_paterno,correo\nA1,Ana,Ramos,a@u.mx\nA2\nA3,Luis,Soto,l@u.mx\n,,,\nA4,X,Y,mal');
        const revision = revisarAnalisis(analisis, ['a3']);
        expect(revision.paraEnviar.map((f) => f.matricula)).toEqual(['A1', 'A2']);
        expect(revision.yaInscritas.map((f) => f.matricula)).toEqual(['A3']);
        expect(revision.soloMatricula.map((f) => f.matricula)).toEqual(['A2']);
        expect(revision.descartadas).toHaveLength(1);
        expect(revision.gruposDescartadas[0].mensaje).toBe('El correo no es válido.');
        expect(revision.avisoSoloMatricula).toMatchObject({ cantidad: 1, filas: '3' });
    });

    it('el reporte de fallidos junta lo descartado y lo que rechazó el servidor, ordenado por fila y listo para Excel', () => {
        const { cantidad, texto } = reporteDeFallidos({
            descartadas: [{ linea: 6, matricula: '', mensaje: 'Falta la matrícula.' }],
            filasServidor: [
                { linea: 4, matricula: 'ZZP003', resultado: 'error', codigo: 'VALIDACION', mensaje: 'Faltan datos, del alumno nuevo.' },
                { linea: 2, matricula: 'ZZP001', resultado: 'inscrito' },
            ],
        });
        expect(cantidad).toBe(2);
        const lineas = texto.replace('﻿', '').trim().split('\n');
        expect(lineas[0]).toBe('linea,matricula,causa,detalle');
        expect(lineas[1]).toBe('4,ZZP003,VALIDACION,"Faltan datos, del alumno nuevo."');
        expect(lineas[2]).toBe('6,,Descartada al leer el archivo,Falta la matrícula.');
        expect(texto.startsWith('﻿')).toBe(true);
    });

    it('neutraliza las celdas que una hoja de cálculo ejecutaría como fórmula', () => {
        const texto = aCsv(['a'], [['=HYPERLINK("x")'], ['+1'], ['normal']]);
        expect(texto).toContain("\"'=HYPERLINK(\"\"x\"\")\"");
        expect(texto).toContain("'+1");
        expect(texto).toContain('normal');
    });
});
