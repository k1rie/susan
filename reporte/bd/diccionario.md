# Diccionario de datos de SUSAN (generado desde la base de datos)

Generado por `generar-diccionario.mjs` consultando el catálogo de PostgreSQL 16 de la base local `susan`
(`pg_class`, `pg_attribute`, `pg_constraint`, `pg_index`, `pg_trigger`, `pg_policies`). Nada está escrito a mano:
los tipos, nulos, valores por omisión, restricciones e índices son los del catálogo; el propósito de cada tabla es su
`COMMENT ON TABLE` (que viene de las migraciones). Los tipos se abrevian (`varchar`, `timestamptz`, `time`).
Las expresiones de CHECK se muestran tal como las devuelve `pg_get_constraintdef` (con sus conversiones `::tipo`).

Alcance: 20 tablas base del esquema `public` y la vista `v_resumen_asistencia`; al final, las 2 tablas internas del esquema `app`.
Marca **[ext]** = columna que no figura en el esquema relacional de la especificación (Avance 1, sección 3.4.1).

## Índice

| Área | Tablas |
|---|---|
| A · Catálogo académico | `alumno`, `docente`, `materia`, `aula`, `grupo`, `horario_grupo`, `inscripcion` |
| B · Operación de la clase | `sesion_clase`, `asistencia`, `justificante` |
| C · Captura y módulo biométrico | `consentimiento`, `indice_faiss`, `plantilla_facial`, `plantilla_foto`, `camara`, `captura`, `deteccion` |
| D · Seguridad y configuración | `usuario`, `bitacora_auditoria`, `parametro_sistema` |

## Área A · Catálogo académico

Fuente de las tablas: `0003_tablas_academico.sql`.

### alumno

**Propósito:** Persona cuya asistencia se registra.

**En la especificación:** sí · **Columnas:** 7 · **RLS:** habilitado

| # | Columna | Tipo | Nulo | Por omisión / generación |
|--:|---|---|:-:|---|
| 1 | `id_alumno` | integer | no | GENERATED ALWAYS AS IDENTITY |
| 2 | `matricula` | varchar(10) | no |  |
| 3 | `apellido_paterno` | varchar(40) | no |  |
| 4 | `apellido_materno` | varchar(40) | sí |  |
| 5 | `nombres` | varchar(60) | no |  |
| 6 | `correo_institucional` | varchar(120) | no |  |
| 7 | `estatus` | estatus_alumno | no | `'activo'::estatus_alumno` |

**Llave primaria:** `pk_alumno` (id_alumno)

**Llaves foráneas:** ninguna.

**Únicos:**

- `uq_alumno_correo`: UNIQUE (correo_institucional)
- `uq_alumno_matricula`: UNIQUE (matricula)

**Restricciones CHECK:**

- `ck_alumno_correo`: `((POSITION(('@'::text) IN (correo_institucional)) > 0))`

**Políticas RLS (3, todas SELECT):** `admin_ve_todo`, `alumno_ve_lo_propio`, `docente_ve_sus_grupos`

### docente

**Propósito:** Responsable del grupo y de las correcciones.

**En la especificación:** sí · **Columnas:** 7 · **RLS:** habilitado

| # | Columna | Tipo | Nulo | Por omisión / generación |
|--:|---|---|:-:|---|
| 1 | `id_docente` | integer | no | GENERATED ALWAYS AS IDENTITY |
| 2 | `num_empleado` | varchar(10) | no |  |
| 3 | `apellido_paterno` | varchar(40) | no |  |
| 4 | `apellido_materno` | varchar(40) | sí |  |
| 5 | `nombres` | varchar(60) | no |  |
| 6 | `correo_institucional` | varchar(120) | no |  |
| 7 | `estatus` | estatus_docente | no | `'activo'::estatus_docente` |

**Llave primaria:** `pk_docente` (id_docente)

**Llaves foráneas:** ninguna.

**Únicos:**

- `uq_docente_correo`: UNIQUE (correo_institucional)
- `uq_docente_num_empleado`: UNIQUE (num_empleado)

**Restricciones CHECK:**

- `ck_docente_correo`: `((POSITION(('@'::text) IN (correo_institucional)) > 0))`

**Políticas RLS (3, todas SELECT):** `admin_ve_todo`, `alumno_ve_docentes_de_sus_grupos`, `docente_ve_lo_propio`

### materia

**Propósito:** Asignatura del plan de estudios.

**En la especificación:** sí · **Columnas:** 5 · **RLS:** habilitado

| # | Columna | Tipo | Nulo | Por omisión / generación |
|--:|---|---|:-:|---|
| 1 | `id_materia` | integer | no | GENERATED ALWAYS AS IDENTITY |
| 2 | `clave` | varchar(8) | no |  |
| 3 | `nombre` | varchar(80) | no |  |
| 4 | `creditos` | smallint | no |  |
| 5 | `horas_semana` | smallint | no |  |

**Llave primaria:** `pk_materia` (id_materia)

**Llaves foráneas:** ninguna.

**Únicos:**

- `uq_materia_clave`: UNIQUE (clave)

**Restricciones CHECK:**

- `ck_materia_creditos`: `((creditos > 0))`
- `ck_materia_horas`: `(((horas_semana >= 1) AND (horas_semana <= 20)))`

**Políticas RLS (2, todas SELECT):** `admin_ve_todo`, `participante_ve_materias_de_sus_grupos`

### aula

**Propósito:** Espacio fisico donde se imparte el grupo y se instalan las camaras.

**En la especificación:** sí · **Columnas:** 4 · **RLS:** habilitado

