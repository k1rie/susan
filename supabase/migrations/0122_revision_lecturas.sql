-- 0122 · Revision: lecturas SECURITY INVOKER STABLE (docs/api/revision.md 3.1 y 3.6-3.10).
--   api_cola_revision · api_mis_justificantes · api_mis_justificables · api_detecciones_caso ·
--   api_justificante_documento · api_sesiones_corregibles · api_registros_corregibles
-- La RLS del usuario aplica; ademas se repite la pertenencia (g.id_docente = app.id_docente()) como defensa.
-- Ninguna devuelve rutas objeto_* salvo api_detecciones_caso y api_justificante_documento, cuyo
-- unico consumidor es un Route Handler que firma la URL, asienta la consulta y no reenvia la ruta.

-- Lecturas (detecciones) del alumno en una sesion: solo las atribuidas a una plantilla suya.
-- Hasta p_max por caso: es_valida DESC, score DESC, marca_tiempo. Nunca devuelve rutas.
CREATE OR REPLACE FUNCTION app.c1_lecturas_caso(p_id_alumno integer, p_id_sesion integer, p_max integer DEFAULT 10) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
    WITH ini AS (
        SELECT app.instante_clase(s.fecha, s.hora_inicio) AS t0 FROM public.sesion_clase s WHERE s.id_sesion = p_id_sesion
    ), l AS (
        SELECT d.id_deteccion, d.id_captura, c.marca_tiempo, cam.posicion, d.score_similitud, d.es_valida,
               (d.objeto_recorte IS NOT NULL) AS tiene_recorte,
               round(extract(epoch FROM c.marca_tiempo - (SELECT t0 FROM ini)) / 60, 2) AS minuto
          FROM public.deteccion d
          JOIN public.captura c ON c.id_captura = d.id_captura
          JOIN public.plantilla_facial pf ON pf.id_plantilla = d.id_plantilla
          LEFT JOIN public.camara cam ON cam.id_camara = c.id_camara
         WHERE c.id_sesion = p_id_sesion AND pf.id_alumno = p_id_alumno
    )
    SELECT jsonb_build_object(
        'lecturas_validas', (SELECT count(*) FILTER (WHERE es_valida) FROM l),
        'total_lecturas', (SELECT count(*) FROM l),
        'mejor_score', (SELECT max(score_similitud) FROM l),
        'lecturas', coalesce((SELECT jsonb_agg(jsonb_build_object(
                'id_deteccion', x.id_deteccion, 'id_captura', x.id_captura,
                'marca_tiempo', app.c1_iso(x.marca_tiempo), 'minuto_sesion', x.minuto,
                'camara_posicion', x.posicion, 'score_similitud', x.score_similitud,
                'es_valida', x.es_valida, 'tiene_recorte', x.tiene_recorte)
                ORDER BY x.es_valida DESC, x.score_similitud DESC, x.marca_tiempo, x.id_deteccion)
              FROM (SELECT * FROM l ORDER BY es_valida DESC, score_similitud DESC, marca_tiempo, id_deteccion
                     LIMIT greatest(coalesce(p_max, 10), 0)) x), '[]'::jsonb))
$$;
COMMENT ON FUNCTION app.c1_lecturas_caso(integer, integer, integer) IS
    'Lecturas del alumno en la sesion (validas primero, por score) sin rutas objeto_*, con contadores totales. INVOKER: aplica la RLS.';
