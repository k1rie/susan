-- api_c_12 · app.resolver_pendientes_vencidos (RF-11, BPMN-02; docs/api/revision.md 5.2 y 6.2) y privilegios de app.*
BEGIN;
SELECT t.begin('api_c_12_revision_job');
SELECT t.cargar_fixtures();
\ir api_c_escenario.inc

-- Pendientes vencibles: AS1 (3A, S1) y AS5 (5B, S3), ambas con vence_en = 2026-09-10 09:00-06. AS6 es de una sesion abierta.
SELECT t.as_service();
SELECT t.reloj('2026-09-10 08:59:00-06');
SELECT t.eq((app.resolver_pendientes_vencidos(app.id_cuenta_servicio()) ->> 'resueltos')::int, 0, 'JOB-03: a 47 h 59 min nada vence');
SELECT t.reloj('2026-09-10 09:00:00-06');
SELECT t.eq((app.resolver_pendientes_vencidos(app.id_cuenta_servicio()) ->> 'resueltos')::int, 0, 'JOB-02: a las 48 h exactas todavia se puede corregir');
SELECT t.reloj('2026-09-10 09:00:01-06');

SELECT t.efecto($q$ SELECT app.resolver_pendientes_vencidos(app.id_cuenta_servicio()) $q$,
    $q$ SELECT (SELECT estado::text || '/' || origen::text || '/' || (hora_registro IS NULL) FROM asistencia WHERE id_asistencia = t.c('AS1')) = 'ausente/correccion/true'
           AND (SELECT estado::text FROM asistencia WHERE id_asistencia = t.c('AS5')) = 'ausente'
           AND (t.c_bit('correccion', 'asistencia', t.c('AS1')) ->> 'id_usuario')::int = app.id_cuenta_servicio()
           AND (t.c_bit('correccion', 'asistencia', t.c('AS1')) -> 'valor_anterior' ->> 'estado') = 'pendiente'
           AND (t.c_bit('correccion', 'asistencia', t.c('AS1')) -> 'valor_nuevo' ->> 'comentario') LIKE 'Plazo de corrección vencido%' $q$,
    'JOB-01: AS1 y AS5 pasan a ausente con la cuenta de servicio y asiento de bitacora');
SELECT t.lives_rb($q$ DO $d$ DECLARE r jsonb; BEGIN
    r := app.resolver_pendientes_vencidos(app.id_cuenta_servicio());
    IF (r ->> 'resueltos')::int <> 2 OR jsonb_array_length(r -> 'ids') <> 2 OR jsonb_array_length(r -> 'fallidos') <> 0 THEN
        RAISE EXCEPTION 'resultado inesperado: %', r;
    END IF;
    r := app.resolver_pendientes_vencidos(app.id_cuenta_servicio());
    IF (r ->> 'resueltos')::int <> 0 THEN RAISE EXCEPTION 'JOB-04 no es idempotente: %', r; END IF;
END $d$ $q$, 'JOB-01/04: resuelve 2, la segunda ejecucion resuelve 0 (idempotente)');
SELECT t.efecto($q$ SELECT app.resolver_pendientes_vencidos(app.id_cuenta_servicio()) $q$,
    $q$ SELECT (SELECT estado::text FROM asistencia WHERE id_asistencia = t.c('AS6')) = 'pendiente'
           AND (SELECT estado::text || origen::text FROM asistencia WHERE id_asistencia = t.c('AS2')) = 'ausenteautomatico'
           AND (SELECT estado::text FROM asistencia WHERE id_asistencia = t.c('AS3')) = 'retardo'
           AND (SELECT estado::text FROM asistencia WHERE id_asistencia = t.c('AS4')) = 'presente' $q$,
    'JOB-05/06: sesion abierta y estados distintos de pendiente no se tocan');
SELECT t.efecto($q$ SELECT app.resolver_pendientes_vencidos(app.id_cuenta_servicio()) $q$,
    $q$ SELECT NOT t.c_derecho('3A', 'A001')
           AND t.c_nbit('notificacion', 'inscripcion',
                (SELECT id_inscripcion FROM inscripcion WHERE id_alumno = t.id_alumno('A001') AND id_grupo = t.id_grupo('3A'))) = 1 $q$,
    'JOB: resolver a ausente recalcula (A001: 10 faltas pierde el derecho y notifica)');
SELECT t.lives_rb($q$ DO $d$ DECLARE r jsonb; BEGIN
    r := app.resolver_pendientes_vencidos(app.id_cuenta_servicio(), 1);
    IF (r ->> 'resueltos')::int <> 1 THEN RAISE EXCEPTION 'JOB-08 primera: %', r; END IF;
    r := app.resolver_pendientes_vencidos(app.id_cuenta_servicio(), 1);
    IF (r ->> 'resueltos')::int <> 1 THEN RAISE EXCEPTION 'JOB-08 segunda: %', r; END IF;
    r := app.resolver_pendientes_vencidos(app.id_cuenta_servicio(), 1);
    IF (r ->> 'resueltos')::int <> 0 THEN RAISE EXCEPTION 'JOB-08 tercera: %', r; END IF;
END $d$ $q$, 'JOB-08: p_limite = 1 resuelve de uno en uno');
SELECT t.throws($q$ SELECT app.resolver_pendientes_vencidos(t.id_usuario('docente1@susan.test')) $q$, 'P0001:CUENTA_SERVICIO_INVALIDA', 'JOB-07: cuenta de docente');
SELECT t.throws($q$ SELECT app.resolver_pendientes_vencidos(999999) $q$, 'P0001:CUENTA_SERVICIO_INVALIDA', 'JOB-07: usuario inexistente');
SELECT t.throws($q$ SELECT app.resolver_pendientes_vencidos(NULL) $q$, 'P0001:CUENTA_SERVICIO_INVALIDA', 'JOB-07: usuario nulo');
SELECT t.throws($q$ UPDATE usuario SET activo = false WHERE correo = 'servicio@susan.local';
                    SELECT app.resolver_pendientes_vencidos((SELECT id_usuario FROM usuario WHERE correo = 'servicio@susan.local')) $q$, 'P0001:CUENTA_SERVICIO_INVALIDA', 'JOB-07: cuenta de servicio inactiva');

