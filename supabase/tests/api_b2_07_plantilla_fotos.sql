-- api_b2_07 · plantilla de varias fotos (migracion 0235): tabla plantilla_foto, trigger de la foto principal,
-- api_plantilla_registrar con p_fotos, api_plantilla_alumno (fotos), api_documento_url_autorizar('plantilla_foto'),
-- svc_indice_plan (objetos_foto), archivado/revocacion de las fotos junto con su plantilla, RLS y permisos.
BEGIN;
SELECT t.begin('api_b2_07_plantilla_fotos');
SELECT t.cargar_fixtures();
CREATE FUNCTION t.ruta(p_prefijo text, p_matricula text, p_n integer, p_ext text) RETURNS text LANGUAGE sql STABLE
AS $$ SELECT p_prefijo || '/' || t.id_alumno(p_matricula) || '/00000000-0000-4000-8000-' || lpad(p_n::text, 12, '0') || '.' || p_ext $$;
-- p_n fotos de p_matricula con rutas p_base+1 .. p_base+p_n, calidad completa y coseno_resto 0.81, 0.82, ...
CREATE FUNCTION t.fotos(p_matricula text, p_base integer, p_n integer) RETURNS jsonb LANGUAGE sql STABLE
AS $$ SELECT jsonb_agg(jsonb_build_object(
              'objeto_foto', t.ruta('registro', p_matricula, p_base + i, 'jpg'),
              'calidad', jsonb_build_object('brillo', 120.5, 'nitidez', 88.2, 'tamano_rostro_px', 210, 'frontal', true),
              'coseno_resto', round(0.8 + i * 0.01, 3)) ORDER BY i)
        FROM generate_series(1, p_n) i $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t TO PUBLIC;

-- ===================== estructura, validador y trigger (como propietario) =====================
SELECT t.as_postgres();
SELECT t.eq((SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'api_plantilla_registrar'), 1::bigint,
    'una sola api_plantilla_registrar (sin overload ambiguo)');
SELECT t.eq((SELECT pronargs::int FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'api_plantilla_registrar'), 5,
    'api_plantilla_registrar tiene 5 parametros (p_fotos es el ultimo)');
SELECT t.eq((SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname LIKE 'api\_%'), 72::bigint,
    'el catalogo sigue en 72 api_* (ninguna RPC nueva)');
