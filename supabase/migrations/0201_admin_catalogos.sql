-- 0201 · db-admin · catalogos: alumnos, docentes y materias (RF-01).
-- Lecturas INVOKER STABLE (administrador y docente; la RLS acota al docente a sus grupos).
-- Escrituras DEFINER VOLATILE solo administrador. Bajas LOGICAS: cambian el estatus y conservan el historial.
-- Sin bitacora: accion_bitacora no tiene un valor para altas/bajas de catalogo (ver reporte, requests).

-- ===================================================================================================
-- ALUMNOS
-- ===================================================================================================
CREATE OR REPLACE FUNCTION public.api_alumnos_listar(
    p_q text DEFAULT NULL, p_estatus text DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0
) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_pat   text := app.b1_patron(p_q);
    v_est   public.estatus_alumno;
    v_total bigint;
    v_items jsonb;
BEGIN
    PERFORM app.exigir_rol('administrador', 'docente');
    IF nullif(btrim(coalesce(p_estatus, '')), '') IS NOT NULL THEN
        BEGIN
            v_est := btrim(p_estatus)::public.estatus_alumno;
        EXCEPTION WHEN invalid_text_representation THEN
            PERFORM app.fallar('VALIDACION', 'Estatus de alumno no válido.');
        END;
    END IF;

    SELECT count(*) INTO v_total FROM public.alumno a
     WHERE (v_est IS NULL OR a.estatus = v_est)
       AND (v_pat IS NULL OR a.matricula ILIKE v_pat OR a.correo_institucional ILIKE v_pat
            OR concat_ws(' ', a.nombres, a.apellido_paterno, a.apellido_materno) ILIKE v_pat
            OR concat_ws(' ', a.apellido_paterno, a.apellido_materno, a.nombres) ILIKE v_pat);

    SELECT coalesce(jsonb_agg(x.j ORDER BY x.rn), '[]'::jsonb) INTO v_items FROM (
        SELECT row_number() OVER (ORDER BY a.apellido_paterno, a.apellido_materno NULLS FIRST, a.nombres, a.id_alumno) AS rn,
               app.b1_alumno_json(a) || jsonb_build_object(
                   'consentimiento_vigente', app.tiene_consentimiento_vigente(a.id_alumno),
                   'plantilla_activa', EXISTS (SELECT 1 FROM public.plantilla_facial p WHERE p.id_alumno = a.id_alumno AND p.activa)) AS j
          FROM public.alumno a
                 WHERE (v_est IS NULL OR a.estatus = v_est)
                   AND (v_pat IS NULL OR a.matricula ILIKE v_pat OR a.correo_institucional ILIKE v_pat
                        OR concat_ws(' ', a.nombres, a.apellido_paterno, a.apellido_materno) ILIKE v_pat
                        OR concat_ws(' ', a.apellido_paterno, a.apellido_materno, a.nombres) ILIKE v_pat)
                 ORDER BY a.apellido_paterno, a.apellido_materno NULLS FIRST, a.nombres, a.id_alumno
                 LIMIT app.b1_limite(p_limit) OFFSET app.b1_desplazamiento(p_offset)
    ) x;
    RETURN jsonb_build_object('total', v_total, 'items', v_items);
END
$$;
GRANT EXECUTE ON FUNCTION public.api_alumnos_listar(text, text, integer, integer) TO authenticated;
COMMENT ON FUNCTION public.api_alumnos_listar(text, text, integer, integer) IS
$c$Lista alumnos con filtro de texto y estatus (paginada).
ARGS: p_q texto libre (matricula, nombre, correo; opcional); p_estatus activo|baja_temporal|baja_definitiva|egresado (opcional); p_limit def. 50 max 200; p_offset def. 0.
RETURNS: {"total": 25, "items": [{"id_alumno": 1, "matricula": "A001", "apellido_paterno": "Ramos", "apellido_materno": "Diaz", "nombres": "Beatriz", "nombre_completo": "Ramos Diaz Beatriz", "correo_institucional": "a001@unach.test", "estatus": "activo", "consentimiento_vigente": true, "plantilla_activa": true}]}
ERRORES: NO_AUTENTICADO, CUENTA_INACTIVA, NO_AUTORIZADO (alumno, tecnico), VALIDACION (estatus invalido).
ROLES: administrador (todos); docente (solo alumnos inscritos en sus grupos, por RLS).$c$;

CREATE OR REPLACE FUNCTION public.api_alumno_obtener(p_id_alumno integer) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    a      public.alumno%ROWTYPE;
    v_cons jsonb;
    v_plan jsonb;
    v_insc jsonb;
