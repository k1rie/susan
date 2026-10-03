-- 0103 · Series para el analisis numerico, impacto en tiempo y alertas del docente.
--   api_serie_grupo · api_matriz_grupo · api_serie_alumno · api_impacto_tiempo · api_alertas_docente
-- Formas fijadas en docs/ARCHITECTURE.md seccion 11 (api_serie_grupo, api_matriz_grupo): solo sesiones
-- 'cerrada', ordenadas por fecha. Lecturas SECURITY INVOKER STABLE; sin imagenes ni rutas objeto_*.

-- ---------------------------------------------------------------------------------------------
-- api_serie_grupo: una entrada por sesion cerrada con los conteos por estado y la tasa de ausentismo.
-- Claves extra respecto del contrato minimo: retardos_por_ausencia (nivel superior) y anio_iso (por sesion).
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_serie_grupo(p_id_grupo integer) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol  text := app.exigir_rol('administrador', 'docente');
    g      public.grupo%ROWTYPE := app.c1_grupo_visible(p_id_grupo);
    v_ses  jsonb;
    v_prog integer;
BEGIN
    SELECT count(*)::integer INTO v_prog FROM public.sesion_clase s WHERE s.id_grupo = g.id_grupo AND s.estatus <> 'suspendida';

    SELECT coalesce(jsonb_agg(jsonb_build_object(
               'id_sesion', q.id_sesion,
               'fecha', q.fecha,
               'semana_iso', q.semana_iso,
               'anio_iso', q.anio_iso,
               'dia_semana', q.dia_semana,
               'inscritos', q.inscritos,
               'presentes', q.presentes,
               'retardos', q.retardos,
               'ausentes', q.ausentes,
               'justificados', q.justificados,
               'pendientes', q.pendientes,
               'tasa_ausentismo', CASE WHEN q.inscritos > 0 THEN round(q.ausentes::numeric / q.inscritos, 4) ELSE 0 END)
               ORDER BY q.fecha, q.hora_inicio, q.id_sesion), '[]'::jsonb)
      INTO v_ses
      FROM (
        SELECT s.id_sesion, s.fecha, s.hora_inicio,
               extract(week FROM s.fecha)::integer AS semana_iso,
               extract(isoyear FROM s.fecha)::integer AS anio_iso,
               extract(isodow FROM s.fecha)::integer AS dia_semana,
               c.inscritos, c.presentes, c.retardos, c.ausentes, c.justificados, c.pendientes
          FROM public.sesion_clase s
          CROSS JOIN LATERAL (
              SELECT count(*)::integer AS inscritos,
                     (count(*) FILTER (WHERE a.estado = 'presente'))::integer AS presentes,
                     (count(*) FILTER (WHERE a.estado = 'retardo'))::integer AS retardos,
                     (count(*) FILTER (WHERE a.estado = 'ausente'))::integer AS ausentes,
                     (count(*) FILTER (WHERE a.estado = 'justificado'))::integer AS justificados,
                     (count(*) FILTER (WHERE a.estado = 'pendiente'))::integer AS pendientes
                FROM public.asistencia a WHERE a.id_sesion = s.id_sesion) c
         WHERE s.id_grupo = g.id_grupo AND s.estatus = 'cerrada'
      ) q;

    RETURN jsonb_build_object(
        'id_grupo', g.id_grupo,
        'periodo', g.periodo,
        'sesiones_programadas', v_prog,
        'limite_pct', app.param_num('porcentaje_max_ausencias'),
        'retardos_por_ausencia', app.param_num('retardos_por_ausencia')::integer,
        'sesiones', v_ses);
