-- Emulacion MINIMA de lo que Supabase ya provee, solo para PostgreSQL local (sin Docker).
-- NUNCA se aplica en Supabase real: alli existen los roles, el esquema auth y el esquema storage.
-- Es idempotente (se reaplica en cada db-up) y tolera ejecuciones en paralelo: los roles son
-- globales del cluster y varias BD de prueba pueden crearlos a la vez.

-- ---------------------------------------------------------------------------------------------
-- Roles de la API (en Supabase: anon, authenticated, service_role). NOLOGIN: se asumen con
-- SET ROLE desde la conexion de superusuario, igual que PostgREST.
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN SELECT * FROM (VALUES
        ('anon', 'NOLOGIN NOINHERIT'),
        ('authenticated', 'NOLOGIN NOINHERIT'),
        ('service_role', 'NOLOGIN NOINHERIT BYPASSRLS')
    ) AS t(nombre, opciones)
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r.nombre) THEN
            BEGIN
                EXECUTE format('CREATE ROLE %I %s', r.nombre, r.opciones);
            EXCEPTION WHEN duplicate_object OR unique_violation THEN
                NULL; -- otra ejecucion en paralelo lo creo primero
            END;
        END IF;
    END LOOP;
END
$$;

-- ---------------------------------------------------------------------------------------------
-- Esquema extensions (Supabase instala ahi pgcrypto, pg_trgm, ...).
-- ---------------------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Permisos por omision que Supabase da en el esquema public: ALL a los tres roles de la API.
-- Las migraciones de SUSAN los retiran explicitamente (REVOKE) donde corresponde.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Esquema auth (GoTrue). Solo lo que SUSAN usa: auth.users y auth.uid()/role()/jwt()/email().
-- ---------------------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    aud                 varchar(255) DEFAULT 'authenticated',
    role                varchar(255) DEFAULT 'authenticated',
    email               varchar(255) UNIQUE,
    encrypted_password  varchar(255),      -- bcrypt: extensions.crypt(clave, extensions.gen_salt('bf'))
    email_confirmed_at  timestamptz,
    raw_app_meta_data   jsonb,
    raw_user_meta_data  jsonb,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

-- Igual que Supabase: lee request.jwt.claims (y, por compatibilidad, request.jwt.claim.sub).
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
AS $$
    SELECT coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
AS $$
    SELECT coalesce(
        nullif(current_setting('request.jwt.claim.role', true), ''),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
    )::text
$$;

CREATE OR REPLACE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
AS $$
    SELECT coalesce(
        nullif(current_setting('request.jwt.claim.email', true), ''),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
    )::text
$$;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
AS $$
    SELECT coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.role(), auth.email(), auth.jwt() TO anon, authenticated, service_role;
-- En Supabase solo el servicio de autenticacion toca auth.users; service_role lo usa via auth.admin.
GRANT ALL ON auth.users TO service_role;

-- ---------------------------------------------------------------------------------------------
-- Esquema storage minimo: lo justo para probar politicas sobre storage.objects.
-- ---------------------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS storage.buckets (
    id                  text PRIMARY KEY,
    name                text NOT NULL UNIQUE,
    owner               uuid,
    public              boolean DEFAULT false,
    file_size_limit     bigint,
    allowed_mime_types  text[],
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage.objects (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id   text REFERENCES storage.buckets (id),
    name        text,
    owner       uuid,
    metadata    jsonb,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now(),
    CONSTRAINT bucketid_objname UNIQUE (bucket_id, name)
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    _parts text[];
BEGIN
    _parts := string_to_array(name, '/');
    RETURN _parts[1:array_length(_parts, 1) - 1];
END
$$;

CREATE OR REPLACE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    _parts text[];
BEGIN
    _parts := string_to_array(name, '/');
    RETURN _parts[array_length(_parts, 1)];
END
$$;

CREATE OR REPLACE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    _parts := string_to_array(name, '/');
    _filename := _parts[array_length(_parts, 1)];
    RETURN (string_to_array(_filename, '.'))[array_length(string_to_array(_filename, '.'), 1)];
END
$$;

GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT ALL ON storage.buckets, storage.objects TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION storage.foldername(text), storage.filename(text), storage.extension(text)
    TO anon, authenticated, service_role;
