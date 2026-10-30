# Estación de aula SUSAN

Lector RFID con pantalla, tres LED, zumbador y botón, basado en **Arduino UNO R3**, que se conecta por **USB (puerto serie)**
a la computadora del docente. Sirve para pasar lista con una **tarjeta personal** a los alumnos que no pueden usar el
reconocimiento facial. Unidad «Manejo de puertos» · Programación Avanzada · 3° N · UNACH FCA C-I.

> **Estado en una línea:** diseñado, compilado y probado en el computador (pruebas unitarias, escenarios con hardware
> simulado, el binario en un simulador de instrucciones y el puente por un puerto serie virtual). **Nada se ha probado todavía
> en hardware físico** y **no está integrado** con la base de datos de SUSAN.

## 1. Qué es y por qué existe

En SUSAN **no se reconoce ningún rostro sin consentimiento firmado y vigente** (RN-13, RNF-06 de la especificación
`docs/spec/Avance1.txt`). Cuando el alumno no tiene consentimiento, lo revocó, o la cámara del aula falla, la especificación
manda **pase de lista manual** (RF-09, RN-06): el docente captura el estado de cada uno desde la pantalla de sesión.

La estación agrega una **segunda forma de registrar la presencia en esos casos**: el alumno acerca una tarjeta RFID personal a
un lector que está en el escritorio o en la puerta del aula. Así el pase manual no depende de que el docente busque a cada
alumno en pantalla, y quien no dio su consentimiento no queda en desventaja ni es expuesto.

Lo que **no** es:

* No es autenticación fuerte: una tarjeta es *algo que se tiene*, se puede prestar o clonar (ver §11). Es una comodidad de
  captura con revisión del docente, igual que el pase manual.
* No cierra sesiones. Cerrar una sesión exige la autenticación del docente en la aplicación web; el botón de la estación solo
  cambia la página de la pantalla (y el firmware no tiene ningún comando que cierre nada).
* No forma parte de los 22 RF de la especificación: es una extensión de la unidad. Su integración debe respetar los contratos de
  `docs/API-RPC.md` (ver §10).

## 2. Estado y evidencia

| Elemento | Estado | Evidencia |
|---|---|---|
| Diseño eléctrico y del protocolo | **Diseñado ✔** | este README, `circuito/pines.md` |
| Esquema de conexión | **Generado ✔** | `circuito/circuito.svg` / `.png`; el generador falla si no coincide con `pines.csv` y `bom.csv`; revisado a ojo |
| Firmware compilado para UNO | **Compilado ✔** (build manual, **no** con `arduino-cli`) | `firmware/COMPILACION.txt`: flash 14 122 B (43 %), SRAM 1 227 B (60 %), 0 avisos propios |
| Pruebas en el host de la lógica y del sketch con hardware simulado | **✔** | `firmware/pruebas/RESULTADO.txt`: 65 + 38 casos, con sanitizadores, 11 mutaciones detectadas |
| Binario en simulador de instrucciones (simavr) | **✔ parcial** | `COMPILACION.txt`: 12 comprobaciones; sin LCD ni tarjetas |
| Puente Node: pruebas y recorrido simulado | **✔** | `puente/RESULTADO.txt`: 42 pruebas (41 pasan, 1 omitida con `serialport` instalado) |
| Puente contra un puerto serie virtual (pty) | **✔** | `puente/pruebas/puente-pty.test.mjs` |
| **Pruebas en hardware físico** | **✘ PENDIENTE** | ver la lista de verificación de §8 |
| Integración con SUSAN (tabla `credencial`, RPC) | **✘ No implementada** | `registrarPresencia()` es un *stub* que solo escribe en pantalla (§10) |
| Caja o soporte | **✘ No diseñado** | |

Qué significa cada ✔, sin exagerar:

* **Compilado**: el sketch enlaza contra el código fuente real de las librerías MFRC522 1.4.12 y LiquidCrystal_I2C y del núcleo
  Arduino AVR 1.8.6. No se grabó en ninguna placa.
* **Pruebas en el host**: validan la *lógica* (protocolo, tiempos, antirrebote, máquina de estados). El hardware es una
  simulación escrita por nosotros (`firmware/pruebas/simulacion/`); no reproduce la electrónica ni el comportamiento fino de
  las librerías ni de las tarjetas reales.
