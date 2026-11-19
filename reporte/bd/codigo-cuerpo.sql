-- ============================================================================================
-- SUSAN · Código de base de datos: extractos para el reporte de avances
-- Cada extracto va entre las marcas  "-- [n] FUENTE: ..."  y  "-- [/n]".
-- El texto entre marcas es copia LITERAL (byte a byte) de las líneas indicadas de
-- supabase/migrations/ en el commit f742bb4; verificar-cuerpo.mjs lo comprueba.
-- Son fragmentos: no se ejecutan por separado (dependen de objetos que crean otras migraciones).
-- ============================================================================================

-- [1] FUENTE: supabase/migrations/0005_tablas_operacion.sql, líneas 3-73 · DDL del área B: sesion_clase, asistencia y justificante (con sus CHECK, UNIQUE y FK)
CREATE TABLE public.sesion_clase (
    id_sesion               integer GENERATED ALWAYS AS IDENTITY,
    id_grupo                integer NOT NULL,
    fecha                   date NOT NULL,
    hora_inicio             time NOT NULL,
    hora_fin                time NOT NULL,
    -- Se copian de parametro_sistema al programar la sesion: un ajuste posterior no altera las ya registradas.
    tolerancia_min          smallint NOT NULL DEFAULT 20,
    limite_presente_min     smallint NOT NULL DEFAULT 10,
    intervalo_muestreo_seg  smallint NOT NULL DEFAULT 15,
    modo_registro           public.modo_registro_sesion NOT NULL DEFAULT 'automatico',
    estatus                 public.estatus_sesion NOT NULL DEFAULT 'programada',
    CONSTRAINT pk_sesion_clase PRIMARY KEY (id_sesion),
    CONSTRAINT fk_sesion_grupo FOREIGN KEY (id_grupo) REFERENCES public.grupo (id_grupo) ON DELETE RESTRICT,
    CONSTRAINT uq_sesion_grupo_fecha_hora UNIQUE (id_grupo, fecha, hora_inicio),
    CONSTRAINT ck_sesion_horas CHECK (hora_fin > hora_inicio),
    CONSTRAINT ck_sesion_ventana CHECK (limite_presente_min > 0 AND limite_presente_min < tolerancia_min),
    CONSTRAINT ck_sesion_intervalo CHECK (intervalo_muestreo_seg BETWEEN 5 AND 120)
);
COMMENT ON TABLE public.sesion_clase IS 'Ocurrencia concreta de una clase; las programadas son la base del porcentaje de faltas (RN-11).';

CREATE TABLE public.asistencia (
    id_asistencia       integer GENERATED ALWAYS AS IDENTITY,
    id_sesion           integer NOT NULL,
    id_alumno           integer NOT NULL,
    estado              public.estado_asistencia NOT NULL,
    hora_registro       timestamptz,
    origen              public.origen_asistencia NOT NULL,
    conteo_detecciones  smallint NOT NULL DEFAULT 0,
    CONSTRAINT pk_asistencia PRIMARY KEY (id_asistencia),
    CONSTRAINT fk_asistencia_sesion FOREIGN KEY (id_sesion) REFERENCES public.sesion_clase (id_sesion) ON DELETE RESTRICT,
    CONSTRAINT fk_asistencia_alumno FOREIGN KEY (id_alumno) REFERENCES public.alumno (id_alumno) ON DELETE RESTRICT,
    -- RN-02: un solo registro por alumno y sesion, sin importar cuantas detecciones haya.
    CONSTRAINT uq_asistencia_sesion_alumno UNIQUE (id_sesion, id_alumno),
    CONSTRAINT ck_asistencia_conteo CHECK (conteo_detecciones >= 0),
    CONSTRAINT ck_asistencia_ausente_sin_hora CHECK (estado <> 'ausente' OR hora_registro IS NULL),
    -- Un pendiente es automatico, tiene hora y al menos una lectura (RN-05).
    CONSTRAINT ck_asistencia_pendiente CHECK (
        estado <> 'pendiente'
        OR (origen = 'automatico' AND hora_registro IS NOT NULL AND conteo_detecciones > 0)
    ),
    -- La hora decide el estado (RN-03); solo una correccion puede dejar presente/retardo sin hora.
    CONSTRAINT ck_asistencia_hora_presencia CHECK (
        estado NOT IN ('presente', 'retardo') OR origen = 'correccion' OR hora_registro IS NOT NULL
    )
);
COMMENT ON TABLE public.asistencia IS 'Resultado unico de un alumno en una sesion. Triggers: trg_asistencia_rn01, trg_asistencia_ciclo.';

