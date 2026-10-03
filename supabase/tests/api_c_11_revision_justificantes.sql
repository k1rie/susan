-- api_c_11 · api_validar/registrar/resolver_justificante (RF-12, RN-09; docs/api/revision.md 3.3-3.5, 6.3, 6.4)
BEGIN;
SELECT t.begin('api_c_11_revision_justificantes');
SELECT t.cargar_fixtures();
\ir api_c_escenario.inc

SELECT t.reloj('2026-09-10 08:00:00-06');
-- ===== REG: registrar justificante =================================================================
SELECT t.as_user('alumno2@susan.test');
SELECT t.efecto($q$ SELECT public.api_registrar_justificante(t.c('S0'), 'Cita médica', t.c_doc('A002')) $q$,
    $q$ SELECT (SELECT estatus::text FROM justificante WHERE id_justificante = t.c_jid('3A', '2026-09-05', 'A002')) = 'pendiente'
           AND (SELECT resuelto_por IS NULL AND fecha_resolucion IS NULL FROM justificante WHERE id_justificante = t.c_jid('3A', '2026-09-05', 'A002'))
           AND (SELECT registrado_por FROM justificante WHERE id_justificante = t.c_jid('3A', '2026-09-05', 'A002')) = t.id_usuario('alumno2@susan.test')
           AND (SELECT fecha_registro FROM justificante WHERE id_justificante = t.c_jid('3A', '2026-09-05', 'A002')) = app.now() $q$,
    'REG-01: alumno registra justificante de su falta');
SELECT t.eq((public.api_registrar_justificante(t.c('S0'), '  Cita médica  ', t.c_doc('A002')) ->> 'registrado_por_rol'), 'alumno', 'REG-01: registrado_por_rol = alumno');
SELECT t.throws($q$ SELECT public.api_registrar_justificante(t.c('S0'), 'otro', t.c_doc('A002')) $q$, 'P0001:JUSTIFICANTE_DUPLICADO', 'REG-07: segundo justificante mientras hay uno pendiente');
SELECT t.throws($q$ SELECT public.api_validar_justificante(t.c('S0')) $q$, 'P0001:JUSTIFICANTE_DUPLICADO', 'REG-18: validar tambien detecta el duplicado');
SELECT t.eq(t.n($q$ SELECT 1 FROM justificante WHERE id_alumno = t.id_alumno('A002') $q$), 2::bigint, 'REG-18: validar no inserta (fixture + el registrado)');
SELECT t.eq((public.api_validar_justificante(t.c('S1')) ->> 'estado'), 'ausente', 'REG-18: validar un destino valido devuelve el estado');
SELECT t.throws($q$ SELECT public.api_registrar_justificante(t.c('S1'), '', t.c_doc('A002')) $q$, 'P0001:VALIDACION', 'REG-10: motivo vacio');
SELECT t.throws($q$ SELECT public.api_registrar_justificante(t.c('S1'), '   ', t.c_doc('A002')) $q$, 'P0001:VALIDACION', 'REG-10: motivo en blanco');
SELECT t.throws($q$ SELECT public.api_registrar_justificante(t.c('S1'), repeat('m', 201), t.c_doc('A002')) $q$, 'P0001:VALIDACION', 'REG-10: motivo de 201');
SELECT t.lives_rb($q$ SELECT public.api_registrar_justificante(t.c('S1'), repeat('m', 200), t.c_doc('A002')) $q$, 'REG-10: motivo de 200');
SELECT t.throws($q$ SELECT public.api_registrar_justificante(t.c('S1'), 'm', 'justificantes/' || t.id_alumno('A001') || '/5b3c0a9e-72d4-4f1b-9c1e-0d2f6a8b4e11.pdf') $q$,
    'P0001:DOCUMENTO_INVALIDO', 'REG-11: ruta de otro alumno');
