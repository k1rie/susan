-- 0204 · db-admin · inscripciones (RF-02, RN-01) y carga masiva.
-- Reglas: una fila por (alumno, grupo); la reinscripcion tras baja REACTIVA la fila (fecha_alta = hoy);
-- solo alumnos activos se inscriben. Codigos: INSCRIPCION_DUPLICADA, ALUMNO_NO_ACTIVO.
-- Importacion: validacion fila por fila y un subtransaccion (SAVEPOINT implicito del bloque EXCEPTION) por fila,
-- de modo que una fila mala no deshace las buenas; un lote admite hasta 500 filas.

-- Nucleo compartido por api_inscribir y la importacion. Se llama solo desde funciones DEFINER.
CREATE OR REPLACE FUNCTION app.b1_inscribir(p_id_grupo integer, p_id_alumno integer)
    RETURNS TABLE (id_inscripcion integer, resultado text)
    LANGUAGE plpgsql VOLATILE
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_est public.estatus_alumno;
    i     public.inscripcion%ROWTYPE;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.grupo WHERE grupo.id_grupo = p_id_grupo) THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El grupo no existe.');
    END IF;
    SELECT a.estatus INTO v_est FROM public.alumno a WHERE a.id_alumno = p_id_alumno;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El alumno no existe.');
    END IF;
    IF v_est <> 'activo' THEN
        PERFORM app.fallar('ALUMNO_NO_ACTIVO', 'Solo se puede inscribir a un alumno activo.');
    END IF;

    SELECT * INTO i FROM public.inscripcion n WHERE n.id_alumno = p_id_alumno AND n.id_grupo = p_id_grupo FOR UPDATE;
    IF FOUND THEN
        IF i.estatus = 'activa' THEN
            PERFORM app.fallar('INSCRIPCION_DUPLICADA', 'El alumno ya está inscrito en el grupo.');
        END IF;
        UPDATE public.inscripcion SET estatus = 'activa', fecha_alta = app.hoy() WHERE inscripcion.id_inscripcion = i.id_inscripcion;
        -- Con historial previo, el derecho a examen se vuelve a calcular si el dominio de asistencia ya lo define.
        IF to_regprocedure('app.recalcular_inscripcion(integer)') IS NOT NULL THEN
            EXECUTE format('SELECT app.recalcular_inscripcion(%s)', i.id_inscripcion);
        END IF;
        RETURN QUERY SELECT i.id_inscripcion, 'reinscrito'::text;
        RETURN;
    END IF;

    BEGIN
        INSERT INTO public.inscripcion (id_alumno, id_grupo) VALUES (p_id_alumno, p_id_grupo) RETURNING * INTO i;
    EXCEPTION WHEN unique_violation THEN
        PERFORM app.fallar('INSCRIPCION_DUPLICADA', 'El alumno ya está inscrito en el grupo.');
    END;
    RETURN QUERY SELECT i.id_inscripcion, 'inscrito'::text;
END
$$;

-- ---------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_inscribir(p_id_grupo integer, p_id_alumno integer) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_id  integer;
    v_res text;
    i     public.inscripcion%ROWTYPE;
BEGIN
    PERFORM app.exigir_rol('administrador');
    SELECT r.id_inscripcion, r.resultado INTO v_id, v_res FROM app.b1_inscribir(p_id_grupo, p_id_alumno) r;
    SELECT * INTO i FROM public.inscripcion WHERE id_inscripcion = v_id;
    RETURN jsonb_build_object('id_inscripcion', i.id_inscripcion, 'id_grupo', i.id_grupo, 'id_alumno', i.id_alumno,
        'estatus', i.estatus, 'fecha_alta', i.fecha_alta, 'derecho_examen', i.derecho_examen,
        'reinscrita', v_res = 'reinscrito');
END
$$;
GRANT EXECUTE ON FUNCTION public.api_inscribir(integer, integer) TO authenticated;
COMMENT ON FUNCTION public.api_inscribir(integer, integer) IS
$c$Inscribe a un alumno activo en un grupo. Sin duplicados: si ya esta activo se rechaza; si estaba en baja se reactiva la misma fila con fecha_alta de hoy.
ARGS: p_id_grupo; p_id_alumno.
RETURNS: {"id_inscripcion": 7, "id_grupo": 1, "id_alumno": 3, "estatus": "activa", "fecha_alta": "2026-09-14", "derecho_examen": true, "reinscrita": false}
ERRORES: NO_AUTORIZADO, NO_ENCONTRADO (grupo o alumno), ALUMNO_NO_ACTIVO, INSCRIPCION_DUPLICADA.
ROLES: administrador.$c$;