CREATE TABLE public.justificante (
    id_justificante   integer GENERATED ALWAYS AS IDENTITY,
    id_sesion         integer NOT NULL,
    id_alumno         integer NOT NULL,
    motivo            varchar(200) NOT NULL,
    objeto_documento  varchar(255) NOT NULL,
    estatus           public.estatus_justificante NOT NULL DEFAULT 'pendiente',
    registrado_por    integer NOT NULL,
    resuelto_por      integer,
    fecha_registro    timestamptz NOT NULL DEFAULT app.now(),
    fecha_resolucion  timestamptz,
    CONSTRAINT pk_justificante PRIMARY KEY (id_justificante),
    -- RN-09: solo se justifica un registro de asistencia que existe, y no se borra uno justificado.
    CONSTRAINT fk_justificante_asistencia FOREIGN KEY (id_sesion, id_alumno)
        REFERENCES public.asistencia (id_sesion, id_alumno) ON DELETE RESTRICT,
    CONSTRAINT fk_justificante_registrado FOREIGN KEY (registrado_por) REFERENCES public.usuario (id_usuario) ON DELETE RESTRICT,
    CONSTRAINT fk_justificante_resuelto FOREIGN KEY (resuelto_por) REFERENCES public.usuario (id_usuario) ON DELETE RESTRICT,
    CONSTRAINT ck_justificante_resolucion CHECK (
        (estatus = 'pendiente') = (resuelto_por IS NULL AND fecha_resolucion IS NULL)
    ),
    CONSTRAINT ck_justificante_fechas CHECK (fecha_resolucion IS NULL OR fecha_resolucion >= fecha_registro)
);
COMMENT ON TABLE public.justificante IS 'Soporte documental de una falta o un retardo.';
-- [/1]

-- [2] FUENTE: supabase/migrations/0006_tablas_biometria.sql, líneas 32-50 · DDL de plantilla_facial (RN-12: indexada o no, faiss_id)
CREATE TABLE public.plantilla_facial (
    id_plantilla    integer GENERATED ALWAYS AS IDENTITY,
    id_alumno       integer NOT NULL,
    id_consent      integer NOT NULL,
    id_indice       integer,
    faiss_id        bigint,
    objeto_foto     varchar(255) NOT NULL,
    fecha_registro  timestamptz NOT NULL DEFAULT app.now(),
    activa          boolean NOT NULL DEFAULT true,
    CONSTRAINT pk_plantilla_facial PRIMARY KEY (id_plantilla),
    CONSTRAINT fk_plantilla_alumno FOREIGN KEY (id_alumno) REFERENCES public.alumno (id_alumno) ON DELETE RESTRICT,
    CONSTRAINT fk_plantilla_consent FOREIGN KEY (id_consent) REFERENCES public.consentimiento (id_consent) ON DELETE RESTRICT,
    CONSTRAINT fk_plantilla_indice FOREIGN KEY (id_indice) REFERENCES public.indice_faiss (id_indice) ON DELETE RESTRICT,
    CONSTRAINT uq_plantilla_indice_faiss_id UNIQUE (id_indice, faiss_id),
    CONSTRAINT ck_plantilla_faiss_id CHECK (faiss_id IS NULL OR faiss_id >= 0),
    -- Indice y faiss_id van juntos: ambos nulos hasta la reconstruccion, ambos con valor despues.
    CONSTRAINT ck_plantilla_indexada CHECK ((id_indice IS NULL) = (faiss_id IS NULL))
);
COMMENT ON TABLE public.plantilla_facial IS 'Referencia al vector de un alumno en el indice (RN-12). Trigger: trg_plantilla_rn13.';
-- [/2]

