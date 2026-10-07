// Autoservicio del alumno: aceptar su consentimiento y registrar su propio rostro. Solo servidor.
//
// Diferencias con el flujo del administrador (lib/server/biometria.js):
//  * El alumno es SIEMPRE el de la sesión: ningún endpoint recibe un id_alumno ni un id_consent. Salen de api_mi_registro.
//  * El consentimiento no se sube: se acepta el aviso con la sesión autenticada y el sistema genera la constancia PDF
//    (lib/server/constancia.js), que queda en el bucket como el PDF firmado a mano que sube el administrador.
//  * Antes de guardar el rostro se comprueba que no pertenezca ya a OTRA matrícula (un alumno no puede registrar la cara de un
//    compañero para que le pase lista). El vector nunca sale del servicio de reconocimiento (RNF-03).
//  * Un tope diario de registros (la RPC lo impone; aquí se avisa antes de gastar CPU en el servicio de reconocimiento).
import { ApiError } from '@/lib/api/errors';
import { VERSION_AVISO } from '@/lib/avisoBiometrico';
import {
    agruparDuplicadas, analizarConjunto, comoBlob, fotosDeLaPeticion, indiceSinMuestras, muestraDe, reconstruirSinFallar,
    registrarVariasFotos,
} from './biometria.js';
import { generarConstancia } from './constancia.js';
import { reconocer } from './recognition.js';
import { eliminarObjetoSilencioso, rutaObjeto, subirObjeto } from './storage.js';

/** Con cuántas tomas del conjunto se busca un rostro repetido: las extremas y la de en medio bastan y acotan el costo. */
const MAX_COMPARACIONES = 3;
/** Score con el que el sistema atribuiría una asistencia a otra persona (RN-04) si falta el parámetro. */
const UMBRAL_POR_OMISION = 0.85;

const error = (code, message, status, details = null) => new ApiError({ code, message, status, details });

/** Exige un alumno activo con consentimiento vigente (RN-13) y cupo diario; devuelve el estado que usan los pasos siguientes. */
function exigirPuedeRegistrarRostro(registro) {
    if (!registro?.puede_registrar) {
        throw error('ALUMNO_INACTIVO', 'Tu cuenta de alumno no está activa. Acude a tu coordinación.', 409);
    }
    if (!registro.consentimiento) {
        throw error('RN_13_CONSENTIMIENTO_NO_VIGENTE', 'Primero acepta el aviso de privacidad para poder registrar tu rostro.', 409);
    }
    if (registro.registros_24h >= registro.limite_registros_24h) {
        throw error('AUTOREGISTRO_LIMITE', 'Alcanzaste el límite de registros faciales de hoy. Inténtalo mañana o acude a tu coordinación.', 429);
    }
}

/**
 * POST /api/yo/consentimiento: el alumno acepta el aviso vigente. Genera la constancia PDF, la sube y registra el
 * consentimiento (si el registro falla, se borra el PDF subido).
 */
export async function aceptarConsentimientoPropio({ rpc, admin, ip, body }) {
    const registro = await rpc('api_mi_registro');
    if (!registro?.puede_registrar) {
        throw error('ALUMNO_INACTIVO', 'Tu cuenta de alumno no está activa. Acude a tu coordinación.', 409);
    }
    if (body.version_aviso !== VERSION_AVISO) {
        throw error('AVISO_DESACTUALIZADO', 'El aviso de privacidad cambió. Recarga la página y vuelve a leerlo antes de aceptar.', 409);
    }
    if (registro.consentimiento) {
        throw error('CONSENTIMIENTO_YA_VIGENTE', 'Ya aceptaste el aviso y tu consentimiento sigue vigente.', 409);
    }

    const constancia = generarConstancia({
        nombre: registro.nombre,
        matricula: registro.matricula,
        ahora: registro.ahora,
        vigenciaHasta: registro.vigencia_prevista,
        meses: registro.vigencia_meses,
        ip,
    });
    const cliente = await admin();
    const ruta = rutaObjeto.consentimiento(registro.id_alumno);
    await subirObjeto(ruta, constancia, { contentType: 'application/pdf', upsert: false, admin: cliente });
    try {
        return await rpc('api_mi_consentimiento_aceptar', { objetoDocumento: ruta, versionAviso: VERSION_AVISO, ip });
    } catch (e) {
        await eliminarObjetoSilencioso(ruta, { admin: cliente });
        throw e;
    }
}

