// Esquemas zod compartidos por los Route Handlers. Solo servidor.
import * as z from 'zod';

/** Entero positivo de 32 bits; acepta el número JSON o su texto (segmentos de ruta, query y multipart). */
export const idEntero = z.preprocess(
    (v) => (typeof v === 'string' && /^\d{1,10}$/.test(v) ? Number(v) : v),
    z.number().int().positive().max(2147483647),
);

/** Booleano desde JSON o texto 'true'/'false'. */
export const booleano = z.preprocess(
    (v) => (v === 'true' ? true : v === 'false' ? false : v),
    z.boolean(),
);

/** Fecha AAAA-MM-DD válida (no solo con la forma: 2026-02-31 se rechaza). */
export const fechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD.').refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}, 'Fecha inválida.');

export const paramsId = z.object({ id: idEntero }).strict();

// ---- Captura ----
export const capturaCuerpo = z.object({
    id_camara: idEntero,
    // Instante del fotograma en el cliente. Lo recomendable es enviarlo siempre: hace idempotente el reintento.
    marca_tiempo: z.iso.datetime({ offset: true }).optional(),
}).strict();

// ---- Revisión ----
export const deteccionesQuery = z.object({
    solo_validas: booleano.optional().default(false),
    limit: z.preprocess((v) => (typeof v === 'string' && /^\d{1,4}$/.test(v) ? Number(v) : v),
        z.number().int().min(1).max(100)).optional().default(50),
    offset: z.preprocess((v) => (typeof v === 'string' && /^\d{1,9}$/.test(v) ? Number(v) : v),
        z.number().int().min(0)).optional().default(0),
}).strict();

export const justificanteCampos = z.object({
    id_sesion: idEntero,
    id_alumno: idEntero.optional(),
}).strict();

// ---- Biometría ----
export const plantillaCampos = z.object({ id_consent: idEntero }).strict();

export const consentimientoCampos = z.object({
    id_alumno: idEntero,
    fecha_firma: fechaISO,
    vigencia_hasta: fechaISO,
}).strict().refine((d) => d.vigencia_hasta > d.fecha_firma, {
    message: 'La vigencia debe ser posterior a la fecha de firma.',
    path: ['vigencia_hasta'],
});

export const indiceQuery = z.object({
    limit: z.preprocess((v) => (typeof v === 'string' && /^\d{1,3}$/.test(v) ? Number(v) : v),
        z.number().int().min(1).max(200)).optional().default(10),
    offset: z.preprocess((v) => (typeof v === 'string' && /^\d{1,9}$/.test(v) ? Number(v) : v),
        z.number().int().min(0)).optional().default(0),
}).strict();

export const reconstruirCuerpo = z.object({ completa: z.boolean().optional().default(false) }).strict();

export const revertirCuerpo = z.object({ id_indice: idEntero }).strict();

// ---- Administración de cuentas ----
export const ROLES_USUARIO = ['administrador', 'docente', 'alumno', 'tecnico'];

export const usuarioCrearCuerpo = z.object({
    correo: z.string().trim().toLowerCase().max(254).pipe(z.email('Correo inválido.')),
    rol: z.enum(ROLES_USUARIO),
    id_docente: idEntero.optional(),
    id_alumno: idEntero.optional(),
}).strict().superRefine((d, ctx) => {
    // El vínculo debe ser coherente con el rol (la base también lo valida: ROL_VINCULO_INCOHERENTE),
    // pero se comprueba ANTES de crear la cuenta en Auth para no crear y compensar sin necesidad.
    if (d.rol === 'docente' && d.id_docente === undefined) {
        ctx.addIssue({ code: 'custom', path: ['id_docente'], message: 'El rol docente requiere id_docente.' });
    }
    if (d.rol === 'alumno' && d.id_alumno === undefined) {
        ctx.addIssue({ code: 'custom', path: ['id_alumno'], message: 'El rol alumno requiere id_alumno.' });
    }
    if (d.rol !== 'docente' && d.id_docente !== undefined) {
        ctx.addIssue({ code: 'custom', path: ['id_docente'], message: 'Solo el rol docente lleva id_docente.' });
    }
    if (d.rol !== 'alumno' && d.id_alumno !== undefined) {
        ctx.addIssue({ code: 'custom', path: ['id_alumno'], message: 'Solo el rol alumno lleva id_alumno.' });
    }
});

// ---- Jobs ----
export const periodo = z.string().regex(/^\d{4}-[12]$/, 'Usa el formato AAAA-S (S = 1 o 2).');
export const recalcularCuerpo = z.object({ periodo: periodo.optional() }).strict();
