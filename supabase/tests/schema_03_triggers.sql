-- Los seis disparadores: trg_asistencia_rn01, trg_asistencia_ciclo, trg_captura_rn06,
-- trg_plantilla_rn13, trg_bitacora_sin_cambios, trg_bitacora_sin_truncate.
-- Fixtures: 3A (A-12, automatica) tiene a A001/A002/A005/A006 activos y a A003 en baja; 5B (B-04) es
-- de pase manual y solo tiene a A004. La sesion 3A del 14-sep esta abierta con A001 pendiente (1 lectura).
BEGIN;
SELECT t.begin('schema_03_triggers');
SELECT t.cargar_fixtures();

-- ===== trg_asistencia_rn01 (RN-01) =================================================================
SELECT t.throws($q$ INSERT INTO asistencia (id_sesion, id_alumno, estado, hora_registro, origen)
    VALUES (t.id_sesion('3A', '2026-09-14'), t.id_alumno('A004'), 'presente', '2026-09-14 07:02:00-06', 'manual') $q$,
    '23514:rn01_asistencia_inscripcion_activa', 'RN-01: asistencia de un alumno no inscrito en el grupo');
SELECT t.throws($q$ INSERT INTO asistencia (id_sesion, id_alumno, estado, hora_registro, origen)
    VALUES (t.id_sesion('3A', '2026-09-14'), t.id_alumno('A003'), 'presente', '2026-09-14 07:02:00-06', 'manual') $q$,
    '23514:rn01_asistencia_inscripcion_activa', 'RN-01: asistencia de una alumna con la inscripcion en baja');
SELECT t.throws($q$ UPDATE asistencia SET id_alumno = t.id_alumno('A004')
    WHERE id_sesion = t.id_sesion('3A', '2026-09-07') AND id_alumno = t.id_alumno('A006') $q$,
    '23514:rn01_asistencia_inscripcion_activa', 'RN-01: cambiar el alumno de un registro a uno no inscrito');
SELECT t.throws($q$ UPDATE asistencia SET id_sesion = t.id_sesion('5B', '2026-09-14')
    WHERE id_sesion = t.id_sesion('3A', '2026-09-07') AND id_alumno = t.id_alumno('A006') $q$,
    '23514:rn01_asistencia_inscripcion_activa', 'RN-01: mover un registro a la sesion de un grupo donde no esta inscrito');
SELECT t.throws($q$ UPDATE inscripcion SET estatus = 'baja' WHERE id_alumno = t.id_alumno('A002') AND id_grupo = t.id_grupo('3A');
                    INSERT INTO asistencia (id_sesion, id_alumno, estado, hora_registro, origen)
                    VALUES (t.id_sesion('3A', '2026-09-14'), t.id_alumno('A002'), 'presente', '2026-09-14 07:02:00-06', 'manual') $q$,
    '23514:rn01_asistencia_inscripcion_activa', 'RN-01: tras dar de baja la inscripcion ya no se registra asistencia');
SELECT t.lives_rb($q$ INSERT INTO asistencia (id_sesion, id_alumno, estado, hora_registro, origen)
    VALUES (t.id_sesion('3A', '2026-09-14'), t.id_alumno('A002'), 'presente', '2026-09-14 07:02:00-06', 'manual') $q$,
    'RN-01: un inscrito activo si recibe asistencia');
SELECT t.lives_rb($q$ UPDATE asistencia SET conteo_detecciones = 2
    WHERE id_sesion = t.id_sesion('3A', '2026-09-14') AND id_alumno = t.id_alumno('A001') $q$,
    'RN-01 no estorba un UPDATE de otras columnas');

-- ===== trg_asistencia_ciclo (RN-05, RN-06, RN-07, RN-09) ============================================
-- Nacimiento
SELECT t.throws($q$ INSERT INTO asistencia (id_sesion, id_alumno, estado, hora_registro, origen, conteo_detecciones)
    VALUES (t.id_sesion('3A', '2026-09-14'), t.id_alumno('A002'), 'presente', '2026-09-14 07:02:00-06', 'automatico', 3) $q$,
    '23514:rn05_asistencia_nace_pendiente', 'RN-05: un registro automatico no nace presente');
