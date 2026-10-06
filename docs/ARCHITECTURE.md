# SUSAN — Arquitectura

Fuente funcional: `docs/spec/Avance1.pdf` (1er avance). Este documento fija **cómo** se implementa esa
especificación con Next.js + Tailwind + Supabase y qué reglas transversales obedece todo componente.
Los contratos de detalle (RPC, rutas, formas JSON) viven en `docs/API.md` y `docs/api/*.md`.

## 1. Capas (spec §3.5, Figura 10)

```
 PRESENTACIÓN            DISPOSITIVOS
 Next.js (web/)          Webcam del navegador (tipo 'navegador') · cámaras IP (tipo 'ip')
   │  supabase-js (anon+JWT)        │ fotogramas cada intervalo_muestreo_seg
   │  fetch /api/*                  ▼
 SERVICIOS ───────────────────────────────────────────────────────────────────────
   Route Handlers (web/src/app/api)  ──►  recognition-service (FastAPI + FAISS)
   · captura/enrolamiento/URLs firmadas/jobs      · detecta, vectoriza (512-d, en memoria)
   · admin de cuentas (service_role)              · busca k-NN, sube recortes
   Programador de tareas = /api/jobs/* (cron)     · construye/carga índice (JSON en el bucket)
 DATOS ───────────────────────────────────────────────────────────────────────────
   PostgreSQL (Supabase): 20 tablas 3FN (19 de la spec + `plantilla_foto`) + RLS + triggers + RPC api_*/svc_*
   Supabase Storage: bucket privado `susan-private` (documentos, recortes, índice FAISS .json; las fotos de registro solo viven hasta que se indexan, ext. 18)
```

Reglas de reparto (spec Tabla 34): las **reglas de negocio nunca viven en la interfaz**. Viven en PostgreSQL
(restricciones, triggers, RPC transaccionales) o en Route Handlers (lo que requiere service_role, IP, almacenamiento
o el servicio de reconocimiento). La UI presenta y captura decisiones.

## 2. Acceso a datos: solo RPC

- **Todas** las lecturas y escrituras de la app pasan por funciones PostgreSQL llamadas por `supabase.rpc(nombre, args)`.
  Nada de `.from('tabla')` en el código de la app. Esto da: un contrato explícito, transacciones, reglas de negocio en
  un solo sitio, y la posibilidad de ejecutar el mismo código en modo local contra PostgreSQL puro.
- `api_*` → `GRANT EXECUTE` solo a `authenticated`. Las de **lectura** son `SECURITY INVOKER` (la RLS del usuario
  aplica: "el docente solo ve sus grupos" lo hace la base, no la UI — RF-19). Las de **escritura** son
  `SECURITY DEFINER` con `SET search_path = public, app, pg_temp` y validan rol/pertenencia explícitamente.
- `svc_*` → `GRANT EXECUTE` solo a `service_role` (Route Handlers y jobs). Nunca llamables desde el navegador.
- Lógica interna y funciones de trigger en el esquema privado **`app`** (no expuesto por la API).
- Privilegios de tabla: `REVOKE ALL` a `anon` y `authenticated` sobre todas las tablas; `GRANT SELECT` solo donde una
  política RLS lo respalda (necesario para las RPC invoker). Ninguna escritura directa. `bitacora_auditoria` es de
  solo inserción (triggers `trg_bitacora_sin_cambios`, `trg_bitacora_sin_truncate`).
- Tablas en `public` con los nombres de la especificación en minúsculas: `alumno, docente, materia, aula, grupo,
  horario_grupo, inscripcion, sesion_clase, asistencia, justificante, consentimiento, indice_faiss, plantilla_facial,
  plantilla_foto, camara, captura, deteccion, usuario, bitacora_auditoria, parametro_sistema`; vista `v_resumen_asistencia`
  (`security_invoker = true`). Constraints con prefijos `pk_ fk_ uq_ ck_ ux_ trg_` (spec §3.4).
- JSON de las RPC: claves `snake_case` iguales a las columnas; fechas ISO 8601 (`fecha` = `YYYY-MM-DD`, `hora_*` =
  `HH:MM:SS`, instantes con offset); enteros como número JSON. Las listas paginadas devuelven
  `{ total, items: [...] }` y aceptan `p_limit` (def. 50, máx. 200) y `p_offset`.
- **Reloj único**: toda lógica de negocio usa `app.now()` (no `now()`), que devuelve `now()` salvo que la base tenga
  `app.allow_fake_clock = 'on'` y la sesión fije `app.fake_now` (solo desarrollo/pruebas). Hora de clase =
  `(fecha + hora_inicio) AT TIME ZONE 'America/Mexico_City'`.
