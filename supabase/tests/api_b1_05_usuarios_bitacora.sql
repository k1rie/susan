-- api_b1_05: usuarios (RF-20), bitacora (RNF-08), resumen del administrador y contrato de las RPC del dominio.
BEGIN;
SELECT t.begin('api_b1_05_usuarios_bitacora');
SELECT t.cargar_fixtures();
SELECT t.id_usuario('admin@susan.test') AS uadm, t.id_usuario('alumno1@susan.test') AS ual1, t.id_usuario('alumno5@susan.test') AS ual5,
       t.id_usuario('tecnico@susan.test') AS utec, t.id_usuario('docente1@susan.test') AS udoc1, t.id_usuario('servicio@susan.local') AS usrv,
       t.id_docente('D001') AS d1, t.id_alumno('A003') AS a3 \gset

SELECT t.as_user('admin@susan.test');
-- listado: la cuenta de servicio no aparece
SELECT t.eq((public.api_usuarios_listar() ->> 'total')::int, 8, 'admin lista 8 cuentas (sin la de servicio)');
SELECT t.ok(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.api_usuarios_listar(p_limit => 200) -> 'items') i WHERE i ->> 'correo' = 'servicio@susan.local'), 'servicio@susan.local oculta');
SELECT t.eq((public.api_usuarios_listar(p_q => 'servicio') ->> 'total')::int, 0, 'ni siquiera buscandola');
SELECT t.eq((public.api_usuarios_listar(p_rol => 'tecnico') ->> 'total')::int, 1, 'el rol tecnico solo muestra al tecnico real');
SELECT t.eq((public.api_usuarios_listar(p_rol => 'docente') ->> 'total')::int, 2, 'filtro por rol');
SELECT t.eq((public.api_usuarios_listar(p_q => 'D001') -> 'items' -> 0 ->> 'correo'), 'docente1@susan.test', 'busqueda por numero de empleado');
SELECT t.eq((public.api_usuarios_listar(p_q => 'A004') -> 'items' -> 0 ->> 'vinculo'), 'A004', 'busqueda por matricula, con vinculo');
SELECT t.eq(jsonb_array_length(public.api_usuarios_listar(p_limit => 3) -> 'items'), 3, 'paginacion');
SELECT t.throws($q$ SELECT public.api_usuarios_listar(p_rol => 'dios') $q$, 'P0001:VALIDACION', 'rol invalido');

-- actualizar
SELECT t.efecto(format($q$ SELECT public.api_usuario_actualizar(%s, '{"activo":false}') $q$, :ual1),
    format($q$ SELECT NOT (SELECT activo FROM public.usuario WHERE id_usuario = %s) $q$, :ual1), 'desactivar cuenta');
SELECT t.efecto(format($q$ SELECT public.api_usuario_actualizar(%s, '{"activo":true}') $q$, :ual5),
    format($q$ SELECT (SELECT activo FROM public.usuario WHERE id_usuario = %s) $q$, :ual5), 'activar cuenta inactiva');
