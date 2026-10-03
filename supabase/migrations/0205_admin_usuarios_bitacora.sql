-- 0205 · db-admin · usuarios (RF-20), bitacora (RNF-08) y resumen del administrador.
-- Sin autorregistro: las cuentas las crea el administrador desde un Route Handler que usa Auth admin y luego
-- svc_usuario_crear (service_role). La cuenta de servicio (servicio@susan.local) nunca aparece en estas RPC.
-- Codigos propios: USUARIO_PROPIO, ROL_VINCULO_INCOHERENTE, CORREO_RESERVADO.

CREATE OR REPLACE FUNCTION public.api_usuarios_listar(
    p_q text DEFAULT NULL, p_rol text DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0
) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_pat   text := app.b1_patron(p_q);
    v_rol   public.rol_usuario;
    v_total bigint;
    v_items jsonb;
BEGIN
    PERFORM app.exigir_rol('administrador');
    IF nullif(btrim(coalesce(p_rol, '')), '') IS NOT NULL THEN
        BEGIN
            v_rol := btrim(p_rol)::public.rol_usuario;
        EXCEPTION WHEN invalid_text_representation THEN
            PERFORM app.fallar('VALIDACION', 'Rol no válido (administrador, docente, alumno o tecnico).');
        END;
    END IF;

    SELECT count(*) INTO v_total
      FROM public.usuario u
      LEFT JOIN public.docente d ON d.id_docente = u.id_docente
      LEFT JOIN public.alumno a ON a.id_alumno = u.id_alumno
     WHERE u.auth_uid <> '00000000-0000-4000-8000-000000000001'::uuid
       AND (v_rol IS NULL OR u.rol = v_rol)
       AND (v_pat IS NULL OR u.correo ILIKE v_pat OR d.num_empleado ILIKE v_pat OR a.matricula ILIKE v_pat
            OR concat_ws(' ', d.nombres, d.apellido_paterno, d.apellido_materno, a.nombres, a.apellido_paterno, a.apellido_materno) ILIKE v_pat
            OR concat_ws(' ', d.apellido_paterno, d.apellido_materno, d.nombres, a.apellido_paterno, a.apellido_materno, a.nombres) ILIKE v_pat);

    SELECT coalesce(jsonb_agg(x.j ORDER BY x.rn), '[]'::jsonb) INTO v_items FROM (
        SELECT row_number() OVER (ORDER BY u.rol, u.correo, u.id_usuario) AS rn,
               jsonb_build_object(
                   'id_usuario', u.id_usuario, 'correo', u.correo, 'rol', u.rol, 'activo', u.activo,
                   'id_docente', u.id_docente, 'id_alumno', u.id_alumno,
                   'nombre', CASE WHEN d.id_docente IS NOT NULL THEN app.b1_nombre(d.apellido_paterno, d.apellido_materno, d.nombres)
                                  WHEN a.id_alumno IS NOT NULL THEN app.b1_nombre(a.apellido_paterno, a.apellido_materno, a.nombres) END,
                   'vinculo', coalesce(d.num_empleado, a.matricula)) AS j
          FROM public.usuario u
          LEFT JOIN public.docente d ON d.id_docente = u.id_docente
          LEFT JOIN public.alumno a ON a.id_alumno = u.id_alumno
         WHERE u.auth_uid <> '00000000-0000-4000-8000-000000000001'::uuid
           AND (v_rol IS NULL OR u.rol = v_rol)
           AND (v_pat IS NULL OR u.correo ILIKE v_pat OR d.num_empleado ILIKE v_pat OR a.matricula ILIKE v_pat
                OR concat_ws(' ', d.nombres, d.apellido_paterno, d.apellido_materno, a.nombres, a.apellido_paterno, a.apellido_materno) ILIKE v_pat
                OR concat_ws(' ', d.apellido_paterno, d.apellido_materno, d.nombres, a.apellido_paterno, a.apellido_materno, a.nombres) ILIKE v_pat)
         ORDER BY u.rol, u.correo, u.id_usuario
         LIMIT app.b1_limite(p_limit) OFFSET app.b1_desplazamiento(p_offset)
    ) x;
    RETURN jsonb_build_object('total', v_total, 'items', v_items);
