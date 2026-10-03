-- Sesiones (4/5): cierre en sesion manual, cierre por el programador (cuenta de servicio), recalculo
-- (9 vs 10 faltas de 48, RN-11), suspension y reanudacion.
BEGIN;
SELECT t.begin('api_a_sesiones_04_cierre_suspension');
SELECT t.cargar_fixtures();

CREATE TEMP TABLE ids AS
SELECT 's3a_14' AS k, t.id_sesion('3A', DATE '2026-09-14') AS v
UNION ALL SELECT 's3a_16', t.id_sesion('3A', DATE '2026-09-16')
UNION ALL SELECT 's3a_07', t.id_sesion('3A', DATE '2026-09-07')
UNION ALL SELECT 's5b_14', t.id_sesion('5B', DATE '2026-09-14')
UNION ALL SELECT 'g3a', t.id_grupo('3A')
UNION ALL SELECT 'A001', t.id_alumno('A001') UNION ALL SELECT 'A002', t.id_alumno('A002')
UNION ALL SELECT 'A004', t.id_alumno('A004');
GRANT SELECT ON ids TO PUBLIC;
CREATE FUNCTION pg_temp.i(p text) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT v FROM ids WHERE k = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.i(text) TO PUBLIC;
GRANT SELECT ON public.asistencia, public.bitacora_auditoria, public.sesion_clase, public.inscripcion, public.v_resumen_asistencia TO PUBLIC;

-- ===== Sesion MANUAL: 5B, la docente adelanta el cierre al terminar la tolerancia =============
INSERT INTO inscripcion (id_alumno, id_grupo, estatus, fecha_alta) VALUES (pg_temp.i('A002'), t.id_grupo('5B'), 'activa', '2026-08-03');
SELECT t.reloj('2026-09-14 09:05:00-06');
SELECT t.as_user('docente2@susan.test');
SELECT t.lives(format($q$ SELECT public.api_registrar_manual(%s, %s, 'presente') $q$, pg_temp.i('s5b_14'), pg_temp.i('A004')), 'manual 5B: A004 presente a las 09:05');
SELECT t.as_postgres();
SELECT t.reloj('2026-09-14 09:19:59-06');
SELECT t.as_user('docente2@susan.test');
SELECT t.throws(format('SELECT public.api_cerrar_sesion(%s)', pg_temp.i('s5b_14')), 'P0001:VENTANA_TOLERANCIA_ABIERTA', 'cierre manual: 09:19:59 aun dentro de la tolerancia');
SELECT t.as_postgres();
SELECT t.reloj('2026-09-14 09:20:00-06');
SELECT t.as_user('docente2@susan.test');
SELECT t.eq(public.api_cerrar_sesion(pg_temp.i('s5b_14')) ->> 'ausentes_creados', '1', 'cierre manual: crea ausente a A002 (no marcada)');
SELECT t.as_postgres();
SELECT t.eq((SELECT estado || '/' || origen || '/' || coalesce(hora_registro::text, '-') FROM asistencia
              WHERE id_sesion = pg_temp.i('s5b_14') AND id_alumno = pg_temp.i('A002')), 'ausente/manual/-', 'cierre manual: ausente con origen del modo de la sesion (manual) y sin hora');
SELECT t.eq(t.n($$ SELECT 1 FROM bitacora_auditoria WHERE accion = 'cierre_sesion' AND id_registro = pg_temp.i('s5b_14')
                    AND id_usuario = t.id_usuario('docente2@susan.test') $$), 1, 'cierre manual: bitacora con la cuenta de la docente');

-- ===== Cierre por el programador (p_por_docente = false): cuenta de servicio ==================
SELECT t.reloj('2026-09-14 08:00:01-06');
SELECT t.as_service();
SELECT t.eq(app.cerrar_sesion(pg_temp.i('s3a_14'), false) ->> 'ausentes_creados', '3', 'job: ausente a A002, A005 y A006');
SELECT t.as_postgres();
SELECT t.eq(t.n($$ SELECT 1 FROM bitacora_auditoria WHERE accion = 'cierre_sesion' AND id_registro = pg_temp.i('s3a_14')
                    AND id_usuario = t.id_usuario('servicio@susan.local') AND NOT (valor_nuevo ->> 'por_docente')::boolean $$), 1, 'job: bitacora a nombre de la cuenta de servicio');
