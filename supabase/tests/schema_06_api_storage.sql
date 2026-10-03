-- RPC de plataforma (api_yo, api_ahora, api_parametros_publicos), endurecimiento del reloj simulado
-- y politicas de Storage.
BEGIN;
SELECT t.begin('schema_06_api_storage');
SELECT t.cargar_fixtures();

-- ===== api_yo ======================================================================================
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(public.api_yo() ->> 'nombre', 'Ana López Ruiz', 'api_yo: nombre completo del docente (nombres + apellidos)');
SELECT t.eq(public.api_yo() ->> 'home', '/docente', 'api_yo: home del docente');
SELECT t.eq((public.api_yo() ->> 'id_docente')::int, t.id_docente('D001'), 'api_yo: id_docente');
SELECT t.ok((public.api_yo() -> 'id_alumno') = 'null'::jsonb AND (public.api_yo() ->> 'activo')::boolean, 'api_yo: id_alumno nulo y cuenta activa');
SELECT t.eq(public.api_yo() ->> 'rol', 'docente', 'api_yo: rol');
SELECT t.eq(public.api_yo() ->> 'auth_uid', '00000000-0000-4000-8000-000000000012', 'api_yo: auth_uid');
SELECT t.as_user('alumno1@susan.test');
SELECT t.eq(public.api_yo() ->> 'nombre', 'Beatriz Ramos Díaz', 'api_yo: nombre del alumno');
SELECT t.eq(public.api_yo() ->> 'home', '/alumno', 'api_yo: home del alumno');
SELECT t.as_user('admin@susan.test');
SELECT t.eq(public.api_yo() ->> 'nombre', 'admin@susan.test', 'api_yo: sin vinculo el nombre es el correo');
SELECT t.eq(public.api_yo() ->> 'home', '/admin', 'api_yo: home del administrador');
SELECT t.as_user('tecnico@susan.test');
SELECT t.eq(public.api_yo() ->> 'home', '/tecnico', 'api_yo: home del tecnico');
SELECT t.as_user('alumno5@susan.test');
SELECT t.ok((public.api_yo() ->> 'activo')::boolean = false AND (public.api_yo() -> 'home') = 'null'::jsonb, 'api_yo: cuenta inactiva => activo false y home nulo');
SELECT t.eq(public.api_yo() ->> 'nombre', 'alumno5@susan.test', 'api_yo: cuenta inactiva => nombre = correo (la RLS le oculta su ficha)');
SELECT t.as_uid_huerfano();
SELECT t.throws($q$ SELECT public.api_yo() $q$, 'P0001:CUENTA_NO_VINCULADA', 'api_yo: JWT valido sin cuenta en usuario');
SELECT t.as_postgres();
SELECT t.throws($q$ SELECT public.api_yo() $q$, 'P0001:NO_AUTENTICADO', 'api_yo: sin sesion');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.api_yo() $q$, '42501', 'api_yo: anon sin EXECUTE');

-- ===== api_ahora ===================================================================================
SELECT t.as_user('alumno1@susan.test');
SELECT t.eq(public.api_ahora() ->> 'fecha', '2026-09-14', 'api_ahora: fecha del plantel');
SELECT t.eq(public.api_ahora() ->> 'hora', '07:12:00', 'api_ahora: hora del plantel');
SELECT t.eq((public.api_ahora() ->> 'dia_semana')::int, 1, 'api_ahora: lunes = 1');
SELECT t.eq(public.api_ahora() ->> 'zona', 'America/Mexico_City', 'api_ahora: zona');
SELECT t.eq((public.api_ahora() ->> 'reloj_simulado')::boolean, true, 'api_ahora: avisa del reloj simulado');
SELECT t.eq((public.api_ahora() ->> 'ahora')::timestamptz, '2026-09-14 13:12:00+00'::timestamptz, 'api_ahora: instante UTC');
SELECT t.eq(public.api_ahora() ->> 'ahora', '2026-09-14T13:12:00+00:00', 'api_ahora: instante ISO 8601 con offset');
SELECT t.as_user('alumno5@susan.test');
SELECT t.throws($q$ SELECT public.api_ahora() $q$, 'P0001:CUENTA_INACTIVA', 'api_ahora: cuenta inactiva');
SELECT t.as_postgres();

