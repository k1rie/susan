-- 0200 · db-admin · ayudantes internos (esquema app) de la gestion academica.
-- Prefijo b1_ = piezas del dominio "administracion" (api_b1_*). Idempotente (CREATE OR REPLACE).
-- Las funciones que usan las RPC INVOKER necesitan EXECUTE para authenticated (README, "Privilegios").

-- Paginacion uniforme: p_limit por omision 50, maximo 200; p_offset >= 0.
CREATE OR REPLACE FUNCTION app.b1_limite(p_limit integer) RETURNS integer
    LANGUAGE sql IMMUTABLE
    SET search_path = pg_catalog, pg_temp
AS $$ SELECT least(greatest(coalesce(p_limit, 50), 1), 200) $$;

CREATE OR REPLACE FUNCTION app.b1_desplazamiento(p_offset integer) RETURNS integer
    LANGUAGE sql IMMUTABLE
    SET search_path = pg_catalog, pg_temp
AS $$ SELECT greatest(coalesce(p_offset, 0), 0) $$;

-- Patron ILIKE seguro: escapa % _ \ del texto del usuario (nunca se concatena SQL con el).
CREATE OR REPLACE FUNCTION app.b1_patron(p_q text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path = pg_catalog, pg_temp
AS $$
    SELECT CASE WHEN nullif(btrim(coalesce(p_q, '')), '') IS NULL THEN NULL
                ELSE '%' || replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%' END
$$;

-- Entrada jsonb: exige un objeto.
CREATE OR REPLACE FUNCTION app.b1_obj(p jsonb) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
    IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
        PERFORM app.fallar('VALIDACION', 'Se esperaba un objeto JSON con los datos.');
    END IF;
    RETURN p;
END
$$;

-- Texto recortado de una clave del objeto ('' y null -> null).
CREATE OR REPLACE FUNCTION app.b1_str(p jsonb, k text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path = pg_catalog, pg_temp
AS $$ SELECT nullif(btrim(p ->> k), '') $$;

-- Entero de una clave del objeto; VALIDACION si no es un entero.
CREATE OR REPLACE FUNCTION app.b1_int(p jsonb, k text) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE
    SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    v text := nullif(btrim(p ->> k), '');
BEGIN
    IF v IS NULL THEN
        RETURN NULL;
    END IF;
    IF v !~ '^-?[0-9]{1,9}$' THEN
        PERFORM app.fallar('VALIDACION', format('%s debe ser un entero.', k));
    END IF;
    RETURN v::integer;
END
$$;

-- Nombre para listados: apellidos primero.
CREATE OR REPLACE FUNCTION app.b1_nombre(p_ap text, p_am text, p_nombres text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path = pg_catalog, pg_temp
AS $$ SELECT p_ap || ' ' || coalesce(p_am || ' ', '') || p_nombres $$;

-- Formas JSON base (claves = columnas). INVOKER: la RLS del llamador aplica a lo que lean otros.
CREATE OR REPLACE FUNCTION app.b1_alumno_json(a public.alumno) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path = pg_catalog, pg_temp
AS $$
    SELECT jsonb_build_object(
        'id_alumno', a.id_alumno, 'matricula', a.matricula,
        'apellido_paterno', a.apellido_paterno, 'apellido_materno', a.apellido_materno, 'nombres', a.nombres,
        'nombre_completo', app.b1_nombre(a.apellido_paterno, a.apellido_materno, a.nombres),
        'correo_institucional', a.correo_institucional, 'estatus', a.estatus)
$$;

CREATE OR REPLACE FUNCTION app.b1_docente_json(d public.docente) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path = pg_catalog, pg_temp
AS $$
    SELECT jsonb_build_object(
        'id_docente', d.id_docente, 'num_empleado', d.num_empleado,
        'apellido_paterno', d.apellido_paterno, 'apellido_materno', d.apellido_materno, 'nombres', d.nombres,
        'nombre_completo', app.b1_nombre(d.apellido_paterno, d.apellido_materno, d.nombres),
        'correo_institucional', d.correo_institucional, 'estatus', d.estatus)
$$;

CREATE OR REPLACE FUNCTION app.b1_materia_json(m public.materia) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path = pg_catalog, pg_temp
AS $$
    SELECT jsonb_build_object('id_materia', m.id_materia, 'clave', m.clave, 'nombre', m.nombre,
                              'creditos', m.creditos, 'horas_semana', m.horas_semana)
$$;

CREATE OR REPLACE FUNCTION app.b1_aula_json(a public.aula) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path = pg_catalog, pg_temp
AS $$
    SELECT jsonb_build_object('id_aula', a.id_aula, 'clave', a.clave, 'edificio', a.edificio, 'capacidad', a.capacidad)
$$;

-- Camara; la direccion IP es infraestructura: solo la ve el administrador.
CREATE OR REPLACE FUNCTION app.b1_camara_json(c public.camara) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path = public, app, pg_temp
AS $$
    SELECT jsonb_build_object('id_camara', c.id_camara, 'id_aula', c.id_aula, 'posicion', c.posicion,
        'tipo', c.tipo,
        'direccion_ip', CASE WHEN app.rol() = 'administrador' THEN c.direccion_ip ELSE NULL END,
        'estatus', c.estatus)
$$;

GRANT EXECUTE ON FUNCTION
    app.b1_limite(integer), app.b1_desplazamiento(integer), app.b1_patron(text), app.b1_obj(jsonb),
    app.b1_str(jsonb, text), app.b1_int(jsonb, text), app.b1_nombre(text, text, text),
    app.b1_alumno_json(public.alumno), app.b1_docente_json(public.docente), app.b1_materia_json(public.materia),
    app.b1_aula_json(public.aula), app.b1_camara_json(public.camara)
    TO authenticated, service_role;
