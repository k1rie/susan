-- api_b3_01 · autoservicio del alumno (migracion 0239): api_mi_registro, api_mi_consentimiento_aceptar/revocar,
-- api_mi_plantilla_registrar, svc_faiss_ids_otros_alumnos y la no-regresion de api_plantilla_registrar (administrador).
-- Fixtures: A001 (consent vigente + plantilla activa en v001, alumno1@), A002 (consent vigente, sin plantilla, alumno2@),
-- A004 (plantilla activa en v001, alumno4@), A005 (consent revocado, cuenta INACTIVA). Reloj fijo: 14-sep-2026 07:12.
--
-- Ojo: las funciones t.id_* leen tablas con los privilegios del rol ACTIVO; un alumno no ve las filas de otros y obtendria NULL
-- (y una ruta NULL "pasaria" las pruebas de IDOR en vacio). Por eso los ids se guardan antes en t.k (como postgres) y las
-- aserciones que leen tablas se hacen como postgres.
BEGIN;
SELECT t.begin('api_b3_01_autoservicio');
SELECT t.cargar_fixtures();

-- Dos alumnos nuevos con cuenta: A007 sin consentimiento y A008 con baja temporal.
INSERT INTO public.alumno (matricula, apellido_paterno, apellido_materno, nombres, correo_institucional) VALUES
    ('A007', 'Prueba', 'Siete', 'Alumna', 'a007@susan.test'),
    ('A008', 'Prueba', 'Ocho', 'Alumno', 'a008@susan.test');
UPDATE public.alumno SET estatus = 'baja_temporal' WHERE matricula = 'A008';
INSERT INTO public.usuario (auth_uid, correo, rol, id_docente, id_alumno, activo) VALUES
    ('00000000-0000-4000-8000-000000000057', 'alumno7@susan.test', 'alumno', NULL, t.id_alumno('A007'), true),
    ('00000000-0000-4000-8000-000000000058', 'alumno8@susan.test', 'alumno', NULL, t.id_alumno('A008'), true);

-- Cache de ids legible por cualquier rol: 'A001' -> id_alumno; 'C_A001' -> su primer consentimiento; 'U_alumno1' -> id_usuario.
CREATE TABLE t.k (k text PRIMARY KEY, v integer);
GRANT SELECT ON t.k TO PUBLIC;
INSERT INTO t.k SELECT m, t.id_alumno(m) FROM unnest(ARRAY['A001', 'A002', 'A004', 'A005', 'A007', 'A008']) m;
INSERT INTO t.k SELECT 'C_' || m, t.id_consent(m) FROM unnest(ARRAY['A001', 'A002', 'A004']) m;
INSERT INTO t.k SELECT 'U_' || m, t.id_usuario(m || '@susan.test') FROM unnest(ARRAY['alumno1', 'alumno2', 'alumno7']) m;
CREATE FUNCTION t.ia(p_matricula text) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT v FROM t.k WHERE k = p_matricula $$;
CREATE FUNCTION t.ic(p_matricula text) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT v FROM t.k WHERE k = 'C_' || p_matricula $$;
CREATE FUNCTION t.iu(p_cuenta text) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT v FROM t.k WHERE k = 'U_' || p_cuenta $$;
GRANT EXECUTE ON FUNCTION t.ia(text), t.ic(text), t.iu(text) TO PUBLIC;
-- Ruta valida de objeto: <prefijo>/<id_alumno>/<uuid>.<ext>
CREATE FUNCTION t.ruta(p_prefijo text, p_matricula text, p_n integer, p_ext text) RETURNS text LANGUAGE sql STABLE
AS $$ SELECT p_prefijo || '/' || t.ia(p_matricula) || '/00000000-0000-4000-8000-' || lpad(p_n::text, 12, '0') || '.' || p_ext $$;
-- N rutas de fotos del alumno desde el uuid base indicado, como el arreglo p_fotos de la RPC.
CREATE FUNCTION t.fotos(p_matricula text, p_base integer, p_n integer) RETURNS jsonb LANGUAGE sql STABLE
AS $$ SELECT jsonb_agg(jsonb_build_object('objeto_foto', t.ruta('registro', p_matricula, p_base + g, 'jpg'))) FROM generate_series(1, p_n) g $$;
GRANT EXECUTE ON FUNCTION t.ruta(text, text, integer, text), t.fotos(text, integer, integer) TO PUBLIC;
SELECT t.ok(t.ia('A001') IS NOT NULL AND t.ic('A002') IS NOT NULL AND t.iu('alumno7') IS NOT NULL, 'preparacion: ids en cache');

