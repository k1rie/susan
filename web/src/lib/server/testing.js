// Ayudantes SOLO para pruebas (vitest): backends simulados tipo supabase-js y constructores de Request.
// No lo importa ningún código de producción.
import { vi } from 'vitest';

/** Los handlers de RPC pueden devolver { __error: {...} } para simular un error de PostgreSQL. */
export const errorDeNegocio = (hint, message = 'Error de negocio.') => ({
    __error: { code: 'P0001', hint, message, details: null },
});

/** Backend simulado. `rpcs`: { nombre: (args) => data | { __error } }. Registra llamadas en `llamadas`. */
export function crearBackend({ rpcs = {}, user = { id: 'auth-1' }, storage = {}, authAdmin = {} } = {}) {
    const llamadas = [];
    const rpc = vi.fn(async (nombre, args) => {
        llamadas.push(nombre);
        const manejador = rpcs[nombre];
        if (!manejador) return { data: null, error: { code: '42883', message: `no existe ${nombre}`, details: null, hint: null } };
        const resultado = await manejador(args);
        if (resultado && typeof resultado === 'object' && '__error' in resultado) return { data: null, error: resultado.__error };
        return { data: resultado === undefined ? null : resultado, error: null };
    });
    const bucket = {
        upload: vi.fn(async () => ({ data: {}, error: null })),
        createSignedUrl: vi.fn(async (ruta, seg) => ({ data: { signedUrl: `https://firmada.test/${ruta}?t=${seg}` }, error: null })),
        remove: vi.fn(async () => ({ data: [], error: null })),
        download: vi.fn(),
        ...storage,
    };
    return {
        llamadas,
        bucket,
        rpc,
        auth: {
            getUser: vi.fn(async () => ({ data: { user }, error: user ? null : { message: 'sin sesion' } })),
            getSession: vi.fn(),
            admin: {
                createUser: vi.fn(async () => ({ data: { user: { id: 'nuevo-uid' } }, error: null })),
                deleteUser: vi.fn(async () => ({ data: {}, error: null })),
                updateUserById: vi.fn(async () => ({ data: {}, error: null })),
                listUsers: vi.fn(async () => ({ data: { users: [] }, error: null })),
                ...authAdmin,
            },
        },
        storage: { from: vi.fn(() => bucket) },
    };
}

export const YO = {
    docente: { id_usuario: 7, correo: 'doc@x.test', rol: 'docente', activo: true, id_docente: 12, id_alumno: null, nombre: 'Doc', home: '/docente' },
    admin: { id_usuario: 1, correo: 'adm@x.test', rol: 'administrador', activo: true, id_docente: null, id_alumno: null, nombre: 'Adm', home: '/admin' },
    alumno: { id_usuario: 31, correo: 'al@x.test', rol: 'alumno', activo: true, id_docente: null, id_alumno: 44, nombre: 'Al', home: '/alumno' },
    tecnico: { id_usuario: 3, correo: 'tec@x.test', rol: 'tecnico', activo: true, id_docente: null, id_alumno: null, nombre: 'Tec', home: '/tecnico' },
};

/** Cabecera mínima de un JPEG / PNG / PDF real (lo que mira la detección por firma). */
export const BYTES_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
export const BYTES_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
export const BYTES_PDF = new TextEncoder().encode('%PDF-1.7\n%fake\n');

export const archivo = (bytes, tipo, nombre = 'a') => new File([bytes], nombre, { type: tipo });

/**
 * n JPEG con la misma firma y UN byte distinto: BYTES_JPEG idéntico repetido dispararía FOTOS_DUPLICADAS (sha256
 * de los bytes), así que las pruebas de varias fotos necesitan contenidos únicos que sigan pasando la firma binaria.
 * @returns {Uint8Array[]}
 */
export const fotosDistintas = (n) => Array.from({ length: n }, (_, i) => new Uint8Array([...BYTES_JPEG, i + 1]));

/** Request JSON o multipart (si `form` es un objeto { campo: string | File | Array }; un arreglo repite el campo). */
export function pedir(url, { method = 'POST', json, form, headers = {} } = {}) {
    const init = { method, headers: { ...headers } };
    if (json !== undefined) {
        init.headers['content-type'] = 'application/json';
        init.body = JSON.stringify(json);
    } else if (form) {
        const fd = new FormData();
        for (const [k, v] of Object.entries(form)) {
            for (const item of Array.isArray(v) ? v : [v]) fd.append(k, item);
        }
        init.body = fd;
    }
    return new Request(`http://localhost${url}`, init);
}

export const conParams = (params) => ({ params: Promise.resolve(params) });