| # | Columna | Tipo | Nulo | Por omisión / generación |
|--:|---|---|:-:|---|
| 1 | `id_aula` | integer | no | GENERATED ALWAYS AS IDENTITY |
| 2 | `clave` | varchar(10) | no |  |
| 3 | `edificio` | varchar(40) | no |  |
| 4 | `capacidad` | smallint | no |  |

**Llave primaria:** `pk_aula` (id_aula)

**Llaves foráneas:** ninguna.

**Únicos:**

- `uq_aula_clave`: UNIQUE (clave)

**Restricciones CHECK:**

- `ck_aula_capacidad`: `((capacidad > 0))`

**Políticas RLS (3, todas SELECT):** `admin_ve_todo`, `participante_ve_aulas_de_sus_grupos`, `tecnico_ve_aulas`

### grupo

**Propósito:** Materia impartida por un docente en un periodo y un aula.

**En la especificación:** sí · **Columnas:** 6 · **RLS:** habilitado

| # | Columna | Tipo | Nulo | Por omisión / generación |
|--:|---|---|:-:|---|
| 1 | `id_grupo` | integer | no | GENERATED ALWAYS AS IDENTITY |
| 2 | `id_materia` | integer | no |  |
| 3 | `id_docente` | integer | no |  |
| 4 | `id_aula` | integer | no |  |
| 5 | `clave_grupo` | varchar(8) | no |  |
| 6 | `periodo` | varchar(10) | no |  |

**Llave primaria:** `pk_grupo` (id_grupo)

**Llaves foráneas:**

| Restricción | Columnas | Referencia | Al borrar |
|---|---|---|---|
| `fk_grupo_aula` | id_aula | `aula` (id_aula) | RESTRICT |
| `fk_grupo_docente` | id_docente | `docente` (id_docente) | RESTRICT |
| `fk_grupo_materia` | id_materia | `materia` (id_materia) | RESTRICT |

**Únicos:**

- `uq_grupo_materia_clave_periodo`: UNIQUE (id_materia, clave_grupo, periodo)

**Restricciones CHECK:**

- `ck_grupo_periodo`: `(((periodo)::text ~ '^[0-9]{4}-[12]$'::text))`

**Índices de apoyo:**

- `ix_grupo_aula`: `public.grupo USING btree (id_aula)`
- `ix_grupo_docente`: `public.grupo USING btree (id_docente)`
- `ix_grupo_periodo`: `public.grupo USING btree (periodo)`

**Políticas RLS (3, todas SELECT):** `admin_ve_todo`, `alumno_ve_sus_grupos`, `docente_ve_sus_grupos`

### horario_grupo

**Propósito:** Bloque semanal del horario de un grupo; de el se generan las sesiones programadas (RN-06).

**En la especificación:** sí · **Columnas:** 5 · **RLS:** habilitado

| # | Columna | Tipo | Nulo | Por omisión / generación |
|--:|---|---|:-:|---|
| 1 | `id_horario` | integer | no | GENERATED ALWAYS AS IDENTITY |
| 2 | `id_grupo` | integer | no |  |
| 3 | `dia_semana` | smallint | no |  |
| 4 | `hora_inicio` | time | no |  |
| 5 | `hora_fin` | time | no |  |

**Llave primaria:** `pk_horario_grupo` (id_horario)

**Llaves foráneas:**

| Restricción | Columnas | Referencia | Al borrar |
|---|---|---|---|
| `fk_horario_grupo` | id_grupo | `grupo` (id_grupo) | CASCADE |

**Únicos:**

- `uq_horario_grupo_dia_hora`: UNIQUE (id_grupo, dia_semana, hora_inicio)

**Restricciones CHECK:**

- `ck_horario_dia`: `(((dia_semana >= 1) AND (dia_semana <= 6)))`
- `ck_horario_horas`: `((hora_fin > hora_inicio))`

**Políticas RLS (2, todas SELECT):** `admin_ve_todo`, `participante_ve_horario_de_sus_grupos`

### inscripcion

**Propósito:** Vinculo alumno-grupo; solo una inscripcion activa habilita la asistencia (RN-01).

**En la especificación:** sí · **Columnas:** 6 · **RLS:** habilitado

| # | Columna | Tipo | Nulo | Por omisión / generación |
|--:|---|---|:-:|---|
| 1 | `id_inscripcion` | integer | no | GENERATED ALWAYS AS IDENTITY |
| 2 | `id_alumno` | integer | no |  |
| 3 | `id_grupo` | integer | no |  |
| 4 | `fecha_alta` | date | no | `app.hoy()` |
| 5 | `estatus` | estatus_inscripcion | no | `'activa'::estatus_inscripcion` |
| 6 | `derecho_examen` | boolean | no | `true` |

**Llave primaria:** `pk_inscripcion` (id_inscripcion)

**Llaves foráneas:**

| Restricción | Columnas | Referencia | Al borrar |
|---|---|---|---|
| `fk_inscripcion_alumno` | id_alumno | `alumno` (id_alumno) | RESTRICT |
| `fk_inscripcion_grupo` | id_grupo | `grupo` (id_grupo) | RESTRICT |

**Únicos:**

- `uq_inscripcion_alumno_grupo`: UNIQUE (id_alumno, id_grupo)

**Índices de apoyo:**

- `ix_inscripcion_grupo`: `public.inscripcion USING btree (id_grupo)`

**Políticas RLS (3, todas SELECT):** `admin_ve_todo`, `alumno_ve_lo_propio`, `docente_ve_sus_grupos`

