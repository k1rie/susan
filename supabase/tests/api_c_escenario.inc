-- Escenario comun de las pruebas api_c_1x (se incluye con \ir dentro de la transaccion de cada archivo).
--   S1 = 3A 2026-09-08 07:00-09:00 cerrada (vence_en = 2026-09-10 09:00-06) · S0 = 3A 2026-09-05 cerrada
--   S3 = 5B 2026-09-08 07:00-09:00 cerrada (automatica) · 43 sesiones de junio: 3A llega a 48 programadas.
--   AS1 A001 pendiente (2 lecturas) · AS2 A002 ausente · AS3 A005 retardo · AS4 A006 presente (S1) · AS5 A004 pendiente (S3)
--   AS6 A001 pendiente en la sesion ABIERTA 14-sep · AS7 A002 ausente y AS8 A005 retardo (S0) · A001 con 9 faltas en junio.
-- ---- ayudantes de prueba (se deshacen con el ROLLBACK) -------------------------------------------
CREATE TABLE t.c_id (k text PRIMARY KEY, v integer);
GRANT SELECT ON t.c_id TO PUBLIC;
CREATE FUNCTION t.c(p_k text) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT v FROM t.c_id WHERE k = p_k $$;
CREATE FUNCTION t.c_nbit(p_accion text, p_entidad text, p_id bigint) RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT count(*) FROM public.bitacora_auditoria WHERE accion = p_accion::public.accion_bitacora AND entidad = p_entidad AND id_registro = p_id $$;
CREATE FUNCTION t.c_bit(p_accion text, p_entidad text, p_id bigint) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT to_jsonb(b) FROM public.bitacora_auditoria b WHERE accion = p_accion::public.accion_bitacora AND entidad = p_entidad
       AND id_registro = p_id ORDER BY id_bitacora DESC LIMIT 1 $$;
