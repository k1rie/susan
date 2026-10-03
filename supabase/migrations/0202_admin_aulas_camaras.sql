-- 0202 · db-admin · aulas y camaras (RF-22, RN-06).
-- El tecnico NO usa api_camara_guardar: su operacion es api_camara_cambiar_estatus (dominio biometria).
-- Codigos propios: CAMARA_IP_REQUERIDA, CAMARA_POSICION_DUPLICADA, DUPLICADO (clave de aula, IP repetida).

CREATE OR REPLACE FUNCTION public.api_aulas_listar(
    p_q text DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0
) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_pat   text := app.b1_patron(p_q);
    v_total bigint;
    v_items jsonb;
BEGIN
    PERFORM app.exigir_rol('administrador', 'docente');
    SELECT count(*) INTO v_total FROM public.aula a
     WHERE v_pat IS NULL OR a.clave ILIKE v_pat OR a.edificio ILIKE v_pat;
    SELECT coalesce(jsonb_agg(x.j ORDER BY x.rn), '[]'::jsonb) INTO v_items FROM (
        SELECT row_number() OVER (ORDER BY a.clave) AS rn,
               app.b1_aula_json(a) || jsonb_build_object(
                   'camaras_total', (SELECT count(*) FROM public.camara c WHERE c.id_aula = a.id_aula),
                   'camaras_activas', (SELECT count(*) FROM public.camara c WHERE c.id_aula = a.id_aula AND c.estatus = 'activa')) AS j
          FROM public.aula a
         WHERE v_pat IS NULL OR a.clave ILIKE v_pat OR a.edificio ILIKE v_pat
         ORDER BY a.clave LIMIT app.b1_limite(p_limit) OFFSET app.b1_desplazamiento(p_offset)
    ) x;
    RETURN jsonb_build_object('total', v_total, 'items', v_items);
END
$$;
GRANT EXECUTE ON FUNCTION public.api_aulas_listar(text, integer, integer) TO authenticated;
COMMENT ON FUNCTION public.api_aulas_listar(text, integer, integer) IS
$c$Lista aulas con conteo de camaras (paginada).
ARGS: p_q texto libre (clave o edificio; opcional); p_limit def. 50 max 200; p_offset def. 0.
RETURNS: {"total": 2, "items": [{"id_aula": 1, "clave": "A-12", "edificio": "A", "capacidad": 40, "camaras_total": 2, "camaras_activas": 2}]}
ERRORES: NO_AUTORIZADO (alumno, tecnico).
ROLES: administrador (todas); docente (solo aulas de sus grupos, por RLS).$c$;

CREATE OR REPLACE FUNCTION public.api_aula_obtener(p_id_aula integer) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    a      public.aula%ROWTYPE;
    v_cams jsonb;
BEGIN
    PERFORM app.exigir_rol('administrador', 'docente');
    SELECT * INTO a FROM public.aula WHERE id_aula = p_id_aula;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El aula no existe.');
    END IF;
    SELECT coalesce(jsonb_agg(app.b1_camara_json(c) ORDER BY c.posicion), '[]'::jsonb) INTO v_cams
      FROM public.camara c WHERE c.id_aula = a.id_aula;
    RETURN app.b1_aula_json(a) || jsonb_build_object('camaras', v_cams);
END
$$;
GRANT EXECUTE ON FUNCTION public.api_aula_obtener(integer) TO authenticated;
COMMENT ON FUNCTION public.api_aula_obtener(integer) IS
$c$Ficha de un aula con sus camaras (la direccion IP solo se entrega al administrador).
ARGS: p_id_aula.
RETURNS: {"id_aula": 1, "clave": "A-12", "edificio": "A", "capacidad": 40, "camaras": [{"id_camara": 1, "id_aula": 1, "posicion": "frente", "tipo": "ip", "direccion_ip": "10.20.0.12", "estatus": "activa"}]}
ERRORES: NO_AUTORIZADO, NO_ENCONTRADO (no existe o el docente no la usa).
ROLES: administrador; docente (solo aulas de sus grupos).$c$;

CREATE OR REPLACE FUNCTION public.api_aula_guardar(p jsonb) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_p     jsonb;
    v_id    integer;
    v_old   public.aula%ROWTYPE;
    a       public.aula%ROWTYPE;
    v_cla   text;
    v_edi   text;
    v_cap   integer;
    v_max   integer;
    v_crea  boolean;
