# SUSAN · Base de datos: resumen verificado

Material para la sección «Esquema de base de datos y código de base de datos» del reporte de avances. Todo sale de la base viva (PostgreSQL 16.14, base `susan`, 43 de 43 migraciones aplicadas) y de las migraciones del commit `f742bb4` de `origin/main`. Generado el 2026-10-30 04:23 UTC con `generar-resumen.mjs`; las consultas están en la tabla de la sección 1.

## 1. Cifras verificadas

Consultas ejecutadas con `psql` contra el catálogo de PostgreSQL (`pg_class`, `pg_attribute`, `pg_constraint`, `pg_index`, `pg_proc`, `pg_trigger`, `pg_policies`, `pg_enum`). La columna «Consulta» es el SQL exacto que se ejecutó.

| Concepto | Valor | Consulta |
|---|--:|---|
| Esquemas (sin los del sistema) | **6** | `select count(*) from pg_namespace where nspname not like 'pg\_%' and nspname <> 'information_schema'` |
| Tablas base en `public` | **20** | `select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'` |
| Vistas en `public` | **1** | `select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'v'` |
| Tablas base en `app` (internas) | **2** | `select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'app' and c.relkind = 'r'` |
| Columnas de las tablas de `public` | **135** | `select count(*) from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped` |
| Columnas NOT NULL | **113** | `select count(*) from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped and a.attnotnull` |
| Columnas GENERATED ALWAYS AS IDENTITY | **19** | `select count(*) from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped and a.attidentity = 'a'` |
| Columnas binarias o de arreglo (RNF-03) | **0** | `select count(*) from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped and exists (select 1 from pg_type t where t.oid = a.atttypid and (t.typname = 'bytea' or t.typcategory = 'A'))` |
| Llaves primarias | **20** | `select count(*) from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname = 'public' and c.contype = 'p'` |
| Llaves foráneas | **26** | `select count(*) from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname = 'public' and c.contype = 'f'` |
|   de ellas ON DELETE RESTRICT | **25** | `select count(*) from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname = 'public' and c.contype = 'f' and c.confdeltype = 'r'` |
|   de ellas ON DELETE CASCADE | **1** | `select count(*) from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname = 'public' and c.contype = 'f' and c.confdeltype = 'c'` |
| Restricciones UNIQUE | **21** | `select count(*) from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname = 'public' and c.contype = 'u'` |
| Restricciones CHECK | **35** | `select count(*) from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname = 'public' and c.contype = 'c'` |
| Índices en `public` (todos) | **64** | `select count(*) from pg_index i join pg_class t on t.oid = i.indrelid join pg_namespace n on n.oid = t.relnamespace where n.nspname = 'public'` |
|   únicos parciales (sin restricción) | **3** | `select count(*) from pg_index i join pg_class t on t.oid = i.indrelid join pg_namespace n on n.oid = t.relnamespace where n.nspname = 'public' and i.indisunique and i.indpred is not null` |
|   de apoyo no únicos (ix_*) | **20** | `select count(*) from pg_index i join pg_class t on t.oid = i.indrelid join pg_namespace n on n.oid = t.relnamespace where n.nspname = 'public' and not i.indisunique` |
| Tipos ENUM | **14** | `select count(distinct t.oid) from pg_type t join pg_namespace n on n.oid = t.typnamespace join pg_enum e on e.enumtypid = t.oid where n.nspname = 'public'` |
| Valores en total de los ENUM | **50** | `select count(*) from pg_enum e join pg_type t on t.oid = e.enumtypid join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public'` |
| Funciones en `public` (RPC) | **98** | `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'` |
|   prefijo api_ (las llama la interfaz) | **76** | `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'api\_%'` |
|   prefijo svc_ (solo service_role) | **22** | `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'svc\_%'` |
|   SECURITY DEFINER | **60** | `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef` |
|   SECURITY INVOKER | **38** | `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and not p.prosecdef` |
| Funciones en `app` (lógica interna) | **87** | `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app'` |
|   de ellas funciones de disparador (trg_*) | **7** | `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.prorettype = 'trigger'::regtype` |
| Disparadores (no internos) en `public` | **7** | `select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where not t.tgisinternal and n.nspname = 'public'` |
| Tablas con RLS habilitado en `public` | **20** | `select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity` |
| Políticas RLS en `public` | **39** | `select count(*) from pg_policies where schemaname = 'public'` |
| Políticas en `storage` (RESTRICTIVE) | **1** | `select count(*) from pg_policies where schemaname = 'storage'` |
| Privilegios de `anon` sobre tablas de `public` | **0** | `select count(*) from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon'` |
| Privilegios de `authenticated` distintos de SELECT | **0** | `select count(*) from information_schema.role_table_grants where table_schema = 'public' and grantee = 'authenticated' and privilege_type <> 'SELECT'` |
| `service_role` puede INSERT en bitacora_auditoria (0 = no) | **0** | `select has_table_privilege('service_role', 'public.bitacora_auditoria', 'INSERT')::int` |
| Parámetros en parametro_sistema | **12** | `select count(*) from public.parametro_sistema` |
| Migraciones registradas | **43** | `select count(*) from supabase_migrations.schema_migrations` |

