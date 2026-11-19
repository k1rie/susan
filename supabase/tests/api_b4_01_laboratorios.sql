-- api_b4_01: laboratorios (extension 20). El docente solicita, el administrador autoriza.
-- Fixtures: reloj lunes 14-sep-2026 07:12 · 3A (D001, A-12, 4 inscritos activos) · 5B (D002, B-04).
BEGIN;
SELECT t.begin('api_b4_01_laboratorios');
SELECT t.cargar_fixtures();

-- Catalogo de apoyo (como postgres): LAB-1 con clases de otros grupos para probar choques.
--   7Z (D002) usa LAB-1 los viernes 10:00-12:00 SIN sesiones generadas  -> choque por horario semanal
--   8Y (D002) usa LAB-1 los jueves 08:00-10:00 CON sesiones             -> choque por sesion concreta; una suspendida
SELECT t.as_postgres();
INSERT INTO public.aula (clave, edificio, capacidad, tipo) VALUES ('LAB-1', 'C', 30, 'laboratorio'), ('LAB-2', 'C', 3, 'laboratorio'), ('LAB-3', 'C', 30, 'laboratorio');
INSERT INTO public.grupo (id_materia, id_docente, id_aula, clave_grupo, periodo) VALUES
    (t.id_materia('CON202'), t.id_docente('D002'), t.id_aula('LAB-1'), '7Z', '2026-2'),
    (t.id_materia('CON202'), t.id_docente('D002'), t.id_aula('LAB-1'), '8Y', '2026-2');
INSERT INTO public.horario_grupo (id_grupo, dia_semana, hora_inicio, hora_fin) VALUES
    (t.id_grupo('7Z'), 5, '10:00', '12:00'), (t.id_grupo('8Y'), 4, '08:00', '10:00');
INSERT INTO public.sesion_clase (id_grupo, fecha, hora_inicio, hora_fin, estatus) VALUES
    (t.id_grupo('8Y'), '2026-09-17', '08:00', '10:00', 'programada'),
    (t.id_grupo('8Y'), '2026-09-24', '08:00', '10:00', 'suspendida');
SELECT t.id_aula('LAB-1') AS lab1, t.id_aula('LAB-2') AS lab2, t.id_aula('LAB-3') AS lab3, t.id_aula('A-12') AS a12,
       t.id_grupo('3A') AS g3a, t.id_grupo('5B') AS g5b \gset

-- ---------------------------------------------------------------------------------------------
-- 1) El aula tiene tipo (api_aula_guardar) y api_laboratorios_listar lista solo laboratorios
-- ---------------------------------------------------------------------------------------------
SELECT t.as_user('admin@susan.test');
SELECT t.eq(public.api_aula_guardar('{"clave":"LAB-9","edificio":"C","capacidad":20,"tipo":"laboratorio"}') ->> 'tipo', 'laboratorio', 'alta de aula tipo laboratorio');
SELECT t.eq(public.api_aula_guardar('{"clave":"C-77","edificio":"C","capacidad":20}') ->> 'tipo', 'aula', 'tipo por omision: aula');
SELECT t.throws($q$ SELECT public.api_aula_guardar('{"clave":"C-78","edificio":"C","capacidad":20,"tipo":"taller"}') $q$, 'P0001:VALIDACION', 'tipo invalido');
SELECT t.eq((public.api_aulas_listar(p_q => 'LAB-9') -> 'items' -> 0 ->> 'tipo'), 'laboratorio', 'api_aulas_listar expone el tipo');
SELECT t.eq((public.api_laboratorios_listar() ->> 'total')::int, 4, 'admin: 4 laboratorios (LAB-1, LAB-2, LAB-3, LAB-9)');
SELECT t.eq(public.api_laboratorios_listar() -> 'items' -> 0 ->> 'clave', 'LAB-1', 'laboratorios ordenados por clave');
SELECT t.as_user('docente1@susan.test');
SELECT t.eq((public.api_laboratorios_listar() ->> 'total')::int, 4, 'docente tambien ve los laboratorios (aunque no sean de sus grupos)');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ SELECT public.api_laboratorios_listar() $q$, 'P0001:NO_AUTORIZADO', 'alumno no lista laboratorios');
SELECT t.as_user('tecnico@susan.test');
SELECT t.throws($q$ SELECT public.api_laboratorios_listar() $q$, 'P0001:NO_AUTORIZADO', 'tecnico no lista laboratorios');

