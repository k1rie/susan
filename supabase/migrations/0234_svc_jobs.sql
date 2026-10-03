-- 0234 · Jobs del programador de tareas (docs/api/biometria.md 3.18 a 3.22). Solo service_role.
-- Cada job asume la cuenta de servicio (app.asumir_cuenta_servicio) para que la bitacora quede a su
-- nombre. Un elemento que falla se registra en "errores" y no detiene a los demas (sub-bloque con
-- EXCEPTION). Todos son idempotentes: una segunda corrida no encuentra trabajo pendiente.
-- Dependen de funciones de otros dominios: app.cerrar_sesion (sesiones), app.recalcular_grupo
-- (reportes) y app.resolver_pendientes_vencidos (revision).

-- ---------------------------------------------------------------------------------------------
-- 3.18 svc_job_cerrar_sesiones (RF-10, RN-07): abiertas cuya hora_fin ya paso.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.svc_job_cerrar_sesiones(p_limit integer DEFAULT 200) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    r          record;
    v_res      jsonb;
    v_items    jsonb := '[]'::jsonb;
    v_errores  jsonb := '[]'::jsonb;
    v_cand     integer := 0;
    v_cerr     integer := 0;
    v_hint     text;
    v_msg      text;
    v_state    text;
BEGIN
    IF p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN
        PERFORM app.fallar('VALIDACION', 'p_limit debe estar entre 1 y 1000.');
    END IF;
    PERFORM app.asumir_cuenta_servicio();

    FOR r IN
        SELECT s.id_sesion
          FROM public.sesion_clase s
         WHERE s.estatus = 'abierta'
           AND ((s.fecha + s.hora_fin) AT TIME ZONE app.tz()) <= app.now()
         ORDER BY s.fecha, s.hora_fin, s.id_sesion
         LIMIT p_limit
           FOR UPDATE SKIP LOCKED
    LOOP
        v_cand := v_cand + 1;
        BEGIN
            v_res := app.cerrar_sesion(r.id_sesion, false);
            v_items := v_items || jsonb_build_object('id_sesion', r.id_sesion, 'resultado', v_res);
            v_cerr := v_cerr + 1;
        EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS v_hint = PG_EXCEPTION_HINT, v_msg = MESSAGE_TEXT, v_state = RETURNED_SQLSTATE;
            v_errores := v_errores || jsonb_build_object('id_sesion', r.id_sesion,
                'codigo', coalesce(nullif(v_hint, ''), v_state), 'mensaje', v_msg);
        END;
    END LOOP;

    RETURN jsonb_build_object('ejecutado_en', app.now(), 'candidatas', v_cand, 'cerradas', v_cerr,
                              'items', v_items, 'errores', v_errores);
