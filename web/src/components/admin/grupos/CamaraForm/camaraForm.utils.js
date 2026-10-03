// Validación del formulario de cámara. La IP es obligatoria solo para tipo 'ip'; en 'navegador' se descarta.
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

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const esIp = (s) => {
    const m = IPV4.exec(s);
    if (m) return m.slice(1).every((n) => Number(n) <= 255);
    return /^[0-9a-f:]+$/i.test(s) && s.includes(':');
};

export function validarCamara(v) {
    const e = {};
    if (v.tipo === 'ip') {
        const ip = v.direccion_ip.trim();
        if (!ip) e.direccion_ip = 'Una cámara IP necesita su dirección IP.';
        else if (!esIp(ip)) e.direccion_ip = 'La dirección IP no es válida.';
    }
    return e;
}

export function datosCamara(v, { idAula, posicion, idCamara }) {
    const datos = { id_aula: idAula, posicion, tipo: v.tipo, estatus: v.estatus };
    if (v.tipo === 'ip') datos.direccion_ip = v.direccion_ip.trim();
    if (idCamara) datos.id_camara = idCamara;
    return datos;
}
