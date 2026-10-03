// Mapeo único de estados del dominio a etiqueta en español y tokens de color.
// Siempre texto + color: el color nunca es el único canal de información.
const T = {
    presente: 'text-presente bg-presente-bg',
    retardo: 'text-retardo bg-retardo-bg',
    ausente: 'text-ausente bg-ausente-bg',
    pendiente: 'text-pendiente bg-pendiente-bg',
    justificado: 'text-justificado bg-justificado-bg',
    neutro: 'text-muted-foreground bg-muted',
};

export const MAPA_ESTADOS = {
    asistencia: {
        presente: ['Presente', T.presente],
        retardo: ['Retardo', T.retardo],
        ausente: ['Ausente', T.ausente],
        pendiente: ['Pendiente', T.pendiente],
        justificado: ['Justificado', T.justificado],
        sin_lecturas: ['Sin lecturas', T.neutro],
    },
    justificante: {
        pendiente: ['Pendiente', T.pendiente],
        aprobado: ['Aprobado', T.presente],
        rechazado: ['Rechazado', T.ausente],
    },
    sesion: {
        programada: ['Programada', T.pendiente],
        abierta: ['Abierta', T.justificado],
        cerrada: ['Cerrada', T.neutro],
        suspendida: ['Suspendida', T.retardo],
    },
    camara: {
        activa: ['Activa', T.presente],
        inactiva: ['Inactiva', T.neutro],
        mantenimiento: ['Mantenimiento', T.retardo],
    },
    consentimiento: {
        vigente: ['Vigente', T.presente],
        revocado: ['Revocado', T.ausente],
        vencido: ['Vencido', T.retardo],
    },
    modo: {
        automatico: ['Automático', T.justificado],
        manual: ['Manual', T.pendiente],
    },
    origen: {
        automatico: ['Automático', T.justificado],
        manual: ['Manual', T.pendiente],
        correccion: ['Corrección', T.retardo],
    },
    inscripcion: {
        activa: ['Activa', T.presente],
        baja: ['Baja', T.neutro],
    },
    persona: {
        activo: ['Activo', T.presente],
        baja_temporal: ['Baja temporal', T.retardo],
        baja_definitiva: ['Baja definitiva', T.ausente],
        egresado: ['Egresado', T.justificado],
        licencia: ['Licencia', T.retardo],
        baja: ['Baja', T.ausente],
    },
};

const entrada = (kind, value) => MAPA_ESTADOS[kind]?.[value] ?? null;

// Etiqueta en español; si el valor es desconocido se devuelve tal cual (no se lanza error).
export function etiqueta(kind, value) {
    const e = entrada(kind, value);
    if (e) return e[0];
    return value == null || value === '' ? '-' : String(value);
}

// Clases de color; los valores desconocidos usan tokens neutros.
export function tokens(kind, value) {
    return entrada(kind, value)?.[1] ?? T.neutro;
}
