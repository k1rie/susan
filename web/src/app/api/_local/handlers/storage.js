// Handlers /api/_local/storage/*: upload (multipart, <= 10 MB), download, remove, signed-url y
// object (GET con token firmado). Las rutas de objeto se validan en lib/local/storage.js.
// Los de usuario respetan la politica RESTRICTIVE del bucket privado (ver storage.js).
import { z } from 'zod';
import {
    MAX_SUBIDA,
    crearStorageLocal,
    tipoPorRuta,
    verificarTokenObjeto,
} from '@/lib/local/storage.js';
import { errorHttp, json, leerJson, manejar } from './comun.js';

const esquemaObjeto = z.object({ bucket: z.string().min(2).max(63), path: z.string().min(1).max(1024) });
const esquemaFirma = esquemaObjeto.extend({ expiresIn: z.number().int().positive().optional() });
const esquemaQuitar = z.object({ bucket: z.string().min(2).max(63), paths: z.array(z.string().min(1).max(1024)).min(1).max(100) });

const estatus = (error) => (error?.status >= 400 && error.status < 600 ? error.status : 400);
const respuesta = ({ data, error }) => (error ? json({ data: null, error }, estatus(error)) : json({ data, error: null }));
const almacenDe = (usuario) => crearStorageLocal({ privilegios: 'usuario', sub: usuario.user.id });

export function upload(request) {
    return manejar(request, {}, async ({ usuario }) => {
        const largo = Number(request.headers.get('content-length') || 0);
        // Tope previo a leer el cuerpo (el multipart agrega algo de sobrecarga a los 10 MB).
        if (largo > MAX_SUBIDA + 64 * 1024) return errorHttp('El archivo excede 10 MB.', 'payload_too_large', 413);
        let form;
        try {
            form = await request.formData();
        } catch {
            return errorHttp('Se esperaba multipart/form-data.', 'validation_failed', 400);
        }
        const bucket = form.get('bucket');
        const ruta = form.get('path');
        const archivo = form.get('file');
        if (typeof bucket !== 'string' || typeof ruta !== 'string' || !archivo || typeof archivo === 'string') {
            return errorHttp('Faltan bucket, path o file.', 'validation_failed', 400);
        }
        if (archivo.size > MAX_SUBIDA) return errorHttp('El archivo excede 10 MB.', 'payload_too_large', 413);
        return respuesta(await almacenDe(usuario).from(bucket).upload(ruta, archivo, { upsert: form.get('upsert') === 'true' }));
    });
}

export function download(request) {
    return manejar(request, {}, async ({ usuario }) => {
        const cuerpo = esquemaObjeto.safeParse(await leerJson(request));
        if (!cuerpo.success) return errorHttp('Se esperaba { bucket, path }.', 'validation_failed', 400);
        const { data, error } = await almacenDe(usuario).from(cuerpo.data.bucket).download(cuerpo.data.path);
        if (error) return json({ data: null, error }, estatus(error));
        return new Response(Buffer.from(await data.arrayBuffer()), {
            headers: { 'content-type': tipoPorRuta(cuerpo.data.path), 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' },
        });
    });
}

export function remove(request) {
    return manejar(request, {}, async ({ usuario }) => {
        const cuerpo = esquemaQuitar.safeParse(await leerJson(request));
        if (!cuerpo.success) return errorHttp('Se esperaba { bucket, paths }.', 'validation_failed', 400);
        return respuesta(await almacenDe(usuario).from(cuerpo.data.bucket).remove(cuerpo.data.paths));
    });
}

export function signedUrl(request) {
    return manejar(request, {}, async ({ usuario }) => {
        const cuerpo = esquemaFirma.safeParse(await leerJson(request));
        if (!cuerpo.success) return errorHttp('Se esperaba { bucket, path, expiresIn? }.', 'validation_failed', 400);
        return respuesta(await almacenDe(usuario).from(cuerpo.data.bucket).createSignedUrl(cuerpo.data.path, cuerpo.data.expiresIn ?? 60));
    });
}

// GET con token: la "URL firmada" local. El token (HMAC + expiracion) es la capacidad; ademas se
// exige la cookie de sesion (mas estricto que Supabase, donde la URL firmada es portadora).
export function objeto(request) {
    return manejar(request, { estado: false }, async () => {
        const token = request.nextUrl.searchParams.get('token');
        const dato = verificarTokenObjeto(token);
        if (!dato) return errorHttp('Token invalido o vencido.', 'token_invalido', 403);
        // La firma ya autoriza: se lee con privilegios de servicio (el token solo lo emite el servidor).
        const { data, error } = await crearStorageLocal({ privilegios: 'servicio' }).from(dato.bucket).download(dato.path);
        if (error) return json({ data: null, error }, estatus(error));
        const tipo = tipoPorRuta(dato.path);
        const embebible = tipo.startsWith('image/') || tipo === 'application/pdf';
        return new Response(Buffer.from(await data.arrayBuffer()), {
            headers: {
                'content-type': tipo,
                'content-disposition': embebible ? 'inline' : 'attachment',
                'cache-control': 'private, no-store',
                'x-content-type-options': 'nosniff',
            },
        });
    });
}