BEGIN
    PERFORM app.exigir_rol('administrador', 'docente');
    SELECT * INTO a FROM public.alumno WHERE id_alumno = p_id_alumno;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El alumno no existe.');
    END IF;

    -- Resumen del consentimiento: nunca la ruta del documento. El docente no ve la tabla (RLS): recibe null.
    SELECT jsonb_build_object('id_consent', c.id_consent, 'fecha_firma', c.fecha_firma,
               'vigencia_hasta', c.vigencia_hasta, 'estatus', c.estatus,
               'vigente', app.consentimiento_vigente(c.id_consent))
      INTO v_cons
      FROM public.consentimiento c WHERE c.id_alumno = a.id_alumno
     ORDER BY app.consentimiento_vigente(c.id_consent) DESC, c.fecha_firma DESC, c.id_consent DESC LIMIT 1;

    -- Resumen de la plantilla activa: sin objeto_foto ni vectores.
    SELECT jsonb_build_object('id_plantilla', p.id_plantilla, 'id_consent', p.id_consent,
               'fecha_registro', p.fecha_registro, 'indexada', p.id_indice IS NOT NULL,
               'version_indice', i.version)
      INTO v_plan
      FROM public.plantilla_facial p LEFT JOIN public.indice_faiss i ON i.id_indice = p.id_indice
     WHERE p.id_alumno = a.id_alumno AND p.activa
     ORDER BY p.fecha_registro DESC, p.id_plantilla DESC LIMIT 1;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
               'id_inscripcion', n.id_inscripcion, 'id_grupo', n.id_grupo, 'clave_grupo', n.clave_grupo,
               'periodo', n.periodo, 'materia_clave', n.materia_clave, 'estatus', n.estatus,
               'fecha_alta', n.fecha_alta, 'derecho_examen', n.derecho_examen)
               ORDER BY n.periodo DESC, n.materia_clave, n.clave_grupo), '[]'::jsonb)
      INTO v_insc
      FROM (SELECT i.id_inscripcion, i.id_grupo, g.clave_grupo, g.periodo, m.clave AS materia_clave,
                   i.estatus, i.fecha_alta, i.derecho_examen
              FROM public.inscripcion i
              JOIN public.grupo g ON g.id_grupo = i.id_grupo
              JOIN public.materia m ON m.id_materia = g.id_materia
             WHERE i.id_alumno = a.id_alumno) n;

    RETURN app.b1_alumno_json(a) || jsonb_build_object(
        'consentimiento_vigente', app.tiene_consentimiento_vigente(a.id_alumno),
        'consentimiento', v_cons, 'plantilla', v_plan, 'inscripciones', v_insc);
END
$$;
GRANT EXECUTE ON FUNCTION public.api_alumno_obtener(integer) TO authenticated;
COMMENT ON FUNCTION public.api_alumno_obtener(integer) IS
$c$Ficha de un alumno con resumen de consentimiento, plantilla facial e inscripciones (sin rutas privadas).
ARGS: p_id_alumno.
RETURNS: {"id_alumno": 1, "matricula": "A001", "nombre_completo": "Ramos Diaz Beatriz", "correo_institucional": "a001@unach.test", "estatus": "activo", "consentimiento_vigente": true, "consentimiento": {"id_consent": 1, "fecha_firma": "2026-08-01", "vigencia_hasta": "2027-08-01", "estatus": "vigente", "vigente": true}, "plantilla": {"id_plantilla": 1, "id_consent": 1, "fecha_registro": "2026-08-02T10:00:00-06:00", "indexada": true, "version_indice": "v001"}, "inscripciones": [{"id_inscripcion": 1, "id_grupo": 1, "clave_grupo": "3A", "periodo": "2026-2", "materia_clave": "ADM101", "estatus": "activa", "fecha_alta": "2026-08-03", "derecho_examen": true}]}
ERRORES: NO_AUTORIZADO, NO_ENCONTRADO (no existe o el docente no lo tiene en sus grupos).
ROLES: administrador; docente (solo alumnos de sus grupos; consentimiento llega null porque la tabla es solo del administrador).$c$;

CREATE OR REPLACE FUNCTION public.api_alumno_guardar(p jsonb) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_p     jsonb;
    v_id    integer;
    v_old   public.alumno%ROWTYPE;
    a       public.alumno%ROWTYPE;
    v_mat   text;
    v_ap    text;
    v_am    text;
    v_nom   text;
    v_cor   text;
    v_crea  boolean;
