#!/usr/bin/env bash
# ejecutar.sh - Compila y corre las pruebas del firmware en el PC.
#
#   test_protocolo : lógica pura de protocolo.h (65 casos).
#   test_sketch    : el sketch estacion_aula.ino REAL sobre hardware simulado.
#
# Cada prueba se compila dos veces: (1) -Wall -Wextra -Werror -O2 y (2) con
# AddressSanitizer + UBSan (detecta desbordes de búfer y comportamiento
# indefinido). Además se comprueba que protocolo.h sea C++11 válido (el estándar
# de avr-gcc 7.3) y, con --mutaciones, que las pruebas DETECTAN fallos
# introducidos a propósito (si no los detectaran, estarían vacías).
#
# Uso: firmware/pruebas/ejecutar.sh [--mutaciones] [directorio_temporal]
# Para guardar el registro:  ejecutar.sh --mutaciones | tee RESULTADO.txt
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MUTAR=0
if [ "${1:-}" = "--mutaciones" ]; then MUTAR=1; shift; fi
TMP="${1:-${TMPDIR:-/tmp}/susan-pruebas}"
mkdir -p "$TMP"
FALLOS=0

echo "Pruebas del firmware - Estación de aula SUSAN"
echo "fecha:  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "g++:    $(g++ --version | head -1)"
echo "estas pruebas se ejecutan en el PC; NO hay ejecución en hardware físico"
echo

echo "== 0. protocolo.h como C++11 estricto (el estándar del IDE de Arduino)"
if g++ -std=c++11 -Wall -Wextra -Wpedantic -Werror -fsyntax-only -x c++ "$AQUI/../estacion_aula/protocolo.h"; then
    echo "OK: sin errores ni avisos"
else
    echo "FALLA"; FALLOS=1
fi
echo

compilar_y_correr() {  # <etiqueta> <fuente> <bandera extra...>
    local etiqueta="$1" fuente="$2"; shift 2
    local bin="$TMP/${fuente%.cpp}_$etiqueta"
    echo "== $etiqueta : g++ -std=c++17 -Wall -Wextra $* $fuente"
    if ! g++ -std=c++17 -Wall -Wextra "$@" -I"$AQUI/simulacion" -o "$bin" "$AQUI/$fuente"; then
        echo "FALLA DE COMPILACION"; FALLOS=1; return
    fi
    "$bin" || FALLOS=1
    echo
}

for f in test_protocolo.cpp test_sketch.cpp; do
    compilar_y_correr "estricto" "$f" -Werror -O2
    compilar_y_correr "sanitizadores" "$f" -O1 -g -fsanitize=address,undefined -fno-sanitize-recover=all
done

if [ "$MUTAR" = 1 ]; then
    echo "== Mutaciones: cada cambio rompe el firmware a propósito y las pruebas DEBEN fallar"
    SRC="$TMP/mut/firmware"
    probar() {  # <descripcion> <archivo relativo a estacion_aula> <expresión sed>
        local desc="$1" archivo="$2" expr="$3"
        rm -rf "$TMP/mut"; mkdir -p "$TMP/mut"
        cp -r "$AQUI/.." "$SRC"
        sed -i "$expr" "$SRC/estacion_aula/$archivo"
        if cmp -s "$AQUI/../estacion_aula/$archivo" "$SRC/estacion_aula/$archivo"; then
            echo "  ERROR de la prueba de mutación: el cambio no se aplicó ($desc)"; FALLOS=1; return
        fi
        local resultado=""
        for t in test_protocolo test_sketch; do
            g++ -std=c++17 -O1 -I"$SRC/pruebas/simulacion" -o "$TMP/mut/$t" "$SRC/pruebas/$t.cpp" 2>/dev/null || { resultado="no compila"; break; }
            "$TMP/mut/$t" >"$TMP/mut/$t.txt" 2>&1 || resultado="${resultado} $t"
        done
        if [ -n "$resultado" ]; then
            echo "  detectada ($resultado ):  $desc"
        else
            echo "  NO DETECTADA:  $desc"; FALLOS=1
        fi
    }
    probar "silencio de la PC de 30 s a 60 s" protocolo.h 's/SILENCIO_PC_MS = 30000/SILENCIO_PC_MS = 60000/'
    probar "antirrebote de UID de 2 s a 0" protocolo.h 's/ANTIREBOTE_UID_MS = 2000/ANTIREBOTE_UID_MS = 0/'
    probar "la tarjeta ya no necesita retirarse" protocolo.h 's/if (!retirada_ || (ms_t)(ahora - t_) < ANTIREBOTE_UID_MS)/if ((ms_t)(ahora - t_) < ANTIREBOTE_UID_MS)/'
    probar "líneas de 65 bytes aceptadas" protocolo.h 's/if (n_ >= MAX_LINEA) {/if (n_ >= MAX_LINEA + 1) {/'
    probar "ya no se transliteran los acentos" protocolo.h 's/return TABLA_C3\[b - 0x80\];/return (char)b;/'
    probar "el pitido de OK pasa a 1000 Hz" protocolo.h 's/PIT_OK\[\] = {{2200, 120}}/PIT_OK[] = {{1000, 120}}/'
    probar "RES DUP deja de ser ámbar" protocolo.h '/case EV_DUP:/{n;s/LED_AMBAR/LED_VERDE/}'
    probar "el botón deja de enviar BTN" estacion_aula.ino 's/enviarLinea(proto::BTN);//'
    probar "la retirada nunca se detecta bien (sondeo siempre 'ausente')" estacion_aula.ino 's/filtro.sondeo(presente);/filtro.sondeo(false);/'
    probar "se usa delay() dentro de loop()" estacion_aula.ino 's/^    dibujar(ahora);$/    dibujar(ahora); delay(1);/'
    probar "la PC desconocida cuenta como viva" estacion_aula.ino 's/if (!proto::analizar(linea, c)) {/ultimoRx = ahora; huboRx = true; if (!proto::analizar(linea, c)) {/'
    echo
fi

if [ "$FALLOS" = 0 ]; then
    echo "RESULTADO GLOBAL: TODO CORRECTO"
else
    echo "RESULTADO GLOBAL: HAY FALLOS"
fi
exit "$FALLOS"
