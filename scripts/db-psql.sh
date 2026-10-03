#!/usr/bin/env bash
# psql interactivo (o con los argumentos que se pasen) contra la BD local.
#   scripts/db-psql.sh
#   scripts/db-psql.sh -c "select count(*) from alumno"
set -euo pipefail
# shellcheck source=db-common.sh
source "$(dirname "${BASH_SOURCE[0]}")/db-common.sh"

db_ensure_cluster
exec "$PGBIN/psql" -X -d "$DB_NAME" "$@"
