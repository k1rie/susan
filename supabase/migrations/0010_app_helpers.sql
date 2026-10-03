-- 0010 · Funciones del esquema app: identidad, rol, visibilidad, errores y bitacora.
-- Contratos en docs/ARCHITECTURE.md seccion 11. El reloj (now, tz, hoy, instante_clase,
-- reloj_simulado) ya existe desde 0001.
--
-- Reglas:
--  * search_path fijo en todas.
--  * Las que leen tablas protegidas por RLS (usuario, grupo, ...) son SECURITY DEFINER: se usan
--    dentro de las propias politicas, y si fueran INVOKER provocarian recursion de politicas.
--    Ninguna recibe texto libre que se interpole en SQL dinamico.
--  * La identidad se resuelve SIEMPRE desde auth.uid() (claims del JWT), no desde current_user;
--    asi app.asumir_cuenta_servicio() puede cambiar de identidad dentro de una transaccion.
--  * EXECUTE: nada para PUBLIC/anon. authenticated y service_role solo donde hace falta.

-- ---------------------------------------------------------------------------------------------
-- Errores de negocio: ERRCODE P0001 + HINT = CODIGO (ver docs/api/plataforma.md 3.4).
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION app.fallar(p_codigo text, p_mensaje text) RETURNS void
    LANGUAGE plpgsql
    SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION '%', p_mensaje USING ERRCODE = 'P0001', HINT = p_codigo;
END
$$;
COMMENT ON FUNCTION app.fallar(text, text) IS 'RAISE EXCEPTION con ERRCODE P0001 y HINT = codigo (MAYUSCULAS_CON_GUION_BAJO).';

-- ---------------------------------------------------------------------------------------------
-- Parametros del sistema
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION app.param(p_clave text) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_valor text;
BEGIN
    SELECT valor INTO v_valor FROM public.parametro_sistema WHERE clave = p_clave;
    IF NOT FOUND THEN
        PERFORM app.fallar('PARAMETRO_NO_ENCONTRADO', format('No existe el parámetro de sistema "%s".', p_clave));
    END IF;
    RETURN v_valor;
END
$$;
COMMENT ON FUNCTION app.param(text) IS 'Valor (texto) de un parametro_sistema; PARAMETRO_NO_ENCONTRADO si no existe.';

CREATE FUNCTION app.param_num(p_clave text) RETURNS numeric
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_valor text := app.param(p_clave);
BEGIN
    RETURN v_valor::numeric;
EXCEPTION WHEN invalid_text_representation THEN
    PERFORM app.fallar('PARAMETRO_INVALIDO', format('El parámetro "%s" no es numérico.', p_clave));
    RETURN NULL;
END
$$;
COMMENT ON FUNCTION app.param_num(text) IS 'Valor numerico de un parametro_sistema; PARAMETRO_INVALIDO si no es numerico.';

-- ---------------------------------------------------------------------------------------------
-- Identidad (a partir de auth.uid()). Una cuenta inactiva no tiene rol efectivo: las politicas
-- RLS que dependen de estas funciones se cierran solas.
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION app.id_usuario() RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$ SELECT u.id_usuario FROM public.usuario u WHERE u.auth_uid = auth.uid() AND u.activo $$;

CREATE FUNCTION app.rol() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$ SELECT u.rol::text FROM public.usuario u WHERE u.auth_uid = auth.uid() AND u.activo $$;

CREATE FUNCTION app.id_docente() RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$ SELECT u.id_docente FROM public.usuario u WHERE u.auth_uid = auth.uid() AND u.activo AND u.rol = 'docente' $$;

CREATE FUNCTION app.id_alumno() RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$ SELECT u.id_alumno FROM public.usuario u WHERE u.auth_uid = auth.uid() AND u.activo AND u.rol = 'alumno' $$;

CREATE FUNCTION app.es_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$ SELECT coalesce(app.rol() = 'administrador', false) $$;

-- Lectura minima (sin PII) del rol de una cuenta; docente y alumno no pueden leer la tabla usuario.
CREATE FUNCTION app.rol_de_usuario(p_id_usuario integer) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$ SELECT u.rol::text FROM public.usuario u WHERE u.id_usuario = p_id_usuario $$;

-- Exige sesion valida y, si se indican roles, que la cuenta tenga uno de ellos.
-- exigir_rol() / exigir_rol(NULL) = cualquier rol activo. Devuelve el rol del usuario.
CREATE FUNCTION app.exigir_rol(VARIADIC p_roles text[] DEFAULT NULL) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_uid     uuid := auth.uid();
    v_rol     text;
    v_activo  boolean;
    v_roles   text[];
