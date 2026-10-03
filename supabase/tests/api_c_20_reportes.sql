-- api_c_20 · Reportes, portal del alumno, series, impacto y alertas (RF-13, RF-14, RF-17, RF-21, RN-10, RN-11)
-- Escenario comun api_c_escenario.inc: 3A tiene 48 sesiones programadas (46 cerradas, 1 abierta, 1 programada);
--   A001: 1 presente, 9 ausencias (junio), 2 pendientes (S1 y la sesion abierta)  -> 9 faltas = 18.75 %, en el limite
--   A002: 3 ausencias (07-sep, S1, S0)  -> 3 faltas = 6.25 %          A005: 3 retardos -> 1 falta equivalente = 2.08 %
--   A006: 2 presentes.  A003 (baja) sin registros.  5B: S3 con A004 pendiente y su sesion manual del 07-sep.
BEGIN;
SELECT t.begin('api_c_20_reportes');
SELECT t.cargar_fixtures();
\ir api_c_escenario.inc
SELECT t.reloj('2026-09-08 09:40:00-06');

-- ===== api_reporte_filtros ===========================================================================
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(public.api_reporte_filtros() ->> 'periodo_actual', '2026-2', 'filtros: periodo actual');
SELECT t.eq(jsonb_array_length(public.api_reporte_filtros() -> 'grupos'), 1, 'filtros: el docente solo ve su grupo');
SELECT t.eq(public.api_reporte_filtros('2026-2') -> 'grupos' -> 0 ->> 'inscritos', '4', 'filtros: inscritos activos de 3A');
SELECT t.eq(jsonb_array_length(public.api_reporte_filtros('2025-1') -> 'grupos'), 0, 'filtros: periodo sin grupos');
SELECT t.as_user('admin@susan.test');
SELECT t.eq(jsonb_array_length(public.api_reporte_filtros() -> 'grupos'), 2, 'filtros: el administrador ve todos');

-- ===== api_reporte_grupo =============================================================================
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(public.api_reporte_grupo(t.id_grupo('3A')) ->> 'total', '4', 'RF-17: 4 alumnos activos (la baja no aparece)');
SELECT t.eq(public.api_reporte_grupo(t.id_grupo('3A')) -> 'kpis' ->> 'sesiones_programadas', '48', 'KPI: 48 sesiones programadas');
SELECT t.eq(public.api_reporte_grupo(t.id_grupo('3A')) -> 'kpis' ->> 'sesiones_cerradas', '46', 'KPI: 46 sesiones cerradas');
SELECT t.eq(public.api_reporte_grupo(t.id_grupo('3A')) -> 'kpis' ->> 'inscritos', '4', 'KPI: inscritos');
SELECT t.eq(public.api_reporte_grupo(t.id_grupo('3A')) -> 'kpis' ->> 'asistencia_promedio', '33.33', 'KPI: asistencia promedio = 6 de 18 registros resueltos');
SELECT t.eq(public.api_reporte_grupo(t.id_grupo('3A')) -> 'kpis' ->> 'alumnos_en_limite', '1', 'KPI: A001 esta en el limite');
SELECT t.eq(public.api_reporte_grupo(t.id_grupo('3A')) -> 'kpis' ->> 'alumnos_sin_derecho', '0', 'KPI: nadie sin derecho');
SELECT t.eq(public.api_reporte_grupo(t.id_grupo('3A')) ->> 'limite_pct', '20', 'limite_pct');
SELECT t.eq(public.api_reporte_grupo(t.id_grupo('3A')) -> 'grupo' ->> 'materia_clave', 'ADM101', 'datos del grupo');
SELECT t.eq((SELECT string_agg(x ->> 'matricula', ',') FROM jsonb_array_elements(public.api_reporte_grupo(t.id_grupo('3A')) -> 'items') x),
    'A002,A006,A001,A005', 'orden por apellidos');
-- totales = conteo directo de registros por estado (verificacion de RF-17)
SELECT t.eq((SELECT sum((x ->> 'presentes')::int) FROM jsonb_array_elements(public.api_reporte_grupo(t.id_grupo('3A')) -> 'items') x)::bigint,
    (SELECT count(*) FROM asistencia a JOIN sesion_clase s ON s.id_sesion = a.id_sesion WHERE s.id_grupo = t.id_grupo('3A') AND a.estado = 'presente'
        AND a.id_alumno IN (SELECT id_alumno FROM inscripcion WHERE id_grupo = t.id_grupo('3A') AND estatus = 'activa')), 'RF-17: presentes coinciden con el conteo directo');