END
$$;
COMMENT ON FUNCTION public.svc_job_cerrar_sesiones(integer) IS
'Job RF-10/RN-07: cierra (app.cerrar_sesion, por el sistema) las sesiones abiertas cuya hora_fin ya paso. Una falla no detiene las demas; las programadas nunca abiertas no se tocan. Idempotente.
ARGS: p_limit (def. 200, 1 a 1000)
RETURNS: {"ejecutado_en":"...","candidatas":3,"cerradas":2,"items":[{"id_sesion":88,"resultado":{...}}],"errores":[{"id_sesion":95,"codigo":"VALIDACION","mensaje":"..."}]}
ERRORES: VALIDACION (p_limit), CUENTA_SERVICIO_AUSENTE
ROLES: service_role';
REVOKE ALL ON FUNCTION public.svc_job_cerrar_sesiones(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.svc_job_cerrar_sesiones(integer) TO service_role;

-- ---------------------------------------------------------------------------------------------
-- 3.19 svc_job_resolver_pendientes (RF-11, RN-08): delega en app.resolver_pendientes_vencidos
-- para que la regla (plazo estricto: a las 48:00:00 aun se corrige) viva en un solo lugar.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.svc_job_resolver_pendientes(p_limit integer DEFAULT 500) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_servicio  integer;
    v_res       jsonb;
    v_ids       integer[];
    v_fallidos  jsonb;
    v_resueltas integer;
    v_insc      integer;
BEGIN
    IF p_limit IS NULL OR p_limit < 1 OR p_limit > 5000 THEN
        PERFORM app.fallar('VALIDACION', 'p_limit debe estar entre 1 y 5000.');
    END IF;
    v_servicio := app.asumir_cuenta_servicio();

    v_res := app.resolver_pendientes_vencidos(v_servicio, p_limit);
    v_fallidos := coalesce(v_res -> 'fallidos', '[]'::jsonb);
    v_resueltas := coalesce((v_res ->> 'resueltos')::integer, 0);
    SELECT coalesce(array_agg(x::integer), ARRAY[]::integer[]) INTO v_ids
      FROM jsonb_array_elements_text(coalesce(v_res -> 'ids', '[]'::jsonb)) AS x;

    SELECT count(DISTINCT (a.id_alumno, s.id_grupo)) INTO v_insc
      FROM public.asistencia a JOIN public.sesion_clase s ON s.id_sesion = a.id_sesion
     WHERE a.id_asistencia = ANY (v_ids);

    RETURN jsonb_build_object('ejecutado_en', app.now(),
        'candidatas', v_resueltas + jsonb_array_length(v_fallidos),
        'resueltas', v_resueltas, 'inscripciones_recalculadas', v_insc, 'errores', v_fallidos);
END
$$;
COMMENT ON FUNCTION public.svc_job_resolver_pendientes(integer) IS
'Job RF-11/RN-08: los pendientes de sesiones cerradas con mas de horas_limite_correccion (estricto) pasan a ausente (origen correccion) con la cuenta de servicio y se recalcula la inscripcion. Idempotente.
ARGS: p_limit (def. 500, 1 a 5000)
RETURNS: {"ejecutado_en":"...","candidatas":5,"resueltas":5,"inscripciones_recalculadas":4,"errores":[]}
ERRORES: VALIDACION (p_limit), CUENTA_SERVICIO_AUSENTE
ROLES: service_role';
REVOKE ALL ON FUNCTION public.svc_job_resolver_pendientes(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.svc_job_resolver_pendientes(integer) TO service_role;

-- ---------------------------------------------------------------------------------------------
-- 3.20 Purga de recortes (RNF-05). Orden obligatorio: listar -> borrar objetos -> marcar NULL.
-- Se conserva la fila de la deteccion (plantilla, score, es_valida): solo objeto_recorte pasa a NULL.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.svc_job_purgar_recortes_listar(p_limit integer DEFAULT 500) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_limit  integer := least(greatest(coalesce(p_limit, 500), 1), 2000);
    v_dias   integer := app.param_num('dias_retencion_recortes')::integer;
    v_corte  timestamptz := app.now() - make_interval(days => v_dias);
    v_total  bigint;
    v_items  jsonb;
BEGIN
    SELECT count(*) INTO v_total
      FROM public.deteccion d JOIN public.captura c ON c.id_captura = d.id_captura
     WHERE d.objeto_recorte IS NOT NULL AND c.marca_tiempo < v_corte;

    SELECT coalesce(jsonb_agg(jsonb_build_object('id_deteccion', q.id_deteccion, 'objeto_recorte', q.objeto_recorte)
                              ORDER BY q.id_deteccion), '[]'::jsonb) INTO v_items
      FROM (SELECT d.id_deteccion, d.objeto_recorte
              FROM public.deteccion d JOIN public.captura c ON c.id_captura = d.id_captura
             WHERE d.objeto_recorte IS NOT NULL AND c.marca_tiempo < v_corte
             ORDER BY d.id_deteccion LIMIT v_limit) q;

    RETURN jsonb_build_object('corte', v_corte, 'dias_retencion', v_dias, 'pendientes_total', v_total, 'items', v_items);
END
$$;
COMMENT ON FUNCTION public.svc_job_purgar_recortes_listar(integer) IS
'Paso 1 de la purga RNF-05: rutas de recortes de capturas estrictamente mas viejas que dias_retencion_recortes (7 dias exactos aun se conservan). Solo lectura.
ARGS: p_limit (def. 500, max 2000)
RETURNS: {"corte":"...","dias_retencion":7,"pendientes_total":1240,"items":[{"id_deteccion":90211,"objeto_recorte":"recortes/88/1204/3.jpg"}]}
ERRORES: ninguno
ROLES: service_role';
REVOKE ALL ON FUNCTION public.svc_job_purgar_recortes_listar(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.svc_job_purgar_recortes_listar(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.svc_job_purgar_recortes_marcar(p_ids bigint[]) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_dias   integer := app.param_num('dias_retencion_recortes')::integer;
    v_corte  timestamptz := app.now() - make_interval(days => v_dias);
    v_n      integer;
BEGIN
    IF p_ids IS NULL THEN
        PERFORM app.fallar('VALIDACION', 'p_ids es obligatorio.');
    END IF;
    IF cardinality(p_ids) > 5000 THEN
        PERFORM app.fallar('VALIDACION', 'No se pueden marcar más de 5000 recortes por llamada.');
    END IF;

    -- La antiguedad se vuelve a comprobar: nunca se anula un recorte aun retenido.
    UPDATE public.deteccion d
       SET objeto_recorte = NULL
     WHERE d.id_deteccion = ANY (p_ids)
       AND d.objeto_recorte IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.captura c WHERE c.id_captura = d.id_captura AND c.marca_tiempo < v_corte);
    GET DIAGNOSTICS v_n = ROW_COUNT;

    RETURN jsonb_build_object('solicitadas', cardinality(p_ids), 'marcadas', v_n);
END
$$;
COMMENT ON FUNCTION public.svc_job_purgar_recortes_marcar(bigint[]) IS
'Paso 3 de la purga RNF-05 (despues de borrar los objetos): pone objeto_recorte = NULL en las detecciones vencidas indicadas. Conserva la fila (id_plantilla, score, es_valida). Idempotente.
ARGS: p_ids (hasta 5000 id_deteccion)
RETURNS: {"solicitadas":500,"marcadas":498}
ERRORES: VALIDACION (nulo o mas de 5000)
ROLES: service_role';
REVOKE ALL ON FUNCTION public.svc_job_purgar_recortes_marcar(bigint[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.svc_job_purgar_recortes_marcar(bigint[]) TO service_role;

-- ---------------------------------------------------------------------------------------------
-- 3.21 svc_job_reconstruir_indice: diagnostico (la reconstruccion la orquesta lib/server/indice.js).
-- Se anade el motivo 'dimension_cambiada' (la base no sirve y el plan la descarta).
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.svc_job_reconstruir_indice() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_uso   public.indice_faiss%ROWTYPE;
    v_pend  integer;
    v_obs   integer;
    v_mot   text;
BEGIN
    SELECT * INTO v_uso FROM public.indice_faiss WHERE en_uso;
    SELECT count(*) FILTER (WHERE activa AND id_indice IS NULL),
           count(*) FILTER (WHERE NOT activa AND v_uso.id_indice IS NOT NULL AND id_indice = v_uso.id_indice)
      INTO v_pend, v_obs FROM public.plantilla_facial;

    v_mot := CASE
        WHEN v_uso.id_indice IS NULL THEN 'sin_indice'
        WHEN v_uso.dimension <> app.param_num('dimension_vector')::integer THEN 'dimension_cambiada'
        WHEN v_pend > 0 THEN 'pendientes'
        WHEN v_obs > 0 THEN 'obsoletas'
        ELSE 'ninguno' END;

    RETURN jsonb_build_object('requiere', v_mot <> 'ninguno', 'motivo', v_mot, 'pendientes', v_pend, 'obsoletas', v_obs,
        'en_uso', CASE WHEN v_uso.id_indice IS NULL THEN NULL
                       ELSE jsonb_build_object('id_indice', v_uso.id_indice, 'version', v_uso.version) END);
END
$$;
COMMENT ON FUNCTION public.svc_job_reconstruir_indice() IS
'Diagnostico del job reconstruir-indice: si hace falta reconstruir y por que. Solo lectura.
ARGS: ninguno
RETURNS: {"requiere":true,"motivo":"sin_indice|dimension_cambiada|pendientes|obsoletas|ninguno","pendientes":2,"obsoletas":0,"en_uso":{"id_indice":3,"version":"v003"}|null}
ERRORES: ninguno
ROLES: service_role';
REVOKE ALL ON FUNCTION public.svc_job_reconstruir_indice() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.svc_job_reconstruir_indice() TO service_role;

-- ---------------------------------------------------------------------------------------------
-- 3.22 svc_job_recalcular (RF-13, RF-14, RN-10, RN-11): vence consentimientos y recalcula los
-- grupos del periodo (el indicado, o el mayor periodo con alguna sesion ya ocurrida).
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.svc_job_recalcular(p_periodo text DEFAULT NULL) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    r          record;
    v_periodo  text := p_periodo;
    v_venc     integer;
    v_grupos   integer := 0;
    v_ok       integer := 0;
    v_errores  jsonb := '[]'::jsonb;
    v_hint     text;
    v_msg      text;
    v_state    text;
BEGIN
    IF p_periodo IS NOT NULL AND p_periodo !~ '^[0-9]{4}-[12]$' THEN
        PERFORM app.fallar('VALIDACION', 'El periodo debe tener el formato AAAA-S con S = 1 o 2 (por ejemplo 2026-2).');
    END IF;
    PERFORM app.asumir_cuenta_servicio();

    v_venc := app.vencer_consentimientos();

    IF v_periodo IS NULL THEN
        SELECT max(g.periodo) INTO v_periodo
          FROM public.grupo g
         WHERE EXISTS (SELECT 1 FROM public.sesion_clase s WHERE s.id_grupo = g.id_grupo AND s.fecha <= app.hoy());
    END IF;

    IF v_periodo IS NOT NULL THEN
        FOR r IN SELECT g.id_grupo FROM public.grupo g WHERE g.periodo = v_periodo ORDER BY g.id_grupo LOOP
            v_grupos := v_grupos + 1;
            BEGIN
                PERFORM app.recalcular_grupo(r.id_grupo);
                v_ok := v_ok + 1;
            EXCEPTION WHEN OTHERS THEN
                GET STACKED DIAGNOSTICS v_hint = PG_EXCEPTION_HINT, v_msg = MESSAGE_TEXT, v_state = RETURNED_SQLSTATE;
                v_errores := v_errores || jsonb_build_object('id_grupo', r.id_grupo,
                    'codigo', coalesce(nullif(v_hint, ''), v_state), 'mensaje', v_msg);
            END;
        END LOOP;
    END IF;

    RETURN jsonb_build_object('periodo', v_periodo, 'grupos', v_grupos, 'recalculados', v_ok,
                              'consentimientos_vencidos', v_venc, 'errores', v_errores);
END
$$;
COMMENT ON FUNCTION public.svc_job_recalcular(text) IS
'Job RF-13/RF-14/RN-10/RN-11: vence consentimientos (app.vencer_consentimientos) y recalcula cada grupo del periodo (app.recalcular_grupo). Un grupo con error no detiene a los demas. Idempotente.
ARGS: p_periodo (AAAA-S; si es NULL, el mayor periodo con sesiones ya ocurridas)
RETURNS: {"periodo":"2026-2","grupos":18,"recalculados":18,"consentimientos_vencidos":3,"errores":[]}
ERRORES: VALIDACION (formato de periodo), CUENTA_SERVICIO_AUSENTE
ROLES: service_role';
REVOKE ALL ON FUNCTION public.svc_job_recalcular(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.svc_job_recalcular(text) TO service_role;
