-- 0241 · API de laboratorios (extension 20 de docs/DECISIONS.md): el docente solicita, el administrador autoriza.
-- Depende de 0240. Codigos propios (todos P0001 con HINT):
--   LAB_NO_ES_LABORATORIO · LAB_FUERA_DE_PLAZO · LAB_CAPACIDAD_INSUFICIENTE · LAB_OCUPADO ·
--   SOLICITUD_DUPLICADA · SOLICITUD_YA_RESUELTA · SOLICITUD_VENCIDA · AULA_TIPO_CON_SOLICITUDES.
-- Todas las RPC son DEFINER porque el docente no ve (por RLS) los laboratorios que no son de sus grupos ni los horarios
-- ajenos; cada una filtra por rol y por propiedad a mano, y solo devuelve claves de grupo/materia (nunca datos personales ajenos).

-- ---------------------------------------------------------------------------------------------
-- 1) Aula con tipo: el JSON del aula gana `tipo` (lo heredan api_aulas_listar, api_aula_obtener y api_aula_guardar).
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.b1_aula_json(a public.aula) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path = pg_catalog, pg_temp
AS $$
    SELECT jsonb_build_object('id_aula', a.id_aula, 'clave', a.clave, 'edificio', a.edificio, 'capacidad', a.capacidad,
                              'tipo', a.tipo)
$$;

CREATE OR REPLACE FUNCTION public.api_aula_guardar(p jsonb) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_p     jsonb;
    v_id    integer;
    v_old   public.aula%ROWTYPE;
    a       public.aula%ROWTYPE;
    v_cla   text;
    v_edi   text;
    v_cap   integer;
    v_tipo  text;
    v_max   integer;
    v_crea  boolean;
BEGIN
    PERFORM app.exigir_rol('administrador');
    v_p := app.b1_obj(p);
    v_id := app.b1_int(v_p, 'id_aula');
    v_crea := v_id IS NULL;
    IF NOT v_crea THEN
        SELECT * INTO v_old FROM public.aula WHERE id_aula = v_id FOR UPDATE;
        IF NOT FOUND THEN
            PERFORM app.fallar('NO_ENCONTRADO', 'El aula no existe.');
        END IF;
    END IF;

    v_cla := CASE WHEN v_crea OR v_p ? 'clave' THEN upper(app.b1_str(v_p, 'clave')) ELSE v_old.clave END;
    v_edi := CASE WHEN v_crea OR v_p ? 'edificio' THEN app.b1_str(v_p, 'edificio') ELSE v_old.edificio END;
    v_cap := CASE WHEN v_crea OR v_p ? 'capacidad' THEN app.b1_int(v_p, 'capacidad') ELSE v_old.capacidad END;
    v_tipo := CASE WHEN v_p ? 'tipo' THEN lower(app.b1_str(v_p, 'tipo'))
                   WHEN v_crea THEN 'aula' ELSE v_old.tipo::text END;

    IF v_cla IS NULL OR v_cla !~ '^[A-Z0-9][A-Z0-9-]{0,9}$' THEN
        PERFORM app.fallar('VALIDACION', 'La clave del aula es obligatoria: hasta 10 letras, dígitos o guiones.');
    END IF;
    IF v_edi IS NULL OR length(v_edi) > 40 THEN
        PERFORM app.fallar('VALIDACION', 'El edificio es obligatorio (máximo 40 caracteres).');
    END IF;
    IF v_cap IS NULL OR v_cap < 1 OR v_cap > 32767 THEN
        PERFORM app.fallar('VALIDACION', 'La capacidad debe ser un entero positivo.');
    END IF;
    IF v_tipo IS NULL OR v_tipo NOT IN ('aula', 'laboratorio') THEN
        PERFORM app.fallar('VALIDACION', 'El tipo debe ser aula o laboratorio.');
    END IF;
    IF EXISTS (SELECT 1 FROM public.aula x WHERE x.clave = v_cla AND x.id_aula IS DISTINCT FROM v_id) THEN
        PERFORM app.fallar('DUPLICADO', format('Ya existe un aula con la clave %s.', v_cla));
    END IF;
    -- No se reduce la capacidad por debajo de lo que ya hay inscrito en algun grupo del aula.
    IF NOT v_crea AND v_cap < v_old.capacidad THEN
        SELECT coalesce(max(n), 0) INTO v_max FROM (
            SELECT count(*) AS n FROM public.grupo g
              JOIN public.inscripcion i ON i.id_grupo = g.id_grupo AND i.estatus = 'activa'
             WHERE g.id_aula = v_id GROUP BY g.id_grupo) q;
        IF v_cap < v_max THEN
            PERFORM app.fallar('AULA_CAPACIDAD_INSUFICIENTE',
                format('Un grupo del aula tiene %s inscritos activos; la capacidad no puede ser menor.', v_max));
        END IF;
    END IF;
    -- Un laboratorio con solicitudes vigentes no deja de serlo: quedarian solicitudes sobre un aula que ya no las admite.
    IF NOT v_crea AND v_old.tipo = 'laboratorio' AND v_tipo <> 'laboratorio' AND EXISTS (
        SELECT 1 FROM public.solicitud_laboratorio s
         WHERE s.id_aula = v_id AND s.estatus IN ('pendiente', 'aprobada') AND s.fecha >= app.hoy()) THEN
        PERFORM app.fallar('AULA_TIPO_CON_SOLICITUDES',
            'El laboratorio tiene solicitudes pendientes o aprobadas; resuélvelas o cancélalas antes de cambiar su tipo.');
    END IF;

    BEGIN
        IF v_crea THEN
            INSERT INTO public.aula (clave, edificio, capacidad, tipo) VALUES (v_cla, v_edi, v_cap, v_tipo::public.tipo_aula)
            RETURNING * INTO a;
        ELSE
            UPDATE public.aula SET clave = v_cla, edificio = v_edi, capacidad = v_cap, tipo = v_tipo::public.tipo_aula
             WHERE id_aula = v_id RETURNING * INTO a;
        END IF;
    EXCEPTION WHEN unique_violation THEN
        PERFORM app.fallar('DUPLICADO', 'La clave del aula ya existe.');
    END;
    RETURN app.b1_aula_json(a) || jsonb_build_object('creado', v_crea);
