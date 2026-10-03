-- Sesiones (1/5): panel del docente P-02, apertura (RN-06) y monitor P-03.
BEGIN;
SELECT t.begin('api_a_sesiones_01_panel_abrir');
SELECT t.cargar_fixtures();

-- ids por clave natural, legibles para cualquier rol (la RLS oculta alumnos ajenos)
CREATE TEMP TABLE ids AS
SELECT 's3a_14' AS k, t.id_sesion('3A', DATE '2026-09-14') AS v
UNION ALL SELECT 's3a_16', t.id_sesion('3A', DATE '2026-09-16')
UNION ALL SELECT 's3a_07', t.id_sesion('3A', DATE '2026-09-07')
UNION ALL SELECT 's5b_14', t.id_sesion('5B', DATE '2026-09-14')
UNION ALL SELECT 'A001', t.id_alumno('A001') UNION ALL SELECT 'A002', t.id_alumno('A002');
GRANT SELECT ON ids TO PUBLIC;
CREATE FUNCTION pg_temp.i(p text) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT v FROM ids WHERE k = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.i(text) TO PUBLIC;

-- ===== api_docente_panel ===========================================================================
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(public.api_docente_panel() ->> 'fecha', '2026-09-14', 'panel: fecha del plantel');
SELECT t.eq(jsonb_array_length(public.api_docente_panel() -> 'sesiones_hoy'), 1, 'panel: docente1 solo ve la sesion de hoy de su grupo (3A)');
SELECT t.eq(public.api_docente_panel() #>> '{sesiones_hoy,0,estatus}', 'abierta', 'panel: sesion 3A abierta');
SELECT t.eq(public.api_docente_panel() #>> '{sesiones_hoy,0,materia}', 'Administración I', 'panel: materia');
SELECT t.eq(public.api_docente_panel() #>> '{sesiones_hoy,0,aula}', 'A-12', 'panel: aula');
SELECT t.eq(public.api_docente_panel() #>> '{sesiones_hoy,0,modo_previsto}', 'automatico', 'panel: modo previsto automatico (camaras activas)');
SELECT t.eq((public.api_docente_panel() #>> '{sesiones_hoy,0,camaras_activas}')::int, 2, 'panel: dos camaras activas en A-12');
SELECT t.eq((public.api_docente_panel() ->> 'pendientes')::int, 0, 'panel: el pendiente de la sesion abierta aun no es de revision');
SELECT t.eq((public.api_docente_panel() ->> 'justificantes_por_resolver')::int, 1, 'panel: un justificante por resolver');
SELECT t.ok(jsonb_path_exists(public.api_docente_panel(), '$.alertas[*] ? (@.id_alumno == $a && @.tipo == "sin_derecho_examen")',
        jsonb_build_object('a', pg_temp.i('A002'))), 'panel: alerta de A002 sin derecho (1 falta de 3 programadas > 20 %)');
SELECT t.eq(jsonb_array_length(public.api_docente_panel() -> 'grupos'), 1, 'panel: un grupo');
SELECT t.eq((public.api_docente_panel() #>> '{grupos,0,inscritos}')::int, 4, 'panel: 4 inscritos activos (la baja no cuenta)');
SELECT t.eq(public.api_docente_panel() #>> '{grupos,0,periodo}', '2026-2', 'panel: periodo del grupo');

SELECT t.as_user('docente2@susan.test');
SELECT t.eq(jsonb_array_length(public.api_docente_panel() -> 'sesiones_hoy'), 1, 'panel: docente2 ve solo la de 5B');
SELECT t.eq(public.api_docente_panel() #>> '{sesiones_hoy,0,clave_grupo}', '5B', 'panel: docente2 -> 5B');
SELECT t.eq(public.api_docente_panel() #>> '{sesiones_hoy,0,modo_previsto}', 'manual', 'panel: B-04 sin camara activa -> manual');
SELECT t.eq((public.api_docente_panel() #>> '{sesiones_hoy,0,camaras_activas}')::int, 0, 'panel: B-04 sin camaras activas');
SELECT t.eq((public.api_docente_panel() ->> 'justificantes_por_resolver')::int, 0, 'panel: docente2 sin justificantes (los de 3A no son suyos)');

SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ SELECT public.api_docente_panel() $q$, 'P0001:NO_AUTORIZADO', 'panel: administrador no es docente');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ SELECT public.api_docente_panel() $q$, 'P0001:NO_AUTORIZADO', 'panel: alumno no');
SELECT t.as_user('tecnico@susan.test');
SELECT t.throws($q$ SELECT public.api_docente_panel() $q$, 'P0001:NO_AUTORIZADO', 'panel: tecnico no');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.api_docente_panel() $q$, '42501', 'panel: anon sin EXECUTE');
SELECT t.as_postgres();
SELECT t.throws($q$ SELECT public.api_docente_panel() $q$, 'P0001:NO_AUTENTICADO', 'panel: sin sesion');

-- La sesion programada aparece como "abrible" solo dentro de su horario
SELECT t.as_postgres();
SELECT t.efecto($q$ SELECT t.reloj('2026-09-16 07:30:00-06'); SELECT t.as_user('docente1@susan.test') $q$,
    $q$ SELECT (SELECT x ->> 'abrible' FROM jsonb_array_elements(public.api_docente_panel() -> 'sesiones_hoy') x WHERE (x ->> 'id_sesion')::int = pg_temp.i('s3a_16')) = 'true' $q$,
    'panel: sesion programada dentro de horario es abrible');

-- ===== api_abrir_sesion ============================================================================
-- Horario: [hora_inicio, hora_fin) de la fecha de la sesion
SELECT t.reloj('2026-09-16 06:59:59-06');
SELECT t.as_user('docente1@susan.test');
SELECT t.throws(format('SELECT public.api_abrir_sesion(%s)', pg_temp.i('s3a_16')), 'P0001:FUERA_DE_HORARIO', 'abrir: un segundo antes de hora_inicio');
SELECT t.as_postgres();
SELECT t.reloj('2026-09-16 08:00:00-06');
SELECT t.as_user('docente1@susan.test');
SELECT t.throws(format('SELECT public.api_abrir_sesion(%s)', pg_temp.i('s3a_16')), 'P0001:FUERA_DE_HORARIO', 'abrir: en hora_fin ya no');
SELECT t.as_postgres();
SELECT t.reloj('2026-09-15 07:30:00-06');
SELECT t.as_user('docente1@susan.test');
SELECT t.throws(format('SELECT public.api_abrir_sesion(%s)', pg_temp.i('s3a_16')), 'P0001:FUERA_DE_HORARIO', 'abrir: otro dia');

SELECT t.as_postgres();
SELECT t.reloj('2026-09-16 07:00:00-06');
SELECT t.as_user('docente2@susan.test');
SELECT t.throws(format('SELECT public.api_abrir_sesion(%s)', pg_temp.i('s3a_16')), 'P0001:NO_AUTORIZADO', 'abrir: docente ajeno (IDOR)');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws(format('SELECT public.api_abrir_sesion(%s)', pg_temp.i('s3a_16')), 'P0001:NO_AUTORIZADO', 'abrir: alumno');
SELECT t.as_user('admin@susan.test');
SELECT t.throws(format('SELECT public.api_abrir_sesion(%s)', pg_temp.i('s3a_16')), 'P0001:NO_AUTORIZADO', 'abrir: administrador no abre sesiones');
SELECT t.as_anon();
SELECT t.throws(format('SELECT public.api_abrir_sesion(%s)', pg_temp.i('s3a_16')), '42501', 'abrir: anon sin EXECUTE');
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT public.api_abrir_sesion(999999) $q$, 'P0001:NO_ENCONTRADO', 'abrir: sesion inexistente');
SELECT t.throws(format('SELECT public.api_abrir_sesion(%s)', pg_temp.i('s3a_07')), 'P0001:SESION_CERRADA', 'abrir: sesion cerrada');
SELECT t.eq(public.api_abrir_sesion(pg_temp.i('s3a_14')) ->> 'ya_abierta', 'true', 'abrir: idempotente si ya esta abierta');
SELECT t.eq(public.api_abrir_sesion(pg_temp.i('s3a_14')) ->> 'modo_registro', 'automatico', 'abrir: la sesion abierta conserva su modo');

-- Apertura valida: automatico con camaras activas
SELECT t.eq(public.api_abrir_sesion(pg_temp.i('s3a_16')) ->> 'modo_registro', 'automatico', 'abrir: automatico si hay camara activa (A-12)');
SELECT t.eq(public.api_abrir_sesion(pg_temp.i('s3a_16')) ->> 'estatus', 'abierta', 'abrir: queda abierta');
SELECT t.eq(jsonb_array_length(public.api_abrir_sesion(pg_temp.i('s3a_16')) -> 'camaras'), 2, 'abrir: devuelve las 2 camaras del aula');
SELECT t.eq(public.api_abrir_sesion(pg_temp.i('s3a_16')) ->> 'ya_abierta', 'true', 'abrir: segunda llamada idempotente');
SELECT t.as_postgres();
SELECT t.eq((SELECT estatus::text FROM sesion_clase WHERE id_sesion = pg_temp.i('s3a_16')), 'abierta', 'abrir: persistio el estatus');

-- Una sola camara activa basta (la otra en mantenimiento)
SELECT t.efecto($q$ UPDATE sesion_clase SET estatus = 'programada' WHERE id_sesion = pg_temp.i('s3a_16');
        UPDATE camara SET estatus = 'mantenimiento' WHERE id_camara = t.id_camara('A-12', 'fondo');
        SELECT t.as_user('docente1@susan.test'); SELECT public.api_abrir_sesion(pg_temp.i('s3a_16')) $q$,
    $q$ SELECT (SELECT modo_registro::text FROM sesion_clase WHERE id_sesion = pg_temp.i('s3a_16')) = 'automatico' $q$,
    'abrir: una camara activa basta para el modo automatico');
-- Ninguna camara activa -> manual (RN-06)
SELECT t.efecto($q$ UPDATE sesion_clase SET estatus = 'programada' WHERE id_sesion = pg_temp.i('s3a_16');
        UPDATE camara SET estatus = 'inactiva' WHERE id_aula = t.id_aula('A-12');
        SELECT t.as_user('docente1@susan.test'); SELECT public.api_abrir_sesion(pg_temp.i('s3a_16')) $q$,
    $q$ SELECT (SELECT modo_registro::text FROM sesion_clase WHERE id_sesion = pg_temp.i('s3a_16')) = 'manual' $q$,
    'abrir: sin camaras activas la sesion se abre en modo manual');
-- Aula B-04 (camara inactiva), reloj 09:10 de 5B
SELECT t.efecto($q$ UPDATE sesion_clase SET estatus = 'programada' WHERE id_sesion = pg_temp.i('s5b_14');
        SELECT t.reloj('2026-09-14 09:10:00-06'); SELECT t.as_user('docente2@susan.test'); SELECT public.api_abrir_sesion(pg_temp.i('s5b_14')) $q$,
    $q$ SELECT (SELECT modo_registro::text FROM sesion_clase WHERE id_sesion = pg_temp.i('s5b_14')) = 'manual' $q$,
    'abrir: 5B (aula B-04 sin camara activa) se abre en manual');
-- ===== api_sesion_monitor (3A del 14-sep, reloj 07:12) ============================================
SELECT t.as_postgres();
SELECT t.reloj('2026-09-14 07:12:00-06');
SELECT t.as_user('docente1@susan.test');
SELECT t.eq((public.api_sesion_monitor(pg_temp.i('s3a_14')) #>> '{sesion,minuto_actual}')::numeric, 12.00, 'monitor: minuto actual 12');
SELECT t.eq(public.api_sesion_monitor(pg_temp.i('s3a_14')) #>> '{sesion,en_ventana}', 'true', 'monitor: en ventana de tolerancia (12 <= 20)');
SELECT t.eq(public.api_sesion_monitor(pg_temp.i('s3a_14')) #>> '{sesion,fase}', 'retardo', 'monitor: fase retardo (10-20)');
SELECT t.eq(public.api_sesion_monitor(pg_temp.i('s3a_14')) #>> '{sesion,modo_registro}', 'automatico', 'monitor: modo');
SELECT t.eq(jsonb_array_length(public.api_sesion_monitor(pg_temp.i('s3a_14')) -> 'camaras'), 2, 'monitor: 2 camaras');
SELECT t.eq(public.api_sesion_monitor(pg_temp.i('s3a_14')) #>> '{camaras,0,posicion}', 'frente', 'monitor: camara frente primero');
SELECT t.eq((public.api_sesion_monitor(pg_temp.i('s3a_14')) #>> '{camaras,0,capturas}')::int, 2, 'monitor: 2 capturas de la camara frente');
SELECT t.ok((public.api_sesion_monitor(pg_temp.i('s3a_14')) #>> '{camaras,0,ultima_captura}')::timestamptz = '2026-09-14 07:05:15-06', 'monitor: ultima captura de la camara frente');
SELECT t.eq((public.api_sesion_monitor(pg_temp.i('s3a_14')) #>> '{camaras,1,capturas}')::int, 0, 'monitor: la camara fondo no tiene capturas');
SELECT t.eq(jsonb_array_length(public.api_sesion_monitor(pg_temp.i('s3a_14')) -> 'alumnos'), 4, 'monitor: 4 inscritos activos (sin la baja)');
SELECT t.eq(jsonb_path_query_first(public.api_sesion_monitor(pg_temp.i('s3a_14')), '$.alumnos[*] ? (@.matricula == "A001")') ->> 'estado', 'pendiente', 'monitor: A001 pendiente');
SELECT t.eq((jsonb_path_query_first(public.api_sesion_monitor(pg_temp.i('s3a_14')), '$.alumnos[*] ? (@.matricula == "A001")') ->> 'lecturas_validas')::int, 1, 'monitor: A001 con 1 lectura valida (la de 0.801 no cuenta)');
SELECT t.eq((jsonb_path_query_first(public.api_sesion_monitor(pg_temp.i('s3a_14')), '$.alumnos[*] ? (@.matricula == "A001")') ->> 'mejor_score')::numeric, 0.912, 'monitor: mejor score de A001');
SELECT t.eq(jsonb_path_query_first(public.api_sesion_monitor(pg_temp.i('s3a_14')), '$.alumnos[*] ? (@.matricula == "A001")') ->> 'origen', 'automatico', 'monitor: origen automatico');
SELECT t.ok(jsonb_path_query_first(public.api_sesion_monitor(pg_temp.i('s3a_14')), '$.alumnos[*] ? (@.matricula == "A002")') -> 'estado' = 'null'::jsonb, 'monitor: A002 sin registro (estado null)');
SELECT t.eq(jsonb_path_query_first(public.api_sesion_monitor(pg_temp.i('s3a_14')), '$.alumnos[*] ? (@.matricula == "A001")') ->> 'consentimiento_vigente', 'true', 'monitor: A001 con consentimiento vigente');
SELECT t.eq(jsonb_path_query_first(public.api_sesion_monitor(pg_temp.i('s3a_14')), '$.alumnos[*] ? (@.matricula == "A005")') ->> 'consentimiento_vigente', 'false', 'monitor: A005 consentimiento revocado');
SELECT t.eq(jsonb_path_query_first(public.api_sesion_monitor(pg_temp.i('s3a_14')), '$.alumnos[*] ? (@.matricula == "A006")') ->> 'consentimiento_vigente', 'false', 'monitor: A006 consentimiento vencido');
SELECT t.eq((public.api_sesion_monitor(pg_temp.i('s3a_14')) #>> '{totales,inscritos}')::int, 4, 'monitor: totales.inscritos');
SELECT t.eq((public.api_sesion_monitor(pg_temp.i('s3a_14')) #>> '{totales,pendientes}')::int, 1, 'monitor: totales.pendientes');
SELECT t.eq((public.api_sesion_monitor(pg_temp.i('s3a_14')) #>> '{totales,sin_registro}')::int, 3, 'monitor: totales.sin_registro');
SELECT t.eq((public.api_sesion_monitor(pg_temp.i('s3a_14')) #>> '{totales,capturas}')::int, 2, 'monitor: totales.capturas');
SELECT t.eq((public.api_sesion_monitor(pg_temp.i('s3a_14')) #>> '{totales,detecciones}')::int, 3, 'monitor: totales.detecciones');
SELECT t.eq((public.api_sesion_monitor(pg_temp.i('s3a_14')) #>> '{totales,detecciones_validas}')::int, 1, 'monitor: totales.detecciones_validas');
SELECT t.throws(format('SELECT public.api_sesion_monitor(%s)', pg_temp.i('s5b_14')), 'P0001:NO_AUTORIZADO', 'monitor: docente ajeno');
SELECT t.throws($q$ SELECT public.api_sesion_monitor(999999) $q$, 'P0001:NO_ENCONTRADO', 'monitor: sesion inexistente');
SELECT t.as_user('docente2@susan.test');
SELECT t.throws(format('SELECT public.api_sesion_monitor(%s)', pg_temp.i('s3a_14')), 'P0001:NO_AUTORIZADO', 'monitor: docente2 sobre 3A');
SELECT t.eq(jsonb_array_length(public.api_sesion_monitor(pg_temp.i('s5b_14')) -> 'alumnos'), 1, 'monitor: sesion manual 5B con su unico inscrito');
SELECT t.as_user('admin@susan.test');
SELECT t.throws(format('SELECT public.api_sesion_monitor(%s)', pg_temp.i('s3a_14')), 'P0001:NO_AUTORIZADO', 'monitor: administrador');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws(format('SELECT public.api_sesion_monitor(%s)', pg_temp.i('s3a_14')), 'P0001:NO_AUTORIZADO', 'monitor: alumno');
SELECT t.as_anon();
SELECT t.throws(format('SELECT public.api_sesion_monitor(%s)', pg_temp.i('s3a_14')), '42501', 'monitor: anon');

-- minuto 9.5 -> fase presente; pasada la tolerancia -> fuera de ventana
SELECT t.as_postgres();
SELECT t.efecto($q$ SELECT t.reloj('2026-09-14 07:09:30-06'); SELECT t.as_user('docente1@susan.test') $q$,
    $q$ SELECT public.api_sesion_monitor(pg_temp.i('s3a_14')) #>> '{sesion,fase}' = 'presente' $q$, 'monitor: minuto 9.5 es fase presente');
SELECT t.efecto($q$ SELECT t.reloj('2026-09-14 07:20:01-06'); SELECT t.as_user('docente1@susan.test') $q$,
    $q$ SELECT public.api_sesion_monitor(pg_temp.i('s3a_14')) #>> '{sesion,fase}' = 'fuera_de_ventana'
        AND public.api_sesion_monitor(pg_temp.i('s3a_14')) #>> '{sesion,en_ventana}' = 'false' $q$, 'monitor: tras el minuto 20 sale de la ventana');

SELECT t.summary();
ROLLBACK;
