-- Sesiones (5/5): svc_alumnos_candidatos, svc_crear_captura, svc_registrar_detecciones (validaciones, limites
-- 9:59/10:00 y 0.849/0.850, registros manuales), privilegios y formato de COMMENT.
BEGIN;
SELECT t.begin('api_a_sesiones_05_svc');
SELECT t.cargar_fixtures();

CREATE TEMP TABLE ids AS
SELECT 's3a_14' AS k, t.id_sesion('3A', DATE '2026-09-14') AS v
UNION ALL SELECT 's3a_16', t.id_sesion('3A', DATE '2026-09-16')
UNION ALL SELECT 's5b_14', t.id_sesion('5B', DATE '2026-09-14')
UNION ALL SELECT 'A001', t.id_alumno('A001') UNION ALL SELECT 'A002', t.id_alumno('A002')
UNION ALL SELECT 'frente', t.id_camara('A-12', 'frente') UNION ALL SELECT 'fondo', t.id_camara('A-12', 'fondo')
UNION ALL SELECT 'b04', t.id_camara('B-04', 'frente');
GRANT SELECT ON ids TO PUBLIC;
CREATE FUNCTION pg_temp.i(p text) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT v FROM ids WHERE k = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.i(text) TO PUBLIC;
CREATE FUNCTION pg_temp.reg(p_alumno text) RETURNS text LANGUAGE sql STABLE AS
$$ SELECT estado || '/' || origen || '/' || conteo_detecciones || '/' || coalesce(to_char(hora_registro AT TIME ZONE 'America/Mexico_City', 'HH24:MI:SS'), '-')
     FROM public.asistencia WHERE id_sesion = pg_temp.i('s3a_16') AND id_alumno = pg_temp.i(p_alumno) $$;
GRANT EXECUTE ON FUNCTION pg_temp.reg(text) TO PUBLIC;
GRANT SELECT ON public.asistencia, public.deteccion, public.captura TO PUBLIC;

-- ===== Privilegios ============================================================================
SELECT t.as_user('docente1@susan.test');
SELECT t.throws(format('SELECT public.svc_alumnos_candidatos(%s)', pg_temp.i('s3a_14')), '42501', 'svc_alumnos_candidatos: docente sin EXECUTE');
SELECT t.throws(format($q$ SELECT public.svc_crear_captura(%s, %s, now(), 1) $q$, pg_temp.i('s3a_14'), pg_temp.i('frente')), '42501', 'svc_crear_captura: docente sin EXECUTE');
SELECT t.throws($q$ SELECT public.svc_registrar_detecciones(1, '[]'::jsonb) $q$, '42501', 'svc_registrar_detecciones: docente sin EXECUTE');
SELECT t.as_anon();
SELECT t.throws(format('SELECT public.svc_alumnos_candidatos(%s)', pg_temp.i('s3a_14')), '42501', 'svc_alumnos_candidatos: anon');
SELECT t.throws($q$ SELECT public.svc_registrar_detecciones(1, '[]'::jsonb) $q$, '42501', 'svc_registrar_detecciones: anon');