Esquemas que existen en la base local: `app`, `public`, `extensions` (pgcrypto y pg_trgm) y, solo en local, `auth`, `storage` y `supabase_migrations`, que emula `supabase/local/00_supabase_stubs.sql` (en Supabase real los provee la plataforma). El modelo de SUSAN vive en `public` y `app`.

Nombres de restricciones e índices por prefijo (convención del proyecto): `ck_` 35 · `fk_` 26 · `ix_` 20 · `pk_` 20 · `uq_` 21 · `ux_` 3. Solo objetos del esquema `public`; los índices que respaldan una restricción (PK, UNIQUE) se cuentan como la restricción.

### Datos de demostración cargados en la base de esta verificación

Tras la semilla y `seed-demo.sh --reset` (datos ficticios `@susan.local`; no son datos reales). La columna «Semilla» excluye las filas de prueba con prefijo `ZZ`; «Ahora» es el total que tiene la base en el momento de generar este documento.

| Tabla | Semilla | Ahora | Tabla | Semilla | Ahora |
|---|--:|--:|---|--:|--:|
| `alumno` | 75 | 76 | `asistencia` | 1296 | 1296 |
| `aula` | 2 | 3 | `bitacora_auditoria` | 147 | 147 |
| `camara` | 4 | 5 | `captura` | 13 | 13 |
| `consentimiento` | 77 | 77 | `deteccion` | 199 | 199 |
| `docente` | 3 | 4 | `grupo` | 3 | 4 |
| `horario_grupo` | 9 | 12 | `indice_faiss` | 1 | 1 |
| `inscripcion` | 75 | 75 | `justificante` | 20 | 20 |
| `materia` | 4 | 5 | `parametro_sistema` | 12 | 12 |
| `plantilla_facial` | 75 | 75 | `plantilla_foto` | 75 | 75 |
| `sesion_clase` | 146 | 146 | `usuario` | 31 | 31 |

**Aviso:** la base compartida contiene filas de prueba con prefijo ZZ (alumno `ZZPRUEBA1`; docente `ZZD01`; materia `ZZP101`; aula `ZZ-P1`; grupo `ZZ1`; además una cámara y 3 bloques de horario del grupo de prueba). No pertenecen a la semilla; parecen haberse creado desde los formularios de administración mientras se preparaba este reporte (no se verificó quién las creó) y no se borraron. Las cifras de esquema (tablas, columnas, restricciones, funciones) no dependen de las filas.

## 2. Cómo está organizada la base

**Dos esquemas propios.** `public` guarda las tablas y las funciones que la aplicación puede llamar (`api_*` para la interfaz, `svc_*` solo para el servicio de reconocimiento y los trabajos programados). `app` guarda la lógica interna (reloj único, identidad y rol del usuario, funciones de disparador, núcleos de las RPC) y no se expone por la API. Por regla del proyecto (`CLAUDE.md`), la interfaz no consulta tablas: usa las RPC.

**Cuatro áreas funcionales** (las mismas de la especificación, con una tabla más en el área C):

