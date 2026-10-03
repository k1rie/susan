-- api_b1_03: grupos, horario semanal y generacion de sesiones (RF-01, RF-22, RN-06).
BEGIN;
SELECT t.begin('api_b1_03_grupos_horario');
SELECT t.cargar_fixtures();
SELECT t.id_grupo('3A') AS g3a, t.id_grupo('5B') AS g5b, t.id_materia('ADM101') AS m1, t.id_materia('CON202') AS m2,
       t.id_docente('D001') AS d1, t.id_docente('D002') AS d2, t.id_aula('A-12') AS a12, t.id_aula('B-04') AS b04 \gset

-- ---------------------------------------------------------------- lecturas por rol
SELECT t.as_user('admin@susan.test');
SELECT t.eq((public.api_grupos_listar() ->> 'total')::int, 2, 'admin lista 2 grupos');
SELECT t.eq((public.api_grupos_listar(p_periodo => '2026-2') ->> 'total')::int, 2, 'filtro por periodo');
SELECT t.eq((public.api_grupos_listar(p_periodo => '2025-1') ->> 'total')::int, 0, 'periodo sin grupos');
SELECT t.throws($q$ SELECT public.api_grupos_listar(p_periodo => '2026-3') $q$, 'P0001:PERIODO_INVALIDO', 'periodo con formato invalido en filtro');
SELECT t.eq((public.api_grupos_listar(p_q => '3A') ->> 'total')::int, 1, 'busqueda por clave de grupo');
SELECT t.eq((public.api_grupos_listar(p_q => 'ana') ->> 'total')::int, 1, 'busqueda por docente');
SELECT t.eq((public.api_grupos_listar(p_q => 'B-04') -> 'items' -> 0 ->> 'clave_grupo'), '5B', 'busqueda por aula');
SELECT t.eq((public.api_grupos_listar(p_q => '3A') -> 'items' -> 0 ->> 'inscritos_activos')::int, 4, 'conteo de inscritos activos');
SELECT t.eq((public.api_grupos_listar(p_q => '3A') -> 'items' -> 0 ->> 'sesiones_total')::int, 3, 'conteo de sesiones');
SELECT t.eq(jsonb_array_length(public.api_grupos_listar(p_limit => 1) -> 'items'), 1, 'paginacion');
SELECT t.eq(jsonb_array_length(public.api_grupo_obtener(:g3a) -> 'horario'), 2, 'grupo 3A con 2 bloques');
SELECT t.eq(jsonb_array_length(public.api_grupo_obtener(:g3a) -> 'aula' -> 'camaras'), 2, 'grupo con las camaras del aula');
SELECT t.eq(public.api_grupo_obtener(:g3a) -> 'aula' -> 'camaras' -> 0 ->> 'direccion_ip', '10.20.0.12', 'admin ve la IP');
SELECT t.eq((public.api_grupo_obtener(:g3a) -> 'inscritos' ->> 'activos')::int, 4, 'inscritos activos');
SELECT t.eq((public.api_grupo_obtener(:g3a) -> 'inscritos' ->> 'baja')::int, 1, 'inscritos en baja');
SELECT t.eq((public.api_grupo_obtener(:g3a) -> 'sesiones' ->> 'programadas')::int, 1, 'sesiones programadas');
SELECT t.eq((public.api_grupo_obtener(:g3a) -> 'sesiones' ->> 'abiertas')::int, 1, 'sesiones abiertas');
SELECT t.eq((public.api_grupo_obtener(:g3a) -> 'sesiones' ->> 'cerradas')::int, 1, 'sesiones cerradas');
SELECT t.throws($q$ SELECT public.api_grupo_obtener(999999) $q$, 'P0001:NO_ENCONTRADO', 'grupo inexistente');