END
$$;
GRANT EXECUTE ON FUNCTION public.api_aula_guardar(jsonb) TO authenticated;
COMMENT ON FUNCTION public.api_aula_guardar(jsonb) IS
$c$Da de alta (sin id_aula) o modifica (con id_aula) un aula o laboratorio.
ARGS: p {id_aula?, clave (max 10), edificio (max 40), capacidad > 0, tipo? ('aula' por omision | 'laboratorio')}; en modificacion lo ausente se conserva.
RETURNS: {"id_aula": 3, "clave": "C-01", "edificio": "C", "capacidad": 30, "tipo": "aula", "creado": true}
ERRORES: NO_AUTORIZADO, VALIDACION, NO_ENCONTRADO, DUPLICADO (clave), AULA_CAPACIDAD_INSUFICIENTE (menor que los inscritos activos de un grupo), AULA_TIPO_CON_SOLICITUDES (deja de ser laboratorio con solicitudes pendientes o aprobadas vigentes).
ROLES: administrador.$c$;

-- ---------------------------------------------------------------------------------------------
-- 2) Ayudantes internos (esquema app, prefijo lab_).
-- ---------------------------------------------------------------------------------------------

-- Primer motivo por el que el laboratorio NO esta libre en (fecha, ini, fin), o NULL si lo esta:
--  a) otra solicitud APROBADA que se traslapa;
--  b) una clase de otro grupo que usa ese laboratorio como aula: por sesion concreta (no suspendida) o, si el grupo aun no tiene
--     sesiones generadas para esa fecha y hora, por su horario semanal del mismo periodo.
-- Las solicitudes pendientes NO bloquean: el administrador decide entre ellas.
CREATE OR REPLACE FUNCTION app.lab_conflicto(
    p_id_aula integer, p_fecha date, p_ini time, p_fin time, p_id_solicitud integer, p_id_grupo integer
) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v       text;
    v_per   text;
BEGIN
    SELECT format('el grupo %s de %s tiene aprobado el laboratorio de %s a %s',
                  g.clave_grupo, m.clave, to_char(s.hora_inicio, 'HH24:MI'), to_char(s.hora_fin, 'HH24:MI'))
      INTO v
      FROM public.solicitud_laboratorio s
      JOIN public.grupo g ON g.id_grupo = s.id_grupo
      JOIN public.materia m ON m.id_materia = g.id_materia
     WHERE s.id_aula = p_id_aula AND s.fecha = p_fecha AND s.estatus = 'aprobada'
       AND s.id_solicitud IS DISTINCT FROM p_id_solicitud
       AND s.hora_inicio < p_fin AND s.hora_fin > p_ini
     ORDER BY s.hora_inicio, s.id_solicitud LIMIT 1;
    IF v IS NOT NULL THEN
        RETURN v;
    END IF;

    SELECT format('el grupo %s de %s tiene clase en ese laboratorio de %s a %s',
                  g.clave_grupo, m.clave, to_char(sc.hora_inicio, 'HH24:MI'), to_char(sc.hora_fin, 'HH24:MI'))
      INTO v
      FROM public.sesion_clase sc
      JOIN public.grupo g ON g.id_grupo = sc.id_grupo
      JOIN public.materia m ON m.id_materia = g.id_materia
     WHERE g.id_aula = p_id_aula AND sc.fecha = p_fecha AND sc.estatus <> 'suspendida'
       AND g.id_grupo IS DISTINCT FROM p_id_grupo
       AND sc.hora_inicio < p_fin AND sc.hora_fin > p_ini
     ORDER BY sc.hora_inicio, g.id_grupo LIMIT 1;
    IF v IS NOT NULL THEN
        RETURN v;
    END IF;

    SELECT g2.periodo INTO v_per FROM public.grupo g2 WHERE g2.id_grupo = p_id_grupo;
    SELECT format('el grupo %s de %s tiene clase en ese laboratorio de %s a %s',
                  g.clave_grupo, m.clave, to_char(h.hora_inicio, 'HH24:MI'), to_char(h.hora_fin, 'HH24:MI'))
      INTO v
      FROM public.horario_grupo h
      JOIN public.grupo g ON g.id_grupo = h.id_grupo
      JOIN public.materia m ON m.id_materia = g.id_materia
     WHERE g.id_aula = p_id_aula AND g.periodo = v_per AND g.id_grupo IS DISTINCT FROM p_id_grupo
       AND h.dia_semana = extract(isodow FROM p_fecha)::integer
       AND h.hora_inicio < p_fin AND h.hora_fin > p_ini
       AND NOT EXISTS (SELECT 1 FROM public.sesion_clase sc
                        WHERE sc.id_grupo = g.id_grupo AND sc.fecha = p_fecha AND sc.hora_inicio = h.hora_inicio)
     ORDER BY h.hora_inicio, g.id_grupo LIMIT 1;
    RETURN v;
