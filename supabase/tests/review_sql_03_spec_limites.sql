-- review_sql_03 · casos limite de la spec reproducidos de extremo a extremo (reconocimiento, derecho a examen, zona horaria)
BEGIN;
SELECT t.begin('review_sql_03_spec_limites');
SELECT t.cargar_fixtures();
\ir api_c_escenario.inc

-- Sesion nueva abierta lun 21-sep-2026 07:00-08:00 (automatica) y ayudante de lecturas.
INSERT INTO public.sesion_clase (id_grupo, fecha, hora_inicio, hora_fin, modo_registro, estatus)
VALUES (t.id_grupo('3A'), '2026-09-21', '07:00', '08:00', 'automatico', 'abierta');
INSERT INTO t.c_id VALUES ('SN', t.id_sesion('3A', DATE '2026-09-21')), ('CAMF', t.id_camara('A-12', 'frente')), ('CAMB', t.id_camara('A-12', 'fondo'));
-- Lectura: captura + deteccion (como service_role). Devuelve el resumen de svc_registrar_detecciones.
CREATE FUNCTION t.lec(p_ts text, p_cam text, p_score numeric, p_rostros int DEFAULT 1, p_n int DEFAULT 1) RETURNS jsonb
    LANGUAGE plpgsql AS $$
DECLARE v_cap bigint; v_det jsonb;
BEGIN
    v_cap := public.svc_crear_captura(t.c('SN'), t.c(p_cam), p_ts::timestamptz, p_rostros);
    SELECT jsonb_agg(jsonb_build_object('faiss_id', 0, 'score', p_score)) INTO v_det FROM generate_series(1, p_n);
    RETURN public.svc_registrar_detecciones(v_cap, v_det);
