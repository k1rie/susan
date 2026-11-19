// Lógica de los Route Handlers de biometría: consentimiento, plantilla facial, documentos e índice. Solo servidor.
import { createHash } from 'node:crypto';
import { ApiError } from '@/lib/api/errors';
import { ttlUrlFirmada, eliminarObjetoSilencioso, rutaObjeto, subirObjeto, urlFirmada } from './storage.js';
import { validarFormaConjunto, verificarFotoServicio, verificarFotosServicio } from './recognition.js';
import { estadoIndice, reconstruirIndice, revertirIndice, sincronizarIndice } from './indice.js';

/**
 * Reconstruye el índice sin que su fallo invalide la operación que lo disparó: la plantilla/revocación ya quedó
 * guardada y el job reconstruir-indice (o el botón del técnico) completa lo pendiente.
 */
export async function reconstruirSinFallar(admin) {
    try {
        const r = await reconstruirIndice({ admin });
        return { estado: r.estado, version: r.version, total_vectores: r.total_vectores, muestras: r.muestras ?? [] };
    } catch (e) {
        if (e instanceof ApiError && e.code === 'RECONSTRUCCION_EN_CURSO') return { estado: 'en_curso', version: null };
        console.error('[indice] la reconstrucción tras el cambio falló; queda pendiente');
        return { estado: 'pendiente', version: null, error: { code: e instanceof ApiError ? e.code : 'ERROR_INTERNO' } };
    }
}

export const comoBlob = (archivo) => new Blob([archivo.bytes], { type: archivo.contentType });

/** Huella de los bytes: dos fotos con la misma huella son la misma toma subida dos veces. */
const sha256 = (archivo) => createHash('sha256').update(archivo.bytes).digest('hex');

/**
 * La calidad que devuelve el servicio trae `tamano_rostro_px`; el componente CalidadFotoResumen (docs/api/biometria.md
 * §2.1) lee `tamano_rostro`. Se entregan ambos para no romper a ninguno.
 */
function conAlias(calidad) {
    return { ...calidad, calidad: { ...calidad.calidad, tamano_rostro: calidad.calidad.tamano_rostro_px } };
}

const conAliasCalidad = (calidad) => (calidad ? { ...calidad, tamano_rostro: calidad.tamano_rostro_px } : null);

const errorValidacion = (campo, mensaje) => new ApiError({
    code: 'VALIDACION',
    message: 'Revisa los datos enviados.',
    status: 422,
    details: { campos: [{ campo, mensaje }] },
});

/**
 * `foto` (una sola, camino heredado) XOR `fotos` (1 a 8, repetido). Devuelve { foto, fotos }: exactamente uno viene
 * con valor. Ninguno o ambos es 422, no se adivina cuál quiso decir el cliente.
 */
export function fotosDeLaPeticion(form) {
    const foto = form.archivos.foto ?? null;
    const fotos = form.archivos.fotos ?? [];
    if (foto && fotos.length > 0) throw errorValidacion('fotos', "Envía 'foto' o 'fotos', no ambos.");
    if (!foto && fotos.length === 0) throw errorValidacion('fotos', "Falta la foto: envía 'foto' o 'fotos'.");
    return { foto, fotos };
}

/**
 * El consentimiento debe ser de este alumno y estar vigente ANTES de procesar o guardar su rostro (RN-13). Lo usan
 * el alta y la verificación por conjunto, porque esta última ya calcula embeddings y cosenos de identidad.
 */
async function exigirConsentimientoVigente(rpc, idAlumno, idConsent) {
    const consentimientos = await rpc('api_consentimientos_alumno', { idAlumno, limit: 200 });
    const consentimiento = consentimientos?.items?.find((c) => c.id_consent === idConsent);
    if (!consentimiento) {
        throw new ApiError({
            code: 'RN_13_CONSENTIMIENTO_AJENO', message: 'El consentimiento pertenece a otro alumno o no existe.', status: 409,
        });
    }
    if (!consentimiento.vigente) {
        throw new ApiError({
            code: 'RN_13_CONSENTIMIENTO_NO_VIGENTE',
            message: `El consentimiento ya no está vigente (estatus: ${consentimiento.estatus_efectivo ?? consentimiento.estatus}).`,
            status: 409,
        });
    }
}