BEGIN
    PERFORM app.exigir_rol('administrador');
    v_p := app.b1_obj(p);
    v_id := app.b1_int(v_p, 'id_aula');
    v_crea := v_id IS NULL;
    IF NOT v_crea THEN
        SELECT * INTO v_old FROM public.aula WHERE id_aula = v_id FOR UPDATE;
        IF NOT FOUND THEN
            PERFORM app.fallar('NO_ENCONTRADO', 'El aula no existe.');
        END IF;
    END IF;

    v_cla := CASE WHEN v_crea OR v_p ? 'clave' THEN upper(app.b1_str(v_p, 'clave')) ELSE v_old.clave END;
    v_edi := CASE WHEN v_crea OR v_p ? 'edificio' THEN app.b1_str(v_p, 'edificio') ELSE v_old.edificio END;
    v_cap := CASE WHEN v_crea OR v_p ? 'capacidad' THEN app.b1_int(v_p, 'capacidad') ELSE v_old.capacidad END;

    IF v_cla IS NULL OR v_cla !~ '^[A-Z0-9][A-Z0-9-]{0,9}$' THEN
        PERFORM app.fallar('VALIDACION', 'La clave del aula es obligatoria: hasta 10 letras, dígitos o guiones.');
    END IF;
    IF v_edi IS NULL OR length(v_edi) > 40 THEN
        PERFORM app.fallar('VALIDACION', 'El edificio es obligatorio (máximo 40 caracteres).');
    END IF;
    IF v_cap IS NULL OR v_cap < 1 OR v_cap > 32767 THEN
        PERFORM app.fallar('VALIDACION', 'La capacidad debe ser un entero positivo.');
    END IF;
    IF EXISTS (SELECT 1 FROM public.aula x WHERE x.clave = v_cla AND x.id_aula IS DISTINCT FROM v_id) THEN
        PERFORM app.fallar('DUPLICADO', format('Ya existe un aula con la clave %s.', v_cla));
    END IF;
    -- No se reduce la capacidad por debajo de lo que ya hay inscrito en algun grupo del aula.
    IF NOT v_crea AND v_cap < v_old.capacidad THEN
        SELECT coalesce(max(n), 0) INTO v_max FROM (
            SELECT count(*) AS n FROM public.grupo g
              JOIN public.inscripcion i ON i.id_grupo = g.id_grupo AND i.estatus = 'activa'
             WHERE g.id_aula = v_id GROUP BY g.id_grupo) q;
        IF v_cap < v_max THEN
            PERFORM app.fallar('AULA_CAPACIDAD_INSUFICIENTE',
                format('Un grupo del aula tiene %s inscritos activos; la capacidad no puede ser menor.', v_max));
        END IF;
    END IF;

    BEGIN
        IF v_crea THEN
            INSERT INTO public.aula (clave, edificio, capacidad) VALUES (v_cla, v_edi, v_cap) RETURNING * INTO a;
        ELSE
            UPDATE public.aula SET clave = v_cla, edificio = v_edi, capacidad = v_cap WHERE id_aula = v_id RETURNING * INTO a;
        END IF;
    EXCEPTION WHEN unique_violation THEN
        PERFORM app.fallar('DUPLICADO', 'La clave del aula ya existe.');
    END;
    RETURN app.b1_aula_json(a) || jsonb_build_object('creado', v_crea);
END
$$;
GRANT EXECUTE ON FUNCTION public.api_aula_guardar(jsonb) TO authenticated;
COMMENT ON FUNCTION public.api_aula_guardar(jsonb) IS
$c$Da de alta (sin id_aula) o modifica (con id_aula) un aula.
ARGS: p {id_aula?, clave (max 10), edificio (max 40), capacidad > 0}; en modificacion lo ausente se conserva.
RETURNS: {"id_aula": 3, "clave": "C-01", "edificio": "C", "capacidad": 30, "creado": true}
ERRORES: NO_AUTORIZADO, VALIDACION, NO_ENCONTRADO, DUPLICADO (clave), AULA_CAPACIDAD_INSUFICIENTE (menor que los inscritos activos de un grupo).
ROLES: administrador.$c$;

