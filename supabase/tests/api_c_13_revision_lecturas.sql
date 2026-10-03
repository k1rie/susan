-- api_c_13 · Revision, lecturas: cola, justificables, detecciones del caso, documento, sesiones/registros corregibles
-- (docs/api/revision.md 3.1, 3.6-3.10 y escenarios 6.5, 6.6, 6.8, 6.9).
BEGIN;
SELECT t.begin('api_c_13_revision_lecturas');
SELECT t.cargar_fixtures();
\ir api_c_escenario.inc

-- "Ahora" = 2026-09-08 09:40 (40 min despues del fin de S1; vence_en de S1 = 2026-09-10 09:00-06).
SELECT t.reloj('2026-09-08 09:40:00-06');

-- ===== COL: cola de revision =========================================================================
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 ->> 'id_asistencia', t.c('AS1')::text, 'COL-01: D1 ve su pendiente (AS1)');
SELECT t.eq(jsonb_array_length(public.api_cola_revision() -> 'pendientes'), 1, 'COL-01: solo uno (AS6 es de sesion abierta; AS5 es de D2)');
SELECT t.eq(public.api_cola_revision() -> 'contadores' ->> 'pendientes', '1', 'COL-01: contador de pendientes');
SELECT t.eq(public.api_cola_revision() ->> 'generado_en', '2026-09-08T09:40:00-06:00', 'generado_en con offset');
SELECT t.eq(public.api_cola_revision() ->> 'horas_limite_correccion', '48', 'horas_limite_correccion');
SELECT t.eq(public.api_cola_revision() ->> 'min_detecciones_validas', '3', 'min_detecciones_validas');
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 ->> 'vence_en', '2026-09-10T09:00:00-06:00', 'COL-03: vence_en');
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 ->> 'segundos_restantes', '170400', 'COL-03: segundos_restantes');
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 -> 'alumno' ->> 'nombre_completo', 'Ramos Díaz Beatriz', 'nombre_completo');
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 -> 'grupo' ->> 'clave_grupo', '3A', 'grupo del caso');
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 ->> 'estado_sugerido', 'presente', 'COL-04: 07:04:55 -> presente');
SELECT t.ok(NOT (public.api_cola_revision() -> 'pendientes' -> 0 ->> 'vencido')::boolean, 'COL-03: aun no vencido');
SELECT t.efecto($q$ SELECT t.reloj('2026-09-10 09:00:01-06') $q$,
    $q$ SELECT (public.api_cola_revision() -> 'pendientes' -> 0 ->> 'vencido')::boolean
           AND (public.api_cola_revision() -> 'pendientes' -> 0 ->> 'segundos_restantes') = '-1' $q$,
    'COL-03: a 48 h + 1 s vencido = true y segundos_restantes = -1');
SELECT t.efecto($q$ SELECT t.as_postgres(); UPDATE asistencia SET hora_registro = '2026-09-08 07:09:59-06' WHERE id_asistencia = t.c('AS1'); SELECT t.as_user('docente1@susan.test') $q$,
    $q$ SELECT public.api_cola_revision() -> 'pendientes' -> 0 ->> 'estado_sugerido' = 'presente' $q$, 'COL-04: 07:09:59 -> presente');
SELECT t.efecto($q$ SELECT t.as_postgres(); UPDATE asistencia SET hora_registro = '2026-09-08 07:10:00-06' WHERE id_asistencia = t.c('AS1'); SELECT t.as_user('docente1@susan.test') $q$,
    $q$ SELECT public.api_cola_revision() -> 'pendientes' -> 0 ->> 'estado_sugerido' = 'retardo' $q$, 'COL-04: 07:10:00 -> retardo');
SELECT t.efecto($q$ SELECT t.as_postgres(); UPDATE asistencia SET hora_registro = '2026-09-08 07:20:00-06' WHERE id_asistencia = t.c('AS1'); SELECT t.as_user('docente1@susan.test') $q$,
    $q$ SELECT public.api_cola_revision() -> 'pendientes' -> 0 ->> 'estado_sugerido' = 'retardo' $q$, 'COL-04: 07:20:00 -> retardo');
