#!/usr/bin/env bash
# Genera en supabase/dist/ (ignorado por git) dos archivos para pegar en el SQL Editor de Supabase si no usas la CLI:
#   schema_completo.sql  = todas las migraciones, en orden
#   seed_demo.sql        = semilla de demostración (sin las cuentas locales de 10_local_auth.sql)
# La vía recomendada es la CLI:  supabase link --project-ref <ref> && supabase db push --include-seed
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/supabase/dist"; mkdir -p "$OUT"
{ echo "-- SUSAN · esquema completo (generado por scripts/bundle-supabase-sql.sh)"; for f in "$ROOT"/supabase/migrations/*.sql; do echo; echo "-- ===== $(basename "$f") ====="; cat "$f"; done; } > "$OUT/schema_completo.sql"
{ echo "-- SUSAN · semilla de demostración (generado por scripts/bundle-supabase-sql.sh)"; for n in 01_catalogo 02_sesiones 03_historial 99_recalcular; do echo; echo "-- ===== $n ====="; cat "$ROOT/supabase/seed/$n.sql"; done; } > "$OUT/seed_demo.sql"
ls -la "$OUT" | tail -n +2
