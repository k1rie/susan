-- 0240 · Laboratorios: el docente solicita el uso y el administrador lo autoriza (extension 20 de docs/DECISIONS.md).
-- Primera entrega: solicitud + autorizacion. La puerta con camara (entradas y salidas) usara las solicitudes aprobadas y vendra despues.
--
-- Decisiones:
--  * Un laboratorio ES un aula (mismo catalogo, capacidad y camaras): `aula.tipo` distingue 'aula' de 'laboratorio'.
--  * Una solicitud cubre UNA fecha, UN laboratorio y UN grupo del docente, de hora_inicio a hora_fin. La decide el administrador.
--  * Dos solicitudes APROBADAS no pueden traslaparse en el mismo laboratorio y fecha: lo garantiza un disparador con candado
--    asesor (no se usa EXCLUDE ... gist para no depender de la extension btree_gist en cada entorno). Las RPC validan antes con
--    su propio codigo (LAB_OCUPADO); el disparador es la red de seguridad ante concurrencia.
--  * Las reglas de plazo son parametros del sistema (RNF-02): lab_anticipacion_horas y lab_horizonte_dias.
--
-- Despliegue: aplicar este SQL y despues 0241. Idempotente en lo que admite (ADD COLUMN/VALUE IF NOT EXISTS).
-- ROLLBACK (solo documentado): DROP TABLE public.solicitud_laboratorio; ALTER TABLE public.aula DROP COLUMN tipo;
--   DROP TYPE public.estatus_solicitud_lab, public.tipo_aula; DELETE FROM public.parametro_sistema WHERE clave LIKE 'lab\_%';
--   restaurar app.parametro_meta desde 0040. Los valores del enum accion_bitacora no se pueden quitar.

-- ---------------------------------------------------------------------------------------------
-- 1) Bitacora: una accion nueva. Solo se usa dentro de cuerpos plpgsql (0241), asi que ADD VALUE en la misma transaccion es valido.
-- ---------------------------------------------------------------------------------------------
ALTER TYPE public.accion_bitacora ADD VALUE IF NOT EXISTS 'solicitud_laboratorio';

-- ---------------------------------------------------------------------------------------------
-- 2) Tipos y marca de laboratorio en el aula. DEFAULT constante: ADD COLUMN solo toca metadatos.
-- ---------------------------------------------------------------------------------------------
CREATE TYPE public.tipo_aula AS ENUM ('aula', 'laboratorio');
CREATE TYPE public.estatus_solicitud_lab AS ENUM ('pendiente', 'aprobada', 'rechazada', 'cancelada');

ALTER TABLE public.aula ADD COLUMN IF NOT EXISTS tipo public.tipo_aula NOT NULL DEFAULT 'aula';
COMMENT ON COLUMN public.aula.tipo IS 'aula (salon de clase) o laboratorio (se usa por solicitud autorizada, extension 20).';

-- ---------------------------------------------------------------------------------------------
-- 3) Solicitud de uso de laboratorio.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE public.solicitud_laboratorio (
    id_solicitud      integer GENERATED ALWAYS AS IDENTITY,
    id_aula           integer NOT NULL,
    id_grupo          integer NOT NULL,
    id_docente        integer NOT NULL,
    fecha             date NOT NULL,
    hora_inicio       time NOT NULL,
    hora_fin          time NOT NULL,
    actividad         varchar(200) NOT NULL,
    estatus           public.estatus_solicitud_lab NOT NULL DEFAULT 'pendiente',
    fecha_solicitud   timestamptz NOT NULL DEFAULT app.now(),
    -- Quien cambio el estatus (administrador al aprobar/rechazar; docente o administrador al cancelar) y cuando.
    resuelto_por      integer,
    fecha_resolucion  timestamptz,
    comentario        varchar(300),
    CONSTRAINT pk_solicitud_laboratorio PRIMARY KEY (id_solicitud),
    CONSTRAINT fk_solicitud_lab_aula FOREIGN KEY (id_aula) REFERENCES public.aula (id_aula) ON DELETE RESTRICT,
    CONSTRAINT fk_solicitud_lab_grupo FOREIGN KEY (id_grupo) REFERENCES public.grupo (id_grupo) ON DELETE RESTRICT,
    CONSTRAINT fk_solicitud_lab_docente FOREIGN KEY (id_docente) REFERENCES public.docente (id_docente) ON DELETE RESTRICT,
    CONSTRAINT fk_solicitud_lab_resuelto FOREIGN KEY (resuelto_por) REFERENCES public.usuario (id_usuario) ON DELETE RESTRICT,
    CONSTRAINT ck_solicitud_lab_horas CHECK (hora_fin > hora_inicio),
    CONSTRAINT ck_solicitud_lab_actividad CHECK (length(btrim(actividad)) >= 3),
    CONSTRAINT ck_solicitud_lab_resolucion CHECK (
        (estatus = 'pendiente') = (resuelto_por IS NULL AND fecha_resolucion IS NULL)
    ),
    CONSTRAINT ck_solicitud_lab_fechas CHECK (fecha_resolucion IS NULL OR fecha_resolucion >= fecha_solicitud)
);
COMMENT ON TABLE public.solicitud_laboratorio IS
    'Solicitud del docente para usar un laboratorio con un grupo en una fecha y horario; la autoriza el administrador (extension 20).';

