# Tabla de pines — Estación de aula SUSAN

> **Estado:** diseño. Ningún cableado de este documento se ha probado en hardware físico.
> El dibujo está en [`circuito.svg`](circuito.svg) / [`circuito.png`](circuito.png) y lo genera
> `generar-circuito.mjs`, que **falla** si este archivo, [`pines.csv`](pines.csv) o [`bom.csv`](bom.csv)
> dejan de coincidir con el dibujo.

## Resumen por pin del Arduino UNO

| Pin UNO | Función | Conectado a | Nivel / nota |
|---|---|---|---|
| D2 | Entrada, `INPUT_PULLUP` | SW1 (otro terminal a GND) | Reposo 5 V, pulsado 0 V |
| D5 | Salida | R9 220 Ω → LED1 verde → GND | ≈ 14 mA |
| D6 | Salida | R10 220 Ω → LED2 ámbar → GND | ≈ 14 mA |
| D7 | Salida | R11 220 Ω → LED3 rojo → GND | ≈ 14 mA |
| D8 | Salida (`tone()`, Timer2) | R12 100 Ω → BZ1 (+) → GND | Zumbador pasivo |
| D9 | Salida | RST del MFRC522, vía divisor R4/R8 | 5 V → 3,3 V |
| D10 (SS) | Salida SPI | SDA/SS del MFRC522, vía divisor R1/R5 | 5 V → 3,3 V |
| D11 (MOSI) | Salida SPI | MOSI del MFRC522, vía divisor R3/R7 | 5 V → 3,3 V |
| D12 (MISO) | Entrada SPI | MISO del MFRC522, **directo** | 3,3 V (ver nota) |
| D13 (SCK) | Salida SPI | SCK del MFRC522, vía divisor R2/R6 | 5 V → 3,3 V |
| A4 (SDA) | I2C | SDA del LCD | 5 V, pull-up en la mochila |
| A5 (SCL) | I2C | SCL del LCD | 5 V, pull-up en la mochila |
| 3V3 | Alimentación | 3.3V del MFRC522 (+ C1, C2) | ≤ 150 mA del regulador |
| 5V | Alimentación | VCC del LCD (+ C3) | |
| GND (×3) | Tierra | GND de MFRC522, LCD y bus de LED/zumbador/pulsador | Tierra común |
| — | USB-B | PC del docente | Serie 115200 8N1 + 5 V |

Pines sin usar: D3, D4, A0–A3 (y A6/A7 si el modelo los trae). D0/D1 quedan reservados al USB-serie: no se conecta nada
ahí. D13 (SCK) comparte pin con el LED `L` de la placa. `tone()` usa Timer2 y quitaría el PWM de D3 y D11, pero este
diseño no usa `analogWrite`.

## Conexiones (fuente: `pines.csv`)

| Id | Señal | Pin UNO | Componente | Pin del componente | Sentido | Nivel | Cable |
|---|---|---|---|---|---|---|---|
| `SPI-SS` | SS (selección de esclavo) | D10 | U2 MFRC522 | SDA (SS) | UNO → módulo | 5 V → 3.3 V | violeta |
| `SPI-SCK` | SCK (reloj SPI) | D13 | U2 MFRC522 | SCK | UNO → módulo | 5 V → 3.3 V | dorado |
| `SPI-MOSI` | MOSI (datos hacia el módulo) | D11 | U2 MFRC522 | MOSI | UNO → módulo | 5 V → 3.3 V | azul |
| `SPI-MISO` | MISO (datos desde el módulo) | D12 | U2 MFRC522 | MISO | módulo → UNO | 3.3 V directo | verde |
| `RC522-RST` | RST (reinicio del módulo) | D9 | U2 MFRC522 | RST | UNO → módulo | 5 V → 3.3 V | gris |
| `RC522-IRQ` | IRQ (no se usa) | - | U2 MFRC522 | IRQ | sin conexión | - | - |
| `RC522-3V3` | Alimentación 3.3 V | 3V3 | U2 MFRC522 | 3.3V | alimentación | 3.3 V | naranja |
| `RC522-GND` | Tierra del módulo | GND | U2 MFRC522 | GND | alimentación | 0 V | negro |
| `LCD-SDA` | SDA (I2C) | A4 | U3 LCD I2C | SDA | bidireccional | 5 V | cian |
| `LCD-SCL` | SCL (I2C) | A5 | U3 LCD I2C | SCL | UNO → LCD | 5 V | rosa |
| `LCD-5V` | Alimentación 5 V | 5V | U3 LCD I2C | VCC | alimentación | 5 V | rojo |
| `LCD-GND` | Tierra del LCD | GND | U3 LCD I2C | GND | alimentación | 0 V | negro |
| `LED-VERDE` | LED verde (resultado OK) | D5 | R9 220 Ω + LED1 | ánodo (vía R9) | UNO → LED | 5 V | verde azulado |
| `LED-AMBAR` | LED ámbar (duplicado / sin conexión) | D6 | R10 220 Ω + LED2 | ánodo (vía R10) | UNO → LED | 5 V | verde azulado |
| `LED-ROJO` | LED rojo (no registrada / error) | D7 | R11 220 Ω + LED3 | ánodo (vía R11) | UNO → LED | 5 V | verde azulado |
| `ZUMBADOR` | Zumbador | D8 | R12 100 Ω + BZ1 | terminal + (vía R12) | UNO → zumbador | 5 V | verde azulado |
| `BOTON` | Pulsador de página | D2 | SW1 | terminal 1 | pulsador → UNO | 5 V (pull-up) / 0 V | café |
| `GND-DER` | Tierra de LED / zumbador / pulsador | GND | LED1-3 cátodos + BZ1 − + SW1 terminal 2 | GND | alimentación | 0 V | negro |

