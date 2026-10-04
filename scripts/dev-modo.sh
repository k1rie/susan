#!/usr/bin/env bash
# Conmuta el embedder del servicio de reconocimiento (SOLO modo local). Reinicia ÚNICAMENTE ese servicio: PostgreSQL y la
# web (:3000) no se tocan.
#
#   scripts/dev-modo.sh insightface   rostros REALES (InsightFace buffalo_s; la 1a vez descarga ~120 MB de modelos)
#   scripts/dev-modo.sh fake          demostración sintética (cámara simulada y los 75 alumnos de prueba)
#   scripts/dev-modo.sh estado        modo persistido, servicio, índice cargado y umbral vigente
#   scripts/dev-modo.sh <modo> --reiniciar   fuerza el reinicio aunque ya corra en ese modo (p. ej. para aplicar MIN_SHARPNESS=15)
#
# El modo queda en $SUSAN_LOCAL_DIR/run/embedder y scripts/dev-all.sh lo respeta al arrancar el servicio (la variable
# RECOGNITION_EMBEDDER tiene prioridad sobre el archivo). Licencia: los modelos de InsightFace son SOLO de uso no comercial.
# Guía: docs/DEMO.md, «Probar con tu rostro real (InsightFace)».
# Variables: RECOGNITION_PORT (8000) · RECOGNITION_SERVICE_API_KEY (dev-local-key) · MODO_ESPERA_SEG (700)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/scripts/local-dir.sh"
source "$ROOT/scripts/recognition-lib.sh"

mkdir -p "$REC_RUN_DIR"

umbral_vigente() {
    ( source "$ROOT/scripts/db-common.sh"; "$PGBIN/psql" -X -Atq -d "$DB_NAME" \
        -c "SELECT valor FROM parametro_sistema WHERE clave = 'umbral_similitud'" 2>/dev/null || true )
}

estado() {
    local salud info pid
    pid="$(rec_pid)"
    echo "Modo persistido        : $(rec_modo_archivo || true)${RECOGNITION_EMBEDDER:+  (RECOGNITION_EMBEDDER=$RECOGNITION_EMBEDDER tiene prioridad)}"
    echo "Modo con el que arranca: $(rec_modo_elegido)"
    if rec_vivo; then echo "Proceso                : pid $pid"; else echo "Proceso                : no corre (pid registrado: ${pid:-ninguno})"; fi
    salud="$(rec_salud)"
    echo "GET /health            : ${salud:-sin respuesta}"
    info="$(rec_info_indice)"
    echo "GET /v1/index          : ${info:-sin respuesta}"
    echo "Índice en uso en la BD : $(rec_version_indice || true)"
    echo "umbral_similitud (BD)  : $(umbral_vigente || true)   (score = (coseno + 1) / 2; 0.700 = coseno 0.40)"
    echo "Modelos descargados    : $(du -sh "$REC_MODELOS_DIR" 2>/dev/null | cut -f1 || echo ninguno) en $REC_MODELOS_DIR"
}

# Comprobaciones previas SOLO si hay que descargar modelos (insightface y .models vacío).
prechequeos_descarga() {
    local libre_kb
    if ls "$REC_MODELOS_DIR/models/$REC_MODELO_INSIGHTFACE"/*.onnx >/dev/null 2>&1; then
        rec_log "Modelos ya descargados en $REC_MODELOS_DIR (no hace falta red)."
        return 0
    fi
    rec_log "Primera vez con insightface: se descargan los modelos (~120 MB, uso NO comercial) a $REC_MODELOS_DIR"
    curl -s -I --max-time 15 -o /dev/null -w '' https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_s.zip \
        || rec_die "Sin red hacia github.com: no se pueden descargar los modelos. Conéctate y repite."
    mkdir -p "$ROOT/recognition-service"
    libre_kb="$(df -k "$ROOT/recognition-service" | awk 'NR==2 {print $4}')"
    [ "${libre_kb:-0}" -ge 1048576 ] || rec_die "Menos de 1 GB libre en disco (${libre_kb} KB): libera espacio antes de descargar los modelos."
    rec_log "Red OK · espacio libre: $((libre_kb / 1048576)) GB"
}

cambiar() { # modo
    local modo="$1" previo version espera="${MODO_ESPERA_SEG:-700}" salud t0=$SECONDS antes
    rec_modo_valido "$modo" || rec_die "Modo desconocido: $modo (usa insightface, fake o estado)."
    previo="$(rec_modo_archivo || true)"; previo="${previo:-fake}"
    if [ "$modo" = insightface ]; then prechequeos_descarga; fi

    # Ya corre con ese embedder: solo se persiste (idempotente).
    salud="$(rec_salud)"
    if [ "${FORZAR:-0}" -eq 0 ] && rec_vivo && printf '%s' "$salud" | grep -q "\"embedder\":\"$modo\""; then
        printf '%s' "$modo" > "$REC_RUN_DIR/embedder"
        rec_log "El servicio ya corre en modo $modo; solo se persiste. Nada que reiniciar."
        estado
        return 0
    fi

    version="$(rec_version_indice || true)"
    antes="$(du -sk "$REC_MODELOS_DIR" 2>/dev/null | cut -f1 || echo 0)"
    rec_log "Deteniendo el servicio de reconocimiento (la web y la BD siguen arriba)"
    rec_detener
    rec_log "Arrancando con EMBEDDER=$modo${version:+ · indice $version}"
    rec_arrancar "$modo" "$version"
    if ! rec_esperar "$espera"; then
        rec_log "Falló el arranque en modo $modo; restauro el modo anterior ($previo)."
        rec_detener || true
        rec_arrancar "$previo" "$version"
        rec_esperar 120 || true
        exit 1
    fi
    salud="$(rec_salud)"
    printf '%s' "$salud" | grep -q "\"embedder\":\"$modo\"" || rec_die "El servicio respondió con otro embedder: $salud"
    printf '%s' "$modo" > "$REC_RUN_DIR/embedder"
    rec_log "Listo en $((SECONDS - t0)) s · descargado/crecido en .models: $(( $(du -sk "$REC_MODELOS_DIR" 2>/dev/null | cut -f1 || echo 0) - antes )) KB"
    echo
    estado
    if ! printf '%s' "$salud" | grep -q '"index_loaded":true'; then
        rec_log "AVISO: el índice no está cargado. Consola técnica (/tecnico) -> Índice facial -> «Sincronizar servicio»."
    fi
    if [ "$modo" = fake ]; then
        rec_log "Modo de prueba sintético: la cámara simulada y scripts/seed-demo.sh vuelven a funcionar."
    else
        rec_log "Modo rostros reales: la cámara simulada y scripts/seed-demo.sh NO funcionan aquí (usa 'scripts/dev-modo.sh fake')."
    fi
}

case "${1:-}" in
    insightface|fake) FORZAR=0; [ "${2:-}" = "--reiniciar" ] && FORZAR=1; cambiar "$1" ;;
    estado) estado ;;
    -h|--help|'') sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; [ -n "${1:-}" ] || exit 1 ;;
    *) rec_die "Subcomando desconocido: $1 (usa insightface, fake o estado)." ;;
esac
