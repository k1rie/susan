-- 0050 · RPC de plataforma (docs/api/plataforma.md seccion 3): api_yo, api_ahora, api_parametros_publicos.
-- Convenciones: SET search_path = public, app, pg_temp; EXECUTE solo para authenticated.

-- ---------------------------------------------------------------------------------------------
-- api_yo(): identidad y ruta inicial. INVOKER: lee usuario por la politica usuario_ve_su_cuenta
-- (sin exigir activo, para poder informar activo = false) y docente/alumno por sus politicas
-- (que si exigen cuenta activa; una cuenta inactiva obtiene nombre = correo).
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION public.api_yo() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_uid     uuid := auth.uid();
    u         public.usuario%ROWTYPE;
    v_nombre  text;
BEGIN
    IF v_uid IS NULL THEN
        PERFORM app.fallar('NO_AUTENTICADO', 'Debes iniciar sesión.');
    END IF;

    SELECT * INTO u FROM public.usuario WHERE auth_uid = v_uid;
    IF NOT FOUND THEN
        PERFORM app.fallar('CUENTA_NO_VINCULADA', 'Tu cuenta no está vinculada a un perfil. Contacta al administrador.');
    END IF;

    IF u.id_docente IS NOT NULL THEN
        SELECT d.nombres || ' ' || d.apellido_paterno || coalesce(' ' || d.apellido_materno, '')
          INTO v_nombre FROM public.docente d WHERE d.id_docente = u.id_docente;
    ELSIF u.id_alumno IS NOT NULL THEN
        SELECT a.nombres || ' ' || a.apellido_paterno || coalesce(' ' || a.apellido_materno, '')
          INTO v_nombre FROM public.alumno a WHERE a.id_alumno = u.id_alumno;
    END IF;

    RETURN jsonb_build_object(
        'id_usuario', u.id_usuario,
        'auth_uid', u.auth_uid,
        'correo', u.correo,
        'rol', u.rol,
        'activo', u.activo,
        'id_docente', u.id_docente,
        'id_alumno', u.id_alumno,
        'nombre', coalesce(v_nombre, u.correo),
        'home', CASE WHEN NOT u.activo THEN NULL ELSE CASE u.rol
            WHEN 'administrador' THEN '/admin'
            WHEN 'docente' THEN '/docente'
            WHEN 'alumno' THEN '/alumno'
            WHEN 'tecnico' THEN '/tecnico' END END
    );
END
$$;
COMMENT ON FUNCTION public.api_yo() IS
    'Identidad del usuario autenticado: {id_usuario, auth_uid, correo, rol, activo, id_docente, id_alumno, nombre, home}. Errores: NO_AUTENTICADO, CUENTA_NO_VINCULADA.';
REVOKE ALL ON FUNCTION public.api_yo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_yo() TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- api_ahora(): reloj del servidor para sincronizar la interfaz (nunca se usa el del navegador).
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION public.api_ahora() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_ahora timestamptz;
    v_local timestamp;
BEGIN
    PERFORM app.exigir_rol(NULL);
    v_ahora := app.now();
    v_local := v_ahora AT TIME ZONE app.tz();
    RETURN jsonb_build_object(
        'ahora', v_ahora,
        'zona', app.tz(),
        'fecha', v_local::date,
        'hora', to_char(v_local, 'HH24:MI:SS'),
        'dia_semana', extract(isodow FROM v_local)::int,
        'reloj_simulado', app.reloj_simulado()
    );
END
$$;
COMMENT ON FUNCTION public.api_ahora() IS
    'Hora de negocio: {ahora, zona, fecha, hora, dia_semana (ISO 1=lunes..7), reloj_simulado}. Cualquier rol activo.';
REVOKE ALL ON FUNCTION public.api_ahora() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_ahora() TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- api_parametros_publicos(): todos los parametros como { clave: valor }. DEFINER porque
-- parametro_sistema solo es legible por administrador y tecnico, y la UI de docentes y alumnos
-- necesita mostrar los umbrales; no expone nada sensible.
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION public.api_parametros_publicos() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
BEGIN
    PERFORM app.exigir_rol(NULL);
    RETURN (
        SELECT coalesce(jsonb_object_agg(p.clave,
                   CASE WHEN p.valor ~ '^-?[0-9]+(\.[0-9]+)?$' THEN to_jsonb(p.valor::numeric) ELSE to_jsonb(p.valor) END), '{}'::jsonb)
          FROM public.parametro_sistema p);
END
$$;
COMMENT ON FUNCTION public.api_parametros_publicos() IS
    'Parametros del sistema como objeto {clave: valor} (numericos como numero JSON). Cualquier rol activo.';
REVOKE ALL ON FUNCTION public.api_parametros_publicos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_parametros_publicos() TO authenticated;
