-- 0130 · Ayudantes del esquema app para la sesion de clase (RF-03 a RF-10, RN-02 a RN-07).
--
--  * app.minuto_de_sesion / app.estado_por_minuto: la UNICA definicion de la ventana de tiempo de RN-03.
--      minuto < limite_presente_min            -> presente   (9:59 es presente)
--      limite <= minuto <= tolerancia_min      -> retardo    (10:00 es retardo; el minuto 20 aun cuenta)
--      minuto > tolerancia_min                 -> NULL       (fuera de la ventana de tolerancia)
--    Se usan los valores copiados en la SESION (limite_presente_min, tolerancia_min), no los parametros vigentes.
--  * app.lecturas_validas: lecturas = CAPTURAS DISTINTAS con al menos una deteccion valida del alumno (RN-05).
--  * app.sesion_autorizada / app.sesion_bloqueada: pertenencia (docente titular; opcionalmente administrador),
--    sin IDOR por ids numericos. La bloqueada toma FOR NO KEY UPDATE para serializar capturas, registros
--    manuales y cierre de una misma sesion sin estorbar a las FK (FOR KEY SHARE) de captura/asistencia.
-- Ninguna recibe texto libre ni arma SQL dinamico. Sin EXECUTE para authenticated: solo las llaman RPC DEFINER.

CREATE OR REPLACE FUNCTION app.minuto_de_sesion(p_fecha date, p_hora_inicio time, p_instante timestamptz)
    RETURNS numeric
    LANGUAGE sql STABLE
    SET search_path = pg_catalog, app, pg_temp
AS $$
    SELECT extract(epoch FROM (p_instante - app.instante_clase(p_fecha, p_hora_inicio))) / 60.0
$$;
COMMENT ON FUNCTION app.minuto_de_sesion(date, time, timestamptz) IS
    'Minutos (con fraccion, exactos) transcurridos desde hora_inicio de la sesion hasta el instante dado; negativo antes de iniciar.';

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

CREATE OR REPLACE FUNCTION app.lecturas_validas(p_id_sesion integer, p_id_alumno integer)
    RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
    SELECT count(DISTINCT c.id_captura)::integer
      FROM public.deteccion d
      JOIN public.captura c ON c.id_captura = d.id_captura
      JOIN public.plantilla_facial pf ON pf.id_plantilla = d.id_plantilla
     WHERE c.id_sesion = p_id_sesion AND pf.id_alumno = p_id_alumno AND d.es_valida
$$;
COMMENT ON FUNCTION app.lecturas_validas(integer, integer) IS
    'Capturas distintas con deteccion valida del alumno en la sesion (RN-05); varias lecturas en la misma captura cuentan una vez.';

-- Sesion visible para el solicitante (sin bloquear). Orden de errores: sesion/rol (NO_AUTENTICADO,
-- NO_AUTORIZADO) -> NO_ENCONTRADO -> NO_AUTORIZADO si no es suya.
CREATE OR REPLACE FUNCTION app.sesion_autorizada(p_id_sesion integer, p_permitir_admin boolean DEFAULT false)
    RETURNS public.sesion_clase
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol text := app.exigir_rol();
    s     public.sesion_clase%ROWTYPE;
    v_doc integer;
BEGIN
    IF v_rol NOT IN ('docente') AND NOT (v_rol = 'administrador' AND coalesce(p_permitir_admin, false)) THEN
        PERFORM app.fallar('NO_AUTORIZADO', 'No tienes permiso para realizar esta operación.');
    END IF;

    SELECT * INTO s FROM public.sesion_clase x WHERE x.id_sesion = p_id_sesion;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'La sesión de clase no existe.');
    END IF;

    IF v_rol = 'docente' THEN
        SELECT g.id_docente INTO v_doc FROM public.grupo g WHERE g.id_grupo = s.id_grupo;
        IF v_doc IS DISTINCT FROM app.id_docente() THEN
            PERFORM app.fallar('NO_AUTORIZADO', 'La sesión pertenece al grupo de otro docente.');
        END IF;
    END IF;
    RETURN s;
END
$$;
COMMENT ON FUNCTION app.sesion_autorizada(integer, boolean) IS
    'Devuelve la sesion si el solicitante es su docente titular (o administrador con p_permitir_admin). NO_ENCONTRADO / NO_AUTORIZADO.';

-- Igual, pero toma la fila FOR NO KEY UPDATE y la relee: el estatus devuelto ya es el definitivo.
CREATE OR REPLACE FUNCTION app.sesion_bloqueada(p_id_sesion integer, p_permitir_admin boolean DEFAULT false)
    RETURNS public.sesion_clase
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    s public.sesion_clase%ROWTYPE;
BEGIN
    s := app.sesion_autorizada(p_id_sesion, p_permitir_admin);
    SELECT * INTO s FROM public.sesion_clase x WHERE x.id_sesion = s.id_sesion FOR NO KEY UPDATE;
    RETURN s;
END
$$;
COMMENT ON FUNCTION app.sesion_bloqueada(integer, boolean) IS
    'Como app.sesion_autorizada, pero bloquea la fila de la sesion (FOR NO KEY UPDATE) hasta el fin de la transaccion.';

-- Estado sugerido por la hora de marcado (RF-09): presente / retardo segun RN-03; pasada la ventana
-- de tolerancia no hay sugerencia de presencia y se sugiere ausente.
CREATE OR REPLACE FUNCTION app.estado_sugerido(p_fecha date, p_hora_inicio time, p_limite integer, p_tolerancia integer, p_instante timestamptz)
    RETURNS public.estado_asistencia
    LANGUAGE sql STABLE
    SET search_path = pg_catalog, app, pg_temp
AS $$
    SELECT coalesce(
        app.estado_por_minuto(p_limite, p_tolerancia, app.minuto_de_sesion(p_fecha, p_hora_inicio, p_instante)),
        'ausente'::public.estado_asistencia)
$$;
COMMENT ON FUNCTION app.estado_sugerido(date, time, integer, integer, timestamptz) IS
    'Estado que sugiere la hora de marcado (pase manual, RF-09): presente, retardo, o ausente pasada la tolerancia.';

-- EXECUTE: las puras y la de autorizacion (valida rol y pertenencia ella misma) las llaman tambien las
-- RPC de lectura INVOKER. app.lecturas_validas y app.sesion_bloqueada solo las usan RPC DEFINER.
GRANT EXECUTE ON FUNCTION
    app.minuto_de_sesion(date, time, timestamptz),
    app.estado_por_minuto(integer, integer, numeric),
    app.estado_sugerido(date, time, integer, integer, timestamptz),
    app.sesion_autorizada(integer, boolean)
    TO authenticated, service_role;
