-- api_b1_01: catalogos de alumnos, docentes y materias (RF-01). Roles, duplicados, bajas logicas.
BEGIN;
SELECT t.begin('api_b1_01_catalogos');
SELECT t.cargar_fixtures();
-- ids como postgres: los roles sin acceso no los resolverian por RLS
SELECT t.id_alumno('A001') AS a1, t.id_alumno('A002') AS a2, t.id_alumno('A004') AS a4, t.id_docente('D001') AS d1, t.id_docente('D002') AS d2 \gset

-- ---------------------------------------------------------------- roles: quien puede leer
SELECT t.as_user('admin@susan.test');
SELECT t.eq((public.api_alumnos_listar() ->> 'total')::int, 6, 'admin: lista 6 alumnos');
SELECT t.eq(jsonb_array_length(public.api_alumnos_listar(p_limit => 2) -> 'items'), 2, 'admin: p_limit pagina');
SELECT t.eq(jsonb_array_length(public.api_alumnos_listar(p_limit => 1000) -> 'items'), 6, 'p_limit se acota a 200');
SELECT t.eq((public.api_alumnos_listar(p_q => 'a00_') ->> 'total')::int, 0, 'el guion bajo del filtro es literal, no comodin');
SELECT t.eq((public.api_alumnos_listar(p_q => 'Beatriz') ->> 'total')::int, 1, 'busqueda por nombre');
SELECT t.eq((public.api_alumnos_listar(p_q => 'ramos d') ->> 'total')::int, 1, 'busqueda por apellidos (ilike)');
SELECT t.eq((public.api_alumnos_listar(p_q => '%') ->> 'total')::int, 0, 'el % del usuario no es comodin');
SELECT t.eq((public.api_alumnos_listar(p_estatus => 'activo') ->> 'total')::int, 6, 'filtro por estatus');
SELECT t.throws($q$ SELECT public.api_alumnos_listar(p_estatus => 'nada') $q$, 'P0001:VALIDACION', 'estatus invalido');

SELECT t.as_user('docente1@susan.test');
SELECT t.eq((public.api_alumnos_listar() ->> 'total')::int, 5, 'docente1 ve los 5 alumnos de 3A (incluida la baja), no A004');
SELECT t.eq(public.api_alumno_obtener(t.id_alumno('A001')) ->> 'matricula', 'A001', 'docente: obtiene alumno de su grupo');
SELECT t.throws('SELECT public.api_alumno_obtener(' || :a4 || ')', 'P0001:NO_ENCONTRADO', 'docente: alumno de otro grupo no existe para el');
SELECT t.ok(public.api_alumno_obtener(t.id_alumno('A001')) -> 'consentimiento' = 'null'::jsonb, 'docente: no ve el detalle del consentimiento (RLS)');
SELECT t.ok((public.api_alumno_obtener(t.id_alumno('A001')) ->> 'consentimiento_vigente')::boolean, 'docente: ve si hay consentimiento vigente');
SELECT t.eq((public.api_materias_listar() ->> 'total')::int, 1, 'docente: solo la materia de su grupo');
SELECT t.eq((public.api_docentes_listar() ->> 'total')::int, 1, 'docente: solo su fila');
SELECT t.throws('SELECT public.api_docente_obtener(' || :d2 || ')', 'P0001:NO_ENCONTRADO', 'docente: no consulta a otro docente');
SELECT t.throws($q$ SELECT public.api_alumno_guardar('{"matricula":"X1"}') $q$, 'P0001:NO_AUTORIZADO', 'docente no escribe alumnos');
SELECT t.throws($q$ SELECT public.api_docente_guardar('{"num_empleado":"X1"}') $q$, 'P0001:NO_AUTORIZADO', 'docente no escribe docentes');
SELECT t.throws($q$ SELECT public.api_materia_guardar('{"clave":"X1"}') $q$, 'P0001:NO_AUTORIZADO', 'docente no escribe materias');
SELECT t.throws('SELECT public.api_alumno_cambiar_estatus(' || :a1 || ', ''baja_temporal'')', 'P0001:NO_AUTORIZADO', 'docente no da de baja');
SELECT t.throws('SELECT public.api_docente_cambiar_estatus(' || :d1 || ', ''licencia'')', 'P0001:NO_AUTORIZADO', 'docente no cambia estatus docente');