BEGIN
    PERFORM app.exigir_rol('administrador');
    v_p := app.b1_obj(p);
    v_id := app.b1_int(v_p, 'id_alumno');
    v_crea := v_id IS NULL;
    IF NOT v_crea THEN
        SELECT * INTO v_old FROM public.alumno WHERE id_alumno = v_id FOR UPDATE;
        IF NOT FOUND THEN
            PERFORM app.fallar('NO_ENCONTRADO', 'El alumno no existe.');
        END IF;
    END IF;

    -- En alta todo se exige; en modificacion lo ausente conserva su valor.
    v_mat := CASE WHEN v_crea OR v_p ? 'matricula' THEN upper(app.b1_str(v_p, 'matricula')) ELSE v_old.matricula END;
    v_ap  := CASE WHEN v_crea OR v_p ? 'apellido_paterno' THEN app.b1_str(v_p, 'apellido_paterno') ELSE v_old.apellido_paterno END;
    v_am  := CASE WHEN v_crea OR v_p ? 'apellido_materno' THEN app.b1_str(v_p, 'apellido_materno') ELSE v_old.apellido_materno END;
    v_nom := CASE WHEN v_crea OR v_p ? 'nombres' THEN app.b1_str(v_p, 'nombres') ELSE v_old.nombres END;
    v_cor := CASE WHEN v_crea OR v_p ? 'correo_institucional' OR v_p ? 'correo'
                  THEN lower(coalesce(app.b1_str(v_p, 'correo_institucional'), app.b1_str(v_p, 'correo')))
                  ELSE v_old.correo_institucional END;

    IF v_mat IS NULL OR v_mat !~ '^[A-Z0-9]{1,10}$' THEN
        PERFORM app.fallar('VALIDACION', 'La matrícula es obligatoria: hasta 10 letras o dígitos.');
    END IF;
    IF v_ap IS NULL OR length(v_ap) > 40 THEN
        PERFORM app.fallar('VALIDACION', 'El apellido paterno es obligatorio (máximo 40 caracteres).');
    END IF;
    IF v_am IS NOT NULL AND length(v_am) > 40 THEN
        PERFORM app.fallar('VALIDACION', 'El apellido materno admite máximo 40 caracteres.');
    END IF;
    IF v_nom IS NULL OR length(v_nom) > 60 THEN
        PERFORM app.fallar('VALIDACION', 'Los nombres son obligatorios (máximo 60 caracteres).');
    END IF;
    IF v_cor IS NULL OR length(v_cor) > 120 OR v_cor !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
        PERFORM app.fallar('VALIDACION', 'El correo institucional no es válido.');
    END IF;

    IF EXISTS (SELECT 1 FROM public.alumno x WHERE x.matricula = v_mat AND x.id_alumno IS DISTINCT FROM v_id) THEN
        PERFORM app.fallar('DUPLICADO', format('Ya existe un alumno con la matrícula %s.', v_mat));
    END IF;
    IF EXISTS (SELECT 1 FROM public.alumno x WHERE x.correo_institucional = v_cor AND x.id_alumno IS DISTINCT FROM v_id) THEN
        PERFORM app.fallar('DUPLICADO', 'Ya existe un alumno con ese correo institucional.');
    END IF;

    BEGIN
        IF v_crea THEN
            INSERT INTO public.alumno (matricula, apellido_paterno, apellido_materno, nombres, correo_institucional)
            VALUES (v_mat, v_ap, v_am, v_nom, v_cor) RETURNING * INTO a;
        ELSE
            UPDATE public.alumno SET matricula = v_mat, apellido_paterno = v_ap, apellido_materno = v_am,
                   nombres = v_nom, correo_institucional = v_cor
             WHERE id_alumno = v_id RETURNING * INTO a;
        END IF;
    EXCEPTION WHEN unique_violation THEN
        PERFORM app.fallar('DUPLICADO', 'La matrícula o el correo institucional ya existen.');
    END;
    RETURN app.b1_alumno_json(a) || jsonb_build_object('creado', v_crea);
END
$$;
GRANT EXECUTE ON FUNCTION public.api_alumno_guardar(jsonb) TO authenticated;
COMMENT ON FUNCTION public.api_alumno_guardar(jsonb) IS
$c$Da de alta (sin id_alumno) o modifica (con id_alumno) un alumno; el alta nace activo. El estatus se cambia con api_alumno_cambiar_estatus.
ARGS: p {id_alumno?, matricula, apellido_paterno, apellido_materno?, nombres, correo_institucional}; en modificacion lo ausente se conserva.
RETURNS: {"id_alumno": 7, "matricula": "A007", "nombre_completo": "Soto Mena Carla", "correo_institucional": "a007@unach.test", "estatus": "activo", "creado": true}
ERRORES: NO_AUTORIZADO, VALIDACION (campos), NO_ENCONTRADO (id_alumno), DUPLICADO (matricula o correo).
ROLES: administrador.$c$;

