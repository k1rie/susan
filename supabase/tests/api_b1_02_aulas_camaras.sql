-- api_b1_02: aulas y camaras (RF-22). Posicion unica por aula, IP solo para tipo ip, roles.
BEGIN;
SELECT t.begin('api_b1_02_aulas_camaras');
SELECT t.cargar_fixtures();
SELECT t.id_aula('A-12') AS a12, t.id_aula('B-04') AS b04, t.id_camara('A-12', 'fondo') AS cfondo, t.id_camara('A-12', 'frente') AS cfrente,
       t.id_camara('B-04', 'frente') AS cb04 \gset

SELECT t.as_user('admin@susan.test');
SELECT t.eq((public.api_aulas_listar() ->> 'total')::int, 2, 'admin lista 2 aulas');
SELECT t.eq((public.api_aulas_listar(p_q => 'A-12') -> 'items' -> 0 ->> 'camaras_activas')::int, 2, 'A-12 con 2 camaras activas');
SELECT t.eq((public.api_aulas_listar(p_q => 'B-04') -> 'items' -> 0 ->> 'camaras_activas')::int, 0, 'B-04 sin camaras activas');
SELECT t.eq((public.api_aulas_listar(p_q => 'B-04') -> 'items' -> 0 ->> 'camaras_total')::int, 1, 'B-04 con 1 camara');
SELECT t.eq(public.api_aula_obtener(:a12) ->> 'clave', 'A-12', 'obtener aula');
SELECT t.eq(jsonb_array_length(public.api_aula_obtener(:a12) -> 'camaras'), 2, 'aula con sus camaras');
SELECT t.eq(public.api_aula_obtener(:a12) -> 'camaras' -> 0 ->> 'direccion_ip', '10.20.0.12', 'admin ve la IP (frente primero)');
SELECT t.throws($q$ SELECT public.api_aula_obtener(999999) $q$, 'P0001:NO_ENCONTRADO', 'aula inexistente');

-- alta y validaciones de aula
SELECT t.efecto($q$ SELECT public.api_aula_guardar('{"clave":"c-01","edificio":"C","capacidad":30}') $q$,
    $q$ SELECT EXISTS (SELECT 1 FROM public.aula WHERE clave = 'C-01' AND capacidad = 30) $q$, 'alta de aula (clave en mayusculas)');
SELECT t.throws($q$ SELECT public.api_aula_guardar('{"clave":"A-12","edificio":"X","capacidad":30}') $q$, 'P0001:DUPLICADO', 'clave de aula duplicada');
SELECT t.throws($q$ SELECT public.api_aula_guardar('{"clave":"C-01","edificio":"C","capacidad":0}') $q$, 'P0001:VALIDACION', 'capacidad 0');
SELECT t.throws($q$ SELECT public.api_aula_guardar('{"clave":"C-01","edificio":"C","capacidad":-4}') $q$, 'P0001:VALIDACION', 'capacidad negativa');
SELECT t.throws($q$ SELECT public.api_aula_guardar('{"clave":"C-01","capacidad":10}') $q$, 'P0001:VALIDACION', 'falta edificio');
SELECT t.throws($q$ SELECT public.api_aula_guardar('{"clave":"AULA-MUY-LARGA","edificio":"C","capacidad":10}') $q$, 'P0001:VALIDACION', 'clave > 10');
SELECT t.throws($q$ SELECT public.api_aula_guardar('{"id_aula":999999,"capacidad":10}') $q$, 'P0001:NO_ENCONTRADO', 'modificar aula inexistente');
SELECT t.efecto(format($q$ SELECT public.api_aula_guardar('{"id_aula":%s,"capacidad":4}') $q$, :a12),
    $q$ SELECT EXISTS (SELECT 1 FROM public.aula WHERE clave = 'A-12' AND capacidad = 4 AND edificio = 'A') $q$, 'capacidad igual a los inscritos activos (4): permitida');