* **simavr**: ejecuta el código máquina real, pero con un MFRC522 reducido a un esclavo SPI mínimo y sin pantalla.

## 3. Carpetas

```
hardware/estacion-aula/
├─ README.md                  este documento
├─ circuito/
│  ├─ circuito.svg / .png     esquema de conexión (PNG de 3600 px de ancho)
│  ├─ generar-circuito.mjs    genera ambos y valida contra pines.csv y bom.csv
│  ├─ pines.csv / pines.md    tabla de pines y verificación eléctrica
│  └─ bom.csv                 lista de materiales
├─ firmware/
│  ├─ estacion_aula/          sketch de Arduino: estacion_aula.ino + protocolo.h
│  ├─ pruebas/                pruebas en el host (+ simulacion/ y simavr/), ejecutar.sh, RESULTADO.txt
│  ├─ compilar-avr.sh         compilación sin arduino-cli
│  └─ COMPILACION.txt         registro literal de la compilación y de simavr
└─ puente/
   ├─ puente-serial.mjs       puente Node (serialport) + modo simulado
   ├─ credenciales-demo.csv   3 tarjetas FICTICIAS
   ├─ sesion-demo.json        sesión ficticia
   ├─ pruebas/                node:test (incluye la prueba por pty)
   ├─ RESULTADO.txt           salida de las pruebas
   └─ README.md               guía del puente
```

## 4. Materiales (BOM)

Detalle y notas en [`circuito/bom.csv`](circuito/bom.csv). Cantidades y función:

| Ref. | Cant. | Pieza | Para qué sirve |
|---|---|---|---|
| U1 | 1 | Arduino UNO R3 (ATmega328P) + cable USB A‑B | Cerebro; alimenta todo y habla con la PC por USB |
| U2 | 1 | Módulo lector RFID MFRC522 (RC522), 13,56 MHz | Lee el UID de las tarjetas por SPI; funciona a 3,3 V |
| U3 | 1 | LCD 16×2 HD44780 con mochila I2C (PCF8574) | Muestra sesión, última lectura y resultado; dirección 0x27 o 0x3F |
| R1–R4 | 4 | Resistor 1 kΩ | Parte alta de los divisores de nivel (UNO 5 V → módulo 3,3 V) |
| R5–R8 | 4 | Resistor 2 kΩ | Parte baja de los divisores (nodo → GND) |
| R9–R11 | 3 | Resistor 220 Ω | Limitan la corriente de cada LED (≈ 14 mA) |
| R12 | 1 | Resistor 100 Ω | Limita la corriente del zumbador |
| LED1–LED3 | 3 | LED 5 mm verde, ámbar, rojo | Resultado: OK / duplicado o sin conexión / no registrada o error |
| BZ1 | 1 | Zumbador piezoeléctrico pasivo (o activo de 5 V ≤ 20 mA) | Pitidos distintos por resultado |
| SW1 | 1 | Pulsador táctil 6×6 mm | Cambia la página del LCD |
| C1, C2 | 1 + 1 | 100 nF cerámico, 10 µF electrolítico | Desacoplo de 3,3 V junto al módulo |
| C3 | 1 | 100 µF electrolítico | Desacoplo de 5 V junto al LCD |
| — | 3 | Tarjetas o llaveros MIFARE Classic 1K | Una por alumno de la demostración |
| — | 1 | Protoboard 830 puntos + ≈ 30 jumpers | Montaje de prueba (SPI con cables cortos) |

Costo y proveedores: sin cotizar.

## 5. Pines y cableado

Esquema: [`circuito/circuito.png`](circuito/circuito.png) (vectorial en `circuito.svg`). Tabla completa y verificación
eléctrica: [`circuito/pines.md`](circuito/pines.md).