SELECT t.throws($q$ INSERT INTO asistencia (id_sesion, id_alumno, estado, hora_registro, origen, conteo_detecciones)
    VALUES (t.id_sesion('3A', '2026-09-14'), t.id_alumno('A002'), 'retardo', '2026-09-14 07:12:00-06', 'automatico', 3) $q$,
    '23514:rn05_asistencia_nace_pendiente', 'RN-05: un registro automatico no nace retardo');
SELECT t.throws($q$ INSERT INTO asistencia (id_sesion, id_alumno, estado, hora_registro, origen)
    VALUES (t.id_sesion('3A', '2026-09-14'), t.id_alumno('A002'), 'justificado', '2026-09-14 07:02:00-06', 'manual') $q$,
    '23514:rn09_asistencia_nace_justificada', 'RN-09: un registro manual no nace justificado');
SELECT t.throws($q$ INSERT INTO asistencia (id_sesion, id_alumno, estado, origen)
    VALUES (t.id_sesion('3A', '2026-09-14'), t.id_alumno('A002'), 'justificado', 'correccion') $q$,
    '23514:rn09_asistencia_nace_justificada', 'RN-09: ni siquiera una correccion crea un registro justificado');
SELECT t.throws($q$ INSERT INTO asistencia (id_sesion, id_alumno, estado, hora_registro, origen, conteo_detecciones)
    VALUES (t.id_sesion('5B', '2026-09-14'), t.id_alumno('A004'), 'pendiente', '2026-09-14 09:02:00-06', 'automatico', 1) $q$,
    '23514:rn06_asistencia_automatico_en_sesion_manual', 'RN-06: registro automatico en una sesion de pase manual');
SELECT t.throws($q$ INSERT INTO asistencia (id_sesion, id_alumno, estado, origen)
    VALUES (t.id_sesion('5B', '2026-09-14'), t.id_alumno('A004'), 'ausente', 'automatico') $q$,
    '23514:rn06_asistencia_automatico_en_sesion_manual', 'RN-06: ni el ausente del cierre es automatico en una sesion manual');
SELECT t.lives_rb($q$ INSERT INTO asistencia (id_sesion, id_alumno, estado, origen)
    VALUES (t.id_sesion('5B', '2026-09-14'), t.id_alumno('A004'), 'ausente', 'manual') $q$,
    'RN-07: el ausente de una sesion manual lleva origen manual');
SELECT t.lives_rb($q$ INSERT INTO asistencia (id_sesion, id_alumno, estado, origen)
    VALUES (t.id_sesion('3A', '2026-09-14'), t.id_alumno('A002'), 'ausente', 'automatico') $q$,
    'RN-07: el ausente del cierre de una sesion automatica nace con origen automatico');
SELECT t.lives_rb($q$ INSERT INTO asistencia (id_sesion, id_alumno, estado, hora_registro, origen, conteo_detecciones)
    VALUES (t.id_sesion('3A', '2026-09-14'), t.id_alumno('A002'), 'pendiente', '2026-09-14 07:10:00-06', 'automatico', 1) $q$,
    'RN-05: la primera lectura valida crea el registro pendiente');
SELECT t.lives_rb($q$ INSERT INTO asistencia (id_sesion, id_alumno, estado, hora_registro, origen)
    VALUES (t.id_sesion('3A', '2026-09-14'), t.id_alumno('A005'), 'presente', '2026-09-14 07:02:00-06', 'manual') $q$,
    'RF-09/RNF-06: pase manual en una sesion automatica (alumno sin consentimiento vigente)');

-- Confirmacion y transiciones
SELECT t.throws($q$ UPDATE asistencia SET estado = 'presente'
    WHERE id_sesion = t.id_sesion('3A', '2026-09-14') AND id_alumno = t.id_alumno('A001') $q$,
    '23514:rn05_asistencia_confirmacion_lecturas', 'RN-05: confirmar con una sola lectura');