- **Errores**: `RAISE EXCEPTION '<mensaje en español>' USING ERRCODE = 'P0001', HINT = '<CODIGO>'`. `CODIGO` en
  `MAYUSCULAS_CON_GUION_BAJO` (p. ej. `NO_AUTORIZADO`, `NO_ENCONTRADO`, `VALIDACION`, `RN_08_PLAZO_VENCIDO`). Los errores
  de constraint (23xxx) se mapean en la capa de datos. `src/lib/api/errors.js` define `ApiError { code, message,
  status }` y lo compila desde el registro de códigos de `docs/API.md` §Errores.
- Los Route Handlers responden errores como `{ "error": { "code", "message", "details"? } }` con el status HTTP adecuado.

## 3. Roles y rutas

Roles (`usuario.rol`): `administrador`, `docente`, `alumno`, `tecnico`. Sin autorregistro: el administrador crea las
cuentas (Route Handler con service_role → `auth.admin.createUser` + fila `usuario`). Matriz de permisos = spec Tabla 36.

```
PÚBLICO     /login (P-01) · /recuperar · /cambiar-contrasena
DOCENTE     /docente (P-02) · /docente/sesiones/[id] (P-03 con cámaras / P-04 pase manual, según modo_registro)
            /docente/revision (P-05) · /reportes (P-07) · /analitica
ALUMNO      /alumno (P-08)
ADMIN       /admin · /admin/grupos · /admin/grupos/[id] (P-09) · /admin/alumnos · /admin/alumnos/nuevo ·
            /admin/alumnos/[id] (P-06) · /admin/docentes · /admin/materias · /admin/aulas · /admin/usuarios ·
            /admin/bitacora · /reportes · /analitica
TÉCNICO     /tecnico (cámaras, parámetros del sistema, índice facial)
```

Estructura App Router: grupo `(public)` y grupo `(app)`; el layout de `(app)` exige sesión (servidor), carga
`api_yo()` y pinta el `AppShell` con la navegación del rol. `src/proxy.js` refresca la sesión y hace el
redireccionamiento optimista; la autorización real está en la base (RLS/RPC) y en los Route Handlers.

## 4. Transporte de backend y modo local

La app habla con un objeto "tipo supabase-js" obtenido de `@/lib/backend`:

| Función | Dónde | Qué devuelve |
|---|---|---|
| `getBrowserBackend()` | cliente (`'use client'`) | `{ auth, rpc, storage }` con la sesión del usuario |
| `getServerBackend()` | RSC / Route Handlers | igual, con las cookies de la petición (usuario) |
| `getAdminBackend()` | solo servidor | `service_role`: salta RLS; para `svc_*`, `auth.admin`, Storage |

Superficie PERMITIDA de ese objeto (nada más; así el modo local puede imitarla fielmente):
`auth.getUser()`, `auth.getSession()`, `auth.signInWithPassword({email,password})`, `auth.signOut()`,
`auth.resetPasswordForEmail(email,{redirectTo})`, `auth.updateUser({password})`, `auth.verifyOtp({type,token_hash})` (solo modo real; lo usa `/auth/confirm`), `auth.onAuthStateChange(cb)`,
`rpc(nombre, args)` → `{ data, error }`, `storage.from(bucket).upload(path, body, opts)`,
`storage.from(bucket).createSignedUrl(path, segundos)`, `storage.from(bucket).download(path)`,
`storage.from(bucket).remove([paths])`, y (admin) `auth.admin.createUser/updateUserById/deleteUser/listUsers`.

**Modo real** (`SUSAN_LOCAL` sin definir): `@supabase/ssr` (`createBrowserClient`/`createServerClient`) y
`@supabase/supabase-js` con la service_role.

**Modo local** (`SUSAN_LOCAL=1`, sin Docker ni Supabase): implementa la misma superficie sobre PostgreSQL 16 directo.
- `LOCAL_DATABASE_URL` (def. `postgres://localhost:54329/susan`), clúster en `.local/pgdata`, creado por
  `scripts/db-up.sh`. `supabase/local/00_supabase_stubs.sql` crea lo que Supabase ya trae: roles `anon`,
  `authenticated`, `service_role`; esquemas `auth` (tabla `auth.users` con contraseña `crypt()` de pgcrypto y
  `auth.uid()`/`auth.jwt()`/`auth.role()` leyendo `request.jwt.claims`) y `storage` mínimo. Las migraciones de
  `supabase/migrations/` se aplican **idénticas** a las de producción.
