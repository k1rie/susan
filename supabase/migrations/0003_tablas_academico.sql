-- 0003 · Area A: catalogo academico (spec Tablas 14-20).
-- Convenciones: pk_ fk_ uq_ ck_ ux_ trg_. Todas las FK usan ON DELETE RESTRICT salvo
-- horario_grupo -> grupo (CASCADE: el horario es parte de la definicion del grupo, no evidencia).

CREATE TABLE public.alumno (
    id_alumno             integer GENERATED ALWAYS AS IDENTITY,
    matricula             varchar(10) NOT NULL,
    apellido_paterno      varchar(40) NOT NULL,
    apellido_materno      varchar(40),
    nombres               varchar(60) NOT NULL,
    correo_institucional  varchar(120) NOT NULL,
    estatus               public.estatus_alumno NOT NULL DEFAULT 'activo',
    CONSTRAINT pk_alumno PRIMARY KEY (id_alumno),
    CONSTRAINT uq_alumno_matricula UNIQUE (matricula),
    CONSTRAINT uq_alumno_correo UNIQUE (correo_institucional),
    CONSTRAINT ck_alumno_correo CHECK (position('@' IN correo_institucional) > 0)
);
COMMENT ON TABLE public.alumno IS 'Persona cuya asistencia se registra.';

CREATE TABLE public.docente (
    id_docente            integer GENERATED ALWAYS AS IDENTITY,
    num_empleado          varchar(10) NOT NULL,
    apellido_paterno      varchar(40) NOT NULL,
    apellido_materno      varchar(40),
    nombres               varchar(60) NOT NULL,
    correo_institucional  varchar(120) NOT NULL,
    estatus               public.estatus_docente NOT NULL DEFAULT 'activo',
    CONSTRAINT pk_docente PRIMARY KEY (id_docente),
    CONSTRAINT uq_docente_num_empleado UNIQUE (num_empleado),
    CONSTRAINT uq_docente_correo UNIQUE (correo_institucional),
    CONSTRAINT ck_docente_correo CHECK (position('@' IN correo_institucional) > 0)
);
COMMENT ON TABLE public.docente IS 'Responsable del grupo y de las correcciones.';

CREATE TABLE public.materia (
    id_materia    integer GENERATED ALWAYS AS IDENTITY,
    clave         varchar(8) NOT NULL,
    nombre        varchar(80) NOT NULL,
    creditos      smallint NOT NULL,
    horas_semana  smallint NOT NULL,
    CONSTRAINT pk_materia PRIMARY KEY (id_materia),
    CONSTRAINT uq_materia_clave UNIQUE (clave),
    CONSTRAINT ck_materia_creditos CHECK (creditos > 0),
    CONSTRAINT ck_materia_horas CHECK (horas_semana BETWEEN 1 AND 20)
);
COMMENT ON TABLE public.materia IS 'Asignatura del plan de estudios.';

CREATE TABLE public.aula (
    id_aula    integer GENERATED ALWAYS AS IDENTITY,
    clave      varchar(10) NOT NULL,
    edificio   varchar(40) NOT NULL,
    capacidad  smallint NOT NULL,
    CONSTRAINT pk_aula PRIMARY KEY (id_aula),
    CONSTRAINT uq_aula_clave UNIQUE (clave),
    CONSTRAINT ck_aula_capacidad CHECK (capacidad > 0)
);
COMMENT ON TABLE public.aula IS 'Espacio fisico donde se imparte el grupo y se instalan las camaras.';

CREATE TABLE public.grupo (
    id_grupo     integer GENERATED ALWAYS AS IDENTITY,
    id_materia   integer NOT NULL,
    id_docente   integer NOT NULL,
    id_aula      integer NOT NULL,
    clave_grupo  varchar(8) NOT NULL,
    periodo      varchar(10) NOT NULL,
    CONSTRAINT pk_grupo PRIMARY KEY (id_grupo),
    CONSTRAINT fk_grupo_materia FOREIGN KEY (id_materia) REFERENCES public.materia (id_materia) ON DELETE RESTRICT,
    CONSTRAINT fk_grupo_docente FOREIGN KEY (id_docente) REFERENCES public.docente (id_docente) ON DELETE RESTRICT,
    CONSTRAINT fk_grupo_aula FOREIGN KEY (id_aula) REFERENCES public.aula (id_aula) ON DELETE RESTRICT,
    CONSTRAINT uq_grupo_materia_clave_periodo UNIQUE (id_materia, clave_grupo, periodo),
    CONSTRAINT ck_grupo_periodo CHECK (periodo ~ '^[0-9]{4}-[12]$')
);
COMMENT ON TABLE public.grupo IS 'Materia impartida por un docente en un periodo y un aula.';

CREATE TABLE public.horario_grupo (
    id_horario   integer GENERATED ALWAYS AS IDENTITY,
    id_grupo     integer NOT NULL,
    dia_semana   smallint NOT NULL,
    hora_inicio  time NOT NULL,
    hora_fin     time NOT NULL,
    CONSTRAINT pk_horario_grupo PRIMARY KEY (id_horario),
    CONSTRAINT fk_horario_grupo FOREIGN KEY (id_grupo) REFERENCES public.grupo (id_grupo) ON DELETE CASCADE,
    CONSTRAINT uq_horario_grupo_dia_hora UNIQUE (id_grupo, dia_semana, hora_inicio),
    CONSTRAINT ck_horario_dia CHECK (dia_semana BETWEEN 1 AND 6),
    CONSTRAINT ck_horario_horas CHECK (hora_fin > hora_inicio)
);
COMMENT ON TABLE public.horario_grupo IS 'Bloque semanal del horario de un grupo; de el se generan las sesiones programadas (RN-06).';

CREATE TABLE public.inscripcion (
    id_inscripcion  integer GENERATED ALWAYS AS IDENTITY,
    id_alumno       integer NOT NULL,
    id_grupo        integer NOT NULL,
    fecha_alta      date NOT NULL DEFAULT app.hoy(),
    estatus         public.estatus_inscripcion NOT NULL DEFAULT 'activa',
    derecho_examen  boolean NOT NULL DEFAULT true,
    CONSTRAINT pk_inscripcion PRIMARY KEY (id_inscripcion),
    CONSTRAINT fk_inscripcion_alumno FOREIGN KEY (id_alumno) REFERENCES public.alumno (id_alumno) ON DELETE RESTRICT,
    CONSTRAINT fk_inscripcion_grupo FOREIGN KEY (id_grupo) REFERENCES public.grupo (id_grupo) ON DELETE RESTRICT,
    CONSTRAINT uq_inscripcion_alumno_grupo UNIQUE (id_alumno, id_grupo)
);
COMMENT ON TABLE public.inscripcion IS 'Vinculo alumno-grupo; solo una inscripcion activa habilita la asistencia (RN-01).';
