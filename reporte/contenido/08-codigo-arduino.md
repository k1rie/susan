## CÓDIGO DE ARDUINO.

El programa de la estación se divide en tres partes: el *sketch* de Arduino (`estacion_aula.ino`), que maneja los pines, el lector y la pantalla; el archivo de cabecera `protocolo.h`, que contiene la lógica pura (análisis de tramas, antirrebotes, temporizaciones, efectos y texto de la pantalla) sin depender de ninguna librería de Arduino, y el programa del puerto serie en la computadora (`puente-serial.mjs`, en Node), que atiende las tarjetas leídas. Separar la lógica pura permite probarla en la computadora de desarrollo con un compilador común. Los fragmentos se citan sin modificaciones.

### 1. Archivos del diseño.

<!-- anchos: 36,48,16 -->

| Archivo | Contenido | Líneas |
|---|---|---|
| `firmware/estacion_aula/estacion_aula.ino` | Programa principal: pines, lector, pantalla, serie y ciclo `loop()` | 381 |
| `firmware/estacion_aula/protocolo.h` | Lógica pura: tramas, antirrebotes, efectos y pantallas | 823 |
| `puente/puente-serial.mjs` | Programa del puerto serie en el PC (Node) | 710 |
| `firmware/pruebas/test_protocolo.cpp` | Pruebas de la lógica de `protocolo.h` | 839 |
| `firmware/pruebas/test_sketch.cpp` | Escenarios del sketch con hardware simulado | 643 |
| `firmware/pruebas/simavr/simavr_estacion.c` | Ejecución del binario en el simulador simavr | 265 |
| `puente/pruebas/puente.test.mjs` | Pruebas automáticas del puente | 514 |
| `puente/pruebas/puente-pty.test.mjs` | Puente contra un puerto serie virtual | 103 |
| `firmware/compilar-avr.sh` | Compilación manual para el UNO | 121 |

Nota. Conteo con `wc -l`. Elaboración propia.

### 2. Protocolo serie.

La estación y el PC se comunican por USB a 115200 baudios, 8N1, con líneas de texto ASCII terminadas en `\n` (se tolera `\r\n`) de 64 bytes como máximo sin el salto. Al abrir el puerto, la placa se reinicia y envía `HELLO`.

<!-- anchos: 14,30,36,20 -->

| Dirección | Trama | Significado | Ejemplo |
|---|---|---|---|
| Estación → PC | `HELLO estacion-aula 1.0` | Fin del arranque; se repite cada vez que la placa se reinicia | `HELLO estacion-aula 1.0` |
| Estación → PC | `UID <HEX>` | Tarjeta leída; HEX en mayúsculas y sin separadores (UID de 4, 7 o 10 bytes) | `UID 04A1B2C3` |
| Estación → PC | `BTN` | Pulsación del botón, que solo cambia la página de la pantalla | `BTN` |
| Estación → PC | `PONG` | Respuesta a `PING` | `PONG` |
| PC → estación | `PING` | Comprobación del enlace | `PING` |
| PC → estación | `SES <grupo>\|<materia>\|<presentes>/<total>` | Estado de la sesión para la pantalla; `SES \|\|0/0` indica que no hay sesión abierta | `SES 3o N\|Programacion Ava\|0/30` |
| PC → estación | `RES OK <nombre-corto>` | Tarjeta registrada: LED verde y un pitido corto | `RES OK Ana Demo` |
| PC → estación | `RES DUP [nombre-corto]` | Tarjeta ya registrada: LED ámbar y dos pitidos cortos | `RES DUP Ana Demo` |
| PC → estación | `RES NOREG` | Tarjeta no registrada: LED rojo y un pitido largo y grave | `RES NOREG` |
| PC → estación | `RES ERR [motivo]` | Error: LED rojo intermitente y sin sonido | `RES ERR` |

Nota. Las tramas y el ejemplo de `UID` se tomaron de la documentación de la estación y se comprobaron contra las constantes y el analizador de comandos de `protocolo.h`. Los ejemplos de `SES` y `RES` son los que arma el puente con la sesión y las tarjetas de demostración, que son datos ficticios. Elaboración propia.

### 3. Lógica del protocolo.

