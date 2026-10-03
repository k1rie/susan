// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emitirCambioSesion } from '@/lib/api/sesionEventos.js';

const yo = vi.fn();
vi.mock('@/lib/api/plataforma.js', () => ({ yo: (...a) => yo(...a) }));

const { useMe, invalidarMe } = await import('./useMe.js');

beforeEach(() => { yo.mockReset(); act(() => invalidarMe()); });

describe('useMe', () => {
    it('carga una sola vez y comparte la caché entre componentes', async () => {
        yo.mockResolvedValue({ id_usuario: 1, rol: 'docente' });
        const a = renderHook(() => useMe());
        const b = renderHook(() => useMe());
        await waitFor(() => expect(a.result.current.me).toMatchObject({ rol: 'docente' }));
        expect(b.result.current.me).toMatchObject({ rol: 'docente' });
        expect(yo).toHaveBeenCalledTimes(1);
        const c = renderHook(() => useMe());
        expect(c.result.current.me).toMatchObject({ rol: 'docente' });
        expect(yo).toHaveBeenCalledTimes(1);
    });

    it('se invalida al cerrar sesion', async () => {
        yo.mockResolvedValue({ id_usuario: 1 });
        const { result } = renderHook(() => useMe());
        await waitFor(() => expect(result.current.me).not.toBeNull());
        yo.mockResolvedValue({ id_usuario: 2 });
        act(() => emitirCambioSesion('cierre'));
        await waitFor(() => expect(result.current.me).toMatchObject({ id_usuario: 2 }));
        expect(yo).toHaveBeenCalledTimes(2);
    });

    it('un error no se reintenta en bucle', async () => {
        yo.mockRejectedValue({ code: 'P0001', hint: 'NO_AUTENTICADO', message: 'Debes iniciar sesión.' });
        const { result } = renderHook(() => useMe());
        await waitFor(() => expect(result.current.error).toMatchObject({ code: 'NO_AUTENTICADO' }));
        expect(yo).toHaveBeenCalledTimes(1);
    });
});