-- ---------------------------------------------------------------------------------------------
-- 2) Solicitar (docente1, grupo 3A): caso feliz y bitacora
-- ---------------------------------------------------------------------------------------------
SELECT t.as_user('docente1@susan.test');
SELECT (public.api_laboratorio_solicitar(jsonb_build_object('id_aula', :lab1, 'id_grupo', :g3a, 'fecha', '2026-09-16',
        'hora_inicio', '10:00', 'hora_fin', '12:00', 'actividad', 'Practica de balanza de comprobacion')) ->> 'id_solicitud')::int AS s3a \gset
SELECT t.eq((SELECT estatus::text FROM public.solicitud_laboratorio WHERE id_solicitud = :s3a), 'pendiente', 'la solicitud nace pendiente');
SELECT t.eq(public.api_laboratorio_solicitudes_listar() -> 'items' -> 0 -> 'aula' ->> 'clave', 'LAB-1', 'la lista trae el laboratorio');
SELECT t.eq(public.api_laboratorio_solicitudes_listar() -> 'items' -> 0 -> 'grupo' ->> 'clave_grupo', '3A', 'la lista trae el grupo');
SELECT t.eq((public.api_laboratorio_solicitudes_listar() -> 'items' -> 0 -> 'grupo' ->> 'inscritos')::int, 4, 'inscritos activos del grupo');
SELECT t.eq(public.api_laboratorio_solicitudes_listar() -> 'items' -> 0 ->> 'hora_inicio', '10:00', 'hora de inicio HH:MM');
SELECT t.eq((public.api_laboratorio_solicitudes_listar() -> 'items' -> 0 ->> 'vencida')::boolean, false, 'no vencida');
SELECT t.as_postgres();
SELECT t.eq((SELECT count(*) FROM public.bitacora_auditoria WHERE accion = 'solicitud_laboratorio'), 1::bigint, 'la solicitud deja constancia en bitacora');

-- ---------------------------------------------------------------------------------------------
-- 3) Rechazos al solicitar
-- ---------------------------------------------------------------------------------------------
SELECT t.as_user('docente1@susan.test');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_solicitar('{"id_aula":%s,"id_grupo":%s,"fecha":"16/09/2026","hora_inicio":"10:00","hora_fin":"12:00","actividad":"Practica"}') $q$, :lab1, :g3a),
    'P0001:VALIDACION', 'fecha con formato invalido');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_solicitar('{"id_aula":%s,"id_grupo":%s,"fecha":"2026-02-31","hora_inicio":"10:00","hora_fin":"12:00","actividad":"Practica"}') $q$, :lab1, :g3a),
    'P0001:VALIDACION', 'fecha inexistente');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_solicitar('{"id_aula":%s,"id_grupo":%s,"fecha":"2026-09-18","hora_inicio":"9am","hora_fin":"12:00","actividad":"Practica"}') $q$, :lab3, :g3a),
    'P0001:HORA_INVALIDA', 'hora de inicio invalida');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_solicitar('{"id_aula":%s,"id_grupo":%s,"fecha":"2026-09-18","hora_inicio":"12:00","hora_fin":"10:00","actividad":"Practica"}') $q$, :lab3, :g3a),
    'P0001:HORA_INVALIDA', 'fin antes que inicio');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_solicitar('{"id_aula":%s,"id_grupo":%s,"fecha":"2026-09-18","hora_inicio":"10:00","hora_fin":"10:20","actividad":"Practica"}') $q$, :lab3, :g3a),
    'P0001:VALIDACION', 'menos de 30 minutos');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_solicitar('{"id_aula":%s,"id_grupo":%s,"fecha":"2026-09-18","hora_inicio":"07:00","hora_fin":"16:00","actividad":"Practica"}') $q$, :lab3, :g3a),
    'P0001:VALIDACION', 'mas de 8 horas');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_solicitar('{"id_aula":%s,"id_grupo":%s,"fecha":"2026-09-18","hora_inicio":"10:00","hora_fin":"12:00","actividad":"ab"}') $q$, :lab3, :g3a),
    'P0001:VALIDACION', 'actividad demasiado corta');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_solicitar('{"id_aula":%s,"fecha":"2026-09-18","hora_inicio":"10:00","hora_fin":"12:00","actividad":"Practica"}') $q$, :lab3),
    'P0001:VALIDACION', 'falta el grupo');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_solicitar('{"id_aula":%s,"id_grupo":%s,"fecha":"2026-09-18","hora_inicio":"10:00","hora_fin":"12:00","actividad":"Practica"}') $q$, :a12, :g3a),
    'P0001:LAB_NO_ES_LABORATORIO', 'un aula comun no se solicita como laboratorio');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_solicitar('{"id_aula":999999,"id_grupo":%s,"fecha":"2026-09-18","hora_inicio":"10:00","hora_fin":"12:00","actividad":"Practica"}') $q$, :g3a),
    'P0001:NO_ENCONTRADO', 'laboratorio inexistente');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_solicitar('{"id_aula":%s,"id_grupo":%s,"fecha":"2026-09-18","hora_inicio":"10:00","hora_fin":"12:00","actividad":"Practica"}') $q$, :lab3, :g5b),
    'P0001:NO_ENCONTRADO', 'grupo de otro docente: no se revela');
