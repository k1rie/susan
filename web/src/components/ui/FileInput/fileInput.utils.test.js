import { describe, expect, it } from 'vitest';
import {
    claveArchivo,
    describirReglas,
    esImagen,
    formatearBytes,
    procesarSeleccion,
    tipoPermitido,
    unirTipos,
    validarArchivo,
} from './fileInput.utils.js';

const archivo = (name, { type = '', size = 100, lastModified = 1 } = {}) => ({ name, type, size, lastModified });
const MB = 1024 * 1024;

describe('formatearBytes / tipoPermitido / validarArchivo', () => {
    it('formatea B, KB y MB', () => {
        expect(formatearBytes(512)).toBe('512 B');
        expect(formatearBytes(2048)).toBe('2 KB');
        expect(formatearBytes(10 * MB)).toBe('10 MB');
        expect(formatearBytes(1.5 * MB)).toBe('1.5 MB');
    });

    it('accept admite extensiones, MIME exactos y comodines', () => {
        expect(tipoPermitido(archivo('a.PDF'), '.pdf')).toBe(true);
        expect(tipoPermitido(archivo('a.png', { type: 'image/png' }), 'image/*')).toBe(true);
        expect(tipoPermitido(archivo('a.txt', { type: 'text/plain' }), '.pdf,image/*')).toBe(false);
        expect(tipoPermitido(archivo('a.txt'), undefined)).toBe(true);
    });

    it('validarArchivo devuelve el motivo o null', () => {
        expect(validarArchivo(archivo('a.exe'), { accept: '.pdf' })).toBe('Tipo de archivo no permitido.');
        expect(validarArchivo(archivo('a.pdf', { size: 6 * MB }), { accept: '.pdf', maxBytes: 5 * MB })).toBe('El archivo supera 5 MB.');
        expect(validarArchivo(archivo('a.pdf'), { accept: '.pdf', maxBytes: 5 * MB })).toBeNull();
    });
});

describe('describirReglas', () => {
    it('escribe tipos y peso máximo en una frase', () => {
        expect(describirReglas({ accept: '.pdf', maxBytes: 10 * MB })).toBe('PDF. Máximo 10 MB.');
        expect(describirReglas({ accept: '.pdf,.jpg,.jpeg,.png', maxBytes: 5 * MB })).toBe('PDF, JPG o PNG. Máximo 5 MB.');
        expect(describirReglas({ accept: 'application/pdf,image/jpeg,image/png' })).toBe('PDF, JPG o PNG.');
    });

    it('no anuncia text/plain como otro formato del CSV', () => {
        expect(describirReglas({ accept: '.csv,text/csv,text/plain', maxBytes: MB })).toBe('CSV. Máximo 1 MB.');
    });

    it('nombra extensiones desconocidas, imágenes en general y el tope de archivos', () => {
        expect(describirReglas({ accept: '.xlsx' })).toBe('XLSX.');
        expect(describirReglas({ accept: 'image/*', maxFiles: 5 })).toBe('imagen. Hasta 5 archivos.');
        expect(describirReglas({})).toBe('');
        expect(describirReglas()).toBe('');
    });

    it('unirTipos usa comas y «o» final', () => {
        expect(unirTipos([])).toBe('');
        expect(unirTipos(['A'])).toBe('A');
        expect(unirTipos(['A', 'B'])).toBe('A o B');
        expect(unirTipos(['A', 'B', 'C'])).toBe('A, B o C');
    });
});

describe('procesarSeleccion', () => {
    const opciones = { accept: '.pdf', maxBytes: 5 * MB };

    it('modo sencillo: solo mira el primero y el error es el motivo a secas', () => {
        const r = procesarSeleccion([archivo('a.pdf'), archivo('b.pdf')], opciones);
        expect(r.aceptados.map((f) => f.name)).toEqual(['a.pdf']);
        expect(r.errores).toEqual([]);
        expect(procesarSeleccion([archivo('a.exe')], opciones)).toEqual({ aceptados: [], errores: ['Tipo de archivo no permitido.'] });
    });

    it('modo múltiple: acepta los válidos y nombra el archivo en cada error', () => {
        const r = procesarSeleccion([archivo('a.pdf'), archivo('b.exe'), archivo('c.pdf', { size: 9 * MB })], { ...opciones, multiple: true });
        expect(r.aceptados.map((f) => f.name)).toEqual(['a.pdf']);
        expect(r.errores).toEqual(['b.exe: Tipo de archivo no permitido.', 'c.pdf: El archivo supera 5 MB.']);
    });

    it('respeta maxFiles contando los ya elegidos y avisa cuántos sobraron', () => {
        const actuales = [archivo('uno.pdf'), archivo('dos.pdf')];
        const r = procesarSeleccion([archivo('a.pdf'), archivo('b.pdf'), archivo('c.pdf')], { ...opciones, multiple: true, maxFiles: 3, actuales });
        expect(r.aceptados.map((f) => f.name)).toEqual(['a.pdf']);
        expect(r.errores).toEqual(['Solo se admiten 3 archivos: sobraron 2.']);
    });

    it('descarta en silencio el mismo archivo repetido', () => {
        const a = archivo('a.pdf');
        const r = procesarSeleccion([archivo('a.pdf'), archivo('a.pdf')], { ...opciones, multiple: true, actuales: [a] });
        expect(r).toEqual({ aceptados: [], errores: [] });
    });

    it('esImagen y claveArchivo', () => {
        expect(esImagen(archivo('a.png', { type: 'image/png' }))).toBe(true);
        expect(esImagen(archivo('a.pdf', { type: 'application/pdf' }))).toBe(false);
        expect(esImagen(null)).toBe(false);
        expect(claveArchivo(archivo('a.pdf', { size: 5, lastModified: 9 }))).toBe('a.pdf|5|9');
    });
});