SELECT t.eq((SELECT estado::text FROM asistencia WHERE id_sesion = pg_temp.i('s3a_14') AND id_alumno = pg_temp.i('A001')), 'pendiente', 'job: A001 con 1 lectura queda pendiente');
SELECT t.eq((SELECT origen::text FROM asistencia WHERE id_sesion = pg_temp.i('s3a_14') AND id_alumno = pg_temp.i('A002')), 'automatico', 'job: ausente con origen del modo (automatico)');
SELECT t.eq((SELECT derecho_examen FROM inscripcion WHERE id_alumno = pg_temp.i('A002') AND id_grupo = pg_temp.i('g3a')), false, 'job: el cierre recalcula (A002 con 2 faltas de 3 pierde el derecho)');
SELECT t.as_service();
SELECT t.eq(app.cerrar_sesion(pg_temp.i('s3a_14'), false) ->> 'ya_cerrada', 'true', 'job: idempotente');
SELECT t.throws(format('SELECT app.cerrar_sesion(%s, false)', pg_temp.i('s3a_16')), 'P0001:SESION_NO_ABIERTA', 'job: una sesion programada no se cierra');
SELECT t.as_postgres();  -- limpia la identidad de servicio que asumio el cierre del programador
SELECT t.as_user('docente1@susan.test');
SELECT t.throws(format('SELECT app.cerrar_sesion(%s, true)', pg_temp.i('s3a_14')), '42501', 'app.cerrar_sesion no es llamable por authenticated');
SELECT t.throws(format('SELECT public.api_cerrar_sesion(%s)', pg_temp.i('s3a_16')), 'P0001:SESION_NO_ABIERTA', 'api_cerrar_sesion: sesion programada');

-- ===== 9 vs 10 faltas de 48 (RN-11) =============================================================
-- 3A pasa a 48 sesiones; A002 acumula ausencias previas y el cierre de la sesion del 14-sep agrega la ultima.
SELECT t.as_postgres();
SELECT t.reloj('2026-09-14 07:25:00-06');
UPDATE sesion_clase SET estatus = 'abierta' WHERE id_sesion = pg_temp.i('s3a_14');
DELETE FROM asistencia WHERE id_sesion = pg_temp.i('s3a_14');
UPDATE inscripcion SET derecho_examen = true WHERE id_alumno = pg_temp.i('A002') AND id_grupo = pg_temp.i('g3a');
INSERT INTO sesion_clase (id_grupo, fecha, hora_inicio, hora_fin, estatus)
SELECT pg_temp.i('g3a'), DATE '2026-10-01' + n, '07:00', '08:00', CASE WHEN n < 8 THEN 'cerrada' ELSE 'programada' END::public.estatus_sesion
  FROM generate_series(0, 44) n;
SELECT t.eq(t.n($$ SELECT 1 FROM sesion_clase WHERE id_grupo = pg_temp.i('g3a') $$), 48, 'limite: 48 sesiones programadas');
-- Caso 9: A002 con 1 (07-sep) + 7 ausencias previas = 8; el cierre agrega la 9.a -> conserva derecho
SELECT t.efecto($q$
    INSERT INTO asistencia (id_sesion, id_alumno, estado, hora_registro, origen, conteo_detecciones)
    SELECT s.id_sesion, pg_temp.i('A002'), 'ausente', NULL, 'automatico', 0 FROM sesion_clase s
     WHERE s.id_grupo = pg_temp.i('g3a') AND s.fecha BETWEEN '2026-10-01' AND '2026-10-07';
    SELECT t.as_user('docente1@susan.test'); SELECT public.api_cerrar_sesion(pg_temp.i('s3a_14')) $q$,
    $q$ SELECT (SELECT derecho_examen FROM inscripcion WHERE id_alumno = pg_temp.i('A002') AND id_grupo = pg_temp.i('g3a'))
           AND (SELECT faltas_equivalentes FROM v_resumen_asistencia WHERE id_alumno = pg_temp.i('A002') AND id_grupo = pg_temp.i('g3a')) = 9 $q$,
    'limite: 9 faltas de 48 (18.75 %) conserva el derecho a examen');
-- Caso 10: una ausencia previa mas -> el cierre agrega la 10.a -> 20.83 % pierde el derecho
SELECT t.efecto($q$
    INSERT INTO asistencia (id_sesion, id_alumno, estado, hora_registro, origen, conteo_detecciones)
    SELECT s.id_sesion, pg_temp.i('A002'), 'ausente', NULL, 'automatico', 0 FROM sesion_clase s
     WHERE s.id_grupo = pg_temp.i('g3a') AND s.fecha BETWEEN '2026-10-01' AND '2026-10-08';
    SELECT t.as_user('docente1@susan.test'); SELECT public.api_cerrar_sesion(pg_temp.i('s3a_14')) $q$,
    $q$ SELECT NOT (SELECT derecho_examen FROM inscripcion WHERE id_alumno = pg_temp.i('A002') AND id_grupo = pg_temp.i('g3a'))
           AND (SELECT faltas_equivalentes FROM v_resumen_asistencia WHERE id_alumno = pg_temp.i('A002') AND id_grupo = pg_temp.i('g3a')) = 10 $q$,
    'limite: 10 faltas de 48 (20.83 %) pierde el derecho a examen');

