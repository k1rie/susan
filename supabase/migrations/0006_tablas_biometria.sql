-- 0006 · Area C: captura y modulo biometrico (spec Tablas 24-29).
-- RNF-03: ninguna columna binaria ni de arreglo; solo faiss_id (bigint) y rutas objeto_* (varchar).

CREATE TABLE public.consentimiento (
    id_consent        integer GENERATED ALWAYS AS IDENTITY,
    id_alumno         integer NOT NULL,
    fecha_firma       date NOT NULL,
    vigencia_hasta    date NOT NULL,
    objeto_documento  varchar(255) NOT NULL,
    estatus           public.estatus_consentimiento NOT NULL DEFAULT 'vigente',
    CONSTRAINT pk_consentimiento PRIMARY KEY (id_consent),
    CONSTRAINT fk_consentimiento_alumno FOREIGN KEY (id_alumno) REFERENCES public.alumno (id_alumno) ON DELETE RESTRICT,
    CONSTRAINT ck_consentimiento_vigencia CHECK (vigencia_hasta > fecha_firma)
);
COMMENT ON TABLE public.consentimiento IS 'Autorizacion firmada para el tratamiento del dato facial (RN-13).';

CREATE TABLE public.indice_faiss (
    id_indice           integer GENERATED ALWAYS AS IDENTITY,
    version             varchar(12) NOT NULL,
    dimension           smallint NOT NULL,
    objeto_indice       varchar(255) NOT NULL,
    total_vectores      integer NOT NULL,
    fecha_construccion  timestamptz NOT NULL DEFAULT app.now(),
    en_uso              boolean NOT NULL DEFAULT false,
    CONSTRAINT pk_indice_faiss PRIMARY KEY (id_indice),
    CONSTRAINT uq_indice_faiss_version UNIQUE (version),
    CONSTRAINT ck_indice_dimension CHECK (dimension > 0),
    CONSTRAINT ck_indice_total CHECK (total_vectores >= 0)
);
COMMENT ON TABLE public.indice_faiss IS 'Version del indice vectorial guardada en el bucket (JSON). Una sola en_uso (ux_indice_faiss_en_uso).';

CREATE TABLE public.plantilla_facial (
    id_plantilla    integer GENERATED ALWAYS AS IDENTITY,
    id_alumno       integer NOT NULL,
    id_consent      integer NOT NULL,
    id_indice       integer,
    faiss_id        bigint,
    objeto_foto     varchar(255) NOT NULL,
    fecha_registro  timestamptz NOT NULL DEFAULT app.now(),
    activa          boolean NOT NULL DEFAULT true,
    CONSTRAINT pk_plantilla_facial PRIMARY KEY (id_plantilla),
    CONSTRAINT fk_plantilla_alumno FOREIGN KEY (id_alumno) REFERENCES public.alumno (id_alumno) ON DELETE RESTRICT,
    CONSTRAINT fk_plantilla_consent FOREIGN KEY (id_consent) REFERENCES public.consentimiento (id_consent) ON DELETE RESTRICT,
    CONSTRAINT fk_plantilla_indice FOREIGN KEY (id_indice) REFERENCES public.indice_faiss (id_indice) ON DELETE RESTRICT,
    CONSTRAINT uq_plantilla_indice_faiss_id UNIQUE (id_indice, faiss_id),
    CONSTRAINT ck_plantilla_faiss_id CHECK (faiss_id IS NULL OR faiss_id >= 0),
    -- Indice y faiss_id van juntos: ambos nulos hasta la reconstruccion, ambos con valor despues.
    CONSTRAINT ck_plantilla_indexada CHECK ((id_indice IS NULL) = (faiss_id IS NULL))
);
COMMENT ON TABLE public.plantilla_facial IS 'Referencia al vector de un alumno en el indice (RN-12). Trigger: trg_plantilla_rn13.';