/** POST /api/yo/consentimiento/revocar: archiva sus plantillas y, si estaban indexadas, reconstruye el índice. */
export async function revocarConsentimientoPropio({ rpc, admin, ip }) {
    const resultado = await rpc('api_mi_consentimiento_revocar', { ip });
    if (!resultado?.requiere_reconstruccion) return resultado;
    return { ...resultado, indice: indiceSinMuestras(await reconstruirSinFallar(await admin())) };
}

/** POST /api/yo/plantilla/verificar: calidad y consistencia del conjunto de tomas (no guarda nada). Misma forma que la del admin. */
export async function verificarFotosPropias({ rpc, form }) {
    exigirPuedeRegistrarRostro(await rpc('api_mi_registro'));
    const { fotos } = fotosDeLaPeticion(form);
    return analizarConjunto(fotos, agruparDuplicadas(fotos));
}

/** Posiciones del conjunto con las que se busca un rostro repetido (sin duplicados, en orden). */
export function indicesAComparar(n, max = MAX_COMPARACIONES) {
    if (n <= 0) return [];
    const candidatos = [0, Math.floor((n - 1) / 2), n - 1];
    return [...new Set(candidatos)].slice(0, max);
}

/**
 * El rostro nuevo no debe parecerse (score >= umbral de atribución) al de NINGÚN otro alumno activo del índice en uso. Se busca con el
 * mismo servicio y el mismo umbral que el pase de lista: lo que aquí se rechaza es justo lo que allá se atribuiría a otra persona.
 * El mensaje no revela de quién es el rostro.
 */
async function exigirRostroNuevo({ rpc, svc, archivos, idAlumno }) {
    const otros = await svc('svc_faiss_ids_otros_alumnos', { idAlumno });
    const ids = otros?.faiss_ids;
    if (!Array.isArray(ids) || ids.length === 0) return; // índice vacío o primer alumno: nada con qué comparar
    const parametros = await rpc('api_parametros_publicos');
    const umbral = Number(parametros?.umbral_similitud ?? UMBRAL_POR_OMISION);
    for (const i of indicesAComparar(archivos.length)) {
        const r = await reconocer({ imagen: comoBlob(archivos[i]), allowedFaissIds: ids, maxFaces: 1 });
        const candidato = r.faces?.[0]?.candidate;
        if (candidato && candidato.score >= umbral) {
            throw error('ROSTRO_YA_REGISTRADO',
                'Este rostro ya está registrado en otra cuenta. Si crees que es un error, acude a tu coordinación.', 409);
        }
    }
}

/**
 * POST /api/yo/plantilla: verifica calidad -> rostro no repetido -> sube -> api_mi_plantilla_registrar -> reconstruye el índice.
 * Solo el camino de varias fotos: la plantilla de una sola foto es un recurso del administrador.
 */
export async function registrarPlantillaPropia({ rpc, svc, admin, ip, form }) {
    const registro = await rpc('api_mi_registro');
    exigirPuedeRegistrarRostro(registro);
    const { fotos } = fotosDeLaPeticion(form);
    const idConsent = registro.consentimiento.id_consent;

    const plantilla = await registrarVariasFotos({
        rpc, admin, ip, idAlumno: registro.id_alumno, idConsent, archivos: fotos,
        registrar: (args) => rpc('api_mi_plantilla_registrar', { idConsent, ...args, ip }),
        antesDeGuardar: (archivos) => exigirRostroNuevo({ rpc, svc, archivos, idAlumno: registro.id_alumno }),
    });

    const indice = await reconstruirSinFallar(await admin());
    return {
        ...plantilla,
        indice: indiceSinMuestras(indice),
        version: indice.version,
        muestra: muestraDe(indice, plantilla.id_plantilla),
    };
}
