-- 0203 · db-admin · grupos, horario semanal y sesiones programadas (RF-01, RF-22, RN-06).
-- Codigos propios: PERIODO_INVALIDO, HORARIO_INVALIDO, HORARIO_CHOQUE, GRUPO_CON_HISTORIAL, DOCENTE_NO_ACTIVO,
-- GRUPO_SIN_HORARIO. Un docente que consulta un grupo ajeno recibe NO_ENCONTRADO (la RLS lo oculta).

-- Forma base de un grupo con nombres de materia, docente y aula. INVOKER: lo que se lee depende de la RLS.
CREATE OR REPLACE FUNCTION app.b1_grupo_base(p_id_grupo integer) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
    SELECT jsonb_build_object(
        'id_grupo', g.id_grupo, 'periodo', g.periodo, 'clave_grupo', g.clave_grupo,
        'id_materia', g.id_materia, 'materia_clave', m.clave, 'materia_nombre', m.nombre,
        'id_docente', g.id_docente,
        'docente_nombre', app.b1_nombre(d.apellido_paterno, d.apellido_materno, d.nombres),
        'id_aula', g.id_aula, 'aula_clave', a.clave)
      FROM public.grupo g
      JOIN public.materia m ON m.id_materia = g.id_materia
      LEFT JOIN public.docente d ON d.id_docente = g.id_docente
      LEFT JOIN public.aula a ON a.id_aula = g.id_aula
     WHERE g.id_grupo = p_id_grupo
$$;
GRANT EXECUTE ON FUNCTION app.b1_grupo_base(integer) TO authenticated, service_role;

-- Primer bloque de otro grupo del mismo aula y periodo que se traslapa con (dia, ini, fin); null si no hay.
CREATE OR REPLACE FUNCTION app.b1_choque_horario(
    p_id_aula integer, p_periodo text, p_id_grupo integer, p_dia integer, p_ini time, p_fin time
) RETURNS text
    LANGUAGE sql STABLE
    SET search_path = public, app, pg_temp
AS $$
    SELECT format('grupo %s de %s (%s-%s)', g.clave_grupo, m.clave, to_char(h.hora_inicio, 'HH24:MI'), to_char(h.hora_fin, 'HH24:MI'))
      FROM public.horario_grupo h
      JOIN public.grupo g ON g.id_grupo = h.id_grupo
      JOIN public.materia m ON m.id_materia = g.id_materia
     WHERE g.id_aula = p_id_aula AND g.periodo = p_periodo
       AND g.id_grupo IS DISTINCT FROM p_id_grupo
       AND h.dia_semana = p_dia AND h.hora_inicio < p_fin AND h.hora_fin > p_ini
     ORDER BY h.hora_inicio, g.id_grupo LIMIT 1
$$;

-- ---------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_grupos_listar(
    p_periodo text DEFAULT NULL, p_q text DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0
) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_pat     text := app.b1_patron(p_q);
    v_periodo text := nullif(btrim(coalesce(p_periodo, '')), '');
    v_total   bigint;
    v_items   jsonb;