-- Extension (spec 4.3): la camara puede ser IP o la webcam del navegador del docente.
-- direccion_ip es obligatoria solo para tipo = 'ip' (UNIQUE admite varios nulos).
CREATE TABLE public.camara (
    id_camara     integer GENERATED ALWAYS AS IDENTITY,
    id_aula       integer NOT NULL,
    posicion      public.posicion_camara NOT NULL,
    tipo          public.tipo_camara NOT NULL DEFAULT 'ip',
    direccion_ip  varchar(45),
    estatus       public.estatus_camara NOT NULL DEFAULT 'activa',
    CONSTRAINT pk_camara PRIMARY KEY (id_camara),
    CONSTRAINT fk_camara_aula FOREIGN KEY (id_aula) REFERENCES public.aula (id_aula) ON DELETE RESTRICT,
    CONSTRAINT uq_camara_direccion_ip UNIQUE (direccion_ip),
    -- Una camara por posicion y, por tanto, a lo sumo dos por aula (RN-06).
    CONSTRAINT uq_camara_aula_posicion UNIQUE (id_aula, posicion),
    CONSTRAINT ck_camara_ip CHECK (tipo <> 'ip' OR direccion_ip IS NOT NULL)
);
COMMENT ON TABLE public.camara IS 'Camara fija (ip) o webcam del navegador (navegador) de un aula; determina el modo de la sesion (RN-06).';

CREATE TABLE public.captura (
    id_captura          bigint GENERATED ALWAYS AS IDENTITY,
    id_camara           integer NOT NULL,
    id_sesion           integer NOT NULL,
    marca_tiempo        timestamptz NOT NULL,
    rostros_detectados  smallint NOT NULL DEFAULT 0,
    CONSTRAINT pk_captura PRIMARY KEY (id_captura),
    CONSTRAINT fk_captura_camara FOREIGN KEY (id_camara) REFERENCES public.camara (id_camara) ON DELETE RESTRICT,
    CONSTRAINT fk_captura_sesion FOREIGN KEY (id_sesion) REFERENCES public.sesion_clase (id_sesion) ON DELETE RESTRICT,
    CONSTRAINT uq_captura_camara_marca UNIQUE (id_camara, marca_tiempo),
    CONSTRAINT ck_captura_rostros CHECK (rostros_detectados >= 0)
);
COMMENT ON TABLE public.captura IS 'Toma de una camara durante una sesion; la imagen completa no se almacena. Trigger: trg_captura_rn06.';

CREATE TABLE public.deteccion (
    id_deteccion     bigint GENERATED ALWAYS AS IDENTITY,
    id_captura       bigint NOT NULL,
    id_plantilla     integer,
    score_similitud  numeric(4,3),
    es_valida        boolean NOT NULL DEFAULT false,
    objeto_recorte   varchar(255),
    CONSTRAINT pk_deteccion PRIMARY KEY (id_deteccion),
    -- Sin cascada: borrar una captura no puede perder sus detecciones (RN-09).
    CONSTRAINT fk_deteccion_captura FOREIGN KEY (id_captura) REFERENCES public.captura (id_captura) ON DELETE RESTRICT,
    CONSTRAINT fk_deteccion_plantilla FOREIGN KEY (id_plantilla) REFERENCES public.plantilla_facial (id_plantilla) ON DELETE RESTRICT,
    CONSTRAINT ck_deteccion_score CHECK (score_similitud IS NULL OR score_similitud BETWEEN 0 AND 1),
    -- Sin candidato no hay score ni lectura valida; todo candidato llega con su score (RN-04).
    CONSTRAINT ck_deteccion_candidato CHECK (
        (id_plantilla IS NULL AND score_similitud IS NULL AND es_valida = false)
        OR (id_plantilla IS NOT NULL AND score_similitud IS NOT NULL)
    )
);
COMMENT ON TABLE public.deteccion IS 'Rostro leido dentro de una captura; guarda el vecino mas cercano aunque no alcance el umbral.';
