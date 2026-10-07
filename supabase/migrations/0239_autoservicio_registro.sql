-- 0239 · Autoservicio del alumno: aceptar su consentimiento y registrar su propio rostro (extension 19 de docs/DECISIONS.md).
-- RF-15, RF-16, RF-19, RN-12, RN-13, RNF-06. La spec (§1.2.1) ya dice que el alumno "otorga o no su consentimiento"; hasta hoy solo el
-- administrador podia capturarlo y registrar la plantilla. Con esta migracion el alumno lo hace por su cuenta y el administrador queda
-- como respaldo, auditor y quien revoca.
--
-- Principios:
--  * Las RPC del alumno (api_mi_*) NO reciben id_alumno: lo toman de la sesion (app.id_alumno()). No hay IDOR posible por parametro.
--  * Las RPC del administrador no cambian de contrato: api_plantilla_registrar solo se vuelve una envoltura de app.plantilla_registrar
--    (el cuerpo de 0235 sin cambios, mas la columna origen). Asi alumno y administrador comparten UNA sola regla RN-12/RN-13.
--  * El alumno no lee las tablas biometricas (siguen con RLS solo de administrador): api_mi_registro es DEFINER y devuelve solo el
--    estado de SU registro, sin rutas de objetos ni ids de otras personas.
--  * Candado antiabuso: como maximo `registros_diarios_alumno` registros de plantilla por alumno cada 24 h (cada uno reconstruye el indice).
--  * Antisuplantacion: svc_faiss_ids_otros_alumnos entrega a la ruta los faiss_id de TODOS los demas alumnos del indice en uso; la ruta
--    busca el rostro nuevo entre ellos y lo rechaza si ya pertenece a otra matricula (el vector sigue sin salir del servicio, RNF-03).
--  * Bitacora: alta_consentimiento y revocacion_consentimiento (valores nuevos del enum) con origen, version del aviso e IP.
--
-- Despliegue: aplicar este SQL y despues desplegar la web. Idempotente en lo que admite (ADD COLUMN/VALUE IF NOT EXISTS, CREATE OR REPLACE).
-- ROLLBACK (solo documentado): restaurar api_plantilla_registrar desde 0235; DROP FUNCTION public.api_mi_registro(), public.api_mi_consentimiento_aceptar(text,text,inet),
--   public.api_mi_consentimiento_revocar(inet), public.api_mi_plantilla_registrar(integer,text,inet,jsonb), public.svc_faiss_ids_otros_alumnos(integer),
--   app.plantilla_registrar(integer,integer,text,inet,jsonb,text); ALTER TABLE ... DROP COLUMN origen / version_aviso. Los valores del enum no se pueden quitar.

-- ---------------------------------------------------------------------------------------------
-- 1) Bitacora: dos acciones nuevas. Dentro de esta migracion no se usan (solo dentro de cuerpos plpgsql), asi que
-- ADD VALUE en la misma transaccion es valido.
-- ---------------------------------------------------------------------------------------------
ALTER TYPE public.accion_bitacora ADD VALUE IF NOT EXISTS 'alta_consentimiento';
ALTER TYPE public.accion_bitacora ADD VALUE IF NOT EXISTS 'revocacion_consentimiento';