-- ===== Suspension y reanudacion ================================================================
SELECT t.as_postgres();
SELECT t.reloj('2026-09-14 07:25:00-06');
DELETE FROM sesion_clase WHERE id_grupo = pg_temp.i('g3a') AND fecha >= '2026-10-01' AND NOT EXISTS (SELECT 1 FROM asistencia a WHERE a.id_sesion = sesion_clase.id_sesion);
SELECT t.eq((SELECT sesiones_programadas FROM v_resumen_asistencia WHERE id_alumno = pg_temp.i('A001') AND id_grupo = pg_temp.i('g3a')), 3, 'suspension: 3 sesiones programadas antes');
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(public.api_suspender_sesion(pg_temp.i('s3a_16'), 'Suspensión de labores') ->> 'estatus', 'suspendida', 'suspender: docente titular');
SELECT t.as_postgres();
SELECT t.eq((SELECT sesiones_programadas FROM v_resumen_asistencia WHERE id_alumno = pg_temp.i('A001') AND id_grupo = pg_temp.i('g3a')), 2, 'suspension: sale del denominador (2 programadas)');
SELECT t.eq(t.n($$ SELECT 1 FROM bitacora_auditoria WHERE accion = 'correccion' AND entidad = 'sesion_clase' AND id_registro = pg_temp.i('s3a_16')
                    AND valor_nuevo ->> 'motivo' = 'Suspensión de labores' $$), 1, 'suspension: bitacora con motivo');
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(public.api_suspender_sesion(pg_temp.i('s3a_16'), 'otra vez') ->> 'ya_suspendida', 'true', 'suspender: idempotente');
SELECT t.throws(format($q$ SELECT public.api_abrir_sesion(%s) $q$, pg_temp.i('s3a_16')), 'P0001:SESION_SUSPENDIDA', 'suspendida no se abre');
SELECT t.eq(public.api_reanudar_sesion(pg_temp.i('s3a_16')) ->> 'estatus', 'programada', 'reanudar: vuelve a programada');
SELECT t.as_postgres();
SELECT t.eq((SELECT sesiones_programadas FROM v_resumen_asistencia WHERE id_alumno = pg_temp.i('A001') AND id_grupo = pg_temp.i('g3a')), 3, 'reanudar: vuelve al denominador');
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(public.api_reanudar_sesion(pg_temp.i('s3a_16')) ->> 'ya_programada', 'true', 'reanudar: idempotente');
SELECT t.throws(format($q$ SELECT public.api_suspender_sesion(%s, 'x') $q$, pg_temp.i('s3a_07')), 'P0001:ESTATUS_INVALIDO', 'suspender: sesion cerrada');
SELECT t.throws(format($q$ SELECT public.api_suspender_sesion(%s, 'x') $q$, pg_temp.i('s3a_14')), 'P0001:ESTATUS_INVALIDO', 'suspender: sesion abierta');
SELECT t.throws(format($q$ SELECT public.api_reanudar_sesion(%s) $q$, pg_temp.i('s3a_07')), 'P0001:ESTATUS_INVALIDO', 'reanudar: sesion cerrada');
SELECT t.throws(format($q$ SELECT public.api_suspender_sesion(%s, '   ') $q$, pg_temp.i('s3a_16')), 'P0001:VALIDACION', 'suspender: motivo vacio');
SELECT t.throws(format($q$ SELECT public.api_suspender_sesion(%s, NULL) $q$, pg_temp.i('s3a_16')), 'P0001:VALIDACION', 'suspender: motivo nulo');
SELECT t.throws(format($q$ SELECT public.api_suspender_sesion(%s, repeat('x', 201)) $q$, pg_temp.i('s3a_16')), 'P0001:VALIDACION', 'suspender: motivo de mas de 200');
SELECT t.throws($q$ SELECT public.api_suspender_sesion(999999, 'x') $q$, 'P0001:NO_ENCONTRADO', 'suspender: sesion inexistente');
SELECT t.as_user('docente2@susan.test');
SELECT t.throws(format($q$ SELECT public.api_suspender_sesion(%s, 'x') $q$, pg_temp.i('s3a_16')), 'P0001:NO_AUTORIZADO', 'suspender: docente ajeno');
SELECT t.throws(format($q$ SELECT public.api_reanudar_sesion(%s) $q$, pg_temp.i('s3a_16')), 'P0001:NO_AUTORIZADO', 'reanudar: docente ajeno');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws(format($q$ SELECT public.api_suspender_sesion(%s, 'x') $q$, pg_temp.i('s3a_16')), 'P0001:NO_AUTORIZADO', 'suspender: alumno');
SELECT t.as_user('tecnico@susan.test');
SELECT t.throws(format($q$ SELECT public.api_suspender_sesion(%s, 'x') $q$, pg_temp.i('s3a_16')), 'P0001:NO_AUTORIZADO', 'suspender: tecnico');
SELECT t.as_anon();
SELECT t.throws(format($q$ SELECT public.api_suspender_sesion(%s, 'x') $q$, pg_temp.i('s3a_16')), '42501', 'suspender: anon');
SELECT t.as_user('admin@susan.test');
SELECT t.eq(public.api_suspender_sesion(pg_temp.i('s3a_16'), 'Contingencia') ->> 'estatus', 'suspendida', 'suspender: administrador');
SELECT t.eq(public.api_reanudar_sesion(pg_temp.i('s3a_16')) ->> 'estatus', 'programada', 'reanudar: administrador');

SELECT t.as_postgres();
SELECT t.summary();
ROLLBACK;
