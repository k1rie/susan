// Backend local para el NAVEGADOR: misma superficie permitida, pero por fetch a /api/_local/*
// (la cookie de sesion es httpOnly: el JS no la ve, solo la envia el navegador). Sin imports de
// Node: este modulo viaja en el bundle del cliente.
const BASE = '/api/_local';

const errorRed = (mensaje = 'No se pudo contactar al servidor local.') => ({
    name: 'AuthRetryableFetchError',
    message: mensaje,
    status: 0,
    code: 'LOCAL_FETCH_ERROR',
});

const errorSinSesion = () => ({ name: 'AuthSessionMissingError', message: 'Auth session missing!', status: 400 });

async function llamar(ruta, { metodo = 'POST', json, form } = {}) {
    const init = { method: metodo, credentials: 'same-origin', headers: {} };
    if (form) {
        init.body = form;
    } else if (json !== undefined) {
        init.headers['content-type'] = 'application/json';
        init.body = JSON.stringify(json);
    }
    try {
        return await fetch(`${BASE}${ruta}`, init);
    } catch {
        return null;
    }
}

async function leerJson(res) {
    if (!res) return null;
    try {
        return await res.json();
    } catch {
        return null;
    }
}

export function crearBackendNavegadorLocal() {
    const oyentes = new Set();
    const emitir = (evento, sesion) => {
        for (const cb of [...oyentes]) {
            try {
                cb(evento, sesion);
            } catch (e) {
                console.error('[local] error en un oyente de onAuthStateChange:', e);
            }
        }
    };

    async function leerSesion() {
        const res = await llamar('/auth/session', { metodo: 'GET' });
        const cuerpo = await leerJson(res);
        if (!res || !cuerpo) return { data: { user: null, session: null }, error: errorRed() };
        return { data: { user: cuerpo.data?.user ?? null, session: cuerpo.data?.session ?? null }, error: cuerpo.error ?? null };
    }

    const auth = {
        async getUser() {
            const r = await leerSesion();
            if (r.error) return { data: { user: null }, error: r.error };
            return r.data.user ? { data: { user: r.data.user }, error: null } : { data: { user: null }, error: errorSinSesion() };
        },
        async getSession() {
            const r = await leerSesion();
            return { data: { session: r.data.session }, error: r.error };
        },
        async signInWithPassword({ email, password } = {}) {
            const res = await llamar('/auth/login', { json: { email, password } });
            const cuerpo = await leerJson(res);
            if (!cuerpo) return { data: { user: null, session: null }, error: errorRed() };
            if (cuerpo.error) return { data: { user: null, session: null }, error: cuerpo.error };
            emitir('SIGNED_IN', cuerpo.data.session);
            return { data: cuerpo.data, error: null };
        },
        async signOut() {
            const res = await llamar('/auth/logout');
            const cuerpo = await leerJson(res);
            if (!cuerpo) return { error: errorRed() };
            if (!cuerpo.error) emitir('SIGNED_OUT', null);
            return { error: cuerpo.error ?? null };
        },
        async resetPasswordForEmail(email, opciones = {}) {
            const res = await llamar('/auth/reset', { json: { email, redirectTo: opciones.redirectTo } });
            const cuerpo = await leerJson(res);
            if (!cuerpo) return { data: null, error: errorRed() };
            return { data: cuerpo.data ?? {}, error: cuerpo.error ?? null };
        },
        async updateUser(attrs = {}) {
            const res = await llamar('/auth/password', { json: { password: attrs.password } });
            const cuerpo = await leerJson(res);
            if (!cuerpo) return { data: { user: null }, error: errorRed() };
            if (cuerpo.error) return { data: { user: null }, error: cuerpo.error };
            emitir('USER_UPDATED', null);
            return { data: cuerpo.data, error: null };
        },
        // Igual que supabase-js: INITIAL_SESSION llega de forma asincrona tras suscribirse.
        onAuthStateChange(callback) {
            oyentes.add(callback);
            setTimeout(async () => {
                if (!oyentes.has(callback)) return;
                const r = await leerSesion();
                if (oyentes.has(callback)) callback('INITIAL_SESSION', r.data.session);
            }, 0);
            return { data: { subscription: { unsubscribe: () => oyentes.delete(callback) } } };
        },
    };

    async function rpc(nombre, args) {
        if (typeof nombre !== 'string' || !/^api_[a-z0-9_]+$/.test(nombre)) {
            return { data: null, error: { message: 'Nombre de funcion no permitido.', code: 'PGRST202', details: null, hint: null } };
        }
        const res = await llamar(`/rpc/${nombre}`, { json: { args: args ?? {} } });
        const cuerpo = await leerJson(res);
        if (!cuerpo) {
            return { data: null, error: { message: 'No se pudo contactar al servidor local.', code: 'LOCAL_FETCH_ERROR', details: null, hint: null } };
        }
        return { data: cuerpo.data ?? null, error: cuerpo.error ?? null };
    }

    const storage = {
        from(bucket) {
            return {
                async upload(ruta, cuerpo, opciones = {}) {
                    const form = new FormData();
                    form.append('bucket', bucket);
                    form.append('path', ruta);
                    form.append('upsert', opciones.upsert ? 'true' : 'false');
                    form.append('file', cuerpo instanceof Blob ? cuerpo : new Blob([cuerpo], { type: opciones.contentType }), 'objeto');
                    const res = await llamar('/storage/upload', { form });
                    const r = await leerJson(res);
                    if (!r) return { data: null, error: errorRed() };
                    return { data: r.data ?? null, error: r.error ?? null };
                },
                async download(ruta) {
                    const res = await llamar('/storage/download', { json: { bucket, path: ruta } });
                    if (!res) return { data: null, error: errorRed() };
                    if (!res.ok) {
                        const r = await leerJson(res);
                        return { data: null, error: r?.error ?? errorRed(`Error ${res.status}`) };
                    }
                    return { data: await res.blob(), error: null };
                },
                async remove(rutas) {
                    const res = await llamar('/storage/remove', { json: { bucket, paths: rutas } });
                    const r = await leerJson(res);
                    if (!r) return { data: null, error: errorRed() };
                    return { data: r.data ?? null, error: r.error ?? null };
                },
                async createSignedUrl(ruta, segundos) {
                    const res = await llamar('/storage/signed-url', { json: { bucket, path: ruta, expiresIn: segundos } });
                    const r = await leerJson(res);
                    if (!r) return { data: null, error: errorRed() };
                    return { data: r.data ?? null, error: r.error ?? null };
                },
            };
        },
    };

    return { auth, rpc, storage };
}