CREATE OR REPLACE FUNCTION public.api_baja_inscripcion(p_id_inscripcion integer) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    i public.inscripcion%ROWTYPE;
BEGIN
    PERFORM app.exigir_rol('administrador');
    SELECT * INTO i FROM public.inscripcion WHERE id_inscripcion = p_id_inscripcion FOR UPDATE;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'La inscripción no existe.');
    END IF;
    IF i.estatus = 'baja' THEN
        RETURN jsonb_build_object('id_inscripcion', i.id_inscripcion, 'id_grupo', i.id_grupo, 'id_alumno', i.id_alumno,
                                  'estatus', 'baja', 'cambio', false);
    END IF;
    -- Baja logica: la fila y la asistencia ya registrada se conservan; deja de participar en busqueda y cierre.
    UPDATE public.inscripcion SET estatus = 'baja' WHERE id_inscripcion = i.id_inscripcion;
    RETURN jsonb_build_object('id_inscripcion', i.id_inscripcion, 'id_grupo', i.id_grupo, 'id_alumno', i.id_alumno,
                              'estatus', 'baja', 'cambio', true);
END
$$;
GRANT EXECUTE ON FUNCTION public.api_baja_inscripcion(integer) TO authenticated;
COMMENT ON FUNCTION public.api_baja_inscripcion(integer) IS
$c$Da de baja (logica) una inscripcion: conserva la fila y su historial. Idempotente.
ARGS: p_id_inscripcion.
RETURNS: {"id_inscripcion": 7, "id_grupo": 1, "id_alumno": 3, "estatus": "baja", "cambio": true}
ERRORES: NO_AUTORIZADO, NO_ENCONTRADO.
ROLES: administrador.$c$;

CREATE OR REPLACE FUNCTION public.api_inscritos(p_id_grupo integer, p_estatus text DEFAULT NULL) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_est   public.estatus_inscripcion;
    v_items jsonb;
BEGIN
    PERFORM app.exigir_rol('administrador', 'docente');
    IF NOT EXISTS (SELECT 1 FROM public.grupo WHERE id_grupo = p_id_grupo) THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El grupo no existe.');
    END IF;
    IF nullif(btrim(coalesce(p_estatus, '')), '') IS NOT NULL THEN
        BEGIN
            v_est := btrim(p_estatus)::public.estatus_inscripcion;
        EXCEPTION WHEN invalid_text_representation THEN
            PERFORM app.fallar('VALIDACION', 'Estatus de inscripción no válido (activa o baja).');
        END;
    END IF;
    SELECT coalesce(jsonb_agg(x.j ORDER BY x.rn), '[]'::jsonb) INTO v_items FROM (
        SELECT row_number() OVER (ORDER BY a.apellido_paterno, a.apellido_materno NULLS FIRST, a.nombres, i.id_inscripcion) AS rn,
               jsonb_build_object(
                   'id_inscripcion', i.id_inscripcion, 'id_alumno', a.id_alumno, 'matricula', a.matricula,
                   'nombre_completo', app.b1_nombre(a.apellido_paterno, a.apellido_materno, a.nombres),
                   'correo_institucional', a.correo_institucional, 'estatus_alumno', a.estatus,
                   'estatus', i.estatus, 'fecha_alta', i.fecha_alta, 'derecho_examen', i.derecho_examen,
                   'consentimiento_vigente', app.tiene_consentimiento_vigente(a.id_alumno)) AS j
          FROM public.inscripcion i JOIN public.alumno a ON a.id_alumno = i.id_alumno
         WHERE i.id_grupo = p_id_grupo AND (v_est IS NULL OR i.estatus = v_est)
    ) x;
    RETURN jsonb_build_object('id_grupo', p_id_grupo, 'total', jsonb_array_length(v_items), 'items', v_items);