CREATE INDEX ix_solicitud_lab_aula_fecha ON public.solicitud_laboratorio (id_aula, fecha) WHERE estatus IN ('pendiente', 'aprobada');
CREATE INDEX ix_solicitud_lab_docente ON public.solicitud_laboratorio (id_docente, fecha DESC);
CREATE INDEX ix_solicitud_lab_grupo ON public.solicitud_laboratorio (id_grupo, fecha) WHERE estatus IN ('pendiente', 'aprobada');
CREATE INDEX ix_solicitud_lab_pendientes ON public.solicitud_laboratorio (fecha, hora_inicio) WHERE estatus = 'pendiente';

-- ---------------------------------------------------------------------------------------------
-- 3b) La bitacora solo admite las entidades de su CHECK: se agrega la nueva tabla auditable (de 18 a 19). La lista es la
-- de 0004 mas solicitud_laboratorio; ALTER solo valida las filas existentes, que ya cumplen la lista anterior.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.bitacora_auditoria DROP CONSTRAINT ck_bitacora_entidad;
ALTER TABLE public.bitacora_auditoria ADD CONSTRAINT ck_bitacora_entidad CHECK (entidad IN (
    'alumno', 'docente', 'materia', 'aula', 'grupo', 'horario_grupo', 'inscripcion',
    'sesion_clase', 'asistencia', 'justificante', 'consentimiento', 'indice_faiss',
    'plantilla_facial', 'camara', 'captura', 'deteccion', 'usuario', 'parametro_sistema',
    'solicitud_laboratorio'
));

-- ---------------------------------------------------------------------------------------------
-- 4) Disparador lab01: dos solicitudes APROBADAS no se traslapan en el mismo laboratorio y fecha.
-- El candado asesor serializa a quienes aprueban en el mismo laboratorio (la comprobacion y el cambio de estatus
-- no se pisan). Mismo formato de rechazo que los demas disparadores: 23514 + CONSTRAINT = <regla>.
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION app.trg_solicitud_lab_traslape() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
BEGIN
    IF NEW.estatus <> 'aprobada' THEN
        RETURN NEW;
    END IF;
    PERFORM pg_advisory_xact_lock(240, NEW.id_aula);
    IF EXISTS (
        SELECT 1 FROM public.solicitud_laboratorio s
         WHERE s.id_aula = NEW.id_aula AND s.fecha = NEW.fecha AND s.estatus = 'aprobada'
           AND s.id_solicitud IS DISTINCT FROM NEW.id_solicitud
           AND s.hora_inicio < NEW.hora_fin AND s.hora_fin > NEW.hora_inicio
    ) THEN
        PERFORM app.rechazar_regla('lab01_solicitud_traslape',
            'el laboratorio ya tiene otra solicitud aprobada que se traslapa en esa fecha y horario');
    END IF;
    RETURN NEW;
END
$$;
CREATE TRIGGER trg_solicitud_lab_traslape
    BEFORE INSERT OR UPDATE OF estatus, id_aula, fecha, hora_inicio, hora_fin ON public.solicitud_laboratorio
    FOR EACH ROW EXECUTE FUNCTION app.trg_solicitud_lab_traslape();

-- ---------------------------------------------------------------------------------------------
-- 5) RLS y permisos. La tabla nace despues de 0030 y en local los stubs dan GRANT ALL por defecto: se revoca explicito.
-- Sin escritura directa: todo cambio pasa por las RPC DEFINER de 0241.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.solicitud_laboratorio ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.solicitud_laboratorio FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.solicitud_laboratorio_id_solicitud_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.solicitud_laboratorio TO authenticated;
GRANT ALL ON public.solicitud_laboratorio TO service_role;
GRANT ALL ON SEQUENCE public.solicitud_laboratorio_id_solicitud_seq TO service_role;

CREATE POLICY admin_ve_todo ON public.solicitud_laboratorio FOR SELECT TO authenticated
    USING ((SELECT app.es_admin()));
CREATE POLICY docente_ve_las_suyas ON public.solicitud_laboratorio FOR SELECT TO authenticated
    USING ((SELECT app.rol()) = 'docente' AND id_docente = (SELECT app.id_docente()));

-- ---------------------------------------------------------------------------------------------
-- 6) Parametros del sistema 13 y 14 (extension, como minutos_pase_lista_base). La vista conserva las columnas de 0040.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW app.parametro_meta AS
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
    (12, 'minutos_pase_lista_base',   'entero',  '1',     '60',    'minutos'),
    (13, 'lab_anticipacion_horas',    'entero',  '0',     '720',   'horas'),
    (14, 'lab_horizonte_dias',        'entero',  '1',     '365',   'dias')
  ) AS m(orden, clave, tipo, minimo, maximo, unidad);

INSERT INTO public.parametro_sistema (clave, valor, descripcion) VALUES
    ('lab_anticipacion_horas', '24', 'Horas de anticipación mínima para solicitar un laboratorio (extensión 20)'),
    ('lab_horizonte_dias',     '60', 'Días hacia adelante en que se puede solicitar un laboratorio (extensión 20)')
ON CONFLICT (clave) DO NOTHING;