-- ---- api_mi_registro: el estado sale de la sesion, nunca de un parametro ----
SELECT t.as_user('alumno1@susan.test');
SELECT t.eq((public.api_mi_registro() ->> 'id_alumno')::int, t.ia('A001'), 'mi_registro: es el alumno de la sesion (A001)');
SELECT t.eq(public.api_mi_registro() ->> 'paso', 'listo', 'mi_registro A001: consentimiento + plantilla = listo');
SELECT t.ok((public.api_mi_registro() ->> 'completo')::boolean, 'mi_registro A001: completo');
SELECT t.eq(public.api_mi_registro() -> 'consentimiento' ->> 'origen', 'administrador', 'mi_registro A001: consentimiento de origen administrador');
SELECT t.eq(public.api_mi_registro() -> 'plantilla' ->> 'origen', 'administrador', 'mi_registro A001: plantilla de origen administrador');
SELECT t.ok((public.api_mi_registro() -> 'plantilla' ->> 'en_uso')::boolean, 'mi_registro A001: la plantilla esta en el indice en uso');
SELECT t.eq((public.api_mi_registro() ->> 'registros_24h')::int, 0, 'mi_registro A001: los registros del admin no cuentan para el candado');
SELECT t.eq((public.api_mi_registro() ->> 'limite_registros_24h')::int, 5, 'mi_registro: limite diario 5');
SELECT t.eq((public.api_mi_registro() ->> 'vigencia_meses')::int, 12, 'mi_registro: vigencia 12 meses');
SELECT t.eq(public.api_mi_registro() ->> 'vigencia_prevista', '2027-09-14', 'mi_registro: vigencia prevista = hoy + 12 meses');
SELECT t.eq(public.api_mi_registro() ->> 'matricula', 'A001', 'mi_registro: matricula');
SELECT t.ok(NOT (public.api_mi_registro() ? 'objeto_documento') AND NOT (public.api_mi_registro() -> 'plantilla' ? 'objeto_foto'),
    'mi_registro no expone rutas de objetos');
SELECT t.as_user('alumno2@susan.test');
SELECT t.eq((public.api_mi_registro() ->> 'id_alumno')::int, t.ia('A002'), 'mi_registro: A002 ve solo lo suyo');
SELECT t.eq(public.api_mi_registro() ->> 'paso', 'rostro', 'mi_registro A002: con consentimiento y sin plantilla falta el rostro');
SELECT t.ok(public.api_mi_registro() -> 'plantilla' = 'null'::jsonb, 'mi_registro A002: plantilla null');
SELECT t.as_user('alumno7@susan.test');
SELECT t.eq(public.api_mi_registro() ->> 'paso', 'consentimiento', 'mi_registro A007: sin consentimiento empieza por el aviso');
SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ SELECT public.api_mi_registro() $q$, 'P0001:NO_AUTORIZADO', 'mi_registro: administrador no');
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT public.api_mi_registro() $q$, 'P0001:NO_AUTORIZADO', 'mi_registro: docente no');
SELECT t.as_user('tecnico@susan.test');
SELECT t.throws($q$ SELECT public.api_mi_registro() $q$, 'P0001:NO_AUTORIZADO', 'mi_registro: tecnico no');
SELECT t.as_user('alumno5@susan.test');
SELECT t.throws($q$ SELECT public.api_mi_registro() $q$, 'P0001:CUENTA_INACTIVA', 'mi_registro: cuenta inactiva');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.api_mi_registro() $q$, '42501', 'mi_registro: anon sin EXECUTE');