SELECT t.eq((SELECT sum((x ->> 'ausencias')::int) FROM jsonb_array_elements(public.api_reporte_grupo(t.id_grupo('3A')) -> 'items') x)::bigint,
    (SELECT count(*) FROM asistencia a JOIN sesion_clase s ON s.id_sesion = a.id_sesion WHERE s.id_grupo = t.id_grupo('3A') AND a.estado = 'ausente'), 'RF-17: ausencias coinciden con el conteo directo');
-- fila de A001
SELECT t.eq((SELECT x ->> 'faltas_equivalentes' FROM jsonb_array_elements(public.api_reporte_grupo(t.id_grupo('3A')) -> 'items') x WHERE x ->> 'matricula' = 'A001'), '9', 'A001: 9 faltas equivalentes');
SELECT t.eq((SELECT x ->> 'porcentaje_faltas' FROM jsonb_array_elements(public.api_reporte_grupo(t.id_grupo('3A')) -> 'items') x WHERE x ->> 'matricula' = 'A001'), '18.75', 'A001: 18.75 %');
SELECT t.eq((SELECT x ->> 'pendientes' FROM jsonb_array_elements(public.api_reporte_grupo(t.id_grupo('3A')) -> 'items') x WHERE x ->> 'matricula' = 'A001'), '2', 'A001: 2 pendientes que no cuentan');
SELECT t.eq((SELECT x ->> 'en_limite' FROM jsonb_array_elements(public.api_reporte_grupo(t.id_grupo('3A')) -> 'items') x WHERE x ->> 'matricula' = 'A001'), 'true', 'A001: en el limite');
SELECT t.eq((SELECT x ->> 'faltas_restantes_antes_limite' FROM jsonb_array_elements(public.api_reporte_grupo(t.id_grupo('3A')) -> 'items') x WHERE x ->> 'matricula' = 'A001'), '0', 'A001: 0 faltas restantes');
SELECT t.eq((SELECT x ->> 'faltas_equivalentes' FROM jsonb_array_elements(public.api_reporte_grupo(t.id_grupo('3A')) -> 'items') x WHERE x ->> 'matricula' = 'A005'), '1', 'A005: 3 retardos = 1 falta equivalente');
SELECT t.eq((SELECT x ->> 'faltas_restantes_antes_limite' FROM jsonb_array_elements(public.api_reporte_grupo(t.id_grupo('3A')) -> 'items') x WHERE x ->> 'matricula' = 'A002'), '6', 'A002: 6 faltas restantes');
SELECT t.eq((SELECT x ->> 'derecho_examen' FROM jsonb_array_elements(public.api_reporte_grupo(t.id_grupo('3A')) -> 'items') x WHERE x ->> 'matricula' = 'A006'), 'true', 'derecho_examen en la fila');
SELECT t.ok(public.api_reporte_grupo(t.id_grupo('3A'))::text !~ 'objeto_', 'RNF-03: sin rutas objeto_*');
-- filtro por alumno y detalle
SELECT t.eq(jsonb_array_length(public.api_reporte_grupo(t.id_grupo('3A'), t.id_alumno('A001')) -> 'items'), 1, 'filtro por alumno: una fila');
SELECT t.eq(jsonb_array_length(public.api_reporte_grupo(t.id_grupo('3A'), t.id_alumno('A001')) -> 'detalle'), 47, 'detalle: 46 cerradas + 1 abierta');
SELECT t.eq(public.api_reporte_grupo(t.id_grupo('3A'), t.id_alumno('A001')) -> 'detalle' -> 0 ->> 'estado', 'ausente', 'detalle ordenado por fecha: junio primero');
SELECT t.ok(public.api_reporte_grupo(t.id_grupo('3A')) -> 'detalle' = 'null'::jsonb, 'sin alumno no hay detalle');
SELECT t.throws($q$ SELECT public.api_reporte_grupo(t.id_grupo('3A'), t.id_alumno('A003')) $q$, 'P0001:NO_ENCONTRADO', 'alumno dado de baja: no esta inscrito activo');
SELECT t.throws($q$ SELECT public.api_reporte_grupo(t.id_grupo('3A'), 999999) $q$, 'P0001:NO_ENCONTRADO', 'alumno inexistente');
-- paginacion
SELECT t.eq(jsonb_array_length(public.api_reporte_grupo(t.id_grupo('3A'), NULL, 2, 1) -> 'items'), 2, 'paginacion: limit 2 offset 1');
SELECT t.eq(public.api_reporte_grupo(t.id_grupo('3A'), NULL, 2, 1) ->> 'total', '4', 'paginacion: total sin paginar');
SELECT t.eq(jsonb_array_length(public.api_reporte_grupo(t.id_grupo('3A'), NULL, 0, -3) -> 'items'), 4, 'limite < 1 y offset negativo: valores por omision');
-- permisos
SELECT t.throws($q$ SELECT public.api_reporte_grupo(t.c('G5B')) $q$, 'P0001:NO_AUTORIZADO', 'docente: grupo ajeno');
SELECT t.throws($q$ SELECT public.api_reporte_grupo(999999) $q$, 'P0001:NO_AUTORIZADO', 'docente: grupo inexistente no se distingue del ajeno');
SELECT t.throws($q$ SELECT public.api_reporte_grupo(NULL) $q$, 'P0001:VALIDACION', 'grupo nulo');
SELECT t.as_user('admin@susan.test');
SELECT t.eq(public.api_reporte_grupo(t.c('G5B')) ->> 'total', '1', 'administrador: cualquier grupo');
SELECT t.eq(public.api_reporte_grupo(t.id_grupo('3A')) -> 'kpis' ->> 'alumnos_en_limite', '1', 'administrador: mismos KPIs que el docente');
SELECT t.throws($q$ SELECT public.api_reporte_grupo(999999) $q$, 'P0001:NO_ENCONTRADO', 'administrador: grupo inexistente');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ SELECT public.api_reporte_grupo(t.id_grupo('3A')) $q$, 'P0001:NO_AUTORIZADO', 'alumno no ve reportes de grupo');
SELECT t.as_user('tecnico@susan.test');
SELECT t.throws($q$ SELECT public.api_reporte_grupo(t.id_grupo('3A')) $q$, 'P0001:NO_AUTORIZADO', 'tecnico no ve reportes');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.api_reporte_grupo(1) $q$, '42501', 'anon no ejecuta api_reporte_grupo');
SELECT t.throws($q$ SELECT public.api_serie_grupo(1) $q$, '42501', 'anon no ejecuta api_serie_grupo');
SELECT t.throws($q$ SELECT public.api_alumno_resumen() $q$, '42501', 'anon no ejecuta api_alumno_resumen');
SELECT t.throws($q$ SELECT * FROM public.v_resumen_asistencia $q$, '42501', 'anon no lee la vista');