BEGIN
    PERFORM app.exigir_rol('administrador', 'docente');
    IF v_periodo IS NOT NULL AND v_periodo !~ '^[0-9]{4}-[12]$' THEN
        PERFORM app.fallar('PERIODO_INVALIDO', 'El periodo debe tener el formato AAAA-S (S = 1 o 2).');
    END IF;

    SELECT count(*) INTO v_total
      FROM public.grupo g
      JOIN public.materia m ON m.id_materia = g.id_materia
      LEFT JOIN public.docente d ON d.id_docente = g.id_docente
      LEFT JOIN public.aula a ON a.id_aula = g.id_aula
     WHERE (v_periodo IS NULL OR g.periodo = v_periodo)
       AND (v_pat IS NULL OR g.clave_grupo ILIKE v_pat OR m.clave ILIKE v_pat OR m.nombre ILIKE v_pat
            OR a.clave ILIKE v_pat OR concat_ws(' ', d.nombres, d.apellido_paterno, d.apellido_materno) ILIKE v_pat
            OR concat_ws(' ', d.apellido_paterno, d.apellido_materno, d.nombres) ILIKE v_pat);

    SELECT coalesce(jsonb_agg(x.j ORDER BY x.rn), '[]'::jsonb) INTO v_items FROM (
        SELECT row_number() OVER (ORDER BY g.periodo DESC, m.clave, g.clave_grupo, g.id_grupo) AS rn,
               app.b1_grupo_base(g.id_grupo) || jsonb_build_object(
                   'inscritos_activos', (SELECT count(*) FROM public.inscripcion i WHERE i.id_grupo = g.id_grupo AND i.estatus = 'activa'),
                   'sesiones_total', (SELECT count(*) FROM public.sesion_clase s WHERE s.id_grupo = g.id_grupo)) AS j
          FROM public.grupo g
          JOIN public.materia m ON m.id_materia = g.id_materia
          LEFT JOIN public.docente d ON d.id_docente = g.id_docente
          LEFT JOIN public.aula a ON a.id_aula = g.id_aula
         WHERE (v_periodo IS NULL OR g.periodo = v_periodo)
           AND (v_pat IS NULL OR g.clave_grupo ILIKE v_pat OR m.clave ILIKE v_pat OR m.nombre ILIKE v_pat
                OR a.clave ILIKE v_pat OR concat_ws(' ', d.nombres, d.apellido_paterno, d.apellido_materno) ILIKE v_pat
                OR concat_ws(' ', d.apellido_paterno, d.apellido_materno, d.nombres) ILIKE v_pat)
         ORDER BY g.periodo DESC, m.clave, g.clave_grupo, g.id_grupo
         LIMIT app.b1_limite(p_limit) OFFSET app.b1_desplazamiento(p_offset)
    ) x;
    RETURN jsonb_build_object('total', v_total, 'items', v_items);
END
$$;
GRANT EXECUTE ON FUNCTION public.api_grupos_listar(text, text, integer, integer) TO authenticated;
COMMENT ON FUNCTION public.api_grupos_listar(text, text, integer, integer) IS
$c$Lista grupos con filtro de periodo y texto (paginada), del periodo mas reciente al mas antiguo.
ARGS: p_periodo 'AAAA-S' (opcional); p_q texto libre (clave de grupo, materia, docente, aula; opcional); p_limit def. 50 max 200; p_offset def. 0.
RETURNS: {"total": 2, "items": [{"id_grupo": 1, "periodo": "2026-2", "clave_grupo": "3A", "id_materia": 1, "materia_clave": "ADM101", "materia_nombre": "Administracion I", "id_docente": 1, "docente_nombre": "Lopez Ruiz Ana", "id_aula": 1, "aula_clave": "A-12", "inscritos_activos": 4, "sesiones_total": 3}]}
ERRORES: NO_AUTORIZADO (alumno, tecnico), PERIODO_INVALIDO.
ROLES: administrador (todos); docente (solo los suyos, por RLS).$c$;

CREATE OR REPLACE FUNCTION public.api_grupo_obtener(p_id_grupo integer) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    g       public.grupo%ROWTYPE;
    v_hor   jsonb;
    v_aula  jsonb;
    v_cams  jsonb;
    v_cap   integer;
BEGIN
    PERFORM app.exigir_rol('administrador', 'docente');
    SELECT * INTO g FROM public.grupo WHERE id_grupo = p_id_grupo;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El grupo no existe.');
    END IF;

    SELECT coalesce(jsonb_agg(jsonb_build_object('id_horario', h.id_horario, 'dia_semana', h.dia_semana,
               'hora_inicio', h.hora_inicio, 'hora_fin', h.hora_fin) ORDER BY h.dia_semana, h.hora_inicio), '[]'::jsonb)
      INTO v_hor FROM public.horario_grupo h WHERE h.id_grupo = g.id_grupo;

    SELECT coalesce(jsonb_agg(app.b1_camara_json(c) ORDER BY c.posicion), '[]'::jsonb) INTO v_cams
      FROM public.camara c WHERE c.id_aula = g.id_aula;
    SELECT app.b1_aula_json(a) || jsonb_build_object('camaras', v_cams), a.capacidad INTO v_aula, v_cap
      FROM public.aula a WHERE a.id_aula = g.id_aula;

    RETURN app.b1_grupo_base(g.id_grupo) || jsonb_build_object(
        'horario', v_hor,
        'aula', v_aula,
        'inscritos', jsonb_build_object(
            'activos', (SELECT count(*) FROM public.inscripcion i WHERE i.id_grupo = g.id_grupo AND i.estatus = 'activa'),
            'baja', (SELECT count(*) FROM public.inscripcion i WHERE i.id_grupo = g.id_grupo AND i.estatus = 'baja'),
            'capacidad_aula', v_cap),
        'sesiones', jsonb_build_object(
            'total', (SELECT count(*) FROM public.sesion_clase s WHERE s.id_grupo = g.id_grupo),
            'programadas', (SELECT count(*) FROM public.sesion_clase s WHERE s.id_grupo = g.id_grupo AND s.estatus = 'programada'),
            'abiertas', (SELECT count(*) FROM public.sesion_clase s WHERE s.id_grupo = g.id_grupo AND s.estatus = 'abierta'),
            'cerradas', (SELECT count(*) FROM public.sesion_clase s WHERE s.id_grupo = g.id_grupo AND s.estatus = 'cerrada'),
            'suspendidas', (SELECT count(*) FROM public.sesion_clase s WHERE s.id_grupo = g.id_grupo AND s.estatus = 'suspendida')));