- `rpc()` = `BEGIN; SET LOCAL ROLE <authenticated|service_role>; set_config('request.jwt.claims', …, true);
  SELECT * FROM public.<fn>(p_x => $1, …); COMMIT` (misma semántica que PostgREST: llaves del JSON → parámetros con
  nombre; `setof` → arreglo; `json/jsonb` → valor).
- Sesión local: cookie httpOnly firmada (HMAC con `LOCAL_AUTH_SECRET`) con `sub` = `auth.users.id`. Rutas
  `src/app/api/_local/*` (auth, rpc, storage) existen **solo** si `SUSAN_LOCAL=1` y `NODE_ENV !== 'production'`
  (si no, 404). El storage local escribe en `<LOCAL_STORAGE_DIR>/<bucket>/<ruta>` (default `web/.local/storage/susan-private/…`; el servicio de reconocimiento usa el mismo árbol vía `STORAGE_DIR`); "URL firmada" local =
  `/api/_local/storage/object?token=…` con HMAC y expiración.
- El servicio de reconocimiento tiene su propio backend de almacenamiento (`STORAGE_BACKEND=supabase|local`); en
  local lee/escribe el mismo directorio.
- Reloj de pruebas/demostración en local: `app.fake_now` (ver §2) para poder abrir sesiones fuera de horario.

## 5. Biometría e índice FAISS (spec §3.5.1, RN-12, RNF-03/09/14)

- La BD guarda por rostro solo `faiss_id` + rutas `objeto_*` (la de la foto de registro pasa a `NULL` cuando la foto se borra al indexarse: ext. 18, `docs/DECISIONS.md` §8). El vector de consulta de cada captura existe solo en la
  memoria del servicio y no figura en ninguna respuesta.
- **Índice = archivo JSON versionado en el bucket** (`indice/<version>.json`), formato `susan-faiss-json/1`:
  `{ format, version, dimension, model, metric: "ip", created_at, ntotal, ids: [int…], vectors_b64: "<float32 LE
  N×D en base64>", refs: [{ id_plantilla, faiss_id }] }` (`refs` lo escribe `/v1/index/build`; el manifiesto lo usa para revertir versiones) con vectores L2-normalizados (producto interno = coseno). El servicio lo carga a un
  `faiss.IndexIDMap2(IndexFlatIP)` en memoria; las búsquedas se restringen a los `faiss_id` de los inscritos del grupo
  con `IDSelectorBatch` (RF-04: "un alumno no inscrito nunca es candidato").
- **score_similitud** = `(coseno + 1) / 2` recortado a [0,1], 3 decimales (así el umbral 0.850 de la especificación es
  alcanzable y encaja en `NUMERIC(4,3)` con `0 ≤ score ≤ 1`). Documentado en `docs/DECISIONS.md`.
- Alta de plantilla (RN-12/13): una transacción archiva la anterior y luego inserta la nueva con `id_indice NULL`;
  después se reconstruye una versión completa del índice (conserva vectores vigentes, vectoriza solo las fotos nuevas),
  se sube como JSON con `en_uso = false`, el servicio la precarga, y **una sola transacción** asigna `id_indice`/`faiss_id`
  y mueve `en_uso` (primero FALSE en la anterior, luego TRUE en la nueva: el índice único parcial no es diferible);
  por último el servicio cambia su puntero en memoria sin interrumpir el muestreo.
- **Plantilla de varias fotos** (extensión 7; RN-12 intacta). Una plantilla = **3 a 8 fotos** (5 guiadas) cuyos embeddings L2 se promedian en UN
  vector (centroide, re-normalizado) con UN `faiss_id`: sigue habiendo una sola fila activa de `plantilla_facial` por alumno; las fotos viven en la
  tabla hija `plantilla_foto` (`orden = 1` es la principal = `plantilla_facial.objeto_foto`, creada por trigger; `calidad` y `coseno_resto` son
  escalares informativos). El promedio y el descarte de fotos ajenas (*outliers*) ocurren en el servicio de reconocimiento: el vector solo vive en
  memoria y en el JSON del índice (RNF-03).
  - **Registro** (`POST /api/alumnos/{id}/plantilla`): consentimiento vigente → `POST /v1/photo/check-set` verifica calidad y consistencia de TODAS las fotos
    (una foto debe parecerse en promedio >= `TEMPLATE_OUTLIER_COSINE`, 0.35, a las demás) → si alguna no pasa, 422 `FOTOS_RECHAZADAS` sin subir nada (las fotos
    rechazadas nunca se guardan) → se suben las fotos y `api_plantilla_registrar(..., p_fotos)` archiva la anterior e inserta la nueva en una transacción →
    reconstrucción del índice. El camino de UNA foto (campo `foto`) se conserva como escape y para las plantillas heredadas.
  - **Índice**: `svc_indice_plan` añade `objetos_foto` a cada entrada nueva; el constructor (`/v1/index/build`, entrada `objetos_foto`) embebe cada foto, descarta de forma
    defensiva solo las corruptas o ajenas de verdad (umbral propio 0.25; falla únicamente si NINGUNA es utilizable) y escribe el centroide. Las filas `keep` se conservan idénticas a
    la base (sin renormalizar), así que el costo de N fotos solo se paga al construir una plantilla nueva; la reconstrucción COMPLETA cuesta N veces más.
  - **Compatibilidad**: las plantillas de una foto siguen funcionando sin migración manual (backfill + trigger crean su fila `orden = 1`). Orden de despliegue: SQL, servicio, web.
  - Archivado: sigue siendo solo `activa = false`; las fotos extra no tienen bandera propia (su estado es el de la plantilla padre) y, como la foto principal, no se borran del bucket al
    archivar (ver la brecha de retención en `docs/DECISIONS.md`). Contratos y algoritmo: `docs/api/biometria.md` §4.