## Área B · Operación de la clase

Fuente de las tablas: `0005_tablas_operacion.sql`.

### sesion_clase

**Propósito:** Ocurrencia concreta de una clase; las programadas son la base del porcentaje de faltas (RN-11).

**En la especificación:** sí · **Columnas:** 10 · **RLS:** habilitado

| # | Columna | Tipo | Nulo | Por omisión / generación |
|--:|---|---|:-:|---|
| 1 | `id_sesion` | integer | no | GENERATED ALWAYS AS IDENTITY |
| 2 | `id_grupo` | integer | no |  |
| 3 | `fecha` | date | no |  |
| 4 | `hora_inicio` | time | no |  |
| 5 | `hora_fin` | time | no |  |
| 6 | `tolerancia_min` | smallint | no | `20` |
| 7 | `limite_presente_min` | smallint | no | `10` |
| 8 | `intervalo_muestreo_seg` | smallint | no | `15` |
| 9 | `modo_registro` | modo_registro_sesion | no | `'automatico'::modo_registro_sesion` |
| 10 | `estatus` | estatus_sesion | no | `'programada'::estatus_sesion` |

**Llave primaria:** `pk_sesion_clase` (id_sesion)

**Llaves foráneas:**

| Restricción | Columnas | Referencia | Al borrar |
|---|---|---|---|
| `fk_sesion_grupo` | id_grupo | `grupo` (id_grupo) | RESTRICT |

**Únicos:**

- `uq_sesion_grupo_fecha_hora`: UNIQUE (id_grupo, fecha, hora_inicio)

**Restricciones CHECK:**

- `ck_sesion_horas`: `((hora_fin > hora_inicio))`
- `ck_sesion_intervalo`: `(((intervalo_muestreo_seg >= 5) AND (intervalo_muestreo_seg <= 120)))`
- `ck_sesion_ventana`: `(((limite_presente_min > 0) AND (limite_presente_min < tolerancia_min)))`

**Índices de apoyo:**

- `ix_sesion_estatus_fecha`: `public.sesion_clase USING btree (estatus, fecha)`
- `ix_sesion_fecha`: `public.sesion_clase USING btree (fecha)`

**Políticas RLS (2, todas SELECT):** `admin_ve_todo`, `participante_ve_sesiones_de_sus_grupos`

### asistencia

**Propósito:** Resultado unico de un alumno en una sesion. Triggers: trg_asistencia_rn01, trg_asistencia_ciclo.

**En la especificación:** sí · **Columnas:** 7 · **RLS:** habilitado

| # | Columna | Tipo | Nulo | Por omisión / generación |
|--:|---|---|:-:|---|
| 1 | `id_asistencia` | integer | no | GENERATED ALWAYS AS IDENTITY |
| 2 | `id_sesion` | integer | no |  |
| 3 | `id_alumno` | integer | no |  |
| 4 | `estado` | estado_asistencia | no |  |
| 5 | `hora_registro` | timestamptz | sí |  |
| 6 | `origen` | origen_asistencia | no |  |
| 7 | `conteo_detecciones` | smallint | no | `0` |

**Llave primaria:** `pk_asistencia` (id_asistencia)

**Llaves foráneas:**

| Restricción | Columnas | Referencia | Al borrar |
|---|---|---|---|
| `fk_asistencia_alumno` | id_alumno | `alumno` (id_alumno) | RESTRICT |
| `fk_asistencia_sesion` | id_sesion | `sesion_clase` (id_sesion) | RESTRICT |

**Únicos:**

- `uq_asistencia_sesion_alumno`: UNIQUE (id_sesion, id_alumno)

**Restricciones CHECK:**

- `ck_asistencia_ausente_sin_hora`: `(((estado <> 'ausente'::estado_asistencia) OR (hora_registro IS NULL)))`
- `ck_asistencia_conteo`: `((conteo_detecciones >= 0))`
- `ck_asistencia_hora_presencia`: `(((estado <> ALL (ARRAY['presente'::estado_asistencia, 'retardo'::estado_asistencia])) OR (origen = 'correccion'::origen_asistencia) OR (hora_registro IS NOT NULL)))`
- `ck_asistencia_pendiente`: `(((estado <> 'pendiente'::estado_asistencia) OR ((origen = 'automatico'::origen_asistencia) AND (hora_registro IS NOT NULL) AND (conteo_detecciones > 0))))`

**Índices de apoyo:**

- `ix_asistencia_alumno`: `public.asistencia USING btree (id_alumno)`
- `ix_asistencia_estado`: `public.asistencia USING btree (estado) WHERE (estado = 'pendiente'::estado_asistencia)`

**Disparadores:**

- `trg_asistencia_ciclo`: `BEFORE INSERT OR UPDATE ON public.asistencia FOR EACH ROW EXECUTE FUNCTION app.trg_asistencia_ciclo()`
- `trg_asistencia_rn01`: `BEFORE INSERT OR UPDATE OF id_sesion, id_alumno ON public.asistencia FOR EACH ROW EXECUTE FUNCTION app.trg_asistencia_rn01()`

**Políticas RLS (3, todas SELECT):** `admin_ve_todo`, `alumno_ve_lo_propio`, `docente_ve_sus_grupos`

### justificante

**Propósito:** Soporte documental de una falta o un retardo.

**En la especificación:** sí · **Columnas:** 10 · **RLS:** habilitado

