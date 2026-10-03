-- api_b2_02 · plantilla facial y documentos: api_plantilla_registrar, api_plantilla_alumno, api_documento_url_autorizar (3.4 a 3.6).
BEGIN;
SELECT t.begin('api_b2_02_plantilla');
SELECT t.cargar_fixtures();
CREATE FUNCTION t.ruta(p_prefijo text, p_matricula text, p_n integer, p_ext text) RETURNS text LANGUAGE sql STABLE
AS $$ SELECT p_prefijo || '/' || t.id_alumno(p_matricula) || '/00000000-0000-4000-8000-' || lpad(p_n::text, 12, '0') || '.' || p_ext $$;
GRANT EXECUTE ON FUNCTION t.ruta(text, text, integer, text) TO PUBLIC;

SELECT t.as_user('admin@susan.test');
-- ---- Alta sin plantilla previa ----
SELECT t.eq((public.api_plantilla_registrar(t.id_alumno('A002'), t.id_consent('A002'), t.ruta('registro', 'A002', 1, 'jpg')) ->> 'indexada'),
    'false', 'alta nueva: nace sin indexar');
SELECT t.ok((SELECT id_indice IS NULL AND faiss_id IS NULL AND activa FROM public.plantilla_facial WHERE id_alumno = t.id_alumno('A002')),
    'fila nueva activa con id_indice y faiss_id nulos');
SELECT t.ok(public.api_plantilla_registrar(t.id_alumno('A003'), t.id_consent('A003'), t.ruta('registro', 'A003', 1, 'jpg')) -> 'plantilla_archivada' = 'null'::jsonb,
    'sin plantilla previa: plantilla_archivada null');
SELECT t.eq((SELECT count(*)::int FROM public.bitacora_auditoria WHERE accion = 'alta_plantilla' AND entidad = 'plantilla_facial'
              AND valor_anterior IS NULL), 2, 'bitacora alta_plantilla sin valor anterior (2 altas)');

-- ---- Reemplazo: archivar y luego insertar (RN-12) ----
SELECT t.as_postgres();
SELECT set_config('t.vieja_a001', t.id_plantilla('A001')::text, true);
SELECT t.as_user('admin@susan.test');
SELECT t.eq((public.api_plantilla_registrar(t.id_alumno('A001'), t.id_consent('A001'), t.ruta('registro', 'A001', 2, 'jpg'), '10.1.2.3'::inet) ->> 'plantilla_archivada')::int,
    current_setting('t.vieja_a001')::int, 'reemplazo: devuelve la plantilla archivada');
SELECT t.eq((SELECT count(*)::int FROM public.plantilla_facial WHERE id_alumno = t.id_alumno('A001') AND activa), 1, 'una sola activa (RN-12)');
SELECT t.eq((SELECT count(*)::int FROM public.plantilla_facial WHERE id_alumno = t.id_alumno('A001') AND NOT activa), 1, 'la anterior queda archivada, no borrada');
SELECT t.ok((SELECT id_indice IS NOT NULL FROM public.plantilla_facial WHERE id_plantilla = current_setting('t.vieja_a001')::int),
    'la archivada conserva su referencia al indice');
SELECT t.eq((SELECT valor_anterior ->> 'id_plantilla' FROM public.bitacora_auditoria WHERE accion = 'alta_plantilla'
              AND valor_nuevo ->> 'plantilla_archivada' IS NOT NULL ORDER BY id_bitacora DESC LIMIT 1),
    current_setting('t.vieja_a001'), 'bitacora: valor anterior = plantilla archivada');
SELECT t.eq((SELECT ip_origen FROM public.bitacora_auditoria WHERE accion = 'alta_plantilla' ORDER BY id_bitacora DESC LIMIT 1), '10.1.2.3', 'bitacora guarda la IP');
SELECT t.eq((SELECT id_usuario FROM public.bitacora_auditoria WHERE accion = 'alta_plantilla' ORDER BY id_bitacora DESC LIMIT 1),
    t.id_usuario('admin@susan.test'), 'bitacora a nombre del administrador');
SELECT t.ok((public.api_plantilla_registrar(t.id_alumno('A001'), t.id_consent('A001'), t.ruta('registro', 'A001', 3, 'jpg')) ->> 'requiere_reconstruccion')::boolean,
    'requiere_reconstruccion = true');
