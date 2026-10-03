-- api_b2_06 · flujo completo del indice (RF-16, RN-12, RNF-09): registrar plantilla -> svc_indice_plan -> svc_indice_registrar
-- -> svc_indice_activar (atomico) -> revocar consentimiento -> reconstruir -> svc_indice_revertir. El mapeo viaja como texto JSON
-- (igual que el campo "refs" del manifiesto del servicio de reconocimiento).
BEGIN;
SELECT t.begin('api_b2_06_flujo_indice');
SELECT t.cargar_fixtures();
CREATE FUNCTION t.ruta(p_prefijo text, p_matricula text, p_n integer, p_ext text) RETURNS text LANGUAGE sql STABLE
AS $$ SELECT p_prefijo || '/' || t.id_alumno(p_matricula) || '/00000000-0000-4000-8000-' || lpad(p_n::text, 12, '0') || '.' || p_ext $$;
CREATE FUNCTION t.refs(p_plan jsonb) RETURNS text LANGUAGE sql IMMUTABLE
AS $$ SELECT coalesce(jsonb_agg(jsonb_build_object('id_plantilla', e -> 'id_plantilla', 'faiss_id', e -> 'faiss_id') ORDER BY (e ->> 'id_plantilla')::int), '[]'::jsonb)::text
        FROM jsonb_array_elements(p_plan -> 'entries') e $$;
-- huella del estado del indice: version en uso + (plantilla, indice, faiss_id)
CREATE FUNCTION t.huella() RETURNS text LANGUAGE sql STABLE
AS $$ SELECT md5(coalesce((SELECT string_agg(version, ',') FROM public.indice_faiss WHERE en_uso), '-') || '|' ||
                 coalesce((SELECT string_agg(id_plantilla || ':' || coalesce(id_indice::text, '-') || ':' || coalesce(faiss_id::text, '-') || ':' || activa, ',' ORDER BY id_plantilla)
                             FROM public.plantilla_facial), '')) $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t TO PUBLIC;

