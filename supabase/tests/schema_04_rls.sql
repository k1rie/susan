-- RLS por rol (Tabla 36): que ve y que NO ve cada rol en cada una de las 19 tablas, y que nadie
-- escribe directamente. t.conteos() cuenta las filas visibles con los privilegios y la RLS del rol actual
-- (-1 = permission denied). Fixtures: 3A (docente1, A-12) tiene 4 alumnos activos + 1 en baja; 5B
-- (docente2, B-04) tiene a A004.
BEGIN;
SELECT t.begin('schema_04_rls');
SELECT t.cargar_fixtures();

-- Totales reales (propietario): referencia contra la que se mide lo que cada rol NO ve.
SELECT t.eq(t.conteos(),
    '{"alumno":6,"docente":2,"materia":2,"aula":2,"grupo":2,"horario_grupo":3,"inscripcion":6,"sesion_clase":5,"asistencia":6,
      "justificante":1,"consentimiento":6,"indice_faiss":2,"plantilla_facial":2,"camara":3,"captura":2,"deteccion":3,
      "usuario":9,"bitacora_auditoria":1,"parametro_sistema":12}'::jsonb, 'totales reales de los fixtures');

-- Administrador: todo el catalogo, reportes (asistencia), cuentas, bitacora, parametros; NO justificantes ni capturas/detecciones
SELECT t.as_user('admin@susan.test');
SELECT t.eq(t.conteos(),
    '{"alumno":6,"docente":2,"materia":2,"aula":2,"grupo":2,"horario_grupo":3,"inscripcion":6,"sesion_clase":5,"asistencia":6,
      "justificante":0,"consentimiento":6,"indice_faiss":2,"plantilla_facial":2,"camara":3,"captura":0,"deteccion":0,
      "usuario":9,"bitacora_auditoria":1,"parametro_sistema":12}'::jsonb, 'administrador: ve el catalogo, reportes, cuentas, bitacora y parametros; no justificantes ni detecciones');

-- Docente 1: solo el grupo 3A y lo que cuelga de el
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(t.conteos(),
    '{"alumno":5,"docente":1,"materia":1,"aula":1,"grupo":1,"horario_grupo":2,"inscripcion":5,"sesion_clase":3,"asistencia":5,
      "justificante":1,"consentimiento":0,"indice_faiss":0,"plantilla_facial":1,"camara":2,"captura":2,"deteccion":3,
      "usuario":1,"bitacora_auditoria":0,"parametro_sistema":0}'::jsonb, 'docente1: solo 3A (alumnos inscritos, sesiones, asistencia, justificantes, capturas, detecciones)');
SELECT t.eq(t.n('SELECT 1 FROM alumno WHERE matricula = ''A004'''), 0, 'docente1 no ve al alumno de otro grupo');
SELECT t.eq(t.n('SELECT 1 FROM asistencia WHERE id_sesion = t.id_sesion(''5B'', DATE ''2026-09-07'')'), 0, 'docente1 no ve la asistencia de 5B');
SELECT t.eq(t.n('SELECT 1 FROM grupo WHERE clave_grupo = ''5B'''), 0, 'docente1 no ve el grupo 5B');
SELECT t.eq(t.n('SELECT 1 FROM camara WHERE posicion = ''frente'' AND id_aula = t.id_aula(''B-04'')'), 0, 'docente1 no ve la camara de B-04');
SELECT t.eq(t.n('SELECT 1 FROM plantilla_facial WHERE id_alumno = t.id_alumno(''A004'')'), 0, 'docente1 no ve la plantilla de un alumno ajeno');
SELECT t.eq(t.n('SELECT 1 FROM alumno WHERE matricula = ''A003'''), 1, 'docente1 si ve al alumno con inscripcion en baja de su grupo (historial)');

-- Docente 2: solo 5B
SELECT t.as_user('docente2@susan.test');
SELECT t.eq(t.conteos(),
    '{"alumno":1,"docente":1,"materia":1,"aula":1,"grupo":1,"horario_grupo":1,"inscripcion":1,"sesion_clase":2,"asistencia":1,
      "justificante":0,"consentimiento":0,"indice_faiss":0,"plantilla_facial":1,"camara":1,"captura":0,"deteccion":0,
      "usuario":1,"bitacora_auditoria":0,"parametro_sistema":0}'::jsonb, 'docente2: solo 5B');

-- Alumno 1: lo propio y el contexto de su grupo
SELECT t.as_user('alumno1@susan.test');
SELECT t.eq(t.conteos(),
    '{"alumno":1,"docente":1,"materia":1,"aula":1,"grupo":1,"horario_grupo":2,"inscripcion":1,"sesion_clase":3,"asistencia":2,
      "justificante":0,"consentimiento":0,"indice_faiss":0,"plantilla_facial":0,"camara":0,"captura":0,"deteccion":0,
      "usuario":1,"bitacora_auditoria":0,"parametro_sistema":0}'::jsonb, 'alumno1: su fila, su grupo y su asistencia; nada de companeros, consentimientos ni biometria');
