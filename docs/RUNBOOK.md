# SUSAN — RUNBOOK (despliegue y operación)

Este documento describe cómo llevar SUSAN de modo local a un proyecto **Supabase real**. El modo local (`scripts/dev-all.sh`) está verificado de punta a punta;
el camino contra Supabase usa las **mismas migraciones y las mismas RPC**, pero no se ha ejecutado contra un proyecto vivo en esta sesión: haz el despliegue primero en un
proyecto de pruebas.

## 1. Supabase (base de datos, Auth y bucket)

1. Crea el proyecto en Supabase (PostgreSQL 15+; probado en 16). Anota `Project URL`, `anon key` y `service_role key`.
2. Aplica las migraciones (40 archivos `supabase/migrations/0001…0990`, orden lexicográfico, incluida `0235_plantilla_fotos.sql`; `supabase db push --include-seed` carga además la semilla de demostración):
   ```bash
   supabase link --project-ref <ref>
   supabase db push --dry-run     # revisa el plan: los prefijos 0001… funcionan como versiones numéricas
   supabase db push
   ```
   `0090`/`0091` crean el bucket privado `susan-private` (tope 50 MiB, sin políticas para `anon`/`authenticated`: solo el servidor lo toca con `service_role`).
   Si prefieres no usar la CLI, ejecuta los archivos en orden en el SQL Editor.
   Si aplicas `0235` (plantilla de varias fotos) a una instalación que ya corría, recarga el esquema de PostgREST (`NOTIFY pgrst, 'reload schema';`; `0990` lo hace solo en instalaciones nuevas), o `api_plantilla_registrar` con `p_fotos` fallará con `PGRST202`.
3. **Auth**: desactiva el registro público (`Authentication → Providers → Email → Allow new users to sign up = off`; `supabase/config.toml` ya lo trae para la CLI) y agrega
   `https://<tu-dominio>/cambiar-contrasena` a *Redirect URLs*. Configura SMTP propio para los correos de recuperación.
4. **Primer administrador y cuentas**: la tabla `usuario` enlaza `auth_uid` con Supabase Auth y la crea el administrador desde la consola `/admin/usuarios`; para el primero:
   ```sql
   -- 1) crea el usuario en Authentication → Users (copia su UUID), 2) vincúlalo:
   INSERT INTO usuario (auth_uid, correo, rol) VALUES ('<uuid-de-auth>', 'admin@tu-dominio', 'administrador');
   ```
   Para cargar la semilla de demostración en un proyecto de pruebas: `supabase db reset --linked` no es necesario; ejecuta `supabase/seed/01…03` y `99` en el SQL Editor y luego
   `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/seed-auth-users.mjs` para crear las cuentas de Auth con el mismo `auth_uid` (imprime contraseñas aleatorias una sola vez).
5. **Respaldo (RNF-14)**: activa los respaldos diarios (RPO ≤ 24 h) o PITR. El índice FAISS es reconstruible desde las plantillas activas (`POST /api/indice/reconstruir`).
6. Si esperas más de ~14 000 plantillas, sube el límite global de tamaño de archivo del proyecto (el índice JSON de 20 000 pesa ~55 MB).

## 2. Aplicación web (Next.js)

Variables (ver `web/.env.example`). **Ninguna con prefijo `NEXT_PUBLIC_` es secreta; `SUPABASE_SERVICE_ROLE_KEY` nunca lleva ese prefijo.**

| Variable | Qué es |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Proyecto Supabase (públicas) |
| `NEXT_PUBLIC_SUPABASE_BUCKET` | `susan-private` |
| `NEXT_PUBLIC_SITE_URL` | URL pública (redirecciones de recuperación) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor: Route Handlers y jobs |
| `RECOGNITION_SERVICE_URL`, `RECOGNITION_SERVICE_API_KEY` | Servicio de reconocimiento y su clave (la misma `API_KEY` del servicio) |
| `CRON_SECRET` | Bearer de `/api/jobs/*` (si está vacío los jobs responden 401) |
| `CAMERA_SNAPSHOT_PATH` | Ruta del fotograma de cámaras IP (`/snapshot.jpg`) |