- Puntaje y modelo: el embedder es enchufable (`EMBEDDER=insightface|fake`); `fake` (determinista) permite pruebas sin
  modelos. Dimensión = parámetro `dimension_vector` (512).

## 6. Captura en sesión (flujo 1–4 de la Figura 10)

Página P-03 (cliente) → cada `intervalo_muestreo_seg`: toma un fotograma de la webcam (cámara `tipo='navegador'`) y
hace `POST /api/sesiones/{id}/captura`. Para cámaras `tipo='ip'` el mismo endpoint, sin imagen, le pide al servicio
traer el fotograma de `http://<direccion_ip>/<CAMERA_SNAPSHOT_PATH>`. El handler: autentica al docente → valida sesión
abierta y ventana de tolerancia → `svc_alumnos_candidatos` → `svc_crear_captura` → servicio `/v1/recognize` →
`svc_registrar_detecciones` (aplica umbral, RN-02…RN-05, crea/actualiza `asistencia`) → responde el resumen.
Cierre: `api_cerrar_sesion` (docente) o `/api/jobs/cerrar-sesiones` (cron) → mismos efectos (RN-07).

## 7. Propiedad de archivos (para trabajo en paralelo)

Cada agente edita **solo** lo suyo; lo demás se pide en `requests` del reporte final.
**El SQL es la fuente de verdad del contrato de RPC**: cada función lleva `COMMENT ON FUNCTION` con argumentos y la
forma JSON que devuelve, y `scripts/gen-api-catalog.mjs` genera `docs/API-RPC.md` a partir de `pg_proc`. Los documentos
`docs/api/*.md` son diseño de referencia (algunos son parciales); si el SQL y un documento difieren, manda el SQL.

