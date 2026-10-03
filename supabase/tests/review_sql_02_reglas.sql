-- review_sql_02 · reglas eludibles llamando directo, reloj, bitacora, cuenta de servicio, entradas hostiles
BEGIN;
SELECT t.begin('review_sql_02_reglas');
SELECT t.cargar_fixtures();
\ir api_c_escenario.inc

-- ===== A. Reloj simulado imposible desde un rol de usuario cuando la BD NO lo habilito (produccion) =====
SELECT t.as_postgres();
DO $$ BEGIN EXECUTE format('ALTER DATABASE %I RESET app.allow_fake_clock', current_database()); END $$;
SELECT t.as_user('docente1@susan.test');
SELECT set_config('app.allow_fake_clock', 'on', true), set_config('app.fake_now', '2020-01-01 00:00:00+00', true);
SELECT t.eq(app.reloj_simulado(), false, 'A1: SET de sesion de allow_fake_clock/fake_now no activa el reloj simulado');
SELECT t.ok(abs(extract(epoch FROM app.now() - now())) < 5, 'A2: app.now() sigue siendo now()');
SELECT t.eq((public.api_ahora() ->> 'reloj_simulado')::boolean, false, 'A3: api_ahora no reporta reloj simulado');
SELECT t.throws($q$ SELECT public.api_corregir_asistencia(t.c('AS1'), 'presente') $q$, 'RN_08_PLAZO_VENCIDO',
   'A4: con fake_now=2020 forzado por el usuario, el plazo de correccion sigue vencido (reloj real)');
SELECT t.as_postgres();
DO $$ BEGIN EXECUTE format('ALTER DATABASE %I SET app.allow_fake_clock = ''on''', current_database()); END $$;
SELECT t.reloj('2026-09-14 07:12:00-06');

-- ===== B. Cuenta de servicio y bitacora no suplantables =====
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT app.asumir_cuenta_servicio() $q$, '42501', 'B1: docente no puede asumir la cuenta de servicio');
SELECT t.throws($q$ SELECT app.bitacora('consulta', 'x', 1, NULL, NULL, NULL, 1) $q$, '42501', 'B2: docente no escribe bitacora directo');
SELECT t.throws($q$ SELECT app.cerrar_sesion(t.c('S2'), false) $q$, '42501', 'B3: docente no cierra como servicio');
SELECT t.throws($q$ SELECT public.svc_job_cerrar_sesiones() $q$, '42501', 'B4: docente no ejecuta svc_*');
SELECT t.throws($q$ INSERT INTO bitacora_auditoria (accion, entidad, id_registro) VALUES ('consulta','x',1) $q$, '42501', 'B5: sin INSERT directo en bitacora');
SELECT t.throws($q$ UPDATE bitacora_auditoria SET entidad = 'x' $q$, '42501', 'B6: sin UPDATE en bitacora');
SELECT t.throws($q$ DELETE FROM bitacora_auditoria $q$, '42501', 'B7: sin DELETE en bitacora');
SELECT t.as_service();
SELECT t.throws($q$ UPDATE bitacora_auditoria SET entidad = 'x' $q$, '42501', 'B8: ni service_role actualiza bitacora');
SELECT t.as_postgres();
SELECT t.throws($q$ UPDATE bitacora_auditoria SET entidad = 'x' $q$, '23000', 'B9: ni el propietario/superusuario actualiza bitacora (trigger)');
SELECT t.throws($q$ DELETE FROM bitacora_auditoria $q$, '23000', 'B10: ni el propietario borra bitacora');
SELECT t.throws($q$ TRUNCATE bitacora_auditoria $q$, '23000', 'B11: ni TRUNCATE');
-- las acciones sensibles asientan bitacora a nombre del docente real
SELECT t.as_user('docente1@susan.test');
SELECT t.efecto($q$ SELECT public.api_resolver_justificante(t.c_jid('3A', DATE '2026-09-07', 'A002'), false, 'no') $q$,
   $q$ SELECT t.c_nbit('rechazo_justificante', 'justificante', t.c_jid('3A', DATE '2026-09-07', 'A002')) = 1 $q$, 'B12: rechazar justificante deja bitacora');
SELECT t.efecto($q$ SELECT t.reloj('2026-09-10 08:00:00-06'); SELECT public.api_corregir_asistencia(t.c('AS2'), 'retardo') $q$,
   $q$ SELECT (t.c_bit('correccion', 'asistencia', t.c('AS2')) ->> 'id_usuario')::int = t.id_usuario('docente1@susan.test') $q$, 'B13: correccion a nombre del docente, no del servicio');

-- ===== C. Reglas de la maquina de estados llamando directo =====
SELECT t.reloj('2026-09-10 08:00:00-06');
SELECT t.throws($q$ SELECT public.api_registrar_justificante(t.c('S1'), 'x', t.c_doc('A006'), t.c('ID_A006')) $q$, 'P0001:ESTADO_NO_JUSTIFICABLE',
   'C2: justificar un presente');
