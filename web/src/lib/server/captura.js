// Captura de un fotograma en sesión (flujo 1-4 de la Figura 10; ARCHITECTURE §6). Solo servidor.
//
// Orden de llamadas (cada paso solo corre si el anterior salió bien):
//   api_sesion_monitor (identidad del docente: titular, abierta, automática, en ventana)
//   -> svc_alumnos_candidatos -> servicio /v1/recognize -> svc_crear_captura (con rostros reales)
//   -> svc_registrar_detecciones -> resumen.
// Si el servicio de reconocimiento falla se responde 503 SIN tocar la BD: la sesión sigue operable en manual.
//
// DESVIACIÓN DEL LAYOUT DE RECORTES (documentada en docs/ARCHITECTURE.md §5/§6 por el integrador): el servicio
// sube los recortes DURANTE /v1/recognize, antes de que exista id_captura, así que el prefijo es
// recortes/{id_sesion}/{id_camara}-{epochMs}/ y no recortes/{id_sesion}/{id_captura}/. Es único por fotograma y
// estable ante un reintento con la misma marca_tiempo (sobrescribe los mismos objetos).
import { isIP } from 'node:net';
import { ApiError } from '@/lib/api/errors';
import { exigirCupoCaptura } from './rateLimit.js';
import { reconocer } from './recognition.js';
import { eliminarObjetoSilencioso, prefijoRecortes } from './storage.js';

/** Códigos que significan "ya no se debe seguir muestreando esta sesión/cámara" (el cliente detiene el temporizador). */
const FIN_DE_MUESTREO = new Set(['CAPTURA_EN_OTRA_SESION', 'FUERA_DE_VENTANA', 'SESION_NO_ABIERTA', 'SESION_NO_AUTOMATICA']);

const INTERVALO_POR_OMISION_SEG = 15;
let cacheIntervalo = { valor: null, expira: 0 };

/** Solo para pruebas. */
export function reiniciarCacheIntervalo() {
    cacheIntervalo = { valor: null, expira: 0 };
}

/** intervalo_muestreo_seg con caché de 60 s; si no se puede leer, el valor por omisión (nunca falla la captura por esto). */
async function intervaloMuestreo(rpc) {
    const ahora = Date.now();
    if (cacheIntervalo.valor !== null && ahora < cacheIntervalo.expira) return cacheIntervalo.valor;
    try {
        const p = await rpc('api_parametros_publicos', {});
        const v = Number(p?.intervalo_muestreo_seg);
        const valor = Number.isFinite(v) && v > 0 ? v : INTERVALO_POR_OMISION_SEG;
        cacheIntervalo = { valor, expira: ahora + 60_000 };
        return valor;
    } catch {
        return INTERVALO_POR_OMISION_SEG;
    }
}

const conflicto = (code, message, extra = null) => new ApiError({
    code, message, status: 409, details: { fin_muestreo: true, ...extra },
});

/** Un error de la BD que indica fin del muestreo sale como 409 con details.fin_muestreo = true. */
function comoFinDeMuestreo(e) {
    if (e instanceof ApiError && FIN_DE_MUESTREO.has(e.code)) {
        return new ApiError({ code: e.code, message: e.message, status: 409, details: { fin_muestreo: true } });
    }
    return e;
}