-- alumno propio / ajeno, tecnico, anon: nada de catalogos
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ SELECT public.api_alumnos_listar() $q$, 'P0001:NO_AUTORIZADO', 'alumno: sin listado de alumnos');
SELECT t.throws('SELECT public.api_alumno_obtener(' || :a1 || ')', 'P0001:NO_AUTORIZADO', 'alumno propio: tampoco su ficha de catalogo');
SELECT t.throws('SELECT public.api_alumno_obtener(' || :a2 || ')', 'P0001:NO_AUTORIZADO', 'alumno ajeno: rechazado');
SELECT t.throws($q$ SELECT public.api_docentes_listar() $q$, 'P0001:NO_AUTORIZADO', 'alumno: sin docentes');
SELECT t.throws($q$ SELECT public.api_materias_listar() $q$, 'P0001:NO_AUTORIZADO', 'alumno: sin materias');
SELECT t.throws($q$ SELECT public.api_materia_guardar('{"clave":"X1"}') $q$, 'P0001:NO_AUTORIZADO', 'alumno no escribe');
SELECT t.as_user('tecnico@susan.test');
SELECT t.throws($q$ SELECT public.api_alumnos_listar() $q$, 'P0001:NO_AUTORIZADO', 'tecnico: sin alumnos');
SELECT t.throws($q$ SELECT public.api_docente_guardar('{}') $q$, 'P0001:NO_AUTORIZADO', 'tecnico no escribe');
SELECT t.as_user('alumno5@susan.test');
SELECT t.throws($q$ SELECT public.api_alumnos_listar() $q$, 'P0001:CUENTA_INACTIVA', 'cuenta inactiva rechazada');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.api_alumnos_listar() $q$, '42501', 'anon: sin EXECUTE');
SELECT t.throws($q$ SELECT public.api_alumno_guardar('{}') $q$, '42501', 'anon: sin EXECUTE en escritura');

-- ---------------------------------------------------------------- admin: alumnos
SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ SELECT public.api_alumno_guardar('[1]') $q$, 'P0001:VALIDACION', 'entrada no objeto');
SELECT t.throws($q$ SELECT public.api_alumno_guardar('{"matricula":"A001","apellido_paterno":"X","nombres":"Y","correo_institucional":"x@unach.test"}') $q$,
    'P0001:DUPLICADO', 'matricula duplicada rechazada');
SELECT t.throws($q$ SELECT public.api_alumno_guardar('{"matricula":"a001","apellido_paterno":"X","nombres":"Y","correo_institucional":"x@unach.test"}') $q$,
    'P0001:DUPLICADO', 'matricula duplicada sin distinguir mayusculas');
SELECT t.throws($q$ SELECT public.api_alumno_guardar('{"matricula":"A100","apellido_paterno":"X","nombres":"Y","correo_institucional":"A001@unach.test"}') $q$,
    'P0001:DUPLICADO', 'correo duplicado rechazado');
SELECT t.throws($q$ SELECT public.api_alumno_guardar('{"matricula":"A100","apellido_paterno":"X","nombres":"Y","correo_institucional":"sin-arroba"}') $q$,
    'P0001:VALIDACION', 'correo invalido');
SELECT t.throws($q$ SELECT public.api_alumno_guardar('{"matricula":"A1000000000","apellido_paterno":"X","nombres":"Y","correo_institucional":"x@unach.test"}') $q$,
    'P0001:VALIDACION', 'matricula de mas de 10');
SELECT t.throws($q$ SELECT public.api_alumno_guardar('{"matricula":"A100","nombres":"Y","correo_institucional":"x@unach.test"}') $q$,
    'P0001:VALIDACION', 'falta apellido paterno');
SELECT t.throws($q$ SELECT public.api_alumno_guardar('{"id_alumno":999999,"nombres":"Y"}') $q$, 'P0001:NO_ENCONTRADO', 'modificar inexistente');
SELECT t.throws($q$ SELECT public.api_alumno_guardar('{"id_alumno":"abc"}') $q$, 'P0001:VALIDACION', 'id no entero');
SELECT t.lives_rb($q$ SELECT public.api_alumno_guardar('{"matricula":"a100","apellido_paterno":"Soto","nombres":"Carla","correo_institucional":"A100@UNACH.test"}') $q$, 'alta de alumno');
SELECT t.efecto($q$ SELECT public.api_alumno_guardar('{"matricula":"a100","apellido_paterno":"Soto","nombres":"Carla","correo_institucional":"A100@UNACH.test"}') $q$,
    $q$ SELECT EXISTS (SELECT 1 FROM public.alumno WHERE matricula = 'A100' AND correo_institucional = 'a100@unach.test' AND estatus = 'activo') $q$, 'alta normaliza matricula y correo, nace activo');
