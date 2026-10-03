-- 0131 · RPC del docente para la sesion en vivo: panel P-02, apertura (RN-06) y monitor P-03.
--
-- Regla de apertura (documentada aqui y en el COMMENT):
--   la sesion solo se abre dentro de su horario: hora_inicio <= app.now() < hora_fin de su fecha, la
--   sesion debe estar 'programada' (abierta = idempotente; cerrada/suspendida = error) y solo la abre el
--   docente titular del grupo. Modo (RN-06): 'automatico' si el aula del grupo tiene al menos una camara
--   con estatus 'activa'; si no, 'manual'.

-- ---------------------------------------------------------------------------------------------
-- api_docente_panel · P-02. INVOKER: la RLS del docente decide que ve.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_docente_panel() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_hoy      date := app.hoy();
    v_ahora    timestamptz := app.now();
    v_doc      integer;
    v_sesiones jsonb;
    v_pend     integer;
    v_just     integer;
    v_alertas  jsonb := '[]'::jsonb;
    v_alt      jsonb;
    v_grupos   jsonb;
BEGIN
    PERFORM app.exigir_rol('docente');
    v_doc := app.id_docente();

    SELECT coalesce(jsonb_agg(jsonb_build_object(
               'id_sesion', s.id_sesion,
               'id_grupo', s.id_grupo,
               'materia', m.nombre,
               'clave_grupo', g.clave_grupo,
               'aula', a.clave,
               'fecha', s.fecha,
               'hora_inicio', s.hora_inicio,
               'hora_fin', s.hora_fin,
               'estatus', s.estatus,
               'modo_previsto', CASE WHEN s.estatus = 'programada'
                                     THEN CASE WHEN cam.n > 0 THEN 'automatico' ELSE 'manual' END
                                     ELSE s.modo_registro::text END,
               'camaras_activas', cam.n,
               'abrible', (s.estatus = 'programada'
                           AND v_ahora >= app.instante_clase(s.fecha, s.hora_inicio)
                           AND v_ahora < app.instante_clase(s.fecha, s.hora_fin))
           ) ORDER BY s.hora_inicio, s.id_sesion), '[]'::jsonb)
      INTO v_sesiones
      FROM public.sesion_clase s
      JOIN public.grupo g ON g.id_grupo = s.id_grupo
      JOIN public.materia m ON m.id_materia = g.id_materia
      JOIN public.aula a ON a.id_aula = g.id_aula
      CROSS JOIN LATERAL (SELECT count(*) FILTER (WHERE c.estatus = 'activa')::integer AS n
                            FROM public.camara c WHERE c.id_aula = g.id_aula) cam
     WHERE s.fecha = v_hoy AND g.id_docente = v_doc;

    -- Pendientes de revision: registros pendientes de sesiones ya cerradas (la cola P-05).
    SELECT count(*)::integer INTO v_pend
      FROM public.asistencia x
      JOIN public.sesion_clase s ON s.id_sesion = x.id_sesion
      JOIN public.grupo g ON g.id_grupo = s.id_grupo
     WHERE x.estado = 'pendiente' AND s.estatus = 'cerrada' AND g.id_docente = v_doc;

    SELECT count(*)::integer INTO v_just
      FROM public.justificante j
      JOIN public.sesion_clase s ON s.id_sesion = j.id_sesion
      JOIN public.grupo g ON g.id_grupo = s.id_grupo
     WHERE j.estatus = 'pendiente' AND g.id_docente = v_doc;

    -- Alertas (RF-14): si el dominio de reportes publica api_alertas_docente() se usa tal cual; si no,
    -- se consulta v_resumen_asistencia (sin derecho a examen y a una falta de perderlo).
    IF to_regprocedure('public.api_alertas_docente()') IS NOT NULL THEN
        EXECUTE 'SELECT public.api_alertas_docente()' INTO v_alt;
        v_alertas := CASE jsonb_typeof(v_alt)
                         WHEN 'array' THEN v_alt
                         WHEN 'object' THEN coalesce(v_alt -> 'items', jsonb_build_array(v_alt))
                         ELSE '[]'::jsonb END;
    ELSE
        SELECT coalesce(jsonb_agg(jsonb_build_object(
                   'tipo', CASE WHEN r.supera_limite THEN 'sin_derecho_examen' ELSE 'en_limite' END,
                   'id_grupo', r.id_grupo,
                   'clave_grupo', g.clave_grupo,
                   'materia', m.nombre,
                   'id_alumno', r.id_alumno,
                   'matricula', al.matricula,
                   'nombre', trim(al.apellido_paterno || coalesce(' ' || al.apellido_materno, '') || ' ' || al.nombres),
                   'faltas_equivalentes', r.faltas_equivalentes,
                   'sesiones_programadas', r.sesiones_programadas,
                   'porcentaje_faltas', r.porcentaje_faltas,
                   'limite_pct', r.limite_pct,
                   'faltas_restantes_antes_limite', r.faltas_restantes_antes_limite,
                   'mensaje', CASE WHEN r.supera_limite
                                   THEN 'Superó el límite de faltas equivalentes: sin derecho a examen.'
                                   ELSE 'Está a una falta equivalente de perder el derecho a examen.' END
               ) ORDER BY r.supera_limite DESC, g.clave_grupo, al.apellido_paterno, al.nombres), '[]'::jsonb)
          INTO v_alertas
          FROM public.v_resumen_asistencia r
          JOIN public.grupo g ON g.id_grupo = r.id_grupo
          JOIN public.materia m ON m.id_materia = g.id_materia
          JOIN public.alumno al ON al.id_alumno = r.id_alumno
         WHERE r.estatus_inscripcion = 'activa' AND g.id_docente = v_doc
           AND (r.supera_limite OR r.en_limite);
    END IF;

    -- Mis grupos: los del periodo mas reciente que tenga asignado el docente.
    SELECT coalesce(jsonb_agg(jsonb_build_object(
               'id_grupo', g.id_grupo,
               'materia', m.nombre,
               'clave_grupo', g.clave_grupo,
               'periodo', g.periodo,
               'aula', a.clave,
               'inscritos', (SELECT count(*) FROM public.inscripcion i
                              WHERE i.id_grupo = g.id_grupo AND i.estatus = 'activa')
           ) ORDER BY m.nombre, g.clave_grupo), '[]'::jsonb)
      INTO v_grupos
      FROM public.grupo g
      JOIN public.materia m ON m.id_materia = g.id_materia
      JOIN public.aula a ON a.id_aula = g.id_aula
     WHERE g.id_docente = v_doc
       AND g.periodo = (SELECT max(g2.periodo) FROM public.grupo g2 WHERE g2.id_docente = v_doc);

    RETURN jsonb_build_object(
        'fecha', v_hoy,
        'sesiones_hoy', v_sesiones,
        'pendientes', v_pend,
        'justificantes_por_resolver', v_just,
        'alertas', v_alertas,
        'grupos', v_grupos);
