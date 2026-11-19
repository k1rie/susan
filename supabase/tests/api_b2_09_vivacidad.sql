-- api_b2_09 · deteccion de vida por lectura y marca "sospechosa" (migracion 0238): deteccion.es_viva / puntaje_vida,
-- svc_registrar_detecciones (datos de vida opcionales y tolerantes), y la marca derivada en la cola de revision
-- (api_cola_revision, via app.c1_lecturas_caso) y en api_detecciones_caso.
BEGIN;
SELECT t.begin('api_b2_09_vivacidad');
SELECT t.cargar_fixtures();
\ir api_c_escenario.inc
GRANT SELECT ON public.deteccion, public.captura, public.asistencia TO PUBLIC;

-- ===================== estructura =====================
SELECT t.as_postgres();
SELECT t.ok((SELECT count(*) = 2 FROM pg_attribute
              WHERE attrelid = 'public.deteccion'::regclass AND attname IN ('es_viva', 'puntaje_vida') AND NOT attisdropped AND NOT attnotnull),
    'deteccion.es_viva y puntaje_vida existen y admiten NULL (no evaluada)');
SELECT t.ok(NOT EXISTS (SELECT 1 FROM public.deteccion WHERE es_viva IS NOT NULL OR puntaje_vida IS NOT NULL),
    'las lecturas existentes quedan sin evaluar (NULL, NULL)');
SELECT t.ok(EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.deteccion'::regclass AND conname = 'ck_deteccion_vida' AND convalidated),
    'ck_deteccion_vida existe y esta validada');
SELECT t.eq((SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname LIKE 'api\_%'), 82::bigint,
    'el catalogo tiene 82 api_* (72 + las 4 api_mi_* del autoservicio, 0239 + las 6 api_laboratorio* de 0241)');
SELECT t.lives_rb($q$ INSERT INTO public.deteccion (id_captura, id_plantilla, score_similitud, es_valida, es_viva, puntaje_vida)
    SELECT id_captura, t.id_plantilla('A001'), 0.9, true, true, 0.93 FROM public.captura LIMIT 1 $q$, 'una lectura con veredicto y puntaje es valida');
SELECT t.throws($q$ INSERT INTO public.deteccion (id_captura, id_plantilla, score_similitud, es_valida, es_viva)
    SELECT id_captura, t.id_plantilla('A001'), 0.9, true, false FROM public.captura LIMIT 1 $q$, '23514:ck_deteccion_vida', 'veredicto sin puntaje');
SELECT t.throws($q$ INSERT INTO public.deteccion (id_captura, id_plantilla, score_similitud, es_valida, puntaje_vida)
    SELECT id_captura, t.id_plantilla('A001'), 0.9, true, 0.5 FROM public.captura LIMIT 1 $q$, '23514:ck_deteccion_vida', 'puntaje sin veredicto');
SELECT t.throws($q$ INSERT INTO public.deteccion (id_captura, id_plantilla, score_similitud, es_valida, es_viva, puntaje_vida)
    SELECT id_captura, t.id_plantilla('A001'), 0.9, true, true, 1.5 FROM public.captura LIMIT 1 $q$, '23514:ck_deteccion_vida', 'puntaje fuera de 0..1');

-- ===================== svc_registrar_detecciones guarda la vida (sesion abierta 14-sep, 3A) =====================
SELECT t.reloj('2026-09-14 07:25:00-06');
SELECT t.as_service();
CREATE TEMP TABLE caps (n int PRIMARY KEY, id bigint);
GRANT SELECT ON caps TO PUBLIC;
-- Minutos 07:11 a 07:16: no chocan con las capturas del fixture (svc_crear_captura es idempotente por camara y marca)
INSERT INTO caps SELECT n, public.svc_crear_captura(t.c('S2'), t.id_camara('A-12', 'frente'),
        ('2026-09-14 07:' || lpad((10 + n)::text, 2, '0') || ':00-06')::timestamptz, 1)
  FROM generate_series(1, 6) n;
SELECT t.as_postgres();
CREATE TEMP TABLE antes AS SELECT app.lecturas_validas(t.c('S2'), t.id_alumno('A001')) AS lv;
GRANT SELECT ON antes TO PUBLIC;
SELECT t.as_service();

-- 1: lectura valida de A001 "no viva" (el caso de una foto): se guarda y la lectura SIGUE siendo valida
SELECT t.eq(public.svc_registrar_detecciones((SELECT id FROM caps WHERE n = 1),
        '[{"faiss_id": 0, "score": 0.97, "es_viva": false, "puntaje_vida": 0.1234}]'::jsonb) ->> 'validas', '1',
    'vida: una lectura no viva se registra y sigue siendo valida (la vida no decide la asistencia)');
SELECT t.as_postgres();
SELECT t.eq((SELECT es_viva::text || '/' || puntaje_vida::text FROM public.deteccion WHERE id_captura = (SELECT id FROM caps WHERE n = 1)),
    'false/0.123', 'vida: se guarda el veredicto y el puntaje redondeado a 3 decimales');
