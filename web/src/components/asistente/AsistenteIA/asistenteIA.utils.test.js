import { describe, expect, it } from 'vitest';
import { partirLineas } from '@/lib/http/asistente';
import { MAX_MENSAJES, MAX_TEXTO, historialParaEnviar, mostrarBotonEn } from './asistenteIA.utils.js';

describe('historialParaEnviar', () => {
    it('quita errores y vacíos, deja un solo mensaje por turno y empieza por el usuario', () => {
        expect(historialParaEnviar([
            { rol: 'asistente', texto: 'suelto' },
            { rol: 'usuario', texto: ' a ' },
            { rol: 'asistente', texto: 'falló', error: true },
            { rol: 'usuario', texto: 'b' },
            { rol: 'asistente', texto: '' },
            { rol: 'asistente', texto: 'ok' },
            { rol: 'usuario', texto: 'c' },
        ])).toEqual([
            { rol: 'usuario', texto: 'b' },
            { rol: 'asistente', texto: 'ok' },
            { rol: 'usuario', texto: 'c' },
        ]);
    });

    it('recorta a los últimos MAX_MENSAJES y cada texto a MAX_TEXTO', () => {
        const largos = Array.from({ length: 30 }, (_, i) => ({ rol: i % 2 ? 'asistente' : 'usuario', texto: 'x'.repeat(3000) }));
        const r = historialParaEnviar([...largos, { rol: 'usuario', texto: 'fin' }]);
        expect(r.length).toBeLessThanOrEqual(MAX_MENSAJES);
        expect(r[0].rol).toBe('usuario');
        expect(r.at(-1)).toEqual({ rol: 'usuario', texto: 'fin' });
        expect(r[0].texto).toHaveLength(MAX_TEXTO);
    });
});

describe('mostrarBotonEn', () => {
    it('oculta el botón en el pase de lista y la sesión en vivo', () => {
        expect(mostrarBotonEn('/docente')).toBe(true);
        expect(mostrarBotonEn('/reportes')).toBe(true);
        expect(mostrarBotonEn('/docente/pasar-lista')).toBe(false);
        expect(mostrarBotonEn('/docente/sesiones/3')).toBe(false);
        expect(mostrarBotonEn('/docente/modo-automatico')).toBe(false);
    });
});

describe('partirLineas', () => {
    it('devuelve los eventos completos y guarda el resto; ignora líneas corruptas', () => {
        expect(partirLineas('{"tipo":"texto","texto":"a"}\n{"ti')).toEqual({ eventos: [{ tipo: 'texto', texto: 'a' }], resto: '{"ti' });
        expect(partirLineas('basura\n{"tipo":"fin"}\n').eventos).toEqual([{ tipo: 'fin' }]);
    });
});
