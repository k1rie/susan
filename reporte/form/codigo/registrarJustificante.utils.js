import { validarArchivo } from '@/components/ui/FileInput/fileInput.utils.js';
import { formatearFechaCorta } from '@/lib/formularios/fechas.js';
import { claveGrupo, fechaCorta, nombreMateria } from '../alumno.utils.js';

export const MOTIVO_MAX = 200;
// 5 MiB y PDF/JPG/PNG: lo mismo que exige el servidor (MAX_ARCHIVO_BYTES y `tipos` de POST /api/justificantes/documento).
export const MAX_BYTES = 5 * 1024 * 1024;
export const ACCEPT = '.pdf,.jpg,.jpeg,.png';
// Hasta cuántas faltas se muestran como tarjetas; con más, un selector con búsqueda (50 tarjetas no se leen).
export const MAX_TARJETAS = 4;
// Ideas para empezar el motivo (solo aparecen con el campo vacío; el texto sigue siendo libre y se puede editar).
export const MOTIVOS_SUGERIDOS = ['Cita médica', 'Enfermedad', 'Trámite oficial', 'Asunto familiar'];

// Espejo de la validación del servidor (no la sustituye).
export function validarFormulario({ idSesion, motivo, archivo }) {
    const errores = {};
    if (!idSesion) errores.idSesion = 'Elige la falta o el retardo que quieres justificar.';
    const m = (motivo || '').trim();
    if (!m) errores.motivo = 'Escribe el motivo.';
    else if (m.length > MOTIVO_MAX) errores.motivo = `El motivo admite hasta ${MOTIVO_MAX} caracteres.`;
    if (!archivo) errores.archivo = 'Adjunta el documento (PDF, JPG o PNG).';
    else {
        const e = validarArchivo(archivo, { accept: ACCEPT, maxBytes: MAX_BYTES });
        if (e) errores.archivo = e;
    }
    return errores;
}

const ESTADO = { ausente: 'Ausente', retardo: 'Retardo' };

export function etiquetaJustificable(r) {
    return `${nombreMateria(r.materia)} · ${claveGrupo(r.grupo)} — ${fechaCorta(r.fecha)} — ${ESTADO[r.estado] || r.estado}`;
}

export function mensajeDeError(e) {
    if (e?.code === 'JUSTIFICANTE_DUPLICADO') return 'Ya tienes un justificante pendiente para esta sesión.';
    return e?.message || 'No se pudo enviar el justificante.';
}

/** Datos de una falta o retardo para mostrarla: «Cálculo · 3A», «10 sep 2026», estado y si ya hubo un justificante rechazado. */
export function datosFalta(r) {
    return {
        value: String(r.id_sesion),
        titulo: `${nombreMateria(r.materia)} · ${claveGrupo(r.grupo)}`,
        fecha: formatearFechaCorta(r.fecha) || fechaCorta(r.fecha),
        estado: r.estado,
        rechazado: Boolean(r.tiene_rechazado),
    };
}

/** Sesión elegida de partida: la que viene del enlace «Justificar» y, si solo hay una falta, esa (no hay nada que decidir). */
export function sesionInicial(registros, idSesionInicial) {
    if (registros.some((r) => r.id_sesion === idSesionInicial)) return String(idSesionInicial);
    return registros.length === 1 ? String(registros[0].id_sesion) : '';
}

/** Qué falta para poder enviar, en orden de pantalla: ['la falta o el retardo', 'el motivo', 'el documento']. */
export function pendientesDeCaptura({ idSesion, motivo, archivo }) {
    const faltan = [];
    if (!idSesion) faltan.push('la falta o el retardo');
    if (!(motivo || '').trim()) faltan.push('el motivo');
    if (!archivo) faltan.push('el documento');
    return faltan;
}

/** «el motivo» -> «Falta el motivo.»; dos -> «Faltan el motivo y el documento.»; ninguno -> «Todo listo para enviar.» */
export function textoPendientes(faltan) {
    if (faltan.length === 0) return 'Todo listo para enviar.';
    const lista = faltan.length === 1 ? faltan[0] : `${faltan.slice(0, -1).join(', ')} y ${faltan[faltan.length - 1]}`;
    return `${faltan.length === 1 ? 'Falta' : 'Faltan'} ${lista}.`;
}

/** Primer campo con error en el orden de la pantalla (para llevar el foco ahí al enviar). */
export function primerCampoConError(errores) {
    return ['idSesion', 'motivo', 'archivo'].find((c) => errores?.[c]) ?? null;
}
