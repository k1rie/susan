-- ============================================================================================
-- SUSAN · Anexo: DDL completo de las tablas (esquemas public y app)
-- Generado con:  pg_dump -Fc --schema-only -n public -n app susan  y  pg_restore -L <lista filtrada>
--                --no-owner --no-privileges   (script generar-anexo.mjs). Base: PostgreSQL 16, 43 migraciones.
-- Se conservan: tipos ENUM, tablas, la vista v_resumen_asistencia, PK/UNIQUE/FK (ALTER TABLE), indices,
-- disparadores, RLS y politicas. Las llaves GENERATED ALWAYS AS IDENTITY aparecen como ALTER ... ADD GENERATED.
-- Se omiten: funciones (estan en supabase/migrations), privilegios, propietarios y comentarios.
-- Los CHECK van dentro de CREATE TABLE, como los emite pg_dump. No es un script autonomo: los DEFAULT
-- y los disparadores usan funciones del esquema app que crean las migraciones.
-- ============================================================================================

CREATE TYPE public.accion_bitacora AS ENUM (
    'consulta',
    'correccion',
    'aprobacion_justificante',
    'rechazo_justificante',
    'alta_plantilla',
    'cambio_parametro',
    'cierre_sesion',
    'notificacion',
    'alta_consentimiento',
    'revocacion_consentimiento'
);

CREATE TYPE public.estado_asistencia AS ENUM (
    'presente',
    'retardo',
    'ausente',
    'pendiente',
    'justificado'
);

CREATE TYPE public.estatus_alumno AS ENUM (
    'activo',
    'baja_temporal',
    'baja_definitiva',
    'egresado'
);

CREATE TYPE public.estatus_camara AS ENUM (
    'activa',
    'inactiva',
    'mantenimiento'
);

CREATE TYPE public.estatus_consentimiento AS ENUM (
    'vigente',
    'revocado',
    'vencido'
);

CREATE TYPE public.estatus_docente AS ENUM (
    'activo',
    'licencia',
    'baja'
);

CREATE TYPE public.estatus_inscripcion AS ENUM (
    'activa',
    'baja'
);

CREATE TYPE public.estatus_justificante AS ENUM (
    'pendiente',
    'aprobado',
    'rechazado'
);

CREATE TYPE public.estatus_sesion AS ENUM (
    'programada',
    'abierta',
    'cerrada',
    'suspendida'
);

CREATE TYPE public.modo_registro_sesion AS ENUM (
    'automatico',
    'manual'
);

CREATE TYPE public.origen_asistencia AS ENUM (
    'automatico',
    'manual',
    'correccion'
);

CREATE TYPE public.posicion_camara AS ENUM (
    'frente',
    'fondo'
);

CREATE TYPE public.rol_usuario AS ENUM (
    'administrador',
    'docente',
    'alumno',
    'tecnico'
);

CREATE TYPE public.tipo_camara AS ENUM (
    'ip',
    'navegador'
);

CREATE TABLE public.alumno (
    id_alumno integer NOT NULL,
    matricula character varying(10) NOT NULL,
    apellido_paterno character varying(40) NOT NULL,
    apellido_materno character varying(40),
    nombres character varying(60) NOT NULL,
    correo_institucional character varying(120) NOT NULL,
    estatus public.estatus_alumno DEFAULT 'activo'::public.estatus_alumno NOT NULL,
    CONSTRAINT ck_alumno_correo CHECK ((POSITION(('@'::text) IN (correo_institucional)) > 0))
);

CREATE TABLE public.aula (
    id_aula integer NOT NULL,
    clave character varying(10) NOT NULL,
    edificio character varying(40) NOT NULL,
    capacidad smallint NOT NULL,
    CONSTRAINT ck_aula_capacidad CHECK ((capacidad > 0))
);

CREATE TABLE public.camara (
    id_camara integer NOT NULL,
    id_aula integer NOT NULL,
    posicion public.posicion_camara NOT NULL,
    tipo public.tipo_camara DEFAULT 'ip'::public.tipo_camara NOT NULL,
    direccion_ip character varying(45),
    estatus public.estatus_camara DEFAULT 'activa'::public.estatus_camara NOT NULL,
    CONSTRAINT ck_camara_ip CHECK (((tipo <> 'ip'::public.tipo_camara) OR (direccion_ip IS NOT NULL)))
);

CREATE TABLE public.docente (
    id_docente integer NOT NULL,
    num_empleado character varying(10) NOT NULL,
    apellido_paterno character varying(40) NOT NULL,
    apellido_materno character varying(40),
    nombres character varying(60) NOT NULL,
    correo_institucional character varying(120) NOT NULL,
    estatus public.estatus_docente DEFAULT 'activo'::public.estatus_docente NOT NULL,
    CONSTRAINT ck_docente_correo CHECK ((POSITION(('@'::text) IN (correo_institucional)) > 0))
);

CREATE TABLE public.materia (
    id_materia integer NOT NULL,
    clave character varying(8) NOT NULL,
    nombre character varying(80) NOT NULL,
    creditos smallint NOT NULL,
    horas_semana smallint NOT NULL,
    CONSTRAINT ck_materia_creditos CHECK ((creditos > 0)),
    CONSTRAINT ck_materia_horas CHECK (((horas_semana >= 1) AND (horas_semana <= 20)))
);

CREATE TABLE public.grupo (
    id_grupo integer NOT NULL,
    id_materia integer NOT NULL,
    id_docente integer NOT NULL,
    id_aula integer NOT NULL,
    clave_grupo character varying(8) NOT NULL,
    periodo character varying(10) NOT NULL,
    CONSTRAINT ck_grupo_periodo CHECK (((periodo)::text ~ '^[0-9]{4}-[12]$'::text))
);

