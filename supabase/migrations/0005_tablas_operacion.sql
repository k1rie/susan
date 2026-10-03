-- 0005 · Area B: operacion de la clase (spec Tablas 21-23).

CREATE TABLE public.sesion_clase (
    id_sesion               integer GENERATED ALWAYS AS IDENTITY,
    id_grupo                integer NOT NULL,
    fecha                   date NOT NULL,
    hora_inicio             time NOT NULL,
    hora_fin                time NOT NULL,
    -- Se copian de parametro_sistema al programar la sesion: un ajuste posterior no altera las ya registradas.
    tolerancia_min          smallint NOT NULL DEFAULT 20,
    limite_presente_min     smallint NOT NULL DEFAULT 10,
    intervalo_muestreo_seg  smallint NOT NULL DEFAULT 15,
    modo_registro           public.modo_registro_sesion NOT NULL DEFAULT 'automatico',
    estatus                 public.estatus_sesion NOT NULL DEFAULT 'programada',
    CONSTRAINT pk_sesion_clase PRIMARY KEY (id_sesion),
    CONSTRAINT fk_sesion_grupo FOREIGN KEY (id_grupo) REFERENCES public.grupo (id_grupo) ON DELETE RESTRICT,
    CONSTRAINT uq_sesion_grupo_fecha_hora UNIQUE (id_grupo, fecha, hora_inicio),
    CONSTRAINT ck_sesion_horas CHECK (hora_fin > hora_inicio),
    CONSTRAINT ck_sesion_ventana CHECK (limite_presente_min > 0 AND limite_presente_min < tolerancia_min),
    CONSTRAINT ck_sesion_intervalo CHECK (intervalo_muestreo_seg BETWEEN 5 AND 120)
);
COMMENT ON TABLE public.sesion_clase IS 'Ocurrencia concreta de una clase; las programadas son la base del porcentaje de faltas (RN-11).';

CREATE TABLE public.asistencia (
    id_asistencia       integer GENERATED ALWAYS AS IDENTITY,
    id_sesion           integer NOT NULL,
    id_alumno           integer NOT NULL,
    estado              public.estado_asistencia NOT NULL,
    hora_registro       timestamptz,
    origen              public.origen_asistencia NOT NULL,
    conteo_detecciones  smallint NOT NULL DEFAULT 0,
    CONSTRAINT pk_asistencia PRIMARY KEY (id_asistencia),
    CONSTRAINT fk_asistencia_sesion FOREIGN KEY (id_sesion) REFERENCES public.sesion_clase (id_sesion) ON DELETE RESTRICT,
    CONSTRAINT fk_asistencia_alumno FOREIGN KEY (id_alumno) REFERENCES public.alumno (id_alumno) ON DELETE RESTRICT,
    -- RN-02: un solo registro por alumno y sesion, sin importar cuantas detecciones haya.
    CONSTRAINT uq_asistencia_sesion_alumno UNIQUE (id_sesion, id_alumno),
    CONSTRAINT ck_asistencia_conteo CHECK (conteo_detecciones >= 0),
    CONSTRAINT ck_asistencia_ausente_sin_hora CHECK (estado <> 'ausente' OR hora_registro IS NULL),
    -- Un pendiente es automatico, tiene hora y al menos una lectura (RN-05).
    CONSTRAINT ck_asistencia_pendiente CHECK (
        estado <> 'pendiente'
        OR (origen = 'automatico' AND hora_registro IS NOT NULL AND conteo_detecciones > 0)
    ),
    -- La hora decide el estado (RN-03); solo una correccion puede dejar presente/retardo sin hora.
    CONSTRAINT ck_asistencia_hora_presencia CHECK (
        estado NOT IN ('presente', 'retardo') OR origen = 'correccion' OR hora_registro IS NOT NULL
    )
);
COMMENT ON TABLE public.asistencia IS 'Resultado unico de un alumno en una sesion. Triggers: trg_asistencia_rn01, trg_asistencia_ciclo.';

CREATE TABLE public.justificante (
    id_justificante   integer GENERATED ALWAYS AS IDENTITY,
    id_sesion         integer NOT NULL,
    id_alumno         integer NOT NULL,
    motivo            varchar(200) NOT NULL,
    objeto_documento  varchar(255) NOT NULL,
    estatus           public.estatus_justificante NOT NULL DEFAULT 'pendiente',
    registrado_por    integer NOT NULL,
    resuelto_por      integer,
    fecha_registro    timestamptz NOT NULL DEFAULT app.now(),
    fecha_resolucion  timestamptz,
    CONSTRAINT pk_justificante PRIMARY KEY (id_justificante),
    -- RN-09: solo se justifica un registro de asistencia que existe, y no se borra uno justificado.
    CONSTRAINT fk_justificante_asistencia FOREIGN KEY (id_sesion, id_alumno)
        REFERENCES public.asistencia (id_sesion, id_alumno) ON DELETE RESTRICT,
    CONSTRAINT fk_justificante_registrado FOREIGN KEY (registrado_por) REFERENCES public.usuario (id_usuario) ON DELETE RESTRICT,
    CONSTRAINT fk_justificante_resuelto FOREIGN KEY (resuelto_por) REFERENCES public.usuario (id_usuario) ON DELETE RESTRICT,
    CONSTRAINT ck_justificante_resolucion CHECK (
        (estatus = 'pendiente') = (resuelto_por IS NULL AND fecha_resolucion IS NULL)
    ),
    CONSTRAINT ck_justificante_fechas CHECK (fecha_resolucion IS NULL OR fecha_resolucion >= fecha_registro)
);
COMMENT ON TABLE public.justificante IS 'Soporte documental de una falta o un retardo.';
