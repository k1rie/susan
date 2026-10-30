#!/usr/bin/env bash
# compilar-avr.sh - Compila el sketch para Arduino UNO (ATmega328P) SIN arduino-cli.
#
# Reproduce a mano lo que hace el IDE de Arduino (mismas banderas que el
# platform.txt del núcleo "Arduino AVR Boards" 1.8.6) con:
#   - avr-gcc / avr-g++ / avr-libc de los paquetes de Ubuntu (gcc-avr, avr-libc,
#     binutils-avr) y el núcleo del paquete arduino-core-avr 1.8.6;
#   - las librerías REALES MFRC522 (1.4.12) y LiquidCrystal_I2C (1.1.4), bajadas
#     de GitHub (raw.githubusercontent.com) a un directorio fuera del repositorio.
# Úsese solo cuando arduino-cli no se puede instalar (p. ej. sin acceso a
# downloads.arduino.cc ni a las versiones de GitHub). Con acceso normal es más
# sencillo: arduino-cli compile --fqbn arduino:avr:uno firmware/estacion_aula
#
# Uso:  firmware/compilar-avr.sh [directorio_de_trabajo]
# Requiere: avr-gcc avr-g++ avr-objcopy avr-size, curl, sha256sum.
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKETCH="$AQUI/estacion_aula"
TRABAJO="${1:-${TMPDIR:-/tmp}/susan-avr}"
NUCLEO="${NUCLEO_AVR:-/usr/share/arduino/hardware/arduino/avr}"
LIBS="$TRABAJO/librerias"
BUILD="$TRABAJO/build"
MCU=atmega328p

for h in avr-gcc avr-g++ avr-objcopy avr-size curl sha256sum; do
    command -v "$h" >/dev/null || { echo "Falta la herramienta: $h" >&2; exit 2; }
done
[ -f "$NUCLEO/cores/arduino/Arduino.h" ] || { echo "No encuentro el núcleo AVR en $NUCLEO" >&2; exit 2; }

echo "== Entorno"
echo "fecha:        $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "avr-g++:      $(avr-g++ --version | head -1)"
echo "avr-libc:     $(dpkg-query -W -f='${Version}' avr-libc 2>/dev/null || echo 'desconocida')"
echo "nucleo AVR:   $NUCLEO (platform.txt: $(grep '^version=' "$NUCLEO/platform.txt"))"

# ---------------------------------------------------------------- librerías
bajar() {  # bajar <url> <destino> <sha256 esperado o vacío>
    local url="$1" destino="$2" esperado="$3"
    mkdir -p "$(dirname "$destino")"
    [ -s "$destino" ] || curl -fsS -m 60 -o "$destino" "$url"
    local real
    real="$(sha256sum "$destino" | cut -d' ' -f1)"
    if [ -n "$esperado" ] && [ "$real" != "$esperado" ]; then
        echo "AVISO: sha256 distinto en $(basename "$destino") (esperado $esperado, real $real)" >&2
    fi
}

RFID="https://raw.githubusercontent.com/miguelbalboa/rfid/1.4.12/src"
for f in MFRC522.h MFRC522.cpp MFRC522Extended.h MFRC522Extended.cpp deprecated.h require_cpp11.h; do
    esperado=""
    [ "$f" = "MFRC522.cpp" ] && esperado="bcb6372c98c0ecaa5255c389d1aab846d049fb5a2771307fa38c94ca9fea26cb"
    bajar "$RFID/$f" "$LIBS/MFRC522/src/$f" "$esperado"
done
LCD="https://raw.githubusercontent.com/marcoschwartz/LiquidCrystal_I2C/master"
bajar "$LCD/LiquidCrystal_I2C.h" "$LIBS/LiquidCrystal_I2C/LiquidCrystal_I2C.h" "cff602ee6ac7404acf8eab99ca621a8e0ee641a219cfd87ec877cf03eb973a6f"
bajar "$LCD/LiquidCrystal_I2C.cpp" "$LIBS/LiquidCrystal_I2C/LiquidCrystal_I2C.cpp" "d777dcd59a66951254658017d1135b6f8e571c2bcf6e3b7d4042582da6280006"

