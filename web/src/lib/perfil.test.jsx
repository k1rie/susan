// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { guardarPerfil, leerPerfil, usePreferenciasPerfil } from './perfil.js';

const ME = { id_usuario: 7, correo: 'a@susan.local' };

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

describe('preferencias de perfil', () => {
    it('guardar y leer por usuario, mezclando con lo anterior', () => {
        expect(leerPerfil(ME)).toEqual({});
        guardarPerfil(ME, { tinte: '#e5501e' });
        guardarPerfil(ME, { avisoLeido: true });
        expect(leerPerfil(ME)).toEqual({ tinte: '#e5501e', avisoLeido: true });
        expect(leerPerfil({ id_usuario: 8 })).toEqual({});
    });
    it('el hook refleja el cambio sin recargar y empieza sin preferencia', () => {
        const { result } = renderHook(() => usePreferenciasPerfil(ME));
        expect(result.current.tinte).toBeNull();
        act(() => result.current.guardar({ tinte: '#0b6bcb' }));
        expect(result.current.tinte).toBe('#0b6bcb');
    });
    it('JSON corrupto en el almacenamiento no rompe', () => {
        window.localStorage.setItem('susan.perfil.v1.7', '{no es json');
        expect(leerPerfil(ME)).toEqual({});
        const { result } = renderHook(() => usePreferenciasPerfil(ME));
        expect(result.current.tinte).toBeNull();
    });
});
