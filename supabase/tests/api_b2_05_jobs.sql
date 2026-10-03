-- api_b2_05 · jobs del programador de tareas (biometria.md 3.18 a 3.22): cierre, pendientes vencidos, purga de recortes,
-- diagnostico del indice y recalculo. Todos idempotentes, solo service_role.
BEGIN;
SELECT t.begin('api_b2_05_jobs');
SELECT t.cargar_fixtures();

-- ===================== svc_job_cerrar_sesiones =====================
SELECT t.as_service();
SELECT t.eq((public.svc_job_cerrar_sesiones() ->> 'candidatas')::int, 0, 'cerrar: 07:12, ninguna sesion ha terminado');
SELECT t.reloj('2026-09-14 07:59:59-06');
SELECT t.eq((public.svc_job_cerrar_sesiones() ->> 'candidatas')::int, 0, 'cerrar: 07:59:59 (1 s antes de hora_fin) no califica');
SELECT t.reloj('2026-09-14 08:00:00-06');
SELECT t.eq((public.svc_job_cerrar_sesiones() ->> 'cerradas')::int, 1, 'cerrar: 08:00:00 exacto califica (hora_fin <= ahora): cierra 3A');
SELECT t.eq((SELECT estatus::text FROM public.sesion_clase WHERE id_sesion = t.id_sesion('3A', '2026-09-14')), 'cerrada', 'cerrar: 3A cerrada');
SELECT t.eq((SELECT estatus::text FROM public.sesion_clase WHERE id_sesion = t.id_sesion('5B', '2026-09-14')), 'abierta', 'cerrar: 5B aun abierta (termina a las 10:00)');
SELECT t.eq((SELECT count(*)::int FROM public.asistencia WHERE id_sesion = t.id_sesion('3A', '2026-09-14') AND estado = 'ausente'), 3,
    'cerrar: ausente a los 3 inscritos activos sin registro (el de baja no)');
SELECT t.eq((SELECT count(*)::int FROM public.bitacora_auditoria WHERE accion = 'cierre_sesion' AND id_usuario = app.id_usuario_servicio()
              AND id_registro = t.id_sesion('3A', '2026-09-14')), 1, 'cerrar: cierre_sesion a nombre de la cuenta de servicio');
SELECT t.eq((public.svc_job_cerrar_sesiones() ->> 'candidatas')::int, 0, 'cerrar: idempotente (segunda corrida sin candidatas)');
SELECT t.eq((SELECT count(*)::int FROM public.asistencia WHERE id_sesion = t.id_sesion('3A', '2026-09-14') AND estado = 'ausente'), 3, 'cerrar: la segunda corrida no duplica ausentes');
-- limite de lote y orden (fecha, hora_fin): hace falta mas de una pasada
SELECT t.as_postgres();
UPDATE public.sesion_clase SET estatus = 'abierta' WHERE id_sesion = t.id_sesion('3A', '2026-09-16');
SELECT t.as_service();
SELECT t.reloj('2026-09-16 10:00:00-06');
SELECT t.eq((public.svc_job_cerrar_sesiones(1) ->> 'cerradas')::int, 1, 'cerrar: p_limit 1 cierra una');
SELECT t.eq((SELECT estatus::text FROM public.sesion_clase WHERE id_sesion = t.id_sesion('5B', '2026-09-14')), 'cerrada', 'cerrar: primero la mas antigua (5B 14-sep)');
SELECT t.eq((public.svc_job_cerrar_sesiones(1) ->> 'cerradas')::int, 1, 'cerrar: segunda pasada cierra la siguiente');
SELECT t.eq((public.svc_job_cerrar_sesiones(1) ->> 'cerradas')::int, 0, 'cerrar: tercera pasada sin trabajo');
-- una programada que nunca se abrio no se toca
SELECT t.as_postgres();
INSERT INTO public.sesion_clase (id_grupo, fecha, hora_inicio, hora_fin, modo_registro, estatus)
VALUES (t.id_grupo('3A'), '2026-09-09', '07:00', '08:00', 'automatico', 'programada');
SELECT t.as_service();
SELECT t.eq((public.svc_job_cerrar_sesiones() ->> 'candidatas')::int, 0, 'cerrar: programada pasada no es candidata');
SELECT t.eq((SELECT estatus::text FROM public.sesion_clase WHERE id_grupo = t.id_grupo('3A') AND fecha = '2026-09-09'), 'programada', 'cerrar: la programada sigue programada');
-- argumentos
SELECT t.throws($q$ SELECT public.svc_job_cerrar_sesiones(0) $q$, 'P0001:VALIDACION', 'cerrar: p_limit 0');
SELECT t.throws($q$ SELECT public.svc_job_cerrar_sesiones(1001) $q$, 'P0001:VALIDACION', 'cerrar: p_limit 1001');
SELECT t.throws($q$ SELECT public.svc_job_cerrar_sesiones(NULL) $q$, 'P0001:VALIDACION', 'cerrar: p_limit nulo');

