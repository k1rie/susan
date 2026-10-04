// handle(): envoltorio único de los Route Handlers. Autenticar -> autorizar -> validar -> ejecutar -> mapear errores.
// Los Route Handlers son endpoints públicos: ninguno debe exportarse sin pasar por aquí. Solo servidor.
import * as z from 'zod';
import { ApiError, fromRpcError } from '@/lib/api/errors';
import { callRpc } from '@/lib/api/client';
import { getAdminBackend } from '@/lib/backend';
import { exigirUsuario, verificarCron, verificarOrigen } from './auth.js';
import { ipDeOrigen } from './ip.js';
import { leerArchivoValidado } from './storage.js';

// Mensajes de zod en español: llegan a `details.campos[].mensaje` y se muestran tal cual en los formularios.
z.config(z.locales.es());

const MAX_JSON_BYTES = 256 * 1024;
const MARGEN_MULTIPART = 64 * 1024; // cabeceras y campos de texto del multipart

const CABECERAS_BASE = Object.freeze({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
});

/** Response.json con Cache-Control: no-store. */
export function json(cuerpo, status = 200, headers = {}) {
    return Response.json(cuerpo, { status, headers: { ...CABECERAS_BASE, ...headers } });
}
export const creado = (cuerpo) => json(cuerpo, 201);
export const sinContenido = () => new Response(null, { status: 204, headers: { ...CABECERAS_BASE } });

// ---------------------------------------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------------------------------------

/** ZodError -> ApiError VALIDACION con details.campos [{ campo, mensaje }]. */
export function validacionDeZod(zodError) {
    const campos = zodError.issues.flatMap((i) => {
        if (i.code === 'unrecognized_keys') {
            return i.keys.map((k) => ({ campo: [...i.path, k].join('.'), mensaje: 'Campo no permitido.' }));
        }
        return [{ campo: i.path.join('.'), mensaje: i.message }];
    });
    return new ApiError({ code: 'VALIDACION', message: 'Revisa los datos enviados.', status: 422, details: { campos } });
}

/** Cualquier cosa lanzada -> ApiError. Los errores desconocidos no filtran detalles internos. */
export function aApiError(e) {
    if (e instanceof ApiError) return e;
    if (e instanceof z.ZodError) return validacionDeZod(e);
    // Forma supabase-js ({ message, code, details, hint }) que alguna capa propagó sin convertir.
    if (e && typeof e === 'object' && !(e instanceof Error) && typeof e.code === 'string' && 'message' in e) {
        return fromRpcError(e);
    }
    return new ApiError({
        code: 'ERROR_INTERNO',
        message: 'Ocurrió un error inesperado. Inténtalo de nuevo.',
        status: 500,
    });
}

/**
 * Respuesta de error uniforme { error: { code, message, details? } }. Para ERROR_INTERNO jamás sale `details`
 * (fromRpcError deja ahí el texto crudo de PostgreSQL) ni el nombre de la excepción.
 */
export function respuestaDeError(e, request) {
    const apiError = aApiError(e);
    const interno = apiError.code === 'ERROR_INTERNO';
    const status = apiError.status >= 400 && apiError.status <= 599 ? apiError.status : 500;
    if (status >= 500) {
        // Sin cuerpo, cabeceras, ids de objeto ni PII: solo qué falló y dónde.
        let ruta = '';
        try {
            ruta = new URL(request.url).pathname;
        } catch {
            ruta = '';
        }
        const nombre = interno && !(e instanceof ApiError) && e?.name ? ` ${String(e.name).slice(0, 40)}` : '';
        console.error(`[api] ${request?.method ?? ''} ${ruta} ${apiError.code} ${status}${nombre}`);
    }
    const cuerpo = { code: apiError.code, message: apiError.message };
    if (!interno && apiError.details !== null && apiError.details !== undefined) cuerpo.details = apiError.details;
    const headers = {};
    const espera = apiError.details?.reintentar_en_seg;
    if (status === 429 && Number.isFinite(espera)) headers['Retry-After'] = String(Math.ceil(espera));
    return json({ error: cuerpo }, status, headers);
}

// ---------------------------------------------------------------------------------------------------------
// Lectura del cuerpo (con tope real, no solo Content-Length)
// ---------------------------------------------------------------------------------------------------------

const limiteExcedido = (multipart) => new ApiError({
    code: multipart ? 'ARCHIVO_DEMASIADO_GRANDE' : 'LIMITE_EXCEDIDO',
    message: 'El archivo o el cuerpo supera el tamaño permitido.',
    status: 413,
});

/** Lee el cuerpo contando bytes: un Content-Length falso o ausente (chunked) no evita el tope. */
async function leerCuerpoLimitado(request, maxBytes, multipart) {
    const declarado = Number(request.headers.get('content-length'));
    if (Number.isFinite(declarado) && declarado > maxBytes) throw limiteExcedido(multipart);
    if (!request.body) return Buffer.alloc(0);
    const lector = request.body.getReader();
    const trozos = [];
    let total = 0;
    for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
            await lector.cancel().catch(() => {});
            throw limiteExcedido(multipart);
        }
        trozos.push(value);
    }
    return Buffer.concat(trozos);
}