SELECT t.throws(format($q$ SELECT public.api_aula_guardar('{"id_aula":%s,"capacidad":3}') $q$, :a12), 'P0001:AULA_CAPACIDAD_INSUFICIENTE', 'capacidad menor que los inscritos activos');

-- camaras: alta
SELECT t.efecto(format($q$ SELECT public.api_camara_guardar('{"id_aula":%s,"posicion":"fondo","tipo":"ip","direccion_ip":"10.20.0.5"}') $q$, :b04),
    $q$ SELECT EXISTS (SELECT 1 FROM public.camara WHERE direccion_ip = '10.20.0.5' AND estatus = 'activa' AND posicion = 'fondo') $q$, 'alta de camara ip (nace activa)');
SELECT t.efecto(format($q$ SELECT public.api_camara_guardar('{"id_aula":%s,"posicion":"fondo","tipo":"navegador","direccion_ip":"10.20.0.77"}') $q$, :b04),
    $q$ SELECT EXISTS (SELECT 1 FROM public.camara WHERE posicion = 'fondo' AND id_aula = (SELECT id_aula FROM public.aula WHERE clave = 'B-04') AND tipo = 'navegador' AND direccion_ip IS NULL) $q$,
    'camara navegador: la IP se descarta');
-- camaras: rechazos
SELECT t.throws(format($q$ SELECT public.api_camara_guardar('{"id_aula":%s,"posicion":"frente","tipo":"navegador"}') $q$, :a12),
    'P0001:CAMARA_POSICION_DUPLICADA', 'segunda camara frente en el aula rechazada');
SELECT t.throws(format($q$ SELECT public.api_camara_guardar('{"id_aula":%s,"posicion":"fondo","tipo":"ip","direccion_ip":"10.20.0.50"}') $q$, :a12),
    'P0001:CAMARA_POSICION_DUPLICADA', 'segunda camara fondo en el aula rechazada');
SELECT t.throws(format($q$ SELECT public.api_camara_guardar('{"id_aula":%s,"posicion":"fondo","tipo":"ip"}') $q$, :b04),
    'P0001:CAMARA_IP_REQUERIDA', 'camara ip sin direccion rechazada');
SELECT t.throws(format($q$ SELECT public.api_camara_guardar('{"id_aula":%s,"posicion":"fondo"}') $q$, :b04),
    'P0001:CAMARA_IP_REQUERIDA', 'tipo por omision ip: exige direccion');
SELECT t.throws(format($q$ SELECT public.api_camara_guardar('{"id_aula":%s,"posicion":"fondo","tipo":"ip","direccion_ip":"10.20.0.12"}') $q$, :b04),
    'P0001:DUPLICADO', 'IP ya usada por otra camara');
SELECT t.throws(format($q$ SELECT public.api_camara_guardar('{"id_aula":%s,"posicion":"fondo","tipo":"ip","direccion_ip":"no-es-ip"}') $q$, :b04),
    'P0001:VALIDACION', 'IP invalida');
SELECT t.throws(format($q$ SELECT public.api_camara_guardar('{"id_aula":%s,"posicion":"fondo","tipo":"ip","direccion_ip":"10.0.0.0/24"}') $q$, :b04),
    'P0001:VALIDACION', 'IP con mascara rechazada');
SELECT t.throws(format($q$ SELECT public.api_camara_guardar('{"id_aula":%s,"posicion":"lado","tipo":"ip","direccion_ip":"10.1.1.1"}') $q$, :b04),
    'P0001:VALIDACION', 'posicion invalida');
SELECT t.throws(format($q$ SELECT public.api_camara_guardar('{"id_aula":%s,"posicion":"fondo","tipo":"wifi","direccion_ip":"10.1.1.1"}') $q$, :b04),
    'P0001:VALIDACION', 'tipo invalido');