SELECT t.as_user('docente1@susan.test');
SELECT t.eq((public.api_grupos_listar() ->> 'total')::int, 1, 'docente1: solo su grupo');
SELECT t.eq(public.api_grupo_obtener(:g3a) ->> 'clave_grupo', '3A', 'docente: obtiene su grupo');
SELECT t.ok(public.api_grupo_obtener(:g3a) -> 'aula' -> 'camaras' -> 0 -> 'direccion_ip' = 'null'::jsonb, 'docente: sin IP de camaras');
SELECT t.throws(format($q$ SELECT public.api_grupo_obtener(%s) $q$, :g5b), 'P0001:NO_ENCONTRADO', 'docente ajeno al grupo 5B');
SELECT t.throws(format($q$ SELECT public.api_horario_guardar(%s, '[{"dia_semana":2,"hora_inicio":"10:00","hora_fin":"11:00"}]') $q$, :g3a), 'P0001:NO_AUTORIZADO', 'docente no edita horario');
SELECT t.throws(format($q$ SELECT public.api_generar_sesiones(%s, DATE '2026-10-01', DATE '2026-10-31') $q$, :g3a), 'P0001:NO_AUTORIZADO', 'docente no genera sesiones');
SELECT t.throws($q$ SELECT public.api_grupo_guardar('{}') $q$, 'P0001:NO_AUTORIZADO', 'docente no escribe grupos');
SELECT t.as_user('docente2@susan.test');
SELECT t.throws(format($q$ SELECT public.api_grupo_obtener(%s) $q$, :g3a), 'P0001:NO_ENCONTRADO', 'docente2 ajeno al grupo 3A');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ SELECT public.api_grupos_listar() $q$, 'P0001:NO_AUTORIZADO', 'alumno: sin grupos');
SELECT t.throws(format($q$ SELECT public.api_grupo_obtener(%s) $q$, :g3a), 'P0001:NO_AUTORIZADO', 'alumno propio del grupo: rechazado igual');
SELECT t.throws(format($q$ SELECT public.api_generar_sesiones(%s, DATE '2026-10-01', DATE '2026-10-31') $q$, :g3a), 'P0001:NO_AUTORIZADO', 'alumno no genera sesiones');
SELECT t.as_user('tecnico@susan.test');
SELECT t.throws($q$ SELECT public.api_grupos_listar() $q$, 'P0001:NO_AUTORIZADO', 'tecnico: sin grupos');
SELECT t.throws($q$ SELECT public.api_grupo_guardar('{}') $q$, 'P0001:NO_AUTORIZADO', 'tecnico no escribe grupos');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.api_grupos_listar() $q$, '42501', 'anon: sin EXECUTE');
SELECT t.throws($q$ SELECT public.api_horario_guardar(1, '[]') $q$, '42501', 'anon: sin EXECUTE en horario');

-- ---------------------------------------------------------------- grupo_guardar
SELECT t.as_user('admin@susan.test');
SELECT t.efecto(format($q$ SELECT public.api_grupo_guardar('{"id_materia":%s,"id_docente":%s,"id_aula":%s,"clave_grupo":"3c","periodo":"2026-2"}') $q$, :m2, :d2, :b04),
    $q$ SELECT EXISTS (SELECT 1 FROM public.grupo WHERE clave_grupo = '3C' AND periodo = '2026-2') $q$, 'alta de grupo');
SELECT t.throws(format($q$ SELECT public.api_grupo_guardar('{"id_materia":%s,"id_docente":%s,"id_aula":%s,"clave_grupo":"3A","periodo":"2026-2"}') $q$, :m1, :d1, :a12),
    'P0001:DUPLICADO', 'materia + clave + periodo repetidos');