END
$$;
GRANT EXECUTE ON FUNCTION public.api_grupo_obtener(integer) TO authenticated;
COMMENT ON FUNCTION public.api_grupo_obtener(integer) IS
$c$Ficha de un grupo con horario, aula y camaras, inscritos y sesiones (P-09).
ARGS: p_id_grupo.
RETURNS: {"id_grupo": 1, "periodo": "2026-2", "clave_grupo": "3A", "materia_clave": "ADM101", "docente_nombre": "Lopez Ruiz Ana", "aula_clave": "A-12", "horario": [{"id_horario": 1, "dia_semana": 1, "hora_inicio": "07:00:00", "hora_fin": "08:00:00"}], "aula": {"id_aula": 1, "clave": "A-12", "edificio": "A", "capacidad": 40, "camaras": [{"id_camara": 1, "posicion": "frente", "tipo": "ip", "direccion_ip": "10.20.0.12", "estatus": "activa"}]}, "inscritos": {"activos": 4, "baja": 1, "capacidad_aula": 40}, "sesiones": {"total": 3, "programadas": 1, "abiertas": 1, "cerradas": 1, "suspendidas": 0}}
ERRORES: NO_AUTORIZADO, NO_ENCONTRADO (no existe o el docente no es el titular).
ROLES: administrador; docente (solo sus grupos; sin direccion_ip de camaras).$c$;

CREATE OR REPLACE FUNCTION public.api_grupo_guardar(p jsonb) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_p      jsonb;
    v_id     integer;
    v_old    public.grupo%ROWTYPE;
    g        public.grupo%ROWTYPE;
    v_mat    integer;
    v_doc    integer;
    v_aula   integer;
    v_cla    text;
    v_per    text;
    v_crea   boolean;
    v_estdoc public.estatus_docente;
    h        record;
    v_choque text;