SELECT t.throws($q$ SELECT public.api_registrar_justificante(t.c('S1'), 'm', '../x.pdf') $q$, 'P0001:DOCUMENTO_INVALIDO', 'REG-11: ruta con ..');
SELECT t.throws($q$ SELECT public.api_registrar_justificante(t.c('S1'), 'm', 'justificantes/' || t.id_alumno('A002') || '/../../x/5b3c0a9e-72d4-4f1b-9c1e-0d2f6a8b4e11.pdf') $q$,
    'P0001:DOCUMENTO_INVALIDO', 'REG-11: ruta con .. intermedio');
SELECT t.throws($q$ SELECT public.api_registrar_justificante(t.c('S1'), 'm', replace(t.c_doc('A002'), '.pdf', '.exe')) $q$, 'P0001:DOCUMENTO_INVALIDO', 'REG-11: extension .exe');
SELECT t.throws($q$ SELECT public.api_registrar_justificante(t.c('S1'), 'm', 'justificantes/' || t.id_alumno('A002') || '/no-es-uuid.pdf') $q$, 'P0001:DOCUMENTO_INVALIDO', 'REG-11: uuid mal formado');
SELECT t.throws($q$ SELECT public.api_registrar_justificante(t.c('S1'), 'm', NULL) $q$, 'P0001:DOCUMENTO_INVALIDO', 'REG-11: documento nulo');
SELECT t.throws($q$ SELECT public.api_registrar_justificante(t.c('S1'), 'm', t.c_doc('A002'), t.c('ID_A005')) $q$, 'P0001:NO_AUTORIZADO', 'REG-12: alumno a nombre de otro');
SELECT t.throws($q$ SELECT public.api_validar_justificante(t.c('S1'), t.c('ID_A005')) $q$, 'P0001:NO_AUTORIZADO', 'REG-18: validar a nombre de otro');
SELECT t.lives_rb($q$ SELECT public.api_registrar_justificante(t.c('S1'), 'm', t.c_doc('A002'), t.c('ID_A002')) $q$, 'alumno puede indicar su propio id');
SELECT t.throws($q$ SELECT public.api_registrar_justificante(t.c('S2'), 'm', t.c_doc('A002')) $q$, 'P0001:ASISTENCIA_NO_ENCONTRADA', 'REG-06: sesion sin registro suyo');
SELECT t.throws($q$ SELECT public.api_registrar_justificante(999999, 'm', t.c_doc('A002')) $q$, 'P0001:ASISTENCIA_NO_ENCONTRADA', 'sesion inexistente');
SELECT t.throws($q$ INSERT INTO justificante (id_sesion, id_alumno, motivo, objeto_documento, registrado_por)
        VALUES (t.c('S2'), t.id_alumno('A002'), 'x', 'j.pdf', 1) $q$, '42501', 'alumno no inserta directo en justificante');
-- estados no justificables (como postgres se preparan los casos, como alumno se prueban)
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ SELECT public.api_registrar_justificante(t.c('S1'), 'm', t.c_doc('A001')) $q$, 'P0001:ESTADO_NO_JUSTIFICABLE', 'REG-04: sobre un pendiente');
SELECT t.throws($q$ SELECT public.api_validar_justificante(t.c('S1')) $q$, 'P0001:ESTADO_NO_JUSTIFICABLE', 'REG-18: validar sobre un pendiente');
SELECT t.throws($q$ SELECT public.api_registrar_justificante(t.c('S2'), 'm', t.c_doc('A001')) $q$, 'P0001:SESION_NO_CERRADA', 'REG-16: sesion abierta');
SELECT t.throws($q$ SELECT t.as_postgres(); UPDATE sesion_clase SET estatus = 'cerrada' WHERE id_sesion = t.c('S2');
                    UPDATE asistencia SET estado = 'presente', origen = 'manual' WHERE id_asistencia = t.c('AS6');
                    SELECT t.as_user('alumno1@susan.test'); SELECT public.api_registrar_justificante(t.c('S2'), 'm', t.c_doc('A001')) $q$,
    'P0001:ESTADO_NO_JUSTIFICABLE', 'REG-03: sobre un presente');
