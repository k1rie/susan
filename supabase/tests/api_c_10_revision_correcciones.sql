-- api_c_10 · api_corregir_asistencia (RF-11, RN-08; docs/api/revision.md 3.2 y 6.1)
BEGIN;
SELECT t.begin('api_c_10_revision_correcciones');
SELECT t.cargar_fixtures();
\ir api_c_escenario.inc

-- Reloj: 47 h despues de hora_fin de S1 (vence 2026-09-10 09:00-06). Las fixtures parten de 14-sep: se retrocede.
SELECT t.reloj('2026-09-10 08:00:00-06');

-- ===== COR: api_corregir_asistencia ================================================================
SELECT t.as_user('docente1@susan.test');
SELECT t.efecto($q$ SELECT public.api_corregir_asistencia(t.c('AS1'), 'presente', 'Llegó a tiempo') $q$,
    $q$ SELECT (SELECT estado::text || '/' || origen::text || '/' || conteo_detecciones || '/' || (hora_registro = '2026-09-08 07:04:55-06')
                  FROM asistencia WHERE id_asistencia = t.c('AS1')) = 'presente/correccion/2/true'
           AND (t.c_bit('correccion', 'asistencia', t.c('AS1')) -> 'valor_anterior' ->> 'estado') = 'pendiente'
           AND (t.c_bit('correccion', 'asistencia', t.c('AS1')) -> 'valor_nuevo' ->> 'estado') = 'presente'
           AND (t.c_bit('correccion', 'asistencia', t.c('AS1')) -> 'valor_nuevo' ->> 'comentario') = 'Llegó a tiempo'
           AND (t.c_bit('correccion', 'asistencia', t.c('AS1')) ->> 'id_usuario')::int = t.id_usuario('docente1@susan.test') $q$,
    'COR-01: corregir pendiente a presente (47 h): origen correccion, hora y lecturas intactas, bitacora');
SELECT t.efecto($q$ SELECT t.reloj('2026-09-10 09:00:00-06'); SELECT public.api_corregir_asistencia(t.c('AS1'), 'presente') $q$,
    $q$ SELECT estado = 'presente' FROM asistencia WHERE id_asistencia = t.c('AS1') $q$, 'COR-02: a las 48 h exactas todavia se acepta');
SELECT t.throws($q$ SELECT t.reloj('2026-09-10 09:00:01-06'); SELECT public.api_corregir_asistencia(t.c('AS1'), 'presente') $q$,
    'P0001:RN_08_PLAZO_VENCIDO', 'COR-03: 48 h + 1 s: plazo vencido');
SELECT t.throws($q$ SELECT t.reloj('2026-09-10 10:00:00-06'); SELECT public.api_corregir_asistencia(t.c('AS1'), 'presente') $q$,
    'P0001:RN_08_PLAZO_VENCIDO', 'COR-04: 49 h: plazo vencido');
SELECT t.eq((SELECT estado::text FROM asistencia WHERE id_asistencia = t.c('AS1')), 'pendiente', 'COR-03: el registro queda intacto');
SELECT t.eq(t.c_nbit('correccion', 'asistencia', t.c('AS1')), 0::bigint, 'COR-03: sin asiento en bitacora');
SELECT t.efecto($q$ SELECT public.api_corregir_asistencia(t.c('AS1'), 'ausente') $q$,
    $q$ SELECT (SELECT hora_registro IS NULL FROM asistencia WHERE id_asistencia = t.c('AS1'))
           AND (t.c_bit('correccion', 'asistencia', t.c('AS1')) -> 'valor_anterior' ->> 'hora_registro') = '2026-09-08T07:04:55-06:00'
           AND (SELECT count(*) FROM deteccion d JOIN captura c ON c.id_captura = d.id_captura WHERE c.id_sesion = t.c('S1')) = 3 $q$,
    'COR-05: a ausente: sin hora, hora original en bitacora, las 3 detecciones siguen');
SELECT t.efecto($q$ SELECT public.api_corregir_asistencia(t.c('AS4'), 'retardo'); SELECT public.api_corregir_asistencia(t.c('AS4'), 'presente');
                    SELECT public.api_corregir_asistencia(t.c('AS3'), 'ausente'); SELECT public.api_corregir_asistencia(t.c('AS2'), 'retardo') $q$,
    $q$ SELECT t.c_nbit('correccion', 'asistencia', t.c('AS4')) = 2 AND t.c_nbit('correccion', 'asistencia', t.c('AS3')) = 1
           AND (SELECT estado::text FROM asistencia WHERE id_asistencia = t.c('AS2')) = 'retardo'
           AND (SELECT origen::text FROM asistencia WHERE id_asistencia = t.c('AS2')) = 'correccion' $q$,
    'COR-06: presente<->retardo, retardo->ausente, ausente->retardo (un asiento por cambio)');