-- ===== api_reporte_periodo ===========================================================================
SELECT t.as_user('admin@susan.test');
SELECT t.eq(public.api_reporte_periodo('2026-2') ->> 'total', '2', 'periodo: dos grupos');
SELECT t.eq((SELECT x ->> 'sesiones_cerradas' FROM jsonb_array_elements(public.api_reporte_periodo('2026-2') -> 'items') x WHERE x ->> 'clave_grupo' = '3A'), '46', 'periodo: cerradas de 3A');
SELECT t.eq((SELECT x ->> 'alumnos_en_limite' FROM jsonb_array_elements(public.api_reporte_periodo('2026-2') -> 'items') x WHERE x ->> 'clave_grupo' = '3A'), '1', 'periodo: en el limite de 3A');
SELECT t.eq((SELECT x ->> 'inscritos' FROM jsonb_array_elements(public.api_reporte_periodo('2026-2') -> 'items') x WHERE x ->> 'clave_grupo' = '3A'), '4', 'periodo: inscritos de 3A');
SELECT t.eq((SELECT x ->> 'asistencia_promedio' FROM jsonb_array_elements(public.api_reporte_periodo('2026-2') -> 'items') x WHERE x ->> 'clave_grupo' = '3A'), '33.33', 'periodo: promedio de 3A');
SELECT t.eq((SELECT x ->> 'docente_nombre' FROM jsonb_array_elements(public.api_reporte_periodo('2026-2') -> 'items') x WHERE x ->> 'clave_grupo' = '3A'), 'López Ruiz Ana', 'periodo: nombre del docente');
SELECT t.eq(public.api_reporte_periodo('2026-2', t.c('G5B')) ->> 'total', '1', 'periodo: filtro por grupo');
SELECT t.eq(public.api_reporte_periodo('2025-1') ->> 'total', '0', 'periodo sin grupos');
SELECT t.throws($q$ SELECT public.api_reporte_periodo('abc') $q$, 'P0001:VALIDACION', 'periodo no valido');
SELECT t.throws($q$ SELECT public.api_reporte_periodo(NULL) $q$, 'P0001:VALIDACION', 'periodo nulo');
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(public.api_reporte_periodo('2026-2') ->> 'total', '1', 'periodo: docente solo sus grupos');
SELECT t.throws($q$ SELECT public.api_reporte_periodo('2026-2', t.c('G5B')) $q$, 'P0001:NO_AUTORIZADO', 'periodo: grupo ajeno');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ SELECT public.api_reporte_periodo('2026-2') $q$, 'P0001:NO_AUTORIZADO', 'periodo: alumno');

