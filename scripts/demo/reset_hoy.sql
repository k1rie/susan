-- Reinicio del escenario de "hoy" de la demostración (SOLO base local). Lo ejecuta scripts/demo/seed-demo.mjs con
-- --reset o --abierta; también se puede correr a mano:  scripts/db-psql.sh -f scripts/demo/reset_hoy.sql
--
-- Qué deja (todo lo que la prueba a mano pudo ensuciar vuelve al punto de partida del 14-sep-2026):
--   * Las sesiones de hoy y de mañana de la demostración (3A 07:00 = sesión 19, 5C 09:00 = 115, 3B 09:00 de mañana = 67)
--     en 'programada', sin capturas, detecciones, asistencias ni justificantes. Cualquier otra sesión desde hoy que
--     se haya abierto o cerrado probando con el reloj adelantado también se limpia (las suspendidas por la semilla
--     --16-sep y 16-nov-- se respetan).
--   * Las cámaras en su estado de demostración: A-12 frente (navegador) ACTIVA; A-12 fondo (IP 10.20.12.2) en
--     MANTENIMIENTO (esa IP no existe en una máquina de desarrollo: activa, cada ciclo de muestreo esperaría 3 s y mostraría
--     "cámara inalcanzable"; el aula sigue siendo automática por la cámara del navegador, RN-06); B-04 como en la semilla
--     (sin cámaras activas: pase manual). El técnico puede reactivar la IP desde /tecnico para ver ese error.
--     El modo de cada sesión limpiada se recalcula con la regla RN-06.
--   * Los justificantes pendientes de la semilla (los del viernes 11) que alguien aprobó o rechazó vuelven a pendiente
--     y su asistencia a 'ausente'.
--   * El derecho a examen se recalcula con las reglas reales (RN-10, RN-11).
-- NO borra la bitácora (es de solo inserción por diseño): las acciones de las pruebas quedan asentadas.
--
-- Variables (set_config 'demo.*'; sin ellas, los valores de la semilla):
--   demo.hoy   fecha de "hoy" de la demostración (def. 2026-09-14)
BEGIN;

CREATE TEMP TABLE _demo_hoy ON COMMIT DROP AS
SELECT coalesce(nullif(current_setting('demo.hoy', true), ''), '2026-09-14')::date AS hoy;

CREATE TEMP TABLE _demo_sesiones ON COMMIT DROP AS
SELECT s.id_sesion
  FROM sesion_clase s
  JOIN grupo g ON g.id_grupo = s.id_grupo AND g.periodo = '2026-2'
 CROSS JOIN _demo_hoy h
 WHERE s.fecha >= h.hoy
   AND (
        -- las tres sesiones "listas" de la demostración se fuerzan a programada aunque estén suspendidas
        (g.clave_grupo = '3A' AND s.fecha = h.hoy AND s.hora_inicio = TIME '07:00')
     OR (g.clave_grupo = '5C' AND s.fecha = h.hoy AND s.hora_inicio = TIME '09:00')
     OR (g.clave_grupo = '3B' AND s.fecha = h.hoy + 1 AND s.hora_inicio = TIME '09:00')
        -- el resto solo si alguien la tocó
     OR (s.estatus IN ('abierta', 'cerrada'))
     OR EXISTS (SELECT 1 FROM asistencia a WHERE a.id_sesion = s.id_sesion)
     OR EXISTS (SELECT 1 FROM captura c WHERE c.id_sesion = s.id_sesion)
   );

-- 1. Registros que cuelgan de esas sesiones (de las hojas hacia la raíz por las FK).
DELETE FROM justificante WHERE id_sesion IN (SELECT id_sesion FROM _demo_sesiones);
DELETE FROM deteccion
 WHERE id_captura IN (SELECT c.id_captura FROM captura c WHERE c.id_sesion IN (SELECT id_sesion FROM _demo_sesiones));
DELETE FROM captura WHERE id_sesion IN (SELECT id_sesion FROM _demo_sesiones);
DELETE FROM asistencia WHERE id_sesion IN (SELECT id_sesion FROM _demo_sesiones);

-- 2. Cámaras en su estado de demostración (un técnico pudo cambiar su estatus probando la consola).
UPDATE camara c
   SET estatus = x.estatus::estatus_camara
  FROM (VALUES ('A-12', 'frente', 'activa'), ('A-12', 'fondo', 'mantenimiento'),
               ('B-04', 'frente', 'inactiva'), ('B-04', 'fondo', 'mantenimiento')) AS x(aula, posicion, estatus)
  JOIN aula a ON a.clave = x.aula
 WHERE c.id_aula = a.id_aula AND c.posicion = x.posicion::posicion_camara AND c.estatus <> x.estatus::estatus_camara;

-- 3. Estatus y modo de registro de las sesiones limpiadas.
UPDATE sesion_clase s
   SET estatus = 'programada',
       modo_registro = (CASE WHEN EXISTS (SELECT 1 FROM camara c JOIN grupo g ON g.id_aula = c.id_aula
                                           WHERE g.id_grupo = s.id_grupo AND c.estatus = 'activa')
                             THEN 'automatico' ELSE 'manual' END)::modo_registro_sesion
 WHERE s.id_sesion IN (SELECT id_sesion FROM _demo_sesiones);

-- 4. Justificantes pendientes de la semilla (supabase/seed/03_historial.sql: ruta = md5('seed-just-pend-' || id_asistencia)).
-- Aprobar dejó la asistencia 'justificado' (origen correccion) y trg_asistencia_ciclo prohíbe volver atrás, igual que
-- para cualquier otro cambio de estado; aquí se restaura la fila de la semilla, y por eso se apagan los disparadores solo
-- en esta transacción (mismo recurso que usa la propia semilla para cargar el historial).
SET LOCAL session_replication_role = replica;
UPDATE asistencia a
   SET estado = 'ausente',
       hora_registro = NULL,
       conteo_detecciones = 0,
       origen = (CASE WHEN s.modo_registro = 'automatico' THEN 'automatico' ELSE 'manual' END)::origen_asistencia
  FROM justificante j
  JOIN sesion_clase s ON s.id_sesion = j.id_sesion
 WHERE a.id_sesion = j.id_sesion AND a.id_alumno = j.id_alumno
   AND a.estado = 'justificado'
   AND j.objeto_documento = 'justificantes/' || j.id_alumno || '/' || md5('seed-just-pend-' || a.id_asistencia)::uuid || '.pdf';
UPDATE justificante j
   SET estatus = 'pendiente', resuelto_por = NULL, fecha_resolucion = NULL
  FROM asistencia a
 WHERE a.id_sesion = j.id_sesion AND a.id_alumno = j.id_alumno
   AND j.estatus <> 'pendiente'
   AND j.objeto_documento = 'justificantes/' || j.id_alumno || '/' || md5('seed-just-pend-' || a.id_asistencia)::uuid || '.pdf';
SET LOCAL session_replication_role = origin;

-- 5. Derecho a examen con las reglas reales, a nombre de la cuenta de servicio como hace el cierre de sesión.
SELECT app.asumir_cuenta_servicio();
SELECT app.recalcular_grupo(g.id_grupo) FROM grupo g WHERE g.periodo = '2026-2' ORDER BY g.id_grupo;

COMMIT;
