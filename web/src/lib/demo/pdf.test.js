import { describe, expect, it } from 'vitest';
import { literalPdf, pdfMinimo } from './pdf.js';

const comoTexto = (bytes) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');

describe('literalPdf', () => {
    it('escapa paréntesis y diagonal inversa', () => {
        expect(literalPdf('a (b) \\ c')).toBe('a \\(b\\) \\\\ c');
    });

    it('pasa los acentos a octal Latin-1 y descarta lo que no cabe', () => {
        expect(literalPdf('Matemáticas')).toBe('Matem\\341ticas');
        expect(literalPdf('Ñandú')).toBe('\\321and\\372');
        expect(literalPdf('ok \u{1F600}')).toBe('ok ?');
    });

    it('tolera valores vacíos', () => {
        expect(literalPdf(undefined)).toBe('');
        expect(literalPdf(null)).toBe('');
    });
});

describe('pdfMinimo', () => {
    const bytes = pdfMinimo({ titulo: 'Consentimiento (demostración)', lineas: ['Alumno: Ana García', 'Vigente hasta 2027-08-01'] });
    const texto = comoTexto(bytes);

    it('lleva la firma %PDF- y cierra con %%EOF (lo que valida el servidor al subir)', () => {
        expect(texto.startsWith('%PDF-1.4\n')).toBe(true);
        expect(texto.endsWith('%%EOF\n')).toBe(true);
    });

    it('es solo ASCII: acentos escapados', () => {
        expect(Array.from(bytes).every((b) => b < 128)).toBe(true);
        expect(texto).toContain('Garc\\355a');
        expect(texto).toContain('demostraci\\363n');
    });

    it('la tabla xref apunta al inicio de cada objeto', () => {
        const inicio = Number(/startxref\n(\d+)\n/.exec(texto)[1]);
        expect(texto.slice(inicio, inicio + 4)).toBe('xref');
        const entradas = [...texto.slice(inicio).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
        expect(entradas).toHaveLength(5);
        entradas.forEach((posicion, i) => {
            expect(texto.slice(posicion, posicion + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
        });
    });

    it('el Length del flujo coincide con su contenido', () => {
        const m = /\/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/.exec(texto);
        expect(Number(m[1])).toBe(m[2].length);
        expect(m[2]).toContain('Consentimiento \\(demostraci\\363n\\)');
    });

    it('es determinista', () => {
        expect(pdfMinimo({ titulo: 'x', lineas: ['y'] })).toEqual(pdfMinimo({ titulo: 'x', lineas: ['y'] }));
    });
});