SELECT t.throws($q$ UPDATE asistencia SET estado = 'retardo', conteo_detecciones = 2
    WHERE id_sesion = t.id_sesion('3A', '2026-09-14') AND id_alumno = t.id_alumno('A001') $q$,
    '23514:rn05_asistencia_confirmacion_lecturas', 'RN-05: confirmar con dos lecturas');
SELECT t.throws($q$ UPDATE asistencia SET estado = 'pendiente', conteo_detecciones = 1
    WHERE id_sesion = t.id_sesion('3A', '2026-09-07') AND id_alumno = t.id_alumno('A001') $q$,
    '23514:rn05_asistencia_regreso_a_pendiente', 'RN-05: un presente no regresa a pendiente');
SELECT t.throws($q$ UPDATE asistencia SET estado = 'pendiente', hora_registro = '2026-09-07 07:05:00-06', origen = 'automatico', conteo_detecciones = 1
    WHERE id_sesion = t.id_sesion('3A', '2026-09-07') AND id_alumno = t.id_alumno('A002') $q$,
    '23514:rn05_asistencia_regreso_a_pendiente', 'RN-05: un ausente no regresa a pendiente');
SELECT t.throws($q$ UPDATE asistencia SET estado = 'retardo'
    WHERE id_sesion = t.id_sesion('3A', '2026-09-07') AND id_alumno = t.id_alumno('A001') $q$,
    '23514:rn05_asistencia_cambio_requiere_humano', 'RN-05: el sistema automatico no reclasifica un presente confirmado');
SELECT t.throws($q$ UPDATE asistencia SET estado = 'presente', hora_registro = '2026-09-07 07:05:00-06'
    WHERE id_sesion = t.id_sesion('3A', '2026-09-07') AND id_alumno = t.id_alumno('A002') $q$,
    '23514:rn05_asistencia_cambio_requiere_humano', 'RN-05: un ausente automatico no pasa a presente sin intervencion humana');
SELECT t.throws($q$ UPDATE asistencia SET estado = 'justificado', origen = 'correccion'
    WHERE id_sesion = t.id_sesion('3A', '2026-09-07') AND id_alumno = t.id_alumno('A001') $q$,
    '23514:rn09_asistencia_justificar_solo_falta_o_retardo', 'RN-09: un presente no se justifica');
SELECT t.throws($q$ UPDATE asistencia SET estado = 'justificado', origen = 'correccion'
    WHERE id_sesion = t.id_sesion('3A', '2026-09-14') AND id_alumno = t.id_alumno('A001') $q$,
    '23514:rn09_asistencia_justificar_solo_falta_o_retardo', 'RN-09: un pendiente no se justifica');
SELECT t.throws($q$ UPDATE asistencia SET estado = 'justificado', origen = 'manual'
    WHERE id_sesion = t.id_sesion('3A', '2026-09-07') AND id_alumno = t.id_alumno('A002') $q$,
    '23514:rn09_asistencia_justificar_con_correccion', 'RN-09: justificar exige origen correccion');
SELECT t.throws($q$ UPDATE asistencia SET estado = 'justificado', origen = 'correccion'
    WHERE id_sesion = t.id_sesion('3A', '2026-09-07') AND id_alumno = t.id_alumno('A002');
                    UPDATE asistencia SET estado = 'ausente', origen = 'correccion'
    WHERE id_sesion = t.id_sesion('3A', '2026-09-07') AND id_alumno = t.id_alumno('A002') $q$,
    '23514:rn09_asistencia_justificado_inmutable', 'RN-09: un registro justificado ya no cambia de estado');

-- Transiciones validas
SELECT t.efecto($q$ UPDATE asistencia SET estado = 'presente', conteo_detecciones = 3
    WHERE id_sesion = t.id_sesion('3A', '2026-09-14') AND id_alumno = t.id_alumno('A001') $q$,
    $q$ SELECT estado = 'presente' FROM asistencia WHERE id_sesion = t.id_sesion('3A', '2026-09-14') AND id_alumno = t.id_alumno('A001') $q$,
    'RN-05: la tercera lectura confirma presente');