SELECT t.ok(EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_plantilla_foto_principal' AND NOT tgisinternal), 'existe el trigger de la foto principal');
SELECT t.ok(NOT has_function_privilege('authenticated', 'app.trg_plantilla_foto_principal()', 'EXECUTE'), 'authenticated no ejecuta la funcion del trigger');
SELECT t.ok(NOT has_function_privilege('anon', 'app.calidad_foto_valida(jsonb)', 'EXECUTE'), 'anon no ejecuta el validador');
SELECT t.eq((SELECT count(*) FROM pg_attribute a WHERE a.attrelid = 'public.plantilla_foto'::regclass AND a.attnum > 0 AND NOT a.attisdropped
              AND (a.atttypid = 'bytea'::regtype OR a.atttypid IN (SELECT oid FROM pg_type WHERE typcategory = 'A'))), 0::bigint,
    'RNF-03: plantilla_foto sin columnas binarias ni de arreglo');
-- Validador de calidad (lista blanca)
SELECT t.ok(app.calidad_foto_valida(NULL), 'calidad NULL es valida');
SELECT t.ok(app.calidad_foto_valida('{}'::jsonb), 'calidad {} es valida');
SELECT t.ok(app.calidad_foto_valida('{"brillo":0,"nitidez":1000000,"tamano_rostro_px":100000,"frontal":false}'::jsonb), 'limites inclusivos validos');
SELECT t.ok(NOT app.calidad_foto_valida('null'::jsonb), 'JSON null no es un objeto');
SELECT t.ok(NOT app.calidad_foto_valida('[1,2]'::jsonb), 'arreglo no es valido');
SELECT t.ok(NOT app.calidad_foto_valida('{"vector":[1]}'::jsonb), 'clave ajena no es valida');
SELECT t.ok(NOT app.calidad_foto_valida('{"brillo":256}'::jsonb), 'brillo 256 fuera de rango');
SELECT t.ok(NOT app.calidad_foto_valida('{"brillo":-1}'::jsonb), 'brillo negativo');
SELECT t.ok(NOT app.calidad_foto_valida('{"brillo":"120"}'::jsonb), 'brillo como texto');
SELECT t.ok(NOT app.calidad_foto_valida('{"nitidez":1000001}'::jsonb), 'nitidez fuera de rango');
SELECT t.ok(NOT app.calidad_foto_valida('{"tamano_rostro_px":10.5}'::jsonb), 'tamano_rostro_px no entero');
SELECT t.ok(NOT app.calidad_foto_valida('{"tamano_rostro_px":100001}'::jsonb), 'tamano_rostro_px fuera de rango');
SELECT t.ok(NOT app.calidad_foto_valida('{"frontal":"true"}'::jsonb), 'frontal como texto');
SELECT t.ok(NOT app.calidad_foto_valida('{"frontal":null}'::jsonb), 'frontal null');

-- Trigger: una plantilla insertada directamente (fixtures, semilla, SQL) tiene su fila orden = 1.
SELECT t.eq((SELECT count(*) FROM public.plantilla_foto), 2::bigint, 'los fixtures (2 plantillas) crean 2 filas orden 1 por el trigger');
SELECT t.ok((SELECT count(*) = 2 AND bool_and(pf.orden = 1 AND pf.objeto_foto = p.objeto_foto AND pf.calidad IS NULL AND pf.coseno_resto IS NULL)
               FROM public.plantilla_foto pf JOIN public.plantilla_facial p USING (id_plantilla)),
    'la fila orden 1 repite objeto_foto y no trae calidad ni coseno');
SELECT t.efecto($q$ INSERT INTO public.plantilla_facial (id_alumno, id_consent, objeto_foto)
                    VALUES (t.id_alumno('A003'), t.id_consent('A003'), 'registro/x/directa.jpg') $q$,
    $q$ SELECT (SELECT count(*) FROM public.plantilla_foto pf JOIN public.plantilla_facial p USING (id_plantilla)
                 WHERE p.id_alumno = t.id_alumno('A003') AND pf.orden = 1 AND pf.objeto_foto = 'registro/x/directa.jpg') = 1 $q$,
    'INSERT directo en plantilla_facial crea la fila orden 1');
SELECT t.efecto($q$ UPDATE public.plantilla_facial SET objeto_foto = 'registro/x/nueva.jpg' WHERE id_plantilla = t.id_plantilla('A004') $q$,
    $q$ SELECT (SELECT objeto_foto FROM public.plantilla_foto WHERE id_plantilla = t.id_plantilla('A004') AND orden = 1) = 'registro/x/nueva.jpg' $q$,
    'UPDATE de objeto_foto sincroniza la fila orden 1');
SELECT t.efecto($q$ UPDATE public.plantilla_facial SET activa = false WHERE id_plantilla = t.id_plantilla('A004') $q$,
    $q$ SELECT (SELECT count(*) FROM public.plantilla_foto pf JOIN public.plantilla_facial p USING (id_plantilla)
                 WHERE p.id_alumno = t.id_alumno('A004') AND NOT p.activa) = 1 $q$,
    'archivar una plantilla no toca sus fotos');
-- Restricciones de la tabla
SELECT t.throws($q$ INSERT INTO public.plantilla_foto (id_plantilla, orden, objeto_foto) VALUES (t.id_plantilla('A004'), 1, 'registro/x/otra.jpg') $q$,
    '23505:uq_plantilla_foto_orden', 'unicidad (id_plantilla, orden)');
SELECT t.throws($q$ INSERT INTO public.plantilla_foto (id_plantilla, orden, objeto_foto) VALUES (t.id_plantilla('A004'), 9, 'registro/x/otra.jpg') $q$,
    '23514:ck_plantilla_foto_orden', 'orden 9 fuera de 1..8');
SELECT t.throws($q$ INSERT INTO public.plantilla_foto (id_plantilla, orden, objeto_foto) VALUES (t.id_plantilla('A004'), 0, 'registro/x/otra.jpg') $q$,
    '23514:ck_plantilla_foto_orden', 'orden 0 fuera de 1..8');
SELECT t.throws($q$ INSERT INTO public.plantilla_foto (id_plantilla, orden, objeto_foto, coseno_resto) VALUES (t.id_plantilla('A004'), 2, 'registro/x/otra.jpg', 1.5) $q$,
    '23514', 'coseno_resto fuera de -1..1 (numeric(4,3) lo acepta, el CHECK no)');
SELECT t.throws($q$ INSERT INTO public.plantilla_foto (id_plantilla, orden, objeto_foto, calidad) VALUES (t.id_plantilla('A004'), 2, 'registro/x/otra.jpg', '{"x":1}') $q$,
    '23514:ck_plantilla_foto_calidad', 'INSERT directo con calidad invalida: CHECK');
SELECT t.throws($q$ INSERT INTO public.plantilla_foto (id_plantilla, orden, objeto_foto) VALUES (999999, 2, 'registro/x/otra.jpg') $q$,
    '23503:fk_plantilla_foto_plantilla', 'FK a plantilla_facial');
SELECT t.throws($q$ DELETE FROM public.plantilla_facial WHERE id_plantilla = t.id_plantilla('A004') $q$,
    '23503:fk_plantilla_foto_plantilla', 'borrar una plantilla con fotos falla por RESTRICT');
-- Backfill idempotente
DO $$
DECLARE
    v_n integer;
BEGIN
    INSERT INTO public.plantilla_foto (id_plantilla, orden, objeto_foto)
    SELECT id_plantilla, 1, objeto_foto FROM public.plantilla_facial
    ON CONFLICT (id_plantilla, orden) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    PERFORM set_config('t.backfill', v_n::text, true);
END
$$;
SELECT t.eq(current_setting('t.backfill'), '0', 'el backfill repetido agrega 0 filas');
SELECT t.efecto($q$ DELETE FROM public.plantilla_foto WHERE id_plantilla = t.id_plantilla('A004');
                    INSERT INTO public.plantilla_foto (id_plantilla, orden, objeto_foto)
                    SELECT id_plantilla, 1, objeto_foto FROM public.plantilla_facial
                    ON CONFLICT (id_plantilla, orden) DO NOTHING $q$,
    $q$ SELECT (SELECT count(*) FROM public.plantilla_foto) = 2 $q$,
    'el backfill restituye la fila orden 1 que falte');

-- ===================== registro con 5 fotos =====================
SELECT t.as_user('admin@susan.test');
SELECT set_config('t.reg', public.api_plantilla_registrar(t.id_alumno('A002'), t.id_consent('A002'),
    t.ruta('registro', 'A002', 11, 'jpg'), '10.1.2.3'::inet, t.fotos('A002', 10, 5))::text, true);
SELECT t.eq((current_setting('t.reg')::jsonb ->> 'n_fotos')::int, 5, 'registro con 5 fotos: n_fotos 5');
SELECT t.ok(NOT (current_setting('t.reg')::jsonb ->> 'indexada')::boolean AND (current_setting('t.reg')::jsonb ->> 'requiere_reconstruccion')::boolean,
    'registro con 5 fotos: nace sin indexar y pide reconstruccion');
SELECT t.eq((SELECT count(*)::int FROM public.plantilla_facial WHERE id_alumno = t.id_alumno('A002') AND activa), 1, 'una sola plantilla activa (RN-12)');
SELECT t.eq((SELECT count(*)::int FROM public.plantilla_foto WHERE id_plantilla = t.id_plantilla('A002')), 5, '5 filas en plantilla_foto');
SELECT t.eq((SELECT string_agg(orden::text, ',' ORDER BY orden) FROM public.plantilla_foto WHERE id_plantilla = t.id_plantilla('A002')), '1,2,3,4,5', 'ordenes 1..5');
SELECT t.eq((SELECT string_agg(objeto_foto, ',' ORDER BY orden) FROM public.plantilla_foto WHERE id_plantilla = t.id_plantilla('A002')),
    (SELECT string_agg(e ->> 'objeto_foto', ',' ORDER BY n) FROM jsonb_array_elements(t.fotos('A002', 10, 5)) WITH ORDINALITY x(e, n)), 'las rutas conservan el orden de captura');
SELECT t.ok((SELECT pf.objeto_foto = p.objeto_foto FROM public.plantilla_foto pf JOIN public.plantilla_facial p USING (id_plantilla)
              WHERE p.id_alumno = t.id_alumno('A002') AND p.activa AND pf.orden = 1), 'la foto orden 1 es plantilla_facial.objeto_foto');
SELECT t.ok((SELECT bool_and(calidad = '{"brillo":120.5,"nitidez":88.2,"tamano_rostro_px":210,"frontal":true}'::jsonb) FROM public.plantilla_foto WHERE id_plantilla = t.id_plantilla('A002')),
    'calidad persistida en las 5 fotos (tambien la de orden 1)');
SELECT t.eq((SELECT string_agg(coseno_resto::text, ',' ORDER BY orden) FROM public.plantilla_foto WHERE id_plantilla = t.id_plantilla('A002')),
    '0.810,0.820,0.830,0.840,0.850', 'coseno_resto persistido con 3 decimales');
SELECT t.eq((SELECT valor_nuevo ->> 'n_fotos' FROM public.bitacora_auditoria WHERE accion = 'alta_plantilla' ORDER BY id_bitacora DESC LIMIT 1), '5', 'bitacora alta_plantilla con n_fotos');
SELECT t.eq((SELECT ip_origen FROM public.bitacora_auditoria WHERE accion = 'alta_plantilla' ORDER BY id_bitacora DESC LIMIT 1), '10.1.2.3', 'bitacora guarda la IP');
SELECT set_config('t.pl_a002_5', t.id_plantilla('A002')::text, true);

-- p_objeto_foto NULL con p_fotos (la principal sale de la primera); 3 y 8 fotos (limites); n_fotos
SELECT t.eq((public.api_plantilla_registrar(t.id_alumno('A003'), t.id_consent('A003'), NULL, NULL, t.fotos('A003', 30, 3)) ->> 'n_fotos')::int, 3,
    'p_objeto_foto NULL con p_fotos: acepta 3 fotos (minimo)');
SELECT t.eq((SELECT objeto_foto::text FROM public.plantilla_facial WHERE id_alumno = t.id_alumno('A003') AND activa), t.ruta('registro', 'A003', 31, 'jpg'),
    'la principal es la primera de la lista');
SELECT t.eq((public.api_plantilla_registrar(t.id_alumno('A003'), t.id_consent('A003'), t.ruta('registro', 'A003', 41, 'jpg'), NULL, t.fotos('A003', 40, 8)) ->> 'n_fotos')::int, 8,
    '8 fotos (maximo) con p_objeto_foto igual a la primera');
SELECT t.eq((SELECT count(*)::int FROM public.plantilla_foto WHERE id_plantilla = t.id_plantilla('A003')), 8, 'A003: 8 filas');
SELECT t.eq((SELECT count(*)::int FROM public.plantilla_foto pf JOIN public.plantilla_facial p USING (id_plantilla) WHERE p.id_alumno = t.id_alumno('A003') AND NOT p.activa), 3,
    'A003: la plantilla de 3 fotos archivada conserva sus 3 filas');

-- ===================== compatibilidad con la firma anterior =====================
SELECT t.eq((public.api_plantilla_registrar(t.id_alumno('A001'), t.id_consent('A001'), t.ruta('registro', 'A001', 2, 'jpg')) ->> 'n_fotos')::int, 1,
    'llamada posicional de 3 argumentos: n_fotos 1');
SELECT t.eq((SELECT count(*)::int FROM public.plantilla_foto WHERE id_plantilla = t.id_plantilla('A001')), 1, '3 argumentos: 1 fila (trigger)');
SELECT t.ok((SELECT calidad IS NULL AND coseno_resto IS NULL FROM public.plantilla_foto WHERE id_plantilla = t.id_plantilla('A001')), 'una foto: sin calidad ni coseno');
SELECT t.eq((public.api_plantilla_registrar(t.id_alumno('A001'), t.id_consent('A001'), t.ruta('registro', 'A001', 3, 'jpg'), '10.2.3.4'::inet) ->> 'n_fotos')::int, 1,
    'llamada posicional de 4 argumentos: n_fotos 1');
SELECT t.eq((public.api_plantilla_registrar(p_id_alumno => t.id_alumno('A001'), p_id_consent => t.id_consent('A001'),
    p_objeto_foto => t.ruta('registro', 'A001', 4, 'jpg'), p_ip => '10.2.3.5'::inet) ->> 'n_fotos')::int, 1,
    'llamada por nombre con los 4 argumentos de siempre: n_fotos 1');
SELECT t.eq((SELECT count(*)::int FROM public.plantilla_foto pf JOIN public.plantilla_facial p USING (id_plantilla) WHERE p.id_alumno = t.id_alumno('A001')), 4,
    'A001: cada plantilla (1 activa + 3 archivadas) tiene su fila orden 1');
SELECT t.eq((SELECT valor_nuevo ->> 'n_fotos' FROM public.bitacora_auditoria WHERE accion = 'alta_plantilla' ORDER BY id_bitacora DESC LIMIT 1), '1', 'bitacora n_fotos 1 sin p_fotos');
SELECT t.efecto($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), t.ruta('registro', 'A004', 7, 'jpg'), NULL, 'null'::jsonb) $q$,
    $q$ SELECT (SELECT count(*) FROM public.plantilla_foto WHERE id_plantilla = t.id_plantilla('A004')) = 1 $q$,
    'p_fotos = JSON null equivale a omitirlo (camino heredado)');
