-- 0001 · Esquemas, privilegios por omision y reloj unico.
-- La logica interna vive en el esquema privado 'app' (no expuesto por la API de Supabase);
-- las tablas y las RPC (api_*, svc_*) viven en 'public'.

CREATE SCHEMA IF NOT EXISTS app;
COMMENT ON SCHEMA app IS 'Logica interna de SUSAN (helpers, funciones de trigger, nucleos de las RPC). No se expone por la API.';

-- Nadie ve el esquema app salvo los roles de la API que lo necesitan (las politicas RLS y las
-- RPC INVOKER evalúan funciones de app con los privilegios del usuario). anon queda fuera.
REVOKE ALL ON SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO authenticated, service_role;

-- Postura "cerrado por omision": las funciones nuevas NO son ejecutables por PUBLIC y las de
-- public tampoco lo son por anon/authenticated; cada RPC concede su EXECUTE explicitamente
-- justo despues de CREATE FUNCTION. (Supabase concede ALL a los roles de la API por omision.)
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- Extensiones (en Supabase viven en el esquema 'extensions').
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------------------------
-- Reloj unico. Toda la logica de negocio usa app.now(), nunca now() directamente, para que las
-- pruebas y la demostracion puedan fijar la hora. Se vive en 0001 porque varios DEFAULT de las
-- tablas lo usan.
-- ---------------------------------------------------------------------------------------------

CREATE FUNCTION app.tz() RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path = pg_catalog, pg_temp
AS $$ SELECT 'America/Mexico_City'::text $$;
COMMENT ON FUNCTION app.tz() IS 'Zona horaria del plantel: America/Mexico_City.';

-- El reloj simulado solo se honra si la BASE lo habilito (ALTER DATABASE ... SET
-- app.allow_fake_clock = 'on', que hacen unicamente los scripts locales) Y la sesion fija
-- app.fake_now. Como un SET de sesion puede imitar cualquier GUC 'app.*', se exige ademas que
-- allow_fake_clock figure en la configuracion de la BASE (pg_db_role_setting) y no solo en la sesion.
CREATE FUNCTION app.reloj_simulado() RETURNS boolean
    LANGUAGE plpgsql STABLE
    SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
    IF coalesce(current_setting('app.allow_fake_clock', true), '') <> 'on' THEN
        RETURN false;
    END IF;
    IF coalesce(current_setting('app.fake_now', true), '') = '' THEN
        RETURN false;
    END IF;
    -- La fuente de verdad es pg_db_role_setting (lo que escribe ALTER DATABASE ... SET); un SET de
    -- sesion no la modifica.
    RETURN EXISTS (
        SELECT 1 FROM pg_db_role_setting s
         WHERE s.setdatabase = (SELECT d.oid FROM pg_database d WHERE d.datname = current_database())
           AND s.setrole = 0
           AND s.setconfig @> ARRAY['app.allow_fake_clock=on']);
END
$$;
COMMENT ON FUNCTION app.reloj_simulado() IS 'true si app.now() devuelve la hora simulada app.fake_now (solo bases locales/de prueba).';

CREATE FUNCTION app.now() RETURNS timestamptz
    LANGUAGE plpgsql STABLE
    SET search_path = pg_catalog, app, pg_temp
AS $$
BEGIN
    IF app.reloj_simulado() THEN
        RETURN current_setting('app.fake_now')::timestamptz;
    END IF;
    RETURN now();
END
$$;
COMMENT ON FUNCTION app.now() IS 'Reloj unico del negocio: now(), o app.fake_now si la base habilito el reloj simulado.';

CREATE FUNCTION app.hoy() RETURNS date
    LANGUAGE sql STABLE
    SET search_path = pg_catalog, app, pg_temp
AS $$ SELECT (app.now() AT TIME ZONE app.tz())::date $$;
COMMENT ON FUNCTION app.hoy() IS 'Fecha actual en la zona del plantel, segun app.now().';

-- Instante en que ocurre una hora de clase: (fecha + hora) interpretado en la zona del plantel.
CREATE FUNCTION app.instante_clase(p_fecha date, p_hora time) RETURNS timestamptz
    LANGUAGE sql STABLE
    SET search_path = pg_catalog, app, pg_temp
AS $$ SELECT ((p_fecha + p_hora) AT TIME ZONE app.tz()) $$;
COMMENT ON FUNCTION app.instante_clase(date, time) IS 'Instante (timestamptz) de una fecha y hora de clase en America/Mexico_City.';

GRANT EXECUTE ON FUNCTION app.tz(), app.reloj_simulado(), app.now(), app.hoy(), app.instante_clase(date, time)
    TO authenticated, service_role;