SELECT t.throws($q$ SELECT public.api_camara_guardar('{"posicion":"fondo","tipo":"navegador"}') $q$, 'P0001:VALIDACION', 'falta id_aula');
SELECT t.throws($q$ SELECT public.api_camara_guardar('{"id_aula":999999,"posicion":"fondo","tipo":"navegador"}') $q$, 'P0001:NO_ENCONTRADO', 'aula inexistente');
SELECT t.throws(format($q$ SELECT public.api_camara_guardar('{"id_aula":%s,"tipo":"navegador"}') $q$, :b04), 'P0001:VALIDACION', 'falta posicion en alta');
-- camaras: modificacion
SELECT t.throws(format($q$ SELECT public.api_camara_guardar('{"id_camara":%s,"posicion":"frente"}') $q$, :cfondo), 'P0001:CAMARA_POSICION_DUPLICADA', 'mover fondo a frente ocupado');
SELECT t.throws(format($q$ SELECT public.api_camara_guardar('{"id_camara":%s,"tipo":"ip"}') $q$, :cfondo), 'P0001:CAMARA_IP_REQUERIDA', 'cambiar navegador a ip exige IP');
SELECT t.throws(format($q$ SELECT public.api_camara_guardar('{"id_camara":%s,"id_aula":%s}') $q$, :cfondo, :b04), 'P0001:VALIDACION', 'no se cambia de aula');
SELECT t.throws(format($q$ SELECT public.api_camara_guardar('{"id_camara":%s,"direccion_ip":"10.20.0.4"}') $q$, :cfrente), 'P0001:DUPLICADO', 'IP de otra camara');
SELECT t.throws($q$ SELECT public.api_camara_guardar('{"id_camara":999999,"estatus":"activa"}') $q$, 'P0001:NO_ENCONTRADO', 'camara inexistente');
SELECT t.efecto(format($q$ SELECT public.api_camara_guardar('{"id_camara":%s,"estatus":"mantenimiento"}') $q$, :cfrente),
    $q$ SELECT EXISTS (SELECT 1 FROM public.camara WHERE direccion_ip = '10.20.0.12' AND estatus = 'mantenimiento') $q$, 'cambiar estatus conserva la IP');
SELECT t.efecto(format($q$ SELECT public.api_camara_guardar('{"id_camara":%s,"tipo":"navegador"}') $q$, :cfrente),
    $q$ SELECT EXISTS (SELECT 1 FROM public.camara WHERE posicion = 'frente' AND tipo = 'navegador' AND direccion_ip IS NULL
                         AND id_aula = (SELECT id_aula FROM public.aula WHERE clave = 'A-12')) $q$, 'ip a navegador limpia la IP');
SELECT t.efecto(format($q$ SELECT public.api_camara_guardar('{"id_camara":%s,"direccion_ip":"10.20.0.99"}') $q$, :cfrente),
    $q$ SELECT EXISTS (SELECT 1 FROM public.camara WHERE posicion = 'frente' AND direccion_ip = '10.20.0.99') $q$, 'cambiar IP');
SELECT t.efecto(format($q$ SELECT public.api_camara_guardar('{"id_camara":%s,"estatus":"activa"}') $q$, :cb04),
    $q$ SELECT (SELECT estatus FROM public.camara WHERE direccion_ip = '10.20.0.4') = 'activa' $q$, 'activar camara de B-04');
SELECT t.lives(format($q$ SELECT public.api_camara_guardar('{"id_camara":%s,"direccion_ip":"10.20.0.12"}') $q$, :cfrente), 'regrabar la propia IP no es duplicado');

SELECT t.eq((public.api_camaras_listar() ->> 'total')::int, 3, 'listar todas las camaras');
SELECT t.eq((public.api_camaras_listar(:a12) ->> 'total')::int, 2, 'listar camaras de un aula');
SELECT t.eq(public.api_camaras_listar(:a12) -> 'items' -> 0 ->> 'posicion', 'frente', 'frente antes que fondo');
SELECT t.eq(public.api_camaras_listar(:a12) -> 'items' -> 0 ->> 'aula_clave', 'A-12', 'incluye la clave del aula');
SELECT t.throws($q$ SELECT public.api_camaras_listar(999999) $q$, 'P0001:NO_ENCONTRADO', 'aula inexistente al listar camaras');