SELECT t.as_user('alumno5@susan.test');
SELECT t.throws($q$ SELECT public.api_registrar_justificante(t.c('S1'), 'm', t.c_doc('A005')) $q$, 'P0001:CUENTA_INACTIVA', 'cuenta inactiva');
SELECT t.as_user('alumno4@susan.test');
SELECT t.throws($q$ SELECT public.api_registrar_justificante(t.c('S1'), 'm', t.c_doc('A004')) $q$, 'P0001:ASISTENCIA_NO_ENCONTRADA', 'alumno de otro grupo: sin registro en la sesion');
SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ SELECT public.api_registrar_justificante(t.c('S1'), 'm', t.c_doc('A002'), t.c('ID_A002')) $q$, 'P0001:NO_AUTORIZADO', 'REG-17: administrador');
SELECT t.as_user('tecnico@susan.test');
SELECT t.throws($q$ SELECT public.api_validar_justificante(t.c('S1'), t.c('ID_A002')) $q$, 'P0001:NO_AUTORIZADO', 'REG-17: tecnico');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.api_registrar_justificante(1, 'm', 'x') $q$, '42501', 'anon no registra justificantes');

-- Docente registra a nombre de su alumno (REG-13..15)
SELECT t.as_user('docente1@susan.test');
SELECT t.efecto($q$ SELECT public.api_registrar_justificante(t.c('S1'), 'Presentó constancia', t.c_doc('A002'), t.c('ID_A002')) $q$,
    $q$ SELECT (SELECT registrado_por FROM justificante WHERE id_justificante = t.c_jid('3A', '2026-09-08', 'A002')) = t.id_usuario('docente1@susan.test')
           AND (SELECT estatus::text FROM justificante WHERE id_justificante = t.c_jid('3A', '2026-09-08', 'A002')) = 'pendiente' $q$,
    'REG-13: docente registra por su alumno');
SELECT t.eq((public.api_validar_justificante(t.c('S1'), t.c('ID_A002')) ->> 'id_alumno')::int, t.id_alumno('A002'), 'REG-18: docente valida el destino');
SELECT t.throws($q$ SELECT public.api_registrar_justificante(t.c('S0'), 'm', t.c_doc('A002')) $q$, 'P0001:VALIDACION', 'REG-14: docente sin p_id_alumno');
SELECT t.as_user('docente2@susan.test');
SELECT t.throws($q$ SELECT public.api_registrar_justificante(t.c('S0'), 'm', t.c_doc('A002'), t.c('ID_A002')) $q$, 'P0001:NO_AUTORIZADO', 'REG-15: docente ajeno');
SELECT t.throws($q$ SELECT public.api_validar_justificante(t.c('S0'), t.c('ID_A002')) $q$, 'P0001:NO_AUTORIZADO', 'REG-18: docente ajeno valida');
SELECT t.eq(t.n($q$ SELECT 1 FROM justificante $q$), 0::bigint, 'docente ajeno no ve justificantes (RLS)');


-- ===== RES: resolver justificante ===================================================================
SELECT t.as_postgres();
INSERT INTO justificante (id_sesion, id_alumno, motivo, objeto_documento, registrado_por, fecha_registro) VALUES
    (t.c('S0'), t.id_alumno('A005'), 'Reposo', t.c_doc('A005'), t.id_usuario('docente1@susan.test'), app.now());
SELECT t.as_user('docente1@susan.test');
SELECT t.efecto($q$ SELECT public.api_resolver_justificante(t.c_jid('3A', '2026-09-05', 'A002'), true, 'Constancia válida') $q$,
    $q$ SELECT (SELECT estatus::text FROM justificante WHERE id_justificante = t.c_jid('3A', '2026-09-05', 'A002')) = 'aprobado'
           AND (SELECT resuelto_por FROM justificante WHERE id_justificante = t.c_jid('3A', '2026-09-05', 'A002')) = t.id_usuario('docente1@susan.test')
           AND (SELECT fecha_resolucion FROM justificante WHERE id_justificante = t.c_jid('3A', '2026-09-05', 'A002')) = app.now()
           AND (SELECT estado::text || origen::text FROM asistencia WHERE id_asistencia = t.c('AS7')) = 'justificadocorreccion'
           AND t.c_nbit('aprobacion_justificante', 'justificante', t.c_jid('3A', '2026-09-05', 'A002')) = 1
           AND (t.c_bit('aprobacion_justificante', 'justificante', t.c_jid('3A', '2026-09-05', 'A002')) -> 'valor_anterior' ->> 'estado_asistencia') = 'ausente' $q$,
    'RES-01: aprobar deja el registro justificado y asienta bitacora');
