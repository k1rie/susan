-- Restricciones declarativas: CHECK, UNIQUE, indices parciales, FK y enums. Cada rechazo debe
-- traer el SQLSTATE y el NOMBRE de la restriccion prevista (spec 3.4.3: "un rechazo del motor
-- indica exactamente que regla se violo"). Todo corre como superusuario: aqui se prueba el
-- esquema, no los privilegios.
BEGIN;
SELECT t.begin('schema_02_restricciones');
SELECT t.cargar_fixtures();

-- ===== CHECK =====================================================================================
SELECT t.throws($q$ INSERT INTO alumno (matricula, apellido_paterno, nombres, correo_institucional) VALUES ('X1', 'P', 'N', 'sin-arroba') $q$,
    '23514:ck_alumno_correo', 'alumno: correo sin @');
SELECT t.throws($q$ INSERT INTO docente (num_empleado, apellido_paterno, nombres, correo_institucional) VALUES ('X1', 'P', 'N', 'sin-arroba') $q$,
    '23514:ck_docente_correo', 'docente: correo sin @');
SELECT t.throws($q$ INSERT INTO materia (clave, nombre, creditos, horas_semana) VALUES ('X1', 'N', 0, 4) $q$,
    '23514:ck_materia_creditos', 'materia: creditos = 0');
SELECT t.throws($q$ INSERT INTO materia (clave, nombre, creditos, horas_semana) VALUES ('X1', 'N', 8, 21) $q$,
    '23514:ck_materia_horas', 'materia: 21 horas por semana');
SELECT t.throws($q$ INSERT INTO materia (clave, nombre, creditos, horas_semana) VALUES ('X1', 'N', 8, 0) $q$,
    '23514:ck_materia_horas', 'materia: 0 horas por semana');
SELECT t.throws($q$ INSERT INTO aula (clave, edificio, capacidad) VALUES ('X-1', 'A', 0) $q$,
    '23514:ck_aula_capacidad', 'aula: capacidad 0');
SELECT t.throws($q$ INSERT INTO grupo (id_materia, id_docente, id_aula, clave_grupo, periodo) VALUES (t.id_materia('ADM101'), t.id_docente('D001'), t.id_aula('A-12'), '9Z', '2026-3') $q$,
    '23514:ck_grupo_periodo', 'grupo: periodo con semestre 3');
SELECT t.throws($q$ INSERT INTO grupo (id_materia, id_docente, id_aula, clave_grupo, periodo) VALUES (t.id_materia('ADM101'), t.id_docente('D001'), t.id_aula('A-12'), '9Z', '26-2') $q$,
    '23514:ck_grupo_periodo', 'grupo: periodo con año de dos digitos');
SELECT t.throws($q$ INSERT INTO horario_grupo (id_grupo, dia_semana, hora_inicio, hora_fin) VALUES (t.id_grupo('3A'), 7, '10:00', '11:00') $q$,
    '23514:ck_horario_dia', 'horario: dia 7 (domingo)');
SELECT t.throws($q$ INSERT INTO horario_grupo (id_grupo, dia_semana, hora_inicio, hora_fin) VALUES (t.id_grupo('3A'), 2, '11:00', '10:00') $q$,
    '23514:ck_horario_horas', 'horario: hora_fin anterior a hora_inicio');
SELECT t.throws($q$ INSERT INTO sesion_clase (id_grupo, fecha, hora_inicio, hora_fin) VALUES (t.id_grupo('3A'), '2026-10-05', '08:00', '07:00') $q$,
    '23514:ck_sesion_horas', 'sesion: hora_fin anterior a hora_inicio');
SELECT t.throws($q$ INSERT INTO sesion_clase (id_grupo, fecha, hora_inicio, hora_fin, limite_presente_min, tolerancia_min) VALUES (t.id_grupo('3A'), '2026-10-05', '07:00', '08:00', 20, 20) $q$,
    '23514:ck_sesion_ventana', 'sesion: limite de presente igual a la tolerancia');
SELECT t.throws($q$ INSERT INTO sesion_clase (id_grupo, fecha, hora_inicio, hora_fin, limite_presente_min, tolerancia_min) VALUES (t.id_grupo('3A'), '2026-10-05', '07:00', '08:00', 0, 20) $q$,
    '23514:ck_sesion_ventana', 'sesion: limite de presente = 0');
SELECT t.throws($q$ INSERT INTO sesion_clase (id_grupo, fecha, hora_inicio, hora_fin, intervalo_muestreo_seg) VALUES (t.id_grupo('3A'), '2026-10-05', '07:00', '08:00', 4) $q$,
    '23514:ck_sesion_intervalo', 'sesion: intervalo de muestreo 4 s');
SELECT t.throws($q$ INSERT INTO sesion_clase (id_grupo, fecha, hora_inicio, hora_fin, intervalo_muestreo_seg) VALUES (t.id_grupo('3A'), '2026-10-05', '07:00', '08:00', 121) $q$,
    '23514:ck_sesion_intervalo', 'sesion: intervalo de muestreo 121 s');
SELECT t.throws($q$ INSERT INTO asistencia (id_sesion, id_alumno, estado, hora_registro, origen, conteo_detecciones)
    VALUES (t.id_sesion('3A', '2026-09-14'), t.id_alumno('A002'), 'presente', '2026-09-14 07:01:00-06', 'manual', -1) $q$,
    '23514:ck_asistencia_conteo', 'asistencia: conteo negativo');
SELECT t.throws($q$ INSERT INTO asistencia (id_sesion, id_alumno, estado, hora_registro, origen)
    VALUES (t.id_sesion('3A', '2026-09-14'), t.id_alumno('A002'), 'ausente', '2026-09-14 07:01:00-06', 'manual') $q$,
    '23514:ck_asistencia_ausente_sin_hora', 'asistencia: ausente con hora de registro');
SELECT t.throws($q$ INSERT INTO asistencia (id_sesion, id_alumno, estado, hora_registro, origen, conteo_detecciones)
    VALUES (t.id_sesion('3A', '2026-09-14'), t.id_alumno('A002'), 'pendiente', '2026-09-14 07:01:00-06', 'manual', 1) $q$,
    '23514:ck_asistencia_pendiente', 'asistencia: pendiente con origen manual');
SELECT t.throws($q$ INSERT INTO asistencia (id_sesion, id_alumno, estado, hora_registro, origen, conteo_detecciones)
    VALUES (t.id_sesion('3A', '2026-09-14'), t.id_alumno('A002'), 'pendiente', NULL, 'automatico', 1) $q$,
    '23514:ck_asistencia_pendiente', 'asistencia: pendiente sin hora de registro');
SELECT t.throws($q$ INSERT INTO asistencia (id_sesion, id_alumno, estado, hora_registro, origen, conteo_detecciones)
    VALUES (t.id_sesion('3A', '2026-09-14'), t.id_alumno('A002'), 'pendiente', '2026-09-14 07:01:00-06', 'automatico', 0) $q$,
    '23514:ck_asistencia_pendiente', 'asistencia: pendiente sin lecturas');
SELECT t.throws($q$ INSERT INTO asistencia (id_sesion, id_alumno, estado, hora_registro, origen)
    VALUES (t.id_sesion('3A', '2026-09-14'), t.id_alumno('A002'), 'presente', NULL, 'manual') $q$,
    '23514:ck_asistencia_hora_presencia', 'asistencia: presente manual sin hora');
SELECT t.throws($q$ INSERT INTO justificante (id_sesion, id_alumno, motivo, objeto_documento, registrado_por, resuelto_por)
    VALUES (t.id_sesion('3A', '2026-09-07'), t.id_alumno('A005'), 'x', 'justificantes/1/x.pdf', t.id_usuario('alumno2@susan.test'), t.id_usuario('docente1@susan.test')) $q$,
    '23514:ck_justificante_resolucion', 'justificante: pendiente que ya trae quien resolvio');
SELECT t.throws($q$ INSERT INTO justificante (id_sesion, id_alumno, motivo, objeto_documento, estatus, registrado_por)
    VALUES (t.id_sesion('3A', '2026-09-07'), t.id_alumno('A005'), 'x', 'justificantes/1/x.pdf', 'aprobado', t.id_usuario('alumno2@susan.test')) $q$,
    '23514:ck_justificante_resolucion', 'justificante: aprobado sin quien ni cuando resolvio');
SELECT t.throws($q$ INSERT INTO justificante (id_sesion, id_alumno, motivo, objeto_documento, estatus, registrado_por, resuelto_por, fecha_resolucion)
    VALUES (t.id_sesion('3A', '2026-09-07'), t.id_alumno('A005'), 'x', 'justificantes/1/x.pdf', 'rechazado', t.id_usuario('alumno2@susan.test'),
            t.id_usuario('docente1@susan.test'), app.now() - interval '1 day') $q$,
    '23514:ck_justificante_fechas', 'justificante: resuelto antes de registrarse');
SELECT t.throws($q$ INSERT INTO consentimiento (id_alumno, fecha_firma, vigencia_hasta, objeto_documento)
    VALUES (t.id_alumno('A002'), '2026-09-01', '2026-09-01', 'consentimientos/1/x.pdf') $q$,
    '23514:ck_consentimiento_vigencia', 'consentimiento: vigencia no posterior a la firma');
SELECT t.throws($q$ INSERT INTO indice_faiss (version, dimension, objeto_indice, total_vectores) VALUES ('v900', 0, 'indice/v900.json', 0) $q$,
    '23514:ck_indice_dimension', 'indice: dimension 0');
SELECT t.throws($q$ INSERT INTO indice_faiss (version, dimension, objeto_indice, total_vectores) VALUES ('v900', 512, 'indice/v900.json', -1) $q$,
    '23514:ck_indice_total', 'indice: total de vectores negativo');
SELECT t.throws($q$ INSERT INTO plantilla_facial (id_alumno, id_consent, id_indice, faiss_id, objeto_foto)
    VALUES (t.id_alumno('A002'), t.id_consent('A002'), t.id_indice('v001'), -1, 'registro/2/x.jpg') $q$,
    '23514:ck_plantilla_faiss_id', 'plantilla: faiss_id negativo');
SELECT t.throws($q$ INSERT INTO plantilla_facial (id_alumno, id_consent, id_indice, faiss_id, objeto_foto)
    VALUES (t.id_alumno('A002'), t.id_consent('A002'), t.id_indice('v001'), NULL, 'registro/2/x.jpg') $q$,
    '23514:ck_plantilla_indexada', 'plantilla: indice sin faiss_id');
SELECT t.throws($q$ INSERT INTO plantilla_facial (id_alumno, id_consent, id_indice, faiss_id, objeto_foto)
    VALUES (t.id_alumno('A002'), t.id_consent('A002'), NULL, 7, 'registro/2/x.jpg') $q$,
    '23514:ck_plantilla_indexada', 'plantilla: faiss_id sin indice');
SELECT t.throws($q$ INSERT INTO captura (id_camara, id_sesion, marca_tiempo, rostros_detectados)
    VALUES (t.id_camara('A-12', 'frente'), t.id_sesion('3A', '2026-09-14'), '2026-09-14 07:06:00-06', -1) $q$,
    '23514:ck_captura_rostros', 'captura: rostros negativos');
SELECT t.throws($q$ INSERT INTO deteccion (id_captura, id_plantilla, score_similitud, es_valida) VALUES ((SELECT min(id_captura) FROM captura), t.id_plantilla('A001'), 1.2, false) $q$,
    '23514:ck_deteccion_score', 'deteccion: score 1.2');
SELECT t.throws($q$ INSERT INTO deteccion (id_captura, id_plantilla, score_similitud, es_valida) VALUES ((SELECT min(id_captura) FROM captura), t.id_plantilla('A001'), -0.1, false) $q$,
    '23514:ck_deteccion_score', 'deteccion: score -0.1');
SELECT t.throws($q$ INSERT INTO deteccion (id_captura, id_plantilla, score_similitud, es_valida) VALUES ((SELECT min(id_captura) FROM captura), NULL, 0.4, false) $q$,
    '23514:ck_deteccion_candidato', 'deteccion: sin candidato pero con score');
SELECT t.throws($q$ INSERT INTO deteccion (id_captura, id_plantilla, score_similitud, es_valida) VALUES ((SELECT min(id_captura) FROM captura), NULL, NULL, true) $q$,
    '23514:ck_deteccion_candidato', 'deteccion: sin candidato pero marcada valida');
SELECT t.throws($q$ INSERT INTO deteccion (id_captura, id_plantilla, score_similitud, es_valida) VALUES ((SELECT min(id_captura) FROM captura), t.id_plantilla('A001'), NULL, false) $q$,
    '23514:ck_deteccion_candidato', 'deteccion: candidato sin score');
SELECT t.throws($q$ INSERT INTO bitacora_auditoria (id_usuario, accion, entidad, id_registro) VALUES (t.id_usuario('admin@susan.test'), 'consulta', 'tabla_inventada', 1) $q$,
    '23514:ck_bitacora_entidad', 'bitacora: entidad fuera de las 18 tablas auditables');
SELECT t.throws($q$ INSERT INTO bitacora_auditoria (id_usuario, accion, entidad, id_registro) VALUES (t.id_usuario('admin@susan.test'), 'correccion', 'asistencia', 1) $q$,
    '23514:ck_bitacora_valores', 'bitacora: correccion sin valor anterior ni nuevo');
SELECT t.throws($q$ INSERT INTO bitacora_auditoria (id_usuario, accion, entidad, id_registro, valor_anterior) VALUES (t.id_usuario('admin@susan.test'), 'cambio_parametro', 'parametro_sistema', 0, '{}') $q$,
    '23514:ck_bitacora_valores', 'bitacora: cambio de parametro sin valor nuevo');
SELECT t.throws($q$ INSERT INTO usuario (auth_uid, correo, rol) VALUES ('00000000-0000-4000-8000-0000000000a1', 'x1@susan.test', 'docente') $q$,
    '23514:ck_usuario_docente', 'usuario: rol docente sin id_docente');
SELECT t.throws($q$ INSERT INTO usuario (auth_uid, correo, rol, id_docente) VALUES ('00000000-0000-4000-8000-0000000000a1', 'x1@susan.test', 'administrador', t.id_docente('D001')) $q$,
    '23514:ck_usuario_docente', 'usuario: administrador ligado a un docente');
SELECT t.throws($q$ INSERT INTO usuario (auth_uid, correo, rol) VALUES ('00000000-0000-4000-8000-0000000000a1', 'x1@susan.test', 'alumno') $q$,
    '23514:ck_usuario_alumno', 'usuario: rol alumno sin id_alumno');
SELECT t.throws($q$ INSERT INTO camara (id_aula, posicion, tipo, direccion_ip) VALUES (t.id_aula('B-04'), 'fondo', 'ip', NULL) $q$,
    '23514:ck_camara_ip', 'camara: tipo ip sin direccion_ip');

-- ===== UNIQUE e indices parciales ================================================================
SELECT t.throws($q$ INSERT INTO alumno (matricula, apellido_paterno, nombres, correo_institucional) VALUES ('A001', 'P', 'N', 'otro@unach.test') $q$,
    '23505:uq_alumno_matricula', 'alumno: matricula repetida');
SELECT t.throws($q$ INSERT INTO alumno (matricula, apellido_paterno, nombres, correo_institucional) VALUES ('A099', 'P', 'N', 'a001@unach.test') $q$,
    '23505:uq_alumno_correo', 'alumno: correo repetido');
SELECT t.throws($q$ INSERT INTO docente (num_empleado, apellido_paterno, nombres, correo_institucional) VALUES ('D001', 'P', 'N', 'otro@unach.test') $q$,
    '23505:uq_docente_num_empleado', 'docente: numero de empleado repetido');
SELECT t.throws($q$ INSERT INTO materia (clave, nombre, creditos, horas_semana) VALUES ('ADM101', 'Otra', 8, 4) $q$,
    '23505:uq_materia_clave', 'materia: clave repetida');
SELECT t.throws($q$ INSERT INTO aula (clave, edificio, capacidad) VALUES ('A-12', 'Z', 10) $q$,
    '23505:uq_aula_clave', 'aula: clave repetida');
SELECT t.throws($q$ INSERT INTO grupo (id_materia, id_docente, id_aula, clave_grupo, periodo) VALUES (t.id_materia('ADM101'), t.id_docente('D002'), t.id_aula('B-04'), '3A', '2026-2') $q$,
    '23505:uq_grupo_materia_clave_periodo', 'grupo: misma materia, clave y periodo');
SELECT t.throws($q$ INSERT INTO horario_grupo (id_grupo, dia_semana, hora_inicio, hora_fin) VALUES (t.id_grupo('3A'), 1, '07:00', '09:00') $q$,
    '23505:uq_horario_grupo_dia_hora', 'horario: mismo grupo, dia y hora de inicio');
SELECT t.throws($q$ INSERT INTO inscripcion (id_alumno, id_grupo) VALUES (t.id_alumno('A001'), t.id_grupo('3A')) $q$,
    '23505:uq_inscripcion_alumno_grupo', 'inscripcion: alumno ya inscrito en el grupo');
SELECT t.throws($q$ INSERT INTO sesion_clase (id_grupo, fecha, hora_inicio, hora_fin) VALUES (t.id_grupo('3A'), '2026-09-14', '07:00', '08:00') $q$,
    '23505:uq_sesion_grupo_fecha_hora', 'sesion: mismo grupo, fecha y hora');
SELECT t.throws($q$ INSERT INTO asistencia (id_sesion, id_alumno, estado, hora_registro, origen)
    VALUES (t.id_sesion('3A', '2026-09-07'), t.id_alumno('A001'), 'presente', '2026-09-07 07:01:00-06', 'manual') $q$,
    '23505:uq_asistencia_sesion_alumno', 'RN-02: asistencia duplicada del alumno en la sesion');
SELECT t.throws($q$ INSERT INTO camara (id_aula, posicion, tipo, direccion_ip) VALUES (t.id_aula('B-04'), 'fondo', 'ip', '10.20.0.12') $q$,
    '23505:uq_camara_direccion_ip', 'camara: direccion IP repetida');
SELECT t.throws($q$ INSERT INTO camara (id_aula, posicion, tipo, direccion_ip) VALUES (t.id_aula('A-12'), 'frente', 'ip', '10.20.0.99') $q$,
    '23505:uq_camara_aula_posicion', 'RN-06: segunda camara frente en el mismo aula');
SELECT t.throws($q$ INSERT INTO captura (id_camara, id_sesion, marca_tiempo, rostros_detectados)
    VALUES (t.id_camara('A-12', 'frente'), t.id_sesion('3A', '2026-09-14'), '2026-09-14 07:05:00-06', 0) $q$,
    '23505:uq_captura_camara_marca', 'captura: misma camara y marca de tiempo');
SELECT t.throws($q$ INSERT INTO usuario (auth_uid, correo, rol) VALUES ('00000000-0000-4000-8000-000000000011', 'otro@susan.test', 'administrador') $q$,
    '23505:uq_usuario_auth_uid', 'usuario: auth_uid repetido');
SELECT t.throws($q$ INSERT INTO usuario (auth_uid, correo, rol) VALUES ('00000000-0000-4000-8000-0000000000a1', 'admin@susan.test', 'administrador') $q$,
    '23505:uq_usuario_correo', 'usuario: correo repetido');
SELECT t.throws($q$ INSERT INTO usuario (auth_uid, correo, rol, id_docente) VALUES ('00000000-0000-4000-8000-0000000000a1', 'x1@susan.test', 'docente', t.id_docente('D001')) $q$,
    '23505:uq_usuario_docente', 'usuario: docente con dos cuentas');
SELECT t.throws($q$ INSERT INTO usuario (auth_uid, correo, rol, id_alumno) VALUES ('00000000-0000-4000-8000-0000000000a1', 'x1@susan.test', 'alumno', t.id_alumno('A001')) $q$,
    '23505:uq_usuario_alumno', 'usuario: alumno con dos cuentas');
SELECT t.throws($q$ INSERT INTO indice_faiss (version, dimension, objeto_indice, total_vectores) VALUES ('v001', 512, 'indice/x.json', 0) $q$,
    '23505:uq_indice_faiss_version', 'indice: version repetida');
SELECT t.throws($q$ INSERT INTO plantilla_facial (id_alumno, id_consent, id_indice, faiss_id, objeto_foto, activa)
    VALUES (t.id_alumno('A002'), t.id_consent('A002'), t.id_indice('v001'), 0, 'registro/2/x.jpg', false) $q$,
    '23505:uq_plantilla_indice_faiss_id', 'RN-12: mismo faiss_id dentro de la misma version del indice');
SELECT t.throws($q$ INSERT INTO plantilla_facial (id_alumno, id_consent, objeto_foto) VALUES (t.id_alumno('A001'), t.id_consent('A001'), 'registro/1/otra.jpg') $q$,
    '23505:ux_plantilla_facial_activa', 'RN-12: segunda plantilla activa del alumno');
SELECT t.throws($q$ UPDATE indice_faiss SET en_uso = true WHERE version = 'v002' $q$,
    '23505:ux_indice_faiss_en_uso', 'RNF-09: dos versiones del indice en uso');
SELECT t.throws($q$ UPDATE indice_faiss SET en_uso = true WHERE version = 'v002'; UPDATE indice_faiss SET en_uso = false WHERE version = 'v001' $q$,
    '23505:ux_indice_faiss_en_uso', 'RNF-09: cambio de version en orden inverso (primero encender la nueva)');

-- ===== FK ========================================================================================
SELECT t.throws($q$ INSERT INTO grupo (id_materia, id_docente, id_aula, clave_grupo, periodo) VALUES (t.id_materia('ADM101'), 99999, t.id_aula('A-12'), '9Z', '2026-2') $q$,
    '23503:fk_grupo_docente', 'grupo: docente inexistente');
SELECT t.throws($q$ INSERT INTO inscripcion (id_alumno, id_grupo) VALUES (t.id_alumno('A004'), 99999) $q$,
    '23503:fk_inscripcion_grupo', 'inscripcion: grupo inexistente');
SELECT t.throws($q$ DELETE FROM alumno WHERE id_alumno = t.id_alumno('A001') $q$,
    '23503', 'RN-09/RNF-10: no se borra un alumno con historial');
SELECT t.throws($q$ DELETE FROM grupo WHERE id_grupo = t.id_grupo('3A') $q$,
    '23503', 'un grupo con sesiones o inscripciones no puede borrarse');
SELECT t.throws($q$ DELETE FROM sesion_clase WHERE id_sesion = t.id_sesion('3A', '2026-09-07') $q$,
    '23503', 'RN-09: una sesion con asistencia no puede borrarse');
SELECT t.throws($q$ INSERT INTO justificante (id_sesion, id_alumno, motivo, objeto_documento, registrado_por)
    VALUES (t.id_sesion('3A', '2026-09-16'), t.id_alumno('A001'), 'x', 'justificantes/1/x.pdf', t.id_usuario('alumno1@susan.test')) $q$,
    '23503:fk_justificante_asistencia', 'RN-09: justificante de una sesion sin registro de asistencia');
SELECT t.throws($q$ DELETE FROM asistencia WHERE id_sesion = t.id_sesion('3A', '2026-09-07') AND id_alumno = t.id_alumno('A002') $q$,
    '23503:fk_justificante_asistencia', 'RN-09: no se borra una asistencia con justificante');
SELECT t.throws($q$ DELETE FROM captura WHERE id_captura = (SELECT min(id_captura) FROM captura) $q$,
    '23503:fk_deteccion_captura', 'RN-09: borrar una captura no arrastra sus detecciones');
SELECT t.throws($q$ INSERT INTO plantilla_facial (id_alumno, id_consent, objeto_foto, activa) VALUES (t.id_alumno('A002'), 99999, 'registro/2/x.jpg', false) $q$,
    '23503:fk_plantilla_consent', 'RN-13: la plantilla exige un consentimiento existente');
SELECT t.throws($q$ DELETE FROM usuario WHERE id_usuario = t.id_usuario('docente1@susan.test') $q$,
    '23503', 'una cuenta con bitacora no se borra (baja logica)');

-- ===== Enums ======================================================================================
SELECT t.throws($q$ UPDATE asistencia SET estado = 'otro' WHERE id_asistencia = t.id_asistencia('3A', '2026-09-07', 'A002') $q$,
    '22P02', 'enum: estado de asistencia fuera del dominio');
SELECT t.throws($q$ INSERT INTO usuario (auth_uid, correo, rol) VALUES ('00000000-0000-4000-8000-0000000000a1', 'x1@susan.test', 'root') $q$,
    '22P02', 'enum: rol fuera del dominio');
SELECT t.throws($q$ INSERT INTO camara (id_aula, posicion, tipo, direccion_ip) VALUES (t.id_aula('B-04'), 'fondo', 'usb', '10.9.9.9') $q$,
    '22P02', 'enum: tipo de camara fuera del dominio');
SELECT t.throws($q$ UPDATE sesion_clase SET estatus = 'cancelada' WHERE id_sesion = t.id_sesion('3A', '2026-09-16') $q$,
    '22P02', 'enum: estatus de sesion fuera del dominio');

-- ===== Flujos validos =============================================================================
SELECT t.lives_rb($q$ INSERT INTO sesion_clase (id_grupo, fecha, hora_inicio, hora_fin) VALUES (t.id_grupo('3A'), '2026-10-05', '07:00', '08:00') $q$,
    'sesion nueva toma los DEFAULT de tolerancia, limite e intervalo');
SELECT t.efecto($q$ INSERT INTO sesion_clase (id_grupo, fecha, hora_inicio, hora_fin) VALUES (t.id_grupo('3A'), '2026-10-05', '07:00', '08:00') $q$,
    $q$ SELECT (tolerancia_min, limite_presente_min, intervalo_muestreo_seg, modo_registro, estatus) = (20, 10, 15, 'automatico', 'programada')
          FROM sesion_clase WHERE fecha = '2026-10-05' AND id_grupo = t.id_grupo('3A') $q$,
    'los DEFAULT de la sesion son 20 / 10 / 15 / automatico / programada');
SELECT t.lives_rb($q$ INSERT INTO camara (id_aula, posicion, tipo, direccion_ip) VALUES (t.id_aula('B-04'), 'fondo', 'navegador', NULL) $q$,
    'camara de tipo navegador sin direccion IP');
SELECT t.lives_rb($q$ INSERT INTO camara (id_aula, posicion, tipo, direccion_ip) VALUES (t.id_aula('B-04'), 'fondo', 'ip', '2001:db8::7') $q$,
    'camara IP con direccion IPv6');
SELECT t.lives_rb($q$ INSERT INTO deteccion (id_captura, id_plantilla, score_similitud, es_valida)
    VALUES ((SELECT min(id_captura) FROM captura), NULL, NULL, false) $q$, 'deteccion sin candidato (rostro no reconocido)');
SELECT t.lives_rb($q$ INSERT INTO deteccion (id_captura, id_plantilla, score_similitud, es_valida)
    VALUES ((SELECT min(id_captura) FROM captura), t.id_plantilla('A001'), 0.612, false) $q$, 'deteccion con candidato bajo el umbral (score 0.612, no valida)');
SELECT t.lives_rb($q$ INSERT INTO deteccion (id_captura, id_plantilla, score_similitud, es_valida)
    VALUES ((SELECT min(id_captura) FROM captura), t.id_plantilla('A001'), 1.000, true) $q$, 'deteccion con score en el limite superior 1.000');
SELECT t.efecto($q$ UPDATE indice_faiss SET en_uso = false WHERE version = 'v001'; UPDATE indice_faiss SET en_uso = true WHERE version = 'v002' $q$,
    $q$ SELECT (SELECT count(*) FROM indice_faiss WHERE en_uso) = 1 AND (SELECT en_uso FROM indice_faiss WHERE version = 'v002') $q$,
    'RNF-09: cambio de version del indice en el orden correcto');
SELECT t.efecto($q$ INSERT INTO grupo (id_materia, id_docente, id_aula, clave_grupo, periodo) VALUES (t.id_materia('CON202'), t.id_docente('D001'), t.id_aula('A-12'), '7Z', '2026-2');
                    INSERT INTO horario_grupo (id_grupo, dia_semana, hora_inicio, hora_fin) VALUES (t.id_grupo('7Z'), 2, '10:00', '11:00');
                    DELETE FROM grupo WHERE id_grupo = t.id_grupo('7Z') $q$,
    $q$ SELECT NOT EXISTS (SELECT 1 FROM horario_grupo WHERE hora_inicio = '10:00' AND dia_semana = 2) $q$,
    'borrar un grupo sin sesiones borra en cascada su horario');
SELECT t.lives_rb($q$ SELECT app.bitacora('correccion', 'asistencia', 1, '{"estado":"pendiente"}', '{"estado":"ausente"}', NULL, t.id_usuario('docente1@susan.test')) $q$,
    'bitacora: una correccion con valor anterior y nuevo');
SELECT t.lives_rb($q$ INSERT INTO usuario (auth_uid, correo, rol) VALUES ('00000000-0000-4000-8000-0000000000a1', 'otro.admin@susan.test', 'administrador') $q$,
    'usuario administrador sin docente ni alumno');

SELECT t.summary();
ROLLBACK;