SELECT t.lives_rb(format($q$ SELECT public.api_grupo_guardar('{"id_materia":%s,"id_docente":%s,"id_aula":%s,"clave_grupo":"3A","periodo":"2027-1"}') $q$, :m1, :d1, :a12), 'misma clave en otro periodo es valida');
SELECT t.throws(format($q$ SELECT public.api_grupo_guardar('{"id_materia":%s,"id_docente":%s,"id_aula":%s,"clave_grupo":"9Z","periodo":"2026-3"}') $q$, :m1, :d1, :a12), 'P0001:PERIODO_INVALIDO', 'periodo 2026-3');
SELECT t.throws(format($q$ SELECT public.api_grupo_guardar('{"id_materia":%s,"id_docente":%s,"id_aula":%s,"clave_grupo":"9Z","periodo":"26-2"}') $q$, :m1, :d1, :a12), 'P0001:PERIODO_INVALIDO', 'periodo 26-2');
SELECT t.throws(format($q$ SELECT public.api_grupo_guardar('{"id_materia":%s,"id_docente":%s,"id_aula":%s,"clave_grupo":"9Z"}') $q$, :m1, :d1, :a12), 'P0001:PERIODO_INVALIDO', 'periodo ausente en alta');
SELECT t.throws(format($q$ SELECT public.api_grupo_guardar('{"id_materia":%s,"id_docente":%s,"id_aula":%s,"clave_grupo":"CLAVE-MUY-LARGA","periodo":"2026-2"}') $q$, :m1, :d1, :a12), 'P0001:VALIDACION', 'clave de grupo > 8');
SELECT t.throws(format($q$ SELECT public.api_grupo_guardar('{"id_materia":999999,"id_docente":%s,"id_aula":%s,"clave_grupo":"9Z","periodo":"2026-2"}') $q$, :d1, :a12), 'P0001:NO_ENCONTRADO', 'materia inexistente');
SELECT t.throws(format($q$ SELECT public.api_grupo_guardar('{"id_materia":%s,"id_docente":999999,"id_aula":%s,"clave_grupo":"9Z","periodo":"2026-2"}') $q$, :m1, :a12), 'P0001:NO_ENCONTRADO', 'docente inexistente');
SELECT t.throws(format($q$ SELECT public.api_grupo_guardar('{"id_materia":%s,"id_docente":%s,"id_aula":999999,"clave_grupo":"9Z","periodo":"2026-2"}') $q$, :m1, :d1), 'P0001:NO_ENCONTRADO', 'aula inexistente');
SELECT t.throws($q$ SELECT public.api_grupo_guardar('{"clave_grupo":"9Z","periodo":"2026-2"}') $q$, 'P0001:VALIDACION', 'faltan materia, docente y aula');
SELECT t.throws($q$ SELECT public.api_grupo_guardar('{"id_grupo":999999,"clave_grupo":"X"}') $q$, 'P0001:NO_ENCONTRADO', 'modificar grupo inexistente');
SELECT t.throws(format($q$ SELECT public.api_grupo_guardar('{"id_grupo":%s,"id_materia":%s}') $q$, :g3a, :m2), 'P0001:GRUPO_CON_HISTORIAL', 'con historial no cambia de materia');
SELECT t.throws(format($q$ SELECT public.api_grupo_guardar('{"id_grupo":%s,"periodo":"2027-1"}') $q$, :g3a), 'P0001:GRUPO_CON_HISTORIAL', 'con historial no cambia de periodo');
SELECT t.efecto(format($q$ SELECT public.api_grupo_guardar('{"id_grupo":%s,"id_docente":%s}') $q$, :g3a, :d2),
    $q$ SELECT (SELECT id_docente FROM public.grupo WHERE clave_grupo = '3A') = (SELECT id_docente FROM public.docente WHERE num_empleado = 'D002') $q$, 'reasignar docente');
