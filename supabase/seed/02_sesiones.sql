-- Semilla de demostracion · 02 sesiones: 48 por grupo (3 por semana x 16 semanas), generadas desde
-- horario_grupo. El periodo 2026-2 inicia el lunes 3-ago-2026, de modo que el lunes 14-sep-2026
-- (escenario de la spec) abre la semana 7 y hay 6 semanas de historial (18 sesiones por grupo).
--   * Antes del 14-sep: 'cerrada', salvo las suspendidas.
--   * Desde el 14-sep: 'programada' (la demostracion las abre con el reloj simulado app.fake_now).
--   * 'suspendida' (excluidas del denominador de RN-11): una por grupo en el pasado, mas el 16-sep (Independencia)
--     y el 16-nov (Revolucion) en los grupos que tienen clase esos lunes/miercoles.
--   * El modo sale de las camaras: aula sin camara activa => 'manual' (RN-06).
BEGIN;

INSERT INTO sesion_clase (id_grupo, fecha, hora_inicio, hora_fin, modo_registro, estatus)
SELECT h.id_grupo,
       f.fecha,
       h.hora_inicio,
       h.hora_fin,
       CASE WHEN EXISTS (SELECT 1 FROM camara c WHERE c.id_aula = g.id_aula AND c.estatus = 'activa')
            THEN 'automatico' ELSE 'manual' END::modo_registro_sesion,
       CASE
           WHEN (g.clave_grupo, f.fecha) IN (
                ('3A', DATE '2026-08-19'), ('3B', DATE '2026-09-03'), ('5C', DATE '2026-09-09'),
                ('3A', DATE '2026-09-16'), ('5C', DATE '2026-09-16'), ('3A', DATE '2026-11-16'), ('5C', DATE '2026-11-16'))
               THEN 'suspendida'
           WHEN f.fecha < DATE '2026-09-14' THEN 'cerrada'
           ELSE 'programada'
       END::estatus_sesion
  FROM horario_grupo h
  JOIN grupo g ON g.id_grupo = h.id_grupo AND g.periodo = '2026-2'
 CROSS JOIN LATERAL (
        SELECT (DATE '2026-08-03' + (w * 7) + (h.dia_semana - 1))::date AS fecha
          FROM generate_series(0, 15) AS w) AS f
 ORDER BY h.id_grupo, f.fecha, h.hora_inicio;

COMMIT;
