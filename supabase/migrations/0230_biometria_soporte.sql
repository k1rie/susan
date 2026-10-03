-- 0230 · Biometria: soporte interno (esquema app).
--   app.es_ruta_objeto        valida rutas de objetos del bucket ligadas a un alumno
--   app.bloqueo (+ adquirir/liberar)  arrendamientos con vencimiento para jobs e indice
--   app.vencer_consentimientos        pasa a 'vencido' los consentimientos fuera de vigencia (RN-13)
-- Documento de referencia: docs/api/biometria.md (las secciones 5.x no se llegaron a escribir; esto las define).
-- Idempotente: CREATE OR REPLACE / IF NOT EXISTS.

-- ---------------------------------------------------------------------------------------------
-- Rutas de objeto: '<prefijo>/<id_alumno>/<uuid>.<ext>'. Sin interpolar entrada en expresiones
-- regulares: el prefijo y el id se comparan como texto; solo la extension (alfanumerica) y el uuid
-- entran en la expresion.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.es_ruta_objeto(p_ruta text, p_prefijo text, p_id_alumno integer, p_ext text)
    RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    v_pre text;
BEGIN
    IF p_ruta IS NULL OR p_prefijo IS NULL OR p_id_alumno IS NULL OR p_ext IS NULL
       OR p_ext !~ '^[a-z0-9]{1,8}$' OR length(p_ruta) > 255 THEN
        RETURN false;
    END IF;
    v_pre := p_prefijo || '/' || p_id_alumno::text || '/';
    IF left(p_ruta, length(v_pre)) <> v_pre THEN
        RETURN false;
    END IF;
    RETURN substr(p_ruta, length(v_pre) + 1) ~
        ('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.' || p_ext || '$');
END
$$;
COMMENT ON FUNCTION app.es_ruta_objeto(text, text, integer, text) IS
    'true si la ruta es <prefijo>/<id_alumno>/<uuid>.<ext> (<= 255 caracteres); sirve para que un alumno no ligue objetos de otro.';
GRANT EXECUTE ON FUNCTION app.es_ruta_objeto(text, text, integer, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Bloqueos con arrendamiento. Tabla privada del esquema app: sin acceso para los roles de la API.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.bloqueo (
    clave   varchar(80) NOT NULL,
    dueno   varchar(80) NOT NULL,
    vence   timestamptz NOT NULL,
    CONSTRAINT pk_bloqueo PRIMARY KEY (clave)
);
COMMENT ON TABLE app.bloqueo IS 'Arrendamientos con vencimiento (indice FAISS, jobs). Solo via app.bloqueo_adquirir/liberar.';
ALTER TABLE app.bloqueo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app.bloqueo FROM PUBLIC, anon, authenticated;

-- true si lo obtuvo (no existia, vencio, o ya era del mismo dueno: lo renueva); false si lo tiene otro vigente.
CREATE OR REPLACE FUNCTION app.bloqueo_adquirir(p_clave text, p_dueno text, p_ttl_seg integer DEFAULT 900)
    RETURNS boolean
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_n integer;
BEGIN
    IF p_clave IS NULL OR btrim(p_clave) = '' OR length(p_clave) > 80 THEN
        PERFORM app.fallar('VALIDACION', 'La clave del bloqueo es obligatoria (máximo 80 caracteres).');
    END IF;
    IF p_dueno IS NULL OR btrim(p_dueno) = '' OR length(p_dueno) > 80 THEN
        PERFORM app.fallar('VALIDACION', 'El dueño del bloqueo es obligatorio (máximo 80 caracteres).');
    END IF;
    IF p_ttl_seg IS NULL OR p_ttl_seg NOT BETWEEN 10 AND 7200 THEN
        PERFORM app.fallar('VALIDACION', 'La vigencia del bloqueo debe estar entre 10 y 7200 segundos.');
    END IF;

    INSERT INTO app.bloqueo AS b (clave, dueno, vence)
    VALUES (p_clave, p_dueno, app.now() + make_interval(secs => p_ttl_seg))
    ON CONFLICT (clave) DO UPDATE
        SET dueno = EXCLUDED.dueno, vence = EXCLUDED.vence
        WHERE b.dueno = EXCLUDED.dueno OR b.vence <= app.now();
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RETURN v_n > 0;
END
$$;
COMMENT ON FUNCTION app.bloqueo_adquirir(text, text, integer) IS
    'Arrienda el bloqueo p_clave a p_dueno por p_ttl_seg (10-7200). true si lo obtuvo o renovo; false si otro dueno lo tiene vigente.';
GRANT EXECUTE ON FUNCTION app.bloqueo_adquirir(text, text, integer) TO service_role;

-- true solo si el dueno coincide (y lo elimina).
CREATE OR REPLACE FUNCTION app.bloqueo_liberar(p_clave text, p_dueno text)
    RETURNS boolean
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_n integer;
BEGIN
    DELETE FROM app.bloqueo WHERE clave = p_clave AND dueno = p_dueno;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RETURN v_n > 0;
END
$$;
COMMENT ON FUNCTION app.bloqueo_liberar(text, text) IS 'Libera el bloqueo si p_dueno es su dueno; true si lo libero.';
GRANT EXECUTE ON FUNCTION app.bloqueo_liberar(text, text) TO service_role;

-- ---------------------------------------------------------------------------------------------
-- Vencimiento de consentimientos (RN-13): vigencia_hasta < hoy => 'vencido'. Deja asiento en la
-- bitacora como 'correccion' de la entidad consentimiento (el enum no tiene accion propia; exige
-- valor anterior y nuevo). Devuelve cuantos vencio. Idempotente. No archiva plantillas: el
-- reconocimiento ya se corta porque app.consentimiento_vigente() compara fechas.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.vencer_consentimientos() RETURNS integer
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    r       record;
    v_total integer := 0;
BEGIN
    FOR r IN
        UPDATE public.consentimiento c
           SET estatus = 'vencido'
         WHERE c.estatus = 'vigente' AND c.vigencia_hasta < app.hoy()
        RETURNING c.id_consent, c.id_alumno, c.vigencia_hasta
    LOOP
        PERFORM app.bitacora('correccion', 'consentimiento', r.id_consent,
            jsonb_build_object('estatus', 'vigente'),
            jsonb_build_object('estatus', 'vencido', 'motivo', 'vigencia_terminada',
                               'id_alumno', r.id_alumno, 'vigencia_hasta', r.vigencia_hasta));
        v_total := v_total + 1;
    END LOOP;
    RETURN v_total;
END
$$;
COMMENT ON FUNCTION app.vencer_consentimientos() IS
    'Pasa a vencido los consentimientos vigentes con vigencia_hasta < app.hoy() y asienta bitacora; devuelve cuantos.';
GRANT EXECUTE ON FUNCTION app.vencer_consentimientos() TO service_role;