END
$$;
COMMENT ON FUNCTION public.api_docente_panel() IS $c$
Panel del docente (P-02): sesiones de hoy, pendientes, justificantes por resolver, alertas y grupos del periodo.
ARGS: (sin argumentos; la RLS limita todo a los grupos del docente)
RETURNS: {fecha, sesiones_hoy:[{id_sesion,id_grupo,materia,clave_grupo,aula,fecha,hora_inicio,hora_fin,estatus,modo_previsto,camaras_activas,abrible}], pendientes:2, justificantes_por_resolver:1, alertas:[{tipo:"sin_derecho_examen"|"en_limite",id_grupo,id_alumno,matricula,nombre,...}], grupos:[{id_grupo,materia,clave_grupo,periodo,aula,inscritos}]}. modo_previsto = modo real si la sesion ya abrio; si esta programada, automatico con al menos una camara activa en el aula y manual si no. pendientes = registros pendientes de sesiones cerradas. alertas usa api_alertas_docente() si existe; si no, v_resumen_asistencia. grupos = periodo mas reciente del docente.
ERRORES: NO_AUTENTICADO (sin sesion), CUENTA_INACTIVA, NO_AUTORIZADO (rol distinto de docente)
ROLES: docente
$c$;
REVOKE ALL ON FUNCTION public.api_docente_panel() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_docente_panel() TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- api_abrir_sesion · RN-06, RF-03, RF-09
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_abrir_sesion(p_id_sesion integer) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    s         public.sesion_clase%ROWTYPE;
    v_id_aula integer;
    v_activas integer;
    v_ahora   timestamptz := app.now();
    v_ya      boolean := false;
    v_camaras jsonb;
