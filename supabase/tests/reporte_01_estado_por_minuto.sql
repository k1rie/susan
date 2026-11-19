-- Reporte de pruebas · UT-01 y UT-02: app.estado_por_minuto (RN-03).
-- Funcion pura (IMMUTABLE): no toca tablas, solo se necesita la BD temporal con las migraciones.
-- Esperados tomados de RN-03 con los valores por omision de la sesion (limite_presente_min = 10, tolerancia_min = 20).
BEGIN;
SELECT t.begin('reporte_01_estado_por_minuto');

-- UT-01 · caso normal: dentro de cada tramo de la ventana
SELECT t.eq(app.estado_por_minuto(10, 20, 5.0)::text, 'presente', 'UT-01a: minuto 5 -> presente');
SELECT t.eq(app.estado_por_minuto(10, 20, 15.0)::text, 'retardo', 'UT-01b: minuto 15 -> retardo');

-- UT-02 · casos limite: fronteras exactas y fuera de la ventana
SELECT t.eq(app.estado_por_minuto(10, 20, 9.99)::text, 'presente', 'UT-02a: minuto 9.99 -> presente');
SELECT t.eq(app.estado_por_minuto(10, 20, 10.0)::text, 'retardo', 'UT-02b: minuto 10.00 -> retardo');
SELECT t.eq(app.estado_por_minuto(10, 20, 20.0)::text, 'retardo', 'UT-02c: minuto 20.00 aun es retardo');
SELECT t.ok(app.estado_por_minuto(10, 20, 20.01) IS NULL, 'UT-02d: minuto 20.01 -> NULL (fuera de la ventana)');

SELECT t.summary();
ROLLBACK;
