-- 0132 · Registro manual de asistencia (RF-09, RF-06, RF-08, RNF-06): P-03 «Registrar manualmente» y P-04 pase de lista.
--
-- Reglas:
--  * origen 'manual'. Un solo registro por alumno y sesion (RN-02): si ya hay uno y la regla lo permite,
--    se ACTUALIZA (antes del cierre; despues del cierre la via es la correccion de db-revision).
--  * Sugerencia por la hora de marcado con los limites de la SESION (RN-03): presente antes de limite_presente_min,
--    retardo hasta tolerancia_min; pasada la tolerancia la sugerencia es ausente.
--  * Sesion manual: cualquier inscrito activo. Sesion automatica: SOLO inscritos sin consentimiento vigente o
--    sin lecturas validas, y sin cambiar el modo de la sesion (RF-09, RNF-06).
--  * Un 'ausente' manual no lleva hora (ck_asistencia_ausente_sin_hora); presente/retardo siempre la llevan.
--  * Hora (p_hora): no futura, y dentro de [hora_inicio - 1 h, hora_fin] de la sesion.

-- Nucleo compartido. El llamador ya valido el rol y bloqueo la sesion (app.sesion_bloqueada).
CREATE OR REPLACE FUNCTION app.registrar_asistencia_manual(
    s           public.sesion_clase,
    p_id_alumno integer,
    p_estado    text,
    p_hora      timestamptz
) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_ahora     timestamptz := app.now();
    v_hora      timestamptz;
    v_sugerido  public.estado_asistencia;
    v_estado    public.estado_asistencia;
    v_lect      integer;
    v_consent   boolean;
    a           public.asistencia%ROWTYPE;
    v_creado    boolean;
BEGIN
    IF p_id_alumno IS NULL THEN
        PERFORM app.fallar('VALIDACION', 'Indica el alumno.');
    END IF;
    IF p_estado IS NOT NULL AND p_estado NOT IN ('presente', 'retardo', 'ausente') THEN
        PERFORM app.fallar('ESTADO_INVALIDO', 'El estado debe ser presente, retardo o ausente.');
    END IF;
    IF s.estatus <> 'abierta' THEN
        PERFORM app.fallar('SESION_NO_ABIERTA', 'La sesión no está abierta; solo se registra asistencia en una sesión abierta.');
    END IF;

    v_hora := coalesce(p_hora, v_ahora);
    IF p_hora IS NOT NULL AND (p_hora > v_ahora
            OR p_hora < app.instante_clase(s.fecha, s.hora_inicio) - interval '1 hour'
            OR p_hora > app.instante_clase(s.fecha, s.hora_fin)) THEN
        PERFORM app.fallar('HORA_INVALIDA', 'La hora de marcado no puede ser futura ni quedar fuera del horario de la sesión.');
    END IF;

    -- RN-01: solo con inscripcion activa (se valida antes del disparador para devolver un codigo propio).
    IF NOT EXISTS (SELECT 1 FROM public.inscripcion i
                    WHERE i.id_alumno = p_id_alumno AND i.id_grupo = s.id_grupo AND i.estatus = 'activa') THEN
        PERFORM app.fallar('ALUMNO_NO_INSCRITO', 'El alumno no tiene una inscripción activa en el grupo de la sesión.');
    END IF;

    SELECT * INTO a FROM public.asistencia x
     WHERE x.id_sesion = s.id_sesion AND x.id_alumno = p_id_alumno FOR UPDATE;
    v_creado := NOT FOUND;

    IF NOT v_creado AND a.origen = 'correccion' THEN
        PERFORM app.fallar('REGISTRO_CORREGIDO', 'El registro ya fue corregido por el docente; ajústalo desde la revisión.');
    END IF;

    -- RF-09: en sesion automatica solo a quien el reconocimiento no puede atender.
    IF s.modo_registro = 'automatico' THEN
        v_lect := app.lecturas_validas(s.id_sesion, p_id_alumno);
        v_consent := app.tiene_consentimiento_vigente(p_id_alumno);
        IF v_consent AND v_lect > 0 THEN
            PERFORM app.fallar('ALUMNO_CON_LECTURAS',
                format('El alumno tiene %s lectura(s) válida(s) del reconocimiento; su registro es automático.', v_lect));
        END IF;
    END IF;

    v_sugerido := app.estado_sugerido(s.fecha, s.hora_inicio, s.limite_presente_min, s.tolerancia_min, v_hora);
    v_estado := coalesce(p_estado::public.estado_asistencia, v_sugerido);

    IF v_creado THEN
        INSERT INTO public.asistencia (id_sesion, id_alumno, estado, hora_registro, origen, conteo_detecciones)
        VALUES (s.id_sesion, p_id_alumno, v_estado,
                CASE WHEN v_estado = 'ausente' THEN NULL ELSE v_hora END, 'manual', 0)
        RETURNING * INTO a;
    ELSE
        UPDATE public.asistencia
           SET estado = v_estado,
               hora_registro = CASE WHEN v_estado = 'ausente' THEN NULL ELSE v_hora END,
               origen = 'manual'
         WHERE id_asistencia = a.id_asistencia
         RETURNING * INTO a;
    END IF;

    RETURN jsonb_build_object(
        'id_asistencia', a.id_asistencia,
        'id_sesion', a.id_sesion,
        'id_alumno', a.id_alumno,
        'estado', a.estado,
        'origen', a.origen,
        'hora_registro', a.hora_registro,
        'sugerido', v_sugerido,
        'creado', v_creado);