SELECT t.eq(public.api_usuario_actualizar(:ual1, '{"activo":true}') ->> 'cambio', 'false', 'sin cambio real: cambio=false');
SELECT t.throws(format($q$ SELECT public.api_usuario_actualizar(%s, '{"activo":"si"}') $q$, :ual1), 'P0001:VALIDACION', 'activo no booleano');
SELECT t.throws(format($q$ SELECT public.api_usuario_actualizar(%s, '{}') $q$, :ual1), 'P0001:VALIDACION', 'sin campos');
SELECT t.throws(format($q$ SELECT public.api_usuario_actualizar(%s, '{"rol":"dios"}') $q$, :ual1), 'P0001:VALIDACION', 'rol invalido');
SELECT t.throws($q$ SELECT public.api_usuario_actualizar(999999, '{"activo":false}') $q$, 'P0001:NO_ENCONTRADO', 'usuario inexistente');
SELECT t.throws(format($q$ SELECT public.api_usuario_actualizar(%s, '{"activo":false}') $q$, :usrv), 'P0001:NO_ENCONTRADO', 'la cuenta de servicio no se puede tocar');
SELECT t.throws(format($q$ SELECT public.api_usuario_actualizar(%s, '{"rol":"administrador"}') $q$, :usrv), 'P0001:NO_ENCONTRADO', 'ni cambiarle el rol');
SELECT t.throws(format($q$ SELECT public.api_usuario_actualizar(%s, '{"activo":false}') $q$, :uadm), 'P0001:USUARIO_PROPIO', 'un admin no se desactiva');
SELECT t.throws(format($q$ SELECT public.api_usuario_actualizar(%s, '{"rol":"tecnico"}') $q$, :uadm), 'P0001:USUARIO_PROPIO', 'un admin no se quita el rol');
-- rol coherente con el vinculo
SELECT t.throws(format($q$ SELECT public.api_usuario_actualizar(%s, '{"rol":"docente"}') $q$, :ual1), 'P0001:ROL_VINCULO_INCOHERENTE', 'rol docente sin id_docente');
SELECT t.throws(format($q$ SELECT public.api_usuario_actualizar(%s, '{"rol":"docente","id_docente":%s}') $q$, :ual1, :d1), 'P0001:DUPLICADO', 'el docente ya tiene cuenta');
SELECT t.throws(format($q$ SELECT public.api_usuario_actualizar(%s, '{"rol":"administrador","id_alumno":%s}') $q$, :ual1, :a3), 'P0001:ROL_VINCULO_INCOHERENTE', 'administrador con vinculo');
SELECT t.throws(format($q$ SELECT public.api_usuario_actualizar(%s, '{"id_docente":%s}') $q$, :ual1, :d1), 'P0001:ROL_VINCULO_INCOHERENTE', 'alumno con id_docente');
SELECT t.throws(format($q$ SELECT public.api_usuario_actualizar(%s, '{"rol":"docente","id_docente":999999}') $q$, :ual1), 'P0001:NO_ENCONTRADO', 'docente inexistente');
SELECT t.throws(format($q$ SELECT public.api_usuario_actualizar(%s, '{"id_alumno":%s}') $q$, :ual1, t.id_alumno('A002')), 'P0001:DUPLICADO', 'el alumno ya tiene cuenta');
SELECT t.efecto(format($q$ SELECT public.api_usuario_actualizar(%s, '{"rol":"tecnico"}') $q$, :ual1),
    format($q$ SELECT EXISTS (SELECT 1 FROM public.usuario WHERE id_usuario = %s AND rol = 'tecnico' AND id_alumno IS NULL AND id_docente IS NULL) $q$, :ual1),
    'cambiar a tecnico limpia el vinculo');
SELECT t.efecto(format($q$ SELECT public.api_usuario_actualizar(%s, '{"rol":"alumno","id_alumno":%s}') $q$, :utec, :a3),
    format($q$ SELECT EXISTS (SELECT 1 FROM public.usuario WHERE id_usuario = %s AND rol = 'alumno' AND id_alumno = %s) $q$, :utec, :a3),
    'tecnico a alumno con vinculo (un solo UPDATE coherente)');
SELECT t.efecto(format($q$ SELECT public.api_usuario_actualizar(%s, '{"rol":"docente","id_docente":%s}') $q$, :ual1,
        (SELECT (public.api_docente_guardar('{"num_empleado":"D100","apellido_paterno":"Mena","nombres":"Rosa","correo_institucional":"rosa@unach.test"}') ->> 'id_docente'))),
    format($q$ SELECT EXISTS (SELECT 1 FROM public.usuario WHERE id_usuario = %s AND rol = 'docente' AND id_alumno IS NULL AND id_docente IS NOT NULL) $q$, :ual1),
    'alumno a docente con un docente libre');