| Pin UNO | Conectado a | Nivel |
|---|---|---|
| D10 (SS) | MFRC522 SDA/SS, por divisor R1/R5 | 5 V → 3,3 V |
| D13 (SCK) | MFRC522 SCK, por divisor R2/R6 | 5 V → 3,3 V |
| D11 (MOSI) | MFRC522 MOSI, por divisor R3/R7 | 5 V → 3,3 V |
| D12 (MISO) | MFRC522 MISO, **directo** | 3,3 V |
| D9 | MFRC522 RST, por divisor R4/R8 | 5 V → 3,3 V |
| 3V3 / GND | MFRC522 3.3V / GND (+ C1, C2) | 3,3 V |
| A4 (SDA), A5 (SCL) | LCD SDA, SCL | 5 V, pull-ups en la mochila |
| 5V / GND | LCD VCC / GND (+ C3) | 5 V |
| D5, D6, D7 | R9/R10/R11 → LED verde / ámbar / rojo → GND | 5 V |
| D8 | R12 → BZ1 (+) → GND | 5 V |
| D2 | SW1 → GND (`INPUT_PULLUP`) | 5 V en reposo |

Notas que importan al armar:

1. **El MFRC522 se alimenta solo a 3,3 V.** Conectarlo a 5 V lo daña. Sus entradas tampoco aceptan 5 V: por eso SS, SCK, MOSI
   y RST pasan por divisores 1 kΩ / 2 kΩ (5 V × 2/3 = 3,33 V). **Antes de conectar el módulo, mida con un multímetro** que
   cada nodo de divisor marque ≈ 3,3 V con el UNO encendido.
2. **MISO va directo**: el UNO lee 3,3 V como 1 (umbral 0,6 × VCC = 3,0 V). El margen es pequeño; si las lecturas fueran
   inestables, use un traductor de niveles bidireccional en esa línea.
3. El pin **IRQ** del módulo no se conecta. Hay que soldar la tira de pines del módulo.
4. Los **pull-ups de SDA/SCL** ya vienen en la mochila I2C del LCD; no agregue otros.
5. Cables SPI cortos (< 15 cm). El orden de pines del esquema es lógico, no la posición física de la placa.
6. Polaridad: LED ánodo (pata larga) hacia la resistencia; C2 y C3 con el `+` hacia 3V3 / 5 V.
7. `tone()` usa Timer2 (quita el PWM de D3/D11, que aquí no se usa); D13 comparte pin con el LED `L` de la placa.

### Alimentación y consumo (estimado, no medido)

| Carga | Consumo típico |
|---|---|
| UNO + conversor USB | ≈ 50 mA |
| LCD con luz | 25–40 mA |
| MFRC522 (desde 3V3) | 13–30 mA |
| LED (uno / los tres) | 14 / 42 mA |
| Zumbador pasivo | < 5 mA |
| 4 divisores | ≤ 7 mA |
| **Total** | **≈ 115 mA típico, ≈ 190 mA peor caso** |

Queda por debajo de los 500 mA de un puerto USB 2.0 y del fusible reseteable del UNO. Use un puerto directo de la computadora o
un concentrador con alimentación propia. El regulador de 3,3 V del UNO entrega hasta 150 mA; el módulo usa ≤ 30 mA. Son
cálculos con valores típicos de hojas de datos: **no se midió nada**.

## 6. Protocolo serie

USB, **115200 baudios, 8N1**. Líneas de texto ASCII terminadas en `\n` (se tolera `\r\n`), de **máximo 64 bytes** sin el
salto. Al abrir el puerto el UNO se reinicia (DTR) y manda `HELLO`.

**Estación → PC**

| Línea | Cuándo |
|---|---|
| `HELLO estacion-aula 1.0` | Al terminar el arranque (y cada vez que la placa se reinicia) |
| `UID <HEX>` | Tarjeta leída. HEX en mayúsculas, sin separadores (8, 14 o 20 dígitos: UID de 4, 7 o 10 bytes). Ej.: `UID 04A1B2C3` |
| `BTN` | Cada pulsación del botón (ya con antirrebote de 30 ms) |
| `PONG` | Respuesta a `PING` |

**PC → estación**