SELECT t.as_postgres();
UPDATE public.docente SET estatus = 'licencia' WHERE num_empleado = 'D002';
SELECT t.as_user('admin@susan.test');
SELECT t.throws(format($q$ SELECT public.api_grupo_guardar('{"id_grupo":%s,"id_docente":%s}') $q$, :g3a, :d2), 'P0001:DOCENTE_NO_ACTIVO', 'no se reasigna a un docente en licencia');
SELECT t.lives(format($q$ SELECT public.api_grupo_guardar('{"id_grupo":%s,"clave_grupo":"5B"}') $q$, :g5b), 'docente en licencia que ya era titular puede conservar su grupo');
SELECT t.as_postgres();
UPDATE public.docente SET estatus = 'activo' WHERE num_empleado = 'D002';
SELECT t.as_user('admin@susan.test');

-- ---------------------------------------------------------------- horario_guardar
SELECT t.throws(format($q$ SELECT public.api_horario_guardar(%s, '[{"dia_semana":2,"hora_inicio":"10:00","hora_fin":"09:00"}]') $q$, :g3a), 'P0001:HORARIO_INVALIDO', 'hora_fin < hora_inicio');
SELECT t.throws(format($q$ SELECT public.api_horario_guardar(%s, '[{"dia_semana":2,"hora_inicio":"10:00","hora_fin":"10:00"}]') $q$, :g3a), 'P0001:HORARIO_INVALIDO', 'hora_fin = hora_inicio');
SELECT t.throws(format($q$ SELECT public.api_horario_guardar(%s, '[{"dia_semana":7,"hora_inicio":"10:00","hora_fin":"11:00"}]') $q$, :g3a), 'P0001:HORARIO_INVALIDO', 'dia 7');
SELECT t.throws(format($q$ SELECT public.api_horario_guardar(%s, '[{"dia_semana":0,"hora_inicio":"10:00","hora_fin":"11:00"}]') $q$, :g3a), 'P0001:HORARIO_INVALIDO', 'dia 0');
SELECT t.throws(format($q$ SELECT public.api_horario_guardar(%s, '[{"dia_semana":2,"hora_inicio":"25:00","hora_fin":"26:00"}]') $q$, :g3a), 'P0001:HORARIO_INVALIDO', 'hora imposible');
SELECT t.throws(format($q$ SELECT public.api_horario_guardar(%s, '[{"dia_semana":2,"hora_inicio":"10:00"}]') $q$, :g3a), 'P0001:HORARIO_INVALIDO', 'falta hora_fin');
SELECT t.throws(format($q$ SELECT public.api_horario_guardar(%s, '[5]') $q$, :g3a), 'P0001:HORARIO_INVALIDO', 'bloque que no es objeto');
SELECT t.throws(format($q$ SELECT public.api_horario_guardar(%s, '[]') $q$, :g3a), 'P0001:VALIDACION', 'arreglo vacio');
SELECT t.throws(format($q$ SELECT public.api_horario_guardar(%s, '{"dia_semana":1}') $q$, :g3a), 'P0001:VALIDACION', 'no es arreglo');
SELECT t.throws($q$ SELECT public.api_horario_guardar(999999, '[{"dia_semana":2,"hora_inicio":"10:00","hora_fin":"11:00"}]') $q$, 'P0001:NO_ENCONTRADO', 'grupo inexistente');
SELECT t.throws(format($q$ SELECT public.api_horario_guardar(%s, '[{"dia_semana":2,"hora_inicio":"10:00","hora_fin":"11:00"},{"dia_semana":2,"hora_inicio":"10:30","hora_fin":"11:30"}]') $q$, :g3a), 'P0001:HORARIO_INVALIDO', 'bloques propios traslapados');
SELECT t.lives_rb(format($q$ SELECT public.api_horario_guardar(%s, '[{"dia_semana":2,"hora_inicio":"10:00","hora_fin":"11:00"},{"dia_semana":2,"hora_inicio":"11:00","hora_fin":"12:00"}]') $q$, :g3a), 'bloques propios contiguos son validos');
SELECT t.efecto(format($q$ SELECT public.api_horario_guardar(%s, '[{"dia_semana":2,"hora_inicio":"10:00","hora_fin":"11:00"}]') $q$, :g3a),
    $q$ SELECT (SELECT count(*) FROM public.horario_grupo WHERE id_grupo = (SELECT id_grupo FROM public.grupo WHERE clave_grupo = '3A')) = 1 $q$, 'el horario se reemplaza completo');