-- ---- api_mi_consentimiento_aceptar ----
SELECT t.as_user('alumno7@susan.test');
SELECT t.ok((public.api_mi_consentimiento_aceptar(t.ruta('consentimientos', 'A007', 1, 'pdf'), '2026-10', '10.9.8.7') ->> 'vigente')::boolean,
    'aceptar: queda vigente');
SELECT t.eq(public.api_mi_registro() ->> 'paso', 'rostro', 'aceptar: ahora toca el rostro');
SELECT t.eq(public.api_mi_registro() -> 'consentimiento' ->> 'origen', 'alumno', 'aceptar: origen alumno');
SELECT t.eq(public.api_mi_registro() -> 'consentimiento' ->> 'version_aviso', '2026-10', 'aceptar: guarda la version del aviso');
SELECT t.eq(public.api_mi_registro() -> 'consentimiento' ->> 'fecha_firma', '2026-09-14', 'aceptar: firma = hoy (reloj de negocio)');
SELECT t.eq(public.api_mi_registro() -> 'consentimiento' ->> 'vigencia_hasta', '2027-09-14', 'aceptar: vigencia 12 meses');
SELECT t.throws($q$ SELECT public.api_mi_consentimiento_aceptar(t.ruta('consentimientos', 'A007', 2, 'pdf'), '2026-10') $q$,
    'P0001:CONSENTIMIENTO_YA_VIGENTE', 'aceptar dos veces: rechazado');
SELECT t.as_postgres();
SELECT t.eq((SELECT count(*)::int FROM public.consentimiento WHERE id_alumno = t.ia('A007')), 1, 'aceptar dos veces no duplica el consentimiento');
SELECT t.eq((SELECT count(*)::int FROM public.bitacora_auditoria WHERE accion = 'alta_consentimiento' AND entidad = 'consentimiento'
              AND valor_nuevo ->> 'origen' = 'alumno' AND ip_origen = '10.9.8.7' AND id_usuario = t.iu('alumno7')), 1,
    'aceptar: bitacora alta_consentimiento con usuario, origen e IP');
-- A002 ya tiene consentimiento vigente (fixture): no se duplica
SELECT t.as_user('alumno2@susan.test');
SELECT t.throws($q$ SELECT public.api_mi_consentimiento_aceptar(t.ruta('consentimientos', 'A002', 2, 'pdf'), '2026-10') $q$,
    'P0001:CONSENTIMIENTO_YA_VIGENTE', 'aceptar con uno vigente de antes: rechazado');
-- rutas y datos (A007 revoca el suyo para poder volver a aceptar)
SELECT t.as_postgres();
UPDATE public.consentimiento SET estatus = 'revocado' WHERE id_alumno = t.ia('A007');
SELECT t.as_user('alumno7@susan.test');
SELECT t.throws($q$ SELECT public.api_mi_consentimiento_aceptar(t.ruta('consentimientos', 'A001', 3, 'pdf'), '2026-10') $q$,
    'P0001:RUTA_INVALIDA', 'aceptar con ruta de OTRO alumno (IDOR)');
SELECT t.throws($q$ SELECT public.api_mi_consentimiento_aceptar(t.ruta('registro', 'A007', 3, 'pdf'), '2026-10') $q$,
    'P0001:RUTA_INVALIDA', 'aceptar con prefijo incorrecto');
SELECT t.throws($q$ SELECT public.api_mi_consentimiento_aceptar(t.ruta('consentimientos', 'A007', 3, 'jpg'), '2026-10') $q$,
    'P0001:RUTA_INVALIDA', 'aceptar con extension incorrecta');
SELECT t.throws($q$ SELECT public.api_mi_consentimiento_aceptar(NULL, '2026-10') $q$, 'P0001:RUTA_INVALIDA', 'aceptar con ruta nula');
SELECT t.throws($q$ SELECT public.api_mi_consentimiento_aceptar(t.ruta('consentimientos', 'A007', 3, 'pdf'), NULL) $q$,
    'P0001:VALIDACION', 'aceptar sin version del aviso');
