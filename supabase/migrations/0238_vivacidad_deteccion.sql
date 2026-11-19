-- 0238 · Deteccion de vida por lectura y marca "sospechosa" en la revision (docs/DECISIONS.md, abierto/riesgos 2).
-- El servicio de reconocimiento (addon `liveness` de InsightFace, modo observacion) entrega por rostro
-- `vivacidad: {estado, es_viva, puntaje}`. Esta migracion lo guarda y lo expone al docente; NO cambia ninguna regla de asistencia:
--   * deteccion.es_viva / deteccion.puntaje_vida: NULL = no se evaluo (rostro pequeno, servicio sin el addon, servicio anterior).
--     Como es_valida, es una FOTO del momento: el umbral de vida con que se decidio no se recalcula despues.
--   * Una lectura VALIDA con es_viva = false marca el caso como SOSPECHOSO (`sospechosa`, `lecturas_no_vivas`) en la cola de
--     revision (pendientes y justificantes) y en las lecturas del caso. Es una marca DERIVADA (se calcula al leer): no hay estado
--     que se quede desactualizado ni escritura nueva sobre `asistencia`. No cambia es_valida, ni conteo_detecciones, ni el estado:
--     el docente decide. Solo cuentan las lecturas validas porque son las que sostienen la asistencia.
--   * svc_registrar_detecciones acepta `es_viva` y `puntaje_vida` OPCIONALES por deteccion. Un dato de vida mal formado se ignora
--     (queda NULL) y nunca descarta la deteccion ni tumba la captura: es informativo.
--
-- Despliegue: aplicar este SQL y despues desplegar la web. Orden inverso tambien es seguro (la web nueva manda claves que la funcion
-- vieja ignora). Sin firmas nuevas: no cambia el catalogo de RPC. ADD COLUMN sin DEFAULT es de metadatos (no reescribe la tabla).
-- Idempotente: se puede volver a ejecutar.
--
-- ROLLBACK (solo documentado): restaurar svc_registrar_detecciones, app.c1_lecturas_caso y api_detecciones_caso desde 0135 y 0122;
--   ALTER TABLE public.deteccion DROP CONSTRAINT ck_deteccion_vida, DROP COLUMN es_viva, DROP COLUMN puntaje_vida.

-- Si otra transaccion larga retiene la tabla, falla rapido en vez de encolarse y bloquear las capturas (solo aplica dentro de una transaccion).
SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------------------------------
-- 1) Columnas y restriccion
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.deteccion ADD COLUMN IF NOT EXISTS es_viva boolean;
ALTER TABLE public.deteccion ADD COLUMN IF NOT EXISTS puntaje_vida numeric(4,3);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'public.deteccion'::regclass AND conname = 'ck_deteccion_vida') THEN
        -- Ambas o ninguna: un veredicto de vida siempre llega con su puntaje (como todo candidato llega con su score, RN-04).
        ALTER TABLE public.deteccion ADD CONSTRAINT ck_deteccion_vida CHECK (
            (es_viva IS NULL AND puntaje_vida IS NULL)
            OR (es_viva IS NOT NULL AND puntaje_vida IS NOT NULL AND puntaje_vida BETWEEN 0 AND 1));
    END IF;
END
$$;

COMMENT ON COLUMN public.deteccion.es_viva IS
    'Veredicto de la deteccion de vida del servicio de reconocimiento al momento de la lectura (puntaje >= umbral de vida); NULL = no se evaluo. Informativo: no interviene en es_valida.';
COMMENT ON COLUMN public.deteccion.puntaje_vida IS
    'Puntaje de vida del rostro (0 a 1, 3 decimales) que dio origen a es_viva; NULL = no se evaluo.';