SELECT t.eq((SELECT count(*)::int FROM public.plantilla_facial WHERE id_alumno = t.id_alumno('A001')), 3, 'reemplazos sucesivos conservan todas las filas');

-- ---- Rechazos (todos antes de tocar datos) ----
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A002'), t.id_consent('A001'), t.ruta('registro', 'A002', 4, 'jpg')) $q$,
    'P0001:RN_13_CONSENTIMIENTO_AJENO', 'consentimiento de otro alumno');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A005'), t.id_consent('A005'), t.ruta('registro', 'A005', 4, 'jpg')) $q$,
    'P0001:RN_13_CONSENTIMIENTO_NO_VIGENTE', 'consentimiento revocado');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A006'), t.id_consent('A006'), t.ruta('registro', 'A006', 4, 'jpg')) $q$,
    'P0001:RN_13_CONSENTIMIENTO_NO_VIGENTE', 'consentimiento vencido por fecha');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A002'), 999999, t.ruta('registro', 'A002', 4, 'jpg')) $q$,
    'P0001:NO_ENCONTRADO', 'consentimiento inexistente');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(999999, 1, 'registro/999999/00000000-0000-4000-8000-000000000004.jpg') $q$,
    'P0001:NO_ENCONTRADO', 'alumno inexistente');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A002'), t.id_consent('A002'), t.ruta('registro', 'A001', 4, 'jpg')) $q$,
    'P0001:RUTA_INVALIDA', 'foto de otro alumno');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A002'), t.id_consent('A002'), t.ruta('registro', 'A002', 4, 'png')) $q$,
    'P0001:RUTA_INVALIDA', 'extension png');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A002'), t.id_consent('A002'), t.ruta('consentimientos', 'A002', 4, 'jpg')) $q$,
    'P0001:RUTA_INVALIDA', 'prefijo de consentimientos');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A002'), t.id_consent('A002'), NULL) $q$, 'P0001:RUTA_INVALIDA', 'ruta nula');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A002'), t.id_consent('A002'), repeat('a', 300)) $q$, 'P0001:RUTA_INVALIDA', 'ruta de 300 caracteres');
-- atomicidad: si el consentimiento deja de ser vigente, la plantilla activa NO se archiva
SELECT t.as_postgres();
UPDATE public.consentimiento SET estatus = 'revocado' WHERE id_consent = t.id_consent('A004');
SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A004'), t.id_consent('A004'), t.ruta('registro', 'A004', 4, 'jpg')) $q$,
    'P0001:RN_13_CONSENTIMIENTO_NO_VIGENTE', 'A004 sin consentimiento vigente');
SELECT t.ok((SELECT count(*) = 1 FROM public.plantilla_facial WHERE id_alumno = t.id_alumno('A004') AND activa),
    'el rechazo no archiva la plantilla activa (validar antes de escribir)');
SELECT t.as_postgres();
UPDATE public.alumno SET estatus = 'egresado' WHERE id_alumno = t.id_alumno('A002');
SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A002'), t.id_consent('A002'), t.ruta('registro', 'A002', 5, 'jpg')) $q$,
    'P0001:ALUMNO_INACTIVO', 'alumno egresado');
-- roles
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A001'), t.id_consent('A001'), t.ruta('registro', 'A001', 9, 'jpg')) $q$,
    'P0001:NO_AUTORIZADO', 'docente titular no da de alta');
SELECT t.as_user('docente2@susan.test');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A001'), t.id_consent('A001'), t.ruta('registro', 'A001', 9, 'jpg')) $q$,
    'P0001:NO_AUTORIZADO', 'docente ajeno no da de alta');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A001'), t.id_consent('A001'), t.ruta('registro', 'A001', 9, 'jpg')) $q$,
    'P0001:NO_AUTORIZADO', 'alumno propio no da de alta');
SELECT t.as_user('alumno2@susan.test');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(t.id_alumno('A001'), t.id_consent('A001'), 'x') $q$, 'P0001:NO_AUTORIZADO', 'alumno ajeno');
SELECT t.as_user('tecnico@susan.test');
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(1, 1, 'x') $q$, 'P0001:NO_AUTORIZADO', 'tecnico no da de alta');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.api_plantilla_registrar(1, 1, 'x') $q$, '42501', 'anon sin EXECUTE');

