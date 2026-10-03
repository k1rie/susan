-- 0133 · Cierre de sesion (RF-10, RN-07), suspension y reanudacion (extension documentada, DECISIONS.md).
--
-- Cierre (app.cerrar_sesion), mismo efecto lo dispare el docente o el programador de tareas:
--   1. Consolida: fija conteo_detecciones con las lecturas validas (capturas distintas) de cada registro
--      automatico (nunca lo baja) y confirma como presente/retardo (por la PRIMERA lectura) a quien ya
--      llego a min_detecciones_validas. Los pendientes con 1-2 lecturas se quedan pendientes (cola P-05).
--   2. Crea 'ausente' (sin hora_registro; origen = modo de la sesion) para cada inscrito ACTIVO sin registro.
--      Una inscripcion en baja no genera registro (RN-01).
--   3. estatus = 'cerrada' + bitacora 'cierre_sesion' (usuario: el docente; o la cuenta de servicio si lo
--      cierra el programador, p_por_docente = false) + app.recalcular_grupo (RN-10, RN-11).
-- Adelantar el cierre (p_por_docente = true) solo cuando termino la ventana de tolerancia (o la hora de fin,
-- lo que ocurra primero). Idempotente: una sesion cerrada devuelve su resumen sin efectos.

CREATE OR REPLACE FUNCTION app.cerrar_sesion(p_id_sesion integer, p_por_docente boolean) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    s            public.sesion_clase%ROWTYPE;
    v_docente    boolean := coalesce(p_por_docente, false);
    v_ahora      timestamptz := app.now();
    v_min_det    numeric;
    v_creados    integer;
    v_confirmados integer;
    v_cierre_ant timestamptz;
    v_resumen    jsonb;
    v_pend       integer;
BEGIN
    -- La bitacora queda a nombre de la cuenta de servicio cuando cierra el programador.
    IF NOT v_docente THEN
        PERFORM app.asumir_cuenta_servicio();
    END IF;

    SELECT * INTO s FROM public.sesion_clase x WHERE x.id_sesion = p_id_sesion FOR NO KEY UPDATE;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'La sesión de clase no existe.');
    END IF;

    IF s.estatus = 'cerrada' THEN
        SELECT jsonb_build_object(
                   'id_sesion', s.id_sesion, 'estatus', 'cerrada', 'ya_cerrada', true,
                   'ausentes_creados', 0, 'confirmados', 0,
                   'pendientes', count(*) FILTER (WHERE a.estado = 'pendiente'),
                   'presentes', count(*) FILTER (WHERE a.estado = 'presente'),
                   'retardos', count(*) FILTER (WHERE a.estado = 'retardo'),
                   'ausentes', count(*) FILTER (WHERE a.estado = 'ausente'),
                   'justificados', count(*) FILTER (WHERE a.estado = 'justificado'),
                   'registros', count(*))
          INTO v_resumen FROM public.asistencia a WHERE a.id_sesion = s.id_sesion;
        RETURN v_resumen;
    ELSIF s.estatus = 'suspendida' THEN
        PERFORM app.fallar('SESION_SUSPENDIDA', 'La sesión está suspendida; no se cierra.');
    ELSIF s.estatus <> 'abierta' THEN
        PERFORM app.fallar('SESION_NO_ABIERTA', 'La sesión no se abrió; no hay nada que cerrar.');
    END IF;

    IF v_docente THEN
        v_cierre_ant := least(app.instante_clase(s.fecha, s.hora_inicio) + make_interval(mins => s.tolerancia_min),
                              app.instante_clase(s.fecha, s.hora_fin));
        IF v_ahora < v_cierre_ant THEN
            PERFORM app.fallar('VENTANA_TOLERANCIA_ABIERTA',
                format('Aún no termina la ventana de tolerancia (%s min); el cierre puede adelantarse a partir de las %s.',
                       s.tolerancia_min, to_char(v_cierre_ant AT TIME ZONE app.tz(), 'HH24:MI:SS')));
        END IF;
    END IF;

    v_min_det := app.param_num('min_detecciones_validas');

    -- 1. Consolidacion de lecturas (RN-02, RN-05)
    UPDATE public.asistencia a
       SET conteo_detecciones = l.n
      FROM (SELECT pf.id_alumno, count(DISTINCT c.id_captura)::integer AS n
              FROM public.deteccion d
              JOIN public.captura c ON c.id_captura = d.id_captura
              JOIN public.plantilla_facial pf ON pf.id_plantilla = d.id_plantilla
             WHERE c.id_sesion = s.id_sesion AND d.es_valida
             GROUP BY pf.id_alumno) l
     WHERE a.id_sesion = s.id_sesion AND a.id_alumno = l.id_alumno
       AND a.origen = 'automatico' AND a.estado IN ('pendiente', 'presente', 'retardo')
       AND a.conteo_detecciones < l.n;

    UPDATE public.asistencia a
       SET estado = coalesce(app.estado_por_minuto(s.limite_presente_min, s.tolerancia_min,
                                                   app.minuto_de_sesion(s.fecha, s.hora_inicio, a.hora_registro)),
                             'retardo'::public.estado_asistencia)
     WHERE a.id_sesion = s.id_sesion AND a.estado = 'pendiente' AND a.origen = 'automatico'
       AND a.conteo_detecciones >= v_min_det;
    GET DIAGNOSTICS v_confirmados = ROW_COUNT;

    -- 2. Ausentes de quien no tiene registro (RN-07), con el origen del modo de la sesion
    INSERT INTO public.asistencia (id_sesion, id_alumno, estado, hora_registro, origen, conteo_detecciones)
    SELECT s.id_sesion, i.id_alumno, 'ausente', NULL,
           CASE WHEN s.modo_registro = 'automatico' THEN 'automatico' ELSE 'manual' END::public.origen_asistencia, 0
      FROM public.inscripcion i
     WHERE i.id_grupo = s.id_grupo AND i.estatus = 'activa'
       AND NOT EXISTS (SELECT 1 FROM public.asistencia x WHERE x.id_sesion = s.id_sesion AND x.id_alumno = i.id_alumno)
     ORDER BY i.id_alumno;
    GET DIAGNOSTICS v_creados = ROW_COUNT;

    -- 3. Cierre, bitacora y recalculo
    UPDATE public.sesion_clase SET estatus = 'cerrada' WHERE id_sesion = s.id_sesion;

    SELECT jsonb_build_object(
               'id_sesion', s.id_sesion, 'estatus', 'cerrada', 'ya_cerrada', false,
               'modo_registro', s.modo_registro,
               'ausentes_creados', v_creados,
               'confirmados', v_confirmados,
               'pendientes', count(*) FILTER (WHERE a.estado = 'pendiente'),
               'presentes', count(*) FILTER (WHERE a.estado = 'presente'),
               'retardos', count(*) FILTER (WHERE a.estado = 'retardo'),
               'ausentes', count(*) FILTER (WHERE a.estado = 'ausente'),
               'justificados', count(*) FILTER (WHERE a.estado = 'justificado'),
               'registros', count(*),
               'cerrada_por', CASE WHEN v_docente THEN 'docente' ELSE 'servicio' END,
               'cerrada_en', v_ahora)
      INTO v_resumen FROM public.asistencia a WHERE a.id_sesion = s.id_sesion;
    v_pend := (v_resumen ->> 'pendientes')::integer;

    PERFORM app.bitacora('cierre_sesion', 'sesion_clase', s.id_sesion,
        jsonb_build_object('estatus', 'abierta'),
        jsonb_build_object('estatus', 'cerrada', 'modo_registro', s.modo_registro,
                           'ausentes_creados', v_creados, 'pendientes', v_pend,
                           'por_docente', v_docente));

    PERFORM app.recalcular_grupo(s.id_grupo);
    RETURN v_resumen;
