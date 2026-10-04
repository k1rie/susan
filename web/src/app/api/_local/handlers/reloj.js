// Handler /api/_local/reloj: lee y mueve el reloj de demostracion (lib/local/reloj.js). Solo desarrollo local:
// `manejar` responde 404 sin SUSAN_LOCAL=1 o con NODE_ENV=production, igual que el resto de /api/_local/*.
//
//   GET  -> { activo, corre, ahora (ISO con zona), fecha, hora, inicial }
//   POST -> uno de { avanzarMin: n } | { fijar: 'AAAA-MM-DD HH:MM[:SS]' } | { restablecer: true } | { correr: bool }
//           y responde el mismo cuerpo que GET con el estado ya cambiado.
// Cualquier usuario con sesion puede usarlo (es una herramienta de demostracion, no de administracion).
import { z } from 'zod';
import {
    ErrorReloj,
    MAX_AVANCE_MIN,
    avanzarReloj,
    correrReloj,
    describirReloj,
    fijarReloj,
    leerReloj,
    restablecerReloj,
} from '@/lib/local/reloj.js';
import { errorHttp, json, leerJson, manejar } from './comun.js';

// Solo la forma; que la fecha exista de verdad (2026-02-31) lo decide parsearInstante.
const RE_FIJAR = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/;

// Exactamente una operacion por peticion: strictObject rechaza llaves de mas (p. ej. avanzar y fijar a la vez).
const esquemaCambio = z.union([
    z.strictObject({ avanzarMin: z.number().int().refine((n) => n !== 0).min(-MAX_AVANCE_MIN).max(MAX_AVANCE_MIN) }),
    z.strictObject({ fijar: z.string().trim().regex(RE_FIJAR) }),
    z.strictObject({ restablecer: z.literal(true) }),
    z.strictObject({ correr: z.boolean() }),
]);

const ESTATUS_POR_CODIGO = { RELOJ_NO_ACTIVO: 409, FUERA_DE_RANGO: 400, FORMATO_INVALIDO: 400 };

export function obtenerReloj(request) {
    // GET no cambia estado: no hace falta Origin, pero si sesion.
    return manejar(request, { estado: false }, async () => json(describirReloj(leerReloj())));
}

export function cambiarReloj(request) {
    return manejar(request, {}, async () => {
        const cuerpo = esquemaCambio.safeParse(await leerJson(request));
        if (!cuerpo.success) {
            return errorHttp(
                'Se esperaba exactamente una de: { avanzarMin }, { fijar }, { restablecer: true } o { correr }.',
                'validation_failed',
                400,
            );
        }
        const c = cuerpo.data;
        try {
            let estado;
            if ('avanzarMin' in c) estado = avanzarReloj(c.avanzarMin);
            else if ('fijar' in c) estado = fijarReloj(c.fijar);
            else if ('correr' in c) estado = correrReloj(c.correr);
            else estado = restablecerReloj();
            return json(describirReloj(estado));
        } catch (e) {
            if (e instanceof ErrorReloj) {
                return errorHttp(e.message, e.code, ESTATUS_POR_CODIGO[e.code] ?? 400);
            }
            throw e; // lo atiende `manejar` (500 generico, sin detalles internos)
        }
    });
}