| Zona | Dueño |
|---|---|
| `supabase/migrations/0001–0099`, `supabase/local/**`, `supabase/seed/**`, `scripts/db-*.sh`, `scripts/test-sql.sh`, `supabase/tests/_*`, `supabase/tests/schema_*` | db-schema |
| `supabase/migrations/01xx` + `supabase/tests/api_a_*`: sesiones, captura/svc, asistencia, revisión, justificantes, reportes, series, recalculo | db-api-a |
| `supabase/migrations/02xx` + `supabase/tests/api_b_*`: catálogos, grupos, horarios, inscripciones, usuarios, bitácora, biometría, índice, parámetros, jobs; `scripts/gen-api-catalog.mjs`, `docs/API-RPC.md` | db-api-b |
| `recognition-service/**` | recognition |
| `web/src/lib/numerics/**`, `docs/NUMERICS.md` | numerics |
| `web/src/components/ui/**`, `web/src/components/layout/**`, `web/src/hooks/ui/**` | ui-kit |
| `web/src/lib/backend/**`, `web/src/lib/local/**`, `web/src/app/api/_local/**`, `web/src/proxy.js`, `scripts/dev-*.sh` | adapters |
| `web/src/lib/api/**`, `web/src/hooks/data/**` | data-layer |
| `web/src/lib/http/**`, `web/src/lib/server/**`, `web/src/app/api/**` (excepto `_local`) | route-handlers |
| `web/src/app/(public)/**`, `web/src/app/(app)/layout.jsx`, `web/src/components/auth/**` | screens-auth |
| `web/src/app/(app)/docente/page.jsx`, `(app)/docente/pasar-lista/**`, `components/docente/**`; `(app)/docente/sesiones/**`, `components/sesion/**` (incluye el simulador de cámara de la demostración) | screens-sesiones |
| `web/src/app/(app)/docente/revision/**`, `components/revision/**`, `components/alumno/RegistrarJustificanteForm`, `MisJustificantes` | screens-revision |
| `web/src/app/(app)/reportes/**`, `(app)/alumno/**`, `components/reportes/**`, resto de `components/alumno/**` | screens-reportes |
| `web/src/app/(app)/analitica/**`, `components/analitica/**` | screens-analitica |
| `web/src/app/(app)/admin/alumnos/**`, `components/admin/alumnos/**` (AlumnoForm, ConsentimientoPanel, PlantillaFacialPanel, CapturaGuiadaPlantilla, SubidaFotosPlantilla, GaleriaTomas, CalidadFotoResumen) | screens-alumnos |
| `web/src/app/(app)/admin/grupos/**`, `components/admin/grupos/**` | screens-grupos |
| `web/src/app/(app)/admin/page.jsx`, `admin/{docentes,materias,aulas,usuarios,bitacora,importar}/**`, `components/admin/catalogos/**` | screens-catalogos |
| `web/src/app/(app)/tecnico/**`, `components/tecnico/**` | screens-tecnico |
| `scripts/seed-demo.sh`, `scripts/demo/**`, `web/src/lib/demo/**` (datos de prueba, escenario reiniciable y fotogramas sintéticos; solo modo local), `docs/DEMO*.md` | demo |
| `video/**` (video de presentación HyperFrames; `renders/` no se versiona) | video |
| `docs/**` salvo lo indicado, `README.md` | docs |
| `web/package.json`, `web/next.config.mjs`, `web/src/app/globals.css`, `web/src/config.js`, `CLAUDE.md`, `docs/ARCHITECTURE.md` | integrador (lead) |

## 8. Extensiones a la especificación (detalle y justificación: `docs/DECISIONS.md`)

1. `estatus_sesion` + valor `suspendida` (la spec §4.3 lo propone): excluida del denominador de RN-11.
2. `camara.tipo` (`ip` | `navegador`): permite usar la webcam del equipo del docente como cámara del aula;
   `direccion_ip` es obligatoria solo para `ip`.
3. Parámetro 12 `minutos_pase_lista_base` (5): solo para estimar el tiempo de clase recuperado (objetivo del proyecto).
4. `score_similitud` normalizado como `(coseno+1)/2`.
5. Análisis por métodos numéricos (`web/src/lib/numerics`) y su pantalla `/analitica` — objetivo del proyecto, fuera
   del 1er avance.
6. Carga masiva de alumnos por CSV (herencia de SmartClass `importGroup`).
7. Tabla `plantilla_foto` (20 tablas frente a las 19 de la spec): plantilla de 3 a 8 fotos promediadas en un solo vector (centroide en el servicio de reconocimiento), con RN-12 intacta.

## 9. Fuera de alcance (spec §1.2): entrenar el modelo, control de acceso físico, calificaciones, app móvil nativa, detección de vida (anti-spoofing). QR (de SmartClass) no se incluye: la spec no lo contempla.

## 10. Notas de entorno local (verificadas en la máquina de desarrollo)

- PostgreSQL 16.14 de Homebrew: `/opt/homebrew/opt/postgresql@16/bin` (no está en el PATH). **Siempre** exporta
  `LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8` antes de `initdb`/`pg_ctl`: sin eso el postmaster aborta con
  "became multithreaded during startup".
- Arranca el clúster con `-c listen_addresses=127.0.0.1 -k /tmp` (el socket Unix por defecto del directorio de datos
  supera los 104 caracteres permitidos). Puerto local de SUSAN: **54329**; datos en `.local/pgdata`.
- Extensiones disponibles: `pgcrypto` (bcrypt con `crypt()`/`gen_salt('bf')`), `pg_trgm`, `btree_gist`. NO hay `pg_cron`,
  `pg_net` ni `pgtap` en local: las pruebas SQL son scripts `psql` con bloques `DO` y aserciones propias.
- No hay Docker: `supabase start` no es viable. La CLI `supabase` (2.117) sí sirve para generar/validar migraciones.
- Python: usa `/opt/homebrew/bin/python3.12` (el `python3` del sistema es 3.9). Hay wheels arm64 para `faiss-cpu` 1.15,
  `numpy` 2.x, `onnxruntime` 1.30 y `opencv-python-headless`.

## 11. Contratos internos fijos (no cambiar sin actualizar este documento)

