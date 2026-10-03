-- 0232 · RPC de la consola tecnica (docs/api/biometria.md 3.7 a 3.11): estado del indice, parametros
-- del sistema y camaras. Son SECURITY DEFINER aunque sean de lectura (agregan sobre tablas que el
-- tecnico no puede leer) con comprobacion explicita de rol; no devuelven datos personales.

-- ---------------------------------------------------------------------------------------------
-- 3.7 api_indice_estado
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_indice_estado(
    p_limit  integer DEFAULT 10,
    p_offset integer DEFAULT 0
) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_limit      integer := least(greatest(coalesce(p_limit, 10), 1), 200);
    v_offset     integer := greatest(coalesce(p_offset, 0), 0);
    v_dim        integer;
    v_uso        public.indice_faiss%ROWTYPE;
    v_activas    integer;
    v_indexadas  integer;
    v_pend       integer;
    v_obs        integer;
    v_detalle    jsonb;
    v_ver_total  integer;
    v_versiones  jsonb;
BEGIN
    PERFORM app.exigir_rol('tecnico', 'administrador');
    v_dim := app.param_num('dimension_vector')::integer;
    SELECT * INTO v_uso FROM public.indice_faiss WHERE en_uso;

    SELECT count(*) FILTER (WHERE activa),
           count(*) FILTER (WHERE activa AND id_indice IS NOT NULL),
           count(*) FILTER (WHERE activa AND id_indice IS NULL),
           count(*) FILTER (WHERE NOT activa AND v_uso.id_indice IS NOT NULL AND id_indice = v_uso.id_indice)
      INTO v_activas, v_indexadas, v_pend, v_obs
      FROM public.plantilla_facial;

    SELECT coalesce(jsonb_agg(jsonb_build_object('id_plantilla', q.id_plantilla, 'id_alumno', q.id_alumno,
                                                 'fecha_registro', q.fecha_registro)
                              ORDER BY q.fecha_registro, q.id_plantilla), '[]'::jsonb)
      INTO v_detalle
      FROM (SELECT id_plantilla, id_alumno, fecha_registro FROM public.plantilla_facial
             WHERE activa AND id_indice IS NULL ORDER BY fecha_registro, id_plantilla LIMIT 20) q;

    SELECT count(*) INTO v_ver_total FROM public.indice_faiss;
    SELECT coalesce(jsonb_agg(q.item ORDER BY q.fecha_construccion DESC, q.id_indice DESC), '[]'::jsonb) INTO v_versiones
      FROM (
        SELECT i.id_indice, i.fecha_construccion,
               jsonb_build_object('id_indice', i.id_indice, 'version', i.version, 'dimension', i.dimension,
                                  'total_vectores', i.total_vectores, 'fecha_construccion', i.fecha_construccion,
                                  'en_uso', i.en_uso) AS item
          FROM public.indice_faiss i
         ORDER BY i.fecha_construccion DESC, i.id_indice DESC
         LIMIT v_limit OFFSET v_offset
      ) q;

    RETURN jsonb_build_object(
        'en_uso', CASE WHEN v_uso.id_indice IS NULL THEN NULL
                       ELSE jsonb_build_object('id_indice', v_uso.id_indice, 'version', v_uso.version,
                                               'dimension', v_uso.dimension, 'total_vectores', v_uso.total_vectores,
                                               'fecha_construccion', v_uso.fecha_construccion) END,
        'dimension_configurada', v_dim,
        'dimension_coincide', CASE WHEN v_uso.id_indice IS NULL THEN NULL ELSE v_uso.dimension = v_dim END,
        'plantillas', jsonb_build_object('activas', v_activas, 'indexadas', v_indexadas,
                                         'pendientes', v_pend, 'obsoletas_en_indice', v_obs),
        'requiere_reconstruccion', (v_pend > 0 OR v_obs > 0 OR v_uso.id_indice IS NULL),
        'pendientes_detalle', v_detalle,
        'versiones', jsonb_build_object('total', v_ver_total, 'items', v_versiones));