-- [3] FUENTE: supabase/migrations/0006_tablas_biometria.sql, líneas 84-102 · DDL de deteccion (ck_deteccion_candidato, RN-04)
CREATE TABLE public.deteccion (
    id_deteccion     bigint GENERATED ALWAYS AS IDENTITY,
    id_captura       bigint NOT NULL,
    id_plantilla     integer,
    score_similitud  numeric(4,3),
    es_valida        boolean NOT NULL DEFAULT false,
    objeto_recorte   varchar(255),
    CONSTRAINT pk_deteccion PRIMARY KEY (id_deteccion),
    -- Sin cascada: borrar una captura no puede perder sus detecciones (RN-09).
    CONSTRAINT fk_deteccion_captura FOREIGN KEY (id_captura) REFERENCES public.captura (id_captura) ON DELETE RESTRICT,
    CONSTRAINT fk_deteccion_plantilla FOREIGN KEY (id_plantilla) REFERENCES public.plantilla_facial (id_plantilla) ON DELETE RESTRICT,
    CONSTRAINT ck_deteccion_score CHECK (score_similitud IS NULL OR score_similitud BETWEEN 0 AND 1),
    -- Sin candidato no hay score ni lectura valida; todo candidato llega con su score (RN-04).
    CONSTRAINT ck_deteccion_candidato CHECK (
        (id_plantilla IS NULL AND score_similitud IS NULL AND es_valida = false)
        OR (id_plantilla IS NOT NULL AND score_similitud IS NOT NULL)
    )
);
COMMENT ON TABLE public.deteccion IS 'Rostro leido dentro de una captura; guarda el vecino mas cercano aunque no alcance el umbral.';
-- [/3]

-- [4] FUENTE: supabase/migrations/0007_indices.sql, líneas 5-11 · Índices únicos parciales: una plantilla activa por alumno, un índice FAISS en uso
-- A lo sumo una plantilla activa por alumno. Los indices parciales se comprueban fila por fila:
-- el alta archiva primero la anterior y despues inserta la nueva, en la misma transaccion.
CREATE UNIQUE INDEX ux_plantilla_facial_activa ON public.plantilla_facial (id_alumno) WHERE activa;

-- A lo sumo una version del indice en uso. No es diferible: el cambio de version hace primero
-- UPDATE ... en_uso = false en la vigente y despues en_uso = true en la nueva (orden inverso se rechaza).
CREATE UNIQUE INDEX ux_indice_faiss_en_uso ON public.indice_faiss (en_uso) WHERE en_uso;
-- [/4]

-- [5] FUENTE: supabase/migrations/0100_reportes_base.sql, líneas 11-74 · Vista v_resumen_asistencia (RF-13/RF-14, RN-10/RN-11): faltas equivalentes y límite de ausencias
CREATE OR REPLACE VIEW public.v_resumen_asistencia WITH (security_invoker = true) AS
SELECT
    b.id_inscripcion,
    b.id_alumno,
    b.id_grupo,
    b.estatus_inscripcion,
    b.derecho_examen,
    b.sesiones_programadas,
    b.presentes,
    b.retardos,
    b.ausencias,
    b.justificadas,
    b.pendientes,
    b.faltas_equivalentes,
    CASE WHEN b.sesiones_programadas > 0
         THEN round(100.0 * b.faltas_equivalentes / b.sesiones_programadas, 2) END AS porcentaje_faltas,
    CASE WHEN b.sesiones_programadas > 0
         THEN round(100.0 * b.faltas_equivalentes / b.sesiones_programadas, 2) END AS porcentaje,
    b.limite_pct,
    -- RN-11 con aritmetica exacta (sin redondear): exactamente el limite conserva el derecho.
    (b.faltas_equivalentes * 100 > b.limite_pct * b.sesiones_programadas) AS supera_limite,
    b.faltas_maximas_permitidas,
    CASE WHEN b.faltas_equivalentes * 100 > b.limite_pct * b.sesiones_programadas THEN 0
         ELSE greatest(b.faltas_maximas_permitidas - b.faltas_equivalentes, 0) END AS faltas_restantes_antes_limite,
    -- En el limite: conserva el derecho pero una falta equivalente mas lo pierde.
    (b.sesiones_programadas > 0
     AND b.faltas_equivalentes * 100 <= b.limite_pct * b.sesiones_programadas
     AND b.faltas_maximas_permitidas - b.faltas_equivalentes <= 0) AS en_limite