| Línea | Efecto |
|---|---|
| `PING` | Responde `PONG` |
| `SES <grupo>\|<materia>\|<presentes>/<total>` | Página 1 del LCD. Textos recortados a 16 columnas y sin acentos. `SES \|\|0/0` (grupo y materia vacíos) = **no hay sesión abierta** |
| `RES OK <nombre-corto>` | LED verde, un pitido corto (2200 Hz, 120 ms), LCD «Registrado» + nombre |
| `RES DUP [nombre-corto]` | LED ámbar, dos pitidos cortos, LCD «Ya registrado» |
| `RES NOREG` | LED rojo, un pitido largo y grave (500 Hz, 600 ms), LCD «Tarjeta no registrada» |
| `RES ERR [motivo]` | LED rojo parpadeando, sin sonido, LCD «Error» + motivo (o «del sistema») |

Reglas:

* **Antirrebote del UID**: el mismo UID se ignora si la lectura anterior fue hace menos de **2 s**, y además **la tarjeta debe
  retirarse** (3 sondeos seguidos sin verla) antes de que su siguiente lectura cuente. Un UID distinto cuenta de inmediato.
* **Entradas ignoradas sin consecuencias**: línea de más de 64 bytes (se descarta *entera*), con caracteres de control, de
  verbo desconocido, mal formada o en minúsculas. Ni se bloquea ni se interpreta un fragmento.
* **Regla de los 30 s**: si la PC no manda ningún comando **reconocido** (`PING`, `SES`, `RES`) en 30 s, la pantalla muestra
  «Sin conexion» y el LED ámbar parpadea lento (500 ms de cada 2 s). Un comando desconocido no cuenta como señal de vida.
  Antes del primer comando válido la pantalla dice «Esperando PC...» y a los 30 s pasa a «Sin conexion».
* **Respuesta que no llega**: si tras un `UID` no llega `RES` en 3 s, la estación avisa por su cuenta (LED rojo parpadeando y
  «Sin respuesta»).
* **Pantalla**: tres páginas que rota el botón: 1 sesión (materia, grupo, presentes/total), 2 último UID, 3 diagnóstico
  (`PC:OK RC522:OK`, lecturas). Un resultado `RES` ocupa la pantalla 2 s.
* Si el lector RFID deja de contestar por SPI, el LED rojo parpadea lento y la página 3 muestra `RC522:ERR`; se reintenta cada 5 s.
* Si falta el LCD, la estación sigue funcionando sin pantalla; lo busca en 0x27 y luego en 0x3F, y reintenta cada 5 s.

## 7. Compilar, grabar y probar

**Compilar y grabar** (con acceso normal a internet; en este entorno no se pudieron instalar `arduino-cli` ni el IDE, así que
estos comandos **no se ejecutaron aquí**):

```bash
arduino-cli core install arduino:avr
arduino-cli lib install "MFRC522" "LiquidCrystal I2C"
arduino-cli compile --fqbn arduino:avr:uno hardware/estacion-aula/firmware/estacion_aula
arduino-cli upload  --fqbn arduino:avr:uno -p /dev/ttyACM0 hardware/estacion-aula/firmware/estacion_aula
```

O en el IDE de Arduino: instalar las librerías «MFRC522» (GithubCommunity) y «LiquidCrystal I2C» (Frank de Brabander), abrir
`firmware/estacion_aula/estacion_aula.ino`, elegir *Arduino Uno* y el puerto, y pulsar *Subir*. Probado solo con el núcleo *Arduino AVR
Boards* 1.8.6 (usa `Wire.setWireTimeout`, que no existe en núcleos muy antiguos). Con un zumbador **activo**, cambie `#define ZUMBADOR_ACTIVO 0` a `1` en el sketch.

**Compilación sin `arduino-cli`** (la que se usó para el registro): `firmware/compilar-avr.sh` (necesita `gcc-avr`, `avr-libc`,
`binutils-avr` y `arduino-core-avr`; baja las dos librerías de GitHub con sha256 fijados).

**Pruebas en el computador**

```bash
firmware/pruebas/ejecutar.sh --mutaciones            # lógica + sketch simulado + mutaciones (g++)
firmware/pruebas/simavr/ejecutar-simavr.sh <elf>     # binario en simavr (apt install libsimavr-dev)
cd hardware/estacion-aula/puente && node --test pruebas/*.test.mjs
node puente/puente-serial.mjs --simulado --guion     # recorrido completo sin hardware
node circuito/generar-circuito.mjs                   # regenera el esquema (y valida las tablas)
```