`SUSAN_LOCAL` **no debe** definirse en producción (las rutas `/api/_local/*` además devuelven 404 con `NODE_ENV=production`).

```bash
cd web && npm ci && npm run build && npm start      # o despliega en Vercel/Netlify/Cloudflare
```
Detrás de un proxy/CDN: que **sobrescriba `x-forwarded-for`** (la IP de la bitácora debe ser confiable) y que acepte cuerpos ≥ 11 MB (PDF de consentimiento hasta 10 MiB).
**Límite de 10 MB del proxy de Next 16** (`proxyClientMaxBodySize`): `src/proxy.js` cubre `/api/*`, buferiza como máximo 10 MB por petición y, si el cuerpo es mayor, lo TRUNCA en silencio (el multipart falla con 400). La plantilla de varias fotos se acota con 9 MiB totales, 8 fotos y `maxMultipartBytes` (las rutas responden 413 limpio); si alguien sube `proxyClientMaxBodySize` debe revisar `MAX_PLANTILLA_BYTES_TOTAL` (`lib/server/storage.js`). Hallazgo preexistente: un PDF de consentimiento cercano a su máximo (10 MiB) supera ese tope y falla como 400.

## 3. Servicio de reconocimiento

Imagen: `recognition-service/Dockerfile` (Python 3.12; `--build-arg ML=0` omite InsightFace). Variables (ver `recognition-service/.env.example`):

| Variable | Valor en producción |
|---|---|
| `APP_ENV` | `production` (exige `API_KEY`) |
| `API_KEY` | secreto largo; igual a `RECOGNITION_SERVICE_API_KEY` de la web |
| `EMBEDDER` | `insightface` (modelos de uso **no comercial**; se descargan a `MODEL_DIR` al primer arranque, ~120 MB) |
| `STORAGE_BACKEND` | `supabase` con `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BUCKET=susan-private` |
| `ALLOW_PRIVATE_CAMERAS` | `1` solo si las cámaras IP están en la LAN del plantel (el servicio las alcanza) |
| `INDEX_ACCEPT_MODELS` | vacía (estricto). Solo pruebas locales: modelos de índice ajenos que se aceptan al leer (`scripts/dev-modo.sh` la fija). En producción, no definirla |
| `INDEX_BOOTSTRAP_VERSION` | opcional: fija la versión del índice a cargar al iniciar. Vacía: con Supabase el servicio carga al arrancar la versión en uso (`svc_indice_en_uso`), útil con instancias que se duermen (Railway App Sleeping); si no hay, se activa con `/v1/index/activate` o `POST /api/indice/sincronizar` |
| `TEMPLATE_MIN_PHOTOS`, `TEMPLATE_MAX_PHOTOS` | 3 y 8. Mínimo y máximo de fotos de una plantilla. El 8 es techo duro compartido con SQL y con el proxy; el servicio no arranca si no se cumple `3 <= min <= max <= 8` |
| `TEMPLATE_OUTLIER_COSINE` | 0.35. Coseno medio mínimo de cada foto contra las demás al REGISTRAR; `0` apaga el descarte (modo calibración). Ver el protocolo debajo |
| `TEMPLATE_LINK_COSINE` | 0.30. Segundo criterio de consistencia: las fotos conservadas deben formar UN grupo (dos fotos se enlazan si su coseno >= este valor); detecta mezclas 3+3 de dos personas que la media no ve. `0` lo apaga. El constructor usa `min(0.20, este valor)`. Bájalo (0.25) solo si rechaza fotos genuinas de personas difíciles |
| `TEMPLATE_BUILD_OUTLIER_COSINE` | `min(0.25, TEMPLATE_OUTLIER_COSINE)`. Umbral, más permisivo, del constructor del índice (debe cumplir `0 <= build <= TEMPLATE_OUTLIER_COSINE`). No lo subas: solo se defiende de fotos corruptas o ajenas de verdad |
| `TEMPLATE_MAX_YAW_RATIO` | 0.40 (unos 36 grados). Giro máximo de una toma en modo conjunto (razón compensada por la inclinación de la cabeza) |
| `TEMPLATE_DUP_COSINE` | 0.97. Desde este coseno dos fotos cuentan como casi idénticas (advertencia `DIVERSIDAD_BAJA`) |
| `TEMPLATE_MAX_TOTAL_BYTES` | 31 457 280 (30 MiB). Tope de bytes de una petición a `/v1/photo/check-set` |

