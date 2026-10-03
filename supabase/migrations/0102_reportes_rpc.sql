-- 0102 · Reportes y portal del alumno (RF-13, RF-14, RF-17, RF-21; docs/api/reportes-analitica.md).
--   api_reporte_filtros · api_reporte_grupo · api_reporte_periodo · api_alumno_resumen · api_alumno_historial
-- Lecturas SECURITY INVOKER STABLE: la RLS decide que filas ve cada quien (docente sus grupos, alumno lo
-- propio) y ademas se valida la pertenencia con un codigo de error propio. Porcentajes en escala 0-100 con
-- 2 decimales. Ninguna devuelve imagenes ni rutas objeto_*. Al ser STABLE (PostgREST las ejecuta en una
-- transaccion de solo lectura) no asientan bitacora 'consulta'; las consultas de recortes y documentos
-- si se asientan en los Route Handlers (docs/api/revision.md Decision 8).

-- Contadores de una fila de la vista, con las claves de columna (compartido por todas las RPC de reportes).
CREATE OR REPLACE FUNCTION app.c1_resumen_json(v public.v_resumen_asistencia) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path = pg_catalog, pg_temp
AS $$
    SELECT jsonb_build_object(
        'id_inscripcion', v.id_inscripcion,
        'estatus_inscripcion', v.estatus_inscripcion,
        'sesiones_programadas', v.sesiones_programadas,
        'presentes', v.presentes,
        'retardos', v.retardos,
        'ausencias', v.ausencias,
        'justificadas', v.justificadas,
        'pendientes', v.pendientes,
        'faltas_equivalentes', v.faltas_equivalentes,
        'porcentaje_faltas', v.porcentaje_faltas,
        'limite_pct', v.limite_pct,
        'faltas_maximas_permitidas', v.faltas_maximas_permitidas,
        'faltas_restantes_antes_limite', v.faltas_restantes_antes_limite,
        'supera_limite', v.supera_limite,
        'en_limite', v.en_limite,
        'derecho_examen', v.derecho_examen)
$$;
COMMENT ON FUNCTION app.c1_resumen_json(public.v_resumen_asistencia) IS 'Forma JSON de una fila de v_resumen_asistencia (claves = columnas).';

-- Grupo visible para quien llama: docente solo el suyo (NO_AUTORIZADO); administrador cualquiera (NO_ENCONTRADO si no existe).
CREATE OR REPLACE FUNCTION app.c1_grupo_visible(p_id_grupo integer) RETURNS public.grupo
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    g public.grupo%ROWTYPE;
BEGIN
    IF p_id_grupo IS NULL THEN
        PERFORM app.fallar('VALIDACION', 'Indica el grupo.');
    END IF;
    SELECT g2.* INTO g FROM public.grupo g2 WHERE g2.id_grupo = p_id_grupo;
    IF NOT FOUND THEN
        IF app.rol() = 'administrador' THEN
            PERFORM app.fallar('NO_ENCONTRADO', 'El grupo no existe.');
        END IF;
        PERFORM app.fallar('NO_AUTORIZADO', 'No tienes acceso a este grupo.');
    END IF;
    RETURN g;