| # | Columna | Tipo | Nulo | Por omisión / generación |
|--:|---|---|:-:|---|
| 1 | `id_justificante` | integer | no | GENERATED ALWAYS AS IDENTITY |
| 2 | `id_sesion` | integer | no |  |
| 3 | `id_alumno` | integer | no |  |
| 4 | `motivo` | varchar(200) | no |  |
| 5 | `objeto_documento` | varchar(255) | no |  |
| 6 | `estatus` | estatus_justificante | no | `'pendiente'::estatus_justificante` |
| 7 | `registrado_por` | integer | no |  |
| 8 | `resuelto_por` | integer | sí |  |
| 9 | `fecha_registro` | timestamptz | no | `app.now()` |
| 10 | `fecha_resolucion` | timestamptz | sí |  |

**Llave primaria:** `pk_justificante` (id_justificante)

**Llaves foráneas:**

| Restricción | Columnas | Referencia | Al borrar |
|---|---|---|---|
| `fk_justificante_asistencia` | id_sesion, id_alumno | `asistencia` (id_sesion, id_alumno) | RESTRICT |
| `fk_justificante_registrado` | registrado_por | `usuario` (id_usuario) | RESTRICT |
| `fk_justificante_resuelto` | resuelto_por | `usuario` (id_usuario) | RESTRICT |

**Únicos:**

- `ux_justificante_pendiente` (índice único parcial): `public.justificante USING btree (id_sesion, id_alumno) WHERE (estatus = 'pendiente'::estatus_justificante)`

**Restricciones CHECK:**

- `ck_justificante_fechas`: `(((fecha_resolucion IS NULL) OR (fecha_resolucion >= fecha_registro)))`
- `ck_justificante_resolucion`: `(((estatus = 'pendiente'::estatus_justificante) = ((resuelto_por IS NULL) AND (fecha_resolucion IS NULL))))`

**Índices de apoyo:**

- `ix_justificante_asistencia`: `public.justificante USING btree (id_sesion, id_alumno)`
- `ix_justificante_estatus`: `public.justificante USING btree (estatus) WHERE (estatus = 'pendiente'::estatus_justificante)`

**Políticas RLS (2, todas SELECT):** `alumno_ve_lo_propio`, `docente_ve_sus_grupos`

## Área C · Captura y módulo biométrico

Fuente de las tablas: `0006_tablas_biometria.sql y 0235_plantilla_fotos.sql`.

### consentimiento

**Propósito:** Autorizacion firmada para el tratamiento del dato facial (RN-13).

**En la especificación:** sí · **Columnas:** 8 · **RLS:** habilitado

| # | Columna | Tipo | Nulo | Por omisión / generación |
|--:|---|---|:-:|---|
| 1 | `id_consent` | integer | no | GENERATED ALWAYS AS IDENTITY |
| 2 | `id_alumno` | integer | no |  |
| 3 | `fecha_firma` | date | no |  |
| 4 | `vigencia_hasta` | date | no |  |
| 5 | `objeto_documento` | varchar(255) | no |  |
| 6 | `estatus` | estatus_consentimiento | no | `'vigente'::estatus_consentimiento` |
| 7 | `origen` **[ext]** | varchar(14) | no | `'administrador'::character varying` |
| 8 | `version_aviso` **[ext]** | varchar(20) | sí |  |

Comentarios de columna (`COMMENT ON COLUMN`):

- `origen`: Quien lo registro: administrador (PDF firmado a mano que el admin sube) o alumno (aceptacion en la app con constancia PDF generada por el sistema).
- `version_aviso`: Version del aviso de privacidad biometrico que se acepto (solo origen alumno); NULL en los registrados por el administrador.

**Llave primaria:** `pk_consentimiento` (id_consent)

**Llaves foráneas:**

| Restricción | Columnas | Referencia | Al borrar |
|---|---|---|---|
| `fk_consentimiento_alumno` | id_alumno | `alumno` (id_alumno) | RESTRICT |

**Restricciones CHECK:**

- `ck_consentimiento_origen`: `(((origen)::text = ANY ((ARRAY['administrador'::character varying, 'alumno'::character varying])::text[])))`
- `ck_consentimiento_vigencia`: `((vigencia_hasta > fecha_firma))`

**Índices de apoyo:**

- `ix_consentimiento_alumno`: `public.consentimiento USING btree (id_alumno)`

**Políticas RLS (1, todas SELECT):** `admin_ve_todo`

### indice_faiss

**Propósito:** Version del indice vectorial guardada en el bucket (JSON). Una sola en_uso (ux_indice_faiss_en_uso).

**En la especificación:** sí · **Columnas:** 7 · **RLS:** habilitado

| # | Columna | Tipo | Nulo | Por omisión / generación |
|--:|---|---|:-:|---|
| 1 | `id_indice` | integer | no | GENERATED ALWAYS AS IDENTITY |
| 2 | `version` | varchar(12) | no |  |
| 3 | `dimension` | smallint | no |  |
| 4 | `objeto_indice` | varchar(255) | no |  |
| 5 | `total_vectores` | integer | no |  |
| 6 | `fecha_construccion` | timestamptz | no | `app.now()` |
| 7 | `en_uso` | boolean | no | `false` |

**Llave primaria:** `pk_indice_faiss` (id_indice)

**Llaves foráneas:** ninguna.

**Únicos:**

- `uq_indice_faiss_version`: UNIQUE (version)
- `ux_indice_faiss_en_uso` (índice único parcial): `public.indice_faiss USING btree (en_uso) WHERE en_uso`

**Restricciones CHECK:**

- `ck_indice_dimension`: `((dimension > 0))`
- `ck_indice_total`: `((total_vectores >= 0))`