-- ===== api_parametros_publicos ======================================================================
SELECT t.as_user('alumno1@susan.test');
SELECT t.eq((SELECT count(*) FROM jsonb_object_keys(public.api_parametros_publicos())), 12::bigint, 'api_parametros_publicos: las 12 claves, tambien para un alumno');
SELECT t.eq(public.api_parametros_publicos() ->> 'umbral_similitud', '0.850', 'api_parametros_publicos: el umbral conserva sus tres decimales');
SELECT t.eq(jsonb_typeof(public.api_parametros_publicos() -> 'min_detecciones_validas'), 'number', 'api_parametros_publicos: numericos como numero JSON');
SELECT t.eq((public.api_parametros_publicos() ->> 'horas_limite_correccion')::int, 48, 'api_parametros_publicos: horas_limite_correccion');
SELECT t.eq((public.api_parametros_publicos() ->> 'minutos_pase_lista_base')::int, 5, 'api_parametros_publicos: minutos_pase_lista_base');
SELECT t.eq(t.n('SELECT 1 FROM parametro_sistema'), 0, 'el alumno sigue sin poder leer la tabla de parametros');
SELECT t.as_user('alumno5@susan.test');
SELECT t.throws($q$ SELECT public.api_parametros_publicos() $q$, 'P0001:CUENTA_INACTIVA', 'api_parametros_publicos: cuenta inactiva');
SELECT t.as_postgres();
SELECT t.throws($q$ SELECT public.api_parametros_publicos() $q$, 'P0001:NO_AUTENTICADO', 'api_parametros_publicos: sin sesion');
SELECT t.efecto($q$ UPDATE parametro_sistema SET valor = '0.900' WHERE clave = 'umbral_similitud'; SELECT t.as_user('alumno1@susan.test') $q$,
    $q$ SELECT (SELECT (public.api_parametros_publicos() ->> 'umbral_similitud')::numeric) = 0.9 $q$, 'api_parametros_publicos refleja el valor vigente');

-- ===== Reloj simulado: un SET de sesion no basta ==========================================================
SELECT t.efecto($q$ DO $d$ BEGIN EXECUTE format('ALTER DATABASE %I RESET app.allow_fake_clock', current_database()); END $d$;
                    SELECT set_config('app.allow_fake_clock', 'on', true);
                    SELECT set_config('app.fake_now', '2001-01-01 00:00:00+00', true) $q$,
    $q$ SELECT NOT app.reloj_simulado() AND app.now() > '2025-01-01'::timestamptz $q$,
    'sin la configuracion de la BASE, un SET de sesion no habilita el reloj simulado (app.now() es el real)');
SELECT t.efecto($q$ DO $d$ BEGIN EXECUTE format('ALTER DATABASE %I RESET app.allow_fake_clock', current_database()); END $d$ $q$,
    $q$ SELECT NOT app.reloj_simulado() $q$, 'quitar app.allow_fake_clock de la base apaga el reloj simulado');

-- ===== Storage ==========================================================================================
SELECT t.eq((SELECT public FROM storage.buckets WHERE id = 'susan-private'), false, 'el bucket susan-private existe y es privado');
SELECT t.eq((SELECT count(*) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'susan_private_solo_servicio' AND permissive = 'RESTRICTIVE'),
            1::bigint, 'existe la politica RESTRICTIVE que cierra el bucket a los roles de la API');
INSERT INTO storage.buckets (id, name, public) VALUES ('otro-bucket', 'otro-bucket', false);
INSERT INTO storage.objects (bucket_id, name) VALUES ('susan-private', 'registro/1/a.jpg'), ('otro-bucket', 'x/y.jpg');
CREATE POLICY prueba_permisiva_demasiado_amplia ON storage.objects FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
SELECT t.as_user('admin@susan.test');
SELECT t.eq(t.n('SELECT 1 FROM storage.objects WHERE bucket_id = ''otro-bucket'''), 1, 'una politica permisiva abre otros buckets (control)');
SELECT t.eq(t.n('SELECT 1 FROM storage.objects WHERE bucket_id = ''susan-private'''), 0, 'aun con una politica permisiva, authenticated no ve objetos de susan-private');
SELECT t.throws($q$ INSERT INTO storage.objects (bucket_id, name) VALUES ('susan-private', 'justificantes/1/z.pdf') $q$, '42501', 'authenticated no sube a susan-private');
SELECT t.as_anon();
SELECT t.eq(t.n('SELECT 1 FROM storage.objects WHERE bucket_id = ''susan-private'''), 0, 'anon no ve objetos de susan-private');
SELECT t.throws($q$ INSERT INTO storage.objects (bucket_id, name) VALUES ('susan-private', 'registro/1/b.jpg') $q$, '42501', 'anon no sube a susan-private');
SELECT t.as_service();
SELECT t.eq(t.n('SELECT 1 FROM storage.objects WHERE bucket_id = ''susan-private'''), 1, 'service_role (BYPASSRLS) si ve el bucket');
SELECT t.lives_rb($q$ INSERT INTO storage.objects (bucket_id, name) VALUES ('susan-private', 'recortes/1/1/1.jpg') $q$, 'service_role sube al bucket');

SELECT t.summary();
ROLLBACK;