SELECT t.efecto($q$ UPDATE asistencia SET estado = 'retardo', conteo_detecciones = 3
    WHERE id_sesion = t.id_sesion('3A', '2026-09-14') AND id_alumno = t.id_alumno('A001') $q$,
    $q$ SELECT estado = 'retardo' FROM asistencia WHERE id_sesion = t.id_sesion('3A', '2026-09-14') AND id_alumno = t.id_alumno('A001') $q$,
    'RN-05: la tercera lectura tambien confirma retardo');
SELECT t.efecto($q$ UPDATE asistencia SET conteo_detecciones = 2
    WHERE id_sesion = t.id_sesion('3A', '2026-09-14') AND id_alumno = t.id_alumno('A001') $q$,
    $q$ SELECT estado = 'pendiente' AND conteo_detecciones = 2 FROM asistencia WHERE id_sesion = t.id_sesion('3A', '2026-09-14') AND id_alumno = t.id_alumno('A001') $q$,
    'RN-05: una segunda lectura deja el registro pendiente');
SELECT t.efecto($q$ UPDATE asistencia SET estado = 'presente', origen = 'correccion'
    WHERE id_sesion = t.id_sesion('3A', '2026-09-14') AND id_alumno = t.id_alumno('A001') $q$,
    $q$ SELECT estado = 'presente' AND origen = 'correccion' FROM asistencia WHERE id_sesion = t.id_sesion('3A', '2026-09-14') AND id_alumno = t.id_alumno('A001') $q$,
    'RN-08: el docente resuelve un pendiente con menos lecturas (origen correccion)');
SELECT t.efecto($q$ UPDATE asistencia SET estado = 'ausente', hora_registro = NULL, origen = 'correccion'
    WHERE id_sesion = t.id_sesion('3A', '2026-09-14') AND id_alumno = t.id_alumno('A001') $q$,
    $q$ SELECT estado = 'ausente' FROM asistencia WHERE id_sesion = t.id_sesion('3A', '2026-09-14') AND id_alumno = t.id_alumno('A001') $q$,
    'RN-08: un pendiente vencido pasa a ausente por correccion');
SELECT t.efecto($q$ UPDATE asistencia SET estado = 'presente', hora_registro = NULL, origen = 'correccion'
    WHERE id_sesion = t.id_sesion('3A', '2026-09-07') AND id_alumno = t.id_alumno('A002') $q$,
    $q$ SELECT estado = 'presente' AND hora_registro IS NULL FROM asistencia WHERE id_sesion = t.id_sesion('3A', '2026-09-07') AND id_alumno = t.id_alumno('A002') $q$,
    'un ausente corregido a presente puede quedar sin hora (ck_asistencia_hora_presencia lo admite con correccion)');
SELECT t.efecto($q$ UPDATE asistencia SET estado = 'justificado', origen = 'correccion'
    WHERE id_sesion = t.id_sesion('3A', '2026-09-07') AND id_alumno = t.id_alumno('A002') $q$,
    $q$ SELECT estado = 'justificado' FROM asistencia WHERE id_sesion = t.id_sesion('3A', '2026-09-07') AND id_alumno = t.id_alumno('A002') $q$,
    'RN-09: un ausente se justifica con origen correccion y conserva su fila');
SELECT t.efecto($q$ UPDATE asistencia SET estado = 'justificado', origen = 'correccion'
    WHERE id_sesion = t.id_sesion('3A', '2026-09-07') AND id_alumno = t.id_alumno('A005') $q$,
    $q$ SELECT estado = 'justificado' AND hora_registro IS NOT NULL FROM asistencia WHERE id_sesion = t.id_sesion('3A', '2026-09-07') AND id_alumno = t.id_alumno('A005') $q$,
    'RN-09: un retardo tambien se justifica');