END
$$;
GRANT EXECUTE ON FUNCTION public.api_usuarios_listar(text, text, integer, integer) TO authenticated;
COMMENT ON FUNCTION public.api_usuarios_listar(text, text, integer, integer) IS
$c$Lista las cuentas de usuario (paginada); oculta la cuenta de servicio servicio@susan.local.
ARGS: p_q texto libre (correo, nombre, matricula o numero de empleado; opcional); p_rol administrador|docente|alumno|tecnico (opcional); p_limit def. 50 max 200; p_offset def. 0.
RETURNS: {"total": 7, "items": [{"id_usuario": 2, "correo": "docente1@susan.test", "rol": "docente", "activo": true, "id_docente": 1, "id_alumno": null, "nombre": "Lopez Ruiz Ana", "vinculo": "D001"}]}
ERRORES: NO_AUTORIZADO, VALIDACION (rol).
ROLES: administrador.$c$;

CREATE OR REPLACE FUNCTION public.api_usuario_actualizar(p_id_usuario integer, p jsonb) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_p      jsonb;
    u        public.usuario%ROWTYPE;
    v_activo boolean;
    v_rol    public.rol_usuario;
    v_doc    integer;
    v_alu    integer;
    v_txt    text;
    v_conocido boolean;
    v_propio boolean;
    v_cambio boolean;
BEGIN
    PERFORM app.exigir_rol('administrador');
    v_p := app.b1_obj(p);
    -- La cuenta de servicio no existe para la interfaz.
    SELECT * INTO u FROM public.usuario
     WHERE id_usuario = p_id_usuario AND auth_uid <> '00000000-0000-4000-8000-000000000001'::uuid FOR UPDATE;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El usuario no existe.');
    END IF;
    v_propio := u.id_usuario = app.id_usuario();
    v_conocido := v_p ? 'activo' OR v_p ? 'rol' OR v_p ? 'id_docente' OR v_p ? 'id_alumno';
    IF NOT v_conocido THEN
        PERFORM app.fallar('VALIDACION', 'Indica al menos un campo a cambiar: activo, rol, id_docente o id_alumno.');
    END IF;

    v_activo := u.activo;
    IF v_p ? 'activo' THEN
        IF jsonb_typeof(v_p -> 'activo') <> 'boolean' THEN
            PERFORM app.fallar('VALIDACION', 'activo debe ser true o false.');
        END IF;
        v_activo := (v_p ->> 'activo')::boolean;
    END IF;

    v_rol := u.rol;
    v_txt := app.b1_str(v_p, 'rol');
    IF v_txt IS NOT NULL THEN
        BEGIN
            v_rol := v_txt::public.rol_usuario;
        EXCEPTION WHEN invalid_text_representation THEN
            PERFORM app.fallar('VALIDACION', 'Rol no válido (administrador, docente, alumno o tecnico).');
        END;
    END IF;

    -- Vinculo coherente con el rol (ck_usuario_docente / ck_usuario_alumno).
    v_doc := CASE WHEN v_p ? 'id_docente' THEN app.b1_int(v_p, 'id_docente') ELSE u.id_docente END;
    v_alu := CASE WHEN v_p ? 'id_alumno' THEN app.b1_int(v_p, 'id_alumno') ELSE u.id_alumno END;
    IF v_rol = 'docente' THEN
        IF v_doc IS NULL THEN
            PERFORM app.fallar('ROL_VINCULO_INCOHERENTE', 'El rol docente requiere id_docente.');
        END IF;
        IF v_p ? 'id_alumno' AND (v_p -> 'id_alumno') <> 'null'::jsonb THEN
            PERFORM app.fallar('ROL_VINCULO_INCOHERENTE', 'Una cuenta docente no se vincula a un alumno.');
        END IF;
        v_alu := NULL;
    ELSIF v_rol = 'alumno' THEN
        IF v_alu IS NULL THEN
            PERFORM app.fallar('ROL_VINCULO_INCOHERENTE', 'El rol alumno requiere id_alumno.');
        END IF;
        IF v_p ? 'id_docente' AND (v_p -> 'id_docente') <> 'null'::jsonb THEN
            PERFORM app.fallar('ROL_VINCULO_INCOHERENTE', 'Una cuenta de alumno no se vincula a un docente.');
        END IF;
        v_doc := NULL;
    ELSE
        IF (v_p ? 'id_docente' AND (v_p -> 'id_docente') <> 'null'::jsonb)
           OR (v_p ? 'id_alumno' AND (v_p -> 'id_alumno') <> 'null'::jsonb) THEN
            PERFORM app.fallar('ROL_VINCULO_INCOHERENTE', 'Los roles administrador y tecnico no llevan vínculo con docente ni alumno.');
        END IF;
        v_doc := NULL; v_alu := NULL;
    END IF;
    IF v_doc IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.docente WHERE id_docente = v_doc) THEN
            PERFORM app.fallar('NO_ENCONTRADO', 'El docente no existe.');
        END IF;
        IF EXISTS (SELECT 1 FROM public.usuario x WHERE x.id_docente = v_doc AND x.id_usuario <> u.id_usuario) THEN
            PERFORM app.fallar('DUPLICADO', 'Ese docente ya tiene una cuenta.');
        END IF;
    END IF;
    IF v_alu IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.alumno WHERE id_alumno = v_alu) THEN
            PERFORM app.fallar('NO_ENCONTRADO', 'El alumno no existe.');
        END IF;
        IF EXISTS (SELECT 1 FROM public.usuario x WHERE x.id_alumno = v_alu AND x.id_usuario <> u.id_usuario) THEN
            PERFORM app.fallar('DUPLICADO', 'Ese alumno ya tiene una cuenta.');
        END IF;
    END IF;

    -- Salvaguarda: quien llama es siempre un administrador activo, asi que nunca queda sin uno si no se toca a si mismo.
    IF v_propio AND (NOT v_activo OR v_rol <> 'administrador') THEN
        PERFORM app.fallar('USUARIO_PROPIO', 'No puedes desactivar tu cuenta ni quitarte el rol de administrador.');
    END IF;

    v_cambio := v_activo IS DISTINCT FROM u.activo OR v_rol IS DISTINCT FROM u.rol
                OR v_doc IS DISTINCT FROM u.id_docente OR v_alu IS DISTINCT FROM u.id_alumno;
    IF v_cambio THEN
        -- Un solo UPDATE: los CHECK de coherencia rol/vinculo se evaluan sobre la fila final.
        UPDATE public.usuario SET activo = v_activo, rol = v_rol, id_docente = v_doc, id_alumno = v_alu
         WHERE id_usuario = u.id_usuario;
    END IF;
    RETURN jsonb_build_object('id_usuario', u.id_usuario, 'correo', u.correo, 'rol', v_rol, 'activo', v_activo,
                              'id_docente', v_doc, 'id_alumno', v_alu, 'cambio', v_cambio);