END
$$;
COMMENT ON FUNCTION public.api_indice_estado(integer, integer) IS
'Estado del indice facial: version en uso, contadores de plantillas (activas, indexadas, pendientes, obsoletas), si requiere reconstruccion y versiones.
ARGS: p_limit (def. 10, max 200; versiones), p_offset
RETURNS: {"en_uso":{"id_indice":3,"version":"v003","dimension":512,"total_vectores":498,"fecha_construccion":"..."}|null,"dimension_configurada":512,"dimension_coincide":true,"plantillas":{"activas":500,"indexadas":498,"pendientes":2,"obsoletas_en_indice":0},"requiere_reconstruccion":true,"pendientes_detalle":[{"id_plantilla":41,"id_alumno":17,"fecha_registro":"..."}],"versiones":{"total":3,"items":[{"id_indice":3,"version":"v003","dimension":512,"total_vectores":498,"fecha_construccion":"...","en_uso":true}]}}
ERRORES: NO_AUTORIZADO
ROLES: tecnico, administrador';
REVOKE ALL ON FUNCTION public.api_indice_estado(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_indice_estado(integer, integer) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3.8 api_parametros_listar
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_parametros_listar(
    p_limit  integer DEFAULT 50,
    p_offset integer DEFAULT 0
) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_limit  integer := least(greatest(coalesce(p_limit, 50), 1), 200);
    v_offset integer := greatest(coalesce(p_offset, 0), 0);
    v_total  integer;
    v_items  jsonb;
BEGIN
    PERFORM app.exigir_rol('tecnico', 'administrador');
    SELECT count(*) INTO v_total FROM public.parametro_sistema;

    SELECT coalesce(jsonb_agg(q.item ORDER BY q.orden, q.clave), '[]'::jsonb) INTO v_items
      FROM (
        SELECT coalesce(m.orden, 1000) AS orden, p.clave,
               jsonb_build_object(
                   'clave', p.clave,
                   'valor', p.valor,
                   'tipo', m.tipo,
                   'minimo', m.minimo,
                   'maximo', m.maximo,
                   'unidad', m.unidad,
                   'descripcion', p.descripcion,
                   'actualizado_por', CASE WHEN u.id_usuario IS NULL THEN NULL
                                           ELSE jsonb_build_object('id_usuario', u.id_usuario, 'correo', u.correo) END,
                   'fecha_actualizacion', p.fecha_actualizacion) AS item
          FROM public.parametro_sistema p
          LEFT JOIN app.parametro_meta m ON m.clave = p.clave
          LEFT JOIN public.usuario u ON u.id_usuario = p.actualizado_por
         ORDER BY coalesce(m.orden, 1000), p.clave
         LIMIT v_limit OFFSET v_offset
      ) q;

    RETURN jsonb_build_object('total', v_total, 'items', v_items);
END
$$;
COMMENT ON FUNCTION public.api_parametros_listar(integer, integer) IS
'Parametros del sistema con tipo, rango, unidad y ultimo editor, en el orden de la Tabla 4.
ARGS: p_limit (def. 50, max 200), p_offset
RETURNS: {"total":12,"items":[{"clave":"umbral_similitud","valor":"0.850","tipo":"decimal","minimo":"0.500","maximo":"0.999","unidad":"score","descripcion":"...","actualizado_por":{"id_usuario":3,"correo":"tecnico@example.test"}|null,"fecha_actualizacion":"..."}]}
ERRORES: NO_AUTORIZADO
ROLES: tecnico, administrador (solo lectura)';
REVOKE ALL ON FUNCTION public.api_parametros_listar(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_parametros_listar(integer, integer) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3.9 api_parametro_actualizar: solo tecnico (Tabla 36). Valor canonico, bitacora cambio_parametro.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_parametro_actualizar(
    p_clave text,
    p_valor text,
    p_ip    inet DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    p          public.parametro_sistema%ROWTYPE;
    v_canon    text;
    v_tipo     text;
    v_avisos   jsonb := '[]'::jsonb;
    v_usuario  integer := app.id_usuario();
    v_correo   text;
    v_ant      text;
    v_fecha    timestamptz;
BEGIN
    PERFORM app.exigir_rol('tecnico');

    SELECT * INTO p FROM public.parametro_sistema WHERE clave = p_clave FOR UPDATE;
    IF NOT FOUND THEN
        PERFORM app.fallar('PARAMETRO_NO_ENCONTRADO', 'El parámetro no existe.');
    END IF;

    v_canon := app.validar_parametro(p_clave, p_valor);
    SELECT m.tipo INTO v_tipo FROM app.parametro_meta m WHERE m.clave = p_clave;

    IF v_canon = p.valor THEN
        SELECT u.correo INTO v_correo FROM public.usuario u WHERE u.id_usuario = p.actualizado_por;
        RETURN jsonb_build_object(
            'clave', p.clave, 'valor_anterior', p.valor, 'valor', p.valor, 'cambio', false, 'tipo', v_tipo,
            'advertencias', '[]'::jsonb, 'fecha_actualizacion', p.fecha_actualizacion,
            'actualizado_por', CASE WHEN p.actualizado_por IS NULL THEN NULL
                                    ELSE jsonb_build_object('id_usuario', p.actualizado_por, 'correo', v_correo) END);
    END IF;

    v_ant := p.valor;
    v_fecha := app.now();
    UPDATE public.parametro_sistema
       SET valor = v_canon, actualizado_por = v_usuario, fecha_actualizacion = v_fecha
     WHERE clave = p_clave;

    PERFORM app.bitacora('cambio_parametro', 'parametro_sistema', 0,
        jsonb_build_object('clave', p_clave, 'valor', v_ant),
        jsonb_build_object('clave', p_clave, 'valor', v_canon), p_ip);

    v_avisos := CASE
        WHEN p_clave = 'dimension_vector' THEN
            to_jsonb(ARRAY['Cambiar la dimensión exige cambiar el modelo y reconstruir el índice completo.'])
        WHEN p_clave IN ('tolerancia_min', 'limite_presente_min', 'intervalo_muestreo_seg') THEN
            to_jsonb(ARRAY['Solo afecta a las sesiones que se programen después de este cambio.'])
        WHEN p_clave IN ('umbral_similitud', 'min_detecciones_validas') THEN
            to_jsonb(ARRAY['Aplica a las capturas siguientes; las detecciones ya registradas conservan su validez.'])
        ELSE '[]'::jsonb END;

    SELECT u.correo INTO v_correo FROM public.usuario u WHERE u.id_usuario = v_usuario;
    RETURN jsonb_build_object(
        'clave', p_clave, 'valor_anterior', v_ant, 'valor', v_canon, 'cambio', true, 'tipo', v_tipo,
        'advertencias', v_avisos, 'fecha_actualizacion', v_fecha,
        'actualizado_por', jsonb_build_object('id_usuario', v_usuario, 'correo', v_correo));
END
$$;
COMMENT ON FUNCTION public.api_parametro_actualizar(text, text, inet) IS
'Cambia un parametro del sistema (RNF-02): valida tipo, rango y coherencia, guarda el valor canonico y asienta cambio_parametro. Sin cambio real no escribe ni asienta.
ARGS: p_clave, p_valor (texto), p_ip (opc.)
RETURNS: {"clave":"umbral_similitud","valor_anterior":"0.850","valor":"0.900","cambio":true,"tipo":"decimal","advertencias":["..."],"fecha_actualizacion":"...","actualizado_por":{"id_usuario":3,"correo":"tecnico@example.test"}}
ERRORES: NO_AUTORIZADO (solo tecnico), PARAMETRO_NO_ENCONTRADO, PARAMETRO_VALOR_INVALIDO (tipo, rango o coherencia)
ROLES: tecnico';
REVOKE ALL ON FUNCTION public.api_parametro_actualizar(text, text, inet) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_parametro_actualizar(text, text, inet) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3.10 api_camaras_estado
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_camaras_estado(
    p_estatus public.estatus_camara DEFAULT NULL,
    p_limit   integer DEFAULT 50,
    p_offset  integer DEFAULT 0
) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_limit  integer := least(greatest(coalesce(p_limit, 50), 1), 200);
    v_offset integer := greatest(coalesce(p_offset, 0), 0);
    v_total  integer;
    v_items  jsonb;
BEGIN
    PERFORM app.exigir_rol('tecnico', 'administrador');
    SELECT count(*) INTO v_total FROM public.camara c WHERE p_estatus IS NULL OR c.estatus = p_estatus;

    SELECT coalesce(jsonb_agg(q.item ORDER BY q.clave, q.posicion), '[]'::jsonb) INTO v_items
      FROM (
        SELECT a.clave, c.posicion,
               jsonb_build_object(
                   'id_camara', c.id_camara,
                   'id_aula', c.id_aula,
                   'aula_clave', a.clave,
                   'edificio', a.edificio,
                   'posicion', c.posicion,
                   'tipo', c.tipo,
                   'direccion_ip', c.direccion_ip,
                   'estatus', c.estatus,
                   'ultima_captura', (SELECT max(k.marca_tiempo) FROM public.captura k WHERE k.id_camara = c.id_camara),
                   'capturas_24h', (SELECT count(*) FROM public.captura k
                                     WHERE k.id_camara = c.id_camara AND k.marca_tiempo >= app.now() - interval '24 hours'),
                   'sesion_abierta', EXISTS (SELECT 1 FROM public.sesion_clase s
                                               JOIN public.grupo g ON g.id_grupo = s.id_grupo
                                              WHERE g.id_aula = c.id_aula AND s.estatus = 'abierta')) AS item
          FROM public.camara c
          JOIN public.aula a ON a.id_aula = c.id_aula
         WHERE p_estatus IS NULL OR c.estatus = p_estatus
         ORDER BY a.clave, c.posicion
         LIMIT v_limit OFFSET v_offset
      ) q;

    RETURN jsonb_build_object('total', v_total, 'items', v_items);
END
$$;
COMMENT ON FUNCTION public.api_camaras_estado(public.estatus_camara, integer, integer) IS
'Camaras con su estatus, ultima captura, capturas de las ultimas 24 h y si hay sesion abierta en el aula.
ARGS: p_estatus (activa | inactiva | mantenimiento; NULL = todas), p_limit (def. 50, max 200), p_offset
RETURNS: {"total":2,"items":[{"id_camara":4,"id_aula":2,"aula_clave":"A-12","edificio":"A","posicion":"frente","tipo":"ip","direccion_ip":"10.20.4.21"|null,"estatus":"activa","ultima_captura":"..."|null,"capturas_24h":160,"sesion_abierta":true}]}
ERRORES: NO_AUTORIZADO
ROLES: tecnico, administrador';
REVOKE ALL ON FUNCTION public.api_camaras_estado(public.estatus_camara, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_camaras_estado(public.estatus_camara, integer, integer) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3.11 api_camara_cambiar_estatus: escribe SOLO camara.estatus. No altera sesiones abiertas.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_camara_cambiar_estatus(
    p_id_camara integer,
    p_estatus   public.estatus_camara
) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    c        public.camara%ROWTYPE;
    v_avisos jsonb := '[]'::jsonb;
BEGIN
    PERFORM app.exigir_rol('tecnico', 'administrador');
    IF p_estatus IS NULL THEN
        PERFORM app.fallar('VALIDACION', 'Estatus de cámara no válido.');
    END IF;

    SELECT * INTO c FROM public.camara WHERE id_camara = p_id_camara FOR UPDATE;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'La cámara no existe.');
    END IF;

    IF c.estatus = p_estatus THEN
        RETURN jsonb_build_object('id_camara', c.id_camara, 'id_aula', c.id_aula, 'posicion', c.posicion,
            'estatus_anterior', c.estatus, 'estatus', c.estatus, 'cambio', false, 'advertencias', v_avisos);
    END IF;

    UPDATE public.camara SET estatus = p_estatus WHERE id_camara = p_id_camara;

    IF EXISTS (SELECT 1 FROM public.sesion_clase s JOIN public.grupo g ON g.id_grupo = s.id_grupo
                WHERE g.id_aula = c.id_aula AND s.estatus = 'abierta') THEN
        v_avisos := to_jsonb(ARRAY['Hay una sesión abierta en el aula; su modo de registro no cambia.']);
    END IF;

    RETURN jsonb_build_object('id_camara', c.id_camara, 'id_aula', c.id_aula, 'posicion', c.posicion,
        'estatus_anterior', c.estatus, 'estatus', p_estatus, 'cambio', true, 'advertencias', v_avisos);
END
$$;
COMMENT ON FUNCTION public.api_camara_cambiar_estatus(integer, public.estatus_camara) IS
'Cambia solo el estatus de una camara (RF-22). El modo de las sesiones ya abiertas no cambia; las nuevas lo deciden con las camaras activas (RN-06).
ARGS: p_id_camara, p_estatus (activa | inactiva | mantenimiento)
RETURNS: {"id_camara":5,"id_aula":2,"posicion":"fondo","estatus_anterior":"activa","estatus":"mantenimiento","cambio":true,"advertencias":["..."]}
ERRORES: NO_AUTORIZADO, NO_ENCONTRADO (camara), VALIDACION (estatus nulo)
ROLES: tecnico, administrador';
REVOKE ALL ON FUNCTION public.api_camara_cambiar_estatus(integer, public.estatus_camara) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_camara_cambiar_estatus(integer, public.estatus_camara) TO authenticated;
