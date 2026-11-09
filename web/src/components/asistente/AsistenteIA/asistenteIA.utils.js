// Funciones puras del asistente de IA: sugerencias, historial que se envía y rutas donde el botón no se muestra.

/** Preguntas sugeridas al abrir el panel (docente). */
export const SUGERENCIAS_DOCENTE = Object.freeze([
    '¿Qué alumnos tengo en riesgo?',
    '¿Qué grupo falta más?',
    '¿Qué sesiones tengo hoy?',
    '¿Tengo justificantes pendientes?',
]);

// Topes que también valida el servidor (docs/api/asistente.md): el cliente recorta antes para no recibir un 422.
export const MAX_TEXTO = 2000;
export const MAX_MENSAJES = 20;

// Pantallas con la acción principal abajo (pase de lista y sesión en vivo con cámara): ahí el botón flotante no se dibuja.
const RUTAS_SIN_BOTON = [/^\/docente\/pasar-lista(\/|$)/, /^\/docente\/sesiones\/[^/]+/];

export const mostrarBotonEn = (pathname) => !RUTAS_SIN_BOTON.some((r) => r.test(pathname || ''));

/**
 * Historial que se envía: solo mensajes con texto (sin errores ni respuestas vacías), alternando usuario/asistente, empezando por el
 * usuario y con los últimos MAX_MENSAJES. Los textos se recortan a MAX_TEXTO.
 * @param {{ rol: string, texto: string, error?: boolean }[]} mensajes
 */
export function historialParaEnviar(mensajes) {
    const limpios = [];
    for (const m of mensajes) {
        const texto = String(m.texto ?? '').trim().slice(0, MAX_TEXTO);
        if (!texto || m.error || (m.rol !== 'usuario' && m.rol !== 'asistente')) continue;
        // Dos del mismo rol seguidos (p. ej. una respuesta que falló): se queda el último.
        if (limpios.length && limpios[limpios.length - 1].rol === m.rol) limpios.pop();
        limpios.push({ rol: m.rol, texto });
    }
    let recorte = limpios.slice(-MAX_MENSAJES);
    while (recorte.length && recorte[0].rol !== 'usuario') recorte = recorte.slice(1);
    return recorte;
}
