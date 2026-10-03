-- 0120 · Revision, correcciones y justificantes: base (docs/api/revision.md seccion 5).
--   ux_justificante_pendiente · app.limite_correccion · app.estado_sugerido_revision ·
--   app.aplicar_correccion · app.resolver_pendientes_vencidos · app.validar_destino_justificante ·
--   app.correcciones_recientes. (app.rol_de_usuario ya existe en 0010.)

-- Respaldo declarativo de la unicidad del justificante pendiente ante dos envios simultaneos.
CREATE UNIQUE INDEX IF NOT EXISTS ux_justificante_pendiente
    ON public.justificante (id_sesion, id_alumno) WHERE estatus = 'pendiente';

-- ---------------------------------------------------------------------------------------------
-- RN-08: el plazo termina horas_limite_correccion despues de hora_fin. Hasta ese instante inclusive se acepta.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.limite_correccion(p_fecha date, p_hora_fin time) RETURNS timestamptz
    LANGUAGE sql STABLE
    SET search_path = public, app, pg_temp
AS $$ SELECT app.instante_clase(p_fecha, p_hora_fin) + app.param_num('horas_limite_correccion') * interval '1 hour' $$;
COMMENT ON FUNCTION app.limite_correccion(date, time) IS
    'RN-08: instante limite de correccion = fin de la sesion + horas_limite_correccion (hasta ese instante inclusive se acepta).';

-- RN-03: estricto: 9:59 -> presente; 10:00 y 20:00 -> retardo.
CREATE OR REPLACE FUNCTION app.estado_sugerido_revision(
    p_hora_registro timestamptz, p_fecha date, p_hora_inicio time, p_limite_presente_min integer
) RETURNS text
    LANGUAGE sql STABLE
    SET search_path = public, app, pg_temp
AS $$
    SELECT CASE WHEN p_hora_registro IS NULL THEN NULL
                WHEN p_hora_registro - app.instante_clase(p_fecha, p_hora_inicio)
                     < p_limite_presente_min * interval '1 minute' THEN 'presente'
                ELSE 'retardo' END
$$;
COMMENT ON FUNCTION app.estado_sugerido_revision(timestamptz, date, time, integer) IS
    'RN-03: estado sugerido para una primera lectura valida: presente si llego antes del limite (estricto), si no retardo.';