END
$$;
COMMENT ON FUNCTION app.lab_conflicto(integer, date, time, time, integer, integer) IS
    'Motivo por el que un laboratorio no esta libre en una fecha y horario (solicitud aprobada o clase de otro grupo); NULL si esta libre.';

-- JSON de una solicitud con su laboratorio, grupo y docente. p_conflicto solo lo pasa la lista del administrador.
CREATE OR REPLACE FUNCTION app.lab_json(s public.solicitud_laboratorio, p_conflicto text DEFAULT NULL) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
    SELECT jsonb_build_object(
        'id_solicitud', s.id_solicitud,
        'estatus', s.estatus,
        'fecha', s.fecha,
        'hora_inicio', to_char(s.hora_inicio, 'HH24:MI'),
        'hora_fin', to_char(s.hora_fin, 'HH24:MI'),
        'actividad', s.actividad,
        'fecha_solicitud', s.fecha_solicitud,
        'vencida', (s.estatus = 'pendiente' AND app.instante_clase(s.fecha, s.hora_inicio) <= app.now()),
        'aula', (SELECT jsonb_build_object('id_aula', a.id_aula, 'clave', a.clave, 'edificio', a.edificio, 'capacidad', a.capacidad)
                   FROM public.aula a WHERE a.id_aula = s.id_aula),
        'grupo', (SELECT jsonb_build_object('id_grupo', g.id_grupo, 'clave_grupo', g.clave_grupo, 'periodo', g.periodo,
                                            'materia_clave', m.clave, 'materia_nombre', m.nombre,
                                            'inscritos', (SELECT count(*) FROM public.inscripcion i
                                                           WHERE i.id_grupo = g.id_grupo AND i.estatus = 'activa'))
                    FROM public.grupo g JOIN public.materia m ON m.id_materia = g.id_materia WHERE g.id_grupo = s.id_grupo),
        'docente', (SELECT jsonb_build_object('id_docente', d.id_docente,
                                              'nombre_completo', app.c1_nombre(d.apellido_paterno, d.apellido_materno, d.nombres))
                      FROM public.docente d WHERE d.id_docente = s.id_docente),
        'resuelto_por', (SELECT u.correo FROM public.usuario u WHERE u.id_usuario = s.resuelto_por),
        'fecha_resolucion', s.fecha_resolucion,
        'comentario', s.comentario,
        'conflicto', p_conflicto)
$$;
COMMENT ON FUNCTION app.lab_json(public.solicitud_laboratorio, text) IS 'Forma JSON de una solicitud de laboratorio (usada por las api_laboratorio_*).';

-- ---------------------------------------------------------------------------------------------
-- 3) api_laboratorios_listar: laboratorios que el docente puede pedir y el administrador gestionar.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_laboratorios_listar() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_items jsonb;
BEGIN
    PERFORM app.exigir_rol('administrador', 'docente');
    SELECT coalesce(jsonb_agg(app.b1_aula_json(a) ORDER BY a.clave), '[]'::jsonb) INTO v_items
      FROM public.aula a WHERE a.tipo = 'laboratorio';
    RETURN jsonb_build_object('total', jsonb_array_length(v_items), 'items', v_items);
END
$$;
REVOKE ALL ON FUNCTION public.api_laboratorios_listar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_laboratorios_listar() TO authenticated;
COMMENT ON FUNCTION public.api_laboratorios_listar() IS
$c$Laboratorios del plantel (aulas con tipo laboratorio), ordenados por clave.
ARGS: ninguno.
RETURNS: {"total": 1, "items": [{"id_aula": 3, "clave": "LAB-1", "edificio": "C", "capacidad": 30, "tipo": "laboratorio"}]}
ERRORES: NO_AUTORIZADO (alumno, tecnico).
ROLES: administrador, docente.$c$;

-- ---------------------------------------------------------------------------------------------
-- 4) api_laboratorio_solicitar: el docente pide un laboratorio para uno de sus grupos.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_laboratorio_solicitar(p jsonb) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_p      jsonb;
    v_doc    integer;
    d        public.docente%ROWTYPE;
    a        public.aula%ROWTYPE;
    g        public.grupo%ROWTYPE;
    s        public.solicitud_laboratorio%ROWTYPE;
    v_t      text;
    v_fecha  date;
    v_ini    time;
    v_fin    time;
    v_act    text;
    v_inicio timestamptz;
    v_antic  integer;
    v_horiz  integer;
    v_insc   integer;
    v_conf   text;