CREATE TABLE public.asistencia (
    id_asistencia integer NOT NULL,
    id_sesion integer NOT NULL,
    id_alumno integer NOT NULL,
    estado public.estado_asistencia NOT NULL,
    hora_registro timestamp with time zone,
    origen public.origen_asistencia NOT NULL,
    conteo_detecciones smallint DEFAULT 0 NOT NULL,
    CONSTRAINT ck_asistencia_ausente_sin_hora CHECK (((estado <> 'ausente'::public.estado_asistencia) OR (hora_registro IS NULL))),
    CONSTRAINT ck_asistencia_conteo CHECK ((conteo_detecciones >= 0)),
    CONSTRAINT ck_asistencia_hora_presencia CHECK (((estado <> ALL (ARRAY['presente'::public.estado_asistencia, 'retardo'::public.estado_asistencia])) OR (origen = 'correccion'::public.origen_asistencia) OR (hora_registro IS NOT NULL))),
    CONSTRAINT ck_asistencia_pendiente CHECK (((estado <> 'pendiente'::public.estado_asistencia) OR ((origen = 'automatico'::public.origen_asistencia) AND (hora_registro IS NOT NULL) AND (conteo_detecciones > 0))))
);

CREATE TABLE public.inscripcion (
    id_inscripcion integer NOT NULL,
    id_alumno integer NOT NULL,
    id_grupo integer NOT NULL,
    fecha_alta date DEFAULT app.hoy() NOT NULL,
    estatus public.estatus_inscripcion DEFAULT 'activa'::public.estatus_inscripcion NOT NULL,
    derecho_examen boolean DEFAULT true NOT NULL
);

CREATE TABLE public.sesion_clase (
    id_sesion integer NOT NULL,
    id_grupo integer NOT NULL,
    fecha date NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fin time without time zone NOT NULL,
    tolerancia_min smallint DEFAULT 20 NOT NULL,
    limite_presente_min smallint DEFAULT 10 NOT NULL,
    intervalo_muestreo_seg smallint DEFAULT 15 NOT NULL,
    modo_registro public.modo_registro_sesion DEFAULT 'automatico'::public.modo_registro_sesion NOT NULL,
    estatus public.estatus_sesion DEFAULT 'programada'::public.estatus_sesion NOT NULL,
    CONSTRAINT ck_sesion_horas CHECK ((hora_fin > hora_inicio)),
    CONSTRAINT ck_sesion_intervalo CHECK (((intervalo_muestreo_seg >= 5) AND (intervalo_muestreo_seg <= 120))),
    CONSTRAINT ck_sesion_ventana CHECK (((limite_presente_min > 0) AND (limite_presente_min < tolerancia_min)))
);

CREATE VIEW public.v_resumen_asistencia WITH (security_invoker='true') AS
 SELECT id_inscripcion,
    id_alumno,
    id_grupo,
    estatus_inscripcion,
    derecho_examen,
    sesiones_programadas,
    presentes,
    retardos,
    ausencias,
    justificadas,
    pendientes,
    faltas_equivalentes,
        CASE
            WHEN (sesiones_programadas > 0) THEN round(((100.0 * (faltas_equivalentes)::numeric) / (sesiones_programadas)::numeric), 2)
            ELSE NULL::numeric
        END AS porcentaje_faltas,
        CASE
            WHEN (sesiones_programadas > 0) THEN round(((100.0 * (faltas_equivalentes)::numeric) / (sesiones_programadas)::numeric), 2)
            ELSE NULL::numeric
        END AS porcentaje,
    limite_pct,
    (((faltas_equivalentes * 100))::numeric > (limite_pct * (sesiones_programadas)::numeric)) AS supera_limite,
    faltas_maximas_permitidas,
        CASE
            WHEN (((faltas_equivalentes * 100))::numeric > (limite_pct * (sesiones_programadas)::numeric)) THEN 0
            ELSE GREATEST((faltas_maximas_permitidas - faltas_equivalentes), 0)
        END AS faltas_restantes_antes_limite,
    ((sesiones_programadas > 0) AND (((faltas_equivalentes * 100))::numeric <= (limite_pct * (sesiones_programadas)::numeric)) AND ((faltas_maximas_permitidas - faltas_equivalentes) <= 0)) AS en_limite
   FROM ( SELECT i.id_inscripcion,
            i.id_alumno,
            i.id_grupo,
            i.estatus AS estatus_inscripcion,
            i.derecho_examen,
            sp.n AS sesiones_programadas,
            ac.presentes,
            ac.retardos,
            ac.ausencias,
            ac.justificadas,
            ac.pendientes,
            (ac.ausencias +
                CASE
                    WHEN (p.retardos_por_ausencia >= (1)::numeric) THEN (floor(((ac.retardos)::numeric / p.retardos_por_ausencia)))::integer
                    ELSE 0
                END) AS faltas_equivalentes,
            p.limite_pct,
            (floor(((p.limite_pct * (sp.n)::numeric) / (100)::numeric)))::integer AS faltas_maximas_permitidas
           FROM (((public.inscripcion i
             CROSS JOIN ( SELECT app.param_num('retardos_por_ausencia'::text) AS retardos_por_ausencia,
                    app.param_num('porcentaje_max_ausencias'::text) AS limite_pct) p)
             CROSS JOIN LATERAL ( SELECT (count(*))::integer AS n
                   FROM public.sesion_clase s
                  WHERE ((s.id_grupo = i.id_grupo) AND (s.estatus <> 'suspendida'::public.estatus_sesion))) sp)
             CROSS JOIN LATERAL ( SELECT (count(*) FILTER (WHERE (a.estado = 'presente'::public.estado_asistencia)))::integer AS presentes,
                    (count(*) FILTER (WHERE (a.estado = 'retardo'::public.estado_asistencia)))::integer AS retardos,
                    (count(*) FILTER (WHERE (a.estado = 'ausente'::public.estado_asistencia)))::integer AS ausencias,
                    (count(*) FILTER (WHERE (a.estado = 'justificado'::public.estado_asistencia)))::integer AS justificadas,
                    (count(*) FILTER (WHERE (a.estado = 'pendiente'::public.estado_asistencia)))::integer AS pendientes
                   FROM (public.asistencia a
                     JOIN public.sesion_clase s ON ((s.id_sesion = a.id_sesion)))
                  WHERE ((a.id_alumno = i.id_alumno) AND (s.id_grupo = i.id_grupo) AND (s.estatus <> 'suspendida'::public.estatus_sesion))) ac)) b;