Las dependencias externas del puente y del dibujo se instalan **sin tocar ningún `package.json`** (carpetas `tools/`
ignoradas por git):

```bash
npm install --no-save --prefix hardware/estacion-aula/puente/tools   serialport@13
npm install --no-save --prefix hardware/estacion-aula/circuito/tools playwright@1.56.1   # solo para el PNG
```

## 8. Lista de verificación para la primera puesta en marcha con hardware

Lo siguiente **no se ha hecho**; es el orden sugerido para no dañar nada:

1. Armar solo UNO + divisores **sin** el módulo RC522 conectado; con el UNO encendido medir ≈ 3,3 V en cada nodo de divisor y
   que 3V3 marque ≈ 3,3 V.
2. Conectar el MFRC522, el LCD y el resto; grabar el sketch; abrir el monitor serie a 115200: debe verse `HELLO estacion-aula 1.0`.
3. Escribir `PING` + Enter (con fin de línea «Nueva línea»): debe responder `PONG`.
4. Verificar que el LCD muestre «SUSAN Estacion» y luego «Esperando PC...» (si no, probar la dirección 0x3F, contraste de la
   mochila y que el puente de la luz esté puesto).
5. Acercar una tarjeta: debe aparecer `UID …` **una sola vez**; dejarla puesta 10 s (no debe repetir); retirarla y volver a
   acercarla tras 2 s (debe contar otra vez). **Esta es la prueba clave de la lógica de retirada**, que depende de cómo
   respondan las tarjetas reales a HLTA/WUPA y no pudo comprobarse.
6. Con el puente: `node puente/puente-serial.mjs --puerto /dev/ttyACM0` y `--listar` para ver el puerto. Registrar los UID reales
   en una copia de `credenciales-demo.csv`.
7. Medir el consumo real y la estabilidad con el LCD y el zumbador activos.
8. Anotar los resultados en la tabla de §2.

## 9. Límites conocidos

* **El sondeo del lector bloquea hasta ≈ 25–40 ms** cuando no hay tarjeta (esperas internas de la librería MFRC522) y
  reescribir una fila del LCD por I2C toma ≈ 40 ms. No hay `delay()` en `loop()`, pero ese es el tiempo de respuesta del ciclo.
  El búfer serie del UNO es de 64 bytes (≈ 5,6 ms a 115200): sirve porque el tráfico es de unas pocas líneas por segundo.
* **Lógica de retirada de tarjeta sin validar con tarjetas reales.** Se probó contra cuatro modelos de tarjeta simulada (normal;
  HLTA desde READY que la devuelve a IDLE; que no obedece HLTA; que vuelve sola a IDLE cada 700 ms), pero no con tarjetas físicas.
* **SRAM al 60 %**: sobra margen, pero no hay mucho para crecer sin mover cadenas a `PROGMEM`.
* **Sin *watchdog***: un cuelgue no se recupera solo. Se evitó activarlo sin poder comprobar el cargador de arranque de la
  placa (algunos antiguos se reinician en bucle). Sí hay tiempo límite del bus I2C (`Wire.setWireTimeout`).
* **MISO sin traductor de niveles** (margen de ≈ 0,3 V, ver §5). **Consumo y desacoplo calculados, no medidos.**
* **El puente guarda la sesión en memoria** (JSON de demostración): no consulta la base de datos ni se entera de que el docente
  cerró la sesión en la web. La tabla UID → alumno se lee de un CSV al arrancar (no se recarga en caliente).
* Una estación por computadora; no hay autenticación entre la estación y el puente (el cable USB es el límite de confianza).
* No se probó con **UID de 7 o 10 bytes en hardware** (sí en las pruebas) ni con tarjetas distintas de MIFARE Classic.

## 10. Siguientes pasos (no implementados)

1. **Tabla `credencial`** (nueva migración en `supabase/migrations/`): `id_credencial`, `id_alumno` → `alumno`, `uid` (hex en
   mayúsculas, único), estatus `activa`/`revocada`, fechas de alta y baja; RLS solo para administración. Pantalla de alta de
   tarjetas junto al registro del alumno. **Decisión pendiente del equipo:** el UID identifica a una persona aunque no sea un
   dato biométrico, por lo que conviene revisar con el aviso de privacidad si hace falta consentimiento o aviso propio.