SELECT t.throws($q$ SELECT public.api_corregir_asistencia(t.c('AS1'), 'pendiente') $q$, 'P0001:TRANSICION_NO_PERMITIDA', 'COR-07: a pendiente');
SELECT t.throws($q$ SELECT public.api_corregir_asistencia(t.c('AS1'), 'justificado') $q$, 'P0001:TRANSICION_NO_PERMITIDA', 'COR-08: a justificado');
SELECT t.throws($q$ SELECT public.api_corregir_asistencia(t.c('AS4'), 'presente') $q$, 'P0001:SIN_CAMBIO', 'COR-10: mismo estado');
SELECT t.throws($q$ SELECT public.api_corregir_asistencia(t.c('AS5'), 'presente') $q$, 'P0001:NO_AUTORIZADO', 'COR-12: docente ajeno (grupo de otro docente)');
SELECT t.throws($q$ SELECT public.api_corregir_asistencia(999999, 'presente') $q$, 'P0001:NO_ENCONTRADO', 'COR-14: id inexistente');
SELECT t.throws($q$ SELECT public.api_corregir_asistencia(t.c('AS6'), 'presente') $q$, 'P0001:SESION_NO_CERRADA', 'COR-15: sesion abierta');
SELECT t.throws($q$ SELECT public.api_corregir_asistencia(t.c('AS1'), 'falto') $q$, 'P0001:VALIDACION', 'COR-16: estado desconocido');
SELECT t.throws($q$ SELECT public.api_corregir_asistencia(t.c('AS1'), NULL) $q$, 'P0001:VALIDACION', 'COR-16b: estado nulo');
SELECT t.lives_rb($q$ SELECT public.api_corregir_asistencia(t.c('AS1'), 'presente', repeat('x', 200)) $q$, 'COR-17: comentario de 200 caracteres');
SELECT t.throws($q$ SELECT public.api_corregir_asistencia(t.c('AS1'), 'presente', repeat('x', 201)) $q$, 'P0001:VALIDACION', 'COR-17: comentario de 201');
SELECT t.efecto($q$ SELECT public.api_corregir_asistencia(t.c('AS1'), 'presente', '    ') $q$,
    $q$ SELECT (t.c_bit('correccion', 'asistencia', t.c('AS1')) -> 'valor_nuevo') ->> 'comentario' IS NULL $q$,
    'COR-17: comentario en blanco se guarda NULL');
