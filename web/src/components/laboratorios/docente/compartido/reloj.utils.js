// Reloj del plantel para las pantallas de laboratorios del docente. Las reglas del servidor (anticipación mínima, «ya inició»)
// se evalúan con la hora de NEGOCIO (api_ahora: en desarrollo puede ser el reloj de demostración), no con la del navegador;
// por eso la pantalla pide ese reloj y solo cae al del navegador si la consulta falla. Todo es validación de conveniencia:
// la decisión final siempre es del servidor.
import { esFechaISO, hoyLocal, partesFecha } from '@/lib/formularios/fechas.js';
import { minutosDeHora } from '../../laboratorios.utils.js';

const dos = (n) => String(n).padStart(2, '0');
const HORA = /^([01]\d|2[0-3]):([0-5]\d)/;

/**
 * Minutos desde 1970-01-01 00:00 «de pared» (sin zona) de una fecha 'AAAA-MM-DD' y una hora 'HH:MM'. No es un instante real:
 * solo sirve para comparar y sumar horas dentro del mismo reloj (el del plantel). null si algo no es válido.
 */
export function instanteEnMinutos(fecha, hora) {
    const p = partesFecha(fecha);
    const m = minutosDeHora(hora);
    if (!p || m == null) return null;
    return Date.UTC(p.anio, p.mes - 1, p.dia) / 60000 + m;
}

/** Inverso de `instanteEnMinutos`: { fecha: 'AAAA-MM-DD', hora: 'HH:MM' }. */
export function fechaHoraDeInstante(minutos) {
    const d = new Date(minutos * 60000);
    return {
        fecha: `${String(d.getUTCFullYear()).padStart(4, '0')}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`,
        hora: `${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}`,
    };
}

/** Reloj del navegador como respaldo: { hoy: 'AAAA-MM-DD', hora: 'HH:MM' }. */
export function relojDelNavegador(ahora = new Date()) {
    return { hoy: hoyLocal(ahora), hora: `${dos(ahora.getHours())}:${dos(ahora.getMinutes())}` };
}

/**
 * Reloj del plantel a partir de la respuesta de api_ahora ({ fecha, hora 'HH:MM[:SS]' }). Si la respuesta falta o no sirve, se usa el
 * del navegador (`delPlantel: false`). Los segundos se descartan: las comparaciones son por minuto.
 */
export function relojDeRespuesta(data) {
    const m = HORA.exec(String(data?.hora ?? ''));
    if (esFechaISO(data?.fecha) && m) return { hoy: data.fecha, hora: `${m[1]}:${m[2]}`, delPlantel: true };
    return { ...relojDelNavegador(), delPlantel: false };
}