BEGIN
    PERFORM app.exigir_rol('docente');
    s := app.sesion_bloqueada(p_id_sesion, false);

    SELECT g.id_aula INTO v_id_aula FROM public.grupo g WHERE g.id_grupo = s.id_grupo;

    IF s.estatus = 'abierta' THEN
        v_ya := true;                       -- idempotente: no cambia modo ni vuelve a validar el horario
    ELSIF s.estatus = 'cerrada' THEN
        PERFORM app.fallar('SESION_CERRADA', 'La sesión ya fue cerrada; no puede abrirse de nuevo.');
    ELSIF s.estatus = 'suspendida' THEN
        PERFORM app.fallar('SESION_SUSPENDIDA', 'La sesión está suspendida; reanúdala antes de abrirla.');
    ELSE
        IF v_ahora < app.instante_clase(s.fecha, s.hora_inicio) OR v_ahora >= app.instante_clase(s.fecha, s.hora_fin) THEN
            PERFORM app.fallar('FUERA_DE_HORARIO',
                format('La sesión solo puede abrirse de %s a %s del %s (hora del plantel).',
                       to_char(s.hora_inicio, 'HH24:MI'), to_char(s.hora_fin, 'HH24:MI'), s.fecha));
        END IF;
        SELECT count(*)::integer INTO v_activas
          FROM public.camara c WHERE c.id_aula = v_id_aula AND c.estatus = 'activa';
        UPDATE public.sesion_clase
           SET estatus = 'abierta',
               modo_registro = CASE WHEN v_activas > 0 THEN 'automatico' ELSE 'manual' END::public.modo_registro_sesion
         WHERE id_sesion = s.id_sesion
         RETURNING * INTO s;
    END IF;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
               'id_camara', c.id_camara, 'posicion', c.posicion, 'tipo', c.tipo, 'estatus', c.estatus
           ) ORDER BY c.posicion), '[]'::jsonb)
      INTO v_camaras FROM public.camara c WHERE c.id_aula = v_id_aula;

    RETURN jsonb_build_object(
        'id_sesion', s.id_sesion,
        'id_grupo', s.id_grupo,
        'fecha', s.fecha,
        'hora_inicio', s.hora_inicio,
        'hora_fin', s.hora_fin,
        'estatus', s.estatus,
        'modo_registro', s.modo_registro,
        'ya_abierta', v_ya,
        'tolerancia_min', s.tolerancia_min,
        'limite_presente_min', s.limite_presente_min,
        'intervalo_muestreo_seg', s.intervalo_muestreo_seg,
        'camaras', v_camaras);