-- 1. alta de plantilla (A002) por el administrador
SELECT t.as_user('admin@susan.test');
SELECT t.eq((public.api_plantilla_registrar(t.id_alumno('A002'), t.id_consent('A002'), t.ruta('registro', 'A002', 1, 'jpg')) ->> 'indexada'), 'false', 'flujo 1: plantilla nueva sin indexar');
SELECT t.as_user('tecnico@susan.test');
SELECT t.ok((public.api_indice_estado() ->> 'requiere_reconstruccion')::boolean, 'flujo 1: la consola ve que requiere reconstruccion');
SELECT t.eq((public.api_indice_estado() #>> '{plantillas,pendientes}')::int, 1, 'flujo 1: 1 pendiente');

-- 2-4. plan -> registrar -> activar (la version nueva incluye A001, A004 y A002)
SELECT t.as_service();
SELECT t.as_postgres();
SELECT set_config('t.plan1', public.svc_indice_plan()::text, true);
SELECT t.as_service();
SELECT t.eq(current_setting('t.plan1')::jsonb ->> 'version_sugerida', 'v003', 'flujo 2: version sugerida v003');
SELECT t.eq((current_setting('t.plan1')::jsonb #>> '{totales,nuevas}')::int, 1, 'flujo 2: una nueva');
SELECT t.eq((public.svc_indice_registrar('v003', 512, 'indice/v003.json', (current_setting('t.plan1')::jsonb #>> '{totales,activas}')::int) ->> 'en_uso'), 'false', 'flujo 3: version registrada sin uso');
SELECT t.eq(t.huella(), t.huella(), 'huella estable');
SELECT t.as_postgres();
SELECT set_config('t.h0', t.huella(), true);
SELECT t.as_service();
-- activacion con mapeo invalido: no cambia nada
SELECT t.throws($q$ SELECT public.svc_indice_activar(t.id_indice('v003'), '[{"id_plantilla":1,"faiss_id":0},{"id_plantilla":1,"faiss_id":1},{"id_plantilla":2,"faiss_id":2}]') $q$, 'P0001:INDICE_MAPEO_INVALIDO', 'flujo 4: mapeo con id repetido');
SELECT t.throws($q$ SELECT public.svc_indice_activar(t.id_indice('v003'), '[{"id_plantilla":1,"faiss_id":0},{"id_plantilla":2,"faiss_id":1}]') $q$, 'P0001:INDICE_MAPEO_INCOMPLETO', 'flujo 4: mapeo incompleto');
SELECT t.eq(t.huella(), current_setting('t.h0'), 'flujo 4: tras los rechazos nada cambio (version en uso y plantillas)');
SELECT t.eq((public.svc_indice_activar(t.id_indice('v003'), t.refs(current_setting('t.plan1')::jsonb)::jsonb) ->> 'plantillas_asignadas')::int, 3, 'flujo 4: activada con refs del plan');
SELECT t.eq((public.svc_indice_en_uso() ->> 'version'), 'v003', 'flujo 4: v003 en uso');
SELECT t.as_user('admin@susan.test');
SELECT t.ok((public.api_plantilla_alumno(t.id_alumno('A002')) #>> '{activa,indexada}')::boolean, 'flujo 4: A002 indexada');
SELECT t.eq((public.api_plantilla_alumno(t.id_alumno('A002')) #>> '{activa,version_indice}'), 'v003', 'flujo 4: A002 en v003');
SELECT t.ok((public.api_plantilla_alumno(t.id_alumno('A002')) #>> '{activa,en_uso}')::boolean, 'flujo 4: la version de A002 esta en uso');
SELECT t.as_user('tecnico@susan.test');
SELECT t.ok(NOT (public.api_indice_estado() ->> 'requiere_reconstruccion')::boolean, 'flujo 4: la consola ya no pide reconstruccion');

-- 5. revocar el consentimiento de A002: su vector debe salir en la siguiente version
SELECT t.as_user('admin@susan.test');
SELECT t.ok((public.api_consentimiento_revocar(t.id_consent('A002')) ->> 'requiere_reconstruccion')::boolean, 'flujo 5: revocar pide reconstruccion');
SELECT t.as_user('tecnico@susan.test');
SELECT t.eq((public.api_indice_estado() #>> '{plantillas,obsoletas_en_indice}')::int, 1, 'flujo 5: A002 archivada sigue en el indice en uso');
SELECT t.as_service();
SELECT t.as_postgres();
SELECT set_config('t.plan2', public.svc_indice_plan()::text, true);
SELECT t.as_service();
SELECT t.eq((current_setting('t.plan2')::jsonb #>> '{totales,obsoletas}')::int, 1, 'flujo 5: el plan detecta 1 obsoleta');
SELECT t.ok(NOT (current_setting('t.plan2')::jsonb ->> 'nada_que_hacer')::boolean, 'flujo 5: hay trabajo');
SELECT t.eq((current_setting('t.plan2')::jsonb #>> '{totales,activas}')::int, 2, 'flujo 5: solo A001 y A004 siguen activas');
SELECT t.eq(public.svc_indice_registrar('v004', 512, 'indice/v004.json', 2) ->> 'version', 'v004', 'flujo 5: v004 registrada');
SELECT t.eq((public.svc_indice_activar(t.id_indice('v004'), t.refs(current_setting('t.plan2')::jsonb)::jsonb) ->> 'plantillas_asignadas')::int, 2, 'flujo 5: v004 activada');
SELECT t.eq((SELECT count(*)::int FROM public.indice_faiss WHERE en_uso), 1, 'flujo 5: un solo indice en uso');
SELECT t.as_user('tecnico@susan.test');
SELECT t.eq((public.api_indice_estado() #>> '{plantillas,obsoletas_en_indice}')::int, 0, 'flujo 5: ya no hay obsoletas en la version en uso');
SELECT t.ok(NOT (public.api_indice_estado() ->> 'requiere_reconstruccion')::boolean, 'flujo 5: al dia');

-- 6. revertir a v003 con el mapeo de su manifiesto (A001, A004, A002); A002 esta archivada y se ignora
SELECT t.as_service();
SELECT t.eq((public.svc_indice_revertir(t.id_indice('v003'), t.refs(current_setting('t.plan1')::jsonb)::jsonb) ->> 'plantillas_asignadas')::int, 2, 'flujo 6: revertir asigna A001 y A004');
SELECT t.eq((public.svc_indice_revertir(t.id_indice('v003'), '[]') ->> 'ya_activo')::boolean::text, 'true', 'flujo 6: revertir de nuevo es idempotente');
SELECT t.eq((public.svc_indice_en_uso() ->> 'version'), 'v003', 'flujo 6: v003 en uso otra vez');
SELECT t.as_user('tecnico@susan.test');
SELECT t.eq((public.api_indice_estado() #>> '{plantillas,obsoletas_en_indice}')::int, 1, 'flujo 6: el vector de A002 vuelve a estar en el archivo antiguo');
SELECT t.ok((public.api_indice_estado() ->> 'requiere_reconstruccion')::boolean, 'flujo 6: toca reconstruir para sacarlo');
-- la reversion no cambio ninguna fila de plantilla de alumnos archivados
SELECT t.as_postgres();
SELECT t.eq((SELECT count(*)::int FROM public.plantilla_facial), 3, 'flujo: ninguna plantilla se borro en todo el flujo (A001, A004, A002)');
SELECT t.summary();
ROLLBACK;