SELECT t.throws($q$ SELECT public.api_mi_consentimiento_aceptar(t.ruta('consentimientos', 'A007', 3, 'pdf'), repeat('x', 21)) $q$,
    'P0001:VALIDACION', 'aceptar con version demasiado larga');
SELECT t.lives_rb($q$ SELECT public.api_mi_consentimiento_aceptar(t.ruta('consentimientos', 'A007', 3, 'pdf'), '2026-10') $q$,
    'aceptar de nuevo tras revocar es valido (historial)');
SELECT t.as_user('alumno8@susan.test');
SELECT t.throws($q$ SELECT public.api_mi_consentimiento_aceptar(t.ruta('consentimientos', 'A008', 1, 'pdf'), '2026-10') $q$,
    'P0001:ALUMNO_INACTIVO', 'aceptar con baja temporal');
SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ SELECT public.api_mi_consentimiento_aceptar(t.ruta('consentimientos', 'A001', 4, 'pdf'), '2026-10') $q$,
    'P0001:NO_AUTORIZADO', 'aceptar: administrador no (tiene api_consentimiento_registrar)');
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT public.api_mi_consentimiento_aceptar(t.ruta('consentimientos', 'A001', 4, 'pdf'), '2026-10') $q$,
    'P0001:NO_AUTORIZADO', 'aceptar: docente no');
SELECT t.as_user('alumno5@susan.test');
SELECT t.throws($q$ SELECT public.api_mi_consentimiento_aceptar(t.ruta('consentimientos', 'A005', 4, 'pdf'), '2026-10') $q$,
    'P0001:CUENTA_INACTIVA', 'aceptar: cuenta inactiva');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.api_mi_consentimiento_aceptar('x', '2026-10') $q$, '42501', 'aceptar: anon sin EXECUTE');

-- ---- api_mi_plantilla_registrar ----
SELECT t.as_user('alumno2@susan.test');
SELECT t.eq((public.api_mi_plantilla_registrar(t.ic('A002'), NULL, '10.1.2.3', t.fotos('A002', 100, 5)) ->> 'n_fotos')::int, 5,
    'plantilla propia: 5 fotos registradas');
SELECT t.eq(public.api_mi_registro() -> 'plantilla' ->> 'origen', 'alumno', 'plantilla propia: origen alumno');
SELECT t.eq((public.api_mi_registro() -> 'plantilla' ->> 'n_fotos')::int, 5, 'plantilla propia: 5 fotos en el estado');
SELECT t.eq(public.api_mi_registro() ->> 'paso', 'listo', 'plantilla propia: el registro queda completo');
SELECT t.eq((public.api_mi_registro() ->> 'registros_24h')::int, 1, 'plantilla propia: cuenta 1 para el candado');
SELECT t.as_postgres();
SELECT t.eq((SELECT count(*)::int FROM public.plantilla_foto f JOIN public.plantilla_facial p USING (id_plantilla)
              WHERE p.id_alumno = t.ia('A002') AND p.activa), 5, 'plantilla propia: 5 filas en plantilla_foto');
SELECT t.eq((SELECT count(*)::int FROM public.bitacora_auditoria WHERE accion = 'alta_plantilla' AND valor_nuevo ->> 'origen' = 'alumno'
              AND ip_origen = '10.1.2.3' AND id_usuario = t.iu('alumno2')), 1,
    'plantilla propia: bitacora alta_plantilla con origen alumno, IP y usuario');
-- ajeno / rutas / formas
SELECT t.as_user('alumno2@susan.test');
SELECT t.throws($q$ SELECT public.api_mi_plantilla_registrar(t.ic('A001'), NULL, NULL, t.fotos('A002', 800, 3)) $q$,
    'P0001:RN_13_CONSENTIMIENTO_AJENO', 'plantilla propia con el consentimiento de OTRO alumno');
