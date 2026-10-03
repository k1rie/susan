-- 0135 · Funciones de servicio del muestreo (solo service_role): candidatos, capturas y detecciones.
-- Las llama el Route Handler de captura (docs/ARCHITECTURE.md seccion 6) en este orden:
--   svc_alumnos_candidatos -> (servicio de reconocimiento) -> svc_crear_captura -> svc_registrar_detecciones.
-- Nunca se guardan vectores ni imagenes: solo faiss_id, score y rutas objeto_recorte.

-- ---------------------------------------------------------------------------------------------
-- svc_alumnos_candidatos (RF-04, RNF-06): "un alumno no inscrito, o sin consentimiento vigente, nunca es candidato".
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.svc_alumnos_candidatos(p_id_sesion integer) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    s        public.sesion_clase%ROWTYPE;
    v_indice record;
    v_mapa   jsonb;
BEGIN
    SELECT * INTO s FROM public.sesion_clase x WHERE x.id_sesion = p_id_sesion;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'La sesión de clase no existe.');
    END IF;

    SELECT f.id_indice, f.version INTO v_indice FROM public.indice_faiss f WHERE f.en_uso;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('index_version', NULL, 'id_indice', NULL,
                                  'faiss_ids', '[]'::jsonb, 'mapa', '[]'::jsonb);
    END IF;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
               'faiss_id', p.faiss_id, 'id_plantilla', p.id_plantilla, 'id_alumno', p.id_alumno
           ) ORDER BY p.faiss_id), '[]'::jsonb)
      INTO v_mapa
      FROM public.plantilla_facial p
     WHERE p.activa
       AND p.id_indice = v_indice.id_indice
       AND p.faiss_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.inscripcion i
                    WHERE i.id_alumno = p.id_alumno AND i.id_grupo = s.id_grupo AND i.estatus = 'activa')
       AND app.consentimiento_vigente(p.id_consent);

    RETURN jsonb_build_object(
        'index_version', v_indice.version,
        'id_indice', v_indice.id_indice,
        'faiss_ids', (SELECT coalesce(jsonb_agg(m -> 'faiss_id' ORDER BY (m ->> 'faiss_id')::bigint), '[]'::jsonb)
                       FROM jsonb_array_elements(v_mapa) AS t(m)),
        'mapa', v_mapa);
END
$$;
COMMENT ON FUNCTION public.svc_alumnos_candidatos(integer) IS $c$
Candidatos del reconocimiento para una sesion (RF-04, RNF-06): plantillas activas del indice en uso, de alumnos con inscripcion activa en el grupo y consentimiento vigente.
ARGS: p_id_sesion integer. Sin indice en uso devuelve faiss_ids vacio e index_version null.
RETURNS: {index_version:"v001"|null, id_indice:1|null, faiss_ids:[0,3], mapa:[{faiss_id,id_plantilla,id_alumno}]}
ERRORES: NO_ENCONTRADO (sesion)
ROLES: service_role
$c$;
REVOKE ALL ON FUNCTION public.svc_alumnos_candidatos(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.svc_alumnos_candidatos(integer) TO service_role;

-- ---------------------------------------------------------------------------------------------
-- svc_crear_captura (RF-03, RN-06). Idempotente por (id_camara, marca_tiempo).
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.svc_crear_captura(
    p_id_sesion    integer,
    p_id_camara    integer,
    p_marca_tiempo timestamptz,
    p_rostros      integer
) RETURNS bigint
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    s        public.sesion_clase%ROWTYPE;
    v_cam    public.camara%ROWTYPE;
    v_aula   integer;
    v_ex     public.captura%ROWTYPE;
    v_id     bigint;
BEGIN
    IF p_marca_tiempo IS NULL OR p_rostros IS NULL OR p_rostros < 0 OR p_rostros > 1000 THEN
        PERFORM app.fallar('VALIDACION', 'La captura requiere marca de tiempo y un número de rostros entre 0 y 1000.');
    END IF;

    SELECT * INTO s FROM public.sesion_clase x WHERE x.id_sesion = p_id_sesion FOR NO KEY UPDATE;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'La sesión de clase no existe.');
    END IF;
    SELECT * INTO v_cam FROM public.camara c WHERE c.id_camara = p_id_camara;
    IF NOT FOUND THEN
        PERFORM app.fallar('CAMARA_NO_ENCONTRADA', 'La cámara no existe.');
    END IF;
    SELECT g.id_aula INTO v_aula FROM public.grupo g WHERE g.id_grupo = s.id_grupo;
    IF v_cam.id_aula <> v_aula THEN
        PERFORM app.fallar('CAMARA_FUERA_DE_AULA', 'La cámara no pertenece al aula del grupo de la sesión (RN-06).');
    END IF;

    -- Idempotencia: el mismo fotograma reenviado devuelve la captura existente.
    SELECT * INTO v_ex FROM public.captura k WHERE k.id_camara = p_id_camara AND k.marca_tiempo = p_marca_tiempo;
    IF FOUND THEN
        IF v_ex.id_sesion <> s.id_sesion THEN
            PERFORM app.fallar('CAPTURA_EN_OTRA_SESION', 'Esa cámara ya registró una captura en ese instante para otra sesión.');
        END IF;
        RETURN v_ex.id_captura;
    END IF;

    IF s.estatus <> 'abierta' THEN
        PERFORM app.fallar('SESION_NO_ABIERTA', 'La sesión no está abierta; no admite capturas.');
    END IF;
    IF s.modo_registro <> 'automatico' THEN
        PERFORM app.fallar('SESION_NO_AUTOMATICA', 'La sesión es de pase de lista manual; no admite capturas.');
    END IF;
    IF v_cam.estatus <> 'activa' THEN
        PERFORM app.fallar('CAMARA_INACTIVA', 'La cámara no está activa.');
    END IF;
    IF p_marca_tiempo > app.now() + interval '5 minutes' THEN
        PERFORM app.fallar('MARCA_FUTURA', 'La marca de tiempo de la captura está en el futuro.');
    END IF;
    -- RF-03: el muestreo solo corre mientras la ventana de tolerancia este abierta (marca <= inicio + tolerancia).
    IF p_marca_tiempo > app.instante_clase(s.fecha, s.hora_inicio) + make_interval(mins => s.tolerancia_min) THEN
        PERFORM app.fallar('FUERA_DE_VENTANA',
            format('La captura excede la ventana de tolerancia de %s minutos de la sesión.', s.tolerancia_min));
    END IF;

    INSERT INTO public.captura (id_camara, id_sesion, marca_tiempo, rostros_detectados)
    VALUES (p_id_camara, s.id_sesion, p_marca_tiempo, p_rostros)
    RETURNING id_captura INTO v_id;
    RETURN v_id;
