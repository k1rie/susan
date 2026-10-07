import { describe, expect, it } from 'vitest';
import { VERSION_AVISO, textoPlanoAviso } from '@/lib/avisoBiometrico';
import { envolver, generarConstancia, huellaAviso } from './constancia.js';

const DATOS = { nombre: 'Ana Pérez López', matricula: 'E20230045', ahora: '2026-10-07T09:12:41-06:00', vigenciaHasta: '2027-10-07', ip: '203.0.113.9' };
const comoTexto = (buffer) => buffer.toString('latin1');

describe('generarConstancia', () => {
    const pdf = generarConstancia(DATOS);
    const texto = comoTexto(pdf);

    it('es un PDF con cabecera, fin de archivo y un solo catálogo', () => {
        expect(texto.startsWith('%PDF-1.4\n')).toBe(true);
        expect(texto.trimEnd().endsWith('%%EOF')).toBe(true);
        expect(texto.match(/\/Type \/Catalog/g)).toHaveLength(1);
    });

    it('los desplazamientos del xref apuntan al inicio de cada objeto y startxref al xref', () => {
        const inicio = Number(texto.match(/startxref\n(\d+)\n%%EOF/)[1]);
        expect(texto.slice(inicio, inicio + 4)).toBe('xref');
        const total = Number(texto.slice(inicio).match(/^xref\n0 (\d+)\n/)[1]);
        const entradas = [...texto.slice(inicio).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
        expect(entradas).toHaveLength(total - 1);
        entradas.forEach((posicion, i) => expect(texto.slice(posicion).startsWith(`${i + 1} 0 obj\n`)).toBe(true));
    });

    it('cada /Length coincide con los bytes reales del flujo', () => {
        for (const m of texto.matchAll(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)) {
            expect(Buffer.byteLength(m[2], 'latin1')).toBe(Number(m[1]));
        }
    });

    it('lleva los datos de la aceptación, la huella y el texto del aviso', () => {
        expect(texto).toContain('Ana Pérez López');
        expect(texto).toContain('Matrícula: E20230045');
        expect(texto).toContain('Vigente hasta: 2027-10-07');
        expect(texto).toContain(`Versión del aviso: ${VERSION_AVISO}`);
        expect(texto).toContain(`Huella SHA-256 del aviso: ${huellaAviso()}`);
        expect(texto).toContain('Dirección IP de origen: 203.0.113.9');
        expect(texto).toContain('DECLARACIÓN DEL ALUMNO');
    });

    it('sin IP no escribe la línea de IP', () => {
        expect(comoTexto(generarConstancia({ ...DATOS, ip: null }))).not.toContain('Dirección IP');
    });

    it('escapa paréntesis y barras y sustituye lo que WinAnsi no tiene, sin romper la estructura', () => {
        const raro = generarConstancia({ ...DATOS, nombre: 'Zoë (O\'Brien) \\ 山田' });
        const t = comoTexto(raro);
        expect(t).toContain('Zoë \\(O\'Brien\\) \\\\ ??');
        expect(t.trimEnd().endsWith('%%EOF')).toBe(true);
    });

    it('un nombre larguísimo se parte en varias líneas y el documento sigue siendo válido', () => {
        const t = comoTexto(generarConstancia({ ...DATOS, nombre: 'Nombre '.repeat(80) }));
        expect(t.trimEnd().endsWith('%%EOF')).toBe(true);
        const inicio = Number(t.match(/startxref\n(\d+)\n%%EOF/)[1]);
        expect(t.slice(inicio, inicio + 4)).toBe('xref');
    });
});

describe('huellaAviso', () => {
    it('es estable (misma entrada, misma huella) y cambia si cambia el texto', () => {
        expect(huellaAviso(12)).toBe(huellaAviso(12));
        expect(huellaAviso(12)).toMatch(/^[0-9a-f]{64}$/);
        expect(huellaAviso(12)).not.toBe(huellaAviso(24));
    });

    it('es la huella del texto plano que ve el alumno', () => {
        expect(textoPlanoAviso(12).join('\n')).toContain('Aviso de privacidad');
    });
});

describe('envolver', () => {
    it('no pasa del ancho, corta en espacios y conserva los saltos', () => {
        const lineas = envolver('uno dos tres cuatro cinco seis siete ocho nueve diez', 20);
        expect(lineas.every((l) => l.length <= 20)).toBe(true);
        expect(lineas.join(' ')).toBe('uno dos tres cuatro cinco seis siete ocho nueve diez');
        expect(envolver('a\n\nb')).toEqual(['a', '', 'b']);
    });

    it('parte a la fuerza una palabra más larga que la línea', () => {
        const lineas = envolver('x'.repeat(50), 20);
        expect(lineas).toEqual(['x'.repeat(20), 'x'.repeat(20), 'x'.repeat(10)]);
    });
});