FROM (
    SELECT
        i.id_inscripcion,
        i.id_alumno,
        i.id_grupo,
        i.estatus AS estatus_inscripcion,
        i.derecho_examen,
        sp.n AS sesiones_programadas,
        ac.presentes,
        ac.retardos,
        ac.ausencias,
        ac.justificadas,
        ac.pendientes,
        (ac.ausencias + CASE WHEN p.retardos_por_ausencia >= 1
                             THEN floor(ac.retardos / p.retardos_por_ausencia)::integer ELSE 0 END) AS faltas_equivalentes,
        p.limite_pct,
        floor(p.limite_pct * sp.n / 100)::integer AS faltas_maximas_permitidas
    FROM public.inscripcion i
    CROSS JOIN (SELECT app.param_num('retardos_por_ausencia') AS retardos_por_ausencia,
                       app.param_num('porcentaje_max_ausencias') AS limite_pct) p
    CROSS JOIN LATERAL (
        SELECT count(*)::integer AS n
          FROM public.sesion_clase s
         WHERE s.id_grupo = i.id_grupo AND s.estatus <> 'suspendida'
    ) sp
    CROSS JOIN LATERAL (
        SELECT count(*) FILTER (WHERE a.estado = 'presente')::integer   AS presentes,
               count(*) FILTER (WHERE a.estado = 'retardo')::integer    AS retardos,
               count(*) FILTER (WHERE a.estado = 'ausente')::integer    AS ausencias,
               count(*) FILTER (WHERE a.estado = 'justificado')::integer AS justificadas,
               count(*) FILTER (WHERE a.estado = 'pendiente')::integer  AS pendientes
          FROM public.asistencia a
          JOIN public.sesion_clase s ON s.id_sesion = a.id_sesion
         WHERE a.id_alumno = i.id_alumno AND s.id_grupo = i.id_grupo AND s.estatus <> 'suspendida'
    ) ac
) b;
-- [/5]

-- [6] FUENTE: supabase/migrations/0020_triggers.sql, líneas 24-53 · Disparador trg_asistencia_rn01 (RN-01: solo con inscripción activa)
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
-- [/6]

-- [7] FUENTE: supabase/migrations/0020_triggers.sql, líneas 217-249 · Disparadores de bitácora de solo inserción (RNF-08)
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
-- [/7]

-- [8] FUENTE: supabase/migrations/0030_rls_grants.sql, líneas 119-129 · Políticas RLS de asistencia: administrador, docente de sus grupos, alumno el propio
-- asistencia: la politica de ejemplo de la spec (docente_ve_sus_grupos), mas admin (reportes de
-- todos los grupos) y alumno (historial propio, RF-21).
CREATE POLICY admin_ve_todo ON public.asistencia FOR SELECT TO authenticated
    USING ((SELECT app.es_admin()));
CREATE POLICY docente_ve_sus_grupos ON public.asistencia FOR SELECT TO authenticated
    USING ((SELECT app.rol()) = 'docente'
           AND EXISTS (SELECT 1 FROM public.sesion_clase s
                        WHERE s.id_sesion = asistencia.id_sesion
                          AND s.id_grupo IN (SELECT app.grupos_visibles())));
CREATE POLICY alumno_ve_lo_propio ON public.asistencia FOR SELECT TO authenticated
    USING (id_alumno = (SELECT app.id_alumno()));
-- [/8]

-- [9] FUENTE: supabase/migrations/0030_rls_grants.sql, líneas 185-187 · Política RLS de la bitácora: solo administrador
-- bitacora: solo administrador (RNF-08); nadie escribe ni borra por esta via
CREATE POLICY admin_ve_todo ON public.bitacora_auditoria FOR SELECT TO authenticated
    USING ((SELECT app.es_admin()));
-- [/9]