/**
 * Fotos de bytes idénticos. Devuelve `de[i]` = índice de la primera foto igual a la i-ésima (o null si es la
 * primera ocurrencia) y la lista de índices únicos. Las copias exactas no se mandan al servicio: no aportan
 * identidad nueva y promediarlas solo daría más peso a una toma.
 */
export function agruparDuplicadas(archivos) {
    const vistas = new Map();
    const de = [];
    const unicas = [];
    archivos.forEach((archivo, i) => {
        const huella = sha256(archivo);
        if (vistas.has(huella)) {
            de.push(vistas.get(huella));
        } else {
            vistas.set(huella, i);
            de.push(null);
            unicas.push(i);
        }
    });
    return { de, unicas };
}

/**
 * Analiza el conjunto con el servicio (solo las fotos únicas) y devuelve el resultado mapeado a las posiciones
 * ORIGINALES del envío: las copias exactas salen como estado 'duplicada' (con `duplicada_de`) y el resto lleva el
 * análisis del servicio. Los totales (aceptadas, suficiente, consistencia, cosenos) son los del conjunto sin copias.
 */
export async function analizarConjunto(archivos, agrupacion) {
    const { de, unicas } = agrupacion;
    const conjunto = validarFormaConjunto(await verificarFotosServicio(unicas.map((i) => comoBlob(archivos[i]))), unicas.length);
    const posicionDeUnica = new Map(unicas.map((original, k) => [original, k]));
    const fotos = archivos.map((_, i) => {
        if (de[i] !== null) {
            return {
                indice: i, estado: 'duplicada', rostros: null, un_solo_rostro: null, calidad: null,
                motivo_rechazo: 'Es igual a otra foto del envío.', motivo_codigo: 'DUPLICADA', coseno_resto: null,
                duplicada_de: de[i],
            };
        }
        const f = conjunto.fotos[posicionDeUnica.get(i)];
        return { ...f, indice: i, calidad: conAliasCalidad(f.calidad), duplicada_de: null };
    });
    return { ...conjunto, total: archivos.length, fotos };
}

/** Calidad de UNA toma (rostros, un solo rostro, pose, motivo de rechazo). Es lo que lee la detección en vivo del asistente. */
export async function verificarUnaFoto(archivo) {
    return conAlias(await verificarFotoServicio(comoBlob(archivo)));
}

/**
 * POST /api/plantilla/verificar (admin): solo calidad, no guarda nada.
 * - `foto`: camino heredado (una toma), no exige alumno ni consentimiento.
 * - `fotos`: el conjunto completo (1 a 8). Exige id_alumno e id_consent y el consentimiento vigente, porque se
 *   calculan embeddings y cosenos de identidad de una persona.
 */
export async function verificarFoto({ form, body = {}, rpc }) {
    const { foto, fotos } = fotosDeLaPeticion(form);
    if (foto) return verificarUnaFoto(foto);

    const faltan = ['id_alumno', 'id_consent'].filter((c) => body[c] === undefined);
    if (faltan.length > 0) {
        throw new ApiError({
            code: 'VALIDACION',
            message: 'Revisa los datos enviados.',
            status: 422,
            details: { campos: faltan.map((campo) => ({ campo, mensaje: 'Es obligatorio al verificar varias fotos.' })) },
        });
    }
    await exigirConsentimientoVigente(rpc, body.id_alumno, body.id_consent);
    return analizarConjunto(fotos, agruparDuplicadas(fotos));
}