-- ---- Red de seguridad (escritura directa, como postgres) ----
SELECT t.as_postgres();
SELECT t.throws($q$ INSERT INTO public.plantilla_facial (id_alumno, id_consent, objeto_foto) VALUES (t.id_alumno('A001'), t.id_consent('A001'), 'x') $q$,
    '23505:ux_plantilla_facial_activa', 'insertar sin archivar la anterior falla (orden archivar-insertar)');
SELECT t.throws($q$ INSERT INTO public.plantilla_facial (id_alumno, id_consent, objeto_foto) VALUES (t.id_alumno('A005'), t.id_consent('A005'), 'x') $q$,
    '23514:rn13_plantilla_consentimiento_no_vigente', 'trigger RN-13 como red de seguridad');
SELECT t.throws($q$ INSERT INTO public.plantilla_facial (id_alumno, id_consent, objeto_foto) VALUES (t.id_alumno('A005'), t.id_consent('A001'), 'x') $q$,
    '23514:rn13_plantilla_consentimiento_ajeno', 'trigger RN-13: consentimiento ajeno');

-- ---- api_plantilla_alumno (estado de fixtures + tras reemplazos) ----
SELECT t.as_postgres();
UPDATE public.alumno SET estatus = 'activo' WHERE id_alumno = t.id_alumno('A002');
UPDATE public.consentimiento SET estatus = 'vigente' WHERE id_consent = t.id_consent('A004');
SELECT t.as_user('admin@susan.test');
SELECT t.eq((public.api_plantilla_alumno(t.id_alumno('A004')) #>> '{activa,version_indice}'), 'v001', 'A004: plantilla indexada en v001');
SELECT t.ok((public.api_plantilla_alumno(t.id_alumno('A004')) #>> '{activa,en_uso}')::boolean, 'A004: su indice esta en uso');
SELECT t.ok((public.api_plantilla_alumno(t.id_alumno('A004')) #>> '{activa,indexada}')::boolean, 'A004: indexada');
SELECT t.eq((public.api_plantilla_alumno(t.id_alumno('A004')) #>> '{activa,faiss_id}')::int, 1, 'A004: faiss_id 1');
SELECT t.ok((public.api_plantilla_alumno(t.id_alumno('A004')) #>> '{activa,consentimiento_vigente}')::boolean, 'A004: consentimiento vigente');
SELECT t.eq((public.api_plantilla_alumno(t.id_alumno('A004')) #>> '{indice_en_uso,version}'), 'v001', 'indice_en_uso');
SELECT t.eq((public.api_plantilla_alumno(t.id_alumno('A004')) #>> '{archivadas,total}')::int, 0, 'A004 sin archivadas');
SELECT t.ok(public.api_plantilla_alumno(t.id_alumno('A005')) -> 'activa' = 'null'::jsonb, 'A005: sin plantilla activa');
SELECT t.ok(NOT (public.api_plantilla_alumno(t.id_alumno('A001')) #>> '{activa,indexada}')::boolean, 'A001 tras reemplazo: pendiente de indexar');
SELECT t.ok(public.api_plantilla_alumno(t.id_alumno('A001')) #> '{activa,version_indice}' = 'null'::jsonb, 'A001 pendiente: sin version de indice');
SELECT t.eq((public.api_plantilla_alumno(t.id_alumno('A001')) #>> '{archivadas,total}')::int, 2, 'A001: 2 archivadas');
SELECT t.eq(jsonb_array_length(public.api_plantilla_alumno(t.id_alumno('A001'), 1, 0) #> '{archivadas,items}'), 1, 'archivadas paginadas (limit 1)');
SELECT t.eq((public.api_plantilla_alumno(t.id_alumno('A001'), 1, 0) #>> '{archivadas,total}')::int, 2, 'total no depende del limit');
SELECT t.throws($q$ SELECT public.api_plantilla_alumno(999999) $q$, 'P0001:NO_ENCONTRADO', 'alumno inexistente');
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT public.api_plantilla_alumno(t.id_alumno('A001')) $q$, 'P0001:NO_AUTORIZADO', 'docente titular no consulta la plantilla por RPC');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ SELECT public.api_plantilla_alumno(t.id_alumno('A001')) $q$, 'P0001:NO_AUTORIZADO', 'alumno propio tampoco');
SELECT t.as_user('tecnico@susan.test');
SELECT t.throws($q$ SELECT public.api_plantilla_alumno(1) $q$, 'P0001:NO_AUTORIZADO', 'tecnico no');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.api_plantilla_alumno(1) $q$, '42501', 'anon sin EXECUTE');

-- ---- api_documento_url_autorizar ----
SELECT t.as_user('admin@susan.test');
SELECT t.eq((public.api_documento_url_autorizar('consentimiento', t.id_consent('A002')) ->> 'objeto'),
    'consentimientos/' || t.id_alumno('A002') || '/fixture.pdf', 'devuelve la ruta del consentimiento');
SELECT t.eq((public.api_documento_url_autorizar('consentimiento', t.id_consent('A002')) ->> 'vigencia_seg')::int, 300, 'vigencia por defecto 300 s');
SELECT t.eq((public.api_documento_url_autorizar('plantilla', t.id_plantilla('A004')) ->> 'id_alumno')::int, t.id_alumno('A004'), 'plantilla: id_alumno');
SELECT t.eq((SELECT count(*)::int FROM public.bitacora_auditoria WHERE accion = 'consulta' AND entidad = 'consentimiento'
              AND id_registro = t.id_consent('A002')), 2, 'cada emision asienta consulta (consentimiento x2)');
SELECT t.eq((SELECT count(*)::int FROM public.bitacora_auditoria WHERE accion = 'consulta' AND entidad = 'plantilla_facial'
              AND id_registro = t.id_plantilla('A004') AND valor_nuevo ->> 'id_alumno' = t.id_alumno('A004')::text), 1, 'consulta de plantilla en bitacora');
SELECT t.eq((SELECT id_usuario FROM public.bitacora_auditoria WHERE accion = 'consulta' AND entidad = 'plantilla_facial' ORDER BY id_bitacora DESC LIMIT 1),
    t.id_usuario('admin@susan.test'), 'consulta a nombre del administrador');
SELECT public.api_documento_url_autorizar('consentimiento', t.id_consent('A001'), '10.9.8.7'::inet);
SELECT t.eq((SELECT ip_origen FROM public.bitacora_auditoria WHERE accion = 'consulta' ORDER BY id_bitacora DESC LIMIT 1), '10.9.8.7', 'consulta guarda la IP');
SELECT t.as_postgres();
UPDATE public.parametro_sistema SET valor = '120' WHERE clave = 'vigencia_url_firmada_seg';
SELECT t.as_user('admin@susan.test');
SELECT t.eq((public.api_documento_url_autorizar('consentimiento', t.id_consent('A002')) ->> 'vigencia_seg')::int, 120, 'respeta el parametro menor a 300');
SELECT t.as_postgres();
UPDATE public.parametro_sistema SET valor = '900' WHERE clave = 'vigencia_url_firmada_seg';
SELECT t.as_user('admin@susan.test');
SELECT t.eq((public.api_documento_url_autorizar('consentimiento', t.id_consent('A002')) ->> 'vigencia_seg')::int, 300, 'tope de 300 s aunque el parametro sea mayor (RNF-04)');
SELECT t.throws($q$ SELECT public.api_documento_url_autorizar('justificante', 1) $q$, 'P0001:VALIDACION', 'tipo invalido');
SELECT t.throws($q$ SELECT public.api_documento_url_autorizar(NULL, 1) $q$, 'P0001:VALIDACION', 'tipo nulo');
SELECT t.throws($q$ SELECT public.api_documento_url_autorizar('consentimiento', 999999) $q$, 'P0001:NO_ENCONTRADO', 'consentimiento inexistente');
SELECT t.throws($q$ SELECT public.api_documento_url_autorizar('plantilla', 999999) $q$, 'P0001:NO_ENCONTRADO', 'plantilla inexistente');
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT public.api_documento_url_autorizar('plantilla', 1) $q$, 'P0001:NO_AUTORIZADO', 'docente no obtiene fotos');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ SELECT public.api_documento_url_autorizar('consentimiento', t.id_consent('A001')) $q$, 'P0001:NO_AUTORIZADO', 'alumno no obtiene ni su documento');
SELECT t.as_user('tecnico@susan.test');
SELECT t.throws($q$ SELECT public.api_documento_url_autorizar('plantilla', 1) $q$, 'P0001:NO_AUTORIZADO', 'tecnico no obtiene fotos');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.api_documento_url_autorizar('plantilla', 1) $q$, '42501', 'anon sin EXECUTE');
SELECT t.summary();
ROLLBACK;
