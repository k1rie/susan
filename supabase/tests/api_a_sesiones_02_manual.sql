-- Sesiones (2/5): registro manual (P-03 «Registrar manualmente») y pase de lista manual (P-04), RF-09.
BEGIN;
SELECT t.begin('api_a_sesiones_02_manual');
SELECT t.cargar_fixtures();

CREATE TEMP TABLE ids AS
SELECT 's3a_14' AS k, t.id_sesion('3A', DATE '2026-09-14') AS v
UNION ALL SELECT 's3a_16', t.id_sesion('3A', DATE '2026-09-16')
UNION ALL SELECT 's3a_07', t.id_sesion('3A', DATE '2026-09-07')
UNION ALL SELECT 's5b_14', t.id_sesion('5B', DATE '2026-09-14')
UNION ALL SELECT 'A001', t.id_alumno('A001') UNION ALL SELECT 'A002', t.id_alumno('A002')
UNION ALL SELECT 'A003', t.id_alumno('A003') UNION ALL SELECT 'A004', t.id_alumno('A004')
UNION ALL SELECT 'A005', t.id_alumno('A005') UNION ALL SELECT 'A006', t.id_alumno('A006');
GRANT SELECT ON ids TO PUBLIC;
CREATE FUNCTION pg_temp.i(p text) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT v FROM ids WHERE k = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.i(text) TO PUBLIC;
-- Estado/origen/hora del registro (como postgres, sin RLS)
CREATE FUNCTION pg_temp.reg(p_sesion text, p_alumno text) RETURNS text LANGUAGE sql STABLE AS
$$ SELECT estado || '/' || origen || '/' || coalesce(to_char(hora_registro AT TIME ZONE 'America/Mexico_City', 'HH24:MI:SS'), '-')
     FROM public.asistencia WHERE id_sesion = pg_temp.i(p_sesion) AND id_alumno = pg_temp.i(p_alumno) $$;
GRANT EXECUTE ON FUNCTION pg_temp.reg(text, text) TO PUBLIC;
GRANT SELECT ON public.asistencia TO PUBLIC;  -- solo dentro de la transaccion de prueba (ROLLBACK)

-- ===== api_registrar_manual en sesion AUTOMATICA (3A, 14-sep, reloj 07:12) ======================
SELECT t.as_user('docente1@susan.test');
-- A002: consentimiento vigente pero sin lecturas validas -> permitido; sin estado = sugerido por la hora (minuto 12 -> retardo)
SELECT t.eq(public.api_registrar_manual(pg_temp.i('s3a_14'), pg_temp.i('A002'), NULL) ->> 'estado', 'retardo', 'manual: sin estado usa el sugerido (minuto 12 = retardo)');
SELECT t.as_postgres();
SELECT t.eq(pg_temp.reg('s3a_14', 'A002'), 'retardo/manual/07:12:00', 'manual: origen manual y hora = ahora');
SELECT t.eq((SELECT modo_registro::text FROM sesion_clase WHERE id_sesion = pg_temp.i('s3a_14')), 'automatico', 'manual: NO cambia el modo de la sesion automatica (RF-09)');
-- Doble registro (RN-02): el segundo actualiza, no duplica
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(public.api_registrar_manual(pg_temp.i('s3a_14'), pg_temp.i('A002'), 'presente', '2026-09-14 07:08:00-06') ->> 'creado', 'false', 'manual: segundo registro del mismo alumno actualiza (creado=false)');
SELECT t.as_postgres();
SELECT t.eq(pg_temp.reg('s3a_14', 'A002'), 'presente/manual/07:08:00', 'manual: el registro se actualizo');
SELECT t.eq(t.n($$ SELECT 1 FROM asistencia WHERE id_sesion = pg_temp.i('s3a_14') AND id_alumno = pg_temp.i('A002') $$), 1, 'manual: un solo registro por alumno y sesion (RN-02)');
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(public.api_registrar_manual(pg_temp.i('s3a_14'), pg_temp.i('A002'), 'ausente', '2026-09-14 07:08:00-06') ->> 'hora_registro', NULL, 'manual: ausente no lleva hora');
SELECT t.as_postgres();
SELECT t.eq(pg_temp.reg('s3a_14', 'A002'), 'ausente/manual/-', 'manual: ausente manual sin hora_registro');

