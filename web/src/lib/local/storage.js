// Storage del modo local: objetos en disco <LOCAL_STORAGE_DIR>/<bucket>/<ruta> (el servicio de
// reconocimiento lee y escribe el mismo arbol). Imita la superficie permitida de supabase-js:
// upload / download / remove / createSignedUrl, todas con forma { data, error }.
//
// Dos privilegios, como en Supabase:
//  - 'servicio' (service_role): salta politicas.
//  - 'usuario' (JWT del usuario): el bucket privado de la app esta CERRADO por la politica
//    RESTRICTIVE de 0090_storage_policies.sql (el navegador nunca toca el bucket). Aqui se
//    replica para que nada funcione solo en local. Otros buckets de desarrollo si se permiten.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { BUCKET, serverEnv } from '@/config';
import { esUuid, firmarCarga, verificarCarga } from './session.js';

export const MAX_SUBIDA = 10 * 1024 * 1024; // mismo tope que file_size_limit del bucket real
export const MAX_URL_FIRMADA_SEG = 300; // CLAUDE.md: objetos solo por URL firmada <= 300 s
export const RUTA_OBJETO_FIRMADO = '/api/_local/storage/object';

const RE_BUCKET = /^[a-z0-9][a-z0-9._-]{1,62}$/;
const MAX_RUTA = 1024;

const TIPOS = {
    '.json': 'application/json',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain; charset=utf-8',
};

export const tipoPorRuta = (ruta) => TIPOS[path.extname(String(ruta)).toLowerCase()] || 'application/octet-stream';

/** Error con la forma de StorageApiError de supabase-js. */
export function errorStorage(message, statusCode, error = 'StorageError') {
    return { name: 'StorageApiError', message, statusCode: String(statusCode), error, status: Number(statusCode) };
}

const rechazo = (message, status, tipo) => ({ data: null, error: errorStorage(message, status, tipo) });

/**
 * Valida una ruta de objeto: sin '..', sin absolutas, sin NUL ni retroceso, sin segmentos vacios.
 * Devuelve la lista de segmentos o null si no es valida.
 */
export function segmentosSeguros(ruta) {
    if (typeof ruta !== 'string' || ruta.length === 0 || ruta.length > MAX_RUTA) return null;
    if (/[\u0000-\u001f\u007f\\]/.test(ruta)) return null;
    if (ruta.startsWith('/')) return null;
    const segs = ruta.split('/');
    if (segs.some((s) => s === '' || s === '.' || s === '..')) return null;
    return segs;
}

export const bucketValido = (bucket) => typeof bucket === 'string' && RE_BUCKET.test(bucket);

export const raizStorage = () => path.resolve(/*turbopackIgnore: true*/ process.cwd(), serverEnv().localStorageDir);

/** Ruta absoluta en disco de un objeto, con segunda barrera contra salir de la raiz. */
export function rutaEnDisco(bucket, ruta) {
    const segs = segmentosSeguros(ruta);
    if (!bucketValido(bucket) || !segs) return null;
    const raiz = raizStorage();
    const archivo = path.join(raiz, bucket, ...segs);
    if (!archivo.startsWith(raiz + path.sep)) return null;
    return archivo;
}

async function aBuffer(cuerpo) {
    if (Buffer.isBuffer(cuerpo)) return cuerpo;
    if (typeof cuerpo === 'string') return Buffer.from(cuerpo, 'utf8');
    if (cuerpo instanceof ArrayBuffer) return Buffer.from(cuerpo);
    if (ArrayBuffer.isView(cuerpo)) return Buffer.from(cuerpo.buffer, cuerpo.byteOffset, cuerpo.byteLength);
    if (cuerpo && typeof cuerpo.arrayBuffer === 'function') return Buffer.from(await cuerpo.arrayBuffer());
    return null;
}

// ---- Token de URL firmada --------------------------------------------------------------------
export function firmarObjeto(bucket, ruta, segundos, { secreto = serverEnv().localAuthSecret, ahoraSeg = Math.floor(Date.now() / 1000) } = {}) {
    const dur = Math.min(MAX_URL_FIRMADA_SEG, Math.max(1, Math.floor(Number(segundos)) || MAX_URL_FIRMADA_SEG));
    return firmarCarga({ bucket, path: ruta, exp: ahoraSeg + dur }, secreto, 'storage');
}

/** { bucket, path } si el token es autentico, vigente y apunta a una ruta valida; si no, null. */
export function verificarTokenObjeto(token, { secreto = serverEnv().localAuthSecret, ahoraSeg } = {}) {
    const carga = verificarCarga(token, secreto, 'storage', ahoraSeg);
    if (!carga || !bucketValido(carga.bucket) || !segmentosSeguros(carga.path)) return null;
    return { bucket: carga.bucket, path: carga.path };
}

