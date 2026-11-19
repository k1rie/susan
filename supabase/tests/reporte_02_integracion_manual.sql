-- Reporte de pruebas · IT-01: pase manual de punta a punta en la BD de prueba.
-- Componentes reales: public.api_registrar_manual (rol + bloqueo de la sesion) -> app.registrar_asistencia_manual
-- (RN-01 inscripcion, RN-02 registro unico) -> app.estado_sugerido / app.estado_por_minuto (RN-03)
-- -> tabla public.asistencia con sus restricciones y disparadores.
-- Datos sinteticos de _fixtures.sql: grupo 5B (lun 09:00-10:00, docente2@), sesion manual ABIERTA del 14-sep-2026,
-- A004 inscrito en 5B; A002 NO inscrito en 5B. Todo corre en una transaccion que termina en ROLLBACK.
BEGIN;
SELECT t.begin('reporte_02_integracion_manual');
SELECT t.cargar_fixtures();
SELECT t.reloj('2026-09-14 09:14:00-06');   -- reloj controlado: minuto 14 de la sesion

CREATE TEMP TABLE r (k text PRIMARY KEY, v jsonb);
GRANT ALL ON r TO PUBLIC;

-- Ejecutar como el docente titular; sin estado explicito, con hora de marcado 09:12 (minuto 12).
SELECT t.as_user('docente2@susan.test');
INSERT INTO r SELECT 'resp', public.api_registrar_manual(
    t.id_sesion('5B', DATE '2026-09-14'), t.id_alumno('A004'), NULL, '2026-09-14 09:12:00-06');
SELECT t.as_postgres();

-- Verificar la respuesta de la RPC
SELECT t.eq((SELECT v ->> 'estado' FROM r WHERE k = 'resp'), 'retardo', 'IT-01a: respuesta estado = retardo (minuto 12)');
SELECT t.eq((SELECT v ->> 'origen' FROM r WHERE k = 'resp'), 'manual', 'IT-01b: respuesta origen = manual');
SELECT t.eq((SELECT v ->> 'creado' FROM r WHERE k = 'resp'), 'true', 'IT-01c: respuesta creado = true');

-- Verificar el efecto persistido
SELECT t.eq(t.n($$ SELECT 1 FROM public.asistencia
                   WHERE id_sesion = t.id_sesion('5B', DATE '2026-09-14') AND id_alumno = t.id_alumno('A004')
                     AND estado = 'retardo' AND origen = 'manual'
                     AND hora_registro = '2026-09-14 09:12:00-06'::timestamptz $$), 1,
            'IT-01d: un registro persistido con estado retardo, origen manual y hora 09:12');

-- Alumno sin inscripcion activa en el grupo: se rechaza y no se persiste nada.
-- La sentencia se arma como postgres: el docente2 no ve por RLS al alumno A002 de otro grupo.
INSERT INTO r SELECT 'sql', to_jsonb(format($q$ SELECT public.api_registrar_manual(%s, %s, 'presente', '2026-09-14 09:05:00-06') $q$,
                       t.id_sesion('5B', DATE '2026-09-14'), t.id_alumno('A002')));
SELECT t.as_user('docente2@susan.test');
SELECT t.throws((SELECT v #>> '{}' FROM r WHERE k = 'sql'),
                'P0001:ALUMNO_NO_INSCRITO', 'IT-01e: alumno no inscrito en 5B -> ALUMNO_NO_INSCRITO');
SELECT t.as_postgres();
SELECT t.eq(t.n($$ SELECT 1 FROM public.asistencia
                   WHERE id_sesion = t.id_sesion('5B', DATE '2026-09-14') AND id_alumno = t.id_alumno('A002') $$), 0,
            'IT-01f: no se persistio registro del alumno no inscrito');

SELECT t.summary();
ROLLBACK;
