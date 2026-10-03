#!/usr/bin/env bash
# Funciones comunes de los scripts de base de datos local (se carga con 'source').
# PostgreSQL 16 de Homebrew, sin Docker. Puerto 54329, datos en $SUSAN_LOCAL_DIR/pgdata.

SUSAN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/local-dir.sh
source "$SUSAN_ROOT/scripts/local-dir.sh"   # define SUSAN_LOCAL_DIR (fuera de iCloud si hace falta)
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@16/bin}"
PGDATA_DIR="${SUSAN_PGDATA:-$SUSAN_LOCAL_DIR/pgdata}"
PGPORT_LOCAL="${SUSAN_PGPORT:-54329}"
PGSOCKET_DIR="${SUSAN_PGSOCKET:-/tmp}"
DB_NAME="${SUSAN_DB:-susan}"
MIGRATIONS_DIR="$SUSAN_ROOT/supabase/migrations"
STUBS_FILE="$SUSAN_ROOT/supabase/local/00_supabase_stubs.sql"
SEED_DIR="$SUSAN_ROOT/supabase/seed"
LOCK_DIR="$SUSAN_LOCAL_DIR/cluster.lock"

# Sin esto el postmaster aborta en macOS con "became multithreaded during startup".
export LC_ALL=en_US.UTF-8
export LANG=en_US.UTF-8
export PATH="$PGBIN:$PATH"

# Conexion por TCP a 127.0.0.1 (autenticacion trust: solo desarrollo local).
export PGHOST=127.0.0.1
export PGPORT="$PGPORT_LOCAL"
export PGCONNECT_TIMEOUT=5

db_log() { printf '[db] %s\n' "$*" >&2; }
db_die() { printf '[db] ERROR: %s\n' "$*" >&2; exit 1; }

db_check_bin() {
    [ -x "$PGBIN/pg_ctl" ] || db_die "No se encontro PostgreSQL 16 en $PGBIN (brew install postgresql@16)."
}

db_running() {
    "$PGBIN/pg_isready" -q -h 127.0.0.1 -p "$PGPORT_LOCAL"
}

# Toma un candado (mkdir es atomico) para que varias ejecuciones en paralelo
# no intenten crear o arrancar el cluster al mismo tiempo.
db_lock() {
    mkdir -p "$SUSAN_LOCAL_DIR"
    local intentos=0
    until mkdir "$LOCK_DIR" 2>/dev/null; do
        intentos=$((intentos + 1))
        # Candado huerfano (> 2 min): se retira.
        if [ -d "$LOCK_DIR" ] && [ -n "$(find "$LOCK_DIR" -maxdepth 0 -mmin +2 2>/dev/null)" ]; then
            rmdir "$LOCK_DIR" 2>/dev/null || true
        fi
        [ "$intentos" -gt 240 ] && db_die "No se pudo obtener el candado del cluster ($LOCK_DIR)."
        sleep 0.5
    done
}
db_unlock() { rmdir "$LOCK_DIR" 2>/dev/null || true; }

# Crea (si falta) y arranca el cluster. Idempotente y seguro en paralelo.
db_ensure_cluster() {
    db_check_bin
    db_running && return 0
    db_lock
    if db_running; then db_unlock; return 0; fi
    if [ ! -f "$PGDATA_DIR/PG_VERSION" ]; then
        db_log "Creando cluster en $PGDATA_DIR"
        mkdir -p "$PGDATA_DIR"
        "$PGBIN/initdb" -D "$PGDATA_DIR" -E UTF8 --locale=en_US.UTF-8 -A trust >/dev/null
        # Ajustes solo de desarrollo: rapido y con la misma zona horaria que Supabase.
        cat >> "$PGDATA_DIR/postgresql.conf" <<'CONF'
timezone = 'UTC'
log_timezone = 'UTC'
fsync = off
synchronous_commit = off
full_page_writes = off
max_connections = 100
CONF
    fi
    db_log "Arrancando PostgreSQL en 127.0.0.1:$PGPORT_LOCAL"
    "$PGBIN/pg_ctl" -D "$PGDATA_DIR" -l "$SUSAN_LOCAL_DIR/pg.log" -w -t 60 \
        -o "-c listen_addresses=127.0.0.1 -k $PGSOCKET_DIR -p $PGPORT_LOCAL" start >/dev/null \
        || { db_unlock; db_die "No arranco PostgreSQL (ver $SUSAN_LOCAL_DIR/pg.log)."; }
    db_unlock
}