END
$$;
GRANT EXECUTE ON FUNCTION public.api_inscritos(integer, text) TO authenticated;
COMMENT ON FUNCTION public.api_inscritos(integer, text) IS
$c$Lista de inscritos de un grupo (sin paginar: un grupo es acotado) con estatus, alta, derecho a examen y consentimiento vigente.
ARGS: p_id_grupo; p_estatus activa|baja (opcional; sin el, todas).
RETURNS: {"id_grupo": 1, "total": 5, "items": [{"id_inscripcion": 1, "id_alumno": 1, "matricula": "A001", "nombre_completo": "Ramos Diaz Beatriz", "correo_institucional": "a001@unach.test", "estatus_alumno": "activo", "estatus": "activa", "fecha_alta": "2026-08-03", "derecho_examen": true, "consentimiento_vigente": true}]}
ERRORES: NO_AUTORIZADO (alumno, tecnico), NO_ENCONTRADO (grupo inexistente o ajeno al docente), VALIDACION (estatus).
ROLES: administrador; docente (solo sus grupos, por RLS).$c$;

CREATE OR REPLACE FUNCTION public.api_importar_inscripciones(p_id_grupo integer, p_filas jsonb) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    e         jsonb;
    n         bigint;
    v_mat     text;
    v_ap      text;
    v_am      text;
    v_nom     text;
    v_cor     text;
    v_id      integer;
    v_est     public.estatus_alumno;
    v_creado  boolean;
    v_res     text;
    v_cod     text;
    v_msg     text;
    v_hint    text;
    v_state   text;
    v_out     jsonb := '[]'::jsonb;
    c_ins     integer := 0;
    c_reins   integer := 0;
    c_omit    integer := 0;
    c_err     integer := 0;
    c_crea    integer := 0;
