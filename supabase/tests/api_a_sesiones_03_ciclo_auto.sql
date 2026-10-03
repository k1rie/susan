-- Sesiones (3/5): ciclo completo de una sesion automatica (spec 2895-2906): 4 vueltas x 2 camaras, umbral,
-- lecturas en capturas distintas, pendientes, rostros no atribuidos y cierre (RN-02 a RN-07).
BEGIN;
SELECT t.begin('api_a_sesiones_03_ciclo_auto');
SELECT t.cargar_fixtures();

CREATE TEMP TABLE ids AS
SELECT 's' AS k, t.id_sesion('3A', DATE '2026-09-16') AS v
UNION ALL SELECT 'A001', t.id_alumno('A001') UNION ALL SELECT 'A002', t.id_alumno('A002')
UNION ALL SELECT 'A003', t.id_alumno('A003') UNION ALL SELECT 'A004', t.id_alumno('A004')
UNION ALL SELECT 'A005', t.id_alumno('A005') UNION ALL SELECT 'A006', t.id_alumno('A006')
UNION ALL SELECT 'frente', t.id_camara('A-12', 'frente') UNION ALL SELECT 'fondo', t.id_camara('A-12', 'fondo');
GRANT SELECT ON ids TO PUBLIC;
CREATE FUNCTION pg_temp.i(p text) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT v FROM ids WHERE k = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.i(text) TO PUBLIC;
CREATE FUNCTION pg_temp.reg(p_alumno text) RETURNS text LANGUAGE sql STABLE AS
$$ SELECT estado || '/' || origen || '/' || conteo_detecciones || '/' || coalesce(to_char(hora_registro AT TIME ZONE 'America/Mexico_City', 'HH24:MI:SS'), '-')
     FROM public.asistencia WHERE id_sesion = pg_temp.i('s') AND id_alumno = pg_temp.i(p_alumno) $$;
GRANT EXECUTE ON FUNCTION pg_temp.reg(text) TO PUBLIC;
GRANT SELECT ON public.asistencia, public.deteccion, public.captura, public.bitacora_auditoria, public.sesion_clase, public.inscripcion TO PUBLIC;

-- Plantilla de A002 en el indice en uso (faiss_id 2); A001 = 0, A004 (5B, no inscrito en 3A) = 1
INSERT INTO plantilla_facial (id_alumno, id_consent, id_indice, faiss_id, objeto_foto)
VALUES (pg_temp.i('A002'), t.id_consent('A002'), t.id_indice('v001'), 2, 'registro/fixture-a002.jpg');

-- Apertura a las 07:00
SELECT t.reloj('2026-09-16 07:00:00-06');
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(public.api_abrir_sesion(pg_temp.i('s')) ->> 'modo_registro', 'automatico', 'ciclo: sesion abierta en modo automatico');

-- Muestreo: 4 vueltas x 2 camaras (reloj del plantel 07:02)
SELECT t.as_postgres();
SELECT t.reloj('2026-09-16 07:02:00-06');
SELECT t.as_service();
SELECT t.eq((public.svc_alumnos_candidatos(pg_temp.i('s')) -> 'faiss_ids'), '[0, 2]'::jsonb, 'ciclo: candidatos = A001 (0) y A002 (2); A004 (5B) no es candidato de 3A');