**Políticas RLS (1, todas SELECT):** `admin_o_tecnico_ven_indices`

### plantilla_facial

**Propósito:** Referencia al vector de un alumno en el indice (RN-12). Trigger: trg_plantilla_rn13.

**En la especificación:** sí · **Columnas:** 9 · **RLS:** habilitado

| # | Columna | Tipo | Nulo | Por omisión / generación |
|--:|---|---|:-:|---|
| 1 | `id_plantilla` | integer | no | GENERATED ALWAYS AS IDENTITY |
| 2 | `id_alumno` | integer | no |  |
| 3 | `id_consent` | integer | no |  |
| 4 | `id_indice` | integer | sí |  |
| 5 | `faiss_id` | bigint | sí |  |
| 6 | `objeto_foto` | varchar(255) | sí |  |
| 7 | `fecha_registro` | timestamptz | no | `app.now()` |
| 8 | `activa` | boolean | no | `true` |
| 9 | `origen` **[ext]** | varchar(14) | no | `'administrador'::character varying` |

Comentarios de columna (`COMMENT ON COLUMN`):

- `objeto_foto`: Ruta de la foto principal en el bucket mientras el vector no esta en un indice activado; NULL cuando la foto ya no se conserva (extension 18). El vector vive solo en el JSON del indice.
- `origen`: Quien registro el rostro: administrador o alumno (autoservicio). Informativo y auditable; no cambia ninguna regla de reconocimiento.

**Llave primaria:** `pk_plantilla_facial` (id_plantilla)

**Llaves foráneas:**

| Restricción | Columnas | Referencia | Al borrar |
|---|---|---|---|
| `fk_plantilla_alumno` | id_alumno | `alumno` (id_alumno) | RESTRICT |
| `fk_plantilla_consent` | id_consent | `consentimiento` (id_consent) | RESTRICT |
| `fk_plantilla_indice` | id_indice | `indice_faiss` (id_indice) | RESTRICT |

**Únicos:**

- `uq_plantilla_indice_faiss_id`: UNIQUE (id_indice, faiss_id)
- `ux_plantilla_facial_activa` (índice único parcial): `public.plantilla_facial USING btree (id_alumno) WHERE activa`

**Restricciones CHECK:**

- `ck_plantilla_faiss_id`: `(((faiss_id IS NULL) OR (faiss_id >= 0)))`
- `ck_plantilla_indexada`: `(((id_indice IS NULL) = (faiss_id IS NULL)))`
- `ck_plantilla_origen`: `(((origen)::text = ANY ((ARRAY['administrador'::character varying, 'alumno'::character varying])::text[])))`

**Índices de apoyo:**

- `ix_plantilla_alumno`: `public.plantilla_facial USING btree (id_alumno)`
- `ix_plantilla_consent`: `public.plantilla_facial USING btree (id_consent)`

**Disparadores:**

- `trg_plantilla_foto_principal`: `AFTER INSERT OR UPDATE OF objeto_foto ON public.plantilla_facial FOR EACH ROW EXECUTE FUNCTION app.trg_plantilla_foto_principal()`
- `trg_plantilla_rn13`: `BEFORE INSERT OR UPDATE OF id_consent, id_alumno, activa ON public.plantilla_facial FOR EACH ROW EXECUTE FUNCTION app.trg_plantilla_rn13()`

**Políticas RLS (2, todas SELECT):** `admin_ve_todo`, `docente_ve_sus_grupos`

### plantilla_foto

**Propósito:** Fotos que componen una plantilla facial (extension 17). orden 1 = foto principal = plantilla_facial.objeto_foto. Solo rutas objeto_* y escalares: ningun vector ni imagen (RNF-03). El estado archivada/activa es el de la plantilla padre.

**En la especificación:** no (tabla agregada después del Avance 1) · **Columnas:** 6 · **RLS:** habilitado

| # | Columna | Tipo | Nulo | Por omisión / generación |
|--:|---|---|:-:|---|
| 1 | `id_foto` | integer | no | GENERATED ALWAYS AS IDENTITY |
| 2 | `id_plantilla` | integer | no |  |
| 3 | `orden` | smallint | no |  |
| 4 | `objeto_foto` | varchar(255) | sí |  |
| 5 | `calidad` | jsonb | sí |  |
| 6 | `coseno_resto` | numeric(4,3) | sí |  |

Comentarios de columna (`COMMENT ON COLUMN`):

- `objeto_foto`: Ruta de la foto en el bucket mientras el vector no esta en un indice activado; NULL cuando la foto ya no se conserva (extension 18).
- `calidad`: {brillo, nitidez, tamano_rostro_px, frontal} medidas por el servicio de reconocimiento al registrar; NULL en plantillas anteriores. Informativo.
- `coseno_resto`: Coseno medio de la foto contra las demas fotos aceptadas, medido por el servicio al registrar; NULL en plantillas de una foto. Informativo, no verificable en SQL.

**Llave primaria:** `pk_plantilla_foto` (id_foto)

**Llaves foráneas:**

| Restricción | Columnas | Referencia | Al borrar |
|---|---|---|---|
| `fk_plantilla_foto_plantilla` | id_plantilla | `plantilla_facial` (id_plantilla) | RESTRICT |

**Únicos:**

- `uq_plantilla_foto_orden`: UNIQUE (id_plantilla, orden)

**Restricciones CHECK:**

