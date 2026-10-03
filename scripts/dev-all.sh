#!/usr/bin/env bash
# Levanta todo SUSAN en modo local (sin Docker ni Supabase): PostgreSQL + servicio de
# reconocimiento (EMBEDDER=fake) + Next en desarrollo. Idempotente: lo que ya corre se respeta.
# Uso: scripts/dev-all.sh        (detener: scripts/dev-stop.sh [--all])
# Variables: WEB_PORT (3000) · RECOGNITION_PORT (8000) · RECOGNITION_SERVICE_API_KEY (dev-local-key)
#            SUSAN_FAKE_NOW (def. '2026-09-14 07:12:00-06', el escenario de la semilla; 'off' = reloj real)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/scripts/local-dir.sh"   # SUSAN_LOCAL_DIR: fuera de iCloud si el proyecto esta en el Escritorio
RUN_DIR="$SUSAN_LOCAL_DIR/run"
STORAGE_DIR_ABS="$SUSAN_LOCAL_DIR/storage"
WEB_PORT="${WEB_PORT:-3000}"
REC_PORT="${RECOGNITION_PORT:-8000}"
# Clave SOLO de desarrollo; el servicio y los Route Handlers la comparten.
API_KEY="${RECOGNITION_SERVICE_API_KEY:-dev-local-key}"
FAKE_NOW="${SUSAN_FAKE_NOW-2026-09-14 07:12:00-06}"
DB_URL="postgres://127.0.0.1:${SUSAN_PGPORT:-54329}/${SUSAN_DB:-susan}"

log() { printf '[dev] %s\n' "$*"; }
die() { printf '[dev] ERROR: %s\n' "$*" >&2; exit 1; }

mkdir -p "$RUN_DIR" "$STORAGE_DIR_ABS"

vivo() { [ -f "$1" ] && kill -0 "$(cat "$1")" 2>/dev/null; }

# Espera a que una URL responda (cualquier codigo HTTP cuenta como "arriba").
esperar() { # url etiqueta segundos pidfile logfile
    local url="$1" etiqueta="$2" max="$3" pidfile="$4" logfile="$5" i=0
    while ! curl -s -o /dev/null --max-time 2 "$url"; do
        i=$((i + 1))
        if ! vivo "$pidfile"; then
            tail -n 20 "$logfile" >&2 || true
            die "$etiqueta termino antes de responder (ver $logfile)."
        fi
        [ "$i" -ge "$max" ] && die "$etiqueta no respondio en ${max}s (ver $logfile)."
        sleep 1
    done
}

# ---------------------------------------------------------------------------- 1. PostgreSQL
log "PostgreSQL local (db-up --seed)"
"$ROOT/scripts/db-up.sh" --seed

# ---------------------------------------------------------------------------- 2. Reconocimiento
if vivo "$RUN_DIR/recognition.pid"; then
    log "Servicio de reconocimiento ya corre (pid $(cat "$RUN_DIR/recognition.pid"))"
else
    log "Arrancando servicio de reconocimiento en :$REC_PORT (EMBEDDER=fake; la 1a vez crea el venv)"
    (
        cd "$ROOT/recognition-service"
        EMBEDDER=fake STORAGE_BACKEND=local STORAGE_DIR="$STORAGE_DIR_ABS" \
            API_KEY="$API_KEY" PORT="$REC_PORT" \
            nohup ./run-local.sh fake > "$RUN_DIR/recognition.log" 2>&1 &
        echo $! > "$RUN_DIR/recognition.pid"
    )
    esperar "http://127.0.0.1:$REC_PORT/health" "El servicio de reconocimiento" 300 "$RUN_DIR/recognition.pid" "$RUN_DIR/recognition.log"
fi

# ---------------------------------------------------------------------------- 3. Next (dev)
if vivo "$RUN_DIR/web.pid"; then
    log "Next ya corre (pid $(cat "$RUN_DIR/web.pid"))"
else
    [ -d "$ROOT/web/node_modules" ] || die "Falta web/node_modules: ejecuta 'npm ci' en web/."
    log "Arrancando Next en desarrollo en :$WEB_PORT (SUSAN_LOCAL=1)"
    (
        cd "$ROOT/web"
        export SUSAN_LOCAL=1 NEXT_PUBLIC_SUSAN_LOCAL=1
        export LOCAL_DATABASE_URL="$DB_URL"
        export LOCAL_STORAGE_DIR="$STORAGE_DIR_ABS"
        export LOCAL_AUTH_SECRET="${LOCAL_AUTH_SECRET:-susan-local-dev-secret-change-me}"
        [ "$FAKE_NOW" = "off" ] || export LOCAL_FAKE_NOW="$FAKE_NOW"
        export RECOGNITION_SERVICE_URL="http://127.0.0.1:$REC_PORT"
        export RECOGNITION_SERVICE_API_KEY="$API_KEY"
        export CRON_SECRET="${CRON_SECRET:-dev-cron-secret}"
        export NEXT_PUBLIC_SITE_URL="http://localhost:$WEB_PORT"
        nohup ./node_modules/.bin/next dev -p "$WEB_PORT" > "$RUN_DIR/web.log" 2>&1 &
        echo $! > "$RUN_DIR/web.pid"
    )
    # La ruta local de sesion responde JSON sin tocar la base: sirve de sonda de "Next listo".
    esperar "http://127.0.0.1:$WEB_PORT/api/_local/auth/session" "Next" 120 "$RUN_DIR/web.pid" "$RUN_DIR/web.log"
fi

cat <<MSG

SUSAN lista (modo local)
  Web            http://localhost:$WEB_PORT
  Reconocimiento http://127.0.0.1:$REC_PORT/health
  PostgreSQL     $DB_URL
  Reloj          ${LOCAL_FAKE_NOW:-${FAKE_NOW}}
  Cuentas demo   admin@ · tecnico@ · docente1@..docente3@ · e260001@..e260025@  (@susan.local)
                 contrasena de DESARROLLO: demo1234
  Registros      $SUSAN_LOCAL_DIR/run/*.log   ·   Detener: scripts/dev-stop.sh [--all]
MSG