-- lecturas
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 ->> 'total_lecturas', '3', 'COL-05: 3 lecturas');
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 ->> 'lecturas_validas', '2', 'COL-05: 2 validas');
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 ->> 'mejor_score', '0.912', 'COL-05: mejor score');
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 -> 'lecturas' -> 0 ->> 'score_similitud', '0.912', 'COL-05: la mejor valida primero');
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 -> 'lecturas' -> 1 ->> 'camara_posicion', 'fondo', 'COL-05: segunda lectura valida (fondo)');
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 -> 'lecturas' -> 2 ->> 'es_valida', 'false', 'COL-05: la no valida al final');
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 -> 'lecturas' -> 0 ->> 'minuto_sesion', '4.92', 'COL-05: minuto_sesion');
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 -> 'lecturas' -> 2 ->> 'tiene_recorte', 'false', 'COL-05: sin recorte');
SELECT t.ok(public.api_cola_revision()::text !~ 'objeto_', 'COL-05: ninguna clave objeto_* en la cola');
SELECT t.efecto($q$ SELECT t.as_postgres(); UPDATE deteccion SET objeto_recorte = NULL; SELECT t.as_user('docente1@susan.test') $q$,
    $q$ SELECT NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.api_cola_revision() -> 'pendientes' -> 0 -> 'lecturas') l
                            WHERE (l ->> 'tiene_recorte')::boolean) $q$, 'COL-06: tras la purga tiene_recorte = false sin error');
SELECT t.as_user('docente2@susan.test');
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 ->> 'id_asistencia', t.c('AS5')::text, 'COL-02: D2 solo ve AS5');
SELECT t.eq(jsonb_array_length(public.api_cola_revision() -> 'pendientes'), 1, 'COL-02: una sola fila para D2');
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 ->> 'total_lecturas', '0', 'caso sin lecturas');
SELECT t.eq(public.api_cola_revision() -> 'pendientes' -> 0 -> 'lecturas', '[]'::jsonb, 'caso sin lecturas: lista vacia');
SELECT t.ok(public.api_cola_revision() -> 'pendientes' -> 0 -> 'mejor_score' = 'null'::jsonb, 'caso sin lecturas: mejor_score null');

-- Pestanas y paginacion (COL-11)
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT public.api_cola_revision('x') $q$, 'P0001:VALIDACION', 'COL-11: pestana no valida');
SELECT t.lives_rb($q$ DO $d$ DECLARE r jsonb; BEGIN
    PERFORM t.as_postgres();
    INSERT INTO sesion_clase (id_grupo, fecha, hora_inicio, hora_fin, modo_registro, estatus)
        VALUES (t.id_grupo('3A'), '2026-09-08', '11:00', '12:00', 'automatico', 'cerrada');
    INSERT INTO asistencia (id_sesion, id_alumno, estado, hora_registro, origen, conteo_detecciones)
        SELECT s.id_sesion, t.id_alumno(m), 'pendiente', '2026-09-08 11:03:00-06', 'automatico', 1
          FROM sesion_clase s, unnest(ARRAY['A002', 'A005', 'A006']) m
         WHERE s.id_grupo = t.id_grupo('3A') AND s.hora_inicio = '11:00' AND s.fecha = '2026-09-08';
    PERFORM t.as_user('docente1@susan.test');
    r := public.api_cola_revision('pendientes', 2, 1);
    ASSERT jsonb_array_length(r -> 'pendientes') = 2, 'offset 1 limit 2 de 4: dos elementos';
    ASSERT (r -> 'contadores' ->> 'pendientes') = '4', 'el contador es el total sin paginar';
    ASSERT jsonb_array_length(r -> 'justificantes') = 0 AND jsonb_array_length(r -> 'correcciones_recientes') = 0, 'las otras listas van vacias';
    r := public.api_cola_revision(NULL, 500, -5);
    ASSERT jsonb_array_length(r -> 'pendientes') = 4, 'limite acotado y offset negativo = 0';
    r := public.api_cola_revision(NULL, 0, NULL);
    ASSERT jsonb_array_length(r -> 'pendientes') = 4, 'limite < 1 = por omision';
END $d$ $q$, 'COL-11: pestana, limite y offset');