-- ---------------------------------------------------------------------------------------------
-- 2) svc_registrar_detecciones: guarda es_viva y puntaje_vida (opcionales). Idem 0135 salvo las marcas "-- 0238".
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.svc_registrar_detecciones(p_id_captura bigint, p_detecciones jsonb) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    cap         public.captura%ROWTYPE;
    s           public.sesion_clase%ROWTYPE;
    a           public.asistencia%ROWTYPE;
    d           jsonb;
    v_umbral    numeric := app.param_num('umbral_similitud');
    v_min       numeric := app.param_num('min_detecciones_validas');
    v_indice    integer;
    v_i         integer := 0;
    v_faiss     bigint;
    v_score     numeric;
    v_recorte   text;
    v_pl        record;
    v_id_pl     integer;
    v_valida    boolean;
    v_viva      boolean;                          -- 0238
    v_pvida     numeric;                          -- 0238
    v_total     integer := 0;
    v_validas   integer := 0;
    v_alumnos   integer[] := ARRAY[]::integer[];
    v_alumno    integer;
    v_n         integer;
    v_creado    boolean;
    v_confirmado boolean;
    v_estado    public.estado_asistencia;
    v_cambios   jsonb := '[]'::jsonb;
BEGIN
    SELECT * INTO cap FROM public.captura k WHERE k.id_captura = p_id_captura;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'La captura no existe.');
    END IF;

    -- Idempotencia: una captura ya procesada devuelve su resumen sin duplicar detecciones ni conteos.
    IF EXISTS (SELECT 1 FROM public.deteccion x WHERE x.id_captura = p_id_captura) THEN
        SELECT count(*)::integer, (count(*) FILTER (WHERE x.es_valida))::integer INTO v_total, v_validas
          FROM public.deteccion x WHERE x.id_captura = p_id_captura;
        RETURN jsonb_build_object('id_captura', p_id_captura, 'rostros', cap.rostros_detectados,
                                  'validas', v_validas, 'no_atribuidas', v_total - v_validas,
                                  'cambios', '[]'::jsonb, 'ya_procesada', true);
    END IF;

    SELECT * INTO s FROM public.sesion_clase x WHERE x.id_sesion = cap.id_sesion FOR NO KEY UPDATE;
    IF s.estatus <> 'abierta' THEN
        PERFORM app.fallar('SESION_NO_ABIERTA', 'La sesión no está abierta; no admite detecciones.');
    END IF;
    IF s.modo_registro <> 'automatico' THEN
        PERFORM app.fallar('SESION_NO_AUTOMATICA', 'La sesión es de pase de lista manual; no admite detecciones.');
    END IF;

    IF p_detecciones IS NULL OR jsonb_typeof(p_detecciones) <> 'array' THEN
        PERFORM app.fallar('VALIDACION', 'p_detecciones debe ser un arreglo JSON de {faiss_id, score, objeto_recorte}.');
    END IF;
    IF jsonb_array_length(p_detecciones) > cap.rostros_detectados THEN
        PERFORM app.fallar('VALIDACION',
            format('Hay %s detecciones y la captura declara solo %s rostros.', jsonb_array_length(p_detecciones), cap.rostros_detectados));
    END IF;

    SELECT f.id_indice INTO v_indice FROM public.indice_faiss f WHERE f.en_uso;

    FOR d IN SELECT x FROM jsonb_array_elements(p_detecciones) AS t(x) LOOP
        v_i := v_i + 1;
        v_faiss := NULL; v_score := NULL; v_recorte := NULL; v_id_pl := NULL; v_valida := false;
        v_viva := NULL; v_pvida := NULL;          -- 0238
        BEGIN
            IF jsonb_typeof(d) <> 'object' THEN
                RAISE EXCEPTION 'no es un objeto';
            END IF;
            v_faiss := (d ->> 'faiss_id')::bigint;
            v_score := (d ->> 'score')::numeric;
            v_recorte := d ->> 'objeto_recorte';
            IF v_faiss IS NOT NULL AND (v_faiss < 0 OR v_score IS NULL OR v_score < 0 OR v_score > 1) THEN
                RAISE EXCEPTION 'faiss_id o score fuera de rango';
            END IF;
            IF v_recorte IS NOT NULL AND char_length(v_recorte) > 255 THEN
                RAISE EXCEPTION 'objeto_recorte demasiado largo';
            END IF;
        EXCEPTION WHEN others THEN
            PERFORM app.fallar('VALIDACION', format('La detección %s no es válida: requiere faiss_id (entero >= 0) con score entre 0 y 1.', v_i));
        END;

        -- 0238: vida opcional. Solo se guarda si llegan AMBOS datos bien formados; cualquier otra cosa queda NULL (no se evaluo).
        BEGIN
            IF jsonb_typeof(d -> 'es_viva') = 'boolean' AND jsonb_typeof(d -> 'puntaje_vida') = 'number' THEN
                v_pvida := round((d ->> 'puntaje_vida')::numeric, 3);
                IF v_pvida BETWEEN 0 AND 1 THEN
                    v_viva := (d ->> 'es_viva')::boolean;
                ELSE
                    v_pvida := NULL;
                END IF;
            END IF;
        EXCEPTION WHEN others THEN
            v_viva := NULL; v_pvida := NULL;
        END;

        IF v_faiss IS NOT NULL AND v_indice IS NOT NULL THEN
            SELECT p.id_plantilla, p.id_alumno, p.id_consent, p.activa INTO v_pl
              FROM public.plantilla_facial p WHERE p.id_indice = v_indice AND p.faiss_id = v_faiss;
            IF FOUND THEN
                v_id_pl := v_pl.id_plantilla;
                v_score := round(v_score, 3);     -- se compara el valor que se guarda (NUMERIC(4,3))
                -- RN-04 + RF-04/RNF-06 (red de seguridad: el servicio ya filtra los candidatos).
                v_valida := v_score >= v_umbral
                    AND v_pl.activa
                    AND EXISTS (SELECT 1 FROM public.inscripcion i
                                 WHERE i.id_alumno = v_pl.id_alumno AND i.id_grupo = s.id_grupo AND i.estatus = 'activa')
                    AND app.consentimiento_vigente(v_pl.id_consent);
                IF v_valida AND NOT (v_pl.id_alumno = ANY (v_alumnos)) THEN
                    v_alumnos := v_alumnos || v_pl.id_alumno;
                END IF;
            END IF;
        END IF;
        IF v_id_pl IS NULL THEN
            v_score := NULL;                      -- sin candidato: sin score ni lectura valida (ck_deteccion_candidato)
        END IF;

        INSERT INTO public.deteccion (id_captura, id_plantilla, score_similitud, es_valida, objeto_recorte, es_viva, puntaje_vida)
        VALUES (p_id_captura, v_id_pl, v_score, v_valida, v_recorte, v_viva, v_pvida);
        v_total := v_total + 1;
        IF v_valida THEN v_validas := v_validas + 1; END IF;
    END LOOP;

    -- Ciclo de vida de la asistencia (RN-02, RN-03, RN-05): se recalcula desde los datos, asi el conteo es
    -- siempre "capturas distintas" aunque un alumno salga varias veces en la misma captura.
    FOREACH v_alumno IN ARRAY v_alumnos LOOP
        v_n := app.lecturas_validas(s.id_sesion, v_alumno);
        v_creado := false; v_confirmado := false;

        SELECT * INTO a FROM public.asistencia x WHERE x.id_sesion = s.id_sesion AND x.id_alumno = v_alumno FOR UPDATE;
        IF NOT FOUND THEN
            INSERT INTO public.asistencia (id_sesion, id_alumno, estado, hora_registro, origen, conteo_detecciones)
            VALUES (s.id_sesion, v_alumno, 'pendiente', cap.marca_tiempo, 'automatico', v_n)
            RETURNING * INTO a;
            v_creado := true;
        ELSIF a.origen = 'automatico' AND a.estado IN ('pendiente', 'presente', 'retardo') THEN
            UPDATE public.asistencia
               SET conteo_detecciones = greatest(a.conteo_detecciones, v_n),
                   hora_registro = CASE WHEN a.estado = 'pendiente' THEN least(a.hora_registro, cap.marca_tiempo)
                                        ELSE a.hora_registro END
             WHERE id_asistencia = a.id_asistencia
             RETURNING * INTO a;
        ELSE
            CONTINUE;                              -- registro manual/correccion: no se pisa
        END IF;

        -- Confirmacion (RN-05): el estado lo decide la PRIMERA lectura valida, no la que completa el minimo.
        IF a.estado = 'pendiente' AND a.conteo_detecciones >= v_min THEN
            v_estado := coalesce(
                app.estado_por_minuto(s.limite_presente_min, s.tolerancia_min,
                                      app.minuto_de_sesion(s.fecha, s.hora_inicio, a.hora_registro)),
                'retardo'::public.estado_asistencia);
            UPDATE public.asistencia SET estado = v_estado WHERE id_asistencia = a.id_asistencia
             RETURNING * INTO a;
            v_confirmado := true;
        END IF;

        v_cambios := v_cambios || jsonb_build_array(jsonb_build_object(
            'id_alumno', a.id_alumno, 'estado', a.estado, 'lecturas_validas', v_n,
            'hora_registro', a.hora_registro, 'creado', v_creado, 'confirmado', v_confirmado));
    END LOOP;

    RETURN jsonb_build_object('id_captura', p_id_captura, 'rostros', cap.rostros_detectados,
                              'validas', v_validas, 'no_atribuidas', v_total - v_validas,
                              'cambios', v_cambios, 'ya_procesada', false);
