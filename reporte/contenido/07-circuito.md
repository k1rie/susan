## DISEÑO DEL CIRCUITO DE LA ESTACIÓN DE AULA.

La estación de aula es un dispositivo de escritorio que se conecta por USB a la computadora del docente y permite pasar lista con una tarjeta RFID personal. Existe para el alumno que no otorgó su consentimiento para el reconocimiento facial, que lo revocó, o para cualquier alumno cuando falla la cámara del aula: en SUSAN no se reconoce ningún rostro sin consentimiento vigente (RN-13, RNF-06), y la tarjeta ofrece una vía de registro que no usa el rostro. Es la parte de hardware digital del proyecto integrador y se desarrolló en la unidad «Manejo de puertos» de Programación Avanzada. No es una autenticación fuerte, porque una tarjeta se puede prestar o clonar, y no cierra sesiones: cerrarlas exige la autenticación del docente en la aplicación web.

Este capítulo describe el diseño eléctrico. El circuito se diseñó y se dibujó, pero no se ha armado ni probado con componentes físicos; los consumos y los niveles de voltaje son cálculos con valores típicos de hojas de datos, no mediciones.

### 1. Tarjeta propuesta: Arduino UNO R3.

Se propone la tarjeta Arduino UNO R3 (microcontrolador ATmega328P, lógica de 5 V, reloj de 16 MHz). Las razones que respaldan la elección son las siguientes:

- Tiene puerto USB-B con conversor USB-serie, por lo que la misma conexión alimenta la placa y la comunica con la computadora del docente a 115200 baudios, 8N1.
- Expone el bus SPI (D10 a D13) que usa el lector MFRC522 y el bus I2C (A4 y A5) que usa la pantalla LCD.
- Su regulador entrega 3.3 V hasta 150 mA, suficientes para el módulo lector, que consume 30 mA como máximo.
- Dispone de los pines digitales que se necesitan para tres LED, un zumbador y un pulsador, y deja libres D3, D4 y A0 a A3.
- Su memoria alcanza para el programa: el firmware compilado ocupa 14 122 B de 32 256 B de memoria de programa (43.1 %) y 1 227 B de 2 048 B de SRAM (59.9 %).

### 2. Bloques del circuito.

El circuito se divide en bloques funcionales; las referencias (U1, R1, etc.) son las del esquema y de la lista de materiales.

<!-- anchos: 22,34,44 -->

| Bloque | Componentes | Función |
|---|---|---|
| Control y enlace | U1 Arduino UNO R3 | Ejecuta el firmware; se alimenta y se comunica por USB |
| Lector RFID | U2 MFRC522, C1, C2 | Lee el UID de la tarjeta (13.56 MHz) por SPI |
| Adaptación de niveles | R1 a R4 (1 kΩ), R5 a R8 (2 kΩ) | Baja SS, SCK, MOSI y RST de 5 V a 3.3 V |
| Pantalla | U3 LCD 16×2 con mochila I2C, C3 | Muestra sesión, resultado y diagnóstico |
| Indicadores luminosos | LED1 a LED3, R9 a R11 (220 Ω) | Verde: OK; ámbar: duplicado o sin conexión; rojo: no registrada o error |
| Indicador sonoro | BZ1, R12 (100 Ω) | Pitidos de resultado y de arranque |
| Entrada manual | SW1 | Cambia la página de la pantalla; nunca cierra sesiones |

Nota. Elaboración propia, a partir de la lista de materiales y de la tabla de pines de la estación.

### 3. Asignación de pines.

La tabla siguiente reproduce las conexiones de `pines.csv`. Se omiten las columnas del puerto AVR, el sentido de la señal y las notas, que están en el archivo; el pin IRQ del módulo no se conecta y no aparece en la tabla.

<!-- anchos: 13,9,17,20,17,12 -->

| Id | Pin UNO | Componente | Pin del componente | Nivel | Cable |
|---|---|---|---|---|---|
| `SPI-SS` | D10 | U2 MFRC522 | SDA (SS) | 5 V → 3.3 V | violeta |
| `SPI-SCK` | D13 | U2 MFRC522 | SCK | 5 V → 3.3 V | dorado |
| `SPI-MOSI` | D11 | U2 MFRC522 | MOSI | 5 V → 3.3 V | azul |
| `SPI-MISO` | D12 | U2 MFRC522 | MISO | 3.3 V directo | verde |
| `RC522-RST` | D9 | U2 MFRC522 | RST | 5 V → 3.3 V | gris |
| `RC522-3V3` | 3V3 | U2 MFRC522 | 3.3V | 3.3 V | naranja |
| `RC522-GND` | GND | U2 MFRC522 | GND | 0 V | negro |
| `LCD-SDA` | A4 | U3 LCD I2C | SDA | 5 V | cian |
| `LCD-SCL` | A5 | U3 LCD I2C | SCL | 5 V | rosa |
| `LCD-5V` | 5V | U3 LCD I2C | VCC | 5 V | rojo |
| `LCD-GND` | GND | U3 LCD I2C | GND | 0 V | negro |
| `LED-VERDE` | D5 | R9 220 Ω + LED1 | ánodo (vía R9) | 5 V | verde azulado |
| `LED-AMBAR` | D6 | R10 220 Ω + LED2 | ánodo (vía R10) | 5 V | verde azulado |
| `LED-ROJO` | D7 | R11 220 Ω + LED3 | ánodo (vía R11) | 5 V | verde azulado |
| `ZUMBADOR` | D8 | R12 100 Ω + BZ1 | terminal + (vía R12) | 5 V | verde azulado |
| `BOTON` | D2 | SW1 | terminal 1 | 5 V (pull-up) / 0 V | café |
| `GND-DER` | GND | LED1-3 cátodos + BZ1 − + SW1 terminal 2 | GND | 0 V | negro |

