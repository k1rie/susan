// Utilidades puras compartidas por «Pasar lista»: la tarjeta principal del panel (PasarListaHero), la ruta /docente/pasar-lista
// (PasarLista) y la lista «Todas las sesiones de hoy» (SesionesHoy). Trabajan sobre un elemento de `sesiones_hoy` de api_docente_panel:
//   { id_sesion, materia, clave_grupo, aula, hora_inicio, hora_fin, estatus, modo_previsto, camaras_activas, abrible }
// y, opcionalmente, la hora del plantel ('HH:MM' o 'HH:MM:SS', de api_ahora) para distinguir «aún no» de «ya pasó».

// ---- Contrato de rutas (ver el comentario de cabecera de PasarLista) -----------------------------------------------------------------
export const RUTA_PASAR_LISTA = '/docente/pasar-lista';
/** Query param con el que se llega a la pantalla de sesión: la sesión ya está abierta y se debe ver primero el pase de lista. */
export const PARAM_PASAR_LISTA = 'pasar-lista';
/** Ancla de la lista completa de sesiones del panel (SesionesHoy). */
export const ANCLA_SESIONES_HOY = 'sesiones-hoy';

/** /docente/pasar-lista?sesion=<id>: abre la sesión (si estaba programada) y entra a ella. */
export const urlPasarLista = (idSesion) => `${RUTA_PASAR_LISTA}?sesion=${idSesion}`;

/** /docente/sesiones/<id>, con ?pasar-lista=1 cuando se llega a pasar lista (sesión ya abierta). */
export const urlSesion = (idSesion, { pasarLista = false } = {}) => `/docente/sesiones/${idSesion}${pasarLista ? `?${PARAM_PASAR_LISTA}=1` : ''}`;

// ---- Formato --------------------------------------------------------------------------------------------------------------------------
export const hhmm = (h) => (h ? String(h).slice(0, 5) : '-');

/** Minutos desde la medianoche de 'HH:MM[:SS]'; null si no se puede leer. */
export function aMinutos(hora) {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(hora ?? ''));
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export const tituloSesion = (s) => `${s.materia} (${s.clave_grupo})`;
export const detalleSesion = (s) => `${hhmm(s.hora_inicio)} - ${hhmm(s.hora_fin)} · Aula ${s.aula}`;

// ---- Fase de la sesión ----------------------------------------------------------------------------------------------------------------
// abierta     en curso: se continúa el pase de lista
// abrible     programada y dentro de su horario (el servidor la marca `abrible`, RN-06): se abre y se pasa lista
// espera      programada, todavía no es su hora (o no se conoce la hora del plantel)
// vencida     programada cuyo horario ya terminó sin abrirse: ya no puede abrirse (api_abrir_sesion → FUERA_DE_HORARIO)
// cerrada     terminó: se ven resultados · suspendida  no cuenta para faltas
// OJO: `abrible` es verdadero solo para sesiones PROGRAMADAS dentro de su horario; una sesión abierta trae abrible=false.
export function faseSesion(sesion, hora) {
    if (sesion.estatus === 'abierta') return 'abierta';
    if (sesion.estatus === 'cerrada') return 'cerrada';
    if (sesion.estatus === 'suspendida') return 'suspendida';
    if (sesion.abrible) return 'abrible';
    const ahora = aMinutos(hora);
    const fin = aMinutos(sesion.hora_fin);
    if (ahora != null && fin != null && ahora >= fin) return 'vencida';
    return 'espera';
}

/** Con una sesión así se puede pasar lista ahora mismo: en curso o programada dentro de su horario. */
export const esCandidata = (sesion, hora) => {
    const fase = faseSesion(sesion, hora);
    return fase === 'abierta' || fase === 'abrible';
};

/** Sesiones de hoy ordenadas por hora de inicio y, a igualdad, por id (el panel ya las manda así; se asegura aquí). */
export function ordenarSesiones(sesiones) {
    const lista = Array.isArray(sesiones) ? sesiones : [];
    return [...lista].sort((a, b) => (aMinutos(a.hora_inicio) ?? 0) - (aMinutos(b.hora_inicio) ?? 0) || a.id_sesion - b.id_sesion);
}

export const sesionesCandidatas = (sesiones, hora) => ordenarSesiones(sesiones).filter((s) => esCandidata(s, hora));

/**
 * Sesión protagonista de la tarjeta principal: abierta > programada abrible > siguiente programada > última cerrada de hoy.
 * Si no queda ninguna de esas (solo suspendidas o programadas vencidas) se toma la última del día. Sin sesiones: null.
 */
export function elegirProtagonista(sesiones, hora) {
    const lista = ordenarSesiones(sesiones);
    if (lista.length === 0) return null;
    const deFase = (fase) => lista.filter((s) => faseSesion(s, hora) === fase);
    return deFase('abierta')[0] ?? deFase('abrible')[0] ?? deFase('espera')[0] ?? deFase('cerrada').at(-1) ?? lista.at(-1);
}

// ---- Textos ---------------------------------------------------------------------------------------------------------------------------
/** Etiqueta del botón principal de cada fase (y el destino lo decide quien lo pinta con urlSesion/urlPasarLista). */
export const ETIQUETA_ACCION = {
    abierta: 'Continuar pase de lista',
    abrible: 'Abrir y pasar lista',
    cerrada: 'Ver resultados',
    suspendida: 'Ver sesión',
};