END
$$;
GRANT EXECUTE ON FUNCTION public.api_usuario_actualizar(integer, jsonb) TO authenticated;
COMMENT ON FUNCTION public.api_usuario_actualizar(integer, jsonb) IS
$c$Activa o desactiva una cuenta y/o cambia su rol manteniendo el vinculo coherente (docente exige id_docente, alumno exige id_alumno, administrador y tecnico no llevan vinculo). El correo (identidad en Auth) no se cambia aqui. Un administrador no puede desactivarse ni quitarse el rol a si mismo.
ARGS: p_id_usuario; p {activo?: boolean, rol?, id_docente?, id_alumno?}; al menos un campo.
RETURNS: {"id_usuario": 5, "correo": "alumno1@susan.test", "rol": "alumno", "activo": false, "id_docente": null, "id_alumno": 4, "cambio": true}
ERRORES: NO_AUTORIZADO, NO_ENCONTRADO (usuario, docente o alumno; la cuenta de servicio cuenta como inexistente), VALIDACION, ROL_VINCULO_INCOHERENTE, DUPLICADO (el docente o alumno ya tiene cuenta), USUARIO_PROPIO.
ROLES: administrador.$c$;

CREATE OR REPLACE FUNCTION public.svc_usuario_crear(
    p_correo text, p_rol text, p_id_docente integer DEFAULT NULL, p_id_alumno integer DEFAULT NULL, p_auth_uid uuid DEFAULT NULL
) RETURNS integer
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_cor   text := lower(btrim(coalesce(p_correo, '')));
    v_rol   public.rol_usuario;
    v_id    integer;
    v_est_d public.estatus_docente;
    v_est_a public.estatus_alumno;