BEGIN
    PERFORM app.exigir_rol('docente');
    v_doc := app.id_docente();
    SELECT * INTO d FROM public.docente WHERE id_docente = v_doc;
    IF NOT FOUND OR d.estatus <> 'activo' THEN
        PERFORM app.fallar('DOCENTE_NO_ACTIVO', 'Tu cuenta de docente no está activa; no puedes solicitar laboratorios.');
    END IF;
    v_p := app.b1_obj(p);

    v_t := app.b1_str(v_p, 'fecha');
    IF v_t IS NULL OR v_t !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
        PERFORM app.fallar('VALIDACION', 'La fecha es obligatoria y debe ser AAAA-MM-DD.');
    END IF;
    BEGIN
        v_fecha := v_t::date;
    EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN
        PERFORM app.fallar('VALIDACION', 'La fecha no existe en el calendario.');
    END;

    v_t := app.b1_str(v_p, 'hora_inicio');
    IF v_t IS NULL OR v_t !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' THEN
        PERFORM app.fallar('HORA_INVALIDA', 'hora_inicio es obligatoria y debe ser HH:MM.');
    END IF;
    v_ini := v_t::time;
    v_t := app.b1_str(v_p, 'hora_fin');
    IF v_t IS NULL OR v_t !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' THEN
        PERFORM app.fallar('HORA_INVALIDA', 'hora_fin es obligatoria y debe ser HH:MM.');
    END IF;
    v_fin := v_t::time;
    IF v_fin <= v_ini THEN
        PERFORM app.fallar('HORA_INVALIDA', 'La hora de fin debe ser posterior a la de inicio.');
    END IF;
    IF (v_fin - v_ini) < interval '30 minutes' OR (v_fin - v_ini) > interval '8 hours' THEN
        PERFORM app.fallar('VALIDACION', 'El uso del laboratorio debe durar entre 30 minutos y 8 horas.');
    END IF;

    v_act := app.b1_str(v_p, 'actividad');
    IF v_act IS NULL OR length(v_act) < 3 OR length(v_act) > 200 THEN
        PERFORM app.fallar('VALIDACION', 'Describe la actividad (de 3 a 200 caracteres).');
    END IF;

    IF app.b1_int(v_p, 'id_aula') IS NULL OR app.b1_int(v_p, 'id_grupo') IS NULL THEN
        PERFORM app.fallar('VALIDACION', 'Indica el laboratorio y el grupo.');
    END IF;
    SELECT * INTO a FROM public.aula WHERE id_aula = app.b1_int(v_p, 'id_aula');
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El laboratorio no existe.');
    END IF;
    IF a.tipo <> 'laboratorio' THEN
        PERFORM app.fallar('LAB_NO_ES_LABORATORIO', format('El aula %s no es un laboratorio.', a.clave));
    END IF;
    -- Un grupo ajeno y uno inexistente dan la misma respuesta: no se revela que existe.
    SELECT * INTO g FROM public.grupo WHERE id_grupo = app.b1_int(v_p, 'id_grupo') AND id_docente = v_doc;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El grupo no existe o no es tuyo.');
    END IF;

    v_inicio := app.instante_clase(v_fecha, v_ini);
    v_antic := app.param_num('lab_anticipacion_horas')::integer;
    v_horiz := app.param_num('lab_horizonte_dias')::integer;
    IF v_inicio <= app.now() THEN
        PERFORM app.fallar('LAB_FUERA_DE_PLAZO', 'La fecha y la hora de inicio ya pasaron.');
    END IF;
    IF v_inicio < app.now() + make_interval(hours => v_antic) THEN
        PERFORM app.fallar('LAB_FUERA_DE_PLAZO',
            format('Solicita el laboratorio con al menos %s horas de anticipación.', v_antic));
    END IF;
    IF v_fecha > app.hoy() + v_horiz THEN
        PERFORM app.fallar('LAB_FUERA_DE_PLAZO',
            format('Solo se puede solicitar con hasta %s días de anticipación.', v_horiz));
    END IF;

    SELECT count(*) INTO v_insc FROM public.inscripcion i WHERE i.id_grupo = g.id_grupo AND i.estatus = 'activa';
    IF v_insc > a.capacidad THEN
        PERFORM app.fallar('LAB_CAPACIDAD_INSUFICIENTE',
            format('El grupo %s tiene %s alumnos activos y el laboratorio %s admite %s.', g.clave_grupo, v_insc, a.clave, a.capacidad));
    END IF;

    IF EXISTS (SELECT 1 FROM public.solicitud_laboratorio x
                WHERE x.id_grupo = g.id_grupo AND x.fecha = v_fecha AND x.estatus IN ('pendiente', 'aprobada')
                  AND x.hora_inicio < v_fin AND x.hora_fin > v_ini) THEN
        PERFORM app.fallar('SOLICITUD_DUPLICADA',
            'Ese grupo ya tiene una solicitud pendiente o aprobada que se traslapa en esa fecha y horario.');
    END IF;

    v_conf := app.lab_conflicto(a.id_aula, v_fecha, v_ini, v_fin, NULL, g.id_grupo);
    IF v_conf IS NOT NULL THEN
        PERFORM app.fallar('LAB_OCUPADO', format('El laboratorio no está disponible en ese horario: %s.', v_conf));
    END IF;

    INSERT INTO public.solicitud_laboratorio (id_aula, id_grupo, id_docente, fecha, hora_inicio, hora_fin, actividad)
    VALUES (a.id_aula, g.id_grupo, v_doc, v_fecha, v_ini, v_fin, v_act)
    RETURNING * INTO s;

    PERFORM app.bitacora('solicitud_laboratorio', 'solicitud_laboratorio', s.id_solicitud, NULL,
        jsonb_build_object('estatus', 'pendiente', 'id_aula', s.id_aula, 'id_grupo', s.id_grupo, 'fecha', s.fecha,
                           'hora_inicio', to_char(s.hora_inicio, 'HH24:MI'), 'hora_fin', to_char(s.hora_fin, 'HH24:MI'),
                           'actividad', s.actividad));
    RETURN app.lab_json(s);