/** Ruta del fotograma de una cámara IP: http://<direccion_ip><CAMERA_SNAPSHOT_PATH>. */
export function urlSnapshotCamara(direccionIp, rutaSnapshot = process.env.CAMERA_SNAPSHOT_PATH || '/snapshot.jpg') {
    const sinDireccion = () => new ApiError({
        code: 'CAMARA_SIN_DIRECCION',
        message: 'No se pudo determinar la dirección de la cámara IP. Avisa al administrador.',
        status: 503,
    });
    const ip = String(direccionIp ?? '').trim();
    const version = isIP(ip);
    if (!version) throw sinDireccion();
    // Ruta configurada por el operador: solo caracteres de ruta/consulta, sin esquema ni credenciales.
    if (!/^\/[A-Za-z0-9._~%!$&'()*+,;=:@/?-]*$/.test(rutaSnapshot) || rutaSnapshot.startsWith('//')) throw sinDireccion();
    return `http://${version === 6 ? `[${ip}]` : ip}${rutaSnapshot}`;
}

/** Dirección de una cámara IP: el docente no la ve (api_camaras_listar la oculta), la entrega svc_camara_direccion. */
async function direccionDeCamara(svc, idSesion, camara) {
    if (camara.direccion_ip) return camara.direccion_ip;
    return svc('svc_camara_direccion', { idSesion, idCamara: camara.id_camara });
}

/**
 * @param {{ rpc: Function, svc: Function, me: { id_usuario: number }, params: { id: number },
 *           body: { id_camara: number, marca_tiempo?: string },
 *           form: { archivos: { image?: { bytes: Buffer, contentType: string } | null } } }} ctx
 */
export async function ejecutarCaptura({ rpc, svc, me, params, body, form }) {
    const idSesion = params.id;
    const idCamara = body.id_camara;

    // Cupo: 1 solicitud por cámara cada >= intervalo/2 s (un reintento con la misma marca no consume).
    exigirCupoCaptura({
        idUsuario: me.id_usuario,
        idSesion,
        idCamara,
        intervaloSeg: await intervaloMuestreo(rpc),
        marcaTiempo: body.marca_tiempo ?? null,
    });

    // 1. Con la identidad del docente: la RLS confirma que es el titular del grupo (NO_AUTORIZADO / NO_ENCONTRADO).
    const monitor = await rpc('api_sesion_monitor', { idSesion });
    const sesion = monitor?.sesion;
    if (!sesion || sesion.estatus !== 'abierta') {
        throw conflicto('SESION_NO_ABIERTA', 'La sesión no está abierta; no admite capturas.');
    }
    if (sesion.modo_registro !== 'automatico') {
        throw conflicto('SESION_NO_AUTOMATICA', 'La sesión es de pase de lista manual; no admite capturas.');
    }
    if (!sesion.en_ventana) {
        throw conflicto('FUERA_DE_VENTANA', 'Terminó la ventana de tolerancia de la sesión; ya no se toman capturas.');
    }
    const camara = (monitor.camaras ?? []).find((c) => c.id_camara === idCamara);
    if (!camara) {
        throw new ApiError({
            code: 'CAMARA_FUERA_DE_AULA',
            message: 'La cámara no pertenece al aula del grupo de la sesión (RN-06).',
            status: 409,
        });
    }
    if (camara.estatus !== 'activa') {
        throw new ApiError({ code: 'CAMARA_INACTIVA', message: 'La cámara no está activa.', status: 409 });
    }

    // Origen del fotograma según el tipo de cámara.
    const imagenSubida = form?.archivos?.image ?? null;
    let origen;
    if (camara.tipo === 'ip') {
        if (imagenSubida) {
            throw new ApiError({
                code: 'VALIDACION', message: 'Las cámaras IP no reciben imagen: el servicio la toma de la cámara.',
                status: 422, details: { campos: [{ campo: 'image', mensaje: 'No se admite imagen para una cámara IP.' }] },
            });
        }
        origen = { cameraUrl: urlSnapshotCamara(await direccionDeCamara(svc, idSesion, camara)) };
    } else {
        if (!imagenSubida) {
            throw new ApiError({
                code: 'VALIDACION', message: 'Falta el fotograma de la cámara del navegador.',
                status: 422, details: { campos: [{ campo: 'image', mensaje: 'El fotograma es obligatorio.' }] },
            });
        }
        origen = { imagen: new Blob([imagenSubida.bytes], { type: imagenSubida.contentType }) };
    }

    // 2. Candidatos: solo plantillas de inscritos activos con consentimiento vigente (RF-04).
    const candidatos = await svc('svc_alumnos_candidatos', { idSesion });
    const faissIds = Array.isArray(candidatos?.faiss_ids) ? candidatos.faiss_ids : [];

    // 3. Reconocimiento. Si falla (503/409...) se propaga sin haber escrito nada en la BD.
    const marca = body.marca_tiempo ? new Date(body.marca_tiempo) : new Date();
    const reconocimiento = await reconocer({
        ...origen,
        allowedFaissIds: faissIds,
        cropPrefix: prefijoRecortes(idSesion, idCamara, marca.getTime()),
    });
    const rostros = reconocimiento.faces;
    const huerfanos = () => Promise.all(
        rostros.filter((r) => r.objeto_recorte).map((r) => eliminarObjetoSilencioso(r.objeto_recorte)),
    );

    // 4. Captura con los rostros reales (idempotente por cámara + marca_tiempo).
    let idCaptura;
    try {
        idCaptura = await svc('svc_crear_captura', {
            idSesion, idCamara, marcaTiempo: marca.toISOString(), rostros: rostros.length,
        });
    } catch (e) {
        await huerfanos(); // los recortes ya subidos no quedaron ligados a ninguna captura
        throw comoFinDeMuestreo(e);
    }

    // 5. Detecciones (aplica el umbral y el ciclo de vida de la asistencia). Idempotente por captura.
    let registro;
    try {
        registro = await svc('svc_registrar_detecciones', {
            idCaptura,
            detecciones: rostros.map((r) => ({
                faiss_id: r.candidate?.faiss_id ?? null,
                score: r.candidate?.score ?? null,
                objeto_recorte: r.objeto_recorte,
            })),
        });
    } catch (e) {
        throw comoFinDeMuestreo(e);
    }

    return {
        id_captura: idCaptura,
        marca_tiempo: marca.toISOString(),
        camara: { id_camara: camara.id_camara, posicion: camara.posicion ?? null },
        rostros: rostros.length,
        validas: registro?.validas ?? 0,
        no_atribuidas: registro?.no_atribuidas ?? 0,
        ya_procesada: Boolean(registro?.ya_procesada),
        cambios: registro?.cambios ?? [],
        index_version: reconocimiento.index_version,
        reconocimiento_ms: reconocimiento.elapsed_ms,
    };
}
