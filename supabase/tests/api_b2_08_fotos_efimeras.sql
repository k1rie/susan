-- api_b2_08 · fotos de registro efimeras (migracion 0237, extension 18): objeto_foto admite NULL, purga en dos pasos
-- (svc_fotos_registro_listar / svc_fotos_registro_marcar), nunca se purga lo que aun no esta en un indice, y las lecturas
-- (api_documento_url_autorizar, api_plantilla_alumno) dicen que la foto ya no se conserva en vez de firmar una ruta rota.
BEGIN;
SELECT t.begin('api_b2_08_fotos_efimeras');
SELECT t.cargar_fixtures();
CREATE FUNCTION t.ruta(p_prefijo text, p_matricula text, p_n integer, p_ext text) RETURNS text LANGUAGE sql STABLE
AS $$ SELECT p_prefijo || '/' || t.id_alumno(p_matricula) || '/00000000-0000-4000-8000-' || lpad(p_n::text, 12, '0') || '.' || p_ext $$;
CREATE FUNCTION t.fotos(p_matricula text, p_base integer, p_n integer) RETURNS jsonb LANGUAGE sql STABLE
AS $$ SELECT jsonb_agg(jsonb_build_object('objeto_foto', t.ruta('registro', p_matricula, p_base + i, 'jpg')) ORDER BY i)
        FROM generate_series(1, p_n) i $$;
-- ids de plantilla que lista la purga, en orden
CREATE FUNCTION t.listadas(p_ids integer[] DEFAULT NULL) RETURNS text LANGUAGE sql STABLE
AS $$ SELECT coalesce(string_agg(i ->> 'id_plantilla', ',' ORDER BY (i ->> 'id_plantilla')::int), '')
        FROM jsonb_array_elements(public.svc_fotos_registro_listar(p_ids) -> 'items') i $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t TO PUBLIC;

-- ===================== estructura y permisos =====================
SELECT t.as_postgres();
SELECT t.ok((SELECT NOT attnotnull FROM pg_attribute WHERE attrelid = 'public.plantilla_facial'::regclass AND attname = 'objeto_foto'),
    'plantilla_facial.objeto_foto admite NULL (foto no conservada)');
SELECT t.ok((SELECT NOT attnotnull FROM pg_attribute WHERE attrelid = 'public.plantilla_foto'::regclass AND attname = 'objeto_foto'),
    'plantilla_foto.objeto_foto admite NULL (foto no conservada)');
SELECT t.eq((SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname LIKE 'api\_%'), 76::bigint,
    'el catalogo tiene 76 api_* (72 + las 4 api_mi_* del autoservicio, 0239)');
SELECT t.ok(has_function_privilege('service_role', 'public.svc_fotos_registro_listar(integer[], integer)', 'EXECUTE')
        AND has_function_privilege('service_role', 'public.svc_fotos_registro_marcar(integer[])', 'EXECUTE'),
    'service_role ejecuta listar y marcar');
SELECT t.ok(NOT has_function_privilege('authenticated', 'public.svc_fotos_registro_listar(integer[], integer)', 'EXECUTE')
        AND NOT has_function_privilege('authenticated', 'public.svc_fotos_registro_marcar(integer[])', 'EXECUTE'),
    'authenticated no ejecuta la purga');
SELECT t.ok(NOT has_function_privilege('anon', 'public.svc_fotos_registro_listar(integer[], integer)', 'EXECUTE')
        AND NOT has_function_privilege('anon', 'public.svc_fotos_registro_marcar(integer[])', 'EXECUTE'),
    'anon no ejecuta la purga');

-- ===================== A002: plantilla de 3 fotos recien registrada (sin indexar) =====================
SELECT t.as_user('admin@susan.test');
SELECT public.api_plantilla_registrar(t.id_alumno('A002'), t.id_consent('A002'), t.ruta('registro', 'A002', 11, 'jpg'),
    '10.1.2.3'::inet, t.fotos('A002', 10, 3));
SELECT t.as_postgres();
SELECT t.eq((SELECT count(*)::int FROM public.plantilla_foto WHERE id_plantilla = t.id_plantilla('A002') AND objeto_foto IS NOT NULL), 3,
    'A002 nace con sus 3 fotos');

-- ===================== listar =====================
SELECT t.as_service();
SELECT t.eq(t.listadas(), t.id_plantilla('A001')::text || ',' || t.id_plantilla('A004')::text,
    'solo son purgables las plantillas ya indexadas (A001 y A004); la activa sin indexar (A002) NO aparece');