SELECT t.eq(t.n('SELECT 1 FROM alumno WHERE matricula <> ''A001'''), 0, 'alumno1 no ve a sus companeros');
SELECT t.eq(t.n('SELECT 1 FROM asistencia WHERE id_alumno <> t.id_alumno(''A001'')'), 0, 'alumno1 no ve la asistencia de otros');
SELECT t.eq(t.n('SELECT 1 FROM inscripcion WHERE id_alumno <> t.id_alumno(''A001'')'), 0, 'alumno1 no ve las inscripciones de otros');

-- Alumno 2: ve su justificante
SELECT t.as_user('alumno2@susan.test');
SELECT t.eq(t.n('SELECT 1 FROM justificante'), 1, 'alumno2 ve su justificante');
SELECT t.eq(t.n('SELECT 1 FROM asistencia'), 1, 'alumno2 ve su unico registro de asistencia');
SELECT t.as_user('alumno1@susan.test');
SELECT t.eq(t.n('SELECT 1 FROM justificante'), 0, 'alumno1 no ve el justificante de alumno2');

-- Alumno 4 (grupo 5B)
SELECT t.as_user('alumno4@susan.test');
SELECT t.eq(t.conteos(),
    '{"alumno":1,"docente":1,"materia":1,"aula":1,"grupo":1,"horario_grupo":1,"inscripcion":1,"sesion_clase":2,"asistencia":1,
      "justificante":0,"consentimiento":0,"indice_faiss":0,"plantilla_facial":0,"camara":0,"captura":0,"deteccion":0,
      "usuario":1,"bitacora_auditoria":0,"parametro_sistema":0}'::jsonb, 'alumno4: solo su grupo 5B');

-- Cuenta inactiva: sin rol efectivo, solo su propia fila de usuario (para que api_yo informe CUENTA_INACTIVA)
SELECT t.as_user('alumno5@susan.test');
SELECT t.eq(t.conteos(),
    '{"alumno":0,"docente":0,"materia":0,"aula":0,"grupo":0,"horario_grupo":0,"inscripcion":0,"sesion_clase":0,"asistencia":0,
      "justificante":0,"consentimiento":0,"indice_faiss":0,"plantilla_facial":0,"camara":0,"captura":0,"deteccion":0,
      "usuario":1,"bitacora_auditoria":0,"parametro_sistema":0}'::jsonb, 'cuenta inactiva: no ve nada salvo su propia cuenta');

-- Tecnico: aulas, camaras, indice, parametros
SELECT t.as_user('tecnico@susan.test');
SELECT t.eq(t.conteos(),
    '{"alumno":0,"docente":0,"materia":0,"aula":2,"grupo":0,"horario_grupo":0,"inscripcion":0,"sesion_clase":0,"asistencia":0,
      "justificante":0,"consentimiento":0,"indice_faiss":2,"plantilla_facial":0,"camara":3,"captura":0,"deteccion":0,
      "usuario":1,"bitacora_auditoria":0,"parametro_sistema":12}'::jsonb, 'tecnico: solo aulas, camaras, indice facial y parametros');

-- JWT valido sin cuenta en usuario: nada
SELECT t.as_uid_huerfano();
SELECT t.eq(t.conteos(),
    '{"alumno":0,"docente":0,"materia":0,"aula":0,"grupo":0,"horario_grupo":0,"inscripcion":0,"sesion_clase":0,"asistencia":0,
      "justificante":0,"consentimiento":0,"indice_faiss":0,"plantilla_facial":0,"camara":0,"captura":0,"deteccion":0,
      "usuario":0,"bitacora_auditoria":0,"parametro_sistema":0}'::jsonb, 'un uid sin cuenta no ve nada');

-- anon: sin acceso a ninguna tabla
SELECT t.as_anon();
SELECT t.eq(t.conteos(),
    '{"alumno":-1,"docente":-1,"materia":-1,"aula":-1,"grupo":-1,"horario_grupo":-1,"inscripcion":-1,"sesion_clase":-1,"asistencia":-1,
      "justificante":-1,"consentimiento":-1,"indice_faiss":-1,"plantilla_facial":-1,"camara":-1,"captura":-1,"deteccion":-1,
      "usuario":-1,"bitacora_auditoria":-1,"parametro_sistema":-1}'::jsonb, 'anon: permission denied en las 19 tablas');
SELECT t.throws($q$ SELECT * FROM public.alumno $q$, '42501', 'anon no puede leer alumno');
SELECT t.throws($q$ SELECT * FROM public.bitacora_auditoria $q$, '42501', 'anon no puede leer la bitacora');