BEGIN
    -- Sin exigir_rol: lo llama el servidor con service_role tras crear la cuenta en Auth (EXECUTE solo service_role).
    IF v_cor = '' OR length(v_cor) > 120 OR v_cor !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
        PERFORM app.fallar('VALIDACION', 'El correo institucional no es válido.');
    END IF;
    IF p_auth_uid IS NULL THEN
        PERFORM app.fallar('VALIDACION', 'auth_uid es obligatorio: crea primero la cuenta en Auth.');
    END IF;
    BEGIN
        v_rol := btrim(coalesce(p_rol, ''))::public.rol_usuario;
    EXCEPTION WHEN invalid_text_representation THEN
        PERFORM app.fallar('VALIDACION', 'Rol no válido (administrador, docente, alumno o tecnico).');
    END;
    IF v_cor = 'servicio@susan.local' OR p_auth_uid = '00000000-0000-4000-8000-000000000001'::uuid THEN
        PERFORM app.fallar('CORREO_RESERVADO', 'La cuenta de servicio del sistema está reservada.');
    END IF;

    IF v_rol = 'docente' THEN
        IF p_id_docente IS NULL OR p_id_alumno IS NOT NULL THEN
            PERFORM app.fallar('ROL_VINCULO_INCOHERENTE', 'El rol docente requiere id_docente y no lleva id_alumno.');
        END IF;
    ELSIF v_rol = 'alumno' THEN
        IF p_id_alumno IS NULL OR p_id_docente IS NOT NULL THEN
            PERFORM app.fallar('ROL_VINCULO_INCOHERENTE', 'El rol alumno requiere id_alumno y no lleva id_docente.');
        END IF;
    ELSIF p_id_docente IS NOT NULL OR p_id_alumno IS NOT NULL THEN
        PERFORM app.fallar('ROL_VINCULO_INCOHERENTE', 'Los roles administrador y tecnico no llevan vínculo con docente ni alumno.');
    END IF;

    IF p_id_docente IS NOT NULL THEN
        SELECT estatus INTO v_est_d FROM public.docente WHERE id_docente = p_id_docente;
        IF NOT FOUND THEN
            PERFORM app.fallar('NO_ENCONTRADO', 'El docente no existe.');
        END IF;
        IF v_est_d = 'baja' THEN
            PERFORM app.fallar('DOCENTE_NO_ACTIVO', 'No se crea cuenta para un docente dado de baja.');
        END IF;
    END IF;
    IF p_id_alumno IS NOT NULL THEN
        SELECT estatus INTO v_est_a FROM public.alumno WHERE id_alumno = p_id_alumno;
        IF NOT FOUND THEN
            PERFORM app.fallar('NO_ENCONTRADO', 'El alumno no existe.');
        END IF;
        IF v_est_a <> 'activo' THEN
            PERFORM app.fallar('ALUMNO_NO_ACTIVO', 'Solo se crea cuenta para un alumno activo.');
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM public.usuario WHERE lower(correo) = v_cor) THEN
        PERFORM app.fallar('DUPLICADO', 'Ya existe una cuenta con ese correo.');
    END IF;
    IF EXISTS (SELECT 1 FROM public.usuario WHERE auth_uid = p_auth_uid) THEN
        PERFORM app.fallar('DUPLICADO', 'Esa cuenta de Auth ya está vinculada a un usuario.');
    END IF;
    IF p_id_docente IS NOT NULL AND EXISTS (SELECT 1 FROM public.usuario WHERE id_docente = p_id_docente) THEN
        PERFORM app.fallar('DUPLICADO', 'Ese docente ya tiene una cuenta.');
    END IF;
    IF p_id_alumno IS NOT NULL AND EXISTS (SELECT 1 FROM public.usuario WHERE id_alumno = p_id_alumno) THEN
        PERFORM app.fallar('DUPLICADO', 'Ese alumno ya tiene una cuenta.');
    END IF;

    BEGIN
        INSERT INTO public.usuario (auth_uid, correo, rol, id_docente, id_alumno, activo)
        VALUES (p_auth_uid, v_cor, v_rol, p_id_docente, p_id_alumno, true) RETURNING id_usuario INTO v_id;
    EXCEPTION WHEN unique_violation THEN
        PERFORM app.fallar('DUPLICADO', 'La cuenta ya existe (correo, Auth o vínculo repetidos).');
    END;
    RETURN v_id;