-- Justificantes en la cola (COL-07) y correcciones (COL-08, COL-09, COL-12)
SELECT t.lives_rb($q$ DO $d$ DECLARE r jsonb; BEGIN
    PERFORM t.as_postgres();
    INSERT INTO justificante (id_sesion, id_alumno, motivo, objeto_documento, registrado_por, fecha_registro) VALUES
        (t.c('S0'), t.id_alumno('A002'), 'Cita', t.c_doc('A002'), t.id_usuario('alumno2@susan.test'), app.now()),
        (t.c('S0'), t.id_alumno('A005'), 'Reposo', t.c_doc('A005'), t.id_usuario('docente1@susan.test'), app.now());
    PERFORM t.as_user('docente1@susan.test');
    r := public.api_cola_revision('justificantes');
    ASSERT jsonb_array_length(r -> 'justificantes') = 3, 'fixture + 2: tres justificantes';
    ASSERT (SELECT string_agg(x ->> 'registrado_por_rol', ',' ORDER BY x ->> 'id_justificante') FROM jsonb_array_elements(r -> 'justificantes') x) = 'alumno,alumno,docente',
        'registrado_por_rol alumno/alumno/docente';
    ASSERT r -> 'justificantes' -> 0 -> 'sesion' ->> 'hora_inicio' = '07:00:00', 'sesion con hora_inicio';
    ASSERT r::text !~ 'objeto_', 'sin rutas';
    ASSERT jsonb_array_length(r -> 'pendientes') = 0, 'pestana justificantes no llena pendientes';
END $d$ $q$, 'COL-07: justificantes con rol de quien registro');
SELECT t.lives_rb($q$ DO $d$ DECLARE r jsonb; BEGIN
    PERFORM public.api_corregir_asistencia(t.c('AS1'), 'retardo', 'Llegó pasadas las 7:10');
    r := public.api_cola_revision();
    ASSERT jsonb_array_length(r -> 'pendientes') = 0, 'COL-08: el caso sale de pendientes';
    ASSERT (r -> 'contadores' ->> 'pendientes') = '0' AND (r -> 'contadores' ->> 'correcciones_recientes') = '1', 'contadores';
    ASSERT r -> 'correcciones_recientes' -> 0 ->> 'estado_anterior' = 'pendiente', 'estado_anterior';
    ASSERT r -> 'correcciones_recientes' -> 0 ->> 'estado_nuevo' = 'retardo', 'estado_nuevo';
    ASSERT r -> 'correcciones_recientes' -> 0 ->> 'comentario' = 'Llegó pasadas las 7:10', 'comentario';
    ASSERT r -> 'correcciones_recientes' -> 0 ->> 'estado_actual' = 'retardo', 'estado_actual';
    ASSERT (r -> 'correcciones_recientes' -> 0 ->> 'corregible')::boolean, 'COL-12: dentro de plazo corregible';
    ASSERT NOT (r -> 'correcciones_recientes' -> 0 ->> 'automatica')::boolean, 'correccion del docente: no automatica';
    ASSERT r -> 'correcciones_recientes' -> 0 -> 'usuario' ->> 'rol' = 'docente', 'usuario.rol = docente';
    ASSERT r -> 'correcciones_recientes' -> 0 ->> 'vence_en' = '2026-09-10T09:00:00-06:00', 'vence_en';
    PERFORM t.reloj('2026-09-10 10:00:00-06');
    r := public.api_cola_revision('correcciones');
    ASSERT NOT (r -> 'correcciones_recientes' -> 0 ->> 'corregible')::boolean, 'COL-12: fuera de plazo no corregible';
    PERFORM t.reloj('2026-09-08 09:40:00-06');
    PERFORM t.as_postgres();
    UPDATE asistencia SET estado = 'justificado', origen = 'correccion' WHERE id_asistencia = t.c('AS1');
    PERFORM t.as_user('docente1@susan.test');
    r := public.api_cola_revision('correcciones');
    ASSERT NOT (r -> 'correcciones_recientes' -> 0 ->> 'corregible')::boolean, 'COL-12: justificado no corregible';
END $d$ $q$, 'COL-08/12: correccion visible en la cola, estado_actual y corregible');
SELECT t.lives_rb($q$ DO $d$ DECLARE r jsonb; BEGIN
    PERFORM t.as_service();
    PERFORM t.reloj('2026-09-10 09:00:01-06');
    PERFORM app.resolver_pendientes_vencidos(app.id_cuenta_servicio());
    PERFORM t.as_user('docente1@susan.test');
    r := public.api_cola_revision();
    ASSERT (r -> 'correcciones_recientes' -> 0 ->> 'automatica')::boolean, 'COL-09: resolucion del job: automatica';
    ASSERT r -> 'correcciones_recientes' -> 0 -> 'usuario' ->> 'rol' = 'tecnico', 'COL-09: usuario.rol = tecnico';
    ASSERT r -> 'correcciones_recientes' -> 0 ->> 'estado_nuevo' = 'ausente', 'COL-09: resuelta a ausente';
    PERFORM t.as_user('docente2@susan.test');
    r := public.api_cola_revision();
    ASSERT jsonb_array_length(r -> 'correcciones_recientes') = 1, 'D2 solo ve la correccion de su grupo (AS5)';
END $d$ $q$, 'COL-09: la resolucion automatica aparece como automatica');