- `ck_plantilla_foto_calidad`: `(app.calidad_foto_valida(calidad))`
- `ck_plantilla_foto_coseno`: `(((coseno_resto IS NULL) OR ((coseno_resto >= ('-1'::integer)::numeric) AND (coseno_resto <= (1)::numeric))))`
- `ck_plantilla_foto_orden`: `(((orden >= 1) AND (orden <= 8)))`

**Políticas RLS (1, todas SELECT):** `admin_ve_todo`

### camara

**Propósito:** Camara fija (ip) o webcam del navegador (navegador) de un aula; determina el modo de la sesion (RN-06).

**En la especificación:** sí · **Columnas:** 6 · **RLS:** habilitado

| # | Columna | Tipo | Nulo | Por omisión / generación |
|--:|---|---|:-:|---|
| 1 | `id_camara` | integer | no | GENERATED ALWAYS AS IDENTITY |
| 2 | `id_aula` | integer | no |  |
| 3 | `posicion` | posicion_camara | no |  |
| 4 | `tipo` **[ext]** | tipo_camara | no | `'ip'::tipo_camara` |
| 5 | `direccion_ip` | varchar(45) | sí |  |
| 6 | `estatus` | estatus_camara | no | `'activa'::estatus_camara` |

**Llave primaria:** `pk_camara` (id_camara)

**Llaves foráneas:**

| Restricción | Columnas | Referencia | Al borrar |
|---|---|---|---|
| `fk_camara_aula` | id_aula | `aula` (id_aula) | RESTRICT |

**Únicos:**

- `uq_camara_aula_posicion`: UNIQUE (id_aula, posicion)
- `uq_camara_direccion_ip`: UNIQUE (direccion_ip)

**Restricciones CHECK:**

- `ck_camara_ip`: `(((tipo <> 'ip'::tipo_camara) OR (direccion_ip IS NOT NULL)))`

**Índices de apoyo:**

- `ix_camara_aula`: `public.camara USING btree (id_aula)`

**Políticas RLS (2, todas SELECT):** `admin_o_tecnico_ven_camaras`, `docente_ve_sus_grupos`

### captura

**Propósito:** Toma de una camara durante una sesion; la imagen completa no se almacena. Trigger: trg_captura_rn06.

**En la especificación:** sí · **Columnas:** 5 · **RLS:** habilitado

| # | Columna | Tipo | Nulo | Por omisión / generación |
|--:|---|---|:-:|---|
| 1 | `id_captura` | bigint | no | GENERATED ALWAYS AS IDENTITY |
| 2 | `id_camara` | integer | no |  |
| 3 | `id_sesion` | integer | no |  |
| 4 | `marca_tiempo` | timestamptz | no |  |
| 5 | `rostros_detectados` | smallint | no | `0` |

**Llave primaria:** `pk_captura` (id_captura)

**Llaves foráneas:**

| Restricción | Columnas | Referencia | Al borrar |
|---|---|---|---|
| `fk_captura_camara` | id_camara | `camara` (id_camara) | RESTRICT |
| `fk_captura_sesion` | id_sesion | `sesion_clase` (id_sesion) | RESTRICT |

**Únicos:**

- `uq_captura_camara_marca`: UNIQUE (id_camara, marca_tiempo)

**Restricciones CHECK:**

- `ck_captura_rostros`: `((rostros_detectados >= 0))`

**Índices de apoyo:**

- `ix_captura_sesion`: `public.captura USING btree (id_sesion)`

**Disparadores:**

- `trg_captura_rn06`: `BEFORE INSERT OR UPDATE OF id_camara, id_sesion ON public.captura FOR EACH ROW EXECUTE FUNCTION app.trg_captura_rn06()`

**Políticas RLS (1, todas SELECT):** `docente_ve_sus_grupos`

### deteccion

**Propósito:** Rostro leido dentro de una captura; guarda el vecino mas cercano aunque no alcance el umbral.

**En la especificación:** sí · **Columnas:** 6 · **RLS:** habilitado

| # | Columna | Tipo | Nulo | Por omisión / generación |
|--:|---|---|:-:|---|
| 1 | `id_deteccion` | bigint | no | GENERATED ALWAYS AS IDENTITY |
| 2 | `id_captura` | bigint | no |  |
| 3 | `id_plantilla` | integer | sí |  |
| 4 | `score_similitud` | numeric(4,3) | sí |  |
| 5 | `es_valida` | boolean | no | `false` |
| 6 | `objeto_recorte` | varchar(255) | sí |  |

**Llave primaria:** `pk_deteccion` (id_deteccion)

**Llaves foráneas:**

| Restricción | Columnas | Referencia | Al borrar |
|---|---|---|---|
| `fk_deteccion_captura` | id_captura | `captura` (id_captura) | RESTRICT |
| `fk_deteccion_plantilla` | id_plantilla | `plantilla_facial` (id_plantilla) | RESTRICT |

**Restricciones CHECK:**

- `ck_deteccion_candidato`: `((((id_plantilla IS NULL) AND (score_similitud IS NULL) AND (es_valida = false)) OR ((id_plantilla IS NOT NULL) AND (score_similitud IS NOT NULL))))`
- `ck_deteccion_score`: `(((score_similitud IS NULL) OR ((score_similitud >= (0)::numeric) AND (score_similitud <= (1)::numeric))))`

**Índices de apoyo:**

- `ix_deteccion_captura`: `public.deteccion USING btree (id_captura)`
- `ix_deteccion_plantilla`: `public.deteccion USING btree (id_plantilla)`

**Políticas RLS (1, todas SELECT):** `docente_ve_sus_grupos`

## Área D · Seguridad y configuración

Fuente de las tablas: `0004_tablas_seguridad.sql`.