SELECT t.efecto($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), NULL, NULL,
        (SELECT jsonb_agg(f || '{"calidad":null,"coseno_resto":null}'::jsonb) FROM jsonb_array_elements(t.fotos('A004', 50, 3)) f)) $q$,
    $q$ SELECT (SELECT count(*) FROM public.plantilla_foto WHERE id_plantilla = t.id_plantilla('A004')) = 3
          AND (SELECT bool_and(calidad IS NULL AND coseno_resto IS NULL) FROM public.plantilla_foto WHERE id_plantilla = t.id_plantilla('A004')) $q$,
    'calidad y coseno_resto en null JSON se aceptan y se guardan como NULL');
SELECT t.efecto($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), NULL, NULL,
        (SELECT jsonb_agg(f - 'calidad' - 'coseno_resto') FROM jsonb_array_elements(t.fotos('A004', 50, 3)) f)) $q$,
    $q$ SELECT (SELECT count(*) FROM public.plantilla_foto WHERE id_plantilla = t.id_plantilla('A004')) = 3 $q$,
    'calidad y coseno_resto ausentes se aceptan');
SELECT t.efecto($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), NULL, NULL,
        jsonb_set(t.fotos('A004', 50, 3), '{0,coseno_resto}', '0.12349')) $q$,
    $q$ SELECT (SELECT coseno_resto FROM public.plantilla_foto WHERE id_plantilla = t.id_plantilla('A004') AND orden = 1) = 0.123 $q$,
    'coseno_resto se redondea a 3 decimales');

