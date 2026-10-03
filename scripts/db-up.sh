#!/usr/bin/env bash
# Levanta la base local: crea el cluster si falta, lo arranca, crea la BD 'susan'
# y aplica los stubs de Supabase + las migraciones pendientes. Idempotente.
#   scripts/db-up.sh            solo esquema
#   scripts/db-up.sh --seed     ademas carga la semilla de demostracion (una sola vez)
set -euo pipefail
# shellcheck source=db-common.sh
source "$(dirname "${BASH_SOURCE[0]}")/db-common.sh"

CON_SEMILLA=0
for a in "$@"; do
    case "$a" in
        --seed) CON_SEMILLA=1 ;;
        -h|--help) sed -n '2,6p' "${BASH_SOURCE[0]}"; exit 0 ;;
        *) db_die "Opcion desconocida: $a" ;;
    esac
done

db_ensure_cluster
if ! db_exists "$DB_NAME"; then
    db_log "Creando la base '$DB_NAME'"
    db_create "$DB_NAME"
fi
nuevas="$(db_apply_migrations "$DB_NAME")"
db_log "Migraciones aplicadas ahora: $nuevas"

if [ "$CON_SEMILLA" = "1" ]; then
    if db_seed_applied "$DB_NAME"; then
        db_log "La semilla ya estaba cargada (usa scripts/db-reset.sh para recrearla)."
    else
        db_apply_seed "$DB_NAME"
    fi
fi
db_log "Lista: postgres://127.0.0.1:$PGPORT_LOCAL/$DB_NAME"
