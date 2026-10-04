-- 0235 · Plantilla facial de varias fotos (extension 17 de docs/DECISIONS.md).
-- Una plantilla (RN-12: una sola fila ACTIVA por alumno, un faiss_id) pasa a componerse de 3 a 8 fotos cuyos
-- embeddings promedia el servicio de reconocimiento (centroide). El vector NUNCA llega a la BD (RNF-03): aqui solo
-- viven rutas objeto_*, 4 medidas de calidad y un coseno escalar por foto (coseno_resto), informativos.
--
-- Diseno:
--  * Tabla hija plantilla_foto. La foto principal (la de plantilla_facial.objeto_foto) es SIEMPRE la fila orden = 1,
--    de modo que toda plantilla (heredada o nueva) tiene al menos una fila y ningun lector distingue ambas.
--    El invariante lo mantiene un trigger: RPC, fixtures, semilla e INSERT directos quedan coherentes sin tocar su codigo.
--  * Las fotos extra NO tienen bandera propia: su estado (activa / archivada / revocada) es el de la plantilla padre.
--    Se archivan o se conservan exactamente donde y cuando lo hace la foto principal (archivar = plantilla_facial.activa
--    = false, solo en api_plantilla_registrar al reemplazar y en api_consentimiento_revocar; ninguna ruta borra objetos
--    del bucket al archivar y todas las FK son RESTRICT).
--  * Sin RPC api_* nueva: cambian api_plantilla_registrar (5.o parametro opcional p_fotos), api_plantilla_alumno,
--    api_documento_url_autorizar (tipo 'plantilla_foto') y svc_indice_plan (objetos_foto).
--  * Compatible hacia atras: sin p_fotos todo es identico a 0231 (mas la fila orden = 1 por el trigger).
--  * Orden de despliegue: SQL, servicio de reconocimiento, web. En Supabase real, tras aplicarla hay que recargar el
--    esquema de PostgREST (NOTIFY pgrst, 'reload schema'; 0990 lo hace solo en instalaciones nuevas).
--
-- ROLLBACK (solo documentado): DROP TRIGGER trg_plantilla_foto_principal ON public.plantilla_facial;
--   DROP FUNCTION app.trg_plantilla_foto_principal(); DROP TABLE public.plantilla_foto;
--   DROP FUNCTION app.calidad_foto_valida(jsonb); y recrear api_plantilla_registrar de 4 argumentos desde 0231.

-- ---------------------------------------------------------------------------------------------
-- 1) Validador de la calidad por foto (lista blanca). Lo usan el CHECK y la RPC: asi la RPC responde VALIDACION y
-- nunca un 23514 crudo, y la columna jsonb no puede convertirse en un cajon de datos arbitrarios (ni de vectores).
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.calidad_foto_valida(p jsonb) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    k text;
    v jsonb;
    n numeric;