END
$$;
COMMENT ON FUNCTION public.api_serie_grupo(integer) IS $c$Serie temporal del grupo para el analisis numerico: una entrada por sesion CERRADA, ordenada por fecha, con conteos por estado y tasa de ausentismo = ausentes / inscritos (fraccion 0-1, 4 decimales). inscritos = registros de asistencia de la sesion.
ARGS: p_id_grupo integer
RETURNS: {id_grupo, periodo, sesiones_programadas:48, limite_pct:20, retardos_por_ausencia:3, sesiones:[{id_sesion, fecha, semana_iso, anio_iso, dia_semana (1=lunes), inscritos, presentes, retardos, ausentes, justificados, pendientes, tasa_ausentismo:0.0667}]}
ERRORES: NO_AUTORIZADO (rol o grupo ajeno), NO_ENCONTRADO (grupo inexistente para el administrador), VALIDACION (grupo nulo)
ROLES: administrador, docente (solo sus grupos)$c$;
REVOKE ALL ON FUNCTION public.api_serie_grupo(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_serie_grupo(integer) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- api_matriz_grupo: alumno x sesion cerrada. estados alineado con fechas (null = sin registro). Incluye a
-- los alumnos dados de baja solo si tienen registros en sesiones cerradas. Paginada por alumno (def. 200);
-- fechas es siempre la lista completa.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_matriz_grupo(p_id_grupo integer, p_limit integer DEFAULT 200, p_offset integer DEFAULT 0) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol    text := app.exigir_rol('administrador', 'docente');
    g        public.grupo%ROWTYPE := app.c1_grupo_visible(p_id_grupo);
    v_lim    integer := app.c1_limite(p_limit, 200, 200);
    v_off    integer := app.c1_desplazamiento(p_offset);
    v_fechas jsonb;
    v_total  bigint;
    v_alum   jsonb;
BEGIN
    SELECT coalesce(jsonb_agg(s.fecha ORDER BY s.fecha, s.hora_inicio, s.id_sesion), '[]'::jsonb) INTO v_fechas
      FROM public.sesion_clase s WHERE s.id_grupo = g.id_grupo AND s.estatus = 'cerrada';

    SELECT count(*) INTO v_total
      FROM public.inscripcion i
     WHERE i.id_grupo = g.id_grupo
       AND (i.estatus = 'activa' OR EXISTS (
            SELECT 1 FROM public.asistencia a JOIN public.sesion_clase s ON s.id_sesion = a.id_sesion
             WHERE a.id_alumno = i.id_alumno AND s.id_grupo = g.id_grupo AND s.estatus = 'cerrada'));

    SELECT coalesce(jsonb_agg(q.item ORDER BY q.ap, q.am NULLS FIRST, q.nombres, q.id_alumno), '[]'::jsonb) INTO v_alum
      FROM (
        SELECT al.id_alumno, al.apellido_paterno AS ap, al.apellido_materno AS am, al.nombres,
               jsonb_build_object(
                 'id_alumno', al.id_alumno,
                 'id_inscripcion', i.id_inscripcion,
                 'matricula', al.matricula,
                 'nombre', app.c1_nombre(al.apellido_paterno, al.apellido_materno, al.nombres),
                 'estados', coalesce((
                     SELECT jsonb_agg(a.estado ORDER BY s.fecha, s.hora_inicio, s.id_sesion)
                       FROM public.sesion_clase s
                       LEFT JOIN public.asistencia a ON a.id_sesion = s.id_sesion AND a.id_alumno = i.id_alumno
                      WHERE s.id_grupo = g.id_grupo AND s.estatus = 'cerrada'), '[]'::jsonb)) AS item
          FROM public.inscripcion i
          JOIN public.alumno al ON al.id_alumno = i.id_alumno
         WHERE i.id_grupo = g.id_grupo
           AND (i.estatus = 'activa' OR EXISTS (
                SELECT 1 FROM public.asistencia a JOIN public.sesion_clase s ON s.id_sesion = a.id_sesion
                 WHERE a.id_alumno = i.id_alumno AND s.id_grupo = g.id_grupo AND s.estatus = 'cerrada'))
         ORDER BY al.apellido_paterno, al.apellido_materno NULLS FIRST, al.nombres, al.id_alumno
         LIMIT v_lim OFFSET v_off
      ) q;

    RETURN jsonb_build_object('fechas', v_fechas, 'total', v_total, 'alumnos', v_alum);
END
$$;
COMMENT ON FUNCTION public.api_matriz_grupo(integer, integer, integer) IS $c$Matriz alumno x sesion cerrada para el analisis numerico: fechas (una por sesion cerrada, por orden cronologico) y, por alumno, estados alineados con fechas (null = sin registro). Los alumnos dados de baja solo aparecen si tienen registros. Paginada por alumno (def. 200); clave extra total.
ARGS: p_id_grupo integer; p_limit integer (def. 200, max 200); p_offset integer
RETURNS: {fechas:["2026-08-17"], total, alumnos:[{id_alumno, id_inscripcion, matricula, nombre, estados:["presente","ausente",null]}]}
ERRORES: NO_AUTORIZADO (rol o grupo ajeno), NO_ENCONTRADO (grupo inexistente para el administrador), VALIDACION (grupo nulo)
ROLES: administrador, docente (solo sus grupos)$c$;
REVOKE ALL ON FUNCTION public.api_matriz_grupo(integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_matriz_grupo(integer, integer, integer) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- api_serie_alumno: sesiones cerradas de un alumno con el acumulado de faltas equivalentes (proyeccion).
-- Alumno: solo la propia (p_id_alumno omitido o igual). Docente/administrador: p_id_alumno obligatorio.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_serie_alumno(p_id_grupo integer, p_id_alumno integer DEFAULT NULL) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol  text := app.exigir_rol('alumno', 'administrador', 'docente');
    v_alu  integer;
    g      public.grupo%ROWTYPE;
    v      public.v_resumen_asistencia%ROWTYPE;
    v_rpa  numeric := app.param_num('retardos_por_ausencia');
    v_ses  jsonb;
BEGIN
    IF v_rol = 'alumno' THEN
        v_alu := app.id_alumno();
        IF p_id_alumno IS NOT NULL AND p_id_alumno <> v_alu THEN
            PERFORM app.fallar('NO_AUTORIZADO', 'Solo puedes consultar tus propios registros.');
        END IF;
        IF p_id_grupo IS NULL OR NOT EXISTS (SELECT 1 FROM public.inscripcion i WHERE i.id_alumno = v_alu AND i.id_grupo = p_id_grupo) THEN
            PERFORM app.fallar('NO_AUTORIZADO', 'No estás inscrito en este grupo.');
        END IF;
        SELECT g2.* INTO g FROM public.grupo g2 WHERE g2.id_grupo = p_id_grupo;
    ELSE
        g := app.c1_grupo_visible(p_id_grupo);
        IF p_id_alumno IS NULL THEN
            PERFORM app.fallar('VALIDACION', 'Indica el alumno.');
        END IF;
        v_alu := p_id_alumno;
    END IF;

    SELECT vr.* INTO v FROM public.v_resumen_asistencia vr WHERE vr.id_alumno = v_alu AND vr.id_grupo = g.id_grupo;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El alumno no está inscrito en este grupo.');
    END IF;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
               'id_sesion', q.id_sesion, 'fecha', q.fecha, 'semana_iso', q.semana_iso, 'dia_semana', q.dia_semana,
               'estado', q.estado,
               'ausencias_acumuladas', q.aus, 'retardos_acumulados', q.ret,
               'faltas_equivalentes_acumuladas',
                   q.aus + CASE WHEN v_rpa >= 1 THEN floor(q.ret / v_rpa)::integer ELSE 0 END)
               ORDER BY q.fecha, q.hora_inicio, q.id_sesion), '[]'::jsonb)
      INTO v_ses
      FROM (
        SELECT s.id_sesion, s.fecha, s.hora_inicio,
               extract(week FROM s.fecha)::integer AS semana_iso,
               extract(isodow FROM s.fecha)::integer AS dia_semana,
               a.estado,
               (count(*) FILTER (WHERE a.estado = 'ausente') OVER w)::integer AS aus,
               (count(*) FILTER (WHERE a.estado = 'retardo') OVER w)::integer AS ret
          FROM public.sesion_clase s
          LEFT JOIN public.asistencia a ON a.id_sesion = s.id_sesion AND a.id_alumno = v_alu
         WHERE s.id_grupo = g.id_grupo AND s.estatus = 'cerrada'
        WINDOW w AS (ORDER BY s.fecha, s.hora_inicio, s.id_sesion)
      ) q;

    RETURN jsonb_build_object(
        'id_grupo', g.id_grupo,
        'id_alumno', v_alu,
        'periodo', g.periodo,
        'sesiones_programadas', v.sesiones_programadas,
        'limite_pct', v.limite_pct,
        'retardos_por_ausencia', v_rpa::integer,
        'resumen', app.c1_resumen_json(v),
        'sesiones', v_ses);