/**
 * Qué cámara se usará. Programada: la del aula si hay alguna activa (RN-06); abierta: el modo con el que se abrió.
 * Cerrada o suspendida: null (ya no importa).
 */
export function textoCamara(sesion) {
    if (sesion.estatus === 'cerrada' || sesion.estatus === 'suspendida') return null;
    const conCamara = sesion.estatus === 'abierta' ? sesion.modo_previsto === 'automatico' : Number(sesion.camaras_activas) > 0;
    return conCamara
        ? { conCamara: true, texto: 'Cámara del aula lista' }
        : { conCamara: false, texto: 'Sin cámara activa: se pasa lista a mano' };
}

/**
 * Texto de la regla de apertura para una sesión programada que todavía no se puede abrir (RN-06, api_abrir_sesion): solo se abre
 * dentro de su horario. Distingue «aún no» de «ya pasó» cuando se conoce la hora del plantel.
 */
export function textoVentana(sesion, hora) {
    const inicio = hhmm(sesion.hora_inicio);
    const fin = hhmm(sesion.hora_fin);
    const regla = `La sesión solo puede abrirse dentro de su horario, de ${inicio} a ${fin}.`;
    const fase = faseSesion(sesion, hora);
    if (fase === 'vencida') return { etiqueta: `Terminó a las ${fin}`, regla };
    if (aMinutos(hora) == null) return { etiqueta: `Disponible de ${inicio} a ${fin}`, regla };
    return { etiqueta: `Disponible a las ${inicio}`, regla };
}

/**
 * Por qué no hay sesión para pasar lista ahora (ruta /docente/pasar-lista sin candidatas):
 * { clave, titulo, descripcion }. Precedencia: aún no es hora > horario vencido > todo cerrado > suspendidas > sin clases.
 */
export function motivoSinCandidatas(sesiones, hora) {
    const lista = ordenarSesiones(sesiones);
    if (lista.length === 0) {
        return { clave: 'sin_clases', titulo: 'Hoy no tienes clases programadas', descripcion: 'Cuando tengas una sesión en tu horario, podrás pasar lista desde aquí.' };
    }
    const deFase = (fase) => lista.filter((s) => faseSesion(s, hora) === fase);
    const siguiente = deFase('espera')[0];
    if (siguiente) {
        return {
            clave: 'fuera_de_horario',
            titulo: 'Todavía no es hora de pasar lista',
            descripcion: `${tituloSesion(siguiente)} se puede abrir de ${hhmm(siguiente.hora_inicio)} a ${hhmm(siguiente.hora_fin)}: solo dentro de su horario.`,
        };
    }
    const vencida = deFase('vencida').at(-1);
    if (vencida) {
        return { clave: 'vencida', titulo: 'El horario de la sesión ya terminó', descripcion: `${tituloSesion(vencida)} no se abrió y ya no puede abrirse: solo se abre de ${hhmm(vencida.hora_inicio)} a ${hhmm(vencida.hora_fin)}.` };
    }
    if (deFase('cerrada').length > 0) {
        return { clave: 'todo_cerrado', titulo: 'Ya cerraste las sesiones de hoy', descripcion: 'Ya no hay clases abiertas ni por abrir. Revisa los resultados o los registros pendientes.' };
    }
    return { clave: 'suspendidas', titulo: 'Las sesiones de hoy están suspendidas', descripcion: 'Las sesiones suspendidas no cuentan para las faltas y no se pasa lista en ellas.' };
}

/**
 * Mensaje comprensible para un error de api_abrir_sesion (docs: FUERA_DE_HORARIO, SESION_CERRADA, SESION_SUSPENDIDA, NO_ENCONTRADO,
 * NO_AUTORIZADO…). `reintentable`: tiene sentido volver a intentarlo; `verSesion`: etiqueta del botón que lleva a la pantalla de la
 * sesión (null = no se ofrece).
 */
export function mensajeAperturaFallida(error) {
    const mensaje = error?.message || 'Inténtalo de nuevo; si persiste, avisa al administrador.';
    switch (error?.code) {
        case 'FUERA_DE_HORARIO':
            return { titulo: 'La sesión está fuera de su horario', descripcion: mensaje, reintentable: true, verSesion: null };
        case 'SESION_CERRADA':
            return { titulo: 'La sesión ya está cerrada', descripcion: 'Ya no se puede pasar lista en ella; puedes ver sus resultados.', reintentable: false, verSesion: 'Ver resultados' };
        case 'SESION_SUSPENDIDA':
            return { titulo: 'La sesión está suspendida', descripcion: 'Reanúdala desde la pantalla de la sesión para poder abrirla.', reintentable: false, verSesion: 'Ver sesión' };
        case 'NO_ENCONTRADO':
        case 'NO_AUTORIZADO':
            return { titulo: 'No se encontró la sesión', descripcion: mensaje, reintentable: false, verSesion: null };
        default:
            return { titulo: 'No se pudo abrir la sesión', descripcion: mensaje, reintentable: true, verSesion: null };
    }
}