// ---- Superficie supabase-like ----------------------------------------------------------------
/**
 * @param {{ privilegios?: 'servicio'|'usuario', sub?: string }} opciones
 */
export function crearStorageLocal({ privilegios = 'servicio', sub } = {}) {
    function comprobar(bucket, ruta) {
        if (!bucketValido(bucket)) return errorStorage('Nombre de bucket invalido', 400, 'InvalidBucket');
        if (ruta !== undefined && !segmentosSeguros(ruta)) return errorStorage('Ruta de objeto invalida', 400, 'InvalidKey');
        if (privilegios === 'usuario') {
            if (!esUuid(sub)) return errorStorage('Unauthorized', 401, 'Unauthorized');
            if (bucket === BUCKET) {
                return errorStorage('new row violates row-level security policy', 403, 'Unauthorized');
            }
        }
        return null;
    }

    return {
        from(bucket) {
            return {
                async upload(ruta, cuerpo, opciones = {}) {
                    const e = comprobar(bucket, ruta);
                    if (e) return { data: null, error: e };
                    const buf = await aBuffer(cuerpo);
                    if (!buf) return rechazo('Cuerpo de subida no soportado', 400, 'InvalidRequest');
                    if (buf.length > MAX_SUBIDA) return rechazo('The object exceeded the maximum allowed size', 413, 'Payload too large');
                    const archivo = rutaEnDisco(bucket, ruta);
                    const tmp = `${archivo}.${crypto.randomBytes(6).toString('hex')}.tmp`;
                    try {
                        await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(archivo), { recursive: true });
                        await fs.writeFile(/*turbopackIgnore: true*/ tmp, buf);
                        if (opciones.upsert) {
                            await fs.rename(/*turbopackIgnore: true*/ tmp, archivo); // atomico: el lector nunca ve un archivo a medias
                        } else {
                            await fs.link(tmp, archivo); // EEXIST si ya existe
                            await fs.unlink(/*turbopackIgnore: true*/ tmp);
                        }
                    } catch (err) {
                        await fs.unlink(/*turbopackIgnore: true*/ tmp).catch(() => {});
                        if (err.code === 'EEXIST') return rechazo('The resource already exists', 409, 'Duplicate');
                        return rechazo(`Error de disco: ${err.code || 'desconocido'}`, 500, 'InternalError');
                    }
                    return { data: { path: ruta, id: crypto.randomUUID(), fullPath: `${bucket}/${ruta}` }, error: null };
                },

                async download(ruta) {
                    const e = comprobar(bucket, ruta);
                    if (e) return { data: null, error: e };
                    try {
                        const buf = await fs.readFile(/*turbopackIgnore: true*/ rutaEnDisco(bucket, ruta));
                        return { data: new Blob([buf], { type: tipoPorRuta(ruta) }), error: null };
                    } catch (err) {
                        if (err.code === 'ENOENT' || err.code === 'EISDIR') return rechazo('Object not found', 404, 'not_found');
                        return rechazo(`Error de disco: ${err.code || 'desconocido'}`, 500, 'InternalError');
                    }
                },

                async remove(rutas) {
                    if (!Array.isArray(rutas) || rutas.length === 0 || rutas.length > 1000) {
                        return rechazo('Se esperaba una lista de rutas', 400, 'InvalidRequest');
                    }
                    for (const r of rutas) {
                        const e = comprobar(bucket, r);
                        if (e) return { data: null, error: e };
                    }
                    const quitados = [];
                    for (const r of rutas) {
                        try {
                            await fs.unlink(/*turbopackIgnore: true*/ rutaEnDisco(bucket, r));
                            quitados.push({ name: r, bucket_id: bucket });
                        } catch (err) {
                            if (err.code !== 'ENOENT') return rechazo(`Error de disco: ${err.code || 'desconocido'}`, 500, 'InternalError');
                        }
                    }
                    return { data: quitados, error: null };
                },

                async createSignedUrl(ruta, segundos) {
                    const e = comprobar(bucket, ruta);
                    if (e) return { data: null, error: e };
                    try {
                        const st = await fs.stat(/*turbopackIgnore: true*/ rutaEnDisco(bucket, ruta));
                        if (!st.isFile()) return rechazo('Object not found', 404, 'not_found');
                    } catch {
                        return rechazo('Object not found', 404, 'not_found');
                    }
                    const token = firmarObjeto(bucket, ruta, segundos);
                    return { data: { signedUrl: `${RUTA_OBJETO_FIRMADO}?token=${token}` }, error: null };
                },
            };
        },
    };
}
