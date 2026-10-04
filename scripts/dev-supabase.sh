#!/usr/bin/env bash
# Levanta la web en desarrollo contra el proyecto Supabase REAL (no el modo local).
# Lee las credenciales de supabase/.env (ignorado por Git; plantilla en docs/SUPABASE_SETUP.md) y las exporta
# solo a este proceso: así el modo local de scripts/dev-all.sh (:3000) sigue intacto y ambos pueden correr a la vez.
# Uso: scripts/dev-supabase.sh        Variables: WEB_PORT (3001)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/supabase/.env"
[ -f "$ENV_FILE" ] || { echo "Falta $ENV_FILE (ver docs/SUPABASE_SETUP.md §5)." >&2; exit 1; }
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
for v in SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY; do
    [ -n "${!v:-}" ] || { echo "Falta $v en supabase/.env" >&2; exit 1; }
done

WEB_PORT="${WEB_PORT:-3001}"
export NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
export NEXT_PUBLIC_SUPABASE_BUCKET="${SUPABASE_BUCKET:-susan-private}"
export SUPABASE_SERVICE_ROLE_KEY
export NEXT_PUBLIC_SITE_URL="http://localhost:$WEB_PORT"
# Secreto de /api/jobs/* solo para esta sesión de desarrollo (en producción lo fija el hosting).
export CRON_SECRET="${CRON_SECRET:-$(openssl rand -hex 24)}"
# El modo local NO debe filtrarse a este proceso aunque la terminal lo tenga exportado.
unset SUSAN_LOCAL NEXT_PUBLIC_SUSAN_LOCAL LOCAL_DATABASE_URL LOCAL_FAKE_NOW
# Carpeta de compilación propia: no choca con el .next del modo local.
export NEXT_DIST_DIR=".next-supabase"

cd "$ROOT/web"
exec npx next dev --port "$WEB_PORT"