| Área | Qué guarda | Tablas (filas de la semilla) |
|---|---|---|
| A · Catálogo académico | Quién, qué, dónde y cuándo se enseña: personas, materias, aulas, grupos, horarios e inscripciones. | alumno (75), docente (3), materia (4), aula (2), grupo (3), horario_grupo (9), inscripcion (75) |
| B · Operación de la clase | Lo que ocurre en cada clase: la sesión, el registro de asistencia por alumno y los justificantes. | sesion_clase (146), asistencia (1296), justificante (20) |
| C · Captura y módulo biométrico | Consentimiento, plantillas faciales (y sus fotos), versiones del índice FAISS, cámaras, capturas y detecciones. No hay vectores ni imágenes: solo rutas y números. | consentimiento (77), indice_faiss (1), plantilla_facial (75), plantilla_foto (75), camara (4), captura (13), deteccion (199) |
| D · Seguridad y configuración | Cuentas de acceso (ligadas a Supabase Auth), parámetros calibrables y bitácora de auditoría. | usuario (31), bitacora_auditoria (147), parametro_sistema (12) |

**El eje del modelo** es `asistencia`: una fila por alumno y sesión (`uq_asistencia_sesion_alumno`). Se llega a ella desde `inscripcion` (alumno en grupo), `sesion_clase` (una clase concreta generada del `horario_grupo`) y, en el caso automático, desde `captura` y `deteccion` (lo que vio la cámara). `justificante` se cuelga de la asistencia con una llave compuesta (`fk_justificante_asistencia`), de modo que solo se justifica un registro que existe. `v_resumen_asistencia` es una vista, no una tabla: calcula faltas equivalentes y porcentaje en cada consulta.

**La lógica de negocio vive en PostgreSQL.** Hay 98 funciones en `public` (76 `api_*` y 22 `svc_*`), 87 en `app` y 7 disparadores. Las RPC de escritura son `SECURITY DEFINER` y comprueban rol y pertenencia al principio (`app.exigir_rol`); la mayoría de las lecturas son `SECURITY INVOKER` y dejan que la RLS decida qué filas ve cada quien (algunas lecturas agregadas son DEFINER con comprobación explícita de rol). Las funciones que escriben en `bitacora_auditoria` lo hacen con `app.bitacora()`: cierres de sesión, correcciones, aprobación o rechazo de justificantes, consultas auditadas, cambios de parámetro y altas o revocaciones de consentimiento.

**Seguridad por diseño.** Las 20 tablas de `public` tienen RLS (39 políticas, todas `SELECT` para el rol `authenticated`). `anon` no tiene ningún privilegio sobre las tablas (0 concesiones); `authenticated` solo tiene SELECT (0 concesiones de otro tipo; toda escritura pasa por RPC); `service_role` es la cuenta de los servicios y tampoco puede escribir en la bitácora (INSERT = 0). Por RNF-03 no hay columnas binarias ni de arreglo (0 en las 135 columnas); la biometría se limita a `faiss_id` y rutas `objeto_*`.

**Bajas lógicas y evidencia protegida.** Todas las llaves foráneas son `ON DELETE RESTRICT` salvo `fk_horario_grupo` (CASCADE: el horario es parte de la definición del grupo). No se borra en cascada ninguna evidencia (captura, detección, asistencia, justificante, bitácora).

**Reloj único.** Toda la lógica usa `app.now()` y no `now()` directamente; así las pruebas y la demostración pueden fijar la hora (solo en bases locales o de demostración).

## 3. Reglas de negocio que aplica la base

Cada nombre de la tabla se comprobó contra el catálogo de la base viva (el script falla si alguno no existe). Los rechazos de los disparadores empiezan con el nombre de la regla y devuelven `ERRCODE 23514` con `CONSTRAINT = <regla>`, igual que un CHECK; la bitácora usa `23000`.

