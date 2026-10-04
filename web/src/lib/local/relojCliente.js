// Cliente del navegador de /api/_local/reloj (reloj de demostracion). Sin imports de Node: viaja en el bundle del
// cliente. Fuera del modo local la ruta responde 404 y estas funciones lanzan ApiError NO_ENCONTRADO.
import { getJSON, postJSON } from '@/lib/http/client.js';

export const RUTA_RELOJ_DEMO = '/api/_local/reloj';

/** @returns {Promise<{ activo: boolean, corre: boolean, ahora: string, fecha: string, hora: string, inicial: string | null }>} */
export const leerRelojDemo = (opciones) => getJSON(RUTA_RELOJ_DEMO, opciones);

/**
 * Una sola operacion por llamada.
 * @param {{ avanzarMin: number } | { fijar: string } | { restablecer: true } | { correr: boolean }} cuerpo
 * @returns {Promise<{ activo: boolean, corre: boolean, ahora: string, fecha: string, hora: string, inicial: string | null }>}
 */
export const cambiarRelojDemo = (cuerpo, opciones) => postJSON(RUTA_RELOJ_DEMO, cuerpo, opciones);
