#!/usr/bin/env bash
# Detiene lo que arranco scripts/dev-all.sh (Next y servicio de reconocimiento).
# Con --all detiene tambien PostgreSQL (los datos se conservan). Idempotente.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/scripts/local-dir.sh"
RUN_DIR="$SUSAN_LOCAL_DIR/run"

log() { printf '[dev] %s\n' "$*"; }

# Mata un proceso y todos sus descendientes (next dev lanza hijos; uvicorn puede lanzar workers).
matar_arbol() {
    local pid="$1" hijo
    for hijo in $(pgrep -P "$pid" 2>/dev/null || true); do matar_arbol "$hijo"; done
    kill "$pid" 2>/dev/null || true
}

detener() { # nombre
    local pidfile="$RUN_DIR/$1.pid" pid i
    [ -f "$pidfile" ] || { log "$1: no hay pid registrado"; return 0; }
    pid="$(cat "$pidfile")"
    if kill -0 "$pid" 2>/dev/null; then
        matar_arbol "$pid"
        for i in 1 2 3 4 5 6 7 8 9 10; do
            kill -0 "$pid" 2>/dev/null || break
            sleep 0.5
        done
        if kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null || true
            log "$1: detenido a la fuerza (pid $pid)"
        else
            log "$1: detenido (pid $pid)"
        fi
    else
        log "$1: ya no corria"
    fi
    rm -f "$pidfile"
}

detener web
detener recognition

if [ "${1:-}" = "--all" ]; then
    "$ROOT/scripts/db-down.sh"
fi