CREATE OR REPLACE FUNCTION public.api_alumno_cambiar_estatus(p_id_alumno integer, p_estatus text) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    a       public.alumno%ROWTYPE;
    v_nuevo public.estatus_alumno;
    v_bajas integer := 0;
BEGIN
    PERFORM app.exigir_rol('administrador');
    BEGIN
        v_nuevo := btrim(coalesce(p_estatus, ''))::public.estatus_alumno;
    EXCEPTION WHEN invalid_text_representation THEN
        PERFORM app.fallar('VALIDACION', 'Estatus de alumno no válido.');
    END;
    SELECT * INTO a FROM public.alumno WHERE id_alumno = p_id_alumno FOR UPDATE;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El alumno no existe.');
    END IF;
    IF a.estatus = v_nuevo THEN
        RETURN jsonb_build_object('id_alumno', a.id_alumno, 'estatus_anterior', a.estatus, 'estatus', a.estatus,
                                  'cambio', false, 'inscripciones_dadas_de_baja', 0);
    END IF;
    UPDATE public.alumno SET estatus = v_nuevo WHERE id_alumno = a.id_alumno;
    -- Un alumno que ya no esta activo deja de participar (RN-01); sus filas y asistencias se conservan.
    IF v_nuevo <> 'activo' THEN
        UPDATE public.inscripcion SET estatus = 'baja' WHERE id_alumno = a.id_alumno AND estatus = 'activa';
        GET DIAGNOSTICS v_bajas = ROW_COUNT;
    END IF;
    RETURN jsonb_build_object('id_alumno', a.id_alumno, 'estatus_anterior', a.estatus, 'estatus', v_nuevo,
                              'cambio', true, 'inscripciones_dadas_de_baja', v_bajas);
END
$$;
GRANT EXECUTE ON FUNCTION public.api_alumno_cambiar_estatus(integer, text) TO authenticated;
COMMENT ON FUNCTION public.api_alumno_cambiar_estatus(integer, text) IS
$c$Baja logica o reactivacion de un alumno: cambia el estatus y conserva todo el historial. Un estatus distinto de activo da de baja sus inscripciones activas; reactivar NO las restituye (hay que reinscribir). Idempotente.
ARGS: p_id_alumno; p_estatus activo|baja_temporal|baja_definitiva|egresado.
RETURNS: {"id_alumno": 7, "estatus_anterior": "activo", "estatus": "baja_temporal", "cambio": true, "inscripciones_dadas_de_baja": 2}
ERRORES: NO_AUTORIZADO, VALIDACION (estatus), NO_ENCONTRADO.
ROLES: administrador.$c$;

-- ===================================================================================================
-- DOCENTES
-- ===================================================================================================
CREATE OR REPLACE FUNCTION public.api_docentes_listar(
    p_q text DEFAULT NULL, p_estatus text DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0
) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_pat   text := app.b1_patron(p_q);
    v_est   public.estatus_docente;
    v_total bigint;
    v_items jsonb;
BEGIN
    PERFORM app.exigir_rol('administrador', 'docente');
    IF nullif(btrim(coalesce(p_estatus, '')), '') IS NOT NULL THEN
        BEGIN
            v_est := btrim(p_estatus)::public.estatus_docente;
        EXCEPTION WHEN invalid_text_representation THEN
            PERFORM app.fallar('VALIDACION', 'Estatus de docente no válido.');
        END;
    END IF;

    SELECT count(*) INTO v_total FROM public.docente d
     WHERE (v_est IS NULL OR d.estatus = v_est)
       AND (v_pat IS NULL OR d.num_empleado ILIKE v_pat OR d.correo_institucional ILIKE v_pat
            OR concat_ws(' ', d.nombres, d.apellido_paterno, d.apellido_materno) ILIKE v_pat
            OR concat_ws(' ', d.apellido_paterno, d.apellido_materno, d.nombres) ILIKE v_pat);

    SELECT coalesce(jsonb_agg(x.j ORDER BY x.rn), '[]'::jsonb) INTO v_items FROM (
        SELECT row_number() OVER (ORDER BY d.apellido_paterno, d.apellido_materno NULLS FIRST, d.nombres, d.id_docente) AS rn,
               app.b1_docente_json(d) || jsonb_build_object(
                   'grupos', (SELECT count(*) FROM public.grupo g WHERE g.id_docente = d.id_docente)) AS j
          FROM public.docente d
                 WHERE (v_est IS NULL OR d.estatus = v_est)
                   AND (v_pat IS NULL OR d.num_empleado ILIKE v_pat OR d.correo_institucional ILIKE v_pat
                        OR concat_ws(' ', d.nombres, d.apellido_paterno, d.apellido_materno) ILIKE v_pat
                        OR concat_ws(' ', d.apellido_paterno, d.apellido_materno, d.nombres) ILIKE v_pat)
                 ORDER BY d.apellido_paterno, d.apellido_materno NULLS FIRST, d.nombres, d.id_docente
                 LIMIT app.b1_limite(p_limit) OFFSET app.b1_desplazamiento(p_offset)
    ) x;
    RETURN jsonb_build_object('total', v_total, 'items', v_items);