-- [10] FUENTE: supabase/migrations/0130_sesiones_helpers.sql, líneas 24-34 · Función app.estado_por_minuto (RN-03: presente o retardo según el minuto)
CREATE OR REPLACE FUNCTION app.estado_por_minuto(p_limite integer, p_tolerancia integer, p_minuto numeric)
    RETURNS public.estado_asistencia
    LANGUAGE sql IMMUTABLE
    SET search_path = pg_catalog, pg_temp
AS $$
    SELECT CASE WHEN p_minuto < p_limite THEN 'presente'::public.estado_asistencia
                WHEN p_minuto <= p_tolerancia THEN 'retardo'::public.estado_asistencia
           END
$$;
COMMENT ON FUNCTION app.estado_por_minuto(integer, integer, numeric) IS
    'RN-03: presente si minuto < limite, retardo si limite <= minuto <= tolerancia, NULL fuera de la ventana.';
-- [/10]

-- [11] FUENTE: supabase/migrations/0133_api_sesion_cierre.sql, líneas 14-128 · Función app.cerrar_sesion (RF-10, RN-07): consolida lecturas, crea ausentes, cierra, bitácora y recálculo
CREATE OR REPLACE FUNCTION app.cerrar_sesion(p_id_sesion integer, p_por_docente boolean) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    s            public.sesion_clase%ROWTYPE;
    v_docente    boolean := coalesce(p_por_docente, false);
    v_ahora      timestamptz := app.now();
    v_min_det    numeric;
    v_creados    integer;
    v_confirmados integer;
    v_cierre_ant timestamptz;
    v_resumen    jsonb;
    v_pend       integer;
