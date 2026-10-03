-- 0040 · Parametros del sistema (spec Tabla 4, RNF-02) y cuenta de servicio.

-- Metadatos y validacion de cada parametro. Es la unica definicion de tipos y rangos: la usan
-- app.validar_parametro() (y por tanto api_parametro_actualizar) y la pantalla del tecnico.
CREATE VIEW app.parametro_meta AS
SELECT orden, clave, tipo, minimo, maximo, unidad
  FROM (VALUES
    (1,  'umbral_similitud',          'decimal', '0.500', '0.999', 'score'),
    (2,  'min_detecciones_validas',   'entero',  '1',     '10',    'lecturas'),
    (3,  'limite_presente_min',       'entero',  '1',     '59',    'minutos'),
    (4,  'tolerancia_min',            'entero',  '2',     '120',   'minutos'),
    (5,  'intervalo_muestreo_seg',    'entero',  '5',     '120',   'segundos'),
    (6,  'horas_limite_correccion',   'entero',  '1',     '720',   'horas'),
    (7,  'retardos_por_ausencia',     'entero',  '1',     '10',    'retardos'),
    (8,  'porcentaje_max_ausencias',  'entero',  '1',     '100',   'porcentaje'),
    (9,  'dias_retencion_recortes',   'entero',  '1',     '90',    'dias'),
    (10, 'vigencia_url_firmada_seg',  'entero',  '30',    '300',   'segundos'),
    (11, 'dimension_vector',          'entero',  '64',    '2048',  'dimensiones'),
    (12, 'minutos_pase_lista_base',   'entero',  '1',     '60',    'minutos')
  ) AS m(orden, clave, tipo, minimo, maximo, unidad);
COMMENT ON VIEW app.parametro_meta IS 'Tipo, rango y unidad de cada parametro_sistema, en el orden de la Tabla 4.';
GRANT SELECT ON app.parametro_meta TO authenticated, service_role;

-- Devuelve el valor canonico (texto) o lanza PARAMETRO_VALOR_INVALIDO / PARAMETRO_NO_ENCONTRADO.
-- Coherencia cruzada: limite_presente_min < tolerancia_min (ck_sesion_ventana de las sesiones nuevas).
CREATE FUNCTION app.validar_parametro(p_clave text, p_valor text) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    m          record;
    v_txt      text := btrim(coalesce(p_valor, ''));
    v_num      numeric;
    v_otro     numeric;
BEGIN
    SELECT * INTO m FROM app.parametro_meta WHERE clave = p_clave;
    IF NOT FOUND THEN
        PERFORM app.fallar('PARAMETRO_NO_ENCONTRADO', 'El parámetro no existe.');
    END IF;

    IF m.tipo = 'entero' THEN
        IF v_txt !~ '^[0-9]{1,9}$' THEN
            PERFORM app.fallar('PARAMETRO_VALOR_INVALIDO',
                format('%s debe ser un entero entre %s y %s.', p_clave, m.minimo, m.maximo));
        END IF;
        v_num := v_txt::numeric;
    ELSE
        IF v_txt !~ '^[0-9]{1,3}(\.[0-9]{1,3})?$' THEN
            PERFORM app.fallar('PARAMETRO_VALOR_INVALIDO',
                format('%s debe ser un decimal entre %s y %s con hasta 3 decimales.', p_clave, m.minimo, m.maximo));
        END IF;
        v_num := v_txt::numeric;
    END IF;

    IF v_num < m.minimo::numeric OR v_num > m.maximo::numeric THEN
        PERFORM app.fallar('PARAMETRO_VALOR_INVALIDO',
            format('%s debe estar entre %s y %s.', p_clave, m.minimo, m.maximo));
    END IF;

    IF p_clave = 'limite_presente_min' THEN
        v_otro := app.param_num('tolerancia_min');
        IF v_num >= v_otro THEN
            PERFORM app.fallar('PARAMETRO_VALOR_INVALIDO',
                format('limite_presente_min debe ser menor que tolerancia_min (%s).', v_otro));
        END IF;
    ELSIF p_clave = 'tolerancia_min' THEN
        v_otro := app.param_num('limite_presente_min');
        IF v_num <= v_otro THEN
            PERFORM app.fallar('PARAMETRO_VALOR_INVALIDO',
                format('tolerancia_min debe ser mayor que limite_presente_min (%s).', v_otro));
        END IF;
    END IF;

    IF m.tipo = 'decimal' THEN
        RETURN to_char(v_num, 'FM0.000');
    END IF;
    RETURN v_num::bigint::text;
END
$$;
COMMENT ON FUNCTION app.validar_parametro(text, text) IS 'Valida y normaliza el valor de un parametro (tipo, rango, coherencia); devuelve el canonico.';
GRANT EXECUTE ON FUNCTION app.validar_parametro(text, text) TO service_role;

-- Los 12 valores iniciales. Dejan actualizado_por nulo ("valores iniciales").
INSERT INTO public.parametro_sistema (clave, valor, descripcion) VALUES
    ('umbral_similitud',         '0.850', 'Score mínimo para atribuir una detección (RN-04, RF-05)'),
    ('min_detecciones_validas',  '3',     'Detecciones válidas que confirman la asistencia (RN-05, RF-07)'),
    ('limite_presente_min',      '10',    'Minutos desde el inicio para registrar presente (RN-03, RF-08)'),
    ('tolerancia_min',           '20',    'Fin del retardo y del muestreo, en minutos (RN-03, RF-03, RF-08)'),
    ('intervalo_muestreo_seg',   '15',    'Segundos entre capturas de cada cámara (calibración, RF-03)'),
    ('horas_limite_correccion',  '48',    'Plazo del docente para corregir, en horas desde el fin de la sesión (RN-08, RF-11)'),
    ('retardos_por_ausencia',    '3',     'Retardos que equivalen a una ausencia (RN-10, RF-13)'),
    ('porcentaje_max_ausencias', '20',    'Porcentaje de faltas cuyo exceso retira el derecho a examen (RN-11, RF-14)'),
    ('dias_retencion_recortes',  '7',     'Días de retención de los recortes de rostro (RNF-05)'),
    ('vigencia_url_firmada_seg', '300',   'Vigencia máxima de una URL firmada, en segundos (RNF-04)'),
    ('dimension_vector',         '512',   'Dimensión de los vectores del índice FAISS (RF-04)'),
    ('minutos_pase_lista_base',  '5',     'Minutos de pase de lista tradicional, solo para estimar el tiempo de clase recuperado');

-- Cuenta de servicio del programador de tareas (rol tecnico). auth_uid fijo y SIN fila en
-- auth.users: no se puede iniciar sesion con ella; solo app.asumir_cuenta_servicio() la usa.
INSERT INTO public.usuario (auth_uid, correo, rol, activo)
VALUES ('00000000-0000-4000-8000-000000000001', 'servicio@susan.local', 'tecnico', true);