SELECT t.efecto(format($q$ SELECT public.api_horario_guardar(%s, '[{"dia_semana":"2","hora_inicio":"10:00:00","hora_fin":"11:30"}]') $q$, :g3a),
    $q$ SELECT EXISTS (SELECT 1 FROM public.horario_grupo WHERE dia_semana = 2 AND hora_fin = '11:30') $q$, 'acepta HH:MM:SS y dia como texto');

-- choque de horario en el aula: otro grupo en A-12 (mismo periodo)
SELECT public.api_grupo_guardar(format('{"id_materia":%s,"id_docente":%s,"id_aula":%s,"clave_grupo":"X1","periodo":"2026-2"}', :m2, :d2, :a12)::jsonb) ->> 'id_grupo' AS gx1 \gset
SELECT t.throws(format($q$ SELECT public.api_horario_guardar(%s, '[{"dia_semana":1,"hora_inicio":"07:30","hora_fin":"08:30"}]') $q$, :gx1), 'P0001:HORARIO_CHOQUE', 'choca con 3A (traslape parcial)');
SELECT t.throws(format($q$ SELECT public.api_horario_guardar(%s, '[{"dia_semana":1,"hora_inicio":"06:00","hora_fin":"09:00"}]') $q$, :gx1), 'P0001:HORARIO_CHOQUE', 'choca con 3A (lo envuelve)');
SELECT t.throws(format($q$ SELECT public.api_horario_guardar(%s, '[{"dia_semana":1,"hora_inicio":"07:15","hora_fin":"07:45"}]') $q$, :gx1), 'P0001:HORARIO_CHOQUE', 'choca con 3A (contenido)');
SELECT t.throws(format($q$ SELECT public.api_horario_guardar(%s, '[{"dia_semana":2,"hora_inicio":"10:00","hora_fin":"11:00"},{"dia_semana":3,"hora_inicio":"06:59","hora_fin":"07:01"}]') $q$, :gx1), 'P0001:HORARIO_CHOQUE', 'un bloque bueno y otro que choca: se rechaza todo');
SELECT t.lives(format($q$ SELECT public.api_horario_guardar(%s, '[{"dia_semana":1,"hora_inicio":"08:00","hora_fin":"09:00"}]') $q$, :gx1), 'contiguo a 3A no choca (08:00 = fin de 3A)');
SELECT t.lives(format($q$ SELECT public.api_horario_guardar(%s, '[{"dia_semana":1,"hora_inicio":"06:00","hora_fin":"07:00"}]') $q$, :gx1), 'contiguo por arriba no choca');
SELECT t.lives(format($q$ SELECT public.api_horario_guardar(%s, '[{"dia_semana":2,"hora_inicio":"07:00","hora_fin":"08:00"}]') $q$, :gx1), 'mismo horario en otro dia no choca');
SELECT t.lives(format($q$ SELECT public.api_horario_guardar(%s, '[{"dia_semana":1,"hora_inicio":"08:00","hora_fin":"09:00"}]') $q$, :gx1), 'preparar horario de X1 lunes 08-09');
SELECT t.lives(format($q$ SELECT public.api_horario_guardar(%s, '[{"dia_semana":1,"hora_inicio":"08:00","hora_fin":"09:00"}]') $q$, :gx1), 'regrabar el propio horario no choca consigo mismo');
SELECT t.lives(format($q$ SELECT public.api_horario_guardar(%s, '[{"dia_semana":1,"hora_inicio":"07:00","hora_fin":"08:00"}]') $q$, :g5b) , 'otra aula (B-04) con el mismo horario que 3A: sin choque');
-- mover un grupo de aula revalida: 5B (B-04, lun 07-08 tras la prueba anterior) hacia A-12 choca con 3A
SELECT t.throws(format($q$ SELECT public.api_grupo_guardar('{"id_grupo":%s,"id_aula":%s}') $q$, :g5b, :a12), 'P0001:HORARIO_CHOQUE', 'cambiar de aula revalida el horario');
SELECT t.as_postgres();
SELECT t.as_user('admin@susan.test');
-- otro periodo en la misma aula y hora no choca
SELECT public.api_grupo_guardar(format('{"id_materia":%s,"id_docente":%s,"id_aula":%s,"clave_grupo":"P1","periodo":"2027-1"}', :m2, :d2, :a12)::jsonb) ->> 'id_grupo' AS gp1 \gset
SELECT t.lives(format($q$ SELECT public.api_horario_guardar(%s, '[{"dia_semana":1,"hora_inicio":"07:00","hora_fin":"08:00"}]') $q$, :gp1), 'otro periodo misma aula y hora: sin choque');