-- Roles y privilegios de la cola
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ SELECT public.api_cola_revision() $q$, 'P0001:NO_AUTORIZADO', 'COL-10: alumno');
SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ SELECT public.api_cola_revision() $q$, 'P0001:NO_AUTORIZADO', 'COL-10: administrador');
SELECT t.as_user('tecnico@susan.test');
SELECT t.throws($q$ SELECT public.api_cola_revision() $q$, 'P0001:NO_AUTORIZADO', 'COL-10: tecnico');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.api_cola_revision() $q$, '42501', 'anon no ejecuta api_cola_revision');
SELECT t.throws($q$ SELECT public.api_detecciones_caso(1) $q$, '42501', 'anon no ejecuta api_detecciones_caso');
SELECT t.throws($q$ SELECT public.api_mis_justificantes() $q$, '42501', 'anon no ejecuta api_mis_justificantes');
SELECT t.throws($q$ SELECT public.api_sesiones_corregibles() $q$, '42501', 'anon no ejecuta api_sesiones_corregibles');
SELECT t.throws($q$ SELECT app.correcciones_recientes() $q$, '42501', 'anon no ejecuta app.correcciones_recientes');
SELECT t.as_postgres();
UPDATE usuario SET activo = false WHERE correo = 'docente1@susan.test';
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT public.api_cola_revision() $q$, 'P0001:CUENTA_INACTIVA', 'VIS-09: docente inactivo (cola)');
SELECT t.throws($q$ SELECT public.api_sesiones_corregibles() $q$, 'P0001:CUENTA_INACTIVA', 'VIS-09: docente inactivo (sesiones)');
SELECT t.as_postgres();
UPDATE usuario SET activo = true WHERE correo = 'docente1@susan.test';

-- ===== DET: api_detecciones_caso ======================================================================
SELECT t.reloj('2026-09-08 09:40:00-06');
SELECT set_config('t.nb0', t.c_nbit_total()::text, true);
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(public.api_detecciones_caso(t.c('AS1')) ->> 'total', '3', 'DET-01: 3 lecturas');
SELECT t.eq(jsonb_array_length(public.api_detecciones_caso(t.c('AS1')) -> 'lecturas'), 3, 'DET-01: lecturas');
SELECT t.eq(public.api_detecciones_caso(t.c('AS1')) ->> 'id_usuario', t.id_usuario('docente1@susan.test')::text, 'DET-01: id_usuario del invocador');
SELECT t.eq(public.api_detecciones_caso(t.c('AS1')) ->> 'vigencia_url_firmada_seg', '300', 'DET-01: vigencia 300');
SELECT t.eq(public.api_detecciones_caso(t.c('AS1')) ->> 'objeto_foto_registro',
    'registro/' || (SELECT id_alumno FROM alumno WHERE matricula = 'A001') || '/fixture.jpg', 'DET-01: foto de la plantilla activa');
