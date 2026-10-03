-- Estructura del esquema: replica la validacion de la spec (3.4.3): 19 tablas, 13 dominios
-- enumerados (+ tipo_camara), llaves, restricciones, indices parciales, disparadores, RLS y privilegios.
BEGIN;
SELECT t.begin('schema_01_estructura');

-- Tablas -------------------------------------------------------------------------------------
SELECT t.eq((SELECT count(*) FROM pg_tables WHERE schemaname = 'public'), 19::bigint, '19 tablas en public');
SELECT t.ok((SELECT array_agg(tablename ORDER BY tablename) FROM pg_tables WHERE schemaname = 'public') = ARRAY[
    'alumno', 'asistencia', 'aula', 'bitacora_auditoria', 'camara', 'captura', 'consentimiento', 'deteccion',
    'docente', 'grupo', 'horario_grupo', 'indice_faiss', 'inscripcion', 'justificante', 'materia',
    'parametro_sistema', 'plantilla_facial', 'sesion_clase', 'usuario']::name[], 'los nombres de las tablas son los de la spec');
SELECT t.eq((SELECT count(*) FROM pg_constraint WHERE contype = 'p' AND connamespace = 'public'::regnamespace), 19::bigint, '19 llaves primarias');
SELECT t.eq((SELECT count(*) FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace), 25::bigint, '25 llaves foraneas');
SELECT t.eq((SELECT count(*) FROM pg_constraint WHERE contype = 'f' AND confdeltype = 'c' AND connamespace = 'public'::regnamespace), 1::bigint, 'una sola FK en cascada');
SELECT t.eq((SELECT conrelid::regclass::text FROM pg_constraint WHERE contype = 'f' AND confdeltype = 'c' AND connamespace = 'public'::regnamespace), 'horario_grupo', 'la cascada es horario_grupo -> grupo');
SELECT t.eq((SELECT count(*) FROM pg_constraint WHERE contype = 'f' AND confdeltype = 'r' AND connamespace = 'public'::regnamespace), 24::bigint, 'las otras 24 FK son ON DELETE RESTRICT');
SELECT t.eq((SELECT count(*) FROM pg_constraint WHERE contype = 'u' AND connamespace = 'public'::regnamespace), 20::bigint, '20 restricciones UNIQUE');
SELECT t.ok((SELECT count(*) FROM pg_constraint WHERE contype = 'c' AND connamespace = 'public'::regnamespace) >= 29, 'al menos 29 restricciones CHECK');
SELECT t.eq((SELECT count(*) FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND contype IN ('p','f','u','c')
              AND conname !~ '^(pk|fk|uq|ck)_'), 0::bigint, 'todas las restricciones usan los prefijos pk_ fk_ uq_ ck_');

-- Dominios -----------------------------------------------------------------------------------
SELECT t.eq((SELECT count(*) FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typtype = 'e'), 14::bigint, '13 enums de la spec + tipo_camara');
SELECT t.eq((SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid = 'public.estatus_sesion'::regtype),
            ARRAY['programada', 'abierta', 'cerrada', 'suspendida'], 'estatus_sesion incluye suspendida');
SELECT t.eq((SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid = 'public.tipo_camara'::regtype),
            ARRAY['ip', 'navegador'], 'tipo_camara = ip | navegador');
SELECT t.eq((SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid = 'public.estado_asistencia'::regtype),
            ARRAY['presente', 'retardo', 'ausente', 'pendiente', 'justificado'], 'estado_asistencia (5 valores)');
SELECT t.eq((SELECT count(*) FROM pg_enum e WHERE e.enumtypid = 'public.accion_bitacora'::regtype), 8::bigint, 'accion_bitacora (8 valores)');

-- Tipos fisicos clave del diccionario de datos
SELECT t.eq((SELECT format_type(atttypid, atttypmod) FROM pg_attribute WHERE attrelid = 'public.deteccion'::regclass AND attname = 'score_similitud'), 'numeric(4,3)', 'score_similitud NUMERIC(4,3)');
SELECT t.eq((SELECT format_type(atttypid, atttypmod) FROM pg_attribute WHERE attrelid = 'public.captura'::regclass AND attname = 'id_captura'), 'bigint', 'captura.id_captura BIGINT');
SELECT t.eq((SELECT format_type(atttypid, atttypmod) FROM pg_attribute WHERE attrelid = 'public.plantilla_facial'::regclass AND attname = 'faiss_id'), 'bigint', 'faiss_id BIGINT');
SELECT t.eq((SELECT format_type(atttypid, atttypmod) FROM pg_attribute WHERE attrelid = 'public.alumno'::regclass AND attname = 'matricula'), 'character varying(10)', 'matricula VARCHAR(10)');
SELECT t.eq((SELECT count(*) FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
              WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
                AND (a.atttypid = 'bytea'::regtype OR a.atttypid IN (SELECT oid FROM pg_type WHERE typcategory = 'A'))), 0::bigint,
            'RNF-03: ninguna columna binaria ni de arreglo');
SELECT t.eq((SELECT count(*) FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
              WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND a.attidentity = 'a'), 18::bigint,
            '18 tablas con identity (parametro_sistema usa clave natural)');

-- Indices ------------------------------------------------------------------------------------
SELECT t.eq((SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname IN ('ux_plantilla_facial_activa', 'ux_indice_faiss_en_uso')
              AND indexdef LIKE '%UNIQUE%' AND indexdef LIKE '%WHERE%'), 2::bigint, 'dos indices unicos parciales');