SELECT t.efecto($q$ UPDATE asistencia SET estado = 'ausente', hora_registro = NULL, origen = 'manual'
    WHERE id_sesion = t.id_sesion('3A', '2026-09-07') AND id_alumno = t.id_alumno('A006') $q$,
    $q$ SELECT estado = 'ausente' FROM asistencia WHERE id_sesion = t.id_sesion('3A', '2026-09-07') AND id_alumno = t.id_alumno('A006') $q$,
    'pase manual: el docente cambia presente a ausente');

-- ===== trg_captura_rn06 (RN-06) ====================================================================
SELECT t.throws($q$ INSERT INTO captura (id_camara, id_sesion, marca_tiempo, rostros_detectados)
    VALUES (t.id_camara('B-04', 'frente'), t.id_sesion('3A', '2026-09-14'), '2026-09-14 07:07:00-06', 0) $q$,
    '23514:rn06_captura_camara_aula', 'RN-06: camara de otra aula en la captura');
SELECT t.throws($q$ INSERT INTO captura (id_camara, id_sesion, marca_tiempo, rostros_detectados)
    VALUES (t.id_camara('A-12', 'frente'), t.id_sesion('5B', '2026-09-14'), '2026-09-14 09:07:00-06', 0) $q$,
    '23514:rn06_captura_camara_aula', 'RN-06: camara del aula A-12 en una sesion del aula B-04');
SELECT t.throws($q$ UPDATE captura SET id_camara = t.id_camara('B-04', 'frente') WHERE marca_tiempo = '2026-09-14 07:05:00-06' $q$,
    '23514:rn06_captura_camara_aula', 'RN-06: cambiar la camara de una captura a otra aula');
SELECT t.lives_rb($q$ INSERT INTO captura (id_camara, id_sesion, marca_tiempo, rostros_detectados)
    VALUES (t.id_camara('A-12', 'fondo'), t.id_sesion('3A', '2026-09-14'), '2026-09-14 07:05:00-06', 1) $q$,
    'RN-06: la camara de fondo (navegador) del mismo aula captura en la misma marca de tiempo');

-- ===== trg_plantilla_rn13 (RN-13) ==================================================================
SELECT t.throws($q$ INSERT INTO plantilla_facial (id_alumno, id_consent, objeto_foto) VALUES (t.id_alumno('A002'), t.id_consent('A001'), 'registro/2/n.jpg') $q$,
    '23514:rn13_plantilla_consentimiento_ajeno', 'RN-13: plantilla con el consentimiento de otro alumno');
SELECT t.throws($q$ INSERT INTO plantilla_facial (id_alumno, id_consent, objeto_foto) VALUES (t.id_alumno('A005'), t.id_consent('A005'), 'registro/5/n.jpg') $q$,
    '23514:rn13_plantilla_consentimiento_no_vigente', 'RN-13: plantilla con consentimiento revocado');
SELECT t.throws($q$ INSERT INTO plantilla_facial (id_alumno, id_consent, objeto_foto) VALUES (t.id_alumno('A006'), t.id_consent('A006'), 'registro/6/n.jpg') $q$,
    '23514:rn13_plantilla_consentimiento_vencido', 'RN-13: consentimiento vencido por fecha aunque su estatus siga vigente');
SELECT t.throws($q$ UPDATE consentimiento SET estatus = 'vencido' WHERE id_consent = t.id_consent('A002');
                    INSERT INTO plantilla_facial (id_alumno, id_consent, objeto_foto) VALUES (t.id_alumno('A002'), t.id_consent('A002'), 'registro/2/n.jpg') $q$,
    '23514:rn13_plantilla_consentimiento_no_vigente', 'RN-13: consentimiento con estatus vencido');
SELECT t.throws($q$ UPDATE plantilla_facial SET activa = false WHERE id_alumno = t.id_alumno('A001');
                    UPDATE consentimiento SET estatus = 'revocado' WHERE id_consent = t.id_consent('A001');
                    UPDATE plantilla_facial SET activa = true WHERE id_alumno = t.id_alumno('A001') $q$,
    '23514:rn13_plantilla_consentimiento_no_vigente', 'RN-13: reactivar una plantilla cuyo consentimiento ya se revoco');