-- JOB-10: el pendiente resuelto por el job puede justificarse semanas despues (sin plazo para justificantes)
SELECT t.lives_rb($q$ DO $d$ BEGIN
    PERFORM app.resolver_pendientes_vencidos(app.id_cuenta_servicio());
    PERFORM t.reloj('2026-09-20 10:00:00-06');
    PERFORM t.as_user('alumno1@susan.test');
    PERFORM public.api_registrar_justificante(t.c('S1'), 'Hospitalizacion', t.c_doc('A001'));
    PERFORM t.reloj('2026-10-12 10:00:00-06');
    PERFORM t.as_user('docente1@susan.test');
    PERFORM public.api_resolver_justificante(t.c_jid('3A', '2026-09-08', 'A001'), true);
    IF (SELECT estado FROM asistencia WHERE id_asistencia = t.c('AS1')) <> 'justificado' THEN RAISE EXCEPTION 'debia quedar justificado'; END IF;
END $d$ $q$, 'JOB-10: un ausente resuelto por el job se justifica semanas despues');

-- Privilegios de las funciones internas
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT app.resolver_pendientes_vencidos(1) $q$, '42501', 'authenticated no ejecuta app.resolver_pendientes_vencidos');
SELECT t.throws($q$ SELECT app.aplicar_correccion(t.c('AS1'), 'presente') $q$, '42501', 'authenticated no ejecuta app.aplicar_correccion');
SELECT t.throws($q$ SELECT app.recalcular_inscripcion(1) $q$, '42501', 'authenticated no ejecuta app.recalcular_inscripcion');
SELECT t.throws($q$ SELECT app.validar_destino_justificante(1, 1) $q$, '42501', 'authenticated no ejecuta app.validar_destino_justificante');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT app.resolver_pendientes_vencidos(1) $q$, '42501', 'anon no ejecuta app.resolver_pendientes_vencidos');
SELECT t.throws($q$ SELECT public.svc_registrar_consulta_revision(1, 'asistencia', 1) $q$, '42501', 'anon no ejecuta svc_registrar_consulta_revision');

-- svc_registrar_consulta_revision (RF-19)
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT public.svc_registrar_consulta_revision(t.id_usuario('docente1@susan.test'), 'asistencia', 1) $q$, '42501', 'VIS-07: authenticated no ejecuta svc_registrar_consulta_revision');
SELECT t.as_service();
SELECT t.efecto($q$ SELECT public.svc_registrar_consulta_revision(t.id_usuario('docente1@susan.test'), 'asistencia', t.c('AS1'), '10.1.2.3',
                        jsonb_build_object('detecciones', 3)) $q$,
    $q$ SELECT (t.c_bit('consulta', 'asistencia', t.c('AS1')) ->> 'ip_origen') = '10.1.2.3'
           AND (t.c_bit('consulta', 'asistencia', t.c('AS1')) ->> 'id_usuario')::int = t.id_usuario('docente1@susan.test')
           AND (t.c_bit('consulta', 'asistencia', t.c('AS1')) -> 'valor_nuevo' ->> 'detecciones') = '3' $q$,
    'VIS-08: asiento de consulta con usuario, IP y detalle');
SELECT t.efecto($q$ SELECT public.svc_registrar_consulta_revision(t.id_usuario('docente1@susan.test'), 'justificante', 15, 'no-es-ip') $q$,
    $q$ SELECT (t.c_bit('consulta', 'justificante', 15) ->> 'ip_origen') IS NULL AND t.c_nbit('consulta', 'justificante', 15) = 1 $q$,
    'VIS-08: IP invalida se guarda NULL y la consulta se asienta igual');
SELECT t.throws($q$ SELECT public.svc_registrar_consulta_revision(t.id_usuario('docente1@susan.test'), 'alumno', 1) $q$, 'P0001:VALIDACION', 'VIS-08: entidad no valida');
SELECT t.throws($q$ SELECT public.svc_registrar_consulta_revision(t.id_usuario('alumno1@susan.test'), 'asistencia', 1) $q$, 'P0001:NO_AUTORIZADO', 'VIS-08: usuario que no es docente');
SELECT t.throws($q$ SELECT public.svc_registrar_consulta_revision(999999, 'asistencia', 1) $q$, 'P0001:NO_AUTORIZADO', 'VIS-08: usuario inexistente');
SELECT t.throws($q$ UPDATE usuario SET activo = false WHERE id_usuario = t.id_usuario('docente1@susan.test');
                    SELECT public.svc_registrar_consulta_revision(t.id_usuario('docente1@susan.test'), 'asistencia', 1) $q$, 'P0001:NO_AUTORIZADO', 'VIS-08: docente inactivo');

SELECT t.summary();
ROLLBACK;
