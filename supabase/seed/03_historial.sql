-- Semilla de demostracion · 03 historial de asistencia de las sesiones cerradas (antes del 14-sep-2026).
-- Cada alumno sigue un PATRON segun su ordinal k dentro del grupo (orden de matricula), para que el analisis
-- numerico (web/src/lib/numerics, /analitica) tenga senal. n = numero de la sesion cerrada del grupo (1..18).
--
--   k 1-12  asistencia estable (~4 % ausente, ~6 % retardo)        k 13  asistencia perfecta
--   k 14    deterioro progresivo fuerte (aus. 8 % -> 95 %)          k 15  deterioro progresivo moderado
--   k 16    ausencias recurrentes en LUNES (85 %)                   k 17  ausencias recurrentes en VIERNES (85 %)
--   k 18    abandono repentino tras la sesion 9                     k 19  abandono tardio tras la sesion 14
--   k 20    ausentismo cronico (50 %)                               k 21  ausentismo cronico (40 %) con retardos
--   k 22-23 muchos retardos (50 % / 35 %)                           k 24  4 faltas justificadas (sesiones 3, 7, 11, 15)
--   k 25    inscripcion en baja: historial solo hasta la sesion 8
--
-- El azar es un hash determinista de (alumno, sesion): la semilla es reproducible byte a byte.
-- Origen: 'manual' en sesiones de pase manual y para el alumno sin consentimiento vigente (RF-09, RNF-06);
-- 'correccion' en las faltas justificadas; 'automatico' en el resto.
BEGIN;

-- CARGA MASIVA DE HISTORIAL (unico uso de session_replication_role = replica en la semilla): estos registros
-- representan clases ya cerradas, que en operacion real habrian nacido pendientes y pasado por
-- trg_asistencia_ciclo / trg_asistencia_rn01 (RN-01 ademas rechazaria a los alumnos dados de baja despues).
-- Los CHECK y UNIQUE siguen vigentes en este modo; las FK se cumplen por construccion (todo sale de joins).
SET LOCAL session_replication_role = replica;

INSERT INTO asistencia (id_sesion, id_alumno, estado, hora_registro, origen, conteo_detecciones)
WITH sesiones AS (
    SELECT s.id_sesion, s.id_grupo, s.fecha, s.hora_inicio, s.modo_registro,
           extract(isodow FROM s.fecha)::int AS dia,
           row_number() OVER (PARTITION BY s.id_grupo ORDER BY s.fecha, s.hora_inicio) AS n
      FROM sesion_clase s
     WHERE s.estatus = 'cerrada'
),
alumnos AS (
    SELECT i.id_alumno, i.id_grupo, i.estatus AS estatus_insc,
           row_number() OVER (PARTITION BY i.id_grupo ORDER BY i.id_alumno) AS k,
           (c.estatus <> 'vigente') AS sin_consent
      FROM inscripcion i
      JOIN consentimiento c ON c.id_alumno = i.id_alumno
),
base AS (
    SELECT s.id_sesion, s.fecha, s.hora_inicio, s.modo_registro, s.dia, s.n,
           a.id_alumno, a.k, a.sin_consent,
           (hashtext(a.id_alumno || ':' || s.n || ':1')::bigint & 2147483647) % 1000 AS r1,
           (hashtext(a.id_alumno || ':' || s.n || ':2')::bigint & 2147483647) % 1000 AS r2,
           (hashtext(a.id_alumno || ':' || s.n || ':3')::bigint & 2147483647) % 1000 AS r3
      FROM sesiones s
      JOIN alumnos a ON a.id_grupo = s.id_grupo
     WHERE a.estatus_insc = 'activa' OR s.n <= 8
),
probabilidades AS (
    -- por mil: p_aus = ausente, p_ret = retardo
    SELECT b.*,
           CASE
               WHEN k = 13 THEN 0
               WHEN k = 14 THEN LEAST(950, 30 + 55 * n)
               WHEN k = 15 THEN LEAST(950, 20 + 30 * n)
               WHEN k = 16 THEN CASE WHEN dia = 1 THEN 850 ELSE 40 END
               WHEN k = 17 THEN CASE WHEN dia = 5 THEN 850 ELSE 40 END
               WHEN k = 18 THEN CASE WHEN n > 9 THEN 1000 ELSE 40 END
               WHEN k = 19 THEN CASE WHEN n > 14 THEN 1000 ELSE 40 END
               WHEN k = 20 THEN 500
               WHEN k = 21 THEN 400
               WHEN k IN (22, 23) THEN 50
               ELSE 40
           END AS p_aus,
           CASE
               WHEN k = 13 THEN 0
               WHEN k = 20 THEN 80
               WHEN k = 21 THEN 150
               WHEN k = 22 THEN 500
               WHEN k = 23 THEN 350
               ELSE 60
           END AS p_ret
      FROM base b
),
decidido AS (
    SELECT p.*,
           CASE
               WHEN k = 24 AND n IN (3, 7, 11, 15) THEN 'justificado'
               WHEN r1 < p_aus THEN 'ausente'
               WHEN r1 < p_aus + p_ret THEN 'retardo'
               ELSE 'presente'
           END AS estado
      FROM probabilidades p
),
con_origen AS (
    SELECT d.*,
           CASE
               WHEN estado = 'justificado' THEN 'correccion'
               WHEN modo_registro = 'manual' OR sin_consent THEN 'manual'
               ELSE 'automatico'
           END AS origen
      FROM decidido d
)
SELECT id_sesion,
       id_alumno,
       estado::estado_asistencia,
       -- presente: primeros 10 min (0:00 a 8:59); retardo: del minuto 10 al 19:59 (RN-03)
       CASE estado
           WHEN 'presente' THEN app.instante_clase(fecha, hora_inicio) + make_interval(secs => r2 % 540)
           WHEN 'retardo' THEN app.instante_clase(fecha, hora_inicio) + make_interval(secs => 600 + r2 % 600)
       END,
       origen::origen_asistencia,
       CASE
           WHEN origen <> 'automatico' THEN 0
           WHEN estado = 'presente' THEN 3 + r3 % 18
           WHEN estado = 'retardo' THEN 3 + r3 % 12
           ELSE 0
       END
  FROM con_origen
 ORDER BY id_sesion, id_alumno;

