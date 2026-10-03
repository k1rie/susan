-- api_b2_03 · consola tecnica: parametros (3.8, 3.9), camaras (3.10, 3.11) y estado del indice (3.7).
BEGIN;
SELECT t.begin('api_b2_03_parametros_camaras');
SELECT t.cargar_fixtures();

-- =============================== Parametros ===============================
SELECT t.as_user('tecnico@susan.test');
SELECT t.eq((public.api_parametros_listar() ->> 'total')::int, 12, 'listar: 12 parametros');
SELECT t.eq((public.api_parametros_listar() -> 'items' -> 0 ->> 'clave'), 'umbral_similitud', 'listar: orden de la Tabla 4');
SELECT t.eq((public.api_parametros_listar() -> 'items' -> 11 ->> 'clave'), 'minutos_pase_lista_base', 'listar: ultimo parametro');
SELECT t.eq((public.api_parametros_listar() -> 'items' -> 0 ->> 'minimo'), '0.500', 'listar: minimo del metadato');
SELECT t.eq((public.api_parametros_listar() -> 'items' -> 4 ->> 'unidad'), 'segundos', 'listar: unidad');
SELECT t.ok(public.api_parametros_listar() -> 'items' -> 0 -> 'actualizado_por' = 'null'::jsonb, 'listar: valores iniciales sin editor');
SELECT t.eq(jsonb_array_length(public.api_parametros_listar(5, 10) -> 'items'), 2, 'listar: paginado (offset 10 de 12)');
SELECT t.eq((public.api_parametros_listar(5, 10) ->> 'total')::int, 12, 'listar: total independiente de la pagina');

-- actualizar: valor canonico, bitacora, advertencias
SELECT t.eq((public.api_parametro_actualizar('umbral_similitud', '0.9') ->> 'valor'), '0.900', 'canonico 0.9 -> 0.900');
SELECT t.eq((SELECT valor FROM public.parametro_sistema WHERE clave = 'umbral_similitud'), '0.900', 'valor guardado');
SELECT t.eq(app.param_num('umbral_similitud'), 0.9::numeric, 'app.param_num ve el cambio');
SELECT t.as_postgres();
SELECT t.eq((SELECT count(*)::int FROM public.bitacora_auditoria WHERE accion = 'cambio_parametro' AND entidad = 'parametro_sistema'
              AND id_registro = 0 AND valor_anterior ->> 'valor' = '0.850' AND valor_nuevo ->> 'valor' = '0.900'
              AND valor_nuevo ->> 'clave' = 'umbral_similitud' AND id_usuario = t.id_usuario('tecnico@susan.test')), 1,
    'bitacora cambio_parametro con anterior y nuevo, id_registro 0');