CREATE OR REPLACE FUNCTION public.api_camaras_listar(p_id_aula integer DEFAULT NULL) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_items jsonb;
BEGIN
    PERFORM app.exigir_rol('administrador', 'docente');
    IF p_id_aula IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.aula a WHERE a.id_aula = p_id_aula) THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El aula no existe.');
    END IF;
    SELECT coalesce(jsonb_agg(x.j ORDER BY x.rn), '[]'::jsonb) INTO v_items FROM (
        SELECT row_number() OVER (ORDER BY a.clave, c.posicion) AS rn,
               app.b1_camara_json(c) || jsonb_build_object('aula_clave', a.clave) AS j
          FROM public.camara c JOIN public.aula a ON a.id_aula = c.id_aula
         WHERE p_id_aula IS NULL OR c.id_aula = p_id_aula
    ) x;
    RETURN jsonb_build_object('total', jsonb_array_length(v_items), 'items', v_items);
END
$$;
GRANT EXECUTE ON FUNCTION public.api_camaras_listar(integer) TO authenticated;
COMMENT ON FUNCTION public.api_camaras_listar(integer) IS
$c$Lista las camaras de un aula (o de todas si p_id_aula es null), frente antes que fondo.
ARGS: p_id_aula (opcional).
RETURNS: {"total": 2, "items": [{"id_camara": 1, "id_aula": 1, "aula_clave": "A-12", "posicion": "frente", "tipo": "ip", "direccion_ip": "10.20.0.12", "estatus": "activa"}]}
ERRORES: NO_AUTORIZADO (alumno, tecnico), NO_ENCONTRADO (aula inexistente o ajena al docente).
ROLES: administrador (con direccion_ip); docente (camaras de las aulas de sus grupos, direccion_ip null). El tecnico usa api_camaras_estado.$c$;

CREATE OR REPLACE FUNCTION public.api_camara_guardar(p jsonb) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_p     jsonb;
    v_id    integer;
    v_old   public.camara%ROWTYPE;
    c       public.camara%ROWTYPE;
    v_aula  integer;
    v_pos   public.posicion_camara;
    v_tipo  public.tipo_camara;
    v_est   public.estatus_camara;
    v_ip    text;
    v_inet  inet;
    v_txt   text;
    v_crea  boolean;
    v_cons  text;