END
$$;
GRANT EXECUTE ON FUNCTION public.api_docentes_listar(text, text, integer, integer) TO authenticated;
COMMENT ON FUNCTION public.api_docentes_listar(text, text, integer, integer) IS
$c$Lista docentes con filtro de texto y estatus (paginada).
ARGS: p_q texto libre (num_empleado, nombre, correo; opcional); p_estatus activo|licencia|baja (opcional); p_limit def. 50 max 200; p_offset def. 0.
RETURNS: {"total": 2, "items": [{"id_docente": 1, "num_empleado": "D001", "apellido_paterno": "Lopez", "apellido_materno": "Ruiz", "nombres": "Ana", "nombre_completo": "Lopez Ruiz Ana", "correo_institucional": "ana.lopez@unach.test", "estatus": "activo", "grupos": 1}]}
ERRORES: NO_AUTORIZADO (alumno, tecnico), VALIDACION (estatus invalido).
ROLES: administrador (todos); docente (solo su propia fila, por RLS).$c$;

CREATE OR REPLACE FUNCTION public.api_docente_obtener(p_id_docente integer) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    d       public.docente%ROWTYPE;
    v_grp   jsonb;
BEGIN
    PERFORM app.exigir_rol('administrador', 'docente');
    SELECT * INTO d FROM public.docente WHERE id_docente = p_id_docente;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El docente no existe.');
    END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object('id_grupo', g.id_grupo, 'clave_grupo', g.clave_grupo,
               'periodo', g.periodo, 'materia_clave', m.clave, 'materia_nombre', m.nombre)
               ORDER BY g.periodo DESC, m.clave, g.clave_grupo), '[]'::jsonb)
      INTO v_grp
      FROM public.grupo g JOIN public.materia m ON m.id_materia = g.id_materia
     WHERE g.id_docente = d.id_docente;
    RETURN app.b1_docente_json(d) || jsonb_build_object('grupos', v_grp);
END
$$;
GRANT EXECUTE ON FUNCTION public.api_docente_obtener(integer) TO authenticated;
COMMENT ON FUNCTION public.api_docente_obtener(integer) IS
$c$Ficha de un docente con sus grupos.
ARGS: p_id_docente.
RETURNS: {"id_docente": 1, "num_empleado": "D001", "nombre_completo": "Lopez Ruiz Ana", "correo_institucional": "ana.lopez@unach.test", "estatus": "activo", "grupos": [{"id_grupo": 1, "clave_grupo": "3A", "periodo": "2026-2", "materia_clave": "ADM101", "materia_nombre": "Administracion I"}]}
ERRORES: NO_AUTORIZADO, NO_ENCONTRADO (no existe o el docente consulta a otro).
ROLES: administrador; docente (solo a si mismo).$c$;

CREATE OR REPLACE FUNCTION public.api_docente_guardar(p jsonb) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_p     jsonb;
    v_id    integer;
    v_old   public.docente%ROWTYPE;
    d       public.docente%ROWTYPE;
    v_num   text;
    v_ap    text;
    v_am    text;
    v_nom   text;
    v_cor   text;
    v_crea  boolean;