END
$$;
COMMENT ON FUNCTION public.svc_registrar_detecciones(bigint, jsonb) IS $c$
Registra las detecciones de una captura y aplica el ciclo de vida de la asistencia (RN-02 a RN-05, RF-04 a RF-08).
ARGS: p_id_captura bigint, p_detecciones jsonb = [{faiss_id:int|null, score:numeric|null, objeto_recorte:text|null, es_viva:boolean|null, puntaje_vida:numeric|null}] (no mas que los rostros de la captura). es_viva y puntaje_vida son OPCIONALES (deteccion de vida del servicio): solo se guardan si llegan ambos y bien formados (puntaje entre 0 y 1); si no, quedan NULL y la deteccion se registra igual. Informativos: no cambian es_valida ni la asistencia. Resuelve faiss_id con el indice en uso (sin resolver = sin candidato). Guarda SIEMPRE candidato y score; es_valida = score (a 3 decimales) >= umbral_similitud (0.849 no, 0.850 si) y el candidato esta inscrito, activo y con consentimiento vigente. La 1.a valida de un alumno crea pendiente (origen automatico, hora_registro = marca de la captura); lecturas en capturas distintas suben conteo_detecciones; al llegar a min_detecciones_validas pasa a presente (1.a lectura antes de limite_presente_min) o retardo (hasta tolerancia_min). No pisa registros manuales ni correcciones. Idempotente por captura.
RETURNS: {id_captura,rostros,validas,no_atribuidas,cambios:[{id_alumno,estado,lecturas_validas,hora_registro,creado,confirmado}],ya_procesada}
ERRORES: NO_ENCONTRADO (captura), SESION_NO_ABIERTA, SESION_NO_AUTOMATICA, VALIDACION (arreglo mal formado, score fuera de 0..1, mas detecciones que rostros)
ROLES: service_role
$c$;
REVOKE ALL ON FUNCTION public.svc_registrar_detecciones(bigint, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.svc_registrar_detecciones(bigint, jsonb) TO service_role;

-- ---------------------------------------------------------------------------------------------
-- 3) app.c1_lecturas_caso: agrega lecturas_no_vivas, sospechosa y, por lectura, es_viva / puntaje_vida.
-- Se mezcla (||) en cada caso de api_cola_revision (pendientes y justificantes), asi que ambas pestanas la reciben.
-- Idem 0122 salvo las marcas "-- 0238".
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.c1_lecturas_caso(p_id_alumno integer, p_id_sesion integer, p_max integer DEFAULT 10) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
    WITH ini AS (
        SELECT app.instante_clase(s.fecha, s.hora_inicio) AS t0 FROM public.sesion_clase s WHERE s.id_sesion = p_id_sesion
    ), l AS (
        SELECT d.id_deteccion, d.id_captura, c.marca_tiempo, cam.posicion, d.score_similitud, d.es_valida,
               d.es_viva, d.puntaje_vida,                                                       -- 0238
               (d.objeto_recorte IS NOT NULL) AS tiene_recorte,
               round(extract(epoch FROM c.marca_tiempo - (SELECT t0 FROM ini)) / 60, 2) AS minuto
          FROM public.deteccion d
          JOIN public.captura c ON c.id_captura = d.id_captura
          JOIN public.plantilla_facial pf ON pf.id_plantilla = d.id_plantilla
          LEFT JOIN public.camara cam ON cam.id_camara = c.id_camara
         WHERE c.id_sesion = p_id_sesion AND pf.id_alumno = p_id_alumno
    )
    SELECT jsonb_build_object(
        'lecturas_validas', (SELECT count(*) FILTER (WHERE es_valida) FROM l),
        'total_lecturas', (SELECT count(*) FROM l),
        'mejor_score', (SELECT max(score_similitud) FROM l),
        -- 0238: sospechosa = alguna lectura VALIDA (las que sostienen la asistencia) con veredicto de vida "no viva"
        'lecturas_no_vivas', (SELECT count(*) FILTER (WHERE es_valida AND es_viva IS FALSE) FROM l),
        'sospechosa', (SELECT coalesce(bool_or(es_valida AND es_viva IS FALSE), false) FROM l),
        'lecturas', coalesce((SELECT jsonb_agg(jsonb_build_object(
                'id_deteccion', x.id_deteccion, 'id_captura', x.id_captura,
                'marca_tiempo', app.c1_iso(x.marca_tiempo), 'minuto_sesion', x.minuto,
                'camara_posicion', x.posicion, 'score_similitud', x.score_similitud,
                'es_valida', x.es_valida, 'tiene_recorte', x.tiene_recorte,
                'es_viva', x.es_viva, 'puntaje_vida', x.puntaje_vida)                           -- 0238
                ORDER BY x.es_valida DESC, x.score_similitud DESC, x.marca_tiempo, x.id_deteccion)
              FROM (SELECT * FROM l ORDER BY es_valida DESC, score_similitud DESC, marca_tiempo, id_deteccion
                     LIMIT greatest(coalesce(p_max, 10), 0)) x), '[]'::jsonb))