CREATE TABLE app.bloqueo (
    clave character varying(80) NOT NULL,
    dueno character varying(80) NOT NULL,
    vence timestamp with time zone NOT NULL
);

CREATE TABLE app.reloj_demo (
    id boolean DEFAULT true NOT NULL,
    fake_now timestamp with time zone NOT NULL,
    CONSTRAINT reloj_demo_id_check CHECK (id)
);

ALTER TABLE public.alumno ALTER COLUMN id_alumno ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.alumno_id_alumno_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.asistencia ALTER COLUMN id_asistencia ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.asistencia_id_asistencia_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.aula ALTER COLUMN id_aula ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.aula_id_aula_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE public.bitacora_auditoria (
    id_bitacora bigint NOT NULL,
    id_usuario integer NOT NULL,
    accion public.accion_bitacora NOT NULL,
    entidad character varying(40) NOT NULL,
    id_registro bigint NOT NULL,
    valor_anterior jsonb,
    valor_nuevo jsonb,
    fecha_hora timestamp with time zone DEFAULT app.now() NOT NULL,
    ip_origen character varying(45),
    CONSTRAINT ck_bitacora_entidad CHECK (((entidad)::text = ANY ((ARRAY['alumno'::character varying, 'docente'::character varying, 'materia'::character varying, 'aula'::character varying, 'grupo'::character varying, 'horario_grupo'::character varying, 'inscripcion'::character varying, 'sesion_clase'::character varying, 'asistencia'::character varying, 'justificante'::character varying, 'consentimiento'::character varying, 'indice_faiss'::character varying, 'plantilla_facial'::character varying, 'camara'::character varying, 'captura'::character varying, 'deteccion'::character varying, 'usuario'::character varying, 'parametro_sistema'::character varying])::text[]))),
    CONSTRAINT ck_bitacora_valores CHECK (((accion <> ALL (ARRAY['correccion'::public.accion_bitacora, 'cambio_parametro'::public.accion_bitacora])) OR ((valor_anterior IS NOT NULL) AND (valor_nuevo IS NOT NULL))))
);

ALTER TABLE public.bitacora_auditoria ALTER COLUMN id_bitacora ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.bitacora_auditoria_id_bitacora_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.camara ALTER COLUMN id_camara ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.camara_id_camara_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE public.captura (
    id_captura bigint NOT NULL,
    id_camara integer NOT NULL,
    id_sesion integer NOT NULL,
    marca_tiempo timestamp with time zone NOT NULL,
    rostros_detectados smallint DEFAULT 0 NOT NULL,
    CONSTRAINT ck_captura_rostros CHECK ((rostros_detectados >= 0))
);

ALTER TABLE public.captura ALTER COLUMN id_captura ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.captura_id_captura_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE public.consentimiento (
    id_consent integer NOT NULL,
    id_alumno integer NOT NULL,
    fecha_firma date NOT NULL,
    vigencia_hasta date NOT NULL,
    objeto_documento character varying(255) NOT NULL,
    estatus public.estatus_consentimiento DEFAULT 'vigente'::public.estatus_consentimiento NOT NULL,
    origen character varying(14) DEFAULT 'administrador'::character varying NOT NULL,
    version_aviso character varying(20),
    CONSTRAINT ck_consentimiento_origen CHECK (((origen)::text = ANY ((ARRAY['administrador'::character varying, 'alumno'::character varying])::text[]))),
    CONSTRAINT ck_consentimiento_vigencia CHECK ((vigencia_hasta > fecha_firma))
);

ALTER TABLE public.consentimiento ALTER COLUMN id_consent ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.consentimiento_id_consent_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE public.deteccion (
    id_deteccion bigint NOT NULL,
    id_captura bigint NOT NULL,
    id_plantilla integer,
    score_similitud numeric(4,3),
    es_valida boolean DEFAULT false NOT NULL,
    objeto_recorte character varying(255),
    CONSTRAINT ck_deteccion_candidato CHECK ((((id_plantilla IS NULL) AND (score_similitud IS NULL) AND (es_valida = false)) OR ((id_plantilla IS NOT NULL) AND (score_similitud IS NOT NULL)))),
    CONSTRAINT ck_deteccion_score CHECK (((score_similitud IS NULL) OR ((score_similitud >= (0)::numeric) AND (score_similitud <= (1)::numeric))))
);

ALTER TABLE public.deteccion ALTER COLUMN id_deteccion ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.deteccion_id_deteccion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.docente ALTER COLUMN id_docente ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.docente_id_docente_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.grupo ALTER COLUMN id_grupo ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.grupo_id_grupo_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE public.horario_grupo (
    id_horario integer NOT NULL,
    id_grupo integer NOT NULL,
    dia_semana smallint NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fin time without time zone NOT NULL,
    CONSTRAINT ck_horario_dia CHECK (((dia_semana >= 1) AND (dia_semana <= 6))),
    CONSTRAINT ck_horario_horas CHECK ((hora_fin > hora_inicio))
);

ALTER TABLE public.horario_grupo ALTER COLUMN id_horario ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.horario_grupo_id_horario_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE public.indice_faiss (
    id_indice integer NOT NULL,
    version character varying(12) NOT NULL,
    dimension smallint NOT NULL,
    objeto_indice character varying(255) NOT NULL,
    total_vectores integer NOT NULL,
    fecha_construccion timestamp with time zone DEFAULT app.now() NOT NULL,
    en_uso boolean DEFAULT false NOT NULL,
    CONSTRAINT ck_indice_dimension CHECK ((dimension > 0)),
    CONSTRAINT ck_indice_total CHECK ((total_vectores >= 0))
);