-- Fin de la carga masiva: de aqui en adelante rigen todos los disparadores y FK.
SET LOCAL session_replication_role = origin;

-- Justificantes. Las faltas justificadas (k 24) traen su justificante aprobado, firmado por el docente del grupo;
-- lo registra el propio alumno si tiene cuenta y, si no, el docente. Ademas, un rechazado (primera falta del k 21) y
-- un pendiente (ultima falta del k 20) para que la cola de revision no este vacia. Documentos: rutas ficticias.
INSERT INTO justificante (id_sesion, id_alumno, motivo, objeto_documento, estatus, registrado_por, resuelto_por, fecha_registro, fecha_resolucion)
SELECT a.id_sesion, a.id_alumno,
       (ARRAY['Cita médica','Enfermedad con receta','Trámite oficial','Duelo familiar'])[(a.id_asistencia % 4) + 1],
       'justificantes/' || a.id_alumno || '/' || md5('seed-just-' || a.id_asistencia)::uuid || '.pdf',
       'aprobado',
       COALESCE(ua.id_usuario, ud.id_usuario), ud.id_usuario,
       app.instante_clase(s.fecha, s.hora_fin) + interval '1 day 2 hours',
       app.instante_clase(s.fecha, s.hora_fin) + interval '1 day 20 hours'
  FROM asistencia a
  JOIN sesion_clase s ON s.id_sesion = a.id_sesion
  JOIN grupo g ON g.id_grupo = s.id_grupo
  JOIN usuario ud ON ud.id_docente = g.id_docente
  LEFT JOIN usuario ua ON ua.id_alumno = a.id_alumno
 WHERE a.estado = 'justificado'
 ORDER BY a.id_asistencia;

