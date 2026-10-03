-- 0101 · Ayudantes internos (esquema app) de reportes y revision. Prefijo c1_ = dominio de
-- db-reportes-revision. Idempotente (CREATE OR REPLACE). EXECUTE para authenticated porque los usan
-- RPC de lectura SECURITY INVOKER.

-- Instante ISO 8601 con el desfase de la zona del plantel (p. ej. 2026-09-14T07:04:55-06:00).
CREATE OR REPLACE FUNCTION app.c1_iso(p_ts timestamptz) RETURNS text
    LANGUAGE sql STABLE
    SET search_path = pg_catalog, app, pg_temp
AS $$
    SELECT CASE WHEN p_ts IS NULL THEN NULL ELSE
        to_char(p_ts AT TIME ZONE app.tz(), 'YYYY-MM-DD"T"HH24:MI:SS')
        || CASE WHEN q.seg < 0 THEN '-' ELSE '+' END
        || to_char(abs(q.seg) / 3600, 'FM00') || ':' || to_char((abs(q.seg) % 3600) / 60, 'FM00')
    END
    FROM (SELECT extract(epoch FROM (p_ts AT TIME ZONE app.tz()) - (p_ts AT TIME ZONE 'UTC'))::integer AS seg) q
$$;
COMMENT ON FUNCTION app.c1_iso(timestamptz) IS 'Instante en ISO 8601 con offset de America/Mexico_City; NULL si es NULL.';

-- Paginacion uniforme: NULL o < 1 = valor por omision; tope p_max. Nunca error.
CREATE OR REPLACE FUNCTION app.c1_limite(p_limit integer, p_def integer DEFAULT 50, p_max integer DEFAULT 200) RETURNS integer
    LANGUAGE sql IMMUTABLE
    SET search_path = pg_catalog, pg_temp
AS $$ SELECT least(CASE WHEN p_limit IS NULL OR p_limit < 1 THEN p_def ELSE p_limit END, p_max) $$;

CREATE OR REPLACE FUNCTION app.c1_desplazamiento(p_offset integer) RETURNS integer
    LANGUAGE sql IMMUTABLE
    SET search_path = pg_catalog, pg_temp
AS $$ SELECT greatest(coalesce(p_offset, 0), 0) $$;

-- Mismo formato que app.b1_nombre: 'Garcia Lopez Ana Maria'.
CREATE OR REPLACE FUNCTION app.c1_nombre(p_ap text, p_am text, p_nombres text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path = pg_catalog, pg_temp
AS $$ SELECT p_ap || ' ' || coalesce(p_am || ' ', '') || p_nombres $$;

CREATE OR REPLACE FUNCTION app.c1_alumno_json(p_id integer, p_matricula text, p_ap text, p_am text, p_nombres text) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path = pg_catalog, app, pg_temp
AS $$
    SELECT jsonb_build_object('id_alumno', p_id, 'matricula', p_matricula, 'apellido_paterno', p_ap,
        'apellido_materno', p_am, 'nombres', p_nombres, 'nombre_completo', app.c1_nombre(p_ap, p_am, p_nombres))
$$;

CREATE OR REPLACE FUNCTION app.c1_materia_json(p_id integer, p_clave text, p_nombre text) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path = pg_catalog, pg_temp
AS $$ SELECT jsonb_build_object('id_materia', p_id, 'clave', p_clave, 'nombre', p_nombre) $$;

CREATE OR REPLACE FUNCTION app.c1_grupo_json(p_id integer, p_clave_grupo text, p_periodo text) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path = pg_catalog, pg_temp
AS $$ SELECT jsonb_build_object('id_grupo', p_id, 'clave_grupo', p_clave_grupo, 'periodo', p_periodo) $$;

CREATE OR REPLACE FUNCTION app.c1_sesion_json(s public.sesion_clase) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path = pg_catalog, pg_temp
AS $$
    SELECT jsonb_build_object('id_sesion', s.id_sesion, 'fecha', s.fecha, 'hora_inicio', s.hora_inicio,
        'hora_fin', s.hora_fin, 'modo_registro', s.modo_registro, 'limite_presente_min', s.limite_presente_min,
        'tolerancia_min', s.tolerancia_min)
$$;

GRANT EXECUTE ON FUNCTION
    app.c1_iso(timestamptz), app.c1_limite(integer, integer, integer), app.c1_desplazamiento(integer),
    app.c1_nombre(text, text, text), app.c1_alumno_json(integer, text, text, text, text),
    app.c1_materia_json(integer, text, text), app.c1_grupo_json(integer, text, text),
    app.c1_sesion_json(public.sesion_clase)
    TO authenticated, service_role;
