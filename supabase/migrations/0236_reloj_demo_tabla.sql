-- Reloj de demostración en Supabase.
--
-- En local el reloj simulado se habilita con ALTER DATABASE ... SET app.allow_fake_clock (0001).
-- En Supabase (PostgreSQL 15+) el rol postgres NO es superusuario y no puede fijar parámetros
-- personalizados a nivel de base ("permission denied to set parameter"), así que la demo no
-- tendría sesiones "de hoy". Segunda fuente, igual de cerrada: una tabla de UNA fila sin
-- privilegios para anon/authenticated/service_role; solo el dueño de la base (SQL Editor o
-- conexión directa) puede escribirla. El camino por GUC de 0001 sigue igual y tiene prioridad.

CREATE TABLE app.reloj_demo (
    id        boolean     PRIMARY KEY DEFAULT true CHECK (id),
    fake_now  timestamptz NOT NULL
);
COMMENT ON TABLE app.reloj_demo IS
    'Reloj de demostración para bases donde no se puede usar ALTER DATABASE SET (Supabase). Una fila = reloj simulado activo. Solo el dueño de la base la escribe.';
REVOKE ALL ON app.reloj_demo FROM PUBLIC;
DO $$
DECLARE r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON app.reloj_demo FROM %I', r);
        END IF;
    END LOOP;
END
$$;

-- SECURITY DEFINER: app.now() corre con el rol de quien llama (authenticated en lecturas con RLS)
-- y ese rol no puede leer la tabla; el ayudante solo expone el valor.
CREATE FUNCTION app.reloj_demo_valor() RETURNS timestamptz
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = pg_catalog, pg_temp
AS $$ SELECT r.fake_now FROM app.reloj_demo r WHERE r.id $$;
REVOKE ALL ON FUNCTION app.reloj_demo_valor() FROM PUBLIC;
DO $$
DECLARE r text;
BEGIN
    -- anon no: ninguna función de app es ejecutable sin sesión (schema_01_estructura)
    FOREACH r IN ARRAY ARRAY['authenticated', 'service_role'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('GRANT EXECUTE ON FUNCTION app.reloj_demo_valor() TO %I', r);
        END IF;
    END LOOP;
END
$$;
COMMENT ON FUNCTION app.reloj_demo_valor() IS 'Hora de app.reloj_demo, o NULL si no hay reloj de demostración por tabla.';

CREATE OR REPLACE FUNCTION app.reloj_simulado() RETURNS boolean
    LANGUAGE plpgsql STABLE
    SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
    IF coalesce(current_setting('app.allow_fake_clock', true), '') = 'on'
       AND coalesce(current_setting('app.fake_now', true), '') <> ''
       AND EXISTS (
            SELECT 1 FROM pg_db_role_setting s
             WHERE s.setdatabase = (SELECT d.oid FROM pg_database d WHERE d.datname = current_database())
               AND s.setrole = 0
               AND s.setconfig @> ARRAY['app.allow_fake_clock=on']) THEN
        RETURN true;
    END IF;
    RETURN app.reloj_demo_valor() IS NOT NULL;
END
$$;
COMMENT ON FUNCTION app.reloj_simulado() IS
    'true si app.now() devuelve una hora simulada: app.fake_now habilitado en la BASE (local) o una fila en app.reloj_demo (Supabase).';

CREATE OR REPLACE FUNCTION app.now() RETURNS timestamptz
    LANGUAGE plpgsql STABLE
    SET search_path = pg_catalog, app, pg_temp
AS $$
DECLARE
    v_tabla timestamptz;
BEGIN
    IF coalesce(current_setting('app.allow_fake_clock', true), '') = 'on'
       AND coalesce(current_setting('app.fake_now', true), '') <> ''
       AND EXISTS (
            SELECT 1 FROM pg_db_role_setting s
             WHERE s.setdatabase = (SELECT d.oid FROM pg_database d WHERE d.datname = current_database())
               AND s.setrole = 0
               AND s.setconfig @> ARRAY['app.allow_fake_clock=on']) THEN
        RETURN current_setting('app.fake_now')::timestamptz;
    END IF;
    v_tabla := app.reloj_demo_valor();
    RETURN coalesce(v_tabla, now());
END
$$;
COMMENT ON FUNCTION app.now() IS
    'Reloj único del negocio: now(), o la hora simulada (app.fake_now habilitado en la base, o app.reloj_demo).';
