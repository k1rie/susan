-- Semilla de demostracion · 10 cuentas de Auth SOLO PARA BASE LOCAL.
-- Crea en auth.users (stub de supabase/local/00_supabase_stubs.sql) una cuenta por cada fila de `usuario`
-- (menos la cuenta de servicio, que nunca inicia sesion) con la contrasena de DESARROLLO 'demo1234'.
-- NO usar en Supabase real: alli las cuentas las crea el administrador con auth.admin.createUser.
--
-- Cuentas (todas con contrasena demo1234):
--   admin@susan.local · tecnico@susan.local · docente1@susan.local (3A y 5C) · docente2@susan.local (3B) ·
--   docente3@susan.local (licencia) · e260001@susan.local ... e260025@susan.local (alumnos de 3A)
--
-- La sal de bcrypt es fija para que la semilla sea reproducible; es una clave de desarrollo conocida.
BEGIN;

INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
SELECT u.auth_uid, 'authenticated', 'authenticated', u.correo,
       extensions.crypt('demo1234', '$2a$10$SusanDemoSeedSaltAbcd.u'),
       TIMESTAMPTZ '2026-08-01 00:00:00+00',
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('rol', u.rol)
  FROM usuario u
 WHERE u.correo <> 'servicio@susan.local'
 ORDER BY u.id_usuario
ON CONFLICT (id) DO NOTHING;

COMMIT;
