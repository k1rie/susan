-- 0233 · RPC de servicio del indice FAISS (docs/api/biometria.md 3.12 a 3.17). Solo service_role.
-- Formato del indice y manifiesto: recognition-service/README.md (susan-faiss-json/1, campo refs
-- [{id_plantilla, faiss_id}]). La BD guarda solo faiss_id y rutas; nunca vectores (RNF-03).
-- Orden obligatorio por los indices unicos parciales no diferibles: apagar en_uso de la version
-- previa ANTES de encender la nueva (ux_indice_faiss_en_uso) y archivar antes de insertar
-- (ux_plantilla_facial_activa, en api_plantilla_registrar).

-- Valida un mapeo [{id_plantilla, faiss_id}] y lo devuelve normalizado (arreglo de objetos con enteros).
-- Lanza INDICE_MAPEO_INVALIDO: no es arreglo, elementos mal formados, ids repetidos o faiss_id < 0.
CREATE OR REPLACE FUNCTION app.validar_mapeo_indice(p_mapeo jsonb) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    SET search_path = pg_catalog, public, app, pg_temp
AS $$
DECLARE
    e jsonb;
    v_pl  jsonb := '[]'::jsonb;
BEGIN
    IF p_mapeo IS NULL OR jsonb_typeof(p_mapeo) <> 'array' THEN
        PERFORM app.fallar('INDICE_MAPEO_INVALIDO', 'El mapeo id_plantilla/faiss_id es inválido.');
    END IF;
    FOR e IN SELECT value FROM jsonb_array_elements(p_mapeo) LOOP
        IF jsonb_typeof(e) <> 'object'
           OR jsonb_typeof(e -> 'id_plantilla') IS DISTINCT FROM 'number'
           OR jsonb_typeof(e -> 'faiss_id') IS DISTINCT FROM 'number'
           OR (e ->> 'id_plantilla') !~ '^[0-9]{1,9}$'
           OR (e ->> 'faiss_id') !~ '^[0-9]{1,18}$' THEN
            PERFORM app.fallar('INDICE_MAPEO_INVALIDO', 'El mapeo id_plantilla/faiss_id es inválido.');
        END IF;
    END LOOP;
    IF (SELECT count(DISTINCT (value ->> 'id_plantilla')) FROM jsonb_array_elements(p_mapeo)) <> jsonb_array_length(p_mapeo)
       OR (SELECT count(DISTINCT (value ->> 'faiss_id')) FROM jsonb_array_elements(p_mapeo)) <> jsonb_array_length(p_mapeo) THEN
        PERFORM app.fallar('INDICE_MAPEO_INVALIDO', 'El mapeo tiene id_plantilla o faiss_id repetidos.');
    END IF;
    RETURN p_mapeo;
END
$$;
COMMENT ON FUNCTION app.validar_mapeo_indice(jsonb) IS 'Valida la estructura del mapeo [{id_plantilla, faiss_id}] (enteros, sin repetidos); INDICE_MAPEO_INVALIDO.';
GRANT EXECUTE ON FUNCTION app.validar_mapeo_indice(jsonb) TO service_role;