-- A005 (consentimiento revocado) y A006 (vencido): permitido, aunque nunca tuvieron lecturas
SELECT t.as_user('docente1@susan.test');
SELECT t.lives(format($q$ SELECT public.api_registrar_manual(%s, %s, 'presente', '2026-09-14 07:05:00-06') $q$, pg_temp.i('s3a_14'), pg_temp.i('A005')), 'manual: alumno con consentimiento revocado');
SELECT t.lives(format($q$ SELECT public.api_registrar_manual(%s, %s, 'retardo') $q$, pg_temp.i('s3a_14'), pg_temp.i('A006')), 'manual: alumno con consentimiento vencido');
-- A001: consentimiento vigente y 1 lectura valida -> su registro es automatico
SELECT t.throws(format($q$ SELECT public.api_registrar_manual(%s, %s, 'presente') $q$, pg_temp.i('s3a_14'), pg_temp.i('A001')),
    'P0001:ALUMNO_CON_LECTURAS', 'manual: en sesion automatica no se pisa a quien tiene lecturas validas y consentimiento');
SELECT t.throws(format($q$ SELECT public.api_registrar_manual(%s, %s, 'presente') $q$, pg_temp.i('s3a_14'), pg_temp.i('A003')),
    'P0001:ALUMNO_NO_INSCRITO', 'manual: inscripcion en baja');
SELECT t.throws(format($q$ SELECT public.api_registrar_manual(%s, %s, 'presente') $q$, pg_temp.i('s3a_14'), pg_temp.i('A004')),
    'P0001:ALUMNO_NO_INSCRITO', 'manual: alumno de otro grupo (RN-01)');
SELECT t.throws(format($q$ SELECT public.api_registrar_manual(%s, 999999, 'presente') $q$, pg_temp.i('s3a_14')),
    'P0001:ALUMNO_NO_INSCRITO', 'manual: alumno inexistente');
SELECT t.throws(format($q$ SELECT public.api_registrar_manual(%s, NULL, 'presente') $q$, pg_temp.i('s3a_14')),
    'P0001:VALIDACION', 'manual: alumno nulo');
SELECT t.throws(format($q$ SELECT public.api_registrar_manual(%s, %s, 'pendiente') $q$, pg_temp.i('s3a_14'), pg_temp.i('A006')),
    'P0001:ESTADO_INVALIDO', 'manual: pendiente no es decision humana');
SELECT t.throws(format($q$ SELECT public.api_registrar_manual(%s, %s, 'justificado') $q$, pg_temp.i('s3a_14'), pg_temp.i('A006')),
    'P0001:ESTADO_INVALIDO', 'manual: justificado solo por justificante aprobado');
SELECT t.throws(format($q$ SELECT public.api_registrar_manual(%s, %s, 'volando') $q$, pg_temp.i('s3a_14'), pg_temp.i('A006')),
    'P0001:ESTADO_INVALIDO', 'manual: estado desconocido');
SELECT t.throws(format($q$ SELECT public.api_registrar_manual(%s, %s, 'presente', '2026-09-14 07:30:00-06') $q$, pg_temp.i('s3a_14'), pg_temp.i('A006')),
    'P0001:HORA_INVALIDA', 'manual: hora futura');
SELECT t.throws(format($q$ SELECT public.api_registrar_manual(%s, %s, 'presente', '2026-09-14 05:00:00-06') $q$, pg_temp.i('s3a_14'), pg_temp.i('A006')),
    'P0001:HORA_INVALIDA', 'manual: hora muy anterior a la clase');

-- Limites de la sugerencia: 9:59 presente, 10:00 retardo
SELECT t.as_postgres();
SELECT t.efecto($q$ SELECT t.as_user('docente1@susan.test'); SELECT public.api_registrar_manual(pg_temp.i('s3a_14'), pg_temp.i('A006'), NULL, '2026-09-14 07:09:59-06') $q$,
    $q$ SELECT pg_temp.reg('s3a_14', 'A006') = 'presente/manual/07:09:59' $q$, 'manual: 9:59 sugiere presente');
SELECT t.efecto($q$ SELECT t.as_user('docente1@susan.test'); SELECT public.api_registrar_manual(pg_temp.i('s3a_14'), pg_temp.i('A006'), NULL, '2026-09-14 07:10:00-06') $q$,
    $q$ SELECT pg_temp.reg('s3a_14', 'A006') = 'retardo/manual/07:10:00' $q$, 'manual: 10:00 sugiere retardo');
SELECT t.efecto($q$ SELECT t.reloj('2026-09-14 07:25:00-06'); SELECT t.as_user('docente1@susan.test'); SELECT public.api_registrar_manual(pg_temp.i('s3a_14'), pg_temp.i('A006'), NULL) $q$,
    $q$ SELECT pg_temp.reg('s3a_14', 'A006') = 'ausente/manual/-' $q$, 'manual: pasada la tolerancia la sugerencia es ausente');
SELECT t.efecto($q$ SELECT t.reloj('2026-09-14 07:25:00-06'); SELECT t.as_user('docente1@susan.test'); SELECT public.api_registrar_manual(pg_temp.i('s3a_14'), pg_temp.i('A006'), 'presente') $q$,
    $q$ SELECT pg_temp.reg('s3a_14', 'A006') = 'presente/manual/07:25:00' $q$, 'manual: el docente puede fijar presente aun pasada la tolerancia');