-- ===== portal del alumno =============================================================================
SELECT t.as_user('alumno1@susan.test');
SELECT t.eq(public.api_alumno_resumen() ->> 'periodo', '2026-2', 'resumen: periodo por omision');
SELECT t.eq(public.api_alumno_resumen() -> 'periodos_disponibles', '["2026-2"]'::jsonb, 'resumen: periodos disponibles');
SELECT t.eq(jsonb_array_length(public.api_alumno_resumen() -> 'items'), 1, 'resumen: una materia');
SELECT t.eq(public.api_alumno_resumen() -> 'items' -> 0 ->> 'faltas_equivalentes', '9', 'resumen: 9 faltas equivalentes');
SELECT t.eq(public.api_alumno_resumen() -> 'items' -> 0 ->> 'porcentaje_faltas', '18.75', 'resumen: 18.75 %');
SELECT t.eq(public.api_alumno_resumen() -> 'items' -> 0 ->> 'faltas_maximas_permitidas', '9', 'resumen: maximo permitido');
SELECT t.eq(public.api_alumno_resumen() -> 'items' -> 0 -> 'materia' ->> 'clave', 'ADM101', 'resumen: materia');
SELECT t.eq(public.api_alumno_resumen() -> 'items' -> 0 ->> 'docente_nombre', 'López Ruiz Ana', 'resumen: docente del grupo');
SELECT t.eq(jsonb_array_length(public.api_alumno_resumen('2025-1') -> 'items'), 0, 'resumen: periodo sin materias');
SELECT t.ok(public.api_alumno_resumen()::text !~ 'objeto_', 'RF-21: sin rutas');
-- coincide con el reporte del docente
SELECT t.eq(public.api_alumno_historial(t.id_grupo('3A')) ->> 'total', '47', 'historial: 46 cerradas + 1 abierta');
SELECT t.eq(public.api_alumno_historial(t.id_grupo('3A')) -> 'items' -> 0 ->> 'estatus_sesion', 'abierta', 'historial: lo mas reciente primero');
SELECT t.eq(public.api_alumno_historial(t.id_grupo('3A')) -> 'items' -> 0 ->> 'estado', 'pendiente', 'historial: el pendiente se muestra como pendiente');
SELECT t.eq(public.api_alumno_historial(t.id_grupo('3A')) -> 'items' -> 0 ->> 'puede_justificar', 'false', 'historial: el pendiente no se justifica');
SELECT t.eq((SELECT x ->> 'puede_justificar' FROM jsonb_array_elements(public.api_alumno_historial(t.id_grupo('3A'), 200, 0) -> 'items') x
              WHERE x ->> 'fecha' = '2026-06-01'), 'true', 'historial: una ausencia cerrada si se justifica');
SELECT t.eq(public.api_alumno_historial(t.id_grupo('3A')) -> 'resumen' ->> 'faltas_equivalentes', '9', 'historial: resumen del grupo');
SELECT t.eq(jsonb_array_length(public.api_alumno_historial(t.id_grupo('3A'), 2, 1) -> 'items'), 2, 'historial: paginacion');
SELECT t.ok(public.api_alumno_historial(t.id_grupo('3A'))::text !~ 'objeto_', 'RF-21: historial sin rutas');
SELECT t.throws($q$ SELECT public.api_alumno_historial(t.c('G5B')) $q$, 'P0001:NO_AUTORIZADO', 'historial: grupo donde no esta inscrito');
SELECT t.as_user('alumno2@susan.test');
SELECT t.eq((SELECT x -> 'justificante' ->> 'estatus' FROM jsonb_array_elements(public.api_alumno_historial(t.id_grupo('3A'), 200, 0) -> 'items') x
              WHERE x ->> 'fecha' = '2026-09-07'), 'pendiente', 'historial: estatus del justificante propio');
