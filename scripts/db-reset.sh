#!/usr/bin/env bash
# Recrea la BD 'susan' desde cero: stubs + todas las migraciones + semilla.
#   scripts/db-reset.sh            con semilla de demostracion
#   scripts/db-reset.sh --no-seed  solo esquema
set -euo pipefail
# shellcheck source=db-common.sh
source "$(dirname "${BASH_SOURCE[0]}")/db-common.sh"

CON_SEMILLA=1
for a in "$@"; do
    case "$a" in
        --no-seed) CON_SEMILLA=0 ;;
        -h|--help) sed -n '2,5p' "${BASH_SOURCE[0]}"; exit 0 ;;
        *) db_die "Opcion desconocida: $a" ;;
    esac
done

db_ensure_cluster
db_log "Recreando la base '$DB_NAME'"
db_drop "$DB_NAME"
db_create "$DB_NAME"
nuevas="$(db_apply_migrations "$DB_NAME")"
db_log "Migraciones aplicadas: $nuevas"
if [ "$CON_SEMILLA" = "1" ]; then
    db_apply_seed "$DB_NAME"
fi
db_log "Lista: postgres://127.0.0.1:$PGPORT_LOCAL/$DB_NAME"
