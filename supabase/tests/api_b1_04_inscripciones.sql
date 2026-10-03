-- api_b1_04: inscripciones (RF-02, RN-01) y carga masiva.
BEGIN;
SELECT t.begin('api_b1_04_inscripciones');
SELECT t.cargar_fixtures();
SELECT t.id_grupo('3A') AS g3a, t.id_grupo('5B') AS g5b, t.id_alumno('A001') AS a1, t.id_alumno('A002') AS a2, t.id_alumno('A003') AS a3,
       t.id_alumno('A004') AS a4, t.id_alumno('A005') AS a5 \gset
SELECT id_inscripcion AS i1 FROM public.inscripcion WHERE id_alumno = :a1 AND id_grupo = :g3a \gset
SELECT id_inscripcion AS i3 FROM public.inscripcion WHERE id_alumno = :a3 AND id_grupo = :g3a \gset

SELECT t.as_user('admin@susan.test');
-- inscribir
SELECT t.efecto(format('SELECT public.api_inscribir(%s, %s)', :g3a, :a4),
    format($q$ SELECT EXISTS (SELECT 1 FROM public.inscripcion WHERE id_alumno = %s AND id_grupo = %s AND estatus = 'activa' AND fecha_alta = DATE '2026-09-14') $q$, :a4, :g3a),
    'inscribir: fila activa con fecha de hoy (reloj simulado)');
SELECT t.throws(format('SELECT public.api_inscribir(%s, %s)', :g3a, :a1), 'P0001:INSCRIPCION_DUPLICADA', 'segunda inscripcion en el mismo grupo rechazada');
SELECT t.throws(format('SELECT public.api_inscribir(%s, %s)', :g5b, :a4), 'P0001:INSCRIPCION_DUPLICADA', 'A004 ya esta en 5B');
SELECT t.throws(format('SELECT public.api_inscribir(999999, %s)', :a4), 'P0001:NO_ENCONTRADO', 'grupo inexistente');
SELECT t.throws(format('SELECT public.api_inscribir(%s, 999999)', :g3a), 'P0001:NO_ENCONTRADO', 'alumno inexistente');
-- reinscripcion tras baja: reactiva la misma fila
SELECT t.efecto(format('SELECT public.api_inscribir(%s, %s)', :g3a, :a3),
    format($q$ SELECT (SELECT count(*) FROM public.inscripcion WHERE id_alumno = %s AND id_grupo = %s) = 1
                  AND (SELECT id_inscripcion FROM public.inscripcion WHERE id_alumno = %s AND id_grupo = %s) = %s
                  AND (SELECT estatus FROM public.inscripcion WHERE id_inscripcion = %s) = 'activa'
                  AND (SELECT fecha_alta FROM public.inscripcion WHERE id_inscripcion = %s) = DATE '2026-09-14' $q$,
        :a3, :g3a, :a3, :g3a, :i3, :i3, :i3),
    'reinscripcion tras baja reactiva la misma fila con alta de hoy');
SELECT t.eq(public.api_inscribir(:g3a, :a3) ->> 'reinscrita', 'true', 'la respuesta marca reinscrita') ;
SELECT t.throws(format('SELECT public.api_inscribir(%s, %s)', :g3a, :a3), 'P0001:INSCRIPCION_DUPLICADA', 'tras reactivar, otra vez es duplicado');
-- alumno no activo
SELECT public.api_alumno_cambiar_estatus(:a4, 'baja_temporal') IS NOT NULL AS ok1 \gset
SELECT t.throws(format('SELECT public.api_inscribir(%s, %s)', :g3a, :a4), 'P0001:ALUMNO_NO_ACTIVO', 'alumno en baja temporal no se inscribe');
SELECT public.api_alumno_cambiar_estatus(:a4, 'activo') IS NOT NULL AS ok2 \gset
SELECT t.lives_rb(format('SELECT public.api_inscribir(%s, %s)', :g3a, :a4), 'reactivado el alumno se puede inscribir (no se restituyo la inscripcion de 5B)');

-- baja de inscripcion
SELECT t.efecto(format('SELECT public.api_baja_inscripcion(%s)', :i1),
    format($q$ SELECT (SELECT estatus FROM public.inscripcion WHERE id_inscripcion = %s) = 'baja'
                  AND (SELECT count(*) FROM public.asistencia WHERE id_alumno = %s) = 2 $q$, :i1, :a1),
    'baja logica de inscripcion: conserva fila y asistencia');
SELECT t.eq(public.api_baja_inscripcion(:i1) ->> 'cambio', 'true', 'primera baja cambia');
SELECT t.eq(public.api_baja_inscripcion(:i1) ->> 'cambio', 'false', 'segunda baja idempotente');
SELECT t.throws($q$ SELECT public.api_baja_inscripcion(999999) $q$, 'P0001:NO_ENCONTRADO', 'baja de inscripcion inexistente');