-- ---------------------------------------------------------------------------------------------
-- 2) Quien dio de alta cada cosa y con que version del aviso. DEFAULT constante: ADD COLUMN solo toca metadatos.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.consentimiento ADD COLUMN IF NOT EXISTS origen varchar(14) NOT NULL DEFAULT 'administrador';
ALTER TABLE public.consentimiento ADD COLUMN IF NOT EXISTS version_aviso varchar(20);
ALTER TABLE public.plantilla_facial ADD COLUMN IF NOT EXISTS origen varchar(14) NOT NULL DEFAULT 'administrador';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.consentimiento'::regclass AND conname = 'ck_consentimiento_origen') THEN
        ALTER TABLE public.consentimiento ADD CONSTRAINT ck_consentimiento_origen CHECK (origen IN ('administrador', 'alumno'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.plantilla_facial'::regclass AND conname = 'ck_plantilla_origen') THEN
        ALTER TABLE public.plantilla_facial ADD CONSTRAINT ck_plantilla_origen CHECK (origen IN ('administrador', 'alumno'));
    END IF;
END
$$;

COMMENT ON COLUMN public.consentimiento.origen IS
    'Quien lo registro: administrador (PDF firmado a mano que el admin sube) o alumno (aceptacion en la app con constancia PDF generada por el sistema).';
COMMENT ON COLUMN public.consentimiento.version_aviso IS
    'Version del aviso de privacidad biometrico que se acepto (solo origen alumno); NULL en los registrados por el administrador.';
COMMENT ON COLUMN public.plantilla_facial.origen IS
    'Quien registro el rostro: administrador o alumno (autoservicio). Informativo y auditable; no cambia ninguna regla de reconocimiento.';

-- ---------------------------------------------------------------------------------------------
-- 2b) Constantes de negocio del autoservicio (una sola fuente para las RPC y sus pruebas).
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.autoregistro_limite() RETURNS integer
    LANGUAGE sql IMMUTABLE
    SET search_path = pg_catalog, pg_temp
AS $$ SELECT 5 $$;
COMMENT ON FUNCTION app.autoregistro_limite() IS 'Registros de plantilla que un alumno puede hacer por su cuenta cada 24 h (cada uno reconstruye el indice facial).';

CREATE OR REPLACE FUNCTION app.consentimiento_meses() RETURNS integer
    LANGUAGE sql IMMUTABLE
    SET search_path = pg_catalog, pg_temp
AS $$ SELECT 12 $$;
COMMENT ON FUNCTION app.consentimiento_meses() IS 'Vigencia, en meses, de un consentimiento aceptado por el alumno en la app.';

-- ---------------------------------------------------------------------------------------------
-- 3) app.plantilla_registrar: el cuerpo de api_plantilla_registrar (0235) sin la comprobacion de rol, con p_origen.
-- Lo llaman api_plantilla_registrar (administrador) y api_mi_plantilla_registrar (alumno). No tiene EXECUTE para nadie mas.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.plantilla_registrar(
    p_id_alumno   integer,
    p_id_consent  integer,
    p_objeto_foto text,
    p_ip          inet,
    p_fotos       jsonb,
    p_origen      text
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
    IF p_origen IS NULL OR p_origen NOT IN ('administrador', 'alumno') THEN
        PERFORM app.fallar('VALIDACION', 'El origen del registro no es válido.');
    END IF;

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

    INSERT INTO public.plantilla_facial (id_alumno, id_consent, id_indice, faiss_id, objeto_foto, fecha_registro, activa, origen)
    VALUES (p_id_alumno, p_id_consent, NULL, NULL, v_objeto, app.now(), true, p_origen)
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
                           'n_fotos', v_n, 'origen', p_origen),
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
COMMENT ON FUNCTION app.plantilla_registrar(integer, integer, text, inet, jsonb, text) IS
    'Nucleo compartido de api_plantilla_registrar (administrador) y api_mi_plantilla_registrar (alumno): RN-12 (archivar y luego insertar) y RN-13. Sin comprobacion de rol: la hacen quienes la llaman.';
REVOKE ALL ON FUNCTION app.plantilla_registrar(integer, integer, text, inet, jsonb, text) FROM PUBLIC, anon, authenticated;

-- La RPC del administrador conserva firma, argumentos, errores y comentario (CREATE OR REPLACE no cambia el comentario existente).
CREATE OR REPLACE FUNCTION public.api_plantilla_registrar(
    p_id_alumno   integer,
    p_id_consent  integer,
    p_objeto_foto text,
    p_ip          inet DEFAULT NULL,
    p_fotos       jsonb DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
BEGIN
    PERFORM app.exigir_rol('administrador');
    RETURN app.plantilla_registrar(p_id_alumno, p_id_consent, p_objeto_foto, p_ip, p_fotos, 'administrador');
END
$$;

-- ---------------------------------------------------------------------------------------------
-- 4) api_mi_registro: estado del registro del alumno de la sesion. DEFINER (el alumno no lee las tablas biometricas).
-- Devuelve lo que la pantalla necesita para decidir el paso; nunca rutas de objetos ni datos de otras personas.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_mi_registro() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_id        integer;
    a           public.alumno%ROWTYPE;
    v_hoy       date;
    c           public.consentimiento%ROWTYPE;
    v_cons      jsonb;
    p           public.plantilla_facial%ROWTYPE;
    v_plan      jsonb;
    v_ind       public.indice_faiss%ROWTYPE;
    v_registros integer;
    v_completo  boolean;
    v_paso      text;