SELECT t.as_user('alumno2@susan.test');
SELECT t.throws($q$ SELECT public.api_registrar_justificante(t.c('S1'), 'x', t.c_doc('A001'), t.c('ID_A001')) $q$, 'P0001:NO_AUTORIZADO', 'C3: alumno registra justificante de otro');
SELECT t.throws($q$ SELECT public.api_registrar_justificante(t.c('S1'), 'x', t.c_doc('A001')) $q$, 'P0001:DOCUMENTO_INVALIDO', 'C4: documento con id de otro alumno');
SELECT t.throws($q$ SELECT public.api_registrar_justificante(t.c('S1'), 'x', 'justificantes/' || t.c('ID_A002') || '/../' || t.c('ID_A001') || '/5b3c0a9e-72d4-4f1b-9c1e-0d2f6a8b4e11.pdf') $q$, 'P0001:DOCUMENTO_INVALIDO', 'C5: path traversal');
SELECT t.throws($q$ SELECT public.api_registrar_justificante(t.c('S2'), 'x', t.c_doc('A002')) $q$, 'P0001', 'C6: justificar sesion abierta/sin registro propio');
SELECT t.throws($q$ SELECT public.api_corregir_asistencia(t.c('AS2'), 'ausente') $q$, 'P0001:NO_AUTORIZADO', 'C7: alumno corrige asistencia');
SELECT t.throws($q$ SELECT public.api_resolver_justificante(1, true) $q$, 'P0001:NO_AUTORIZADO', 'C8: alumno resuelve justificante');
SELECT t.throws($q$ SELECT public.api_registrar_manual(t.c('S2'), t.c('ID_A002'), 'presente') $q$, 'P0001:NO_AUTORIZADO', 'C9: alumno pasa lista');
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT public.api_abrir_sesion(t.c('S1')) $q$, 'P0001:SESION_CERRADA', 'C10: reabrir sesion cerrada');
SELECT t.eq((public.api_cerrar_sesion(t.c('S1')) ->> 'ya_cerrada')::boolean, true, 'C11: doble cierre es idempotente y no duplica');
SELECT t.throws($q$ SELECT public.api_registrar_manual(t.c('S1'), t.c('ID_A002'), 'presente') $q$, 'P0001:SESION_NO_ABIERTA', 'C12: pase de lista en sesion cerrada');
SELECT t.throws($q$ SELECT public.api_registrar_manual(t.c('S2'), t.c('ID_A004'), 'presente') $q$, 'P0001:ALUMNO_NO_INSCRITO', 'C13: alumno de otro grupo');
SELECT t.throws($q$ SELECT public.api_registrar_manual(t.c('S2'), t.c('ID_A003'), 'presente') $q$, 'P0001:ALUMNO_NO_INSCRITO', 'C14: alumno en baja');
SELECT t.throws($q$ SELECT public.api_registrar_manual(t.c('S3'), t.c('ID_A004'), 'presente') $q$, 'P0001:NO_AUTORIZADO', 'C15: sesion de otro docente');
-- directo a tablas
SELECT t.throws($q$ UPDATE asistencia SET estado = 'presente' $q$, '42501', 'C16: sin UPDATE directo de asistencia');
SELECT t.throws($q$ INSERT INTO asistencia (id_sesion, id_alumno, estado, origen) VALUES (1,1,'presente','manual') $q$, '42501', 'C17: sin INSERT directo');
SELECT t.throws($q$ UPDATE sesion_clase SET estatus = 'abierta' $q$, '42501', 'C18: sin UPDATE directo de sesion');
-- justificado inmutable aun por postgres
SELECT t.as_postgres();
SELECT t.throws($q$ UPDATE asistencia SET estado = 'justificado', origen = 'correccion' WHERE id_asistencia = t.c('AS4') $q$,
   'rn09_asistencia_justificar', 'C19: presente->justificado nunca (ni de forma directa, como propietario)');