BEGIN
    PERFORM app.exigir_rol('administrador');
    v_p := app.b1_obj(p);
    v_id := app.b1_int(v_p, 'id_grupo');
    v_crea := v_id IS NULL;
    IF NOT v_crea THEN
        SELECT * INTO v_old FROM public.grupo WHERE id_grupo = v_id FOR UPDATE;
        IF NOT FOUND THEN
            PERFORM app.fallar('NO_ENCONTRADO', 'El grupo no existe.');
        END IF;
    END IF;

    v_mat  := CASE WHEN v_crea OR v_p ? 'id_materia' THEN app.b1_int(v_p, 'id_materia') ELSE v_old.id_materia END;
    v_doc  := CASE WHEN v_crea OR v_p ? 'id_docente' THEN app.b1_int(v_p, 'id_docente') ELSE v_old.id_docente END;
    v_aula := CASE WHEN v_crea OR v_p ? 'id_aula' THEN app.b1_int(v_p, 'id_aula') ELSE v_old.id_aula END;
    v_cla  := CASE WHEN v_crea OR v_p ? 'clave_grupo' THEN upper(app.b1_str(v_p, 'clave_grupo')) ELSE v_old.clave_grupo END;
    v_per  := CASE WHEN v_crea OR v_p ? 'periodo' THEN app.b1_str(v_p, 'periodo') ELSE v_old.periodo END;

    IF v_mat IS NULL OR v_doc IS NULL OR v_aula IS NULL THEN
        PERFORM app.fallar('VALIDACION', 'Materia, docente y aula son obligatorios.');
    END IF;
    IF v_cla IS NULL OR v_cla !~ '^[A-Z0-9][A-Z0-9-]{0,7}$' THEN
        PERFORM app.fallar('VALIDACION', 'La clave del grupo es obligatoria: hasta 8 letras, dígitos o guiones.');
    END IF;
    IF v_per IS NULL OR v_per !~ '^[0-9]{4}-[12]$' THEN
        PERFORM app.fallar('PERIODO_INVALIDO', 'El periodo debe tener el formato AAAA-S (S = 1 o 2).');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.materia WHERE id_materia = v_mat) THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'La materia no existe.');
    END IF;
    SELECT estatus INTO v_estdoc FROM public.docente WHERE id_docente = v_doc;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El docente no existe.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.aula WHERE id_aula = v_aula) THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El aula no existe.');
    END IF;
    -- Solo se asigna a un docente activo (al conservar al mismo docente de un grupo existente no se exige).
    IF v_estdoc <> 'activo' AND (v_crea OR v_doc <> v_old.id_docente) THEN
        PERFORM app.fallar('DOCENTE_NO_ACTIVO', 'No se puede asignar un grupo a un docente que no está activo.');
    END IF;

    IF EXISTS (SELECT 1 FROM public.grupo x WHERE x.id_materia = v_mat AND x.clave_grupo = v_cla AND x.periodo = v_per
                  AND x.id_grupo IS DISTINCT FROM v_id) THEN
        PERFORM app.fallar('DUPLICADO', format('Ya existe el grupo %s de esa materia en el periodo %s.', v_cla, v_per));
    END IF;

    IF NOT v_crea THEN
        -- Materia y periodo identifican al grupo: con inscritos o sesiones ya no se cambian.
        IF (v_mat <> v_old.id_materia OR v_per <> v_old.periodo) AND (
               EXISTS (SELECT 1 FROM public.inscripcion WHERE id_grupo = v_id)
            OR EXISTS (SELECT 1 FROM public.sesion_clase WHERE id_grupo = v_id)) THEN
            PERFORM app.fallar('GRUPO_CON_HISTORIAL', 'El grupo ya tiene inscripciones o sesiones; no se puede cambiar su materia ni su periodo.');
        END IF;
        -- Cambiar de aula o de periodo vuelve a validar su horario contra los grupos del aula destino.
        IF v_aula <> v_old.id_aula OR v_per <> v_old.periodo THEN
            PERFORM pg_advisory_xact_lock(hashtext('susan_horario_aula'), v_aula);
            FOR h IN SELECT dia_semana, hora_inicio, hora_fin FROM public.horario_grupo WHERE id_grupo = v_id LOOP
                v_choque := app.b1_choque_horario(v_aula, v_per, v_id, h.dia_semana, h.hora_inicio, h.hora_fin);
                IF v_choque IS NOT NULL THEN
                    PERFORM app.fallar('HORARIO_CHOQUE', format('El horario del grupo choca en el aula destino con el %s.', v_choque));
                END IF;
            END LOOP;
        END IF;
    END IF;

    BEGIN
        IF v_crea THEN
            INSERT INTO public.grupo (id_materia, id_docente, id_aula, clave_grupo, periodo)
            VALUES (v_mat, v_doc, v_aula, v_cla, v_per) RETURNING * INTO g;
        ELSE
            UPDATE public.grupo SET id_materia = v_mat, id_docente = v_doc, id_aula = v_aula, clave_grupo = v_cla, periodo = v_per
             WHERE id_grupo = v_id RETURNING * INTO g;
        END IF;
    EXCEPTION WHEN unique_violation THEN
        PERFORM app.fallar('DUPLICADO', 'Ya existe ese grupo (materia, clave y periodo).');
    END;
    RETURN app.b1_grupo_base(g.id_grupo) || jsonb_build_object('creado', v_crea);