-- inscritos
SELECT t.eq((public.api_inscritos(:g3a) ->> 'total')::int, 5, 'inscritos de 3A incluye la baja');
SELECT t.ok(jsonb_array_length(public.api_inscritos(:g5b) -> 'items') = 1, 'inscritos de 5B');
SELECT t.eq(public.api_inscritos(:g5b) -> 'items' -> 0 ->> 'matricula', 'A004', 'item con matricula');
SELECT t.ok((public.api_inscritos(:g5b) -> 'items' -> 0 ->> 'derecho_examen')::boolean, 'item con derecho_examen');
SELECT t.ok((public.api_inscritos(:g5b) -> 'items' -> 0 ->> 'consentimiento_vigente')::boolean, 'A004 consentimiento vigente');
SELECT t.throws(format($q$ SELECT public.api_inscritos(%s, 'x') $q$, :g3a), 'P0001:VALIDACION', 'estatus invalido');
SELECT t.throws($q$ SELECT public.api_inscritos(999999) $q$, 'P0001:NO_ENCONTRADO', 'grupo inexistente');

-- inscritos con consentimiento (revocado y vencido no son vigentes) en un estado limpio
SELECT t.as_postgres();
SELECT t.as_user('admin@susan.test');
SELECT t.ok((SELECT bool_and((i ->> 'consentimiento_vigente')::boolean = (i ->> 'matricula' IN ('A001', 'A002', 'A003')))
               FROM jsonb_array_elements(public.api_inscritos(:g3a) -> 'items') i), 'consentimiento vigente: A001-A003 si; A005 revocado y A006 vencido no');

-- docente
SELECT t.as_user('docente1@susan.test');
SELECT t.eq((public.api_inscritos(:g3a) ->> 'total')::int, 5, 'docente titular lista sus inscritos');
SELECT t.throws(format('SELECT public.api_inscritos(%s)', :g5b), 'P0001:NO_ENCONTRADO', 'docente ajeno al grupo 5B');
SELECT t.throws(format('SELECT public.api_inscribir(%s, %s)', :g3a, :a4), 'P0001:NO_AUTORIZADO', 'docente no inscribe');
SELECT t.throws(format('SELECT public.api_baja_inscripcion(%s)', :i1), 'P0001:NO_AUTORIZADO', 'docente no da de baja');
SELECT t.throws(format($q$ SELECT public.api_importar_inscripciones(%s, '[]') $q$, :g3a), 'P0001:NO_AUTORIZADO', 'docente no importa');
SELECT t.as_user('docente2@susan.test');
SELECT t.throws(format('SELECT public.api_inscritos(%s)', :g3a), 'P0001:NO_ENCONTRADO', 'docente2 ajeno al grupo 3A');
-- alumno propio / ajeno
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws(format('SELECT public.api_inscritos(%s)', :g3a), 'P0001:NO_AUTORIZADO', 'alumno propio: sin lista de inscritos');
SELECT t.throws(format('SELECT public.api_inscribir(%s, %s)', :g3a, :a1), 'P0001:NO_AUTORIZADO', 'alumno no se inscribe solo');
SELECT t.throws(format('SELECT public.api_baja_inscripcion(%s)', :i1), 'P0001:NO_AUTORIZADO', 'alumno no se da de baja');
SELECT t.throws(format('SELECT public.api_inscribir(%s, %s)', :g5b, :a2), 'P0001:NO_AUTORIZADO', 'alumno no inscribe a un ajeno');
SELECT t.as_user('tecnico@susan.test');
SELECT t.throws(format('SELECT public.api_inscritos(%s)', :g3a), 'P0001:NO_AUTORIZADO', 'tecnico: sin inscritos');
SELECT t.throws(format('SELECT public.api_inscribir(%s, %s)', :g3a, :a4), 'P0001:NO_AUTORIZADO', 'tecnico no inscribe');
SELECT t.as_anon();
SELECT t.throws(format('SELECT public.api_inscribir(%s, %s)', :g3a, :a4), '42501', 'anon: sin EXECUTE');
SELECT t.throws(format($q$ SELECT public.api_importar_inscripciones(%s, '[]') $q$, :g3a), '42501', 'anon: sin EXECUTE en importacion');