SELECT t.efecto(format($q$ SELECT public.api_alumno_guardar('{"id_alumno":%s,"nombres":"Beatriz Elena"}') $q$, t.id_alumno('A001')),
    $q$ SELECT EXISTS (SELECT 1 FROM public.alumno WHERE matricula = 'A001' AND nombres = 'Beatriz Elena' AND apellido_paterno = 'Ramos') $q$, 'modificar conserva lo ausente');
SELECT t.efecto(format($q$ SELECT public.api_alumno_guardar('{"id_alumno":%s,"apellido_materno":null}') $q$, t.id_alumno('A001')),
    $q$ SELECT EXISTS (SELECT 1 FROM public.alumno WHERE matricula = 'A001' AND apellido_materno IS NULL) $q$, 'null explicito limpia apellido materno');
SELECT t.throws(format($q$ SELECT public.api_alumno_guardar('{"id_alumno":%s,"matricula":"A002"}') $q$, t.id_alumno('A001')), 'P0001:DUPLICADO', 'modificar a matricula ajena');
SELECT t.lives(format($q$ SELECT public.api_alumno_guardar('{"id_alumno":%s,"matricula":"A001"}') $q$, t.id_alumno('A001')), 'regrabar la propia matricula no es duplicado');

-- ficha del admin: consentimiento y plantilla sin rutas privadas
SELECT t.eq(public.api_alumno_obtener(t.id_alumno('A001')) -> 'consentimiento' ->> 'estatus', 'vigente', 'admin: consentimiento resumido');
SELECT t.eq(public.api_alumno_obtener(t.id_alumno('A001')) -> 'plantilla' ->> 'version_indice', 'v001', 'admin: plantilla indexada v001');
SELECT t.ok((public.api_alumno_obtener(t.id_alumno('A001')) -> 'plantilla' ->> 'indexada')::boolean, 'plantilla indexada');
SELECT t.ok(public.api_alumno_obtener(t.id_alumno('A002')) -> 'plantilla' = 'null'::jsonb, 'A002 sin plantilla');
SELECT t.ok(position('objeto_' IN public.api_alumno_obtener(t.id_alumno('A001'))::text) = 0
        AND position('fixture' IN public.api_alumno_obtener(t.id_alumno('A001'))::text) = 0, 'la ficha no expone rutas privadas');
SELECT t.eq(jsonb_array_length(public.api_alumno_obtener(t.id_alumno('A003')) -> 'inscripciones'), 1, 'ficha lista inscripciones (incluida la baja)');
SELECT t.ok(NOT (public.api_alumno_obtener(t.id_alumno('A006')) ->> 'consentimiento_vigente')::boolean, 'A006 consentimiento vencido no es vigente');
SELECT t.ok(public.api_alumno_obtener(t.id_alumno('A006')) -> 'consentimiento' ->> 'vigente' = 'false', 'resumen marca vigente=false');
SELECT t.throws($q$ SELECT public.api_alumno_obtener(999999) $q$, 'P0001:NO_ENCONTRADO', 'alumno inexistente');

-- baja logica
SELECT t.efecto(format($q$ SELECT public.api_alumno_cambiar_estatus(%s, 'baja_temporal') $q$, t.id_alumno('A001')),
    $q$ SELECT (SELECT estatus FROM public.alumno WHERE matricula = 'A001') = 'baja_temporal'
          AND (SELECT count(*) FROM public.inscripcion WHERE id_alumno = (SELECT id_alumno FROM public.alumno WHERE matricula = 'A001') AND estatus = 'activa') = 0 $q$,
    'baja logica: estatus y bajas de inscripcion');
SELECT t.efecto(format($q$ SELECT public.api_alumno_cambiar_estatus(%s, 'baja_definitiva') $q$, t.id_alumno('A001')),
    $q$ SELECT (SELECT count(*) FROM public.asistencia WHERE id_alumno = (SELECT id_alumno FROM public.alumno WHERE matricula = 'A001')) = 2
          AND EXISTS (SELECT 1 FROM public.consentimiento WHERE id_alumno = (SELECT id_alumno FROM public.alumno WHERE matricula = 'A001'))
          AND EXISTS (SELECT 1 FROM public.plantilla_facial WHERE id_alumno = (SELECT id_alumno FROM public.alumno WHERE matricula = 'A001')) $q$,
    'baja logica conserva asistencia, consentimiento y plantilla');
