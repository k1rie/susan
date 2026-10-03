# SUSAN con tu proyecto Supabase — paso a paso

Objetivo: dejar tu proyecto Supabase listo (esquema, datos de demostración y cuentas) para **solo probar la interfaz**. Tiempo estimado: 15 minutos.
Para producción real (cron, servicio de reconocimiento, respaldo) ver [`RUNBOOK.md`](./RUNBOOK.md).

> Las migraciones son **idénticas** a las que se probaron en local (1232 aserciones positivas y 801 negativas). El camino contra Supabase usa el mismo SQL; el cliente web en
> modo real se verificó contra un Supabase simulado (ver `docs/review/real-mode.md`), pero aún no contra un proyecto vivo: ante cualquier diferencia, avísame con el mensaje de error.

## 0. Qué necesitas

- Un proyecto en <https://supabase.com> (plan gratuito sirve). Anota en *Project Settings → API*: **Project URL**, **anon key** y **service_role key** (esta última es secreta: nunca en `NEXT_PUBLIC_*`).
- Node 20.9+ y la CLI de Supabase (`brew install supabase/tap/supabase`).
- El repo: `git clone https://github.com/k1rie/susan.git && cd susan`.

## 1. Aplicar esquema + semilla

```bash
supabase login
supabase link --project-ref <ref-de-tu-proyecto>
supabase db push --dry-run                 # revisa el plan (39 migraciones 0001…0990)
supabase db push --include-seed            # esquema + semilla de demostración (supabase/config.toml)
```

¿Sin CLI? Genera los paquetes y pégalos en el **SQL Editor** (primero el esquema, luego la semilla):

```bash
scripts/bundle-supabase-sql.sh             # crea supabase/dist/schema_completo.sql y seed_demo.sql
```

La semilla trae: 75 alumnos, 3 grupos (3A, 3B, 5C) con 48 sesiones cada uno, historial con patrones de ausentismo (deterioro, abandono, ausencias en viernes, retardos),
justificantes, docentes y las filas de `usuario` de demostración (**sin** cuentas de Auth: se crean en el paso 3).

## 2. Autenticación (Project Settings → Authentication)

- Desactiva el registro público: *Providers → Email → Allow new users to sign up = off* (SUSAN no tiene autorregistro; el administrador crea las cuentas).
- *URL Configuration*: **Site URL** `http://localhost:3000` (y tu dominio cuando lo tengas) y en *Redirect URLs* agrega `http://localhost:3000/cambiar-contrasena`.
- **Plantillas de correo** (*Authentication → Email Templates*): para que el enlace funcione aunque se abra en **otro navegador o dispositivo**, cambia el enlace de las plantillas
  *Reset Password* e *Invite user* a:
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` (recuperación) y `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` (invitación).
  La ruta `/auth/confirm` canjea el token en el servidor y lleva a `/cambiar-contrasena`. (Con la plantilla por defecto solo funciona en el mismo navegador que pidió el correo.)
- Para pruebas rápidas puedes dejar el SMTP por defecto de Supabase (límite de correos bajo). Para producción configura SMTP propio.

## 3. Cuentas de demostración

```bash
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service_role> \
  node scripts/seed-auth-users.mjs --password 'Susan-Demo-2026'
```

Crea en Auth las cuentas de la semilla con el **mismo uuid** de la tabla `usuario`: `admin@susan.local`, `tecnico@susan.local`, `docente1@susan.local` (grupos 3A y 5C),
`docente2@susan.local`, `docente3@susan.local`, `e260001@susan.local`…`e260025@susan.local` (alumnos de 3A), todas con la contraseña que pases en `--password`
(sin `--password` genera una distinta por cuenta y la imprime una vez). Es idempotente.

> Contraseña de demostración: solo para el proyecto de pruebas. No la uses en un proyecto real.

**Primer administrador de un proyecto real** (sin semilla): `node scripts/bootstrap-admin.mjs --email admin@tu-dominio.mx` (crea la cuenta de Auth + fila `usuario`).

## 4. Reloj de demostración (recomendado para probar)

La semilla narra el **lunes 14-sep-2026 07:12**. Con el reloj real no habría sesiones "de hoy" para abrir. Pega en el SQL Editor `supabase/demo/demo_clock_on.sql`:

```sql
ALTER DATABASE postgres SET app.allow_fake_clock = 'on';
ALTER DATABASE postgres SET app.fake_now = '2026-09-14 07:12:00-06';
```

Aplica a conexiones nuevas (si no se nota, espera unos minutos o reinicia la base en *Project Settings → Database*). La app mostrará el aviso "Reloj simulado activo".
Para volver al reloj real: `supabase/demo/demo_clock_off.sql`.

## 5. Variables de entorno de la web

Crea `web/.env.local` (está en `.gitignore`):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>          # solo servidor
NEXT_PUBLIC_SITE_URL=http://localhost:3000
CRON_SECRET=cualquier-cadena-larga                    # para /api/jobs/* (opcional en pruebas de diseño)
# Reconocimiento (opcional para probar solo la interfaz; sin servicio la cámara muestra aviso y se usa pase manual):
# RECOGNITION_SERVICE_URL=http://127.0.0.1:8000
# RECOGNITION_SERVICE_API_KEY=dev-key
```

```bash
cd web && npm install && npm run dev        # http://localhost:3000
```

Inicia sesión con `docente1@susan.local` → *Abrir sesión* del grupo 3A; con `admin@susan.local` para catálogos/grupos; con `e260001@susan.local` para el portal del alumno;
`tecnico@susan.local` para la consola técnica. La pantalla **Analítica** funciona con los patrones sembrados.

## 6. (Opcional) Servicio de reconocimiento contra Supabase

Para probar la captura con cámara y el índice FAISS guardado como JSON en tu bucket:

```bash
cd recognition-service && python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
APP_ENV=development API_KEY=dev-key EMBEDDER=fake STORAGE_BACKEND=supabase \
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service_role> BUCKET=susan-private \
  .venv/bin/uvicorn app.main:app_factory --factory --port 8000
```
(`EMBEDDER=insightface` usa modelos reales de uso no comercial; `fake` sirve para ver el flujo). El bucket `susan-private` lo crea la migración `0090`.

## Comprobaciones rápidas

| Síntoma | Causa probable |
|---|---|
| Login responde "credenciales inválidas" | No corriste el paso 3 o la contraseña no coincide |
| `NO_AUTENTICADO` / `CUENTA_NO_VINCULADA` tras entrar | La cuenta de Auth no tiene fila en `usuario` con el mismo uuid (paso 3) |
| El panel docente no muestra sesiones de hoy | Falta el reloj de demostración (paso 4) |
| `Could not find the function public.api_…` | PostgREST no recargó: ejecuta `NOTIFY pgrst, 'reload schema';` en el SQL Editor |
| Correos de recuperación no llegan | SMTP por defecto limitado; configura el tuyo |