**Esquema `app`** (lo implementa db-schema en `0010`; lo usan todos los dominios):
`app.now() timestamptz` · `app.tz() text` (`'America/Mexico_City'`) · `app.param(p_clave text) text` · `app.param_num(p_clave text) numeric` ·
`app.rol() text` · `app.id_usuario() integer` · `app.id_docente() integer` · `app.id_alumno() integer` · `app.es_admin() boolean` ·
`app.puede_ver_grupo(p_id_grupo integer) boolean` (admin: todos; docente: sus grupos; alumno: grupos con inscripción propia) ·
`app.bitacora(p_accion accion_bitacora, p_entidad text, p_id_registro bigint, p_anterior jsonb, p_nuevo jsonb, p_ip inet DEFAULT NULL, p_id_usuario integer DEFAULT NULL) returns bigint`.
db-api-a define: `app.cerrar_sesion(p_id_sesion integer, p_por_docente boolean) returns jsonb`,
`app.recalcular_inscripcion(p_id_inscripcion integer) returns void`, `app.recalcular_grupo(p_id_grupo integer) returns void`,
y la vista `v_resumen_asistencia`.

**Series para el análisis numérico** (db-api-a las devuelve; `lib/numerics` y `/analitica` las consumen; solo sesiones `cerrada`, ordenadas por fecha):
```json
api_serie_grupo(p_id_grupo) -> { "id_grupo": 12, "periodo": "2026-2", "sesiones_programadas": 48, "limite_pct": 20,
  "sesiones": [ { "id_sesion": 101, "fecha": "2026-08-17", "semana_iso": 34, "dia_semana": 1, "inscritos": 30,
                  "presentes": 25, "retardos": 2, "ausentes": 2, "justificados": 1, "pendientes": 0,
                  "tasa_ausentismo": 0.0667 } ] }          // tasa = ausentes / inscritos
api_matriz_grupo(p_id_grupo) -> { "fechas": ["2026-08-17", "..."],
  "alumnos": [ { "id_alumno": 1, "id_inscripcion": 9, "matricula": "A2301", "nombre": "Pérez Ana",
                 "estados": ["presente", "ausente", null] } ] }   // alineado con "fechas"; null = sin registro
```

**Servicio de reconocimiento** (cabecera `X-API-Key`; detalle en `docs/api/biometria.md` §servicio):
`POST /v1/recognize` multipart: `image` (archivo) **o** `camera_url`, `allowed_faiss_ids` (JSON array), `crop_prefix`, `max_faces` (60).
200 → `{ index_version, elapsed_ms, image:{width,height}, faces:[{ bbox:[x1,y1,x2,y2], det_score, candidate:{faiss_id,score}|null, objeto_recorte:string|null }] }`
(nunca el vector). Errores: 401, 409 `INDEX_NOT_LOADED`, 422 imagen inválida, 504 cámara inalcanzable.
Además: `GET /health`, `GET /v1/index`, `POST /v1/photo/check`, `POST /v1/photo/check-set`, `POST /v1/index/build`, `POST /v1/index/activate`.
`POST /v1/photo/check-set`: multipart con `images` repetido (1 a 8 archivos) → `{ total, aceptadas, minimo, maximo, suficiente, consistente, ambiguo, umbral_coseno, coseno_min, coseno_medio, coseno_max_par, advertencias, fotos:[{ indice, estado: aceptada|calidad|inconsistente|ilegible, rostros, un_solo_rostro, calidad, motivo_rechazo, motivo_codigo, coseno_resto }] }`
(nunca el vector; no guarda nada). `POST /v1/index/build` acepta además entradas `{ objetos_foto: [...] }` (2 a 8 fotos, promedio en el servicio) y responde con `muestras` por plantilla multifoto. Contrato completo en `docs/api/biometria.md` §4.

## 12. Capa SQL: reglas aprendidas en la construcción (db-schema)

- Las funciones nuevas **nacen sin `EXECUTE`** para PUBLIC/anon/authenticated: cada RPC hace su `GRANT EXECUTE` justo después del `CREATE FUNCTION`
  (`api_*` → `authenticated`, `svc_*` → `service_role`). Una función `INVOKER` llamada desde RLS o desde una RPC de lectura necesita `EXECUTE` para `authenticated` aunque esté en `app`.
- `app.bitacora` y `app.asumir_cuenta_servicio` solo las ejecuta `service_role` o una RPC `DEFINER`; `service_role` no escribe la bitácora directamente.
- Los triggers rechazan con `ERRCODE 23514` y `CONSTRAINT = <nombre de la regla>` (p. ej. `rn01_asistencia_inscripcion_activa`); la bitácora con `23000`. Las RPC validan antes y devuelven su código `P0001`+`HINT`.
  `src/lib/api/errors.js` mapea `23514` con `rn*_` → 409 `RN_xx`, y `23000` → 409.