BEGIN
    PERFORM app.exigir_rol('alumno');
    v_id := app.id_alumno();
    IF v_id IS NULL THEN
        PERFORM app.fallar('CUENTA_NO_VINCULADA', 'Tu cuenta no está vinculada a un alumno. Contacta al administrador.');
    END IF;
    v_hoy := app.hoy();
    SELECT * INTO a FROM public.alumno WHERE id_alumno = v_id;

    -- El consentimiento vigente de mayor vigencia (igual criterio que api_consentimientos_alumno).
    SELECT x.* INTO c
      FROM public.consentimiento x
     WHERE x.id_alumno = v_id AND app.consentimiento_vigente(x.id_consent)
     ORDER BY x.vigencia_hasta DESC, x.id_consent DESC
     LIMIT 1;
    IF FOUND THEN
        v_cons := jsonb_build_object(
            'id_consent', c.id_consent,
            'fecha_firma', c.fecha_firma,
            'vigencia_hasta', c.vigencia_hasta,
            'dias_restantes', c.vigencia_hasta - v_hoy,
            'origen', c.origen,
            'version_aviso', c.version_aviso);
    END IF;

    SELECT * INTO v_ind FROM public.indice_faiss WHERE en_uso;
    SELECT x.* INTO p FROM public.plantilla_facial x WHERE x.id_alumno = v_id AND x.activa;
    IF FOUND THEN
        v_plan := jsonb_build_object(
            'id_plantilla', p.id_plantilla,
            'id_consent', p.id_consent,
            'fecha_registro', p.fecha_registro,
            'indexada', p.id_indice IS NOT NULL,
            'en_uso', (p.id_indice IS NOT NULL AND p.id_indice = v_ind.id_indice),
            'n_fotos', (SELECT count(*) FROM public.plantilla_foto f WHERE f.id_plantilla = p.id_plantilla),
            'origen', p.origen,
            'consentimiento_vigente', app.consentimiento_vigente(p.id_consent));
    END IF;

    SELECT count(*) INTO v_registros
      FROM public.plantilla_facial x
     WHERE x.id_alumno = v_id AND x.origen = 'alumno' AND x.fecha_registro > app.now() - interval '24 hours';

    -- "Completo": hay consentimiento vigente y una plantilla activa amparada por un consentimiento vigente.
    v_completo := v_cons IS NOT NULL AND v_plan IS NOT NULL AND coalesce((v_plan ->> 'consentimiento_vigente')::boolean, false);
    v_paso := CASE WHEN v_cons IS NULL THEN 'consentimiento'
                   WHEN v_completo THEN 'listo'
                   ELSE 'rostro' END;

    RETURN jsonb_build_object(
        'id_alumno', a.id_alumno,
        'matricula', a.matricula,
        'nombre', a.nombres || ' ' || a.apellido_paterno || coalesce(' ' || a.apellido_materno, ''),
        'estatus', a.estatus,
        'hoy', v_hoy,
        'ahora', app.now(),
        'puede_registrar', a.estatus = 'activo',
        'consentimiento', v_cons,
        'plantilla', v_plan,
        'completo', v_completo,
        'paso', v_paso,
        'vigencia_meses', app.consentimiento_meses(),
        'vigencia_prevista', (v_hoy + make_interval(months => app.consentimiento_meses()))::date,
        'registros_24h', v_registros,
        'limite_registros_24h', app.autoregistro_limite());