-- ===================== svc_job_resolver_pendientes =====================
-- A001 quedo 'pendiente' en 3A 14-sep (1 lectura < 3). hora_fin = 08:00 -> limite 16-sep 08:00.
SELECT t.eq((SELECT estado::text FROM public.asistencia WHERE id_asistencia = t.id_asistencia('3A', '2026-09-14', 'A001')), 'pendiente', 'resolver: A001 pendiente tras el cierre');
SELECT t.reloj('2026-09-16 07:59:59-06');
SELECT t.eq((public.svc_job_resolver_pendientes() ->> 'resueltas')::int, 0, 'resolver: 47:59:59 despues de hora_fin, no vence');
SELECT t.reloj('2026-09-16 08:00:00-06');
SELECT t.eq((public.svc_job_resolver_pendientes() ->> 'resueltas')::int, 0, 'resolver: 48:00:00 exactas, el docente aun puede corregir (estricto)');
SELECT t.reloj('2026-09-16 08:00:01-06');
SELECT t.eq((public.svc_job_resolver_pendientes() ->> 'resueltas')::int, 1, 'resolver: 48:00:01 se resuelve');
SELECT t.eq((SELECT estado::text || '/' || origen::text FROM public.asistencia WHERE id_asistencia = t.id_asistencia('3A', '2026-09-14', 'A001')), 'ausente/correccion', 'resolver: ausente con origen correccion');
SELECT t.ok((SELECT hora_registro IS NULL FROM public.asistencia WHERE id_asistencia = t.id_asistencia('3A', '2026-09-14', 'A001')), 'resolver: hora_registro nula');
SELECT t.eq((SELECT conteo_detecciones::int FROM public.asistencia WHERE id_asistencia = t.id_asistencia('3A', '2026-09-14', 'A001')), 1, 'resolver: conserva el conteo de detecciones');
SELECT t.eq((SELECT count(*)::int FROM public.deteccion), 3, 'resolver: no toca las detecciones');
SELECT t.eq((SELECT count(*)::int FROM public.bitacora_auditoria WHERE accion = 'correccion' AND entidad = 'asistencia'
              AND id_registro = t.id_asistencia('3A', '2026-09-14', 'A001') AND id_usuario = app.id_usuario_servicio()
              AND valor_anterior ->> 'estado' = 'pendiente' AND valor_nuevo ->> 'estado' = 'ausente'), 1, 'resolver: correccion con anterior y nuevo a nombre del servicio');