END
$$;
COMMENT ON FUNCTION public.svc_crear_captura(integer, integer, timestamptz, integer) IS $c$
Registra la captura de una camara en una sesion automatica abierta (RF-03). Idempotente por (id_camara, marca_tiempo): devuelve el id existente.
ARGS: p_id_sesion integer, p_id_camara integer, p_marca_tiempo timestamptz (<= hora_inicio + tolerancia_min, no futura mas de 5 min), p_rostros integer (0 a 1000). La camara debe ser del aula del grupo y estar activa.
RETURNS: id_captura bigint
ERRORES: NO_ENCONTRADO (sesion), CAMARA_NO_ENCONTRADA, CAMARA_FUERA_DE_AULA (RN-06), CAMARA_INACTIVA, SESION_NO_ABIERTA, SESION_NO_AUTOMATICA, FUERA_DE_VENTANA (pasada la tolerancia), MARCA_FUTURA, CAPTURA_EN_OTRA_SESION, VALIDACION
ROLES: service_role
$c$;
REVOKE ALL ON FUNCTION public.svc_crear_captura(integer, integer, timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.svc_crear_captura(integer, integer, timestamptz, integer) TO service_role;

-- ---------------------------------------------------------------------------------------------
-- svc_registrar_detecciones (RF-04, RF-05, RF-06, RF-07, RF-08; RN-02 a RN-05)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.svc_registrar_detecciones(p_id_captura bigint, p_detecciones jsonb) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    cap         public.captura%ROWTYPE;
    s           public.sesion_clase%ROWTYPE;
    a           public.asistencia%ROWTYPE;
    d           jsonb;
    v_umbral    numeric := app.param_num('umbral_similitud');
    v_min       numeric := app.param_num('min_detecciones_validas');
    v_indice    integer;
    v_i         integer := 0;
    v_faiss     bigint;
    v_score     numeric;
    v_recorte   text;
    v_pl        record;
    v_id_pl     integer;
    v_valida    boolean;
    v_total     integer := 0;
    v_validas   integer := 0;
    v_alumnos   integer[] := ARRAY[]::integer[];
    v_alumno    integer;
    v_n         integer;
    v_creado    boolean;
    v_confirmado boolean;
    v_estado    public.estado_asistencia;
    v_cambios   jsonb := '[]'::jsonb;
BEGIN
    SELECT * INTO cap FROM public.captura k WHERE k.id_captura = p_id_captura;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'La captura no existe.');
    END IF;

    -- Idempotencia: una captura ya procesada devuelve su resumen sin duplicar detecciones ni conteos.
    IF EXISTS (SELECT 1 FROM public.deteccion x WHERE x.id_captura = p_id_captura) THEN
        SELECT count(*)::integer, (count(*) FILTER (WHERE x.es_valida))::integer INTO v_total, v_validas
          FROM public.deteccion x WHERE x.id_captura = p_id_captura;
        RETURN jsonb_build_object('id_captura', p_id_captura, 'rostros', cap.rostros_detectados,
                                  'validas', v_validas, 'no_atribuidas', v_total - v_validas,
                                  'cambios', '[]'::jsonb, 'ya_procesada', true);
    END IF;

    SELECT * INTO s FROM public.sesion_clase x WHERE x.id_sesion = cap.id_sesion FOR NO KEY UPDATE;
    IF s.estatus <> 'abierta' THEN
        PERFORM app.fallar('SESION_NO_ABIERTA', 'La sesión no está abierta; no admite detecciones.');
    END IF;
    IF s.modo_registro <> 'automatico' THEN
        PERFORM app.fallar('SESION_NO_AUTOMATICA', 'La sesión es de pase de lista manual; no admite detecciones.');
    END IF;

    IF p_detecciones IS NULL OR jsonb_typeof(p_detecciones) <> 'array' THEN
        PERFORM app.fallar('VALIDACION', 'p_detecciones debe ser un arreglo JSON de {faiss_id, score, objeto_recorte}.');
    END IF;
    IF jsonb_array_length(p_detecciones) > cap.rostros_detectados THEN
        PERFORM app.fallar('VALIDACION',
            format('Hay %s detecciones y la captura declara solo %s rostros.', jsonb_array_length(p_detecciones), cap.rostros_detectados));
    END IF;

    SELECT f.id_indice INTO v_indice FROM public.indice_faiss f WHERE f.en_uso;

    FOR d IN SELECT x FROM jsonb_array_elements(p_detecciones) AS t(x) LOOP
        v_i := v_i + 1;
        v_faiss := NULL; v_score := NULL; v_recorte := NULL; v_id_pl := NULL; v_valida := false;
        BEGIN
            IF jsonb_typeof(d) <> 'object' THEN
                RAISE EXCEPTION 'no es un objeto';
            END IF;
            v_faiss := (d ->> 'faiss_id')::bigint;
            v_score := (d ->> 'score')::numeric;
            v_recorte := d ->> 'objeto_recorte';
            IF v_faiss IS NOT NULL AND (v_faiss < 0 OR v_score IS NULL OR v_score < 0 OR v_score > 1) THEN
                RAISE EXCEPTION 'faiss_id o score fuera de rango';
            END IF;
            IF v_recorte IS NOT NULL AND char_length(v_recorte) > 255 THEN
                RAISE EXCEPTION 'objeto_recorte demasiado largo';
            END IF;
        EXCEPTION WHEN others THEN
            PERFORM app.fallar('VALIDACION', format('La detección %s no es válida: requiere faiss_id (entero >= 0) con score entre 0 y 1.', v_i));
        END;

        IF v_faiss IS NOT NULL AND v_indice IS NOT NULL THEN
            SELECT p.id_plantilla, p.id_alumno, p.id_consent, p.activa INTO v_pl
              FROM public.plantilla_facial p WHERE p.id_indice = v_indice AND p.faiss_id = v_faiss;
            IF FOUND THEN
                v_id_pl := v_pl.id_plantilla;
                v_score := round(v_score, 3);     -- se compara el valor que se guarda (NUMERIC(4,3))
                -- RN-04 + RF-04/RNF-06 (red de seguridad: el servicio ya filtra los candidatos).
                v_valida := v_score >= v_umbral
                    AND v_pl.activa
                    AND EXISTS (SELECT 1 FROM public.inscripcion i
                                 WHERE i.id_alumno = v_pl.id_alumno AND i.id_grupo = s.id_grupo AND i.estatus = 'activa')
                    AND app.consentimiento_vigente(v_pl.id_consent);
                IF v_valida AND NOT (v_pl.id_alumno = ANY (v_alumnos)) THEN
                    v_alumnos := v_alumnos || v_pl.id_alumno;
                END IF;
            END IF;
        END IF;
        IF v_id_pl IS NULL THEN
            v_score := NULL;                      -- sin candidato: sin score ni lectura valida (ck_deteccion_candidato)
        END IF;

        INSERT INTO public.deteccion (id_captura, id_plantilla, score_similitud, es_valida, objeto_recorte)
        VALUES (p_id_captura, v_id_pl, v_score, v_valida, v_recorte);
        v_total := v_total + 1;
        IF v_valida THEN v_validas := v_validas + 1; END IF;
    END LOOP;

    -- Ciclo de vida de la asistencia (RN-02, RN-03, RN-05): se recalcula desde los datos, asi el conteo es
    -- siempre "capturas distintas" aunque un alumno salga varias veces en la misma captura.
    FOREACH v_alumno IN ARRAY v_alumnos LOOP
        v_n := app.lecturas_validas(s.id_sesion, v_alumno);
        v_creado := false; v_confirmado := false;

        SELECT * INTO a FROM public.asistencia x WHERE x.id_sesion = s.id_sesion AND x.id_alumno = v_alumno FOR UPDATE;
        IF NOT FOUND THEN
            INSERT INTO public.asistencia (id_sesion, id_alumno, estado, hora_registro, origen, conteo_detecciones)
            VALUES (s.id_sesion, v_alumno, 'pendiente', cap.marca_tiempo, 'automatico', v_n)
            RETURNING * INTO a;
            v_creado := true;
        ELSIF a.origen = 'automatico' AND a.estado IN ('pendiente', 'presente', 'retardo') THEN
            UPDATE public.asistencia
               SET conteo_detecciones = greatest(a.conteo_detecciones, v_n),
                   hora_registro = CASE WHEN a.estado = 'pendiente' THEN least(a.hora_registro, cap.marca_tiempo)
                                        ELSE a.hora_registro END
             WHERE id_asistencia = a.id_asistencia
             RETURNING * INTO a;
        ELSE
            CONTINUE;                              -- registro manual/correccion: no se pisa
        END IF;

        -- Confirmacion (RN-05): el estado lo decide la PRIMERA lectura valida, no la que completa el minimo.
        IF a.estado = 'pendiente' AND a.conteo_detecciones >= v_min THEN
            v_estado := coalesce(
                app.estado_por_minuto(s.limite_presente_min, s.tolerancia_min,
                                      app.minuto_de_sesion(s.fecha, s.hora_inicio, a.hora_registro)),
                'retardo'::public.estado_asistencia);
            UPDATE public.asistencia SET estado = v_estado WHERE id_asistencia = a.id_asistencia
             RETURNING * INTO a;
            v_confirmado := true;
        END IF;

        v_cambios := v_cambios || jsonb_build_array(jsonb_build_object(
            'id_alumno', a.id_alumno, 'estado', a.estado, 'lecturas_validas', v_n,
            'hora_registro', a.hora_registro, 'creado', v_creado, 'confirmado', v_confirmado));
    END LOOP;

    RETURN jsonb_build_object('id_captura', p_id_captura, 'rostros', cap.rostros_detectados,
                              'validas', v_validas, 'no_atribuidas', v_total - v_validas,
                              'cambios', v_cambios, 'ya_procesada', false);