SELECT t.throws($q$ UPDATE plantilla_facial SET id_consent = t.id_consent('A002') WHERE id_alumno = t.id_alumno('A001') $q$,
    '23514:rn13_plantilla_consentimiento_ajeno', 'RN-13: reasignar la plantilla al consentimiento de otro alumno');
SELECT t.throws($q$ UPDATE plantilla_facial SET id_consent = t.id_consent('A005') WHERE id_alumno = t.id_alumno('A001') $q$,
    '23514:rn13_plantilla_consentimiento_ajeno', 'RN-13: la propiedad se comprueba antes que la vigencia');
SELECT t.efecto($q$ UPDATE plantilla_facial SET activa = false WHERE id_alumno = t.id_alumno('A001');
                    INSERT INTO plantilla_facial (id_alumno, id_consent, objeto_foto) VALUES (t.id_alumno('A001'), t.id_consent('A001'), 'registro/1/nueva.jpg') $q$,
    $q$ SELECT (SELECT count(*) FROM plantilla_facial WHERE id_alumno = t.id_alumno('A001') AND activa) = 1
          AND (SELECT count(*) FROM plantilla_facial WHERE id_alumno = t.id_alumno('A001')) = 2 $q$,
    'RN-12: el alta archiva primero la plantilla anterior y despues inserta la nueva');
SELECT t.lives_rb($q$ INSERT INTO plantilla_facial (id_alumno, id_consent, objeto_foto) VALUES (t.id_alumno('A002'), t.id_consent('A002'), 'registro/2/n.jpg') $q$,
    'RN-13: primera plantilla de un alumno con consentimiento vigente (sin indice todavia)');
SELECT t.lives_rb($q$ UPDATE consentimiento SET estatus = 'revocado' WHERE id_consent = t.id_consent('A001');
                      UPDATE plantilla_facial SET activa = false WHERE id_alumno = t.id_alumno('A001') $q$,
    'RN-13: tras revocar el consentimiento la plantilla se puede archivar');
SELECT t.lives_rb($q$ UPDATE plantilla_facial SET id_indice = t.id_indice('v002'), faiss_id = 5 WHERE id_alumno = t.id_alumno('A001') $q$,
    'RN-12: reconstruir el indice reasigna id_indice/faiss_id sin volver a validar el consentimiento');

-- ===== Bitacora de solo insercion (RNF-08) ==========================================================
SELECT t.throws($q$ UPDATE bitacora_auditoria SET entidad = 'alumno' $q$, '23000:trg_bitacora_sin_cambios', 'RNF-08: UPDATE sobre la bitacora');
SELECT t.throws($q$ DELETE FROM bitacora_auditoria $q$, '23000:trg_bitacora_sin_cambios', 'RNF-08: DELETE sobre la bitacora');
SELECT t.throws($q$ TRUNCATE bitacora_auditoria $q$, '23000:trg_bitacora_sin_truncate', 'RNF-08: TRUNCATE sobre la bitacora');
SELECT t.throws($q$ SET LOCAL session_replication_role = replica; DELETE FROM bitacora_auditoria $q$,
    '23000:trg_bitacora_sin_cambios', 'RNF-08: ni con session_replication_role = replica (ENABLE ALWAYS)');
SELECT t.throws($q$ SET LOCAL session_replication_role = replica; TRUNCATE bitacora_auditoria $q$,
    '23000:trg_bitacora_sin_truncate', 'RNF-08: ni TRUNCATE en modo replica');
SELECT t.throws($q$ TRUNCATE usuario CASCADE $q$, '23000:trg_bitacora_sin_truncate', 'RNF-08: un TRUNCATE ... CASCADE que alcanza la bitacora tambien se rechaza');
SELECT t.lives_rb($q$ SELECT app.bitacora('consulta', 'asistencia', 1, NULL, '{"x":1}', NULL, t.id_usuario('docente1@susan.test')) $q$,
    'RNF-08: insertar en la bitacora (via app.bitacora) si se permite');

SELECT t.summary();
ROLLBACK;