END
$$;
COMMENT ON FUNCTION app.c1_grupo_visible(integer) IS 'Fila del grupo si la RLS del invocador la deja ver; NO_AUTORIZADO (docente) o NO_ENCONTRADO (administrador) si no.';
GRANT EXECUTE ON FUNCTION app.c1_resumen_json(public.v_resumen_asistencia), app.c1_grupo_visible(integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- api_reporte_filtros: periodos y grupos accesibles (alimenta los selectores de P-07 y /analitica).
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_reporte_filtros(p_periodo text DEFAULT NULL) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol     text := app.exigir_rol('administrador', 'docente');
    v_periodos jsonb;
    v_actual  text;
    v_sel     text;
    v_grupos  jsonb;
BEGIN
    SELECT coalesce(jsonb_agg(p ORDER BY p DESC), '[]'::jsonb), max(p) INTO v_periodos, v_actual
      FROM (SELECT DISTINCT g.periodo AS p FROM public.grupo g) q;
    v_sel := coalesce(nullif(btrim(p_periodo), ''), v_actual);

    SELECT coalesce(jsonb_agg(jsonb_build_object(
               'id_grupo', g.id_grupo, 'clave_grupo', g.clave_grupo, 'periodo', g.periodo,
               'id_materia', m.id_materia, 'materia_clave', m.clave, 'materia_nombre', m.nombre,
               'id_docente', g.id_docente,
               'docente_nombre', (SELECT app.c1_nombre(d.apellido_paterno, d.apellido_materno, d.nombres)
                                    FROM public.docente d WHERE d.id_docente = g.id_docente),
               'inscritos', (SELECT count(*) FROM public.inscripcion i WHERE i.id_grupo = g.id_grupo AND i.estatus = 'activa'))
               ORDER BY m.nombre, g.clave_grupo, g.id_grupo), '[]'::jsonb)
      INTO v_grupos
      FROM public.grupo g JOIN public.materia m ON m.id_materia = g.id_materia
     WHERE g.periodo = v_sel;

    RETURN jsonb_build_object('periodo_actual', v_actual, 'periodo', v_sel, 'periodos', v_periodos, 'grupos', v_grupos);
END
$$;
COMMENT ON FUNCTION public.api_reporte_filtros(text) IS $c$Periodos y grupos accesibles para los filtros de reportes y analitica (docente: solo sus grupos).
ARGS: p_periodo text opcional (def. el periodo mas reciente accesible)
RETURNS: {periodo_actual, periodo, periodos:["2026-2"], grupos:[{id_grupo, clave_grupo, periodo, id_materia, materia_clave, materia_nombre, id_docente, docente_nombre, inscritos}]}
ERRORES: NO_AUTORIZADO (rol distinto de administrador o docente)
ROLES: administrador, docente$c$;
REVOKE ALL ON FUNCTION public.api_reporte_filtros(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_reporte_filtros(text) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- api_reporte_grupo (RF-17, RF-13, RF-14): KPIs y una fila por alumno con inscripcion activa.
-- asistencia_promedio = 100 * (presentes + retardos) / (registros resueltos, es decir no pendientes) de las
-- sesiones cerradas del grupo, 2 decimales; NULL sin registros. Los KPIs son del grupo completo aunque
-- se filtre por alumno. El detalle sesion por sesion solo viene con p_id_alumno.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_reporte_grupo(
    p_id_grupo  integer,
    p_id_alumno integer DEFAULT NULL,
    p_limit     integer DEFAULT 50,
    p_offset    integer DEFAULT 0
) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol     text := app.exigir_rol('administrador', 'docente');
    g         public.grupo%ROWTYPE := app.c1_grupo_visible(p_id_grupo);
    v_lim     integer := app.c1_limite(p_limit);
    v_off     integer := app.c1_desplazamiento(p_offset);
    v_grupo   jsonb;
    v_kpis    jsonb;
    v_total   bigint;
    v_items   jsonb;
    v_detalle jsonb := NULL;
    v_prom    numeric;
BEGIN
    IF p_id_alumno IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.inscripcion i WHERE i.id_grupo = g.id_grupo AND i.id_alumno = p_id_alumno AND i.estatus = 'activa') THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El alumno no está inscrito en este grupo.');
    END IF;

    SELECT jsonb_build_object(
               'id_grupo', g.id_grupo, 'clave_grupo', g.clave_grupo, 'periodo', g.periodo,
               'id_materia', m.id_materia, 'materia_clave', m.clave, 'materia_nombre', m.nombre,
               'id_docente', g.id_docente,
               'docente_nombre', (SELECT app.c1_nombre(d.apellido_paterno, d.apellido_materno, d.nombres)
                                    FROM public.docente d WHERE d.id_docente = g.id_docente),
               'id_aula', g.id_aula, 'aula_clave', (SELECT au.clave FROM public.aula au WHERE au.id_aula = g.id_aula))
      INTO v_grupo FROM public.materia m WHERE m.id_materia = g.id_materia;

    SELECT round(100.0 * count(*) FILTER (WHERE a.estado IN ('presente', 'retardo'))
                 / nullif(count(*) FILTER (WHERE a.estado <> 'pendiente'), 0), 2)
      INTO v_prom
      FROM public.asistencia a
      JOIN public.sesion_clase s ON s.id_sesion = a.id_sesion AND s.estatus = 'cerrada'
      JOIN public.inscripcion i ON i.id_alumno = a.id_alumno AND i.id_grupo = s.id_grupo AND i.estatus = 'activa'
     WHERE s.id_grupo = g.id_grupo;

    SELECT jsonb_build_object(
               'sesiones_programadas', (SELECT count(*) FROM public.sesion_clase s WHERE s.id_grupo = g.id_grupo AND s.estatus <> 'suspendida'),
               'sesiones_cerradas', (SELECT count(*) FROM public.sesion_clase s WHERE s.id_grupo = g.id_grupo AND s.estatus = 'cerrada'),
               'inscritos', count(*),
               'asistencia_promedio', v_prom,
               'alumnos_en_limite', count(*) FILTER (WHERE v.en_limite),
               'alumnos_sin_derecho', count(*) FILTER (WHERE NOT v.derecho_examen))
      INTO v_kpis
      FROM public.v_resumen_asistencia v WHERE v.id_grupo = g.id_grupo AND v.estatus_inscripcion = 'activa';

    SELECT count(*) INTO v_total
      FROM public.v_resumen_asistencia v
     WHERE v.id_grupo = g.id_grupo AND v.estatus_inscripcion = 'activa' AND (p_id_alumno IS NULL OR v.id_alumno = p_id_alumno);

    SELECT coalesce(jsonb_agg(q.item ORDER BY q.ap, q.am NULLS FIRST, q.nombres, q.id_alumno), '[]'::jsonb) INTO v_items
      FROM (
        SELECT al.id_alumno, al.apellido_paterno AS ap, al.apellido_materno AS am, al.nombres,
               app.c1_alumno_json(al.id_alumno, al.matricula, al.apellido_paterno, al.apellido_materno, al.nombres)
               || app.c1_resumen_json(v) AS item
          FROM public.v_resumen_asistencia v
          JOIN public.alumno al ON al.id_alumno = v.id_alumno
         WHERE v.id_grupo = g.id_grupo AND v.estatus_inscripcion = 'activa' AND (p_id_alumno IS NULL OR v.id_alumno = p_id_alumno)
         ORDER BY al.apellido_paterno, al.apellido_materno NULLS FIRST, al.nombres, al.id_alumno
         LIMIT v_lim OFFSET v_off
      ) q;

    IF p_id_alumno IS NOT NULL THEN
        SELECT coalesce(jsonb_agg(jsonb_build_object(
                   'id_sesion', s.id_sesion, 'fecha', s.fecha, 'hora_inicio', s.hora_inicio,
                   'estatus_sesion', s.estatus,
                   'estado', a.estado, 'origen', a.origen, 'hora_registro', app.c1_iso(a.hora_registro),
                   'justificante_estatus', (SELECT j.estatus FROM public.justificante j
                                             WHERE j.id_sesion = s.id_sesion AND j.id_alumno = p_id_alumno
                                             ORDER BY j.id_justificante DESC LIMIT 1))
                   ORDER BY s.fecha, s.hora_inicio, s.id_sesion), '[]'::jsonb)
          INTO v_detalle
          FROM public.sesion_clase s
          LEFT JOIN public.asistencia a ON a.id_sesion = s.id_sesion AND a.id_alumno = p_id_alumno
         WHERE s.id_grupo = g.id_grupo AND (s.estatus IN ('cerrada', 'abierta', 'suspendida') OR a.id_asistencia IS NOT NULL);
    END IF;

    RETURN jsonb_build_object(
        'generado_en', app.c1_iso(app.now()),
        'grupo', v_grupo,
        'limite_pct', app.param_num('porcentaje_max_ausencias'),
        'retardos_por_ausencia', app.param_num('retardos_por_ausencia')::integer,
        'kpis', v_kpis,
        'total', v_total,
        'items', v_items,
        'detalle', v_detalle);
END
$$;
COMMENT ON FUNCTION public.api_reporte_grupo(integer, integer, integer, integer) IS $c$Reporte de asistencia de un grupo (RF-17): KPIs del grupo y una fila por alumno activo con presentes, retardos, ausencias, justificadas, pendientes, faltas equivalentes (RN-10), porcentaje sobre sesiones programadas (RN-11), faltas restantes y derecho a examen. Con p_id_alumno trae solo su fila y su detalle por sesion.
ARGS: p_id_grupo integer; p_id_alumno integer opcional; p_limit integer (def. 50, max 200); p_offset integer
RETURNS: {generado_en, grupo:{id_grupo, clave_grupo, periodo, id_materia, materia_clave, materia_nombre, id_docente, docente_nombre, id_aula, aula_clave}, limite_pct:20, retardos_por_ausencia:3, kpis:{sesiones_programadas:48, sesiones_cerradas, inscritos, asistencia_promedio:91.5, alumnos_en_limite, alumnos_sin_derecho}, total, items:[{id_alumno, matricula, apellido_paterno, apellido_materno, nombres, nombre_completo, id_inscripcion, sesiones_programadas, presentes, retardos, ausencias, justificadas, pendientes, faltas_equivalentes, porcentaje_faltas:18.75, limite_pct, faltas_maximas_permitidas, faltas_restantes_antes_limite, supera_limite, en_limite, derecho_examen}], detalle:null|[{id_sesion, fecha, hora_inicio, estatus_sesion, estado, origen, hora_registro, justificante_estatus}]}
ERRORES: NO_AUTORIZADO (rol o grupo ajeno), NO_ENCONTRADO (grupo inexistente para el administrador; alumno no inscrito), VALIDACION (grupo nulo)
ROLES: administrador (todos los grupos), docente (solo los suyos)$c$;
REVOKE ALL ON FUNCTION public.api_reporte_grupo(integer, integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_reporte_grupo(integer, integer, integer, integer) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- api_reporte_periodo (RF-17): una fila por grupo del periodo.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_reporte_periodo(
    p_periodo  text,
    p_id_grupo integer DEFAULT NULL,
    p_limit    integer DEFAULT 50,
    p_offset   integer DEFAULT 0
) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol   text := app.exigir_rol('administrador', 'docente');
    v_per   text := btrim(coalesce(p_periodo, ''));
    v_lim   integer := app.c1_limite(p_limit);
    v_off   integer := app.c1_desplazamiento(p_offset);
    v_total bigint;
    v_items jsonb;
    g       public.grupo%ROWTYPE;
BEGIN
    IF v_per !~ '^[0-9]{4}-[12]$' THEN
        PERFORM app.fallar('VALIDACION', 'Periodo no válido: use el formato AAAA-1 o AAAA-2.');
    END IF;
    IF p_id_grupo IS NOT NULL THEN
        g := app.c1_grupo_visible(p_id_grupo);
    END IF;

    SELECT count(*) INTO v_total FROM public.grupo gr
     WHERE gr.periodo = v_per AND (p_id_grupo IS NULL OR gr.id_grupo = p_id_grupo);

    SELECT coalesce(jsonb_agg(q.item ORDER BY q.materia, q.clave_grupo, q.id_grupo), '[]'::jsonb) INTO v_items
      FROM (
        SELECT gr.id_grupo, gr.clave_grupo, m.nombre AS materia,
               jsonb_build_object(
                 'id_grupo', gr.id_grupo, 'clave_grupo', gr.clave_grupo, 'periodo', gr.periodo,
                 'id_materia', m.id_materia, 'materia_clave', m.clave, 'materia_nombre', m.nombre,
                 'id_docente', gr.id_docente,
                 'docente_nombre', (SELECT app.c1_nombre(d.apellido_paterno, d.apellido_materno, d.nombres)
                                      FROM public.docente d WHERE d.id_docente = gr.id_docente),
                 'id_aula', gr.id_aula,
                 'inscritos', r.inscritos,
                 'sesiones_programadas', ss.programadas,
                 'sesiones_cerradas', ss.cerradas,
                 'asistencia_promedio', pr.promedio,
                 'alumnos_en_limite', r.en_limite,
                 'alumnos_sin_derecho', r.sin_derecho) AS item
          FROM public.grupo gr
          JOIN public.materia m ON m.id_materia = gr.id_materia
          CROSS JOIN LATERAL (
              SELECT count(*)::integer AS inscritos,
                     (count(*) FILTER (WHERE v.en_limite))::integer AS en_limite,
                     (count(*) FILTER (WHERE NOT v.derecho_examen))::integer AS sin_derecho
                FROM public.v_resumen_asistencia v
               WHERE v.id_grupo = gr.id_grupo AND v.estatus_inscripcion = 'activa') r
          CROSS JOIN LATERAL (
              SELECT (count(*) FILTER (WHERE s.estatus <> 'suspendida'))::integer AS programadas,
                     (count(*) FILTER (WHERE s.estatus = 'cerrada'))::integer AS cerradas
                FROM public.sesion_clase s WHERE s.id_grupo = gr.id_grupo) ss
          CROSS JOIN LATERAL (
              SELECT round(100.0 * count(*) FILTER (WHERE a.estado IN ('presente', 'retardo'))
                           / nullif(count(*) FILTER (WHERE a.estado <> 'pendiente'), 0), 2) AS promedio
                FROM public.asistencia a
                JOIN public.sesion_clase s ON s.id_sesion = a.id_sesion AND s.estatus = 'cerrada'
                JOIN public.inscripcion i ON i.id_alumno = a.id_alumno AND i.id_grupo = s.id_grupo AND i.estatus = 'activa'
               WHERE s.id_grupo = gr.id_grupo) pr
         WHERE gr.periodo = v_per AND (p_id_grupo IS NULL OR gr.id_grupo = p_id_grupo)
         ORDER BY m.nombre, gr.clave_grupo, gr.id_grupo
         LIMIT v_lim OFFSET v_off
      ) q;

    RETURN jsonb_build_object('generado_en', app.c1_iso(app.now()), 'periodo', v_per, 'total', v_total, 'items', v_items);
END
$$;
COMMENT ON FUNCTION public.api_reporte_periodo(text, integer, integer, integer) IS $c$Reporte por periodo (RF-17): una fila por grupo con inscritos, sesiones programadas y cerradas, asistencia promedio y alumnos en el limite o sin derecho.
ARGS: p_periodo text (AAAA-1|AAAA-2); p_id_grupo integer opcional; p_limit integer (def. 50, max 200); p_offset integer
RETURNS: {generado_en, periodo, total, items:[{id_grupo, clave_grupo, periodo, id_materia, materia_clave, materia_nombre, id_docente, docente_nombre, id_aula, inscritos, sesiones_programadas, sesiones_cerradas, asistencia_promedio, alumnos_en_limite, alumnos_sin_derecho}]}
ERRORES: NO_AUTORIZADO (rol o grupo ajeno), NO_ENCONTRADO (grupo inexistente para el administrador), VALIDACION (periodo)
ROLES: administrador (todos los grupos); docente (solo los suyos, impuesto por la RLS)$c$;
REVOKE ALL ON FUNCTION public.api_reporte_periodo(text, integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_reporte_periodo(text, integer, integer, integer) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- Portal del alumno (RF-21): solo lo propio, sin imagenes ni rutas.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_alumno_resumen(p_periodo text DEFAULT NULL) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol      text := app.exigir_rol('alumno');
    v_alu      integer := app.id_alumno();
    v_periodos jsonb;
    v_sel      text;
    v_items    jsonb;
BEGIN
    SELECT coalesce(jsonb_agg(p ORDER BY p DESC), '[]'::jsonb), max(p) INTO v_periodos, v_sel
      FROM (SELECT DISTINCT g.periodo AS p FROM public.inscripcion i JOIN public.grupo g ON g.id_grupo = i.id_grupo
             WHERE i.id_alumno = v_alu) q;
    v_sel := coalesce(nullif(btrim(p_periodo), ''), v_sel);

    SELECT coalesce(jsonb_agg(q.item ORDER BY q.materia, q.id_grupo), '[]'::jsonb) INTO v_items
      FROM (
        SELECT g.id_grupo, m.nombre AS materia,
               jsonb_build_object(
                 'id_grupo', g.id_grupo, 'clave_grupo', g.clave_grupo, 'periodo', g.periodo,
                 'materia', app.c1_materia_json(m.id_materia, m.clave, m.nombre),
                 'docente_nombre', (SELECT app.c1_nombre(d.apellido_paterno, d.apellido_materno, d.nombres)
                                      FROM public.docente d WHERE d.id_docente = g.id_docente),
                 'sesiones_cerradas', (SELECT count(*) FROM public.sesion_clase s WHERE s.id_grupo = g.id_grupo AND s.estatus = 'cerrada'))
               || app.c1_resumen_json(v) AS item
          FROM public.v_resumen_asistencia v
          JOIN public.grupo g ON g.id_grupo = v.id_grupo
          JOIN public.materia m ON m.id_materia = g.id_materia
         WHERE v.id_alumno = v_alu AND g.periodo = v_sel
      ) q;

    RETURN jsonb_build_object('id_alumno', v_alu, 'periodo', v_sel, 'periodos_disponibles', v_periodos, 'items', v_items);
END
$$;
COMMENT ON FUNCTION public.api_alumno_resumen(text) IS $c$Resumen por materia del alumno autenticado en un periodo (RF-21): acumulados, porcentaje de faltas frente al limite, faltas restantes y derecho a examen. Coincide con el reporte del docente; los pendientes no cuentan hasta resolverse.
ARGS: p_periodo text opcional (def. el periodo mas reciente del alumno)
RETURNS: {id_alumno, periodo, periodos_disponibles:["2026-2"], items:[{id_grupo, clave_grupo, periodo, materia:{id_materia, clave, nombre}, docente_nombre, sesiones_cerradas, id_inscripcion, sesiones_programadas, presentes, retardos, ausencias, justificadas, pendientes, faltas_equivalentes, porcentaje_faltas, limite_pct, faltas_maximas_permitidas, faltas_restantes_antes_limite, supera_limite, en_limite, derecho_examen}]}
ERRORES: NO_AUTORIZADO (rol distinto de alumno)
ROLES: alumno (solo propios)$c$;
REVOKE ALL ON FUNCTION public.api_alumno_resumen(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_alumno_resumen(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.api_alumno_historial(p_id_grupo integer, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol     text := app.exigir_rol('alumno');
    v_alu     integer := app.id_alumno();
    v_lim     integer := app.c1_limite(p_limit);
    v_off     integer := app.c1_desplazamiento(p_offset);
    g         public.grupo%ROWTYPE;
    v         public.v_resumen_asistencia%ROWTYPE;
    v_total   bigint;
    v_items   jsonb;
BEGIN
    SELECT * INTO v FROM public.v_resumen_asistencia vr WHERE vr.id_alumno = v_alu AND vr.id_grupo = p_id_grupo;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_AUTORIZADO', 'No estás inscrito en este grupo.');
    END IF;
    SELECT g2.* INTO g FROM public.grupo g2 WHERE g2.id_grupo = p_id_grupo;

    SELECT count(*) INTO v_total
      FROM public.sesion_clase s
      LEFT JOIN public.asistencia a ON a.id_sesion = s.id_sesion AND a.id_alumno = v_alu
     WHERE s.id_grupo = p_id_grupo AND (s.estatus IN ('cerrada', 'abierta', 'suspendida') OR a.id_asistencia IS NOT NULL);

    SELECT coalesce(jsonb_agg(q.item ORDER BY q.fecha DESC, q.hora_inicio DESC, q.id_sesion DESC), '[]'::jsonb) INTO v_items
      FROM (
        SELECT s.id_sesion, s.fecha, s.hora_inicio,
               jsonb_build_object(
                 'id_sesion', s.id_sesion, 'fecha', s.fecha, 'hora_inicio', s.hora_inicio, 'hora_fin', s.hora_fin,
                 'estatus_sesion', s.estatus, 'modo_registro', s.modo_registro,
                 'estado', a.estado, 'origen', a.origen, 'hora_registro', app.c1_iso(a.hora_registro),
                 'justificante', (SELECT jsonb_build_object('id_justificante', j.id_justificante, 'estatus', j.estatus)
                                    FROM public.justificante j WHERE j.id_sesion = s.id_sesion AND j.id_alumno = v_alu
                                   ORDER BY j.id_justificante DESC LIMIT 1),
                 'puede_justificar', (s.estatus = 'cerrada' AND a.estado IN ('ausente', 'retardo')
                                      AND NOT EXISTS (SELECT 1 FROM public.justificante j
                                                       WHERE j.id_sesion = s.id_sesion AND j.id_alumno = v_alu AND j.estatus = 'pendiente'))
               ) AS item
          FROM public.sesion_clase s
          LEFT JOIN public.asistencia a ON a.id_sesion = s.id_sesion AND a.id_alumno = v_alu
         WHERE s.id_grupo = p_id_grupo AND (s.estatus IN ('cerrada', 'abierta', 'suspendida') OR a.id_asistencia IS NOT NULL)
         ORDER BY s.fecha DESC, s.hora_inicio DESC, s.id_sesion DESC
         LIMIT v_lim OFFSET v_off
      ) q;

    RETURN jsonb_build_object(
        'grupo', jsonb_build_object('id_grupo', g.id_grupo, 'clave_grupo', g.clave_grupo, 'periodo', g.periodo,
                 'materia', (SELECT app.c1_materia_json(m.id_materia, m.clave, m.nombre) FROM public.materia m WHERE m.id_materia = g.id_materia)),
        'resumen', app.c1_resumen_json(v),
        'total', v_total,
        'items', v_items);
END
$$;
COMMENT ON FUNCTION public.api_alumno_historial(integer, integer, integer) IS $c$Historial por sesion del alumno autenticado en un grupo propio (RF-21), sin imagenes ni rutas: estado de cada sesion cerrada, abierta o suspendida (estado null = sin registro), origen, estatus de su justificante y si aun puede justificarla.
ARGS: p_id_grupo integer; p_limit integer (def. 50, max 200); p_offset integer
RETURNS: {grupo:{id_grupo, clave_grupo, periodo, materia}, resumen:{...contadores del grupo...}, total, items:[{id_sesion, fecha, hora_inicio, hora_fin, estatus_sesion, modo_registro, estado, origen, hora_registro, justificante:{id_justificante, estatus}|null, puede_justificar}]}
ERRORES: NO_AUTORIZADO (rol distinto de alumno o grupo donde no esta inscrito)
ROLES: alumno (solo propios)$c$;
REVOKE ALL ON FUNCTION public.api_alumno_historial(integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_alumno_historial(integer, integer, integer) TO authenticated;
