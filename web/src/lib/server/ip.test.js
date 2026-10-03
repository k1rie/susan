import { describe, expect, it } from 'vitest';
import { ipDeOrigen } from './ip.js';

const conCabeceras = (h) => ({ headers: new Headers(h) });

describe('ipDeOrigen', () => {
    it('toma el primer elemento válido de x-forwarded-for', () => {
        expect(ipDeOrigen(conCabeceras({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }))).toBe('203.0.113.9');
    });
    it('salta elementos inválidos hasta el primero válido', () => {
        expect(ipDeOrigen(conCabeceras({ 'x-forwarded-for': 'unknown, 198.51.100.7' }))).toBe('198.51.100.7');
    });
    it('quita puerto y corchetes', () => {
        expect(ipDeOrigen(conCabeceras({ 'x-forwarded-for': '203.0.113.9:5555' }))).toBe('203.0.113.9');
        expect(ipDeOrigen(conCabeceras({ 'x-forwarded-for': '[2001:db8::1]:443' }))).toBe('2001:db8::1');
        expect(ipDeOrigen(conCabeceras({ 'x-forwarded-for': '2001:db8::1' }))).toBe('2001:db8::1');
    });
    it('cae a x-real-ip si x-forwarded-for no sirve', () => {
        expect(ipDeOrigen(conCabeceras({ 'x-forwarded-for': 'basura', 'x-real-ip': '192.0.2.5' }))).toBe('192.0.2.5');
    });
    it('devuelve null si no hay IP válida', () => {
        expect(ipDeOrigen(conCabeceras({}))).toBeNull();
        expect(ipDeOrigen(conCabeceras({ 'x-forwarded-for': "1.2.3.4'; DROP TABLE" }))).toBeNull();
        expect(ipDeOrigen(conCabeceras({ 'x-real-ip': '999.1.1.1' }))).toBeNull();
        expect(ipDeOrigen(null)).toBeNull();
    });
});