El analizador de `protocolo.h` acepta solo las formas exactas `PING`, `SES ...` y `RES ...`. Cualquier otra línea (más de 64 bytes, verbo desconocido, mal formada o en minúsculas) se ignora sin consecuencias y no cuenta como señal de vida de la computadora. La función `despuesDePalabra` exige la palabra completa, de modo que `RES OKAY` no se interpreta como `RES OK`.

:::codigo etiqueta="Código C++." archivo="/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/hardware/estacion-aula/firmware/estacion_aula/protocolo.h" lineas="333-381"

Nota. Fragmento de `protocolo.h` (líneas 333 a 381): interpretación de las respuestas `RES` y análisis de una línea ya ensamblada. Elaboración propia.

### 4. Programa principal.

El programa principal es no bloqueante: `loop()` no usa `delay()` y compara el tiempo con `millis()` en aritmética modular. En cada vuelta se lee el puerto serie, el botón y el lector, se vigila el plazo de la respuesta de la computadora, se avanzan los efectos (LED y zumbador) y se redibuja la pantalla. La función `setup()` termina enviando `HELLO`, con lo que la computadora sabe que ya puede mandar la sesión.

:::codigo etiqueta="Código C++." archivo="/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/hardware/estacion-aula/firmware/estacion_aula/estacion_aula.ino" lineas="332-381"

Nota. Fragmento de `estacion_aula.ino` (líneas 332 a 381): `setup()` y `loop()`. Elaboración propia.

### 5. Programa del puerto serie en el PC.

El puente en Node abre el puerto serie, convierte las líneas `UID` en decisiones y responde con `RES`. Aplica el orden rebote, sesión, tarjeta registrada, duplicado y registro. La función de registro, `registrarPresencia()`, es hoy un sustituto que solo escribe en pantalla; no escribe en la base de datos.

:::codigo etiqueta="Código JavaScript." archivo="/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/hardware/estacion-aula/puente/puente-serial.mjs" lineas="377-420"

Nota. Fragmento de `puente-serial.mjs` (líneas 377 a 420): método `manejarUid`. Elaboración propia.

### 6. Estado de verificación.

Todas las verificaciones se hicieron en la computadora de desarrollo, con herramientas de software. Los resultados que registran los archivos de la estación son estos:

<!-- anchos: 34,40,26 -->

| Verificación | Herramienta | Resultado |
|---|---|---|
| Compilación para UNO | avr-gcc 7.3.0, núcleo Arduino AVR 1.8.6, librerías MFRC522 1.4.12 y LiquidCrystal_I2C 1.1.4 | Sin errores ni avisos propios (-Wall -Wextra); flash 14 122 B (43.1 %), SRAM 1 227 B (59.9 %) |
| Lógica de `protocolo.h` | Pruebas en el PC, también con sanitizadores | 65 casos, 0 fallidos (6 138 afirmaciones) |
| Sketch con hardware simulado | Pruebas en el PC, también con sanitizadores | 38 casos, 0 fallidos |
| Mutaciones del firmware | Cambios intencionales | Las 11 mutaciones fueron detectadas |
| Binario en simulador de instrucciones | simavr 1.6, ATmega328P a 16 MHz | 12 comprobaciones, 0 fallidas |
| Puente en Node | Pruebas automáticas y puerto serie virtual | 42 pruebas: 41 aprobadas, 1 omitida, 0 fallidas |

Nota. Datos de `firmware/COMPILACION.txt`, `firmware/pruebas/RESULTADO.txt` y `puente/RESULTADO.txt` (registros del 30 de octubre de 2026). Elaboración propia.

El firmware se compiló con un procedimiento manual que replica las banderas del núcleo 1.8.6, porque no fue posible obtener `arduino-cli` en el entorno de desarrollo, y el tamaño exacto puede variar unos bytes con el compilador del IDE. El simulador de instrucciones es un modelo mínimo, sin pantalla ni tarjetas RFID y con el lector reducido a un esclavo SPI que solo contesta el registro de versión. El puente se probó con un dispositivo en memoria y con pseudoterminales, sin ninguna placa. Estos resultados validan la lógica del programa en software y simulación; **no validan el hardware físico**. Falta probar el cableado y los divisores de voltaje, las lecturas reales de tarjetas (incluida la detección de retirada), la dirección I2C de la pantalla (0x27 o 0x3F), el antirrebote real del pulsador y el puerto serie real. La integración con la base de datos (tabla de credenciales y función RPC) es el siguiente avance.