BEGIN
    PERFORM app.exigir_rol('administrador');
    v_p := app.b1_obj(p);
    v_id := app.b1_int(v_p, 'id_docente');
    v_crea := v_id IS NULL;
    IF NOT v_crea THEN
        SELECT * INTO v_old FROM public.docente WHERE id_docente = v_id FOR UPDATE;
        IF NOT FOUND THEN
            PERFORM app.fallar('NO_ENCONTRADO', 'El docente no existe.');
        END IF;
    END IF;

    v_num := CASE WHEN v_crea OR v_p ? 'num_empleado' THEN upper(app.b1_str(v_p, 'num_empleado')) ELSE v_old.num_empleado END;
    v_ap  := CASE WHEN v_crea OR v_p ? 'apellido_paterno' THEN app.b1_str(v_p, 'apellido_paterno') ELSE v_old.apellido_paterno END;
    v_am  := CASE WHEN v_crea OR v_p ? 'apellido_materno' THEN app.b1_str(v_p, 'apellido_materno') ELSE v_old.apellido_materno END;
    v_nom := CASE WHEN v_crea OR v_p ? 'nombres' THEN app.b1_str(v_p, 'nombres') ELSE v_old.nombres END;
    v_cor := CASE WHEN v_crea OR v_p ? 'correo_institucional' OR v_p ? 'correo'
                  THEN lower(coalesce(app.b1_str(v_p, 'correo_institucional'), app.b1_str(v_p, 'correo')))
                  ELSE v_old.correo_institucional END;

    IF v_num IS NULL OR v_num !~ '^[A-Z0-9]{1,10}$' THEN
        PERFORM app.fallar('VALIDACION', 'El número de empleado es obligatorio: hasta 10 letras o dígitos.');
    END IF;
    IF v_ap IS NULL OR length(v_ap) > 40 THEN
        PERFORM app.fallar('VALIDACION', 'El apellido paterno es obligatorio (máximo 40 caracteres).');
    END IF;
    IF v_am IS NOT NULL AND length(v_am) > 40 THEN
        PERFORM app.fallar('VALIDACION', 'El apellido materno admite máximo 40 caracteres.');
    END IF;
    IF v_nom IS NULL OR length(v_nom) > 60 THEN
        PERFORM app.fallar('VALIDACION', 'Los nombres son obligatorios (máximo 60 caracteres).');
    END IF;
    IF v_cor IS NULL OR length(v_cor) > 120 OR v_cor !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
        PERFORM app.fallar('VALIDACION', 'El correo institucional no es válido.');
    END IF;

    IF EXISTS (SELECT 1 FROM public.docente x WHERE x.num_empleado = v_num AND x.id_docente IS DISTINCT FROM v_id) THEN
        PERFORM app.fallar('DUPLICADO', format('Ya existe un docente con el número de empleado %s.', v_num));
    END IF;
    IF EXISTS (SELECT 1 FROM public.docente x WHERE x.correo_institucional = v_cor AND x.id_docente IS DISTINCT FROM v_id) THEN
        PERFORM app.fallar('DUPLICADO', 'Ya existe un docente con ese correo institucional.');
    END IF;

    BEGIN
        IF v_crea THEN
            INSERT INTO public.docente (num_empleado, apellido_paterno, apellido_materno, nombres, correo_institucional)
            VALUES (v_num, v_ap, v_am, v_nom, v_cor) RETURNING * INTO d;
        ELSE
            UPDATE public.docente SET num_empleado = v_num, apellido_paterno = v_ap, apellido_materno = v_am,
                   nombres = v_nom, correo_institucional = v_cor
             WHERE id_docente = v_id RETURNING * INTO d;
        END IF;
    EXCEPTION WHEN unique_violation THEN
        PERFORM app.fallar('DUPLICADO', 'El número de empleado o el correo institucional ya existen.');
    END;
    RETURN app.b1_docente_json(d) || jsonb_build_object('creado', v_crea);
END
$$;
GRANT EXECUTE ON FUNCTION public.api_docente_guardar(jsonb) TO authenticated;
COMMENT ON FUNCTION public.api_docente_guardar(jsonb) IS
$c$Da de alta (sin id_docente) o modifica (con id_docente) un docente; el alta nace activo. El estatus se cambia con api_docente_cambiar_estatus.
ARGS: p {id_docente?, num_empleado, apellido_paterno, apellido_materno?, nombres, correo_institucional}; en modificacion lo ausente se conserva.
RETURNS: {"id_docente": 3, "num_empleado": "D003", "nombre_completo": "Mena Soto Rosa", "correo_institucional": "rosa.mena@unach.test", "estatus": "activo", "creado": true}
ERRORES: NO_AUTORIZADO, VALIDACION, NO_ENCONTRADO, DUPLICADO (num_empleado o correo).
ROLES: administrador.$c$;

CREATE OR REPLACE FUNCTION public.api_docente_cambiar_estatus(p_id_docente integer, p_estatus text) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    d       public.docente%ROWTYPE;
    v_nuevo public.estatus_docente;
