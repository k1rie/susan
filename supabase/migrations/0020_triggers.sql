-- 0020 · Los seis disparadores de la especificacion (3.4.3, Tabla 12).
--   trg_asistencia_rn01      RN-01  inscripcion activa (con FOR SHARE)
--   trg_asistencia_ciclo     RN-02/05/06/07/09  maquina de estados de asistencia.estado
--   trg_captura_rn06         RN-06  la camara de la captura esta en el aula del grupo de la sesion
--   trg_plantilla_rn13       RN-13  consentimiento del mismo alumno, vigente y en fecha
--   trg_bitacora_sin_cambios RNF-08 la bitacora no admite UPDATE ni DELETE
--   trg_bitacora_sin_truncate RNF-08 ni TRUNCATE
--
-- Convencion de rechazo: el mensaje empieza con el nombre de la regla (p. ej.
-- rn01_asistencia_inscripcion_activa) y se reporta con ERRCODE 23514 (check_violation) y
-- CONSTRAINT = nombre de la regla, para que el motor indique exactamente que regla se violo
-- igual que lo hace con un CHECK. La bitacora usa 23000 (integrity_constraint_violation).
-- Las funciones son SECURITY DEFINER para ver las filas de apoyo sin depender de la RLS de quien escribe.

CREATE FUNCTION app.rechazar_regla(p_regla text, p_detalle text) RETURNS void
    LANGUAGE plpgsql
    SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION '%: %', p_regla, p_detalle USING ERRCODE = 'check_violation', CONSTRAINT = p_regla;
END
$$;

-- ---------------------------------------------------------------------------------------------
-- RN-01: antes de insertar, o de cambiar id_sesion / id_alumno, exige una inscripcion ACTIVA del
-- alumno en el grupo de la sesion y la bloquea (FOR SHARE) hasta el fin de la transaccion, para
-- que una baja simultanea no se cuele entre la comprobacion y el commit.
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION app.trg_asistencia_rn01() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_id_inscripcion integer;
BEGIN
    SELECT i.id_inscripcion INTO v_id_inscripcion
      FROM public.inscripcion i
      JOIN public.sesion_clase s ON s.id_grupo = i.id_grupo
     WHERE s.id_sesion = NEW.id_sesion
       AND i.id_alumno = NEW.id_alumno
       AND i.estatus = 'activa'
       FOR SHARE OF i;
    IF NOT FOUND THEN
        PERFORM app.rechazar_regla('rn01_asistencia_inscripcion_activa',
            'el alumno no tiene una inscripción activa en el grupo de la sesión');
    END IF;
    RETURN NEW;
END
$$;

CREATE TRIGGER trg_asistencia_rn01
    BEFORE INSERT OR UPDATE OF id_sesion, id_alumno ON public.asistencia
    FOR EACH ROW EXECUTE FUNCTION app.trg_asistencia_rn01();

-- ---------------------------------------------------------------------------------------------
-- Ciclo de vida de asistencia.estado (RN-05, RN-06, RN-07, RN-09 y docs/api/revision.md 5.4).
--
-- Nacimiento (INSERT):
--   * 'justificado' nunca nace asi (RN-09).
--   * origen 'automatico': solo en sesion de modo 'automatico' (RN-06) y solo como 'pendiente'
--     (primera lectura valida) o 'ausente' (cierre de sesion) (RN-05, RN-07).
--   * origen 'manual' / 'correccion': presente, retardo o ausente.
-- Transiciones (UPDATE de estado):
--   pendiente -> presente|retardo : con origen 'automatico' exige conteo >= min_detecciones_validas (RN-05);
--                                   con 'manual' o 'correccion' es decision humana (no exige lecturas).
--   pendiente -> ausente          : solo 'manual' o 'correccion'.
--   presente|retardo|ausente entre si (estado distinto): solo 'manual' o 'correccion'.
--   ausente|retardo -> justificado: solo con origen 'correccion' (RN-09).
--   * -> pendiente                : nunca (no se regresa a pendiente).
--   pendiente|presente -> justificado, justificado -> otro estado: nunca.
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION app.trg_asistencia_ciclo() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_modo public.modo_registro_sesion;
    v_min  numeric;