END
$$;
REVOKE ALL ON FUNCTION public.api_laboratorio_solicitar(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_laboratorio_solicitar(jsonb) TO authenticated;
COMMENT ON FUNCTION public.api_laboratorio_solicitar(jsonb) IS
$c$El docente solicita un laboratorio para uno de sus grupos en una fecha y horario. Nace pendiente.
ARGS: p {id_aula (laboratorio), id_grupo (del docente), fecha 'AAAA-MM-DD', hora_inicio 'HH:MM', hora_fin 'HH:MM', actividad (3 a 200 caracteres)}. Duracion de 30 minutos a 8 horas; anticipacion minima lab_anticipacion_horas y horizonte maximo lab_horizonte_dias.
RETURNS: {"id_solicitud": 7, "estatus": "pendiente", "fecha": "2026-09-24", "hora_inicio": "10:00", "hora_fin": "12:00", "actividad": "Practica de balanza", "fecha_solicitud": "2026-09-14T13:12:00+00:00", "vencida": false, "aula": {"id_aula": 3, "clave": "LAB-1", "edificio": "C", "capacidad": 30}, "grupo": {"id_grupo": 1, "clave_grupo": "3A", "periodo": "2026-2", "materia_clave": "ADM101", "materia_nombre": "Administracion I", "inscritos": 4}, "docente": {"id_docente": 1, "nombre_completo": "Lopez Ruiz Ana"}, "resuelto_por": null, "fecha_resolucion": null, "comentario": null, "conflicto": null}
ERRORES: NO_AUTORIZADO, DOCENTE_NO_ACTIVO, VALIDACION, HORA_INVALIDA, NO_ENCONTRADO (laboratorio inexistente o grupo que no es del docente), LAB_NO_ES_LABORATORIO, LAB_FUERA_DE_PLAZO, LAB_CAPACIDAD_INSUFICIENTE (inscritos activos mayores que la capacidad), SOLICITUD_DUPLICADA (el grupo ya tiene una solicitud vigente que se traslapa), LAB_OCUPADO (solicitud aprobada o clase de otro grupo en ese horario).
ROLES: docente. Deja constancia en bitacora (solicitud_laboratorio).$c$;

-- ---------------------------------------------------------------------------------------------
-- 5) api_laboratorio_resolver: el administrador aprueba o rechaza una solicitud pendiente.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_laboratorio_resolver(
    p_id_solicitud integer, p_aprobar boolean, p_comentario text DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    s        public.solicitud_laboratorio%ROWTYPE;
    a        public.aula%ROWTYPE;
    v_usu    integer;
    v_com    text := nullif(btrim(coalesce(p_comentario, '')), '');
    v_insc   integer;
    v_conf   text;
BEGIN
    PERFORM app.exigir_rol('administrador');
    IF p_id_solicitud IS NULL OR p_aprobar IS NULL THEN
        PERFORM app.fallar('VALIDACION', 'Indica la solicitud y si se aprueba o se rechaza.');
    END IF;
    IF v_com IS NOT NULL AND length(v_com) > 300 THEN
        PERFORM app.fallar('VALIDACION', 'El comentario admite hasta 300 caracteres.');
    END IF;
    v_usu := app.id_usuario();

    SELECT * INTO s FROM public.solicitud_laboratorio WHERE id_solicitud = p_id_solicitud FOR UPDATE;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'La solicitud no existe.');
    END IF;
    IF s.estatus <> 'pendiente' THEN
        PERFORM app.fallar('SOLICITUD_YA_RESUELTA', format('La solicitud ya está %s.', s.estatus));
    END IF;

    IF p_aprobar THEN
        IF app.instante_clase(s.fecha, s.hora_inicio) <= app.now() THEN
            PERFORM app.fallar('SOLICITUD_VENCIDA', 'La hora de inicio de la solicitud ya pasó; no se puede aprobar.');
        END IF;
        SELECT * INTO a FROM public.aula WHERE id_aula = s.id_aula;
        IF a.tipo <> 'laboratorio' THEN
            PERFORM app.fallar('LAB_NO_ES_LABORATORIO', format('El aula %s ya no es un laboratorio.', a.clave));
        END IF;
        SELECT count(*) INTO v_insc FROM public.inscripcion i WHERE i.id_grupo = s.id_grupo AND i.estatus = 'activa';
        IF v_insc > a.capacidad THEN
            PERFORM app.fallar('LAB_CAPACIDAD_INSUFICIENTE',
                format('El grupo tiene %s alumnos activos y el laboratorio %s admite %s.', v_insc, a.clave, a.capacidad));
        END IF;
        v_conf := app.lab_conflicto(s.id_aula, s.fecha, s.hora_inicio, s.hora_fin, s.id_solicitud, s.id_grupo);
        IF v_conf IS NOT NULL THEN
            PERFORM app.fallar('LAB_OCUPADO', format('El laboratorio no está disponible en ese horario: %s.', v_conf));
        END IF;
        UPDATE public.solicitud_laboratorio
           SET estatus = 'aprobada', resuelto_por = v_usu, fecha_resolucion = app.now(), comentario = v_com
         WHERE id_solicitud = s.id_solicitud RETURNING * INTO s;
    ELSE
        IF v_com IS NULL OR length(v_com) < 3 THEN
            PERFORM app.fallar('VALIDACION', 'Indica el motivo del rechazo (mínimo 3 caracteres).');
        END IF;
        UPDATE public.solicitud_laboratorio
           SET estatus = 'rechazada', resuelto_por = v_usu, fecha_resolucion = app.now(), comentario = v_com
         WHERE id_solicitud = s.id_solicitud RETURNING * INTO s;
    END IF;

    PERFORM app.bitacora('solicitud_laboratorio', 'solicitud_laboratorio', s.id_solicitud,
        jsonb_build_object('estatus', 'pendiente'),
        jsonb_build_object('estatus', s.estatus, 'comentario', s.comentario));
    RETURN app.lab_json(s);