2. **RPC** que resuelva `uid` → alumno y registre con origen manual reutilizando `api_registrar_manual(p_id_sesion,
   p_id_alumno, p_estado, p_hora)` (RF-09; en sesión automática solo admite a inscritos sin consentimiento vigente o sin
   lecturas válidas, que es justo el caso de uso). Hoy esas RPC son `authenticated`: **el puente no debe llevar la
   `service_role` key** (CLAUDE.md) ni guardar un token del docente en disco.
3. **Dónde vive la integración.** Dos caminos a evaluar: (a) un *Route Handler* de Next autenticado con la sesión del docente al
   que llama el puente, o (b) leer la estación **directamente desde la aplicación web con la API Web Serial** del navegador,
   sin proceso intermedio ni secretos fuera del navegador autenticado (solo Chrome/Edge; no evaluado). En ambos casos se
   sustituye únicamente `registrarPresencia()` y se cargan las tarjetas desde la base en lugar del CSV.
4. Que `SES` refleje la sesión real (consultarla por RPC) y que el puente cierre el enlace cuando el docente cierre la sesión.
5. Caja o soporte, cableado definitivo (placa perforada o PCB), reubicar el lector junto a la puerta si se desea.
6. Pruebas en hardware (§8); si pasan, evaluar *watchdog*, traductor de niveles en MISO y `PROGMEM`.

## 11. Seguridad

* **Un UID no es un secreto.** Se transmite en claro por radio y se lee con cualquier teléfono compatible; no sirve como
  contraseña. Por eso el sistema lo trata como un *identificador* que el docente puede revisar, nunca como prueba de identidad.
* **Riesgo de clonación y de préstamo**: las MIFARE Classic de bajo costo se copian con herramientas comunes y una tarjeta se
  puede pasar a otra persona. Mitigaciones previstas: el docente ve quién se registró y puede corregir (RF-11); registrar solo
  durante la sesión abierta; revocar credenciales; en el futuro, tarjetas con autenticación criptográfica (p. ej. NTAG 424 DNA o
  DESFire) si el riesgo lo justifica.
* **Es un recurso de conveniencia, no autenticación fuerte.** No debe otorgar nada que el pase manual no otorgue.
* **Privacidad**: el puente enmascara UID y matrículas en sus registros y no escribe nombres (CLAUDE.md: sin PII en logs);
  `--verboso` lo desactiva y solo debe usarse con los datos ficticios de `credenciales-demo.csv`. Ningún dato facial interviene.
* **Secretos**: ninguno vive en esta carpeta; el siguiente paso debe mantener esa regla (§10.2).
* El firmware ignora cualquier entrada que no sea un comando exacto y no ofrece ninguna acción destructiva por serie.

## 12. Decisiones de diseño respecto al borrador inicial

Cambios y refinamientos que se hicieron al revisar el diseño; el resto del borrador se respetó:

1. **`SES ||0/0` = sin sesión** (protocolo): sin esto la estación no podía mostrar «Sin sesion abierta» cuando el docente cierra.
2. **`RES ERR` y `RES DUP` aceptan texto opcional** (motivo y nombre): permite «Error: Sin sesion abierta» sin agregar verbos nuevos;
   la forma sin texto del borrador sigue siendo válida.
3. **Dos reglas de antirrebote combinadas** (2 s por UID *y* retirada con WUPA): el HALT de la tarjeta solo no basta si una
   tarjeta vuelve sola a IDLE.
4. **Aviso local si no llega `RES` en 3 s** y **estado «Esperando PC»** antes de la primera señal de la PC.
5. **Autodiagnóstico**: LED rojo lento si el RC522 no contesta, reintentos del lector y del LCD cada 5 s, tiempo límite en I2C.
6. **Zumbador pasivo con `tone()` como diseño base** (el activo queda como opción por macro).
7. **Desacoplo con capacitores C1–C3**, y la advertencia explícita de que MISO directo tiene poco margen.
8. **Logs enmascarados** en el puente por la regla de PII del proyecto.
