-- RELOJ DE DEMOSTRACIÓN (solo para probar la interfaz con la semilla).
-- Congela app.now() en el lunes 14-sep-2026 07:12 (hora del plantel), el escenario que narra la semilla: las sesiones de
-- "hoy" del grupo 3A (07:00) y 5C (09:00) quedan abribles. NO usar en producción: congela el tiempo de TODO el sistema.
-- Ejecútalo en el SQL Editor de Supabase. Aplica a conexiones NUEVAS: si no se nota, espera un par de minutos o reinicia
-- la base desde Project Settings → Database.
ALTER DATABASE postgres SET app.allow_fake_clock = 'on';
ALTER DATABASE postgres SET app.fake_now = '2026-09-14 07:12:00-06';