SELECT t.eq(public.api_alumno_cambiar_estatus(t.id_alumno('A001'), 'activo') ->> 'cambio', 'false', 'mismo estatus: idempotente');
SELECT t.eq((public.api_alumno_cambiar_estatus(t.id_alumno('A002'), 'egresado') ->> 'inscripciones_dadas_de_baja')::int, 1, 'reporta inscripciones dadas de baja');
SELECT t.eq(public.api_alumno_cambiar_estatus(t.id_alumno('A002'), 'egresado') ->> 'cambio', 'false', 'segunda baja: sin cambio');
SELECT t.eq((public.api_alumnos_listar(p_estatus => 'egresado') ->> 'total')::int, 1, 'el egresado sigue en el catalogo');
SELECT t.throws(format($q$ SELECT public.api_alumno_cambiar_estatus(%s, 'borrado') $q$, t.id_alumno('A001')), 'P0001:VALIDACION', 'estatus invalido');
SELECT t.throws($q$ SELECT public.api_alumno_cambiar_estatus(999999, 'activo') $q$, 'P0001:NO_ENCONTRADO', 'baja de inexistente');

-- ---------------------------------------------------------------- admin: docentes
SELECT t.throws($q$ SELECT public.api_docente_guardar('{"num_empleado":"D001","apellido_paterno":"X","nombres":"Y","correo_institucional":"x@unach.test"}') $q$,
    'P0001:DUPLICADO', 'num_empleado duplicado rechazado');
SELECT t.throws($q$ SELECT public.api_docente_guardar('{"num_empleado":"D100","apellido_paterno":"X","nombres":"Y","correo_institucional":"ana.lopez@unach.test"}') $q$,
    'P0001:DUPLICADO', 'correo de docente duplicado');
SELECT t.throws($q$ SELECT public.api_docente_guardar('{"num_empleado":"D 100","apellido_paterno":"X","nombres":"Y","correo_institucional":"x@unach.test"}') $q$,
    'P0001:VALIDACION', 'num_empleado con espacio');
SELECT t.efecto($q$ SELECT public.api_docente_guardar('{"num_empleado":"d100","apellido_paterno":"Mena","nombres":"Rosa","correo_institucional":"rosa@unach.test"}') $q$,
    $q$ SELECT EXISTS (SELECT 1 FROM public.docente WHERE num_empleado = 'D100' AND estatus = 'activo') $q$, 'alta de docente');
SELECT t.efecto(format($q$ SELECT public.api_docente_guardar('{"id_docente":%s,"nombres":"Ana Maria"}') $q$, t.id_docente('D001')),
    $q$ SELECT EXISTS (SELECT 1 FROM public.docente WHERE num_empleado = 'D001' AND nombres = 'Ana Maria') $q$, 'modificar docente');
SELECT t.eq((public.api_docentes_listar() ->> 'total')::int, 2, 'admin lista 2 docentes');
SELECT t.eq((public.api_docentes_listar(p_q => 'D002') -> 'items' -> 0 ->> 'grupos')::int, 1, 'docente con conteo de grupos');
SELECT t.eq(jsonb_array_length(public.api_docente_obtener(t.id_docente('D001')) -> 'grupos'), 1, 'ficha del docente con grupos');
SELECT t.eq(public.api_docente_cambiar_estatus(t.id_docente('D001'), 'licencia') ->> 'estatus', 'licencia', 'licencia con sesiones por impartir: permitida');
SELECT t.throws(format($q$ SELECT public.api_docente_cambiar_estatus(%s, 'baja') $q$, t.id_docente('D001')), 'P0001:DOCENTE_CON_GRUPOS', 'baja con sesiones por impartir rechazada');
SELECT t.as_postgres();
UPDATE public.sesion_clase SET estatus = 'suspendida' WHERE estatus IN ('programada', 'abierta') AND id_grupo = (SELECT id_grupo FROM public.grupo WHERE clave_grupo = '3A');
SELECT t.as_user('admin@susan.test');
SELECT t.eq(public.api_docente_cambiar_estatus(t.id_docente('D001'), 'baja') ->> 'estatus', 'baja', 'baja de docente sin sesiones por impartir');
SELECT t.eq(public.api_docente_cambiar_estatus(t.id_docente('D001'), 'baja') ->> 'cambio', 'false', 'docente: mismo estatus idempotente');
SELECT t.throws(format($q$ SELECT public.api_docente_cambiar_estatus(%s, 'x') $q$, t.id_docente('D001')), 'P0001:VALIDACION', 'estatus de docente invalido');
SELECT t.throws($q$ SELECT public.api_docente_cambiar_estatus(999999, 'baja') $q$, 'P0001:NO_ENCONTRADO', 'docente inexistente');
SELECT t.throws($q$ SELECT public.api_docentes_listar(p_estatus => 'x') $q$, 'P0001:VALIDACION', 'filtro de estatus de docente invalido');