SELECT t.eq(public.api_detecciones_caso(t.c('AS1')) -> 'lecturas' -> 0 ->> 'camara_posicion', 'frente', 'DET-01: camara_posicion de la primera');
SELECT t.eq(public.api_detecciones_caso(t.c('AS1')) -> 'lecturas' -> 0 ->> 'objeto_recorte', 'recortes/s1/1.jpg', 'DET-01: ruta del recorte (solo para el handler)');
SELECT t.ok(public.api_detecciones_caso(t.c('AS1')) -> 'lecturas' -> 2 -> 'objeto_recorte' = 'null'::jsonb, 'DET-09: recorte ausente = null sin error');
SELECT t.eq(public.api_detecciones_caso(t.c('AS1')) -> 'asistencia' ->> 'conteo_detecciones', '2', 'datos de la asistencia');
SELECT t.eq(public.api_detecciones_caso(t.c('AS1'), true) ->> 'total', '2', 'DET-05: solo validas: total 2');
SELECT t.eq(jsonb_array_length(public.api_detecciones_caso(t.c('AS1'), true) -> 'lecturas'), 2, 'DET-05: solo validas: 2 lecturas');
SELECT t.eq(jsonb_array_length(public.api_detecciones_caso(t.c('AS1'), false, 1, 1) -> 'lecturas'), 1, 'paginacion de lecturas');
SELECT t.eq(public.api_detecciones_caso(t.c('AS2')) ->> 'total', '0', 'DET-12: alumno sin lecturas');
SELECT t.ok(public.api_detecciones_caso(t.c('AS2')) -> 'objeto_foto_registro' = 'null'::jsonb, 'DET-12: alumno sin plantilla activa: foto null');
SELECT t.efecto($q$ SELECT t.as_postgres(); UPDATE parametro_sistema SET valor = '900' WHERE clave = 'vigencia_url_firmada_seg'; SELECT t.as_user('docente1@susan.test') $q$,
    $q$ SELECT public.api_detecciones_caso(t.c('AS1')) ->> 'vigencia_url_firmada_seg' = '300' $q$, 'DET-04: la vigencia nunca excede 300 s');
SELECT t.throws($q$ SELECT public.api_detecciones_caso(999999) $q$, 'P0001:NO_ENCONTRADO', 'caso inexistente');
SELECT t.throws($q$ SELECT public.api_detecciones_caso(t.c('AS5')) $q$, 'P0001:NO_ENCONTRADO', 'DET-02: caso de grupo ajeno');
SELECT t.eq(t.c_nbit_total(), current_setting('t.nb0')::bigint, 'la lectura no asienta bitacora (lo hace el handler)');
SELECT t.as_user('docente2@susan.test');
SELECT t.throws($q$ SELECT public.api_detecciones_caso(t.c('AS1')) $q$, 'P0001:NO_ENCONTRADO', 'DET-02: D2 sobre caso de D1');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ SELECT public.api_detecciones_caso(t.c('AS1')) $q$, 'P0001:NO_AUTORIZADO', 'DET-03: alumno');
SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ SELECT public.api_detecciones_caso(t.c('AS1')) $q$, 'P0001:NO_AUTORIZADO', 'DET-03: administrador');