Nota. Valores tomados de `circuito/pines.csv`; 17 de las 18 filas del archivo (se omite `RC522-IRQ`, sin conexión). Elaboración propia.

### 4. Esquema del circuito.

El esquema se genera con el programa `generar-circuito.mjs`, que falla si el dibujo deja de coincidir con `pines.csv` y `bom.csv`; además se revisó a simple vista.

:::figura archivo="/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/hardware/estacion-aula/circuito/circuito.png" titulo="Esquema de conexión de la estación de aula." nota="Nota. Elaboración propia. Diseño no probado en hardware físico." ancho=16

El módulo MFRC522 funciona a 3.3 V y sus entradas no toleran 5 V, mientras que el UNO entrega señales de 5 V. Por eso SS, SCK, MOSI y RST (UNO hacia módulo) pasan por divisores resistivos de 1 kΩ en la parte alta y 2 kΩ en la parte baja, con lo que la salida es 5 × 2/(1 + 2) = 3.33 V. El README de la estación indica medir con un multímetro que cada nodo marque aproximadamente 3.3 V antes de conectar el módulo. La línea MISO (módulo hacia UNO) va directa: el UNO lee 3.3 V como nivel alto porque su umbral es 0.6 × VCC = 3.0 V, de modo que el margen es de apenas 0.3 V; si las lecturas fueran inestables, el propio README recomienda un traductor de niveles bidireccional en esa línea.

El consumo es una estimación, no una medición. Por componente se estiman: UNO con conversor USB, 50 mA; LCD con luz, de 25 a 40 mA; MFRC522, de 13 a 30 mA desde el regulador de 3.3 V; cada LED, 14 mA (42 mA los tres); zumbador pasivo, menos de 5 mA; y los cuatro divisores, hasta 7 mA. El total es de unos 115 mA típicos y 190 mA en el peor caso, por debajo de los 500 mA de un puerto USB 2.0. El regulador de 3.3 V del UNO entrega hasta 150 mA y el módulo usa 30 mA o menos. Para estabilizar la alimentación se colocan C1 (100 nF) y C2 (10 µF) junto al módulo y C3 (100 µF) junto a la pantalla.

### 5. Lista de materiales.

<!-- anchos: 11,8,48,17,16 -->

| Refs. | Cant. | Descripción | Valor | En esquema |
|---|---|---|---|---|
| U1 | 1 | Arduino UNO R3 (o compatible ATmega328P) con cable USB A-B | 5 V / 16 MHz | sí |
| U2 | 1 | Módulo lector RFID MFRC522 (RC522) 13.56 MHz | 3.3 V | sí |
| U3 | 1 | Pantalla LCD 16×2 HD44780 con mochila I2C PCF8574 | 5 V | sí |
| R1-R4 | 4 | Resistor 1/4 W (parte alta de los divisores) | 1 kΩ | sí |
| R5-R8 | 4 | Resistor 1/4 W (parte baja de los divisores) | 2 kΩ | sí |
| R9-R11 | 3 | Resistor 1/4 W en serie con cada LED | 220 Ω | sí |
| R12 | 1 | Resistor 1/4 W en serie con el zumbador | 100 Ω | sí |
| LED1 | 1 | LED 5 mm verde | verde | sí |
| LED2 | 1 | LED 5 mm ámbar | ámbar | sí |
| LED3 | 1 | LED 5 mm rojo | rojo | sí |
| BZ1 | 1 | Zumbador piezoeléctrico pasivo (o activo de 5 V ≤ 20 mA) | 5 V | sí |
| SW1 | 1 | Pulsador táctil 6×6 mm normalmente abierto | - | sí |
| C1 | 1 | Capacitor cerámico | 100 nF | sí |
| C2 | 1 | Capacitor electrolítico 16 V | 10 µF | sí |
| C3 | 1 | Capacitor electrolítico 16 V | 100 µF | sí |
| TARJETAS | 3 | Tarjetas o llaveros MIFARE Classic 1K (13.56 MHz) | - | no |
| PROTOBOARD | 1 | Protoboard de 830 puntos | - | no |
| JUMPERS | 30 | Cables jumper (aprox. 20 macho-macho + 10 macho-hembra) | - | no |
| CAJA | 1 | Caja o soporte impreso (opcional) | - | no |

Nota. Valores tomados de `circuito/bom.csv` (19 filas). Las filas que no están en el esquema son tarjetas, protoboard, cables y caja; la caja es opcional y está pendiente porque no se diseñó. Elaboración propia.