**Plantilla de varias fotos: calibración.** La plantilla pasa de 1 a 3–8 fotos que el servicio promedia en un solo vector (`docs/api/biometria.md` §4, `docs/DECISIONS.md` sección 6). El umbral 0.35 es una hipótesis calibrada con variantes de una foto por persona, no con fotos independientes reales. Protocolo: registrar 5 tomas reales de un alumno de prueba y leer el `coseno_resto` de cada una (Detalles de calidad en `/admin/alumnos/{id}`, o `activa.fotos` de `api_plantilla_alumno`). Si los valores típicos son menores que 0.5, baja `TEMPLATE_OUTLIER_COSINE` a 0.30 (poblaciones difíciles); si todas pasan siempre con valores > 0.8, puedes subirlo a 0.40–0.45 para detectar mezclas balanceadas de dos personas. Son variables del servicio: no requieren redeploy de la web. La plantilla multifoto exige `EMBEDDER=insightface`.

El índice vive en **memoria de un proceso**: con varias instancias, activa la versión en cada una. Un solo proceso resiste ~20 000 plantillas (búsqueda exhaustiva ≈ 1 ms).
Tras desplegar: `POST /api/indice/sincronizar` (administrador/técnico) o reconstruir desde `/tecnico`.

**Orden de despliegue de la plantilla de varias fotos: SQL, servicio, web.** Un servicio sin actualizar rechaza con 422 las entradas `objetos_foto` (solo ocurre si ya existen plantillas multifoto); con la BD nueva, el web y el servicio viejos siguen funcionando (4 argumentos y una sola foto). En modo local el adaptador cachea el catálogo de funciones 60 s: tras `scripts/db-up.sh`, reinicia el servicio y el Next, o espera más de 60 s (si no, `PGRST202`).

## 4. Tareas programadas (`/api/jobs/*`, `Authorization: Bearer $CRON_SECRET`)

Todas son idempotentes. Frecuencias sugeridas:

| Job | Qué hace | Cron |
|---|---|---|
| `POST /api/jobs/cerrar-sesiones` | Cierra sesiones abiertas cuya hora de fin pasó (crea ausentes, recalcula, bitácora) | `*/5 * * * *` |
| `POST /api/jobs/resolver-pendientes` | Pendientes sin revisar tras 48 h → ausente (origen `correccion`, cuenta de servicio) | `15 * * * *` |
| `POST /api/jobs/purgar-recortes` | Borra recortes de rostro con más de 7 días (objeto + ruta) | `0 3 * * *` |
| `POST /api/jobs/recalcular` | Recalcula faltas equivalentes y derecho a examen del periodo vigente | `30 2 * * *` |
| `POST /api/jobs/reconstruir-indice` | Indexa plantillas pendientes (no hace nada si no hay) | `*/15 * * * *` |

Tres formas de dispararlos (elige una):
- **Vercel Cron** (envía `GET` con `Authorization: Bearer $CRON_SECRET` automáticamente cuando existe la variable `CRON_SECRET`; los jobs aceptan `GET` y `POST`). En `vercel.json`: `{"crons":[{"path":"/api/jobs/cerrar-sesiones","schedule":"*/5 * * * *"}, …]}`.
- **GitHub Actions** (`schedule:` + `curl -fsS -X POST -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" https://<dominio>/api/jobs/<job>`).
- **pg_cron + pg_net** dentro de Supabase: `select cron.schedule('susan-cerrar', '*/5 * * * *', $$select net.http_post('https://<dominio>/api/jobs/cerrar-sesiones', headers := jsonb_build_object('Authorization','Bearer <CRON_SECRET>'))$$);`.