-- Autorizacion
SELECT t.as_user('docente2@susan.test');
SELECT t.throws(format($q$ SELECT public.api_registrar_manual(%s, %s, 'presente') $q$, pg_temp.i('s3a_14'), pg_temp.i('A006')), 'P0001:NO_AUTORIZADO', 'manual: docente ajeno (IDOR)');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws(format($q$ SELECT public.api_registrar_manual(%s, %s, 'presente') $q$, pg_temp.i('s3a_14'), pg_temp.i('A001')), 'P0001:NO_AUTORIZADO', 'manual: el alumno no se registra a si mismo');
SELECT t.as_user('admin@susan.test');
SELECT t.throws(format($q$ SELECT public.api_registrar_manual(%s, %s, 'presente') $q$, pg_temp.i('s3a_14'), pg_temp.i('A006')), 'P0001:NO_AUTORIZADO', 'manual: administrador');
SELECT t.as_anon();
SELECT t.throws(format($q$ SELECT public.api_registrar_manual(%s, %s, 'presente') $q$, pg_temp.i('s3a_14'), pg_temp.i('A006')), '42501', 'manual: anon');
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT public.api_registrar_manual(999999, 1, 'presente') $q$, 'P0001:NO_ENCONTRADO', 'manual: sesion inexistente');
SELECT t.throws(format($q$ SELECT public.api_registrar_manual(%s, %s, 'presente') $q$, pg_temp.i('s3a_16'), pg_temp.i('A006')), 'P0001:SESION_NO_ABIERTA', 'manual: sesion programada');
SELECT t.throws(format($q$ SELECT public.api_registrar_manual(%s, %s, 'presente') $q$, pg_temp.i('s3a_07'), pg_temp.i('A006')), 'P0001:SESION_NO_ABIERTA', 'manual: sesion cerrada');

-- ===== Sesion MANUAL (5B, 14-sep, reloj 09:14) ================================================
SELECT t.as_postgres();
SELECT t.reloj('2026-09-14 09:14:00-06');
INSERT INTO inscripcion (id_alumno, id_grupo, estatus, fecha_alta) VALUES
    (pg_temp.i('A001'), t.id_grupo('5B'), 'activa', '2026-08-03'), (pg_temp.i('A002'), t.id_grupo('5B'), 'activa', '2026-08-03'),
    (pg_temp.i('A005'), t.id_grupo('5B'), 'activa', '2026-08-03');
SELECT t.as_user('docente2@susan.test');
-- En sesion manual cualquier inscrito, aun con consentimiento vigente
SELECT t.eq(public.api_registrar_manual(pg_temp.i('s5b_14'), pg_temp.i('A004'), NULL) ->> 'estado', 'retardo', 'manual (sesion manual): a las 09:14 se sugiere retardo');
SELECT t.eq(public.api_registrar_manual(pg_temp.i('s5b_14'), pg_temp.i('A004'), NULL, '2026-09-14 09:09:59-06') ->> 'estado', 'presente', 'manual (sesion manual): 9:59 presente (actualiza)');
SELECT t.throws(format($q$ SELECT public.api_registrar_manual(%s, %s, 'presente') $q$, pg_temp.i('s5b_14'), pg_temp.i('A006')), 'P0001:ALUMNO_NO_INSCRITO', 'manual (sesion manual): A006 no esta en 5B');

-- Pase de lista por lote: registros explicitos + «marcar restantes segun la hora»
SELECT t.eq(public.api_pase_lista_manual(pg_temp.i('s5b_14'),
        jsonb_build_array(jsonb_build_object('id_alumno', pg_temp.i('A001'), 'estado', 'presente', 'hora', '2026-09-14T09:05:00-06:00'),
                          jsonb_build_object('id_alumno', pg_temp.i('A004'), 'estado', 'ausente')), true) ->> 'procesados', '4', 'pase: 2 explicitos + 2 restantes');
SELECT t.as_postgres();
SELECT t.eq(pg_temp.reg('s5b_14', 'A001'), 'presente/manual/09:05:00', 'pase: A001 presente con su hora');
SELECT t.eq(pg_temp.reg('s5b_14', 'A004'), 'ausente/manual/-', 'pase: A004 se actualizo a ausente');
SELECT t.eq(pg_temp.reg('s5b_14', 'A002'), 'retardo/manual/09:14:00', 'pase: restante marcado segun la hora (09:14 = retardo)');
SELECT t.eq(pg_temp.reg('s5b_14', 'A005'), 'retardo/manual/09:14:00', 'pase: otro restante');
SELECT t.eq(t.n($$ SELECT 1 FROM asistencia WHERE id_sesion = pg_temp.i('s5b_14') $$), 4, 'pase: 4 inscritos, 4 registros (uno por alumno)');
SELECT t.as_user('docente2@susan.test');
SELECT t.eq(public.api_pase_lista_manual(pg_temp.i('s5b_14'), '[]'::jsonb, true) ->> 'restantes_marcados', '0', 'pase: sin restantes no hace nada (idempotente)');

