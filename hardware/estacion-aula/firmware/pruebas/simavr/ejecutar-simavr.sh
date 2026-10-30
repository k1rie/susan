#!/usr/bin/env bash
# ejecutar-simavr.sh - Corre el binario compilado del sketch en el simulador de
# instrucciones simavr. Requiere: libsimavr-dev (apt) y haber compilado antes con
# firmware/compilar-avr.sh (que deja estacion_aula.elf en <trabajo>/build).
#
# Uso: ejecutar-simavr.sh [ruta/estacion_aula.elf] [directorio_temporal]
set -euo pipefail
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ELF="${1:-${TMPDIR:-/tmp}/susan-avr/build/estacion_aula.elf}"
TMP="${2:-${TMPDIR:-/tmp}/susan-simavr}"
[ -f "$ELF" ] || { echo "No existe $ELF: ejecute antes firmware/compilar-avr.sh" >&2; exit 2; }
[ -d /usr/include/simavr ] || { echo "Falta libsimavr-dev (apt install libsimavr-dev)" >&2; exit 2; }
mkdir -p "$TMP"
echo "fecha: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "simavr: $(dpkg-query -W -f='${Package} ${Version}' libsimavr-dev 2>/dev/null || echo desconocido)"
echo "elf:    $ELF ($(sha256sum "$ELF" | cut -c1-16)...)"
gcc -O2 -Wall -Wextra -I/usr/include/simavr -o "$TMP/simavr_estacion" "$AQUI/simavr_estacion.c" -lsimavr -lm
"$TMP/simavr_estacion" "$ELF"