SELECT t.efecto($q$ SELECT public.api_resolver_justificante(t.c_jid('3A', '2026-09-05', 'A005'), true) $q$,
    $q$ SELECT (SELECT estado::text FROM asistencia WHERE id_asistencia = t.c('AS8')) = 'justificado'
           AND (SELECT hora_registro = '2026-09-05 07:12:00-06' FROM asistencia WHERE id_asistencia = t.c('AS8')) $q$,
    'RES-02: un retardo justificado conserva su hora');
SELECT t.efecto($q$ SELECT public.api_resolver_justificante(t.c_jid('3A', '2026-09-05', 'A002'), true) $q$,
    $q$ SELECT (SELECT count(*) FROM deteccion) = 6 AND (SELECT count(*) FROM captura) = 5
           AND (SELECT id_asistencia FROM asistencia WHERE id_asistencia = t.c('AS7')) = t.c('AS7') $q$,
    'RES-01: no se borra ni el registro ni capturas/detecciones (RN-09)');
SELECT t.efecto($q$ SELECT public.api_resolver_justificante(t.c_jid('3A', '2026-09-05', 'A002'), false, 'Ilegible') $q$,
    $q$ SELECT (SELECT estatus::text FROM justificante WHERE id_justificante = t.c_jid('3A', '2026-09-05', 'A002')) = 'rechazado'
           AND (SELECT resuelto_por IS NOT NULL AND fecha_resolucion IS NOT NULL FROM justificante WHERE id_justificante = t.c_jid('3A', '2026-09-05', 'A002'))
           AND (SELECT estado::text || origen::text FROM asistencia WHERE id_asistencia = t.c('AS7')) = 'ausenteautomatico'
           AND t.c_nbit('rechazo_justificante', 'justificante', t.c_jid('3A', '2026-09-05', 'A002')) = 1 $q$,
    'RES-03: rechazar conserva el estado y origen del registro');
SELECT t.throws($q$ SELECT public.api_resolver_justificante(t.c_jid('3A', '2026-09-05', 'A002'), true);
                    SELECT public.api_resolver_justificante(t.c_jid('3A', '2026-09-05', 'A002'), false) $q$, 'P0001:JUSTIFICANTE_YA_RESUELTO', 'RES-04: ya resuelto');
SELECT t.throws($q$ SELECT public.api_resolver_justificante(t.c_jid('3A', '2026-09-05', 'A002'), NULL) $q$, 'P0001:VALIDACION', 'RES-06: p_aprobar nulo');
SELECT t.throws($q$ SELECT public.api_resolver_justificante(999999, true) $q$, 'P0001:NO_ENCONTRADO', 'RES-07: id inexistente');
SELECT t.throws($q$ SELECT public.api_resolver_justificante(t.c_jid('3A', '2026-09-05', 'A002'), true, repeat('c', 201)) $q$, 'P0001:VALIDACION', 'RES-11: comentario de 201');
SELECT t.efecto($q$ SELECT t.reloj('2026-10-08 09:40:00-06'); SELECT public.api_resolver_justificante(t.c_jid('3A', '2026-09-05', 'A002'), true) $q$,
    $q$ SELECT estado = 'justificado' FROM asistencia WHERE id_asistencia = t.c('AS7') $q$, 'RES-08: sin plazo para resolver justificantes (30 dias despues)');
SELECT t.throws($q$ SELECT t.as_postgres(); UPDATE asistencia SET estado = 'presente', origen = 'manual', hora_registro = app.now() WHERE id_asistencia = t.c('AS7');
                    SELECT t.as_user('docente1@susan.test'); SELECT public.api_resolver_justificante(t.c_jid('3A', '2026-09-05', 'A002'), true) $q$,
    'P0001:ESTADO_NO_JUSTIFICABLE', 'RES-10: el registro ya no es falta ni retardo');