END
$$;
GRANT EXECUTE ON FUNCTION public.api_grupo_guardar(jsonb) TO authenticated;
COMMENT ON FUNCTION public.api_grupo_guardar(jsonb) IS
$c$Da de alta (sin id_grupo) o modifica (con id_grupo) un grupo: materia + clave_grupo + periodo unicos, periodo AAAA-S, docente activo, aula existente. Con inscripciones o sesiones no se cambia materia ni periodo; al cambiar de aula se revalida el horario.
ARGS: p {id_grupo?, id_materia, id_docente, id_aula, clave_grupo (max 8), periodo 'AAAA-S'}; en modificacion lo ausente se conserva.
RETURNS: {"id_grupo": 3, "periodo": "2026-2", "clave_grupo": "3C", "id_materia": 1, "materia_clave": "ADM101", "materia_nombre": "Administracion I", "id_docente": 1, "docente_nombre": "Lopez Ruiz Ana", "id_aula": 1, "aula_clave": "A-12", "creado": true}
ERRORES: NO_AUTORIZADO, VALIDACION, PERIODO_INVALIDO, NO_ENCONTRADO (grupo, materia, docente o aula), DOCENTE_NO_ACTIVO, DUPLICADO, GRUPO_CON_HISTORIAL, HORARIO_CHOQUE (cambio de aula).
ROLES: administrador.$c$;

-- ---------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_horario_guardar(p_id_grupo integer, p_bloques jsonb) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    g        public.grupo%ROWTYPE;
    e        jsonb;
    n        bigint;
    v_n      integer := 0;
    v_t      text;
    v_dias   integer[] := '{}';
    v_ini    time[] := '{}';
    v_fin    time[] := '{}';
    v_dia    integer;
    v_hi     time;
    v_hf     time;
    i        integer;
    j        integer;
    v_choque text;
    v_res    jsonb;
BEGIN
    PERFORM app.exigir_rol('administrador');
    SELECT * INTO g FROM public.grupo WHERE id_grupo = p_id_grupo FOR UPDATE;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El grupo no existe.');
    END IF;
    IF p_bloques IS NULL OR jsonb_typeof(p_bloques) <> 'array' OR jsonb_array_length(p_bloques) = 0 THEN
        PERFORM app.fallar('VALIDACION', 'p_bloques debe ser un arreglo con al menos un bloque {dia_semana, hora_inicio, hora_fin}.');
    END IF;
    IF jsonb_array_length(p_bloques) > 42 THEN
        PERFORM app.fallar('VALIDACION', 'Un grupo admite como máximo 42 bloques semanales.');
    END IF;

    FOR e, n IN SELECT x, o FROM jsonb_array_elements(p_bloques) WITH ORDINALITY AS t(x, o) LOOP
        IF jsonb_typeof(e) <> 'object' THEN
            PERFORM app.fallar('HORARIO_INVALIDO', format('Bloque %s: se esperaba un objeto.', n));
        END IF;
        v_t := nullif(btrim(e ->> 'dia_semana'), '');
        IF v_t IS NULL OR v_t !~ '^[0-9]{1,2}$' OR v_t::integer NOT BETWEEN 1 AND 6 THEN
            PERFORM app.fallar('HORARIO_INVALIDO', format('Bloque %s: el día debe ser de 1 (lunes) a 6 (sábado).', n));
        END IF;
        v_dia := v_t::integer;
        v_t := nullif(btrim(e ->> 'hora_inicio'), '');
        IF v_t IS NULL OR v_t !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' THEN
            PERFORM app.fallar('HORARIO_INVALIDO', format('Bloque %s: hora_inicio debe ser HH:MM.', n));
        END IF;
        v_hi := v_t::time;
        v_t := nullif(btrim(e ->> 'hora_fin'), '');
        IF v_t IS NULL OR v_t !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' THEN
            PERFORM app.fallar('HORARIO_INVALIDO', format('Bloque %s: hora_fin debe ser HH:MM.', n));
        END IF;
        v_hf := v_t::time;
        IF v_hf <= v_hi THEN
            PERFORM app.fallar('HORARIO_INVALIDO', format('Bloque %s: la hora de fin debe ser posterior a la de inicio.', n));
        END IF;
        v_n := v_n + 1;
        v_dias := v_dias || v_dia;
        v_ini := v_ini || v_hi;
        v_fin := v_fin || v_hf;
    END LOOP;

    -- Traslapes entre los propios bloques del grupo.
    FOR i IN 1 .. v_n LOOP
        FOR j IN i + 1 .. v_n LOOP
            IF v_dias[i] = v_dias[j] AND v_ini[i] < v_fin[j] AND v_ini[j] < v_fin[i] THEN
                PERFORM app.fallar('HORARIO_INVALIDO', format('Los bloques %s y %s del mismo día se traslapan.', i, j));
            END IF;
        END LOOP;
    END LOOP;

    -- Choque con otros grupos del aula (mismo periodo). El candado serializa a quienes editan el aula.
    PERFORM pg_advisory_xact_lock(hashtext('susan_horario_aula'), g.id_aula);
    FOR i IN 1 .. v_n LOOP
        v_choque := app.b1_choque_horario(g.id_aula, g.periodo, g.id_grupo, v_dias[i], v_ini[i], v_fin[i]);
        IF v_choque IS NOT NULL THEN
            PERFORM app.fallar('HORARIO_CHOQUE', format('El bloque %s choca en el aula con el %s.', i, v_choque));
        END IF;
    END LOOP;

    -- Reemplazo completo. Las sesiones ya generadas no se tocan: se complementan con api_generar_sesiones.
    DELETE FROM public.horario_grupo WHERE id_grupo = g.id_grupo;
    FOR i IN 1 .. v_n LOOP
        INSERT INTO public.horario_grupo (id_grupo, dia_semana, hora_inicio, hora_fin)
        VALUES (g.id_grupo, v_dias[i], v_ini[i], v_fin[i]);
    END LOOP;

    SELECT coalesce(jsonb_agg(jsonb_build_object('id_horario', h.id_horario, 'dia_semana', h.dia_semana,
               'hora_inicio', h.hora_inicio, 'hora_fin', h.hora_fin) ORDER BY h.dia_semana, h.hora_inicio), '[]'::jsonb)
      INTO v_res FROM public.horario_grupo h WHERE h.id_grupo = g.id_grupo;
    RETURN jsonb_build_object('id_grupo', g.id_grupo, 'id_aula', g.id_aula, 'bloques', v_res);
