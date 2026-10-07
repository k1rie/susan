// Validación y datos del formulario de cámara. La IP es obligatoria solo para tipo 'ip'; en 'navegador' se descarta.
export const TIPOS = [
    { value: 'ip', label: 'Cámara IP' },
    { value: 'navegador', label: 'Webcam del navegador' },
];
export const ESTATUS_CAMARA = [
    { value: 'activa', label: 'Activa' },
    { value: 'inactiva', label: 'Inactiva' },
    { value: 'mantenimiento', label: 'En mantenimiento' },
];
export const etiquetaPosicion = (p) => (p === 'fondo' ? 'Fondo' : 'Frente');
export const etiquetaEstatus = (e) => ESTATUS_CAMARA.find((x) => x.value === e)?.label ?? e;
export const EJEMPLO_IP = '10.20.12.2';

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const esIp = (s) => {
    const m = IPV4.exec(s);
    if (m) return m.slice(1).every((n) => Number(n) <= 255);
    return /^[0-9a-f:]+$/i.test(s) && s.includes(':');
};

export function validarCamara(v) {
    const e = {};
    if (v.tipo === 'ip') {
        const ip = String(v.direccion_ip ?? '').trim();
        if (!ip) e.direccion_ip = `Escribe la dirección IP de la cámara, por ejemplo ${EJEMPLO_IP}.`;
        else if (!esIp(ip)) e.direccion_ip = `La dirección IP no es válida. Usa el formato ${EJEMPLO_IP}.`;
    }
    return e;
}

export function datosCamara(v, { idAula, posicion, idCamara }) {
    const datos = { id_aula: idAula, posicion, tipo: v.tipo, estatus: v.estatus };
    if (v.tipo === 'ip') datos.direccion_ip = v.direccion_ip.trim();
    if (idCamara) datos.id_camara = idCamara;
    return datos;
}

/** Valores del formulario a partir de la cámara guardada (o los de una cámara nueva: IP y activa). */
export const valoresDeCamara = (camara) => ({
    tipo: camara?.tipo ?? 'ip',
    direccion_ip: camara?.direccion_ip ?? '',
    estatus: camara?.estatus ?? 'activa',
});

/** Error del servidor -> { campo: mensaje } pegado al campo; null si es un error general. */
export function mapearErrorCamara(error) {
    switch (error?.code) {
        case 'CAMARA_IP_REQUERIDA':
            return { direccion_ip: error.message || 'Una cámara IP necesita su dirección IP.' };
        case 'DUPLICADO':
            return { direccion_ip: error.message || 'Otra cámara ya usa esa dirección IP.' };
        default:
            return null;
    }
}

/**
 * Cómo está el botón «Probar conexión». La prueba del servidor usa la cámara GUARDADA (POST /api/admin/camaras/{id}/probar no recibe la
 * dirección), así que con cambios sin guardar probaría la IP vieja: se bloquea y se dice por qué en vez de probar en silencio otra cosa.
 * @returns {{ puede: boolean, motivo: string|null }}
 */
export function estadoProbar({ camara, tipoActual, sucio }) {
    if (!camara) return { puede: false, motivo: 'Guarda la cámara para poder probarla.' };
    if (camara.tipo !== 'ip') return { puede: false, motivo: 'La webcam del navegador se prueba al abrir la sesión de captura.' };
    if (tipoActual !== 'ip') return { puede: false, motivo: 'Guarda el cambio de tipo para probar la cámara IP.' };
    if (sucio) return { puede: false, motivo: `Hay cambios sin guardar: la prueba usa la dirección guardada (${camara.direccion_ip}), no la que escribiste. Guarda primero.` };
    return { puede: true, motivo: null };
}

/** Resultado de la prueba a texto persistente (la hora la pone quien llama). */
export function describirPrueba(r) {
    if (r.ok === false) return { ok: false, titulo: 'No respondió', detalle: r.mensaje || 'La cámara no respondió.' };
    const partes = [];
    if (r.ms != null) partes.push(`${r.ms} ms`);
    if (r.rostros != null) partes.push(r.rostros === 1 ? '1 rostro detectado' : `${r.rostros} rostros detectados`);
    return { ok: true, titulo: 'Conectada', detalle: partes.join(' · ') };
}
