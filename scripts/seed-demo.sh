#!/usr/bin/env bash
# Datos de prueba completos y reiniciables para probar SUSAN de punta a punta. SOLO modo local; guía en docs/DEMO.md.
#
#   scripts/seed-demo.sh              asegura consentimientos, plantillas faciales, índice FAISS cargado y casos de
#                                     revisión, sin destruir lo hecho a mano (idempotente)
#   scripts/seed-demo.sh --reset      además deja la sesión 19 de hoy en 'programada' (sin capturas, detecciones,
#                                     asistencias ni justificantes) y vuelve a armar los casos de revisión
#   scripts/seed-demo.sh --abierta    como --reset, pero la sesión 19 queda ABIERTA y sin registros
#   scripts/seed-demo.sh --muestras   solo escribe una foto sintética por alumno para subirla a mano en el alta de plantilla
#   scripts/seed-demo.sh --captura …  simula la cámara del aula desde la terminal (ver scripts/demo/captura.mjs; --help allí)
#
# Si PostgreSQL, el servicio de reconocimiento o la web no están arriba, llama a scripts/dev-all.sh (que respeta lo que ya
# corre). Se niega a correr contra una base que no sea la local de desarrollo (reloj de demostración habilitado).
# Solo funciona con el embedder 'fake' (se niega con InsightFace; ver scripts/dev-modo.sh).
# Variables: las mismas que dev-all.sh (WEB_PORT, RECOGNITION_PORT, RECOGNITION_SERVICE_API_KEY, SUSAN_FAKE_NOW).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/scripts/db-common.sh"   # PGBIN, DB_NAME, SUSAN_LOCAL_DIR (fuera de iCloud si hace falta)

WEB_PORT="${WEB_PORT:-3000}"
REC_PORT="${RECOGNITION_PORT:-8000}"

log() { printf '[seed-demo] %s\n' "$*"; }
die() { printf '[seed-demo] ERROR: %s\n' "$*" >&2; exit 1; }

solo_muestras=0
modo_captura=0
[ "${1:-}" = "--captura" ] && { modo_captura=1; shift; }
for arg in "$@"; do
    [ "$modo_captura" -eq 1 ] && break   # los argumentos de --captura son de captura.mjs, que los valida
    case "$arg" in
        --reset|--abierta) ;;
        --muestras) solo_muestras=1 ;;
        -h|--help) sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) die "Opción desconocida: $arg (usa --reset, --abierta o --muestras)." ;;
    esac
done

# Nunca fuera del desarrollo local: estos datos pisan estados de sesiones y cuentas.
[ "${NODE_ENV:-}" = "production" ] && die "NODE_ENV=production: los datos de demostración solo existen en el modo local."
[ "${APP_ENV:-}" = "production" ] && die "APP_ENV=production: los datos de demostración solo existen en el modo local."
command -v node >/dev/null || die "No se encontró node (se necesita Node 20.9 o superior)."

db_ensure_cluster
db_exists "$DB_NAME" || die "La base '$DB_NAME' no existe: ejecuta scripts/dev-all.sh primero."

if [ "$solo_muestras" -eq 0 ]; then
    web_ok() { curl -s -o /dev/null --max-time 3 "http://127.0.0.1:$WEB_PORT/api/_local/auth/session"; }
    rec_ok() { curl -s -o /dev/null --max-time 3 "http://127.0.0.1:$REC_PORT/health"; }
    if ! web_ok || ! rec_ok; then
        log "La web o el servicio de reconocimiento no responden: scripts/dev-all.sh"
        "$ROOT/scripts/dev-all.sh"
    fi
fi

# La semilla y la cámara simulada fabrican rostros SINTÉTICOS (cuadrados con marco magenta) que solo entiende el embedder
# 'fake'. Con InsightFace (rostros reales) no detectan nada: las 75 plantillas fallarían y el índice no se reconstruiría.
# Se niega antes de tocar nada. --muestras solo escribe archivos y no necesita el servicio.
if [ "$solo_muestras" -eq 0 ]; then
    salud="$(curl -s --max-time 5 "http://127.0.0.1:$REC_PORT/health" || true)"
    embedder_actual="$(printf '%s' "$salud" | sed -n 's/.*"embedder":"\([^"]*\)".*/\1/p')"
    if [ -n "$embedder_actual" ] && [ "$embedder_actual" != "fake" ]; then
        die "El servicio de reconocimiento corre con el embedder '$embedder_actual' (rostros reales): la semilla y la cámara simulada usan rostros sintéticos y no funcionan así. Vuelve al modo de prueba con 'scripts/dev-modo.sh fake' y repite; para volver a rostros reales, 'scripts/dev-modo.sh insightface'."
    fi
fi

# La base y el almacenamiento que ve la web (los mismos valores que fija dev-all.sh).
export SUSAN_LOCAL_DIR
export LOCAL_DATABASE_URL="${LOCAL_DATABASE_URL:-postgres://127.0.0.1:${PGPORT_LOCAL}/${DB_NAME}}"
export LOCAL_STORAGE_DIR="${LOCAL_STORAGE_DIR:-$SUSAN_LOCAL_DIR/storage}"
export WEB_PORT RECOGNITION_PORT="$REC_PORT"
export RECOGNITION_SERVICE_API_KEY="${RECOGNITION_SERVICE_API_KEY:-dev-local-key}"

if [ "$modo_captura" -eq 1 ]; then
    exec node "$ROOT/scripts/demo/captura.mjs" "$@"
fi
exec node "$ROOT/scripts/demo/seed-demo.mjs" "$@"
