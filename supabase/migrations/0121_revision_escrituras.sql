-- 0121 · Revision: escrituras (docs/api/revision.md 3.2-3.5 y 3.11).
--   api_corregir_asistencia · api_validar_justificante · api_registrar_justificante ·
--   api_resolver_justificante · svc_registrar_consulta_revision
-- SECURITY DEFINER VOLATILE, primera instruccion app.exigir_rol, pertenencia validada (docente solo sus
-- grupos; alumno solo lo propio). Cada cambio recalcula la inscripcion (RN-10/RN-11).

-- ---------------------------------------------------------------------------------------------
-- 3.2 api_corregir_asistencia (RF-11, RN-08)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_corregir_asistencia(
    p_id_asistencia integer,
    p_estado        text,
    p_comentario    text DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol        text := app.exigir_rol('docente');
    v_comentario text;
    a            public.asistencia%ROWTYPE;
    s            public.sesion_clase%ROWTYPE;
    v_docente    integer;
    v_vence      timestamptz;
    v_res        jsonb;
    v_insc       integer;
    v_der_ant    boolean;
    v_der_nvo    boolean;
BEGIN
    IF p_estado IS NULL OR p_estado NOT IN ('presente', 'retardo', 'ausente', 'pendiente', 'justificado') THEN
        PERFORM app.fallar('VALIDACION', 'Estado no válido: use presente, retardo o ausente.');
    END IF;
    IF p_estado IN ('pendiente', 'justificado') THEN
        PERFORM app.fallar('TRANSICION_NO_PERMITIDA',
            'Un registro no puede volver a pendiente ni pasar a justificado por corrección; el justificado no se modifica.');
    END IF;
    v_comentario := nullif(btrim(coalesce(p_comentario, '')), '');
    IF char_length(v_comentario) > 200 THEN
        PERFORM app.fallar('VALIDACION', 'El comentario admite hasta 200 caracteres.');
    END IF;

    SELECT a2.* INTO a FROM public.asistencia a2 WHERE a2.id_asistencia = p_id_asistencia FOR UPDATE;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El registro de asistencia no existe.');
    END IF;
    SELECT s2.* INTO s FROM public.sesion_clase s2 WHERE s2.id_sesion = a.id_sesion;
    SELECT g.id_docente INTO v_docente FROM public.grupo g WHERE g.id_grupo = s.id_grupo;
    IF v_docente IS DISTINCT FROM app.id_docente() THEN
        PERFORM app.fallar('NO_AUTORIZADO', 'Solo el docente titular del grupo puede corregir la asistencia.');
    END IF;

    IF s.estatus <> 'cerrada' THEN
        PERFORM app.fallar('SESION_NO_CERRADA', 'La sesión sigue abierta; ciérrala antes de corregir un registro.');
    END IF;
    IF a.estado = 'justificado' THEN
        PERFORM app.fallar('TRANSICION_NO_PERMITIDA',
            'Un registro no puede volver a pendiente ni pasar a justificado por corrección; el justificado no se modifica.');
    END IF;
    IF a.estado::text = p_estado THEN
        PERFORM app.fallar('SIN_CAMBIO', 'El registro ya está en el estado indicado.');
    END IF;

    v_vence := app.limite_correccion(s.fecha, s.hora_fin);
    IF app.now() > v_vence THEN
        PERFORM app.fallar('RN_08_PLAZO_VENCIDO', format('El plazo de corrección terminó el %s (%s h después del fin de la sesión).',
            to_char(v_vence AT TIME ZONE app.tz(), 'YYYY-MM-DD HH24:MI'), app.param_num('horas_limite_correccion')::integer));
    END IF;

    IF p_estado = 'presente' AND EXISTS (
        SELECT 1 FROM public.justificante j
         WHERE j.id_sesion = a.id_sesion AND j.id_alumno = a.id_alumno AND j.estatus = 'pendiente') THEN
        PERFORM app.fallar('JUSTIFICANTE_PENDIENTE',
            'Hay un justificante pendiente para este registro; resuélvelo antes de marcarlo como presente.');
    END IF;

    SELECT i.id_inscripcion, i.derecho_examen INTO v_insc, v_der_ant
      FROM public.inscripcion i WHERE i.id_alumno = a.id_alumno AND i.id_grupo = s.id_grupo;

    v_res := app.aplicar_correccion(p_id_asistencia, p_estado, v_comentario, app.id_usuario(), NULL);

    IF v_insc IS NOT NULL THEN
        PERFORM app.recalcular_inscripcion(v_insc);
        SELECT i.derecho_examen INTO v_der_nvo FROM public.inscripcion i WHERE i.id_inscripcion = v_insc;
    END IF;

    RETURN jsonb_build_object(
        'id_asistencia', p_id_asistencia,
        'id_sesion', a.id_sesion,
        'id_alumno', a.id_alumno,
        'estado_anterior', a.estado,
        'estado', p_estado,
        'origen', 'correccion',
        'hora_registro', v_res -> 'hora_registro',
        'vence_en', app.c1_iso(v_vence),
        'id_bitacora', v_res -> 'id_bitacora',
        'inscripcion', jsonb_build_object('id_inscripcion', v_insc,
            'derecho_examen_anterior', v_der_ant, 'derecho_examen', v_der_nvo));
END
$$;
COMMENT ON FUNCTION public.api_corregir_asistencia(integer, text, text) IS
$c$Corrige el estado de un registro de asistencia (RF-11, RN-08): origen correccion, plazo de horas_limite_correccion, bitacora con valor anterior y nuevo, recalculo del derecho a examen.
ARGS: p_id_asistencia integer; p_estado text (presente|retardo|ausente); p_comentario text opcional (<= 200)
RETURNS: {id_asistencia, id_sesion, id_alumno, estado_anterior, estado, origen:"correccion", hora_registro, vence_en, id_bitacora, inscripcion:{id_inscripcion, derecho_examen_anterior, derecho_examen}}
ERRORES: NO_AUTORIZADO (rol o grupo ajeno), NO_ENCONTRADO, VALIDACION (estado o comentario), TRANSICION_NO_PERMITIDA (pendiente, justificado o registro justificado), SIN_CAMBIO, SESION_NO_CERRADA, RN_08_PLAZO_VENCIDO, JUSTIFICANTE_PENDIENTE (presente con justificante pendiente)
ROLES: docente titular del grupo$c$;
REVOKE ALL ON FUNCTION public.api_corregir_asistencia(integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_corregir_asistencia(integer, text, text) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3.3 api_validar_justificante: precomprobacion sin escribir.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_validar_justificante(p_id_sesion integer, p_id_alumno integer DEFAULT NULL) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol text := app.exigir_rol('alumno', 'docente');
    v     jsonb;
BEGIN
    v := app.validar_destino_justificante(p_id_sesion, p_id_alumno, false);
    RETURN v - 'id_grupo' - 'rol';
END
$$;
COMMENT ON FUNCTION public.api_validar_justificante(integer, integer) IS
$c$Precomprueba (sin escribir) que se puede registrar un justificante para la sesion y el alumno.
ARGS: p_id_sesion integer; p_id_alumno integer (NULL para alumno; obligatorio para docente)
RETURNS: {id_sesion, id_alumno, id_asistencia, estado:"ausente", ya_tuvo_rechazo:false}
ERRORES: NO_AUTORIZADO, VALIDACION, ASISTENCIA_NO_ENCONTRADA, SESION_NO_CERRADA, ESTADO_NO_JUSTIFICABLE, JUSTIFICANTE_DUPLICADO
ROLES: alumno (propios), docente titular$c$;
REVOKE ALL ON FUNCTION public.api_validar_justificante(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_validar_justificante(integer, integer) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3.4 api_registrar_justificante (RF-12)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_registrar_justificante(
    p_id_sesion        integer,
    p_motivo           text,
    p_objeto_documento text,
    p_id_alumno        integer DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol     text := app.exigir_rol('alumno', 'docente');
    v_alumno  integer;
    v_motivo  text;
    v         jsonb;
    j         public.justificante%ROWTYPE;
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

    v_motivo := btrim(coalesce(p_motivo, ''));
    IF v_motivo = '' OR char_length(v_motivo) > 200 THEN
        PERFORM app.fallar('VALIDACION', 'El motivo es obligatorio y admite hasta 200 caracteres.');
    END IF;

    -- Solo la ruta del propio alumno y con la forma que genera el handler de subida (sin '..').
    IF p_objeto_documento IS NULL OR char_length(p_objeto_documento) > 255
       OR p_objeto_documento !~ ('^justificantes/' || v_alumno::text
            || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|png)$') THEN
        PERFORM app.fallar('DOCUMENTO_INVALIDO', 'El documento no es válido; súbelo de nuevo.');
    END IF;

    v := app.validar_destino_justificante(p_id_sesion, v_alumno, true);

    BEGIN
        INSERT INTO public.justificante (id_sesion, id_alumno, motivo, objeto_documento, estatus, registrado_por, fecha_registro)
        VALUES (p_id_sesion, v_alumno, v_motivo, p_objeto_documento, 'pendiente', app.id_usuario(), app.now())
        RETURNING * INTO j;
    EXCEPTION WHEN unique_violation THEN
        PERFORM app.fallar('JUSTIFICANTE_DUPLICADO', 'Ya existe un justificante pendiente para este registro.');
    END;

    RETURN jsonb_build_object(
        'id_justificante', j.id_justificante,
        'id_sesion', j.id_sesion,
        'id_alumno', j.id_alumno,
        'id_asistencia', v -> 'id_asistencia',
        'estado_asistencia', v -> 'estado',
        'estatus', j.estatus,
        'motivo', j.motivo,
        'objeto_documento', j.objeto_documento,
        'registrado_por_rol', v_rol,
        'fecha_registro', app.c1_iso(j.fecha_registro));
END
$$;
COMMENT ON FUNCTION public.api_registrar_justificante(integer, text, text, integer) IS
$c$Registra un justificante pendiente de una falta o retardo de una sesion cerrada (RF-12). El documento debe ser justificantes/<id_alumno>/<uuid>.(pdf|jpg|png).
ARGS: p_id_sesion integer; p_motivo text (1..200); p_objeto_documento text (ruta en el bucket); p_id_alumno integer (NULL para alumno; obligatorio para docente)
RETURNS: {id_justificante, id_sesion, id_alumno, id_asistencia, estado_asistencia, estatus:"pendiente", motivo, objeto_documento, registrado_por_rol, fecha_registro}
ERRORES: NO_AUTORIZADO (alumno ajeno o grupo no titular), VALIDACION (motivo o alumno), DOCUMENTO_INVALIDO, ASISTENCIA_NO_ENCONTRADA, SESION_NO_CERRADA, ESTADO_NO_JUSTIFICABLE, JUSTIFICANTE_DUPLICADO
ROLES: alumno (propios), docente titular$c$;
REVOKE ALL ON FUNCTION public.api_registrar_justificante(integer, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_registrar_justificante(integer, text, text, integer) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3.5 api_resolver_justificante (RF-12, RN-09). No toca captura ni deteccion.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_resolver_justificante(
    p_id_justificante integer,
    p_aprobar         boolean,
    p_comentario      text DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol        text := app.exigir_rol('docente');
    v_comentario text;
    j            public.justificante%ROWTYPE;
    a            public.asistencia%ROWTYPE;
    v_grupo      integer;
    v_docente    integer;
    v_usuario    integer := app.id_usuario();
    v_ahora      timestamptz := app.now();
    v_bit        bigint;
    v_insc       integer;
    v_der_ant    boolean;
    v_der_nvo    boolean;
    v_estado_nvo public.estado_asistencia;
BEGIN
    IF p_aprobar IS NULL THEN
        PERFORM app.fallar('VALIDACION', 'Indica si el justificante se aprueba o se rechaza.');
    END IF;
    v_comentario := nullif(btrim(coalesce(p_comentario, '')), '');
    IF char_length(v_comentario) > 200 THEN
        PERFORM app.fallar('VALIDACION', 'El comentario admite hasta 200 caracteres.');
    END IF;

    SELECT j2.* INTO j FROM public.justificante j2 WHERE j2.id_justificante = p_id_justificante FOR UPDATE;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El justificante no existe.');
    END IF;
    SELECT a2.* INTO a FROM public.asistencia a2 WHERE a2.id_sesion = j.id_sesion AND a2.id_alumno = j.id_alumno FOR UPDATE;
    SELECT s.id_grupo, g.id_docente INTO v_grupo, v_docente
      FROM public.sesion_clase s JOIN public.grupo g ON g.id_grupo = s.id_grupo WHERE s.id_sesion = j.id_sesion;
    IF v_docente IS DISTINCT FROM app.id_docente() THEN
        PERFORM app.fallar('NO_AUTORIZADO', 'Solo el docente titular del grupo puede resolver justificantes.');
    END IF;
    IF j.estatus <> 'pendiente' THEN
        PERFORM app.fallar('JUSTIFICANTE_YA_RESUELTO', 'Este justificante ya fue resuelto.');
    END IF;

    SELECT i.id_inscripcion, i.derecho_examen INTO v_insc, v_der_ant
      FROM public.inscripcion i WHERE i.id_alumno = j.id_alumno AND i.id_grupo = v_grupo;

    IF p_aprobar THEN
        IF a.estado NOT IN ('ausente', 'retardo') THEN
            PERFORM app.fallar('ESTADO_NO_JUSTIFICABLE', 'El registro ya no es una ausencia ni un retardo; no se puede justificar.');
        END IF;
        -- RN-09: solo cambia el estado y el origen; hora_registro, conteo y detecciones se conservan.
        UPDATE public.asistencia SET estado = 'justificado', origen = 'correccion' WHERE id_asistencia = a.id_asistencia;
        UPDATE public.justificante SET estatus = 'aprobado', resuelto_por = v_usuario, fecha_resolucion = v_ahora
         WHERE id_justificante = j.id_justificante;
        v_estado_nvo := 'justificado';
        v_bit := app.bitacora('aprobacion_justificante', 'justificante', j.id_justificante,
            jsonb_build_object('estatus', 'pendiente', 'estado_asistencia', a.estado, 'origen_asistencia', a.origen),
            jsonb_build_object('estatus', 'aprobado', 'estado_asistencia', 'justificado', 'origen_asistencia', 'correccion',
                               'id_asistencia', a.id_asistencia, 'comentario', v_comentario));
    ELSE
        UPDATE public.justificante SET estatus = 'rechazado', resuelto_por = v_usuario, fecha_resolucion = v_ahora
         WHERE id_justificante = j.id_justificante;
        v_estado_nvo := a.estado;
        v_bit := app.bitacora('rechazo_justificante', 'justificante', j.id_justificante,
            jsonb_build_object('estatus', 'pendiente'),
            jsonb_build_object('estatus', 'rechazado', 'id_asistencia', a.id_asistencia, 'comentario', v_comentario));
    END IF;

    IF v_insc IS NOT NULL THEN
        PERFORM app.recalcular_inscripcion(v_insc);
        SELECT i.derecho_examen INTO v_der_nvo FROM public.inscripcion i WHERE i.id_inscripcion = v_insc;
    END IF;

    RETURN jsonb_build_object(
        'id_justificante', j.id_justificante,
        'id_asistencia', a.id_asistencia,
        'estatus', CASE WHEN p_aprobar THEN 'aprobado' ELSE 'rechazado' END,
        'estado_asistencia_anterior', a.estado,
        'estado_asistencia', v_estado_nvo,
        'resuelto_por', v_usuario,
        'fecha_resolucion', app.c1_iso(v_ahora),
        'id_bitacora', v_bit,
        'inscripcion', jsonb_build_object('id_inscripcion', v_insc,
            'derecho_examen_anterior', v_der_ant, 'derecho_examen', v_der_nvo));
END
$$;
COMMENT ON FUNCTION public.api_resolver_justificante(integer, boolean, text) IS
$c$Aprueba o rechaza un justificante pendiente (RF-12, RN-09). Aprobar deja el registro justificado (origen correccion) sin borrar lecturas; asienta bitacora y recalcula el derecho a examen. Sin plazo.
ARGS: p_id_justificante integer; p_aprobar boolean; p_comentario text opcional (<= 200)
RETURNS: {id_justificante, id_asistencia, estatus, estado_asistencia_anterior, estado_asistencia, resuelto_por, fecha_resolucion, id_bitacora, inscripcion:{id_inscripcion, derecho_examen_anterior, derecho_examen}}
ERRORES: NO_AUTORIZADO (rol o grupo ajeno), NO_ENCONTRADO, VALIDACION (p_aprobar nulo o comentario largo), JUSTIFICANTE_YA_RESUELTO, ESTADO_NO_JUSTIFICABLE
ROLES: docente titular del grupo$c$;
REVOKE ALL ON FUNCTION public.api_resolver_justificante(integer, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_resolver_justificante(integer, boolean, text) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3.11 svc_registrar_consulta_revision (RF-19): asiento 'consulta' de los Route Handlers.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.svc_registrar_consulta_revision(
    p_id_usuario  integer,
    p_entidad     text,
    p_id_registro bigint,
    p_ip          text  DEFAULT NULL,
    p_detalle     jsonb DEFAULT NULL
) RETURNS bigint
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_ip inet;
BEGIN
    IF p_entidad IS NULL OR p_entidad NOT IN ('asistencia', 'justificante') OR p_id_registro IS NULL THEN
        PERFORM app.fallar('VALIDACION', 'Entidad de consulta no válida.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.usuario u WHERE u.id_usuario = p_id_usuario AND u.activo AND u.rol = 'docente') THEN
        PERFORM app.fallar('NO_AUTORIZADO', 'La cuenta que consulta no es un docente activo.');
    END IF;
    BEGIN
        v_ip := nullif(btrim(coalesce(p_ip, '')), '')::inet;
    EXCEPTION WHEN others THEN
        v_ip := NULL;
    END;
    RETURN app.bitacora('consulta', p_entidad, p_id_registro, NULL, p_detalle, v_ip, p_id_usuario);
END
$$;
COMMENT ON FUNCTION public.svc_registrar_consulta_revision(integer, text, bigint, text, jsonb) IS
$c$Asienta una consulta (accion consulta) de lecturas/recortes de un caso o del documento de un justificante, a nombre del docente indicado (RF-19).
ARGS: p_id_usuario integer (docente activo); p_entidad text (asistencia|justificante); p_id_registro bigint; p_ip text opcional (IP invalida = NULL); p_detalle jsonb opcional (solo ids y contadores)
RETURNS: id_bitacora bigint
ERRORES: VALIDACION (entidad), NO_AUTORIZADO (cuenta no es docente activo)
ROLES: service_role$c$;
REVOKE ALL ON FUNCTION public.svc_registrar_consulta_revision(integer, text, bigint, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.svc_registrar_consulta_revision(integer, text, bigint, text, jsonb) TO service_role;