BEGIN
    PERFORM app.exigir_rol('administrador');
    IF NOT EXISTS (SELECT 1 FROM public.grupo WHERE id_grupo = p_id_grupo) THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El grupo no existe.');
    END IF;
    IF p_filas IS NULL OR jsonb_typeof(p_filas) <> 'array' OR jsonb_array_length(p_filas) = 0 THEN
        PERFORM app.fallar('VALIDACION', 'p_filas debe ser un arreglo con al menos una fila.');
    END IF;
    IF jsonb_array_length(p_filas) > 500 THEN
        PERFORM app.fallar('VALIDACION', 'Un lote admite como máximo 500 filas; divide el archivo.');
    END IF;

    FOR e, n IN SELECT x, o FROM jsonb_array_elements(p_filas) WITH ORDINALITY AS t(x, o) LOOP
        v_creado := false; v_res := NULL; v_cod := NULL; v_msg := NULL; v_id := NULL; v_mat := NULL;
        BEGIN   -- subtransaccion por fila: lo que falle aqui no deshace las filas buenas
            IF jsonb_typeof(e) <> 'object' THEN
                PERFORM app.fallar('VALIDACION', 'La fila debe ser un objeto.');
            END IF;
            v_mat := upper(app.b1_str(e, 'matricula'));
            IF v_mat IS NULL OR v_mat !~ '^[A-Z0-9]{1,10}$' THEN
                PERFORM app.fallar('VALIDACION', 'La matrícula es obligatoria: hasta 10 letras o dígitos.');
            END IF;

            SELECT a.id_alumno, a.estatus INTO v_id, v_est FROM public.alumno a WHERE a.matricula = v_mat;
            IF NOT FOUND THEN
                v_ap  := app.b1_str(e, 'apellido_paterno');
                v_am  := app.b1_str(e, 'apellido_materno');
                v_nom := app.b1_str(e, 'nombres');
                v_cor := lower(coalesce(app.b1_str(e, 'correo'), app.b1_str(e, 'correo_institucional')));
                IF v_ap IS NULL OR length(v_ap) > 40 OR (v_am IS NOT NULL AND length(v_am) > 40)
                   OR v_nom IS NULL OR length(v_nom) > 60 THEN
                    PERFORM app.fallar('VALIDACION', 'Alumno nuevo: apellido paterno y nombres son obligatorios (40/40/60 caracteres).');
                END IF;
                IF v_cor IS NULL OR length(v_cor) > 120 OR v_cor !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
                    PERFORM app.fallar('VALIDACION', 'Alumno nuevo: el correo institucional no es válido.');
                END IF;
                IF EXISTS (SELECT 1 FROM public.alumno a WHERE a.correo_institucional = v_cor) THEN
                    PERFORM app.fallar('DUPLICADO', 'Ese correo institucional ya pertenece a otro alumno.');
                END IF;
                INSERT INTO public.alumno (matricula, apellido_paterno, apellido_materno, nombres, correo_institucional)
                VALUES (v_mat, v_ap, v_am, v_nom, v_cor) RETURNING id_alumno INTO v_id;
                v_creado := true;
            END IF;

            SELECT r.resultado INTO v_res FROM app.b1_inscribir(p_id_grupo, v_id) r;
            v_msg := CASE WHEN v_creado THEN 'Alumno creado e inscrito.'
                          WHEN v_res = 'reinscrito' THEN 'Reinscrito (se reactivó su inscripción).'
                          ELSE 'Inscrito.' END;
        EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT, v_hint = PG_EXCEPTION_HINT;
            v_creado := false;       -- la subtransaccion deshizo la creacion del alumno
            IF v_state = 'P0001' AND v_hint IS NOT NULL THEN
                v_cod := v_hint;
            ELSIF v_state = '23505' THEN
                v_cod := 'DUPLICADO'; v_msg := 'La matrícula o el correo ya existen.';
            ELSIF v_state IN ('23514', '22001', '22P02') THEN
                v_cod := 'VALIDACION'; v_msg := 'La fila contiene datos no válidos.';
            ELSE
                v_cod := 'ERROR_FILA'; v_msg := 'No se pudo procesar la fila.';
            END IF;
            v_res := CASE WHEN v_cod = 'INSCRIPCION_DUPLICADA' THEN 'omitido' ELSE 'error' END;
        END;

        IF v_res = 'inscrito' THEN c_ins := c_ins + 1;
        ELSIF v_res = 'reinscrito' THEN c_reins := c_reins + 1;
        ELSIF v_res = 'omitido' THEN c_omit := c_omit + 1;
        ELSE c_err := c_err + 1;
        END IF;
        IF v_creado THEN c_crea := c_crea + 1; END IF;

        v_out := v_out || jsonb_build_array(jsonb_build_object(
            'fila', n, 'matricula', v_mat, 'resultado', v_res, 'codigo', v_cod, 'mensaje', v_msg,
            'alumno_creado', v_creado));
    END LOOP;

    RETURN jsonb_build_object('id_grupo', p_id_grupo, 'total', jsonb_array_length(p_filas),
        'inscritos', c_ins, 'reinscritos', c_reins, 'omitidos', c_omit, 'errores', c_err,
        'alumnos_creados', c_crea, 'filas', v_out);
END
$$;
GRANT EXECUTE ON FUNCTION public.api_importar_inscripciones(integer, jsonb) TO authenticated;
COMMENT ON FUNCTION public.api_importar_inscripciones(integer, jsonb) IS
$c$Carga masiva de inscripciones por lote (maximo 500 filas): por cada fila crea el alumno si su matricula no existe (exige apellido_paterno, nombres y correo) o reutiliza el existente (sin modificar sus datos) y lo inscribe. Cada fila se valida y se ejecuta en su propia subtransaccion: las malas no deshacen las buenas. Una fila ya inscrita se reporta como omitida; un alumno que no esta activo, como error.
ARGS: p_id_grupo; p_filas [{"matricula": "A101", "nombres": "Ana", "apellido_paterno": "Soto", "apellido_materno": "Mena", "correo": "a101@unach.test"}].
RETURNS: {"id_grupo": 1, "total": 3, "inscritos": 1, "reinscritos": 0, "omitidos": 1, "errores": 1, "alumnos_creados": 1, "filas": [{"fila": 1, "matricula": "A101", "resultado": "inscrito", "codigo": null, "mensaje": "Alumno creado e inscrito.", "alumno_creado": true}]}
ERRORES: NO_AUTORIZADO, NO_ENCONTRADO (grupo), VALIDACION (lote vacio o de mas de 500). Por fila: resultado inscrito|reinscrito|omitido|error con codigo VALIDACION, DUPLICADO, ALUMNO_NO_ACTIVO, INSCRIPCION_DUPLICADA o ERROR_FILA.
ROLES: administrador.$c$;