END
$$;
GRANT EXECUTE ON FUNCTION public.api_horario_guardar(integer, jsonb) TO authenticated;
COMMENT ON FUNCTION public.api_horario_guardar(integer, jsonb) IS
$c$Reemplaza el horario semanal completo de un grupo. Valida dia 1..6, hora_fin > hora_inicio, que los bloques no se traslapen entre si y que no choquen con otros grupos del mismo aula y periodo (bloques contiguos no chocan). No modifica sesiones ya generadas.
ARGS: p_id_grupo; p_bloques [{"dia_semana": 1, "hora_inicio": "07:00", "hora_fin": "08:00"}] (1..42 bloques; 1 = lunes).
RETURNS: {"id_grupo": 1, "id_aula": 1, "bloques": [{"id_horario": 9, "dia_semana": 1, "hora_inicio": "07:00:00", "hora_fin": "08:00:00"}]}
ERRORES: NO_AUTORIZADO, NO_ENCONTRADO (grupo), VALIDACION (arreglo vacio o demasiado grande), HORARIO_INVALIDO (dia, hora, fin <= inicio, traslape propio), HORARIO_CHOQUE (otro grupo del aula).
ROLES: administrador.$c$;

CREATE OR REPLACE FUNCTION public.api_generar_sesiones(
    p_id_grupo integer, p_desde date, p_hasta date, p_omitir_fechas date[] DEFAULT '{}'
) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    g           public.grupo%ROWTYPE;
    v_omitir    date[] := coalesce(p_omitir_fechas, '{}');
    v_tol       smallint;
    v_lim       smallint;
    v_int       smallint;
    v_modo      public.modo_registro_sesion;
    v_candidatas integer;
    v_por_fecha integer;
    v_creadas   integer;