ALTER TABLE public.indice_faiss ALTER COLUMN id_indice ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.indice_faiss_id_indice_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.inscripcion ALTER COLUMN id_inscripcion ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.inscripcion_id_inscripcion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE public.justificante (
    id_justificante integer NOT NULL,
    id_sesion integer NOT NULL,
    id_alumno integer NOT NULL,
    motivo character varying(200) NOT NULL,
    objeto_documento character varying(255) NOT NULL,
    estatus public.estatus_justificante DEFAULT 'pendiente'::public.estatus_justificante NOT NULL,
    registrado_por integer NOT NULL,
    resuelto_por integer,
    fecha_registro timestamp with time zone DEFAULT app.now() NOT NULL,
    fecha_resolucion timestamp with time zone,
    CONSTRAINT ck_justificante_fechas CHECK (((fecha_resolucion IS NULL) OR (fecha_resolucion >= fecha_registro))),
    CONSTRAINT ck_justificante_resolucion CHECK (((estatus = 'pendiente'::public.estatus_justificante) = ((resuelto_por IS NULL) AND (fecha_resolucion IS NULL))))
);

ALTER TABLE public.justificante ALTER COLUMN id_justificante ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.justificante_id_justificante_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.materia ALTER COLUMN id_materia ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.materia_id_materia_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE public.parametro_sistema (
    clave character varying(40) NOT NULL,
    valor character varying(40) NOT NULL,
    descripcion character varying(200) NOT NULL,
    actualizado_por integer,
    fecha_actualizacion timestamp with time zone DEFAULT app.now() NOT NULL
);

CREATE TABLE public.plantilla_facial (
    id_plantilla integer NOT NULL,
    id_alumno integer NOT NULL,
    id_consent integer NOT NULL,
    id_indice integer,
    faiss_id bigint,
    objeto_foto character varying(255),
    fecha_registro timestamp with time zone DEFAULT app.now() NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    origen character varying(14) DEFAULT 'administrador'::character varying NOT NULL,
    CONSTRAINT ck_plantilla_faiss_id CHECK (((faiss_id IS NULL) OR (faiss_id >= 0))),
    CONSTRAINT ck_plantilla_indexada CHECK (((id_indice IS NULL) = (faiss_id IS NULL))),
    CONSTRAINT ck_plantilla_origen CHECK (((origen)::text = ANY ((ARRAY['administrador'::character varying, 'alumno'::character varying])::text[])))
);

ALTER TABLE public.plantilla_facial ALTER COLUMN id_plantilla ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.plantilla_facial_id_plantilla_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE public.plantilla_foto (
    id_foto integer NOT NULL,
    id_plantilla integer NOT NULL,
    orden smallint NOT NULL,
    objeto_foto character varying(255),
    calidad jsonb,
    coseno_resto numeric(4,3),
    CONSTRAINT ck_plantilla_foto_calidad CHECK (app.calidad_foto_valida(calidad)),
    CONSTRAINT ck_plantilla_foto_coseno CHECK (((coseno_resto IS NULL) OR ((coseno_resto >= ('-1'::integer)::numeric) AND (coseno_resto <= (1)::numeric)))),
    CONSTRAINT ck_plantilla_foto_orden CHECK (((orden >= 1) AND (orden <= 8)))
);

ALTER TABLE public.plantilla_foto ALTER COLUMN id_foto ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.plantilla_foto_id_foto_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.sesion_clase ALTER COLUMN id_sesion ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.sesion_clase_id_sesion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE public.usuario (
    id_usuario integer NOT NULL,
    auth_uid uuid NOT NULL,
    correo character varying(120) NOT NULL,
    rol public.rol_usuario NOT NULL,
    id_docente integer,
    id_alumno integer,
    activo boolean DEFAULT true NOT NULL,
    CONSTRAINT ck_usuario_alumno CHECK (((rol = 'alumno'::public.rol_usuario) = (id_alumno IS NOT NULL))),
    CONSTRAINT ck_usuario_docente CHECK (((rol = 'docente'::public.rol_usuario) = (id_docente IS NOT NULL)))
);

ALTER TABLE public.usuario ALTER COLUMN id_usuario ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.usuario_id_usuario_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE ONLY app.bloqueo
    ADD CONSTRAINT pk_bloqueo PRIMARY KEY (clave);

ALTER TABLE ONLY app.reloj_demo
    ADD CONSTRAINT reloj_demo_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.alumno
    ADD CONSTRAINT pk_alumno PRIMARY KEY (id_alumno);

ALTER TABLE ONLY public.asistencia
    ADD CONSTRAINT pk_asistencia PRIMARY KEY (id_asistencia);

ALTER TABLE ONLY public.aula
    ADD CONSTRAINT pk_aula PRIMARY KEY (id_aula);

ALTER TABLE ONLY public.bitacora_auditoria
    ADD CONSTRAINT pk_bitacora_auditoria PRIMARY KEY (id_bitacora);

ALTER TABLE ONLY public.camara
    ADD CONSTRAINT pk_camara PRIMARY KEY (id_camara);

ALTER TABLE ONLY public.captura
    ADD CONSTRAINT pk_captura PRIMARY KEY (id_captura);

ALTER TABLE ONLY public.consentimiento
    ADD CONSTRAINT pk_consentimiento PRIMARY KEY (id_consent);

ALTER TABLE ONLY public.deteccion
    ADD CONSTRAINT pk_deteccion PRIMARY KEY (id_deteccion);

ALTER TABLE ONLY public.docente
    ADD CONSTRAINT pk_docente PRIMARY KEY (id_docente);

ALTER TABLE ONLY public.grupo
    ADD CONSTRAINT pk_grupo PRIMARY KEY (id_grupo);

ALTER TABLE ONLY public.horario_grupo
    ADD CONSTRAINT pk_horario_grupo PRIMARY KEY (id_horario);