-- ===== documento del justificante (3.8) ==============================================================
SELECT t.as_postgres();
INSERT INTO justificante (id_sesion, id_alumno, motivo, objeto_documento, registrado_por, fecha_registro)
VALUES (t.c('S1'), t.id_alumno('A002'), 'Cita', t.c_doc('A002'), t.id_usuario('alumno2@susan.test'), app.now());
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(public.api_justificante_documento(t.c_jid('3A', '2026-09-08', 'A002')) ->> 'objeto_documento', t.c_doc('A002'), 'DOC-14: ruta del documento para el handler');
SELECT t.eq(public.api_justificante_documento(t.c_jid('3A', '2026-09-08', 'A002')) ->> 'vigencia_url_firmada_seg', '300', 'DOC-14: vigencia 300');
SELECT t.eq(public.api_justificante_documento(t.c_jid('3A', '2026-09-08', 'A002')) ->> 'id_asistencia', t.c('AS2')::text, 'id_asistencia del justificante');
SELECT t.throws($q$ SELECT public.api_justificante_documento(999999) $q$, 'P0001:NO_ENCONTRADO', 'justificante inexistente');
SELECT t.as_user('docente2@susan.test');
SELECT t.throws($q$ SELECT public.api_justificante_documento(t.c_jid('3A', '2026-09-08', 'A002')) $q$, 'P0001:NO_ENCONTRADO', 'DOC-15: D2 no ve documentos de D1');
SELECT t.as_user('alumno2@susan.test');
SELECT t.throws($q$ SELECT public.api_justificante_documento(1) $q$, 'P0001:NO_AUTORIZADO', 'DOC-15: el alumno no usa esta RPC');

-- ===== mis justificantes / justificables (VIS-01..03) =================================================
SELECT t.as_postgres();
INSERT INTO justificante (id_sesion, id_alumno, motivo, objeto_documento, estatus, registrado_por, resuelto_por, fecha_registro, fecha_resolucion)
VALUES (t.c('S0'), t.id_alumno('A002'), 'Primer intento', t.c_doc('A002'), 'rechazado', t.id_usuario('alumno2@susan.test'),
        t.id_usuario('docente1@susan.test'), app.now(), app.now()),
       (t.c('S0'), t.id_alumno('A005'), 'De otra alumna', t.c_doc('A005'), 'pendiente', t.id_usuario('docente1@susan.test'), NULL, app.now(), NULL);
SELECT t.as_user('alumno2@susan.test');
SELECT t.eq(public.api_mis_justificantes() ->> 'total', '3', 'VIS-01: solo los de A002 (fixture, S1 y el rechazado de S0)');
SELECT t.ok(public.api_mis_justificantes()::text !~ 'objeto_', 'VIS-01: sin rutas ni documentos');
SELECT t.eq((SELECT count(*) FROM jsonb_array_elements(public.api_mis_justificantes() -> 'items') x WHERE x ->> 'motivo' = 'De otra alumna'), 0::bigint,
    'VIS-01: no aparece el justificante de otra alumna del mismo grupo');
SELECT t.eq(public.api_mis_justificantes() -> 'items' -> 0 -> 'materia' ->> 'clave', 'ADM101', 'materia del justificante');
SELECT t.eq(jsonb_array_length(public.api_mis_justificantes(1, 1) -> 'items'), 1, 'paginacion de mis justificantes');
SELECT t.eq(public.api_mis_justificables() ->> 'total', '1', 'VIS-02: S1 tiene justificante pendiente; solo S0 (con rechazado) es justificable');
SELECT t.eq(public.api_mis_justificables() -> 'items' -> 0 ->> 'id_asistencia', t.c('AS7')::text, 'VIS-02: la falta de S0');
SELECT t.eq(public.api_mis_justificables() -> 'items' -> 0 ->> 'tiene_rechazado', 'true', 'VIS-02: tiene_rechazado');
SELECT t.ok(public.api_mis_justificables()::text !~ 'objeto_', 'VIS-02: sin rutas');
SELECT t.as_user('alumno1@susan.test');
SELECT t.eq(public.api_mis_justificables() ->> 'total', '9', 'VIS-02: A001 solo tiene justificables sus 9 ausencias de junio (el pendiente y la sesion abierta no cuentan)');
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT public.api_mis_justificantes() $q$, 'P0001:NO_AUTORIZADO', 'VIS-03: docente');
SELECT t.throws($q$ SELECT public.api_mis_justificables() $q$, 'P0001:NO_AUTORIZADO', 'VIS-03: docente (justificables)');
SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ SELECT public.api_mis_justificantes() $q$, 'P0001:NO_AUTORIZADO', 'VIS-03: administrador');