GRANT EXECUTE ON FUNCTION app.limite_correccion(date, time), app.estado_sugerido_revision(timestamptz, date, time, integer)
    TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Nucleo de escritura de una correccion. NO autoriza ni verifica el plazo (lo hace el llamador).
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.aplicar_correccion(
    p_id_asistencia integer,
    p_estado        text,
    p_comentario    text    DEFAULT NULL,
    p_id_usuario    integer DEFAULT NULL,
    p_ip            inet    DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    a        public.asistencia%ROWTYPE;
    v_grupo  integer;
    v_hora   timestamptz;
    v_bit    bigint;
BEGIN
    IF p_estado IS NULL OR p_estado NOT IN ('presente', 'retardo', 'ausente') THEN
        PERFORM app.fallar('VALIDACION', 'Estado no válido: use presente, retardo o ausente.');
    END IF;
    SELECT * INTO a FROM public.asistencia WHERE id_asistencia = p_id_asistencia FOR UPDATE;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El registro de asistencia no existe.');
    END IF;
    SELECT s.id_grupo INTO v_grupo FROM public.sesion_clase s WHERE s.id_sesion = a.id_sesion;

    -- ck_asistencia_ausente_sin_hora: un ausente no lleva hora; la original queda en la bitacora y en las detecciones.
    v_hora := CASE WHEN p_estado = 'ausente' THEN NULL ELSE a.hora_registro END;

    UPDATE public.asistencia
       SET estado = p_estado::public.estado_asistencia, origen = 'correccion', hora_registro = v_hora
     WHERE id_asistencia = p_id_asistencia;

    v_bit := app.bitacora(
        'correccion', 'asistencia', p_id_asistencia,
        jsonb_build_object('estado', a.estado, 'origen', a.origen,
                           'hora_registro', app.c1_iso(a.hora_registro), 'conteo_detecciones', a.conteo_detecciones),
        jsonb_build_object('estado', p_estado, 'origen', 'correccion',
                           'hora_registro', app.c1_iso(v_hora), 'comentario', p_comentario),
        p_ip, p_id_usuario);

    RETURN jsonb_build_object(
        'id_asistencia', p_id_asistencia, 'id_sesion', a.id_sesion, 'id_alumno', a.id_alumno, 'id_grupo', v_grupo,
        'estado_anterior', a.estado, 'estado', p_estado, 'hora_registro', app.c1_iso(v_hora), 'id_bitacora', v_bit);
END
$$;
COMMENT ON FUNCTION app.aplicar_correccion(integer, text, text, integer, inet) IS
    'Aplica una correccion (estado, origen correccion) y la asienta en bitacora con valor anterior y nuevo. No autoriza ni valida plazo. Solo service_role y funciones DEFINER.';
GRANT EXECUTE ON FUNCTION app.aplicar_correccion(integer, text, text, integer, inet) TO service_role;

-- ---------------------------------------------------------------------------------------------
-- Job: pendientes cuyo plazo vencio pasan a ausente con la cuenta de servicio (RF-11, BPMN-02).
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.resolver_pendientes_vencidos(p_id_usuario integer, p_limite integer DEFAULT 1000) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    r         record;
    v_insc    integer;
    v_ids     integer[] := ARRAY[]::integer[];
    v_fallidos jsonb := '[]'::jsonb;
    v_limite  integer := CASE WHEN p_limite IS NULL OR p_limite < 1 THEN 1000 ELSE p_limite END;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.usuario u WHERE u.id_usuario = p_id_usuario AND u.activo AND u.rol = 'tecnico') THEN
        PERFORM app.fallar('CUENTA_SERVICIO_INVALIDA', 'La cuenta indicada no es una cuenta de servicio activa.');
    END IF;

    FOR r IN
        SELECT a.id_asistencia, a.id_alumno, s.id_grupo
          FROM public.asistencia a
          JOIN public.sesion_clase s ON s.id_sesion = a.id_sesion
         WHERE a.estado = 'pendiente' AND s.estatus = 'cerrada'
           AND app.now() > app.limite_correccion(s.fecha, s.hora_fin)
         ORDER BY a.id_asistencia
         LIMIT v_limite
           FOR UPDATE OF a SKIP LOCKED
    LOOP
        BEGIN
            PERFORM app.aplicar_correccion(r.id_asistencia, 'ausente',
                'Plazo de corrección vencido: resolución automática', p_id_usuario);
            SELECT i.id_inscripcion INTO v_insc FROM public.inscripcion i
             WHERE i.id_alumno = r.id_alumno AND i.id_grupo = r.id_grupo;
            IF v_insc IS NOT NULL THEN
                PERFORM app.recalcular_inscripcion(v_insc);
            END IF;
            v_ids := v_ids || r.id_asistencia;
        EXCEPTION WHEN OTHERS THEN
            v_fallidos := v_fallidos || jsonb_build_object('id_asistencia', r.id_asistencia, 'error', SQLERRM);
        END;
    END LOOP;

    RETURN jsonb_build_object('resueltos', cardinality(v_ids), 'ids', to_jsonb(v_ids), 'fallidos', v_fallidos);
END
$$;
COMMENT ON FUNCTION app.resolver_pendientes_vencidos(integer, integer) IS
    'Pendientes de sesiones cerradas con plazo vencido (estricto) pasan a ausente con la cuenta de servicio y se recalcula la inscripcion. Idempotente. Devuelve {resueltos, ids, fallidos}.';
GRANT EXECUTE ON FUNCTION app.resolver_pendientes_vencidos(integer, integer) TO service_role;