SELECT t.eq((SELECT x ->> 'puede_justificar' FROM jsonb_array_elements(public.api_alumno_historial(t.id_grupo('3A'), 200, 0) -> 'items') x
              WHERE x ->> 'fecha' = '2026-09-07'), 'false', 'historial: con justificante pendiente no se vuelve a justificar');
SELECT t.as_user('docente1@susan.test');
SELECT t.throws($q$ SELECT public.api_alumno_resumen() $q$, 'P0001:NO_AUTORIZADO', 'resumen: docente');
SELECT t.throws($q$ SELECT public.api_alumno_historial(t.id_grupo('3A')) $q$, 'P0001:NO_AUTORIZADO', 'historial: docente');
SELECT t.as_user('admin@susan.test');
SELECT t.throws($q$ SELECT public.api_alumno_resumen() $q$, 'P0001:NO_AUTORIZADO', 'resumen: administrador');

-- ===== series ========================================================================================
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(jsonb_array_length(public.api_serie_grupo(t.id_grupo('3A')) -> 'sesiones'), 46, 'serie: solo sesiones cerradas');
SELECT t.eq(public.api_serie_grupo(t.id_grupo('3A')) ->> 'sesiones_programadas', '48', 'serie: sesiones programadas');
SELECT t.eq(public.api_serie_grupo(t.id_grupo('3A')) ->> 'limite_pct', '20', 'serie: limite_pct');
SELECT t.eq(public.api_serie_grupo(t.id_grupo('3A')) ->> 'periodo', '2026-2', 'serie: periodo');
SELECT t.eq(public.api_serie_grupo(t.id_grupo('3A')) -> 'sesiones' -> 0 ->> 'fecha', '2026-06-01', 'serie: ordenada por fecha');
SELECT t.eq(public.api_serie_grupo(t.id_grupo('3A')) -> 'sesiones' -> 0 ->> 'dia_semana', '1', 'serie: 1 = lunes');
SELECT t.eq(public.api_serie_grupo(t.id_grupo('3A')) -> 'sesiones' -> 0 ->> 'tasa_ausentismo', '1.0000', 'serie: tasa = ausentes / inscritos');
SELECT t.eq((SELECT x ->> 'semana_iso' FROM jsonb_array_elements(public.api_serie_grupo(t.id_grupo('3A')) -> 'sesiones') x WHERE x ->> 'fecha' = '2026-09-07'), '37', 'serie: semana ISO');
SELECT t.eq((SELECT x ->> 'anio_iso' FROM jsonb_array_elements(public.api_serie_grupo(t.id_grupo('3A')) -> 'sesiones') x WHERE x ->> 'fecha' = '2026-09-07'), '2026', 'serie: anio ISO');
SELECT t.eq((SELECT x - 'id_sesion' FROM jsonb_array_elements(public.api_serie_grupo(t.id_grupo('3A')) -> 'sesiones') x WHERE x ->> 'fecha' = '2026-09-08'),
    '{"fecha":"2026-09-08","semana_iso":37,"anio_iso":2026,"dia_semana":2,"inscritos":4,"presentes":1,"retardos":1,"ausentes":1,"justificados":0,"pendientes":1,"tasa_ausentismo":0.2500}'::jsonb,
    'serie: forma completa de una sesion');
SELECT t.ok(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.api_serie_grupo(t.id_grupo('3A')) -> 'sesiones') x WHERE x ->> 'fecha' IN ('2026-09-14', '2026-09-16')),
    'serie: la sesion abierta y la programada no aparecen');
SELECT t.ok(public.api_serie_grupo(t.id_grupo('3A'))::text !~ 'objeto_', 'serie: sin rutas');
SELECT t.throws($q$ SELECT public.api_serie_grupo(t.c('G5B')) $q$, 'P0001:NO_AUTORIZADO', 'serie: grupo ajeno');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ SELECT public.api_serie_grupo(t.id_grupo('3A')) $q$, 'P0001:NO_AUTORIZADO', 'serie de grupo: alumno');
SELECT t.as_user('docente2@susan.test');
SELECT t.eq(jsonb_array_length(public.api_serie_grupo(t.c('G5B')) -> 'sesiones'), 2, 'serie: 5B tiene 2 cerradas');