-- ===== D. Entradas hostiles: limites y texto =====
SELECT t.as_user('admin@susan.test');
SELECT t.lives($q$ SELECT public.api_alumnos_listar(NULL, NULL, -5, -3) $q$, 'D1: limit/offset negativos no revientan');
SELECT t.lives($q$ SELECT public.api_alumnos_listar(NULL, NULL, 2147483647, 2147483647) $q$, 'D2: limit/offset gigantes');
SELECT t.ok(jsonb_array_length(public.api_alumnos_listar(NULL, NULL, 2147483647, 0) -> 'items') <= 200, 'D3: limit gigante se acota (<=200)');
SELECT t.lives($q$ SELECT public.api_bitacora_listar(NULL, NULL, NULL, NULL, NULL, -1, -1) $q$, 'D4: bitacora limit negativo');
SELECT t.eq(jsonb_array_length(public.api_alumnos_listar('%', NULL, 50, 0) -> 'items'), 0, 'D5: p_q = "%" se trata literal (no comodin)');
SELECT t.eq(jsonb_array_length(public.api_alumnos_listar('_', NULL, 50, 0) -> 'items'), 0, 'D6: p_q = "_" literal');
SELECT t.lives($q$ SELECT public.api_alumnos_listar($s$'; DROP TABLE alumno; --$s$, NULL, 50, 0) $q$, 'D7: comilla en p_q');
SELECT t.ok(to_regclass('public.alumno') IS NOT NULL, 'D8: la tabla sigue existiendo');
SELECT t.throws($q$ SELECT public.api_alumnos_listar(NULL, $s$activo' OR '1'='1$s$, 50, 0) $q$, 'P0001', 'D9: p_estatus invalido rechazado');
SELECT t.lives($q$ SELECT public.api_alumnos_listar(repeat('a', 100000), NULL, 50, 0) $q$, 'D10: p_q de 100 KB');
SELECT t.lives($q$ SELECT public.api_usuarios_listar(NULL, 'docente', 50, 0) $q$, 'D11: usuarios por rol');
SELECT t.throws($q$ SELECT public.api_usuarios_listar(NULL, $s$x' OR 1=1 --$s$, 50, 0) $q$, 'P0001', 'D12: p_rol invalido');
-- jsonb hostil
SELECT t.throws($q$ SELECT public.api_alumno_guardar('[1,2]'::jsonb) $q$, 'P0001', 'D13: api_alumno_guardar con arreglo');
SELECT t.throws($q$ SELECT public.api_alumno_guardar('"x"'::jsonb) $q$, 'P0001', 'D14: api_alumno_guardar con cadena');
SELECT t.throws($q$ SELECT public.api_alumno_guardar(NULL) $q$, 'P0001', 'D15: api_alumno_guardar NULL');
SELECT t.throws($q$ SELECT public.api_alumno_guardar('{"matricula":"ZZ9","apellido_paterno":"A","nombres":"B","correo_institucional":"z@x.com","id_alumno":"1; drop table alumno"}'::jsonb) $q$, 'P0001', 'D16: id_alumno textual malicioso');
SELECT t.throws($q$ SELECT public.api_importar_inscripciones(t.c('G3A'), '{"a":1}'::jsonb) $q$, 'P0001', 'D17: importar con objeto en vez de arreglo');
SELECT t.throws($q$ SELECT public.api_importar_inscripciones(t.c('G3A'), (SELECT jsonb_agg(jsonb_build_object('matricula','M'||g)) FROM generate_series(1,20000) g)) $q$, 'P0001', 'D18: importar 20000 filas rechazado (limite)');
SELECT t.ok((SELECT (public.api_importar_inscripciones(t.c('G3A'), '[[1],"x",null,{"matricula":{"x":1}}]'::jsonb)) ->> 'inscritas')::int IS DISTINCT FROM 4, 'D19: filas mal formadas no se inscriben');
DO $$ BEGIN RAISE NOTICE 'D19 salida: %', public.api_importar_inscripciones(t.c('G3A'), '[[1],"x",null,{"matricula":{"x":1}}]'::jsonb); END $$;
SELECT t.throws($q$ SELECT public.api_grupo_guardar('{"clave_grupo":"X","periodo":"2026-2","id_materia":"abc"}'::jsonb) $q$, 'P0001', 'D20: grupo con id textual');
SELECT t.throws($q$ SELECT public.api_horario_guardar(t.c('G3A'), '{"x":1}'::jsonb) $q$, 'P0001', 'D21: horario no arreglo');
SELECT t.throws($q$ SELECT public.api_pase_lista_manual(t.c('S2'), '[]'::jsonb) $q$, 'P0001:NO_AUTORIZADO', 'D22: admin no pasa lista');
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT public.api_pase_lista_manual(t.c('S2'), '{"a":1}'::jsonb) $q$, 'P0001:VALIDACION', 'D23: pase con objeto');
SELECT t.throws($q$ SELECT public.api_pase_lista_manual(t.c('S2'), (SELECT jsonb_agg(jsonb_build_object('id_alumno', g)) FROM generate_series(1,501) g)) $q$, 'P0001:VALIDACION', 'D24: 501 registros');
SELECT t.throws($q$ SELECT public.api_pase_lista_manual(t.c('S2'), '[{"id_alumno": 1.5e400}]'::jsonb) $q$, 'P0001', 'D25: numero fuera de rango');
SELECT t.throws($q$ SELECT public.api_pase_lista_manual(t.c('S2'), '[{"id_alumno": "9999999999"}]'::jsonb) $q$, 'P0001:VALIDACION', 'D26: id desbordado');

SELECT t.summary();
ROLLBACK;