ALTER TABLE ONLY public.indice_faiss
    ADD CONSTRAINT pk_indice_faiss PRIMARY KEY (id_indice);

ALTER TABLE ONLY public.inscripcion
    ADD CONSTRAINT pk_inscripcion PRIMARY KEY (id_inscripcion);

ALTER TABLE ONLY public.justificante
    ADD CONSTRAINT pk_justificante PRIMARY KEY (id_justificante);

ALTER TABLE ONLY public.materia
    ADD CONSTRAINT pk_materia PRIMARY KEY (id_materia);

ALTER TABLE ONLY public.parametro_sistema
    ADD CONSTRAINT pk_parametro_sistema PRIMARY KEY (clave);

ALTER TABLE ONLY public.plantilla_facial
    ADD CONSTRAINT pk_plantilla_facial PRIMARY KEY (id_plantilla);

ALTER TABLE ONLY public.plantilla_foto
    ADD CONSTRAINT pk_plantilla_foto PRIMARY KEY (id_foto);

ALTER TABLE ONLY public.sesion_clase
    ADD CONSTRAINT pk_sesion_clase PRIMARY KEY (id_sesion);

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT pk_usuario PRIMARY KEY (id_usuario);

ALTER TABLE ONLY public.alumno
    ADD CONSTRAINT uq_alumno_correo UNIQUE (correo_institucional);

ALTER TABLE ONLY public.alumno
    ADD CONSTRAINT uq_alumno_matricula UNIQUE (matricula);

ALTER TABLE ONLY public.asistencia
    ADD CONSTRAINT uq_asistencia_sesion_alumno UNIQUE (id_sesion, id_alumno);

ALTER TABLE ONLY public.aula
    ADD CONSTRAINT uq_aula_clave UNIQUE (clave);

ALTER TABLE ONLY public.camara
    ADD CONSTRAINT uq_camara_aula_posicion UNIQUE (id_aula, posicion);

ALTER TABLE ONLY public.camara
    ADD CONSTRAINT uq_camara_direccion_ip UNIQUE (direccion_ip);

ALTER TABLE ONLY public.captura
    ADD CONSTRAINT uq_captura_camara_marca UNIQUE (id_camara, marca_tiempo);

ALTER TABLE ONLY public.docente
    ADD CONSTRAINT uq_docente_correo UNIQUE (correo_institucional);

ALTER TABLE ONLY public.docente
    ADD CONSTRAINT uq_docente_num_empleado UNIQUE (num_empleado);

ALTER TABLE ONLY public.grupo
    ADD CONSTRAINT uq_grupo_materia_clave_periodo UNIQUE (id_materia, clave_grupo, periodo);

ALTER TABLE ONLY public.horario_grupo
    ADD CONSTRAINT uq_horario_grupo_dia_hora UNIQUE (id_grupo, dia_semana, hora_inicio);

ALTER TABLE ONLY public.indice_faiss
    ADD CONSTRAINT uq_indice_faiss_version UNIQUE (version);

ALTER TABLE ONLY public.inscripcion
    ADD CONSTRAINT uq_inscripcion_alumno_grupo UNIQUE (id_alumno, id_grupo);

ALTER TABLE ONLY public.materia
    ADD CONSTRAINT uq_materia_clave UNIQUE (clave);

ALTER TABLE ONLY public.plantilla_foto
    ADD CONSTRAINT uq_plantilla_foto_orden UNIQUE (id_plantilla, orden);

ALTER TABLE ONLY public.plantilla_facial
    ADD CONSTRAINT uq_plantilla_indice_faiss_id UNIQUE (id_indice, faiss_id);

ALTER TABLE ONLY public.sesion_clase
    ADD CONSTRAINT uq_sesion_grupo_fecha_hora UNIQUE (id_grupo, fecha, hora_inicio);

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT uq_usuario_alumno UNIQUE (id_alumno);

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT uq_usuario_auth_uid UNIQUE (auth_uid);

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT uq_usuario_correo UNIQUE (correo);

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT uq_usuario_docente UNIQUE (id_docente);

CREATE INDEX ix_asistencia_alumno ON public.asistencia USING btree (id_alumno);

CREATE INDEX ix_asistencia_estado ON public.asistencia USING btree (estado) WHERE (estado = 'pendiente'::public.estado_asistencia);

CREATE INDEX ix_bitacora_entidad ON public.bitacora_auditoria USING btree (entidad, id_registro);

CREATE INDEX ix_bitacora_fecha ON public.bitacora_auditoria USING btree (fecha_hora);

CREATE INDEX ix_bitacora_usuario ON public.bitacora_auditoria USING btree (id_usuario);

CREATE INDEX ix_camara_aula ON public.camara USING btree (id_aula);

CREATE INDEX ix_captura_sesion ON public.captura USING btree (id_sesion);

CREATE INDEX ix_consentimiento_alumno ON public.consentimiento USING btree (id_alumno);

CREATE INDEX ix_deteccion_captura ON public.deteccion USING btree (id_captura);

CREATE INDEX ix_deteccion_plantilla ON public.deteccion USING btree (id_plantilla);

CREATE INDEX ix_grupo_aula ON public.grupo USING btree (id_aula);

CREATE INDEX ix_grupo_docente ON public.grupo USING btree (id_docente);

CREATE INDEX ix_grupo_periodo ON public.grupo USING btree (periodo);

CREATE INDEX ix_inscripcion_grupo ON public.inscripcion USING btree (id_grupo);

CREATE INDEX ix_justificante_asistencia ON public.justificante USING btree (id_sesion, id_alumno);

CREATE INDEX ix_justificante_estatus ON public.justificante USING btree (estatus) WHERE (estatus = 'pendiente'::public.estatus_justificante);

CREATE INDEX ix_plantilla_alumno ON public.plantilla_facial USING btree (id_alumno);

CREATE INDEX ix_plantilla_consent ON public.plantilla_facial USING btree (id_consent);

CREATE INDEX ix_sesion_estatus_fecha ON public.sesion_clase USING btree (estatus, fecha);