END
$$;
REVOKE ALL ON FUNCTION public.api_laboratorio_resolver(integer, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_laboratorio_resolver(integer, boolean, text) TO authenticated;
COMMENT ON FUNCTION public.api_laboratorio_resolver(integer, boolean, text) IS
$c$El administrador aprueba (p_aprobar = true) o rechaza una solicitud pendiente. Al aprobar se revalidan hora de inicio, laboratorio, capacidad y disponibilidad; al rechazar el comentario es obligatorio.
ARGS: p_id_solicitud; p_aprobar boolean; p_comentario opcional al aprobar (max 300), obligatorio al rechazar (minimo 3).
RETURNS: la solicitud con su nuevo estatus (misma forma que api_laboratorio_solicitar).
ERRORES: NO_AUTORIZADO, VALIDACION, NO_ENCONTRADO, SOLICITUD_YA_RESUELTA, SOLICITUD_VENCIDA (la hora de inicio ya paso), LAB_NO_ES_LABORATORIO, LAB_CAPACIDAD_INSUFICIENTE, LAB_OCUPADO.
ROLES: administrador. Deja constancia en bitacora (solicitud_laboratorio).$c$;

-- ---------------------------------------------------------------------------------------------
-- 6) api_laboratorio_cancelar: el docente cancela la suya; el administrador cancela cualquiera (con motivo).
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_laboratorio_cancelar(p_id_solicitud integer, p_comentario text DEFAULT NULL) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol    text := app.exigir_rol('administrador', 'docente');
    s        public.solicitud_laboratorio%ROWTYPE;
    v_ant    public.estatus_solicitud_lab;
    v_com    text := nullif(btrim(coalesce(p_comentario, '')), '');
BEGIN
    IF p_id_solicitud IS NULL THEN
        PERFORM app.fallar('VALIDACION', 'Indica la solicitud.');
    END IF;
    IF v_com IS NOT NULL AND length(v_com) > 300 THEN
        PERFORM app.fallar('VALIDACION', 'El comentario admite hasta 300 caracteres.');
    END IF;
    IF v_rol = 'administrador' AND (v_com IS NULL OR length(v_com) < 3) THEN
        PERFORM app.fallar('VALIDACION', 'Indica el motivo de la cancelación (mínimo 3 caracteres).');
    END IF;

    SELECT * INTO s FROM public.solicitud_laboratorio
     WHERE id_solicitud = p_id_solicitud AND (v_rol = 'administrador' OR id_docente = app.id_docente()) FOR UPDATE;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'La solicitud no existe.');
    END IF;
    IF s.estatus NOT IN ('pendiente', 'aprobada') THEN
        PERFORM app.fallar('SOLICITUD_YA_RESUELTA', format('La solicitud ya está %s; no se puede cancelar.', s.estatus));
    END IF;
    IF s.estatus = 'aprobada' AND app.instante_clase(s.fecha, s.hora_inicio) <= app.now() THEN
        PERFORM app.fallar('SOLICITUD_VENCIDA', 'La solicitud aprobada ya inició o pasó; no se puede cancelar.');
    END IF;

    v_ant := s.estatus;
    UPDATE public.solicitud_laboratorio
       SET estatus = 'cancelada', resuelto_por = app.id_usuario(), fecha_resolucion = app.now(), comentario = v_com
     WHERE id_solicitud = s.id_solicitud RETURNING * INTO s;

    PERFORM app.bitacora('solicitud_laboratorio', 'solicitud_laboratorio', s.id_solicitud,
        jsonb_build_object('estatus', v_ant),
        jsonb_build_object('estatus', 'cancelada', 'comentario', s.comentario, 'por', v_rol));
    RETURN app.lab_json(s);
END
$$;
REVOKE ALL ON FUNCTION public.api_laboratorio_cancelar(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_laboratorio_cancelar(integer, text) TO authenticated;
COMMENT ON FUNCTION public.api_laboratorio_cancelar(integer, text) IS
$c$Cancela una solicitud pendiente o aprobada que aun no inicia. El docente solo cancela las suyas (comentario opcional); el administrador cancela cualquiera y debe indicar el motivo.
ARGS: p_id_solicitud; p_comentario opcional para el docente (max 300), obligatorio para el administrador (minimo 3).
RETURNS: la solicitud con estatus cancelada (misma forma que api_laboratorio_solicitar).
ERRORES: NO_AUTORIZADO, VALIDACION, NO_ENCONTRADO (no existe o no es del docente), SOLICITUD_YA_RESUELTA (rechazada o cancelada), SOLICITUD_VENCIDA (aprobada que ya inicio).
ROLES: administrador, docente. Deja constancia en bitacora (solicitud_laboratorio).$c$;

-- ---------------------------------------------------------------------------------------------
-- 7) api_laboratorio_solicitudes_listar: las del docente (propias) o todas (administrador).
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_laboratorio_solicitudes_listar(
    p_estatus text DEFAULT NULL, p_id_aula integer DEFAULT NULL, p_desde date DEFAULT NULL, p_hasta date DEFAULT NULL,
    p_limit integer DEFAULT 50, p_offset integer DEFAULT 0
) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol     text := app.exigir_rol('administrador', 'docente');
    v_doc     integer := app.id_docente();
    v_est     public.estatus_solicitud_lab;
    v_lim     integer := app.b1_limite(p_limit);
    v_off     integer := app.b1_desplazamiento(p_offset);
    v_total   bigint;
    v_conteos jsonb;
    v_items   jsonb;
