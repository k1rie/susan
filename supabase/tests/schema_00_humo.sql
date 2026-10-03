-- Humo: el harness, los fixtures y el reloj simulado funcionan.
BEGIN;
SELECT t.begin('schema_00_humo');
SELECT t.cargar_fixtures();

SELECT t.eq(app.now(), '2026-09-14 13:12:00+00'::timestamptz, 'el reloj simulado fija app.now()');
SELECT t.eq(t.n('SELECT 1 FROM public.alumno'), 6, 'seis alumnos de fixture');
SELECT t.eq(t.n('SELECT 1 FROM public.asistencia'), 6, 'seis registros de asistencia de fixture');
SELECT t.summary();
ROLLBACK;