END
$$;
COMMENT ON FUNCTION public.api_abrir_sesion(integer) IS $c$
Abre la sesion de clase (programada -> abierta) y fija el modo de registro por las camaras del aula (RN-06).
ARGS: p_id_sesion integer. Solo dentro del horario (hora_inicio <= ahora < hora_fin de la fecha de la sesion, hora del plantel). Modo automatico si el aula tiene al menos una camara con estatus activa; si no, manual. Idempotente si ya esta abierta.
RETURNS: {id_sesion,id_grupo,fecha,hora_inicio,hora_fin,estatus:"abierta",modo_registro:"automatico"|"manual",ya_abierta,tolerancia_min,limite_presente_min,intervalo_muestreo_seg,camaras:[{id_camara,posicion,tipo,estatus}]}
ERRORES: NO_ENCONTRADO (sesion inexistente), NO_AUTORIZADO (rol o sesion de otro docente), FUERA_DE_HORARIO (fuera de hora_inicio..hora_fin), SESION_CERRADA, SESION_SUSPENDIDA
ROLES: docente (titular del grupo)
$c$;
REVOKE ALL ON FUNCTION public.api_abrir_sesion(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_abrir_sesion(integer) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- api_sesion_monitor · P-03. INVOKER: camaras, capturas y detecciones llegan por RLS del docente.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_sesion_monitor(p_id_sesion integer) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    s         public.sesion_clase%ROWTYPE;
    v_ahora   timestamptz := app.now();
    v_min     numeric;
    v_sesion  jsonb;
    v_camaras jsonb;
    v_alumnos jsonb;
    v_totales jsonb;
BEGIN
    PERFORM app.exigir_rol('docente');
    s := app.sesion_autorizada(p_id_sesion, false);
    v_min := app.minuto_de_sesion(s.fecha, s.hora_inicio, v_ahora);

    SELECT jsonb_build_object(
               'id_sesion', s.id_sesion,
               'id_grupo', s.id_grupo,
               'materia', m.nombre,
               'clave_grupo', g.clave_grupo,
               'periodo', g.periodo,
               'aula', a.clave,
               'fecha', s.fecha,
               'hora_inicio', s.hora_inicio,
               'hora_fin', s.hora_fin,
               'estatus', s.estatus,
               'modo_registro', s.modo_registro,
               'tolerancia_min', s.tolerancia_min,
               'limite_presente_min', s.limite_presente_min,
               'intervalo_muestreo_seg', s.intervalo_muestreo_seg,
               'minuto_actual', round(v_min, 2),
               'en_ventana', (s.estatus = 'abierta' AND v_min <= s.tolerancia_min),
               'fase', CASE WHEN s.estatus <> 'abierta' THEN s.estatus::text
                            WHEN v_min < s.limite_presente_min THEN 'presente'
                            WHEN v_min <= s.tolerancia_min THEN 'retardo'
                            ELSE 'fuera_de_ventana' END)
      INTO v_sesion
      FROM public.grupo g
      JOIN public.materia m ON m.id_materia = g.id_materia
      JOIN public.aula a ON a.id_aula = g.id_aula
     WHERE g.id_grupo = s.id_grupo;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
               'id_camara', c.id_camara,
               'posicion', c.posicion,
               'tipo', c.tipo,
               'estatus', c.estatus,
               'ultima_captura', x.ultima,
               'capturas', x.n
           ) ORDER BY c.posicion), '[]'::jsonb)
      INTO v_camaras
      FROM public.grupo g
      JOIN public.camara c ON c.id_aula = g.id_aula
      CROSS JOIN LATERAL (SELECT max(k.marca_tiempo) AS ultima, count(*)::integer AS n
                            FROM public.captura k
                           WHERE k.id_camara = c.id_camara AND k.id_sesion = s.id_sesion) x
     WHERE g.id_grupo = s.id_grupo;

    -- Inscritos activos y quien ya tenga registro (una baja posterior no borra su registro).
    WITH lect AS (
        SELECT pf.id_alumno,
               (count(DISTINCT c.id_captura) FILTER (WHERE d.es_valida))::integer AS lecturas,
               max(d.score_similitud) AS mejor
          FROM public.deteccion d
          JOIN public.captura c ON c.id_captura = d.id_captura AND c.id_sesion = s.id_sesion
          JOIN public.plantilla_facial pf ON pf.id_plantilla = d.id_plantilla
         GROUP BY pf.id_alumno
    ), base AS (
        SELECT al.id_alumno, al.matricula, al.apellido_paterno, al.apellido_materno, al.nombres, i.estatus AS estatus_inscripcion
          FROM public.inscripcion i
          JOIN public.alumno al ON al.id_alumno = i.id_alumno
         WHERE i.id_grupo = s.id_grupo
           AND (i.estatus = 'activa'
                OR EXISTS (SELECT 1 FROM public.asistencia x WHERE x.id_sesion = s.id_sesion AND x.id_alumno = al.id_alumno))
    )
    SELECT coalesce(jsonb_agg(jsonb_build_object(
               'id_alumno', b.id_alumno,
               'matricula', b.matricula,
               'nombre', trim(b.apellido_paterno || coalesce(' ' || b.apellido_materno, '') || ' ' || b.nombres),
               'inscripcion', b.estatus_inscripcion,
               'estado', a.estado,
               'origen', a.origen,
               'hora_registro', a.hora_registro,
               'conteo_detecciones', a.conteo_detecciones,
               'lecturas_validas', coalesce(l.lecturas, 0),
               'mejor_score', l.mejor,
               'consentimiento_vigente', app.tiene_consentimiento_vigente(b.id_alumno)
           ) ORDER BY b.apellido_paterno, b.apellido_materno NULLS FIRST, b.nombres, b.id_alumno), '[]'::jsonb)
      INTO v_alumnos
      FROM base b
      LEFT JOIN public.asistencia a ON a.id_sesion = s.id_sesion AND a.id_alumno = b.id_alumno
      LEFT JOIN lect l ON l.id_alumno = b.id_alumno;

    SELECT jsonb_build_object(
               'inscritos', (SELECT count(*) FROM public.inscripcion i WHERE i.id_grupo = s.id_grupo AND i.estatus = 'activa'),
               'presentes', count(*) FILTER (WHERE a.estado = 'presente'),
               'retardos', count(*) FILTER (WHERE a.estado = 'retardo'),
               'ausentes', count(*) FILTER (WHERE a.estado = 'ausente'),
               'pendientes', count(*) FILTER (WHERE a.estado = 'pendiente'),
               'justificados', count(*) FILTER (WHERE a.estado = 'justificado'),
               'registrados', count(*),
               'sin_registro', (SELECT count(*) FROM public.inscripcion i
                                 WHERE i.id_grupo = s.id_grupo AND i.estatus = 'activa'
                                   AND NOT EXISTS (SELECT 1 FROM public.asistencia z
                                                    WHERE z.id_sesion = s.id_sesion AND z.id_alumno = i.id_alumno)),
               'manuales', count(*) FILTER (WHERE a.origen = 'manual'),
               'capturas', (SELECT count(*) FROM public.captura k WHERE k.id_sesion = s.id_sesion),
               'detecciones', (SELECT count(*) FROM public.deteccion d JOIN public.captura k ON k.id_captura = d.id_captura
                                WHERE k.id_sesion = s.id_sesion),
               'detecciones_validas', (SELECT count(*) FROM public.deteccion d JOIN public.captura k ON k.id_captura = d.id_captura
                                        WHERE k.id_sesion = s.id_sesion AND d.es_valida))
      INTO v_totales
      FROM public.asistencia a WHERE a.id_sesion = s.id_sesion;

    RETURN jsonb_build_object('sesion', v_sesion, 'camaras', v_camaras, 'alumnos', v_alumnos, 'totales', v_totales);