-- ===== svc_alumnos_candidatos ==================================================================
SELECT t.as_service();
SELECT t.eq(public.svc_alumnos_candidatos(pg_temp.i('s3a_14')) ->> 'index_version', 'v001', 'candidatos: version del indice en uso');
SELECT t.eq(public.svc_alumnos_candidatos(pg_temp.i('s3a_14')) -> 'faiss_ids', '[0]'::jsonb, 'candidatos 3A: solo A001 (A002 sin plantilla; A004 es de 5B)');
SELECT t.eq((public.svc_alumnos_candidatos(pg_temp.i('s3a_14')) #>> '{mapa,0,id_alumno}')::int, pg_temp.i('A001'), 'candidatos: mapa con id_alumno');
SELECT t.eq((public.svc_alumnos_candidatos(pg_temp.i('s3a_14')) #>> '{mapa,0,id_plantilla}')::int, t.id_plantilla('A001'), 'candidatos: mapa con id_plantilla');
SELECT t.eq(public.svc_alumnos_candidatos(pg_temp.i('s5b_14')) -> 'faiss_ids', '[1]'::jsonb, 'candidatos 5B: solo A004');
SELECT t.eq(jsonb_typeof(public.svc_alumnos_candidatos(pg_temp.i('s5b_14')) -> 'faiss_ids' -> 0), 'number', 'faiss_ids son NUMEROS JSON, no texto (el cliente del servicio exige enteros)');
SELECT t.throws($q$ SELECT public.svc_alumnos_candidatos(999999) $q$, 'P0001:NO_ENCONTRADO', 'candidatos: sesion inexistente');
SELECT t.as_postgres();
SELECT t.efecto($q$ UPDATE consentimiento SET estatus = 'revocado' WHERE id_consent = t.id_consent('A001'); SELECT t.as_service() $q$,
    $q$ SELECT public.svc_alumnos_candidatos(pg_temp.i('s3a_14')) -> 'faiss_ids' = '[]'::jsonb $q$, 'candidatos: consentimiento revocado excluye al alumno');
SELECT t.efecto($q$ UPDATE consentimiento SET vigencia_hasta = '2026-09-13' WHERE id_consent = t.id_consent('A001'); SELECT t.as_service() $q$,
    $q$ SELECT public.svc_alumnos_candidatos(pg_temp.i('s3a_14')) -> 'faiss_ids' = '[]'::jsonb $q$, 'candidatos: consentimiento vencido por fecha excluye al alumno');
SELECT t.efecto($q$ UPDATE inscripcion SET estatus = 'baja' WHERE id_alumno = t.id_alumno('A001'); SELECT t.as_service() $q$,
    $q$ SELECT public.svc_alumnos_candidatos(pg_temp.i('s3a_14')) -> 'faiss_ids' = '[]'::jsonb $q$, 'candidatos: inscripcion en baja excluye al alumno (RF-04)');
SELECT t.efecto($q$ UPDATE plantilla_facial SET activa = false WHERE id_alumno = t.id_alumno('A001'); SELECT t.as_service() $q$,
    $q$ SELECT public.svc_alumnos_candidatos(pg_temp.i('s3a_14')) -> 'faiss_ids' = '[]'::jsonb $q$, 'candidatos: plantilla archivada excluida');
SELECT t.efecto($q$ UPDATE plantilla_facial SET id_indice = t.id_indice('v002') WHERE id_alumno = t.id_alumno('A001'); SELECT t.as_service() $q$,
    $q$ SELECT public.svc_alumnos_candidatos(pg_temp.i('s3a_14')) -> 'faiss_ids' = '[]'::jsonb $q$, 'candidatos: solo plantillas del indice en uso');
SELECT t.efecto($q$ UPDATE indice_faiss SET en_uso = false; SELECT t.as_service() $q$,
    $q$ SELECT public.svc_alumnos_candidatos(pg_temp.i('s3a_14')) -> 'faiss_ids' = '[]'::jsonb
        AND public.svc_alumnos_candidatos(pg_temp.i('s3a_14')) -> 'index_version' = 'null'::jsonb $q$, 'candidatos: sin indice en uso -> faiss_ids vacio e index_version null');

-- ===== svc_crear_captura =========================================================================
SELECT t.as_postgres();
SELECT t.reloj('2026-09-14 07:25:00-06');
SELECT t.as_service();
SELECT t.ok(public.svc_crear_captura(pg_temp.i('s3a_14'), pg_temp.i('frente'), '2026-09-14 07:20:00-06', 2) > 0, 'captura: en el limite de la tolerancia (07:20:00) se acepta');
SELECT t.throws(format($q$ SELECT public.svc_crear_captura(%s, %s, '2026-09-14 07:20:01-06', 1) $q$, pg_temp.i('s3a_14'), pg_temp.i('frente')), 'P0001:FUERA_DE_VENTANA', 'captura: 07:20:01 fuera de la tolerancia');
SELECT t.eq(public.svc_crear_captura(pg_temp.i('s3a_14'), pg_temp.i('frente'), '2026-09-14 07:20:00-06', 9),
            public.svc_crear_captura(pg_temp.i('s3a_14'), pg_temp.i('frente'), '2026-09-14 07:20:00-06', 9), 'captura: idempotente por (camara, marca_tiempo)');
SELECT t.eq(t.n($$ SELECT 1 FROM captura WHERE id_camara = pg_temp.i('frente') AND marca_tiempo = '2026-09-14 07:20:00-06' $$), 1, 'captura: no se duplica la fila');
SELECT t.eq((SELECT rostros_detectados::int FROM captura WHERE id_camara = pg_temp.i('frente') AND marca_tiempo = '2026-09-14 07:20:00-06'), 2, 'captura: la repeticion conserva los rostros originales');
SELECT t.throws(format($q$ SELECT public.svc_crear_captura(%s, %s, '2026-09-14 07:10:00-06', 1) $q$, pg_temp.i('s3a_14'), pg_temp.i('b04')), 'P0001:CAMARA_FUERA_DE_AULA', 'captura: camara de otra aula (RN-06)');
SELECT t.throws(format($q$ SELECT public.svc_crear_captura(%s, 999999, '2026-09-14 07:10:00-06', 1) $q$, pg_temp.i('s3a_14')), 'P0001:CAMARA_NO_ENCONTRADA', 'captura: camara inexistente');
SELECT t.throws(format($q$ SELECT public.svc_crear_captura(999999, %s, '2026-09-14 07:10:00-06', 1) $q$, pg_temp.i('frente')), 'P0001:NO_ENCONTRADO', 'captura: sesion inexistente');
SELECT t.throws(format($q$ SELECT public.svc_crear_captura(%s, %s, '2026-09-16 07:01:00-06', 1) $q$, pg_temp.i('s3a_16'), pg_temp.i('frente')), 'P0001:SESION_NO_ABIERTA', 'captura: sesion programada');
SELECT t.throws(format($q$ SELECT public.svc_crear_captura(%s, %s, '2026-09-14 07:10:00-06', 1) $q$, pg_temp.i('s5b_14'), pg_temp.i('b04')), 'P0001:SESION_NO_AUTOMATICA', 'captura: sesion de pase manual');
SELECT t.throws(format($q$ SELECT public.svc_crear_captura(%s, %s, '2026-09-14 07:10:00-06', -1) $q$, pg_temp.i('s3a_14'), pg_temp.i('frente')), 'P0001:VALIDACION', 'captura: rostros negativos');
SELECT t.throws(format($q$ SELECT public.svc_crear_captura(%s, %s, NULL, 1) $q$, pg_temp.i('s3a_14'), pg_temp.i('frente')), 'P0001:VALIDACION', 'captura: sin marca de tiempo');
SELECT t.throws(format($q$ SELECT public.svc_crear_captura(%s, %s, '2026-09-14 07:40:00-06', 1) $q$, pg_temp.i('s3a_14'), pg_temp.i('frente')), 'P0001:MARCA_FUTURA', 'captura: marca en el futuro');
SELECT t.as_postgres();
UPDATE camara SET estatus = 'inactiva' WHERE id_camara = pg_temp.i('fondo');
SELECT t.as_service();
SELECT t.throws(format($q$ SELECT public.svc_crear_captura(%s, %s, '2026-09-14 07:10:00-06', 1) $q$, pg_temp.i('s3a_14'), pg_temp.i('fondo')), 'P0001:CAMARA_INACTIVA', 'captura: camara inactiva');
SELECT t.as_postgres();
UPDATE camara SET estatus = 'activa' WHERE id_camara = pg_temp.i('fondo');

-- ===== svc_registrar_detecciones: validaciones ===================================================
SELECT t.as_service();
CREATE TEMP TABLE caps (n int, id bigint);
GRANT ALL ON caps TO PUBLIC;
INSERT INTO caps VALUES (1, public.svc_crear_captura(pg_temp.i('s3a_14'), pg_temp.i('fondo'), '2026-09-14 07:11:00-06', 1));
SELECT t.throws(format($q$ SELECT public.svc_registrar_detecciones(%s, '{"a": 1}'::jsonb) $q$, (SELECT id FROM caps WHERE n = 1)), 'P0001:VALIDACION', 'detecciones: no es arreglo');
SELECT t.throws(format($q$ SELECT public.svc_registrar_detecciones(%s, NULL) $q$, (SELECT id FROM caps WHERE n = 1)), 'P0001:VALIDACION', 'detecciones: nulo');
SELECT t.throws(format($q$ SELECT public.svc_registrar_detecciones(%s, '[{"faiss_id": 0, "score": 1.5}]'::jsonb) $q$, (SELECT id FROM caps WHERE n = 1)), 'P0001:VALIDACION', 'detecciones: score > 1');
SELECT t.throws(format($q$ SELECT public.svc_registrar_detecciones(%s, '[{"faiss_id": 0}]'::jsonb) $q$, (SELECT id FROM caps WHERE n = 1)), 'P0001:VALIDACION', 'detecciones: candidato sin score');
SELECT t.throws(format($q$ SELECT public.svc_registrar_detecciones(%s, '[{"faiss_id": "x", "score": 0.9}]'::jsonb) $q$, (SELECT id FROM caps WHERE n = 1)), 'P0001:VALIDACION', 'detecciones: faiss_id no numerico');
SELECT t.throws(format($q$ SELECT public.svc_registrar_detecciones(%s, '[{"faiss_id": null}, {"faiss_id": null}]'::jsonb) $q$, (SELECT id FROM caps WHERE n = 1)), 'P0001:VALIDACION', 'detecciones: mas detecciones que rostros');
SELECT t.throws($q$ SELECT public.svc_registrar_detecciones(999999999, '[]'::jsonb) $q$, 'P0001:NO_ENCONTRADO', 'detecciones: captura inexistente');
SELECT t.eq(t.n($$ SELECT 1 FROM deteccion WHERE id_captura = (SELECT id FROM caps WHERE n = 1) $$), 0, 'detecciones: los rechazos no dejan filas');
-- Captura de una sesion manual (insertada directo): se rechaza
SELECT t.as_postgres();
INSERT INTO captura (id_camara, id_sesion, marca_tiempo, rostros_detectados) VALUES (pg_temp.i('b04'), pg_temp.i('s5b_14'), '2026-09-14 09:01:00-06', 1);
SELECT t.as_service();
SELECT t.throws($q$ SELECT public.svc_registrar_detecciones((SELECT id_captura FROM captura WHERE id_sesion = t.id_sesion('5B', DATE '2026-09-14')), '[]'::jsonb) $q$,
    'P0001:SESION_NO_AUTOMATICA', 'detecciones: sesion de pase manual');
-- Idempotencia y sin candidato
SELECT t.as_service();
SELECT t.eq(public.svc_registrar_detecciones((SELECT id FROM caps WHERE n = 1), '[{"faiss_id": 99, "score": 0.97}]'::jsonb) ->> 'no_atribuidas', '1', 'detecciones: faiss_id fuera del indice = sin candidato');
SELECT t.eq(t.n($$ SELECT 1 FROM deteccion WHERE id_captura = (SELECT id FROM caps WHERE n = 1) AND id_plantilla IS NULL AND score_similitud IS NULL AND NOT es_valida $$), 1, 'detecciones: sin candidato no guarda score');
SELECT t.eq(public.svc_registrar_detecciones((SELECT id FROM caps WHERE n = 1), '[{"faiss_id": 0, "score": 0.97}]'::jsonb) ->> 'ya_procesada', 'true', 'detecciones: reintento de captura procesada es idempotente');
SELECT t.eq(t.n($$ SELECT 1 FROM deteccion WHERE id_captura = (SELECT id FROM caps WHERE n = 1) $$), 1, 'detecciones: el reintento no duplica filas');
-- Sesion cerrada: ya no admite detecciones de una captura pendiente
INSERT INTO caps VALUES (2, public.svc_crear_captura(pg_temp.i('s3a_14'), pg_temp.i('frente'), '2026-09-14 07:12:00-06', 1));
SELECT t.as_postgres();
UPDATE sesion_clase SET estatus = 'cerrada' WHERE id_sesion = pg_temp.i('s3a_14');
SELECT t.as_service();
SELECT t.throws(format($q$ SELECT public.svc_registrar_detecciones(%s, '[]'::jsonb) $q$, (SELECT id FROM caps WHERE n = 2)), 'P0001:SESION_NO_ABIERTA', 'detecciones: sesion cerrada');
SELECT t.as_postgres();
UPDATE sesion_clase SET estatus = 'abierta' WHERE id_sesion = pg_temp.i('s3a_14');

-- ===== Limites 9:59 / 10:00 y 0.849 / 0.850 en una sesion limpia (3A, 16-sep) ===================
SELECT t.as_postgres();
SELECT t.reloj('2026-09-16 07:00:00-06');
SELECT t.as_user('docente1@susan.test');
SELECT t.lives(format('SELECT public.api_abrir_sesion(%s)', pg_temp.i('s3a_16')), 'limites: sesion abierta');
SELECT t.as_postgres();
INSERT INTO plantilla_facial (id_alumno, id_consent, id_indice, faiss_id, objeto_foto)
VALUES (pg_temp.i('A002'), t.id_consent('A002'), t.id_indice('v001'), 2, 'registro/fixture-a002.jpg');
SELECT t.reloj('2026-09-16 07:12:00-06');
SELECT t.as_service();
-- c1 07:09:59 -> primera lectura de A001 (A001 0.8494 no vale)
INSERT INTO caps VALUES (10, public.svc_crear_captura(pg_temp.i('s3a_16'), pg_temp.i('frente'), '2026-09-16 07:09:30-06', 1));
SELECT t.eq(public.svc_registrar_detecciones((SELECT id FROM caps WHERE n = 10), '[{"faiss_id": 0, "score": 0.8494}]'::jsonb) ->> 'validas', '0', 'limites: 0.8494 se redondea a 0.849 y no vale');
SELECT t.eq(t.n($$ SELECT 1 FROM asistencia WHERE id_sesion = pg_temp.i('s3a_16') $$), 0, 'limites: 0.849 no crea registro');
INSERT INTO caps VALUES (11, public.svc_crear_captura(pg_temp.i('s3a_16'), pg_temp.i('frente'), '2026-09-16 07:09:59-06', 1));
SELECT t.eq(public.svc_registrar_detecciones((SELECT id FROM caps WHERE n = 11), '[{"faiss_id": 0, "score": 0.8495}]'::jsonb) ->> 'validas', '1', 'limites: 0.8495 se redondea a 0.850 y vale');
INSERT INTO caps VALUES (12, public.svc_crear_captura(pg_temp.i('s3a_16'), pg_temp.i('frente'), '2026-09-16 07:10:00-06', 1));
SELECT t.eq(public.svc_registrar_detecciones((SELECT id FROM caps WHERE n = 12), '[{"faiss_id": 2, "score": 0.9}]'::jsonb) ->> 'validas', '1', 'limites: primera lectura de A002 a las 07:10:00');
INSERT INTO caps VALUES (13, public.svc_crear_captura(pg_temp.i('s3a_16'), pg_temp.i('frente'), '2026-09-16 07:10:15-06', 2));
SELECT t.eq(public.svc_registrar_detecciones((SELECT id FROM caps WHERE n = 13), '[{"faiss_id": 0, "score": 0.9}, {"faiss_id": 2, "score": 0.9}]'::jsonb) ->> 'validas', '2', 'limites: tercera captura');
SELECT t.eq(pg_temp.reg('A001'), 'pendiente/automatico/2/07:09:59', 'limites: A001 con 2 lecturas sigue pendiente');
INSERT INTO caps VALUES (14, public.svc_crear_captura(pg_temp.i('s3a_16'), pg_temp.i('frente'), '2026-09-16 07:10:30-06', 2));
SELECT t.eq(jsonb_array_length(public.svc_registrar_detecciones((SELECT id FROM caps WHERE n = 14), '[{"faiss_id": 0, "score": 0.9}, {"faiss_id": 2, "score": 0.9}]'::jsonb) -> 'cambios'), 2, 'limites: cuarta captura confirma a ambos');
SELECT t.eq(pg_temp.reg('A001'), 'presente/automatico/3/07:09:59', 'limites: 9:59 -> presente (el estado lo decide la PRIMERA lectura, no la tercera que cayo en retardo)');
SELECT t.eq(pg_temp.reg('A002'), 'retardo/automatico/3/07:10:00', 'limites: 10:00 -> retardo');

-- Un registro manual no se pisa con lecturas automaticas
SELECT t.as_postgres();
SELECT t.efecto($q$ DELETE FROM asistencia WHERE id_sesion = pg_temp.i('s3a_16') AND id_alumno = pg_temp.i('A002');
        DELETE FROM deteccion WHERE id_plantilla IN (SELECT id_plantilla FROM plantilla_facial WHERE id_alumno = pg_temp.i('A002'));
        SELECT t.as_user('docente1@susan.test'); SELECT public.api_registrar_manual(pg_temp.i('s3a_16'), pg_temp.i('A002'), 'ausente'); SELECT t.as_service();
        SELECT public.svc_registrar_detecciones(public.svc_crear_captura(pg_temp.i('s3a_16'), pg_temp.i('fondo'), '2026-09-16 07:11:00-06', 1), '[{"faiss_id": 2, "score": 0.95}]'::jsonb) $q$,
    $q$ SELECT pg_temp.reg('A002') = 'ausente/manual/0/-' $q$, 'manual: las lecturas automaticas posteriores no pisan un registro manual');

-- ===== Formato de COMMENT (lo parsea el generador de catalogo) ===================================
SELECT t.as_postgres();
SELECT t.eq(t.n($$ SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                    WHERE n.nspname = 'public' AND p.proname IN ('api_docente_panel','api_abrir_sesion','api_sesion_monitor','api_registrar_manual',
                        'api_pase_lista_manual','api_cerrar_sesion','api_suspender_sesion','api_reanudar_sesion',
                        'svc_alumnos_candidatos','svc_crear_captura','svc_registrar_detecciones')
                      AND obj_description(p.oid, 'pg_proc') ~ '\nARGS: .*\nRETURNS: .*\nERRORES: .*\nROLES: ' $$), 11, 'COMMENT: las 11 RPC publicas llevan ARGS/RETURNS/ERRORES/ROLES');

SELECT t.summary();
ROLLBACK;