| Regla | Qué exige | Mecanismo real en la base (nombres del catálogo) |
|---|---|---|
| RN-01 | Solo hay asistencia en grupos con inscripción activa. | disparador `trg_asistencia_rn01`; error `rn01_asistencia_inscripcion_activa`; restricción `uq_inscripcion_alumno_grupo` |
| RN-02 | Un solo registro de asistencia por alumno y sesión. | restricción `uq_asistencia_sesion_alumno` |
| RN-03 | Presente en los primeros 10 min, retardo hasta el minuto 20 (por la primera lectura válida). | función `app.estado_por_minuto`; restricción `ck_sesion_ventana`; restricción `ck_asistencia_hora_presencia`; parámetro `limite_presente_min`; parámetro `tolerancia_min` |
| RN-04 | Una lectura se atribuye solo si su score alcanza el umbral (0.850). | parámetro `umbral_similitud`; restricción `ck_deteccion_score`; restricción `ck_deteccion_candidato`; función `public.svc_registrar_detecciones` |
| RN-05 | Se confirma con al menos 3 lecturas válidas; con 1 o 2 queda pendiente. | disparador `trg_asistencia_ciclo`; error `rn05_asistencia_confirmacion_lecturas`; restricción `ck_asistencia_pendiente`; parámetro `min_detecciones_validas` |
| RN-06 | La cámara de una captura es del aula del grupo; sin cámaras activas, pase manual. | disparador `trg_captura_rn06`; error `rn06_captura_camara_aula`; error `rn06_asistencia_automatico_en_sesion_manual`; restricción `uq_camara_aula_posicion`; función `public.api_abrir_sesion` |
| RN-07 | Al cerrar la sesión, los inscritos sin registro quedan ausentes. | función `app.cerrar_sesion`; función `public.api_cerrar_sesion`; función `public.svc_job_cerrar_sesiones` |
| RN-08 | Corrección hasta 48 h después de la sesión, con valor anterior y nuevo en bitácora. | función `app.limite_correccion`; parámetro `horas_limite_correccion`; restricción `ck_bitacora_valores`; función `public.api_corregir_asistencia` |
| RN-09 | Un justificante aprobado pasa el registro a justificado sin borrarlo ni borrar sus lecturas. | restricción `fk_justificante_asistencia`; error `rn09_asistencia_justificado_inmutable`; índice `ux_justificante_pendiente`; restricción `ck_justificante_resolucion`; función `public.api_resolver_justificante` |
| RN-10 | Tres retardos equivalen a una ausencia. | vista `v_resumen_asistencia`; parámetro `retardos_por_ausencia` |
| RN-11 | Superar el 20 % de faltas equivalentes quita el derecho a examen. | vista `v_resumen_asistencia`; función `app.recalcular_inscripcion`; parámetro `porcentaje_max_ausencias` |
| RN-12 | Una sola plantilla activa por alumno y una sola versión del índice en uso. | índice `ux_plantilla_facial_activa`; índice `ux_indice_faiss_en_uso`; restricción `uq_plantilla_indice_faiss_id`; restricción `ck_plantilla_indexada` |
| RN-13 | No hay plantilla sin consentimiento propio, vigente y en fecha. | disparador `trg_plantilla_rn13`; error `rn13_plantilla_consentimiento_vencido`; restricción `fk_plantilla_consent`; restricción `ck_consentimiento_vigencia` |
| RNF-08 | La bitácora de auditoría es de solo inserción. | disparador `trg_bitacora_sin_cambios`; disparador `trg_bitacora_sin_truncate`; política `admin_ve_todo@bitacora_auditoria` |

Notas: (a) los parámetros (`umbral_similitud`, `limite_presente_min`, etc.) están en `parametro_sistema` y no en el código; la sesión copia `tolerancia_min`, `limite_presente_min` e `intervalo_muestreo_seg` al programarse, de modo que un ajuste posterior no altera las sesiones ya registradas. (b) La especificación (3.4.3) deja las reglas que dependen de la hora o del usuario autenticado (apertura en horario RN-06, plazo de 48 h RN-08) a la capa de servicios; en la base viven dentro de funciones (`api_abrir_sesion`, `app.limite_correccion`), no como CHECK.

## 4. Diferencias frente a la especificación (Avance 1)

La especificación (`docs/spec/Avance1.txt`) describe **19 tablas**. La base actual tiene **20**, más una vista. Cifras de la spec tomadas de sus secciones 3.4.1 (esquema relacional, que este material parseó y comparó columna por columna), 3.4.3 y OE-3; cifras actuales, de la base viva.

| Elemento | Spec (Avance 1) | Base actual | Qué cambió |
|---|--:|--:|---|
| Tablas | 19 | **20** | + plantilla_foto (migración 0235, extensión 17) |
| Atributos (columnas) | 125 | **135** | + camara.tipo, consentimiento.origen, consentimiento.version_aviso, plantilla_facial.origen y las 6 de plantilla_foto |
| Llaves primarias | 19 | **20** | + pk_plantilla_foto |
| Llaves foráneas | 25 | **26** | + fk_plantilla_foto_plantilla |
| Restricciones UNIQUE | 20 | **21** | + uq_plantilla_foto_orden |
| Restricciones CHECK | 29 | **35** | + ck_camara_ip, ck_consentimiento_origen, ck_plantilla_origen y 3 de plantilla_foto |
| Índices únicos parciales | 2 | **3** | + ux_justificante_pendiente (migración 0120) |
| Tipos ENUM | 13 | **14** | + tipo_camara; accion_bitacora gana 2 valores (0239) |
| Disparadores | 6 | **7** | + trg_plantilla_foto_principal (0235) |
| Parámetros del sistema | 11 | **12** | la spec dice 11 claves (RNF-02); la base tiene 12 |