END
$$;
COMMENT ON FUNCTION public.api_sesion_monitor(integer) IS $c$
Monitor en vivo de la sesion (P-03/P-04): sesion con minuto actual, camaras, estado de cada alumno y totales.
ARGS: p_id_sesion integer. lecturas_validas = capturas DISTINTAS con deteccion valida del alumno; mejor_score = mayor score entre sus detecciones (aunque no alcance el umbral). Lista los inscritos activos y a quien ya tenga registro.
RETURNS: {sesion:{id_sesion,...,estatus,modo_registro,minuto_actual:9.5,en_ventana:true,fase:"presente"|"retardo"|"fuera_de_ventana"|<estatus>}, camaras:[{id_camara,posicion,tipo,estatus,ultima_captura,capturas}], alumnos:[{id_alumno,matricula,nombre,inscripcion,estado:null|"pendiente"|...,origen,hora_registro,conteo_detecciones,lecturas_validas,mejor_score,consentimiento_vigente}], totales:{inscritos,presentes,retardos,ausentes,pendientes,justificados,registrados,sin_registro,manuales,capturas,detecciones,detecciones_validas}}
ERRORES: NO_AUTENTICADO, NO_AUTORIZADO (rol o sesion de otro docente), NO_ENCONTRADO
ROLES: docente (titular del grupo)
$c$;
REVOKE ALL ON FUNCTION public.api_sesion_monitor(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_sesion_monitor(integer) TO authenticated;