BEGIN
    IF p IS NULL THEN
        RETURN true;
    END IF;
    -- COALESCE: jsonb_typeof(NULL) es NULL y "NULL <> x" no dispara un IF.
    IF coalesce(jsonb_typeof(p), '') <> 'object' THEN
        RETURN false;
    END IF;
    FOR k, v IN SELECT key, value FROM jsonb_each(p) LOOP
        IF k IN ('brillo', 'nitidez', 'tamano_rostro_px') THEN
            IF coalesce(jsonb_typeof(v), '') <> 'number' THEN
                RETURN false;
            END IF;
            n := (v #>> '{}')::numeric;
            IF k = 'brillo' AND n NOT BETWEEN 0 AND 255 THEN
                RETURN false;
            ELSIF k = 'nitidez' AND n NOT BETWEEN 0 AND 1000000 THEN
                RETURN false;
            ELSIF k = 'tamano_rostro_px' AND (n NOT BETWEEN 0 AND 100000 OR n <> trunc(n)) THEN
                RETURN false;
            END IF;
        ELSIF k = 'frontal' THEN
            IF coalesce(jsonb_typeof(v), '') <> 'boolean' THEN
                RETURN false;
            END IF;
        ELSE
            RETURN false;
        END IF;
    END LOOP;
    RETURN true;
END
$$;
COMMENT ON FUNCTION app.calidad_foto_valida(jsonb) IS
    'true si la calidad de una foto es NULL o un objeto con solo brillo (0..255), nitidez (0..1000000), tamano_rostro_px (entero 0..100000) y frontal (booleano).';
GRANT EXECUTE ON FUNCTION app.calidad_foto_valida(jsonb) TO service_role;

-- ---------------------------------------------------------------------------------------------
-- 2) Tabla hija. Sin columna "incluida": lo que esta aqui es exactamente lo aceptado al registrar (las fotos
-- rechazadas no se suben: minimiza datos biometricos y evita guardar el rostro de un tercero).
-- ---------------------------------------------------------------------------------------------
CREATE TABLE public.plantilla_foto (
    id_foto       integer GENERATED ALWAYS AS IDENTITY,
    id_plantilla  integer NOT NULL,
    orden         smallint NOT NULL,
    objeto_foto   varchar(255) NOT NULL,
    calidad       jsonb,
    coseno_resto  numeric(4,3),
    CONSTRAINT pk_plantilla_foto PRIMARY KEY (id_foto),
    CONSTRAINT fk_plantilla_foto_plantilla FOREIGN KEY (id_plantilla) REFERENCES public.plantilla_facial (id_plantilla) ON DELETE RESTRICT,
    -- Tambien es el indice por id_plantilla (prefijo) que usan las lecturas.
    CONSTRAINT uq_plantilla_foto_orden UNIQUE (id_plantilla, orden),
    CONSTRAINT ck_plantilla_foto_orden CHECK (orden BETWEEN 1 AND 8),
    CONSTRAINT ck_plantilla_foto_coseno CHECK (coseno_resto IS NULL OR coseno_resto BETWEEN -1 AND 1),
    CONSTRAINT ck_plantilla_foto_calidad CHECK (app.calidad_foto_valida(calidad))
);
COMMENT ON TABLE public.plantilla_foto IS
    'Fotos que componen una plantilla facial (extension 17). orden 1 = foto principal = plantilla_facial.objeto_foto. Solo rutas objeto_* y escalares: ningun vector ni imagen (RNF-03). El estado archivada/activa es el de la plantilla padre.';
COMMENT ON COLUMN public.plantilla_foto.calidad IS
    '{brillo, nitidez, tamano_rostro_px, frontal} medidas por el servicio de reconocimiento al registrar; NULL en plantillas anteriores. Informativo.';
COMMENT ON COLUMN public.plantilla_foto.coseno_resto IS
    'Coseno medio de la foto contra las demas fotos aceptadas, medido por el servicio al registrar; NULL en plantillas de una foto. Informativo, no verificable en SQL.';

-- ---------------------------------------------------------------------------------------------
-- 3) Invariante: toda plantilla tiene su fila orden = 1 (la foto principal). DEFINER para escribir aunque
-- quien inserte la plantilla no tenga privilegios sobre plantilla_foto.
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION app.trg_plantilla_foto_principal() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
BEGIN
    INSERT INTO public.plantilla_foto (id_plantilla, orden, objeto_foto)
    VALUES (NEW.id_plantilla, 1, NEW.objeto_foto)
    ON CONFLICT (id_plantilla, orden) DO UPDATE SET objeto_foto = EXCLUDED.objeto_foto;
    RETURN NULL;
END
$$;
COMMENT ON FUNCTION app.trg_plantilla_foto_principal() IS
    'Mantiene plantilla_foto.orden = 1 igual a plantilla_facial.objeto_foto (alta y cambio de la foto principal).';

CREATE TRIGGER trg_plantilla_foto_principal
    AFTER INSERT OR UPDATE OF objeto_foto ON public.plantilla_facial
    FOR EACH ROW EXECUTE FUNCTION app.trg_plantilla_foto_principal();

-- ---------------------------------------------------------------------------------------------
-- 4) Backfill idempotente: las plantillas existentes (de una foto) reciben su fila orden = 1.
-- Sin tocar su indexacion ni su faiss_id: siguen en 'keep'.
-- ---------------------------------------------------------------------------------------------
INSERT INTO public.plantilla_foto (id_plantilla, orden, objeto_foto)
SELECT id_plantilla, 1, objeto_foto FROM public.plantilla_facial
ON CONFLICT (id_plantilla, orden) DO NOTHING;

-- ---------------------------------------------------------------------------------------------
-- 5) RLS y permisos. La tabla nace despues de 0030 y en local los stubs dan GRANT ALL por defecto: se revoca explicito.
-- Solo el administrador la lee (el docente sigue viendo la foto principal por plantilla_facial); nadie escribe
-- salvo las funciones DEFINER.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.plantilla_foto ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plantilla_foto FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.plantilla_foto_id_foto_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.plantilla_foto TO authenticated;
GRANT ALL ON public.plantilla_foto TO service_role;
GRANT ALL ON SEQUENCE public.plantilla_foto_id_foto_seq TO service_role;
CREATE POLICY admin_ve_todo ON public.plantilla_foto FOR SELECT TO authenticated
    USING ((SELECT app.es_admin()));