BEGIN
    IF nullif(btrim(coalesce(p_estatus, '')), '') IS NOT NULL THEN
        BEGIN
            v_est := btrim(p_estatus)::public.estatus_solicitud_lab;
        EXCEPTION WHEN invalid_text_representation THEN
            PERFORM app.fallar('VALIDACION', 'El estatus debe ser pendiente, aprobada, rechazada o cancelada.');
        END;
    END IF;

    SELECT jsonb_build_object(
               'pendiente', count(*) FILTER (WHERE s.estatus = 'pendiente'),
               'aprobada',  count(*) FILTER (WHERE s.estatus = 'aprobada'),
               'rechazada', count(*) FILTER (WHERE s.estatus = 'rechazada'),
               'cancelada', count(*) FILTER (WHERE s.estatus = 'cancelada'),
               'total',     count(*)),
           count(*) FILTER (WHERE v_est IS NULL OR s.estatus = v_est)
      INTO v_conteos, v_total
      FROM public.solicitud_laboratorio s
     WHERE (v_rol = 'administrador' OR s.id_docente = v_doc)
       AND (p_id_aula IS NULL OR s.id_aula = p_id_aula)
       AND (p_desde IS NULL OR s.fecha >= p_desde) AND (p_hasta IS NULL OR s.fecha <= p_hasta);

    -- Pendientes primero y por fecha ascendente (lo mas proximo a vencer); el resto, del mas reciente al mas antiguo.
    SELECT coalesce(jsonb_agg(
               app.lab_json(x.fila,
                   CASE WHEN v_rol = 'administrador' AND (x.fila).estatus = 'pendiente' THEN
                       app.lab_conflicto((x.fila).id_aula, (x.fila).fecha, (x.fila).hora_inicio, (x.fila).hora_fin,
                                         (x.fila).id_solicitud, (x.fila).id_grupo) END)
               || CASE WHEN v_rol = 'administrador' AND (x.fila).estatus = 'pendiente' THEN
                       jsonb_build_object('compite', (SELECT count(*) FROM public.solicitud_laboratorio o
                                                       WHERE o.id_aula = (x.fila).id_aula AND o.fecha = (x.fila).fecha
                                                         AND o.estatus = 'pendiente' AND o.id_solicitud <> (x.fila).id_solicitud
                                                         AND o.hora_inicio < (x.fila).hora_fin AND o.hora_fin > (x.fila).hora_inicio))
                   ELSE '{}'::jsonb END
               ORDER BY x.rn), '[]'::jsonb)
      INTO v_items
      FROM (
        SELECT s AS fila,
               row_number() OVER (ORDER BY CASE WHEN s.estatus = 'pendiente' THEN 0 ELSE 1 END,
                                           CASE WHEN s.estatus = 'pendiente' THEN s.fecha END ASC,
                                           CASE WHEN s.estatus = 'pendiente' THEN s.hora_inicio END ASC,
                                           s.fecha DESC, s.hora_inicio DESC, s.id_solicitud DESC) AS rn
          FROM public.solicitud_laboratorio s
         WHERE (v_rol = 'administrador' OR s.id_docente = v_doc)
           AND (v_est IS NULL OR s.estatus = v_est)
           AND (p_id_aula IS NULL OR s.id_aula = p_id_aula)
           AND (p_desde IS NULL OR s.fecha >= p_desde) AND (p_hasta IS NULL OR s.fecha <= p_hasta)
      ) x
     WHERE x.rn > v_off AND x.rn <= v_off + v_lim;

    RETURN jsonb_build_object('total', v_total, 'conteos', v_conteos, 'items', v_items);
END
$$;
REVOKE ALL ON FUNCTION public.api_laboratorio_solicitudes_listar(text, integer, date, date, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_laboratorio_solicitudes_listar(text, integer, date, date, integer, integer) TO authenticated;
COMMENT ON FUNCTION public.api_laboratorio_solicitudes_listar(text, integer, date, date, integer, integer) IS
$c$Solicitudes de laboratorio (paginada). Pendientes primero por fecha y hora ascendentes; el resto de la mas reciente a la mas antigua. `conteos` ignora el filtro de estatus. Solo para el administrador, las pendientes traen `conflicto` (texto o null: por que no se podria aprobar hoy) y `compite` (otras pendientes que se traslapan).
ARGS: p_estatus pendiente|aprobada|rechazada|cancelada (opcional); p_id_aula; p_desde y p_hasta (fecha de uso); p_limit def. 50 max 200; p_offset def. 0.
RETURNS: {"total": 3, "conteos": {"pendiente": 1, "aprobada": 2, "rechazada": 0, "cancelada": 0, "total": 3}, "items": [{"id_solicitud": 7, "estatus": "pendiente", "fecha": "2026-09-24", "hora_inicio": "10:00", "hora_fin": "12:00", "actividad": "Practica de balanza", "vencida": false, "aula": {"id_aula": 3, "clave": "LAB-1", "edificio": "C", "capacidad": 30}, "grupo": {"id_grupo": 1, "clave_grupo": "3A", "materia_clave": "ADM101", "materia_nombre": "Administracion I", "inscritos": 4}, "docente": {"id_docente": 1, "nombre_completo": "Lopez Ruiz Ana"}, "conflicto": null, "compite": 0}]}
ERRORES: NO_AUTORIZADO (alumno, tecnico), VALIDACION (estatus desconocido).
ROLES: administrador (todas); docente (solo las suyas).$c$;

-- ---------------------------------------------------------------------------------------------
-- 8) api_laboratorio_agenda: ocupacion de un laboratorio en un rango (clases del aula y solicitudes vigentes).
-- Sirve al docente para elegir un horario libre y al administrador para decidir. Del resto de los docentes solo se muestran
-- grupo y materia; el nombre del docente lo ve unicamente el administrador.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_laboratorio_agenda(p_id_aula integer, p_desde date, p_hasta date) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol     text := app.exigir_rol('administrador', 'docente');
    v_doc     integer := app.id_docente();
    a         public.aula%ROWTYPE;
    v_bloques jsonb;