END
$$;
COMMENT ON FUNCTION public.svc_registrar_detecciones(bigint, jsonb) IS $c$
Registra las detecciones de una captura y aplica el ciclo de vida de la asistencia (RN-02 a RN-05, RF-04 a RF-08).
ARGS: p_id_captura bigint, p_detecciones jsonb = [{faiss_id:int|null, score:numeric|null, objeto_recorte:text|null}] (no mas que los rostros de la captura). Resuelve faiss_id con el indice en uso (sin resolver = sin candidato). Guarda SIEMPRE candidato y score; es_valida = score (a 3 decimales) >= umbral_similitud (0.849 no, 0.850 si) y el candidato esta inscrito, activo y con consentimiento vigente. La 1.a valida de un alumno crea pendiente (origen automatico, hora_registro = marca de la captura); lecturas en capturas distintas suben conteo_detecciones; al llegar a min_detecciones_validas pasa a presente (1.a lectura antes de limite_presente_min) o retardo (hasta tolerancia_min). No pisa registros manuales ni correcciones. Idempotente por captura.
RETURNS: {id_captura,rostros,validas,no_atribuidas,cambios:[{id_alumno,estado,lecturas_validas,hora_registro,creado,confirmado}],ya_procesada}
ERRORES: NO_ENCONTRADO (captura), SESION_NO_ABIERTA, SESION_NO_AUTOMATICA, VALIDACION (arreglo mal formado, score fuera de 0..1, mas detecciones que rostros)
ROLES: service_role
$c$;
REVOKE ALL ON FUNCTION public.svc_registrar_detecciones(bigint, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.svc_registrar_detecciones(bigint, jsonb) TO service_role;