-- roles sin acceso
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT public.api_usuarios_listar() $q$, 'P0001:NO_AUTORIZADO', 'docente no lista cuentas');
SELECT t.throws(format($q$ SELECT public.api_usuario_actualizar(%s, '{"activo":false}') $q$, :ual1), 'P0001:NO_AUTORIZADO', 'docente no actualiza cuentas');
SELECT t.throws($q$ SELECT public.api_bitacora_listar() $q$, 'P0001:NO_AUTORIZADO', 'docente no lee la bitacora');
SELECT t.throws($q$ SELECT public.api_admin_resumen() $q$, 'P0001:NO_AUTORIZADO', 'docente sin resumen de admin');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ SELECT public.api_usuarios_listar() $q$, 'P0001:NO_AUTORIZADO', 'alumno no lista cuentas');
SELECT t.throws(format($q$ SELECT public.api_usuario_actualizar(%s, '{"rol":"administrador"}') $q$, :ual1), 'P0001:NO_AUTORIZADO', 'alumno no se escala a admin');
SELECT t.throws($q$ SELECT public.api_bitacora_listar() $q$, 'P0001:NO_AUTORIZADO', 'alumno no lee la bitacora');
SELECT t.throws($q$ SELECT public.api_admin_resumen() $q$, 'P0001:NO_AUTORIZADO', 'alumno sin resumen');
SELECT t.as_user('tecnico@susan.test');
SELECT t.throws($q$ SELECT public.api_usuarios_listar() $q$, 'P0001:NO_AUTORIZADO', 'tecnico no lista cuentas');
SELECT t.throws($q$ SELECT public.api_bitacora_listar() $q$, 'P0001:NO_AUTORIZADO', 'tecnico no lee la bitacora');
SELECT t.throws($q$ SELECT public.api_admin_resumen() $q$, 'P0001:NO_AUTORIZADO', 'tecnico sin resumen');
SELECT t.as_user('alumno5@susan.test');
SELECT t.throws($q$ SELECT public.api_admin_resumen() $q$, 'P0001:CUENTA_INACTIVA', 'cuenta inactiva');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.api_usuarios_listar() $q$, '42501', 'anon: sin EXECUTE');
SELECT t.throws($q$ SELECT public.api_bitacora_listar() $q$, '42501', 'anon: sin bitacora');
SELECT t.as_uid_huerfano();
SELECT t.throws($q$ SELECT public.api_admin_resumen() $q$, 'P0001:CUENTA_NO_VINCULADA', 'uid sin perfil');

-- ---------------------------------------------------------------- svc_usuario_crear (service_role)
SELECT t.as_user('admin@susan.test');
SELECT (public.api_docente_guardar('{"num_empleado":"D200","apellido_paterno":"Vela","nombres":"Pia","correo_institucional":"pia@unach.test"}') ->> 'id_docente')::int AS d200,
       (public.api_alumno_guardar('{"matricula":"A200","apellido_paterno":"Vela","nombres":"Leo","correo_institucional":"a200@unach.test"}') ->> 'id_alumno')::int AS a200 \gset