-- ===================== validaciones (todas antes de escribir) =====================
SELECT t.as_postgres();
SELECT set_config('t.n_fotos_total', (SELECT count(*) FROM public.plantilla_foto)::text, true);
SELECT set_config('t.pl_a004', t.id_plantilla('A004')::text, true);
SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), NULL, NULL, '{"a":1}'::jsonb) $q$,
    'P0001:VALIDACION', 'p_fotos no es arreglo (objeto)');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), NULL, NULL, '"abc"'::jsonb) $q$,
    'P0001:VALIDACION', 'p_fotos no es arreglo (texto)');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), NULL, NULL, '[]'::jsonb) $q$,
    'P0001:VALIDACION', 'p_fotos vacio');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), NULL, NULL, t.fotos('A004', 60, 2)) $q$,
    'P0001:VALIDACION', '2 fotos: por debajo del minimo');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), NULL, NULL, t.fotos('A004', 60, 9)) $q$,
    'P0001:VALIDACION', '9 fotos: por encima del maximo');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), NULL, NULL,
        jsonb_set(t.fotos('A004', 60, 3), '{1}', '7')) $q$,
    'P0001:VALIDACION', 'un elemento no es objeto (numero)');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), NULL, NULL,
        jsonb_set(t.fotos('A004', 60, 3), '{1}', '"registro/x"')) $q$,
    'P0001:VALIDACION', 'un elemento es un texto, no un objeto');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), NULL, NULL,
        jsonb_set(t.fotos('A004', 60, 3), '{1,objeto_foto}', '12')) $q$,
    'P0001:VALIDACION', 'objeto_foto no es texto');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), NULL, NULL,
        jsonb_set(t.fotos('A004', 60, 3), '{1}', '{"calidad":{"brillo":1}}')) $q$,
    'P0001:VALIDACION', 'un elemento sin objeto_foto');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), NULL, NULL,
        jsonb_set(t.fotos('A004', 60, 3), '{1,vector}', '[0.1]')) $q$,
    'P0001:VALIDACION', 'clave extra en el elemento (vector)');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), NULL, NULL,
        jsonb_set(t.fotos('A004', 60, 3), '{1,calidad,otra}', '1')) $q$,
    'P0001:VALIDACION', 'calidad con clave extra');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), NULL, NULL,
        jsonb_set(t.fotos('A004', 60, 3), '{1,calidad}', '[1,2]')) $q$,
    'P0001:VALIDACION', 'calidad como arreglo numerico');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), NULL, NULL,
        jsonb_set(t.fotos('A004', 60, 3), '{1,calidad}', '"buena"')) $q$,
    'P0001:VALIDACION', 'calidad como texto');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), NULL, NULL,
        jsonb_set(t.fotos('A004', 60, 3), '{1,calidad,brillo}', '300')) $q$,
    'P0001:VALIDACION', 'brillo 300');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), NULL, NULL,
        jsonb_set(t.fotos('A004', 60, 3), '{1,calidad,frontal}', '1')) $q$,
    'P0001:VALIDACION', 'frontal no booleano');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), NULL, NULL,
        jsonb_set(t.fotos('A004', 60, 3), '{1,coseno_resto}', '1.5')) $q$,
    'P0001:VALIDACION', 'coseno_resto 1.5');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), NULL, NULL,
        jsonb_set(t.fotos('A004', 60, 3), '{1,coseno_resto}', '-1.01')) $q$,
    'P0001:VALIDACION', 'coseno_resto -1.01');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), NULL, NULL,
        jsonb_set(t.fotos('A004', 60, 3), '{1,coseno_resto}', '"0.5"')) $q$,
    'P0001:VALIDACION', 'coseno_resto como texto');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), NULL, NULL,
        jsonb_set(t.fotos('A004', 60, 3), '{2,objeto_foto}', to_jsonb(t.ruta('registro', 'A004', 61, 'jpg')))) $q$,
    'P0001:VALIDACION', 'rutas repetidas');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), NULL, NULL,
        jsonb_set(t.fotos('A004', 60, 3), '{1,objeto_foto}', to_jsonb(t.ruta('registro', 'A001', 62, 'jpg')))) $q$,
    'P0001:RUTA_INVALIDA', 'una ruta es de otro alumno');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), NULL, NULL,
        jsonb_set(t.fotos('A004', 60, 3), '{2,objeto_foto}', to_jsonb(t.ruta('registro', 'A004', 62, 'png')))) $q$,
    'P0001:RUTA_INVALIDA', 'una ruta con extension png');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), NULL, NULL,
        jsonb_set(t.fotos('A004', 60, 3), '{0,objeto_foto}', to_jsonb(t.ruta('consentimientos', 'A004', 61, 'jpg')))) $q$,
    'P0001:RUTA_INVALIDA', 'una ruta con el prefijo de consentimientos');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), t.ruta('registro', 'A004', 62, 'jpg'), NULL, t.fotos('A004', 60, 3)) $q$,
    'P0001:VALIDACION', 'la foto principal no es la primera de la lista');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), t.ruta('registro', 'A001', 61, 'jpg'), NULL, t.fotos('A004', 60, 3)) $q$,
    'P0001:VALIDACION', 'la foto principal de otro alumno tampoco coincide con la primera');
