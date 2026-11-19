-- 0237 · Fotos de registro efimeras (extension 18 de docs/DECISIONS.md).
-- Las fotos de registro de un alumno solo sirven para calcular su vector: una vez que ese vector vive en el JSON del
-- indice FAISS en uso, la foto no tiene otro uso y dejarla en el bucket es guardar un rostro sin necesidad (RNF-03).
-- La foto se sube, el servicio de reconocimiento la lee al construir el indice, y cuando la version que contiene el
-- vector queda activa se borra el objeto y la ruta pasa a NULL (mismo patron que la purga de recortes, RNF-05).
--
-- Diseno:
--  * plantilla_facial.objeto_foto y plantilla_foto.objeto_foto admiten NULL = "la foto ya no se conserva". La fila de
--    la plantilla (faiss_id, id_indice, consentimiento) y las medidas escalares de calidad se conservan.
--  * Purga en 3 pasos y en este orden: listar -> borrar objetos -> marcar NULL. Con el orden inverso quedarian objetos
--    huerfanos; si el proceso muere entre 2 y 3, la siguiente corrida vuelve a listar y borrar un objeto ausente no es error.
--  * Solo es purgable la foto de una plantilla cuyo vector ya esta en una version activada (id_indice NOT NULL) o que
--    quedo archivada (nunca volvera al indice). Una plantilla activa sin indexar conserva su foto: la necesita el build.
--    El marcado vuelve a comprobarlo, de modo que nunca se anula la unica copia de algo que aun no esta en el indice.
--  * api_documento_url_autorizar responde FOTO_NO_CONSERVADA en vez de firmar una ruta que ya no existe;
--    api_plantilla_alumno informa que fotos siguen disponibles para que la pantalla no ofrezca un enlace roto.
--  * Orden de despliegue: SQL, web. El servicio de reconocimiento no cambia.
--
-- ROLLBACK (solo documentado): restaurar api_plantilla_alumno y api_documento_url_autorizar desde 0235; DROP FUNCTION
--   public.svc_fotos_registro_listar(integer[], integer); DROP FUNCTION public.svc_fotos_registro_marcar(integer[]);
--   y, solo si ninguna fila tiene objeto_foto NULL, ALTER COLUMN objeto_foto SET NOT NULL en ambas tablas.

-- ---------------------------------------------------------------------------------------------
-- 1) NULL = foto no conservada. El trigger trg_plantilla_foto_principal ya propaga el cambio a la fila orden = 1.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.plantilla_facial ALTER COLUMN objeto_foto DROP NOT NULL;
ALTER TABLE public.plantilla_foto ALTER COLUMN objeto_foto DROP NOT NULL;
COMMENT ON COLUMN public.plantilla_facial.objeto_foto IS
    'Ruta de la foto principal en el bucket mientras el vector no esta en un indice activado; NULL cuando la foto ya no se conserva (extension 18). El vector vive solo en el JSON del indice.';
COMMENT ON COLUMN public.plantilla_foto.objeto_foto IS
    'Ruta de la foto en el bucket mientras el vector no esta en un indice activado; NULL cuando la foto ya no se conserva (extension 18).';

-- ---------------------------------------------------------------------------------------------
-- 2) svc_fotos_registro_listar: paso 1 de la purga. Una fila por plantilla con todos sus objetos, para que el borrado
-- nunca deje una plantilla a medias. p_ids restringe a plantillas concretas (la reconstruccion pasa las que acaba de indexar).
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.svc_fotos_registro_listar(
    p_ids   integer[] DEFAULT NULL,
    p_limit integer DEFAULT 200
) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_limit  integer := least(greatest(coalesce(p_limit, 200), 1), 1000);
    v_total  bigint;
    v_items  jsonb;
