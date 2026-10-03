# Revision del modo real de Supabase (con un Supabase simulado fiel)

Herramienta: `scripts/fake-supabase.mjs` (GoTrue + PostgREST/rpc + Storage en 127.0.0.1:54399, sin dependencias
nuevas; usa la BD local `susan_realmode`, un clon de `susan`, y el ejecutor `web/src/lib/local/rpc.js`).
Next arrancado SIN `SUSAN_LOCAL`, puerto 3120, `NEXT_DIST_DIR=.next-realmode.nosync`.
Prueba automatica: `web/src/review/realmode.test.js`.

## Verificado y correcto (registro en vivo)

- Login real con `createBrowserClient.signInWithPassword` desde el navegador (pagina /login): cookie
  `sb-127-auth-token` (el ref es el primer label del host; con `abcd.supabase.co` sera `sb-abcd-auth-token`),
  formato `base64-<json>`, 1587 bytes (sin chunking a ese tamano), NO HttpOnly (diseno de @supabase/ssr: el
  navegador necesita leerla; ver nota en "Como conectar").
- `/docente` con sesion: `requerirSesion` + `api_yo` en el servidor por PostgREST (200); docente en `/admin` y
  alumno en `/docente` redirigen a su home (`NEXT_REDIRECT;replace;/alumno;307`), igual que en modo local.
- Sin cookie: `/docente` -> 307 `/login?next=%2Fdocente`; `/api/indice` -> 401 JSON `NO_AUTENTICADO`.
- `/api/indice`: docente 403, alumno 403, tecnico 200, admin 200 (service_role no interviene; RPC con el JWT del usuario).
- Refresh en el proxy: con `access_token` caducado y refresh vigente, `/docente` responde 200 con `Set-Cookie`
  de la cookie nueva y `Cache-Control: no-cache, must-revalidate`; 3 peticiones paralelas con la misma cookie
  caducada responden 200 (el stub imita el intervalo de reuso de 10 s de GoTrue).

- Rutas protegidas por rol en servidor: `/admin` con alumno y `/docente` con alumno/admin redirigen a su home; un
  JWT de usuario contra `svc_*` da 42501 -> 403 y contra `/auth/v1/admin/*` da 403 `not_admin`; el anon da 401.
- Sesion muerta (refresh ya usado, sesion revocada, cookie basura, trozos corruptos): `/docente` -> 307
  `/login?next=...` con `Set-Cookie: sb-127-auth-token=; Max-Age=0`; `/api/indice` -> 401 JSON y cookie borrada.
- `POST /api/admin/usuarios` (service_role, `auth.admin.createUser`): 201 con contrasena temporal; duplicado -> 409
  `DUPLICADO`; **compensacion**: con `id_docente` inexistente `svc_usuario_crear` falla (404 `NO_ENCONTRADO`) y la
  cuenta de Auth queda borrada (comprobado en `auth.users` y `public.usuario`); docente -> 403;
  `/api/admin/usuarios/{id}/restablecer` (`listUsers` + `updateUserById`) -> 200.
- Refresh dentro de un Route Handler de escritura: `POST /api/admin/usuarios` con cookie caducada -> 201 + `Set-Cookie`
  nuevo, con UNA sola llamada `POST /auth/v1/token` por peticion.
- Cierre de sesion desde la UI (menu -> Salir): `POST /auth/v1/logout` (precedido del preflight CORS), cookie borrada,
  redireccion a `/login?msg=sesion_cerrada`.
- Storage con `createClient(service_role)` (via vitest): upload con Buffer y con Blob (FormData), duplicado sin upsert
  -> `statusCode '409'`, `createSignedUrl` -> URL absoluta `.../storage/v1/object/sign/...?token=` que se descarga sin
  cabeceras y con token manipulado da 400, `download`, `remove`, y el bucket privado cerrado al JWT de usuario (403).
- Rutas del adaptador local (`/api/_local/*`) en modo real: todas 404 (`NO_ENCONTRADO`); no hay puerta trasera.
- Bundle del cliente (`.next-realmode.nosync/dev/static`, 78 archivos): el valor de `SUPABASE_SERVICE_ROLE_KEY` y el
  secreto JWT NO aparecen (0 archivos); la anon key si (es publica, `NEXT_PUBLIC_*`). Ver el hallazgo 4 sobre
  `serverEnv()`. (`next build` no se ejecuto por instruccion: se reviso el bundle de `next dev` en modo real.)
