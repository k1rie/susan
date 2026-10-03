#!/usr/bin/env bash
# Detiene el PostgreSQL local (los datos de .local/pgdata se conservan).
set -euo pipefail
# shellcheck source=db-common.sh
source "$(dirname "${BASH_SOURCE[0]}")/db-common.sh"

db_check_bin
if db_running; then
    "$PGBIN/pg_ctl" -D "$PGDATA_DIR" -m fast -w stop >/dev/null
    db_log "PostgreSQL detenido."
else
    db_log "PostgreSQL ya estaba detenido."
fi