-- matriz
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(jsonb_array_length(public.api_matriz_grupo(t.id_grupo('3A')) -> 'fechas'), 46, 'matriz: 46 fechas');
SELECT t.eq(public.api_matriz_grupo(t.id_grupo('3A')) -> 'fechas' -> 0, '"2026-06-01"'::jsonb, 'matriz: primera fecha');
SELECT t.eq(public.api_matriz_grupo(t.id_grupo('3A')) ->> 'total', '4', 'matriz: 4 alumnos (la baja sin registros no aparece)');
SELECT t.eq((SELECT string_agg(x ->> 'matricula', ',') FROM jsonb_array_elements(public.api_matriz_grupo(t.id_grupo('3A')) -> 'alumnos') x), 'A002,A006,A001,A005', 'matriz: orden por apellidos');
SELECT t.ok((SELECT bool_and(jsonb_array_length(x -> 'estados') = 46) FROM jsonb_array_elements(public.api_matriz_grupo(t.id_grupo('3A')) -> 'alumnos') x), 'matriz: estados alineados con fechas');
SELECT t.eq((SELECT x -> 'estados' ->> 0 FROM jsonb_array_elements(public.api_matriz_grupo(t.id_grupo('3A')) -> 'alumnos') x WHERE x ->> 'matricula' = 'A001'), 'ausente', 'matriz: A001 ausente el 1-jun');
SELECT t.ok((SELECT x -> 'estados' -> 0 = 'null'::jsonb FROM jsonb_array_elements(public.api_matriz_grupo(t.id_grupo('3A')) -> 'alumnos') x WHERE x ->> 'matricula' = 'A006'), 'matriz: sin registro = null');
SELECT t.eq((SELECT x -> 'estados' ->> 45 FROM jsonb_array_elements(public.api_matriz_grupo(t.id_grupo('3A')) -> 'alumnos') x WHERE x ->> 'matricula' = 'A001'), 'pendiente', 'matriz: ultima sesion cerrada de A001 pendiente');
SELECT t.eq((SELECT x ->> 'nombre' FROM jsonb_array_elements(public.api_matriz_grupo(t.id_grupo('3A')) -> 'alumnos') x WHERE x ->> 'matricula' = 'A001'), 'Ramos Díaz Beatriz', 'matriz: nombre');
SELECT t.eq((SELECT x ->> 'id_inscripcion' FROM jsonb_array_elements(public.api_matriz_grupo(t.id_grupo('3A')) -> 'alumnos') x WHERE x ->> 'matricula' = 'A001'),
    (SELECT id_inscripcion::text FROM inscripcion WHERE id_alumno = t.id_alumno('A001') AND id_grupo = t.id_grupo('3A')), 'matriz: id_inscripcion');
SELECT t.eq(jsonb_array_length(public.api_matriz_grupo(t.id_grupo('3A'), 2, 2) -> 'alumnos'), 2, 'matriz: paginacion por alumno');
SELECT t.eq(jsonb_array_length(public.api_matriz_grupo(t.id_grupo('3A'), 2, 2) -> 'fechas'), 46, 'matriz: fechas completas aunque se pagine');
SELECT t.efecto($q$ SELECT t.as_postgres(); UPDATE inscripcion SET estatus = 'activa' WHERE id_alumno = t.id_alumno('A003') AND id_grupo = t.id_grupo('3A');
                    INSERT INTO asistencia (id_sesion, id_alumno, estado, hora_registro, origen) VALUES (t.c('S0'), t.id_alumno('A003'), 'presente', '2026-09-05 07:02:00-06', 'manual');
                    UPDATE inscripcion SET estatus = 'baja' WHERE id_alumno = t.id_alumno('A003') AND id_grupo = t.id_grupo('3A');
                    SELECT t.as_user('docente1@susan.test') $q$,
    $q$ SELECT public.api_matriz_grupo(t.id_grupo('3A')) ->> 'total' = '5'
           AND EXISTS (SELECT 1 FROM jsonb_array_elements(public.api_matriz_grupo(t.id_grupo('3A')) -> 'alumnos') x WHERE x ->> 'matricula' = 'A003') $q$,
    'matriz: un alumno dado de baja aparece si tiene registros');
