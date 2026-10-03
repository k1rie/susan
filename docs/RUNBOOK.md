# SUSAN — RUNBOOK (despliegue y operación)

Este documento describe cómo llevar SUSAN de modo local a un proyecto **Supabase real**. El modo local (`scripts/dev-all.sh`) está verificado de punta a punta;
el camino contra Supabase usa las **mismas migraciones y las mismas RPC**, pero no se ha ejecutado contra un proyecto vivo en esta sesión: haz el despliegue primero en un
proyecto de pruebas.

## 1. Supabase (base de datos, Auth y bucket)

1. Crea el proyecto en Supabase (PostgreSQL 15+; probado en 16). Anota `Project URL`, `anon key` y `service_role key`.
2. Aplica las migraciones (38 archivos `supabase/migrations/0001…0136`, orden lexicográfico):
   ```bash
   supabase link --project-ref <ref>
   supabase db push --dry-run     # revisa el plan: los prefijos 0001… funcionan como versiones numéricas
   supabase db push
   ```
   `0090`/`0091` crean el bucket privado `susan-private` (tope 50 MiB, sin políticas para `anon`/`authenticated`: solo el servidor lo toca con `service_role`).
   Si prefieres no usar la CLI, ejecuta los archivos en orden en el SQL Editor.
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

## 3. Servicio de reconocimiento

Imagen: `recognition-service/Dockerfile` (Python 3.12; `--build-arg ML=0` omite InsightFace). Variables (ver `recognition-service/.env.example`):

| Variable | Valor en producción |
|---|---|
| `APP_ENV` | `production` (exige `API_KEY`) |
| `API_KEY` | secreto largo; igual a `RECOGNITION_SERVICE_API_KEY` de la web |
| `EMBEDDER` | `insightface` (modelos de uso **no comercial**; se descargan a `MODEL_DIR` al primer arranque, ~120 MB) |
| `STORAGE_BACKEND` | `supabase` con `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BUCKET=susan-private` |
| `ALLOW_PRIVATE_CAMERAS` | `1` solo si las cámaras IP están en la LAN del plantel (el servicio las alcanza) |
| `INDEX_BOOTSTRAP_VERSION` | opcional: versión del índice a cargar al iniciar (si no, se activa con `/v1/index/activate` o `POST /api/indice/sincronizar`) |

El índice vive en **memoria de un proceso**: con varias instancias, activa la versión en cada una. Un solo proceso resiste ~20 000 plantillas (búsqueda exhaustiva ≈ 1 ms).
Tras desplegar: `POST /api/indice/sincronizar` (administrador/técnico) o reconstruir desde `/tecnico`.

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
  Cada detección conserva candidato y score aunque no alcance el umbral: úsalas para calibrar. Si la cola de revisión se llena, el umbral o el mínimo de lecturas son demasiado exigentes.
- **Consentimiento y baja**: revocar un consentimiento archiva la plantilla y obliga a reconstruir el índice; a ese alumno se le toma asistencia manual (RNF-06).
- **Rotar secretos**: `RECOGNITION_SERVICE_API_KEY`/`API_KEY` (ambos lados a la vez), `CRON_SECRET`, `service_role`. Si se filtra la `service_role`, rótala en Supabase de inmediato.
- **Auditoría**: `/admin/bitacora` (solo inserción: ni siquiera `service_role` puede modificarla).
- **Diagnóstico**: `GET /api/salud`; `GET /health` y `GET /v1/index` del servicio (con `X-API-Key`).

## 6. Desarrollo local (resumen)

`scripts/dev-all.sh` / `scripts/dev-stop.sh [--all]`; BD: `scripts/db-up.sh [--seed]`, `db-reset.sh`, `db-psql.sh`; pruebas: `scripts/test-sql.sh`.
Login por `curl` en modo local: `POST /api/_local/auth/login` exige la cabecera `Origin` igual al host. El estado local vive en `~/.susan-local/SUSAN` (ver `scripts/local-dir.sh`).
Si el proyecto está en un Escritorio con iCloud, **muévelo fuera** (p. ej. `~/Developer/SUSAN`); `node_modules`, `.next` y el venv ya son carpetas `*.nosync` como mitigación.