-- ---------------------------------------------------------------------------------------------
-- Precomprobacion y validacion del destino de un justificante (pasos 1, 2, 5, 6, 7 y 8 de RF-12).
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.validar_destino_justificante(
    p_id_sesion integer, p_id_alumno integer, p_bloquear boolean DEFAULT false
) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol      text := app.exigir_rol('alumno', 'docente');
    v_alumno   integer;
    s          public.sesion_clase%ROWTYPE;
    v_docente  integer;
    v_id_asist integer;
    v_estado   public.estado_asistencia;
    v_rechazo  boolean;
BEGIN
    IF v_rol = 'alumno' THEN
        v_alumno := app.id_alumno();
        IF p_id_alumno IS NOT NULL AND p_id_alumno <> v_alumno THEN
            PERFORM app.fallar('NO_AUTORIZADO', 'Solo puedes registrar justificantes de tus propias faltas.');
        END IF;
    ELSE
        IF p_id_alumno IS NULL THEN
            PERFORM app.fallar('VALIDACION', 'Indica el alumno del justificante.');
        END IF;
        v_alumno := p_id_alumno;
    END IF;
    IF p_id_sesion IS NULL THEN
        PERFORM app.fallar('VALIDACION', 'Indica la sesión del justificante.');
    END IF;

    SELECT s2.* INTO s FROM public.sesion_clase s2 WHERE s2.id_sesion = p_id_sesion;
    IF NOT FOUND THEN
        PERFORM app.fallar('ASISTENCIA_NO_ENCONTRADA', 'No existe un registro de asistencia de ese alumno en esa sesión.');
    END IF;
    SELECT g.id_docente INTO v_docente FROM public.grupo g WHERE g.id_grupo = s.id_grupo;
    IF v_rol = 'docente' AND v_docente IS DISTINCT FROM app.id_docente() THEN
        PERFORM app.fallar('NO_AUTORIZADO', 'Este grupo no está asignado a tu cuenta.');
    END IF;

    IF p_bloquear THEN
        SELECT a.id_asistencia, a.estado INTO v_id_asist, v_estado
          FROM public.asistencia a WHERE a.id_sesion = p_id_sesion AND a.id_alumno = v_alumno FOR UPDATE;
    ELSE
        SELECT a.id_asistencia, a.estado INTO v_id_asist, v_estado
          FROM public.asistencia a WHERE a.id_sesion = p_id_sesion AND a.id_alumno = v_alumno;
    END IF;
    IF v_id_asist IS NULL THEN
        PERFORM app.fallar('ASISTENCIA_NO_ENCONTRADA', 'No existe un registro de asistencia de ese alumno en esa sesión.');
    END IF;

    IF s.estatus <> 'cerrada' THEN
        PERFORM app.fallar('SESION_NO_CERRADA', 'La sesión aún no ha cerrado; espera a que termine.');
    END IF;
    IF v_estado NOT IN ('ausente', 'retardo') THEN
        PERFORM app.fallar('ESTADO_NO_JUSTIFICABLE',
            CASE WHEN v_estado = 'pendiente' THEN 'El registro sigue pendiente de revisión del docente.'
                 ELSE format('Solo se justifica una ausencia o un retardo; el registro está en «%s».', v_estado) END);
    END IF;
    IF EXISTS (SELECT 1 FROM public.justificante j
                WHERE j.id_sesion = p_id_sesion AND j.id_alumno = v_alumno AND j.estatus = 'pendiente') THEN
        PERFORM app.fallar('JUSTIFICANTE_DUPLICADO', 'Ya existe un justificante pendiente para este registro.');
    END IF;
    SELECT EXISTS (SELECT 1 FROM public.justificante j
                    WHERE j.id_sesion = p_id_sesion AND j.id_alumno = v_alumno AND j.estatus = 'rechazado')
      INTO v_rechazo;

    RETURN jsonb_build_object('id_sesion', p_id_sesion, 'id_alumno', v_alumno, 'id_asistencia', v_id_asist,
        'estado', v_estado, 'ya_tuvo_rechazo', v_rechazo, 'id_grupo', s.id_grupo, 'rol', v_rol);
END
$$;
COMMENT ON FUNCTION app.validar_destino_justificante(integer, integer, boolean) IS
    'Valida rol, pertenencia, sesion cerrada, estado justificable y ausencia de duplicado para un justificante; con p_bloquear bloquea la asistencia (FOR UPDATE).';