SELECT t.throws($q$ SELECT public.svc_usuario_crear('x@susan.test', 'tecnico', NULL, NULL, '00000000-0000-4000-8000-0000000000aa') $q$, '42501', 'authenticated no ejecuta svc_*');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.svc_usuario_crear('x@susan.test', 'tecnico', NULL, NULL, '00000000-0000-4000-8000-0000000000aa') $q$, '42501', 'anon no ejecuta svc_*');
SELECT t.as_service();
SELECT t.lives_rb(format($q$ SELECT public.svc_usuario_crear('PIA@unach.test', 'docente', %s, NULL, '00000000-0000-4000-8000-0000000000a1') $q$, :d200), 'crear cuenta docente');
SELECT t.lives_rb(format($q$ SELECT public.svc_usuario_crear('a200@unach.test', 'alumno', NULL, %s, '00000000-0000-4000-8000-0000000000a2') $q$, :a200), 'crear cuenta alumno');
SELECT t.lives_rb($q$ SELECT public.svc_usuario_crear('admin2@susan.test', 'administrador', NULL, NULL, '00000000-0000-4000-8000-0000000000a3') $q$, 'crear cuenta administrador sin vinculo');
SELECT t.efecto(format($q$ SELECT public.svc_usuario_crear('PIA@unach.test', 'docente', %s, NULL, '00000000-0000-4000-8000-0000000000a1') $q$, :d200),
    $q$ SELECT EXISTS (SELECT 1 FROM public.usuario WHERE correo = 'pia@unach.test' AND rol = 'docente' AND activo) $q$, 'la cuenta nace activa y con correo normalizado');
SELECT t.ok(public.svc_usuario_crear('admin3@susan.test', 'tecnico', NULL, NULL, '00000000-0000-4000-8000-0000000000a4') > 0, 'devuelve id_usuario');
SELECT t.throws(format($q$ SELECT public.svc_usuario_crear('otro@unach.test', 'docente', %s, NULL, '00000000-0000-4000-8000-0000000000a5') $q$, :d1), 'P0001:DUPLICADO', 'usuario duplicado por docente');
SELECT t.throws(format($q$ SELECT public.svc_usuario_crear('otro@unach.test', 'alumno', NULL, %s, '00000000-0000-4000-8000-0000000000a5') $q$, t.id_alumno('A001')), 'P0001:DUPLICADO', 'usuario duplicado por alumno');
SELECT t.throws($q$ SELECT public.svc_usuario_crear('admin@susan.test', 'tecnico', NULL, NULL, '00000000-0000-4000-8000-0000000000a6') $q$, 'P0001:DUPLICADO', 'correo repetido');
SELECT t.throws($q$ SELECT public.svc_usuario_crear('nuevo@susan.test', 'tecnico', NULL, NULL, '00000000-0000-4000-8000-000000000011') $q$, 'P0001:DUPLICADO', 'auth_uid repetido');
SELECT t.throws($q$ SELECT public.svc_usuario_crear('servicio@susan.local', 'tecnico', NULL, NULL, '00000000-0000-4000-8000-0000000000a7') $q$, 'P0001:CORREO_RESERVADO', 'correo de la cuenta de servicio reservado');
SELECT t.throws($q$ SELECT public.svc_usuario_crear('nuevo@susan.test', 'tecnico', NULL, NULL, '00000000-0000-4000-8000-000000000001') $q$, 'P0001:CORREO_RESERVADO', 'uid de la cuenta de servicio reservado');
SELECT t.throws($q$ SELECT public.svc_usuario_crear('nuevo@susan.test', 'docente', NULL, NULL, '00000000-0000-4000-8000-0000000000a8') $q$, 'P0001:ROL_VINCULO_INCOHERENTE', 'docente sin vinculo');
SELECT t.throws(format($q$ SELECT public.svc_usuario_crear('nuevo@susan.test', 'docente', %s, %s, '00000000-0000-4000-8000-0000000000a8') $q$, :d200, :a200), 'P0001:ROL_VINCULO_INCOHERENTE', 'docente con vinculo de alumno');
SELECT t.throws(format($q$ SELECT public.svc_usuario_crear('nuevo@susan.test', 'administrador', NULL, %s, '00000000-0000-4000-8000-0000000000a8') $q$, :a200), 'P0001:ROL_VINCULO_INCOHERENTE', 'administrador con vinculo');
SELECT t.throws($q$ SELECT public.svc_usuario_crear('nuevo@susan.test', 'docente', 999999, NULL, '00000000-0000-4000-8000-0000000000a8') $q$, 'P0001:NO_ENCONTRADO', 'docente inexistente');
SELECT t.throws($q$ SELECT public.svc_usuario_crear('nuevo@susan.test', 'dios', NULL, NULL, '00000000-0000-4000-8000-0000000000a8') $q$, 'P0001:VALIDACION', 'rol invalido');
SELECT t.throws($q$ SELECT public.svc_usuario_crear('sin-arroba', 'tecnico', NULL, NULL, '00000000-0000-4000-8000-0000000000a8') $q$, 'P0001:VALIDACION', 'correo invalido');
SELECT t.throws($q$ SELECT public.svc_usuario_crear('nuevo@susan.test', 'tecnico', NULL, NULL, NULL) $q$, 'P0001:VALIDACION', 'sin auth_uid');
SELECT t.as_postgres();
UPDATE public.alumno SET estatus = 'baja_definitiva' WHERE id_alumno = :a200;
UPDATE public.docente SET estatus = 'baja' WHERE id_docente = :d200;
SELECT t.as_service();
SELECT t.throws(format($q$ SELECT public.svc_usuario_crear('nuevo@susan.test', 'alumno', NULL, %s, '00000000-0000-4000-8000-0000000000a8') $q$, :a200), 'P0001:ALUMNO_NO_ACTIVO', 'alumno dado de baja');
SELECT t.throws(format($q$ SELECT public.svc_usuario_crear('nuevo@susan.test', 'docente', %s, NULL, '00000000-0000-4000-8000-0000000000a8') $q$, :d200), 'P0001:DOCENTE_NO_ACTIVO', 'docente dado de baja');