## 5. Operación

- **Calibración** (RNF-02): el técnico edita `umbral_similitud` (0.850), `min_detecciones_validas` (3), `intervalo_muestreo_seg` (15)… en `/tecnico`; cada cambio queda en bitácora con valor anterior y nuevo.
  Con rostros reales (InsightFace) el 0.850 es demasiado exigente (coseno 0.70): en local se calibró a **0.700** (coseno 0.40); ver `docs/DEMO.md` §9 y las mediciones en `recognition-service/README.md`. Recalíbralo con tus propias cámaras y plantillas.
  Cada detección conserva candidato y score aunque no alcance el umbral: úsalas para calibrar. Si la cola de revisión se llena, el umbral o el mínimo de lecturas son demasiado exigentes.
- **Consentimiento y baja**: revocar un consentimiento archiva la plantilla y obliga a reconstruir el índice; a ese alumno se le toma asistencia manual (RNF-06). **La revocación solo es efectiva cuando la reconstrucción termina `activada`**: `reconstruirSinFallar` devuelve `pendiente` si falla y la pantalla de revocación lo avisa ("El índice facial conserva el vector hasta que se reconstruya"); en ese caso reconstruye desde `/tecnico`.
- **Retención de fotos de plantillas archivadas o revocadas**: archivar es solo `activa = false`; ninguna ruta borra fotos del bucket (ni la principal ni las extra de `plantilla_foto`), `vencer_consentimientos` no archiva y la purga de recortes (RNF-05) no las cubre. Con varias fotos el volumen retenido por alumno sube hasta 8 veces. Consulta exacta para listarlas: `SELECT pf.objeto_foto FROM plantilla_foto pf JOIN plantilla_facial p USING (id_plantilla) WHERE NOT p.activa` (y, para consentimientos revocados o vencidos, `JOIN` con `consentimiento` por estatus). Hasta que exista el job de purga (`svc_job_purgar_fotos_archivadas`, pendiente), la retención y el borrado manual son responsabilidad del operador.
- **Plantilla de varias fotos**: reconstruir el índice con `completa = true` re-embebe todas las fotos (N veces el cómputo; con 20 000 plantillas de 5 fotos ≈ 28 min frente al objetivo de 10 min): úsala solo si es imprescindible. Un build falla (`INDICE_CONSTRUCCION_FALLIDA`, `details.errores[].codigo = SIN_MUESTRAS_UTILIZABLES`) solo si NINGUNA foto de una plantilla es utilizable; archiva esa plantilla (registrando de nuevo) y reconstruye. Las fotos subidas por API directa pueden conservar EXIF (el servidor no re-escribe los JPEG; la pantalla sí los re-codifica sin metadatos).
- **Rotar secretos**: `RECOGNITION_SERVICE_API_KEY`/`API_KEY` (ambos lados a la vez), `CRON_SECRET`, `service_role`. Si se filtra la `service_role`, rótala en Supabase de inmediato.
- **Auditoría**: `/admin/bitacora` (solo inserción: ni siquiera `service_role` puede modificarla).
- **Diagnóstico**: `GET /api/salud`; `GET /health` y `GET /v1/index` del servicio (con `X-API-Key`).

## 6. Desarrollo local (resumen)

`scripts/dev-all.sh` / `scripts/dev-stop.sh [--all]`; BD: `scripts/db-up.sh [--seed]`, `db-reset.sh`, `db-psql.sh`; pruebas: `scripts/test-sql.sh`.
Login por `curl` en modo local: `POST /api/_local/auth/login` exige la cabecera `Origin` igual al host. El estado local vive en `~/.susan-local/SUSAN` (ver `scripts/local-dir.sh`).
Si el proyecto está en un Escritorio con iCloud, **muévelo fuera** (p. ej. `~/Developer/SUSAN`); `node_modules`, `.next` y el venv ya son carpetas `*.nosync` como mitigación.