SELECT t.eq((public.svc_fotos_registro_listar() ->> 'pendientes_total')::int, 2, 'pendientes_total cuenta plantillas purgables');
SELECT t.eq(t.listadas(ARRAY[t.id_plantilla('A002')]), '', 'pedir A002 por id tampoco la lista: aun no esta en un indice');
SELECT t.eq(t.listadas(ARRAY[t.id_plantilla('A001')]), t.id_plantilla('A001')::text, 'p_ids restringe a las plantillas pedidas');
SELECT t.eq((public.svc_fotos_registro_listar(NULL, 1) -> 'items') #>> '{0,id_plantilla}', t.id_plantilla('A001')::text, 'p_limit 1 devuelve la primera plantilla');
SELECT t.eq(jsonb_array_length(public.svc_fotos_registro_listar(NULL, 1) -> 'items'), 1, 'p_limit limita plantillas');
SELECT t.eq((public.svc_fotos_registro_listar(NULL, 1) ->> 'pendientes_total')::int, 2, 'pendientes_total ignora el limite');
SELECT t.eq((public.svc_fotos_registro_listar(ARRAY[t.id_plantilla('A001')]) #>> '{items,0,objetos,0}'),
    'registro/' || t.id_alumno('A001') || '/fixture.jpg', 'la entrada trae la ruta del objeto a borrar');
SELECT t.throws($q$ SELECT public.svc_fotos_registro_listar((SELECT array_agg(g) FROM generate_series(1, 5001) g)) $q$,
    'P0001:VALIDACION', 'mas de 5000 plantillas por llamada: VALIDACION');

-- ===================== marcar =====================
SELECT t.throws($q$ SELECT public.svc_fotos_registro_marcar(NULL) $q$, 'P0001:VALIDACION', 'p_ids nulo: VALIDACION');
SELECT t.throws($q$ SELECT public.svc_fotos_registro_marcar((SELECT array_agg(g) FROM generate_series(1, 5001) g)) $q$,
    'P0001:VALIDACION', 'mas de 5000 plantillas por llamada: VALIDACION');
-- A002 no esta indexada: marcarla no hace nada (la unica copia de su vector es la foto)
SELECT t.eq((public.svc_fotos_registro_marcar(ARRAY[t.id_plantilla('A002')]) ->> 'marcadas')::int, 0, 'marcar una plantilla sin indexar no marca nada');
SELECT t.as_postgres();
SELECT t.eq((SELECT count(*)::int FROM public.plantilla_foto WHERE id_plantilla = t.id_plantilla('A002') AND objeto_foto IS NOT NULL), 3,
    'A002 conserva sus 3 fotos y la principal');
SELECT t.ok((SELECT objeto_foto IS NOT NULL FROM public.plantilla_facial WHERE id_plantilla = t.id_plantilla('A002')), 'A002 conserva plantilla_facial.objeto_foto');

-- A001: purga real
SELECT t.as_service();
SELECT t.eq(public.svc_fotos_registro_marcar(ARRAY[t.id_plantilla('A001')]), '{"solicitadas":1,"marcadas":1}'::jsonb, 'marcar A001: 1 de 1');
SELECT t.as_postgres();
SELECT t.ok((SELECT objeto_foto IS NULL FROM public.plantilla_facial WHERE id_plantilla = t.id_plantilla('A001')), 'A001: plantilla_facial.objeto_foto = NULL');
SELECT t.ok((SELECT bool_and(objeto_foto IS NULL) AND count(*) >= 1 FROM public.plantilla_foto WHERE id_plantilla = t.id_plantilla('A001')),
    'A001: todas sus plantilla_foto = NULL (la fila orden 1 la sincroniza el trigger)');
SELECT t.ok((SELECT id_indice IS NOT NULL AND faiss_id IS NOT NULL AND activa FROM public.plantilla_facial WHERE id_plantilla = t.id_plantilla('A001')),
    'A001 sigue activa e indexada: la purga solo toca la ruta de la foto');
SELECT t.as_service();
SELECT t.eq(public.svc_fotos_registro_marcar(ARRAY[t.id_plantilla('A001')]), '{"solicitadas":1,"marcadas":0}'::jsonb, 'marcar de nuevo es idempotente (0 marcadas)');
SELECT t.eq(t.listadas(), t.id_plantilla('A004')::text, 'A001 ya no aparece en el listado; queda A004');

-- ===================== archivadas: nunca volveran al indice =====================
SELECT t.as_postgres();
SELECT set_config('t.pl4', t.id_plantilla('A004')::text, true);
SELECT t.as_user('admin@susan.test');
SELECT public.api_consentimiento_revocar(t.id_consent('A004'));
SELECT t.as_service();
SELECT t.ok(NOT (SELECT activa FROM public.plantilla_facial WHERE id_plantilla = current_setting('t.pl4')::int), 'A004 archivada por la revocacion');
SELECT t.eq(t.listadas(), current_setting('t.pl4'), 'una plantilla archivada sigue siendo purgable');
SELECT t.eq((public.svc_fotos_registro_marcar(ARRAY[current_setting('t.pl4')::int]) ->> 'marcadas')::int, 1, 'se purga la foto de la plantilla archivada');
SELECT t.eq(t.listadas(), '', 'no queda nada purgable (A002 sigue sin indexar)');

-- ===================== reversion entre listar y marcar: la ruta se conserva =====================
-- Una plantilla que dejo de estar indexada despues de listarla no se marca: su foto sigue siendo la unica copia.
SELECT t.as_postgres();
UPDATE public.plantilla_facial SET id_indice = NULL, faiss_id = NULL WHERE id_plantilla = t.id_plantilla('A002');
SELECT t.as_service();
SELECT t.eq((public.svc_fotos_registro_marcar(ARRAY[t.id_plantilla('A002')]) ->> 'marcadas')::int, 0, 'sin indexar: marcar no anula la ruta');

-- ===================== lecturas del administrador =====================
SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ SELECT public.api_documento_url_autorizar('plantilla', t.id_plantilla('A001')) $q$,
    'P0001:FOTO_NO_CONSERVADA', 'documento tipo plantilla de una foto purgada: FOTO_NO_CONSERVADA');
SELECT t.throws($q$ SELECT public.api_documento_url_autorizar('plantilla_foto', (SELECT id_foto FROM public.plantilla_foto WHERE id_plantilla = t.id_plantilla('A001') AND orden = 1)) $q$,
    'P0001:FOTO_NO_CONSERVADA', 'documento tipo plantilla_foto de una foto purgada: FOTO_NO_CONSERVADA');
SELECT t.as_postgres();
SELECT t.eq((SELECT count(*)::int FROM public.bitacora_auditoria WHERE entidad = 'plantilla_facial' AND id_registro = t.id_plantilla('A001') AND accion = 'consulta'), 0,
    'pedir una foto purgada no asienta consulta en bitacora');
SELECT t.as_user('admin@susan.test');
SELECT t.eq(public.api_documento_url_autorizar('plantilla', t.id_plantilla('A002')) ->> 'objeto', t.ruta('registro', 'A002', 11, 'jpg'),
    'una foto que aun existe se firma como siempre');
SELECT t.eq(public.api_documento_url_autorizar('plantilla_foto',
        (SELECT id_foto FROM public.plantilla_foto WHERE id_plantilla = t.id_plantilla('A002') AND orden = 2)) ->> 'orden', '2',
    'una foto de la plantilla que aun existe tambien');
SELECT t.ok(NOT (public.api_plantilla_alumno(t.id_alumno('A001')) #>> '{activa,foto_disponible}')::boolean,
    'api_plantilla_alumno: A001 foto_disponible = false');
SELECT t.ok((SELECT bool_and(NOT (f ->> 'disponible')::boolean) FROM jsonb_array_elements(public.api_plantilla_alumno(t.id_alumno('A001')) #> '{activa,fotos}') f),
    'api_plantilla_alumno: ninguna foto de A001 esta disponible');
SELECT t.ok((public.api_plantilla_alumno(t.id_alumno('A002')) #>> '{activa,foto_disponible}')::boolean,
    'api_plantilla_alumno: A002 foto_disponible = true');
SELECT t.eq((SELECT count(*)::int FROM jsonb_array_elements(public.api_plantilla_alumno(t.id_alumno('A002')) #> '{activa,fotos}') f WHERE (f ->> 'disponible')::boolean), 3,
    'api_plantilla_alumno: las 3 fotos de A002 estan disponibles');
SELECT t.ok(public.api_plantilla_alumno(t.id_alumno('A001')) #>> '{activa,faiss_id}' IS NOT NULL
        AND (public.api_plantilla_alumno(t.id_alumno('A001')) #>> '{activa,indexada}')::boolean,
    'api_plantilla_alumno: el vector de A001 sigue referenciado tras purgar la foto');
SELECT t.ok(public.api_plantilla_alumno(t.id_alumno('A001'))::text !~ 'registro/', 'api_plantilla_alumno nunca emite rutas del bucket');

-- ===================== la revision del docente tolera la ausencia de foto de registro =====================
SELECT t.as_postgres();
SELECT set_config('t.as1', (SELECT id_asistencia::text FROM public.asistencia
                              WHERE id_sesion = t.id_sesion('3A', '2026-09-14') AND id_alumno = t.id_alumno('A001')), true);
SELECT t.as_user('docente1@susan.test');
SELECT t.ok((public.api_detecciones_caso(current_setting('t.as1')::int) -> 'objeto_foto_registro') = 'null'::jsonb,
    'api_detecciones_caso: sin foto de registro devuelve objeto_foto_registro = null (no falla)');

-- ===================== nadie mas ejecuta la purga =====================
SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ SELECT public.svc_fotos_registro_listar() $q$, '42501', 'el administrador no ejecuta svc_fotos_registro_listar');
SELECT t.throws($q$ SELECT public.svc_fotos_registro_marcar(ARRAY[1]) $q$, '42501', 'el administrador no ejecuta svc_fotos_registro_marcar');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.svc_fotos_registro_listar() $q$, '42501', 'anon no ejecuta svc_fotos_registro_listar');

SELECT t.summary();
ROLLBACK;