-- ---------------------------------------------------------------- generar_sesiones
SELECT public.api_grupo_guardar(format('{"id_materia":%s,"id_docente":%s,"id_aula":%s,"clave_grupo":"G1","periodo":"2026-2"}', :m1, :d1, :a12)::jsonb) ->> 'id_grupo' AS gg1 \gset
SELECT t.throws(format($q$ SELECT public.api_generar_sesiones(%s, DATE '2026-09-14', DATE '2026-09-27') $q$, :gg1), 'P0001:GRUPO_SIN_HORARIO', 'grupo sin horario');
SELECT public.api_horario_guardar(:gg1, '[{"dia_semana":2,"hora_inicio":"10:00","hora_fin":"11:00"},{"dia_semana":5,"hora_inicio":"10:00","hora_fin":"11:00"}]') IS NOT NULL AS ok_h \gset
SELECT t.throws(format($q$ SELECT public.api_generar_sesiones(%s, DATE '2026-09-27', DATE '2026-09-14') $q$, :gg1), 'P0001:VALIDACION', 'desde > hasta');
SELECT t.throws(format($q$ SELECT public.api_generar_sesiones(%s, NULL, DATE '2026-09-14') $q$, :gg1), 'P0001:VALIDACION', 'desde nulo');
SELECT t.throws(format($q$ SELECT public.api_generar_sesiones(%s, DATE '2026-01-01', DATE '2027-06-01') $q$, :gg1), 'P0001:VALIDACION', 'rango mayor a 366 dias');
SELECT t.throws($q$ SELECT public.api_generar_sesiones(999999, DATE '2026-09-14', DATE '2026-09-27') $q$, 'P0001:NO_ENCONTRADO', 'grupo inexistente');
SELECT public.api_generar_sesiones(:gg1, DATE '2026-09-14', DATE '2026-09-27') AS r1 \gset
SELECT t.eq((:'r1'::jsonb ->> 'creadas')::int, 4, 'genera 4 sesiones (2 martes + 2 viernes)');
SELECT t.eq(:'r1'::jsonb ->> 'modo_registro', 'automatico', 'aula con camara activa: modo automatico');
SELECT t.eq((SELECT count(*) FROM public.sesion_clase WHERE id_grupo = :gg1 AND estatus = 'programada'
              AND tolerancia_min = 20 AND limite_presente_min = 10 AND intervalo_muestreo_seg = 15 AND hora_inicio = '10:00' AND hora_fin = '11:00')::int, 4, 'sesiones con parametros vigentes e iguales al horario');