BEGIN
    SELECT s.modo_registro INTO v_modo FROM public.sesion_clase s WHERE s.id_sesion = NEW.id_sesion;

    -- RN-06: en una sesion de pase manual no existen registros automaticos.
    IF NEW.origen = 'automatico' AND v_modo = 'manual' THEN
        PERFORM app.rechazar_regla('rn06_asistencia_automatico_en_sesion_manual',
            'una sesión de pase manual no admite registros con origen automático');
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.estado = 'justificado' THEN
            PERFORM app.rechazar_regla('rn09_asistencia_nace_justificada',
                'un registro no puede nacer justificado; solo un justificante aprobado lo justifica');
        END IF;
        IF NEW.origen = 'automatico' AND NEW.estado NOT IN ('pendiente', 'ausente') THEN
            PERFORM app.rechazar_regla('rn05_asistencia_nace_pendiente',
                'un registro automático nace pendiente (o ausente al cierre), nunca ' || NEW.estado::text);
        END IF;
        RETURN NEW;
    END IF;

    -- UPDATE
    IF NEW.estado = OLD.estado THEN
        RETURN NEW; -- cambios de conteo u hora sin cambiar de estado
    END IF;

    IF NEW.estado = 'pendiente' THEN
        PERFORM app.rechazar_regla('rn05_asistencia_regreso_a_pendiente',
            'un registro no puede regresar a pendiente (estado anterior: ' || OLD.estado::text || ')');
    END IF;

    IF OLD.estado = 'justificado' THEN
        PERFORM app.rechazar_regla('rn09_asistencia_justificado_inmutable',
            'un registro justificado ya no cambia de estado');
    END IF;

    IF NEW.estado = 'justificado' THEN
        IF OLD.estado NOT IN ('ausente', 'retardo') THEN
            PERFORM app.rechazar_regla('rn09_asistencia_justificar_solo_falta_o_retardo',
                'solo una falta o un retardo puede justificarse (estado anterior: ' || OLD.estado::text || ')');
        END IF;
        IF NEW.origen <> 'correccion' THEN
            PERFORM app.rechazar_regla('rn09_asistencia_justificar_con_correccion',
                'la justificación se asienta con origen correccion');
        END IF;
        RETURN NEW;
    END IF;

    -- Destino presente | retardo | ausente
    IF OLD.estado = 'pendiente' AND NEW.estado IN ('presente', 'retardo') AND NEW.origen = 'automatico' THEN
        v_min := app.param_num('min_detecciones_validas');
        IF NEW.conteo_detecciones < v_min THEN
            PERFORM app.rechazar_regla('rn05_asistencia_confirmacion_lecturas',
                format('confirmar la asistencia exige al menos %s lecturas válidas (tiene %s)', v_min, NEW.conteo_detecciones));
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.origen = 'automatico' THEN
        PERFORM app.rechazar_regla('rn05_asistencia_cambio_requiere_humano',
            'pasar de ' || OLD.estado::text || ' a ' || NEW.estado::text || ' requiere origen manual o correccion');
    END IF;
    RETURN NEW;
END
$$;

CREATE TRIGGER trg_asistencia_ciclo
    BEFORE INSERT OR UPDATE ON public.asistencia
    FOR EACH ROW EXECUTE FUNCTION app.trg_asistencia_ciclo();

-- ---------------------------------------------------------------------------------------------
-- RN-06: la camara de cada captura debe estar en el aula del grupo de la sesion.
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION app.trg_captura_rn06() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM public.camara c
          JOIN public.sesion_clase s ON s.id_sesion = NEW.id_sesion
          JOIN public.grupo g ON g.id_grupo = s.id_grupo
         WHERE c.id_camara = NEW.id_camara AND c.id_aula = g.id_aula)
    THEN
        PERFORM app.rechazar_regla('rn06_captura_camara_aula',
            'la cámara de la captura no pertenece al aula del grupo de la sesión');
    END IF;
    RETURN NEW;