-- plazos: hoy 07:12 con 24 h de anticipacion
SELECT t.throws(format($q$ SELECT public.api_laboratorio_solicitar('{"id_aula":%s,"id_grupo":%s,"fecha":"2026-09-14","hora_inicio":"10:00","hora_fin":"12:00","actividad":"Practica"}') $q$, :lab3, :g3a),
    'P0001:LAB_FUERA_DE_PLAZO', 'hoy mismo: sin la anticipacion minima');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_solicitar('{"id_aula":%s,"id_grupo":%s,"fecha":"2026-09-13","hora_inicio":"10:00","hora_fin":"12:00","actividad":"Practica"}') $q$, :lab3, :g3a),
    'P0001:LAB_FUERA_DE_PLAZO', 'fecha pasada');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_solicitar('{"id_aula":%s,"id_grupo":%s,"fecha":"2026-12-31","hora_inicio":"10:00","hora_fin":"12:00","actividad":"Practica"}') $q$, :lab3, :g3a),
    'P0001:LAB_FUERA_DE_PLAZO', 'mas alla del horizonte de 60 dias');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_solicitar('{"id_aula":%s,"id_grupo":%s,"fecha":"2026-09-18","hora_inicio":"10:00","hora_fin":"12:00","actividad":"Practica"}') $q$, :lab2, :g3a),
    'P0001:LAB_CAPACIDAD_INSUFICIENTE', 'el grupo (4) no cabe en un laboratorio de 3');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_solicitar('{"id_aula":%s,"id_grupo":%s,"fecha":"2026-09-16","hora_inicio":"11:00","hora_fin":"13:00","actividad":"Otra practica"}') $q$, :lab3, :g3a),
    'P0001:SOLICITUD_DUPLICADA', 'el mismo grupo no puede estar en dos laboratorios a la vez');
-- choques con clases del laboratorio
SELECT t.throws(format($q$ SELECT public.api_laboratorio_solicitar('{"id_aula":%s,"id_grupo":%s,"fecha":"2026-09-18","hora_inicio":"11:00","hora_fin":"12:30","actividad":"Practica"}') $q$, :lab1, :g3a),
    'P0001:LAB_OCUPADO', 'choca con el horario semanal de 7Z (sin sesiones generadas)');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_solicitar('{"id_aula":%s,"id_grupo":%s,"fecha":"2026-09-17","hora_inicio":"09:00","hora_fin":"11:00","actividad":"Practica"}') $q$, :lab1, :g3a),
    'P0001:LAB_OCUPADO', 'choca con una sesion concreta de 8Y');