BEGIN
    -- La bitacora queda a nombre de la cuenta de servicio cuando cierra el programador.
    IF NOT v_docente THEN
        PERFORM app.asumir_cuenta_servicio();
    END IF;

    SELECT * INTO s FROM public.sesion_clase x WHERE x.id_sesion = p_id_sesion FOR NO KEY UPDATE;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'La sesión de clase no existe.');
    END IF;

    IF s.estatus = 'cerrada' THEN
        SELECT jsonb_build_object(
                   'id_sesion', s.id_sesion, 'estatus', 'cerrada', 'ya_cerrada', true,
                   'ausentes_creados', 0, 'confirmados', 0,
                   'pendientes', count(*) FILTER (WHERE a.estado = 'pendiente'),
                   'presentes', count(*) FILTER (WHERE a.estado = 'presente'),
                   'retardos', count(*) FILTER (WHERE a.estado = 'retardo'),
                   'ausentes', count(*) FILTER (WHERE a.estado = 'ausente'),
                   'justificados', count(*) FILTER (WHERE a.estado = 'justificado'),
                   'registros', count(*))
          INTO v_resumen FROM public.asistencia a WHERE a.id_sesion = s.id_sesion;
        RETURN v_resumen;
    ELSIF s.estatus = 'suspendida' THEN
        PERFORM app.fallar('SESION_SUSPENDIDA', 'La sesión está suspendida; no se cierra.');
    ELSIF s.estatus <> 'abierta' THEN
        PERFORM app.fallar('SESION_NO_ABIERTA', 'La sesión no se abrió; no hay nada que cerrar.');
    END IF;

    IF v_docente THEN
        v_cierre_ant := least(app.instante_clase(s.fecha, s.hora_inicio) + make_interval(mins => s.tolerancia_min),
                              app.instante_clase(s.fecha, s.hora_fin));
        IF v_ahora < v_cierre_ant THEN
            PERFORM app.fallar('VENTANA_TOLERANCIA_ABIERTA',
                format('Aún no termina la ventana de tolerancia (%s min); el cierre puede adelantarse a partir de las %s.',
                       s.tolerancia_min, to_char(v_cierre_ant AT TIME ZONE app.tz(), 'HH24:MI:SS')));
        END IF;
    END IF;

    v_min_det := app.param_num('min_detecciones_validas');

    -- 1. Consolidacion de lecturas (RN-02, RN-05)
    UPDATE public.asistencia a
       SET conteo_detecciones = l.n
      FROM (SELECT pf.id_alumno, count(DISTINCT c.id_captura)::integer AS n
              FROM public.deteccion d
              JOIN public.captura c ON c.id_captura = d.id_captura
              JOIN public.plantilla_facial pf ON pf.id_plantilla = d.id_plantilla
             WHERE c.id_sesion = s.id_sesion AND d.es_valida
             GROUP BY pf.id_alumno) l
     WHERE a.id_sesion = s.id_sesion AND a.id_alumno = l.id_alumno
       AND a.origen = 'automatico' AND a.estado IN ('pendiente', 'presente', 'retardo')
       AND a.conteo_detecciones < l.n;

    UPDATE public.asistencia a
       SET estado = coalesce(app.estado_por_minuto(s.limite_presente_min, s.tolerancia_min,
                                                   app.minuto_de_sesion(s.fecha, s.hora_inicio, a.hora_registro)),
                             'retardo'::public.estado_asistencia)
     WHERE a.id_sesion = s.id_sesion AND a.estado = 'pendiente' AND a.origen = 'automatico'
       AND a.conteo_detecciones >= v_min_det;
    GET DIAGNOSTICS v_confirmados = ROW_COUNT;

    -- 2. Ausentes de quien no tiene registro (RN-07), con el origen del modo de la sesion
    INSERT INTO public.asistencia (id_sesion, id_alumno, estado, hora_registro, origen, conteo_detecciones)
    SELECT s.id_sesion, i.id_alumno, 'ausente', NULL,
           CASE WHEN s.modo_registro = 'automatico' THEN 'automatico' ELSE 'manual' END::public.origen_asistencia, 0
      FROM public.inscripcion i
     WHERE i.id_grupo = s.id_grupo AND i.estatus = 'activa'
       AND NOT EXISTS (SELECT 1 FROM public.asistencia x WHERE x.id_sesion = s.id_sesion AND x.id_alumno = i.id_alumno)
     ORDER BY i.id_alumno;
    GET DIAGNOSTICS v_creados = ROW_COUNT;

    -- 3. Cierre, bitacora y recalculo
    UPDATE public.sesion_clase SET estatus = 'cerrada' WHERE id_sesion = s.id_sesion;

    SELECT jsonb_build_object(
               'id_sesion', s.id_sesion, 'estatus', 'cerrada', 'ya_cerrada', false,
               'modo_registro', s.modo_registro,
               'ausentes_creados', v_creados,
               'confirmados', v_confirmados,
               'pendientes', count(*) FILTER (WHERE a.estado = 'pendiente'),
               'presentes', count(*) FILTER (WHERE a.estado = 'presente'),
               'retardos', count(*) FILTER (WHERE a.estado = 'retardo'),
               'ausentes', count(*) FILTER (WHERE a.estado = 'ausente'),
               'justificados', count(*) FILTER (WHERE a.estado = 'justificado'),
               'registros', count(*),
               'cerrada_por', CASE WHEN v_docente THEN 'docente' ELSE 'servicio' END,
               'cerrada_en', v_ahora)
      INTO v_resumen FROM public.asistencia a WHERE a.id_sesion = s.id_sesion;
    v_pend := (v_resumen ->> 'pendientes')::integer;

    PERFORM app.bitacora('cierre_sesion', 'sesion_clase', s.id_sesion,
        jsonb_build_object('estatus', 'abierta'),
        jsonb_build_object('estatus', 'cerrada', 'modo_registro', s.modo_registro,
                           'ausentes_creados', v_creados, 'pendientes', v_pend,
                           'por_docente', v_docente));

    PERFORM app.recalcular_grupo(s.id_grupo);
    RETURN v_resumen;
END
$$;
-- [/11]

-- [12] FUENTE: supabase/migrations/0133_api_sesion_cierre.sql, líneas 137-148 · RPC api_cerrar_sesion: envoltorio que expone el cierre al docente titular
CREATE OR REPLACE FUNCTION public.api_cerrar_sesion(p_id_sesion integer) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    s public.sesion_clase%ROWTYPE;
BEGIN
    PERFORM app.exigir_rol('docente');
    s := app.sesion_bloqueada(p_id_sesion, false);
    RETURN app.cerrar_sesion(s.id_sesion, true);
END
$$;
-- [/12]
