-- Semilla de demostracion · 99 recalculo de derecho a examen.
-- app.recalcular_grupo(id_grupo) lo define db-api-a (migraciones 01xx). Si todavia no existe (esquema
-- anterior a esa migracion) este paso se omite sin error. Se asume la cuenta de servicio para que las
-- notificaciones 'notificacion' (RN-11) queden asentadas a su nombre.
BEGIN;

DO $$
DECLARE
    v_grupo integer;
    v_n     integer := 0;
BEGIN
    IF to_regprocedure('app.recalcular_grupo(integer)') IS NULL THEN
        RAISE NOTICE 'app.recalcular_grupo no existe todavia: se omite el recalculo';
        RETURN;
    END IF;

    PERFORM app.asumir_cuenta_servicio();
    FOR v_grupo IN SELECT id_grupo FROM grupo WHERE periodo = '2026-2' ORDER BY id_grupo LOOP
        EXECUTE format('SELECT app.recalcular_grupo(%s)', v_grupo);
        v_n := v_n + 1;
    END LOOP;
    RAISE NOTICE 'recalculados % grupos', v_n;
END
$$;

COMMIT;
