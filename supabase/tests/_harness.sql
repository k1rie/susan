-- Harness de pruebas SQL de SUSAN (sin pgTAP: no existe en el PostgreSQL local).
-- scripts/test-sql.sh lo aplica UNA vez a la BD temporal; cada archivo de prueba corre despues en
-- su propia transaccion que termina en ROLLBACK, asi las pruebas no se contaminan entre si.
--
-- Esquema de un archivo de prueba:
--     BEGIN;
--     SELECT t.begin('nombre_del_archivo');
--     SELECT t.cargar_fixtures();            -- catalogo minimo (_fixtures.sql), reloj fijo
--     SELECT t.lives($q$ INSERT ... $q$, 'flujo valido');
--     SELECT t.throws($q$ INSERT ... $q$, '23514:ck_deteccion_score', 'score 1.2');
--     SELECT t.as_user('docente1@susan.test'); SELECT t.eq(t.n('SELECT 1 FROM asistencia'), 3::bigint, '...');
--     SELECT t.summary();
--     ROLLBACK;
--
-- Contadores: 'pos' = aserciones de flujo valido (ok, eq, lives, no_rows...), 'neg' = rechazos
-- esperados (throws), 'fail' = aserciones que no se cumplieron. Viven en GUC locales a la transaccion.

DROP SCHEMA IF EXISTS t CASCADE;
CREATE SCHEMA t;

CREATE FUNCTION t._inc(p_clave text) RETURNS void
    LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('t.' || p_clave,
        (coalesce(nullif(current_setting('t.' || p_clave, true), ''), '0')::int + 1)::text, true);
END
$$;

CREATE FUNCTION t.begin(p_archivo text) RETURNS void
    LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('t.archivo', p_archivo, true);
    PERFORM set_config('t.pos', '0', true);
    PERFORM set_config('t.neg', '0', true);
    PERFORM set_config('t.fail', '0', true);
END
$$;

CREATE FUNCTION t._falla(p_nombre text, p_detalle text) RETURNS void
    LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM t._inc('fail');
    RAISE NOTICE 'not ok - [%] %: %', current_setting('t.archivo', true), p_nombre, p_detalle;
END
$$;

-- Afirmacion booleana (flujo valido).
CREATE FUNCTION t.ok(p_cond boolean, p_nombre text) RETURNS boolean
    LANGUAGE plpgsql
AS $$
BEGIN
    IF p_cond IS TRUE THEN
        PERFORM t._inc('pos');
        RETURN true;
    END IF;
    PERFORM t._falla(p_nombre, 'la condicion no se cumplio (' || coalesce(p_cond::text, 'NULL') || ')');
    RETURN false;
END
$$;

-- Igualdad (NULL = NULL cuenta como igual).
CREATE FUNCTION t.eq(p_real anyelement, p_esperado anyelement, p_nombre text) RETURNS boolean
    LANGUAGE plpgsql
AS $$
BEGIN
    IF p_real IS NOT DISTINCT FROM p_esperado THEN
        PERFORM t._inc('pos');
        RETURN true;
    END IF;
    PERFORM t._falla(p_nombre, format('esperado %L, obtenido %L', p_esperado, p_real));
    RETURN false;
END
$$;

-- Sobrecarga para no tener que castear enteros en cada llamada (t.n() devuelve bigint).
CREATE FUNCTION t.eq(p_real bigint, p_esperado bigint, p_nombre text) RETURNS boolean
    LANGUAGE plpgsql
AS $$
BEGIN
    IF p_real IS NOT DISTINCT FROM p_esperado THEN
        PERFORM t._inc('pos');
        RETURN true;
    END IF;
    PERFORM t._falla(p_nombre, format('esperado %L, obtenido %L', p_esperado, p_real));
    RETURN false;
END
$$;

CREATE FUNCTION t.eq(p_real integer, p_esperado integer, p_nombre text) RETURNS boolean
    LANGUAGE plpgsql
AS $$
BEGIN
    IF p_real IS NOT DISTINCT FROM p_esperado THEN
        PERFORM t._inc('pos');
        RETURN true;
    END IF;
    PERFORM t._falla(p_nombre, format('esperado %L, obtenido %L', p_esperado, p_real));
    RETURN false;
END
$$;