SELECT t.eq((SELECT min(fecha)::text FROM public.sesion_clase WHERE id_grupo = :gg1), '2026-09-15', 'primer martes');
SELECT t.eq((public.api_generar_sesiones(:gg1, DATE '2026-09-14', DATE '2026-09-27') ->> 'creadas')::int, 0, 'idempotente: no crea de nuevo');
SELECT t.eq((public.api_generar_sesiones(:gg1, DATE '2026-09-14', DATE '2026-09-27') ->> 'ya_existentes')::int, 4, 'idempotente: reporta existentes');
SELECT t.eq((SELECT count(*) FROM public.sesion_clase WHERE id_grupo = :gg1)::int, 4, 'sin duplicados tras repetir');
-- parametros vigentes: cambian y las nuevas los copian; las viejas no se tocan
SELECT t.as_postgres();
UPDATE public.parametro_sistema SET valor = '30' WHERE clave = 'tolerancia_min';
UPDATE public.parametro_sistema SET valor = '12' WHERE clave = 'limite_presente_min';
UPDATE public.parametro_sistema SET valor = '20' WHERE clave = 'intervalo_muestreo_seg';
SELECT t.as_user('admin@susan.test');
SELECT public.api_generar_sesiones(:gg1, DATE '2026-09-14', DATE '2026-10-04') AS r2 \gset
SELECT t.eq((:'r2'::jsonb ->> 'creadas')::int, 2, 'ampliar el rango crea solo las nuevas (29-sep y 2-oct)');
SELECT t.eq((:'r2'::jsonb ->> 'ya_existentes')::int, 4, 'las 4 anteriores se omiten');
SELECT t.eq((:'r2'::jsonb -> 'parametros' ->> 'tolerancia_min')::int, 30, 'respuesta con los parametros vigentes');
SELECT t.eq((SELECT count(*) FROM public.sesion_clase WHERE id_grupo = :gg1 AND tolerancia_min = 30 AND limite_presente_min = 12 AND intervalo_muestreo_seg = 20)::int, 2, 'las nuevas copian los parametros vigentes');
SELECT t.eq((SELECT count(*) FROM public.sesion_clase WHERE id_grupo = :gg1 AND tolerancia_min = 20)::int, 4, 'las ya creadas no cambian');
-- omitir fechas
SELECT public.api_generar_sesiones(:gg1, DATE '2026-10-05', DATE '2026-10-09', ARRAY[DATE '2026-10-06']) AS r3 \gset
SELECT t.eq((:'r3'::jsonb ->> 'creadas')::int, 1, 'omitir el martes 6-oct: solo crea el viernes');
SELECT t.eq((:'r3'::jsonb ->> 'omitidas_por_fecha')::int, 1, 'reporta omitida por fecha');
SELECT t.eq((:'r3'::jsonb ->> 'omitidas')::int, 1, 'omitidas totales');
SELECT t.ok(NOT EXISTS (SELECT 1 FROM public.sesion_clase WHERE id_grupo = :gg1 AND fecha = '2026-10-06'), 'la fecha omitida no existe');
-- grupo existente: ya hay sesiones, no se duplican
SELECT t.eq((public.api_generar_sesiones(:g3a, DATE '2026-09-14', DATE '2026-09-16') ->> 'creadas')::int, 0, '3A: lunes 14 y miercoles 16 ya existen');
SELECT t.eq((public.api_generar_sesiones(:g3a, DATE '2026-09-14', DATE '2026-09-16') ->> 'ya_existentes')::int, 2, '3A: dos ya existentes');
-- aula sin camara activa => manual
SELECT t.eq(public.api_generar_sesiones(:g5b, DATE '2026-09-21', DATE '2026-09-21') ->> 'modo_registro', 'manual', 'B-04 sin camara activa: sesiones manuales') ;
SELECT t.eq((SELECT modo_registro::text FROM public.sesion_clase WHERE id_grupo = :g5b AND fecha = '2026-09-21'), 'manual', 'la sesion nace manual');
SELECT t.eq((SELECT hora_inicio::text FROM public.sesion_clase WHERE id_grupo = :g5b AND fecha = '2026-09-21'), '07:00:00', 'usa el horario vigente del grupo (5B quedo lun 07-08)');

SELECT t.summary();
ROLLBACK;