Comparación columna por columna (spec 3.4.1 contra la base): 19 tablas y 125 columnas en la spec; **0** columnas de la spec faltan en la base; **4** columnas existen en tablas de la spec sin figurar en ella (`camara.tipo`, `consentimiento.origen`, `consentimiento.version_aviso`, `plantilla_facial.origen`); y **1** tabla nueva (`plantilla_foto`, 6 columnas).

Otras diferencias que se verificaron en la base:

- `plantilla_facial.objeto_foto` y `plantilla_foto.objeto_foto` admiten nulo (migración 0237, extensión 18): cuando el vector ya vive en el índice FAISS en uso, la foto de registro se descarta. En la spec era NOT NULL.
- `ck_bitacora_entidad` enumera 18 entidades auditables (las de la spec); `plantilla_foto` no está en esa lista.
- `accion_bitacora` tiene 10 valores: los 8 de la spec más `alta_consentimiento` y `revocacion_consentimiento` (0239). `estatus_sesion` incluye `suspendida`, valor que agrega una extensión documentada (0002) y que se excluye del denominador de RN-11.
- `camara.tipo` (`ip` o `navegador`) y `ck_camara_ip`: permiten que la cámara sea la webcam del navegador del docente; la dirección IP solo es obligatoria para el tipo `ip`.
- La spec contaba 6 disparadores y 16 pruebas positivas y 46 negativas; la base actual tiene 7 disparadores y el conjunto de pruebas SQL de la sección 5.

## 5. Pruebas SQL

Salida de `scripts/test-sql.sh` (conservada en `pruebas-sql.txt`): Salida de scripts/test-sql.sh (commit f742bb4 de origin/main), ejecutado el 2026-10-30T03:57Z contra PostgreSQL 16 local; BD temporal, ya eliminada.

**37 archivos, 0 con fallas; 1508 pruebas positivas y 953 negativas; 0 fallos** (0m13.209s de ejecución). Las pruebas positivas comprueban que lo permitido funciona; las negativas, que la base rechaza lo prohibido con la restricción o el código de error esperado. El script crea una base temporal, aplica stubs, migraciones y fixtures, y la elimina al terminar.

| Grupo de archivos | Archivos | Positivas | Negativas |
|---|--:|--:|--:|
| `api_a_sesiones` | 5 | 180 | 95 |
| `api_b1` | 5 | 221 | 209 |
| `api_b2` | 8 | 495 | 244 |
| `api_b3` | 1 | 54 | 42 |
| `api_c` | 6 | 289 | 141 |
| `review_sql` | 5 | 56 | 50 |
| `schema` | 7 | 213 | 172 |
| **Total** | **37** | **1508** | **953** |

Los archivos de `supabase/tests/` que no empiezan con guion bajo son 37, los mismos 37 de la salida. Los grupos son: `schema_*` (estructura, restricciones, disparadores, RLS, ayudantes, Storage), `api_a_*` (sesiones), `api_b1/b2/b3_*` (administración, biometría, autoservicio), `api_c_*` (recálculo, revisión, reportes) y `review_sql_*` (IDOR, reglas, límites de la spec, auditoría, abuso).

## 6. Archivos de este material

`diccionario.md` (diccionario de datos por tabla, generado), `er-general.png`, `er-a-academico.png`, `er-b-operacion.png`, `er-c-biometria.png`, `er-d-seguridad.png` (+ `.svg`), `codigo-cuerpo.sql` (extractos verificados), `codigo-anexo.sql` (DDL completo con pg_dump), `migraciones.md`, `funciones.md` (firmas de las 185 funciones) y los scripts que los generan.

Para regenerar todo (requiere la base local en `127.0.0.1:54329`, usuario `postgres`, base `susan`): `node generar-diccionario.mjs && node generar-er.mjs && node generar-cuerpo.mjs && node verificar-cuerpo.mjs && node verificar-contra-bd.mjs && node generar-anexo.mjs && node generar-resumen.mjs`. `verificacion.txt` guarda la salida de las dos verificaciones del código.