BEGIN
    IF p_ids IS NOT NULL AND cardinality(p_ids) > 5000 THEN
        PERFORM app.fallar('VALIDACION', 'No se pueden consultar más de 5000 plantillas por llamada.');
    END IF;

    SELECT count(*) INTO v_total
      FROM public.plantilla_facial p
     WHERE (p.id_indice IS NOT NULL OR NOT p.activa)
       AND (p_ids IS NULL OR p.id_plantilla = ANY (p_ids))
       AND (p.objeto_foto IS NOT NULL
            OR EXISTS (SELECT 1 FROM public.plantilla_foto f WHERE f.id_plantilla = p.id_plantilla AND f.objeto_foto IS NOT NULL));

    SELECT coalesce(jsonb_agg(jsonb_build_object('id_plantilla', q.id_plantilla, 'objetos', q.objetos)
                              ORDER BY q.id_plantilla), '[]'::jsonb) INTO v_items
      FROM (
        SELECT p.id_plantilla,
               (SELECT coalesce(jsonb_agg(u.objeto ORDER BY u.objeto), '[]'::jsonb)
                  FROM (SELECT p.objeto_foto::text AS objeto WHERE p.objeto_foto IS NOT NULL
                        UNION
                        SELECT f.objeto_foto::text FROM public.plantilla_foto f
                         WHERE f.id_plantilla = p.id_plantilla AND f.objeto_foto IS NOT NULL) u) AS objetos
          FROM public.plantilla_facial p
         WHERE (p.id_indice IS NOT NULL OR NOT p.activa)
           AND (p_ids IS NULL OR p.id_plantilla = ANY (p_ids))
           AND (p.objeto_foto IS NOT NULL
                OR EXISTS (SELECT 1 FROM public.plantilla_foto f WHERE f.id_plantilla = p.id_plantilla AND f.objeto_foto IS NOT NULL))
         ORDER BY p.id_plantilla
         LIMIT v_limit
      ) q;

    RETURN jsonb_build_object('pendientes_total', v_total, 'items', v_items);
END
$$;
COMMENT ON FUNCTION public.svc_fotos_registro_listar(integer[], integer) IS
'Paso 1 de la purga de fotos de registro (extension 18): plantillas cuyo vector ya esta en un indice activado, o que quedaron archivadas, y que todavia guardan alguna foto en el bucket. Una fila por plantilla con TODOS sus objetos. Una plantilla activa sin indexar nunca aparece: su foto aun la necesita el build. Solo lectura.
ARGS: p_ids (opc.; restringe a esas plantillas; null = todas), p_limit (def. 200, max 1000; cuenta plantillas, no objetos)
RETURNS: {"pendientes_total":412,"items":[{"id_plantilla":41,"objetos":["registro/17/a.jpg","registro/17/b.jpg"]}]}
ERRORES: VALIDACION (p_ids con mas de 5000)
ROLES: service_role';
REVOKE ALL ON FUNCTION public.svc_fotos_registro_listar(integer[], integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.svc_fotos_registro_listar(integer[], integer) TO service_role;

-- ---------------------------------------------------------------------------------------------
-- 3) svc_fotos_registro_marcar: paso 3 (despues de borrar los objetos). Vuelve a comprobar la condicion: una plantilla
-- que dejo de estar indexada entre el listado y el marcado (p. ej. por una reversion) conserva su ruta.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.svc_fotos_registro_marcar(p_ids integer[]) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_ok integer[];
BEGIN
    IF p_ids IS NULL THEN
        PERFORM app.fallar('VALIDACION', 'p_ids es obligatorio.');
    END IF;
    IF cardinality(p_ids) > 5000 THEN
        PERFORM app.fallar('VALIDACION', 'No se pueden marcar más de 5000 plantillas por llamada.');
    END IF;

    SELECT coalesce(array_agg(p.id_plantilla), '{}') INTO v_ok
      FROM public.plantilla_facial p
     WHERE p.id_plantilla = ANY (p_ids)
       AND (p.id_indice IS NOT NULL OR NOT p.activa)
       AND (p.objeto_foto IS NOT NULL
            OR EXISTS (SELECT 1 FROM public.plantilla_foto f WHERE f.id_plantilla = p.id_plantilla AND f.objeto_foto IS NOT NULL));

    -- Primero la principal (su trigger deja en NULL la fila orden = 1), despues las demas fotos de la plantilla.
    UPDATE public.plantilla_facial SET objeto_foto = NULL WHERE id_plantilla = ANY (v_ok) AND objeto_foto IS NOT NULL;
    UPDATE public.plantilla_foto SET objeto_foto = NULL WHERE id_plantilla = ANY (v_ok) AND objeto_foto IS NOT NULL;

    RETURN jsonb_build_object('solicitadas', cardinality(p_ids), 'marcadas', cardinality(v_ok));
