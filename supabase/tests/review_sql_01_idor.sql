-- review_sql_01 · IDOR y fugas de rutas/IP en las RPC desde cada rol (revision de seguridad SQL)
BEGIN;
SELECT t.begin('review_sql_01_idor');
SELECT t.cargar_fixtures();
\ir api_c_escenario.inc

-- Ayudante: ejecuta una consulta que devuelve jsonb/text y regresa el texto, o 'ERR:<hint>'.
CREATE FUNCTION t.try(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text; h text;
BEGIN
    EXECUTE p_sql INTO v;
    RETURN coalesce(v, 'NULL');
EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS h = PG_EXCEPTION_HINT;
    RETURN 'ERR:' || SQLSTATE || ':' || coalesce(h, '') || ':' || left(SQLERRM, 80);
END $$;
GRANT EXECUTE ON FUNCTION t.try(text) TO PUBLIC;

-- Mapa: llamadas de lectura de todo el catalogo con ids de OTROS usuarios.
CREATE TABLE t.llamadas (n serial, sql text);
GRANT SELECT ON t.llamadas TO PUBLIC;
INSERT INTO t.llamadas (sql) VALUES
 ($$SELECT public.api_alumno_obtener(t.c('ID_A002'))$$),
 ($$SELECT public.api_alumno_obtener(t.c('ID_A004'))$$),
 ($$SELECT public.api_plantilla_alumno(t.c('ID_A001'))$$),
 ($$SELECT public.api_plantilla_alumno(t.c('ID_A004'))$$),
 ($$SELECT public.api_consentimientos_alumno(t.c('ID_A001'))$$),
 ($$SELECT public.api_consentimientos_alumno(t.c('ID_A004'))$$),
 ($$SELECT public.api_alumno_historial(t.c('G3A'))$$),
 ($$SELECT public.api_alumno_historial(t.c('G5B'))$$),
 ($$SELECT public.api_justificante_documento(t.c_jid('3A', DATE '2026-09-07', 'A002'))$$),
 ($$SELECT public.api_detecciones_caso(t.c('AS1'))$$),
 ($$SELECT public.api_detecciones_caso(t.c('AS5'))$$),
 ($$SELECT public.api_cola_revision()$$),
 ($$SELECT public.api_registros_corregibles(t.c('S1'))$$),
 ($$SELECT public.api_registros_corregibles(t.c('S3'))$$),
 ($$SELECT public.api_sesion_monitor(t.c('S2'))$$),
 ($$SELECT public.api_sesion_monitor(t.c('S3'))$$),
 ($$SELECT public.api_matriz_grupo(t.c('G3A'))$$),
 ($$SELECT public.api_matriz_grupo(t.c('G5B'))$$),
 ($$SELECT public.api_grupo_obtener(t.c('G3A'))$$),
 ($$SELECT public.api_grupo_obtener(t.c('G5B'))$$),
 ($$SELECT public.api_grupos_listar()$$),
 ($$SELECT public.api_aula_obtener(t.id_aula('A-12'))$$),
 ($$SELECT public.api_aula_obtener(t.id_aula('B-04'))$$),
 ($$SELECT public.api_aulas_listar()$$),
 ($$SELECT public.api_camaras_listar()$$),
 ($$SELECT public.api_camaras_listar(t.id_aula('A-12'))$$),
 ($$SELECT public.api_camaras_estado()$$),
 ($$SELECT public.api_inscritos(t.c('G3A'))$$),
 ($$SELECT public.api_inscritos(t.c('G5B'))$$),
 ($$SELECT public.api_alumnos_listar()$$),
 ($$SELECT public.api_docentes_listar()$$),
 ($$SELECT public.api_docente_obtener(t.id_docente('D002'))$$),
 ($$SELECT public.api_usuarios_listar()$$),
 ($$SELECT public.api_bitacora_listar()$$),
 ($$SELECT public.api_parametros_listar()$$),
 ($$SELECT public.api_indice_estado()$$),
 ($$SELECT public.api_reporte_grupo(t.c('G3A'))$$),
 ($$SELECT public.api_reporte_grupo(t.c('G5B'))$$),
 ($$SELECT public.api_reporte_grupo(t.c('G3A'), t.c('ID_A002'))$$),
 ($$SELECT public.api_reporte_periodo('2026-2')$$),
 ($$SELECT public.api_serie_alumno(t.c('G3A'), t.c('ID_A002'))$$),
 ($$SELECT public.api_serie_grupo(t.c('G5B'))$$),
 ($$SELECT public.api_alertas_docente(t.c('G5B'))$$),
 ($$SELECT public.api_impacto_tiempo(t.c('G5B'))$$),
 ($$SELECT public.api_mis_justificantes()$$),
 ($$SELECT public.api_alumno_resumen()$$),
 ($$SELECT public.api_docente_panel()$$);

-- Resultado de cada llamada por rol, como texto
CREATE TABLE t.res (rol text, n int, sql text, salida text);
GRANT SELECT, INSERT ON t.res TO PUBLIC;
DO $$
DECLARE r record; u text;
BEGIN
  FOREACH u IN ARRAY ARRAY['alumno2@susan.test','alumno1@susan.test','docente2@susan.test','docente1@susan.test','tecnico@susan.test','admin@susan.test'] LOOP
    FOR r IN SELECT * FROM t.llamadas ORDER BY n LOOP
      PERFORM t.as_user(u);
      INSERT INTO t.res VALUES (u, r.n, r.sql, t.try(r.sql));
      PERFORM t.as_postgres();
    END LOOP;
  END LOOP;
END $$;
-- ^ (INSERT en t.res por authenticated fallaria; se hace como postgres: ver abajo)
SELECT t.as_postgres();
SELECT t.ok(true, 'marcador');

-- Un docente solo recibe rutas en las llamadas de SUS casos (docente1: S1/AS1/justificante de 3A; docente2: AS5)
SELECT t.eq((SELECT count(*) FROM t.res WHERE salida ~ 'objeto_(recorte|foto|documento)' AND NOT (
      (rol = 'docente1@susan.test' AND n IN (9, 10)) OR (rol = 'docente2@susan.test' AND n = 11) OR rol = 'admin@susan.test')), 0::bigint,
   'las rutas objeto_* solo salen a su docente titular (o admin en consentimientos/plantillas)');
-- Fugas de rutas y IP
SELECT t.eq((SELECT count(*) FROM t.res WHERE rol IN ('alumno1@susan.test','alumno2@susan.test','tecnico@susan.test') AND salida ~ 'objeto_(recorte|foto|documento)|auth_uid'), 0::bigint,
   'alumnos y tecnico no ven objeto_* ni auth_uid en ninguna api_* (los docentes solo ven rutas de sus propios casos)');
SELECT t.eq((SELECT count(*) FROM t.res WHERE rol IN ('docente1@susan.test','docente2@susan.test','alumno1@susan.test','alumno2@susan.test') AND salida ~ '10\.20\.0\.'), 0::bigint,
   'docente/alumno no ven direccion_ip');
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT rol, n, left(sql,70) q, substring(salida from '.{0,60}(objeto_(recorte|foto|documento)|auth_uid).{0,40}') m FROM t.res WHERE salida ~ 'objeto_(recorte|foto|documento)|auth_uid' ORDER BY rol, n LOOP
    RAISE NOTICE 'LEAK % #% % :: %', r.rol, r.n, r.q, r.m; END LOOP;
  FOR r IN SELECT n, left(sql,70) q, string_agg(substr(rol,1,6) || '=' || CASE WHEN salida LIKE 'ERR:%' THEN substr(salida,1,40) ELSE 'ok' END, ' | ' ORDER BY rol) x FROM t.res GROUP BY n, sql ORDER BY n LOOP
    RAISE NOTICE 'M #% % :: %', r.n, r.q, r.x; END LOOP;
END $$;
SELECT t.summary();
ROLLBACK;
