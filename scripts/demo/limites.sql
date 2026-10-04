-- Deja a E260001 EXACTAMENTE en el límite de faltas del grupo 3A (SOLO base local; idempotente).
--
-- Para qué: que el alumno e260001@ vea el aviso "en el límite" (una falta equivalente más le quita el derecho a examen)
-- y que, al cerrar la sesión de hoy sin que la cámara lo reconozca, se vea el aviso "pierde el derecho a examen".
-- La semilla lo deja con 0 faltas; aquí se convierten en 'ausente' las primeras asistencias presentes de sus clases
-- cerradas (las de la semilla, no las de reposición) hasta igualar faltas_maximas_permitidas (RN-11).
-- No toca a nadie más. El alumno con derecho a examen retirado de la propia semilla es E260014 (12 faltas).
--
-- Variables (set_config 'demo.*'): demo.hoy, fecha de "hoy" de la demostración (def. 2026-09-14).
BEGIN;

SELECT app.asumir_cuenta_servicio();

DO $$
DECLARE
    v_hoy        date := coalesce(nullif(current_setting('demo.hoy', true), ''), '2026-09-14')::date;
    v_grupo      integer;
    v_alumno     integer;
    v_insc       integer;
    v_maximo     integer;
    v_actual     integer;
BEGIN
    SELECT g.id_grupo INTO v_grupo FROM grupo g WHERE g.clave_grupo = '3A' AND g.periodo = '2026-2';
    SELECT a.id_alumno INTO v_alumno FROM alumno a WHERE a.matricula = 'E260001';
    SELECT i.id_inscripcion INTO v_insc FROM inscripcion i WHERE i.id_alumno = v_alumno AND i.id_grupo = v_grupo;
    IF v_insc IS NULL THEN
        RAISE NOTICE 'E260001 no esta inscrito en 3A: se omite el ajuste de limite';
        RETURN;
    END IF;

    SELECT r.faltas_maximas_permitidas, r.faltas_equivalentes INTO v_maximo, v_actual
      FROM v_resumen_asistencia r WHERE r.id_inscripcion = v_insc;

    IF v_actual < v_maximo THEN
        -- Igual que la carga masiva de la semilla: el ciclo de vida prohíbe pasar presente -> ausente con origen
        -- automático, y esto representa historial ya cerrado, no una transición nueva.
        SET LOCAL session_replication_role = replica;
        UPDATE asistencia
           SET estado = 'ausente', hora_registro = NULL, conteo_detecciones = 0
         WHERE id_asistencia IN (
               SELECT a.id_asistencia
                 FROM asistencia a
                 JOIN sesion_clase s ON s.id_sesion = a.id_sesion
                WHERE a.id_alumno = v_alumno AND s.id_grupo = v_grupo AND s.estatus = 'cerrada'
                  AND a.estado = 'presente' AND s.fecha < v_hoy - 2
                ORDER BY s.fecha, s.hora_inicio
                LIMIT v_maximo - v_actual);
        SET LOCAL session_replication_role = origin;
    END IF;

    PERFORM app.recalcular_inscripcion(v_insc);
END
$$;

COMMIT;