-- ---------------------------------------------------------------------------------------------
-- 3.12 svc_indice_plan: solo lectura. faiss_id nuevos = max(todo faiss_id historico) + posicion.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.svc_indice_plan(p_completa boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_dim      integer := app.param_num('dimension_vector')::integer;
    v_uso      public.indice_faiss%ROWTYPE;
    v_base_id  integer;
    v_motivo   text;
    v_max      bigint;
    v_version  text;
    v_entries  jsonb;
    v_activas  integer;
    v_nuevas   integer;
    v_obs      integer;
BEGIN
    SELECT * INTO v_uso FROM public.indice_faiss WHERE en_uso;
    IF v_uso.id_indice IS NULL THEN
        v_motivo := 'sin_indice';
    ELSIF v_uso.dimension <> v_dim THEN
        v_motivo := 'dimension_cambiada';
    ELSIF coalesce(p_completa, false) THEN
        v_motivo := 'completa';
    ELSE
        v_base_id := v_uso.id_indice;
    END IF;

    SELECT coalesce(max(faiss_id), -1) INTO v_max FROM public.plantilla_facial;

    SELECT 'v' || lpad((1 + coalesce(max(substring(version FROM '^v([0-9]{1,15})$')::bigint), 0))::text, 3, '0')
      INTO v_version FROM public.indice_faiss;

    WITH act AS (
        SELECT p.id_plantilla, p.id_alumno, p.faiss_id, p.id_indice, p.objeto_foto,
               coalesce(v_base_id IS NOT NULL AND p.id_indice = v_base_id, false) AS en_base
          FROM public.plantilla_facial p WHERE p.activa
    ), num AS (
        SELECT a.*, row_number() OVER (PARTITION BY a.en_base ORDER BY a.id_plantilla) AS rn FROM act a
    )
    SELECT coalesce(jsonb_agg(jsonb_build_object(
               'id_plantilla', n.id_plantilla,
               'id_alumno', n.id_alumno,
               'faiss_id', CASE WHEN n.en_base THEN n.faiss_id ELSE v_max + n.rn END,
               'id_indice', n.id_indice,
               'en_base', n.en_base,
               'objeto_foto', n.objeto_foto) ORDER BY n.id_plantilla), '[]'::jsonb),
           count(*), count(*) FILTER (WHERE NOT n.en_base)
      INTO v_entries, v_activas, v_nuevas
      FROM num n;

    IF v_base_id IS NOT NULL THEN
        SELECT count(*) INTO v_obs FROM public.plantilla_facial WHERE NOT activa AND id_indice = v_base_id;
    ELSE
        v_obs := 0;
    END IF;

    RETURN jsonb_build_object(
        'dimension', v_dim,
        'version_sugerida', v_version,
        'base', CASE WHEN v_base_id IS NULL THEN NULL
                     ELSE jsonb_build_object('id_indice', v_uso.id_indice, 'version', v_uso.version,
                                             'objeto_indice', v_uso.objeto_indice,
                                             'total_vectores', v_uso.total_vectores) END,
        'motivo_sin_base', v_motivo,
        'totales', jsonb_build_object('activas', v_activas, 'nuevas', v_nuevas,
                                      'en_base', v_activas - v_nuevas, 'obsoletas', v_obs),
        'nada_que_hacer', (v_nuevas = 0 AND v_obs = 0 AND v_base_id IS NOT NULL),
        'entries', v_entries);
END
$$;
COMMENT ON FUNCTION public.svc_indice_plan(boolean) IS
'Plan de reconstruccion del indice: base (version en uso, o null), todas las plantillas activas con su faiss_id (los nuevos son max historico + posicion, nunca reutilizados), version sugerida y totales. Solo lectura.
ARGS: p_completa (true = ignorar la base y reprocesar todas las fotos)
RETURNS: {"dimension":512,"version_sugerida":"v004","base":{"id_indice":3,"version":"v003","objeto_indice":"indice/v003.json","total_vectores":498}|null,"motivo_sin_base":null|"sin_indice"|"dimension_cambiada"|"completa","totales":{"activas":500,"nuevas":2,"en_base":498,"obsoletas":0},"nada_que_hacer":false,"entries":[{"id_plantilla":12,"id_alumno":3,"faiss_id":1001,"id_indice":3,"en_base":true,"objeto_foto":"registro/3/<uuid>.jpg"}]}
ERRORES: ninguno propio
ROLES: service_role';
REVOKE ALL ON FUNCTION public.svc_indice_plan(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.svc_indice_plan(boolean) TO service_role;

-- ---------------------------------------------------------------------------------------------
-- 3.13 svc_indice_registrar: inserta la version con en_uso = false. Idempotente.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.svc_indice_registrar(
    p_version        text,
    p_dimension      integer,
    p_objeto_indice  text,
    p_total_vectores integer
) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    i         public.indice_faiss%ROWTYPE;
    v_ya      boolean := false;
BEGIN
    IF p_version IS NULL OR p_version !~ '^[A-Za-z0-9._-]{1,12}$' THEN
        PERFORM app.fallar('VALIDACION', 'La versión del índice no es válida (1 a 12 caracteres: letras, números, punto, guion).');
    END IF;
    IF p_objeto_indice IS DISTINCT FROM ('indice/' || p_version || '.json') THEN
        PERFORM app.fallar('RUTA_INVALIDA', 'La ruta del archivo no es válida para este registro.');
    END IF;
    IF p_dimension IS DISTINCT FROM app.param_num('dimension_vector')::integer THEN
        PERFORM app.fallar('INDICE_DIMENSION_INVALIDA', 'La dimensión del índice no coincide con dimension_vector.');
    END IF;
    IF p_total_vectores IS NULL OR p_total_vectores < 0 THEN
        PERFORM app.fallar('VALIDACION', 'El total de vectores no puede ser negativo.');
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('susan.indice.cambio'));

    SELECT * INTO i FROM public.indice_faiss WHERE version = p_version;
    IF FOUND THEN
        IF i.objeto_indice = p_objeto_indice AND i.dimension = p_dimension
           AND i.total_vectores = p_total_vectores AND NOT i.en_uso THEN
            v_ya := true;
        ELSE
            PERFORM app.fallar('INDICE_VERSION_DUPLICADA', 'La versión del índice ya existe.');
        END IF;
    ELSE
        INSERT INTO public.indice_faiss (version, dimension, objeto_indice, total_vectores, fecha_construccion, en_uso)
        VALUES (p_version, p_dimension, p_objeto_indice, p_total_vectores, app.now(), false)
        RETURNING * INTO i;
    END IF;

    RETURN jsonb_build_object(
        'id_indice', i.id_indice, 'version', i.version, 'dimension', i.dimension,
        'objeto_indice', i.objeto_indice, 'total_vectores', i.total_vectores, 'en_uso', i.en_uso,
        'fecha_construccion', i.fecha_construccion, 'ya_registrada', v_ya);
END
$$;
COMMENT ON FUNCTION public.svc_indice_registrar(text, integer, text, integer) IS
'Registra una version del indice ya subida al bucket (en_uso = false). Idempotente si coinciden ruta, dimension y total.
ARGS: p_version (^[A-Za-z0-9._-]{1,12}$), p_dimension (= dimension_vector), p_objeto_indice (indice/{version}.json), p_total_vectores (>= 0)
RETURNS: {"id_indice":4,"version":"v004","dimension":512,"objeto_indice":"indice/v004.json","total_vectores":500,"en_uso":false,"fecha_construccion":"...","ya_registrada":false}
ERRORES: VALIDACION (version o total), RUTA_INVALIDA, INDICE_DIMENSION_INVALIDA, INDICE_VERSION_DUPLICADA (existe con otros datos o en uso)
ROLES: service_role';
REVOKE ALL ON FUNCTION public.svc_indice_registrar(text, integer, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.svc_indice_registrar(text, integer, text, integer) TO service_role;

-- ---------------------------------------------------------------------------------------------
-- 3.14 svc_indice_activar: cambio atomico de version. Si cualquier validacion o paso falla no
-- cambia nada (la transaccion de la RPC se revierte entera).
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.svc_indice_activar(
    p_id_indice integer,
    p_mapeo     jsonb
) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    i          public.indice_faiss%ROWTYPE;
    v_ant      public.indice_faiss%ROWTYPE;
    v_n        integer;
    v_asig     integer;
    v_pend     integer;
    v_cons     text;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('susan.indice.cambio'));

    SELECT * INTO i FROM public.indice_faiss WHERE id_indice = p_id_indice FOR UPDATE;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'La versión del índice no existe.');
    END IF;

    IF i.en_uso THEN
        SELECT count(*) FILTER (WHERE id_indice = i.id_indice), count(*) FILTER (WHERE id_indice IS NULL)
          INTO v_asig, v_pend FROM public.plantilla_facial WHERE activa;
        RETURN jsonb_build_object('id_indice', i.id_indice, 'version', i.version, 'anterior', NULL,
            'plantillas_asignadas', v_asig, 'plantillas_pendientes', v_pend,
            'total_vectores', i.total_vectores, 'ya_activo', true, 'activado_en', NULL);
    END IF;

    PERFORM app.validar_mapeo_indice(p_mapeo);
    IF jsonb_array_length(p_mapeo) <> i.total_vectores THEN
        PERFORM app.fallar('INDICE_MAPEO_INCOMPLETO', 'El mapeo no corresponde al total de vectores del índice.');
    END IF;
    IF i.dimension <> app.param_num('dimension_vector')::integer THEN
        PERFORM app.fallar('INDICE_DIMENSION_INVALIDA', 'La dimensión del índice no coincide con dimension_vector.');
    END IF;

    -- Plantillas activas bloqueadas: una alta o archivado concurrente espera a que termine el cambio.
    PERFORM 1 FROM public.plantilla_facial WHERE activa FOR UPDATE;

    IF EXISTS (
        SELECT 1 FROM jsonb_to_recordset(p_mapeo) AS m(id_plantilla integer, faiss_id bigint)
          LEFT JOIN public.plantilla_facial p ON p.id_plantilla = m.id_plantilla
         WHERE p.id_plantilla IS NULL OR NOT p.activa
    ) OR EXISTS (
        SELECT 1 FROM public.plantilla_facial p
         WHERE p.activa AND p.id_indice IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(p_mapeo) AS m(id_plantilla integer, faiss_id bigint)
                            WHERE m.id_plantilla = p.id_plantilla)
    ) THEN
        PERFORM app.fallar('INDICE_PLAN_OBSOLETO', 'El plan cambió mientras se construía el índice; reintente.');
    END IF;

    SELECT * INTO v_ant FROM public.indice_faiss WHERE en_uso;

    BEGIN
        -- PASO 1: apagar la version previa. PASO 2 (abajo): encender la nueva.
        UPDATE public.indice_faiss SET en_uso = false WHERE en_uso;

        UPDATE public.plantilla_facial p
           SET id_indice = p_id_indice, faiss_id = m.faiss_id
          FROM jsonb_to_recordset(p_mapeo) AS m(id_plantilla integer, faiss_id bigint)
         WHERE p.id_plantilla = m.id_plantilla;

        UPDATE public.indice_faiss SET en_uso = true WHERE id_indice = p_id_indice;
    EXCEPTION WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_cons = CONSTRAINT_NAME;
        IF v_cons = 'ux_indice_faiss_en_uso' THEN
            PERFORM app.fallar('RN_12_INDICE_EN_USO_DUPLICADO', 'Ya existe una versión del índice en uso.');
        END IF;
        PERFORM app.fallar('INDICE_MAPEO_INVALIDO', 'El mapeo id_plantilla/faiss_id es inválido.');
    END;

    SELECT count(*) FILTER (WHERE id_indice = p_id_indice), count(*) FILTER (WHERE id_indice IS NULL)
      INTO v_asig, v_pend FROM public.plantilla_facial WHERE activa;

    RETURN jsonb_build_object(
        'id_indice', i.id_indice, 'version', i.version,
        'anterior', CASE WHEN v_ant.id_indice IS NULL THEN NULL
                         ELSE jsonb_build_object('id_indice', v_ant.id_indice, 'version', v_ant.version) END,
        'plantillas_asignadas', v_asig, 'plantillas_pendientes', v_pend,
        'total_vectores', i.total_vectores, 'ya_activo', false, 'activado_en', app.now());