SELECT t.throws($q$ SELECT public.api_mi_plantilla_registrar(t.ic('A002'), NULL, NULL, t.fotos('A001', 800, 3)) $q$,
    'P0001:RUTA_INVALIDA', 'plantilla propia con fotos en la ruta de OTRO alumno (IDOR)');
SELECT t.throws($q$ SELECT public.api_mi_plantilla_registrar(t.ic('A002'), NULL, NULL, t.fotos('A002', 800, 2)) $q$,
    'P0001:VALIDACION', 'plantilla propia con 2 fotos (el minimo del conjunto es 3)');
SELECT t.throws($q$ SELECT public.api_mi_plantilla_registrar(t.ic('A002'), NULL, NULL, t.fotos('A002', 800, 9)) $q$,
    'P0001:VALIDACION', 'plantilla propia con 9 fotos (maximo 8)');
SELECT t.throws($q$ SELECT public.api_mi_plantilla_registrar(t.ic('A002'), t.ruta('registro', 'A001', 801, 'jpg')) $q$,
    'P0001:RUTA_INVALIDA', 'plantilla propia: foto suelta de OTRO alumno');
SELECT t.throws($q$ SELECT public.api_mi_plantilla_registrar(999999, t.ruta('registro', 'A002', 801, 'jpg')) $q$,
    'P0001:NO_ENCONTRADO', 'plantilla propia: consentimiento inexistente');
SELECT t.as_user('alumno2@susan.test');
-- una sola foto (camino heredado) tambien vale: p_fotos = NULL
SELECT t.eq((public.api_mi_plantilla_registrar(t.ic('A002'), t.ruta('registro', 'A002', 200, 'jpg')) ->> 'n_fotos')::int, 1,
    'plantilla propia: una foto (camino heredado)');
SELECT t.ok((public.api_mi_plantilla_registrar(t.ic('A002'), NULL, NULL, t.fotos('A002', 300, 3)) ->> 'plantilla_archivada') IS NOT NULL,
    'plantilla propia: re-registrar archiva la anterior (RN-12)');
SELECT t.as_postgres();
SELECT t.eq((SELECT count(*)::int FROM public.plantilla_facial WHERE id_alumno = t.ia('A002') AND activa), 1, 'RN-12: una sola plantilla activa');
SELECT t.as_user('alumno2@susan.test');
-- candado: 3 hechas hasta aqui; el 4.o y el 5.o pasan y el 6.o se rechaza
SELECT public.api_mi_plantilla_registrar(t.ic('A002'), NULL, NULL, t.fotos('A002', 400, 3));
SELECT public.api_mi_plantilla_registrar(t.ic('A002'), NULL, NULL, t.fotos('A002', 500, 3));
SELECT t.throws($q$ SELECT public.api_mi_plantilla_registrar(t.ic('A002'), NULL, NULL, t.fotos('A002', 600, 3)) $q$,
    'P0001:AUTOREGISTRO_LIMITE', 'candado: el 6.o registro en 24 h se rechaza');
SELECT t.eq((public.api_mi_registro() ->> 'registros_24h')::int, 5, 'candado: registros_24h = 5');
SELECT t.reloj('2026-09-15 07:30:00-06');
SELECT t.lives_rb($q$ SELECT public.api_mi_plantilla_registrar(t.ic('A002'), NULL, NULL, t.fotos('A002', 600, 3)) $q$,
    'candado: pasadas 24 h se puede registrar de nuevo');
SELECT t.reloj('2026-09-14 07:12:00-06');
-- los registros del administrador NO consumen el candado del alumno y quedan con su origen
SELECT t.as_user('admin@susan.test');
SELECT t.lives_rb($q$ SELECT public.api_plantilla_registrar(t.ia('A002'), t.ic('A002'), NULL, NULL, t.fotos('A002', 700, 3)) $q$,
    'admin: api_plantilla_registrar sigue funcionando (no regresion)');