SELECT t.throws($q$ SELECT public.api_matriz_grupo(t.c('G5B')) $q$, 'P0001:NO_AUTORIZADO', 'matriz: grupo ajeno');

-- serie de alumno
SELECT t.as_user('alumno1@susan.test');
SELECT t.eq(jsonb_array_length(public.api_serie_alumno(t.id_grupo('3A')) -> 'sesiones'), 46, 'serie alumno: 46 sesiones cerradas');
SELECT t.eq(public.api_serie_alumno(t.id_grupo('3A')) -> 'sesiones' -> 45 ->> 'faltas_equivalentes_acumuladas', '9', 'serie alumno: acumulado final = 9');
SELECT t.eq(public.api_serie_alumno(t.id_grupo('3A')) -> 'sesiones' -> 3 ->> 'faltas_equivalentes_acumuladas', '4', 'serie alumno: acumulado a la 4a sesion = 4');
SELECT t.eq(public.api_serie_alumno(t.id_grupo('3A')) -> 'sesiones' -> 45 ->> 'estado', 'pendiente', 'serie alumno: estado de la ultima');
SELECT t.eq(public.api_serie_alumno(t.id_grupo('3A'), t.c('ID_A001')) ->> 'id_alumno', t.c('ID_A001')::text, 'serie alumno: puede indicar su propio id');
SELECT t.eq(public.api_serie_alumno(t.id_grupo('3A')) -> 'resumen' ->> 'porcentaje_faltas', '18.75', 'serie alumno: resumen');
SELECT t.throws($q$ SELECT public.api_serie_alumno(t.id_grupo('3A'), t.c('ID_A002')) $q$, 'P0001:NO_AUTORIZADO', 'serie alumno: id de otro alumno');
SELECT t.throws($q$ SELECT public.api_serie_alumno(t.c('G5B')) $q$, 'P0001:NO_AUTORIZADO', 'serie alumno: grupo sin inscripcion');
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(public.api_serie_alumno(t.id_grupo('3A'), t.id_alumno('A005')) -> 'sesiones' -> 45 ->> 'faltas_equivalentes_acumuladas', '1', 'serie alumno (docente): 3 retardos = 1');
SELECT t.throws($q$ SELECT public.api_serie_alumno(t.id_grupo('3A')) $q$, 'P0001:VALIDACION', 'serie alumno: el docente debe indicar al alumno');
SELECT t.throws($q$ SELECT public.api_serie_alumno(t.id_grupo('3A'), t.c('ID_A004')) $q$, 'P0001:NO_ENCONTRADO', 'serie alumno: alumno de otro grupo');
SELECT t.throws($q$ SELECT public.api_serie_alumno(t.c('G5B'), t.c('ID_A004')) $q$, 'P0001:NO_AUTORIZADO', 'serie alumno: grupo ajeno');
SELECT t.as_user('tecnico@susan.test');
SELECT t.throws($q$ SELECT public.api_serie_alumno(t.id_grupo('3A'), 1) $q$, 'P0001:NO_AUTORIZADO', 'serie alumno: tecnico');

-- ===== api_impacto_tiempo ============================================================================
SELECT t.as_user('admin@susan.test');
SELECT t.eq(public.api_impacto_tiempo() ->> 'sesiones_automaticas', '47', 'impacto: 47 sesiones cerradas automaticas');
SELECT t.eq(public.api_impacto_tiempo() ->> 'sesiones_manuales', '1', 'impacto: 1 manual');
SELECT t.eq(public.api_impacto_tiempo() ->> 'minutos_recuperados', '235', 'impacto: 47 x 5 min');
SELECT t.eq(public.api_impacto_tiempo() ->> 'horas_recuperadas', '3.92', 'impacto: horas');
SELECT t.eq(public.api_impacto_tiempo() ->> 'es_estimacion', 'true', 'impacto: es una estimacion');
SELECT t.eq(public.api_impacto_tiempo() ->> 'nota', 'Estimación: sesiones automáticas × 5 min de pase de lista manual.', 'impacto: nota');
SELECT t.eq(public.api_impacto_tiempo(t.id_grupo('3A')) ->> 'minutos_recuperados', '230', 'impacto de un grupo');
SELECT t.eq(public.api_impacto_tiempo(NULL, '2026-2') ->> 'sesiones_cerradas', '48', 'impacto por periodo');
SELECT t.eq(public.api_impacto_tiempo(NULL, '2025-1') ->> 'sesiones_cerradas', '0', 'impacto: periodo sin sesiones');
SELECT t.efecto($q$ SELECT t.as_postgres(); UPDATE parametro_sistema SET valor = '6' WHERE clave = 'minutos_pase_lista_base'; SELECT t.as_user('admin@susan.test') $q$,
    $q$ SELECT public.api_impacto_tiempo(t.id_grupo('3A')) ->> 'minutos_recuperados' = '276' $q$, 'impacto: usa el parametro minutos_pase_lista_base');