SELECT t.lives(format($q$ SELECT public.api_laboratorio_solicitar('{"id_aula":%s,"id_grupo":%s,"fecha":"2026-09-18","hora_inicio":"12:00","hora_fin":"14:00","actividad":"Practica"}') $q$, :lab1, :g3a),
    'justo al terminar la clase de 7Z (12:00) ya esta libre');
SELECT t.lives(format($q$ SELECT public.api_laboratorio_solicitar('{"id_aula":%s,"id_grupo":%s,"fecha":"2026-09-24","hora_inicio":"08:30","hora_fin":"09:30","actividad":"Practica"}') $q$, :lab1, :g3a),
    'la sesion suspendida de 8Y ya no bloquea el laboratorio');
-- roles
SELECT t.as_user('docente2@susan.test');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_solicitar('{"id_aula":%s,"id_grupo":%s,"fecha":"2026-09-18","hora_inicio":"13:00","hora_fin":"14:00","actividad":"Practica"}') $q$, :lab3, :g3a),
    'P0001:NO_ENCONTRADO', 'docente2 no puede pedir con el grupo 3A (IDOR)');
SELECT t.as_user('admin@susan.test');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_solicitar('{"id_aula":%s,"id_grupo":%s,"fecha":"2026-09-18","hora_inicio":"13:00","hora_fin":"14:00","actividad":"Practica"}') $q$, :lab3, :g3a),
    'P0001:NO_AUTORIZADO', 'el administrador no solicita (solo autoriza)');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_solicitar('{"id_aula":%s,"id_grupo":%s,"fecha":"2026-09-18","hora_inicio":"13:00","hora_fin":"14:00","actividad":"Practica"}') $q$, :lab3, :g3a),
    'P0001:NO_AUTORIZADO', 'el alumno no solicita');

-- docente2 compite por el mismo horario con 5B (se traslapa con la pendiente de 3A)
SELECT t.as_user('docente2@susan.test');
SELECT (public.api_laboratorio_solicitar(jsonb_build_object('id_aula', :lab1, 'id_grupo', :g5b, 'fecha', '2026-09-16',
        'hora_inicio', '11:00', 'hora_fin', '13:00', 'actividad', 'Practica de poliza de diario')) ->> 'id_solicitud')::int AS s5b \gset
SELECT t.eq((SELECT estatus::text FROM public.solicitud_laboratorio WHERE id_solicitud = :s5b), 'pendiente', 'una pendiente no bloquea a otra: el administrador decide');

