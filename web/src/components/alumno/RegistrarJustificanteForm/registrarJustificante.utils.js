import { validarArchivo } from '@/components/ui/FileInput/fileInput.utils.js';
import { claveGrupo, fechaCorta, nombreMateria } from '../alumno.utils.js';

export const MOTIVO_MAX = 200;
export const MAX_BYTES = 5 * 1024 * 1024;
export const ACCEPT = '.pdf,.jpg,.jpeg,.png';

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