BEGIN
    PERFORM app.exigir_rol('administrador');
    BEGIN
        v_nuevo := btrim(coalesce(p_estatus, ''))::public.estatus_docente;
    EXCEPTION WHEN invalid_text_representation THEN
        PERFORM app.fallar('VALIDACION', 'Estatus de docente no válido.');
    END;
    SELECT * INTO d FROM public.docente WHERE id_docente = p_id_docente FOR UPDATE;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El docente no existe.');
    END IF;
    IF d.estatus = v_nuevo THEN
        RETURN jsonb_build_object('id_docente', d.id_docente, 'estatus_anterior', d.estatus, 'estatus', d.estatus, 'cambio', false);
    END IF;
    -- No se puede dar de baja a quien aun tiene clases por impartir: primero se reasignan sus grupos.
    IF v_nuevo = 'baja' AND EXISTS (
        SELECT 1 FROM public.grupo g JOIN public.sesion_clase s ON s.id_grupo = g.id_grupo
         WHERE g.id_docente = d.id_docente AND s.estatus IN ('programada', 'abierta') AND s.fecha >= app.hoy()) THEN
        PERFORM app.fallar('DOCENTE_CON_GRUPOS', 'El docente tiene sesiones por impartir; reasigna sus grupos antes de darlo de baja.');
    END IF;
    UPDATE public.docente SET estatus = v_nuevo WHERE id_docente = d.id_docente;
    RETURN jsonb_build_object('id_docente', d.id_docente, 'estatus_anterior', d.estatus, 'estatus', v_nuevo, 'cambio', true);
END
$$;
GRANT EXECUTE ON FUNCTION public.api_docente_cambiar_estatus(integer, text) TO authenticated;
COMMENT ON FUNCTION public.api_docente_cambiar_estatus(integer, text) IS
$c$Baja logica, licencia o reactivacion de un docente; conserva el historial. Idempotente. La baja se rechaza si tiene sesiones programadas o abiertas de hoy en adelante.
ARGS: p_id_docente; p_estatus activo|licencia|baja.
RETURNS: {"id_docente": 3, "estatus_anterior": "activo", "estatus": "licencia", "cambio": true}
ERRORES: NO_AUTORIZADO, VALIDACION (estatus), NO_ENCONTRADO, DOCENTE_CON_GRUPOS (baja con sesiones por impartir).
ROLES: administrador.$c$;

-- ===================================================================================================
-- MATERIAS
-- ===================================================================================================
CREATE OR REPLACE FUNCTION public.api_materias_listar(
    p_q text DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0
) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_pat   text := app.b1_patron(p_q);
    v_total bigint;
    v_items jsonb;
BEGIN
    PERFORM app.exigir_rol('administrador', 'docente');
    SELECT count(*) INTO v_total FROM public.materia m
     WHERE v_pat IS NULL OR m.clave ILIKE v_pat OR m.nombre ILIKE v_pat;
    SELECT coalesce(jsonb_agg(x.j ORDER BY x.rn), '[]'::jsonb) INTO v_items FROM (
        SELECT row_number() OVER (ORDER BY m.clave) AS rn, app.b1_materia_json(m) AS j
          FROM public.materia m
         WHERE v_pat IS NULL OR m.clave ILIKE v_pat OR m.nombre ILIKE v_pat
         ORDER BY m.clave LIMIT app.b1_limite(p_limit) OFFSET app.b1_desplazamiento(p_offset)
    ) x;
    RETURN jsonb_build_object('total', v_total, 'items', v_items);
END
$$;
GRANT EXECUTE ON FUNCTION public.api_materias_listar(text, integer, integer) TO authenticated;
COMMENT ON FUNCTION public.api_materias_listar(text, integer, integer) IS
$c$Lista materias con filtro de texto (paginada).
ARGS: p_q texto libre (clave o nombre; opcional); p_limit def. 50 max 200; p_offset def. 0.
RETURNS: {"total": 2, "items": [{"id_materia": 1, "clave": "ADM101", "nombre": "Administracion I", "creditos": 8, "horas_semana": 4}]}
ERRORES: NO_AUTORIZADO (alumno, tecnico).
ROLES: administrador (todas); docente (solo materias de sus grupos, por RLS).$c$;

CREATE OR REPLACE FUNCTION public.api_materia_obtener(p_id_materia integer) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    m public.materia%ROWTYPE;
BEGIN
    PERFORM app.exigir_rol('administrador', 'docente');
    SELECT * INTO m FROM public.materia WHERE id_materia = p_id_materia;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'La materia no existe.');
    END IF;
    RETURN app.b1_materia_json(m);