END
$$;
COMMENT ON FUNCTION public.svc_fotos_registro_marcar(integer[]) IS
'Paso 3 de la purga de fotos de registro (despues de borrar los objetos): pone objeto_foto = NULL en la plantilla y en todas sus fotos, solo si su vector ya esta en un indice activado o la plantilla esta archivada. Conserva la fila (faiss_id, id_indice, calidad, coseno_resto). Idempotente.
ARGS: p_ids (hasta 5000 id_plantilla)
RETURNS: {"solicitadas":200,"marcadas":198}
ERRORES: VALIDACION (nulo o mas de 5000)
ROLES: service_role';
REVOKE ALL ON FUNCTION public.svc_fotos_registro_marcar(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.svc_fotos_registro_marcar(integer[]) TO service_role;

-- ---------------------------------------------------------------------------------------------
-- 4) api_plantilla_alumno: cada foto informa si sigue disponible y la activa informa si conserva su foto principal.
-- Claves nuevas (aditivas): activa.foto_disponible, activa.fotos[].disponible. Sigue sin emitir nunca objeto_foto.
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
               'consentimiento_vigente', app.consentimiento_vigente(p.id_consent),
               'foto_disponible', p.objeto_foto IS NOT NULL,
               'n_fotos', greatest(f.n, 1),
               'coseno_min', f.cmin,
               'coseno_medio', f.cmedio,
               'fotos', coalesce(f.fotos, '[]'::jsonb))
      INTO v_activa
      FROM public.plantilla_facial p
      LEFT JOIN public.indice_faiss i ON i.id_indice = p.id_indice
      CROSS JOIN LATERAL (
            SELECT count(*)::integer AS n,
                   min(pf.coseno_resto) AS cmin,
                   round(avg(pf.coseno_resto), 3) AS cmedio,
                   jsonb_agg(jsonb_build_object(
                       'id_foto', pf.id_foto, 'orden', pf.orden, 'principal', pf.orden = 1,
                       'disponible', pf.objeto_foto IS NOT NULL,
                       'calidad', pf.calidad, 'coseno_resto', pf.coseno_resto) ORDER BY pf.orden) AS fotos
              FROM public.plantilla_foto pf WHERE pf.id_plantilla = p.id_plantilla) f
     WHERE p.id_alumno = p_id_alumno AND p.activa;

    SELECT count(*) INTO v_arch_tot FROM public.plantilla_facial WHERE id_alumno = p_id_alumno AND NOT activa;
    SELECT coalesce(jsonb_agg(q.item ORDER BY q.fecha_registro DESC, q.id_plantilla DESC), '[]'::jsonb) INTO v_arch
      FROM (
        SELECT p.id_plantilla, p.fecha_registro,
               jsonb_build_object('id_plantilla', p.id_plantilla, 'id_consent', p.id_consent,
                                  'fecha_registro', p.fecha_registro,
                                  'n_fotos', greatest((SELECT count(*)::integer FROM public.plantilla_foto pf
                                                        WHERE pf.id_plantilla = p.id_plantilla), 1)) AS item
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
'Plantilla facial activa de un alumno (con su version de indice y sus fotos) y las archivadas paginadas. Nunca devuelve rutas objeto_foto: la foto se abre con api_documento_url_autorizar (tipo plantilla o plantilla_foto) y solo mientras siga disponible: tras indexar, la foto se borra y quedan foto_disponible = false y fotos[].disponible = false (extension 18). coseno_min y coseno_medio son la consistencia entre fotos medida por el servicio al registrar (informativa; null en plantillas de una foto).
ARGS: p_id_alumno, p_limit (def. 50, max 200; aplica a archivadas), p_offset
RETURNS: {"id_alumno":17,"activa":{"id_plantilla":41,"id_consent":9,"fecha_registro":"...","indexada":true,"id_indice":3,"version_indice":"v003","faiss_id":1042,"en_uso":true,"consentimiento_vigente":true,"foto_disponible":false,"n_fotos":5,"coseno_min":0.512|null,"coseno_medio":0.744|null,"fotos":[{"id_foto":101,"orden":1,"principal":true,"disponible":false,"calidad":{"brillo":120.5,"nitidez":88.2,"tamano_rostro_px":210,"frontal":true}|null,"coseno_resto":0.812|null}]}|null,"archivadas":{"total":1,"items":[{"id_plantilla":33,"id_consent":4,"fecha_registro":"...","n_fotos":1}]},"indice_en_uso":{"id_indice":3,"version":"v003"}|null}
ERRORES: NO_AUTORIZADO, NO_ENCONTRADO (alumno)
ROLES: administrador';
REVOKE ALL ON FUNCTION public.api_plantilla_alumno(integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_plantilla_alumno(integer, integer, integer) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 5) api_documento_url_autorizar: una foto purgada no tiene ruta que firmar. Se rechaza ANTES de asentar la consulta
-- (la excepcion revierte la transaccion entera: no queda una consulta de bitacora sobre algo que no se entrego).
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
    v_alumno    integer;
    v_objeto    text;
    v_plantilla integer;
    v_orden     smallint;
    v_vigencia  integer;
BEGIN
    PERFORM app.exigir_rol('administrador');

    IF p_tipo IS NULL OR p_tipo NOT IN ('consentimiento', 'plantilla', 'plantilla_foto') THEN
        PERFORM app.fallar('VALIDACION', 'Tipo de documento no válido.');
    END IF;
    v_vigencia := least(app.param_num('vigencia_url_firmada_seg')::integer, 300);

    IF p_tipo = 'consentimiento' THEN
        SELECT c.id_alumno, c.objeto_documento INTO v_alumno, v_objeto
          FROM public.consentimiento c WHERE c.id_consent = p_id_registro;
        IF NOT FOUND THEN
            PERFORM app.fallar('NO_ENCONTRADO', 'El consentimiento no existe.');
        END IF;
        PERFORM app.bitacora('consulta', 'consentimiento', p_id_registro, NULL,
            jsonb_build_object('id_alumno', v_alumno), p_ip);
    ELSIF p_tipo = 'plantilla' THEN
        SELECT p.id_alumno, p.objeto_foto INTO v_alumno, v_objeto
          FROM public.plantilla_facial p WHERE p.id_plantilla = p_id_registro;
        IF NOT FOUND THEN
            PERFORM app.fallar('NO_ENCONTRADO', 'La plantilla no existe.');
        END IF;
        IF v_objeto IS NULL THEN
            PERFORM app.fallar('FOTO_NO_CONSERVADA', 'La foto ya no se conserva: solo se guarda el vector del rostro en el índice.');
        END IF;
        PERFORM app.bitacora('consulta', 'plantilla_facial', p_id_registro, NULL,
            jsonb_build_object('id_alumno', v_alumno), p_ip);
    ELSE
        SELECT p.id_alumno, pf.objeto_foto, p.id_plantilla, pf.orden INTO v_alumno, v_objeto, v_plantilla, v_orden
          FROM public.plantilla_foto pf JOIN public.plantilla_facial p ON p.id_plantilla = pf.id_plantilla
         WHERE pf.id_foto = p_id_registro;
        IF NOT FOUND THEN
            PERFORM app.fallar('NO_ENCONTRADO', 'La foto de la plantilla no existe.');
        END IF;
        IF v_objeto IS NULL THEN
            PERFORM app.fallar('FOTO_NO_CONSERVADA', 'La foto ya no se conserva: solo se guarda el vector del rostro en el índice.');
        END IF;
        PERFORM app.bitacora('consulta', 'plantilla_facial', v_plantilla, NULL,
            jsonb_build_object('id_alumno', v_alumno, 'id_foto', p_id_registro, 'orden', v_orden), p_ip);
        RETURN jsonb_build_object(
            'tipo', p_tipo,
            'id_registro', p_id_registro,
            'id_alumno', v_alumno,
            'id_plantilla', v_plantilla,
            'orden', v_orden,
            'objeto', v_objeto,
            'vigencia_seg', v_vigencia);
    END IF;

    RETURN jsonb_build_object(
        'tipo', p_tipo,
        'id_registro', p_id_registro,
        'id_alumno', v_alumno,
        'objeto', v_objeto,
        'vigencia_seg', v_vigencia);
END
$$;
COMMENT ON FUNCTION public.api_documento_url_autorizar(text, integer, inet) IS
'Autoriza la URL firmada de un documento/foto: devuelve la ruta y la vigencia (<= 300 s) y asienta consulta en bitacora (RF-19) antes de devolver. plantilla = foto principal de la plantilla; plantilla_foto = una foto concreta de la plantilla (p_id_registro = id_foto; la consulta se asienta sobre la plantilla con id_foto y orden). Las fotos de registro se borran al indexarse (extension 18): pedir una ya purgada responde FOTO_NO_CONSERVADA y no asienta consulta.
ARGS: p_tipo (consentimiento | plantilla | plantilla_foto), p_id_registro (id_consent, id_plantilla o id_foto), p_ip (opc.)
RETURNS: {"tipo":"plantilla","id_registro":41,"id_alumno":17,"objeto":"registro/17/<uuid>.jpg","vigencia_seg":300}   |   tipo plantilla_foto: {"tipo":"plantilla_foto","id_registro":<id_foto>,"id_alumno":17,"id_plantilla":41,"orden":3,"objeto":"registro/17/<uuid>.jpg","vigencia_seg":300}
ERRORES: NO_AUTORIZADO, VALIDACION (tipo), NO_ENCONTRADO, FOTO_NO_CONSERVADA (plantilla o plantilla_foto ya purgada)
ROLES: administrador';
REVOKE ALL ON FUNCTION public.api_documento_url_autorizar(text, integer, inet) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_documento_url_autorizar(text, integer, inet) TO authenticated;