END
$$;
COMMENT ON FUNCTION public.svc_indice_activar(integer, jsonb) IS
'Activa atomicamente una version del indice (RF-16, RN-12, RNF-09): apaga la anterior, asigna id_indice/faiss_id a las plantillas del mapeo y enciende la nueva en una sola transaccion; si algo es invalido no cambia nada. Reintentable (ya_activo).
ARGS: p_id_indice, p_mapeo (jsonb [{"id_plantilla":12,"faiss_id":1001}], uno por vector; coincide con refs del manifiesto)
RETURNS: {"id_indice":4,"version":"v004","anterior":{"id_indice":3,"version":"v003"}|null,"plantillas_asignadas":500,"plantillas_pendientes":1,"total_vectores":500,"ya_activo":false,"activado_en":"..."}
ERRORES: NO_ENCONTRADO (version), INDICE_MAPEO_INVALIDO (estructura, repetidos, faiss_id < 0), INDICE_MAPEO_INCOMPLETO (conteo <> total_vectores), INDICE_DIMENSION_INVALIDA, INDICE_PLAN_OBSOLETO (plantilla archivada o activa indexada ausente del mapeo), RN_12_INDICE_EN_USO_DUPLICADO
ROLES: service_role';
REVOKE ALL ON FUNCTION public.svc_indice_activar(integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.svc_indice_activar(integer, jsonb) TO service_role;

-- ---------------------------------------------------------------------------------------------
-- 3.15 svc_indice_revertir: pone en uso una version anterior (mapeo = refs de su manifiesto).
-- Plantillas activas fuera del mapeo quedan pendientes; las archivadas del mapeo se ignoran.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.svc_indice_revertir(
    p_id_indice integer,
    p_mapeo     jsonb
) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    i       public.indice_faiss%ROWTYPE;
    v_ant   public.indice_faiss%ROWTYPE;
    v_asig  integer;
    v_pend  integer;
    v_cons  text;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('susan.indice.cambio'));

    SELECT * INTO i FROM public.indice_faiss WHERE id_indice = p_id_indice FOR UPDATE;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'La versión del índice no existe.');
    END IF;
    IF i.dimension <> app.param_num('dimension_vector')::integer THEN
        PERFORM app.fallar('INDICE_NO_REVERTIBLE', 'La versión indicada no puede ponerse en uso.');
    END IF;

    IF i.en_uso THEN
        SELECT count(*) FILTER (WHERE id_indice = i.id_indice), count(*) FILTER (WHERE id_indice IS NULL)
          INTO v_asig, v_pend FROM public.plantilla_facial WHERE activa;
        RETURN jsonb_build_object('id_indice', i.id_indice, 'version', i.version, 'anterior', NULL,
            'plantillas_asignadas', v_asig, 'plantillas_pendientes', v_pend, 'ya_activo', true);
    END IF;

    PERFORM app.validar_mapeo_indice(p_mapeo);

    PERFORM 1 FROM public.plantilla_facial WHERE activa FOR UPDATE;
    SELECT * INTO v_ant FROM public.indice_faiss WHERE en_uso;

    BEGIN
        UPDATE public.indice_faiss SET en_uso = false WHERE en_uso;

        -- Activas en el mapeo: reciben (destino, faiss_id). Activas fuera del mapeo: pendientes.
        UPDATE public.plantilla_facial p
           SET id_indice = p_id_indice, faiss_id = m.faiss_id
          FROM jsonb_to_recordset(p_mapeo) AS m(id_plantilla integer, faiss_id bigint)
         WHERE p.id_plantilla = m.id_plantilla AND p.activa;

        UPDATE public.plantilla_facial p
           SET id_indice = NULL, faiss_id = NULL
         WHERE p.activa AND (p.id_indice IS NOT NULL OR p.faiss_id IS NOT NULL)
           AND NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(p_mapeo) AS m(id_plantilla integer, faiss_id bigint)
                            WHERE m.id_plantilla = p.id_plantilla);

        UPDATE public.indice_faiss SET en_uso = true WHERE id_indice = p_id_indice;
    EXCEPTION WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_cons = CONSTRAINT_NAME;
        IF v_cons = 'ux_indice_faiss_en_uso' THEN
            PERFORM app.fallar('RN_12_INDICE_EN_USO_DUPLICADO', 'Ya existe una versión del índice en uso.');
        END IF;
        PERFORM app.fallar('INDICE_MAPEO_INVALIDO', 'El mapeo id_plantilla/faiss_id es inválido.');
    END;

    SELECT count(*) FILTER (WHERE id_indice = p_id_indice), count(*) FILTER (WHERE id_indice IS NULL)
      INTO v_asig, v_pend FROM public.plantilla_facial WHERE activa;

    RETURN jsonb_build_object(
        'id_indice', i.id_indice, 'version', i.version,
        'anterior', CASE WHEN v_ant.id_indice IS NULL THEN NULL
                         ELSE jsonb_build_object('id_indice', v_ant.id_indice, 'version', v_ant.version) END,
        'plantillas_asignadas', v_asig, 'plantillas_pendientes', v_pend, 'ya_activo', false);