BEGIN
    PERFORM app.exigir_rol('administrador');
    v_p := app.b1_obj(p);
    v_id := app.b1_int(v_p, 'id_camara');
    v_crea := v_id IS NULL;
    IF NOT v_crea THEN
        SELECT * INTO v_old FROM public.camara WHERE id_camara = v_id FOR UPDATE;
        IF NOT FOUND THEN
            PERFORM app.fallar('NO_ENCONTRADO', 'La cámara no existe.');
        END IF;
    END IF;

    v_aula := CASE WHEN v_crea THEN app.b1_int(v_p, 'id_aula')
                   ELSE coalesce(app.b1_int(v_p, 'id_aula'), v_old.id_aula) END;
    IF v_aula IS NULL THEN
        PERFORM app.fallar('VALIDACION', 'id_aula es obligatorio.');
    END IF;
    IF NOT v_crea AND v_aula <> v_old.id_aula THEN
        PERFORM app.fallar('VALIDACION', 'Una cámara no se cambia de aula; crea una nueva en el aula destino.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.aula WHERE id_aula = v_aula) THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El aula no existe.');
    END IF;

    -- Enumerados y texto: se validan con mensaje propio, no con el error de cast.
    BEGIN
        v_txt := app.b1_str(v_p, 'posicion');
        v_pos := CASE WHEN v_txt IS NOT NULL THEN v_txt::public.posicion_camara
                      WHEN v_crea THEN NULL ELSE v_old.posicion END;
        v_txt := app.b1_str(v_p, 'tipo');
        v_tipo := CASE WHEN v_txt IS NOT NULL THEN v_txt::public.tipo_camara
                       WHEN v_crea THEN 'ip'::public.tipo_camara ELSE v_old.tipo END;
        v_txt := app.b1_str(v_p, 'estatus');
        v_est := CASE WHEN v_txt IS NOT NULL THEN v_txt::public.estatus_camara
                      WHEN v_crea THEN 'activa'::public.estatus_camara ELSE v_old.estatus END;
    EXCEPTION WHEN invalid_text_representation THEN
        PERFORM app.fallar('VALIDACION', 'Posición (frente|fondo), tipo (ip|navegador) o estatus (activa|inactiva|mantenimiento) no válidos.');
    END;
    IF v_pos IS NULL THEN
        PERFORM app.fallar('VALIDACION', 'La posición de la cámara (frente o fondo) es obligatoria.');
    END IF;

    IF v_tipo = 'navegador' THEN
        v_ip := NULL;                                  -- la webcam del navegador no tiene IP
    ELSE
        v_ip := CASE WHEN v_p ? 'direccion_ip' OR v_crea THEN app.b1_str(v_p, 'direccion_ip')
                     ELSE v_old.direccion_ip END;
        IF v_ip IS NULL THEN
            PERFORM app.fallar('CAMARA_IP_REQUERIDA', 'Una cámara de tipo ip necesita su dirección IP.');
        END IF;
        BEGIN
            IF position('/' IN v_ip) > 0 THEN
                RAISE invalid_text_representation;
            END IF;
            v_inet := v_ip::inet;
        EXCEPTION WHEN invalid_text_representation THEN
            PERFORM app.fallar('VALIDACION', 'La dirección IP no es válida.');
        END;
        v_ip := host(v_inet);
    END IF;

    IF EXISTS (SELECT 1 FROM public.camara x WHERE x.id_aula = v_aula AND x.posicion = v_pos AND x.id_camara IS DISTINCT FROM v_id) THEN
        PERFORM app.fallar('CAMARA_POSICION_DUPLICADA', format('El aula ya tiene una cámara en la posición %s.', v_pos));
    END IF;
    IF v_ip IS NOT NULL AND EXISTS (SELECT 1 FROM public.camara x WHERE x.direccion_ip = v_ip AND x.id_camara IS DISTINCT FROM v_id) THEN
        PERFORM app.fallar('DUPLICADO', format('La dirección IP %s ya está asignada a otra cámara.', v_ip));
    END IF;

    BEGIN
        IF v_crea THEN
            INSERT INTO public.camara (id_aula, posicion, tipo, direccion_ip, estatus)
            VALUES (v_aula, v_pos, v_tipo, v_ip, v_est) RETURNING * INTO c;
        ELSE
            UPDATE public.camara SET posicion = v_pos, tipo = v_tipo, direccion_ip = v_ip, estatus = v_est
             WHERE id_camara = v_id RETURNING * INTO c;
        END IF;
    EXCEPTION WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_cons = CONSTRAINT_NAME;
        IF v_cons = 'uq_camara_aula_posicion' THEN
            PERFORM app.fallar('CAMARA_POSICION_DUPLICADA', 'El aula ya tiene una cámara en esa posición.');
        END IF;
        PERFORM app.fallar('DUPLICADO', 'La dirección IP ya está asignada a otra cámara.');
    END;
    RETURN app.b1_camara_json(c) || jsonb_build_object('creado', v_crea);
END
$$;
GRANT EXECUTE ON FUNCTION public.api_camara_guardar(jsonb) TO authenticated;
COMMENT ON FUNCTION public.api_camara_guardar(jsonb) IS
$c$Da de alta (sin id_camara) o modifica (con id_camara) una camara de un aula: una por posicion (frente|fondo); la direccion IP es obligatoria solo para tipo ip (en navegador se descarta). No cambia una camara de aula. No altera sesiones ya abiertas.
ARGS: p {id_camara?, id_aula (solo alta), posicion frente|fondo, tipo ip|navegador (def. ip), direccion_ip, estatus activa|inactiva|mantenimiento (def. activa)}; en modificacion lo ausente se conserva.
RETURNS: {"id_camara": 4, "id_aula": 1, "posicion": "fondo", "tipo": "ip", "direccion_ip": "10.20.0.13", "estatus": "activa", "creado": true}
ERRORES: NO_AUTORIZADO (incluye tecnico), VALIDACION, NO_ENCONTRADO (camara o aula), CAMARA_IP_REQUERIDA, CAMARA_POSICION_DUPLICADA, DUPLICADO (IP en uso).
ROLES: administrador.$c$;