CREATE INDEX ix_sesion_fecha ON public.sesion_clase USING btree (fecha);

CREATE UNIQUE INDEX ux_indice_faiss_en_uso ON public.indice_faiss USING btree (en_uso) WHERE en_uso;

CREATE UNIQUE INDEX ux_justificante_pendiente ON public.justificante USING btree (id_sesion, id_alumno) WHERE (estatus = 'pendiente'::public.estatus_justificante);

CREATE UNIQUE INDEX ux_plantilla_facial_activa ON public.plantilla_facial USING btree (id_alumno) WHERE activa;

CREATE TRIGGER trg_asistencia_ciclo BEFORE INSERT OR UPDATE ON public.asistencia FOR EACH ROW EXECUTE FUNCTION app.trg_asistencia_ciclo();

CREATE TRIGGER trg_asistencia_rn01 BEFORE INSERT OR UPDATE OF id_sesion, id_alumno ON public.asistencia FOR EACH ROW EXECUTE FUNCTION app.trg_asistencia_rn01();

CREATE TRIGGER trg_bitacora_sin_cambios BEFORE DELETE OR UPDATE ON public.bitacora_auditoria FOR EACH ROW EXECUTE FUNCTION app.trg_bitacora_sin_cambios();

ALTER TABLE public.bitacora_auditoria ENABLE ALWAYS TRIGGER trg_bitacora_sin_cambios;

CREATE TRIGGER trg_bitacora_sin_truncate BEFORE TRUNCATE ON public.bitacora_auditoria FOR EACH STATEMENT EXECUTE FUNCTION app.trg_bitacora_sin_truncate();

ALTER TABLE public.bitacora_auditoria ENABLE ALWAYS TRIGGER trg_bitacora_sin_truncate;

CREATE TRIGGER trg_captura_rn06 BEFORE INSERT OR UPDATE OF id_camara, id_sesion ON public.captura FOR EACH ROW EXECUTE FUNCTION app.trg_captura_rn06();

CREATE TRIGGER trg_plantilla_foto_principal AFTER INSERT OR UPDATE OF objeto_foto ON public.plantilla_facial FOR EACH ROW EXECUTE FUNCTION app.trg_plantilla_foto_principal();

CREATE TRIGGER trg_plantilla_rn13 BEFORE INSERT OR UPDATE OF id_consent, id_alumno, activa ON public.plantilla_facial FOR EACH ROW EXECUTE FUNCTION app.trg_plantilla_rn13();

ALTER TABLE ONLY public.asistencia
    ADD CONSTRAINT fk_asistencia_alumno FOREIGN KEY (id_alumno) REFERENCES public.alumno(id_alumno) ON DELETE RESTRICT;

ALTER TABLE ONLY public.asistencia
    ADD CONSTRAINT fk_asistencia_sesion FOREIGN KEY (id_sesion) REFERENCES public.sesion_clase(id_sesion) ON DELETE RESTRICT;

ALTER TABLE ONLY public.bitacora_auditoria
    ADD CONSTRAINT fk_bitacora_usuario FOREIGN KEY (id_usuario) REFERENCES public.usuario(id_usuario) ON DELETE RESTRICT;

ALTER TABLE ONLY public.camara
    ADD CONSTRAINT fk_camara_aula FOREIGN KEY (id_aula) REFERENCES public.aula(id_aula) ON DELETE RESTRICT;

ALTER TABLE ONLY public.captura
    ADD CONSTRAINT fk_captura_camara FOREIGN KEY (id_camara) REFERENCES public.camara(id_camara) ON DELETE RESTRICT;

ALTER TABLE ONLY public.captura
    ADD CONSTRAINT fk_captura_sesion FOREIGN KEY (id_sesion) REFERENCES public.sesion_clase(id_sesion) ON DELETE RESTRICT;

ALTER TABLE ONLY public.consentimiento
    ADD CONSTRAINT fk_consentimiento_alumno FOREIGN KEY (id_alumno) REFERENCES public.alumno(id_alumno) ON DELETE RESTRICT;

ALTER TABLE ONLY public.deteccion
    ADD CONSTRAINT fk_deteccion_captura FOREIGN KEY (id_captura) REFERENCES public.captura(id_captura) ON DELETE RESTRICT;

ALTER TABLE ONLY public.deteccion
    ADD CONSTRAINT fk_deteccion_plantilla FOREIGN KEY (id_plantilla) REFERENCES public.plantilla_facial(id_plantilla) ON DELETE RESTRICT;

ALTER TABLE ONLY public.grupo
    ADD CONSTRAINT fk_grupo_aula FOREIGN KEY (id_aula) REFERENCES public.aula(id_aula) ON DELETE RESTRICT;

ALTER TABLE ONLY public.grupo
    ADD CONSTRAINT fk_grupo_docente FOREIGN KEY (id_docente) REFERENCES public.docente(id_docente) ON DELETE RESTRICT;

ALTER TABLE ONLY public.grupo
    ADD CONSTRAINT fk_grupo_materia FOREIGN KEY (id_materia) REFERENCES public.materia(id_materia) ON DELETE RESTRICT;

ALTER TABLE ONLY public.horario_grupo
    ADD CONSTRAINT fk_horario_grupo FOREIGN KEY (id_grupo) REFERENCES public.grupo(id_grupo) ON DELETE CASCADE;

ALTER TABLE ONLY public.inscripcion
    ADD CONSTRAINT fk_inscripcion_alumno FOREIGN KEY (id_alumno) REFERENCES public.alumno(id_alumno) ON DELETE RESTRICT;

ALTER TABLE ONLY public.inscripcion
    ADD CONSTRAINT fk_inscripcion_grupo FOREIGN KEY (id_grupo) REFERENCES public.grupo(id_grupo) ON DELETE RESTRICT;

ALTER TABLE ONLY public.justificante
    ADD CONSTRAINT fk_justificante_asistencia FOREIGN KEY (id_sesion, id_alumno) REFERENCES public.asistencia(id_sesion, id_alumno) ON DELETE RESTRICT;