### usuario

**Propósito:** Cuenta de acceso vinculada a Supabase Auth (auth_uid); la contrasena nunca se guarda aqui.

**En la especificación:** sí · **Columnas:** 7 · **RLS:** habilitado

| # | Columna | Tipo | Nulo | Por omisión / generación |
|--:|---|---|:-:|---|
| 1 | `id_usuario` | integer | no | GENERATED ALWAYS AS IDENTITY |
| 2 | `auth_uid` | uuid | no |  |
| 3 | `correo` | varchar(120) | no |  |
| 4 | `rol` | rol_usuario | no |  |
| 5 | `id_docente` | integer | sí |  |
| 6 | `id_alumno` | integer | sí |  |
| 7 | `activo` | boolean | no | `true` |

**Llave primaria:** `pk_usuario` (id_usuario)

**Llaves foráneas:**

| Restricción | Columnas | Referencia | Al borrar |
|---|---|---|---|
| `fk_usuario_alumno` | id_alumno | `alumno` (id_alumno) | RESTRICT |
| `fk_usuario_docente` | id_docente | `docente` (id_docente) | RESTRICT |

**Únicos:**

- `uq_usuario_alumno`: UNIQUE (id_alumno)
- `uq_usuario_auth_uid`: UNIQUE (auth_uid)
- `uq_usuario_correo`: UNIQUE (correo)
- `uq_usuario_docente`: UNIQUE (id_docente)

**Restricciones CHECK:**

- `ck_usuario_alumno`: `(((rol = 'alumno'::rol_usuario) = (id_alumno IS NOT NULL)))`
- `ck_usuario_docente`: `(((rol = 'docente'::rol_usuario) = (id_docente IS NOT NULL)))`

**Políticas RLS (2, todas SELECT):** `admin_ve_todo`, `usuario_ve_su_cuenta`

### bitacora_auditoria

**Propósito:** Registro de solo insercion de acciones sensibles (RNF-08). Se escribe unicamente con app.bitacora().

**En la especificación:** sí · **Columnas:** 9 · **RLS:** habilitado

| # | Columna | Tipo | Nulo | Por omisión / generación |
|--:|---|---|:-:|---|
| 1 | `id_bitacora` | bigint | no | GENERATED ALWAYS AS IDENTITY |
| 2 | `id_usuario` | integer | no |  |
| 3 | `accion` | accion_bitacora | no |  |
| 4 | `entidad` | varchar(40) | no |  |
| 5 | `id_registro` | bigint | no |  |
| 6 | `valor_anterior` | jsonb | sí |  |
| 7 | `valor_nuevo` | jsonb | sí |  |
| 8 | `fecha_hora` | timestamptz | no | `app.now()` |
| 9 | `ip_origen` | varchar(45) | sí |  |

**Llave primaria:** `pk_bitacora_auditoria` (id_bitacora)

**Llaves foráneas:**

| Restricción | Columnas | Referencia | Al borrar |
|---|---|---|---|
| `fk_bitacora_usuario` | id_usuario | `usuario` (id_usuario) | RESTRICT |

**Restricciones CHECK:**

- `ck_bitacora_entidad`: `(((entidad)::text = ANY ((ARRAY['alumno'::character varying, 'docente'::character varying, 'materia'::character varying, 'aula'::character varying, 'grupo'::character varying, 'horario_grupo'::character varying, 'inscripcion'::character varying, 'sesion_clase'::character varying, 'asistencia'::character varying, 'justificante'::character varying, 'consentimiento'::character varying, 'indice_faiss'::character varying, 'plantilla_facial'::character varying, 'camara'::character varying, 'captura'::character varying, 'deteccion'::character varying, 'usuario'::character varying, 'parametro_sistema'::character varying])::text[])))`
- `ck_bitacora_valores`: `(((accion <> ALL (ARRAY['correccion'::accion_bitacora, 'cambio_parametro'::accion_bitacora])) OR ((valor_anterior IS NOT NULL) AND (valor_nuevo IS NOT NULL))))`

**Índices de apoyo:**

- `ix_bitacora_entidad`: `public.bitacora_auditoria USING btree (entidad, id_registro)`
- `ix_bitacora_fecha`: `public.bitacora_auditoria USING btree (fecha_hora)`
- `ix_bitacora_usuario`: `public.bitacora_auditoria USING btree (id_usuario)`

**Disparadores:**

- `trg_bitacora_sin_cambios` (ENABLE ALWAYS): `BEFORE DELETE OR UPDATE ON public.bitacora_auditoria FOR EACH ROW EXECUTE FUNCTION app.trg_bitacora_sin_cambios()`
- `trg_bitacora_sin_truncate` (ENABLE ALWAYS): `BEFORE TRUNCATE ON public.bitacora_auditoria FOR EACH STATEMENT EXECUTE FUNCTION app.trg_bitacora_sin_truncate()`

**Políticas RLS (1, todas SELECT):** `admin_ve_todo`

### parametro_sistema

**Propósito:** Parametros configurables del sistema (spec Tabla 4); el valor se guarda en texto.

**En la especificación:** sí · **Columnas:** 5 · **RLS:** habilitado

| # | Columna | Tipo | Nulo | Por omisión / generación |
|--:|---|---|:-:|---|
| 1 | `clave` | varchar(40) | no |  |
| 2 | `valor` | varchar(40) | no |  |
| 3 | `descripcion` | varchar(200) | no |  |
| 4 | `actualizado_por` | integer | sí |  |
| 5 | `fecha_actualizacion` | timestamptz | no | `app.now()` |

