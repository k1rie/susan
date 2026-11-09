// Herramientas del asistente de IA: cada una llama a una RPC api_* con la identidad DEL DOCENTE (ctx.rpc, la RLS limita a sus grupos)
// y reduce el resultado a lo mínimo que hace falta para responder (RNF-03 y minimización de PII): sin ids de inscripción, sin
// apellidos por separado, sin motivos de justificante, sin lecturas, recortes, rutas ni vectores. Solo servidor.
import * as z from 'zod';

const MAX_FILAS = 60;
const MAX_SESIONES_SERIE = 40;

const idGrupo = z.coerce.number().int().positive();
const periodo = z.string().trim().regex(/^\d{4}-\d{1,2}$/, 'Periodo con forma AAAA-N.');

const recortar = (lista, max = MAX_FILAS) => (Array.isArray(lista) ? lista.slice(0, max) : []);
const nombreAlumno = (a) => a?.nombre_completo ?? a?.nombre ?? null;

/** Una por herramienta: `definicion` va a Claude, `entrada` valida lo que Claude manda, `ejecutar` consulta y reduce. */
const HERRAMIENTAS = [
    {
        definicion: {
            name: 'panel_docente',
            description:
                'Resumen del día del docente: fecha de hoy, sesiones de hoy (materia, grupo, aula, horario, estatus y modo previsto), '
                + 'registros pendientes de revisar, justificantes por resolver, número de alertas y la lista de grupos del periodo con su id_grupo. '
                + 'Úsala primero cuando necesites la fecha, los grupos o el id_grupo de otra consulta.',
            input_schema: { type: 'object', properties: {}, additionalProperties: false },
        },
        etiqueta: 'Consultando tu panel del día',
        entrada: z.object({}).strip(),
        async ejecutar(rpc) {
            const p = await rpc('api_docente_panel', {});
            const alertas = Array.isArray(p?.alertas) ? p.alertas : [];
            return {
                fecha: p?.fecha ?? null,
                sesiones_hoy: recortar(p?.sesiones_hoy).map((s) => ({
                    materia: s.materia, clave_grupo: s.clave_grupo, id_grupo: s.id_grupo, aula: s.aula,
                    hora_inicio: s.hora_inicio, hora_fin: s.hora_fin, estatus: s.estatus, modo_previsto: s.modo_previsto,
                })),
                registros_pendientes: p?.pendientes ?? 0,
                justificantes_por_resolver: p?.justificantes_por_resolver ?? 0,
                alertas: {
                    sin_derecho_examen: alertas.filter((a) => a.tipo === 'sin_derecho_examen' || a.tipo === 'sin_derecho').length,
                    en_limite: alertas.filter((a) => a.tipo === 'en_limite').length,
                },
                grupos: recortar(p?.grupos).map((g) => ({
                    id_grupo: g.id_grupo, materia: g.materia, clave_grupo: g.clave_grupo, periodo: g.periodo, inscritos: g.inscritos,
                })),
            };
        },
    },
    {
        definicion: {
            name: 'alumnos_en_riesgo',
            description:
                'Alumnos activos que ya perdieron el derecho a examen (tipo sin_derecho) o están a una falta equivalente de perderlo '
                + '(tipo en_limite), con su porcentaje de faltas y las faltas que les quedan. Opcional: id_grupo para un solo grupo.',
            input_schema: {
                type: 'object',
                properties: { id_grupo: { type: 'integer', description: 'Grupo a filtrar (de panel_docente). Omitir = todos.' } },
                additionalProperties: false,
            },
        },
        etiqueta: 'Buscando alumnos en riesgo',
        entrada: z.object({ id_grupo: idGrupo.optional() }).strip(),
        async ejecutar(rpc, { id_grupo }) {
            const r = await rpc('api_alertas_docente', { idGrupo: id_grupo ?? null, limit: MAX_FILAS });
            return {
                total: r?.total ?? 0,
                sin_derecho: r?.sin_derecho ?? 0,
                en_limite: r?.en_limite ?? 0,
                alumnos: recortar(r?.items).map((a) => ({
                    tipo: a.tipo,
                    matricula: a.matricula,
                    nombre: nombreAlumno(a),
                    grupo: a.clave_grupo,
                    materia: a.materia_nombre,
                    faltas_equivalentes: a.faltas_equivalentes,
                    porcentaje_faltas: a.porcentaje_faltas,
                    limite_pct: a.limite_pct,
                    faltas_restantes_antes_limite: a.faltas_restantes_antes_limite,
                    derecho_examen: a.derecho_examen,
                })),
            };
        },
    },
    {
        definicion: {
            name: 'ausentismo_por_grupo',
            description:
                'Comparativo de los grupos del docente en un periodo: inscritos, sesiones programadas y cerradas, asistencia promedio (%) '
                + 'y cuántos alumnos están en el límite o sin derecho. Sirve para «¿qué grupo falta más?». Sin periodo usa el actual.',
            input_schema: {
                type: 'object',
                properties: { periodo: { type: 'string', description: 'Periodo AAAA-N, p. ej. 2026-2. Omitir = periodo actual.' } },
                additionalProperties: false,
            },
        },
        etiqueta: 'Comparando el ausentismo de tus grupos',
        entrada: z.object({ periodo: periodo.optional() }).strip(),
        async ejecutar(rpc, { periodo: p }) {
            let elegido = p;
            if (!elegido) {
                const filtros = await rpc('api_reporte_filtros', {});
                elegido = filtros?.periodo_actual ?? filtros?.periodo ?? filtros?.periodos?.[0] ?? null;
                if (!elegido) return { periodo: null, grupos: [], nota: 'No hay periodos con grupos para este docente.' };
            }
            const r = await rpc('api_reporte_periodo', { periodo: elegido, limit: MAX_FILAS });
            return {
                periodo: r?.periodo ?? elegido,
                grupos: recortar(r?.items).map((g) => ({
                    id_grupo: g.id_grupo, clave_grupo: g.clave_grupo, materia: g.materia_nombre, inscritos: g.inscritos,
                    sesiones_programadas: g.sesiones_programadas, sesiones_cerradas: g.sesiones_cerradas,
                    asistencia_promedio: g.asistencia_promedio, alumnos_en_limite: g.alumnos_en_limite, alumnos_sin_derecho: g.alumnos_sin_derecho,
                })),
            };
        },
    },
    {
        definicion: {
            name: 'reporte_grupo',
            description:
                'Reporte de asistencia de UN grupo: indicadores del grupo y una fila por alumno con presentes, retardos, ausencias, '
                + 'justificadas, porcentaje de faltas, faltas restantes y derecho a examen. Requiere id_grupo (de panel_docente).',
            input_schema: {
                type: 'object',
                properties: { id_grupo: { type: 'integer', description: 'Grupo del docente.' } },
                required: ['id_grupo'],
                additionalProperties: false,
            },
        },
        etiqueta: 'Leyendo el reporte del grupo',
        entrada: z.object({ id_grupo: idGrupo }).strip(),
        async ejecutar(rpc, { id_grupo }) {
            const r = await rpc('api_reporte_grupo', { idGrupo: id_grupo, limit: MAX_FILAS });
            return {
                grupo: { clave_grupo: r?.grupo?.clave_grupo, materia: r?.grupo?.materia_nombre, periodo: r?.grupo?.periodo },
                limite_pct: r?.limite_pct,
                retardos_por_ausencia: r?.retardos_por_ausencia,
                kpis: r?.kpis ?? null,
                total_alumnos: r?.total ?? 0,
                alumnos: recortar(r?.items).map((a) => ({
                    matricula: a.matricula, nombre: nombreAlumno(a), presentes: a.presentes, retardos: a.retardos,
                    ausencias: a.ausencias, justificadas: a.justificadas, pendientes: a.pendientes,
                    porcentaje_faltas: a.porcentaje_faltas, faltas_restantes_antes_limite: a.faltas_restantes_antes_limite,
                    derecho_examen: a.derecho_examen,
                })),
            };
        },
    },
    {
        definicion: {
            name: 'tendencia_grupo',
            description:
                'Evolución del ausentismo de UN grupo, una entrada por sesión cerrada (las más recientes): fecha, día de la semana '
                + '(1 = lunes), ausentes, inscritos y tasa de ausentismo (fracción 0-1). Sirve para patrones por día o tendencia.',
            input_schema: {
                type: 'object',
                properties: { id_grupo: { type: 'integer', description: 'Grupo del docente.' } },
                required: ['id_grupo'],
                additionalProperties: false,
            },
        },
        etiqueta: 'Revisando la tendencia del grupo',
        entrada: z.object({ id_grupo: idGrupo }).strip(),
        async ejecutar(rpc, { id_grupo }) {
            const r = await rpc('api_serie_grupo', { idGrupo: id_grupo });
            const sesiones = Array.isArray(r?.sesiones) ? r.sesiones : [];
            return {
                periodo: r?.periodo ?? null,
                sesiones_programadas: r?.sesiones_programadas ?? null,
                sesiones_cerradas: sesiones.length,
                sesiones: sesiones.slice(-MAX_SESIONES_SERIE).map((s) => ({
                    fecha: s.fecha, dia_semana: s.dia_semana, inscritos: s.inscritos, ausentes: s.ausentes,
                    retardos: s.retardos, tasa_ausentismo: s.tasa_ausentismo,
                })),
            };
        },
    },
    {
        definicion: {
            name: 'justificantes_pendientes',
            description:
                'Justificantes por resolver y registros pendientes de revisión del docente: cuántos hay y, de cada justificante, '
                + 'alumno, materia, grupo y fecha de la sesión. No incluye el motivo ni documentos.',
            input_schema: { type: 'object', properties: {}, additionalProperties: false },
        },
        etiqueta: 'Revisando justificantes pendientes',
        entrada: z.object({}).strip(),
        async ejecutar(rpc) {
            const r = await rpc('api_cola_revision', { pestana: 'justificantes', limit: MAX_FILAS });
            return {
                justificantes_por_resolver: r?.contadores?.justificantes ?? 0,
                registros_pendientes: r?.contadores?.pendientes ?? 0,
                justificantes: recortar(r?.justificantes).map((j) => ({
                    matricula: j.alumno?.matricula, nombre: nombreAlumno(j.alumno), materia: j.materia?.nombre,
                    grupo: j.grupo?.clave_grupo, fecha_sesion: j.sesion?.fecha, registrado: j.fecha_registro,
                })),
            };
        },
    },
];