GRANT EXECUTE ON FUNCTION app.c1_lecturas_caso(integer, integer, integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 3.1 api_cola_revision (RF-18)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_cola_revision(
    p_pestana text    DEFAULT NULL,
    p_limit   integer DEFAULT 50,
    p_offset  integer DEFAULT 0
) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol    text := app.exigir_rol('docente');
    v_doc    integer := app.id_docente();
    v_lim    integer := app.c1_limite(p_limit);
    v_off    integer := app.c1_desplazamiento(p_offset);
    v_pend   jsonb := '[]'::jsonb;
    v_just   jsonb := '[]'::jsonb;
    v_corr   jsonb;
    v_n_pend bigint;
    v_n_just bigint;
BEGIN
    IF p_pestana IS NOT NULL AND p_pestana NOT IN ('pendientes', 'justificantes', 'correcciones') THEN
        PERFORM app.fallar('VALIDACION', 'Pestaña no válida: use pendientes, justificantes o correcciones.');
    END IF;

    SELECT count(*) INTO v_n_pend
      FROM public.asistencia a
      JOIN public.sesion_clase s ON s.id_sesion = a.id_sesion AND s.estatus = 'cerrada'
      JOIN public.grupo g ON g.id_grupo = s.id_grupo
     WHERE a.estado = 'pendiente' AND g.id_docente = v_doc;
    SELECT count(*) INTO v_n_just
      FROM public.justificante j
      JOIN public.sesion_clase s ON s.id_sesion = j.id_sesion
      JOIN public.grupo g ON g.id_grupo = s.id_grupo
     WHERE j.estatus = 'pendiente' AND g.id_docente = v_doc;
    v_corr := app.correcciones_recientes(v_lim, v_off);

    IF p_pestana IS NULL OR p_pestana = 'pendientes' THEN
        SELECT coalesce(jsonb_agg(q.item ORDER BY q.vence, q.id_asistencia), '[]'::jsonb) INTO v_pend
          FROM (
            SELECT a.id_asistencia, app.limite_correccion(s.fecha, s.hora_fin) AS vence,
                   jsonb_build_object(
                     'id_asistencia', a.id_asistencia,
                     'estado', a.estado,
                     'origen', a.origen,
                     'hora_registro', app.c1_iso(a.hora_registro),
                     'conteo_detecciones', a.conteo_detecciones,
                     'alumno', app.c1_alumno_json(al.id_alumno, al.matricula, al.apellido_paterno, al.apellido_materno, al.nombres),
                     'materia', app.c1_materia_json(m.id_materia, m.clave, m.nombre),
                     'grupo', app.c1_grupo_json(g.id_grupo, g.clave_grupo, g.periodo),
                     'sesion', app.c1_sesion_json(s),
                     'vence_en', app.c1_iso(app.limite_correccion(s.fecha, s.hora_fin)),
                     'segundos_restantes', floor(extract(epoch FROM app.limite_correccion(s.fecha, s.hora_fin) - app.now()))::integer,
                     'vencido', app.now() > app.limite_correccion(s.fecha, s.hora_fin),
                     'estado_sugerido', app.estado_sugerido_revision(a.hora_registro, s.fecha, s.hora_inicio, s.limite_presente_min)
                   ) || app.c1_lecturas_caso(a.id_alumno, a.id_sesion, 10) AS item
              FROM public.asistencia a
              JOIN public.sesion_clase s ON s.id_sesion = a.id_sesion AND s.estatus = 'cerrada'
              JOIN public.grupo g ON g.id_grupo = s.id_grupo
              JOIN public.materia m ON m.id_materia = g.id_materia
              JOIN public.alumno al ON al.id_alumno = a.id_alumno
             WHERE a.estado = 'pendiente' AND g.id_docente = v_doc
             ORDER BY app.limite_correccion(s.fecha, s.hora_fin), a.id_asistencia
             LIMIT v_lim OFFSET v_off
          ) q;
    END IF;

    IF p_pestana IS NULL OR p_pestana = 'justificantes' THEN
        SELECT coalesce(jsonb_agg(q.item ORDER BY q.fecha_registro, q.id_justificante), '[]'::jsonb) INTO v_just
          FROM (
            SELECT j.id_justificante, j.fecha_registro,
                   jsonb_build_object(
                     'id_justificante', j.id_justificante,
                     'id_asistencia', a.id_asistencia,
                     'estado_asistencia', a.estado,
                     'motivo', j.motivo,
                     'fecha_registro', app.c1_iso(j.fecha_registro),
                     'registrado_por_rol', app.rol_de_usuario(j.registrado_por),
                     'alumno', app.c1_alumno_json(al.id_alumno, al.matricula, al.apellido_paterno, al.apellido_materno, al.nombres),
                     'materia', app.c1_materia_json(m.id_materia, m.clave, m.nombre),
                     'grupo', app.c1_grupo_json(g.id_grupo, g.clave_grupo, g.periodo),
                     'sesion', app.c1_sesion_json(s)
                   ) || app.c1_lecturas_caso(j.id_alumno, j.id_sesion, 10) AS item
              FROM public.justificante j
              JOIN public.asistencia a ON a.id_sesion = j.id_sesion AND a.id_alumno = j.id_alumno
              JOIN public.sesion_clase s ON s.id_sesion = j.id_sesion
              JOIN public.grupo g ON g.id_grupo = s.id_grupo
              JOIN public.materia m ON m.id_materia = g.id_materia
              JOIN public.alumno al ON al.id_alumno = j.id_alumno
             WHERE j.estatus = 'pendiente' AND g.id_docente = v_doc
             ORDER BY j.fecha_registro, j.id_justificante
             LIMIT v_lim OFFSET v_off
          ) q;
    END IF;

    RETURN jsonb_build_object(
        'generado_en', app.c1_iso(app.now()),
        'horas_limite_correccion', app.param_num('horas_limite_correccion')::integer,
        'min_detecciones_validas', app.param_num('min_detecciones_validas')::integer,
        'contadores', jsonb_build_object('pendientes', v_n_pend, 'justificantes', v_n_just,
                                         'correcciones_recientes', (v_corr ->> 'total')::bigint),
        'pendientes', v_pend,
        'justificantes', v_just,
        'correcciones_recientes', CASE WHEN p_pestana IS NULL OR p_pestana = 'correcciones'
                                       THEN v_corr -> 'items' ELSE '[]'::jsonb END);
END
$$;
COMMENT ON FUNCTION public.api_cola_revision(text, integer, integer) IS $c$Cola de revision del docente (RF-18): pendientes de sesiones cerradas, justificantes por resolver y correcciones de los ultimos 30 dias, con lecturas (sin rutas), plazo restante y estado sugerido (RN-03).
ARGS: p_pestana text (NULL = las tres listas; pendientes|justificantes|correcciones); p_limit integer (def. 50, max 200, por lista); p_offset integer
RETURNS: {generado_en, horas_limite_correccion, min_detecciones_validas, contadores:{pendientes, justificantes, correcciones_recientes}, pendientes:[{id_asistencia, estado, origen, hora_registro, conteo_detecciones, alumno, materia, grupo, sesion, vence_en, segundos_restantes, vencido, estado_sugerido, lecturas_validas, total_lecturas, mejor_score, lecturas:[{id_deteccion, id_captura, marca_tiempo, minuto_sesion, camara_posicion, score_similitud, es_valida, tiene_recorte}]}], justificantes:[...], correcciones_recientes:[...]}
ERRORES: NO_AUTORIZADO (no es docente), VALIDACION (pestana)
ROLES: docente (solo sus grupos)$c$;
REVOKE ALL ON FUNCTION public.api_cola_revision(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_cola_revision(text, integer, integer) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3.6 api_mis_justificantes / api_mis_justificables (RF-12, RF-21)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_mis_justificantes(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol   text := app.exigir_rol('alumno');
    v_alu   integer := app.id_alumno();
    v_lim   integer := app.c1_limite(p_limit);
    v_off   integer := app.c1_desplazamiento(p_offset);
    v_total bigint;
    v_items jsonb;
BEGIN
    SELECT count(*) INTO v_total FROM public.justificante j WHERE j.id_alumno = v_alu;
    SELECT coalesce(jsonb_agg(q.item ORDER BY q.fecha_registro DESC, q.id_justificante DESC), '[]'::jsonb) INTO v_items
      FROM (
        SELECT j.id_justificante, j.fecha_registro,
               jsonb_build_object(
                 'id_justificante', j.id_justificante,
                 'estatus', j.estatus,
                 'motivo', j.motivo,
                 'fecha_registro', app.c1_iso(j.fecha_registro),
                 'fecha_resolucion', app.c1_iso(j.fecha_resolucion),
                 'registrado_por_rol', app.rol_de_usuario(j.registrado_por),
                 'id_sesion', j.id_sesion,
                 'id_asistencia', a.id_asistencia,
                 'estado_asistencia', a.estado,
                 'fecha', s.fecha,
                 'hora_inicio', s.hora_inicio,
                 'materia', app.c1_materia_json(m.id_materia, m.clave, m.nombre),
                 'grupo', app.c1_grupo_json(g.id_grupo, g.clave_grupo, g.periodo)) AS item
          FROM public.justificante j
          JOIN public.asistencia a ON a.id_sesion = j.id_sesion AND a.id_alumno = j.id_alumno
          JOIN public.sesion_clase s ON s.id_sesion = j.id_sesion
          JOIN public.grupo g ON g.id_grupo = s.id_grupo
          JOIN public.materia m ON m.id_materia = g.id_materia
         WHERE j.id_alumno = v_alu
         ORDER BY j.fecha_registro DESC, j.id_justificante DESC
         LIMIT v_lim OFFSET v_off
      ) q;
    RETURN jsonb_build_object('total', v_total, 'items', v_items);
END
$$;
COMMENT ON FUNCTION public.api_mis_justificantes(integer, integer) IS $c$Justificantes propios del alumno con su estatus, sin documento ni comentarios del docente.
ARGS: p_limit integer (def. 50, max 200); p_offset integer
RETURNS: {total, items:[{id_justificante, estatus, motivo, fecha_registro, fecha_resolucion, registrado_por_rol, id_sesion, id_asistencia, estado_asistencia, fecha, hora_inicio, materia, grupo}]}
ERRORES: NO_AUTORIZADO (no es alumno)
ROLES: alumno (solo propios)$c$;
REVOKE ALL ON FUNCTION public.api_mis_justificantes(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_mis_justificantes(integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.api_mis_justificables(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol   text := app.exigir_rol('alumno');
    v_alu   integer := app.id_alumno();
    v_lim   integer := app.c1_limite(p_limit);
    v_off   integer := app.c1_desplazamiento(p_offset);
    v_total bigint;
    v_items jsonb;
BEGIN
    SELECT count(*) INTO v_total
      FROM public.asistencia a
      JOIN public.sesion_clase s ON s.id_sesion = a.id_sesion AND s.estatus = 'cerrada'
     WHERE a.id_alumno = v_alu AND a.estado IN ('ausente', 'retardo')
       AND NOT EXISTS (SELECT 1 FROM public.justificante j
                        WHERE j.id_sesion = a.id_sesion AND j.id_alumno = a.id_alumno AND j.estatus = 'pendiente');
    SELECT coalesce(jsonb_agg(q.item ORDER BY q.fecha DESC, q.hora_inicio DESC, q.id_asistencia DESC), '[]'::jsonb) INTO v_items
      FROM (
        SELECT a.id_asistencia, s.fecha, s.hora_inicio,
               jsonb_build_object(
                 'id_asistencia', a.id_asistencia,
                 'id_sesion', a.id_sesion,
                 'estado', a.estado,
                 'origen', a.origen,
                 'fecha', s.fecha,
                 'hora_inicio', s.hora_inicio,
                 'hora_fin', s.hora_fin,
                 'materia', app.c1_materia_json(m.id_materia, m.clave, m.nombre),
                 'grupo', app.c1_grupo_json(g.id_grupo, g.clave_grupo, g.periodo),
                 'tiene_rechazado', EXISTS (SELECT 1 FROM public.justificante j
                                             WHERE j.id_sesion = a.id_sesion AND j.id_alumno = a.id_alumno
                                               AND j.estatus = 'rechazado')) AS item
          FROM public.asistencia a
          JOIN public.sesion_clase s ON s.id_sesion = a.id_sesion AND s.estatus = 'cerrada'
          JOIN public.grupo g ON g.id_grupo = s.id_grupo
          JOIN public.materia m ON m.id_materia = g.id_materia
         WHERE a.id_alumno = v_alu AND a.estado IN ('ausente', 'retardo')
           AND NOT EXISTS (SELECT 1 FROM public.justificante j
                            WHERE j.id_sesion = a.id_sesion AND j.id_alumno = a.id_alumno AND j.estatus = 'pendiente')
         ORDER BY s.fecha DESC, s.hora_inicio DESC, a.id_asistencia DESC
         LIMIT v_lim OFFSET v_off
      ) q;
    RETURN jsonb_build_object('total', v_total, 'items', v_items);
END
$$;
COMMENT ON FUNCTION public.api_mis_justificables(integer, integer) IS $c$Faltas y retardos propios de sesiones cerradas que aun se pueden justificar (sin justificante pendiente).
ARGS: p_limit integer (def. 50, max 200); p_offset integer
RETURNS: {total, items:[{id_asistencia, id_sesion, estado, origen, fecha, hora_inicio, hora_fin, materia, grupo, tiene_rechazado}]}
ERRORES: NO_AUTORIZADO (no es alumno)
ROLES: alumno (solo propios)$c$;
REVOKE ALL ON FUNCTION public.api_mis_justificables(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_mis_justificables(integer, integer) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3.7 api_detecciones_caso (RF-18, RF-19, RNF-04, RNF-05). No escribe bitacora: el Route Handler
-- que la llama asienta la consulta con svc_registrar_consulta_revision antes de firmar URLs.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_detecciones_caso(
    p_id_asistencia integer,
    p_solo_validas  boolean DEFAULT false,
    p_limit         integer DEFAULT 50,
    p_offset        integer DEFAULT 0
) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol   text := app.exigir_rol('docente');
    v_doc   integer := app.id_docente();
    v_lim   integer := app.c1_limite(p_limit, 50, 100);
    v_off   integer := app.c1_desplazamiento(p_offset);
    a       public.asistencia%ROWTYPE;
    s       public.sesion_clase%ROWTYPE;
    al      public.alumno%ROWTYPE;
    v_foto  text;
    v_total bigint;
    v_items jsonb;
BEGIN
    SELECT a2.* INTO a FROM public.asistencia a2 WHERE a2.id_asistencia = p_id_asistencia;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El caso no existe o no pertenece a tus grupos.');
    END IF;
    SELECT s2.* INTO s FROM public.sesion_clase s2
      JOIN public.grupo g ON g.id_grupo = s2.id_grupo
     WHERE s2.id_sesion = a.id_sesion AND g.id_docente = v_doc;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El caso no existe o no pertenece a tus grupos.');
    END IF;
    SELECT al2.* INTO al FROM public.alumno al2 WHERE al2.id_alumno = a.id_alumno;
    SELECT pf.objeto_foto INTO v_foto FROM public.plantilla_facial pf WHERE pf.id_alumno = a.id_alumno AND pf.activa;

    SELECT count(*) INTO v_total
      FROM public.deteccion d
      JOIN public.captura c ON c.id_captura = d.id_captura
      JOIN public.plantilla_facial pf ON pf.id_plantilla = d.id_plantilla
     WHERE c.id_sesion = a.id_sesion AND pf.id_alumno = a.id_alumno AND (NOT coalesce(p_solo_validas, false) OR d.es_valida);

    SELECT coalesce(jsonb_agg(x.item ORDER BY x.es_valida DESC, x.marca_tiempo, x.id_deteccion), '[]'::jsonb) INTO v_items
      FROM (
        SELECT d.id_deteccion, d.es_valida, c.marca_tiempo,
               jsonb_build_object(
                 'id_deteccion', d.id_deteccion,
                 'id_captura', d.id_captura,
                 'marca_tiempo', app.c1_iso(c.marca_tiempo),
                 'minuto_sesion', round(extract(epoch FROM c.marca_tiempo - app.instante_clase(s.fecha, s.hora_inicio)) / 60, 2),
                 'camara_posicion', cam.posicion,
                 'score_similitud', d.score_similitud,
                 'es_valida', d.es_valida,
                 'tiene_recorte', d.objeto_recorte IS NOT NULL,
                 'objeto_recorte', d.objeto_recorte) AS item
          FROM public.deteccion d
          JOIN public.captura c ON c.id_captura = d.id_captura
          JOIN public.plantilla_facial pf ON pf.id_plantilla = d.id_plantilla
          LEFT JOIN public.camara cam ON cam.id_camara = c.id_camara
         WHERE c.id_sesion = a.id_sesion AND pf.id_alumno = a.id_alumno AND (NOT coalesce(p_solo_validas, false) OR d.es_valida)
         ORDER BY d.es_valida DESC, c.marca_tiempo, d.id_deteccion
         LIMIT v_lim OFFSET v_off
      ) x;

    RETURN jsonb_build_object(
        'id_usuario', app.id_usuario(),
        'vigencia_url_firmada_seg', least(app.param_num('vigencia_url_firmada_seg'), 300)::integer,
        'asistencia', jsonb_build_object('id_asistencia', a.id_asistencia, 'id_sesion', a.id_sesion, 'estado', a.estado,
            'origen', a.origen, 'hora_registro', app.c1_iso(a.hora_registro), 'conteo_detecciones', a.conteo_detecciones),
        'alumno', app.c1_alumno_json(al.id_alumno, al.matricula, al.apellido_paterno, al.apellido_materno, al.nombres),
        'sesion', app.c1_sesion_json(s),
        'objeto_foto_registro', v_foto,
        'total', v_total,
        'lecturas', v_items);
END
$$;
COMMENT ON FUNCTION public.api_detecciones_caso(integer, boolean, integer, integer) IS $c$Lecturas de un caso (detecciones atribuidas al alumno en la sesion) con rutas de recortes y foto de registro: SOLO para el Route Handler, que debe asentar la consulta (svc_registrar_consulta_revision) antes de firmar URLs de 300 s como maximo.
ARGS: p_id_asistencia integer; p_solo_validas boolean (def. false); p_limit integer (def. 50, max 100); p_offset integer
RETURNS: {id_usuario, vigencia_url_firmada_seg, asistencia, alumno, sesion, objeto_foto_registro, total, lecturas:[{id_deteccion, id_captura, marca_tiempo, minuto_sesion, camara_posicion, score_similitud, es_valida, tiene_recorte, objeto_recorte}]}
ERRORES: NO_AUTORIZADO (no es docente), NO_ENCONTRADO (inexistente o de grupo ajeno)
ROLES: docente titular (via Route Handler)$c$;
REVOKE ALL ON FUNCTION public.api_detecciones_caso(integer, boolean, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_detecciones_caso(integer, boolean, integer, integer) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3.8 api_justificante_documento (RF-12, RNF-04)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_justificante_documento(p_id_justificante integer) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol text := app.exigir_rol('docente');
    j     public.justificante%ROWTYPE;
    v_id_asist integer;
BEGIN
    SELECT j2.* INTO j FROM public.justificante j2
      JOIN public.sesion_clase s ON s.id_sesion = j2.id_sesion
      JOIN public.grupo g ON g.id_grupo = s.id_grupo
     WHERE j2.id_justificante = p_id_justificante AND g.id_docente = app.id_docente();
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El justificante no existe o no pertenece a tus grupos.');
    END IF;
    SELECT a.id_asistencia INTO v_id_asist FROM public.asistencia a WHERE a.id_sesion = j.id_sesion AND a.id_alumno = j.id_alumno;
    RETURN jsonb_build_object(
        'id_usuario', app.id_usuario(),
        'vigencia_url_firmada_seg', least(app.param_num('vigencia_url_firmada_seg'), 300)::integer,
        'id_justificante', j.id_justificante,
        'id_alumno', j.id_alumno,
        'id_asistencia', v_id_asist,
        'estatus', j.estatus,
        'objeto_documento', j.objeto_documento);
END
$$;
COMMENT ON FUNCTION public.api_justificante_documento(integer) IS $c$Ruta del documento de un justificante de un grupo propio: SOLO para el Route Handler, que asienta la consulta y firma una URL de 300 s como maximo.
ARGS: p_id_justificante integer
RETURNS: {id_usuario, vigencia_url_firmada_seg, id_justificante, id_alumno, id_asistencia, estatus, objeto_documento}
ERRORES: NO_AUTORIZADO (no es docente), NO_ENCONTRADO (inexistente o de grupo ajeno)
ROLES: docente titular (via Route Handler)$c$;
REVOKE ALL ON FUNCTION public.api_justificante_documento(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_justificante_documento(integer) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3.9 api_sesiones_corregibles / 3.10 api_registros_corregibles (inicio "Registro por corregir")
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_sesiones_corregibles(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol   text := app.exigir_rol('docente');
    v_doc   integer := app.id_docente();
    v_lim   integer := app.c1_limite(p_limit);
    v_off   integer := app.c1_desplazamiento(p_offset);
    v_total bigint;
    v_items jsonb;
BEGIN
    SELECT count(*) INTO v_total
      FROM public.sesion_clase s JOIN public.grupo g ON g.id_grupo = s.id_grupo
     WHERE s.estatus = 'cerrada' AND g.id_docente = v_doc AND app.now() <= app.limite_correccion(s.fecha, s.hora_fin);
    SELECT coalesce(jsonb_agg(q.item ORDER BY q.fecha DESC, q.hora_inicio DESC, q.id_sesion DESC), '[]'::jsonb) INTO v_items
      FROM (
        SELECT s.id_sesion, s.fecha, s.hora_inicio,
               jsonb_build_object(
                 'id_sesion', s.id_sesion, 'fecha', s.fecha, 'hora_inicio', s.hora_inicio, 'hora_fin', s.hora_fin,
                 'modo_registro', s.modo_registro,
                 'grupo', app.c1_grupo_json(g.id_grupo, g.clave_grupo, g.periodo),
                 'materia', app.c1_materia_json(m.id_materia, m.clave, m.nombre),
                 'vence_en', app.c1_iso(app.limite_correccion(s.fecha, s.hora_fin)),
                 'segundos_restantes', floor(extract(epoch FROM app.limite_correccion(s.fecha, s.hora_fin) - app.now()))::integer,
                 'total_registros', (SELECT count(*) FROM public.asistencia a WHERE a.id_sesion = s.id_sesion),
                 'total_pendientes', (SELECT count(*) FROM public.asistencia a WHERE a.id_sesion = s.id_sesion AND a.estado = 'pendiente')
               ) AS item
          FROM public.sesion_clase s
          JOIN public.grupo g ON g.id_grupo = s.id_grupo
          JOIN public.materia m ON m.id_materia = g.id_materia
         WHERE s.estatus = 'cerrada' AND g.id_docente = v_doc AND app.now() <= app.limite_correccion(s.fecha, s.hora_fin)
         ORDER BY s.fecha DESC, s.hora_inicio DESC, s.id_sesion DESC
         LIMIT v_lim OFFSET v_off
      ) q;
    RETURN jsonb_build_object('total', v_total, 'items', v_items);
END
$$;
COMMENT ON FUNCTION public.api_sesiones_corregibles(integer, integer) IS $c$Sesiones cerradas de los grupos del docente cuyo plazo de correccion (RN-08) sigue abierto.
ARGS: p_limit integer (def. 50, max 200); p_offset integer
RETURNS: {total, items:[{id_sesion, fecha, hora_inicio, hora_fin, modo_registro, grupo, materia, vence_en, segundos_restantes, total_registros, total_pendientes}]}
ERRORES: NO_AUTORIZADO (no es docente)
ROLES: docente (solo sus grupos)$c$;
REVOKE ALL ON FUNCTION public.api_sesiones_corregibles(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_sesiones_corregibles(integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.api_registros_corregibles(
    p_id_sesion integer,
    p_limit     integer DEFAULT 100,
    p_offset    integer DEFAULT 0
) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol    text := app.exigir_rol('docente');
    v_doc    integer := app.id_docente();
    v_lim    integer := app.c1_limite(p_limit, 100, 200);
    v_off    integer := app.c1_desplazamiento(p_offset);
    s        public.sesion_clase%ROWTYPE;
    v_vence  timestamptz;
    v_plazo  boolean;
    v_total  bigint;
    v_items  jsonb;
BEGIN
    SELECT s2.* INTO s FROM public.sesion_clase s2 JOIN public.grupo g ON g.id_grupo = s2.id_grupo
     WHERE s2.id_sesion = p_id_sesion AND g.id_docente = v_doc;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'La sesión no existe o no pertenece a tus grupos.');
    END IF;
    v_vence := app.limite_correccion(s.fecha, s.hora_fin);
    v_plazo := app.now() <= v_vence;

    SELECT count(*) INTO v_total FROM public.asistencia a WHERE a.id_sesion = s.id_sesion;
    SELECT coalesce(jsonb_agg(q.item ORDER BY q.ap, q.am NULLS LAST, q.nombres, q.id_asistencia), '[]'::jsonb) INTO v_items
      FROM (
        SELECT a.id_asistencia, al.apellido_paterno AS ap, al.apellido_materno AS am, al.nombres,
               jsonb_build_object(
                 'id_asistencia', a.id_asistencia,
                 'alumno', app.c1_alumno_json(al.id_alumno, al.matricula, al.apellido_paterno, al.apellido_materno, al.nombres),
                 'estado', a.estado,
                 'origen', a.origen,
                 'hora_registro', app.c1_iso(a.hora_registro),
                 'conteo_detecciones', a.conteo_detecciones,
                 'justificante_pendiente', EXISTS (SELECT 1 FROM public.justificante j
                     WHERE j.id_sesion = a.id_sesion AND j.id_alumno = a.id_alumno AND j.estatus = 'pendiente'),
                 'corregible', (v_plazo AND a.estado <> 'justificado' AND s.estatus = 'cerrada')) AS item
          FROM public.asistencia a
          JOIN public.alumno al ON al.id_alumno = a.id_alumno
         WHERE a.id_sesion = s.id_sesion
         ORDER BY al.apellido_paterno, al.apellido_materno NULLS LAST, al.nombres, a.id_asistencia
         LIMIT v_lim OFFSET v_off
      ) q;

    RETURN jsonb_build_object(
        'sesion', app.c1_sesion_json(s),
        'vence_en', app.c1_iso(v_vence),
        'segundos_restantes', floor(extract(epoch FROM v_vence - app.now()))::integer,
        'dentro_de_plazo', v_plazo,
        'total', v_total,
        'items', v_items);
END
$$;
COMMENT ON FUNCTION public.api_registros_corregibles(integer, integer, integer) IS $c$Registros de asistencia de una sesion propia con su plazo de correccion y si cada uno es corregible.
ARGS: p_id_sesion integer; p_limit integer (def. 100, max 200); p_offset integer
RETURNS: {sesion, vence_en, segundos_restantes, dentro_de_plazo, total, items:[{id_asistencia, alumno, estado, origen, hora_registro, conteo_detecciones, justificante_pendiente, corregible}]}
ERRORES: NO_AUTORIZADO (no es docente), NO_ENCONTRADO (sesion inexistente o ajena)
ROLES: docente titular$c$;
REVOKE ALL ON FUNCTION public.api_registros_corregibles(integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_registros_corregibles(integer, integer, integer) TO authenticated;