SELECT t.throws($q$ SELECT public.api_resolver_justificante(t.c_jid('3A', '2026-09-05', 'A002'), true);
                    SELECT public.api_corregir_asistencia(t.c('AS7'), 'presente') $q$, 'P0001:TRANSICION_NO_PERMITIDA', 'RES-13: tras aprobar no se corrige');
SELECT t.throws($q$ SELECT t.as_user('alumno2@susan.test'); SELECT public.api_registrar_justificante(t.c('S1'), 'm', t.c_doc('A002'));
                    SELECT t.as_user('docente1@susan.test'); SELECT public.api_corregir_asistencia(t.c('AS2'), 'presente') $q$,
    'P0001:JUSTIFICANTE_PENDIENTE', 'COR-18: presente con justificante pendiente');
SELECT t.lives_rb($q$ SELECT t.as_user('alumno2@susan.test'); SELECT public.api_registrar_justificante(t.c('S1'), 'm', t.c_doc('A002'));
                    SELECT t.as_user('docente1@susan.test'); SELECT public.api_corregir_asistencia(t.c('AS2'), 'retardo') $q$,
    'COR-18: retardo con justificante pendiente si');
SELECT t.as_user('docente2@susan.test');
SELECT t.throws($q$ SELECT public.api_resolver_justificante(t.c_jid('3A', '2026-09-05', 'A002'), true) $q$, 'P0001:NO_AUTORIZADO', 'RES-05: docente ajeno');
SELECT t.as_user('alumno2@susan.test');
SELECT t.throws($q$ SELECT public.api_resolver_justificante(t.c_jid('3A', '2026-09-05', 'A002'), true) $q$, 'P0001:NO_AUTORIZADO', 'RES-05: el alumno no resuelve');
SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ SELECT public.api_resolver_justificante(1, true) $q$, 'P0001:NO_AUTORIZADO', 'RES: administrador');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.api_resolver_justificante(1, true) $q$, '42501', 'anon no resuelve');

-- RES-09: A001 con 10 faltas (sin derecho); aprobar el justificante de una la devuelve a 9 (18.75 %)
SELECT t.as_postgres();
UPDATE asistencia SET estado = 'ausente', origen = 'correccion', hora_registro = NULL WHERE id_asistencia = t.c('AS1');
SELECT app.recalcular_grupo(t.id_grupo('3A'));
SELECT t.ok(NOT t.c_derecho('3A', 'A001'), 'RES-09: con 10 faltas A001 pierde el derecho');
INSERT INTO justificante (id_sesion, id_alumno, motivo, objeto_documento, registrado_por, fecha_registro)
VALUES (t.c('S1'), t.id_alumno('A001'), 'Hospitalizacion', t.c_doc('A001'), t.id_usuario('alumno1@susan.test'), app.now());
SELECT t.as_user('docente1@susan.test');
SELECT t.efecto($q$ SELECT public.api_resolver_justificante(t.c_jid('3A', '2026-09-08', 'A001'), true) $q$,
    $q$ SELECT t.c_derecho('3A', 'A001') AND (SELECT faltas_equivalentes FROM v_resumen_asistencia
            WHERE id_alumno = t.id_alumno('A001') AND id_grupo = t.id_grupo('3A')) = 9 $q$,
    'RES-09: aprobar la decima falta devuelve el derecho (18.75 %)');
SELECT t.lives_rb($q$ DO $d$ BEGIN
    IF (public.api_resolver_justificante(t.c_jid('3A', '2026-09-08', 'A001'), true) -> 'inscripcion' ->> 'derecho_examen_anterior') <> 'false' THEN
        RAISE EXCEPTION 'derecho_examen_anterior debia ser false';
    END IF;
END $d$ $q$, 'RES-09: el retorno informa derecho_examen_anterior = false');


SELECT t.summary();
ROLLBACK;