ALTER TABLE ONLY public.justificante
    ADD CONSTRAINT fk_justificante_registrado FOREIGN KEY (registrado_por) REFERENCES public.usuario(id_usuario) ON DELETE RESTRICT;

ALTER TABLE ONLY public.justificante
    ADD CONSTRAINT fk_justificante_resuelto FOREIGN KEY (resuelto_por) REFERENCES public.usuario(id_usuario) ON DELETE RESTRICT;

ALTER TABLE ONLY public.parametro_sistema
    ADD CONSTRAINT fk_parametro_usuario FOREIGN KEY (actualizado_por) REFERENCES public.usuario(id_usuario) ON DELETE RESTRICT;

ALTER TABLE ONLY public.plantilla_facial
    ADD CONSTRAINT fk_plantilla_alumno FOREIGN KEY (id_alumno) REFERENCES public.alumno(id_alumno) ON DELETE RESTRICT;

ALTER TABLE ONLY public.plantilla_facial
    ADD CONSTRAINT fk_plantilla_consent FOREIGN KEY (id_consent) REFERENCES public.consentimiento(id_consent) ON DELETE RESTRICT;

ALTER TABLE ONLY public.plantilla_foto
    ADD CONSTRAINT fk_plantilla_foto_plantilla FOREIGN KEY (id_plantilla) REFERENCES public.plantilla_facial(id_plantilla) ON DELETE RESTRICT;

ALTER TABLE ONLY public.plantilla_facial
    ADD CONSTRAINT fk_plantilla_indice FOREIGN KEY (id_indice) REFERENCES public.indice_faiss(id_indice) ON DELETE RESTRICT;

ALTER TABLE ONLY public.sesion_clase
    ADD CONSTRAINT fk_sesion_grupo FOREIGN KEY (id_grupo) REFERENCES public.grupo(id_grupo) ON DELETE RESTRICT;

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT fk_usuario_alumno FOREIGN KEY (id_alumno) REFERENCES public.alumno(id_alumno) ON DELETE RESTRICT;

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT fk_usuario_docente FOREIGN KEY (id_docente) REFERENCES public.docente(id_docente) ON DELETE RESTRICT;

ALTER TABLE app.bloqueo ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_o_tecnico_ven_camaras ON public.camara FOR SELECT TO authenticated USING ((( SELECT app.rol() AS rol) = ANY (ARRAY['administrador'::text, 'tecnico'::text])));

CREATE POLICY admin_o_tecnico_ven_indices ON public.indice_faiss FOR SELECT TO authenticated USING ((( SELECT app.rol() AS rol) = ANY (ARRAY['administrador'::text, 'tecnico'::text])));

CREATE POLICY admin_o_tecnico_ven_parametros ON public.parametro_sistema FOR SELECT TO authenticated USING ((( SELECT app.rol() AS rol) = ANY (ARRAY['administrador'::text, 'tecnico'::text])));

CREATE POLICY admin_ve_todo ON public.alumno FOR SELECT TO authenticated USING (( SELECT app.es_admin() AS es_admin));

CREATE POLICY admin_ve_todo ON public.asistencia FOR SELECT TO authenticated USING (( SELECT app.es_admin() AS es_admin));

CREATE POLICY admin_ve_todo ON public.aula FOR SELECT TO authenticated USING (( SELECT app.es_admin() AS es_admin));

CREATE POLICY admin_ve_todo ON public.bitacora_auditoria FOR SELECT TO authenticated USING (( SELECT app.es_admin() AS es_admin));

CREATE POLICY admin_ve_todo ON public.consentimiento FOR SELECT TO authenticated USING (( SELECT app.es_admin() AS es_admin));

CREATE POLICY admin_ve_todo ON public.docente FOR SELECT TO authenticated USING (( SELECT app.es_admin() AS es_admin));

CREATE POLICY admin_ve_todo ON public.grupo FOR SELECT TO authenticated USING (( SELECT app.es_admin() AS es_admin));

CREATE POLICY admin_ve_todo ON public.horario_grupo FOR SELECT TO authenticated USING (( SELECT app.es_admin() AS es_admin));

CREATE POLICY admin_ve_todo ON public.inscripcion FOR SELECT TO authenticated USING (( SELECT app.es_admin() AS es_admin));

CREATE POLICY admin_ve_todo ON public.materia FOR SELECT TO authenticated USING (( SELECT app.es_admin() AS es_admin));

CREATE POLICY admin_ve_todo ON public.plantilla_facial FOR SELECT TO authenticated USING (( SELECT app.es_admin() AS es_admin));

CREATE POLICY admin_ve_todo ON public.plantilla_foto FOR SELECT TO authenticated USING (( SELECT app.es_admin() AS es_admin));

CREATE POLICY admin_ve_todo ON public.sesion_clase FOR SELECT TO authenticated USING (( SELECT app.es_admin() AS es_admin));

CREATE POLICY admin_ve_todo ON public.usuario FOR SELECT TO authenticated USING (( SELECT app.es_admin() AS es_admin));

ALTER TABLE public.alumno ENABLE ROW LEVEL SECURITY;

CREATE POLICY alumno_ve_docentes_de_sus_grupos ON public.docente FOR SELECT TO authenticated USING (((( SELECT app.rol() AS rol) = 'alumno'::text) AND (id_docente IN ( SELECT g.id_docente
   FROM public.grupo g))));

CREATE POLICY alumno_ve_lo_propio ON public.alumno FOR SELECT TO authenticated USING ((id_alumno = ( SELECT app.id_alumno() AS id_alumno)));

CREATE POLICY alumno_ve_lo_propio ON public.asistencia FOR SELECT TO authenticated USING ((id_alumno = ( SELECT app.id_alumno() AS id_alumno)));

CREATE POLICY alumno_ve_lo_propio ON public.inscripcion FOR SELECT TO authenticated USING ((id_alumno = ( SELECT app.id_alumno() AS id_alumno)));

