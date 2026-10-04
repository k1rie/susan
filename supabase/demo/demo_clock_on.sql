-- RELOJ DE DEMOSTRACIÓN (solo para probar la interfaz con la semilla).
-- Congela app.now() en el lunes 14-sep-2026 07:12 (hora del plantel), el escenario que narra la semilla: las sesiones de
-- "hoy" del grupo 3A (07:00) y 5C (09:00) quedan abribles. NO usar en producción: congela el tiempo de TODO el sistema.
-- Ejecútalo en el SQL Editor de Supabase (o con psql como dueño de la base). Efecto inmediato.
-- Usa la tabla app.reloj_demo (migración 0236): en Supabase el rol postgres no puede hacer ALTER DATABASE SET app.*.
INSERT INTO app.reloj_demo (id, fake_now) VALUES (true, '2026-09-14 07:12:00-06')
    ON CONFLICT (id) DO UPDATE SET fake_now = excluded.fake_now;