$$;
COMMENT ON FUNCTION app.c1_lecturas_caso(integer, integer, integer) IS
    'Lecturas del alumno en la sesion (validas primero, por score) sin rutas objeto_*, con contadores totales y la marca sospechosa (alguna lectura valida con es_viva = false). INVOKER: aplica la RLS.';
GRANT EXECUTE ON FUNCTION app.c1_lecturas_caso(integer, integer, integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 4) api_detecciones_caso: agrega sospechosa / lecturas_no_vivas y, por lectura, es_viva / puntaje_vida.
-- La regla vive en un solo lugar: la marca sale de app.c1_lecturas_caso (p_max = 0 = solo contadores).
-- Idem 0122 salvo las marcas "-- 0238".
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_detecciones_caso(
    p_id_asistencia integer,
    p_solo_validas  boolean DEFAULT false,
    p_limit         integer DEFAULT 50,
    p_offset        integer DEFAULT 0
) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol   text := app.exigir_rol('docente');
    v_doc   integer := app.id_docente();
    v_lim   integer := app.c1_limite(p_limit, 50, 100);
    v_off   integer := app.c1_desplazamiento(p_offset);
    a       public.asistencia%ROWTYPE;
    s       public.sesion_clase%ROWTYPE;
    al      public.alumno%ROWTYPE;
    v_foto  text;
    v_total bigint;
    v_items jsonb;
    v_vida  jsonb;                                                                            -- 0238