END
$$;
COMMENT ON FUNCTION public.api_mi_registro() IS
'Estado del registro biometrico del alumno de la sesion: consentimiento vigente, plantilla activa y el paso que sigue (consentimiento | rostro | listo). No recibe id_alumno: sale de la sesion.
ARGS: ninguno
RETURNS: {"id_alumno":17,"matricula":"E20230045","nombre":"Ana Perez Lopez","estatus":"activo","hoy":"2026-10-07","ahora":"2026-10-07T09:12:41-06:00","puede_registrar":true,"consentimiento":{"id_consent":9,"fecha_firma":"2026-10-07","vigencia_hasta":"2027-10-07","dias_restantes":365,"origen":"alumno","version_aviso":"2026-10"}|null,"plantilla":{"id_plantilla":41,"id_consent":9,"fecha_registro":"...","indexada":true,"en_uso":true,"n_fotos":5,"origen":"alumno","consentimiento_vigente":true}|null,"completo":true,"paso":"listo","vigencia_meses":12,"vigencia_prevista":"2027-10-07","registros_24h":1,"limite_registros_24h":5}
ERRORES: NO_AUTENTICADO, CUENTA_INACTIVA, NO_AUTORIZADO (no es alumno), CUENTA_NO_VINCULADA
ROLES: alumno';
REVOKE ALL ON FUNCTION public.api_mi_registro() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_mi_registro() TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 5) api_mi_consentimiento_aceptar: el alumno acepta el aviso con su sesion iniciada. La constancia PDF (nombre, matricula, fecha,
-- IP, version del aviso) la genera la ruta y ya esta en el bucket cuando se llama; la fecha de firma es hoy y la vigencia, 12 meses.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_mi_consentimiento_aceptar(
    p_objeto_documento text,
    p_version_aviso    text,
    p_ip               inet DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_id      integer;
    v_estatus public.estatus_alumno;
    v_hoy     date;
    c         public.consentimiento%ROWTYPE;
BEGIN
    PERFORM app.exigir_rol('alumno');
    v_id := app.id_alumno();
    IF v_id IS NULL THEN
        PERFORM app.fallar('CUENTA_NO_VINCULADA', 'Tu cuenta no está vinculada a un alumno. Contacta al administrador.');
    END IF;
    v_hoy := app.hoy();

    -- Serializa doble clic y dos pestanas: la segunda ve el consentimiento de la primera.
    SELECT a.estatus INTO v_estatus FROM public.alumno a WHERE a.id_alumno = v_id FOR UPDATE;
    IF v_estatus <> 'activo' THEN
        PERFORM app.fallar('ALUMNO_INACTIVO', 'El alumno no tiene estatus activo.');
    END IF;

    IF p_version_aviso IS NULL OR btrim(p_version_aviso) = '' OR length(p_version_aviso) > 20 THEN
        PERFORM app.fallar('VALIDACION', 'La versión del aviso es obligatoria (máximo 20 caracteres).');
    END IF;
    IF NOT app.es_ruta_objeto(p_objeto_documento, 'consentimientos', v_id, 'pdf') THEN
        PERFORM app.fallar('RUTA_INVALIDA', 'La ruta del archivo no es válida para este registro.');
    END IF;
    IF app.tiene_consentimiento_vigente(v_id) THEN
        PERFORM app.fallar('CONSENTIMIENTO_YA_VIGENTE', 'Ya aceptaste el aviso y tu consentimiento sigue vigente.');
    END IF;

    INSERT INTO public.consentimiento (id_alumno, fecha_firma, vigencia_hasta, objeto_documento, estatus, origen, version_aviso)
    VALUES (v_id, v_hoy, (v_hoy + make_interval(months => app.consentimiento_meses()))::date, p_objeto_documento, 'vigente', 'alumno', btrim(p_version_aviso))
    RETURNING * INTO c;

    PERFORM app.bitacora('alta_consentimiento', 'consentimiento', c.id_consent, NULL,
        jsonb_build_object('id_consent', c.id_consent, 'id_alumno', v_id, 'fecha_firma', c.fecha_firma,
                           'vigencia_hasta', c.vigencia_hasta, 'origen', 'alumno', 'version_aviso', c.version_aviso),
        p_ip);

    RETURN jsonb_build_object(
        'id_consent', c.id_consent,
        'id_alumno', c.id_alumno,
        'fecha_firma', c.fecha_firma,
        'vigencia_hasta', c.vigencia_hasta,
        'estatus', c.estatus,
        'vigente', app.consentimiento_vigente(c.id_consent),
        'origen', c.origen,
        'version_aviso', c.version_aviso);
END
$$;
COMMENT ON FUNCTION public.api_mi_consentimiento_aceptar(text, text, inet) IS
'El alumno de la sesion acepta el aviso de privacidad biometrico: registra su consentimiento (firma hoy, vigencia 12 meses) con la constancia PDF ya subida, y lo asienta en bitacora. No recibe id_alumno.
ARGS: p_objeto_documento (consentimientos/{id_alumno}/{uuid}.pdf), p_version_aviso (<= 20 caracteres), p_ip (opc.)
RETURNS: {"id_consent":9,"id_alumno":17,"fecha_firma":"2026-10-07","vigencia_hasta":"2027-10-07","estatus":"vigente","vigente":true,"origen":"alumno","version_aviso":"2026-10"}
ERRORES: NO_AUTORIZADO (no es alumno), CUENTA_NO_VINCULADA, ALUMNO_INACTIVO, VALIDACION (version), RUTA_INVALIDA, CONSENTIMIENTO_YA_VIGENTE
ROLES: alumno';
REVOKE ALL ON FUNCTION public.api_mi_consentimiento_aceptar(text, text, inet) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_mi_consentimiento_aceptar(text, text, inet) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 6) api_mi_consentimiento_revocar: el alumno retira su consentimiento. Revoca todos sus consentimientos vigentes y archiva las
-- plantillas ligadas (RNF-06): desde ese momento solo hay pase manual hasta que acepte de nuevo. Una sola transaccion.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_mi_consentimiento_revocar(p_ip inet DEFAULT NULL) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_id         integer;
    c            public.consentimiento%ROWTYPE;
    v_revocados  integer := 0;
    v_archivadas integer := 0;
    v_indexadas  integer := 0;
    v_a          integer;
    v_i          integer;