- Prueba automatica `web/src/review/realmode.test.js`: 14 pruebas contra el stub (login/cookie base64-, getUser en
  peticion nueva, sin sesion 42501/401, error de negocio -> ApiError 403, cookies en trozos .0/.1 con metadatos de
  8 KB, proxy sin cookie/basura/refresh/sesion revocada, admin createUser/dup/weak_password/listUsers/update/delete,
  svc_* por rol, JWT de usuario vs API admin, Storage completo, bucket privado cerrado).

## Bugs de modo real corregidos

Ninguno en `web/src/lib/backend/**`: el camino real (cliente del navegador, `createServerClient` en RSC y handlers,
refresco en el proxy, `createClient` service_role, `restringir`) funciono a la primera contra el stub. Los dos
problemas reales encontrados estan fuera de la zona de correccion permitida y se reportan abajo.

## Hallazgos (fuera de la zona de escritura: solo reportados)

1. **major** - Una caida o lentitud de Auth cierra la sesion de la interfaz. `web/src/lib/server/auth.js`
   `usuarioAuth()` (lineas ~38-48) devuelve `null` ante CUALQUIER fallo de `getUser()`, tambien un
   `AuthRetryableFetchError` (red, 5xx, timeout) que `supabase-js` devuelve como `{ error }` sin lanzar.
   Evidencia (stub detenido con una cookie vigente): `GET /api/indice` -> 401 `NO_AUTENTICADO`; `GET /tecnico` -> 307
   `/login?next=%2Ftecnico`. El cliente HTTP (`lib/http/client.js:105`) despacha `EVENTO_SESION_EXPIRADA` en todo 401,
   asi que un parpadeo de GoTrue manda al usuario a /login (la cookie no se borra, pero la sesion de pantalla se pierde).
   Correccion: en `usuarioAuth`/`proxy.js` distinguir `error.name === 'AuthRetryableFetchError'` o `status >= 500`
   y responder 503 `ERROR_RED`/`AUTH_NO_DISPONIBLE` (no 401) y en el proxy dejar pasar sin redirigir; el cliente
   debe despachar el evento solo con `NO_AUTENTICADO` real. Tambien conviene un timeout para el `fetch` de Auth.