BEGIN
    PERFORM app.exigir_rol('administrador');
    SELECT * INTO g FROM public.grupo WHERE id_grupo = p_id_grupo FOR UPDATE;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El grupo no existe.');
    END IF;
    IF p_desde IS NULL OR p_hasta IS NULL OR p_hasta < p_desde THEN
        PERFORM app.fallar('VALIDACION', 'Indica un rango de fechas válido (desde <= hasta).');
    END IF;
    IF p_hasta - p_desde > 366 THEN
        PERFORM app.fallar('VALIDACION', 'El rango no puede exceder 366 días.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.horario_grupo WHERE id_grupo = g.id_grupo) THEN
        PERFORM app.fallar('GRUPO_SIN_HORARIO', 'El grupo no tiene horario; captúralo antes de generar sesiones.');
    END IF;

    -- Parametros VIGENTES: se copian a cada sesion y las ya creadas no cambian si el parametro se edita despues.
    v_tol := app.param_num('tolerancia_min')::smallint;
    v_lim := app.param_num('limite_presente_min')::smallint;
    v_int := app.param_num('intervalo_muestreo_seg')::smallint;
    -- Igual que la semilla: aula sin camara activa => pase manual (RN-06).
    v_modo := CASE WHEN EXISTS (SELECT 1 FROM public.camara c WHERE c.id_aula = g.id_aula AND c.estatus = 'activa')
                   THEN 'automatico' ELSE 'manual' END;

    WITH cand AS (
        SELECT (p_desde + k)::date AS fecha, h.hora_inicio, h.hora_fin
          FROM generate_series(0, p_hasta - p_desde) AS k
          JOIN public.horario_grupo h ON h.id_grupo = g.id_grupo
                                      AND h.dia_semana = extract(isodow FROM (p_desde + k))::integer
    ), ins AS (
        INSERT INTO public.sesion_clase (id_grupo, fecha, hora_inicio, hora_fin, tolerancia_min, limite_presente_min,
                                         intervalo_muestreo_seg, modo_registro, estatus)
        SELECT g.id_grupo, c.fecha, c.hora_inicio, c.hora_fin, v_tol, v_lim, v_int, v_modo, 'programada'
          FROM cand c WHERE NOT (c.fecha = ANY (v_omitir))
        ON CONFLICT ON CONSTRAINT uq_sesion_grupo_fecha_hora DO NOTHING
        RETURNING 1
    )
    SELECT (SELECT count(*) FROM cand), (SELECT count(*) FROM cand WHERE fecha = ANY (v_omitir)), (SELECT count(*) FROM ins)
      INTO v_candidatas, v_por_fecha, v_creadas;

    RETURN jsonb_build_object(
        'id_grupo', g.id_grupo, 'desde', p_desde, 'hasta', p_hasta,
        'creadas', v_creadas,
        'omitidas', v_candidatas - v_creadas,
        'omitidas_por_fecha', v_por_fecha,
        'ya_existentes', v_candidatas - v_por_fecha - v_creadas,
        'modo_registro', v_modo,
        'parametros', jsonb_build_object('tolerancia_min', v_tol, 'limite_presente_min', v_lim, 'intervalo_muestreo_seg', v_int));
END
$$;
GRANT EXECUTE ON FUNCTION public.api_generar_sesiones(integer, date, date, date[]) TO authenticated;
COMMENT ON FUNCTION public.api_generar_sesiones(integer, date, date, date[]) IS
$c$Crea sesiones 'programada' a partir del horario del grupo entre dos fechas (inclusivas), copiando tolerancia_min, limite_presente_min e intervalo_muestreo_seg de los parametros vigentes; el modo nace automatico si el aula tiene alguna camara activa y manual si no. Idempotente por (grupo, fecha, hora_inicio): lo ya existente se omite, no se modifica.
ARGS: p_id_grupo; p_desde y p_hasta (date, rango maximo 366 dias); p_omitir_fechas date[] (feriados o suspensiones; opcional).
RETURNS: {"id_grupo": 1, "desde": "2026-09-01", "hasta": "2026-09-30", "creadas": 12, "omitidas": 3, "omitidas_por_fecha": 1, "ya_existentes": 2, "modo_registro": "automatico", "parametros": {"tolerancia_min": 20, "limite_presente_min": 10, "intervalo_muestreo_seg": 15}}
ERRORES: NO_AUTORIZADO, NO_ENCONTRADO (grupo), VALIDACION (rango), GRUPO_SIN_HORARIO.
ROLES: administrador.$c$;