# psql contra una BD (por omision la principal).
db_psql() {
    local bd="$DB_NAME"
    if [ "${1:-}" = "-d" ]; then bd="$2"; shift 2; fi
    PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -v ON_ERROR_STOP=1 -d "$bd" "$@"
}

db_exists() {
    [ "$("$PGBIN/psql" -X -Atq -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$1'")" = "1" ]
}

db_create() {
    "$PGBIN/psql" -X -q -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$1\" ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'en_US.UTF-8' LC_CTYPE 'en_US.UTF-8'" >/dev/null
    # El reloj simulado solo se habilita en bases locales/de prueba (nunca en produccion).
    "$PGBIN/psql" -X -q -d postgres -v ON_ERROR_STOP=1 \
        -c "ALTER DATABASE \"$1\" SET app.allow_fake_clock = 'on'" \
        -c "ALTER DATABASE \"$1\" SET timezone = 'UTC'" >/dev/null
}

db_drop() {
    "$PGBIN/psql" -X -q -d postgres -c "DROP DATABASE IF EXISTS \"$1\" WITH (FORCE)" >/dev/null 2>&1 || true
}

# Aplica stubs (siempre; son idempotentes) y las migraciones pendientes de la BD.
# Cada migracion corre en su propia transaccion, como hace Supabase.
db_apply_migrations() {
    local bd="$1"
    db_psql -d "$bd" -f "$STUBS_FILE" || db_die "Fallaron los stubs de Supabase."
    db_psql -d "$bd" -c "CREATE SCHEMA IF NOT EXISTS supabase_migrations; CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (version text PRIMARY KEY, name text, aplicada timestamptz NOT NULL DEFAULT now());"
    local f version aplicada n=0
    for f in "$MIGRATIONS_DIR"/*.sql; do
        [ -e "$f" ] || continue
        version="$(basename "$f" .sql)"
        aplicada="$("$PGBIN/psql" -X -Atq -d "$bd" -c "SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '$version'")"
        [ "$aplicada" = "1" ] && continue
        db_psql -d "$bd" --single-transaction -f "$f" || db_die "Fallo la migracion $version."
        db_psql -d "$bd" -c "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('$version', '$version')"
        n=$((n + 1))
    done
    echo "$n"
}

# Aplica la semilla (supabase/seed/*.sql en orden lexicografico).
db_apply_seed() {
    local bd="$1" f
    for f in "$SEED_DIR"/*.sql; do
        [ -e "$f" ] || continue
        db_log "semilla: $(basename "$f")"
        db_psql -d "$bd" -f "$f" || db_die "Fallo la semilla $(basename "$f")."
    done
    db_psql -d "$bd" -c "CREATE SCHEMA IF NOT EXISTS supabase_migrations; CREATE TABLE IF NOT EXISTS supabase_migrations.seed_runs (aplicada timestamptz NOT NULL DEFAULT now()); INSERT INTO supabase_migrations.seed_runs DEFAULT VALUES;"
}

# Dos consultas separadas: un CASE con subconsulta falla al planificar si la tabla aun no existe.
db_seed_applied() {
    local existe
    existe="$("$PGBIN/psql" -X -Atq -d "$1" -c "SELECT to_regclass('supabase_migrations.seed_runs') IS NOT NULL")"
    [ "$existe" = "t" ] || return 1
    [ "$("$PGBIN/psql" -X -Atq -d "$1" -c "SELECT count(*) FROM supabase_migrations.seed_runs")" != "0" ]
}
