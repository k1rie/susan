-- Funciones del esquema app: reloj unico, parametros, identidad por rol, visibilidad, consentimiento,
-- errores, bitacora y cuenta de servicio.
BEGIN;
SELECT t.begin('schema_05_helpers');
SELECT t.cargar_fixtures();

-- ===== Reloj unico ===============================================================================
SELECT t.ok(app.reloj_simulado(), 'el reloj simulado esta activo en la BD de prueba');
SELECT t.eq(app.now(), '2026-09-14 13:12:00+00'::timestamptz, 'app.now() devuelve app.fake_now');
SELECT t.eq(app.tz(), 'America/Mexico_City', 'app.tz()');
SELECT t.eq(app.hoy(), DATE '2026-09-14', 'app.hoy() = lunes 14-sep (07:12 en el plantel)');
SELECT t.efecto($q$ SELECT set_config('app.fake_now', '2026-09-15 03:00:00+00', true) $q$, $q$ SELECT app.hoy() = DATE '2026-09-14' $q$,
    'a las 03:00 UTC del 15 todavia es 14 en el plantel (21:00)');
SELECT t.eq(app.instante_clase(DATE '2026-09-14', TIME '07:00'), '2026-09-14 13:00:00+00'::timestamptz, 'app.instante_clase: 07:00 en el plantel = 13:00 UTC');
SELECT t.eq(app.instante_clase(DATE '2026-09-14', TIME '07:10') - app.instante_clase(DATE '2026-09-14', TIME '07:00'), interval '10 minutes', 'diferencia de 10 min entre instantes de clase');
SELECT t.efecto($q$ SELECT set_config('app.fake_now', '', true) $q$, $q$ SELECT NOT app.reloj_simulado() AND app.now() > '2025-01-01'::timestamptz $q$,
    'sin app.fake_now el reloj es el real');

-- ===== Fallar ====================================================================================
SELECT t.throws($q$ SELECT app.fallar('PRUEBA_CODIGO', 'Mensaje de prueba.') $q$, 'P0001:PRUEBA_CODIGO:Mensaje de prueba.', 'app.fallar: P0001 con HINT = codigo y el mensaje');

-- ===== Parametros ================================================================================
SELECT t.eq(app.param('umbral_similitud'), '0.850', 'app.param texto');
SELECT t.eq(app.param_num('umbral_similitud'), 0.85::numeric, 'app.param_num numerico');
SELECT t.eq(app.param_num('min_detecciones_validas'), 3::numeric, 'min_detecciones_validas = 3');
SELECT t.eq(app.param_num('horas_limite_correccion'), 48::numeric, 'horas_limite_correccion = 48');
SELECT t.throws($q$ SELECT app.param('no_existe') $q$, 'P0001:PARAMETRO_NO_ENCONTRADO', 'app.param de una clave inexistente');
SELECT t.throws($q$ UPDATE parametro_sistema SET valor = 'abc' WHERE clave = 'tolerancia_min'; SELECT app.param_num('tolerancia_min') $q$,
    'P0001:PARAMETRO_INVALIDO', 'app.param_num de un valor no numerico');

