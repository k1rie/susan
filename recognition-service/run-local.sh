#!/usr/bin/env bash
# Arranca el servicio en local. Uso: ./run-local.sh [fake|insightface]   (por defecto fake)
set -euo pipefail
cd "$(dirname "$0")"
source ../scripts/local-dir.sh   # SUSAN_LOCAL_DIR (fuera de iCloud si hace falta)
# El venv vive en .venv.nosync (iCloud no lo sincroniza); .venv es solo un atajo.
VENV=.venv
[ -d .venv.nosync ] && VENV=.venv.nosync
if [ ! -d "$VENV" ]; then
    /opt/homebrew/bin/python3.12 -m venv .venv.nosync
    VENV=.venv.nosync
    "$VENV/bin/pip" install -q -r requirements.txt
fi
export EMBEDDER="${1:-${EMBEDDER:-fake}}"
if [ "$EMBEDDER" = "insightface" ]; then "$VENV/bin/pip" install -q -r requirements-ml.txt; fi
export APP_ENV="${APP_ENV:-development}"
# Clave solo para desarrollo local; en cualquier otro entorno defina API_KEY en el entorno
export API_KEY="${API_KEY:-dev-local-key}"
export STORAGE_BACKEND="${STORAGE_BACKEND:-local}"
export STORAGE_DIR="${STORAGE_DIR:-$SUSAN_LOCAL_DIR/storage}"
export ALLOW_PRIVATE_CAMERAS="${ALLOW_PRIVATE_CAMERAS:-1}"
exec "$VENV/bin/uvicorn" app.main:app_factory --factory --host 127.0.0.1 --port "${PORT:-8000}"