-- ===== sesiones y registros corregibles (VIS-04..06) =================================================
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(public.api_sesiones_corregibles() ->> 'total', '2', 'VIS-04: ahora: S1 y la sesion del 07-sep siguen en plazo');
SELECT t.efecto($q$ SELECT t.reloj('2026-09-10 08:00:00-06') $q$,
    $q$ SELECT public.api_sesiones_corregibles() ->> 'total' = '1' AND public.api_sesiones_corregibles() -> 'items' -> 0 ->> 'segundos_restantes' = '3600'
           AND public.api_sesiones_corregibles() -> 'items' -> 0 ->> 'id_sesion' = t.c('S1')::text $q$, 'VIS-04: a 47 h solo S1 con 3600 s');
SELECT t.efecto($q$ SELECT t.reloj('2026-09-10 10:00:00-06') $q$,
    $q$ SELECT public.api_sesiones_corregibles() ->> 'total' = '0' $q$, 'VIS-04: a 49 h ya no aparece');
SELECT t.eq(public.api_sesiones_corregibles() -> 'items' -> 0 ->> 'total_pendientes', '1', 'sesiones corregibles: total_pendientes');
SELECT t.eq(public.api_sesiones_corregibles() -> 'items' -> 0 ->> 'total_registros', '4', 'sesiones corregibles: total_registros');
SELECT t.eq(public.api_registros_corregibles(t.c('S1')) ->> 'total', '4', 'VIS-05: 4 registros');
SELECT t.eq((SELECT string_agg(x -> 'alumno' ->> 'matricula', ',') FROM jsonb_array_elements(public.api_registros_corregibles(t.c('S1')) -> 'items') x),
    'A002,A006,A001,A005', 'VIS-05: orden por apellidos (Cruz, Nava, Ramos, Silva)');
SELECT t.ok((public.api_registros_corregibles(t.c('S1')) ->> 'dentro_de_plazo')::boolean, 'VIS-05: dentro de plazo');
SELECT t.eq((SELECT count(*) FROM jsonb_array_elements(public.api_registros_corregibles(t.c('S1')) -> 'items') x WHERE (x ->> 'corregible')::boolean), 4::bigint, 'VIS-05: todos corregibles');
SELECT t.eq((SELECT x ->> 'justificante_pendiente' FROM jsonb_array_elements(public.api_registros_corregibles(t.c('S1')) -> 'items') x
              WHERE x -> 'alumno' ->> 'matricula' = 'A002'), 'true', 'VIS-05: justificante_pendiente de A002');
SELECT t.efecto($q$ SELECT t.reloj('2026-09-10 10:00:00-06') $q$,
    $q$ SELECT NOT (public.api_registros_corregibles(t.c('S1')) ->> 'dentro_de_plazo')::boolean
           AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.api_registros_corregibles(t.c('S1')) -> 'items') x WHERE (x ->> 'corregible')::boolean) $q$,
    'VIS-05: a 49 h dentro_de_plazo = false y ninguno corregible');
SELECT t.throws($q$ SELECT public.api_registros_corregibles(t.c('S3')) $q$, 'P0001:NO_ENCONTRADO', 'VIS-06: sesion de otro docente');
SELECT t.throws($q$ SELECT public.api_registros_corregibles(999999) $q$, 'P0001:NO_ENCONTRADO', 'sesion inexistente');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ SELECT public.api_sesiones_corregibles() $q$, 'P0001:NO_AUTORIZADO', 'sesiones corregibles: alumno');
SELECT t.throws($q$ SELECT public.api_registros_corregibles(1) $q$, 'P0001:NO_AUTORIZADO', 'registros corregibles: alumno');