-- service_role: salta RLS y ve todo (la bitacora solo en lectura)
SELECT t.as_service();
SELECT t.eq(t.conteos(),
    '{"alumno":6,"docente":2,"materia":2,"aula":2,"grupo":2,"horario_grupo":3,"inscripcion":6,"sesion_clase":5,"asistencia":6,
      "justificante":1,"consentimiento":6,"indice_faiss":2,"plantilla_facial":2,"camara":3,"captura":2,"deteccion":3,
      "usuario":9,"bitacora_auditoria":1,"parametro_sistema":12}'::jsonb, 'service_role ve todas las filas');
SELECT t.throws($q$ INSERT INTO bitacora_auditoria (id_usuario, accion, entidad, id_registro) VALUES (1, 'consulta', 'alumno', 1) $q$,
    '42501', 'service_role no inserta en la bitacora directamente (solo via app.bitacora)');
SELECT t.lives_rb($q$ INSERT INTO aula (clave, edificio, capacidad) VALUES ('Z-99', 'Z', 10) $q$, 'service_role si escribe en el catalogo');

-- ===== Nadie escribe directamente (authenticated) ================================================
SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ INSERT INTO aula (clave, edificio, capacidad) VALUES ('Z-99', 'Z', 10) $q$, '42501', 'admin no inserta directamente en aula');
SELECT t.throws($q$ UPDATE parametro_sistema SET valor = '0.500' WHERE clave = 'umbral_similitud' $q$, '42501', 'admin no modifica parametros directamente');
SELECT t.throws($q$ DELETE FROM alumno $q$, '42501', 'admin no borra alumnos directamente');
SELECT t.throws($q$ DELETE FROM bitacora_auditoria $q$, '42501', 'admin no borra la bitacora');
SELECT t.throws($q$ TRUNCATE bitacora_auditoria $q$, '42501', 'admin no hace TRUNCATE de la bitacora');
SELECT t.throws($q$ UPDATE usuario SET rol = 'administrador' $q$, '42501', 'admin no cambia roles directamente');
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ UPDATE asistencia SET estado = 'presente' $q$, '42501', 'docente no corrige asistencia directamente (solo por RPC)');
SELECT t.throws($q$ INSERT INTO asistencia (id_sesion, id_alumno, estado, hora_registro, origen)
    VALUES (t.id_sesion('3A', DATE '2026-09-14'), t.id_alumno('A002'), 'presente', now(), 'manual') $q$, '42501', 'docente no inserta asistencia directamente');
SELECT t.throws($q$ UPDATE justificante SET estatus = 'aprobado' $q$, '42501', 'docente no resuelve justificantes directamente');
SELECT t.throws($q$ DELETE FROM deteccion $q$, '42501', 'docente no borra detecciones');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ UPDATE asistencia SET estado = 'presente' $q$, '42501', 'alumno no se cambia la asistencia');
SELECT t.throws($q$ INSERT INTO justificante (id_sesion, id_alumno, motivo, objeto_documento, registrado_por)
    VALUES (t.id_sesion('3A', DATE '2026-09-07'), t.id_alumno('A001'), 'x', 'justificantes/1/x.pdf', 1) $q$, '42501', 'alumno no inserta justificantes directamente');
SELECT t.as_user('tecnico@susan.test');
SELECT t.throws($q$ UPDATE parametro_sistema SET valor = '0.500' WHERE clave = 'umbral_similitud' $q$, '42501', 'tecnico no modifica parametros directamente (usa api_parametro_actualizar)');
SELECT t.throws($q$ UPDATE camara SET estatus = 'inactiva' $q$, '42501', 'tecnico no cambia camaras directamente');
SELECT t.as_anon();
SELECT t.throws($q$ INSERT INTO aula (clave, edificio, capacidad) VALUES ('Z-99', 'Z', 10) $q$, '42501', 'anon no inserta');

-- ===== Funciones: lo que authenticated y anon pueden ejecutar =====================================
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT app.bitacora('consulta', 'alumno', 1, NULL, NULL) $q$, '42501', 'authenticated no ejecuta app.bitacora');
SELECT t.throws($q$ SELECT app.asumir_cuenta_servicio() $q$, '42501', 'authenticated no ejecuta app.asumir_cuenta_servicio');
SELECT t.throws($q$ SELECT app.validar_parametro('umbral_similitud', '0.9') $q$, '42501', 'authenticated no ejecuta app.validar_parametro');
SELECT t.throws($q$ SELECT app.trg_asistencia_ciclo() $q$, '42501', 'authenticated no ejecuta funciones de trigger');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT app.now() $q$, '42501', 'anon no ejecuta app.now (ni ve el esquema app)');
SELECT t.throws($q$ SELECT public.api_yo() $q$, '42501', 'anon no ejecuta api_yo');

SELECT t.summary();
ROLLBACK;