END
$$;
COMMENT ON FUNCTION app.registrar_asistencia_manual(public.sesion_clase, integer, text, timestamptz) IS
    'Nucleo del registro manual (RF-09): valida inscripcion, regla de consentimiento/lecturas y crea o actualiza el unico registro del alumno. El llamador valida rol y bloquea la sesion.';

-- ---------------------------------------------------------------------------------------------
-- api_registrar_manual
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_registrar_manual(
    p_id_sesion integer,
    p_id_alumno integer,
    p_estado    text,
    p_hora      timestamptz DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    s public.sesion_clase%ROWTYPE;
BEGIN
    PERFORM app.exigir_rol('docente');
    s := app.sesion_bloqueada(p_id_sesion, false);
    RETURN app.registrar_asistencia_manual(s, p_id_alumno, p_estado, p_hora);
END
$$;
COMMENT ON FUNCTION public.api_registrar_manual(integer, integer, text, timestamptz) IS $c$
Registra o actualiza con origen manual la asistencia de un alumno en una sesion abierta (RF-09).
ARGS: p_id_sesion integer, p_id_alumno integer, p_estado text ("presente"|"retardo"|"ausente"; NULL = el sugerido por la hora), p_hora timestamptz (default ahora; no futura). En sesion automatica solo para inscritos sin consentimiento vigente o sin lecturas validas; no cambia el modo de la sesion. Un solo registro por alumno y sesion: si ya hay uno manual (o un automatico de alguien sin consentimiento) se actualiza.
RETURNS: {id_asistencia,id_sesion,id_alumno,estado,origen:"manual",hora_registro,sugerido,creado}. hora_registro es null si el estado es ausente.
ERRORES: NO_AUTORIZADO (rol o sesion de otro docente), NO_ENCONTRADO (sesion), SESION_NO_ABIERTA, ALUMNO_NO_INSCRITO, ALUMNO_CON_LECTURAS (sesion automatica, con consentimiento y lecturas), ESTADO_INVALIDO, HORA_INVALIDA, REGISTRO_CORREGIDO, VALIDACION
ROLES: docente (titular del grupo)
$c$;
REVOKE ALL ON FUNCTION public.api_registrar_manual(integer, integer, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_registrar_manual(integer, integer, text, timestamptz) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- api_pase_lista_manual: lote atomico (todo o nada) + «marcar restantes segun la hora» (P-04)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_pase_lista_manual(
    p_id_sesion        integer,
    p_registros        jsonb,
    p_marcar_restantes boolean DEFAULT false
) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    s          public.sesion_clase%ROWTYPE;
    e          jsonb;
    v_i        integer := 0;
    v_id       integer;
    v_estado   text;
    v_hora     timestamptz;
    v_vistos   integer[] := ARRAY[]::integer[];
    v_res      jsonb;
    v_items    jsonb := '[]'::jsonb;
    v_creados  integer := 0;
    v_actual   integer := 0;
    v_resto    integer := 0;
    r          record;
BEGIN
    PERFORM app.exigir_rol('docente');
    s := app.sesion_bloqueada(p_id_sesion, false);

    IF p_registros IS NULL THEN
        p_registros := '[]'::jsonb;
    END IF;
    IF jsonb_typeof(p_registros) <> 'array' THEN
        PERFORM app.fallar('VALIDACION', 'p_registros debe ser un arreglo JSON de {id_alumno, estado, hora}.');
    END IF;
    IF jsonb_array_length(p_registros) > 500 THEN
        PERFORM app.fallar('VALIDACION', 'Un pase de lista admite hasta 500 registros por llamada.');
    END IF;

    FOR e IN SELECT x FROM jsonb_array_elements(p_registros) AS t(x) LOOP
        v_i := v_i + 1;
        BEGIN
            IF jsonb_typeof(e) <> 'object' THEN
                RAISE EXCEPTION 'no es un objeto';
            END IF;
            v_id := (e ->> 'id_alumno')::integer;
            v_estado := nullif(e ->> 'estado', '');
            v_hora := nullif(e ->> 'hora', '')::timestamptz;
        EXCEPTION WHEN others THEN
            PERFORM app.fallar('VALIDACION', format('El registro %s del pase de lista no es válido.', v_i));
        END;
        IF v_id IS NULL THEN
            PERFORM app.fallar('VALIDACION', format('El registro %s del pase de lista no indica id_alumno.', v_i));
        END IF;
        IF v_id = ANY (v_vistos) THEN
            PERFORM app.fallar('REGISTRO_DUPLICADO',
                format('El alumno %s aparece más de una vez en el pase de lista; solo hay un registro por alumno y sesión.', v_id));
        END IF;
        v_vistos := v_vistos || v_id;

        v_res := app.registrar_asistencia_manual(s, v_id, v_estado, v_hora);
        v_items := v_items || jsonb_build_array(v_res);
        IF (v_res ->> 'creado')::boolean THEN v_creados := v_creados + 1; ELSE v_actual := v_actual + 1; END IF;
    END LOOP;

    -- «Marcar restantes segun la hora»: los inscritos activos aun sin registro reciben el estado que
    -- sugiere la hora de marcado. En sesion automatica se omiten los que ya tienen lecturas validas.
    IF coalesce(p_marcar_restantes, false) THEN
        FOR r IN
            SELECT i.id_alumno
              FROM public.inscripcion i
             WHERE i.id_grupo = s.id_grupo AND i.estatus = 'activa'
               AND NOT EXISTS (SELECT 1 FROM public.asistencia x
                                WHERE x.id_sesion = s.id_sesion AND x.id_alumno = i.id_alumno)
             ORDER BY i.id_alumno
        LOOP
            IF s.modo_registro = 'automatico'
               AND app.tiene_consentimiento_vigente(r.id_alumno)
               AND app.lecturas_validas(s.id_sesion, r.id_alumno) > 0 THEN
                CONTINUE;
            END IF;
            v_res := app.registrar_asistencia_manual(s, r.id_alumno, NULL, NULL);
            v_items := v_items || jsonb_build_array(v_res);
            v_creados := v_creados + 1;
            v_resto := v_resto + 1;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'id_sesion', s.id_sesion,
        'modo_registro', s.modo_registro,
        'procesados', jsonb_array_length(v_items),
        'creados', v_creados,
        'actualizados', v_actual,
        'restantes_marcados', v_resto,
        'items', v_items);
END
$$;
COMMENT ON FUNCTION public.api_pase_lista_manual(integer, jsonb, boolean) IS $c$
Pase de lista manual por lote, atomico (todo o nada), con origen manual (P-04, RF-09).
ARGS: p_id_sesion integer, p_registros jsonb = [{id_alumno:int, estado:"presente"|"retardo"|"ausente"|null, hora:timestamptz|null}] (estado null = sugerido por la hora; sin id_alumno repetidos; max 500), p_marcar_restantes boolean (default false: ademas marca a los inscritos activos sin registro con el estado que sugiere la hora de marcado; en sesion automatica omite a quien ya tiene lecturas validas). Aplica las mismas reglas que api_registrar_manual a cada alumno.
RETURNS: {id_sesion,modo_registro,procesados,creados,actualizados,restantes_marcados,items:[{id_asistencia,id_alumno,estado,origen,hora_registro,sugerido,creado}]}
ERRORES: NO_AUTORIZADO (rol o sesion de otro docente), NO_ENCONTRADO (sesion), SESION_NO_ABIERTA, VALIDACION (registro mal formado), REGISTRO_DUPLICADO (alumno repetido en el lote), ALUMNO_NO_INSCRITO, ALUMNO_CON_LECTURAS, ESTADO_INVALIDO, HORA_INVALIDA, REGISTRO_CORREGIDO
ROLES: docente (titular del grupo)
$c$;
REVOKE ALL ON FUNCTION public.api_pase_lista_manual(integer, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_pase_lista_manual(integer, jsonb, boolean) TO authenticated;