END
$$;

CREATE TRIGGER trg_captura_rn06
    BEFORE INSERT OR UPDATE OF id_camara, id_sesion ON public.captura
    FOR EACH ROW EXECUTE FUNCTION app.trg_captura_rn06();

-- ---------------------------------------------------------------------------------------------
-- RN-13: la plantilla se apoya en un consentimiento del MISMO alumno que este 'vigente' y cuya
-- vigencia cubra la fecha actual (app.hoy()). La propiedad del consentimiento se comprueba
-- siempre; la vigencia solo al activar (alta, reactivacion o cambio de consentimiento), para
-- poder archivar una plantilla despues de que su consentimiento se revoque o venza.
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION app.trg_plantilla_rn13() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_c public.consentimiento%ROWTYPE;
BEGIN
    SELECT * INTO v_c FROM public.consentimiento c WHERE c.id_consent = NEW.id_consent;
    IF NOT FOUND THEN
        RETURN NEW; -- la FK fk_plantilla_consent lo rechazara con su propio nombre
    END IF;

    IF v_c.id_alumno <> NEW.id_alumno THEN
        PERFORM app.rechazar_regla('rn13_plantilla_consentimiento_ajeno',
            'el consentimiento pertenece a otro alumno');
    END IF;

    IF NEW.activa AND (TG_OP = 'INSERT' OR NOT OLD.activa OR OLD.id_consent <> NEW.id_consent) THEN
        IF v_c.estatus <> 'vigente' THEN
            PERFORM app.rechazar_regla('rn13_plantilla_consentimiento_no_vigente',
                'el consentimiento está ' || v_c.estatus::text);
        END IF;
        IF app.hoy() NOT BETWEEN v_c.fecha_firma AND v_c.vigencia_hasta THEN
            PERFORM app.rechazar_regla('rn13_plantilla_consentimiento_vencido',
                format('la fecha actual (%s) está fuera de la vigencia del consentimiento (%s a %s)',
                       app.hoy(), v_c.fecha_firma, v_c.vigencia_hasta));
        END IF;
    END IF;
    RETURN NEW;
END
$$;

CREATE TRIGGER trg_plantilla_rn13
    BEFORE INSERT OR UPDATE OF id_consent, id_alumno, activa ON public.plantilla_facial
    FOR EACH ROW EXECUTE FUNCTION app.trg_plantilla_rn13();

-- ---------------------------------------------------------------------------------------------
-- RNF-08: la bitacora es de solo insercion. ENABLE ALWAYS: tambien protege con
-- session_replication_role = replica (el modo que usa la carga masiva de la semilla).
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION app.trg_bitacora_sin_cambios() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'trg_bitacora_sin_cambios: la bitácora de auditoría es de solo inserción (%)', TG_OP
        USING ERRCODE = 'integrity_constraint_violation', CONSTRAINT = 'trg_bitacora_sin_cambios';
END
$$;

CREATE FUNCTION app.trg_bitacora_sin_truncate() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'trg_bitacora_sin_truncate: la bitácora de auditoría no admite TRUNCATE'
        USING ERRCODE = 'integrity_constraint_violation', CONSTRAINT = 'trg_bitacora_sin_truncate';
END
$$;

CREATE TRIGGER trg_bitacora_sin_cambios
    BEFORE UPDATE OR DELETE ON public.bitacora_auditoria
    FOR EACH ROW EXECUTE FUNCTION app.trg_bitacora_sin_cambios();
CREATE TRIGGER trg_bitacora_sin_truncate
    BEFORE TRUNCATE ON public.bitacora_auditoria
    FOR EACH STATEMENT EXECUTE FUNCTION app.trg_bitacora_sin_truncate();

ALTER TABLE public.bitacora_auditoria ENABLE ALWAYS TRIGGER trg_bitacora_sin_cambios;
ALTER TABLE public.bitacora_auditoria ENABLE ALWAYS TRIGGER trg_bitacora_sin_truncate;