2. **major** - La recuperacion de contrasena solo funciona en el MISMO navegador. `@supabase/ssr`
   `createBrowserClient` fuerza `flowType: "pkce"` (`node_modules/@supabase/ssr/dist/module/createBrowserClient.js:41`,
   despues de `...options.auth`: no se puede cambiar). El enlace del correo llega como `?code=` y su canje exige el
   `code_verifier` que `resetPasswordForEmail` dejo en una cookie del navegador que lo pidio; abrir el correo en el
   telefono o en otro navegador falla. El comentario de `src/proxy.js` y de `cambiar-contrasena/page.jsx` ("el token
   llega en el hash") es falso con este cliente. Ademas `restringir` no expone `exchangeCodeForSession`/`verifyOtp`.
   Correccion: plantilla de correo de recuperacion `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
   + Route Handler que llame `verifyOtp({ type:'recovery', token_hash })` con el backend de servidor y redirija a
   `/cambiar-contrasena`. (No ejecutado: el stub no implementa `/auth/v1/verify`; hallazgo por lectura del cliente.)
3. **minor** - 2-3 viajes a Auth por peticion. `GET /api/indice` genera `GET /auth/v1/user` x2 (proxy + handler) +
   `api_yo`; una pagina genera 3 `GET /auth/v1/user` y 2 `api_yo` (layout y pagina). Los endpoints de captura se
   llaman con frecuencia: `getUser()` por duplicado anade latencia y carga a GoTrue. Correccion: `getClaims()` (verifica
   el JWT localmente) en el proxy o excluir `/api/*` del proxy y dejar que el handler valide.
4. **minor** - `serverEnv()` de `src/config.js` entra al bundle del cliente (en dev): aparecen en
   `static/chunks/*.js` los nombres `SUPABASE_SERVICE_ROLE_KEY`, `LOCAL_AUTH_SECRET`, el secreto por defecto
   `susan-local-dev-secret-change-me` y la URL `postgres://localhost:54329/susan` (4 archivos). Los VALORES no se
   filtran (en el navegador `process.env` solo trae `NEXT_PUBLIC_*`; 0 coincidencias del valor real), pero el
   secreto HMAC por defecto del modo local queda publicado: si alguien despliega por error con `SUSAN_LOCAL=1`
   sin `LOCAL_AUTH_SECRET`, cualquiera forjaria cookies. Correccion: mover `serverEnv` a un modulo con
   `import 'server-only'` (o validar en `localAuthSecret` que en `NODE_ENV=production` no se use el valor por defecto).
5. **minor (documentacion)** - La cookie `sb-<ref>-auth-token` del modo real NO es HttpOnly (el cliente del
   navegador la necesita; `Set-Cookie` de `@supabase/ssr` usa `httpOnly:false`, `maxAge` 400 dias). `ARCHITECTURE.md`
   solo describe la cookie httpOnly del modo local: conviene anotar la diferencia (un XSS exfiltra el refresh token)
   y reforzar CSP.

## Como conectar tu proyecto Supabase real

Variables (`web/.env.local` o las del hosting; **sin** `SUSAN_LOCAL`):

| Variable | Valor | Visible al navegador |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | si |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key | si |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role / secret key | NO, nunca `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SITE_URL` | URL publica (con https) | si (el valor por omision `http://localhost:3000` rompe el enlace de recuperacion y la comprobacion de Origen) |
| `NEXT_PUBLIC_SUPABASE_BUCKET` | `susan-private` (privado) | si |
| `RECOGNITION_SERVICE_URL`, `RECOGNITION_SERVICE_API_KEY`, `CRON_SECRET` | servicio y jobs | NO |

Comprobaciones en el proyecto, en este orden:
1. Aplicar `supabase/migrations/*` (incluye `0990_postgrest_reload.sql`) y la semilla minima; en Auth crear el primer
   administrador y vincularlo con `svc_usuario_crear`/seed (`usuario.auth_uid = auth.users.id`).
2. Auth > URL Configuration: `Site URL` = `NEXT_PUBLIC_SITE_URL`; `Redirect URLs` incluye `<SITE>/cambiar-contrasena`
   (y `/auth/confirm` si se aplica el hallazgo 2). Auth > Providers: Email activo, "Confirm email" segun politica,
   politica de contrasena >= 10 con letra y digito (la app la exige).
3. Storage: bucket `susan-private` PRIVADO, limite de tamano 10 MiB, y la politica de `0090_storage_policies.sql`
   (el JWT de usuario no toca el bucket: comprobar que `upload` con sesion de docente da 403).
4. Con las llaves nuevas (`sb_publishable_...`/`sb_secret_...`) o las JWT clasicas: ambas sirven con `supabase-js`
   ^2.117; las `sb_secret_` no son JWT (no usarlas como Bearer a mano).
5. Prueba de humo: `curl $URL/rest/v1/rpc/api_yo -H "apikey: <anon>"` -> 401 `42501`; el mismo con el JWT de un
   docente (`/auth/v1/token?grant_type=password`) -> `{rol:'docente',...}`; con la service_role `svc_indice_en_uso` -> 200.
6. En la app: login (cookie `sb-<ref>-auth-token`), `/docente` con docente, `/admin` con docente redirige, crear un
   usuario desde /admin/usuarios (y borrar la cuenta de prueba), subir un justificante y abrir su URL firmada (<= 300 s).
7. Tras desplegar: `grep -r <valor de SUPABASE_SERVICE_ROLE_KEY> .next/static` debe dar 0 resultados.
8. Reproducir todo esto sin Supabase: `LOCAL_DATABASE_URL=... node scripts/fake-supabase.mjs` y
   `npx vitest run src/review/realmode.test.js` (ver el encabezado de `scripts/fake-supabase.mjs`).

## Limites del stub (no sustituyen una prueba contra Supabase real)

Sin `/auth/v1/verify` ni PKCE, sin correo, sin llaves asimetricas (ES256/JWKS) ni rate limits, `void` de PostgREST
responde `200 null` (el real puede responder 204), claims JWT minimos en `request.jwt.claims`, y el estado de
sesiones/refresh vive en memoria (reiniciar el stub invalida todas las cookies, como si se revocaran las sesiones).