- Códigos `P0001` base definidos por db-schema: `NO_AUTENTICADO`, `CUENTA_NO_VINCULADA`, `CUENTA_INACTIVA`, `NO_AUTORIZADO`, `PARAMETRO_NO_ENCONTRADO`, `PARAMETRO_INVALIDO`, `PARAMETRO_VALOR_INVALIDO`, `CUENTA_SERVICIO_AUSENTE`, `BITACORA_VALORES_REQUERIDOS`.
- Pruebas: `scripts/test-sql.sh [filtro]` (BD temporal por ejecución); API del harness `t.*` en `supabase/README.md`. `db-reset.sh` recrea la BD `susan`: no usarlo mientras otros trabajan.
- Cada `api_*`/`svc_*` lleva `COMMENT ON FUNCTION` con `ARGS:`/`RETURNS:`/`ERRORES:`/`ROLES:`; de ahí se genera `docs/API-RPC.md`.
- Conexión local: `postgres://127.0.0.1:54329/susan` (trust). `rpc()` local = `SET LOCAL ROLE` + `request.jwt.claims` con `sub` = `usuario.auth_uid`. Login local contra `auth.users` con `extensions.crypt()`;
  contraseña de DESARROLLO `demo1234` (cuentas `admin@`, `tecnico@`, `docente1@`…`docente3@`, `e260001@`…`e260025@`, todas `@susan.local`). La BD `susan` ya tiene `app.allow_fake_clock='on'`.

## 13. Notas de integración (olas 3 y 4)

- **Rutas locales**: viven en `web/src/app/api/%5Flocal/**` (una carpeta `_local` sería privada en Next y no enruta; `%5F` es la forma documentada). Los `route.js` solo delegan en
  `web/src/app/api/_local/handlers/` (carpeta privada con la lógica y sus pruebas). `@/lib/backend/index.js` carga el código de servidor con `import()` dentro de
  `if (process.env.NEXT_RUNTIME === 'nodejs')` y las cookies pasan por `backend/cookies.js`, para no meter `pg` ni `next/headers` en el bundle del cliente.
- **Recortes**: el servicio sube los recortes antes de existir `id_captura`, así que el prefijo es `recortes/{id_sesion}/{id_camara}-{epochMs}/{n}.jpg`
  (no `recortes/{id_sesion}/{id_captura}/{n}.jpg`). La purga se guía por las rutas de `deteccion.objeto_recorte`, no por el layout.
- **Cámaras IP**: el docente no ve `direccion_ip`; el handler de captura la obtiene con `svc_camara_direccion(p_id_sesion, p_id_camara)` y arma `http://<ip><CAMERA_SNAPSHOT_PATH>`.
- **Reloj de demostración local**: `LOCAL_FAKE_NOW` fija `app.fake_now` en cada RPC local (`scripts/dev-all.sh` lo pone en `2026-09-14 07:12:00-06`; `SUSAN_FAKE_NOW=off` usa el real).
- **iCloud y ubicación del proyecto**: el Escritorio de la máquina de desarrollo está sincronizado con iCloud y, con el disco al ~98 %, macOS desaloja archivos (`dataless`): lecturas lentas o imposibles,
  módulos truncados, directorios/symlinks duplicados (`X 2`) y migraciones omitidas en silencio. Por eso **el proyecto real vive en `~/Developer/SUSAN`** y `~/Desktop/SUSAN` es solo un enlace simbólico a esa ruta.
  Capas adicionales: los datos mutables del modo local (clúster PostgreSQL, storage, PIDs) van a `SUSAN_LOCAL_DIR` (`scripts/local-dir.sh`; en esta máquina `~/.susan-local/SUSAN`, que se reutiliza si ya existe);
  `web/node_modules`, `web/.next` y `recognition-service/.venv` son `*.nosync` con symlink; dev servers paralelos: `NEXT_DIST_DIR=.next-<clave>.nosync`.
  Usa siempre la ruta real (`~/Developer/SUSAN`) en scripts y tareas. Si el enlace del Escritorio aparece renombrado ("SUSAN 2"), bórralo y recréalo; el repo no se ve afectado. Nunca crees symlinks sobre un nombre que iCloud ya conocía mientras borras el anterior.