/** Medidas de calidad que guarda la BD (lista blanca de app.calidad_foto_valida): sin el alias `tamano_rostro`. */
function calidadParaBD(calidad) {
    if (!calidad) return null;
    const { brillo, nitidez, tamano_rostro_px: tamanoRostroPx, frontal } = calidad;
    return { brillo, nitidez, tamano_rostro_px: tamanoRostroPx, frontal };
}

/** Elemento de p_fotos: las claves nulas se omiten (la RPC acepta ausentes y rechaza claves desconocidas). */
function fotoParaRpc(ruta, foto) {
    const elemento = { objeto_foto: ruta };
    const calidad = calidadParaBD(foto.calidad);
    if (calidad) elemento.calidad = calidad;
    if (typeof foto.coseno_resto === 'number') elemento.coseno_resto = foto.coseno_resto;
    return elemento;
}

/** Resumen escalar del build para ESTA plantilla (el arreglo completo de muestras no viaja al cliente). */
export function muestraDe(indice, idPlantilla) {
    const m = indice?.muestras?.find((x) => x.id_plantilla === idPlantilla);
    if (!m) return null;
    return {
        total: m.total,
        usadas: m.usadas,
        descartadas: m.descartadas,
        coseno_min: m.coseno_min,
        coseno_medio: m.coseno_medio,
        degradada: m.degradada,
    };
}

/** Quita `muestras` de la respuesta del índice: es detalle interno del build, no del contrato con la pantalla. */
export function indiceSinMuestras(indice) {
    const salida = { ...indice };
    delete salida.muestras;
    return salida;
}

/**
 * La alta con la RPC del administrador (api_plantilla_registrar). El autoservicio del alumno pasa su propia función `registrar`
 * (api_mi_plantilla_registrar), que no lleva id_alumno: sale de la sesión.
 */
const altaDelAdministrador = ({ rpc, ip, idAlumno, idConsent }) => (args) => rpc('api_plantilla_registrar', { idAlumno, idConsent, ...args, ip });

/** Camino heredado de UNA foto: calidad individual -> subir -> RPC con los 4 argumentos de siempre. */
async function registrarUnaFoto({ rpc, admin, ip, idAlumno, idConsent, archivo, registrar = null }) {
    // Calidad: un solo rostro y sin motivo de rechazo.
    const calidad = conAlias(await verificarFotoServicio(comoBlob(archivo)));
    if (!calidad.un_solo_rostro || calidad.motivo_rechazo) {
        throw new ApiError({
            code: 'FOTO_RECHAZADA',
            message: calidad.motivo_rechazo ?? 'La foto no es válida para la plantilla facial.',
            status: 422,
            details: {
                motivo_rechazo: calidad.motivo_rechazo,
                motivo_codigo: calidad.motivo_codigo ?? null,
                rostros: calidad.rostros,
                calidad: calidad.calidad,
            },
        });
    }

    // Subida con ruta construida en servidor y registro; si el registro falla se borra el objeto subido.
    const cliente = await admin();
    const ruta = rutaObjeto.registro(idAlumno);
    await subirObjeto(ruta, archivo.bytes, { contentType: 'image/jpeg', upsert: false, admin: cliente });
    try {
        return await (registrar ?? altaDelAdministrador({ rpc, ip, idAlumno, idConsent }))({ objetoFoto: ruta });
    } catch (e) {
        await eliminarObjetoSilencioso(ruta, { admin: cliente });
        throw e;
    }
}

/**
 * Camino de varias fotos: duplicados -> análisis del conjunto (calidad + consistencia) -> rechazo estricto o
 * subida de TODAS -> RPC con p_fotos. Las fotos rechazadas nunca se suben: lo que queda en el bucket y en
 * plantilla_foto es exactamente lo aceptado (y no se guarda el rostro de un tercero que se coló en el lote).
 */