-- ---------------------------------------------------------------- bitacora
SELECT t.as_user('admin@susan.test');
SELECT t.eq((public.api_bitacora_listar() ->> 'total')::int, 1, 'la bitacora de fixtures tiene 1 evento');
SELECT t.eq(public.api_bitacora_listar() -> 'items' -> 0 ->> 'usuario_correo', 'docente1@susan.test', 'item con el correo del usuario');
SELECT t.eq(public.api_bitacora_listar() -> 'items' -> 0 ->> 'ip_origen', '10.0.0.5', 'item con IP de origen');
SELECT t.eq((public.api_bitacora_listar(p_accion => 'consulta') ->> 'total')::int, 1, 'filtro por accion');
SELECT t.eq((public.api_bitacora_listar(p_accion => 'cierre_sesion') ->> 'total')::int, 0, 'accion sin eventos');
SELECT t.eq((public.api_bitacora_listar(p_entidad => 'deteccion') ->> 'total')::int, 1, 'filtro por entidad');
SELECT t.eq((public.api_bitacora_listar(p_entidad => 'alumno') ->> 'total')::int, 0, 'entidad sin eventos');
SELECT t.eq((public.api_bitacora_listar(p_id_usuario => :udoc1) ->> 'total')::int, 1, 'filtro por usuario');
SELECT t.eq((public.api_bitacora_listar(p_id_usuario => :uadm) ->> 'total')::int, 0, 'otro usuario sin eventos');
SELECT t.eq((public.api_bitacora_listar(p_desde => DATE '2026-09-14', p_hasta => DATE '2026-09-14') ->> 'total')::int, 1, 'rango de un dia (hasta inclusivo, hora del plantel)');
SELECT t.eq((public.api_bitacora_listar(p_hasta => DATE '2026-09-13') ->> 'total')::int, 0, 'hasta anterior al evento');
SELECT t.eq((public.api_bitacora_listar(p_desde => DATE '2026-09-15') ->> 'total')::int, 0, 'desde posterior al evento');
SELECT t.throws($q$ SELECT public.api_bitacora_listar(p_desde => DATE '2026-09-15', p_hasta => DATE '2026-09-14') $q$, 'P0001:VALIDACION', 'desde > hasta');
SELECT t.throws($q$ SELECT public.api_bitacora_listar(p_accion => 'borrar') $q$, 'P0001:VALIDACION', 'accion invalida');
SELECT t.eq(jsonb_array_length(public.api_bitacora_listar(p_limit => 0) -> 'items'), 1, 'p_limit minimo 1');

