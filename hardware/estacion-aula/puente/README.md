# Puente serie — Estación de aula SUSAN

Programa de Node (ESM) que habla con la estación por USB serie (115200 8N1), decide a qué alumno corresponde cada tarjeta y
contesta `RES …` / `SES …` para que la estación muestre el resultado. Es la parte de «Manejo de puertos» del lado de la
computadora del docente. Protocolo completo: [`../README.md`](../README.md) §6.

> **Importante:** `registrarPresencia(matricula)` es un **stub**. Solo escribe un aviso en pantalla y devuelve éxito; **no
> escribe nada en la base de datos de SUSAN**. La integración real (tabla `credencial` + RPC del pase manual) es el siguiente
> paso (README §10). Nada de esto se ha probado con el Arduino físico.

## Uso

```bash
# 1) Dependencia (una sola vez; no modifica ningún package.json)
npm install --no-save --prefix puente/tools serialport@13

# 2) Ver los puertos
node puente/puente-serial.mjs --listar

# 3) Conectar con la estación
node puente/puente-serial.mjs --puerto /dev/ttyACM0 --baud 115200
#    Windows: --puerto COM3     macOS: --puerto /dev/cu.usbmodem1101

# Sin hardware: dispositivo falso en memoria
node puente/puente-serial.mjs --simulado --guion     # recorrido automático (≈ 5 s)
node puente/puente-serial.mjs --simulado             # interactivo
```

Opciones: `--credenciales <csv>` (por omisión `credenciales-demo.csv`), `--sesion <json>` (por omisión `sesion-demo.json`),
`--sin-sesion` (arranca con la sesión cerrada), `--verboso` (muestra UID, matrículas y nombres completos: solo con datos
ficticios), `--ayuda`. Código de salida 2 ante argumentos o archivos inválidos. En Linux el usuario debe pertenecer al grupo
`dialout` (o `uucp`) para abrir `/dev/ttyACM0`.

Comandos del modo interactivo (`--simulado`): `tap <UID|1|2|3>`, `btn`, `silencio` (la «placa» deja de contestar PING), `voz`,
`abrir`, `cerrar` (equivalen a que el docente abra/cierre la sesión en la web; la estación **no** puede hacerlo), `estado`, `salir`.

## Qué hace

1. **Abre el puerto**. Al abrirlo, el UNO se reinicia (DTR) y manda `HELLO`; el puente responde con `SES …`. Si en 3 s no llega
   `HELLO` (puerto abierto sin reinicio) sincroniza de todos modos.
2. **Latido cada 10 s**: `PING` + `SES`. Así la estación nunca llega a sus 30 s de silencio y la pantalla se refresca sola.
3. **Regla de 30 s del lado de la PC**: si la estación no manda nada reconocible en 30 s, avisa y marca el enlace como
   perdido; sigue intentando y se recupera sola al volver a oír a la placa. Si el puerto se cierra (cable desconectado),
   reintenta abrirlo cada 3 s (código presente; no se probó con un desenchufado físico).
4. **Por cada `UID`**, en este orden: rebote (mismo UID en < 2 s: se ignora, sin respuesta) → ¿hay sesión? (`RES ERR Sin sesion
   abierta`) → ¿la tarjeta está en la tabla? (`RES NOREG`) → ¿ya estaba presente? (`RES DUP <nombre>`) →
   `registrarPresencia()` → `RES OK <nombre>` y un `SES` con el contador nuevo. Si el registro falla o no se confirma: `RES ERR`.
   Dos tarjetas del mismo alumno leídas a la vez se registran una sola vez.
5. **`BTN`** solo se anota: la estación ya cambió de página; el botón no puede cerrar sesiones.
6. Todo lo desconocido, de más de 64 bytes o con bytes no ASCII se descarta sin afectar al resto.
7. Todo lo que se escribe a la estación pasa por una validación de la gramática del protocolo (64 bytes, ASCII, verbos válidos).

## Archivos de configuración (datos ficticios)

* `credenciales-demo.csv`: `UID,matricula,nombre_corto`. Tres filas ficticias (`04DE0001`…`04DE0003`, matrículas `DEMO000x`).
  UID en hexadecimal mayúscula de 4, 7 o 10 bytes; sin comillas ni comas dentro de los campos; `#` comenta. Una fila inválida
  o un UID repetido se avisa al cargar y no sobrescribe a la primera.
* `sesion-demo.json`: `abierta`, `grupo`, `materia`, `total` y la lista `presentes` (matrículas ya presentes). Es el estado que
  en producción vendría de la base de datos.

## Privacidad de los registros

Por regla del proyecto (sin PII en logs) el puente muestra los UID como `****0001` y las matrículas como `***001` y no escribe
nombres. `--verboso` lo desactiva. Con datos reales **no** use `--verboso` ni guarde la salida.

## Pruebas

```bash
cd hardware/estacion-aula/puente
node --test pruebas/*.test.mjs
```

* `pruebas/puente.test.mjs`: texto y transliteración, análisis y ensamblado de líneas, CSV, flujo completo contra un
  dispositivo simulado (OK, duplicado, desconocida, sin sesión, fallo del registro, rebote de 2 s, concurrencia, entradas
  hostiles, privacidad de los registros), **la regla de 30 s, el latido y el HELLO ausente con temporizadores falsos**
  (`mock.timers`) y la línea de comandos.
* `pruebas/puente-pty.test.mjs`: el puente **real** (con `serialport`) contra una «estación» en un par de pseudo-terminales
  creado con `socat`; recorre HELLO, SES, OK, rebote, DUP, NOREG, ruido y Ctrl+C. Se omite si falta `socat` o `serialport`.

Resultado registrado en [`RESULTADO.txt`](RESULTADO.txt). El dispositivo simulado (`DispositivoSimulado`) es un doble de pruebas
escrito aparte del firmware: no ejecuta su código; la coherencia entre ambos se comprobó en `firmware/pruebas`.

## Límites

* Estado de sesión en memoria y credenciales desde un CSV cargado al arrancar.
* Una estación por proceso. Sin autenticación entre estación y puente.
* `serialport` 13 en Linux llama a `udevadm` para `--listar`; si no existe, el puente lista los nodos `/dev/ttyACM*`/`ttyUSB*`.