export async function registrarVariasFotos({ rpc, admin, ip, idAlumno, idConsent, archivos, registrar = null, antesDeGuardar = null }) {
    const agrupacion = agruparDuplicadas(archivos);
    const duplicadas = agrupacion.de.flatMap((de, indice) => (de === null ? [] : [{ indice, de }]));
    if (duplicadas.length > 0) {
        throw new ApiError({
            code: 'FOTOS_DUPLICADAS',
            message: 'Hay fotos repetidas: usa tomas distintas.',
            status: 422,
            details: { duplicadas },
        });
    }

    const conjunto = await analizarConjunto(archivos, agrupacion);
    if (conjunto.fotos.some((f) => f.estado !== 'aceptada') || conjunto.ambiguo) {
        throw new ApiError({
            code: 'FOTOS_RECHAZADAS',
            message: 'Algunas fotos no sirven: repite las tomas marcadas.',
            status: 422,
            details: {
                minimo: conjunto.minimo,
                maximo: conjunto.maximo,
                total: conjunto.total,
                aceptadas: conjunto.aceptadas,
                umbral_coseno: conjunto.umbral_coseno,
                consistente: conjunto.consistente,
                ambiguo: conjunto.ambiguo,
                fotos: conjunto.fotos.map((f) => ({
                    indice: f.indice,
                    estado: f.estado,
                    motivo_codigo: f.motivo_codigo,
                    motivo_rechazo: f.motivo_rechazo,
                    coseno_resto: f.coseno_resto,
                })),
            },
        });
    }
    if (!conjunto.suficiente) {
        // El mínimo lo decide el servicio (TEMPLATE_MIN_PHOTOS): esta capa solo conoce el techo.
        throw new ApiError({
            code: 'FOTOS_INSUFICIENTES',
            message: `Se necesitan al menos ${conjunto.minimo} fotos.`,
            status: 422,
            details: { minimo: conjunto.minimo, recibidas: archivos.length },
        });
    }

    // Comprobaciones propias de quien llama (p. ej. que el rostro no pertenezca ya a otra matrícula): después de validar la calidad
    // y antes de guardar nada, para que un rechazo no deje fotos en el bucket.
    if (antesDeGuardar) await antesDeGuardar(archivos);

    // Subida en serie (una ruta de servidor por foto, uuid distinto). TRANSACCIONALIDAD: si falla cualquier subida
    // o la RPC se borran TODAS las ya subidas y se relanza el error original; no quedan huérfanos.
    const cliente = await admin();
    const subidas = [];
    try {
        for (const archivo of archivos) {
            const ruta = rutaObjeto.registro(idAlumno);
            await subirObjeto(ruta, archivo.bytes, { contentType: 'image/jpeg', upsert: false, admin: cliente });
            subidas.push(ruta);
        }
        return await (registrar ?? altaDelAdministrador({ rpc, ip, idAlumno, idConsent }))({
            objetoFoto: subidas[0],
            fotos: subidas.map((ruta, i) => fotoParaRpc(ruta, conjunto.fotos[i])),
        });
    } catch (e) {
        await Promise.allSettled(subidas.map((ruta) => eliminarObjetoSilencioso(ruta, { admin: cliente })));
        throw e;
    }
}

/**
 * POST /api/alumnos/{id}/plantilla (admin).
 * consentimiento vigente -> calidad (de la foto o del conjunto) -> subir -> api_plantilla_registrar -> reconstruir
 * el índice. Una foto (`foto`, o `fotos` con un solo archivo) sigue el camino heredado; 2 o más forman la plantilla
 * promediada (el servicio calcula el centroide al construir el índice; aquí no viaja ningún vector).
 */