-- ---------------------------------------------------------------- resumen
SELECT t.eq((public.api_admin_resumen() ->> 'periodo'), '2026-2', 'periodo en curso');
SELECT t.eq((public.api_admin_resumen() ->> 'grupos_periodo')::int, 2, 'grupos del periodo');
SELECT t.eq((public.api_admin_resumen() -> 'sesiones_hoy' ->> 'total')::int, 2, 'sesiones de hoy');
SELECT t.eq((public.api_admin_resumen() -> 'sesiones_hoy' ->> 'abiertas')::int, 2, 'sesiones abiertas hoy');
SELECT t.eq((public.api_admin_resumen() -> 'camaras' ->> 'activas')::int, 2, 'camaras activas');
SELECT t.eq((public.api_admin_resumen() -> 'camaras' ->> 'inactivas')::int, 1, 'camaras inactivas');
SELECT t.eq((public.api_admin_resumen() ->> 'consentimientos_por_vencer_30d')::int, 0, 'sin consentimientos por vencer');
SELECT t.eq((public.api_admin_resumen() ->> 'plantillas_sin_indexar')::int, 0, 'sin plantillas sin indexar');
SELECT t.as_postgres();
UPDATE public.consentimiento SET vigencia_hasta = DATE '2026-10-01' WHERE id_consent = t.id_consent('A001');
UPDATE public.consentimiento SET vigencia_hasta = DATE '2026-12-01' WHERE id_consent = t.id_consent('A002');
UPDATE public.plantilla_facial SET id_indice = NULL, faiss_id = NULL WHERE id_alumno = t.id_alumno('A004');
UPDATE public.camara SET estatus = 'mantenimiento' WHERE direccion_ip = '10.20.0.12';
SELECT t.as_user('admin@susan.test');
SELECT t.eq((public.api_admin_resumen() ->> 'consentimientos_por_vencer_30d')::int, 1, 'un consentimiento vence en 30 dias (otro en 78 no cuenta)');
SELECT t.eq((public.api_admin_resumen() ->> 'plantillas_sin_indexar')::int, 1, 'una plantilla sin indexar');
SELECT t.eq((public.api_admin_resumen() -> 'camaras' ->> 'activas')::int, 1, 'camara en mantenimiento ya no esta activa');
SELECT t.eq((public.api_admin_resumen() -> 'camaras' ->> 'en_mantenimiento')::int, 1, 'cuenta las de mantenimiento');
SELECT t.eq((public.api_admin_resumen() -> 'camaras' ->> 'inactivas')::int, 2, 'inactivas incluye mantenimiento');
SELECT t.as_postgres();
SELECT t.reloj('2026-12-31 10:00:00-06');
SELECT t.as_user('admin@susan.test');
SELECT t.eq((public.api_admin_resumen() ->> 'periodo'), '2026-2', 'fin de año: sigue el periodo con grupos');
SELECT t.reloj('2027-02-01 10:00:00-06');
SELECT t.eq((public.api_admin_resumen() ->> 'periodo'), '2026-2', 'periodo calendario 2027-1 sin grupos: cae al mas reciente');
SELECT t.eq((public.api_admin_resumen() ->> 'fecha'), '2027-02-01', 'usa el reloj unico');

-- ---------------------------------------------------------------- contrato de todas las RPC del dominio
SELECT t.as_postgres();
SELECT t.eq((SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
              AND p.proname IN ('api_alumnos_listar','api_alumno_obtener','api_alumno_guardar','api_alumno_cambiar_estatus',
                  'api_docentes_listar','api_docente_obtener','api_docente_guardar','api_docente_cambiar_estatus',
                  'api_materias_listar','api_materia_obtener','api_materia_guardar',
                  'api_aulas_listar','api_aula_obtener','api_aula_guardar','api_camaras_listar','api_camara_guardar',
                  'api_grupos_listar','api_grupo_obtener','api_grupo_guardar','api_horario_guardar','api_generar_sesiones',
                  'api_inscribir','api_baja_inscripcion','api_inscritos','api_importar_inscripciones',
                  'api_usuarios_listar','api_usuario_actualizar','svc_usuario_crear','api_bitacora_listar','api_admin_resumen'))::int,
    30, '30 funciones publicas del dominio');
