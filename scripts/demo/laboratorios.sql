-- Escenario de laboratorios de la demostración (extensión 20, docs/DECISIONS.md). SOLO base local; lo ejecuta
-- scripts/demo/seed-demo.mjs en cada corrida y puede correrse a mano:  scripts/db-psql.sh -f scripts/demo/laboratorios.sql
--
-- Qué deja:
--   * Dos laboratorios (aulas tipo laboratorio, edificio C): LAB-1 (30 lugares) y LAB-2 (25). Siempre se aseguran (idempotente).
--   * Un juego de solicitudes que muestra cada caso de la pantalla del administrador (fechas relativas a «hoy»):
--       - dos pendientes de docente1 que COMPITEN por LAB-1 el mismo jueves (3A 10:00-12:00 y 5C 11:00-13:00);
--       - una aprobada de docente2 (3B) en LAB-2 el miércoles 11:00-13:00 y una pendiente de docente1 (3A) que se traslapa con ella
--         (el administrador la ve con «conflicto» y no puede aprobarla);
--       - una rechazada con motivo (5C) y una aprobada ya realizada (3A, viernes pasado) para el historial.
--   * Solo se recrea el juego de solicitudes con demo.reiniciar_lab = '1' (--reset y --abierta) o si la tabla está vacía: una corrida
--     normal NO borra lo que alguien resolvió probando.
-- NO borra la bitácora (es de solo inserción por diseño).
--
-- Variables (set_config 'demo.*'; sin ellas, los valores de la semilla):
--   demo.hoy             fecha de «hoy» de la demostración (def. 2026-09-14)
--   demo.reiniciar_lab   '1' = recrear las solicitudes de demostración
BEGIN;

INSERT INTO aula (clave, edificio, capacidad, tipo)
VALUES ('LAB-1', 'C', 30, 'laboratorio'), ('LAB-2', 'C', 25, 'laboratorio')
ON CONFLICT (clave) DO UPDATE SET tipo = 'laboratorio';

DO $$
DECLARE
    v_hoy       date := coalesce(nullif(current_setting('demo.hoy', true), ''), '2026-09-14')::date;
    v_reiniciar boolean := coalesce(nullif(current_setting('demo.reiniciar_lab', true), ''), '0') = '1';
    v_admin     integer := (SELECT id_usuario FROM usuario WHERE correo = 'admin@susan.local');
    v_lab1      integer := (SELECT id_aula FROM aula WHERE clave = 'LAB-1');
    v_lab2      integer := (SELECT id_aula FROM aula WHERE clave = 'LAB-2');
    v_d1        integer := (SELECT id_docente FROM docente WHERE num_empleado = 'D0001');
    v_d2        integer := (SELECT id_docente FROM docente WHERE num_empleado = 'D0002');
    v_3a        integer := (SELECT id_grupo FROM grupo WHERE clave_grupo = '3A' AND periodo = '2026-2');
    v_3b        integer := (SELECT id_grupo FROM grupo WHERE clave_grupo = '3B' AND periodo = '2026-2');
    v_5c        integer := (SELECT id_grupo FROM grupo WHERE clave_grupo = '5C' AND periodo = '2026-2');
    -- Instante de una hora local del plantel un cierto número de días antes de «hoy».
    v_antes     timestamptz;
BEGIN
    IF v_admin IS NULL OR v_d1 IS NULL OR v_d2 IS NULL OR v_3a IS NULL OR v_3b IS NULL OR v_5c IS NULL THEN
        RAISE NOTICE 'laboratorios.sql: falta la semilla base (admin, docentes o grupos); se omiten las solicitudes de demostración';
        RETURN;
    END IF;
    IF NOT v_reiniciar AND EXISTS (SELECT 1 FROM solicitud_laboratorio) THEN
        RETURN;
    END IF;

    DELETE FROM solicitud_laboratorio;

    -- Pendientes que compiten por LAB-1 el jueves.
    v_antes := ((v_hoy - 1) + TIME '16:30') AT TIME ZONE 'America/Mexico_City';
    INSERT INTO solicitud_laboratorio (id_aula, id_grupo, id_docente, fecha, hora_inicio, hora_fin, actividad, estatus, fecha_solicitud)
    VALUES (v_lab1, v_3a, v_d1, v_hoy + 3, '10:00', '12:00', 'Práctica de balanza de comprobación en hoja de cálculo', 'pendiente', v_antes),
           (v_lab1, v_5c, v_d1, v_hoy + 3, '11:00', '13:00', 'Taller de funciones lineales con software de graficación', 'pendiente', v_antes + interval '20 minutes');

    -- Aprobada de 3B en LAB-2 el miércoles y una pendiente de 3A que se traslapa con ella (conflicto).
    INSERT INTO solicitud_laboratorio (id_aula, id_grupo, id_docente, fecha, hora_inicio, hora_fin, actividad, estatus,
                                       fecha_solicitud, resuelto_por, fecha_resolucion, comentario)
    VALUES (v_lab2, v_3b, v_d2, v_hoy + 2, '11:00', '13:00', 'Práctica de póliza de diario con software contable', 'aprobada',
            ((v_hoy - 2) + TIME '09:10') AT TIME ZONE 'America/Mexico_City', v_admin,
            ((v_hoy - 1) + TIME '12:00') AT TIME ZONE 'America/Mexico_City', 'Autorizado. Pasar por las llaves a Servicios Escolares.');
    INSERT INTO solicitud_laboratorio (id_aula, id_grupo, id_docente, fecha, hora_inicio, hora_fin, actividad, estatus, fecha_solicitud)
    VALUES (v_lab2, v_3a, v_d1, v_hoy + 2, '12:00', '13:30', 'Revisión de estados financieros con datos reales', 'pendiente',
            ((v_hoy - 1) + TIME '17:45') AT TIME ZONE 'America/Mexico_City');

    -- Historial: una rechazada con motivo y una aprobada que ya se realizó.
    INSERT INTO solicitud_laboratorio (id_aula, id_grupo, id_docente, fecha, hora_inicio, hora_fin, actividad, estatus,
                                       fecha_solicitud, resuelto_por, fecha_resolucion, comentario)
    VALUES (v_lab1, v_5c, v_d1, v_hoy + 4, '08:00', '10:00', 'Práctica de estadística descriptiva', 'rechazada',
            ((v_hoy - 3) + TIME '10:00') AT TIME ZONE 'America/Mexico_City', v_admin,
            ((v_hoy - 2) + TIME '08:30') AT TIME ZONE 'America/Mexico_City', 'Mantenimiento de equipos esa semana. Propón otra fecha.'),
           (v_lab1, v_3a, v_d1, v_hoy - 3, '08:00', '10:00', 'Práctica de ajustes contables', 'aprobada',
            ((v_hoy - 9) + TIME '11:00') AT TIME ZONE 'America/Mexico_City', v_admin,
            ((v_hoy - 8) + TIME '09:00') AT TIME ZONE 'America/Mexico_City', NULL);
END
$$;

COMMIT;
