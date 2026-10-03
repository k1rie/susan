// Lógica de los Route Handlers de biometría: consentimiento, plantilla facial, documentos e índice. Solo servidor.
import { ApiError } from '@/lib/api/errors';
import { ttlUrlFirmada, eliminarObjetoSilencioso, rutaObjeto, subirObjeto, urlFirmada } from './storage.js';
import { verificarFotoServicio } from './recognition.js';
import { estadoIndice, reconstruirIndice, revertirIndice, sincronizarIndice } from './indice.js';

/**
 * Reconstruye el índice sin que su fallo invalide la operación que lo disparó: la plantilla/revocación ya quedó
 * guardada y el job reconstruir-indice (o el botón del técnico) completa lo pendiente.
 */
export async function reconstruirSinFallar(admin) {
    try {
        const r = await reconstruirIndice({ admin });
        return { estado: r.estado, version: r.version, total_vectores: r.total_vectores };
    } catch (e) {
        if (e instanceof ApiError && e.code === 'RECONSTRUCCION_EN_CURSO') return { estado: 'en_curso', version: null };
        console.error('[indice] la reconstrucción tras el cambio falló; queda pendiente');
        return { estado: 'pendiente', version: null, error: { code: e instanceof ApiError ? e.code : 'ERROR_INTERNO' } };
    }
}

const comoBlob = (archivo) => new Blob([archivo.bytes], { type: archivo.contentType });

/**
 * La calidad que devuelve el servicio trae `tamano_rostro_px`; el componente CalidadFotoResumen (docs/api/biometria.md
 * §2.1) lee `tamano_rostro`. Se entregan ambos para no romper a ninguno.
 */
function conAlias(calidad) {
    return { ...calidad, calidad: { ...calidad.calidad, tamano_rostro: calidad.calidad.tamano_rostro_px } };
}

/** POST /api/plantilla/verificar (admin): solo calidad, no guarda nada. */
export async function verificarFoto({ form }) {
    return conAlias(await verificarFotoServicio(comoBlob(form.archivos.foto)));
}

/**
 * POST /api/alumnos/{id}/plantilla (admin).
 * consentimiento vigente -> calidad de la foto -> subir -> api_plantilla_registrar -> reconstruir el índice.
 */
export async function registrarPlantilla({ rpc, admin, ip, params, body, form }) {
    const idAlumno = params.id;
    const foto = form.archivos.foto;

    // 1. El consentimiento debe ser de este alumno y estar vigente ANTES de procesar o guardar su rostro (RN-13).
    const consentimientos = await rpc('api_consentimientos_alumno', { idAlumno, limit: 200 });
    const consentimiento = consentimientos?.items?.find((c) => c.id_consent === body.id_consent);
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

    // 2. Calidad: un solo rostro y sin motivo de rechazo.
    const calidad = conAlias(await verificarFotoServicio(comoBlob(foto)));
    if (!calidad.un_solo_rostro || calidad.motivo_rechazo) {
        throw new ApiError({
            code: 'FOTO_RECHAZADA',
            message: calidad.motivo_rechazo ?? 'La foto no es válida para la plantilla facial.',
            status: 422,
            details: { motivo_rechazo: calidad.motivo_rechazo, rostros: calidad.rostros, calidad: calidad.calidad },
        });
    }

    // 3. Subida con ruta construida en servidor y registro; si el registro falla se borra el objeto subido.
    const cliente = await admin();
    const ruta = rutaObjeto.registro(idAlumno);
    await subirObjeto(ruta, foto.bytes, { contentType: 'image/jpeg', upsert: false, admin: cliente });
    let plantilla;
    try {
        plantilla = await rpc('api_plantilla_registrar', { idAlumno, idConsent: body.id_consent, objetoFoto: ruta, ip });
    } catch (e) {
        await eliminarObjetoSilencioso(ruta, { admin: cliente });
        throw e;
    }

    // 4. Índice: se reconstruye ya; si no se puede, la plantilla queda pendiente de indexar.
    const indice = await reconstruirSinFallar(cliente);
    return { ...plantilla, indice, version: indice.version };
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
    return { ...resultado, indice: await reconstruirSinFallar(await admin()) };
}

/**
 * GET /api/documentos/{consentimiento|plantilla}/{id} (admin): URL firmada. La RPC autoriza (rol y existencia),
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