SELECT t.eq((public.svc_job_resolver_pendientes() ->> 'candidatas')::int, 0, 'resolver: idempotente');
SELECT t.eq((public.svc_job_resolver_pendientes() -> 'errores')::text, '[]', 'resolver: sin errores');
-- el resultado reporta inscripciones recalculadas
SELECT t.as_postgres();
INSERT INTO public.sesion_clase (id_grupo, fecha, hora_inicio, hora_fin, modo_registro, estatus) VALUES (t.id_grupo('3A'), '2026-09-10', '07:00', '08:00', 'automatico', 'cerrada');
INSERT INTO public.asistencia (id_sesion, id_alumno, estado, hora_registro, origen, conteo_detecciones)
VALUES (t.id_sesion('3A', '2026-09-10'), t.id_alumno('A002'), 'pendiente', '2026-09-10 07:03:00-06', 'automatico', 2);
SELECT t.as_service();
SELECT t.eq((public.svc_job_resolver_pendientes() ->> 'inscripciones_recalculadas')::int, 1, 'resolver: reporta inscripciones recalculadas');
-- pendientes de una sesion aun abierta jamas se resuelven; y el plazo es el parametro
SELECT t.as_postgres();
INSERT INTO public.asistencia (id_sesion, id_alumno, estado, hora_registro, origen, conteo_detecciones)
VALUES (t.id_sesion('3A', '2026-09-09'), t.id_alumno('A002'), 'pendiente', '2026-09-09 07:03:00-06', 'automatico', 1);
SELECT t.as_service();
SELECT t.eq((public.svc_job_resolver_pendientes() ->> 'candidatas')::int, 0, 'resolver: sesion no cerrada (programada) no se resuelve');
SELECT t.as_postgres();
UPDATE public.sesion_clase SET estatus = 'cerrada' WHERE id_grupo = t.id_grupo('3A') AND fecha = '2026-09-09';
UPDATE public.parametro_sistema SET valor = '720' WHERE clave = 'horas_limite_correccion';
SELECT t.as_service();
SELECT t.eq((public.svc_job_resolver_pendientes() ->> 'candidatas')::int, 0, 'resolver: con plazo de 720 h no vence');
SELECT t.as_postgres();
UPDATE public.parametro_sistema SET valor = '48' WHERE clave = 'horas_limite_correccion';
SELECT t.as_service();
SELECT t.eq((public.svc_job_resolver_pendientes(1) ->> 'resueltas')::int, 1, 'resolver: p_limit 1 resuelve una por pasada');
SELECT t.eq((public.svc_job_resolver_pendientes() ->> 'resueltas')::int, 0, 'resolver: nada mas pendiente');
SELECT t.throws($q$ SELECT public.svc_job_resolver_pendientes(0) $q$, 'P0001:VALIDACION', 'resolver: p_limit 0');
SELECT t.throws($q$ SELECT public.svc_job_resolver_pendientes(5001) $q$, 'P0001:VALIDACION', 'resolver: p_limit 5001');