SELECT t.ok((SELECT bool_and(obj_description(p.oid, 'pg_proc') ~ E'\nARGS: .*\nRETURNS: .*\nERRORES: .*\nROLES: ')
               FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
                AND (p.proname LIKE 'api\_%' OR p.proname LIKE 'svc\_%')
                AND p.proname IN ('api_aulas_listar','api_aula_obtener','api_aula_guardar','api_camaras_listar','api_camara_guardar',
                  'api_grupos_listar','api_grupo_obtener','api_grupo_guardar','api_horario_guardar','api_generar_sesiones',
                  'api_inscribir','api_baja_inscripcion','api_inscritos','api_importar_inscripciones',
                  'api_usuarios_listar','api_usuario_actualizar','svc_usuario_crear','api_bitacora_listar','api_admin_resumen',
                  'api_docentes_listar','api_docente_obtener','api_docente_guardar','api_docente_cambiar_estatus')),
    'COMMENT con ARGS/RETURNS/ERRORES/ROLES');
SELECT t.ok((SELECT bool_and(has_function_privilege('authenticated', p.oid, 'EXECUTE') AND NOT has_function_privilege('anon', p.oid, 'EXECUTE'))
               FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN
                 ('api_aulas_listar','api_grupos_listar','api_inscribir','api_usuarios_listar','api_bitacora_listar','api_admin_resumen','api_generar_sesiones')),
    'api_*: EXECUTE solo authenticated');
SELECT t.ok(has_function_privilege('service_role', 'public.svc_usuario_crear(text,text,integer,integer,uuid)', 'EXECUTE')
        AND NOT has_function_privilege('authenticated', 'public.svc_usuario_crear(text,text,integer,integer,uuid)', 'EXECUTE')
        AND NOT has_function_privilege('anon', 'public.svc_usuario_crear(text,text,integer,integer,uuid)', 'EXECUTE'), 'svc_usuario_crear: solo service_role');
SELECT t.ok((SELECT bool_and(p.prosecdef) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN
              ('api_alumno_guardar','api_alumno_cambiar_estatus','api_docente_guardar','api_docente_cambiar_estatus','api_materia_guardar',
               'api_aula_guardar','api_camara_guardar','api_grupo_guardar','api_horario_guardar','api_generar_sesiones','api_inscribir',
               'api_baja_inscripcion','api_importar_inscripciones','api_usuario_actualizar','svc_usuario_crear')), 'escrituras: SECURITY DEFINER');
SELECT t.ok((SELECT bool_and(NOT p.prosecdef AND p.provolatile = 's') FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN
              ('api_alumnos_listar','api_alumno_obtener','api_docentes_listar','api_docente_obtener','api_materias_listar','api_materia_obtener',
               'api_aulas_listar','api_aula_obtener','api_camaras_listar','api_grupos_listar','api_grupo_obtener','api_inscritos',
               'api_usuarios_listar','api_bitacora_listar','api_admin_resumen')), 'lecturas: SECURITY INVOKER STABLE');
SELECT t.ok((SELECT bool_and(p.proconfig::text LIKE '%search_path=public, app, pg_temp%') FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
              AND p.prosecdef AND p.proname IN ('api_alumno_guardar','api_grupo_guardar','api_horario_guardar','api_inscribir','api_usuario_actualizar','svc_usuario_crear')),
    'DEFINER con search_path fijo');

SELECT t.summary();
ROLLBACK;