END
$$;
GRANT EXECUTE ON FUNCTION public.api_materia_obtener(integer) TO authenticated;
COMMENT ON FUNCTION public.api_materia_obtener(integer) IS
$c$Ficha de una materia.
ARGS: p_id_materia.
RETURNS: {"id_materia": 1, "clave": "ADM101", "nombre": "Administracion I", "creditos": 8, "horas_semana": 4}
ERRORES: NO_AUTORIZADO, NO_ENCONTRADO.
ROLES: administrador; docente (solo materias de sus grupos).$c$;

CREATE OR REPLACE FUNCTION public.api_materia_guardar(p jsonb) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_p     jsonb;
    v_id    integer;
    v_old   public.materia%ROWTYPE;
    m       public.materia%ROWTYPE;
    v_cla   text;
    v_nom   text;
    v_cre   integer;
    v_hor   integer;
    v_crea  boolean;
BEGIN
    PERFORM app.exigir_rol('administrador');
    v_p := app.b1_obj(p);
    v_id := app.b1_int(v_p, 'id_materia');
    v_crea := v_id IS NULL;
    IF NOT v_crea THEN
        SELECT * INTO v_old FROM public.materia WHERE id_materia = v_id FOR UPDATE;
        IF NOT FOUND THEN
            PERFORM app.fallar('NO_ENCONTRADO', 'La materia no existe.');
        END IF;
    END IF;

    v_cla := CASE WHEN v_crea OR v_p ? 'clave' THEN upper(app.b1_str(v_p, 'clave')) ELSE v_old.clave END;
    v_nom := CASE WHEN v_crea OR v_p ? 'nombre' THEN app.b1_str(v_p, 'nombre') ELSE v_old.nombre END;
    v_cre := CASE WHEN v_crea OR v_p ? 'creditos' THEN app.b1_int(v_p, 'creditos') ELSE v_old.creditos END;
    v_hor := CASE WHEN v_crea OR v_p ? 'horas_semana' THEN app.b1_int(v_p, 'horas_semana') ELSE v_old.horas_semana END;

    IF v_cla IS NULL OR v_cla !~ '^[A-Z0-9]{1,8}$' THEN
        PERFORM app.fallar('VALIDACION', 'La clave es obligatoria: hasta 8 letras o dígitos.');
    END IF;
    IF v_nom IS NULL OR length(v_nom) > 80 THEN
        PERFORM app.fallar('VALIDACION', 'El nombre es obligatorio (máximo 80 caracteres).');
    END IF;
    IF v_cre IS NULL OR v_cre < 1 OR v_cre > 32767 THEN
        PERFORM app.fallar('VALIDACION', 'Los créditos deben ser un entero positivo.');
    END IF;
    IF v_hor IS NULL OR v_hor NOT BETWEEN 1 AND 20 THEN
        PERFORM app.fallar('VALIDACION', 'Las horas por semana deben estar entre 1 y 20.');
    END IF;
    IF EXISTS (SELECT 1 FROM public.materia x WHERE x.clave = v_cla AND x.id_materia IS DISTINCT FROM v_id) THEN
        PERFORM app.fallar('DUPLICADO', format('Ya existe una materia con la clave %s.', v_cla));
    END IF;

    BEGIN
        IF v_crea THEN
            INSERT INTO public.materia (clave, nombre, creditos, horas_semana)
            VALUES (v_cla, v_nom, v_cre, v_hor) RETURNING * INTO m;
        ELSE
            UPDATE public.materia SET clave = v_cla, nombre = v_nom, creditos = v_cre, horas_semana = v_hor
             WHERE id_materia = v_id RETURNING * INTO m;
        END IF;
    EXCEPTION WHEN unique_violation THEN
        PERFORM app.fallar('DUPLICADO', 'La clave de materia ya existe.');
    END;
    RETURN app.b1_materia_json(m) || jsonb_build_object('creado', v_crea);
END
$$;
GRANT EXECUTE ON FUNCTION public.api_materia_guardar(jsonb) TO authenticated;
COMMENT ON FUNCTION public.api_materia_guardar(jsonb) IS
$c$Da de alta (sin id_materia) o modifica (con id_materia) una materia.
ARGS: p {id_materia?, clave (max 8), nombre (max 80), creditos > 0, horas_semana 1..20}; en modificacion lo ausente se conserva.
RETURNS: {"id_materia": 3, "clave": "MAT110", "nombre": "Matematicas", "creditos": 6, "horas_semana": 4, "creado": true}
ERRORES: NO_AUTORIZADO, VALIDACION, NO_ENCONTRADO, DUPLICADO (clave).
ROLES: administrador.$c$;