BEGIN
    SELECT a2.* INTO a FROM public.asistencia a2 WHERE a2.id_asistencia = p_id_asistencia;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El caso no existe o no pertenece a tus grupos.');
    END IF;
    SELECT s2.* INTO s FROM public.sesion_clase s2
      JOIN public.grupo g ON g.id_grupo = s2.id_grupo
     WHERE s2.id_sesion = a.id_sesion AND g.id_docente = v_doc;
    IF NOT FOUND THEN
        PERFORM app.fallar('NO_ENCONTRADO', 'El caso no existe o no pertenece a tus grupos.');
    END IF;
    SELECT al2.* INTO al FROM public.alumno al2 WHERE al2.id_alumno = a.id_alumno;
    SELECT pf.objeto_foto INTO v_foto FROM public.plantilla_facial pf WHERE pf.id_alumno = a.id_alumno AND pf.activa;
    v_vida := app.c1_lecturas_caso(a.id_alumno, a.id_sesion, 0);                              -- 0238

    SELECT count(*) INTO v_total
      FROM public.deteccion d
      JOIN public.captura c ON c.id_captura = d.id_captura
      JOIN public.plantilla_facial pf ON pf.id_plantilla = d.id_plantilla
     WHERE c.id_sesion = a.id_sesion AND pf.id_alumno = a.id_alumno AND (NOT coalesce(p_solo_validas, false) OR d.es_valida);

    SELECT coalesce(jsonb_agg(x.item ORDER BY x.es_valida DESC, x.marca_tiempo, x.id_deteccion), '[]'::jsonb) INTO v_items
      FROM (
        SELECT d.id_deteccion, d.es_valida, c.marca_tiempo,
               jsonb_build_object(
                 'id_deteccion', d.id_deteccion,
                 'id_captura', d.id_captura,
                 'marca_tiempo', app.c1_iso(c.marca_tiempo),
                 'minuto_sesion', round(extract(epoch FROM c.marca_tiempo - app.instante_clase(s.fecha, s.hora_inicio)) / 60, 2),
                 'camara_posicion', cam.posicion,
                 'score_similitud', d.score_similitud,
                 'es_valida', d.es_valida,
                 'es_viva', d.es_viva,                                                        -- 0238
                 'puntaje_vida', d.puntaje_vida,                                              -- 0238
                 'tiene_recorte', d.objeto_recorte IS NOT NULL,
                 'objeto_recorte', d.objeto_recorte) AS item
          FROM public.deteccion d
          JOIN public.captura c ON c.id_captura = d.id_captura
          JOIN public.plantilla_facial pf ON pf.id_plantilla = d.id_plantilla
          LEFT JOIN public.camara cam ON cam.id_camara = c.id_camara
         WHERE c.id_sesion = a.id_sesion AND pf.id_alumno = a.id_alumno AND (NOT coalesce(p_solo_validas, false) OR d.es_valida)
         ORDER BY d.es_valida DESC, c.marca_tiempo, d.id_deteccion
         LIMIT v_lim OFFSET v_off
      ) x;

    RETURN jsonb_build_object(
        'id_usuario', app.id_usuario(),
        'vigencia_url_firmada_seg', least(app.param_num('vigencia_url_firmada_seg'), 300)::integer,
        'asistencia', jsonb_build_object('id_asistencia', a.id_asistencia, 'id_sesion', a.id_sesion, 'estado', a.estado,
            'origen', a.origen, 'hora_registro', app.c1_iso(a.hora_registro), 'conteo_detecciones', a.conteo_detecciones),
        'alumno', app.c1_alumno_json(al.id_alumno, al.matricula, al.apellido_paterno, al.apellido_materno, al.nombres),
        'sesion', app.c1_sesion_json(s),
        'objeto_foto_registro', v_foto,
        'sospechosa', v_vida -> 'sospechosa',                                                 -- 0238
        'lecturas_no_vivas', v_vida -> 'lecturas_no_vivas',                                   -- 0238
        'total', v_total,
        'lecturas', v_items);