-- RN-13 y alumno con fotos
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A002'), t.id_consent('A001'), NULL, NULL, t.fotos('A002', 70, 3)) $q$,
    'P0001:RN_13_CONSENTIMIENTO_AJENO', 'con fotos: consentimiento de otro alumno');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A005'), t.id_consent('A005'), NULL, NULL, t.fotos('A005', 70, 3)) $q$,
    'P0001:RN_13_CONSENTIMIENTO_NO_VIGENTE', 'con fotos: consentimiento revocado');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A006'), t.id_consent('A006'), NULL, NULL, t.fotos('A006', 70, 3)) $q$,
    'P0001:RN_13_CONSENTIMIENTO_NO_VIGENTE', 'con fotos: consentimiento vencido');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A002'), 999999, NULL, NULL, t.fotos('A002', 70, 3)) $q$,
    'P0001:NO_ENCONTRADO', 'con fotos: consentimiento inexistente');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(999999, 1, NULL, NULL, t.fotos('A002', 70, 3)) $q$,
    'P0001:NO_ENCONTRADO', 'con fotos: alumno inexistente');
-- atomicidad: ningun rechazo escribio filas ni archivo la plantilla activa de A004
SELECT t.as_postgres();
SELECT t.eq((SELECT count(*) FROM public.plantilla_foto)::text, current_setting('t.n_fotos_total'), 'los rechazos no dejaron filas en plantilla_foto');
SELECT t.eq(t.id_plantilla('A004')::text, current_setting('t.pl_a004'), 'los rechazos no archivaron la plantilla activa de A004');
-- roles
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A001'), t.id_consent('A001'), NULL, NULL, t.fotos('A001', 80, 3)) $q$,
    'P0001:NO_AUTORIZADO', 'docente no registra plantilla de varias fotos');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A001'), t.id_consent('A001'), NULL, NULL, t.fotos('A001', 80, 3)) $q$,
    'P0001:NO_AUTORIZADO', 'alumno no registra plantilla de varias fotos');
SELECT t.as_user('tecnico@susan.test');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A001'), t.id_consent('A001'), NULL, NULL, t.fotos('A001', 80, 3)) $q$,
    'P0001:NO_AUTORIZADO', 'tecnico no registra plantilla de varias fotos');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(1, 1, NULL, NULL, '[]'::jsonb) $q$, '42501', 'anon sin EXECUTE');