END
$$;
COMMENT ON FUNCTION app.cerrar_sesion(integer, boolean) IS
    'RN-07/RF-10: consolida lecturas, crea ausente (origen del modo de la sesion) a cada inscrito activo sin registro, cierra, asienta cierre_sesion (docente o cuenta de servicio si p_por_docente = false) y recalcula el grupo. Idempotente. Con p_por_docente = true exige terminada la ventana de tolerancia.';
REVOKE ALL ON FUNCTION app.cerrar_sesion(integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.cerrar_sesion(integer, boolean) TO service_role;

-- ---------------------------------------------------------------------------------------------
-- api_cerrar_sesion
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_cerrar_sesion(p_id_sesion integer) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    s public.sesion_clase%ROWTYPE;
BEGIN
    PERFORM app.exigir_rol('docente');
    s := app.sesion_bloqueada(p_id_sesion, false);
    RETURN app.cerrar_sesion(s.id_sesion, true);
END
$$;
COMMENT ON FUNCTION public.api_cerrar_sesion(integer) IS $c$
Cierra la sesion de clase (RF-10, RN-07): ausente a los inscritos activos sin registro, pendientes a la cola, estatus cerrada, bitacora y recalculo de faltas.
ARGS: p_id_sesion integer. Adelantar el cierre solo cuando termino la ventana de tolerancia (hora_inicio + tolerancia_min de la sesion). Idempotente.
RETURNS: {id_sesion,estatus:"cerrada",ya_cerrada,modo_registro,ausentes_creados,confirmados,pendientes,presentes,retardos,ausentes,justificados,registros,cerrada_por:"docente",cerrada_en}
ERRORES: NO_AUTORIZADO (rol o sesion de otro docente), NO_ENCONTRADO, VENTANA_TOLERANCIA_ABIERTA (cierre antes de terminar la tolerancia), SESION_NO_ABIERTA (programada), SESION_SUSPENDIDA
ROLES: docente (titular del grupo)
$c$;
REVOKE ALL ON FUNCTION public.api_cerrar_sesion(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_cerrar_sesion(integer) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- Suspension / reanudacion. Sin tipo de bitacora propio (el ENUM es de la especificacion), se asienta como
-- 'correccion' sobre la entidad sesion_clase con valor anterior y nuevo (incluye el motivo).
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_suspender_sesion(p_id_sesion integer, p_motivo text) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    s        public.sesion_clase%ROWTYPE;
    v_motivo text := btrim(coalesce(p_motivo, ''));
BEGIN
    PERFORM app.exigir_rol('docente', 'administrador');
    s := app.sesion_bloqueada(p_id_sesion, true);

    IF v_motivo = '' OR char_length(v_motivo) > 200 THEN
        PERFORM app.fallar('VALIDACION', 'Indica el motivo de la suspensión (1 a 200 caracteres).');
    END IF;

    IF s.estatus = 'suspendida' THEN
        RETURN jsonb_build_object('id_sesion', s.id_sesion, 'estatus', s.estatus, 'ya_suspendida', true);
    ELSIF s.estatus <> 'programada' THEN
        PERFORM app.fallar('ESTATUS_INVALIDO',
            format('Solo se suspende una sesión programada (esta está %s).', s.estatus));
    END IF;

    UPDATE public.sesion_clase SET estatus = 'suspendida' WHERE id_sesion = s.id_sesion;
    PERFORM app.bitacora('correccion', 'sesion_clase', s.id_sesion,
        jsonb_build_object('estatus', 'programada'),
        jsonb_build_object('estatus', 'suspendida', 'motivo', v_motivo, 'evento', 'suspension_sesion'));
    PERFORM app.recalcular_grupo(s.id_grupo);

    RETURN jsonb_build_object('id_sesion', s.id_sesion, 'estatus', 'suspendida', 'ya_suspendida', false, 'motivo', v_motivo);
END
$$;
COMMENT ON FUNCTION public.api_suspender_sesion(integer, text) IS $c$
Suspende una sesion programada (extension a la spec): sale del denominador de faltas (RN-11) y se recalcula el grupo.
ARGS: p_id_sesion integer, p_motivo text (1 a 200 caracteres; queda en bitacora como correccion de sesion_clase). Solo sesiones programadas; idempotente si ya esta suspendida.
RETURNS: {id_sesion,estatus:"suspendida",ya_suspendida,motivo}
ERRORES: NO_AUTORIZADO (rol o sesion de otro docente), NO_ENCONTRADO, VALIDACION (motivo vacio o > 200), ESTATUS_INVALIDO (abierta o cerrada)
ROLES: docente (titular del grupo), administrador
$c$;
REVOKE ALL ON FUNCTION public.api_suspender_sesion(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_suspender_sesion(integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.api_reanudar_sesion(p_id_sesion integer) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    s public.sesion_clase%ROWTYPE;
BEGIN
    PERFORM app.exigir_rol('docente', 'administrador');
    s := app.sesion_bloqueada(p_id_sesion, true);

    IF s.estatus = 'programada' THEN
        RETURN jsonb_build_object('id_sesion', s.id_sesion, 'estatus', s.estatus, 'ya_programada', true);
    ELSIF s.estatus <> 'suspendida' THEN
        PERFORM app.fallar('ESTATUS_INVALIDO',
            format('Solo se reanuda una sesión suspendida (esta está %s).', s.estatus));
    END IF;

    UPDATE public.sesion_clase SET estatus = 'programada' WHERE id_sesion = s.id_sesion;
    PERFORM app.bitacora('correccion', 'sesion_clase', s.id_sesion,
        jsonb_build_object('estatus', 'suspendida'),
        jsonb_build_object('estatus', 'programada', 'evento', 'reanudacion_sesion'));
    PERFORM app.recalcular_grupo(s.id_grupo);

    RETURN jsonb_build_object('id_sesion', s.id_sesion, 'estatus', 'programada', 'ya_programada', false);
END
$$;
COMMENT ON FUNCTION public.api_reanudar_sesion(integer) IS $c$
Reanuda una sesion suspendida (suspendida -> programada): vuelve al denominador de faltas y se recalcula el grupo.
ARGS: p_id_sesion integer. Idempotente si ya esta programada.
RETURNS: {id_sesion,estatus:"programada",ya_programada}
ERRORES: NO_AUTORIZADO (rol o sesion de otro docente), NO_ENCONTRADO, ESTATUS_INVALIDO (abierta o cerrada)
ROLES: docente (titular del grupo), administrador
$c$;
REVOKE ALL ON FUNCTION public.api_reanudar_sesion(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_reanudar_sesion(integer) TO authenticated;
