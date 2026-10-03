// Datos de la portada de administración: gráficas y avisos de atención a partir de `api_admin_resumen`.

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Colores de los estados (tokens de globals.css, los mismos de StatusChip): abierta = azul, programada = gris,
// cerrada = verde, suspendida = ámbar. `api_admin_resumen` entrega las cuatro; sin la suspendida el total no cuadra con la base.
export const CONFIG_SESIONES = {
    abierta: { label: 'Abiertas', color: 'var(--justificado)' },
    programada: { label: 'Programadas', color: 'var(--pendiente)' },
    cerrada: { label: 'Cerradas', color: 'var(--presente)' },
    suspendida: { label: 'Suspendidas', color: 'var(--retardo)' },
};

// "Inactivas" incluye las cámaras en mantenimiento (así las entrega la base).
export const CONFIG_CAMARAS = {
    activa: { label: 'Activas', color: 'var(--presente)' },
    inactiva: { label: 'Inactivas', color: 'var(--pendiente)' },
};

export function datosSesiones(sesiones = {}) {
    return [
        { clave: 'abierta', valor: num(sesiones?.abiertas) },
        { clave: 'programada', valor: num(sesiones?.programadas) },
        { clave: 'cerrada', valor: num(sesiones?.cerradas) },
        { clave: 'suspendida', valor: num(sesiones?.suspendidas) },
    ];
}

export function datosCamaras(camaras = {}) {
    return [
        { clave: 'activa', valor: num(camaras?.activas) },
        { clave: 'inactiva', valor: num(camaras?.inactivas) },
    ];
}

/**
 * Avisos que piden acción, solo con valor > 0 (cada uno enlaza a la pantalla donde se resuelve). Lista vacía = todo en orden.
 * `icono` es el nombre del icono Lucide que pinta el componente.
 */
export function avisosAtencion(r = {}) {
    const avisos = [];
    const consentimientos = num(r?.consentimientos_por_vencer_30d);
    if (consentimientos > 0) {
        avisos.push({
            clave: 'consentimientos',
            icono: 'CalendarClock',
            tono: 'dorado',
            titulo: `${consentimientos} consentimiento${consentimientos === 1 ? '' : 's'} por vencer`,
            subtitulo: 'En los próximos 30 días',
            href: '/admin/alumnos',
        });
    }
    const plantillas = num(r?.plantillas_sin_indexar);
    if (plantillas > 0) {
        avisos.push({
            clave: 'plantillas',
            icono: 'ScanFace',
            tono: 'violeta',
            titulo: `${plantillas} plantilla${plantillas === 1 ? '' : 's'} sin indexar`,
            subtitulo: 'Reconstruye el índice facial',
            href: '/tecnico',
        });
    }
    return avisos;
}
