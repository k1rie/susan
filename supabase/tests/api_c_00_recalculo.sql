-- api_c_00 · v_resumen_asistencia y app.recalcular_* (RF-13, RF-14, RN-10, RN-11): limites 48 sesiones.
BEGIN;
SELECT t.begin('api_c_00_recalculo');
SELECT t.cargar_fixtures();

-- 3A pasa a tener 48 sesiones programadas (3 de fixture + 45 cerradas) y una suspendida que NO cuenta.
INSERT INTO public.sesion_clase (id_grupo, fecha, hora_inicio, hora_fin, estatus)
SELECT t.id_grupo('3A'), DATE '2026-06-01' + i, '07:00', '08:00', 'cerrada' FROM generate_series(0, 44) i;
INSERT INTO public.sesion_clase (id_grupo, fecha, hora_inicio, hora_fin, estatus)
VALUES (t.id_grupo('3A'), '2026-12-01', '07:00', '08:00', 'suspendida');

SELECT t.eq((SELECT sesiones_programadas FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A002')), 48,
    'la suspendida no cuenta: 48 sesiones programadas');
SELECT t.eq((SELECT sesiones_programadas FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A004')), 2,
    '5B tiene 2 sesiones programadas (sin mezclar grupos)');

-- A002: 1 ausencia de fixture (07-sep) + 8 ausencias = 9 faltas = 18.75 %
INSERT INTO public.asistencia (id_sesion, id_alumno, estado, origen)
SELECT s.id_sesion, t.id_alumno('A002'), 'ausente', 'manual'
  FROM public.sesion_clase s
 WHERE s.id_grupo = t.id_grupo('3A') AND s.fecha BETWEEN '2026-06-01' AND '2026-06-08';   -- 8 sesiones
SELECT t.eq((SELECT faltas_equivalentes FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A002')), 9, '9 faltas equivalentes');
SELECT t.eq((SELECT porcentaje_faltas FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A002')), 18.75::numeric, '9/48 = 18.75 %');
SELECT t.ok(NOT (SELECT supera_limite FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A002')), '18.75 % no supera el limite');
SELECT t.eq((SELECT faltas_restantes_antes_limite FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A002')), 0, '0 faltas restantes con 9 de 9');
SELECT t.ok((SELECT en_limite FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A002')), 'con 9 faltas esta en el limite');
SELECT t.eq((SELECT faltas_maximas_permitidas FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A002')), 9, 'maximo permitido = 9 de 48');

SELECT app.recalcular_inscripcion((SELECT id_inscripcion FROM inscripcion WHERE id_alumno = t.id_alumno('A002')));
SELECT t.ok((SELECT derecho_examen FROM inscripcion WHERE id_alumno = t.id_alumno('A002')), '9 faltas conservan el derecho');
SELECT t.eq(t.n($q$ SELECT 1 FROM bitacora_auditoria WHERE accion = 'notificacion' AND entidad = 'inscripcion' $q$), 0::bigint,
    'sin cambio de estado no hay notificacion');

-- La decima falta (20.83 %) retira el derecho y notifica UNA vez, aunque se recalcule varias veces.
INSERT INTO public.asistencia (id_sesion, id_alumno, estado, origen)
SELECT s.id_sesion, t.id_alumno('A002'), 'ausente', 'manual'
  FROM public.sesion_clase s WHERE s.id_grupo = t.id_grupo('3A') AND s.fecha = '2026-06-09';
SELECT t.eq((SELECT porcentaje_faltas FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A002')), 20.83::numeric, '10/48 = 20.83 %');
SELECT t.ok((SELECT supera_limite FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A002')), '20.83 % supera el limite');
SELECT t.eq((SELECT faltas_restantes_antes_limite FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A002')), 0, 'restantes = 0 al superar');
SELECT app.recalcular_grupo(t.id_grupo('3A'));
SELECT app.recalcular_grupo(t.id_grupo('3A'));
SELECT t.ok(NOT (SELECT derecho_examen FROM inscripcion WHERE id_alumno = t.id_alumno('A002')), '10 faltas retiran el derecho');
SELECT t.eq(t.n($q$ SELECT 1 FROM bitacora_auditoria WHERE accion = 'notificacion' AND entidad = 'inscripcion'
                      AND valor_nuevo ->> 'evento' = 'pierde_derecho' $q$), 1::bigint, 'una sola notificacion de perdida (idempotente)');

-- Justificar la decima lo devuelve (RF-14): ausente -> justificado con origen correccion.
UPDATE public.asistencia SET estado = 'justificado', origen = 'correccion'
 WHERE id_sesion = t.id_sesion('3A', DATE '2026-06-09') AND id_alumno = t.id_alumno('A002');
SELECT t.eq((SELECT faltas_equivalentes FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A002')), 9, 'justificada no cuenta');
SELECT t.eq((SELECT justificadas FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A002')), 1, 'una justificada');
SELECT app.recalcular_inscripcion((SELECT id_inscripcion FROM inscripcion WHERE id_alumno = t.id_alumno('A002')));
SELECT app.recalcular_inscripcion((SELECT id_inscripcion FROM inscripcion WHERE id_alumno = t.id_alumno('A002')));
SELECT t.ok((SELECT derecho_examen FROM inscripcion WHERE id_alumno = t.id_alumno('A002')), 'justificar la decima devuelve el derecho');
SELECT t.eq(t.n($q$ SELECT 1 FROM bitacora_auditoria WHERE accion = 'notificacion'
                      AND valor_nuevo ->> 'evento' = 'recupera_derecho' $q$), 1::bigint, 'una notificacion de recuperacion');

-- RN-10: 2 ausencias + 7 retardos = 4 faltas equivalentes (A005: ya tiene 1 retardo de fixture).
INSERT INTO public.asistencia (id_sesion, id_alumno, estado, hora_registro, origen)
SELECT s.id_sesion, t.id_alumno('A005'), 'retardo', s.fecha + TIME '07:12', 'manual'
  FROM public.sesion_clase s WHERE s.id_grupo = t.id_grupo('3A') AND s.fecha BETWEEN '2026-06-01' AND '2026-06-06';  -- 6 retardos
INSERT INTO public.asistencia (id_sesion, id_alumno, estado, origen)
SELECT s.id_sesion, t.id_alumno('A005'), 'ausente', 'manual'
  FROM public.sesion_clase s WHERE s.id_grupo = t.id_grupo('3A') AND s.fecha IN ('2026-06-20', '2026-06-21');
SELECT t.eq((SELECT retardos FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A005')), 7, '7 retardos');
SELECT t.eq((SELECT ausencias FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A005')), 2, '2 ausencias');
SELECT t.eq((SELECT faltas_equivalentes FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A005')), 4,
    '2 ausencias + 7 retardos = 4 faltas equivalentes');

-- Pendientes no cuentan (A001 tiene uno el 14-sep) y se separan en su columna.
SELECT t.eq((SELECT pendientes FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A001')), 1, 'un pendiente');
SELECT t.eq((SELECT faltas_equivalentes FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A001')), 0, 'el pendiente no es falta');
SELECT t.eq((SELECT presentes FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A001')), 1, 'un presente');

-- Parametros: con retardos_por_ausencia = 2 los 7 retardos suman 3 + 2 ausencias = 5.
UPDATE public.parametro_sistema SET valor = '2' WHERE clave = 'retardos_por_ausencia';
SELECT t.eq((SELECT faltas_equivalentes FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A005')), 5, 'respeta retardos_por_ausencia');
UPDATE public.parametro_sistema SET valor = '3' WHERE clave = 'retardos_por_ausencia';

-- Limite exacto: 50 sesiones y 10 faltas = 20.00 % conserva el derecho (aritmetica exacta).
INSERT INTO public.sesion_clase (id_grupo, fecha, hora_inicio, hora_fin, estatus)
SELECT t.id_grupo('3A'), DATE '2027-01-10' + i, '07:00', '08:00', 'programada' FROM generate_series(0, 1) i;
INSERT INTO public.asistencia (id_sesion, id_alumno, estado, origen)
SELECT s.id_sesion, t.id_alumno('A006'), 'ausente', 'manual'
  FROM public.sesion_clase s WHERE s.id_grupo = t.id_grupo('3A') AND s.fecha BETWEEN '2026-06-01' AND '2026-06-10';  -- 10 ausencias
SELECT t.eq((SELECT sesiones_programadas FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A006')), 50, '50 sesiones');
SELECT t.eq((SELECT porcentaje_faltas FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A006')), 20.00::numeric, '10/50 = 20.00 %');
SELECT t.ok(NOT (SELECT supera_limite FROM v_resumen_asistencia WHERE id_alumno = t.id_alumno('A006')), 'exactamente 20 % conserva el derecho');

-- Grupo sin sesiones: porcentaje NULL, no supera, recalcular no falla.
INSERT INTO public.grupo (id_materia, id_docente, id_aula, clave_grupo, periodo)
VALUES (t.id_materia('CON202'), t.id_docente('D001'), t.id_aula('A-12'), 'ZZ', '2026-2');
INSERT INTO public.inscripcion (id_alumno, id_grupo) VALUES (t.id_alumno('A001'), (SELECT id_grupo FROM grupo WHERE clave_grupo = 'ZZ'));
SELECT t.eq((SELECT sesiones_programadas FROM v_resumen_asistencia WHERE id_grupo = (SELECT id_grupo FROM grupo WHERE clave_grupo = 'ZZ')), 0, '0 sesiones');
SELECT t.ok((SELECT porcentaje_faltas IS NULL FROM v_resumen_asistencia WHERE id_grupo = (SELECT id_grupo FROM grupo WHERE clave_grupo = 'ZZ')), 'porcentaje NULL sin sesiones');
SELECT t.ok(NOT (SELECT supera_limite OR en_limite FROM v_resumen_asistencia WHERE id_grupo = (SELECT id_grupo FROM grupo WHERE clave_grupo = 'ZZ')), 'sin sesiones no hay limite');
SELECT t.lives($q$ SELECT app.recalcular_grupo((SELECT id_grupo FROM grupo WHERE clave_grupo = 'ZZ')) $q$, 'recalcular grupo sin sesiones');
SELECT t.lives($q$ SELECT app.recalcular_grupo(999999) $q$, 'recalcular grupo inexistente no falla');
SELECT t.throws($q$ SELECT app.recalcular_inscripcion(999999) $q$, 'P0001:NO_ENCONTRADO', 'inscripcion inexistente');

-- Privilegios: authenticated no ejecuta app.recalcular_* (no son API); service_role si; anon no ve la vista.
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT app.recalcular_grupo(1) $q$, '42501', 'docente no ejecuta recalcular_grupo');
SELECT t.ok(t.n($q$ SELECT 1 FROM v_resumen_asistencia $q$) > 0, 'docente ve la vista de sus grupos');
SELECT t.eq(t.n($q$ SELECT 1 FROM v_resumen_asistencia WHERE id_grupo = (SELECT id_grupo FROM grupo WHERE clave_grupo = '5B') $q$), 0::bigint, 'docente no ve acumulados ajenos');
SELECT t.as_user('alumno1@susan.test');
SELECT t.eq(t.n($q$ SELECT 1 FROM v_resumen_asistencia WHERE id_alumno <> app.id_alumno() $q$), 0::bigint, 'alumno solo ve lo propio');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT 1 FROM v_resumen_asistencia $q$, '42501', 'anon no lee la vista');
SELECT t.as_service();
SELECT t.lives($q$ SELECT app.recalcular_grupo(1) $q$, 'service_role ejecuta recalcular_grupo');

SELECT t.summary();
ROLLBACK;