BEGIN
    IF v_uid IS NULL THEN
        PERFORM app.fallar('NO_AUTENTICADO', 'Debes iniciar sesión.');
    END IF;

    SELECT u.rol::text, u.activo INTO v_rol, v_activo FROM public.usuario u WHERE u.auth_uid = v_uid;
    IF NOT FOUND THEN
        PERFORM app.fallar('CUENTA_NO_VINCULADA', 'Tu cuenta no está vinculada a un perfil. Contacta al administrador.');
    END IF;
    IF NOT v_activo THEN
        PERFORM app.fallar('CUENTA_INACTIVA', 'Tu cuenta está inactiva. Contacta al administrador.');
    END IF;

    -- exigir_rol(NULL) llega como {NULL}: se descartan los nulos.
    SELECT coalesce(array_agg(r), ARRAY[]::text[]) INTO v_roles FROM unnest(p_roles) AS r WHERE r IS NOT NULL;
    IF cardinality(v_roles) > 0 AND NOT (v_rol = ANY (v_roles)) THEN
        PERFORM app.fallar('NO_AUTORIZADO', 'No tienes permiso para realizar esta operación.');
    END IF;
    RETURN v_rol;
END
$$;
COMMENT ON FUNCTION app.exigir_rol(text[]) IS 'Exige sesion activa y (opcional) uno de los roles indicados; devuelve el rol. Errores: NO_AUTENTICADO, CUENTA_NO_VINCULADA, CUENTA_INACTIVA, NO_AUTORIZADO.';

-- ---------------------------------------------------------------------------------------------
-- Visibilidad (RF-19, Tabla 36). "Sus grupos": grupo.id_docente = docente de la cuenta.
-- Alumno: grupos donde tiene inscripcion (de cualquier estatus: el historial se conserva).
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION app.grupos_visibles() RETURNS SETOF integer
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol text := app.rol();
BEGIN
    IF v_rol = 'administrador' THEN
        RETURN QUERY SELECT g.id_grupo FROM public.grupo g;
    ELSIF v_rol = 'docente' THEN
        RETURN QUERY SELECT g.id_grupo FROM public.grupo g WHERE g.id_docente = app.id_docente();
    ELSIF v_rol = 'alumno' THEN
        RETURN QUERY SELECT i.id_grupo FROM public.inscripcion i WHERE i.id_alumno = app.id_alumno();
    END IF;
    RETURN;
END
$$;
COMMENT ON FUNCTION app.grupos_visibles() IS 'Ids de grupo que la cuenta actual puede ver (admin: todos; docente: los suyos; alumno: donde tiene inscripcion).';

CREATE FUNCTION app.puede_ver_grupo(p_id_grupo integer) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$ SELECT coalesce(p_id_grupo IN (SELECT app.grupos_visibles()), false) $$;

CREATE FUNCTION app.puede_ver_sesion(p_id_sesion integer) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
    SELECT coalesce(
        (SELECT s.id_grupo IN (SELECT app.grupos_visibles()) FROM public.sesion_clase s WHERE s.id_sesion = p_id_sesion),
        false)
$$;

-- Admin: todos. Alumno: solo el propio. Docente: alumnos con inscripcion (cualquier estatus) en sus grupos.
CREATE FUNCTION app.puede_ver_alumno(p_id_alumno integer) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol text := app.rol();
BEGIN
    IF v_rol = 'administrador' THEN
        RETURN true;
    ELSIF v_rol = 'alumno' THEN
        RETURN p_id_alumno IS NOT NULL AND p_id_alumno = app.id_alumno();
    ELSIF v_rol = 'docente' THEN
        RETURN EXISTS (
            SELECT 1 FROM public.inscripcion i
             WHERE i.id_alumno = p_id_alumno AND i.id_grupo IN (SELECT app.grupos_visibles()));
    END IF;
    RETURN false;
END
$$;

-- ---------------------------------------------------------------------------------------------
-- Consentimiento (RN-13, RNF-06): vigente = estatus 'vigente' y la fecha actual dentro de su vigencia.
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION app.consentimiento_vigente(p_id_consent integer) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.consentimiento c
         WHERE c.id_consent = p_id_consent
           AND c.estatus = 'vigente'
           AND app.hoy() BETWEEN c.fecha_firma AND c.vigencia_hasta)
$$;

CREATE FUNCTION app.tiene_consentimiento_vigente(p_id_alumno integer) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.consentimiento c
         WHERE c.id_alumno = p_id_alumno AND app.consentimiento_vigente(c.id_consent))
$$;

-- ---------------------------------------------------------------------------------------------
-- IP de origen: la deja PostgREST en request.headers (x-forwarded-for / x-real-ip). En modo local
-- no hay cabeceras y devuelve NULL. Un valor que no sea una IP valida tambien da NULL.
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION app.ip_origen() RETURNS inet
    LANGUAGE plpgsql STABLE
    SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    v_headers jsonb;
    v_ip      text;
BEGIN
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
    IF v_headers IS NULL THEN
        RETURN NULL;
    END IF;
    v_ip := btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', v_headers ->> 'x-real-ip', ''), ',', 1));
    IF v_ip = '' THEN
        RETURN NULL;
    END IF;
    RETURN v_ip::inet;
EXCEPTION WHEN others THEN
    RETURN NULL;
END
$$;