function queryDeUrl(request) {
    const params = new URL(request.url).searchParams;
    const salida = {};
    for (const clave of new Set(params.keys())) {
        const valores = params.getAll(clave);
        salida[clave] = valores.length > 1 ? valores : valores[0];
    }
    return salida;
}

const tipoDeContenido = (request) => String(request.headers.get('content-type') || '').toLowerCase();

function parsear(esquema, datos) {
    const r = esquema.safeParse(datos);
    if (!r.success) throw validacionDeZod(r.error);
    return r.data;
}

// ---------------------------------------------------------------------------------------------------------
// Archivos del multipart
// ---------------------------------------------------------------------------------------------------------

const errorDeCampo = (campo, mensaje) => validacionDeZod(new z.ZodError([{ code: 'custom', path: [campo], message: mensaje }]));

/** Relanza un error de archivo agregando `campo` e `indice` a sus details para que la pantalla marque la foto exacta. */
function conIndice(e, campo, indice) {
    if (!(e instanceof ApiError)) return e;
    const base = e.details && typeof e.details === 'object' && !Array.isArray(e.details) ? e.details : {};
    return new ApiError({ code: e.code, message: e.message, status: e.status, details: { ...base, campo, indice } });
}

/**
 * Valida y lee los archivos de UN campo del multipart según su spec. Devuelve el archivo (o null) para campos
 * simples y un arreglo (posiblemente vacío) para los `multiple`. Los topes de cantidad y de bytes totales se
 * comprueban con lo DECLARADO antes de leer nada y otra vez con lo realmente recibido.
 */
async function leerCampoArchivos(spec, recibidos) {
    const { campo, maxBytes, tipos, multiple = false, maxArchivos, maxBytesTotal } = spec;
    if (recibidos.length === 0) {
        if (spec.requerido === false) return multiple ? [] : null;
        throw errorDeCampo(campo, 'El archivo es obligatorio.');
    }
    if (!multiple) {
        if (recibidos.length > 1) throw errorDeCampo(campo, 'Solo se admite un archivo en este campo.');
        return leerArchivoValidado(recibidos[0], { permitidos: tipos, maxBytes });
    }
    if (maxArchivos !== undefined && recibidos.length > maxArchivos) {
        throw new ApiError({
            code: 'DEMASIADOS_ARCHIVOS',
            message: `Se admiten como máximo ${maxArchivos} archivos en este campo.`,
            status: 422,
            details: { campo, maximo: maxArchivos, recibidos: recibidos.length },
        });
    }
    const excedeTotal = () => new ApiError({
        code: 'ARCHIVO_DEMASIADO_GRANDE',
        message: 'Los archivos juntos superan el tamaño permitido.',
        status: 413,
        details: { campo },
    });
    if (maxBytesTotal !== undefined && recibidos.reduce((s, a) => s + (a.size ?? 0), 0) > maxBytesTotal) throw excedeTotal();
    const salida = [];
    let total = 0;
    for (const [indice, archivo] of recibidos.entries()) {
        try {
            salida.push(await leerArchivoValidado(archivo, { permitidos: tipos, maxBytes }));
        } catch (e) {
            throw conIndice(e, campo, indice);
        }
        total += salida[indice].size;
    }
    if (maxBytesTotal !== undefined && total > maxBytesTotal) throw excedeTotal();
    return salida;
}

// ---------------------------------------------------------------------------------------------------------
// handle
// ---------------------------------------------------------------------------------------------------------

/**
 * @typedef {Object} OpcionesHandle
 * @property {'usuario' | 'cron' | 'publica'} [auth='usuario']
 * @property {string[]} [roles]   solo auth:'usuario'; omitido = cualquier rol activo
 * @property {import('zod').ZodType} [input]    cuerpo JSON
 * @property {import('zod').ZodType} [query]    parámetros de URL
 * @property {import('zod').ZodType} [params]   segmentos dinámicos
 * @property {import('zod').ZodType} [fields]   campos de texto de un multipart/form-data
 * @property {{ campo: string, maxBytes: number, tipos: string[], requerido?: boolean, multiple?: boolean,
 *   maxArchivos?: number, maxBytesTotal?: number }[]} [archivos]
 *   `multiple`: el campo puede repetirse (form.archivos[campo] = arreglo en orden de llegada, [] si no llegó nada
 *   y requerido:false). Sin `multiple`, repetir el campo es un 422. `maxArchivos` y `maxBytesTotal` solo aplican
 *   a los campos múltiples.
 * @property {number} [maxBodyBytes]  tope del cuerpo JSON (def. 256 KiB)
 * @property {number} [maxMultipartBytes]  tope del cuerpo multipart completo (def. suma de maxBytes + margen). Las
 *   rutas con varias fotos lo fijan bajo el tope de 10 MB del proxy de Next, que trunca en silencio lo que lo pase.
 *
 * Con `input` y `fields` a la vez el endpoint acepta JSON o multipart según Content-Type; en ambos casos
 * `ctx.body` trae los campos ya validados.
 */

