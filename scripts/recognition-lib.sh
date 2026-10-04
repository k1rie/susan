#!/usr/bin/env bash
# Funciones del servicio de reconocimiento que comparten dev-all.sh y dev-modo.sh (se carga con 'source').
# Requiere ROOT y SUSAN_LOCAL_DIR (los define scripts/local-dir.sh). Solo modo local.
#
# Modo del embedder = fake (demostración sintética, sin modelos) | insightface (rostros reales, modelos de uso NO comercial).
# Prioridad al arrancar el servicio: variable RECOGNITION_EMBEDDER > archivo $SUSAN_LOCAL_DIR/run/embedder > fake.
# El archivo lo escribe 'scripts/dev-modo.sh <modo>'; así un reinicio con dev-all.sh no vuelve a fake sin querer.

REC_RUN_DIR="$SUSAN_LOCAL_DIR/run"
REC_PORT="${RECOGNITION_PORT:-8000}"
REC_API_KEY="${RECOGNITION_SERVICE_API_KEY:-dev-local-key}"   # clave SOLO de desarrollo; la comparte la web
REC_STORAGE_DIR="$SUSAN_LOCAL_DIR/storage"
REC_MODELOS_DIR="$ROOT/recognition-service/.models"           # MODEL_DIR por omisión de run-local.sh (ignorado por git)
REC_MODELO_INSIGHTFACE="buffalo_s"

rec_log() { printf '[reconocimiento] %s\n' "$*"; }
rec_die() { printf '[reconocimiento] ERROR: %s\n' "$*" >&2; exit 1; }

rec_modo_valido() { case "$1" in fake|insightface) return 0 ;; *) return 1 ;; esac; }

# Modo persistido en el archivo (vacío si no hay).
rec_modo_archivo() {
    [ -f "$REC_RUN_DIR/embedder" ] && tr -d '[:space:]' < "$REC_RUN_DIR/embedder" || true
}

# Modo con el que debe correr el servicio: RECOGNITION_EMBEDDER > archivo > fake.
rec_modo_elegido() {
    local m="${RECOGNITION_EMBEDDER:-}"
    [ -n "$m" ] || m="$(rec_modo_archivo)"
    m="${m:-fake}"
    rec_modo_valido "$m" || rec_die "Modo de embedder desconocido: '$m' (usa fake o insightface)."
    printf '%s' "$m"
}

# Cada modo acepta además el modelo del otro al LEER el índice (INDEX_ACCEPT_MODELS): el índice de la demostración
# (vectores 'fake-hash') sigue sirviendo bajo insightface y viceversa. Sin esto, cambiar de modo dejaría el servicio sin
# índice (422 INDEX_INVALID). Ver recognition-service/README.md.
rec_modelos_aceptados() {
    case "$1" in
        insightface) printf 'fake-hash' ;;
        *) printf '%s' "$REC_MODELO_INSIGHTFACE" ;;
    esac
}

# Versión del índice facial en uso según la BD (vacía si no hay). Subshell: db-common.sh no deja variables ni PATH.
rec_version_indice() {
    ( source "$ROOT/scripts/db-common.sh"; "$PGBIN/psql" -X -Atq -d "$DB_NAME" \
        -c "SELECT version FROM indice_faiss WHERE en_uso LIMIT 1" 2>/dev/null || true )
}

rec_pid() { [ -f "$REC_RUN_DIR/recognition.pid" ] && cat "$REC_RUN_DIR/recognition.pid" || true; }