SELECT t.ok((SELECT es_valida FROM public.deteccion WHERE id_captura = (SELECT id FROM caps WHERE n = 1)), 'vida: es_valida no cambia por es_viva = false');

-- 2: viva
SELECT t.as_service();
SELECT public.svc_registrar_detecciones((SELECT id FROM caps WHERE n = 2), '[{"faiss_id": 0, "score": 0.95, "es_viva": true, "puntaje_vida": 0.93}]'::jsonb);
-- 3: sin datos de vida (rostro pequeno o servicio sin el addon): NULL, NULL
SELECT public.svc_registrar_detecciones((SELECT id FROM caps WHERE n = 3), '[{"faiss_id": 0, "score": 0.95}]'::jsonb);
-- 4: solo uno de los dos datos -> se ignoran ambos
SELECT public.svc_registrar_detecciones((SELECT id FROM caps WHERE n = 4), '[{"faiss_id": 0, "score": 0.95, "es_viva": false}]'::jsonb);
-- 5: mal formados (texto, puntaje fuera de rango): NO tumban la captura, quedan sin evaluar
SELECT t.lives(format($q$ SELECT public.svc_registrar_detecciones(%s, '[{"faiss_id": 0, "score": 0.95, "es_viva": "no", "puntaje_vida": "x"}]'::jsonb) $q$,
    (SELECT id FROM caps WHERE n = 5)), 'vida mal formada (texto): la deteccion se registra igual');
SELECT t.lives(format($q$ SELECT public.svc_registrar_detecciones(%s, '[{"faiss_id": 0, "score": 0.95, "es_viva": true, "puntaje_vida": 7}]'::jsonb) $q$,
    (SELECT id FROM caps WHERE n = 6)), 'vida con puntaje fuera de 0..1: la deteccion se registra igual');
SELECT t.as_postgres();
SELECT t.eq((SELECT es_viva::text || '/' || puntaje_vida::text FROM public.deteccion WHERE id_captura = (SELECT id FROM caps WHERE n = 2)),
    'true/0.930', 'vida: lectura viva guardada');
SELECT t.ok((SELECT es_viva IS NULL AND puntaje_vida IS NULL FROM public.deteccion WHERE id_captura = (SELECT id FROM caps WHERE n = 3)),
    'vida: sin datos de vida -> NULL, NULL');
SELECT t.ok((SELECT es_viva IS NULL AND puntaje_vida IS NULL FROM public.deteccion WHERE id_captura = (SELECT id FROM caps WHERE n = 4)),
    'vida: solo es_viva sin puntaje -> se ignora');
SELECT t.ok((SELECT es_viva IS NULL AND puntaje_vida IS NULL FROM public.deteccion WHERE id_captura = (SELECT id FROM caps WHERE n = 5)),
    'vida: texto -> se ignora');
SELECT t.ok((SELECT es_viva IS NULL AND puntaje_vida IS NULL FROM public.deteccion WHERE id_captura = (SELECT id FROM caps WHERE n = 6)),
    'vida: puntaje 7 -> se ignora');
SELECT t.eq((SELECT count(*) FROM public.deteccion WHERE id_captura IN (SELECT id FROM caps)), 6::bigint, 'vida: las 6 detecciones quedaron registradas');
SELECT t.eq(app.lecturas_validas(t.c('S2'), t.id_alumno('A001')), (SELECT lv FROM antes) + 6,
    'vida: las 6 lecturas cuentan para RN-05, tambien la no viva (la vida no descuenta lecturas validas)');

-- ===================== marca sospechosa en la revision (S1: AS1 de A001 con 2 lecturas validas y 1 no valida) =====================
-- Las lecturas de A001 en S1 son 0.912 valida, 0.874 valida y 0.801 no valida (api_c_escenario.inc).
CREATE FUNCTION t.vida_s1(p_score numeric, p_viva boolean, p_puntaje numeric) RETURNS void LANGUAGE sql
AS $$ UPDATE public.deteccion SET es_viva = p_viva, puntaje_vida = p_puntaje
       WHERE score_similitud = p_score AND id_captura IN (SELECT id_captura FROM public.captura WHERE id_sesion = t.c('S1')) $$;
GRANT EXECUTE ON FUNCTION t.vida_s1(numeric, boolean, numeric) TO PUBLIC;

SELECT t.reloj('2026-09-08 09:40:00-06');
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 ->> 'sospechosa', 'false', 'SOSP-01: sin datos de vida el caso no es sospechoso');
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 ->> 'lecturas_no_vivas', '0', 'SOSP-01: 0 lecturas no vivas');
SELECT t.ok(public.api_cola_revision() -> 'pendientes' -> 0 -> 'lecturas' -> 0 -> 'es_viva' = 'null'::jsonb
        AND public.api_cola_revision() -> 'pendientes' -> 0 -> 'lecturas' -> 0 -> 'puntaje_vida' = 'null'::jsonb,
    'SOSP-01: la lectura sin evaluar trae es_viva y puntaje_vida en null');