echo "== Librerías (sha256)"
( cd "$LIBS" && sha256sum MFRC522/src/MFRC522.cpp MFRC522/src/MFRC522.h LiquidCrystal_I2C/*.h LiquidCrystal_I2C/*.cpp )

# ------------------------------------------------------------------ compilar
rm -rf "$BUILD"
mkdir -p "$BUILD/nucleo" "$BUILD/libs" "$BUILD/sketch"

COMUN=(-mmcu=$MCU -DF_CPU=16000000L -DARDUINO=10819 -DARDUINO_AVR_UNO -DARDUINO_ARCH_AVR
       "-I$NUCLEO/cores/arduino" "-I$NUCLEO/variants/standard")
INC_LIBS=("-I$NUCLEO/libraries/SPI/src" "-I$NUCLEO/libraries/Wire/src"
          "-I$LIBS/MFRC522/src" "-I$LIBS/LiquidCrystal_I2C")
CFLAGS=(-c -g -Os -std=gnu11 -ffunction-sections -fdata-sections -MMD -flto -fno-fat-lto-objects)
CXXFLAGS=(-c -g -Os -std=gnu++11 -fpermissive -fno-exceptions -ffunction-sections -fdata-sections
          -fno-threadsafe-statics -Wno-error=narrowing -MMD -flto)
SFLAGS=(-c -g -x assembler-with-cpp -flto -MMD)

compilar() {  # compilar <aviso: -w|-Wall -Wextra> <fuente> <objeto>
    local avisos="$1" fuente="$2" objeto="$3"
    case "$fuente" in
        *.c)   avr-gcc  "${CFLAGS[@]}"   $avisos "${COMUN[@]}" "${INC_LIBS[@]}" "$fuente" -o "$objeto" ;;
        *.S)   avr-gcc  "${SFLAGS[@]}"   "${COMUN[@]}" "$fuente" -o "$objeto" ;;
        *)     avr-g++  "${CXXFLAGS[@]}" $avisos "${COMUN[@]}" "${INC_LIBS[@]}" "$fuente" -o "$objeto" ;;
    esac
}

echo "== Compilando núcleo, SPI, Wire y librerías de terceros (sin avisos: -w, como el IDE por omisión)"
OBJ_NUCLEO=()
for f in "$NUCLEO"/cores/arduino/*.c "$NUCLEO"/cores/arduino/*.cpp "$NUCLEO"/cores/arduino/*.S; do
    [ -e "$f" ] || continue
    o="$BUILD/nucleo/$(basename "$f").o"; compilar -w "$f" "$o"; OBJ_NUCLEO+=("$o")
done
OBJ_LIBS=()
for f in "$NUCLEO/libraries/SPI/src/SPI.cpp" "$NUCLEO/libraries/Wire/src/Wire.cpp" \
         "$NUCLEO/libraries/Wire/src/utility/twi.c" \
         "$LIBS/MFRC522/src/MFRC522.cpp" "$LIBS/LiquidCrystal_I2C/LiquidCrystal_I2C.cpp"; do
    o="$BUILD/libs/$(basename "$f").o"; compilar -w "$f" "$o"; OBJ_LIBS+=("$o")
done

echo "== Compilando el sketch con -Wall -Wextra (los avisos de NUESTRO código sí se ven)"
# El constructor de sketches del IDE antepone Arduino.h y marca la línea original.
{
    echo '#include <Arduino.h>'
    echo '#line 1 "estacion_aula.ino"'
    cat "$SKETCH/estacion_aula.ino"
} > "$BUILD/sketch/estacion_aula.ino.cpp"
# (el include "protocolo.h" se resuelve desde la carpeta del sketch con -I)
avr-g++ "${CXXFLAGS[@]}" -Wall -Wextra "${COMUN[@]}" "${INC_LIBS[@]}" -I"$SKETCH" \
    "$BUILD/sketch/estacion_aula.ino.cpp" -o "$BUILD/sketch/estacion_aula.ino.o"
echo "sketch: compilado sin errores"

echo "== Enlazando"
rm -f "$BUILD/nucleo.a"
for o in "${OBJ_NUCLEO[@]}"; do avr-gcc-ar rcs "$BUILD/nucleo.a" "$o"; done
avr-gcc -w -Os -g -flto -fuse-linker-plugin -Wl,--gc-sections -mmcu=$MCU \
    -o "$BUILD/estacion_aula.elf" "$BUILD/sketch/estacion_aula.ino.o" "${OBJ_LIBS[@]}" \
    "$BUILD/nucleo.a" "-L$BUILD" -lm
avr-objcopy -O ihex -R .eeprom "$BUILD/estacion_aula.elf" "$BUILD/estacion_aula.hex"

echo "== Tamaño (UNO: 32256 bytes de flash útiles, 2048 de SRAM)"
avr-size -C --mcu=$MCU "$BUILD/estacion_aula.elf"
avr-size -A "$BUILD/estacion_aula.elf" | awk '/^\.(text|data|bss)/ {print}'
echo "hex: $BUILD/estacion_aula.hex ($(wc -c < "$BUILD/estacion_aula.hex") bytes de texto Intel HEX)"
echo "RESULTADO: COMPILACION CORRECTA (no implica que funcione en hardware: ver README)"