CREATE POLICY alumno_ve_lo_propio ON public.justificante FOR SELECT TO authenticated USING ((id_alumno = ( SELECT app.id_alumno() AS id_alumno)));

CREATE POLICY alumno_ve_sus_grupos ON public.grupo FOR SELECT TO authenticated USING (((( SELECT app.rol() AS rol) = 'alumno'::text) AND (id_grupo IN ( SELECT app.grupos_visibles() AS grupos_visibles))));

ALTER TABLE public.asistencia ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.aula ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.bitacora_auditoria ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.camara ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.captura ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.consentimiento ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.deteccion ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.docente ENABLE ROW LEVEL SECURITY;

CREATE POLICY docente_ve_lo_propio ON public.docente FOR SELECT TO authenticated USING ((id_docente = ( SELECT app.id_docente() AS id_docente)));

CREATE POLICY docente_ve_sus_grupos ON public.alumno FOR SELECT TO authenticated USING (((( SELECT app.rol() AS rol) = 'docente'::text) AND (id_alumno IN ( SELECT i.id_alumno
   FROM public.inscripcion i
  WHERE (i.id_grupo IN ( SELECT app.grupos_visibles() AS grupos_visibles))))));

CREATE POLICY docente_ve_sus_grupos ON public.asistencia FOR SELECT TO authenticated USING (((( SELECT app.rol() AS rol) = 'docente'::text) AND (EXISTS ( SELECT 1
   FROM public.sesion_clase s
  WHERE ((s.id_sesion = asistencia.id_sesion) AND (s.id_grupo IN ( SELECT app.grupos_visibles() AS grupos_visibles)))))));

CREATE POLICY docente_ve_sus_grupos ON public.camara FOR SELECT TO authenticated USING (((( SELECT app.rol() AS rol) = 'docente'::text) AND (id_aula IN ( SELECT g.id_aula
   FROM public.grupo g))));

CREATE POLICY docente_ve_sus_grupos ON public.captura FOR SELECT TO authenticated USING (((( SELECT app.rol() AS rol) = 'docente'::text) AND (EXISTS ( SELECT 1
   FROM public.sesion_clase s
  WHERE ((s.id_sesion = captura.id_sesion) AND (s.id_grupo IN ( SELECT app.grupos_visibles() AS grupos_visibles)))))));

CREATE POLICY docente_ve_sus_grupos ON public.deteccion FOR SELECT TO authenticated USING (((( SELECT app.rol() AS rol) = 'docente'::text) AND (id_captura IN ( SELECT c.id_captura
   FROM public.captura c))));

CREATE POLICY docente_ve_sus_grupos ON public.grupo FOR SELECT TO authenticated USING (((( SELECT app.rol() AS rol) = 'docente'::text) AND (id_docente = ( SELECT app.id_docente() AS id_docente))));

CREATE POLICY docente_ve_sus_grupos ON public.inscripcion FOR SELECT TO authenticated USING (((( SELECT app.rol() AS rol) = 'docente'::text) AND (id_grupo IN ( SELECT app.grupos_visibles() AS grupos_visibles))));

CREATE POLICY docente_ve_sus_grupos ON public.justificante FOR SELECT TO authenticated USING (((( SELECT app.rol() AS rol) = 'docente'::text) AND (EXISTS ( SELECT 1
   FROM public.sesion_clase s
  WHERE ((s.id_sesion = justificante.id_sesion) AND (s.id_grupo IN ( SELECT app.grupos_visibles() AS grupos_visibles)))))));

CREATE POLICY docente_ve_sus_grupos ON public.plantilla_facial FOR SELECT TO authenticated USING (((( SELECT app.rol() AS rol) = 'docente'::text) AND (id_alumno IN ( SELECT i.id_alumno
   FROM public.inscripcion i
  WHERE (i.id_grupo IN ( SELECT app.grupos_visibles() AS grupos_visibles))))));

ALTER TABLE public.grupo ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.horario_grupo ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.indice_faiss ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.inscripcion ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.justificante ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.materia ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.parametro_sistema ENABLE ROW LEVEL SECURITY;

CREATE POLICY participante_ve_aulas_de_sus_grupos ON public.aula FOR SELECT TO authenticated USING (((( SELECT app.rol() AS rol) = ANY (ARRAY['docente'::text, 'alumno'::text])) AND (id_aula IN ( SELECT g.id_aula
   FROM public.grupo g))));

CREATE POLICY participante_ve_horario_de_sus_grupos ON public.horario_grupo FOR SELECT TO authenticated USING (((( SELECT app.rol() AS rol) = ANY (ARRAY['docente'::text, 'alumno'::text])) AND (id_grupo IN ( SELECT app.grupos_visibles() AS grupos_visibles))));

CREATE POLICY participante_ve_materias_de_sus_grupos ON public.materia FOR SELECT TO authenticated USING (((( SELECT app.rol() AS rol) = ANY (ARRAY['docente'::text, 'alumno'::text])) AND (id_materia IN ( SELECT g.id_materia
   FROM public.grupo g))));

CREATE POLICY participante_ve_sesiones_de_sus_grupos ON public.sesion_clase FOR SELECT TO authenticated USING (((( SELECT app.rol() AS rol) = ANY (ARRAY['docente'::text, 'alumno'::text])) AND (id_grupo IN ( SELECT app.grupos_visibles() AS grupos_visibles))));

ALTER TABLE public.plantilla_facial ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.plantilla_foto ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sesion_clase ENABLE ROW LEVEL SECURITY;

CREATE POLICY tecnico_ve_aulas ON public.aula FOR SELECT TO authenticated USING ((( SELECT app.rol() AS rol) = 'tecnico'::text));

ALTER TABLE public.usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY usuario_ve_su_cuenta ON public.usuario FOR SELECT TO authenticated USING ((auth_uid = ( SELECT auth.uid() AS uid)));
