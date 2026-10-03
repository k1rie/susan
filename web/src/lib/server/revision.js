// Lógica de los Route Handlers de revisión (casos, justificantes). Solo servidor.
import { ApiError } from '@/lib/api/errors';
import { rutaObjeto, subirObjeto, tipoDeRuta, ttlUrlFirmada, urlFirmada } from './storage.js';

const bitacoraNoDisponible = () => new ApiError({
    code: 'BITACORA_NO_DISPONIBLE',
    message: 'No se pudo registrar la consulta en la bitácora; por seguridad no se muestran los archivos.',
    status: 503,
});

/**
 * Asienta la consulta en bitácora ANTES de firmar (RF-19). Falla cerrado: si no se pudo asentar, no hay URL.
 * @returns {Promise<number>} id_bitacora
 */
export async function asentarConsulta(svc, { idUsuario, entidad, idRegistro, ip, detalle }) {
    try {
        const id = await svc('svc_registrar_consulta_revision', { idUsuario, entidad, idRegistro, ip, detalle });
        return id;
    } catch (e) {
        // Un docente inválido (NO_AUTORIZADO) es un rechazo legítimo; cualquier otro fallo es "bitácora caída".
        if (e instanceof ApiError && e.code === 'NO_AUTORIZADO') throw e;
        throw bitacoraNoDisponible();
    }
}

/**
 * GET /api/casos/{id}/detecciones.
 * Pasos: api_detecciones_caso (identidad del docente; si falla no se asienta ni firma nada) -> bitácora -> firmar.
 */
export async function detallesDeCaso({ rpc, svc, admin, me, ip, params, query }) {
    const idAsistencia = params.id;
    const datos = await rpc('api_detecciones_caso', {
        idAsistencia, soloValidas: query.solo_validas, limit: query.limit, offset: query.offset,
    });
    const lecturas = Array.isArray(datos?.lecturas) ? datos.lecturas : [];
    const conRecorte = lecturas.filter((l) => l.objeto_recorte);

    // Una consulta = una fila de bitácora por petición (no una por recorte). Solo ids y contadores, nunca rutas.
    await asentarConsulta(svc, {
        idUsuario: datos?.id_usuario ?? me.id_usuario,
        entidad: 'asistencia',
        idRegistro: idAsistencia,
        ip,
        detalle: {
            ids_deteccion: lecturas.map((l) => l.id_deteccion),
            recortes: conRecorte.length,
            foto_registro: Boolean(datos?.objeto_foto_registro),
        },
    });

    const cliente = await admin();
    const vigencia = ttlUrlFirmada(datos?.vigencia_url_firmada_seg);
    const firmar = async (ruta) => {
        try {
            const f = await urlFirmada(ruta, { admin: cliente, segundos: vigencia, vigencia });
            return { url: f.url, expira_en: f.expira_en };
        } catch {
            return { url: null, expira_en: null, error: true }; // una firma fallida no aborta toda la respuesta
        }
    };

    const foto = datos?.objeto_foto_registro ? await firmar(datos.objeto_foto_registro) : null;
    const firmadas = new Map();
    await Promise.all(conRecorte.map(async (l) => firmadas.set(l.id_deteccion, await firmar(l.objeto_recorte))));

    return {
        id_asistencia: idAsistencia,
        asistencia: datos.asistencia,
        alumno: datos.alumno,
        sesion: datos.sesion,
        vigencia_seg: vigencia,
        generado_en: new Date().toISOString(),
        foto_registro: foto,
        total: datos.total ?? lecturas.length,
        // Nunca se reenvía ninguna ruta objeto_*.
        lecturas: lecturas.map(({ objeto_recorte: ruta, tiene_recorte: tiene, ...resto }) => ({
            ...resto,
            recorte_disponible: Boolean(tiene && ruta),
            recorte: ruta ? (firmadas.get(resto.id_deteccion) ?? null) : null,
        })),
    };
}

/**
 * POST /api/justificantes/documento.
 * api_validar_justificante (sin escribir) -> subir. Nada se sube si la validación falla.
 */
export async function subirDocumentoDeJustificante({ rpc, admin, me, body, form }) {
    const archivo = form.archivos.archivo;
    let idAlumnoDestino;
    if (me.rol === 'alumno') {
        // Un alumno solo sube para sí mismo: omitido o igual al propio; la RPC recibe NULL.
        if (body.id_alumno !== undefined && body.id_alumno !== me.id_alumno) {
            throw new ApiError({ code: 'NO_AUTORIZADO', message: 'Solo puedes registrar justificantes propios.', status: 403 });
        }
        idAlumnoDestino = null;
    } else {
        if (body.id_alumno === undefined) {
            throw new ApiError({
                code: 'VALIDACION', message: 'Revisa los datos enviados.', status: 422,
                details: { campos: [{ campo: 'id_alumno', mensaje: 'Es obligatorio para el docente.' }] },
            });
        }
        idAlumnoDestino = body.id_alumno;
    }
    const validacion = await rpc('api_validar_justificante', { idSesion: body.id_sesion, idAlumno: idAlumnoDestino });
    const idAlumno = validacion.id_alumno;
    const ruta = rutaObjeto.justificante(idAlumno, archivo.ext); // la ruta SIEMPRE se construye aquí
    await subirObjeto(ruta, archivo.bytes, { contentType: archivo.contentType, upsert: false, admin: await admin() });
    return { objeto_documento: ruta, tipo: archivo.tipo, bytes: archivo.size, id_alumno: idAlumno };
}

/** GET /api/justificantes/{id}/documento. Bitácora ANTES de firmar; fallo cerrado. */
export async function documentoDeJustificante({ rpc, svc, admin, me, ip, params }) {
    const idJustificante = params.id;
    const datos = await rpc('api_justificante_documento', { idJustificante });
    await asentarConsulta(svc, {
        idUsuario: datos?.id_usuario ?? me.id_usuario,
        entidad: 'justificante',
        idRegistro: idJustificante,
        ip,
        detalle: { id_asistencia: datos?.id_asistencia ?? null },
    });
    const vigencia = ttlUrlFirmada(datos?.vigencia_url_firmada_seg);
    const f = await urlFirmada(datos.objeto_documento, { admin: await admin(), segundos: vigencia, vigencia });
    return {
        id_justificante: idJustificante,
        tipo: tipoDeRuta(datos.objeto_documento),
        url: f.url,
        expira_en: f.expira_en,
        vigencia_seg: f.segundos,
    };
}