SELECT t.efecto($q$ SELECT public.api_plantilla_registrar(t.ia('A002'), t.ic('A002'), NULL, NULL, t.fotos('A002', 700, 3)) $q$,
    $q$ SELECT (SELECT origen FROM public.plantilla_facial WHERE id_alumno = t.ia('A002') AND activa) = 'administrador' $q$,
    'admin: la plantilla queda con origen administrador');
-- vencido por fecha
SELECT t.as_postgres();
UPDATE public.consentimiento SET fecha_firma = DATE '2026-08-01', vigencia_hasta = DATE '2026-09-13' WHERE id_alumno = t.ia('A004');
SELECT t.as_user('alumno4@susan.test');
SELECT t.throws($q$ SELECT public.api_mi_plantilla_registrar(t.ic('A004'), NULL, NULL, t.fotos('A004', 900, 3)) $q$,
    'P0001:RN_13_CONSENTIMIENTO_NO_VIGENTE', 'plantilla propia con consentimiento vencido por fecha');
SELECT t.as_user('alumno8@susan.test');
SELECT t.throws($q$ SELECT public.api_mi_plantilla_registrar(1, NULL, NULL, t.fotos('A008', 1, 3)) $q$,
    'P0001:ALUMNO_INACTIVO', 'plantilla propia con baja temporal');
-- roles
SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ SELECT public.api_mi_plantilla_registrar(t.ic('A002'), NULL, NULL, t.fotos('A002', 1000, 3)) $q$,
    'P0001:NO_AUTORIZADO', 'plantilla propia: administrador no (usa api_plantilla_registrar)');
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT public.api_mi_plantilla_registrar(1, NULL, NULL, NULL) $q$, 'P0001:NO_AUTORIZADO', 'plantilla propia: docente no');
SELECT t.as_user('tecnico@susan.test');
SELECT t.throws($q$ SELECT public.api_mi_plantilla_registrar(1, NULL, NULL, NULL) $q$, 'P0001:NO_AUTORIZADO', 'plantilla propia: tecnico no');
SELECT t.as_user('alumno5@susan.test');
SELECT t.throws($q$ SELECT public.api_mi_plantilla_registrar(1, NULL, NULL, NULL) $q$, 'P0001:CUENTA_INACTIVA', 'plantilla propia: cuenta inactiva');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.api_mi_plantilla_registrar(1, 'x') $q$, '42501', 'plantilla propia: anon sin EXECUTE');
-- un alumno no puede llamar a la RPC del administrador ni al nucleo
SELECT t.as_user('alumno2@susan.test');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.ia('A002'), t.ic('A002'), NULL, NULL, t.fotos('A002', 1100, 3)) $q$,
    'P0001:NO_AUTORIZADO', 'el alumno no puede usar api_plantilla_registrar (ni para si mismo)');
SELECT t.throws($q$ SELECT app.plantilla_registrar(t.ia('A002'), t.ic('A002'), NULL, NULL, t.fotos('A002', 1100, 3), 'alumno') $q$,
    '42501', 'el nucleo app.plantilla_registrar no es invocable por authenticated');

-- ---- api_mi_consentimiento_revocar ----
SELECT t.as_user('alumno1@susan.test');
SELECT t.eq((public.api_mi_consentimiento_revocar('10.4.4.4') ->> 'consentimientos_revocados')::int, 1, 'revocar: 1 consentimiento');
SELECT t.eq(public.api_mi_registro() ->> 'paso', 'consentimiento', 'revocar: vuelve al primer paso');
SELECT t.ok(public.api_mi_registro() -> 'plantilla' = 'null'::jsonb, 'revocar: la plantilla se archiva (RNF-06)');
SELECT t.throws($q$ SELECT public.api_mi_consentimiento_revocar() $q$, 'P0001:RN_13_CONSENTIMIENTO_NO_VIGENTE', 'revocar sin consentimiento vigente');
SELECT t.throws($q$ SELECT public.api_mi_plantilla_registrar(t.ic('A001'), NULL, NULL, t.fotos('A001', 1200, 3)) $q$,
    'P0001:RN_13_CONSENTIMIENTO_NO_VIGENTE', 'tras revocar no se registra el rostro (RN-13)');