-- ---------------------------------------------------------------- importacion masiva
SELECT t.as_user('admin@susan.test');
SELECT public.api_alumno_cambiar_estatus(:a2, 'egresado') IS NOT NULL AS ok3 \gset
SELECT public.api_importar_inscripciones(:g3a, $j$[
  {"matricula":"A101","nombres":"Ana","apellido_paterno":"Soto","apellido_materno":"Mena","correo":"a101@unach.test"},
  {"matricula":"A004"},
  {"matricula":"A005"},
  {"matricula":"A102","nombres":"Beto","apellido_paterno":"Rey"},
  {"matricula":"A103","nombres":"Cira","apellido_paterno":"Paz","correo":"a001@unach.test"},
  {"matricula":""},
  {"matricula":"a101"},
  {"matricula":"A002"},
  5,
  {"matricula":"A104","nombres":"Dana","apellido_paterno":"Gil","correo":"A104@UNACH.test"}
]$j$::jsonb) AS imp \gset
SELECT t.eq((:'imp'::jsonb ->> 'total')::int, 10, 'importacion: 10 filas');
SELECT t.eq((:'imp'::jsonb ->> 'inscritos')::int, 3, 'importacion: inscritos (A101, A004, A104)');
SELECT t.eq((:'imp'::jsonb ->> 'omitidos')::int, 2, 'importacion: omitidos (A005 ya inscrito, A101 repetida)');
SELECT t.eq((:'imp'::jsonb ->> 'errores')::int, 5, 'importacion: errores (A102, A103, vacia, A002 egresado, no objeto)');
SELECT t.eq((:'imp'::jsonb ->> 'alumnos_creados')::int, 2, 'importacion: alumnos creados (A101, A104)');
SELECT t.eq(:'imp'::jsonb -> 'filas' -> 0 ->> 'resultado', 'inscrito', 'fila 1 inscrita');
SELECT t.eq((:'imp'::jsonb -> 'filas' -> 0 ->> 'fila')::int, 1, 'la fila se numera desde 1');
SELECT t.ok((:'imp'::jsonb -> 'filas' -> 0 ->> 'alumno_creado')::boolean, 'fila 1 creo al alumno');
SELECT t.eq(:'imp'::jsonb -> 'filas' -> 1 ->> 'resultado', 'inscrito', 'fila 2 reutiliza a A004');
SELECT t.ok(NOT (:'imp'::jsonb -> 'filas' -> 1 ->> 'alumno_creado')::boolean, 'fila 2 no crea alumno');
SELECT t.eq(:'imp'::jsonb -> 'filas' -> 2 ->> 'codigo', 'INSCRIPCION_DUPLICADA', 'fila 3 ya inscrita');
SELECT t.eq(:'imp'::jsonb -> 'filas' -> 2 ->> 'resultado', 'omitido', 'fila 3 omitida');
SELECT t.eq(:'imp'::jsonb -> 'filas' -> 3 ->> 'codigo', 'VALIDACION', 'fila 4 sin correo');
SELECT t.eq(:'imp'::jsonb -> 'filas' -> 4 ->> 'codigo', 'DUPLICADO', 'fila 5 correo de otro alumno');
SELECT t.eq(:'imp'::jsonb -> 'filas' -> 5 ->> 'codigo', 'VALIDACION', 'fila 6 matricula vacia');
SELECT t.eq(:'imp'::jsonb -> 'filas' -> 6 ->> 'resultado', 'omitido', 'fila 7 repite a A101 (minusculas)');
SELECT t.eq(:'imp'::jsonb -> 'filas' -> 7 ->> 'codigo', 'ALUMNO_NO_ACTIVO', 'fila 8 alumno egresado');
SELECT t.eq(:'imp'::jsonb -> 'filas' -> 8 ->> 'codigo', 'VALIDACION', 'fila 9 no es objeto');
SELECT t.eq(:'imp'::jsonb -> 'filas' -> 9 ->> 'resultado', 'inscrito', 'fila 10 inscrita (correo normalizado)');
SELECT t.ok(NOT EXISTS (SELECT 1 FROM public.alumno WHERE matricula IN ('A102', 'A103')), 'las filas malas no dejan alumnos a medias (subtransaccion por fila)');
SELECT t.ok(EXISTS (SELECT 1 FROM public.alumno WHERE matricula = 'A104' AND correo_institucional = 'a104@unach.test'), 'las buenas posteriores a las malas si se guardaron');
SELECT t.eq((SELECT count(*) FROM public.inscripcion WHERE id_grupo = :g3a AND estatus = 'activa' AND id_alumno IN (SELECT id_alumno FROM public.alumno WHERE matricula IN ('A101', 'A004', 'A104')))::int, 3, 'inscripciones creadas');
-- reinscrito en lote
SELECT public.api_baja_inscripcion(:i3) IS NOT NULL AS ok4 \gset
SELECT t.eq(public.api_importar_inscripciones(:g3a, '[{"matricula":"A003"}]') -> 'filas' -> 0 ->> 'resultado', 'reinscrito', 'importar a un alumno en baja del grupo lo reinscribe');
SELECT t.throws(format($q$ SELECT public.api_importar_inscripciones(%s, '[]') $q$, :g3a), 'P0001:VALIDACION', 'lote vacio');
SELECT t.throws(format($q$ SELECT public.api_importar_inscripciones(%s, '{"a":1}') $q$, :g3a), 'P0001:VALIDACION', 'lote que no es arreglo');
SELECT t.throws(format($q$ SELECT public.api_importar_inscripciones(%s, (SELECT jsonb_agg(jsonb_build_object('matricula', 'M' || g)) FROM generate_series(1, 501) g)) $q$, :g3a), 'P0001:VALIDACION', 'mas de 500 filas');
SELECT t.throws($q$ SELECT public.api_importar_inscripciones(999999, '[{"matricula":"A001"}]') $q$, 'P0001:NO_ENCONTRADO', 'grupo inexistente en importacion');

SELECT t.summary();
ROLLBACK;