- `proxy.js` deja `/cambiar-contrasena` pública: el token de recuperación de Supabase llega en el hash de la URL (solo el navegador lo ve), así que la sesión de recuperación se establece en el cliente y es la propia página la que comprueba si hay sesión.
- Pendientes conocidos: `svc_usuario_obtener` (hoy restablecer recorre listados) y bitácora de alta/restablecimiento de cuentas (el enum `accion_bitacora` no tiene valor propio).
- **Cabeceras de seguridad** (`web/next.config.mjs`): siempre X-Frame-Options DENY, nosniff, Referrer-Policy y Permissions-Policy (`camera=(self)`); en producción además CSP (`script-src 'self' 'unsafe-inline'`
  porque Next hidrata con scripts en línea; endurecer con nonces desde `proxy.js` queda como mejora) y HSTS. `img-src`/`connect-src` incluyen el origen de `NEXT_PUBLIC_SUPABASE_URL`.
  Los componentes de animación futuros que usen WebGL/workers deben respetar `worker-src 'self' blob:`; fuentes solo con `next/font` (autoalojadas).
- **`/auth/confirm`** (`web/src/app/auth/confirm/route.js`): canjea `token_hash` por sesión en el servidor (`verifyOtp`) para recuperación/invitación; solo modo real (404 en local); destinos fijos.
- **Caída de Auth**: `usuarioAuth` lanza 503 `AUTH_NO_DISPONIBLE` ante `AuthRetryableFetchError`/5xx; el proxy deja pasar sin redirigir.
- **Verificación del modo real**: `scripts/fake-supabase.mjs` emula GoTrue + PostgREST + Storage sobre el SQL local; ver `docs/review/real-mode.md`.

## 14. Sistema de diseño (capa de presentación)

Resumen técnico; identidad, componentes firma, tipografía y armazón en [`docs/design/SISTEMA.md`](design/SISTEMA.md), referencias medidas en [`docs/design/REFERENCIAS.md`](design/REFERENCIAS.md)
y registro de módulos en [`docs/design/MODULOS.md`](design/MODULOS.md).

- **Tokens**: `web/src/app/globals.css` define el vocabulario de shadcn/ui (`--background`, `--card`, `--primary`, `--muted`, `--accent`, `--destructive`, `--border`, `--ring`, `--link`…), la marca UNACH, las
  portadas pastel (`--tono-*`), los estados de asistencia y una paleta `.dark` (sin interruptor aún). `@theme inline` los expone a Tailwind 4. Fuentes con `next/font`: Hanken Grotesk (interfaz), EB Garamond
  (`font-display`, solo saludo/titulares de acceso) y Geist Mono.
- **Capas de componentes**: `components/shadcn/` = primitivas vendorizadas (CLI `shadcn`); `components/ui/` = API estable de SUSAN que usan las pantallas (Button, Card, Tabs, Pills, TarjetaPortada, TarjetaFila,
  Avatar, StatusChip…); `components/motion/` = BlurText, CountUp, Reveal, SpotlightCard, StaggerList; `components/home/` = Resaltado, ModuloCard, FilaModulos, CampoComando, HomeRol, CatalogoModulos;
  `components/layout/` = AppShell (riel + panel flotante + barra móvil + paleta ⌘K), Sidebar, MenuCuenta, TopbarMovil, BottomNav; `components/auth/` = pantalla dividida con PanelProducto y el asistente `Onboarding`.
- **Registro de módulos** (`lib/modulos.js`): fuente única del Home por rol, `/modulos`, `/modulos/[id]`, la paleta y la sección «Próximamente» del riel. Los componentes cliente lo importan (las entradas llevan
  componentes de icono y no cruzan de servidor a cliente como props).
- **Preferencias de perfil** (`lib/perfil.js`): color del avatar y marcas del onboarding en `localStorage` por usuario (sin columna en la base; sin datos sensibles).
- **Iconos**: siempre `lucide-react`. **Movimiento**: ver `components/motion/README.md`; presupuesto de JS y mediciones en `docs/DESIGN_PROGRESS.md` (`scripts/measure-bundle.mjs`).
- **Accesibilidad**: foco visible en anillo, `aria-current` en la navegación, combobox/listbox en la paleta, texto `sr-only` para titulares y cifras animadas, panel de producto del login `aria-hidden` y sin controles,
  estados siempre con texto además de color, asistente de onboarding con foco al título y progreso anunciado.
- **Hidratación**: el HTML del servidor y la primera pasada del cliente deben coincidir. Lo que depende del navegador (hora local, preferencia de movimiento, localStorage) usa `useSyncExternalStore` con instantánea de
  servidor o se activa tras montar (`Reveal immediate`).