END
$$;
GRANT EXECUTE ON FUNCTION public.svc_usuario_crear(text, text, integer, integer, uuid) TO service_role;
COMMENT ON FUNCTION public.svc_usuario_crear(text, text, integer, integer, uuid) IS
$c$Inserta la fila de usuario despues de crear la cuenta en Auth (sin autorregistro). Un usuario por docente o alumno, rol coherente con el vinculo, correo unico. Devuelve id_usuario.
ARGS: p_correo; p_rol administrador|docente|alumno|tecnico; p_id_docente (solo rol docente); p_id_alumno (solo rol alumno); p_auth_uid uuid de Auth.
RETURNS: 12 (integer: id_usuario creado)
ERRORES: VALIDACION (correo, rol, auth_uid), ROL_VINCULO_INCOHERENTE, NO_ENCONTRADO (docente o alumno), DOCENTE_NO_ACTIVO, ALUMNO_NO_ACTIVO, CORREO_RESERVADO, DUPLICADO (correo, auth_uid, docente o alumno ya con cuenta).
ROLES: service_role (Route Handler de administracion de cuentas).$c$;

-- ---------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_bitacora_listar(
    p_accion text DEFAULT NULL, p_entidad text DEFAULT NULL, p_id_usuario integer DEFAULT NULL,
    p_desde date DEFAULT NULL, p_hasta date DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0
) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_accion public.accion_bitacora;
    v_entidad text := nullif(btrim(coalesce(p_entidad, '')), '');
    v_ini    timestamptz;
    v_fin    timestamptz;
    v_total  bigint;
    v_items  jsonb;
BEGIN
    PERFORM app.exigir_rol('administrador');
    IF nullif(btrim(coalesce(p_accion, '')), '') IS NOT NULL THEN
        BEGIN
            v_accion := btrim(p_accion)::public.accion_bitacora;
        EXCEPTION WHEN invalid_text_representation THEN
            PERFORM app.fallar('VALIDACION', 'Acción de bitácora no válida.');
        END;
    END IF;
    IF p_desde IS NOT NULL AND p_hasta IS NOT NULL AND p_hasta < p_desde THEN
        PERFORM app.fallar('VALIDACION', 'El rango de fechas es inválido (desde > hasta).');
    END IF;
    -- Fechas en hora del plantel; hasta es inclusivo.
    v_ini := CASE WHEN p_desde IS NULL THEN NULL ELSE p_desde::timestamp AT TIME ZONE app.tz() END;
    v_fin := CASE WHEN p_hasta IS NULL THEN NULL ELSE (p_hasta + 1)::timestamp AT TIME ZONE app.tz() END;

    SELECT count(*) INTO v_total FROM public.bitacora_auditoria b
     WHERE (v_accion IS NULL OR b.accion = v_accion) AND (v_entidad IS NULL OR b.entidad = v_entidad)
       AND (p_id_usuario IS NULL OR b.id_usuario = p_id_usuario)
       AND (v_ini IS NULL OR b.fecha_hora >= v_ini) AND (v_fin IS NULL OR b.fecha_hora < v_fin);

    SELECT coalesce(jsonb_agg(x.j ORDER BY x.rn), '[]'::jsonb) INTO v_items FROM (
        SELECT row_number() OVER (ORDER BY b.fecha_hora DESC, b.id_bitacora DESC) AS rn,
               jsonb_build_object(
                   'id_bitacora', b.id_bitacora, 'id_usuario', b.id_usuario, 'usuario_correo', u.correo,
                   'accion', b.accion, 'entidad', b.entidad, 'id_registro', b.id_registro,
                   'valor_anterior', b.valor_anterior, 'valor_nuevo', b.valor_nuevo,
                   'fecha_hora', b.fecha_hora, 'ip_origen', b.ip_origen) AS j
          FROM public.bitacora_auditoria b JOIN public.usuario u ON u.id_usuario = b.id_usuario
         WHERE (v_accion IS NULL OR b.accion = v_accion) AND (v_entidad IS NULL OR b.entidad = v_entidad)
           AND (p_id_usuario IS NULL OR b.id_usuario = p_id_usuario)
           AND (v_ini IS NULL OR b.fecha_hora >= v_ini) AND (v_fin IS NULL OR b.fecha_hora < v_fin)
         ORDER BY b.fecha_hora DESC, b.id_bitacora DESC
         LIMIT app.b1_limite(p_limit) OFFSET app.b1_desplazamiento(p_offset)
    ) x;
    RETURN jsonb_build_object('total', v_total, 'items', v_items);