-- ---------------------------------------------------------------- admin: materias
SELECT t.throws($q$ SELECT public.api_materia_guardar('{"clave":"ADM101","nombre":"X","creditos":4,"horas_semana":4}') $q$, 'P0001:DUPLICADO', 'clave de materia duplicada');
SELECT t.throws($q$ SELECT public.api_materia_guardar('{"clave":"MAT1","nombre":"X","creditos":0,"horas_semana":4}') $q$, 'P0001:VALIDACION', 'creditos 0');
SELECT t.throws($q$ SELECT public.api_materia_guardar('{"clave":"MAT1","nombre":"X","creditos":4,"horas_semana":21}') $q$, 'P0001:VALIDACION', 'horas > 20');
SELECT t.throws($q$ SELECT public.api_materia_guardar('{"clave":"MAT1","nombre":"X","creditos":"cuatro","horas_semana":4}') $q$, 'P0001:VALIDACION', 'creditos no numericos');
SELECT t.throws($q$ SELECT public.api_materia_guardar('{"clave":"MATERIA123","nombre":"X","creditos":4,"horas_semana":4}') $q$, 'P0001:VALIDACION', 'clave > 8');
SELECT t.efecto($q$ SELECT public.api_materia_guardar('{"clave":"mat110","nombre":"Matematicas","creditos":6,"horas_semana":4}') $q$,
    $q$ SELECT EXISTS (SELECT 1 FROM public.materia WHERE clave = 'MAT110') $q$, 'alta de materia');
SELECT t.efecto(format($q$ SELECT public.api_materia_guardar('{"id_materia":%s,"creditos":9}') $q$, t.id_materia('ADM101')),
    $q$ SELECT EXISTS (SELECT 1 FROM public.materia WHERE clave = 'ADM101' AND creditos = 9 AND nombre = 'Administración I') $q$, 'modificar materia conserva lo ausente');
SELECT t.eq((public.api_materias_listar() ->> 'total')::int, 2, 'admin lista 2 materias');
SELECT t.eq((public.api_materias_listar(p_q => 'conta') ->> 'total')::int, 1, 'busqueda de materia');
SELECT t.eq(public.api_materia_obtener(t.id_materia('CON202')) ->> 'clave', 'CON202', 'obtener materia');
SELECT t.throws($q$ SELECT public.api_materia_obtener(999999) $q$, 'P0001:NO_ENCONTRADO', 'materia inexistente');
SELECT t.throws($q$ SELECT public.api_materia_guardar('{"id_materia":999999}') $q$, 'P0001:NO_ENCONTRADO', 'modificar materia inexistente');

-- catalogo: comentarios con el formato del generador
SELECT t.ok((SELECT bool_and(obj_description(p.oid, 'pg_proc') ~ E'\nARGS: .*\nRETURNS: .*\nERRORES: .*\nROLES: ')
               FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
                AND p.proname IN ('api_alumnos_listar','api_alumno_obtener','api_alumno_guardar','api_alumno_cambiar_estatus',
                                  'api_docentes_listar','api_docente_obtener','api_docente_guardar','api_docente_cambiar_estatus',
                                  'api_materias_listar','api_materia_obtener','api_materia_guardar')), 'COMMENT con ARGS/RETURNS/ERRORES/ROLES');
SELECT t.ok((SELECT bool_and(has_function_privilege('authenticated', p.oid, 'EXECUTE') AND NOT has_function_privilege('anon', p.oid, 'EXECUTE'))
               FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'api\_alumno%'), 'EXECUTE solo authenticated');

SELECT t.summary();
ROLLBACK;
