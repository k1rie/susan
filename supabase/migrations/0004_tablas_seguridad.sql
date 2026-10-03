-- 0004 · Area D: seguridad y configuracion (spec Tablas 30-32). Se crea antes que las areas B y C
-- porque justificante, bitacora y parametros referencian a usuario.

CREATE TABLE public.usuario (
    id_usuario  integer GENERATED ALWAYS AS IDENTITY,
    auth_uid    uuid NOT NULL,
    correo      varchar(120) NOT NULL,
    rol         public.rol_usuario NOT NULL,
    id_docente  integer,
    id_alumno   integer,
    activo      boolean NOT NULL DEFAULT true,
    CONSTRAINT pk_usuario PRIMARY KEY (id_usuario),
    CONSTRAINT fk_usuario_docente FOREIGN KEY (id_docente) REFERENCES public.docente (id_docente) ON DELETE RESTRICT,
    CONSTRAINT fk_usuario_alumno FOREIGN KEY (id_alumno) REFERENCES public.alumno (id_alumno) ON DELETE RESTRICT,
    CONSTRAINT uq_usuario_auth_uid UNIQUE (auth_uid),
    CONSTRAINT uq_usuario_correo UNIQUE (correo),
    CONSTRAINT uq_usuario_docente UNIQUE (id_docente),
    CONSTRAINT uq_usuario_alumno UNIQUE (id_alumno),
    CONSTRAINT ck_usuario_docente CHECK ((rol = 'docente') = (id_docente IS NOT NULL)),
    CONSTRAINT ck_usuario_alumno CHECK ((rol = 'alumno') = (id_alumno IS NOT NULL))
);
COMMENT ON TABLE public.usuario IS 'Cuenta de acceso vinculada a Supabase Auth (auth_uid); la contrasena nunca se guarda aqui.';

CREATE TABLE public.parametro_sistema (
    clave                varchar(40) NOT NULL,
    valor                varchar(40) NOT NULL,
    descripcion          varchar(200) NOT NULL,
    actualizado_por      integer,
    fecha_actualizacion  timestamptz NOT NULL DEFAULT app.now(),
    CONSTRAINT pk_parametro_sistema PRIMARY KEY (clave),
    CONSTRAINT fk_parametro_usuario FOREIGN KEY (actualizado_por) REFERENCES public.usuario (id_usuario) ON DELETE RESTRICT
);
COMMENT ON TABLE public.parametro_sistema IS 'Parametros configurables del sistema (spec Tabla 4); el valor se guarda en texto.';

CREATE TABLE public.bitacora_auditoria (
    id_bitacora     bigint GENERATED ALWAYS AS IDENTITY,
    id_usuario      integer NOT NULL,
    accion          public.accion_bitacora NOT NULL,
    entidad         varchar(40) NOT NULL,
    id_registro     bigint NOT NULL,
    valor_anterior  jsonb,
    valor_nuevo     jsonb,
    fecha_hora      timestamptz NOT NULL DEFAULT app.now(),
    ip_origen       varchar(45),
    CONSTRAINT pk_bitacora_auditoria PRIMARY KEY (id_bitacora),
    CONSTRAINT fk_bitacora_usuario FOREIGN KEY (id_usuario) REFERENCES public.usuario (id_usuario) ON DELETE RESTRICT,
    -- Las 18 tablas auditables (todas menos la propia bitacora).
    CONSTRAINT ck_bitacora_entidad CHECK (entidad IN (
        'alumno', 'docente', 'materia', 'aula', 'grupo', 'horario_grupo', 'inscripcion',
        'sesion_clase', 'asistencia', 'justificante', 'consentimiento', 'indice_faiss',
        'plantilla_facial', 'camara', 'captura', 'deteccion', 'usuario', 'parametro_sistema'
    )),
    -- RN-08 / RNF-02: corregir o cambiar un parametro exige guardar el antes y el despues.
    CONSTRAINT ck_bitacora_valores CHECK (
        accion NOT IN ('correccion', 'cambio_parametro')
        OR (valor_anterior IS NOT NULL AND valor_nuevo IS NOT NULL)
    )
);
COMMENT ON TABLE public.bitacora_auditoria IS 'Registro de solo insercion de acciones sensibles (RNF-08). Se escribe unicamente con app.bitacora().';