-- Cuenta las filas de una consulta, con los privilegios y la RLS del rol actual.
CREATE FUNCTION t.n(p_consulta text) RETURNS bigint
    LANGUAGE plpgsql
AS $$
DECLARE
    v bigint;
BEGIN
    EXECUTE 'SELECT count(*) FROM (' || p_consulta || ') AS q' INTO v;
    RETURN v;
END
$$;

-- La sentencia debe ejecutarse sin error (flujo valido).
CREATE FUNCTION t.lives(p_sql text, p_nombre text) RETURNS boolean
    LANGUAGE plpgsql
AS $$
BEGIN
    BEGIN
        EXECUTE p_sql;
    EXCEPTION WHEN OTHERS THEN
        PERFORM t._falla(p_nombre, format('error inesperado [%s] %s', SQLSTATE, SQLERRM));
        RETURN false;
    END;
    PERFORM t._inc('pos');
    RETURN true;
END
$$;

-- Como t.lives, pero deshace la sentencia al terminar (savepoint): sirve para probar varios
-- flujos validos sobre el mismo estado de fixtures sin que uno contamine al siguiente.
CREATE FUNCTION t.lives_rb(p_sql text, p_nombre text) RETURNS boolean
    LANGUAGE plpgsql
AS $$
DECLARE
    v_error text := NULL;
BEGIN
    BEGIN
        EXECUTE p_sql;
        RAISE EXCEPTION 'rollback_de_prueba' USING ERRCODE = 'T0001';
    EXCEPTION
        WHEN SQLSTATE 'T0001' THEN NULL;
        WHEN OTHERS THEN v_error := format('error inesperado [%s] %s', SQLSTATE, SQLERRM);
    END;
    IF v_error IS NOT NULL THEN
        PERFORM t._falla(p_nombre, v_error);
        RETURN false;
    END IF;
    PERFORM t._inc('pos');
    RETURN true;
END
$$;

-- Ejecuta p_sql, evalua p_consulta (devuelve boolean) sobre el estado resultante y deshace todo.
CREATE FUNCTION t.efecto(p_sql text, p_consulta text, p_nombre text) RETURNS boolean
    LANGUAGE plpgsql
AS $$
DECLARE
    v_ok    boolean;
    v_error text := NULL;
BEGIN
    BEGIN
        EXECUTE p_sql;
        EXECUTE p_consulta INTO v_ok;
        RAISE EXCEPTION 'rollback_de_prueba' USING ERRCODE = 'T0001';
    EXCEPTION
        WHEN SQLSTATE 'T0001' THEN NULL;
        WHEN OTHERS THEN v_error := format('error inesperado [%s] %s', SQLSTATE, SQLERRM);
    END;
    IF v_error IS NOT NULL THEN
        PERFORM t._falla(p_nombre, v_error);
        RETURN false;
    END IF;
    RETURN t.ok(v_ok, p_nombre);
END
$$;

-- La sentencia debe ser rechazada. p_esperado = fichas separadas por ':'; cada una debe coincidir con
-- el SQLSTATE, el HINT, el nombre de la restriccion/regla o aparecer en el mensaje. Ej.:
--   '23514'  '23514:ck_deteccion_score'  'P0001:NO_AUTORIZADO'  'rn01_asistencia_inscripcion_activa'
CREATE FUNCTION t.throws(p_sql text, p_esperado text, p_nombre text) RETURNS boolean
    LANGUAGE plpgsql
AS $$
DECLARE
    v_estado text;
    v_msg    text;
    v_hint   text;
    v_cons   text;
    v_ficha  text;
    v_falta  text := '';
BEGIN
    BEGIN
        EXECUTE p_sql;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_estado = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT,
            v_hint = PG_EXCEPTION_HINT, v_cons = CONSTRAINT_NAME;
        FOREACH v_ficha IN ARRAY string_to_array(p_esperado, ':') LOOP
            IF NOT (v_ficha = v_estado OR v_ficha = coalesce(v_hint, '') OR v_ficha = coalesce(v_cons, '')
                    OR position(v_ficha IN v_msg) > 0) THEN
                v_falta := v_falta || ' ' || v_ficha;
            END IF;
        END LOOP;
        IF v_falta = '' THEN
            PERFORM t._inc('neg');
            RETURN true;
        END IF;
        PERFORM t._falla(p_nombre, format('rechazado pero sin%s; obtenido sqlstate=%s hint=%s constraint=%s msg=%s',
            v_falta, v_estado, coalesce(v_hint, '-'), coalesce(v_cons, '-'), left(v_msg, 120)));
        RETURN false;
    END;
    PERFORM t._falla(p_nombre, 'se esperaba un rechazo (' || p_esperado || ') y la sentencia se ejecuto');
    RETURN false;