END
$$;
COMMENT ON FUNCTION public.api_serie_alumno(integer, integer) IS $c$Serie de un alumno en un grupo: una entrada por sesion CERRADA (estado null = sin registro) con las ausencias, retardos y faltas equivalentes acumuladas hasta esa sesion, mas su resumen actual. Sin imagenes.
ARGS: p_id_grupo integer; p_id_alumno integer (omitido o propio para el alumno; obligatorio para docente y administrador)
RETURNS: {id_grupo, id_alumno, periodo, sesiones_programadas, limite_pct, retardos_por_ausencia, resumen:{...}, sesiones:[{id_sesion, fecha, semana_iso, dia_semana, estado, ausencias_acumuladas, retardos_acumulados, faltas_equivalentes_acumuladas}]}
ERRORES: NO_AUTORIZADO (alumno ajeno, grupo ajeno o sin inscripcion propia), NO_ENCONTRADO (alumno no inscrito en el grupo), VALIDACION (falta p_id_alumno)
ROLES: alumno (solo propios), docente (sus grupos), administrador$c$;
REVOKE ALL ON FUNCTION public.api_serie_alumno(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_serie_alumno(integer, integer) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- api_impacto_tiempo: ESTIMACION del tiempo de clase recuperado (objetivo del proyecto, spec 4.1).
-- minutos_recuperados = sesiones automaticas cerradas * minutos_pase_lista_base (parametro 12).
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_impacto_tiempo(p_id_grupo integer DEFAULT NULL, p_periodo text DEFAULT NULL) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol   text := app.exigir_rol('administrador', 'docente');
    v_per   text := nullif(btrim(coalesce(p_periodo, '')), '');
    v_base  numeric := app.param_num('minutos_pase_lista_base');
    v_aut   integer;
    v_man   integer;
    v_min   numeric;
    g       public.grupo%ROWTYPE;
BEGIN
    IF v_per IS NOT NULL AND v_per !~ '^[0-9]{4}-[12]$' THEN
        PERFORM app.fallar('VALIDACION', 'Periodo no válido: use el formato AAAA-1 o AAAA-2.');
    END IF;
    IF p_id_grupo IS NOT NULL THEN
        g := app.c1_grupo_visible(p_id_grupo);
    END IF;

    SELECT (count(*) FILTER (WHERE s.modo_registro = 'automatico'))::integer,
           (count(*) FILTER (WHERE s.modo_registro = 'manual'))::integer
      INTO v_aut, v_man
      FROM public.sesion_clase s JOIN public.grupo gr ON gr.id_grupo = s.id_grupo
     WHERE s.estatus = 'cerrada'
       AND (p_id_grupo IS NULL OR s.id_grupo = p_id_grupo)
       AND (v_per IS NULL OR gr.periodo = v_per);
    v_min := v_aut * v_base;

    RETURN jsonb_build_object(
        'id_grupo', p_id_grupo,
        'periodo', v_per,
        'sesiones_cerradas', v_aut + v_man,
        'sesiones_automaticas', v_aut,
        'sesiones_manuales', v_man,
        'minutos_pase_lista_base', v_base,
        'minutos_recuperados', v_min,
        'horas_recuperadas', round(v_min / 60, 2),
        'es_estimacion', true,
        'nota', format('Estimación: sesiones automáticas × %s min de pase de lista manual.', v_base::text));
END
$$;
COMMENT ON FUNCTION public.api_impacto_tiempo(integer, text) IS $c$ESTIMACION del tiempo de clase recuperado: sesiones cerradas en modo automatico vs manual y minutos recuperados = automaticas x minutos_pase_lista_base. No es una medicion.
ARGS: p_id_grupo integer opcional; p_periodo text opcional (AAAA-1|AAAA-2)
RETURNS: {id_grupo, periodo, sesiones_cerradas, sesiones_automaticas, sesiones_manuales, minutos_pase_lista_base:5, minutos_recuperados, horas_recuperadas, es_estimacion:true, nota}
ERRORES: NO_AUTORIZADO (rol o grupo ajeno), NO_ENCONTRADO (grupo inexistente para el administrador), VALIDACION (periodo)
ROLES: administrador, docente (solo sus grupos)$c$;
REVOKE ALL ON FUNCTION public.api_impacto_tiempo(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_impacto_tiempo(integer, text) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- api_alertas_docente (RF-14): alumnos sin derecho a examen o a una falta equivalente del limite.
-- Lectura reutilizable por el panel P-02.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_alertas_docente(p_id_grupo integer DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol    text := app.exigir_rol('administrador', 'docente');
    v_lim    integer := app.c1_limite(p_limit);
    v_off    integer := app.c1_desplazamiento(p_offset);
    g        public.grupo%ROWTYPE;
    v_sin    bigint;
    v_lim_n  bigint;
    v_items  jsonb;
BEGIN
    IF p_id_grupo IS NOT NULL THEN
        g := app.c1_grupo_visible(p_id_grupo);
    END IF;

    SELECT count(*) FILTER (WHERE NOT v.derecho_examen OR v.supera_limite),
           count(*) FILTER (WHERE v.derecho_examen AND NOT v.supera_limite AND v.en_limite)
      INTO v_sin, v_lim_n
      FROM public.v_resumen_asistencia v
     WHERE v.estatus_inscripcion = 'activa' AND (p_id_grupo IS NULL OR v.id_grupo = p_id_grupo)
       AND (NOT v.derecho_examen OR v.supera_limite OR v.en_limite);

    SELECT coalesce(jsonb_agg(q.item ORDER BY q.orden, q.pct DESC NULLS LAST, q.ap, q.am NULLS FIRST, q.nombres, q.id_alumno), '[]'::jsonb) INTO v_items
      FROM (
        SELECT al.id_alumno, al.apellido_paterno AS ap, al.apellido_materno AS am, al.nombres, v.porcentaje_faltas AS pct,
               CASE WHEN NOT v.derecho_examen OR v.supera_limite THEN 0 ELSE 1 END AS orden,
               jsonb_build_object(
                 'tipo', CASE WHEN NOT v.derecho_examen OR v.supera_limite THEN 'sin_derecho' ELSE 'en_limite' END,
                 'id_grupo', gr.id_grupo, 'clave_grupo', gr.clave_grupo, 'periodo', gr.periodo,
                 'materia_clave', m.clave, 'materia_nombre', m.nombre)
               || app.c1_alumno_json(al.id_alumno, al.matricula, al.apellido_paterno, al.apellido_materno, al.nombres)
               || app.c1_resumen_json(v) AS item
          FROM public.v_resumen_asistencia v
          JOIN public.alumno al ON al.id_alumno = v.id_alumno
          JOIN public.grupo gr ON gr.id_grupo = v.id_grupo
          JOIN public.materia m ON m.id_materia = gr.id_materia
         WHERE v.estatus_inscripcion = 'activa' AND (p_id_grupo IS NULL OR v.id_grupo = p_id_grupo)
           AND (NOT v.derecho_examen OR v.supera_limite OR v.en_limite)
         ORDER BY CASE WHEN NOT v.derecho_examen OR v.supera_limite THEN 0 ELSE 1 END, v.porcentaje_faltas DESC NULLS LAST,
                  al.apellido_paterno, al.apellido_materno NULLS FIRST, al.nombres, al.id_alumno
         LIMIT v_lim OFFSET v_off
      ) q;

    RETURN jsonb_build_object('generado_en', app.c1_iso(app.now()),
        'total', v_sin + v_lim_n, 'sin_derecho', v_sin, 'en_limite', v_lim_n, 'items', v_items);
END
$$;
COMMENT ON FUNCTION public.api_alertas_docente(integer, integer, integer) IS $c$Alertas de asistencia para el panel del docente (RF-14): alumnos activos sin derecho a examen (tipo sin_derecho) o a una falta equivalente de perderlo (tipo en_limite), primero los que ya no tienen derecho y luego por porcentaje descendente.
ARGS: p_id_grupo integer opcional; p_limit integer (def. 50, max 200); p_offset integer
RETURNS: {generado_en, total, sin_derecho, en_limite, items:[{tipo:"sin_derecho"|"en_limite", id_grupo, clave_grupo, periodo, materia_clave, materia_nombre, id_alumno, matricula, apellido_paterno, apellido_materno, nombres, nombre_completo, id_inscripcion, sesiones_programadas, presentes, retardos, ausencias, justificadas, pendientes, faltas_equivalentes, porcentaje_faltas, limite_pct, faltas_maximas_permitidas, faltas_restantes_antes_limite, supera_limite, en_limite, derecho_examen}]}
ERRORES: NO_AUTORIZADO (rol o grupo ajeno), NO_ENCONTRADO (grupo inexistente para el administrador)
ROLES: docente (solo sus grupos), administrador (todos)$c$;
REVOKE ALL ON FUNCTION public.api_alertas_docente(integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_alertas_docente(integer, integer, integer) TO authenticated;
