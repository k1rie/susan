-- 0242 · Intervalo de muestreo desde 1 s (antes 5 s).
--
-- Con 5 s entre capturas, más ~1.5 s de envío y reconocimiento, un alumno tardaba ~20 s en juntar las 3 detecciones que confirman
-- su asistencia (min_detecciones_validas). El cliente espera a que termine cada captura antes de programar la siguiente
-- (useMuestreoSesion), así que con 1 s el ritmo real queda en ~2.5 s por captura sin encimar peticiones; el limitador del servidor
-- (lib/server/captura.js) admite una solicitud por cámara cada intervalo/2 s. Solo cambia el rango: el valor sigue siendo el que
-- fije el técnico en /tecnico, y las sesiones ya programadas conservan el intervalo que copiaron al generarse.

ALTER TABLE public.sesion_clase DROP CONSTRAINT ck_sesion_intervalo;
ALTER TABLE public.sesion_clase ADD CONSTRAINT ck_sesion_intervalo CHECK (intervalo_muestreo_seg BETWEEN 1 AND 120);

CREATE OR REPLACE VIEW app.parametro_meta AS
SELECT orden, clave, tipo, minimo, maximo, unidad
  FROM (VALUES
    (1,  'umbral_similitud',          'decimal', '0.500', '0.999', 'score'),
    (2,  'min_detecciones_validas',   'entero',  '1',     '10',    'lecturas'),
    (3,  'limite_presente_min',       'entero',  '1',     '59',    'minutos'),
    (4,  'tolerancia_min',            'entero',  '2',     '120',   'minutos'),
    (5,  'intervalo_muestreo_seg',    'entero',  '1',     '120',   'segundos'),
    (6,  'horas_limite_correccion',   'entero',  '1',     '720',   'horas'),
    (7,  'retardos_por_ausencia',     'entero',  '1',     '10',    'retardos'),
    (8,  'porcentaje_max_ausencias',  'entero',  '1',     '100',   'porcentaje'),
    (9,  'dias_retencion_recortes',   'entero',  '1',     '90',    'dias'),
    (10, 'vigencia_url_firmada_seg',  'entero',  '30',    '300',   'segundos'),
    (11, 'dimension_vector',          'entero',  '64',    '2048',  'dimensiones'),
    (12, 'minutos_pase_lista_base',   'entero',  '1',     '60',    'minutos')
  ) AS m(orden, clave, tipo, minimo, maximo, unidad);