-- ---------------------------------------------------------------------------------------------
-- 6) api_plantilla_registrar con p_fotos. Se hace DROP de la firma de 4 argumentos: un overload haria ambigua la
-- llamada por nombre (y el adaptador local toma la primera funcion con ese nombre). p_ip sigue siendo el 4.o:
-- toda llamada posicional o por nombre de 0231 sigue valiendo.
-- Trampa de PL/pgSQL: jsonb_typeof(NULL) es NULL; en cada comprobacion de tipo se usa COALESCE o IS DISTINCT FROM.
-- ---------------------------------------------------------------------------------------------
DROP FUNCTION public.api_plantilla_registrar(integer, integer, text, inet);

CREATE FUNCTION public.api_plantilla_registrar(
    p_id_alumno   integer,
    p_id_consent  integer,
    p_objeto_foto text,
    p_ip          inet DEFAULT NULL,
    p_fotos       jsonb DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_estatus   public.estatus_alumno;
    c           public.consentimiento%ROWTYPE;
    v_ant_id    integer;
    v_ant_cons  integer;
    v_nueva     public.plantilla_facial%ROWTYPE;
    v_objeto    text := p_objeto_foto;
    v_fotos     jsonb := p_fotos;
    v_n         integer := 1;
    e           jsonb;
    v_cal       jsonb;
    v_cos       numeric;
BEGIN
    PERFORM app.exigir_rol('administrador');

    -- Serializa altas concurrentes del mismo alumno.
    SELECT a.estatus INTO v_estatus FROM public.alumno a WHERE a.id_alumno = p_id_alumno FOR UPDATE;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El alumno no existe.');
    END IF;
    IF v_estatus <> 'activo' THEN
        PERFORM app.fallar('ALUMNO_INACTIVO', 'El alumno no tiene estatus activo.');
    END IF;

    -- Un JSON null (PostgREST) equivale a no mandar p_fotos: camino heredado de una foto.
    IF v_fotos IS NOT NULL AND jsonb_typeof(v_fotos) = 'null' THEN
        v_fotos := NULL;
    END IF;

    IF v_fotos IS NULL THEN
        IF NOT app.es_ruta_objeto(p_objeto_foto, 'registro', p_id_alumno, 'jpg') THEN
            PERFORM app.fallar('RUTA_INVALIDA', 'La ruta del archivo no es válida para este registro.');
        END IF;
    ELSE
        -- (a) arreglo de 3 a 8 elementos.
        IF coalesce(jsonb_typeof(v_fotos), '') <> 'array'
           OR jsonb_array_length(v_fotos) NOT BETWEEN 3 AND 8 THEN
            PERFORM app.fallar('VALIDACION', 'Una plantilla de varias fotos lleva de 3 a 8 fotos.');
        END IF;
        v_n := jsonb_array_length(v_fotos);

        -- (b) forma de cada elemento: solo objeto_foto (texto), calidad y coseno_resto (ausentes o null JSON admitidos).
        FOR e IN SELECT value FROM jsonb_array_elements(v_fotos) LOOP
            IF coalesce(jsonb_typeof(e), '') <> 'object'
               OR coalesce(jsonb_typeof(e -> 'objeto_foto'), '') <> 'string'
               OR EXISTS (SELECT 1 FROM jsonb_object_keys(e) k WHERE k NOT IN ('objeto_foto', 'calidad', 'coseno_resto'))
            THEN
                PERFORM app.fallar('VALIDACION', 'La descripción de las fotos no es válida.');
            END IF;
            v_cal := e -> 'calidad';
            IF v_cal IS NOT NULL AND jsonb_typeof(v_cal) <> 'null' AND NOT app.calidad_foto_valida(v_cal) THEN
                PERFORM app.fallar('VALIDACION', 'La descripción de las fotos no es válida.');
            END IF;
            IF e -> 'coseno_resto' IS NOT NULL AND jsonb_typeof(e -> 'coseno_resto') <> 'null' THEN
                IF jsonb_typeof(e -> 'coseno_resto') <> 'number'
                   OR (e ->> 'coseno_resto')::numeric NOT BETWEEN -1 AND 1 THEN
                    PERFORM app.fallar('VALIDACION', 'La descripción de las fotos no es válida.');
                END IF;
            END IF;
        END LOOP;

        -- (c) cada ruta es del alumno y tiene el formato registro/{id_alumno}/{uuid}.jpg.
        FOR e IN SELECT value FROM jsonb_array_elements(v_fotos) LOOP
            IF NOT app.es_ruta_objeto(e ->> 'objeto_foto', 'registro', p_id_alumno, 'jpg') THEN
                PERFORM app.fallar('RUTA_INVALIDA', 'La ruta del archivo no es válida para este registro.');
            END IF;
        END LOOP;

        -- (d) sin rutas repetidas.
        IF (SELECT count(DISTINCT x ->> 'objeto_foto') FROM jsonb_array_elements(v_fotos) x) <> v_n THEN
            PERFORM app.fallar('VALIDACION', 'Las fotos no pueden repetirse.');
        END IF;

        -- (e) la principal es la primera de la lista (o no se manda aparte).
        IF p_objeto_foto IS NOT NULL AND p_objeto_foto <> (v_fotos -> 0 ->> 'objeto_foto') THEN
            PERFORM app.fallar('VALIDACION', 'La foto principal debe ser la primera de la lista.');
        END IF;
        v_objeto := v_fotos -> 0 ->> 'objeto_foto';
    END IF;

    SELECT * INTO c FROM public.consentimiento WHERE id_consent = p_id_consent;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El consentimiento no existe.');
    END IF;
    IF c.id_alumno <> p_id_alumno THEN
        PERFORM app.fallar('RN_13_CONSENTIMIENTO_AJENO', 'El consentimiento pertenece a otro alumno.');
    END IF;
    IF NOT app.consentimiento_vigente(p_id_consent) THEN
        PERFORM app.fallar('RN_13_CONSENTIMIENTO_NO_VIGENTE',
            'El consentimiento no está firmado y vigente: la alta se rechaza.');
    END IF;

    -- 1) archivar (la plantilla anterior conserva sus fotos en tabla y bucket, igual que su foto principal);
    -- 2) insertar (el trigger crea la fila orden = 1).
    SELECT p.id_plantilla, p.id_consent INTO v_ant_id, v_ant_cons
      FROM public.plantilla_facial p WHERE p.id_alumno = p_id_alumno AND p.activa;
    UPDATE public.plantilla_facial SET activa = false WHERE id_alumno = p_id_alumno AND activa;

    INSERT INTO public.plantilla_facial (id_alumno, id_consent, id_indice, faiss_id, objeto_foto, fecha_registro, activa)
    VALUES (p_id_alumno, p_id_consent, NULL, NULL, v_objeto, app.now(), true)
    RETURNING * INTO v_nueva;

    IF v_fotos IS NOT NULL THEN
        -- calidad y coseno_resto los aporta el llamador (servicio via ruta Next): informativos.
        FOR i IN 1..v_n LOOP
            e := v_fotos -> (i - 1);
            v_cal := CASE WHEN jsonb_typeof(e -> 'calidad') = 'object' THEN e -> 'calidad' END;
            v_cos := CASE WHEN jsonb_typeof(e -> 'coseno_resto') = 'number'
                          THEN round((e ->> 'coseno_resto')::numeric, 3) END;
            IF i = 1 THEN
                UPDATE public.plantilla_foto SET calidad = v_cal, coseno_resto = v_cos
                 WHERE id_plantilla = v_nueva.id_plantilla AND orden = 1;
            ELSE
                INSERT INTO public.plantilla_foto (id_plantilla, orden, objeto_foto, calidad, coseno_resto)
                VALUES (v_nueva.id_plantilla, i, e ->> 'objeto_foto', v_cal, v_cos);
            END IF;
        END LOOP;
    END IF;

    PERFORM app.bitacora('alta_plantilla', 'plantilla_facial', v_nueva.id_plantilla,
        CASE WHEN v_ant_id IS NULL THEN NULL
             ELSE jsonb_build_object('id_plantilla', v_ant_id, 'id_consent', v_ant_cons, 'activa', true) END,
        jsonb_build_object('id_plantilla', v_nueva.id_plantilla, 'id_consent', p_id_consent,
                           'objeto_foto', v_objeto, 'activa', true, 'plantilla_archivada', v_ant_id,
                           'n_fotos', v_n),
        p_ip);

    RETURN jsonb_build_object(
        'id_plantilla', v_nueva.id_plantilla,
        'id_alumno', p_id_alumno,
        'id_consent', p_id_consent,
        'activa', true,
        'indexada', false,
        'plantilla_archivada', v_ant_id,
        'fecha_registro', v_nueva.fecha_registro,
        'requiere_reconstruccion', true,
        'n_fotos', v_n);