**Llave primaria:** `pk_parametro_sistema` (clave)

**Llaves foráneas:**

| Restricción | Columnas | Referencia | Al borrar |
|---|---|---|---|
| `fk_parametro_usuario` | actualizado_por | `usuario` (id_usuario) | RESTRICT |

**Políticas RLS (1, todas SELECT):** `admin_o_tecnico_ven_parametros`

## Tipos enumerados (dominios cerrados)

La base define 14 tipos `ENUM` en `public` (13 de la especificación, Tabla 13, más `tipo_camara`). Se usan como dominio cerrado de las columnas indicadas.

| Tipo | Valores | Columnas que lo usan |
|---|---|---|
| `accion_bitacora` | `consulta`, `correccion`, `aprobacion_justificante`, `rechazo_justificante`, `alta_plantilla`, `cambio_parametro`, `cierre_sesion`, `notificacion`, `alta_consentimiento`, `revocacion_consentimiento` | bitacora_auditoria.accion |
| `estado_asistencia` | `presente`, `retardo`, `ausente`, `pendiente`, `justificado` | asistencia.estado |
| `estatus_alumno` | `activo`, `baja_temporal`, `baja_definitiva`, `egresado` | alumno.estatus |
| `estatus_camara` | `activa`, `inactiva`, `mantenimiento` | camara.estatus |
| `estatus_consentimiento` | `vigente`, `revocado`, `vencido` | consentimiento.estatus |
| `estatus_docente` | `activo`, `licencia`, `baja` | docente.estatus |
| `estatus_inscripcion` | `activa`, `baja` | inscripcion.estatus |
| `estatus_justificante` | `pendiente`, `aprobado`, `rechazado` | justificante.estatus |
| `estatus_sesion` | `programada`, `abierta`, `cerrada`, `suspendida` | sesion_clase.estatus |
| `modo_registro_sesion` | `automatico`, `manual` | sesion_clase.modo_registro |
| `origen_asistencia` | `automatico`, `manual`, `correccion` | asistencia.origen |
| `posicion_camara` | `frente`, `fondo` | camara.posicion |
| `rol_usuario` | `administrador`, `docente`, `alumno`, `tecnico` | usuario.rol |
| `tipo_camara` | `ip`, `navegador` | camara.tipo |

## Vista

### v_resumen_asistencia

**Propósito:** Acumulados por inscripcion (RF-13/14, RN-10/11): conteos por estado, faltas_equivalentes = ausencias + floor(retardos/retardos_por_ausencia), porcentaje_faltas sobre sesiones PROGRAMADAS (no suspendidas), supera_limite, en_limite y faltas_restantes_antes_limite. security_invoker.

| # | Columna | Tipo |
|--:|---|---|
| 1 | `id_inscripcion` | integer |
| 2 | `id_alumno` | integer |
| 3 | `id_grupo` | integer |
| 4 | `estatus_inscripcion` | estatus_inscripcion |
| 5 | `derecho_examen` | boolean |
| 6 | `sesiones_programadas` | integer |
| 7 | `presentes` | integer |
| 8 | `retardos` | integer |
| 9 | `ausencias` | integer |
| 10 | `justificadas` | integer |
| 11 | `pendientes` | integer |
| 12 | `faltas_equivalentes` | integer |
| 13 | `porcentaje_faltas` | numeric |
| 14 | `porcentaje` | numeric |
| 15 | `limite_pct` | numeric |
| 16 | `supera_limite` | boolean |
| 17 | `faltas_maximas_permitidas` | integer |
| 18 | `faltas_restantes_antes_limite` | integer |
| 19 | `en_limite` | boolean |

La vista no almacena datos: se calcula en cada consulta (spec 3.4) y se crea con `security_invoker`, de modo que la RLS de quien consulta decide qué filas ve.

## Tablas internas del esquema `app` (no expuestas por la API)

### app.bloqueo

**Propósito:** Arrendamientos con vencimiento (indice FAISS, jobs). Solo via app.bloqueo_adquirir/liberar.

**RLS:** habilitado (sin políticas: ningún rol de la API accede)

| # | Columna | Tipo | Nulo | Por omisión |
|--:|---|---|:-:|---|
| 1 | `clave` | varchar(80) | no |  |
| 2 | `dueno` | varchar(80) | no |  |
| 3 | `vence` | timestamptz | no |  |

**Restricciones:**

- `pk_bloqueo`: `PRIMARY KEY (clave)`

### app.reloj_demo

**Propósito:** Reloj de demostración para bases donde no se puede usar ALTER DATABASE SET (Supabase). Una fila = reloj simulado activo. Solo el dueño de la base la escribe.

**RLS:** no habilitado; los privilegios se revocan a los roles de la API (migración 0236)

| # | Columna | Tipo | Nulo | Por omisión |
|--:|---|---|:-:|---|
| 1 | `id` | boolean | no | `true` |
| 2 | `fake_now` | timestamptz | no |  |

**Restricciones:**

- `reloj_demo_id_check`: `CHECK (id)`
- `reloj_demo_pkey`: `PRIMARY KEY (id)`

## Esquemas `auth`, `storage` y `supabase_migrations` en la base local

Esas tablas (`auth.users`, `storage.buckets`, `storage.objects`, `supabase_migrations.schema_migrations`, `supabase_migrations.seed_runs`)
las emula `supabase/local/00_supabase_stubs.sql` solo en PostgreSQL local; en Supabase real las provee la plataforma. No forman
parte del modelo de SUSAN y por eso no se documentan aquí.