GRANT EXECUTE ON FUNCTION app.validar_destino_justificante(integer, integer, boolean) TO service_role;

-- ---------------------------------------------------------------------------------------------
-- Correcciones recientes del docente (bitacora legible solo por el administrador: funcion DEFINER
-- acotada a los grupos del docente que llama). Ventana de 30 dias.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.correcciones_recientes(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_doc   integer := app.id_docente();
    v_lim   integer := app.c1_limite(p_limit);
    v_off   integer := app.c1_desplazamiento(p_offset);
    v_total bigint;
    v_items jsonb;
BEGIN
    IF v_doc IS NULL THEN
        RETURN jsonb_build_object('total', 0, 'items', '[]'::jsonb);
    END IF;

    SELECT count(*) INTO v_total
      FROM public.bitacora_auditoria b
      JOIN public.asistencia a ON a.id_asistencia = b.id_registro
      JOIN public.sesion_clase s ON s.id_sesion = a.id_sesion
      JOIN public.grupo g ON g.id_grupo = s.id_grupo
     WHERE b.accion = 'correccion' AND b.entidad = 'asistencia'
       AND b.fecha_hora >= app.now() - interval '30 days' AND g.id_docente = v_doc;

    SELECT coalesce(jsonb_agg(x.item ORDER BY x.fecha_hora DESC, x.id_bitacora DESC), '[]'::jsonb) INTO v_items
      FROM (
        SELECT b.fecha_hora, b.id_bitacora,
               jsonb_build_object(
                 'id_bitacora', b.id_bitacora,
                 'fecha_hora', app.c1_iso(b.fecha_hora),
                 'id_asistencia', a.id_asistencia,
                 'usuario', jsonb_build_object('id_usuario', b.id_usuario, 'rol', app.rol_de_usuario(b.id_usuario)),
                 'automatica', coalesce(app.rol_de_usuario(b.id_usuario) = 'tecnico', false),
                 'alumno', app.c1_alumno_json(al.id_alumno, al.matricula, al.apellido_paterno, al.apellido_materno, al.nombres),
                 'materia', app.c1_materia_json(m.id_materia, m.clave, m.nombre),
                 'grupo', app.c1_grupo_json(g.id_grupo, g.clave_grupo, g.periodo),
                 'sesion', app.c1_sesion_json(s),
                 'estado_anterior', b.valor_anterior ->> 'estado',
                 'estado_nuevo', b.valor_nuevo ->> 'estado',
                 'comentario', b.valor_nuevo ->> 'comentario',
                 'estado_actual', a.estado,
                 'vence_en', app.c1_iso(app.limite_correccion(s.fecha, s.hora_fin)),
                 'corregible', (app.now() <= app.limite_correccion(s.fecha, s.hora_fin) AND a.estado <> 'justificado')
               ) AS item
          FROM public.bitacora_auditoria b
          JOIN public.asistencia a ON a.id_asistencia = b.id_registro
          JOIN public.sesion_clase s ON s.id_sesion = a.id_sesion
          JOIN public.grupo g ON g.id_grupo = s.id_grupo
          JOIN public.materia m ON m.id_materia = g.id_materia
          JOIN public.alumno al ON al.id_alumno = a.id_alumno
         WHERE b.accion = 'correccion' AND b.entidad = 'asistencia'
           AND b.fecha_hora >= app.now() - interval '30 days' AND g.id_docente = v_doc
         ORDER BY b.fecha_hora DESC, b.id_bitacora DESC
         LIMIT v_lim OFFSET v_off
      ) x;

    RETURN jsonb_build_object('total', v_total, 'items', v_items);
END
$$;
COMMENT ON FUNCTION app.correcciones_recientes(integer, integer) IS
    'Correcciones (bitacora) de los ultimos 30 dias sobre asistencia de los grupos del docente que llama: {total, items}. DEFINER acotado por app.id_docente().';
GRANT EXECUTE ON FUNCTION app.correcciones_recientes(integer, integer) TO authenticated, service_role;
