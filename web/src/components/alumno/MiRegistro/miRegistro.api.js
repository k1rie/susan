// Llamadas del autoservicio con la forma que espera usePlantillaFacial (la del flujo del administrador). Ninguna lleva id_alumno ni
// id_consent: salen de la sesión (api_mi_registro y /api/yo/*). Van a nivel de módulo porque useApiQuery exige funciones estables.
import { miRegistro } from '@/lib/api/biometria.js';
import { registrarMiPlantilla, verificarMiFoto, verificarMisFotos } from '@/lib/http/autoservicio.js';

/** api_mi_registro -> { vigente, consentimiento_vigente } (la forma de api_consentimientos_alumno). */
export async function consentimientosPropios() {
    const r = await miRegistro();
    return { vigente: Boolean(r.consentimiento), consentimiento_vigente: r.consentimiento, items: [] };
}

/** api_mi_registro -> { activa, archivadas } (la forma de api_plantilla_alumno que lee el hook). */
export async function plantillaPropia() {
    const r = await miRegistro();
    return { activa: r.plantilla, archivadas: { total: 0, items: [] } };
}

/** `permiteUna: false`: la plantilla de una sola foto es un recurso del administrador. */
export const API_PROPIA = {
    consentimientos: consentimientosPropios,
    plantilla: plantillaPropia,
    verificar: (blobs, { signal } = {}) => verificarMisFotos(blobs, { signal }),
    verificarUna: (blob, { signal } = {}) => verificarMiFoto(blob, { signal }),
    registrar: ({ fotos }) => registrarMiPlantilla({ fotos }),
    permiteUna: false,
};