-- Atomicidad y validaciones del lote (SESION MANUAL 5B: se prueba con alumnos nuevos en un grupo limpio)
SELECT t.as_postgres();
DELETE FROM asistencia WHERE id_sesion = pg_temp.i('s5b_14');
SELECT t.as_user('docente2@susan.test');
SELECT t.throws(format($q$ SELECT public.api_pase_lista_manual(%s, '[{"id_alumno": %s, "estado": "presente"}, {"id_alumno": %s, "estado": "ausente"}]'::jsonb) $q$,
        pg_temp.i('s5b_14'), pg_temp.i('A001'), pg_temp.i('A001')), 'P0001:REGISTRO_DUPLICADO', 'pase: alumno repetido en el lote');
SELECT t.throws(format($q$ SELECT public.api_pase_lista_manual(%s, '[{"id_alumno": %s, "estado": "presente"}, {"id_alumno": %s, "estado": "presente"}]'::jsonb) $q$,
        pg_temp.i('s5b_14'), pg_temp.i('A001'), pg_temp.i('A006')), 'P0001:ALUMNO_NO_INSCRITO', 'pase: un registro invalido rechaza el lote');
SELECT t.as_postgres();
SELECT t.eq(t.n($$ SELECT 1 FROM asistencia WHERE id_sesion = pg_temp.i('s5b_14') $$), 0, 'pase: el lote es atomico (nada se guardo)');
SELECT t.as_user('docente2@susan.test');
SELECT t.throws(format($q$ SELECT public.api_pase_lista_manual(%s, '{"id_alumno": 1}'::jsonb) $q$, pg_temp.i('s5b_14')), 'P0001:VALIDACION', 'pase: p_registros debe ser arreglo');
SELECT t.throws(format($q$ SELECT public.api_pase_lista_manual(%s, '[{"estado": "presente"}]'::jsonb) $q$, pg_temp.i('s5b_14')), 'P0001:VALIDACION', 'pase: registro sin id_alumno');
SELECT t.throws(format($q$ SELECT public.api_pase_lista_manual(%s, '[{"id_alumno": "x"}]'::jsonb) $q$, pg_temp.i('s5b_14')), 'P0001:VALIDACION', 'pase: id_alumno no numerico');
SELECT t.throws(format($q$ SELECT public.api_pase_lista_manual(%s, '[{"id_alumno": %s, "estado": "xx"}]'::jsonb) $q$, pg_temp.i('s5b_14'), pg_temp.i('A001')), 'P0001:ESTADO_INVALIDO', 'pase: estado invalido');
SELECT t.as_user('docente1@susan.test');
SELECT t.throws(format($q$ SELECT public.api_pase_lista_manual(%s, '[]'::jsonb, true) $q$, pg_temp.i('s5b_14')), 'P0001:NO_AUTORIZADO', 'pase: docente ajeno');
SELECT t.as_user('alumno4@susan.test');
SELECT t.throws(format($q$ SELECT public.api_pase_lista_manual(%s, '[]'::jsonb, true) $q$, pg_temp.i('s5b_14')), 'P0001:NO_AUTORIZADO', 'pase: alumno');
SELECT t.as_anon();
SELECT t.throws(format($q$ SELECT public.api_pase_lista_manual(%s, '[]'::jsonb, true) $q$, pg_temp.i('s5b_14')), '42501', 'pase: anon');

-- Pase con restantes en sesion AUTOMATICA (3A): omite a quien ya tiene lecturas validas (A001) y marca al resto
SELECT t.as_postgres();
SELECT t.reloj('2026-09-14 07:12:00-06');
DELETE FROM asistencia WHERE id_sesion = pg_temp.i('s3a_14') AND id_alumno <> pg_temp.i('A001');
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(public.api_pase_lista_manual(pg_temp.i('s3a_14'), '[]'::jsonb, true) ->> 'restantes_marcados', '3', 'pase automatica: marca a A002, A005 y A006');
SELECT t.as_postgres();
SELECT t.eq(pg_temp.reg('s3a_14', 'A001'), 'pendiente/automatico/07:05:00', 'pase automatica: A001 (con lecturas) intacto');
SELECT t.eq(pg_temp.reg('s3a_14', 'A002'), 'retardo/manual/07:12:00', 'pase automatica: A002 retardo manual');

SELECT t.summary();
ROLLBACK;