-- Vuelta 1
CREATE TEMP TABLE caps (n int, id bigint);
GRANT ALL ON caps TO PUBLIC;
INSERT INTO caps VALUES (1, public.svc_crear_captura(pg_temp.i('s'), pg_temp.i('frente'), '2026-09-16 07:00:15-06', 3));
SELECT t.eq(public.svc_registrar_detecciones((SELECT id FROM caps WHERE n = 1), '[
    {"faiss_id": 0, "score": 0.912, "objeto_recorte": "recortes/1/1.jpg"},
    {"faiss_id": 2, "score": 0.887, "objeto_recorte": "recortes/1/2.jpg"},
    {"faiss_id": null, "score": null, "objeto_recorte": "recortes/1/3.jpg"}]'::jsonb) #>> '{validas}', '2', 'v1 frente: 2 validas');
SELECT t.eq(pg_temp.reg('A001'), 'pendiente/automatico/1/07:00:15', 'v1: A001 nace pendiente con hora de la captura y conteo 1');
SELECT t.eq(pg_temp.reg('A002'), 'pendiente/automatico/1/07:00:15', 'v1: A002 nace pendiente');
SELECT t.eq(t.n($$ SELECT 1 FROM deteccion WHERE id_captura = (SELECT id FROM caps WHERE n = 1) AND id_plantilla IS NULL AND score_similitud IS NULL AND NOT es_valida $$), 1, 'v1: rostro sin candidato = deteccion sin plantilla ni score, no valida');

INSERT INTO caps VALUES (2, public.svc_crear_captura(pg_temp.i('s'), pg_temp.i('fondo'), '2026-09-16 07:00:15-06', 1));
SELECT t.eq(public.svc_registrar_detecciones((SELECT id FROM caps WHERE n = 2), '[{"faiss_id": 0, "score": 0.870}]'::jsonb) #>> '{cambios,0,lecturas_validas}', '2', 'v1 fondo: A001 llega a 2 lecturas (capturas distintas, misma marca de tiempo)');
SELECT t.eq(pg_temp.reg('A001'), 'pendiente/automatico/2/07:00:15', 'v1 fondo: A001 sigue pendiente con 2 lecturas');

-- Vuelta 2: A001 llega a 3 -> presente; A002 con 0.801 no cuenta
INSERT INTO caps VALUES (3, public.svc_crear_captura(pg_temp.i('s'), pg_temp.i('frente'), '2026-09-16 07:00:30-06', 2));
SELECT t.eq(public.svc_registrar_detecciones((SELECT id FROM caps WHERE n = 3), '[
    {"faiss_id": 0, "score": 0.930}, {"faiss_id": 2, "score": 0.801}]'::jsonb) #>> '{no_atribuidas}', '1', 'v2 frente: 0.801 es no atribuida');
SELECT t.eq(pg_temp.reg('A001'), 'presente/automatico/3/07:00:15', 'v2: A001 confirmado presente con 3 lecturas');
SELECT t.eq(pg_temp.reg('A002'), 'pendiente/automatico/1/07:00:15', 'v2: A002 (1 valida + 0.801) sigue pendiente');
SELECT t.eq(t.n($$ SELECT 1 FROM deteccion d JOIN plantilla_facial p USING (id_plantilla) WHERE p.id_alumno = pg_temp.i('A002') AND d.score_similitud = 0.801 AND NOT d.es_valida $$), 1, 'v2: la lectura de 0.801 se guarda con candidato y score aunque no valga');

INSERT INTO caps VALUES (4, public.svc_crear_captura(pg_temp.i('s'), pg_temp.i('fondo'), '2026-09-16 07:00:30-06', 1));
SELECT t.eq(public.svc_registrar_detecciones((SELECT id FROM caps WHERE n = 4), '[{"faiss_id": 1, "score": 0.612}]'::jsonb) #>> '{validas}', '0', 'v2 fondo: candidato 0.612 no se atribuye');
SELECT t.eq(t.n($$ SELECT 1 FROM asistencia WHERE id_sesion = pg_temp.i('s') AND id_alumno = pg_temp.i('A004') $$), 0, 'v2 fondo: A004 no recibe asistencia');

-- Vuelta 3: dos rostros del mismo alumno en la misma captura cuentan una vez
INSERT INTO caps VALUES (5, public.svc_crear_captura(pg_temp.i('s'), pg_temp.i('frente'), '2026-09-16 07:00:45-06', 2));
SELECT t.eq(public.svc_registrar_detecciones((SELECT id FROM caps WHERE n = 5), '[
    {"faiss_id": 0, "score": 0.900}, {"faiss_id": 0, "score": 0.880}]'::jsonb) #>> '{validas}', '2', 'v3 frente: ambas detecciones son validas');
SELECT t.eq(pg_temp.reg('A001'), 'presente/automatico/4/07:00:15', 'v3: dos rostros en una captura suman UNA lectura (4)');
INSERT INTO caps VALUES (6, public.svc_crear_captura(pg_temp.i('s'), pg_temp.i('fondo'), '2026-09-16 07:00:45-06', 1));
SELECT t.eq(public.svc_registrar_detecciones((SELECT id FROM caps WHERE n = 6), '[{"faiss_id": 1, "score": 0.990}]'::jsonb) #>> '{validas}', '0', 'v3 fondo: alumno no inscrito en 3A nunca se atribuye, ni con 0.990');
SELECT t.eq(t.n($$ SELECT 1 FROM deteccion WHERE id_captura = (SELECT id FROM caps WHERE n = 6) AND id_plantilla = t.id_plantilla('A004') AND score_similitud = 0.990 AND NOT es_valida $$), 1, 'v3 fondo: queda como evidencia con candidato y score');

-- Vuelta 4: exactamente el umbral cuenta; 0.849 no
INSERT INTO caps VALUES (7, public.svc_crear_captura(pg_temp.i('s'), pg_temp.i('frente'), '2026-09-16 07:01:00-06', 1));
SELECT t.eq(public.svc_registrar_detecciones((SELECT id FROM caps WHERE n = 7), '[{"faiss_id": 0, "score": 0.850}]'::jsonb) #>> '{validas}', '1', 'v4 frente: 0.850 es valida (>= umbral)');
INSERT INTO caps VALUES (8, public.svc_crear_captura(pg_temp.i('s'), pg_temp.i('fondo'), '2026-09-16 07:01:00-06', 1));
SELECT t.eq(public.svc_registrar_detecciones((SELECT id FROM caps WHERE n = 8), '[{"faiss_id": 0, "score": 0.849}]'::jsonb) #>> '{validas}', '0', 'v4 fondo: 0.849 no es valida');
SELECT t.eq(pg_temp.reg('A001'), 'presente/automatico/5/07:00:15', 'ciclo: A001 con 5 lecturas validas en capturas distintas, un solo registro');
SELECT t.eq(t.n($$ SELECT 1 FROM captura WHERE id_sesion = pg_temp.i('s') $$), 8, 'ciclo: 8 capturas (4 vueltas x 2 camaras)');
SELECT t.eq(t.n($$ SELECT 1 FROM deteccion d JOIN captura c USING (id_captura) WHERE c.id_sesion = pg_temp.i('s') $$), 12, 'ciclo: 12 detecciones guardadas (todas, valgan o no)');
SELECT t.eq(t.n($$ SELECT 1 FROM deteccion d JOIN captura c USING (id_captura) WHERE c.id_sesion = pg_temp.i('s') AND d.es_valida $$), 7, 'ciclo: 7 validas');

-- Monitor en vivo
SELECT t.as_user('docente1@susan.test');
SELECT t.eq((jsonb_path_query_first(public.api_sesion_monitor(pg_temp.i('s')), '$.alumnos[*] ? (@.matricula == "A001")') ->> 'lecturas_validas')::int, 5, 'monitor: A001 5 lecturas (capturas distintas)');
SELECT t.eq((jsonb_path_query_first(public.api_sesion_monitor(pg_temp.i('s')), '$.alumnos[*] ? (@.matricula == "A001")') ->> 'mejor_score')::numeric, 0.930, 'monitor: mejor score de A001');
SELECT t.eq((jsonb_path_query_first(public.api_sesion_monitor(pg_temp.i('s')), '$.alumnos[*] ? (@.matricula == "A002")') ->> 'lecturas_validas')::int, 1, 'monitor: A002 1 lectura valida');
SELECT t.eq((public.api_sesion_monitor(pg_temp.i('s')) #>> '{camaras,0,capturas}')::int, 4, 'monitor: 4 capturas de la camara frente');
SELECT t.eq((public.api_sesion_monitor(pg_temp.i('s')) #>> '{totales,presentes}')::int, 1, 'monitor: totales presentes');

-- ===== Cierre (RN-07, RF-10) ==================================================================
-- Antes de terminar la ventana de tolerancia (07:20:00) el docente no puede adelantar el cierre
SELECT t.as_postgres();
SELECT t.reloj('2026-09-16 07:19:59-06');
SELECT t.as_user('docente1@susan.test');
SELECT t.throws(format('SELECT public.api_cerrar_sesion(%s)', pg_temp.i('s')), 'P0001:VENTANA_TOLERANCIA_ABIERTA', 'cierre: adelantado antes de la ventana (07:19:59) se rechaza');
SELECT t.as_user('docente2@susan.test');
SELECT t.throws(format('SELECT public.api_cerrar_sesion(%s)', pg_temp.i('s')), 'P0001:NO_AUTORIZADO', 'cierre: docente ajeno');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws(format('SELECT public.api_cerrar_sesion(%s)', pg_temp.i('s')), 'P0001:NO_AUTORIZADO', 'cierre: alumno');
SELECT t.as_anon();
SELECT t.throws(format('SELECT public.api_cerrar_sesion(%s)', pg_temp.i('s')), '42501', 'cierre: anon');
SELECT t.as_postgres();
SELECT t.reloj('2026-09-16 07:20:00-06');
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT public.api_cerrar_sesion(999999) $q$, 'P0001:NO_ENCONTRADO', 'cierre: sesion inexistente');
SELECT t.eq(public.api_cerrar_sesion(pg_temp.i('s')) ->> 'ausentes_creados', '2', 'cierre: ausente para A005 y A006 (sin lecturas)');
SELECT t.as_postgres();
SELECT t.eq((SELECT estatus::text FROM sesion_clase WHERE id_sesion = pg_temp.i('s')), 'cerrada', 'cierre: estatus cerrada');
SELECT t.eq(pg_temp.reg('A001'), 'presente/automatico/5/07:00:15', 'cierre: A001 presente intacta');
SELECT t.eq(pg_temp.reg('A002'), 'pendiente/automatico/1/07:00:15', 'cierre: A002 (1 lectura) sigue pendiente para la cola de revision');
SELECT t.eq(pg_temp.reg('A005'), 'ausente/automatico/0/-', 'cierre: A005 ausente, sin hora, origen del modo de la sesion (automatico)');
SELECT t.eq(pg_temp.reg('A006'), 'ausente/automatico/0/-', 'cierre: A006 ausente');
SELECT t.eq(t.n($$ SELECT 1 FROM asistencia WHERE id_sesion = pg_temp.i('s') AND id_alumno = pg_temp.i('A003') $$), 0, 'cierre: la inscripcion en baja no genera registro (RN-01)');
SELECT t.eq(t.n($$ SELECT 1 FROM asistencia WHERE id_sesion = pg_temp.i('s') $$), 4, 'cierre: cada inscrito activo tiene exactamente un registro');
SELECT t.eq(t.n($$ SELECT 1 FROM bitacora_auditoria WHERE accion = 'cierre_sesion' AND entidad = 'sesion_clase' AND id_registro = pg_temp.i('s')
                    AND id_usuario = t.id_usuario('docente1@susan.test') AND (valor_nuevo ->> 'por_docente')::boolean $$), 1, 'cierre: bitacora cierre_sesion a nombre del docente');
-- Idempotencia
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(public.api_cerrar_sesion(pg_temp.i('s')) ->> 'ya_cerrada', 'true', 'cierre: idempotente');
SELECT t.as_postgres();
SELECT t.eq(t.n($$ SELECT 1 FROM bitacora_auditoria WHERE accion = 'cierre_sesion' AND id_registro = pg_temp.i('s') $$), 1, 'cierre: el segundo cierre no duplica la bitacora');
SELECT t.eq(t.n($$ SELECT 1 FROM asistencia WHERE id_sesion = pg_temp.i('s') $$), 4, 'cierre: el segundo cierre no crea registros');
-- Tras el cierre ya no hay capturas ni detecciones
SELECT t.as_service();
SELECT t.throws(format($q$ SELECT public.svc_crear_captura(%s, %s, '2026-09-16 07:10:00-06', 1) $q$, pg_temp.i('s'), pg_temp.i('frente')), 'P0001:SESION_NO_ABIERTA', 'cierre: sesion cerrada no admite capturas');
SELECT t.as_postgres();
SELECT t.summary();
ROLLBACK;