SELECT t.throws($q$ SELECT public.api_impacto_tiempo(NULL, 'x') $q$, 'P0001:VALIDACION', 'impacto: periodo no valido');
SELECT t.as_user('docente2@susan.test');
SELECT t.eq(public.api_impacto_tiempo() ->> 'sesiones_cerradas', '2', 'impacto: el docente solo cuenta sus grupos');
SELECT t.throws($q$ SELECT public.api_impacto_tiempo(t.c('G3A')) $q$, 'P0001:NO_AUTORIZADO', 'impacto: grupo ajeno');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ SELECT public.api_impacto_tiempo() $q$, 'P0001:NO_AUTORIZADO', 'impacto: alumno');

-- ===== api_alertas_docente ===========================================================================
SELECT t.as_user('docente1@susan.test');
SELECT t.eq(public.api_alertas_docente() ->> 'total', '1', 'alertas: A001 a una falta del limite');
SELECT t.eq(public.api_alertas_docente() -> 'items' -> 0 ->> 'tipo', 'en_limite', 'alertas: tipo en_limite');
SELECT t.eq(public.api_alertas_docente() -> 'items' -> 0 ->> 'matricula', 'A001', 'alertas: alumno');
SELECT t.eq(public.api_alertas_docente() ->> 'sin_derecho', '0', 'alertas: nadie sin derecho');
SELECT t.efecto($q$ SELECT t.as_postgres(); UPDATE asistencia SET estado = 'ausente', hora_registro = NULL, origen = 'manual' WHERE id_asistencia = t.c('AS1');
                    SELECT app.recalcular_grupo(t.id_grupo('3A'));
                    SELECT t.as_user('docente1@susan.test') $q$,
    $q$ SELECT public.api_alertas_docente() -> 'items' -> 0 ->> 'tipo' = 'sin_derecho'
           AND public.api_alertas_docente() ->> 'sin_derecho' = '1' AND public.api_alertas_docente() ->> 'en_limite' = '0'
           AND public.api_alertas_docente() -> 'items' -> 0 ->> 'derecho_examen' = 'false'
           AND public.api_alertas_docente() -> 'items' -> 0 ->> 'porcentaje_faltas' = '20.83' $q$,
    'alertas: la decima falta lo deja sin derecho');
SELECT t.eq(public.api_alertas_docente(t.id_grupo('3A')) ->> 'total', '1', 'alertas: filtro por grupo');
SELECT t.throws($q$ SELECT public.api_alertas_docente(t.c('G5B')) $q$, 'P0001:NO_AUTORIZADO', 'alertas: grupo ajeno');
SELECT t.ok(public.api_alertas_docente()::text !~ 'objeto_', 'alertas: sin rutas');
SELECT t.as_user('docente2@susan.test');
SELECT t.eq(public.api_alertas_docente() ->> 'total', '1', 'alertas: D2 solo ve su grupo (5B con 3 sesiones: una falta mas ya superaria el limite)');
SELECT t.eq(public.api_alertas_docente() -> 'items' -> 0 ->> 'matricula', 'A004', 'alertas: D2 no ve alumnos de D1');
SELECT t.as_user('alumno1@susan.test');
SELECT t.throws($q$ SELECT public.api_alertas_docente() $q$, 'P0001:NO_AUTORIZADO', 'alertas: alumno');
SELECT t.as_anon();
SELECT t.throws($q$ SELECT public.api_alertas_docente() $q$, '42501', 'anon no ejecuta api_alertas_docente');

SELECT t.summary();
ROLLBACK;