-- ---------------------------------------------------------------------------------------------
-- 4) Visibilidad por rol
-- ---------------------------------------------------------------------------------------------
SELECT t.as_user('docente2@susan.test');
SELECT t.eq((public.api_laboratorio_solicitudes_listar() ->> 'total')::int, 1, 'docente2 solo ve la suya');
SELECT t.eq((SELECT count(*) FROM public.solicitud_laboratorio), 1::bigint, 'RLS: docente2 solo lee su fila');
SELECT t.as_user('alumno1@susan.test');
SELECT t.eq((SELECT count(*) FROM public.solicitud_laboratorio), 0::bigint, 'RLS: el alumno no ve solicitudes');
SELECT t.throws($q$ SELECT public.api_laboratorio_solicitudes_listar() $q$, 'P0001:NO_AUTORIZADO', 'el alumno no lista solicitudes');
SELECT t.as_user('docente1@susan.test');
SELECT t.eq((public.api_laboratorio_solicitudes_listar() ->> 'total')::int, 3, 'docente1 ve las 3 suyas (la de 3A y las 2 de los casos de choque libres)');
SELECT t.as_user('admin@susan.test');
SELECT t.eq((public.api_laboratorio_solicitudes_listar() ->> 'total')::int, 4, 'admin ve las 4');
SELECT t.eq((public.api_laboratorio_solicitudes_listar() -> 'conteos' ->> 'pendiente')::int, 4, 'conteos: 4 pendientes');
SELECT t.eq((public.api_laboratorio_solicitudes_listar(p_estatus => 'aprobada') ->> 'total')::int, 0, 'filtro por estatus');
SELECT t.eq((public.api_laboratorio_solicitudes_listar(p_estatus => 'aprobada') -> 'conteos' ->> 'pendiente')::int, 4, 'los conteos ignoran el filtro de estatus');
SELECT t.throws($q$ SELECT public.api_laboratorio_solicitudes_listar(p_estatus => 'inventado') $q$, 'P0001:VALIDACION', 'estatus desconocido');
SELECT t.eq(jsonb_array_length(public.api_laboratorio_solicitudes_listar(p_limit => 2) -> 'items'), 2, 'paginado: limit 2');
SELECT t.eq(jsonb_array_length(public.api_laboratorio_solicitudes_listar(p_limit => 2, p_offset => 3) -> 'items'), 1, 'paginado: offset 3 deja 1');
-- pendientes primero por fecha ascendente: la del 16-sep antes que la del 18 y la del 24
SELECT t.eq(public.api_laboratorio_solicitudes_listar() -> 'items' -> 0 ->> 'fecha', '2026-09-16', 'orden: la mas proxima primero');
SELECT t.eq(public.api_laboratorio_solicitudes_listar(p_id_aula => :lab1, p_desde => '2026-09-16', p_hasta => '2026-09-16') ->> 'total', '2', 'filtro por laboratorio y fecha');
SELECT t.eq((public.api_laboratorio_solicitudes_listar(p_id_aula => :lab1, p_desde => '2026-09-16', p_hasta => '2026-09-16') -> 'items' -> 0 ->> 'compite')::int, 1, 'el administrador ve con cuantas pendientes compite');
SELECT t.ok((public.api_laboratorio_solicitudes_listar(p_id_aula => :lab1, p_desde => '2026-09-16', p_hasta => '2026-09-16') -> 'items' -> 0 -> 'conflicto') = 'null'::jsonb, 'sin choque con clases ni aprobadas: conflicto null');
SELECT t.as_user('docente1@susan.test');
SELECT t.ok(NOT (public.api_laboratorio_solicitudes_listar() -> 'items' -> 0 ? 'compite'), 'el docente no ve con quien compite');

-- ---------------------------------------------------------------------------------------------
-- 5) Resolver (administrador)
-- ---------------------------------------------------------------------------------------------
SELECT t.as_user('docente1@susan.test');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_resolver(%s, true) $q$, :s3a), 'P0001:NO_AUTORIZADO', 'el docente no autoriza');
SELECT t.as_user('admin@susan.test');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_resolver(%s, false) $q$, :s5b), 'P0001:VALIDACION', 'rechazar exige motivo');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_resolver(%s, false, 'no') $q$, :s5b), 'P0001:VALIDACION', 'el motivo debe tener al menos 3 caracteres');
SELECT t.throws($q$ SELECT public.api_laboratorio_resolver(999999, true) $q$, 'P0001:NO_ENCONTRADO', 'solicitud inexistente');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_resolver(%s, NULL) $q$, :s3a), 'P0001:VALIDACION', 'falta la decision');
SELECT t.eq(public.api_laboratorio_resolver(:s3a, true, 'Autorizado') ->> 'estatus', 'aprobada', 'el administrador aprueba');
SELECT t.eq(public.api_laboratorio_solicitudes_listar(p_estatus => 'aprobada') -> 'items' -> 0 ->> 'resuelto_por', 'admin@susan.test', 'queda quien autorizo');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_resolver(%s, true) $q$, :s3a), 'P0001:SOLICITUD_YA_RESUELTA', 'no se resuelve dos veces');
-- la de 5B ya no se puede aprobar: 3A tiene aprobado ese horario
SELECT t.throws(format($q$ SELECT public.api_laboratorio_resolver(%s, true) $q$, :s5b), 'P0001:LAB_OCUPADO', 'no se aprueban dos solicitudes traslapadas');
SELECT t.ok(position('3A' IN (public.api_laboratorio_solicitudes_listar(p_estatus => 'pendiente', p_id_aula => :lab1, p_desde => '2026-09-16', p_hasta => '2026-09-16') -> 'items' -> 0 ->> 'conflicto')) > 0,
    'la lista del administrador explica el conflicto (menciona 3A)');