-- ===================== Purga de recortes =====================
-- capturas: 14-sep 07:05:00 (2 detecciones) y 07:05:15 (1 deteccion); retencion 7 dias.
SELECT t.reloj('2026-09-21 07:05:00-06');
SELECT t.eq((public.svc_job_purgar_recortes_listar() ->> 'pendientes_total')::int, 0, 'purga: a exactamente 7 dias aun se conserva');
SELECT t.eq((public.svc_job_purgar_recortes_listar() ->> 'dias_retencion')::int, 7, 'purga: dias_retencion');
SELECT t.ok((public.svc_job_purgar_recortes_listar() ->> 'corte')::timestamptz = '2026-09-14 07:05:00-06'::timestamptz, 'purga: corte = ahora - 7 dias');
SELECT t.reloj('2026-09-21 07:05:01-06');
SELECT t.eq((public.svc_job_purgar_recortes_listar() ->> 'pendientes_total')::int, 2, 'purga: 1 s despues vencen las 2 detecciones de la primera captura');
SELECT t.eq(jsonb_array_length(public.svc_job_purgar_recortes_listar() -> 'items'), 2, 'purga: items');
SELECT t.eq(jsonb_array_length(public.svc_job_purgar_recortes_listar(1) -> 'items'), 1, 'purga: p_limit 1');
SELECT t.eq((public.svc_job_purgar_recortes_listar(1) ->> 'pendientes_total')::int, 2, 'purga: pendientes_total no depende del limite');
SELECT t.ok((public.svc_job_purgar_recortes_listar() -> 'items' -> 0 ->> 'objeto_recorte') LIKE 'recortes/%', 'purga: devuelve la ruta del objeto');
SELECT t.as_postgres();
SELECT set_config('t.ids', (SELECT array_agg(d.id_deteccion ORDER BY d.id_deteccion)::text FROM public.deteccion d), true);
SELECT set_config('t.nuevo', (SELECT d.id_deteccion::text FROM public.deteccion d JOIN public.captura c USING (id_captura) ORDER BY c.marca_tiempo DESC, d.id_deteccion DESC LIMIT 1), true);
SELECT t.as_service();
-- marcar: solo las vencidas; la mas reciente (07:05:15) se vuelve a comprobar y NO se anula
SELECT t.eq((public.svc_job_purgar_recortes_marcar(current_setting('t.ids')::bigint[]) ->> 'marcadas')::int, 2, 'purga: marca solo las 2 vencidas aunque se pidan 3');
SELECT t.eq((public.svc_job_purgar_recortes_marcar(current_setting('t.ids')::bigint[]) ->> 'solicitadas')::int, 3, 'purga: solicitadas = 3');
SELECT t.eq((public.svc_job_purgar_recortes_marcar(current_setting('t.ids')::bigint[]) ->> 'marcadas')::int, 0, 'purga: idempotente (ya no quedan)');
SELECT t.eq((SELECT count(*)::int FROM public.deteccion), 3, 'purga: conserva las 3 filas de DETECCION');
SELECT t.eq((SELECT count(*)::int FROM public.deteccion WHERE objeto_recorte IS NULL), 2, 'purga: 2 con recorte NULL');
SELECT t.ok((SELECT objeto_recorte IS NOT NULL FROM public.deteccion WHERE id_deteccion = current_setting('t.nuevo')::bigint), 'purga: la deteccion reciente conserva su recorte');
SELECT t.eq((SELECT count(*)::int FROM public.deteccion WHERE id_plantilla IS NOT NULL AND score_similitud IS NOT NULL), 2,
    'purga: id_plantilla y score_similitud intactos');
SELECT t.eq((SELECT es_valida::text FROM public.deteccion WHERE score_similitud = 0.912), 'true', 'purga: es_valida intacto');
SELECT t.eq((public.svc_job_purgar_recortes_listar() ->> 'pendientes_total')::int, 0, 'purga: nada pendiente tras marcar');
SELECT t.reloj('2026-09-21 07:05:16-06');
SELECT t.eq((public.svc_job_purgar_recortes_listar() ->> 'pendientes_total')::int, 1, 'purga: a las 07:05:16 vence la tercera');
SELECT t.eq((public.svc_job_purgar_recortes_marcar(ARRAY[999999]::bigint[]) ->> 'marcadas')::int, 0, 'purga: ids inexistentes no marcan');
SELECT t.eq((public.svc_job_purgar_recortes_marcar(ARRAY[]::bigint[]) ->> 'solicitadas')::int, 0, 'purga: arreglo vacio');
SELECT t.throws($q$ SELECT public.svc_job_purgar_recortes_marcar(NULL) $q$, 'P0001:VALIDACION', 'purga: ids nulo');
SELECT t.throws($q$ SELECT public.svc_job_purgar_recortes_marcar(ARRAY(SELECT generate_series(1, 5001))::bigint[]) $q$, 'P0001:VALIDACION', 'purga: mas de 5000 ids');
SELECT t.lives($q$ SELECT public.svc_job_purgar_recortes_marcar(ARRAY(SELECT generate_series(100000, 104999))::bigint[]) $q$, 'purga: 5000 ids es el maximo');
SELECT t.eq((public.svc_job_purgar_recortes_marcar(current_setting('t.ids')::bigint[]) ->> 'marcadas')::int, 1, 'purga: ahora si marca la tercera');
-- el plazo es el parametro
SELECT t.as_postgres();
UPDATE public.parametro_sistema SET valor = '30' WHERE clave = 'dias_retencion_recortes';
UPDATE public.deteccion SET objeto_recorte = 'recortes/1/1/1.jpg' WHERE id_deteccion = current_setting('t.nuevo')::bigint;
SELECT t.as_service();
SELECT t.eq((public.svc_job_purgar_recortes_listar() ->> 'pendientes_total')::int, 0, 'purga: con 30 dias de retencion no vence');

