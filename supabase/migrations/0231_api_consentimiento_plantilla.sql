-- 0231 · RPC de consentimiento y plantilla facial (docs/api/biometria.md 3.1 a 3.6).
-- RF-15, RF-16, RF-19, RN-12, RN-13, RNF-04. Solo administrador. Escrituras DEFINER; lecturas INVOKER (RLS).
-- Ningun api_* devuelve vectores (no existen en la BD) ni objeto_* salvo api_documento_url_autorizar.

-- ---------------------------------------------------------------------------------------------
-- 3.1 api_consentimiento_registrar
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_consentimiento_registrar(
    p_id_alumno        integer,
    p_fecha_firma      date,
    p_vigencia_hasta   date,
    p_objeto_documento text,
    p_ip               inet DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_estatus public.estatus_alumno;
    v_hoy     date;
    c         public.consentimiento%ROWTYPE;
BEGIN
    PERFORM app.exigir_rol('administrador');
    v_hoy := app.hoy();

    SELECT a.estatus INTO v_estatus FROM public.alumno a WHERE a.id_alumno = p_id_alumno;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El alumno no existe.');
    END IF;
    IF v_estatus <> 'activo' THEN
        PERFORM app.fallar('ALUMNO_INACTIVO', 'El alumno no tiene estatus activo.');
    END IF;

    IF p_fecha_firma IS NULL OR p_vigencia_hasta IS NULL THEN
        PERFORM app.fallar('VALIDACION', 'La fecha de firma y la vigencia son obligatorias.');
    END IF;
    IF p_fecha_firma > v_hoy THEN
        PERFORM app.fallar('VALIDACION', 'La fecha de firma no puede ser futura.');
    END IF;
    IF p_vigencia_hasta <= p_fecha_firma THEN
        PERFORM app.fallar('VALIDACION', 'La vigencia debe ser posterior a la fecha de firma.');
    END IF;
    IF p_vigencia_hasta < v_hoy THEN
        PERFORM app.fallar('VALIDACION', 'La vigencia ya terminó.');
    END IF;
    IF NOT app.es_ruta_objeto(p_objeto_documento, 'consentimientos', p_id_alumno, 'pdf') THEN
        PERFORM app.fallar('RUTA_INVALIDA', 'La ruta del archivo no es válida para este registro.');
    END IF;

    INSERT INTO public.consentimiento (id_alumno, fecha_firma, vigencia_hasta, objeto_documento, estatus)
    VALUES (p_id_alumno, p_fecha_firma, p_vigencia_hasta, p_objeto_documento, 'vigente')
    RETURNING * INTO c;

    RETURN jsonb_build_object(
        'id_consent', c.id_consent,
        'id_alumno', c.id_alumno,
        'fecha_firma', c.fecha_firma,
        'vigencia_hasta', c.vigencia_hasta,
        'estatus', c.estatus,
        'vigente', app.consentimiento_vigente(c.id_consent));
END
$$;
COMMENT ON FUNCTION public.api_consentimiento_registrar(integer, date, date, text, inet) IS
'Registra un consentimiento firmado (RN-13); conserva el historial.
ARGS: p_id_alumno, p_fecha_firma (<= hoy), p_vigencia_hasta (> firma y >= hoy), p_objeto_documento (consentimientos/{id_alumno}/{uuid}.pdf), p_ip (opc.)
RETURNS: {"id_consent":9,"id_alumno":17,"fecha_firma":"2026-08-24","vigencia_hasta":"2027-08-23","estatus":"vigente","vigente":true}
ERRORES: NO_AUTORIZADO (no es administrador), NO_ENCONTRADO (alumno), ALUMNO_INACTIVO, VALIDACION (fechas), RUTA_INVALIDA
ROLES: administrador';
REVOKE ALL ON FUNCTION public.api_consentimiento_registrar(integer, date, date, text, inet) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_consentimiento_registrar(integer, date, date, text, inet) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3.2 api_consentimiento_revocar: revoca y archiva las plantillas ligadas (RNF-06; el vector sale
-- del indice en la siguiente reconstruccion). Una sola transaccion.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_consentimiento_revocar(
    p_id_consent integer,
    p_ip         inet DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    c             public.consentimiento%ROWTYPE;
    v_archivadas  integer;
    v_indexadas   integer;
BEGIN
    PERFORM app.exigir_rol('administrador');

    SELECT * INTO c FROM public.consentimiento WHERE id_consent = p_id_consent FOR UPDATE;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El consentimiento no existe.');
    END IF;
    IF c.estatus <> 'vigente' THEN
        PERFORM app.fallar('RN_13_CONSENTIMIENTO_NO_VIGENTE',
            format('El consentimiento ya no está vigente (estatus: %s).', c.estatus));
    END IF;

    UPDATE public.consentimiento SET estatus = 'revocado' WHERE id_consent = p_id_consent;

    WITH arch AS (
        UPDATE public.plantilla_facial SET activa = false
         WHERE id_consent = p_id_consent AND activa
        RETURNING id_indice)
    SELECT count(*), count(id_indice) INTO v_archivadas, v_indexadas FROM arch;

    RETURN jsonb_build_object(
        'id_consent', c.id_consent,
        'id_alumno', c.id_alumno,
        'estatus', 'revocado',
        'plantillas_archivadas', v_archivadas,
        'requiere_reconstruccion', v_indexadas > 0);
END
$$;
COMMENT ON FUNCTION public.api_consentimiento_revocar(integer, inet) IS
'Revoca un consentimiento vigente y archiva sus plantillas activas (el alumno pasa a pase manual).
ARGS: p_id_consent, p_ip (opc.)
RETURNS: {"id_consent":9,"id_alumno":17,"estatus":"revocado","plantillas_archivadas":1,"requiere_reconstruccion":true}
ERRORES: NO_AUTORIZADO, NO_ENCONTRADO (consentimiento), RN_13_CONSENTIMIENTO_NO_VIGENTE (ya revocado o vencido)
ROLES: administrador';
REVOKE ALL ON FUNCTION public.api_consentimiento_revocar(integer, inet) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_consentimiento_revocar(integer, inet) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3.3 api_consentimientos_alumno (INVOKER: la RLS del administrador lee consentimiento/plantilla)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_consentimientos_alumno(
    p_id_alumno integer,
    p_limit     integer DEFAULT 50,
    p_offset    integer DEFAULT 0
) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_limit   integer := least(greatest(coalesce(p_limit, 50), 1), 200);
    v_offset  integer := greatest(coalesce(p_offset, 0), 0);
    v_hoy     date;
    v_total   integer;
    v_items   jsonb;
    v_vigente jsonb;
BEGIN
    PERFORM app.exigir_rol('administrador');
    v_hoy := app.hoy();

    IF NOT EXISTS (SELECT 1 FROM public.alumno WHERE id_alumno = p_id_alumno) THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El alumno no existe.');
    END IF;

    SELECT count(*) INTO v_total FROM public.consentimiento WHERE id_alumno = p_id_alumno;

    SELECT coalesce(jsonb_agg(q.item ORDER BY q.fecha_firma DESC, q.id_consent DESC), '[]'::jsonb) INTO v_items
      FROM (
        SELECT c.id_consent, c.fecha_firma,
               jsonb_build_object(
                   'id_consent', c.id_consent,
                   'fecha_firma', c.fecha_firma,
                   'vigencia_hasta', c.vigencia_hasta,
                   'estatus', c.estatus,
                   'estatus_efectivo', CASE WHEN c.estatus = 'revocado' THEN 'revocado'
                                            WHEN app.consentimiento_vigente(c.id_consent) THEN 'vigente'
                                            ELSE 'vencido' END,
                   'vigente', app.consentimiento_vigente(c.id_consent),
                   'dias_restantes', CASE WHEN app.consentimiento_vigente(c.id_consent)
                                          THEN c.vigencia_hasta - v_hoy END,
                   'plantillas_activas', (SELECT count(*) FROM public.plantilla_facial p
                                           WHERE p.id_consent = c.id_consent AND p.activa),
                   'tiene_documento', (c.objeto_documento IS NOT NULL AND length(c.objeto_documento) > 0)
               ) AS item
          FROM public.consentimiento c
         WHERE c.id_alumno = p_id_alumno
         ORDER BY c.fecha_firma DESC, c.id_consent DESC
         LIMIT v_limit OFFSET v_offset
      ) q;

    SELECT jsonb_build_object('id_consent', c.id_consent, 'fecha_firma', c.fecha_firma,
                              'vigencia_hasta', c.vigencia_hasta, 'dias_restantes', c.vigencia_hasta - v_hoy)
      INTO v_vigente
      FROM public.consentimiento c
     WHERE c.id_alumno = p_id_alumno AND app.consentimiento_vigente(c.id_consent)
     ORDER BY c.vigencia_hasta DESC, c.id_consent DESC
     LIMIT 1;

    RETURN jsonb_build_object(
        'id_alumno', p_id_alumno,
        'vigente', v_vigente IS NOT NULL,
        'consentimiento_vigente', v_vigente,
        'total', v_total,
        'items', v_items);
END
$$;
COMMENT ON FUNCTION public.api_consentimientos_alumno(integer, integer, integer) IS
'Historial de consentimientos de un alumno y el vigente (mayor vigencia_hasta).
ARGS: p_id_alumno, p_limit (def. 50, max 200), p_offset
RETURNS: {"id_alumno":17,"vigente":true,"consentimiento_vigente":{"id_consent":9,"fecha_firma":"2026-08-24","vigencia_hasta":"2027-08-23","dias_restantes":344},"total":2,"items":[{"id_consent":9,"fecha_firma":"2026-08-24","vigencia_hasta":"2027-08-23","estatus":"vigente","estatus_efectivo":"vigente","vigente":true,"dias_restantes":344,"plantillas_activas":1,"tiene_documento":true}]}
ERRORES: NO_AUTORIZADO, NO_ENCONTRADO (alumno)
ROLES: administrador';
REVOKE ALL ON FUNCTION public.api_consentimientos_alumno(integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_consentimientos_alumno(integer, integer, integer) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3.4 api_plantilla_registrar: archivar la anterior ANTES de insertar (ux_plantilla_facial_activa
-- no es diferible). Valida todo antes; trg_plantilla_rn13 es solo red de seguridad.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_plantilla_registrar(
    p_id_alumno   integer,
    p_id_consent  integer,
    p_objeto_foto text,
    p_ip          inet DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_estatus   public.estatus_alumno;
    c           public.consentimiento%ROWTYPE;
    v_ant_id    integer;
    v_ant_cons  integer;
    v_nueva     public.plantilla_facial%ROWTYPE;
BEGIN
    PERFORM app.exigir_rol('administrador');

    -- Serializa altas concurrentes del mismo alumno.
    SELECT a.estatus INTO v_estatus FROM public.alumno a WHERE a.id_alumno = p_id_alumno FOR UPDATE;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El alumno no existe.');
    END IF;
    IF v_estatus <> 'activo' THEN
        PERFORM app.fallar('ALUMNO_INACTIVO', 'El alumno no tiene estatus activo.');
    END IF;

    IF NOT app.es_ruta_objeto(p_objeto_foto, 'registro', p_id_alumno, 'jpg') THEN
        PERFORM app.fallar('RUTA_INVALIDA', 'La ruta del archivo no es válida para este registro.');
    END IF;

    SELECT * INTO c FROM public.consentimiento WHERE id_consent = p_id_consent;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El consentimiento no existe.');
    END IF;
    IF c.id_alumno <> p_id_alumno THEN
        PERFORM app.fallar('RN_13_CONSENTIMIENTO_AJENO', 'El consentimiento pertenece a otro alumno.');
    END IF;
    IF NOT app.consentimiento_vigente(p_id_consent) THEN
        PERFORM app.fallar('RN_13_CONSENTIMIENTO_NO_VIGENTE',
            'El consentimiento no está firmado y vigente: la alta se rechaza.');
    END IF;

    -- 1) archivar; 2) insertar.
    SELECT p.id_plantilla, p.id_consent INTO v_ant_id, v_ant_cons
      FROM public.plantilla_facial p WHERE p.id_alumno = p_id_alumno AND p.activa;
    UPDATE public.plantilla_facial SET activa = false WHERE id_alumno = p_id_alumno AND activa;

    INSERT INTO public.plantilla_facial (id_alumno, id_consent, id_indice, faiss_id, objeto_foto, fecha_registro, activa)
    VALUES (p_id_alumno, p_id_consent, NULL, NULL, p_objeto_foto, app.now(), true)
    RETURNING * INTO v_nueva;

    PERFORM app.bitacora('alta_plantilla', 'plantilla_facial', v_nueva.id_plantilla,
        CASE WHEN v_ant_id IS NULL THEN NULL
             ELSE jsonb_build_object('id_plantilla', v_ant_id, 'id_consent', v_ant_cons, 'activa', true) END,
        jsonb_build_object('id_plantilla', v_nueva.id_plantilla, 'id_consent', p_id_consent,
                           'objeto_foto', p_objeto_foto, 'activa', true, 'plantilla_archivada', v_ant_id),
        p_ip);

    RETURN jsonb_build_object(
        'id_plantilla', v_nueva.id_plantilla,
        'id_alumno', p_id_alumno,
        'id_consent', p_id_consent,
        'activa', true,
        'indexada', false,
        'plantilla_archivada', v_ant_id,
        'fecha_registro', v_nueva.fecha_registro,
        'requiere_reconstruccion', true);
END
$$;
COMMENT ON FUNCTION public.api_plantilla_registrar(integer, integer, text, inet) IS
'Da de alta la plantilla facial (RN-12/RN-13): archiva la activa anterior, inserta la nueva sin indexar y asienta alta_plantilla.
ARGS: p_id_alumno, p_id_consent (vigente y del mismo alumno), p_objeto_foto (registro/{id_alumno}/{uuid}.jpg), p_ip (opc.)
RETURNS: {"id_plantilla":41,"id_alumno":17,"id_consent":9,"activa":true,"indexada":false,"plantilla_archivada":33,"fecha_registro":"2026-09-14T09:12:41-06:00","requiere_reconstruccion":true}
ERRORES: NO_AUTORIZADO, NO_ENCONTRADO (alumno o consentimiento), ALUMNO_INACTIVO, RUTA_INVALIDA, RN_13_CONSENTIMIENTO_AJENO, RN_13_CONSENTIMIENTO_NO_VIGENTE
ROLES: administrador';
REVOKE ALL ON FUNCTION public.api_plantilla_registrar(integer, integer, text, inet) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_plantilla_registrar(integer, integer, text, inet) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3.5 api_plantilla_alumno (INVOKER)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_plantilla_alumno(
    p_id_alumno integer,
    p_limit     integer DEFAULT 50,
    p_offset    integer DEFAULT 0
) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_limit    integer := least(greatest(coalesce(p_limit, 50), 1), 200);
    v_offset   integer := greatest(coalesce(p_offset, 0), 0);
    v_uso      public.indice_faiss%ROWTYPE;
    v_activa   jsonb;
    v_arch_tot integer;
    v_arch     jsonb;
BEGIN
    PERFORM app.exigir_rol('administrador');
    IF NOT EXISTS (SELECT 1 FROM public.alumno WHERE id_alumno = p_id_alumno) THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El alumno no existe.');
    END IF;

    SELECT * INTO v_uso FROM public.indice_faiss WHERE en_uso;

    SELECT jsonb_build_object(
               'id_plantilla', p.id_plantilla,
               'id_consent', p.id_consent,
               'fecha_registro', p.fecha_registro,
               'indexada', p.id_indice IS NOT NULL,
               'id_indice', p.id_indice,
               'version_indice', i.version,
               'faiss_id', p.faiss_id,
               'en_uso', (p.id_indice IS NOT NULL AND p.id_indice = v_uso.id_indice),
               'consentimiento_vigente', app.consentimiento_vigente(p.id_consent))
      INTO v_activa
      FROM public.plantilla_facial p
      LEFT JOIN public.indice_faiss i ON i.id_indice = p.id_indice
     WHERE p.id_alumno = p_id_alumno AND p.activa;

    SELECT count(*) INTO v_arch_tot FROM public.plantilla_facial WHERE id_alumno = p_id_alumno AND NOT activa;
    SELECT coalesce(jsonb_agg(q.item ORDER BY q.fecha_registro DESC, q.id_plantilla DESC), '[]'::jsonb) INTO v_arch
      FROM (
        SELECT p.id_plantilla, p.fecha_registro,
               jsonb_build_object('id_plantilla', p.id_plantilla, 'id_consent', p.id_consent,
                                  'fecha_registro', p.fecha_registro) AS item
          FROM public.plantilla_facial p
         WHERE p.id_alumno = p_id_alumno AND NOT p.activa
         ORDER BY p.fecha_registro DESC, p.id_plantilla DESC
         LIMIT v_limit OFFSET v_offset
      ) q;

    RETURN jsonb_build_object(
        'id_alumno', p_id_alumno,
        'activa', v_activa,
        'archivadas', jsonb_build_object('total', v_arch_tot, 'items', v_arch),
        'indice_en_uso', CASE WHEN v_uso.id_indice IS NULL THEN NULL
                              ELSE jsonb_build_object('id_indice', v_uso.id_indice, 'version', v_uso.version) END);
END
$$;
COMMENT ON FUNCTION public.api_plantilla_alumno(integer, integer, integer) IS
'Plantilla facial activa de un alumno (con su version de indice) y las archivadas paginadas.
ARGS: p_id_alumno, p_limit (def. 50, max 200; aplica a archivadas), p_offset
RETURNS: {"id_alumno":17,"activa":{"id_plantilla":41,"id_consent":9,"fecha_registro":"...","indexada":true,"id_indice":3,"version_indice":"v003","faiss_id":1042,"en_uso":true,"consentimiento_vigente":true}|null,"archivadas":{"total":1,"items":[{"id_plantilla":33,"id_consent":4,"fecha_registro":"..."}]},"indice_en_uso":{"id_indice":3,"version":"v003"}|null}
ERRORES: NO_AUTORIZADO, NO_ENCONTRADO (alumno)
ROLES: administrador';
REVOKE ALL ON FUNCTION public.api_plantilla_alumno(integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_plantilla_alumno(integer, integer, integer) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3.6 api_documento_url_autorizar: cada emision de URL asienta 'consulta' (RF-19, RNF-08).
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_documento_url_autorizar(
    p_tipo        text,
    p_id_registro integer,
    p_ip          inet DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_alumno integer;
    v_objeto text;
BEGIN
    PERFORM app.exigir_rol('administrador');

    IF p_tipo IS NULL OR p_tipo NOT IN ('consentimiento', 'plantilla') THEN
        PERFORM app.fallar('VALIDACION', 'Tipo de documento no válido.');
    END IF;

    IF p_tipo = 'consentimiento' THEN
        SELECT c.id_alumno, c.objeto_documento INTO v_alumno, v_objeto
          FROM public.consentimiento c WHERE c.id_consent = p_id_registro;
        IF NOT FOUND THEN
            PERFORM app.fallar('NO_ENCONTRADO', 'El consentimiento no existe.');
        END IF;
    ELSE
        SELECT p.id_alumno, p.objeto_foto INTO v_alumno, v_objeto
          FROM public.plantilla_facial p WHERE p.id_plantilla = p_id_registro;
        IF NOT FOUND THEN
            PERFORM app.fallar('NO_ENCONTRADO', 'La plantilla no existe.');
        END IF;
    END IF;

    PERFORM app.bitacora('consulta',
        CASE p_tipo WHEN 'consentimiento' THEN 'consentimiento' ELSE 'plantilla_facial' END,
        p_id_registro, NULL, jsonb_build_object('id_alumno', v_alumno), p_ip);

    RETURN jsonb_build_object(
        'tipo', p_tipo,
        'id_registro', p_id_registro,
        'id_alumno', v_alumno,
        'objeto', v_objeto,
        'vigencia_seg', least(app.param_num('vigencia_url_firmada_seg')::integer, 300));
END
$$;
COMMENT ON FUNCTION public.api_documento_url_autorizar(text, integer, inet) IS
'Autoriza la URL firmada de un documento/foto: devuelve la ruta y la vigencia (<= 300 s) y asienta consulta en bitacora (RF-19).
ARGS: p_tipo (consentimiento | plantilla), p_id_registro (id_consent o id_plantilla), p_ip (opc.)
RETURNS: {"tipo":"plantilla","id_registro":41,"id_alumno":17,"objeto":"registro/17/<uuid>.jpg","vigencia_seg":300}
ERRORES: NO_AUTORIZADO, VALIDACION (tipo), NO_ENCONTRADO
ROLES: administrador';
REVOKE ALL ON FUNCTION public.api_documento_url_autorizar(text, integer, inet) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_documento_url_autorizar(text, integer, inet) TO authenticated;