export async function registrarPlantilla({ rpc, admin, ip, params, body, form }) {
    const idAlumno = params.id;
    const { foto, fotos } = fotosDeLaPeticion(form);
    const archivos = foto ? [foto] : fotos;

    // 1. El consentimiento se comprueba ANTES de procesar o guardar el rostro (RN-13).
    await exigirConsentimientoVigente(rpc, idAlumno, body.id_consent);

    // 2-3. Calidad, subida y registro.
    const esVarias = archivos.length >= 2;
    const plantilla = esVarias
        ? await registrarVariasFotos({ rpc, admin, ip, idAlumno, idConsent: body.id_consent, archivos })
        : await registrarUnaFoto({ rpc, admin, ip, idAlumno, idConsent: body.id_consent, archivo: archivos[0] });

    // 4. Índice: se reconstruye ya; si no se puede, la plantilla queda pendiente de indexar.
    const indice = await reconstruirSinFallar(await admin());
    return {
        ...plantilla,
        indice: indiceSinMuestras(indice),
        version: indice.version,
        muestra: esVarias ? muestraDe(indice, plantilla.id_plantilla) : null,
    };
}

/** POST /api/consentimientos (admin): PDF firmado -> bucket -> api_consentimiento_registrar. */
export async function registrarConsentimiento({ rpc, admin, ip, body, form }) {
    const documento = form.archivos.documento;
    const cliente = await admin();
    const ruta = rutaObjeto.consentimiento(body.id_alumno);
    await subirObjeto(ruta, documento.bytes, { contentType: 'application/pdf', upsert: false, admin: cliente });
    try {
        return await rpc('api_consentimiento_registrar', {
            idAlumno: body.id_alumno,
            fechaFirma: body.fecha_firma,
            vigenciaHasta: body.vigencia_hasta,
            objetoDocumento: ruta,
            ip,
        });
    } catch (e) {
        await eliminarObjetoSilencioso(ruta, { admin: cliente });
        throw e;
    }
}

/** POST /api/consentimientos/{id}/revocar (admin): archiva sus plantillas y reconstruye el índice. */
export async function revocarConsentimiento({ rpc, admin, ip, params }) {
    const resultado = await rpc('api_consentimiento_revocar', { idConsent: params.id, ip });
    if (!resultado?.requiere_reconstruccion) return resultado;
    return { ...resultado, indice: indiceSinMuestras(await reconstruirSinFallar(await admin())) };
}

/**
 * GET /api/documentos/{consentimiento|plantilla|plantilla_foto}/{id} (admin): URL firmada. La RPC autoriza (rol y existencia),
 * devuelve la ruta y la vigencia, y asienta la consulta en bitácora ANTES de que se firme nada (RF-19).
 */
export function urlDeDocumento(tipo) {
    return async function urlDocumento({ rpc, admin, ip, params }) {
        const autorizacion = await rpc('api_documento_url_autorizar', { tipo, idRegistro: params.id, ip });
        const vigencia = ttlUrlFirmada(autorizacion?.vigencia_seg);
        const f = await urlFirmada(autorizacion.objeto, { admin: await admin(), segundos: vigencia, vigencia });
        return { tipo, id_registro: params.id, id_alumno: autorizacion.id_alumno ?? null, url: f.url, expira_en: f.expira_en, vigencia_seg: f.segundos };
    };
}

// ---- Índice facial ----
export const indiceEstado = ({ backend, query }) => estadoIndice({ backend, limit: query.limit, offset: query.offset });

export async function indiceReconstruir({ admin, body }) {
    return reconstruirIndice({ completa: body.completa, admin: await admin() });
}

export async function indiceSincronizar({ admin }) {
    return sincronizarIndice({ admin: await admin() });
}

/** POST /api/indice/revertir (técnico): resuelve la versión por su id y la pone en uso. */
export async function indiceRevertir({ rpc, admin, body }) {
    const estado = await rpc('api_indice_estado', { limit: 200 });
    const destino = estado?.versiones?.items?.find((v) => v.id_indice === body.id_indice);
    if (!destino) throw new ApiError({ code: 'NO_ENCONTRADO', message: 'La versión del índice no existe.', status: 404 });
    return revertirIndice({ idIndice: destino.id_indice, version: destino.version, admin: await admin() });
}