SELECT t.as_postgres();
SELECT t.eq((SELECT estatus::text FROM public.consentimiento WHERE id_consent = t.ic('A001')), 'revocado', 'revocar: estatus revocado');
SELECT t.eq((SELECT count(*)::int FROM public.plantilla_facial WHERE id_alumno = t.ia('A001') AND activa), 0, 'revocar: ninguna plantilla activa');
SELECT t.eq((SELECT count(*)::int FROM public.bitacora_auditoria WHERE accion = 'revocacion_consentimiento' AND ip_origen = '10.4.4.4'
              AND id_usuario = t.iu('alumno1') AND valor_nuevo ->> 'origen' = 'alumno'), 1, 'revocar: bitacora revocacion_consentimiento');
SELECT t.as_user('alumno2@susan.test');
SELECT t.eq(public.api_mi_registro() ->> 'paso', 'listo', 'revocar de A001 no toca a A002');
SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ SELECT public.api_mi_consentimiento_revocar() $q$, 'P0001:NO_AUTORIZADO', 'revocar: administrador no (tiene api_consentimiento_revocar)');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.api_mi_consentimiento_revocar() $q$, '42501', 'revocar: anon sin EXECUTE');

-- ---- RLS: el alumno sigue sin leer las tablas biometricas ----
SELECT t.as_user('alumno2@susan.test');
SELECT t.ok((t.conteos() ->> 'consentimiento')::int <= 0, 'RLS: el alumno no lee consentimiento directamente');
SELECT t.ok((t.conteos() ->> 'plantilla_facial')::int <= 0, 'RLS: el alumno no lee plantilla_facial directamente');

-- ---- svc_faiss_ids_otros_alumnos ----
SELECT t.as_service();
SELECT t.eq(public.svc_faiss_ids_otros_alumnos(t.ia('A001')) -> 'faiss_ids', '[1]'::jsonb, 'otros: para A001 solo el faiss_id de A004');
SELECT t.eq(public.svc_faiss_ids_otros_alumnos(t.ia('A004')) -> 'faiss_ids', '[]'::jsonb,
    'otros: para A004 no hay otros (la plantilla de A001 se archivo al revocar)');
SELECT t.eq(public.svc_faiss_ids_otros_alumnos(t.ia('A002')) ->> 'indice', 'v001', 'otros: informa la version del indice en uso');
SELECT t.as_postgres();
UPDATE public.alumno SET estatus = 'baja_temporal' WHERE matricula = 'A004';
SELECT t.as_service();
SELECT t.eq(public.svc_faiss_ids_otros_alumnos(t.ia('A002')) -> 'faiss_ids', '[]'::jsonb, 'otros: un alumno dado de baja ya no cuenta como duplicado');
SELECT t.throws($q$ SELECT public.svc_faiss_ids_otros_alumnos(NULL) $q$, 'P0001:VALIDACION', 'otros: alumno nulo');
SELECT t.as_postgres();
UPDATE public.indice_faiss SET en_uso = false WHERE en_uso;
SELECT t.as_service();
SELECT t.ok(public.svc_faiss_ids_otros_alumnos(t.ia('A002')) ->> 'indice' IS NULL AND public.svc_faiss_ids_otros_alumnos(t.ia('A002')) -> 'faiss_ids' = '[]'::jsonb,
    'otros: sin indice en uso = lista vacia');
SELECT t.as_user('alumno2@susan.test');
SELECT t.throws($q$ SELECT public.svc_faiss_ids_otros_alumnos(1) $q$, '42501', 'otros: authenticated sin EXECUTE');
SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ SELECT public.svc_faiss_ids_otros_alumnos(1) $q$, '42501', 'otros: ni el administrador');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.svc_faiss_ids_otros_alumnos(1) $q$, '42501', 'otros: anon sin EXECUTE');

SELECT t.summary();
ROLLBACK;