-- ---------------------------------------------------------------------------------------------
-- Cuenta de servicio (rol tecnico) con la que el programador de tareas asienta sus resoluciones
-- automaticas (RN-07, RN-08). Su auth_uid es fijo y NO existe en auth.users: nadie puede iniciar
-- sesion con ella; solo se "asume" dentro de una transaccion de service_role.
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION app.id_cuenta_servicio() RETURNS integer
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_id integer;
BEGIN
    SELECT u.id_usuario INTO v_id FROM public.usuario u
     WHERE u.auth_uid = '00000000-0000-4000-8000-000000000001'::uuid AND u.rol = 'tecnico' AND u.activo;
    IF v_id IS NULL THEN
        PERFORM app.fallar('CUENTA_SERVICIO_AUSENTE', 'No existe la cuenta de servicio del sistema.');
    END IF;
    RETURN v_id;
END
$$;

CREATE FUNCTION app.id_usuario_servicio() RETURNS integer
    LANGUAGE sql STABLE
    SET search_path = public, app, pg_temp
AS $$ SELECT app.id_cuenta_servicio() $$;

-- Hace que, hasta el fin de la transaccion, auth.uid() sea la cuenta de servicio: app.id_usuario()
-- y app.rol() devuelven la cuenta tecnica y app.bitacora() asienta con ella. Solo service_role.
CREATE FUNCTION app.asumir_cuenta_servicio() RETURNS integer
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_id integer := app.id_cuenta_servicio();
    v_uid uuid;
BEGIN
    SELECT u.auth_uid INTO v_uid FROM public.usuario u WHERE u.id_usuario = v_id;
    PERFORM set_config('request.jwt.claims',
        jsonb_build_object('sub', v_uid, 'role', 'service_role', 'servicio', true)::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_uid::text, true);
    RETURN v_id;
END
$$;
COMMENT ON FUNCTION app.asumir_cuenta_servicio() IS 'Fija (solo en la transaccion) la identidad de la cuenta de servicio; EXECUTE solo para service_role.';

-- ---------------------------------------------------------------------------------------------
-- Bitacora (RNF-08): UNICA via de escritura de bitacora_auditoria. Nadie tiene INSERT directo.
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION app.bitacora(
    p_accion      public.accion_bitacora,
    p_entidad     text,
    p_id_registro bigint,
    p_anterior    jsonb,
    p_nuevo       jsonb,
    p_ip          inet    DEFAULT NULL,
    p_id_usuario  integer DEFAULT NULL
) RETURNS bigint
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_usuario integer;
    v_ip      inet;
    v_id      bigint;
BEGIN
    IF p_accion IN ('correccion', 'cambio_parametro') AND (p_anterior IS NULL OR p_nuevo IS NULL) THEN
        PERFORM app.fallar('BITACORA_VALORES_REQUERIDOS',
            'Una corrección o cambio de parámetro debe guardar valor anterior y nuevo.');
    END IF;

    -- Usuario explicito > sesion actual > cuenta de servicio (acciones automaticas).
    v_usuario := coalesce(p_id_usuario, app.id_usuario(), app.id_cuenta_servicio());
    v_ip := coalesce(p_ip, app.ip_origen());

    INSERT INTO public.bitacora_auditoria (id_usuario, accion, entidad, id_registro, valor_anterior, valor_nuevo, ip_origen)
    VALUES (v_usuario, p_accion, p_entidad, p_id_registro, p_anterior, p_nuevo, CASE WHEN v_ip IS NULL THEN NULL ELSE host(v_ip) END)
    RETURNING id_bitacora INTO v_id;
    RETURN v_id;
END
$$;
COMMENT ON FUNCTION app.bitacora(public.accion_bitacora, text, bigint, jsonb, jsonb, inet, integer) IS
    'Asienta un evento en bitacora_auditoria y devuelve su id. Usuario: p_id_usuario, o la sesion, o la cuenta de servicio.';

-- ---------------------------------------------------------------------------------------------
-- Privilegios. Las funciones usadas por politicas RLS o por RPC INVOKER necesitan EXECUTE para
-- authenticated. bitacora y la cuenta de servicio son solo de service_role (las RPC DEFINER
-- corren como propietario y no necesitan el grant).
-- ---------------------------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION
    app.fallar(text, text),
    app.param(text), app.param_num(text),
    app.id_usuario(), app.rol(), app.id_docente(), app.id_alumno(), app.es_admin(),
    app.rol_de_usuario(integer), app.exigir_rol(text[]),
    app.grupos_visibles(), app.puede_ver_grupo(integer), app.puede_ver_sesion(integer), app.puede_ver_alumno(integer),
    app.consentimiento_vigente(integer), app.tiene_consentimiento_vigente(integer),
    app.ip_origen()
    TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION
    app.bitacora(public.accion_bitacora, text, bigint, jsonb, jsonb, inet, integer),
    app.id_cuenta_servicio(), app.id_usuario_servicio(), app.asumir_cuenta_servicio()
    TO service_role;