# ¿El pid registrado es de verdad nuestro uvicorn? (nunca se mata algo que no lo sea)
rec_vivo() {
    local pid; pid="$(rec_pid)"
    [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}
rec_es_servicio() {
    ps -p "$1" -o command= 2>/dev/null | grep -q 'app.main:app_factory'
}

rec_salud() { curl -s --max-time 3 "http://127.0.0.1:$REC_PORT/health" 2>/dev/null || true; }
rec_info_indice() {
    curl -s --max-time 5 -H "X-API-Key: $REC_API_KEY" "http://127.0.0.1:$REC_PORT/v1/index" 2>/dev/null || true
}
# Valor de una clave de un JSON plano: rec_json_valor '<json>' clave
rec_json_valor() {
    printf '%s' "$1" | sed -n "s/.*\"$2\":\"\{0,1\}\([^\",}]*\)\"\{0,1\}.*/\1/p" | head -n1
}

# Mata un proceso y sus descendientes (igual que scripts/dev-stop.sh).
rec_matar_arbol() {
    local pid="$1" hijo
    for hijo in $(pgrep -P "$pid" 2>/dev/null || true); do rec_matar_arbol "$hijo"; done
    kill "$pid" 2>/dev/null || true
}

# Detiene SOLO el servicio de reconocimiento (pid registrado). Falla si el puerto lo ocupa algo ajeno.
rec_detener() {
    local pid i
    pid="$(rec_pid)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        rec_es_servicio "$pid" || rec_die "El pid $pid de recognition.pid no es el servicio de reconocimiento; no lo detengo."
        rec_matar_arbol "$pid"
        for i in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
        if kill -0 "$pid" 2>/dev/null; then kill -9 "$pid" 2>/dev/null || true; rec_log "Servicio detenido a la fuerza (pid $pid)"
        else rec_log "Servicio detenido (pid $pid)"; fi
    fi
    rm -f "$REC_RUN_DIR/recognition.pid"
    local ocupante
    ocupante="$(lsof -nP -iTCP:"$REC_PORT" -sTCP:LISTEN -t 2>/dev/null | head -n1 || true)"
    [ -z "$ocupante" ] || rec_die "El puerto $REC_PORT lo ocupa otro proceso (pid $ocupante) que no es el servicio registrado."
}

# Arranca el servicio en segundo plano con el embedder pedido. Mismo entorno que siempre usó dev-all.sh.
rec_arrancar() { # modo [version_indice]
    local modo="$1" version="${2:-}"
    mkdir -p "$REC_RUN_DIR" "$REC_STORAGE_DIR"
    (
        cd "$ROOT/recognition-service"
        EMBEDDER="$modo" STORAGE_BACKEND=local STORAGE_DIR="$REC_STORAGE_DIR" \
            API_KEY="$REC_API_KEY" PORT="$REC_PORT" INDEX_BOOTSTRAP_VERSION="$version" \
            INDEX_ACCEPT_MODELS="$(rec_modelos_aceptados "$modo")" \
            nohup ./run-local.sh "$modo" > "$REC_RUN_DIR/recognition.log" 2>&1 &
        echo $! > "$REC_RUN_DIR/recognition.pid"
    )
}

# Espera a que /health responda; con progreso (la 1a vez con insightface descarga modelos). Devuelve 1 si no llega.
rec_esperar() { # segundos
    local max="$1" t0=$SECONDS i=0 ultima=""
    until curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$REC_PORT/health"; do
        if ! rec_vivo; then
            tail -n 25 "$REC_RUN_DIR/recognition.log" >&2 || true
            rec_log "El servicio terminó antes de responder (ver $REC_RUN_DIR/recognition.log)." >&2
            return 1
        fi
        if [ $((SECONDS - t0)) -ge "$max" ]; then
            rec_log "El servicio no respondió en ${max}s (ver $REC_RUN_DIR/recognition.log)." >&2
            return 1
        fi
        i=$((i + 1))
        if [ $((i % 10)) -eq 0 ]; then
            ultima="$(tr '\r' '\n' < "$REC_RUN_DIR/recognition.log" 2>/dev/null | grep -v '^$' | tail -n1 | cut -c1-110)"
            rec_log "esperando... $((SECONDS - t0))s · modelos en disco: $(du -sh "$REC_MODELOS_DIR" 2>/dev/null | cut -f1 || echo 0) · ${ultima}"
        fi
        sleep 1
    done
}