END
$$;

-- ---------------------------------------------------------------------------------------------
-- Identidad y reloj
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION t.as_postgres() RETURNS void
    LANGUAGE plpgsql
AS $$
BEGIN
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    PERFORM set_config('request.jwt.claim.sub', '', true);
END
$$;

-- Se comporta como PostgREST: rol authenticated + claims con el auth_uid de la cuenta.
CREATE FUNCTION t.as_user(p_correo text) RETURNS void
    LANGUAGE plpgsql
AS $$
DECLARE
    v_uid uuid;
BEGIN
    RESET ROLE;
    SELECT u.auth_uid INTO v_uid FROM public.usuario u WHERE u.correo = p_correo;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'la cuenta de prueba % no existe (se carga en t.cargar_fixtures)', p_correo;
    END IF;
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', v_uid, 'role', 'authenticated', 'email', p_correo)::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
END
$$;

-- authenticated con un JWT valido pero sin cuenta en usuario.
CREATE FUNCTION t.as_uid_huerfano() RETURNS void
    LANGUAGE plpgsql
AS $$
BEGIN
    RESET ROLE;
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', '99999999-9999-4999-8999-999999999999', 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
END
$$;

CREATE FUNCTION t.as_anon() RETURNS void
    LANGUAGE plpgsql
AS $$
BEGIN
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    EXECUTE 'SET LOCAL ROLE anon';
END
$$;

CREATE FUNCTION t.as_service() RETURNS void
    LANGUAGE plpgsql
AS $$
BEGIN
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
    EXECUTE 'SET LOCAL ROLE service_role';
END
$$;

-- Fija app.fake_now para la transaccion (la BD de prueba habilita app.allow_fake_clock).
CREATE FUNCTION t.reloj(p_instante text) RETURNS void
    LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('app.fake_now', p_instante, true);
    IF NOT app.reloj_simulado() THEN
        RAISE EXCEPTION 'el reloj simulado no esta habilitado en esta BD (ALTER DATABASE ... SET app.allow_fake_clock = ''on'')';
    END IF;
END
$$;

-- Filas visibles por tabla para el rol actual (RLS incluida): {"alumno": 5, ...}. Una tabla sobre la que
-- el rol no tiene ni SELECT da -1 (permission denied). Sirve para describir "que ve cada rol".
CREATE FUNCTION t.conteos() RETURNS jsonb
    LANGUAGE plpgsql
AS $$
DECLARE
    v_tabla text;
    v_n     bigint;
    v_res   jsonb := '{}'::jsonb;
BEGIN
    FOREACH v_tabla IN ARRAY ARRAY['alumno', 'docente', 'materia', 'aula', 'grupo', 'horario_grupo', 'inscripcion',
        'sesion_clase', 'asistencia', 'justificante', 'consentimiento', 'indice_faiss', 'plantilla_facial', 'camara',
        'captura', 'deteccion', 'usuario', 'bitacora_auditoria', 'parametro_sistema']
    LOOP
        BEGIN
            EXECUTE format('SELECT count(*) FROM public.%I', v_tabla) INTO v_n;
        EXCEPTION WHEN insufficient_privilege THEN
            v_n := -1;
        END;
        v_res := v_res || jsonb_build_object(v_tabla, v_n);
    END LOOP;
    RETURN v_res;
END
$$;

-- Imprime la linea que lee scripts/test-sql.sh. Siempre al final del archivo.
CREATE FUNCTION t.summary() RETURNS void
    LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE 'SUMMARY file=% pos=% neg=% fail=%',
        current_setting('t.archivo', true), current_setting('t.pos', true),
        current_setting('t.neg', true), current_setting('t.fail', true);
END
$$;

GRANT USAGE ON SCHEMA t TO PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t TO PUBLIC;