END
$$;
COMMENT ON FUNCTION public.api_plantilla_registrar(integer, integer, text, inet, jsonb) IS
'Da de alta la plantilla facial (RN-12/RN-13), de una foto o de 3 a 8: archiva la activa anterior (con sus fotos, que NO se borran), inserta la nueva sin indexar y asienta alta_plantilla. Atomica: una falla no deja filas en plantilla_foto ni archiva la anterior. El promedio de los embeddings y el descarte de outliers ocurren en el servicio de reconocimiento (los vectores nunca tocan la BD, RNF-03); calidad y coseno_resto los aporta el llamador y son informativos, no verificables en SQL.
ARGS: p_id_alumno, p_id_consent (vigente y del mismo alumno), p_objeto_foto (registro/{id_alumno}/{uuid}.jpg; con p_fotos puede ser NULL o igual a la primera), p_ip (opc.), p_fotos (opc.; arreglo JSON de 3 a 8 objetos EN ORDEN DE CAPTURA, el primero es la foto principal; por elemento: objeto_foto (obligatoria, registro/{id_alumno}/{uuid}.jpg, sin repetidas), calidad (opc., null o {brillo 0..255, nitidez 0..1000000, tamano_rostro_px entero 0..100000, frontal boolean}) y coseno_resto (opc., null o numero entre -1 y 1, se guarda con 3 decimales); cualquier otra clave es invalida; un JSON null equivale a omitirlo)
RETURNS: {"id_plantilla":41,"id_alumno":17,"id_consent":9,"activa":true,"indexada":false,"plantilla_archivada":33,"fecha_registro":"2026-09-14T09:12:41-06:00","requiere_reconstruccion":true,"n_fotos":5}   (n_fotos = 1 sin p_fotos)
ERRORES: NO_AUTORIZADO, NO_ENCONTRADO (alumno o consentimiento), ALUMNO_INACTIVO, VALIDACION (p_fotos: cantidad, forma, repetidas, principal distinta de la primera), RUTA_INVALIDA, RN_13_CONSENTIMIENTO_AJENO, RN_13_CONSENTIMIENTO_NO_VIGENTE
ROLES: administrador';
REVOKE ALL ON FUNCTION public.api_plantilla_registrar(integer, integer, text, inet, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_plantilla_registrar(integer, integer, text, inet, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 7a) api_plantilla_alumno: claves nuevas dentro de 'activa' (n_fotos, coseno_min, coseno_medio, fotos) y n_fotos en las
-- archivadas. NUNCA emite objeto_foto. Respaldo: una plantilla sin filas (p. ej. cargada con session_replication_role
-- = replica) cuenta como de una foto y fotos = [].
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_plantilla_alumno(
    p_id_alumno integer,
    p_limit     integer DEFAULT 50,
    p_offset    integer DEFAULT 0
) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_limit    integer := least(greatest(coalesce(p_limit, 50), 1), 200);
    v_offset   integer := greatest(coalesce(p_offset, 0), 0);
    v_uso      public.indice_faiss%ROWTYPE;
    v_activa   jsonb;
    v_arch_tot integer;
    v_arch     jsonb;
BEGIN
    PERFORM app.exigir_rol('administrador');
    IF NOT EXISTS (SELECT 1 FROM public.alumno WHERE id_alumno = p_id_alumno) THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El alumno no existe.');
    END IF;

    SELECT * INTO v_uso FROM public.indice_faiss WHERE en_uso;

    SELECT jsonb_build_object(
               'id_plantilla', p.id_plantilla,
               'id_consent', p.id_consent,
               'fecha_registro', p.fecha_registro,
               'indexada', p.id_indice IS NOT NULL,
               'id_indice', p.id_indice,
               'version_indice', i.version,
               'faiss_id', p.faiss_id,
               'en_uso', (p.id_indice IS NOT NULL AND p.id_indice = v_uso.id_indice),
               'consentimiento_vigente', app.consentimiento_vigente(p.id_consent),
               'n_fotos', greatest(f.n, 1),
               'coseno_min', f.cmin,
               'coseno_medio', f.cmedio,
               'fotos', coalesce(f.fotos, '[]'::jsonb))
      INTO v_activa
      FROM public.plantilla_facial p
      LEFT JOIN public.indice_faiss i ON i.id_indice = p.id_indice
      CROSS JOIN LATERAL (
            SELECT count(*)::integer AS n,
                   min(pf.coseno_resto) AS cmin,
                   round(avg(pf.coseno_resto), 3) AS cmedio,
                   jsonb_agg(jsonb_build_object(
                       'id_foto', pf.id_foto, 'orden', pf.orden, 'principal', pf.orden = 1,
                       'calidad', pf.calidad, 'coseno_resto', pf.coseno_resto) ORDER BY pf.orden) AS fotos
              FROM public.plantilla_foto pf WHERE pf.id_plantilla = p.id_plantilla) f
     WHERE p.id_alumno = p_id_alumno AND p.activa;

    SELECT count(*) INTO v_arch_tot FROM public.plantilla_facial WHERE id_alumno = p_id_alumno AND NOT activa;
    SELECT coalesce(jsonb_agg(q.item ORDER BY q.fecha_registro DESC, q.id_plantilla DESC), '[]'::jsonb) INTO v_arch
      FROM (
        SELECT p.id_plantilla, p.fecha_registro,
               jsonb_build_object('id_plantilla', p.id_plantilla, 'id_consent', p.id_consent,
                                  'fecha_registro', p.fecha_registro,
                                  'n_fotos', greatest((SELECT count(*)::integer FROM public.plantilla_foto pf
                                                        WHERE pf.id_plantilla = p.id_plantilla), 1)) AS item
          FROM public.plantilla_facial p
         WHERE p.id_alumno = p_id_alumno AND NOT p.activa
         ORDER BY p.fecha_registro DESC, p.id_plantilla DESC
         LIMIT v_limit OFFSET v_offset
      ) q;

    RETURN jsonb_build_object(
        'id_alumno', p_id_alumno,
        'activa', v_activa,
        'archivadas', jsonb_build_object('total', v_arch_tot, 'items', v_arch),
        'indice_en_uso', CASE WHEN v_uso.id_indice IS NULL THEN NULL
                              ELSE jsonb_build_object('id_indice', v_uso.id_indice, 'version', v_uso.version) END);
END
$$;
COMMENT ON FUNCTION public.api_plantilla_alumno(integer, integer, integer) IS
'Plantilla facial activa de un alumno (con su version de indice y sus fotos) y las archivadas paginadas. Nunca devuelve rutas objeto_foto: la foto se abre con api_documento_url_autorizar (tipo plantilla o plantilla_foto). coseno_min y coseno_medio son la consistencia entre fotos medida por el servicio al registrar (informativa; null en plantillas de una foto).
ARGS: p_id_alumno, p_limit (def. 50, max 200; aplica a archivadas), p_offset
RETURNS: {"id_alumno":17,"activa":{"id_plantilla":41,"id_consent":9,"fecha_registro":"...","indexada":true,"id_indice":3,"version_indice":"v003","faiss_id":1042,"en_uso":true,"consentimiento_vigente":true,"n_fotos":5,"coseno_min":0.512|null,"coseno_medio":0.744|null,"fotos":[{"id_foto":101,"orden":1,"principal":true,"calidad":{"brillo":120.5,"nitidez":88.2,"tamano_rostro_px":210,"frontal":true}|null,"coseno_resto":0.812|null}]}|null,"archivadas":{"total":1,"items":[{"id_plantilla":33,"id_consent":4,"fecha_registro":"...","n_fotos":1}]},"indice_en_uso":{"id_indice":3,"version":"v003"}|null}
ERRORES: NO_AUTORIZADO, NO_ENCONTRADO (alumno)
ROLES: administrador';
REVOKE ALL ON FUNCTION public.api_plantilla_alumno(integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_plantilla_alumno(integer, integer, integer) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 7b) api_documento_url_autorizar: tipo nuevo 'plantilla_foto' (p_id_registro = id_foto). 'plantilla' sigue siendo la
-- foto principal. Cada emision asienta 'consulta' (RF-19) ANTES de devolver; ck_bitacora_entidad no cambia.
-- Funciona tambien para fotos de plantillas archivadas, igual que hoy.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_documento_url_autorizar(
    p_tipo        text,
    p_id_registro integer,
    p_ip          inet DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_alumno    integer;
    v_objeto    text;
    v_plantilla integer;
    v_orden     smallint;
    v_vigencia  integer;
BEGIN
    PERFORM app.exigir_rol('administrador');

    IF p_tipo IS NULL OR p_tipo NOT IN ('consentimiento', 'plantilla', 'plantilla_foto') THEN
        PERFORM app.fallar('VALIDACION', 'Tipo de documento no válido.');
    END IF;
    v_vigencia := least(app.param_num('vigencia_url_firmada_seg')::integer, 300);

    IF p_tipo = 'consentimiento' THEN
        SELECT c.id_alumno, c.objeto_documento INTO v_alumno, v_objeto
          FROM public.consentimiento c WHERE c.id_consent = p_id_registro;
        IF NOT FOUND THEN
            PERFORM app.fallar('NO_ENCONTRADO', 'El consentimiento no existe.');
        END IF;
        PERFORM app.bitacora('consulta', 'consentimiento', p_id_registro, NULL,
            jsonb_build_object('id_alumno', v_alumno), p_ip);
    ELSIF p_tipo = 'plantilla' THEN
        SELECT p.id_alumno, p.objeto_foto INTO v_alumno, v_objeto
          FROM public.plantilla_facial p WHERE p.id_plantilla = p_id_registro;
        IF NOT FOUND THEN
            PERFORM app.fallar('NO_ENCONTRADO', 'La plantilla no existe.');
        END IF;
        PERFORM app.bitacora('consulta', 'plantilla_facial', p_id_registro, NULL,
            jsonb_build_object('id_alumno', v_alumno), p_ip);
    ELSE
        SELECT p.id_alumno, pf.objeto_foto, p.id_plantilla, pf.orden INTO v_alumno, v_objeto, v_plantilla, v_orden
          FROM public.plantilla_foto pf JOIN public.plantilla_facial p ON p.id_plantilla = pf.id_plantilla
         WHERE pf.id_foto = p_id_registro;
        IF NOT FOUND THEN
            PERFORM app.fallar('NO_ENCONTRADO', 'La foto de la plantilla no existe.');
        END IF;
        PERFORM app.bitacora('consulta', 'plantilla_facial', v_plantilla, NULL,
            jsonb_build_object('id_alumno', v_alumno, 'id_foto', p_id_registro, 'orden', v_orden), p_ip);
        RETURN jsonb_build_object(
            'tipo', p_tipo,
            'id_registro', p_id_registro,
            'id_alumno', v_alumno,
            'id_plantilla', v_plantilla,
            'orden', v_orden,
            'objeto', v_objeto,
            'vigencia_seg', v_vigencia);
    END IF;

    RETURN jsonb_build_object(
        'tipo', p_tipo,
        'id_registro', p_id_registro,
        'id_alumno', v_alumno,
        'objeto', v_objeto,
        'vigencia_seg', v_vigencia);
END
$$;
COMMENT ON FUNCTION public.api_documento_url_autorizar(text, integer, inet) IS
'Autoriza la URL firmada de un documento/foto: devuelve la ruta y la vigencia (<= 300 s) y asienta consulta en bitacora (RF-19) antes de devolver. plantilla = foto principal de la plantilla; plantilla_foto = una foto concreta de la plantilla (p_id_registro = id_foto; la consulta se asienta sobre la plantilla con id_foto y orden). Tambien funciona para fotos de plantillas archivadas.
ARGS: p_tipo (consentimiento | plantilla | plantilla_foto), p_id_registro (id_consent, id_plantilla o id_foto), p_ip (opc.)
RETURNS: {"tipo":"plantilla","id_registro":41,"id_alumno":17,"objeto":"registro/17/<uuid>.jpg","vigencia_seg":300}   |   tipo plantilla_foto: {"tipo":"plantilla_foto","id_registro":<id_foto>,"id_alumno":17,"id_plantilla":41,"orden":3,"objeto":"registro/17/<uuid>.jpg","vigencia_seg":300}
ERRORES: NO_AUTORIZADO, VALIDACION (tipo), NO_ENCONTRADO
ROLES: administrador';
REVOKE ALL ON FUNCTION public.api_documento_url_autorizar(text, integer, inet) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_documento_url_autorizar(text, integer, inet) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 7c) svc_indice_plan: cada entry nueva (en_base = false) gana objetos_foto, todas las fotos por orden con la principal
-- primero (respaldo: [objeto_foto]); null si en_base. Solo plantillas ACTIVAS entran en el plan (incluidas las de
-- consentimiento vencido: vencer_consentimientos no archiva); las fotos de plantillas archivadas o revocadas quedan
-- fuera del indice igual que su foto principal.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.svc_indice_plan(p_completa boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_dim      integer := app.param_num('dimension_vector')::integer;
    v_uso      public.indice_faiss%ROWTYPE;
    v_base_id  integer;
    v_motivo   text;
    v_max      bigint;
    v_version  text;
    v_entries  jsonb;
    v_activas  integer;
    v_nuevas   integer;
    v_obs      integer;
BEGIN
    SELECT * INTO v_uso FROM public.indice_faiss WHERE en_uso;
    IF v_uso.id_indice IS NULL THEN
        v_motivo := 'sin_indice';
    ELSIF v_uso.dimension <> v_dim THEN
        v_motivo := 'dimension_cambiada';
    ELSIF coalesce(p_completa, false) THEN
        v_motivo := 'completa';
    ELSE
        v_base_id := v_uso.id_indice;
    END IF;

    SELECT coalesce(max(faiss_id), -1) INTO v_max FROM public.plantilla_facial;

    SELECT 'v' || lpad((1 + coalesce(max(substring(version FROM '^v([0-9]{1,15})$')::bigint), 0))::text, 3, '0')
      INTO v_version FROM public.indice_faiss;

    WITH act AS (
        SELECT p.id_plantilla, p.id_alumno, p.faiss_id, p.id_indice, p.objeto_foto,
               coalesce(v_base_id IS NOT NULL AND p.id_indice = v_base_id, false) AS en_base
          FROM public.plantilla_facial p WHERE p.activa
    ), num AS (
        SELECT a.*, row_number() OVER (PARTITION BY a.en_base ORDER BY a.id_plantilla) AS rn FROM act a
    )
    SELECT coalesce(jsonb_agg(jsonb_build_object(
               'id_plantilla', n.id_plantilla,
               'id_alumno', n.id_alumno,
               'faiss_id', CASE WHEN n.en_base THEN n.faiss_id ELSE v_max + n.rn END,
               'id_indice', n.id_indice,
               'en_base', n.en_base,
               'objeto_foto', n.objeto_foto,
               'objetos_foto', CASE WHEN n.en_base THEN NULL
                                    ELSE coalesce((SELECT jsonb_agg(pf.objeto_foto ORDER BY pf.orden)
                                                     FROM public.plantilla_foto pf
                                                    WHERE pf.id_plantilla = n.id_plantilla),
                                                  jsonb_build_array(n.objeto_foto)) END
               ) ORDER BY n.id_plantilla), '[]'::jsonb),
           count(*), count(*) FILTER (WHERE NOT n.en_base)
      INTO v_entries, v_activas, v_nuevas
      FROM num n;

    IF v_base_id IS NOT NULL THEN
        SELECT count(*) INTO v_obs FROM public.plantilla_facial WHERE NOT activa AND id_indice = v_base_id;
    ELSE
        v_obs := 0;
    END IF;

    RETURN jsonb_build_object(
        'dimension', v_dim,
        'version_sugerida', v_version,
        'base', CASE WHEN v_base_id IS NULL THEN NULL
                     ELSE jsonb_build_object('id_indice', v_uso.id_indice, 'version', v_uso.version,
                                             'objeto_indice', v_uso.objeto_indice,
                                             'total_vectores', v_uso.total_vectores) END,
        'motivo_sin_base', v_motivo,
        'totales', jsonb_build_object('activas', v_activas, 'nuevas', v_nuevas,
                                      'en_base', v_activas - v_nuevas, 'obsoletas', v_obs),
        'nada_que_hacer', (v_nuevas = 0 AND v_obs = 0 AND v_base_id IS NOT NULL),
        'entries', v_entries);
END
$$;
COMMENT ON FUNCTION public.svc_indice_plan(boolean) IS
'Plan de reconstruccion del indice: base (version en uso, o null), todas las plantillas activas con su faiss_id (los nuevos son max historico + posicion, nunca reutilizados), version sugerida y totales. Cada entry nueva trae objetos_foto (todas las fotos de la plantilla por orden, la principal primero; las plantillas de una foto traen un arreglo de 1) y las que estan en la base traen null: el servicio las conserva con keep. Solo plantillas activas; las fotos de plantillas archivadas o revocadas no entran. Solo lectura.
ARGS: p_completa (true = ignorar la base y reprocesar todas las fotos)
RETURNS: {"dimension":512,"version_sugerida":"v004","base":{"id_indice":3,"version":"v003","objeto_indice":"indice/v003.json","total_vectores":498}|null,"motivo_sin_base":null|"sin_indice"|"dimension_cambiada"|"completa","totales":{"activas":500,"nuevas":2,"en_base":498,"obsoletas":0},"nada_que_hacer":false,"entries":[{"id_plantilla":12,"id_alumno":3,"faiss_id":1001,"id_indice":3,"en_base":true,"objeto_foto":"registro/3/<uuid>.jpg","objetos_foto":null},{"id_plantilla":41,"id_alumno":17,"faiss_id":1043,"id_indice":null,"en_base":false,"objeto_foto":"registro/17/a.jpg","objetos_foto":["registro/17/a.jpg","registro/17/b.jpg","registro/17/c.jpg"]}]}
ERRORES: ninguno propio
ROLES: service_role';
REVOKE ALL ON FUNCTION public.svc_indice_plan(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.svc_indice_plan(boolean) TO service_role;