-- ===================== svc_job_reconstruir_indice (diagnostico) =====================
SELECT t.eq((public.svc_job_reconstruir_indice() ->> 'motivo'), 'ninguno', 'diagnostico: indice al dia');
SELECT t.ok(NOT (public.svc_job_reconstruir_indice() ->> 'requiere')::boolean, 'diagnostico: no requiere');
SELECT t.eq((public.svc_job_reconstruir_indice() #>> '{en_uso,version}'), 'v001', 'diagnostico: version en uso');
SELECT t.as_postgres();
UPDATE public.plantilla_facial SET activa = false WHERE id_alumno = t.id_alumno('A001');
SELECT t.as_service();
SELECT t.eq((public.svc_job_reconstruir_indice() ->> 'motivo'), 'obsoletas', 'diagnostico: archivada aun en el indice => obsoletas');
SELECT t.eq((public.svc_job_reconstruir_indice() ->> 'obsoletas')::int, 1, 'diagnostico: 1 obsoleta');
SELECT t.as_postgres();
INSERT INTO public.plantilla_facial (id_alumno, id_consent, objeto_foto) VALUES (t.id_alumno('A002'), t.id_consent('A002'), 'registro/x/00000000-0000-4000-8000-000000000001.jpg');
SELECT t.as_service();
SELECT t.eq((public.svc_job_reconstruir_indice() ->> 'motivo'), 'pendientes', 'diagnostico: pendientes tienen prioridad sobre obsoletas');
SELECT t.ok((public.svc_job_reconstruir_indice() ->> 'requiere')::boolean, 'diagnostico: requiere');
SELECT t.efecto($q$ UPDATE public.parametro_sistema SET valor = '256' WHERE clave = 'dimension_vector' $q$,
    $q$ SELECT public.svc_job_reconstruir_indice() ->> 'motivo' = 'dimension_cambiada' $q$, 'diagnostico: dimension_cambiada');
SELECT t.efecto($q$ UPDATE public.indice_faiss SET en_uso = false $q$,
    $q$ SELECT public.svc_job_reconstruir_indice() ->> 'motivo' = 'sin_indice' AND public.svc_job_reconstruir_indice() -> 'en_uso' = 'null'::jsonb $q$, 'diagnostico: sin_indice');

-- ===================== svc_job_recalcular =====================
SELECT t.reloj('2026-09-14 07:12:00-06');
SELECT t.eq((public.svc_job_recalcular() ->> 'periodo'), '2026-2', 'recalcular: periodo con sesiones ya ocurridas');
SELECT t.eq((public.svc_job_recalcular() ->> 'consentimientos_vencidos')::int, 0, 'recalcular: la primera corrida ya vencio el consentimiento A006');
SELECT t.eq((SELECT estatus::text FROM public.consentimiento WHERE id_alumno = t.id_alumno('A006')), 'vencido', 'recalcular: A006 vencido');
SELECT t.eq((SELECT count(*)::int FROM public.bitacora_auditoria WHERE entidad = 'consentimiento' AND accion = 'correccion'
              AND id_usuario = app.id_usuario_servicio()), 1, 'recalcular: vencimiento a nombre de la cuenta de servicio');
SELECT t.eq((public.svc_job_recalcular('2026-2') ->> 'grupos')::int, 2, 'recalcular: 2 grupos del periodo');
SELECT t.eq((public.svc_job_recalcular('2026-2') ->> 'recalculados')::int, 2, 'recalcular: 2 recalculados');
SELECT t.eq((public.svc_job_recalcular('2028-1') ->> 'grupos')::int, 0, 'recalcular: periodo sin grupos');
SELECT t.ok(public.svc_job_recalcular('2026-2') -> 'errores' = '[]'::jsonb, 'recalcular: sin errores');
SELECT t.throws($q$ SELECT public.svc_job_recalcular('2026') $q$, 'P0001:VALIDACION', 'recalcular: formato 2026');
SELECT t.throws($q$ SELECT public.svc_job_recalcular('2026-12') $q$, 'P0001:VALIDACION', 'recalcular: formato 2026-12');
SELECT t.throws($q$ SELECT public.svc_job_recalcular('2026-3') $q$, 'P0001:VALIDACION', 'recalcular: semestre 3 no existe (ck_grupo_periodo)');
SELECT t.throws($q$ SELECT public.svc_job_recalcular('x; DROP TABLE alumno') $q$, 'P0001:VALIDACION', 'recalcular: inyeccion');
-- el periodo por omision es el mayor con sesiones ya ocurridas
SELECT t.as_postgres();
INSERT INTO public.grupo (id_materia, id_docente, id_aula, clave_grupo, periodo)
VALUES (t.id_materia('ADM101'), t.id_docente('D002'), t.id_aula('B-04'), '9Z', '2027-1');
INSERT INTO public.grupo (id_materia, id_docente, id_aula, clave_grupo, periodo)
VALUES (t.id_materia('ADM101'), t.id_docente('D002'), t.id_aula('B-04'), '9Y', '2027-2');
INSERT INTO public.sesion_clase (id_grupo, fecha, hora_inicio, hora_fin, estatus)
SELECT g.id_grupo, CASE g.periodo WHEN '2027-1' THEN DATE '2026-09-10' ELSE DATE '2027-02-01' END, '10:00', '11:00', 'cerrada'
  FROM public.grupo g WHERE g.clave_grupo IN ('9Z', '9Y');
SELECT t.as_service();
SELECT t.eq((public.svc_job_recalcular() ->> 'periodo'), '2027-1', 'recalcular: el periodo 2027-2 sin sesiones ocurridas no cuenta');
SELECT t.eq((public.svc_job_recalcular() ->> 'grupos')::int, 1, 'recalcular: 1 grupo en 2027-1');

-- ===================== Aislamiento de fallos (stubs dentro de la transaccion de prueba) =====================
SELECT t.as_postgres();
DO $x$
BEGIN
    EXECUTE format($f$
        CREATE OR REPLACE FUNCTION app.recalcular_grupo(p_id_grupo integer) RETURNS void
            LANGUAGE plpgsql SET search_path = public, app, pg_temp
        AS $b$ BEGIN
            IF p_id_grupo = %s THEN PERFORM app.fallar('PRUEBA_FALLA', 'grupo de prueba'); END IF;
        END $b$ $f$, t.id_grupo('3A'));
END $x$;
SELECT t.as_service();
SELECT t.eq((public.svc_job_recalcular('2026-2') ->> 'recalculados')::int, 1, 'recalcular: un grupo con error no detiene a los demas');
SELECT t.eq((public.svc_job_recalcular('2026-2') -> 'errores' -> 0 ->> 'codigo'), 'PRUEBA_FALLA', 'recalcular: error con codigo del HINT');
SELECT t.eq((public.svc_job_recalcular('2026-2') -> 'errores' -> 0 ->> 'id_grupo')::int, t.id_grupo('3A'), 'recalcular: error identifica el grupo');
SELECT t.as_postgres();
UPDATE public.sesion_clase SET estatus = 'abierta' WHERE id_grupo = t.id_grupo('3A') AND fecha = '2026-09-14';
UPDATE public.sesion_clase SET estatus = 'abierta' WHERE id_grupo = t.id_grupo('5B') AND fecha = '2026-09-14';
DO $x$
BEGIN
    EXECUTE format($f$
        CREATE OR REPLACE FUNCTION app.cerrar_sesion(p_id_sesion integer, p_por_docente boolean) RETURNS jsonb
            LANGUAGE plpgsql SET search_path = public, app, pg_temp
        AS $b$ BEGIN
            IF p_id_sesion = %s THEN PERFORM app.fallar('PRUEBA_FALLA', 'sesion de prueba'); END IF;
            UPDATE public.sesion_clase SET estatus = 'cerrada' WHERE id_sesion = p_id_sesion;
            RETURN jsonb_build_object('stub', true);
        END $b$ $f$, t.id_sesion('3A', '2026-09-14'));
END $x$;
SELECT t.as_service();
SELECT t.reloj('2026-09-16 10:00:00-06');
SELECT t.eq((public.svc_job_cerrar_sesiones() ->> 'candidatas')::int, 2, 'cerrar: 2 candidatas');
SELECT t.as_postgres();
UPDATE public.sesion_clase SET estatus = 'abierta' WHERE id_grupo = t.id_grupo('5B') AND fecha = '2026-09-14';
SELECT t.as_service();
SELECT t.eq((public.svc_job_cerrar_sesiones() ->> 'cerradas')::int, 1, 'cerrar: una falla no impide cerrar las demas');
SELECT t.eq((public.svc_job_cerrar_sesiones() -> 'errores' -> 0 ->> 'codigo'), 'PRUEBA_FALLA', 'cerrar: el error trae el codigo');
SELECT t.eq((public.svc_job_cerrar_sesiones() -> 'errores' -> 0 ->> 'id_sesion')::int, t.id_sesion('3A', '2026-09-14'), 'cerrar: el error identifica la sesion');

-- ===================== Permisos =====================
SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ SELECT public.svc_job_cerrar_sesiones() $q$, '42501', 'administrador no ejecuta jobs');
SELECT t.throws($q$ SELECT public.svc_job_resolver_pendientes() $q$, '42501', 'administrador no resuelve pendientes');
SELECT t.throws($q$ SELECT public.svc_job_purgar_recortes_listar() $q$, '42501', 'administrador no lista recortes a purgar');
SELECT t.throws($q$ SELECT public.svc_job_purgar_recortes_marcar(ARRAY[1]::bigint[]) $q$, '42501', 'administrador no marca recortes');
SELECT t.throws($q$ SELECT public.svc_job_reconstruir_indice() $q$, '42501', 'administrador no ejecuta el diagnostico');
SELECT t.throws($q$ SELECT public.svc_job_recalcular() $q$, '42501', 'administrador no recalcula');
SELECT t.as_user('tecnico@susan.test');
SELECT t.throws($q$ SELECT public.svc_job_cerrar_sesiones() $q$, '42501', 'tecnico no ejecuta jobs (solo el servidor)');
SELECT t.throws($q$ SELECT public.svc_job_recalcular() $q$, '42501', 'tecnico no recalcula');
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT public.svc_job_cerrar_sesiones() $q$, '42501', 'docente no ejecuta jobs');
SELECT t.throws($q$ SELECT public.svc_job_resolver_pendientes() $q$, '42501', 'docente no resuelve pendientes');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ SELECT public.svc_job_purgar_recortes_listar() $q$, '42501', 'alumno no lista recortes');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.svc_job_cerrar_sesiones() $q$, '42501', 'anon no ejecuta jobs');
SELECT t.throws($q$ SELECT public.svc_job_recalcular() $q$, '42501', 'anon no recalcula');
SELECT t.summary();
ROLLBACK;
