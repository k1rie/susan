-- review_sql_05 · abuso de volumen en RPC administrativas
BEGIN;
SELECT t.begin('review_sql_05_abuso');
SELECT t.cargar_fixtures();
\ir api_c_escenario.inc
SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ SELECT public.api_generar_sesiones(t.c('G3A'), DATE '2026-08-01', DATE '2126-08-01') $q$, 'P0001', 'V1: generar sesiones de 100 anos se rechaza');
SELECT t.throws($q$ SELECT public.api_generar_sesiones(t.c('G3A'), DATE '2026-08-01', DATE '2026-07-01') $q$, 'P0001', 'V2: rango invertido');
SELECT t.throws($q$ SELECT public.api_generar_sesiones(t.c('G3A'), DATE '0001-01-01', DATE '9999-12-31') $q$, 'P0001', 'V3: rango extremo');
SELECT t.lives_rb($q$ SELECT public.api_generar_sesiones(t.c('G3A'), DATE '2026-12-01', DATE '2026-12-31', (SELECT array_agg(d::date) FROM generate_series(DATE '2026-12-01', DATE '2026-12-31', '1 day') d)) $q$, 'V4: omitir todas las fechas');
SELECT t.throws($q$ SELECT public.api_horario_guardar(t.c('G3A'), (SELECT jsonb_agg(jsonb_build_object('dia_semana', 1, 'hora_inicio', '07:00', 'hora_fin', '08:00')) FROM generate_series(1, 5000))) $q$, 'P0001', 'V5: 5000 bloques de horario');
SELECT t.summary();
ROLLBACK;