/**
 * @param {OpcionesHandle} opciones
 * @param {(ctx: object) => Promise<any> | any} fn
 * @returns {(request: Request, routeContext?: { params?: Promise<object> }) => Promise<Response>}
 */
export function handle(opciones, fn) {
    const { auth = 'usuario', roles, input, query, params, fields, archivos = [] } = opciones ?? {};
    const aceptaJson = Boolean(input);
    const aceptaMultipart = Boolean(fields) || archivos.length > 0;
    const maxMultipart = opciones?.maxMultipartBytes
        ?? archivos.reduce((s, a) => s + a.maxBytes, 0) + MARGEN_MULTIPART;
    const maxJson = opciones?.maxBodyBytes ?? MAX_JSON_BYTES;

    return async function manejador(request, routeContext) {
        try {
            // 1. Autenticación y autorización
            let sesion = { backend: null, me: null, user: null, ip: ipDeOrigen(request) };
            if (auth === 'usuario') sesion = await exigirUsuario(request, { roles });
            else if (auth === 'cron') verificarCron(request);
            else verificarOrigen(request);

            // 2-3. Tamaño y cuerpo
            let body = {};
            const form = { campos: {}, archivos: {} };
            if (aceptaJson || aceptaMultipart) {
                const ct = tipoDeContenido(request);
                const metodo = String(request.method).toUpperCase();
                const conCuerpo = !['GET', 'HEAD', 'OPTIONS'].includes(metodo);
                if (conCuerpo) {
                    const esMultipart = ct.startsWith('multipart/form-data');
                    const esJson = ct.startsWith('application/json');
                    if (esMultipart && aceptaMultipart) {
                        const crudo = await leerCuerpoLimitado(request, maxMultipart, true);
                        let datos;
                        try {
                            datos = await new Request('http://interno.local/', {
                                method: 'POST',
                                headers: { 'content-type': request.headers.get('content-type') },
                                body: crudo,
                            }).formData();
                        } catch {
                            throw new ApiError({ code: 'PETICION_INVALIDA', message: 'El formulario enviado no se pudo leer.', status: 400 });
                        }
                        const texto = {};
                        const subidos = {}; // campo -> [archivos]: un mismo nombre puede repetirse (varias fotos)
                        for (const [clave, valor] of datos.entries()) {
                            if (typeof valor === 'string') texto[clave] = valor;
                            else (subidos[clave] ??= []).push(valor);
                        }
                        body = fields ? parsear(fields, texto) : {};
                        form.campos = body;
                        for (const spec of archivos) {
                            form.archivos[spec.campo] = await leerCampoArchivos(spec, subidos[spec.campo] ?? []);
                        }
                    } else if (esJson && aceptaJson) {
                        const crudo = await leerCuerpoLimitado(request, maxJson, false);
                        let datos;
                        try {
                            datos = crudo.length ? JSON.parse(crudo.toString('utf8')) : {};
                        } catch {
                            throw new ApiError({ code: 'PETICION_INVALIDA', message: 'El cuerpo no es JSON válido.', status: 400 });
                        }
                        body = parsear(input, datos);
                    } else if (!ct && !request.body && aceptaJson) {
                        body = parsear(input, {}); // POST sin cuerpo: valen los valores por omisión del esquema
                    } else {
                        throw new ApiError({ code: 'TIPO_NO_SOPORTADO', message: 'Tipo de contenido no soportado.', status: 415 });
                    }
                    // JSON y multipart a la vez: los archivos opcionales ausentes quedan en null para uniformidad.
                    for (const spec of archivos) if (!(spec.campo in form.archivos)) form.archivos[spec.campo] = spec.multiple ? [] : null;
                } else {
                    for (const spec of archivos) form.archivos[spec.campo] = spec.multiple ? [] : null;
                }
            }

            // 4. Validación de query y params
            const parametrosQuery = query ? parsear(query, queryDeUrl(request)) : {};
            const parametrosRuta = params ? parsear(params, (await routeContext?.params) ?? {}) : {};

            // 5. Ejecución
            let adminCache = null;
            const admin = async () => {
                adminCache ??= await getAdminBackend();
                return adminCache;
            };
            const sinBackend = () => {
                throw new ApiError({ code: 'ERROR_INTERNO', message: 'Esta ruta no tiene identidad de usuario.', status: 500 });
            };
            const ctx = {
                request,
                user: sesion.user,
                me: sesion.me,
                ip: sesion.ip,
                body,
                query: parametrosQuery,
                params: parametrosRuta,
                form,
                backend: sesion.backend,
                admin,
                /** RPC api_* con la identidad DEL USUARIO (la RLS aplica). */
                rpc: sesion.backend
                    ? (nombre, args) => callRpc(nombre, args, { backend: sesion.backend })
                    : sinBackend,
                /** RPC svc_* con service_role. */
                svc: async (nombre, args) => callRpc(nombre, args, { backend: await admin() }),
            };
            const resultado = await fn(ctx);
            if (resultado instanceof Response) return resultado;
            return json(resultado === undefined ? { ok: true } : resultado);
        } catch (e) {
            return respuestaDeError(e, request);
        }
    };
}