-- red de seguridad: aunque se salte la RPC, el disparador lo impide
SELECT t.as_postgres();
SELECT t.throws(format($q$ UPDATE public.solicitud_laboratorio SET estatus = 'aprobada', resuelto_por = (SELECT id_usuario FROM public.usuario WHERE correo = 'admin@susan.test'), fecha_resolucion = app.now() WHERE id_solicitud = %s $q$, :s5b),
    'lab01_solicitud_traslape', 'disparador lab01: dos aprobadas no se traslapan');
SELECT t.as_user('admin@susan.test');
SELECT t.eq(public.api_laboratorio_resolver(:s5b, false, 'Ese horario ya fue asignado a 3A')  ->> 'estatus', 'rechazada', 'rechazar con motivo');
SELECT t.eq(public.api_laboratorio_solicitudes_listar(p_estatus => 'rechazada') -> 'items' -> 0 ->> 'comentario', 'Ese horario ya fue asignado a 3A', 'el docente puede leer el motivo');
-- horarios contiguos no se traslapan
SELECT t.as_user('docente2@susan.test');
SELECT (public.api_laboratorio_solicitar(jsonb_build_object('id_aula', :lab1, 'id_grupo', :g5b, 'fecha', '2026-09-16',
        'hora_inicio', '12:00', 'hora_fin', '13:00', 'actividad', 'Practica contigua')) ->> 'id_solicitud')::int AS s5c \gset
SELECT t.as_user('admin@susan.test');
SELECT t.eq(public.api_laboratorio_resolver(:s5c, true) ->> 'estatus', 'aprobada', 'una solicitud que empieza donde termina otra no choca');

-- ---------------------------------------------------------------------------------------------
-- 6) Agenda
-- ---------------------------------------------------------------------------------------------
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(jsonb_array_length(public.api_laboratorio_agenda(:lab1, '2026-09-14', '2026-09-27') -> 'bloques'), 5,
    'agenda LAB-1: 1 clase (8Y, 17-sep) + 4 solicitudes vigentes (3A y 5B aprobadas el 16, y las del 18 y el 24)');
SELECT t.eq((SELECT count(*) FROM jsonb_array_elements(public.api_laboratorio_agenda(:lab1, '2026-09-14', '2026-09-27') -> 'bloques') b WHERE b ->> 'tipo' = 'clase'), 1::bigint, 'agenda: 1 clase (la suspendida no aparece)');
SELECT t.ok((SELECT bool_and(b -> 'docente_nombre' = 'null'::jsonb) FROM jsonb_array_elements(public.api_laboratorio_agenda(:lab1, '2026-09-14', '2026-09-27') -> 'bloques') b), 'el docente no ve nombres de docentes');
SELECT t.ok((SELECT bool_and(b -> 'id_solicitud' = 'null'::jsonb) FROM jsonb_array_elements(public.api_laboratorio_agenda(:lab1, '2026-09-14', '2026-09-27') -> 'bloques') b
              WHERE NOT (b ->> 'propia')::boolean), 'del bloque ajeno no se entrega el id de la solicitud');
SELECT t.as_user('admin@susan.test');
SELECT t.ok((SELECT bool_or(b ->> 'docente_nombre' IS NOT NULL) FROM jsonb_array_elements(public.api_laboratorio_agenda(:lab1, '2026-09-14', '2026-09-27') -> 'bloques') b), 'el administrador si ve al docente');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_agenda(%s, '2026-09-14', '2026-12-31') $q$, :lab1), 'P0001:VALIDACION', 'rango maximo de 42 dias');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_agenda(%s, '2026-09-20', '2026-09-14') $q$, :lab1), 'P0001:VALIDACION', 'rango invertido');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_agenda(%s, '2026-09-14', '2026-09-20') $q$, :a12), 'P0001:NO_ENCONTRADO', 'un aula comun no tiene agenda de laboratorio');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_agenda(%s, '2026-09-14', '2026-09-20') $q$, :lab1), 'P0001:NO_AUTORIZADO', 'el alumno no ve la agenda');