BEGIN
    PERFORM app.exigir_rol('alumno');
    v_id := app.id_alumno();
    IF v_id IS NULL THEN
        PERFORM app.fallar('CUENTA_NO_VINCULADA', 'Tu cuenta no está vinculada a un alumno. Contacta al administrador.');
    END IF;

    PERFORM 1 FROM public.alumno a WHERE a.id_alumno = v_id FOR UPDATE;

    FOR c IN SELECT x.* FROM public.consentimiento x WHERE x.id_alumno = v_id AND x.estatus = 'vigente' ORDER BY x.id_consent FOR UPDATE LOOP
        UPDATE public.consentimiento SET estatus = 'revocado' WHERE id_consent = c.id_consent;
        WITH arch AS (
            UPDATE public.plantilla_facial SET activa = false
             WHERE id_consent = c.id_consent AND activa
            RETURNING id_indice)
        SELECT count(*), count(id_indice) INTO v_a, v_i FROM arch;
        v_revocados := v_revocados + 1;
        v_archivadas := v_archivadas + v_a;
        v_indexadas := v_indexadas + v_i;
        PERFORM app.bitacora('revocacion_consentimiento', 'consentimiento', c.id_consent,
            jsonb_build_object('estatus', 'vigente'),
            jsonb_build_object('estatus', 'revocado', 'origen', 'alumno', 'plantillas_archivadas', v_a),
            p_ip);
    END LOOP;

    IF v_revocados = 0 THEN
        PERFORM app.fallar('RN_13_CONSENTIMIENTO_NO_VIGENTE', 'No tienes un consentimiento vigente que revocar.');
    END IF;

    RETURN jsonb_build_object(
        'id_alumno', v_id,
        'consentimientos_revocados', v_revocados,
        'plantillas_archivadas', v_archivadas,
        'requiere_reconstruccion', v_indexadas > 0);