END $$;
GRANT EXECUTE ON FUNCTION t.lec(text, text, numeric, int, int) TO PUBLIC;
CREATE FUNCTION t.est(p_mat text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT estado::text || '/' || conteo_detecciones FROM asistencia WHERE id_sesion = t.c('SN') AND id_alumno = t.id_alumno(p_mat) $$;
GRANT EXECUTE ON FUNCTION t.est(text) TO PUBLIC;
SELECT t.reloj('2026-09-21 07:12:00-06');
SELECT t.as_service();

-- Umbral 0.849 / 0.850
SELECT t.efecto($q$ SELECT t.lec('2026-09-21 07:01:00-06', 'CAMF', 0.849) $q$,
    $q$ SELECT NOT EXISTS (SELECT 1 FROM asistencia WHERE id_sesion = t.c('SN')) $q$, 'U1: 0.849 no es valida: no crea asistencia');
SELECT t.efecto($q$ SELECT t.lec('2026-09-21 07:01:00-06', 'CAMF', 0.850) $q$,
    $q$ SELECT t.est('A001') = 'pendiente/1' $q$, 'U2: 0.850 es valida (pendiente, 1 lectura)');
-- Tres lecturas en capturas DISTINTAS
SELECT t.efecto($q$ SELECT t.lec('2026-09-21 07:01:00-06', 'CAMF', 0.95, 3, 3) $q$,
    $q$ SELECT t.est('A001') = 'pendiente/1' $q$, 'L1: tres detecciones del mismo alumno en UNA captura cuentan una lectura');
SELECT t.efecto($q$ SELECT t.lec('2026-09-21 07:01:00-06', 'CAMF', 0.95); SELECT t.lec('2026-09-21 07:01:00-06', 'CAMB', 0.95) $q$,
    $q$ SELECT t.est('A001') = 'pendiente/2' $q$, 'L2: dos camaras en el mismo instante son dos capturas distintas');
SELECT t.efecto($q$ SELECT t.lec('2026-09-21 07:01:00-06', 'CAMF', 0.95); SELECT t.lec('2026-09-21 07:01:15-06', 'CAMF', 0.95); SELECT t.lec('2026-09-21 07:01:30-06', 'CAMF', 0.95) $q$,
    $q$ SELECT t.est('A001') = 'presente/3' $q$, 'L3: tres capturas distintas confirman presente (primera lectura minuto 1)');
-- Re-enviar la misma captura es idempotente
SELECT t.efecto($q$ SELECT t.lec('2026-09-21 07:01:00-06', 'CAMF', 0.95); SELECT t.lec('2026-09-21 07:01:00-06', 'CAMF', 0.95); SELECT t.lec('2026-09-21 07:01:00-06', 'CAMF', 0.95) $q$,
    $q$ SELECT t.est('A001') = 'pendiente/1' $q$, 'L4: la misma captura reenviada tres veces cuenta una sola lectura');
SELECT t.reloj('2026-09-21 07:21:00-06');
-- Minuto 9:59 / 10:00 / 20:00 / 20:01 segun la PRIMERA lectura valida
SELECT t.efecto($q$ SELECT t.lec('2026-09-21 07:09:59-06', 'CAMF', 0.95); SELECT t.lec('2026-09-21 07:10:15-06', 'CAMF', 0.95); SELECT t.lec('2026-09-21 07:10:30-06', 'CAMF', 0.95) $q$,
    $q$ SELECT t.est('A001') = 'presente/3' $q$, 'M1: primera lectura 9 min 59 s: presente');
SELECT t.efecto($q$ SELECT t.lec('2026-09-21 07:10:00-06', 'CAMF', 0.95); SELECT t.lec('2026-09-21 07:10:15-06', 'CAMF', 0.95); SELECT t.lec('2026-09-21 07:10:30-06', 'CAMF', 0.95) $q$,
    $q$ SELECT t.est('A001') = 'retardo/3' $q$, 'M2: primera lectura a los 10 min exactos: retardo');
SELECT t.efecto($q$ SELECT t.lec('2026-09-21 07:20:00-06', 'CAMF', 0.95); SELECT t.lec('2026-09-21 07:20:00-06', 'CAMB', 0.95); SELECT t.lec('2026-09-21 07:19:59-06', 'CAMB', 0.95) $q$,
    $q$ SELECT t.est('A001') = 'retardo/3' $q$, 'M3: minuto 20 exacto es retardo (inclusive)');
SELECT t.throws($q$ SELECT t.lec('2026-09-21 07:20:01-06', 'CAMF', 0.95) $q$, 'FUERA_DE_VENTANA', 'M4: captura a 20 min 1 s se rechaza');
-- Cierre: A001 con 2 lecturas queda pendiente; sin lecturas ausente
SELECT t.reloj('2026-09-21 07:25:00-06');
SELECT t.as_user('docente1@susan.test');
SELECT t.efecto($q$ SELECT public.api_cerrar_sesion(t.c('SN')) $q$,
    $q$ SELECT (SELECT estado::text FROM asistencia WHERE id_sesion = t.c('SN') AND id_alumno = t.c('ID_A002')) = 'ausente' $q$, 'K1: cierre crea ausente al inscrito sin registro');

-- ===== Derecho a examen: 48 sesiones, 9 faltas conserva / 10 pierde; 3 retardos = 1 falta =====
SELECT t.as_postgres();
SELECT t.eq((SELECT derecho_examen FROM inscripcion WHERE id_alumno = t.id_alumno('A001') AND id_grupo = t.id_grupo('3A')), true, 'E0: partida con 9 faltas conserva derecho (estado inicial de la inscripcion)');
SELECT t.efecto($q$ SELECT app.recalcular_inscripcion((SELECT id_inscripcion FROM inscripcion WHERE id_alumno = t.id_alumno('A001') AND id_grupo = t.id_grupo('3A'))) $q$,
    $q$ SELECT derecho_examen AND faltas_equivalentes = 9 AND sesiones_programadas = 49 OR (derecho_examen AND faltas_equivalentes = 9) FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A001') AND id_grupo = t.id_grupo('3A') $q$,
    'E1: 9 faltas sobre 48-49 sesiones conservan el derecho');
DO $$ BEGIN RAISE NOTICE 'E-info: %', (SELECT row_to_json(v)::text FROM v_resumen_asistencia v WHERE id_alumno = t.id_alumno('A001') AND id_grupo = t.id_grupo('3A')); END $$;
SELECT t.efecto($q$ INSERT INTO asistencia (id_sesion, id_alumno, estado, origen) VALUES (t.c('S0'), t.id_alumno('A001'), 'ausente', 'manual');
                    SELECT app.recalcular_inscripcion((SELECT id_inscripcion FROM inscripcion WHERE id_alumno = t.id_alumno('A001') AND id_grupo = t.id_grupo('3A'))) $q$,
    $q$ SELECT NOT derecho_examen AND faltas_equivalentes = 10 FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A001') AND id_grupo = t.id_grupo('3A') $q$,
    'E2: la falta 10 de 48 (20.83 %) retira el derecho');
-- 3 retardos = 1 ausencia (A005 ya trae 3 retardos: 07-sep, 05-sep y 08-sep)
SELECT t.eq((SELECT retardos || '/' || faltas_equivalentes FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A005') AND id_grupo = t.id_grupo('3A')), '3/1', 'R1: tres retardos = 1 ausencia equivalente');
SELECT t.efecto($q$ INSERT INTO asistencia (id_sesion, id_alumno, estado, hora_registro, origen)
                    SELECT id_sesion, t.id_alumno('A005'), 'retardo', fecha + time '07:12' , 'manual' FROM sesion_clase WHERE fecha BETWEEN '2026-06-01' AND '2026-06-02' AND id_grupo = t.id_grupo('3A') $q$,
    $q$ SELECT retardos = 5 AND faltas_equivalentes = 1 FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A005') AND id_grupo = t.id_grupo('3A') $q$,
    'R2: cinco retardos = 1 ausencia (piso)');
SELECT t.efecto($q$ INSERT INTO asistencia (id_sesion, id_alumno, estado, hora_registro, origen)
                    SELECT id_sesion, t.id_alumno('A005'), 'retardo', fecha + time '07:12' , 'manual' FROM sesion_clase WHERE fecha BETWEEN '2026-06-01' AND '2026-06-03' AND id_grupo = t.id_grupo('3A') $q$,
    $q$ SELECT retardos = 6 AND faltas_equivalentes = 2 FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A005') AND id_grupo = t.id_grupo('3A') $q$,
    'R3: seis retardos = 2 ausencias');

-- ===== Zona horaria: America/Mexico_City (UTC-6) vs UTC de la BD, alrededor de medianoche UTC =====
INSERT INTO public.sesion_clase (id_grupo, fecha, hora_inicio, hora_fin, modo_registro, estatus) VALUES
    (t.id_grupo('3A'), '2026-09-14', '23:00', '23:59', 'automatico', 'programada'),
    (t.id_grupo('3A'), '2026-09-15', '23:00', '23:59', 'automatico', 'programada');
INSERT INTO t.c_id VALUES ('SNOCHE14', (SELECT id_sesion FROM public.sesion_clase WHERE id_grupo = t.id_grupo('3A') AND fecha = '2026-09-14' AND hora_inicio = '23:00')),
                          ('SNOCHE15', (SELECT id_sesion FROM public.sesion_clase WHERE id_grupo = t.id_grupo('3A') AND fecha = '2026-09-15' AND hora_inicio = '23:00'));
SELECT t.as_user('docente1@susan.test');
SELECT t.reloj('2026-09-15 05:30:00+00');          -- UTC ya es 15-sep, el plantel va en 14-sep 23:30
SELECT t.eq(public.api_ahora() ->> 'fecha', '2026-09-14', 'Z1: a las 05:30 UTC del 15 el plantel sigue en el 14');
SELECT t.eq(public.api_ahora() ->> 'hora', '23:30:00', 'Z2: hora del plantel 23:30');
SELECT t.lives_rb($q$ SELECT public.api_abrir_sesion(t.c('SNOCHE14')) $q$, 'Z3: a las 23:30 locales se abre la sesion del 14 (aunque UTC ya sea 15)');
SELECT t.throws($q$ SELECT public.api_abrir_sesion(t.c('SNOCHE15')) $q$, 'FUERA_DE_HORARIO', 'Z4: la sesion del 15 a las 23:00 no se abre a las 23:30 del 14');
SELECT t.reloj('2026-09-15 06:00:00+00');
SELECT t.eq(public.api_ahora() ->> 'fecha', '2026-09-15', 'Z5: 06:00 UTC = 00:00 local del 15');
SELECT t.as_postgres();
-- Vigencia del consentimiento por fecha LOCAL
UPDATE consentimiento SET vigencia_hasta = '2026-09-14' WHERE id_consent = t.id_consent('A001');
SELECT t.reloj('2026-09-15 05:59:59+00');
SELECT t.eq(app.consentimiento_vigente(t.id_consent('A001')), true, 'Z6: consentimiento con vigencia 14-sep sigue vigente a las 23:59:59 locales');
SELECT t.reloj('2026-09-15 06:00:00+00');
SELECT t.eq(app.consentimiento_vigente(t.id_consent('A001')), false, 'Z7: ya no vigente a las 00:00 locales del 15');
-- Plazo de correccion con fin de sesion cerca de medianoche
SELECT t.eq(app.limite_correccion(DATE '2026-09-14', TIME '23:59'), '2026-09-17 05:59:00+00'::timestamptz, 'Z8: 48 h desde 23:59 locales = 17-sep 05:59 UTC');

SELECT t.summary();
ROLLBACK;