La columna `nota` completa de cada conexión está en [`pines.csv`](pines.csv).

## Verificación eléctrica del diseño

Estas comprobaciones son **cálculos de diseño** con valores típicos de hojas de datos; no se midió nada.

1. **Divisores 1 kΩ / 2 kΩ.** Las entradas digitales del MFRC522 no están pensadas para 5 V (la hoja de datos limita la tensión
   de entrada a algo más que su alimentación, VDD + 0,5 V; valor recordado de la hoja de datos, verificar en la revisión vigente),
   así que SS, SCK, MOSI y RST, que salen del UNO a 5 V, se rebajan: Vsalida = 5 V × 2 kΩ / (1 kΩ + 2 kΩ) = 3,33 V.
   Corriente por divisor con la línea en alto: 5 V / 3 kΩ ≈ 1,7 mA; con 4 divisores, ≤ 6,7 mA. Impedancia de salida
   1 kΩ‖2 kΩ ≈ 667 Ω con unos 20 pF de cable y entrada: constante de tiempo ≈ 13 ns, muy por debajo del periodo de 250 ns del SPI a 4 MHz.
2. **MISO directo.** El MFRC522 entrega ≈ 3,3 V en alto y el ATmega328P alimentado a 5 V reconoce un 1 desde 0,6 × VCC = 3,0 V
   (hoja de datos del ATmega328P; verificar): margen de ≈ 0,3 V. Es una práctica extendida pero **justa**. Si hubiera lecturas
   inestables, sustituir ese cable por un traductor de niveles bidireccional (p. ej. módulo de 4 canales con BSS138).
3. **LED.** (5 V − Vf ≈ 2 V) / 220 Ω ≈ 14 mA. El límite recomendado del ATmega328P es 20 mA por pin (40 mA absoluto).
   Con los tres encendidos a la vez ≈ 42 mA, dentro de lo que admiten los puertos B y D por separado.
4. **Zumbador.** Un piezo pasivo es una carga capacitiva de pocos mA; R12 (100 Ω) limita el pico de corriente al conmutar.
   Un zumbador activo de 5 V que consuma ≤ 20 mA también sirve (en ese caso, definir `ZUMBADOR_ACTIVO 1` en el sketch).
5. **Polaridad.** LED: ánodo (pata larga) hacia la resistencia, cátodo (pata corta, lado plano) a GND. C2 y C3
   (electrolíticos): `+` al lado de 3V3 / 5 V. El zumbador pasivo suele ir sin polaridad; si el modelo marca `+`, ese
   terminal va a R12.
6. **I2C.** SDA y SCL necesitan pull-ups; la mochila PCF8574 los trae (4,7–10 kΩ a 5 V). No se añaden externos: dos
   juegos en paralelo bajarían la resistencia efectiva y aumentarían la corriente de bajada.
7. **Conflictos de pines.** SPI de hardware fijo (D11–D13), D10 debe ser salida (lo es: SS del módulo), A4/A5 son los pines
   I2C del UNO, `tone()` usa Timer2 (afecta solo PWM de D3/D11, no usado) y D2 (INT0) se lee por sondeo, no
   por interrupción. D0/D1 (UART) quedan para el USB: no se conecta nada ahí.
8. **Presupuesto de corriente (5 V, estimado).** UNO + conversor USB ≈ 50 mA; LCD con luz 25–40 mA; MFRC522 13–30 mA;
   un LED 14 mA (tres: 42 mA); zumbador pasivo < 5 mA; divisores ≤ 7 mA. **Típico ≈ 115 mA, peor caso ≈ 190 mA**, bajo el
   límite de 500 mA del puerto USB 2.0 y del fusible reseteable del UNO. Conviene un puerto USB directo del equipo y no un
   concentrador sin alimentación. El regulador de 3,3 V del UNO entrega hasta 150 mA; el MFRC522 usa ≤ 30 mA.
9. **Desacoplo.** C1 (100 nF) + C2 (10 µF) entre 3V3 y GND pegados al módulo RC522, y C3 (100 µF) entre 5 V y GND junto al
   LCD, evitan reinicios por picos de corriente de la antena y de la luz del LCD, sobre todo con cables jumper largos.
10. **Cables.** SPI de menos de ≈ 15 cm y, si es posible, trenzando cada señal con GND; el bus SPI a 4 MHz con jumpers
    largos es la causa habitual de lecturas intermitentes.