const POR_NOMBRE = new Map(HERRAMIENTAS.map((h) => [h.definicion.name, h]));

/** Definiciones para `tools` de la Messages API (orden fijo: el prefijo cacheado no cambia entre peticiones). */
export const DEFINICIONES_HERRAMIENTAS = HERRAMIENTAS.map((h) => ({ ...h.definicion, eager_input_streaming: true }));

/** Texto de estado que ve el docente mientras corre una herramienta. */
export const etiquetaHerramienta = (nombre) => POR_NOMBRE.get(nombre)?.etiqueta ?? 'Consultando tus datos';

/**
 * Ejecuta una herramienta pedida por Claude. Nunca lanza: los errores vuelven como { error } para el tool_result.
 * @returns {Promise<{ ok: boolean, contenido: string }>}
 */
export async function ejecutarHerramienta(nombre, entrada, rpc) {
    const herramienta = POR_NOMBRE.get(nombre);
    if (!herramienta) return { ok: false, contenido: JSON.stringify({ error: 'HERRAMIENTA_DESCONOCIDA' }) };
    // Con eager_input_streaming la API ya no valida la entrada: se valida aquí antes de consultar nada.
    const validada = herramienta.entrada.safeParse(entrada ?? {});
    if (!validada.success) {
        return { ok: false, contenido: JSON.stringify({ error: 'ENTRADA_INVALIDA', detalle: validada.error.issues.map((i) => i.message) }) };
    }
    try {
        const datos = await herramienta.ejecutar(rpc, validada.data);
        return { ok: true, contenido: JSON.stringify(datos) };
    } catch (e) {
        // Código de negocio (NO_AUTORIZADO, NO_ENCONTRADO...) sí: le sirve a Claude para explicarlo. Texto crudo de la base, no.
        const code = typeof e?.code === 'string' ? e.code : 'ERROR_CONSULTA';
        return { ok: false, contenido: JSON.stringify({ error: code }) };
    }
}