BEGIN
    IF p_desde IS NULL OR p_hasta IS NULL OR p_hasta < p_desde THEN
        PERFORM app.fallar('VALIDACION', 'Indica un rango de fechas válido (desde <= hasta).');
    END IF;
    IF p_hasta - p_desde > 41 THEN
        PERFORM app.fallar('VALIDACION', 'El rango máximo de la agenda es de 42 días.');
    END IF;
    SELECT * INTO a FROM public.aula WHERE id_aula = p_id_aula AND tipo = 'laboratorio';
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El laboratorio no existe.');
    END IF;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
               'tipo', b.tipo, 'estatus', b.estatus, 'fecha', b.fecha,
               'hora_inicio', to_char(b.hora_inicio, 'HH24:MI'), 'hora_fin', to_char(b.hora_fin, 'HH24:MI'),
               'clave_grupo', b.clave_grupo, 'materia_clave', b.materia_clave, 'materia_nombre', b.materia_nombre,
               'propia', b.propia,
               'id_solicitud', CASE WHEN v_rol = 'administrador' OR b.propia THEN b.id_solicitud END,
               'docente_nombre', CASE WHEN v_rol = 'administrador' THEN b.docente_nombre END)
           ORDER BY b.fecha, b.hora_inicio, b.tipo), '[]'::jsonb)
      INTO v_bloques
      FROM (
        SELECT 'clase'::text AS tipo, NULL::text AS estatus, sc.fecha, sc.hora_inicio, sc.hora_fin,
               g.clave_grupo, m.clave AS materia_clave, m.nombre AS materia_nombre,
               (g.id_docente = v_doc) AS propia, NULL::integer AS id_solicitud,
               app.c1_nombre(d.apellido_paterno, d.apellido_materno, d.nombres) AS docente_nombre
          FROM public.sesion_clase sc
          JOIN public.grupo g ON g.id_grupo = sc.id_grupo
          JOIN public.materia m ON m.id_materia = g.id_materia
          JOIN public.docente d ON d.id_docente = g.id_docente
         WHERE g.id_aula = a.id_aula AND sc.fecha BETWEEN p_desde AND p_hasta AND sc.estatus <> 'suspendida'
        UNION ALL
        SELECT 'solicitud'::text, s.estatus::text, s.fecha, s.hora_inicio, s.hora_fin,
               g.clave_grupo, m.clave, m.nombre, (s.id_docente = v_doc), s.id_solicitud,
               app.c1_nombre(d.apellido_paterno, d.apellido_materno, d.nombres)
          FROM public.solicitud_laboratorio s
          JOIN public.grupo g ON g.id_grupo = s.id_grupo
          JOIN public.materia m ON m.id_materia = g.id_materia
          JOIN public.docente d ON d.id_docente = s.id_docente
         WHERE s.id_aula = a.id_aula AND s.fecha BETWEEN p_desde AND p_hasta AND s.estatus IN ('pendiente', 'aprobada')
      ) b;

    RETURN jsonb_build_object('aula', app.b1_aula_json(a), 'desde', p_desde, 'hasta', p_hasta, 'bloques', v_bloques);
END
$$;
REVOKE ALL ON FUNCTION public.api_laboratorio_agenda(integer, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_laboratorio_agenda(integer, date, date) TO authenticated;
COMMENT ON FUNCTION public.api_laboratorio_agenda(integer, date, date) IS
$c$Ocupacion de un laboratorio entre dos fechas: clases de los grupos que lo usan como aula (sesiones no suspendidas) y solicitudes pendientes o aprobadas.
ARGS: p_id_aula (laboratorio); p_desde; p_hasta (maximo 42 dias de rango).
RETURNS: {"aula": {"id_aula": 3, "clave": "LAB-1", "edificio": "C", "capacidad": 30, "tipo": "laboratorio"}, "desde": "2026-09-14", "hasta": "2026-09-27", "bloques": [{"tipo": "solicitud", "estatus": "aprobada", "fecha": "2026-09-24", "hora_inicio": "10:00", "hora_fin": "12:00", "clave_grupo": "3A", "materia_clave": "ADM101", "materia_nombre": "Administracion I", "propia": true, "id_solicitud": 7, "docente_nombre": null}]}
ERRORES: NO_AUTORIZADO, VALIDACION (rango), NO_ENCONTRADO (no existe o no es laboratorio).
ROLES: administrador (ve tambien el nombre del docente y el id de cada solicitud); docente (id solo de las suyas).$c$;