-- Una lectura VALIDA no viva -> sospechosa
SELECT t.as_postgres();
SELECT t.vida_s1(0.912, false, 0.120);
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 ->> 'sospechosa', 'true', 'SOSP-02: una lectura valida con es_viva = false marca el caso como sospechoso');
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 ->> 'lecturas_no_vivas', '1', 'SOSP-02: cuenta 1 lectura no viva');
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 -> 'lecturas' -> 0 ->> 'es_viva', 'false', 'SOSP-02: la lectura expone es_viva');
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 -> 'lecturas' -> 0 ->> 'puntaje_vida', '0.120', 'SOSP-02: la lectura expone puntaje_vida');
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 ->> 'lecturas_validas', '2', 'SOSP-02: la marca NO cambia las lecturas validas');
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 ->> 'estado', 'pendiente', 'SOSP-02: ni el estado del caso');
SELECT t.eq(public.api_cola_revision() -> 'contadores' ->> 'pendientes', '1', 'SOSP-02: ni el contador de la cola');
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 ->> 'estado_sugerido', 'presente', 'SOSP-02: ni el estado sugerido');

-- api_detecciones_caso: misma marca, por lectura y en el encabezado
SELECT t.eq(public.api_detecciones_caso(t.c('AS1')) ->> 'sospechosa', 'true', 'SOSP-03: api_detecciones_caso informa sospechosa');
SELECT t.eq(public.api_detecciones_caso(t.c('AS1')) ->> 'lecturas_no_vivas', '1', 'SOSP-03: y cuantas lecturas no vivas');
SELECT t.eq((SELECT count(*) FROM jsonb_array_elements(public.api_detecciones_caso(t.c('AS1')) -> 'lecturas') l WHERE l ->> 'es_viva' = 'false'), 1::bigint,
    'SOSP-03: exactamente una lectura no viva en el detalle');
SELECT t.eq(public.api_detecciones_caso(t.c('AS1'), true, 1, 1) ->> 'sospechosa', 'true',
    'SOSP-03: la marca no depende de la paginacion (la pagina pedida no contiene la lectura no viva) ni de p_solo_validas');

-- Una lectura NO valida con es_viva = false NO marca el caso (no sostiene la asistencia)
SELECT t.as_postgres();
SELECT t.vida_s1(0.912, true, 0.900);
SELECT t.vida_s1(0.801, false, 0.050);
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 ->> 'sospechosa', 'false', 'SOSP-04: una lectura NO valida y no viva no marca el caso');
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 ->> 'lecturas_no_vivas', '0', 'SOSP-04: y no cuenta como lectura no viva');

-- Todas vivas -> no sospechosa
SELECT t.as_postgres();
SELECT t.vida_s1(0.874, true, 0.950);
SELECT t.vida_s1(0.801, true, 0.950);
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(public.api_detecciones_caso(t.c('AS1')) ->> 'sospechosa', 'false', 'SOSP-05: todas vivas -> no sospechosa');

-- La pestana de justificantes recibe la misma marca (mismo helper)
SELECT t.as_postgres();
SELECT t.vida_s1(0.874, false, 0.020);
INSERT INTO public.justificante (id_sesion, id_alumno, motivo, objeto_documento, registrado_por, fecha_registro)
    VALUES (t.c('S1'), t.id_alumno('A001'), 'Consulta medica', t.c_doc('A001'),
            (SELECT id_usuario FROM public.usuario WHERE correo = 'docente1@susan.test'), '2026-09-08 09:30:00-06');
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(public.api_cola_revision('justificantes') -> 'justificantes' -> 0 ->> 'sospechosa', 'true',
    'SOSP-06: la pestana de justificantes tambien trae la marca');
SELECT t.eq(public.api_cola_revision('justificantes') -> 'justificantes' -> 0 ->> 'lecturas_no_vivas', '1', 'SOSP-06: y el conteo');

-- Aislamiento: el otro docente no ve nada de esto (RLS intacta)
SELECT t.as_user('docente2@susan.test');
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 ->> 'sospechosa', 'false', 'SOSP-07: el caso de D2 (sin lecturas) no es sospechoso');
SELECT t.throws(format('SELECT public.api_detecciones_caso(%s)', t.c('AS1')), 'P0001:NO_ENCONTRADO', 'SOSP-07: D2 no accede al detalle del caso de D1');

-- Privilegios: svc_registrar_detecciones sigue cerrada a usuarios
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT public.svc_registrar_detecciones(1, '[]'::jsonb) $q$, '42501', 'svc_registrar_detecciones sigue sin EXECUTE para docentes');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.svc_registrar_detecciones(1, '[]'::jsonb) $q$, '42501', 'svc_registrar_detecciones sigue sin EXECUTE para anon');

SELECT t.summary();
ROLLBACK;