-- ===== esquema y disparadores (ESQ) ==================================================================
SELECT t.as_postgres();
SELECT t.throws($q$ UPDATE asistencia SET estado = 'presente', origen = 'automatico' WHERE id_asistencia = t.c('AS1') $q$, '23514:rn05_asistencia_confirmacion_lecturas', 'ESQ-01: confirmar con 2 lecturas y origen automatico');
SELECT t.lives_rb($q$ UPDATE asistencia SET estado = 'presente', origen = 'correccion' WHERE id_asistencia = t.c('AS1') $q$, 'ESQ-02: con origen correccion se acepta');
SELECT t.throws($q$ UPDATE asistencia SET estado = 'pendiente' WHERE id_asistencia = t.c('AS4') $q$, '23514', 'ESQ-03: regresar a pendiente');
SELECT t.throws($q$ INSERT INTO justificante (id_sesion, id_alumno, motivo, objeto_documento, registrado_por)
        VALUES (t.c('S1'), t.id_alumno('A002'), 'dup', 'j.pdf', t.id_usuario('alumno2@susan.test')) $q$, '23505:ux_justificante_pendiente', 'ESQ-06: dos justificantes pendientes del mismo registro');
SELECT t.throws($q$ INSERT INTO justificante (id_sesion, id_alumno, motivo, objeto_documento, registrado_por)
        VALUES (t.c('S2'), t.id_alumno('A002'), 'x', 'j.pdf', t.id_usuario('alumno2@susan.test')) $q$, '23503:fk_justificante_asistencia', 'REG-06: justificante sin asistencia viola la FK compuesta');
SELECT t.throws($q$ UPDATE bitacora_auditoria SET ip_origen = 'x' $q$, 'trg_bitacora_sin_cambios', 'ESQ-07: la bitacora no admite UPDATE');
SELECT t.eq(app.estado_sugerido_revision('2026-09-08 07:09:59-06', DATE '2026-09-08', TIME '07:00', 10), 'presente', 'ESQ-08: 9:59 -> presente');
SELECT t.eq(app.estado_sugerido_revision('2026-09-08 07:10:00-06', DATE '2026-09-08', TIME '07:00', 10), 'retardo', 'ESQ-08: 10:00 -> retardo');
SELECT t.eq(app.estado_sugerido_revision('2026-09-08 07:20:00-06', DATE '2026-09-08', TIME '07:00', 10), 'retardo', 'ESQ-08: 20:00 -> retardo');
SELECT t.ok(app.estado_sugerido_revision(NULL, DATE '2026-09-08', TIME '07:00', 10) IS NULL, 'sin hora_registro no hay sugerencia');
SELECT t.eq(app.c1_iso('2026-09-08 13:04:55+00'::timestamptz), '2026-09-08T07:04:55-06:00', 'c1_iso: instante con offset del plantel');
SELECT t.eq(app.limite_correccion(DATE '2026-09-08', TIME '09:00')::text, '2026-09-10 15:00:00+00', 'limite_correccion = fin + 48 h');
SELECT t.as_user('docente1@susan.test');
SELECT t.ok(t.n($q$ SELECT 1 FROM camara $q$) > 0 AND t.n($q$ SELECT 1 FROM plantilla_facial WHERE id_alumno = t.c('ID_A001') $q$) = 1,
    'ESQ-04: docente ve camaras del aula y la plantilla de su alumno');
SELECT t.eq(t.n($q$ SELECT 1 FROM plantilla_facial WHERE id_alumno = t.c('ID_A004') $q$), 0::bigint, 'ESQ-04: no ve la plantilla de un alumno de otro docente');
SELECT t.as_user('alumno1@susan.test');
SELECT t.ok(t.n($q$ SELECT 1 FROM sesion_clase WHERE id_grupo = t.id_grupo('3A') $q$) > 0 AND t.n($q$ SELECT 1 FROM materia $q$) > 0, 'ESQ-05: alumno ve sesiones y materia de su grupo');
SELECT t.eq(t.n($q$ SELECT 1 FROM grupo WHERE clave_grupo = '5B' $q$), 0::bigint, 'ESQ-05: no ve el grupo ajeno');

SELECT t.summary();
ROLLBACK;