END
$$;
COMMENT ON FUNCTION public.api_mi_consentimiento_revocar(inet) IS
'El alumno de la sesion revoca su consentimiento vigente y se archivan sus plantillas activas (pase manual). Asienta revocacion_consentimiento. No recibe id_alumno.
ARGS: p_ip (opc.)
RETURNS: {"id_alumno":17,"consentimientos_revocados":1,"plantillas_archivadas":1,"requiere_reconstruccion":true}
ERRORES: NO_AUTORIZADO (no es alumno), CUENTA_NO_VINCULADA, RN_13_CONSENTIMIENTO_NO_VIGENTE (no hay uno vigente)
ROLES: alumno';
REVOKE ALL ON FUNCTION public.api_mi_consentimiento_revocar(inet) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_mi_consentimiento_revocar(inet) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 7) api_mi_plantilla_registrar: el alumno registra su propio rostro. Mismo nucleo que el administrador (RN-12/RN-13) mas el
-- candado antiabuso de 5 registros por 24 h (cada uno reconstruye el indice facial).
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_mi_plantilla_registrar(
    p_id_consent  integer,
    p_objeto_foto text,
    p_ip          inet DEFAULT NULL,
    p_fotos       jsonb DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_id      integer;
    v_hoy_n   integer;
BEGIN
    PERFORM app.exigir_rol('alumno');
    v_id := app.id_alumno();
    IF v_id IS NULL THEN
        PERFORM app.fallar('CUENTA_NO_VINCULADA', 'Tu cuenta no está vinculada a un alumno. Contacta al administrador.');
    END IF;

    -- Bloquea al alumno antes de contar: dos registros simultaneos no pasan el candado a la vez.
    PERFORM 1 FROM public.alumno a WHERE a.id_alumno = v_id FOR UPDATE;
    SELECT count(*) INTO v_hoy_n
      FROM public.plantilla_facial x
     WHERE x.id_alumno = v_id AND x.origen = 'alumno' AND x.fecha_registro > app.now() - interval '24 hours';
    IF v_hoy_n >= app.autoregistro_limite() THEN
        PERFORM app.fallar('AUTOREGISTRO_LIMITE',
            'Alcanzaste el límite de registros faciales de hoy. Inténtalo mañana o acude a tu coordinación.');
    END IF;

    RETURN app.plantilla_registrar(v_id, p_id_consent, p_objeto_foto, p_ip, p_fotos, 'alumno');
END
$$;
COMMENT ON FUNCTION public.api_mi_plantilla_registrar(integer, text, inet, jsonb) IS
'El alumno de la sesion registra su propia plantilla facial (RN-12/RN-13): igual que api_plantilla_registrar pero sin id_alumno (sale de la sesion), con origen alumno y un maximo de 5 registros por 24 h.
ARGS: p_id_consent (vigente y del propio alumno), p_objeto_foto (registro/{id_alumno}/{uuid}.jpg; con p_fotos puede ser NULL o igual a la primera), p_ip (opc.), p_fotos (opc.; arreglo JSON de 3 a 8 objetos con la misma forma que en api_plantilla_registrar)
RETURNS: {"id_plantilla":41,"id_alumno":17,"id_consent":9,"activa":true,"indexada":false,"plantilla_archivada":33,"fecha_registro":"2026-10-07T09:12:41-06:00","requiere_reconstruccion":true,"n_fotos":5}
ERRORES: NO_AUTORIZADO (no es alumno), CUENTA_NO_VINCULADA, AUTOREGISTRO_LIMITE, ALUMNO_INACTIVO, VALIDACION, RUTA_INVALIDA, RN_13_CONSENTIMIENTO_AJENO, RN_13_CONSENTIMIENTO_NO_VIGENTE
ROLES: alumno';
REVOKE ALL ON FUNCTION public.api_mi_plantilla_registrar(integer, text, inet, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_mi_plantilla_registrar(integer, text, inet, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 8) svc_faiss_ids_otros_alumnos: los faiss_id de las plantillas activas e indexadas en el indice en uso de TODOS los demas alumnos
-- activos. La ruta del alumno los pasa como allowed_faiss_ids al servicio para comprobar que el rostro nuevo no es ya de otra matricula.
-- Solo service_role. Devuelve unicamente enteros: ni ids de alumno ni de plantilla.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.svc_faiss_ids_otros_alumnos(p_id_alumno integer) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_version text;
    v_ids     jsonb;
BEGIN
    IF p_id_alumno IS NULL THEN
        PERFORM app.fallar('VALIDACION', 'El alumno es obligatorio.');
    END IF;
    SELECT i.version INTO v_version FROM public.indice_faiss i WHERE i.en_uso;
    IF v_version IS NULL THEN
        RETURN jsonb_build_object('indice', NULL, 'faiss_ids', '[]'::jsonb);
    END IF;

    SELECT coalesce(jsonb_agg(p.faiss_id ORDER BY p.faiss_id), '[]'::jsonb) INTO v_ids
      FROM public.plantilla_facial p
      JOIN public.indice_faiss i ON i.id_indice = p.id_indice AND i.en_uso
      JOIN public.alumno a ON a.id_alumno = p.id_alumno AND a.estatus = 'activo'
     WHERE p.activa AND p.faiss_id IS NOT NULL AND p.id_alumno <> p_id_alumno;

    RETURN jsonb_build_object('indice', v_version, 'faiss_ids', v_ids);
END
$$;
COMMENT ON FUNCTION public.svc_faiss_ids_otros_alumnos(integer) IS
'faiss_id de las plantillas activas e indexadas (indice en uso) de todos los alumnos activos salvo p_id_alumno, para comprobar que un rostro nuevo no pertenece ya a otra matricula. Solo enteros.
ARGS: p_id_alumno
RETURNS: {"indice":"v004","faiss_ids":[1,2,3]}   (indice = null y faiss_ids = [] si no hay indice en uso)
ERRORES: VALIDACION (alumno nulo)
ROLES: service_role';
REVOKE ALL ON FUNCTION public.svc_faiss_ids_otros_alumnos(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.svc_faiss_ids_otros_alumnos(integer) TO service_role;