-- ---------------------------------------------------------------------------------------------
-- 7) Un laboratorio con solicitudes vigentes no deja de serlo
-- ---------------------------------------------------------------------------------------------
SELECT t.as_user('admin@susan.test');
SELECT t.throws(format($q$ SELECT public.api_aula_guardar('{"id_aula":%s,"tipo":"aula"}') $q$, :lab1), 'P0001:AULA_TIPO_CON_SOLICITUDES', 'LAB-1 tiene solicitudes aprobadas vigentes');
SELECT t.lives(format($q$ SELECT public.api_aula_guardar('{"id_aula":%s,"tipo":"aula"}') $q$, :lab2), 'LAB-2 sin solicitudes si puede cambiar de tipo');

-- ---------------------------------------------------------------------------------------------
-- 8) Cancelar
-- ---------------------------------------------------------------------------------------------
SELECT t.as_user('docente2@susan.test');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_cancelar(%s) $q$, :s3a), 'P0001:NO_ENCONTRADO', 'docente2 no cancela la solicitud de docente1');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_cancelar(%s) $q$, :s5b), 'P0001:SOLICITUD_YA_RESUELTA', 'una rechazada no se cancela');
SELECT t.eq(public.api_laboratorio_cancelar(:s5c) ->> 'estatus', 'cancelada', 'el docente cancela su solicitud aprobada que aun no inicia');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_cancelar(%s) $q$, :s5c), 'P0001:SOLICITUD_YA_RESUELTA', 'ya cancelada');
SELECT t.as_user('admin@susan.test');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_cancelar(%s) $q$, :s3a), 'P0001:VALIDACION', 'el administrador debe dar motivo');
-- cancelada: libera el horario y se puede pedir de nuevo
SELECT t.as_user('docente2@susan.test');
SELECT t.lives(format($q$ SELECT public.api_laboratorio_solicitar(jsonb_build_object('id_aula', %s, 'id_grupo', %s, 'fecha', '2026-09-16', 'hora_inicio', '12:00', 'hora_fin', '13:00', 'actividad', 'Reprogramada')) $q$, :lab1, :g5b),
    'tras cancelar, el mismo grupo puede volver a pedir ese horario');

-- ---------------------------------------------------------------------------------------------
-- 9) Reloj: una vez iniciada, la solicitud vence
-- ---------------------------------------------------------------------------------------------
SELECT t.reloj('2026-09-16 12:30:00-06');
SELECT t.as_user('admin@susan.test');
SELECT t.ok((SELECT bool_and((i ->> 'vencida')::boolean) FROM jsonb_array_elements(public.api_laboratorio_solicitudes_listar(p_estatus => 'pendiente') -> 'items') i
              WHERE i ->> 'fecha' = '2026-09-16'), 'una pendiente cuya hora de inicio ya paso aparece vencida');
SELECT t.throws(format($q$ SELECT public.api_laboratorio_cancelar(%s, 'Mantenimiento del laboratorio') $q$, :s3a), 'P0001:SOLICITUD_VENCIDA', 'una aprobada que ya inicio no se cancela');
SELECT t.reloj('2026-09-15 08:00:00-06');
SELECT t.as_user('admin@susan.test');
SELECT t.eq(public.api_laboratorio_cancelar(:s3a, 'Mantenimiento del laboratorio') ->> 'estatus', 'cancelada', 'el administrador cancela una aprobada futura con motivo');
SELECT t.as_postgres();
SELECT t.ok((SELECT valor FROM public.parametro_sistema WHERE clave = 'lab_anticipacion_horas') = '24', 'parametro lab_anticipacion_horas = 24');
SELECT t.ok((SELECT valor FROM public.parametro_sistema WHERE clave = 'lab_horizonte_dias') = '60', 'parametro lab_horizonte_dias = 60');
SELECT t.throws($q$ SELECT app.validar_parametro('lab_horizonte_dias', '0') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO', 'horizonte minimo 1 dia');
SELECT t.throws($q$ SELECT app.validar_parametro('lab_anticipacion_horas', '721') $q$, 'P0001:PARAMETRO_VALOR_INVALIDO', 'anticipacion maxima 720 horas');
SELECT t.eq(app.validar_parametro('lab_anticipacion_horas', '0'), '0', 'anticipacion 0 es valida');

SELECT t.summary();
ROLLBACK;
