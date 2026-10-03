-- 0100 · Base de acumulados: v_resumen_asistencia y recalculo del derecho a examen
-- (RF-13, RF-14, RN-10, RN-11; ARCHITECTURE seccion 11).
--
--  * v_resumen_asistencia: una fila por inscripcion, NUNCA se guarda (spec 3.4). security_invoker:
--    la RLS de quien consulta decide que inscripciones, sesiones y asistencias ve (docente sus
--    grupos, alumno lo propio). Las sesiones que cuentan son las no 'suspendida' (programadas,
--    abiertas y cerradas): el porcentaje se calcula sobre las PROGRAMADAS, no sobre las cerradas.
--  * app.recalcular_inscripcion / app.recalcular_grupo: mueven inscripcion.derecho_examen (reversible)
--    y asientan 'notificacion' en bitacora SOLO cuando el derecho cambia de estado.

CREATE OR REPLACE VIEW public.v_resumen_asistencia WITH (security_invoker = true) AS
SELECT
    b.id_inscripcion,
    b.id_alumno,
    b.id_grupo,
    b.estatus_inscripcion,
    b.derecho_examen,
    b.sesiones_programadas,
    b.presentes,
    b.retardos,
    b.ausencias,
    b.justificadas,
    b.pendientes,
    b.faltas_equivalentes,
    CASE WHEN b.sesiones_programadas > 0
         THEN round(100.0 * b.faltas_equivalentes / b.sesiones_programadas, 2) END AS porcentaje_faltas,
    CASE WHEN b.sesiones_programadas > 0
         THEN round(100.0 * b.faltas_equivalentes / b.sesiones_programadas, 2) END AS porcentaje,
    b.limite_pct,
    -- RN-11 con aritmetica exacta (sin redondear): exactamente el limite conserva el derecho.
    (b.faltas_equivalentes * 100 > b.limite_pct * b.sesiones_programadas) AS supera_limite,
    b.faltas_maximas_permitidas,
    CASE WHEN b.faltas_equivalentes * 100 > b.limite_pct * b.sesiones_programadas THEN 0
         ELSE greatest(b.faltas_maximas_permitidas - b.faltas_equivalentes, 0) END AS faltas_restantes_antes_limite,
    -- En el limite: conserva el derecho pero una falta equivalente mas lo pierde.
    (b.sesiones_programadas > 0
     AND b.faltas_equivalentes * 100 <= b.limite_pct * b.sesiones_programadas
     AND b.faltas_maximas_permitidas - b.faltas_equivalentes <= 0) AS en_limite
FROM (
    SELECT
        i.id_inscripcion,
        i.id_alumno,
        i.id_grupo,
        i.estatus AS estatus_inscripcion,
        i.derecho_examen,
        sp.n AS sesiones_programadas,
        ac.presentes,
        ac.retardos,
        ac.ausencias,
        ac.justificadas,
        ac.pendientes,
        (ac.ausencias + CASE WHEN p.retardos_por_ausencia >= 1
                             THEN floor(ac.retardos / p.retardos_por_ausencia)::integer ELSE 0 END) AS faltas_equivalentes,
        p.limite_pct,
        floor(p.limite_pct * sp.n / 100)::integer AS faltas_maximas_permitidas
    FROM public.inscripcion i
    CROSS JOIN (SELECT app.param_num('retardos_por_ausencia') AS retardos_por_ausencia,
                       app.param_num('porcentaje_max_ausencias') AS limite_pct) p
    CROSS JOIN LATERAL (
        SELECT count(*)::integer AS n
          FROM public.sesion_clase s
         WHERE s.id_grupo = i.id_grupo AND s.estatus <> 'suspendida'
    ) sp
    CROSS JOIN LATERAL (
        SELECT count(*) FILTER (WHERE a.estado = 'presente')::integer   AS presentes,
               count(*) FILTER (WHERE a.estado = 'retardo')::integer    AS retardos,
               count(*) FILTER (WHERE a.estado = 'ausente')::integer    AS ausencias,
               count(*) FILTER (WHERE a.estado = 'justificado')::integer AS justificadas,
               count(*) FILTER (WHERE a.estado = 'pendiente')::integer  AS pendientes
          FROM public.asistencia a
          JOIN public.sesion_clase s ON s.id_sesion = a.id_sesion
         WHERE a.id_alumno = i.id_alumno AND s.id_grupo = i.id_grupo AND s.estatus <> 'suspendida'
    ) ac
) b;