INSERT INTO justificante (id_sesion, id_alumno, motivo, objeto_documento, estatus, registrado_por, resuelto_por, fecha_registro, fecha_resolucion)
SELECT x.id_sesion, x.id_alumno, 'Problemas de transporte',
       'justificantes/' || x.id_alumno || '/' || md5('seed-just-rech-' || x.id_asistencia)::uuid || '.pdf',
       'rechazado', COALESCE(ua.id_usuario, ud.id_usuario), ud.id_usuario,
       app.instante_clase(x.fecha, x.hora_fin) + interval '1 day',
       app.instante_clase(x.fecha, x.hora_fin) + interval '2 days'
  FROM (
        SELECT DISTINCT ON (a.id_alumno) a.id_asistencia, a.id_sesion, a.id_alumno, s.fecha, s.hora_fin, s.id_grupo
          FROM asistencia a
          JOIN sesion_clase s ON s.id_sesion = a.id_sesion
          JOIN inscripcion i ON i.id_alumno = a.id_alumno AND i.id_grupo = s.id_grupo
         WHERE a.estado = 'ausente'
           AND (SELECT count(*) FROM inscripcion i2 WHERE i2.id_grupo = i.id_grupo AND i2.id_alumno <= a.id_alumno) % 25 = 21
         ORDER BY a.id_alumno, s.fecha
       ) x
  JOIN grupo g ON g.id_grupo = x.id_grupo
  JOIN usuario ud ON ud.id_docente = g.id_docente
  LEFT JOIN usuario ua ON ua.id_alumno = x.id_alumno;

INSERT INTO justificante (id_sesion, id_alumno, motivo, objeto_documento, estatus, registrado_por, fecha_registro)
SELECT x.id_sesion, x.id_alumno, 'Enfermedad con receta',
       'justificantes/' || x.id_alumno || '/' || md5('seed-just-pend-' || x.id_asistencia)::uuid || '.pdf',
       'pendiente', COALESCE(ua.id_usuario, ud.id_usuario),
       app.instante_clase(x.fecha, x.hora_fin) + interval '5 hours'
  FROM (
        SELECT DISTINCT ON (a.id_alumno) a.id_asistencia, a.id_sesion, a.id_alumno, s.fecha, s.hora_fin, s.id_grupo
          FROM asistencia a
          JOIN sesion_clase s ON s.id_sesion = a.id_sesion
          JOIN inscripcion i ON i.id_alumno = a.id_alumno AND i.id_grupo = s.id_grupo
         WHERE a.estado = 'ausente'
           AND (SELECT count(*) FROM inscripcion i2 WHERE i2.id_grupo = i.id_grupo AND i2.id_alumno <= a.id_alumno) % 25 = 20
         ORDER BY a.id_alumno, s.fecha DESC
       ) x
  JOIN grupo g ON g.id_grupo = x.id_grupo
  JOIN usuario ud ON ud.id_docente = g.id_docente
  LEFT JOIN usuario ua ON ua.id_alumno = x.id_alumno;

-- Bitacora historica (la fecha_hora se fija a la del hecho; se inserta directo porque app.bitacora usa el reloj
-- actual). Cierre de cada sesion cerrada, por la cuenta de servicio (RN-07), y aprobacion/rechazo de justificantes.
INSERT INTO bitacora_auditoria (id_usuario, accion, entidad, id_registro, valor_anterior, valor_nuevo, fecha_hora)
SELECT app.id_cuenta_servicio(), 'cierre_sesion', 'sesion_clase', s.id_sesion,
       jsonb_build_object('estatus', 'abierta'),
       jsonb_build_object('estatus', 'cerrada',
                          'ausentes', (SELECT count(*) FROM asistencia a WHERE a.id_sesion = s.id_sesion AND a.estado = 'ausente')),
       app.instante_clase(s.fecha, s.hora_fin)
  FROM sesion_clase s
 WHERE s.estatus = 'cerrada'
 ORDER BY s.fecha, s.id_sesion;

INSERT INTO bitacora_auditoria (id_usuario, accion, entidad, id_registro, valor_anterior, valor_nuevo, fecha_hora)
SELECT j.resuelto_por,
       CASE j.estatus WHEN 'aprobado' THEN 'aprobacion_justificante' ELSE 'rechazo_justificante' END::accion_bitacora,
       'justificante', j.id_justificante,
       jsonb_build_object('estatus', 'pendiente'),
       jsonb_build_object('estatus', j.estatus),
       j.fecha_resolucion
  FROM justificante j
 WHERE j.estatus IN ('aprobado', 'rechazado')
 ORDER BY j.fecha_resolucion, j.id_justificante;

COMMIT;