SELECT t.as_user('tecnico@susan.test');
SELECT t.eq((public.api_parametros_listar() -> 'items' -> 0 #>> '{actualizado_por,correo}'), 'tecnico@susan.test', 'listar: ultimo editor');
SELECT t.eq((public.api_parametro_actualizar('umbral_similitud', '0.95') ->> 'valor_anterior'), '0.900', 'valor_anterior');
SELECT t.eq(jsonb_array_length(public.api_parametro_actualizar('umbral_similitud', '0.96') -> 'advertencias'), 1, 'umbral: 1 advertencia');
-- sin cambio real: no escribe ni asienta
SELECT t.as_postgres();
SELECT set_config('t.bit', (SELECT count(*)::text FROM public.bitacora_auditoria WHERE accion = 'cambio_parametro'), true);
SELECT t.as_user('tecnico@susan.test');
SELECT t.ok(NOT (public.api_parametro_actualizar('umbral_similitud', '0.960') ->> 'cambio')::boolean, 'mismo valor canonico: cambio = false');
SELECT t.ok(NOT (public.api_parametro_actualizar('umbral_similitud', ' 0.96 ') ->> 'cambio')::boolean, 'espacios recortados: sin cambio');
SELECT t.as_postgres();
SELECT t.eq((SELECT count(*)::int FROM public.bitacora_auditoria WHERE accion = 'cambio_parametro'), current_setting('t.bit')::int,
    'sin cambio no hay bitacora');
SELECT t.as_user('tecnico@susan.test');
-- limites: decimal 0.500..0.999, 3 decimales
SELECT t.lives_rb($q$ SELECT public.api_parametro_actualizar('umbral_similitud', '0.500') $q$, 'umbral 0.500 valido');
SELECT t.lives_rb($q$ SELECT public.api_parametro_actualizar('umbral_similitud', '0.999') $q$, 'umbral 0.999 valido');
SELECT t.throws($q$ SELECT public.api_parametro_actualizar('umbral_similitud', '0.499') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO', 'umbral 0.499');
SELECT t.throws($q$ SELECT public.api_parametro_actualizar('umbral_similitud', '1.000') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO', 'umbral 1.000');
SELECT t.throws($q$ SELECT public.api_parametro_actualizar('umbral_similitud', '0.8501') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO', 'umbral con 4 decimales');
SELECT t.throws($q$ SELECT public.api_parametro_actualizar('umbral_similitud', 'abc') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO', 'umbral no numerico');
SELECT t.throws($q$ SELECT public.api_parametro_actualizar('umbral_similitud', NULL) $q$, 'P0001:PARAMETRO_VALOR_INVALIDO', 'valor nulo');
SELECT t.throws($q$ SELECT public.api_parametro_actualizar('umbral_similitud', '0.8; DROP TABLE alumno') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO', 'inyeccion en valor');
-- enteros
SELECT t.lives_rb($q$ SELECT public.api_parametro_actualizar('intervalo_muestreo_seg', '5') $q$, 'intervalo 5 valido');
SELECT t.lives_rb($q$ SELECT public.api_parametro_actualizar('intervalo_muestreo_seg', '120') $q$, 'intervalo 120 valido');
SELECT t.throws($q$ SELECT public.api_parametro_actualizar('intervalo_muestreo_seg', '4') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO', 'intervalo 4');
SELECT t.throws($q$ SELECT public.api_parametro_actualizar('intervalo_muestreo_seg', '121') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO', 'intervalo 121');
SELECT t.throws($q$ SELECT public.api_parametro_actualizar('intervalo_muestreo_seg', '15.5') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO', 'intervalo decimal');
SELECT t.throws($q$ SELECT public.api_parametro_actualizar('intervalo_muestreo_seg', '-1') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO', 'intervalo negativo');
SELECT t.throws($q$ SELECT public.api_parametro_actualizar('intervalo_muestreo_seg', '') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO', 'intervalo vacio');
SELECT t.throws($q$ SELECT public.api_parametro_actualizar('min_detecciones_validas', '0') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO', 'min_detecciones 0');
SELECT t.lives_rb($q$ SELECT public.api_parametro_actualizar('min_detecciones_validas', '10') $q$, 'min_detecciones 10 valido');
SELECT t.throws($q$ SELECT public.api_parametro_actualizar('min_detecciones_validas', '11') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO', 'min_detecciones 11');
SELECT t.lives_rb($q$ SELECT public.api_parametro_actualizar('vigencia_url_firmada_seg', '300') $q$, 'vigencia URL 300 valida');
SELECT t.throws($q$ SELECT public.api_parametro_actualizar('vigencia_url_firmada_seg', '301') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO', 'vigencia URL 301 (RNF-04)');
SELECT t.throws($q$ SELECT public.api_parametro_actualizar('vigencia_url_firmada_seg', '29') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO', 'vigencia URL 29');
-- coherencia limite_presente_min < tolerancia_min (10 y 20 iniciales)
SELECT t.lives_rb($q$ SELECT public.api_parametro_actualizar('limite_presente_min', '19') $q$, 'limite 19 < tolerancia 20');
SELECT t.throws($q$ SELECT public.api_parametro_actualizar('limite_presente_min', '20') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO:menor que tolerancia_min', 'limite = tolerancia rechazado');
SELECT t.lives_rb($q$ SELECT public.api_parametro_actualizar('tolerancia_min', '11') $q$, 'tolerancia 11 > limite 10');
SELECT t.throws($q$ SELECT public.api_parametro_actualizar('tolerancia_min', '10') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO:mayor que limite_presente_min', 'tolerancia = limite rechazada');
-- advertencias por clave
SELECT t.ok((public.api_parametro_actualizar('dimension_vector', '256') -> 'advertencias' ->> 0) LIKE '%reconstruir el índice completo%', 'dimension_vector: advertencia de reconstruccion');
SELECT t.ok((public.api_parametro_actualizar('tolerancia_min', '25') -> 'advertencias' ->> 0) LIKE '%sesiones que se programen después%', 'tolerancia: afecta solo a sesiones nuevas');
SELECT t.eq(jsonb_array_length(public.api_parametro_actualizar('dias_retencion_recortes', '10') -> 'advertencias'), 0, 'sin advertencias para dias_retencion_recortes');
SELECT t.throws($q$ SELECT public.api_parametro_actualizar('no_existe', '1') $q$, 'P0001:PARAMETRO_NO_ENCONTRADO', 'clave desconocida');
SELECT t.throws($q$ SELECT public.api_parametro_actualizar(NULL, '1') $q$, 'P0001:PARAMETRO_NO_ENCONTRADO', 'clave nula');
-- un rechazo no escribe
SELECT t.as_postgres();
SELECT t.eq((SELECT valor FROM public.parametro_sistema WHERE clave = 'intervalo_muestreo_seg'), '15', 'rechazos y rollbacks dejan el valor intacto');
-- roles: el administrador solo consulta; docentes y alumnos nada
SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ SELECT public.api_parametro_actualizar('umbral_similitud', '0.9') $q$, 'P0001:NO_AUTORIZADO', 'administrador no cambia parametros (Tabla 36)');
SELECT t.eq((public.api_parametros_listar() ->> 'total')::int, 12, 'administrador si consulta');
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT public.api_parametro_actualizar('umbral_similitud', '0.9') $q$, 'P0001:NO_AUTORIZADO', 'docente no cambia parametros');
SELECT t.throws($q$ SELECT public.api_parametros_listar() $q$, 'P0001:NO_AUTORIZADO', 'docente no lista parametros');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ SELECT public.api_parametro_actualizar('umbral_similitud', '0.9') $q$, 'P0001:NO_AUTORIZADO', 'alumno no cambia parametros');
SELECT t.throws($q$ SELECT public.api_parametros_listar() $q$, 'P0001:NO_AUTORIZADO', 'alumno no lista parametros');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.api_parametro_actualizar('umbral_similitud', '0.9') $q$, '42501', 'anon no actualiza');
SELECT t.throws($q$ SELECT public.api_parametros_listar() $q$, '42501', 'anon no lista');

-- =============================== Camaras ===============================
SELECT t.as_user('tecnico@susan.test');
SELECT t.eq((public.api_camaras_estado() ->> 'total')::int, 3, 'camaras: total 3');
SELECT t.eq((public.api_camaras_estado() -> 'items' -> 0 ->> 'aula_clave'), 'A-12', 'orden: aula');
SELECT t.eq((public.api_camaras_estado() -> 'items' -> 0 ->> 'posicion'), 'frente', 'orden: posicion');
SELECT t.eq((public.api_camaras_estado() -> 'items' -> 0 ->> 'capturas_24h')::int, 2, 'frente A-12: 2 capturas en 24 h');
SELECT t.ok((public.api_camaras_estado() -> 'items' -> 0 ->> 'ultima_captura') IS NOT NULL, 'frente A-12: ultima captura');
SELECT t.eq((public.api_camaras_estado() -> 'items' -> 1 ->> 'capturas_24h')::int, 0, 'fondo A-12: sin capturas');
SELECT t.ok(public.api_camaras_estado() -> 'items' -> 1 -> 'ultima_captura' = 'null'::jsonb, 'fondo A-12: ultima_captura null');
SELECT t.ok(public.api_camaras_estado() -> 'items' -> 1 -> 'direccion_ip' = 'null'::jsonb, 'navegador: direccion_ip null');
SELECT t.eq((public.api_camaras_estado() -> 'items' -> 0 ->> 'direccion_ip'), '10.20.0.12', 'ip: direccion');
SELECT t.ok((public.api_camaras_estado() -> 'items' -> 0 ->> 'sesion_abierta')::boolean, 'A-12: sesion abierta');
SELECT t.eq((public.api_camaras_estado('inactiva') ->> 'total')::int, 1, 'filtro por estatus inactiva');
SELECT t.eq((public.api_camaras_estado('inactiva') -> 'items' -> 0 ->> 'aula_clave'), 'B-04', 'filtro: B-04');
SELECT t.eq(jsonb_array_length(public.api_camaras_estado(NULL, 1, 1) -> 'items'), 1, 'paginado');
SELECT t.eq((public.api_camaras_estado('mantenimiento') ->> 'total')::int, 0, 'sin camaras en mantenimiento');
-- ventana de 24 h: una captura de hace 25 h no cuenta; la de exactamente 24 h si
SELECT t.as_postgres();
INSERT INTO public.captura (id_camara, id_sesion, marca_tiempo, rostros_detectados) VALUES
    (t.id_camara('A-12', 'frente'), t.id_sesion('3A', '2026-09-07'), '2026-09-13 06:00:00-06', 0),
    (t.id_camara('A-12', 'frente'), t.id_sesion('3A', '2026-09-07'), '2026-09-13 07:12:00-06', 0);
SELECT t.as_user('tecnico@susan.test');
SELECT t.eq((public.api_camaras_estado() -> 'items' -> 0 ->> 'capturas_24h')::int, 3, 'ventana: 25 h fuera, 24 h exactas dentro');
-- cambiar estatus
SELECT t.eq((public.api_camara_cambiar_estatus(t.id_camara('A-12', 'fondo'), 'mantenimiento') ->> 'estatus_anterior'), 'activa', 'cambiar: estatus anterior');
SELECT t.eq((SELECT estatus::text FROM public.camara WHERE id_camara = t.id_camara('A-12', 'fondo')), 'mantenimiento', 'cambiar: persistido');
SELECT t.ok((SELECT direccion_ip IS NULL AND tipo = 'navegador' AND posicion = 'fondo' FROM public.camara WHERE id_camara = t.id_camara('A-12', 'fondo')),
    'solo cambia el estatus (tipo, ip y posicion intactos)');
SELECT t.eq(jsonb_array_length(public.api_camara_cambiar_estatus(t.id_camara('A-12', 'frente'), 'inactiva') -> 'advertencias'), 1, 'aviso por sesion abierta en el aula');
SELECT t.ok(NOT (public.api_camara_cambiar_estatus(t.id_camara('A-12', 'frente'), 'inactiva') ->> 'cambio')::boolean, 'mismo estatus: cambio = false');
SELECT t.eq((public.api_camaras_estado('inactiva') ->> 'total')::int, 2, 'filtro refleja el cambio');
SELECT t.as_postgres();
UPDATE public.sesion_clase SET estatus = 'cerrada' WHERE estatus = 'abierta';
SELECT t.as_user('tecnico@susan.test');
SELECT t.eq(jsonb_array_length(public.api_camara_cambiar_estatus(t.id_camara('B-04', 'frente'), 'activa') -> 'advertencias'), 0, 'sin sesion abierta: sin avisos');
SELECT t.ok(NOT (public.api_camaras_estado() -> 'items' -> 0 ->> 'sesion_abierta')::boolean, 'sesion_abierta false al cerrar');
SELECT t.throws($q$ SELECT public.api_camara_cambiar_estatus(999999, 'activa') $q$, 'P0001:NO_ENCONTRADO', 'camara inexistente');
SELECT t.throws($q$ SELECT public.api_camara_cambiar_estatus(1, NULL) $q$, 'P0001:VALIDACION', 'estatus nulo');
SELECT t.throws($q$ SELECT public.api_camara_cambiar_estatus(1, 'rota') $q$, '22P02', 'estatus fuera del enum');
SELECT t.as_user('admin@susan.test');
SELECT t.lives_rb($q$ SELECT public.api_camara_cambiar_estatus(t.id_camara('B-04', 'frente'), 'mantenimiento') $q$, 'administrador tambien cambia estatus');
SELECT t.eq((public.api_camaras_estado() ->> 'total')::int, 3, 'administrador consulta camaras');
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT public.api_camara_cambiar_estatus(1, 'activa') $q$, 'P0001:NO_AUTORIZADO', 'docente no cambia estatus');
SELECT t.throws($q$ SELECT public.api_camaras_estado() $q$, 'P0001:NO_AUTORIZADO', 'docente no lista camaras por esta RPC');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ SELECT public.api_camara_cambiar_estatus(1, 'activa') $q$, 'P0001:NO_AUTORIZADO', 'alumno no cambia estatus');
SELECT t.throws($q$ SELECT public.api_camaras_estado() $q$, 'P0001:NO_AUTORIZADO', 'alumno no lista camaras');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.api_camara_cambiar_estatus(1, 'activa') $q$, '42501', 'anon no cambia');
SELECT t.throws($q$ SELECT public.api_camaras_estado() $q$, '42501', 'anon no lista');

-- =============================== Estado del indice ===============================
SELECT t.as_postgres();
UPDATE public.parametro_sistema SET valor = '512' WHERE clave = 'dimension_vector';
SELECT t.as_user('tecnico@susan.test');
SELECT t.eq((public.api_indice_estado() #>> '{en_uso,version}'), 'v001', 'estado: version en uso');
SELECT t.eq((public.api_indice_estado() #>> '{plantillas,activas}')::int, 2, 'estado: 2 activas');
SELECT t.eq((public.api_indice_estado() #>> '{plantillas,indexadas}')::int, 2, 'estado: 2 indexadas');
SELECT t.eq((public.api_indice_estado() #>> '{plantillas,pendientes}')::int, 0, 'estado: 0 pendientes');
SELECT t.ok(NOT (public.api_indice_estado() ->> 'requiere_reconstruccion')::boolean, 'estado: no requiere reconstruccion');
SELECT t.ok((public.api_indice_estado() ->> 'dimension_coincide')::boolean, 'dimension coincide');
SELECT t.eq((public.api_indice_estado() #>> '{versiones,total}')::int, 2, 'estado: 2 versiones');
SELECT t.eq((public.api_indice_estado() #>> '{versiones,items,0,version}'), 'v002', 'versiones: mas reciente primero');
SELECT t.eq((public.api_indice_estado(1, 1) #>> '{versiones,items,0,version}'), 'v001', 'versiones: offset');
-- plantilla archivada que sigue en el indice en uso => obsoleta
SELECT t.as_postgres();
UPDATE public.plantilla_facial SET activa = false WHERE id_alumno = t.id_alumno('A001');
SELECT t.as_user('tecnico@susan.test');
SELECT t.eq((public.api_indice_estado() #>> '{plantillas,obsoletas_en_indice}')::int, 1, 'archivada en el indice: obsoleta');
SELECT t.ok((public.api_indice_estado() ->> 'requiere_reconstruccion')::boolean, 'obsoleta => requiere reconstruccion');
-- pendiente: activa sin indexar
SELECT t.as_postgres();
INSERT INTO public.plantilla_facial (id_alumno, id_consent, objeto_foto) VALUES (t.id_alumno('A002'), t.id_consent('A002'), 'registro/x/00000000-0000-4000-8000-000000000001.jpg');
SELECT t.as_user('admin@susan.test');
SELECT t.eq((public.api_indice_estado() #>> '{plantillas,pendientes}')::int, 1, 'estado: 1 pendiente');
SELECT t.eq(jsonb_array_length(public.api_indice_estado() -> 'pendientes_detalle'), 1, 'detalle de pendientes');
SELECT t.ok(NOT (public.api_indice_estado() -> 'pendientes_detalle' -> 0) ?| ARRAY['matricula', 'nombres', 'objeto_foto'], 'el detalle no expone datos personales ni rutas');
-- dimension distinta
SELECT t.as_postgres();
UPDATE public.parametro_sistema SET valor = '256' WHERE clave = 'dimension_vector';
SELECT t.as_user('tecnico@susan.test');
SELECT t.ok(NOT (public.api_indice_estado() ->> 'dimension_coincide')::boolean, 'dimension configurada distinta: no coincide');
-- sin indice en uso
SELECT t.as_postgres();
UPDATE public.indice_faiss SET en_uso = false;
SELECT t.as_user('tecnico@susan.test');
SELECT t.ok(public.api_indice_estado() -> 'en_uso' = 'null'::jsonb, 'sin indice: en_uso null');
SELECT t.ok((public.api_indice_estado() ->> 'requiere_reconstruccion')::boolean, 'sin indice: requiere reconstruccion');
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT public.api_indice_estado() $q$, 'P0001:NO_AUTORIZADO', 'docente no ve el estado del indice');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ SELECT public.api_indice_estado() $q$, 'P0001:NO_AUTORIZADO', 'alumno no ve el estado del indice');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.api_indice_estado() $q$, '42501', 'anon no ve el estado');
SELECT t.summary();
ROLLBACK;