END
$$;
COMMENT ON FUNCTION public.svc_indice_revertir(integer, jsonb) IS
'Pone en uso una version anterior del indice (atomico, mismo bloqueo que activar). Las plantillas activas que no figuran en el mapeo quedan pendientes de indexar.
ARGS: p_id_indice (version destino), p_mapeo (jsonb [{"id_plantilla","faiss_id"}] = refs del manifiesto de esa version)
RETURNS: {"id_indice":3,"version":"v003","anterior":{"id_indice":4,"version":"v004"}|null,"plantillas_asignadas":498,"plantillas_pendientes":2,"ya_activo":false}
ERRORES: NO_ENCONTRADO (version), INDICE_NO_REVERTIBLE (dimension distinta a dimension_vector), INDICE_MAPEO_INVALIDO
ROLES: service_role';
REVOKE ALL ON FUNCTION public.svc_indice_revertir(integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.svc_indice_revertir(integer, jsonb) TO service_role;

-- ---------------------------------------------------------------------------------------------
-- 3.16 svc_indice_en_uso
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.svc_indice_en_uso() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    i public.indice_faiss%ROWTYPE;
BEGIN
    SELECT * INTO i FROM public.indice_faiss WHERE en_uso;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    RETURN jsonb_build_object('id_indice', i.id_indice, 'version', i.version, 'objeto_indice', i.objeto_indice,
                              'dimension', i.dimension, 'total_vectores', i.total_vectores);
END
$$;
COMMENT ON FUNCTION public.svc_indice_en_uso() IS
'Version del indice en uso (para el arranque del servicio de reconocimiento); null si no hay.
ARGS: ninguno
RETURNS: {"id_indice":4,"version":"v004","objeto_indice":"indice/v004.json","dimension":512,"total_vectores":500} | null
ERRORES: ninguno
ROLES: service_role';
REVOKE ALL ON FUNCTION public.svc_indice_en_uso() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.svc_indice_en_uso() TO service_role;

-- ---------------------------------------------------------------------------------------------
-- 3.17 svc_bloqueo_adquirir / svc_bloqueo_liberar
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.svc_bloqueo_adquirir(p_clave text, p_dueno text, p_ttl_seg integer DEFAULT 900)
    RETURNS boolean
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
BEGIN
    RETURN app.bloqueo_adquirir(p_clave, p_dueno, p_ttl_seg);
END
$$;
COMMENT ON FUNCTION public.svc_bloqueo_adquirir(text, text, integer) IS
'Arrienda un bloqueo con vencimiento (reconstruccion de indice, jobs). true si lo obtuvo o renovo (mismo dueno); false si otro lo tiene vigente.
ARGS: p_clave (indice, job:purgar-recortes, job:recalcular, ...), p_dueno, p_ttl_seg (10-7200, def. 900)
RETURNS: true | false
ERRORES: VALIDACION (clave, dueno o ttl)
ROLES: service_role';
REVOKE ALL ON FUNCTION public.svc_bloqueo_adquirir(text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.svc_bloqueo_adquirir(text, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.svc_bloqueo_liberar(p_clave text, p_dueno text) RETURNS boolean
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
BEGIN
    RETURN app.bloqueo_liberar(p_clave, p_dueno);
END
$$;
COMMENT ON FUNCTION public.svc_bloqueo_liberar(text, text) IS
'Libera un bloqueo; true solo si p_dueno es su dueno.
ARGS: p_clave, p_dueno
RETURNS: true | false
ERRORES: ninguno
ROLES: service_role';
REVOKE ALL ON FUNCTION public.svc_bloqueo_liberar(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.svc_bloqueo_liberar(text, text) TO service_role;
