-- api_b2_04 · indice FAISS: svc_indice_plan / registrar / activar / revertir / en_uso, bloqueos y flujo completo (3.12 a 3.17).
BEGIN;
SELECT t.begin('api_b2_04_indice');
SELECT t.cargar_fixtures();
CREATE FUNCTION t.ruta(p_prefijo text, p_matricula text, p_n integer, p_ext text) RETURNS text LANGUAGE sql STABLE
AS $$ SELECT p_prefijo || '/' || t.id_alumno(p_matricula) || '/00000000-0000-4000-8000-' || lpad(p_n::text, 12, '0') || '.' || p_ext $$;
-- mapeo [{id_plantilla, faiss_id}] a partir de un plan (lo mismo que hace lib/server/indice.js con refs)
CREATE FUNCTION t.mapa(p_plan jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE
AS $$ SELECT coalesce(jsonb_agg(jsonb_build_object('id_plantilla', e -> 'id_plantilla', 'faiss_id', e -> 'faiss_id') ORDER BY (e ->> 'id_plantilla')::int), '[]'::jsonb)
        FROM jsonb_array_elements(p_plan -> 'entries') e $$;
CREATE FUNCTION t.en_uso() RETURNS text LANGUAGE sql STABLE
AS $$ SELECT coalesce(string_agg(version, ','), '-') FROM public.indice_faiss WHERE en_uso $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t TO PUBLIC;

-- ===================== svc_indice_plan =====================
SELECT t.as_service();
SELECT t.eq((public.svc_indice_plan() #>> '{base,version}'), 'v001', 'plan: base = version en uso');
SELECT t.ok(public.svc_indice_plan() -> 'motivo_sin_base' = 'null'::jsonb, 'plan: con base no hay motivo_sin_base');
SELECT t.eq((public.svc_indice_plan() ->> 'version_sugerida'), 'v003', 'plan: version sugerida v003 (existen v001 y v002)');
SELECT t.eq((public.svc_indice_plan() ->> 'dimension')::int, 512, 'plan: dimension');
SELECT t.ok((public.svc_indice_plan() ->> 'nada_que_hacer')::boolean, 'plan: sin cambios => nada_que_hacer');
SELECT t.eq((public.svc_indice_plan() #>> '{totales,en_base}')::int, 2, 'plan: 2 en base');
SELECT t.eq((SELECT string_agg((e ->> 'faiss_id'), ',' ORDER BY (e ->> 'id_plantilla')::int) FROM jsonb_array_elements(public.svc_indice_plan() -> 'entries') e),
    '0,1', 'plan: las plantillas en base conservan su faiss_id');
-- altas nuevas (admin) -> pendientes con faiss_id nuevos monotonos
SELECT t.as_user('admin@susan.test');
SELECT public.api_plantilla_registrar(t.id_alumno('A002'), t.id_consent('A002'), t.ruta('registro', 'A002', 1, 'jpg'));
SELECT public.api_plantilla_registrar(t.id_alumno('A003'), t.id_consent('A003'), t.ruta('registro', 'A003', 1, 'jpg'));
SELECT t.as_service();
SELECT t.eq((public.svc_indice_plan() #>> '{totales,nuevas}')::int, 2, 'plan: 2 nuevas');
SELECT t.ok(NOT (public.svc_indice_plan() ->> 'nada_que_hacer')::boolean, 'plan: hay nuevas => hay trabajo');
SELECT t.eq((SELECT string_agg((e ->> 'faiss_id') || ':' || (e ->> 'en_base'), ',' ORDER BY (e ->> 'id_plantilla')::int) FROM jsonb_array_elements(public.svc_indice_plan() -> 'entries') e),
    '0:true,1:true,2:false,3:false', 'plan: faiss_id nuevos = max + posicion');
-- reemplazo de A001: la archivada (faiss 0) no se reutiliza y sigue contando como "obsoleta"
SELECT t.as_user('admin@susan.test');
SELECT public.api_plantilla_registrar(t.id_alumno('A001'), t.id_consent('A001'), t.ruta('registro', 'A001', 2, 'jpg'));
SELECT t.as_service();
SELECT t.eq((public.svc_indice_plan() #>> '{totales,obsoletas}')::int, 1, 'plan: 1 obsoleta (A001 archivada sigue en v001)');
SELECT t.eq((public.svc_indice_plan() #>> '{totales,activas}')::int, 4, 'plan: 4 activas (la archivada no entra)');
SELECT t.eq((SELECT max((e ->> 'faiss_id')::int) FROM jsonb_array_elements(public.svc_indice_plan() -> 'entries') e), 4, 'plan: faiss_id nuevo = 4 (el 0 archivado no se reutiliza)');
SELECT t.eq((SELECT count(DISTINCT e ->> 'faiss_id')::int FROM jsonb_array_elements(public.svc_indice_plan() -> 'entries') e), 4, 'plan: faiss_id unicos');
-- plan completo
SELECT t.ok(public.svc_indice_plan(true) -> 'base' = 'null'::jsonb, 'plan completo: sin base');
SELECT t.eq((public.svc_indice_plan(true) ->> 'motivo_sin_base'), 'completa', 'plan completo: motivo');
SELECT t.eq((public.svc_indice_plan(true) #>> '{totales,nuevas}')::int, 4, 'plan completo: todas nuevas');
SELECT t.eq((public.svc_indice_plan(true) #>> '{totales,obsoletas}')::int, 0, 'plan completo: obsoletas 0 (no hay base)');
SELECT t.eq((SELECT min((e ->> 'faiss_id')::int) FROM jsonb_array_elements(public.svc_indice_plan(true) -> 'entries') e), 2, 'plan completo: faiss_id desde max + 1 (el maximo persistido es 1)');
-- sin indice en uso / dimension cambiada
SELECT t.efecto($q$ UPDATE public.indice_faiss SET en_uso = false $q$, $q$ SELECT public.svc_indice_plan() ->> 'motivo_sin_base' = 'sin_indice' $q$, 'plan: sin_indice');
SELECT t.efecto($q$ UPDATE public.parametro_sistema SET valor = '256' WHERE clave = 'dimension_vector' $q$,
    $q$ SELECT public.svc_indice_plan() ->> 'motivo_sin_base' = 'dimension_cambiada' AND public.svc_indice_plan() ->> 'dimension' = '256' $q$, 'plan: dimension_cambiada');

-- ===================== svc_indice_registrar =====================
SELECT t.eq((public.svc_indice_registrar('v003', 512, 'indice/v003.json', 4) ->> 'en_uso'), 'false', 'registrar: nace sin uso');
SELECT t.ok((public.svc_indice_registrar('v003', 512, 'indice/v003.json', 4) ->> 'ya_registrada')::boolean, 'registrar: ya_registrada = true al repetir');
SELECT t.eq((SELECT count(*)::int FROM public.indice_faiss WHERE version = 'v003'), 1, 'registrar idempotente: una sola fila');
SELECT t.throws($q$ SELECT public.svc_indice_registrar('v003', 512, 'indice/v003.json', 5) $q$, 'P0001:INDICE_VERSION_DUPLICADA', 'misma version con otro total');
SELECT t.throws($q$ SELECT public.svc_indice_registrar('v001', 512, 'indice/v001.json', 2) $q$, 'P0001:INDICE_VERSION_DUPLICADA', 'version en uso no se re-registra');
SELECT t.throws($q$ SELECT public.svc_indice_registrar('v009', 512, 'indice/otra.json', 4) $q$, 'P0001:RUTA_INVALIDA', 'ruta distinta de indice/{version}.json');
SELECT t.throws($q$ SELECT public.svc_indice_registrar('v009', 512, '../indice/v009.json', 4) $q$, 'P0001:RUTA_INVALIDA', 'ruta con traversal');
SELECT t.throws($q$ SELECT public.svc_indice_registrar('v009', 256, 'indice/v009.json', 4) $q$, 'P0001:INDICE_DIMENSION_INVALIDA', 'dimension distinta a dimension_vector');
SELECT t.throws($q$ SELECT public.svc_indice_registrar('v 09', 512, 'indice/v 09.json', 4) $q$, 'P0001:VALIDACION', 'version con espacio');
SELECT t.throws($q$ SELECT public.svc_indice_registrar('v0123456789012', 512, 'indice/v0123456789012.json', 4) $q$, 'P0001:VALIDACION', 'version de 13 caracteres');
SELECT t.throws($q$ SELECT public.svc_indice_registrar(NULL, 512, 'indice/x.json', 4) $q$, 'P0001:VALIDACION', 'version nula');
SELECT t.throws($q$ SELECT public.svc_indice_registrar('v009', 512, 'indice/v009.json', -1) $q$, 'P0001:VALIDACION', 'total negativo');
SELECT t.lives_rb($q$ SELECT public.svc_indice_registrar('v009', 512, 'indice/v009.json', 0) $q$, 'total 0 valido (indice vacio)');
SELECT t.lives_rb($q$ SELECT public.svc_indice_registrar('v0123456789a', 512, 'indice/v0123456789a.json', 1) $q$, 'version de 12 caracteres valida');

-- ===================== svc_indice_activar: rechazos (no cambian nada) =====================
SELECT t.eq(t.en_uso(), 'v001', 'antes: v001 en uso');
SELECT t.throws($q$ SELECT public.svc_indice_activar(999999, '[]') $q$, 'P0001:NO_ENCONTRADO', 'activar: version inexistente');
SELECT t.throws($q$ SELECT public.svc_indice_activar(t.id_indice('v003'), t.mapa(public.svc_indice_plan()) - 0) $q$, 'P0001:INDICE_MAPEO_INCOMPLETO', 'mapeo con 3 de 4');
SELECT t.throws($q$ SELECT public.svc_indice_activar(t.id_indice('v003'), t.mapa(public.svc_indice_plan()) || '[{"id_plantilla":1,"faiss_id":99}]'::jsonb) $q$, 'P0001:INDICE_MAPEO_INCOMPLETO', 'mapeo con 5 de 4');
SELECT t.throws($q$ SELECT public.svc_indice_activar(t.id_indice('v003'), NULL) $q$, 'P0001:INDICE_MAPEO_INVALIDO', 'mapeo nulo');
SELECT t.throws($q$ SELECT public.svc_indice_activar(t.id_indice('v003'), '{"id_plantilla":1,"faiss_id":2}') $q$, 'P0001:INDICE_MAPEO_INVALIDO', 'mapeo no es arreglo');
SELECT t.throws($q$ SELECT public.svc_indice_activar(t.id_indice('v003'), '[1,2,3,4]') $q$, 'P0001:INDICE_MAPEO_INVALIDO', 'elementos no objeto');
SELECT t.throws($q$ SELECT public.svc_indice_activar(t.id_indice('v003'), '[{"id_plantilla":"1","faiss_id":2},{"id_plantilla":2,"faiss_id":3},{"id_plantilla":3,"faiss_id":4},{"id_plantilla":4,"faiss_id":5}]') $q$, 'P0001:INDICE_MAPEO_INVALIDO', 'id_plantilla como texto');
SELECT t.throws($q$ SELECT public.svc_indice_activar(t.id_indice('v003'), '[{"id_plantilla":1,"faiss_id":-1},{"id_plantilla":2,"faiss_id":3},{"id_plantilla":3,"faiss_id":4},{"id_plantilla":4,"faiss_id":5}]') $q$, 'P0001:INDICE_MAPEO_INVALIDO', 'faiss_id negativo');
SELECT t.throws($q$ SELECT public.svc_indice_activar(t.id_indice('v003'), '[{"id_plantilla":1,"faiss_id":1.5},{"id_plantilla":2,"faiss_id":3},{"id_plantilla":3,"faiss_id":4},{"id_plantilla":4,"faiss_id":5}]') $q$, 'P0001:INDICE_MAPEO_INVALIDO', 'faiss_id decimal');
SELECT t.throws($q$ SELECT public.svc_indice_activar(t.id_indice('v003'), '[{"id_plantilla":1},{"id_plantilla":2,"faiss_id":3},{"id_plantilla":3,"faiss_id":4},{"id_plantilla":4,"faiss_id":5}]') $q$, 'P0001:INDICE_MAPEO_INVALIDO', 'falta faiss_id');
SELECT t.throws($q$ SELECT public.svc_indice_activar(t.id_indice('v003'), '[{"id_plantilla":1,"faiss_id":2},{"id_plantilla":1,"faiss_id":3},{"id_plantilla":3,"faiss_id":4},{"id_plantilla":4,"faiss_id":5}]') $q$, 'P0001:INDICE_MAPEO_INVALIDO', 'id_plantilla repetido');
SELECT t.throws($q$ SELECT public.svc_indice_activar(t.id_indice('v003'), '[{"id_plantilla":1,"faiss_id":2},{"id_plantilla":2,"faiss_id":2},{"id_plantilla":3,"faiss_id":4},{"id_plantilla":4,"faiss_id":5}]') $q$, 'P0001:INDICE_MAPEO_INVALIDO', 'faiss_id repetido');
-- plan obsoleto: plantilla archivada o inexistente en el mapeo; activa indexada ausente
SELECT t.throws($q$ SELECT public.svc_indice_activar(t.id_indice('v003'),
        (t.mapa(public.svc_indice_plan()) - 0) || jsonb_build_array(jsonb_build_object('id_plantilla', (SELECT id_plantilla FROM public.plantilla_facial WHERE NOT activa AND id_alumno = t.id_alumno('A001')), 'faiss_id', 77))) $q$,
    'P0001:INDICE_PLAN_OBSOLETO', 'plantilla archivada en el mapeo');
SELECT t.throws($q$ SELECT public.svc_indice_activar(t.id_indice('v003'),
        (t.mapa(public.svc_indice_plan()) - 0) || '[{"id_plantilla":999999,"faiss_id":77}]'::jsonb) $q$, 'P0001:INDICE_PLAN_OBSOLETO', 'plantilla inexistente en el mapeo');
SELECT t.as_postgres();
SELECT t.as_service();
SELECT t.eq(public.svc_indice_registrar('v004', 512, 'indice/v004.json', 3) ->> 'version', 'v004', 'registrar v004 (3 vectores)');
SELECT t.throws($q$ SELECT public.svc_indice_activar(t.id_indice('v004'),
        (SELECT jsonb_agg(m) FROM jsonb_array_elements(t.mapa(public.svc_indice_plan())) m WHERE (m ->> 'id_plantilla')::int <> t.id_plantilla('A004'))) $q$,
    'P0001:INDICE_PLAN_OBSOLETO', 'activa indexada (A004 en v001) ausente del mapeo');
SELECT t.eq(t.en_uso(), 'v001', 'tras los rechazos v001 sigue en uso');
SELECT t.eq((SELECT count(*)::int FROM public.plantilla_facial WHERE activa AND id_indice IS NULL), 3, 'tras los rechazos las 3 pendientes (A001, A002, A003) siguen pendientes');
SELECT t.eq((SELECT id_indice FROM public.plantilla_facial WHERE id_plantilla = t.id_plantilla('A004')), t.id_indice('v001'), 'A004 sigue en v001');
SELECT t.throws($q$ DO $x$ BEGIN
        UPDATE public.parametro_sistema SET valor = '256' WHERE clave = 'dimension_vector';
        PERFORM public.svc_indice_activar(t.id_indice('v003'), t.mapa(public.svc_indice_plan()));
    END $x$ $q$, 'P0001:INDICE_DIMENSION_INVALIDA', 'activar con dimension distinta a dimension_vector');

-- ===================== svc_indice_activar: flujo valido =====================
SELECT t.as_postgres();
SELECT set_config('t.map3', t.mapa(public.svc_indice_plan())::text, true);
SELECT t.as_service();
SELECT t.eq((public.svc_indice_activar(t.id_indice('v003'), current_setting('t.map3')::jsonb) ->> 'plantillas_asignadas')::int, 4, 'activar: 4 plantillas asignadas');
SELECT t.eq(t.en_uso(), 'v003', 'activar: solo v003 en uso');
SELECT t.eq((SELECT count(*)::int FROM public.indice_faiss WHERE en_uso), 1, 'activar: exactamente un indice en uso');
SELECT t.eq((SELECT faiss_id::int FROM public.plantilla_facial WHERE id_plantilla = t.id_plantilla('A002')), 2, 'A002 recibio faiss_id 2');
SELECT t.eq((SELECT id_indice FROM public.plantilla_facial WHERE id_plantilla = t.id_plantilla('A002')), t.id_indice('v003'), 'A002 apunta a v003');
SELECT t.eq((SELECT faiss_id::int FROM public.plantilla_facial WHERE id_plantilla = t.id_plantilla('A004')), 1, 'A004 conserva su faiss_id');
SELECT t.eq((SELECT id_indice FROM public.plantilla_facial WHERE id_plantilla = t.id_plantilla('A004')), t.id_indice('v003'), 'A004 ahora en v003');
SELECT t.eq((SELECT faiss_id::int FROM public.plantilla_facial WHERE NOT activa AND id_alumno = t.id_alumno('A001')), 0, 'la archivada conserva su par (v001, 0)');
SELECT t.ok(NOT (SELECT en_uso FROM public.indice_faiss WHERE version = 'v001'), 'v001 ya no esta en uso');
SELECT t.eq(public.svc_indice_en_uso() ->> 'version', 'v003', 'svc_indice_en_uso');
SELECT t.eq((public.svc_indice_en_uso() ->> 'total_vectores')::int, 4, 'svc_indice_en_uso: total');
SELECT t.eq(public.svc_indice_en_uso() ->> 'objeto_indice', 'indice/v003.json', 'svc_indice_en_uso: objeto');
SELECT t.ok((public.svc_indice_activar(t.id_indice('v003'), '[]') ->> 'ya_activo')::boolean, 'reintento: ya_activo sin tocar nada (aun con mapeo vacio)');
SELECT t.ok((public.svc_indice_plan() ->> 'nada_que_hacer')::boolean, 'tras activar el plan no tiene nada que hacer');
SELECT t.eq((public.svc_indice_plan() #>> '{totales,obsoletas}')::int, 0, 'obsoletas 0: la archivada ya no esta en la version en uso');
SELECT t.as_user('tecnico@susan.test');
SELECT t.ok(NOT (public.api_indice_estado() ->> 'requiere_reconstruccion')::boolean, 'api_indice_estado: no requiere reconstruccion');
SELECT t.as_service();

-- Un alta posterior al plan queda pendiente y no invalida la activacion (plan con 3 de 4)
SELECT t.as_user('admin@susan.test');
SELECT public.api_plantilla_registrar(t.id_alumno('A003'), t.id_consent('A003'), t.ruta('registro', 'A003', 2, 'jpg'));
SELECT t.as_service();
SELECT t.eq((public.svc_indice_plan() #>> '{totales,nuevas}')::int, 1, 'plan: 1 nueva (A003 reemplazada)');
SELECT t.eq((public.svc_indice_plan() #>> '{totales,obsoletas}')::int, 1, 'plan: 1 obsoleta (A003 anterior)');
SELECT t.as_postgres();
SELECT set_config('t.map4', t.mapa(public.svc_indice_plan())::text, true);
SELECT t.as_service();
SELECT public.svc_indice_registrar('v005', 512, 'indice/v005.json', 4);
SELECT t.as_user('admin@susan.test');
SELECT public.api_plantilla_registrar(t.id_alumno('A002'), t.id_consent('A002'), t.ruta('registro', 'A002', 3, 'jpg'));   -- llega despues del plan
SELECT t.as_service();
SELECT t.throws($q$ SELECT public.svc_indice_activar(t.id_indice('v005'), current_setting('t.map4')::jsonb) $q$, 'P0001:INDICE_PLAN_OBSOLETO',
    'A002 se reemplazo despues del plan: el mapeo trae una archivada => plan obsoleto');
SELECT t.eq(t.en_uso(), 'v003', 'tras el plan obsoleto v003 sigue en uso');
-- nuevo plan y activacion correcta (v006), con una alta posterior que queda pendiente
SELECT t.as_postgres();
SELECT set_config('t.map6', t.mapa(public.svc_indice_plan())::text, true);
SELECT t.as_service();
SELECT public.svc_indice_registrar('v006', 512, 'indice/v006.json', 4);
SELECT t.as_user('admin@susan.test');
SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), t.ruta('registro', 'A004', 4, 'jpg'));
SELECT t.as_service();
SELECT t.throws($q$ SELECT public.svc_indice_activar(t.id_indice('v006'), current_setting('t.map6')::jsonb) $q$, 'P0001:INDICE_PLAN_OBSOLETO',
    'A004 (indexada) se archivo despues del plan: obsoleto');
SELECT t.as_postgres();
SELECT set_config('t.map7', t.mapa(public.svc_indice_plan())::text, true);
SELECT t.as_service();
SELECT public.svc_indice_registrar('v007', 512, 'indice/v007.json', 4);
SELECT t.eq((public.svc_indice_activar(t.id_indice('v007'), current_setting('t.map7')::jsonb) ->> 'plantillas_asignadas')::int, 4, 'v007: activada con su plan vigente');
SELECT t.eq((public.svc_indice_en_uso() ->> 'version'), 'v007', 'v007 en uso');
SELECT t.eq((public.svc_indice_activar(t.id_indice('v007'), current_setting('t.map7')::jsonb) ->> 'ya_activo')::boolean::text, 'true', 'reintento idempotente');
SELECT t.eq((SELECT count(*)::int FROM public.indice_faiss WHERE en_uso), 1, 'siempre un solo indice en uso');

-- ===================== svc_indice_revertir =====================
SELECT t.eq((public.svc_indice_registrar('v008', 512, 'indice/v008.json', 3) ->> 'ya_registrada')::boolean::text, 'false', 'registrar v008 (sera reversion parcial)');
SELECT t.throws($q$ SELECT public.svc_indice_revertir(999999, '[]') $q$, 'P0001:NO_ENCONTRADO', 'revertir: version inexistente');
SELECT t.throws($q$ SELECT public.svc_indice_revertir(t.id_indice('v008'), '{"x":1}') $q$, 'P0001:INDICE_MAPEO_INVALIDO', 'revertir: mapeo invalido');
SELECT t.throws($q$ SELECT public.svc_indice_revertir(t.id_indice('v008'), '[{"id_plantilla":1,"faiss_id":1},{"id_plantilla":2,"faiss_id":1}]') $q$, 'P0001:INDICE_MAPEO_INVALIDO', 'revertir: faiss_id repetido');
SELECT t.throws($q$ DO $x$ BEGIN
        UPDATE public.parametro_sistema SET valor = '256' WHERE clave = 'dimension_vector';
        PERFORM public.svc_indice_revertir(t.id_indice('v003'), current_setting('t.map3')::jsonb);
    END $x$ $q$, 'P0001:INDICE_NO_REVERTIBLE', 'revertir con dimension distinta');
SELECT t.eq(t.en_uso(), 'v007', 'los rechazos no cambian la version en uso');
-- revertir a v003 con su mapeo original: A003 (reemplazada) y A002/A004 nuevas quedan segun el mapeo
SELECT t.eq((public.svc_indice_revertir(t.id_indice('v003'), current_setting('t.map3')::jsonb) ->> 'ya_activo')::boolean::text, 'false', 'revertir a v003');
SELECT t.eq(t.en_uso(), 'v003', 'revertir: v003 en uso');
SELECT t.eq((SELECT count(*)::int FROM public.indice_faiss WHERE en_uso), 1, 'revertir: un solo indice en uso');
SELECT t.eq((SELECT count(*)::int FROM public.plantilla_facial WHERE activa AND id_indice = t.id_indice('v003')), 1,
    'revertir: solo A001 (activa tambien en v003) vuelve a v003');
SELECT t.eq((SELECT count(*)::int FROM public.plantilla_facial WHERE activa AND id_indice IS NULL AND faiss_id IS NULL), 3,
    'revertir: A002, A003 y A004 (reemplazadas despues de v003) quedan pendientes');
SELECT t.eq((SELECT faiss_id::int FROM public.plantilla_facial WHERE activa AND id_alumno = t.id_alumno('A001')), 4, 'revertir: A001 recupera su faiss_id de v003');
SELECT t.ok((public.svc_indice_revertir(t.id_indice('v003'), '[]') ->> 'ya_activo')::boolean, 'revertir al que ya esta en uso: ya_activo');
-- volver a v007 con su mapeo (version usada antes)
SELECT t.eq((public.svc_indice_activar(t.id_indice('v007'), current_setting('t.map7')::jsonb) ->> 'plantillas_asignadas')::int, 4, 'volver a activar v007 con su mapeo');
SELECT t.eq(t.en_uso(), 'v007', 'v007 de nuevo en uso');

-- orden: encender sin apagar la anterior viola ux_indice_faiss_en_uso (por eso el orden FALSE-TRUE)
SELECT t.as_postgres();
SELECT t.throws($q$ UPDATE public.indice_faiss SET en_uso = true WHERE version = 'v003' $q$, '23505:ux_indice_faiss_en_uso', 'dos indices en uso: rechazado por el indice unico');

-- ===================== Permisos =====================
SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ SELECT public.svc_indice_plan() $q$, '42501', 'administrador no ejecuta svc_indice_plan');
SELECT t.throws($q$ SELECT public.svc_indice_registrar('v100', 512, 'indice/v100.json', 1) $q$, '42501', 'administrador no registra indices');
SELECT t.throws($q$ SELECT public.svc_indice_activar(1, '[]') $q$, '42501', 'administrador no activa');
SELECT t.throws($q$ SELECT public.svc_indice_revertir(1, '[]') $q$, '42501', 'administrador no revierte');
SELECT t.throws($q$ SELECT public.svc_indice_en_uso() $q$, '42501', 'administrador no ejecuta svc_indice_en_uso');
SELECT t.throws($q$ SELECT public.svc_bloqueo_adquirir('indice', 'x') $q$, '42501', 'administrador no adquiere bloqueos');
SELECT t.as_user('tecnico@susan.test');
SELECT t.throws($q$ SELECT public.svc_indice_activar(1, '[]') $q$, '42501', 'tecnico no activa (solo el servidor)');
SELECT t.throws($q$ SELECT public.svc_indice_revertir(1, '[]') $q$, '42501', 'tecnico no revierte directamente');
SELECT t.throws($q$ SELECT public.svc_bloqueo_liberar('indice', 'x') $q$, '42501', 'tecnico no libera bloqueos');
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT public.svc_indice_plan() $q$, '42501', 'docente no ejecuta svc_indice_plan');
SELECT t.throws($q$ SELECT public.svc_indice_activar(1, '[]') $q$, '42501', 'docente no activa');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ SELECT public.svc_indice_en_uso() $q$, '42501', 'alumno no ejecuta svc_indice_en_uso');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.svc_indice_plan() $q$, '42501', 'anon no ejecuta svc_indice_plan');
SELECT t.throws($q$ SELECT public.svc_indice_activar(1, '[]') $q$, '42501', 'anon no activa');
SELECT t.throws($q$ SELECT public.svc_bloqueo_adquirir('indice', 'x') $q$, '42501', 'anon no adquiere bloqueos');
SELECT t.throws($q$ SELECT app.bloqueo_adquirir('indice', 'x') $q$, '42501', 'anon no ejecuta app.bloqueo_adquirir');
SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ SELECT app.bloqueo_adquirir('indice', 'x') $q$, '42501', 'authenticated no ejecuta app.bloqueo_adquirir');
SELECT t.throws($q$ SELECT * FROM app.bloqueo $q$, '42501', 'authenticated no lee app.bloqueo');

-- ===================== Bloqueos con arrendamiento =====================
SELECT t.as_service();
SELECT t.ok(public.svc_bloqueo_adquirir('indice', 'proc-A', 60), 'adquirir libre');
SELECT t.ok(public.svc_bloqueo_adquirir('indice', 'proc-A', 60), 'el mismo dueno lo renueva');
SELECT t.ok(NOT public.svc_bloqueo_adquirir('indice', 'proc-B', 60), 'otro dueno no lo obtiene mientras esta vigente');
SELECT t.ok(NOT public.svc_bloqueo_liberar('indice', 'proc-B'), 'liberar con otro dueno: false');
SELECT t.ok(NOT public.svc_bloqueo_adquirir('indice', 'proc-B', 60), 'y sigue ocupado');
SELECT t.ok(public.svc_bloqueo_adquirir('job:recalcular', 'proc-B', 60), 'claves distintas son independientes');
SELECT t.ok(public.svc_bloqueo_liberar('indice', 'proc-A'), 'liberar con su dueno: true');
SELECT t.ok(NOT public.svc_bloqueo_liberar('indice', 'proc-A'), 'liberar dos veces: false');
SELECT t.ok(public.svc_bloqueo_adquirir('indice', 'proc-B', 60), 'liberado: otro lo obtiene');
-- vencimiento: ttl 10 s; a +9 s sigue ocupado, a +10 s caduco (vence <= ahora)
SELECT t.ok(public.svc_bloqueo_adquirir('job:purgar-recortes', 'proc-A', 10), 'ttl minimo 10 s');
SELECT t.reloj('2026-09-14 07:12:09-06');
SELECT t.ok(NOT public.svc_bloqueo_adquirir('job:purgar-recortes', 'proc-B', 10), 'a +9 s sigue vigente');
SELECT t.reloj('2026-09-14 07:12:10-06');
SELECT t.ok(public.svc_bloqueo_adquirir('job:purgar-recortes', 'proc-B', 10), 'a +10 s caduco: otro lo toma');
SELECT t.reloj('2026-09-14 07:12:00-06');
SELECT t.throws($q$ SELECT public.svc_bloqueo_adquirir('indice', 'x', 9) $q$, 'P0001:VALIDACION', 'ttl 9 invalido');
SELECT t.throws($q$ SELECT public.svc_bloqueo_adquirir('indice', 'x', 7201) $q$, 'P0001:VALIDACION', 'ttl 7201 invalido');
SELECT t.lives_rb($q$ SELECT public.svc_bloqueo_adquirir('indice-ttl-max', 'x', 7200) $q$, 'ttl 7200 valido');
SELECT t.throws($q$ SELECT public.svc_bloqueo_adquirir('', 'x') $q$, 'P0001:VALIDACION', 'clave vacia');
SELECT t.throws($q$ SELECT public.svc_bloqueo_adquirir('indice', '') $q$, 'P0001:VALIDACION', 'dueno vacio');
SELECT t.throws($q$ SELECT public.svc_bloqueo_adquirir(NULL, 'x') $q$, 'P0001:VALIDACION', 'clave nula');
SELECT t.summary();
ROLLBACK;