-- validar_parametro: valor canonico o PARAMETRO_VALOR_INVALIDO
SELECT t.eq(app.validar_parametro('umbral_similitud', '0.9'), '0.900', 'validar_parametro normaliza el decimal a 3 decimales');
SELECT t.eq(app.validar_parametro('umbral_similitud', ' 0.875 '), '0.875', 'validar_parametro recorta espacios');
SELECT t.eq(app.validar_parametro('intervalo_muestreo_seg', '30'), '30', 'validar_parametro entero valido');
SELECT t.eq(app.validar_parametro('intervalo_muestreo_seg', '5'), '5', 'intervalo de muestreo en el minimo (5)');
SELECT t.eq(app.validar_parametro('intervalo_muestreo_seg', '120'), '120', 'intervalo de muestreo en el maximo (120)');
SELECT t.eq(app.validar_parametro('limite_presente_min', '15'), '15', 'limite_presente_min por debajo de la tolerancia');
SELECT t.eq(app.validar_parametro('tolerancia_min', '30'), '30', 'tolerancia_min por encima del limite');
SELECT t.throws($q$ SELECT app.validar_parametro('umbral_similitud', '1.5') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO', 'umbral fuera de rango (1.5)');
SELECT t.throws($q$ SELECT app.validar_parametro('umbral_similitud', '0.1') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO', 'umbral por debajo del minimo');
SELECT t.throws($q$ SELECT app.validar_parametro('umbral_similitud', '0.85555') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO', 'umbral con mas de 3 decimales');
SELECT t.throws($q$ SELECT app.validar_parametro('umbral_similitud', 'abc') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO', 'umbral no numerico');
SELECT t.throws($q$ SELECT app.validar_parametro('intervalo_muestreo_seg', '4') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO:entre 5 y 120', 'intervalo 4 s (el mensaje indica el rango)');
SELECT t.throws($q$ SELECT app.validar_parametro('intervalo_muestreo_seg', '121') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO', 'intervalo 121 s');
SELECT t.throws($q$ SELECT app.validar_parametro('intervalo_muestreo_seg', '15.5') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO', 'entero con decimales');
SELECT t.throws($q$ SELECT app.validar_parametro('intervalo_muestreo_seg', '-1') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO', 'entero negativo');
SELECT t.throws($q$ SELECT app.validar_parametro('intervalo_muestreo_seg', NULL) $q$, 'P0001:PARAMETRO_VALOR_INVALIDO', 'valor nulo');
SELECT t.throws($q$ SELECT app.validar_parametro('limite_presente_min', '20') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO:menor que tolerancia_min', 'limite_presente_min igual a la tolerancia');
SELECT t.throws($q$ SELECT app.validar_parametro('tolerancia_min', '10') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO:mayor que limite_presente_min', 'tolerancia_min igual al limite de presente');
SELECT t.throws($q$ SELECT app.validar_parametro('vigencia_url_firmada_seg', '301') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO', 'URL firmada de mas de 300 s (RNF-04)');
SELECT t.throws($q$ SELECT app.validar_parametro('clave_inventada', '1') $q$, 'P0001:PARAMETRO_NO_ENCONTRADO', 'clave inexistente');

-- ===== Identidad por rol ==========================================================================
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(app.rol(), 'docente', 'docente1: rol');
SELECT t.eq(app.id_usuario(), t.id_usuario('docente1@susan.test'), 'docente1: id_usuario');
SELECT t.eq(app.id_docente(), t.id_docente('D001'), 'docente1: id_docente');
SELECT t.ok(app.id_alumno() IS NULL, 'docente1: sin id_alumno');
SELECT t.ok(NOT app.es_admin(), 'docente1: no es admin');
SELECT t.as_user('alumno1@susan.test');
SELECT t.eq(app.rol(), 'alumno', 'alumno1: rol');
SELECT t.eq(app.id_alumno(), t.id_alumno('A001'), 'alumno1: id_alumno');
SELECT t.ok(app.id_docente() IS NULL, 'alumno1: sin id_docente');
SELECT t.as_user('admin@susan.test');
SELECT t.ok(app.es_admin(), 'admin: es_admin');
SELECT t.ok(app.id_docente() IS NULL AND app.id_alumno() IS NULL, 'admin: sin vinculos');
SELECT t.as_user('tecnico@susan.test');
SELECT t.eq(app.rol(), 'tecnico', 'tecnico: rol');
SELECT t.as_user('alumno5@susan.test');
SELECT t.ok(app.rol() IS NULL AND app.id_usuario() IS NULL AND app.id_alumno() IS NULL, 'cuenta inactiva: sin rol efectivo');
SELECT t.as_uid_huerfano();
SELECT t.ok(app.rol() IS NULL AND app.id_usuario() IS NULL, 'uid sin cuenta: sin rol');
SELECT t.as_anon();
SELECT t.as_postgres();
SELECT t.eq(app.rol_de_usuario(t.id_usuario('docente1@susan.test')), 'docente', 'rol_de_usuario');
SELECT t.ok(app.rol_de_usuario(999999) IS NULL, 'rol_de_usuario de un id inexistente es NULL');

-- ===== exigir_rol ===========================================================================
SELECT t.as_postgres();
SELECT t.throws($q$ SELECT app.exigir_rol(NULL) $q$, 'P0001:NO_AUTENTICADO', 'exigir_rol sin sesion');
SELECT t.as_uid_huerfano();
SELECT t.throws($q$ SELECT app.exigir_rol('docente') $q$, 'P0001:CUENTA_NO_VINCULADA', 'exigir_rol con uid sin cuenta');
SELECT t.as_user('alumno5@susan.test');
SELECT t.throws($q$ SELECT app.exigir_rol(NULL) $q$, 'P0001:CUENTA_INACTIVA', 'exigir_rol con cuenta inactiva');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ SELECT app.exigir_rol('docente', 'administrador') $q$, 'P0001:NO_AUTORIZADO', 'exigir_rol: alumno en operacion de docente/admin');
SELECT t.eq(app.exigir_rol('alumno'), 'alumno', 'exigir_rol devuelve el rol cuando coincide');
SELECT t.eq(app.exigir_rol('docente', 'alumno'), 'alumno', 'exigir_rol con varios roles permitidos');
SELECT t.eq(app.exigir_rol(NULL), 'alumno', 'exigir_rol(NULL) acepta cualquier rol activo');
SELECT t.as_user('tecnico@susan.test');
SELECT t.eq(app.exigir_rol('tecnico'), 'tecnico', 'exigir_rol tecnico');

-- ===== Visibilidad =====================================================================================
SELECT t.as_user('docente1@susan.test');
SELECT t.ok(app.puede_ver_grupo(t.id_grupo('3A')), 'docente1 ve su grupo');
SELECT t.ok(NOT app.puede_ver_grupo(t.id_grupo('5B')), 'docente1 no ve el grupo ajeno');
SELECT t.ok(app.puede_ver_sesion(t.id_sesion('3A', DATE '2026-09-14')), 'docente1 ve su sesion');
SELECT t.ok(NOT app.puede_ver_sesion(t.id_sesion('5B', DATE '2026-09-14')), 'docente1 no ve la sesion ajena');
SELECT t.ok(NOT app.puede_ver_sesion(999999), 'sesion inexistente: false');
SELECT t.ok(app.puede_ver_alumno(t.id_alumno('A001')) AND app.puede_ver_alumno(t.id_alumno('A003')), 'docente1 ve a sus alumnos (incluida la baja)');
SELECT t.ok(NOT app.puede_ver_alumno(t.id_alumno('A004')), 'docente1 no ve al alumno de otro grupo');
SELECT t.eq((SELECT count(*) FROM app.grupos_visibles()), 1::bigint, 'docente1: un grupo visible');
SELECT t.as_user('alumno1@susan.test');
SELECT t.ok(app.puede_ver_grupo(t.id_grupo('3A')) AND NOT app.puede_ver_grupo(t.id_grupo('5B')), 'alumno1 ve su grupo y no el ajeno');
SELECT t.ok(app.puede_ver_alumno(t.id_alumno('A001')) AND NOT app.puede_ver_alumno(t.id_alumno('A002')), 'alumno1 solo se ve a si mismo');
SELECT t.as_user('admin@susan.test');
SELECT t.ok(app.puede_ver_grupo(t.id_grupo('5B')) AND app.puede_ver_sesion(t.id_sesion('5B', DATE '2026-09-14')) AND app.puede_ver_alumno(t.id_alumno('A004')), 'admin ve todo');
SELECT t.as_user('tecnico@susan.test');
SELECT t.ok(NOT app.puede_ver_grupo(t.id_grupo('3A')) AND NOT app.puede_ver_alumno(t.id_alumno('A001')), 'tecnico no ve grupos ni alumnos');
SELECT t.as_user('alumno5@susan.test');
SELECT t.ok(NOT app.puede_ver_grupo(t.id_grupo('3A')), 'cuenta inactiva no ve grupos');
SELECT t.as_postgres();

-- ===== Consentimiento ==================================================================================
SELECT t.ok(app.consentimiento_vigente(t.id_consent('A001')), 'consentimiento vigente');
SELECT t.ok(NOT app.consentimiento_vigente(t.id_consent('A005')), 'consentimiento revocado no es vigente');
SELECT t.ok(NOT app.consentimiento_vigente(t.id_consent('A006')), 'consentimiento vencido por fecha no es vigente aunque el estatus diga vigente');
SELECT t.ok(NOT app.consentimiento_vigente(999999), 'consentimiento inexistente');
SELECT t.ok(app.tiene_consentimiento_vigente(t.id_alumno('A002')) AND NOT app.tiene_consentimiento_vigente(t.id_alumno('A005')), 'tiene_consentimiento_vigente por alumno');
SELECT t.efecto($q$ SELECT t.reloj('2027-08-01 12:00:00-06') $q$, $q$ SELECT app.consentimiento_vigente(t.id_consent('A001')) $q$, 'el ultimo dia de vigencia aun cuenta');
SELECT t.efecto($q$ SELECT t.reloj('2027-08-02 12:00:00-06') $q$, $q$ SELECT NOT app.consentimiento_vigente(t.id_consent('A001')) $q$, 'al dia siguiente de la vigencia ya no');

-- ===== Bitacora =================================================================================
SELECT t.as_postgres();
SELECT t.throws($q$ SELECT app.bitacora('correccion', 'asistencia', 1, NULL, '{"x":1}') $q$, 'P0001:BITACORA_VALORES_REQUERIDOS', 'bitacora: correccion sin valor anterior');
SELECT t.throws($q$ SELECT app.bitacora('cambio_parametro', 'parametro_sistema', 0, '{"x":1}', NULL) $q$, 'P0001:BITACORA_VALORES_REQUERIDOS', 'bitacora: cambio de parametro sin valor nuevo');
SELECT t.throws($q$ SELECT app.bitacora('consulta', 'bitacora_auditoria', 1, NULL, NULL) $q$, '23514:ck_bitacora_entidad', 'bitacora: la propia bitacora no es entidad auditable');
SELECT t.efecto($q$ SELECT app.bitacora('consulta', 'deteccion', 7, NULL, '{"a":1}', '192.168.1.9'::inet, t.id_usuario('docente2@susan.test')) $q$,
    $q$ SELECT (id_usuario, entidad, id_registro, ip_origen, fecha_hora) = (t.id_usuario('docente2@susan.test'), 'deteccion', 7, '192.168.1.9', app.now())
          FROM bitacora_auditoria WHERE id_registro = 7 $q$, 'bitacora: asienta usuario, entidad, registro, IP y la fecha del reloj unico');
SELECT t.efecto($q$ SELECT app.bitacora('consulta', 'deteccion', 7, NULL, NULL) $q$,
    $q$ SELECT id_usuario = app.id_cuenta_servicio() AND ip_origen IS NULL FROM bitacora_auditoria WHERE id_registro = 7 $q$,
    'bitacora: sin sesion ni usuario explicito asienta con la cuenta de servicio');
SELECT t.efecto($q$ SELECT t.as_user('docente1@susan.test'); SELECT set_config('request.headers', '{"x-forwarded-for":"203.0.113.7, 10.0.0.1"}', true); SELECT t.as_postgres();
                    SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000000012')::text, true);
                    SELECT app.bitacora('consulta', 'deteccion', 8, NULL, NULL) $q$,
    $q$ SELECT id_usuario = t.id_usuario('docente1@susan.test') AND ip_origen = '203.0.113.7' FROM bitacora_auditoria WHERE id_registro = 8 $q$,
    'bitacora: toma el usuario de la sesion y la IP de x-forwarded-for');
SELECT t.efecto($q$ SELECT set_config('request.headers', '{"x-forwarded-for":"no-es-una-ip"}', true) $q$, $q$ SELECT app.ip_origen() IS NULL $q$, 'ip_origen ignora valores que no son IP');
SELECT t.ok(app.ip_origen() IS NULL, 'ip_origen sin cabeceras (modo local) es NULL');

-- ===== Cuenta de servicio =================================================================================
SELECT t.as_service();
SELECT t.ok(app.id_cuenta_servicio() = (SELECT id_usuario FROM usuario WHERE correo = 'servicio@susan.local'), 'id_cuenta_servicio resuelve la cuenta tecnica');
SELECT t.ok(app.rol() IS NULL, 'service_role sin asumir no tiene rol de negocio');
SELECT t.efecto($q$ SELECT app.asumir_cuenta_servicio() $q$, $q$ SELECT app.rol() = 'tecnico' AND app.id_usuario() = app.id_cuenta_servicio() $q$,
    'asumir_cuenta_servicio: app.rol() = tecnico e id_usuario = cuenta de servicio');
SELECT t.efecto($q$ SELECT app.asumir_cuenta_servicio(); SELECT app.bitacora('cierre_sesion', 'sesion_clase', 1, NULL, '{"estatus":"cerrada"}') $q$,
    $q$ SELECT id_usuario = app.id_cuenta_servicio() FROM bitacora_auditoria WHERE accion = 'cierre_sesion' $q$,
    'la bitacora de una resolucion automatica queda a nombre de la cuenta de servicio');
SELECT t.efecto($q$ SELECT app.asumir_cuenta_servicio(); SELECT app.exigir_rol('tecnico') $q$, $q$ SELECT true $q$, 'tras asumirla, exigir_rol(tecnico) pasa');
SELECT t.as_postgres();
SELECT t.throws($q$ UPDATE usuario SET activo = false WHERE correo = 'servicio@susan.local'; SELECT app.id_cuenta_servicio() $q$,
    'P0001:CUENTA_SERVICIO_AUSENTE', 'si la cuenta de servicio se desactiva, id_cuenta_servicio falla');

SELECT t.summary();
ROLLBACK;
