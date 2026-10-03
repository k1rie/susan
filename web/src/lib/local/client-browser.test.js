import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearBackendNavegadorLocal } from './client-browser.js';

const respuesta = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('cliente local del navegador', () => {
    it('getUser: sin sesion devuelve AuthSessionMissingError; con sesion, el usuario', async () => {
        const fetchFalso = vi
            .fn()
            .mockResolvedValueOnce(respuesta({ data: { user: null, session: null }, error: null }))
            .mockResolvedValueOnce(respuesta({ data: { user: { id: 'u1', email: 'a@b.c' }, session: { user: { id: 'u1' } } }, error: null }));
        vi.stubGlobal('fetch', fetchFalso);
        const b = crearBackendNavegadorLocal();
        expect((await b.auth.getUser()).error.name).toBe('AuthSessionMissingError');
        expect((await b.auth.getUser()).data.user).toEqual({ id: 'u1', email: 'a@b.c' });
        const [url, init] = fetchFalso.mock.calls[0];
        expect(url).toBe('/api/_local/auth/session');
        expect(init).toMatchObject({ method: 'GET', credentials: 'same-origin' });
    });

    it('signInWithPassword emite SIGNED_IN y signOut SIGNED_OUT a los oyentes', async () => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValueOnce(respuesta({ data: { user: null, session: null }, error: null })) // INITIAL_SESSION
                .mockResolvedValueOnce(respuesta({ data: { user: { id: 'u1' }, session: { user: { id: 'u1' } } }, error: null }))
                .mockResolvedValueOnce(respuesta({ error: null })),
        );
        const b = crearBackendNavegadorLocal();
        const eventos = [];
        const { data } = b.auth.onAuthStateChange((e, s) => eventos.push([e, s?.user?.id ?? null]));
        await new Promise((r) => setTimeout(r, 20));
        await b.auth.signInWithPassword({ email: 'a@b.c', password: 'x' });
        await b.auth.signOut();
        data.subscription.unsubscribe();
        expect(eventos).toEqual([
            ['INITIAL_SESSION', null],
            ['SIGNED_IN', 'u1'],
            ['SIGNED_OUT', null],
        ]);
    });

    it('rpc: POST con { args } y solo api_*; svc_* se rechaza sin llamar a la red', async () => {
        const fetchFalso = vi.fn().mockResolvedValue(respuesta({ data: { ok: 1 }, error: null }));
        vi.stubGlobal('fetch', fetchFalso);
        const b = crearBackendNavegadorLocal();
        expect(await b.rpc('api_yo', { p_x: 1 })).toEqual({ data: { ok: 1 }, error: null });
        expect(fetchFalso.mock.calls[0][0]).toBe('/api/_local/rpc/api_yo');
        expect(JSON.parse(fetchFalso.mock.calls[0][1].body)).toEqual({ args: { p_x: 1 } });
        const svc = await b.rpc('svc_crear_captura', {});
        expect(svc.error.code).toBe('PGRST202');
        expect(fetchFalso).toHaveBeenCalledTimes(1);
    });

    it('un fallo de red se convierte en error, no en excepcion', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fallo')));
        const b = crearBackendNavegadorLocal();
        expect((await b.rpc('api_yo', {})).error.code).toBe('LOCAL_FETCH_ERROR');
        expect((await b.auth.signInWithPassword({ email: 'a', password: 'b' })).error.code).toBe('LOCAL_FETCH_ERROR');
        expect((await b.storage.from('x').download('a.txt')).error).toBeTruthy();
    });

    it('storage: upload por multipart, download como Blob, firma y borrado por JSON', async () => {
        const fetchFalso = vi
            .fn()
            .mockResolvedValueOnce(respuesta({ data: { path: 'a.txt' }, error: null }))
            .mockResolvedValueOnce(new Response('hola', { status: 200 }))
            .mockResolvedValueOnce(respuesta({ data: { signedUrl: '/api/_local/storage/object?token=t' }, error: null }))
            .mockResolvedValueOnce(respuesta({ data: [{ name: 'a.txt' }], error: null }));
        vi.stubGlobal('fetch', fetchFalso);
        const s = crearBackendNavegadorLocal().storage.from('susan-test');
        await s.upload('a.txt', new Blob(['hola']), { upsert: true });
        const form = fetchFalso.mock.calls[0][1].body;
        expect(form.get('bucket')).toBe('susan-test');
        expect(form.get('path')).toBe('a.txt');
        expect(form.get('upsert')).toBe('true');
        expect(await (await s.download('a.txt')).data.text()).toBe('hola');
        expect((await s.createSignedUrl('a.txt', 60)).data.signedUrl).toContain('token=t');
        expect((await s.remove(['a.txt'])).data).toHaveLength(1);
    });
});