-- docente titular: lectura de lo suyo, sin IP
SELECT t.as_user('docente1@susan.test');
SELECT t.eq((public.api_aulas_listar() ->> 'total')::int, 1, 'docente: solo el aula de su grupo');
SELECT t.eq(public.api_aula_obtener(:a12) ->> 'clave', 'A-12', 'docente: obtiene su aula');
SELECT t.ok(public.api_aula_obtener(:a12) -> 'camaras' -> 0 -> 'direccion_ip' = 'null'::jsonb, 'docente: la IP de la camara llega null');
SELECT t.eq((public.api_camaras_listar(:a12) ->> 'total')::int, 2, 'docente: ve las camaras de su aula');
SELECT t.ok(public.api_camaras_listar(:a12) -> 'items' -> 0 -> 'direccion_ip' = 'null'::jsonb, 'docente: sin IP al listar camaras');
SELECT t.throws(format($q$ SELECT public.api_camaras_listar(%s) $q$, :b04), 'P0001:NO_ENCONTRADO', 'docente ajeno al aula B-04');
SELECT t.throws(format($q$ SELECT public.api_aula_obtener(%s) $q$, :b04), 'P0001:NO_ENCONTRADO', 'docente: aula ajena no existe para el');
SELECT t.throws($q$ SELECT public.api_aula_guardar('{"clave":"Z-1","edificio":"Z","capacidad":10}') $q$, 'P0001:NO_AUTORIZADO', 'docente no escribe aulas');
SELECT t.throws(format($q$ SELECT public.api_camara_guardar('{"id_camara":%s,"estatus":"inactiva"}') $q$, :cfrente), 'P0001:NO_AUTORIZADO', 'docente no escribe camaras');

SELECT t.as_user('docente2@susan.test');
SELECT t.eq((public.api_camaras_listar() ->> 'total')::int, 1, 'docente2: solo la camara de B-04');
SELECT t.throws(format($q$ SELECT public.api_camaras_listar(%s) $q$, :a12), 'P0001:NO_ENCONTRADO', 'docente2: A-12 no es de sus grupos');

-- el tecnico no administra camaras por esta via
SELECT t.as_user('tecnico@susan.test');
SELECT t.throws(format($q$ SELECT public.api_camara_guardar('{"id_camara":%s,"estatus":"inactiva"}') $q$, :cfrente), 'P0001:NO_AUTORIZADO', 'tecnico no usa api_camara_guardar');
SELECT t.throws($q$ SELECT public.api_camaras_listar() $q$, 'P0001:NO_AUTORIZADO', 'tecnico: sin api_camaras_listar (usa api_camaras_estado)');
SELECT t.throws($q$ SELECT public.api_aulas_listar() $q$, 'P0001:NO_AUTORIZADO', 'tecnico: sin catalogo de aulas');
SELECT t.throws($q$ SELECT public.api_aula_guardar('{"clave":"Z-1","edificio":"Z","capacidad":10}') $q$, 'P0001:NO_AUTORIZADO', 'tecnico no escribe aulas');

SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ SELECT public.api_aulas_listar() $q$, 'P0001:NO_AUTORIZADO', 'alumno: sin aulas');
SELECT t.throws(format($q$ SELECT public.api_camaras_listar(%s) $q$, :a12), 'P0001:NO_AUTORIZADO', 'alumno: sin camaras');
SELECT t.throws(format($q$ SELECT public.api_camara_guardar('{"id_camara":%s,"estatus":"inactiva"}') $q$, :cfrente), 'P0001:NO_AUTORIZADO', 'alumno no escribe camaras');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.api_aulas_listar() $q$, '42501', 'anon: sin EXECUTE');
SELECT t.throws($q$ SELECT public.api_camara_guardar('{}') $q$, '42501', 'anon: sin EXECUTE en escritura');

SELECT t.summary();
ROLLBACK;