SELECT t.ok((SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'ix\_%') >= 12, 'al menos doce indices de apoyo');
SELECT t.ok(EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ix_captura_sesion'), 'indice captura(id_sesion)');
SELECT t.ok(EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ix_deteccion_captura'), 'indice deteccion(id_captura)');
SELECT t.ok(EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ix_asistencia_alumno'), 'indice asistencia(id_alumno)');

-- Disparadores -------------------------------------------------------------------------------
SELECT t.ok((SELECT array_agg(tgname::text) FROM pg_trigger WHERE NOT tgisinternal AND tgrelid::regclass::text !~ '^storage')
            @> ARRAY['trg_asistencia_ciclo', 'trg_asistencia_rn01', 'trg_bitacora_sin_cambios', 'trg_bitacora_sin_truncate',
                     'trg_captura_rn06', 'trg_plantilla_rn13'], 'existen los seis disparadores con el nombre de la spec');
SELECT t.eq((SELECT count(*) FROM pg_trigger WHERE tgname IN ('trg_bitacora_sin_cambios', 'trg_bitacora_sin_truncate') AND tgenabled = 'A'), 2::bigint,
            'los disparadores de la bitacora son ENABLE ALWAYS (valen tambien en modo replica)');

-- RLS y privilegios --------------------------------------------------------------------------
SELECT t.eq((SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relrowsecurity), 19::bigint, 'RLS activa en las 19 tablas');
SELECT t.ok((SELECT count(*) FROM pg_policies WHERE schemaname = 'public') >= 19, 'cada tabla tiene sus politicas');
SELECT t.eq((SELECT count(*) FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
              AND has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')), 0::bigint, 'anon sin ningun privilegio de tabla');
SELECT t.eq((SELECT count(*) FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
              AND has_table_privilege('authenticated', c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE')), 0::bigint, 'authenticated sin escritura directa en ninguna tabla');
SELECT t.eq((SELECT count(*) FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
              AND has_table_privilege('authenticated', c.oid, 'SELECT')), 19::bigint, 'authenticated con SELECT en las 19 tablas (respaldado por politicas)');
SELECT t.ok(NOT has_table_privilege('service_role', 'public.bitacora_auditoria', 'INSERT,UPDATE,DELETE,TRUNCATE'), 'service_role no escribe la bitacora directamente');
SELECT t.ok(has_table_privilege('service_role', 'public.asistencia', 'INSERT,UPDATE,DELETE'), 'service_role conserva ALL en las demas tablas');
SELECT t.eq((SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'S'
              AND CASE WHEN relkind = 'S' THEN has_sequence_privilege('authenticated', oid, 'USAGE,UPDATE') ELSE false END), 0::bigint, 'authenticated sin acceso a secuencias');

-- Funciones: search_path fijo y EXECUTE cerrado ------------------------------------------------
SELECT t.eq((SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'app'::regnamespace
              AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')), 0::bigint,
            'todas las funciones de app tienen search_path fijo');
SELECT t.eq((SELECT count(*) FROM pg_proc p WHERE p.pronamespace IN ('app'::regnamespace, 'public'::regnamespace)
              AND p.proname IN ('api_yo', 'api_ahora', 'api_parametros_publicos')
              AND (NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%'))), 0::bigint,
            'las RPC de plataforma tienen search_path fijo');
SELECT t.eq((SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'app'::regnamespace
              AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('public', p.oid, 'EXECUTE'))), 0::bigint,
            'ninguna funcion de app es ejecutable por anon/PUBLIC');
SELECT t.ok(NOT has_function_privilege('authenticated', 'app.bitacora(public.accion_bitacora,text,bigint,jsonb,jsonb,inet,integer)', 'EXECUTE'),
            'authenticated no puede escribir bitacora directamente');
SELECT t.ok(NOT has_function_privilege('authenticated', 'app.asumir_cuenta_servicio()', 'EXECUTE'), 'authenticated no puede asumir la cuenta de servicio');
SELECT t.ok(has_function_privilege('service_role', 'app.asumir_cuenta_servicio()', 'EXECUTE'), 'service_role si puede asumirla');
SELECT t.eq((SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'app'::regnamespace AND p.proname LIKE 'trg\_%'
              AND has_function_privilege('authenticated', p.oid, 'EXECUTE')), 0::bigint, 'las funciones de trigger no son ejecutables por authenticated');
SELECT t.ok(NOT has_function_privilege('anon', 'public.api_yo()', 'EXECUTE'), 'anon no ejecuta api_yo');
SELECT t.ok(has_function_privilege('authenticated', 'public.api_yo()', 'EXECUTE'), 'authenticated ejecuta api_yo');

-- Parametros y cuenta de servicio -----------------------------------------------------------
SELECT t.eq((SELECT count(*) FROM public.parametro_sistema), 12::bigint, '12 parametros iniciales');
SELECT t.eq((SELECT valor FROM public.parametro_sistema WHERE clave = 'umbral_similitud'), '0.850', 'umbral_similitud = 0.850');
SELECT t.eq((SELECT count(*) FROM public.parametro_sistema WHERE actualizado_por IS NOT NULL), 0::bigint, 'los iniciales no tienen actualizado_por');
SELECT t.eq((SELECT count(*) FROM public.usuario WHERE rol = 'tecnico' AND correo = 'servicio@susan.local' AND activo), 1::bigint, 'existe la cuenta de servicio (tecnico)');
SELECT t.eq((SELECT count(*) FROM app.parametro_meta), 12::bigint, 'app.parametro_meta describe los 12 parametros');

SELECT t.summary();
ROLLBACK;