END
$$;
COMMENT ON FUNCTION public.api_detecciones_caso(integer, boolean, integer, integer) IS $c$Lecturas de un caso (detecciones atribuidas al alumno en la sesion) con rutas de recortes y foto de registro: SOLO para el Route Handler, que debe asentar la consulta (svc_registrar_consulta_revision) antes de firmar URLs de 300 s como maximo.
ARGS: p_id_asistencia integer; p_solo_validas boolean (def. false); p_limit integer (def. 50, max 100); p_offset integer
RETURNS: {id_usuario, vigencia_url_firmada_seg, asistencia, alumno, sesion, objeto_foto_registro, sospechosa, lecturas_no_vivas, total, lecturas:[{id_deteccion, id_captura, marca_tiempo, minuto_sesion, camara_posicion, score_similitud, es_valida, es_viva, puntaje_vida, tiene_recorte, objeto_recorte}]}
sospechosa = alguna lectura valida del caso con es_viva = false (deteccion de vida); es_viva y puntaje_vida son null si la lectura no se evaluo.
ERRORES: NO_AUTORIZADO (no es docente), NO_ENCONTRADO (inexistente o de grupo ajeno)
ROLES: docente titular (via Route Handler)$c$;
REVOKE ALL ON FUNCTION public.api_detecciones_caso(integer, boolean, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_detecciones_caso(integer, boolean, integer, integer) TO authenticated;

-- PostgREST: refresca el esquema (Supabase ya lo hace en cada DDL; cinturon extra).
NOTIFY pgrst, 'reload schema';