END
$$;
GRANT EXECUTE ON FUNCTION public.api_bitacora_listar(text, text, integer, date, date, integer, integer) TO authenticated;
COMMENT ON FUNCTION public.api_bitacora_listar(text, text, integer, date, date, integer, integer) IS
$c$Consulta la bitacora de auditoria (solo lectura, mas reciente primero) con filtros opcionales.
ARGS: p_accion consulta|correccion|aprobacion_justificante|rechazo_justificante|alta_plantilla|cambio_parametro|cierre_sesion|notificacion; p_entidad (nombre de entidad); p_id_usuario; p_desde y p_hasta (date en hora del plantel, hasta inclusivo); p_limit def. 50 max 200; p_offset def. 0.
RETURNS: {"total": 1, "items": [{"id_bitacora": 1, "id_usuario": 2, "usuario_correo": "docente1@susan.test", "accion": "consulta", "entidad": "deteccion", "id_registro": 1, "valor_anterior": null, "valor_nuevo": {"fixture": true}, "fecha_hora": "2026-09-14T07:12:00-06:00", "ip_origen": "10.0.0.5"}]}
ERRORES: NO_AUTORIZADO, VALIDACION (accion o rango de fechas).
ROLES: administrador (la RLS de bitacora_auditoria lo respalda).$c$;

CREATE OR REPLACE FUNCTION public.api_admin_resumen() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_hoy     date := app.hoy();
    v_periodo text;
BEGIN
    PERFORM app.exigir_rol('administrador');
    -- Periodo en curso por calendario (ene-jun = 1, jul-dic = 2); si no tiene grupos, el mas reciente que exista.
    v_periodo := to_char(v_hoy, 'YYYY') || '-' || CASE WHEN extract(month FROM v_hoy) <= 6 THEN '1' ELSE '2' END;
    IF NOT EXISTS (SELECT 1 FROM public.grupo WHERE periodo = v_periodo) THEN
        v_periodo := coalesce((SELECT max(periodo) FROM public.grupo), v_periodo);
    END IF;

    RETURN jsonb_build_object(
        'fecha', v_hoy,
        'periodo', v_periodo,
        'alumnos_activos', (SELECT count(*) FROM public.alumno WHERE estatus = 'activo'),
        'docentes_activos', (SELECT count(*) FROM public.docente WHERE estatus = 'activo'),
        'grupos_periodo', (SELECT count(*) FROM public.grupo WHERE periodo = v_periodo),
        'sesiones_hoy', jsonb_build_object(
            'total', (SELECT count(*) FROM public.sesion_clase WHERE fecha = v_hoy),
            'programadas', (SELECT count(*) FROM public.sesion_clase WHERE fecha = v_hoy AND estatus = 'programada'),
            'abiertas', (SELECT count(*) FROM public.sesion_clase WHERE fecha = v_hoy AND estatus = 'abierta'),
            'cerradas', (SELECT count(*) FROM public.sesion_clase WHERE fecha = v_hoy AND estatus = 'cerrada'),
            'suspendidas', (SELECT count(*) FROM public.sesion_clase WHERE fecha = v_hoy AND estatus = 'suspendida')),
        'camaras', jsonb_build_object(
            'activas', (SELECT count(*) FROM public.camara WHERE estatus = 'activa'),
            'inactivas', (SELECT count(*) FROM public.camara WHERE estatus <> 'activa'),
            'en_mantenimiento', (SELECT count(*) FROM public.camara WHERE estatus = 'mantenimiento')),
        'consentimientos_por_vencer_30d', (SELECT count(*) FROM public.consentimiento
            WHERE estatus = 'vigente' AND vigencia_hasta BETWEEN v_hoy AND v_hoy + 30),
        'plantillas_sin_indexar', (SELECT count(*) FROM public.plantilla_facial WHERE activa AND id_indice IS NULL));
END
$$;
GRANT EXECUTE ON FUNCTION public.api_admin_resumen() TO authenticated;
COMMENT ON FUNCTION public.api_admin_resumen() IS
$c$Contadores de la portada del administrador. El periodo es el del calendario (ene-jun = 1, jul-dic = 2) o, si no tiene grupos, el mas reciente. camaras.inactivas incluye las en mantenimiento.
ARGS: ninguno.
RETURNS: {"fecha": "2026-09-14", "periodo": "2026-2", "alumnos_activos": 6, "docentes_activos": 2, "grupos_periodo": 2, "sesiones_hoy": {"total": 2, "programadas": 0, "abiertas": 2, "cerradas": 0, "suspendidas": 0}, "camaras": {"activas": 2, "inactivas": 1, "en_mantenimiento": 0}, "consentimientos_por_vencer_30d": 0, "plantillas_sin_indexar": 0}
ERRORES: NO_AUTORIZADO.
ROLES: administrador.$c$;
