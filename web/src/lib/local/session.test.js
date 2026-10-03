import { describe, expect, it } from 'vitest';
import {
    DURACION_SESION_SEG,
    crearTokenSesion,
    firmarCarga,
    opcionesCookieSesion,
    verificarCarga,
    verificarTokenSesion,
} from './session.js';

const SECRETO = 'secreto-de-prueba';
const SUB = '34cf6120-b7b9-b9cd-2db5-2f108d40b771';
const AHORA = 1_800_000_000;

describe('cookie de sesion local', () => {
    it('firma y verifica un token valido', () => {
        const t = crearTokenSesion(SUB, { secreto: SECRETO, ahoraSeg: AHORA });
        expect(verificarTokenSesion(t, { secreto: SECRETO, ahoraSeg: AHORA + 10 })).toEqual({
            sub: SUB,
            exp: AHORA + DURACION_SESION_SEG,
        });
    });

    it('expira a las 8 horas exactas', () => {
        const t = crearTokenSesion(SUB, { secreto: SECRETO, ahoraSeg: AHORA });
        expect(DURACION_SESION_SEG).toBe(8 * 3600);
        expect(verificarTokenSesion(t, { secreto: SECRETO, ahoraSeg: AHORA + DURACION_SESION_SEG - 1 })).not.toBeNull();
        expect(verificarTokenSesion(t, { secreto: SECRETO, ahoraSeg: AHORA + DURACION_SESION_SEG })).toBeNull();
    });

    it('rechaza una firma de otro secreto', () => {
        const t = crearTokenSesion(SUB, { secreto: 'otro', ahoraSeg: AHORA });
        expect(verificarTokenSesion(t, { secreto: SECRETO, ahoraSeg: AHORA })).toBeNull();
    });

    it('rechaza un cuerpo manipulado (cambiar sub o exp) conservando la firma', () => {
        const t = crearTokenSesion(SUB, { secreto: SECRETO, ahoraSeg: AHORA });
        const [, firma] = t.split('.');
        const otro = Buffer.from(JSON.stringify({ sub: '00000000-0000-4000-8000-000000000001', exp: AHORA + 99999 })).toString('base64url');
        expect(verificarTokenSesion(`${otro}.${firma}`, { secreto: SECRETO, ahoraSeg: AHORA })).toBeNull();
    });

    it('rechaza una firma alterada, truncada o con formato roto', () => {
        const t = crearTokenSesion(SUB, { secreto: SECRETO, ahoraSeg: AHORA });
        const [cuerpo, firma] = t.split('.');
        const mala = (firma[0] === 'A' ? 'B' : 'A') + firma.slice(1);
        for (const malo of [`${cuerpo}.${mala}`, `${cuerpo}.${firma.slice(0, 10)}`, cuerpo, `${t}.x`, '', '.', 'a.b', null, undefined, 42]) {
            expect(verificarTokenSesion(malo, { secreto: SECRETO, ahoraSeg: AHORA })).toBeNull();
        }
    });

    it('rechaza un token sin sub uuid o con sub no uuid', () => {
        const sinSub = firmarCarga({ exp: AHORA + 100 }, SECRETO, 'sesion');
        const subRaro = firmarCarga({ sub: "x'; DROP TABLE usuario;--", exp: AHORA + 100 }, SECRETO, 'sesion');
        expect(verificarTokenSesion(sinSub, { secreto: SECRETO, ahoraSeg: AHORA })).toBeNull();
        expect(verificarTokenSesion(subRaro, { secreto: SECRETO, ahoraSeg: AHORA })).toBeNull();
    });

    it('un token de otro dominio (storage) no sirve como sesion', () => {
        const t = firmarCarga({ sub: SUB, exp: AHORA + 100 }, SECRETO, 'storage');
        expect(verificarTokenSesion(t, { secreto: SECRETO, ahoraSeg: AHORA })).toBeNull();
        expect(verificarCarga(t, SECRETO, 'storage', AHORA)).not.toBeNull();
    });

    it('la cookie es httpOnly, lax y dura 8 h', () => {
        expect(opcionesCookieSesion()).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 28800 });
    });
});