SELECT t.efecto($q$ SELECT public.api_corregir_asistencia(t.c('AS1'), 'presente') $q$,
    $q$ SELECT (SELECT estado::text FROM asistencia WHERE id_asistencia = t.c('AS1')) = 'presente'
           AND (SELECT pendientes FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A001') AND id_grupo = t.id_grupo('3A')) = 1
           AND (SELECT faltas_equivalentes FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A001') AND id_grupo = t.id_grupo('3A')) = 9 $q$,
    'COR-23: el pendiente corregido a presente deja de ser pendiente y no suma faltas');
-- COR-24: la baja de la inscripcion no impide corregir el historial
SELECT t.efecto($q$ SELECT t.as_postgres(); UPDATE inscripcion SET estatus = 'baja' WHERE id_alumno = t.id_alumno('A006') AND id_grupo = t.id_grupo('3A');
                    SELECT t.as_user('docente1@susan.test'); SELECT public.api_corregir_asistencia(t.c('AS4'), 'retardo') $q$,
    $q$ SELECT estado = 'retardo' FROM asistencia WHERE id_asistencia = t.c('AS4') $q$, 'COR-24: corregir el registro de una inscripcion en baja');
-- COR-19: parametro horas_limite_correccion = 24 (RNF-02)
SELECT t.throws($q$ SELECT t.as_postgres(); UPDATE parametro_sistema SET valor = '24' WHERE clave = 'horas_limite_correccion';
                    SELECT t.reloj('2026-09-09 10:00:00-06'); SELECT t.as_user('docente1@susan.test');
                    SELECT public.api_corregir_asistencia(t.c('AS1'), 'presente') $q$, 'P0001:RN_08_PLAZO_VENCIDO', 'COR-19: con 24 h, a las 25 h ya no');
SELECT t.efecto($q$ SELECT t.as_postgres(); UPDATE parametro_sistema SET valor = '24' WHERE clave = 'horas_limite_correccion';
                    SELECT t.reloj('2026-09-09 08:00:00-06'); SELECT t.as_user('docente1@susan.test');
                    SELECT public.api_corregir_asistencia(t.c('AS1'), 'presente') $q$,
    $q$ SELECT estado = 'presente' FROM asistencia WHERE id_asistencia = t.c('AS1') $q$, 'COR-19: con 24 h, a las 23 h si');

-- COR-21/22: derecho a examen (9 faltas conservan, 10 pierden, corregir a presente lo devuelve)
SELECT t.efecto($q$ SELECT public.api_corregir_asistencia(t.c('AS1'), 'retardo') $q$,
    $q$ SELECT t.c_derecho('3A', 'A001') AND t.c_nbit('notificacion', 'inscripcion',
            (SELECT id_inscripcion FROM inscripcion WHERE id_alumno = t.id_alumno('A001') AND id_grupo = t.id_grupo('3A'))) = 0 $q$,
    'COR-21: con 9 faltas (18.75 %) el derecho se conserva');
SELECT t.efecto($q$ SELECT public.api_corregir_asistencia(t.c('AS1'), 'ausente') $q$,
    $q$ SELECT NOT t.c_derecho('3A', 'A001') AND (SELECT faltas_equivalentes FROM v_resumen_asistencia
            WHERE id_alumno = t.id_alumno('A001') AND id_grupo = t.id_grupo('3A')) = 10
           AND t.c_nbit('notificacion', 'inscripcion',
            (SELECT id_inscripcion FROM inscripcion WHERE id_alumno = t.id_alumno('A001') AND id_grupo = t.id_grupo('3A'))) = 1 $q$,
    'COR-21: la decima falta (20.83 %) retira el derecho y notifica');
SELECT t.lives_rb($q$ DO $d$ BEGIN
    IF (public.api_corregir_asistencia(t.c('AS1'), 'ausente') -> 'inscripcion' ->> 'derecho_examen_anterior') <> 'true' THEN
        RAISE EXCEPTION 'derecho_examen_anterior debia ser true';
    END IF;
    IF (SELECT derecho_examen FROM inscripcion WHERE id_alumno = t.id_alumno('A001') AND id_grupo = t.id_grupo('3A')) THEN
        RAISE EXCEPTION 'el derecho debia perderse';
    END IF;
END $d$ $q$, 'COR-21: el retorno informa derecho_examen_anterior = true y derecho_examen = false');
SELECT t.efecto($q$ SELECT public.api_corregir_asistencia(t.c('AS1'), 'ausente'); SELECT public.api_corregir_asistencia(t.c('AS1'), 'presente') $q$,
    $q$ SELECT t.c_derecho('3A', 'A001') AND t.c_nbit('notificacion', 'inscripcion',
            (SELECT id_inscripcion FROM inscripcion WHERE id_alumno = t.id_alumno('A001') AND id_grupo = t.id_grupo('3A'))) = 2 $q$,
    'COR-22: corregir a presente devuelve el derecho (reversible, nueva notificacion)');
SELECT t.as_user('docente1@susan.test');

-- Roles
SELECT t.as_user('docente2@susan.test');
SELECT t.throws($q$ SELECT public.api_corregir_asistencia(t.c('AS1'), 'presente') $q$, 'P0001:NO_AUTORIZADO', 'COR-11: docente ajeno sobre registro de otro grupo');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ SELECT public.api_corregir_asistencia(t.c('AS1'), 'presente') $q$, 'P0001:NO_AUTORIZADO', 'COR-13: alumno');
SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ SELECT public.api_corregir_asistencia(t.c('AS1'), 'presente') $q$, 'P0001:NO_AUTORIZADO', 'COR-13: administrador');
SELECT t.as_user('tecnico@susan.test');
SELECT t.throws($q$ SELECT public.api_corregir_asistencia(t.c('AS1'), 'presente') $q$, 'P0001:NO_AUTORIZADO', 'COR-13: tecnico');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.api_corregir_asistencia(t.c('AS1'), 'presente') $q$, '42501', 'anon no ejecuta api_corregir_asistencia');
SELECT t.as_uid_huerfano();
SELECT t.throws($q$ SELECT public.api_corregir_asistencia(t.c('AS1'), 'presente') $q$, 'P0001:CUENTA_NO_VINCULADA', 'cuenta sin perfil');


SELECT t.summary();
ROLLBACK;