CREATE FUNCTION t.c_nbit_total() RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT count(*) FROM public.bitacora_auditoria $$;
CREATE FUNCTION t.c_doc(p_matricula text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT 'justificantes/' || (SELECT id_alumno FROM public.alumno WHERE matricula = p_matricula) || '/5b3c0a9e-72d4-4f1b-9c1e-0d2f6a8b4e11.pdf' $$;
CREATE FUNCTION t.c_jid(p_grupo text, p_fecha date, p_matricula text) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT j.id_justificante FROM public.justificante j
       WHERE j.id_sesion = t.id_sesion(p_grupo, p_fecha) AND j.id_alumno = t.id_alumno(p_matricula)
       ORDER BY j.id_justificante DESC LIMIT 1 $$;
CREATE FUNCTION t.c_derecho(p_grupo text, p_matricula text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT derecho_examen FROM public.inscripcion WHERE id_grupo = t.id_grupo(p_grupo) AND id_alumno = t.id_alumno(p_matricula) $$;
GRANT EXECUTE ON FUNCTION t.c(text), t.c_nbit(text, text, bigint), t.c_bit(text, text, bigint), t.c_nbit_total(),
    t.c_doc(text), t.c_jid(text, date, text), t.c_derecho(text, text) TO PUBLIC;

-- ---- escenario ------------------------------------------------------------------------------------
INSERT INTO public.sesion_clase (id_grupo, fecha, hora_inicio, hora_fin, modo_registro, estatus) VALUES
    (t.id_grupo('3A'), '2026-09-08', '07:00', '09:00', 'automatico', 'cerrada'),
    (t.id_grupo('3A'), '2026-09-05', '07:00', '09:00', 'automatico', 'cerrada'),
    (t.id_grupo('5B'), '2026-09-08', '07:00', '09:00', 'automatico', 'cerrada');
INSERT INTO public.sesion_clase (id_grupo, fecha, hora_inicio, hora_fin, estatus)
SELECT t.id_grupo('3A'), DATE '2026-06-01' + i, '07:00', '08:00', 'cerrada' FROM generate_series(0, 42) i;

-- S1: A001 pendiente (2 lecturas), A002 ausente, A005 retardo, A006 presente
INSERT INTO public.asistencia (id_sesion, id_alumno, estado, hora_registro, origen, conteo_detecciones) VALUES
    (t.id_sesion('3A', '2026-09-08'), t.id_alumno('A001'), 'pendiente', '2026-09-08 07:04:55-06', 'automatico', 2),
    (t.id_sesion('3A', '2026-09-08'), t.id_alumno('A002'), 'ausente', NULL, 'automatico', 0),
    (t.id_sesion('3A', '2026-09-08'), t.id_alumno('A005'), 'retardo', '2026-09-08 07:12:30-06', 'manual', 3),
    (t.id_sesion('3A', '2026-09-08'), t.id_alumno('A006'), 'presente', '2026-09-08 07:03:00-06', 'manual', 0),
    (t.id_sesion('5B', '2026-09-08'), t.id_alumno('A004'), 'pendiente', '2026-09-08 07:03:00-06', 'automatico', 1),
    (t.id_sesion('3A', '2026-09-05'), t.id_alumno('A002'), 'ausente', NULL, 'automatico', 0),
    (t.id_sesion('3A', '2026-09-05'), t.id_alumno('A005'), 'retardo', '2026-09-05 07:12:00-06', 'manual', 0);
-- 9 faltas de A001 en junio (18.75 % de 48 sesiones)
INSERT INTO public.asistencia (id_sesion, id_alumno, estado, origen)
SELECT s.id_sesion, t.id_alumno('A001'), 'ausente', 'manual'
  FROM public.sesion_clase s WHERE s.id_grupo = t.id_grupo('3A') AND s.fecha BETWEEN '2026-06-01' AND '2026-06-09';

-- Lecturas de A001 en S1: 0.912 valida (frente), 0.874 valida (fondo), 0.801 no valida (frente, sin recorte)
INSERT INTO public.captura (id_camara, id_sesion, marca_tiempo, rostros_detectados) VALUES
    (t.id_camara('A-12', 'frente'), t.id_sesion('3A', '2026-09-08'), '2026-09-08 07:04:55-06', 1),
    (t.id_camara('A-12', 'fondo'),  t.id_sesion('3A', '2026-09-08'), '2026-09-08 07:05:10-06', 1),
    (t.id_camara('A-12', 'frente'), t.id_sesion('3A', '2026-09-08'), '2026-09-08 07:05:25-06', 1);
INSERT INTO public.deteccion (id_captura, id_plantilla, score_similitud, es_valida, objeto_recorte)
SELECT c.id_captura, t.id_plantilla('A001'), v.score, v.valida, v.recorte
  FROM (SELECT id_captura, row_number() OVER (ORDER BY marca_tiempo) AS n FROM public.captura
         WHERE id_sesion = t.id_sesion('3A', '2026-09-08')) c
  JOIN (VALUES (1, 0.912::numeric, true, 'recortes/s1/1.jpg'), (2, 0.874::numeric, true, 'recortes/s1/2.jpg'),
               (3, 0.801::numeric, false, NULL::text)) v(n, score, valida, recorte) ON v.n = c.n;

INSERT INTO t.c_id VALUES
    ('AS1', t.id_asistencia('3A', '2026-09-08', 'A001')), ('AS2', t.id_asistencia('3A', '2026-09-08', 'A002')),
    ('AS3', t.id_asistencia('3A', '2026-09-08', 'A005')), ('AS4', t.id_asistencia('3A', '2026-09-08', 'A006')),
    ('AS5', t.id_asistencia('5B', '2026-09-08', 'A004')), ('AS6', t.id_asistencia('3A', '2026-09-14', 'A001')),
    ('AS7', t.id_asistencia('3A', '2026-09-05', 'A002')), ('AS8', t.id_asistencia('3A', '2026-09-05', 'A005')),
    ('S0', t.id_sesion('3A', '2026-09-05')), ('S1', t.id_sesion('3A', '2026-09-08')),
    ('S2', t.id_sesion('3A', '2026-09-14')), ('S3', t.id_sesion('5B', '2026-09-08'));

SELECT t.eq((SELECT sesiones_programadas FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A001') AND id_grupo = t.id_grupo('3A')), 48,
    'escenario: 48 sesiones programadas en 3A');
-- Ids de alumno guardados en la tabla (el alumno no puede leer filas ajenas de alumno: t.id_alumno daria NULL).
INSERT INTO t.c_id SELECT 'ID_' || matricula, id_alumno FROM public.alumno;
INSERT INTO t.c_id VALUES ('G3A', t.id_grupo('3A')), ('G5B', t.id_grupo('5B'));