COMMENT ON VIEW public.v_resumen_asistencia IS
    'Acumulados por inscripcion (RF-13/14, RN-10/11): conteos por estado, faltas_equivalentes = ausencias + floor(retardos/retardos_por_ausencia), porcentaje_faltas sobre sesiones PROGRAMADAS (no suspendidas), supera_limite, en_limite y faltas_restantes_antes_limite. security_invoker.';

REVOKE ALL ON public.v_resumen_asistencia FROM PUBLIC, anon;
GRANT SELECT ON public.v_resumen_asistencia TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- app.recalcular_inscripcion: aplica RN-11 a una inscripcion. Idempotente. Bloquea la fila para
-- que dos recalculos simultaneos no dupliquen la notificacion.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.recalcular_inscripcion(p_id_inscripcion integer) RETURNS void
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_derecho_ant boolean;
    r             public.v_resumen_asistencia%ROWTYPE;
    v_derecho_nvo boolean;
BEGIN
    SELECT i.derecho_examen INTO v_derecho_ant
      FROM public.inscripcion i WHERE i.id_inscripcion = p_id_inscripcion FOR UPDATE;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', format('No existe la inscripción %s.', p_id_inscripcion));
    END IF;

    SELECT * INTO r FROM public.v_resumen_asistencia v WHERE v.id_inscripcion = p_id_inscripcion;
    v_derecho_nvo := NOT r.supera_limite;

    IF v_derecho_nvo IS DISTINCT FROM v_derecho_ant THEN
        UPDATE public.inscripcion SET derecho_examen = v_derecho_nvo WHERE id_inscripcion = p_id_inscripcion;
        PERFORM app.bitacora(
            'notificacion', 'inscripcion', p_id_inscripcion,
            jsonb_build_object('derecho_examen', v_derecho_ant),
            jsonb_build_object(
                'derecho_examen', v_derecho_nvo,
                'evento', CASE WHEN v_derecho_nvo THEN 'recupera_derecho' ELSE 'pierde_derecho' END,
                'id_alumno', r.id_alumno,
                'id_grupo', r.id_grupo,
                'faltas_equivalentes', r.faltas_equivalentes,
                'sesiones_programadas', r.sesiones_programadas,
                'porcentaje_faltas', r.porcentaje_faltas,
                'limite_pct', r.limite_pct));
    END IF;
END
$$;
COMMENT ON FUNCTION app.recalcular_inscripcion(integer) IS
    'RN-11: fija inscripcion.derecho_examen = NOT supera_limite (reversible) y asienta notificacion en bitacora solo si cambia. Idempotente.';
GRANT EXECUTE ON FUNCTION app.recalcular_inscripcion(integer) TO service_role;

-- Recalculo de todo el grupo (tras cierre de sesion, correccion o justificante). Grupo sin
-- sesiones o sin inscritos: no hace nada y no falla.
CREATE OR REPLACE FUNCTION app.recalcular_grupo(p_id_grupo integer) RETURNS void
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_id integer;
BEGIN
    FOR v_id IN
        SELECT i.id_inscripcion FROM public.inscripcion i WHERE i.id_grupo = p_id_grupo ORDER BY i.id_inscripcion
    LOOP
        PERFORM app.recalcular_inscripcion(v_id);
    END LOOP;
END
$$;
COMMENT ON FUNCTION app.recalcular_grupo(integer) IS
    'Aplica app.recalcular_inscripcion a cada inscripcion del grupo (activas y bajas). Un grupo sin inscritos o sin sesiones no falla.';
GRANT EXECUTE ON FUNCTION app.recalcular_grupo(integer) TO service_role;