-- ===================== api_plantilla_alumno: forma exacta =====================
SELECT t.as_user('admin@susan.test');
SELECT t.eq((public.api_plantilla_alumno(t.id_alumno('A002')) #>> '{activa,n_fotos}')::int, 5, 'activa.n_fotos = 5');
SELECT t.eq((public.api_plantilla_alumno(t.id_alumno('A002')) #>> '{activa,coseno_min}')::numeric, 0.81, 'activa.coseno_min = minimo de coseno_resto');
SELECT t.eq((public.api_plantilla_alumno(t.id_alumno('A002')) #>> '{activa,coseno_medio}')::numeric, 0.83, 'activa.coseno_medio = promedio de coseno_resto');
SELECT t.eq(jsonb_array_length(public.api_plantilla_alumno(t.id_alumno('A002')) #> '{activa,fotos}'), 5, 'activa.fotos tiene 5 elementos');
SELECT t.eq((SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(public.api_plantilla_alumno(t.id_alumno('A002')) #> '{activa,fotos,0}') k),
    'calidad,coseno_resto,id_foto,orden,principal', 'cada foto trae solo id_foto, orden, principal, calidad y coseno_resto');
SELECT t.eq((SELECT string_agg((f ->> 'orden') || ':' || (f ->> 'principal'), ',' ORDER BY (f ->> 'orden')::int)
               FROM jsonb_array_elements(public.api_plantilla_alumno(t.id_alumno('A002')) #> '{activa,fotos}') f),
    '1:true,2:false,3:false,4:false,5:false', 'solo la de orden 1 es principal; las fotos salen ordenadas');
SELECT t.eq(public.api_plantilla_alumno(t.id_alumno('A002')) #> '{activa,fotos,0,calidad}',
    '{"brillo":120.5,"nitidez":88.2,"tamano_rostro_px":210,"frontal":true}'::jsonb, 'fotos[0].calidad exacta');
SELECT t.eq((public.api_plantilla_alumno(t.id_alumno('A002')) #>> '{activa,fotos,0,coseno_resto}')::numeric, 0.81, 'fotos[0].coseno_resto');
SELECT t.eq((public.api_plantilla_alumno(t.id_alumno('A002')) #>> '{activa,fotos,2,id_foto}')::int,
    (SELECT id_foto FROM public.plantilla_foto WHERE id_plantilla = t.id_plantilla('A002') AND orden = 3), 'fotos[2].id_foto es el de la tabla');
SELECT t.ok(NOT (public.api_plantilla_alumno(t.id_alumno('A002'))::text LIKE '%objeto_foto%'), 'api_plantilla_alumno nunca emite objeto_foto');
SELECT t.ok(NOT (public.api_plantilla_alumno(t.id_alumno('A002'))::text LIKE '%registro/%'), 'ni ninguna ruta del bucket');
-- plantilla heredada de una foto (A004, de fixtures)
SELECT t.eq((public.api_plantilla_alumno(t.id_alumno('A004')) #>> '{activa,n_fotos}')::int, 1, 'plantilla de una foto: n_fotos 1');
SELECT t.ok(public.api_plantilla_alumno(t.id_alumno('A004')) #> '{activa,coseno_min}' = 'null'::jsonb
        AND public.api_plantilla_alumno(t.id_alumno('A004')) #> '{activa,coseno_medio}' = 'null'::jsonb, 'una foto: coseno_min y coseno_medio null');
SELECT t.eq(jsonb_array_length(public.api_plantilla_alumno(t.id_alumno('A004')) #> '{activa,fotos}'), 1, 'una foto: fotos tiene 1 elemento');
SELECT t.ok(public.api_plantilla_alumno(t.id_alumno('A004')) #> '{activa,fotos,0,calidad}' = 'null'::jsonb
        AND public.api_plantilla_alumno(t.id_alumno('A004')) #> '{activa,fotos,0,coseno_resto}' = 'null'::jsonb, 'una foto heredada: calidad y coseno_resto null');
SELECT t.eq((public.api_plantilla_alumno(t.id_alumno('A004')) #>> '{activa,version_indice}'), 'v001', 'las claves de siempre siguen ahi (version_indice)');
SELECT t.ok(public.api_plantilla_alumno(t.id_alumno('A005')) -> 'activa' = 'null'::jsonb, 'sin plantilla activa: activa null');
-- respaldo: una plantilla sin filas cuenta como de una foto y fotos = []
SELECT t.as_postgres();
DELETE FROM public.plantilla_foto WHERE id_plantilla = t.id_plantilla('A004');
SELECT t.as_user('admin@susan.test');
SELECT t.eq((public.api_plantilla_alumno(t.id_alumno('A004')) #>> '{activa,n_fotos}')::int, 1, 'respaldo sin filas: n_fotos 1');
SELECT t.eq(jsonb_array_length(public.api_plantilla_alumno(t.id_alumno('A004')) #> '{activa,fotos}'), 0, 'respaldo sin filas: fotos = []');
SELECT t.as_postgres();
INSERT INTO public.plantilla_foto (id_plantilla, orden, objeto_foto) SELECT id_plantilla, 1, objeto_foto FROM public.plantilla_facial WHERE id_plantilla = t.id_plantilla('A004');
SELECT t.as_user('admin@susan.test');

-- ===================== svc_indice_plan: objetos_foto =====================
SELECT t.as_service();
SELECT t.eq((SELECT e -> 'objetos_foto' FROM jsonb_array_elements(public.svc_indice_plan() -> 'entries') e WHERE (e ->> 'id_alumno')::int = t.id_alumno('A004')),
    'null'::jsonb, 'plan: una plantilla en base trae objetos_foto null');
SELECT t.eq((SELECT string_agg(x, ',' ORDER BY n) FROM jsonb_array_elements_text(
        (SELECT e -> 'objetos_foto' FROM jsonb_array_elements(public.svc_indice_plan() -> 'entries') e WHERE (e ->> 'id_alumno')::int = t.id_alumno('A002'))) WITH ORDINALITY x(x, n)),
    (SELECT string_agg(e ->> 'objeto_foto', ',' ORDER BY n) FROM jsonb_array_elements(t.fotos('A002', 10, 5)) WITH ORDINALITY x(e, n)),
    'plan: objetos_foto de la plantilla nueva, en orden de captura y con la principal primero');
SELECT t.eq((SELECT (e -> 'objetos_foto' -> 0) #>> '{}' = e ->> 'objeto_foto' FROM jsonb_array_elements(public.svc_indice_plan() -> 'entries') e WHERE (e ->> 'id_alumno')::int = t.id_alumno('A002')),
    true, 'plan: objetos_foto[0] = objeto_foto');
SELECT t.eq((SELECT jsonb_array_length(e -> 'objetos_foto') FROM jsonb_array_elements(public.svc_indice_plan() -> 'entries') e WHERE (e ->> 'id_alumno')::int = t.id_alumno('A003')),
    8, 'plan: A003 (8 fotos activas) trae 8 rutas');
SELECT t.eq((SELECT e -> 'objetos_foto' FROM jsonb_array_elements(public.svc_indice_plan() -> 'entries') e WHERE (e ->> 'id_alumno')::int = t.id_alumno('A001')),
    jsonb_build_array(t.ruta('registro', 'A001', 4, 'jpg')), 'plan: una plantilla nueva de una foto trae un arreglo de 1');
SELECT t.eq((SELECT e -> 'objetos_foto' FROM jsonb_array_elements(public.svc_indice_plan(true) -> 'entries') e WHERE (e ->> 'id_alumno')::int = t.id_alumno('A004')),
    jsonb_build_array('registro/' || t.id_alumno('A004') || '/fixture.jpg'), 'plan completo: una plantilla heredada trae un arreglo de 1');
SELECT t.ok((SELECT bool_and(jsonb_typeof(e -> 'objetos_foto') = 'array') FROM jsonb_array_elements(public.svc_indice_plan(true) -> 'entries') e),
    'plan completo: todas las entries traen objetos_foto');
SELECT t.ok((SELECT bool_and(e ? 'objeto_foto') FROM jsonb_array_elements(public.svc_indice_plan() -> 'entries') e), 'plan: objeto_foto (la principal) se conserva');
-- respaldo sin filas
SELECT t.as_postgres();
DELETE FROM public.plantilla_foto WHERE id_plantilla = t.id_plantilla('A004');
SELECT t.as_service();
SELECT t.eq((SELECT e -> 'objetos_foto' FROM jsonb_array_elements(public.svc_indice_plan(true) -> 'entries') e WHERE (e ->> 'id_alumno')::int = t.id_alumno('A004')),
    jsonb_build_array('registro/' || t.id_alumno('A004') || '/fixture.jpg'), 'plan: sin filas se usa [objeto_foto]');
SELECT t.as_postgres();
INSERT INTO public.plantilla_foto (id_plantilla, orden, objeto_foto) SELECT id_plantilla, 1, objeto_foto FROM public.plantilla_facial WHERE id_plantilla = t.id_plantilla('A004');
SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ SELECT public.svc_indice_plan() $q$, '42501', 'admin no ejecuta svc_indice_plan');

-- ===================== api_documento_url_autorizar('plantilla_foto') =====================
SELECT t.as_postgres();
SELECT set_config('t.foto3', (SELECT id_foto::text FROM public.plantilla_foto WHERE id_plantilla = t.id_plantilla('A002') AND orden = 3), true);
SELECT t.as_user('admin@susan.test');
SELECT t.eq((public.api_documento_url_autorizar('plantilla_foto', current_setting('t.foto3')::int) ->> 'objeto'), t.ruta('registro', 'A002', 13, 'jpg'), 'plantilla_foto: devuelve la ruta de esa foto');
SELECT t.eq((public.api_documento_url_autorizar('plantilla_foto', current_setting('t.foto3')::int) ->> 'orden')::int, 3, 'plantilla_foto: orden');
SELECT t.eq((public.api_documento_url_autorizar('plantilla_foto', current_setting('t.foto3')::int) ->> 'id_plantilla')::int, t.id_plantilla('A002'), 'plantilla_foto: id_plantilla');
SELECT t.eq((public.api_documento_url_autorizar('plantilla_foto', current_setting('t.foto3')::int) ->> 'id_alumno')::int, t.id_alumno('A002'), 'plantilla_foto: id_alumno');
SELECT t.eq((public.api_documento_url_autorizar('plantilla_foto', current_setting('t.foto3')::int) ->> 'tipo'), 'plantilla_foto', 'plantilla_foto: tipo');
SELECT t.eq((public.api_documento_url_autorizar('plantilla_foto', current_setting('t.foto3')::int) ->> 'id_registro')::int, current_setting('t.foto3')::int, 'plantilla_foto: id_registro = id_foto');
SELECT t.eq((public.api_documento_url_autorizar('plantilla_foto', current_setting('t.foto3')::int) ->> 'vigencia_seg')::int, 300, 'plantilla_foto: vigencia 300 s');
SELECT t.eq((SELECT count(*)::int FROM public.bitacora_auditoria WHERE accion = 'consulta' AND entidad = 'plantilla_facial'
              AND id_registro = t.id_plantilla('A002') AND valor_nuevo ->> 'id_foto' = current_setting('t.foto3')), 7,
    'cada emision asienta consulta con id_foto (7 emisiones previas)');
SELECT t.ok((SELECT valor_nuevo = jsonb_build_object('id_alumno', t.id_alumno('A002'), 'id_foto', current_setting('t.foto3')::int, 'orden', 3)
               FROM public.bitacora_auditoria WHERE accion = 'consulta' AND entidad = 'plantilla_facial' ORDER BY id_bitacora DESC LIMIT 1),
    'la bitacora guarda id_alumno, id_foto y orden');
SELECT public.api_documento_url_autorizar('plantilla_foto', current_setting('t.foto3')::int, '10.9.8.7'::inet);
SELECT t.eq((SELECT ip_origen FROM public.bitacora_auditoria WHERE accion = 'consulta' ORDER BY id_bitacora DESC LIMIT 1), '10.9.8.7', 'consulta de foto guarda la IP');
SELECT t.eq((SELECT id_usuario FROM public.bitacora_auditoria WHERE accion = 'consulta' ORDER BY id_bitacora DESC LIMIT 1), t.id_usuario('admin@susan.test'), 'consulta a nombre del administrador');
-- 'plantilla' sigue devolviendo la foto principal, con la forma de siempre
SELECT t.eq((public.api_documento_url_autorizar('plantilla', t.id_plantilla('A002')) ->> 'objeto'), t.ruta('registro', 'A002', 11, 'jpg'), 'plantilla: sigue siendo la foto principal');
SELECT t.ok(NOT (public.api_documento_url_autorizar('plantilla', t.id_plantilla('A002')) ? 'orden'), 'plantilla: forma sin cambios');
SELECT t.throws($q$ SELECT public.api_documento_url_autorizar('plantilla_foto', 999999) $q$, 'P0001:NO_ENCONTRADO', 'plantilla_foto inexistente');
SELECT t.throws($q$ SELECT public.api_documento_url_autorizar('foto', 1) $q$, 'P0001:VALIDACION', 'tipo invalido');
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT public.api_documento_url_autorizar('plantilla_foto', current_setting('t.foto3')::int) $q$, 'P0001:NO_AUTORIZADO', 'docente titular no abre fotos de la plantilla');
SELECT t.as_user('docente2@susan.test');
SELECT t.throws($q$ SELECT public.api_documento_url_autorizar('plantilla_foto', current_setting('t.foto3')::int) $q$, 'P0001:NO_AUTORIZADO', 'docente ajeno no abre fotos de la plantilla');
SELECT t.as_user('alumno2@susan.test');
SELECT t.throws($q$ SELECT public.api_documento_url_autorizar('plantilla_foto', current_setting('t.foto3')::int) $q$, 'P0001:NO_AUTORIZADO', 'alumno no abre sus fotos');
SELECT t.as_user('tecnico@susan.test');
SELECT t.throws($q$ SELECT public.api_documento_url_autorizar('plantilla_foto', current_setting('t.foto3')::int) $q$, 'P0001:NO_AUTORIZADO', 'tecnico no abre fotos de la plantilla');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.api_documento_url_autorizar('plantilla_foto', 1) $q$, '42501', 'anon sin EXECUTE');

-- ===================== RLS y permisos de plantilla_foto =====================
SELECT t.as_user('admin@susan.test');
SELECT t.ok(t.n('SELECT 1 FROM public.plantilla_foto') >= 20, 'el administrador ve las filas de plantilla_foto');
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(t.n('SELECT 1 FROM public.plantilla_foto'), 0::bigint, 'docente titular: 0 filas (ve la foto principal por plantilla_facial)');
SELECT t.as_user('docente2@susan.test');
SELECT t.eq(t.n('SELECT 1 FROM public.plantilla_foto'), 0::bigint, 'docente ajeno: 0 filas');
SELECT t.as_user('alumno1@susan.test');
SELECT t.eq(t.n('SELECT 1 FROM public.plantilla_foto'), 0::bigint, 'alumno: 0 filas');
SELECT t.as_user('tecnico@susan.test');
SELECT t.eq(t.n('SELECT 1 FROM public.plantilla_foto'), 0::bigint, 'tecnico: 0 filas');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT count(*) FROM public.plantilla_foto $q$, '42501', 'anon: permission denied');
SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ INSERT INTO public.plantilla_foto (id_plantilla, orden, objeto_foto) VALUES (t.id_plantilla('A002'), 6, 'registro/x/y.jpg') $q$, '42501', 'authenticated no inserta en plantilla_foto');
SELECT t.throws($q$ UPDATE public.plantilla_foto SET objeto_foto = 'registro/x/y.jpg' $q$, '42501', 'authenticated no actualiza plantilla_foto');
SELECT t.throws($q$ DELETE FROM public.plantilla_foto $q$, '42501', 'authenticated no borra de plantilla_foto');
SELECT t.ok(NOT has_sequence_privilege('authenticated', 'public.plantilla_foto_id_foto_seq', 'USAGE,UPDATE'), 'authenticated sin acceso a la secuencia');
SELECT t.ok(NOT has_sequence_privilege('anon', 'public.plantilla_foto_id_foto_seq', 'USAGE,UPDATE'), 'anon sin acceso a la secuencia');
SELECT t.as_service();
SELECT t.ok(has_table_privilege('service_role', 'public.plantilla_foto', 'SELECT,INSERT,UPDATE,DELETE'), 'service_role conserva ALL en plantilla_foto');

-- ===================== reemplazo, revocacion y vencimiento: las fotos acompanan a su plantilla =====================
SELECT t.as_user('admin@susan.test');
-- reemplazo de la plantilla de 5 fotos de A002 por una de 4: la anterior se archiva con sus 5 fotos
SELECT t.eq((public.api_plantilla_registrar(t.id_alumno('A002'), t.id_consent('A002'), NULL, NULL, t.fotos('A002', 20, 4)) ->> 'plantilla_archivada')::int,
    current_setting('t.pl_a002_5')::int, 'reemplazo: devuelve la plantilla archivada');
SELECT t.eq((SELECT count(*)::int FROM public.plantilla_foto WHERE id_plantilla = current_setting('t.pl_a002_5')::int), 5, 'la archivada conserva sus 5 filas');
SELECT t.eq((SELECT count(*)::int FROM public.plantilla_foto WHERE id_plantilla = t.id_plantilla('A002')), 4, 'la nueva activa tiene 4 filas');
SELECT t.eq((public.api_plantilla_alumno(t.id_alumno('A002')) #>> '{archivadas,items,0,n_fotos}')::int, 5, 'archivadas.items[].n_fotos = 5');
SELECT t.eq((public.api_plantilla_alumno(t.id_alumno('A002')) #>> '{activa,n_fotos}')::int, 4, 'activa.n_fotos = 4 tras el reemplazo');
SELECT t.ok(NOT (public.api_plantilla_alumno(t.id_alumno('A002')) #>> '{archivadas,items,0}' LIKE '%objeto_foto%'), 'archivadas sin objeto_foto');
-- una foto de la plantilla archivada sigue pudiendo abrirse (igual que la principal archivada)
SELECT t.eq((public.api_documento_url_autorizar('plantilla_foto', (SELECT id_foto FROM public.plantilla_foto WHERE id_plantilla = current_setting('t.pl_a002_5')::int AND orden = 2)) ->> 'objeto'),
    t.ruta('registro', 'A002', 12, 'jpg'), 'las fotos de una plantilla archivada se pueden abrir (auditado)');
SELECT t.as_service();
SELECT t.ok(NOT (public.svc_indice_plan() -> 'entries')::text LIKE '%0000000000011%'
        AND NOT (public.svc_indice_plan() -> 'entries')::text LIKE '%0000000000015%', 'svc_indice_plan no incluye las fotos de la plantilla archivada');
SELECT t.eq((SELECT jsonb_array_length(e -> 'objetos_foto') FROM jsonb_array_elements(public.svc_indice_plan() -> 'entries') e WHERE (e ->> 'id_alumno')::int = t.id_alumno('A002')),
    4, 'svc_indice_plan solo entrega las 4 fotos de la plantilla activa');
-- revocacion del consentimiento: archiva la plantilla; sus fotos permanecen en tabla
SELECT t.as_user('admin@susan.test');
SELECT t.eq((public.api_consentimiento_revocar(t.id_consent('A002')) ->> 'plantillas_archivadas')::int, 1, 'revocar: archiva la plantilla activa');
SELECT t.eq((SELECT count(*)::int FROM public.plantilla_foto pf JOIN public.plantilla_facial p USING (id_plantilla) WHERE p.id_alumno = t.id_alumno('A002')), 9,
    'revocar: las 9 fotos (5 + 4) permanecen en la tabla (como los objetos del bucket)');
SELECT t.ok(public.api_plantilla_alumno(t.id_alumno('A002')) -> 'activa' = 'null'::jsonb, 'revocar: activa pasa a null');
SELECT t.eq((public.api_plantilla_alumno(t.id_alumno('A002')) #>> '{archivadas,total}')::int, 2, 'revocar: 2 plantillas archivadas');
SELECT t.as_service();
SELECT t.eq((SELECT count(*)::int FROM jsonb_array_elements(public.svc_indice_plan(true) -> 'entries') e WHERE (e ->> 'id_alumno')::int = t.id_alumno('A002')), 0,
    'revocar: svc_indice_plan ya no incluye a A002 ni sus fotos');
-- vencer_consentimientos NO archiva: la plantilla vencida sigue activa y svc_indice_plan la sigue incluyendo con sus fotos
SELECT t.as_postgres();
UPDATE public.consentimiento SET vigencia_hasta = '2026-09-01' WHERE id_consent = t.id_consent('A003');
SELECT t.ok(app.vencer_consentimientos() >= 1, 'vencer_consentimientos vence el consentimiento de A003');
SELECT t.eq((SELECT estatus::text FROM public.consentimiento WHERE id_consent = t.id_consent('A003')), 'vencido', 'el consentimiento de A003 quedo vencido');
SELECT t.ok((SELECT activa FROM public.plantilla_facial WHERE id_plantilla = t.id_plantilla('A003')) IS NOT DISTINCT FROM true, 'vencer no archiva la plantilla de A003');
SELECT t.as_service();
SELECT t.eq((SELECT jsonb_array_length(e -> 'objetos_foto') FROM jsonb_array_elements(public.svc_indice_plan(true) -> 'entries') e WHERE (e ->> 'id_alumno')::int = t.id_alumno('A003')),
    8, 'vencida (no archivada): svc_indice_plan sigue entregando sus 8 fotos');

SELECT t.summary();
ROLLBACK;
