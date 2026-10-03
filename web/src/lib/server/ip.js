// IP de origen para la bitácora de consultas (RF-19). Solo servidor.
import { isIP } from 'node:net';

/**
 * Normaliza un candidato de cabecera a una IP: quita corchetes de IPv6 y el puerto de IPv4/IPv6
 * entre corchetes. Devuelve null si no es una IP válida (así nunca se asienta basura en la bitácora).
 * @param {string} crudo
 * @returns {string | null}
 */
function normalizar(crudo) {
    let valor = String(crudo ?? '').trim();
    if (!valor || valor.length > 64) return null;
    // [2001:db8::1]:443 -> 2001:db8::1
    const conCorchetes = valor.match(/^\[([^\]]+)\](?::\d{1,5})?$/);
    if (conCorchetes) valor = conCorchetes[1];
    // 203.0.113.9:5555 -> 203.0.113.9 (solo IPv4: un IPv6 sin corchetes contiene varios ':')
    else if (/^[^:]+:\d{1,5}$/.test(valor)) valor = valor.slice(0, valor.indexOf(':'));
    return isIP(valor) ? valor : null;
}

/**
 * IP de origen: primer elemento VÁLIDO de `x-forwarded-for`; si no hay, `x-real-ip`; null si ninguno sirve.
 * Solo es confiable si el proxy de entrada reescribe `x-forwarded-for` (ver docs/RUNBOOK.md); sin proxy
 * (desarrollo) normalmente no hay cabecera y el resultado es null, que la bitácora admite.
 * @param {Request | { headers: Headers }} request
 * @returns {string | null}
 */
export function ipDeOrigen(request) {
    const cabeceras = request?.headers;
    if (!cabeceras || typeof cabeceras.get !== 'function') return null;
    const reenviada = cabeceras.get('x-forwarded-for');
    if (reenviada) {
        for (const candidato of reenviada.split(',')) {
            const ip = normalizar(candidato);
            if (ip) return ip;
        }
    }
    return normalizar(cabeceras.get('x-real-ip'));
}
