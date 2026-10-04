# Reloj de demostración (solo desarrollo local)

Permite mover la hora de negocio **sin reiniciar nada** para probar el ciclo completo de una sesión de clase: abrirla,
pasar lista, ver el retardo, dejar que termine la tolerancia y cerrarla. Existe únicamente con `SUSAN_LOCAL=1`; en
producción las rutas responden 404 y la tarjeta no se pinta.

## Por qué hace falta

Hasta ahora el reloj simulado era una variable de entorno (`LOCAL_FAKE_NOW`, por omisión el lunes 14-sep-2026 07:12) que
se leía al arrancar Next. Con el reloj fijo en 07:12 la tolerancia de 20 min de la sesión de las 07:00 nunca terminaba:
no se podía cerrar la sesión, no se veían retardos nuevos (el límite de "presente" es 10 min) ni las ausencias del cierre.

## Cómo se usa

### Desde la interfaz (tarjeta «Reloj de demostración»)

Aparece arriba del contenido de cada pantalla autenticada cuando el reloj simulado está activo.

| Control | Efecto |
|---|---|
| `+5 min`, `+10 min`, `+30 min` | Adelanta el reloj ese tiempo. |
| `Correr` / `Pausar` | Echa a andar el reloj en tiempo real desde la hora que marca, o lo detiene. Ver «Modos». |
| `Restablecer` | Vuelve a `LOCAL_FAKE_NOW` (14-sep-2026 07:12), detenido. |
| `Fijar hora` | Abre un campo de fecha y hora (hora de la sede) para saltar a un instante exacto. |

Tras cada cambio la pantalla vuelve a pedir sus datos sola (ver «Cómo se refresca la pantalla»).

### Desde la API

`/api/_local/reloj` exige sesión (cualquier rol). El `POST` además exige la cabecera `Origin` del propio sitio.

```
GET  /api/_local/reloj
  -> { activo, corre, ahora, fecha, hora, inicial }
     ahora   '2026-09-14T07:12:00-06:00' (ISO con zona de la sede)
     fecha   '2026-09-14'      hora '07:12:00'
     inicial el valor de LOCAL_FAKE_NOW (a donde vuelve «restablecer»); null si el reloj está apagado

POST /api/_local/reloj      una sola operación por petición:
  { "avanzarMin": 30 }                    entero distinto de cero, |n| <= 10080 (una semana); negativo = hacia atrás
  { "fijar": "2026-09-14 07:03" }         'AAAA-MM-DD HH:MM[:SS]' (admite 'T'), hora de la sede (-06)
  { "correr": true }                      echa a andar (false = detiene)
  { "restablecer": true }                 borra el estado y vuelve a LOCAL_FAKE_NOW
  -> el mismo cuerpo que GET, ya con el cambio
```

Errores: `400 validation_failed` (cuerpo mal formado, dos operaciones a la vez, llave desconocida), `400 FORMATO_INVALIDO`
(fecha inexistente, p. ej. 31 de febrero), `400 FUERA_DE_RANGO` (fuera de los años 2000–2099), `409 RELOJ_NO_ACTIVO`
(el reloj está apagado, ver «Cuándo está activo»), `401` sin sesión, `403` sin `Origin` válido, `404` fuera del modo local.

### Desde una terminal

```
# sesión de docente1 (contraseña de desarrollo del README)
curl -s -c cj.txt -H 'Origin: http://localhost:3000' -H 'Content-Type: application/json' \
     -d '{"email":"docente1@susan.local","password":"<contraseña de desarrollo>"}' http://localhost:3000/api/_local/auth/login
curl -s -b cj.txt -H 'Origin: http://localhost:3000' -H 'Content-Type: application/json' \
     -d '{"avanzarMin":30}' http://localhost:3000/api/_local/reloj
```

## Qué ventanas del pase de lista se prueban

Valores de la semilla (`parametro_sistema` y la sesión): `limite_presente_min = 10`, `tolerancia_min = 20`,
`min_detecciones_validas = 3`, `intervalo_muestreo_seg = 15`. Ejemplo con la sesión **19** (3A, 07:00–08:00, hoy en la
semilla); los minutos se cuentan desde `hora_inicio`:

| Hora simulada | Minuto de clase | Qué pasa |
|---|---|---|
| antes de 07:00 | — | Abrir la sesión responde `FUERA_DE_HORARIO` (solo se abre entre `hora_inicio` y `hora_fin`). |
| 07:00 a 07:09:59 | 0 a < 10 | La **primera** lectura válida del alumno cae en ventana de **presente**. Al reunir 3 lecturas en capturas distintas queda `presente`. |
| 07:10 a 07:20 | 10 a 20 | La primera lectura válida cae en **retardo**: con 3 lecturas queda `retardo`. |
| después de 07:20 | > 20 | `svc_crear_captura` responde `FUERA_DE_VENTANA`: el muestreo termina (la interfaz recibe `fin_muestreo`). Quien tenga 1–2 lecturas queda `pendiente` (cola de revisión). |
| antes de 07:20 | — | El docente no puede cerrar: `VENTANA_TOLERANCIA_ABIERTA` (el cierre se habilita en `min(inicio + tolerancia, fin)`). |
| desde 07:20 | — | **Cierre** habilitado: consolida lecturas, confirma presentes/retardos y crea `ausente` para cada inscrito activo sin registro. |
| desde 08:00 | — | El job `cerrar-sesiones` (`/api/jobs/cerrar-sesiones`, `svc_job_cerrar_sesiones`) cierra por el sistema las sesiones abiertas cuya `hora_fin` ya pasó. |

El estado lo decide la **primera** lectura válida (no la que completa el mínimo): para ver «presente» hay que pasar lista
con el reloj antes de las 07:10; para ver «retardo», entre 07:10 y 07:20.

Receta para ver todo en una sesión: `Fijar hora` 07:03 → abrir y pasar lista (presentes) → `+10 min` (07:13) → pasar lista
con otro alumno (retardo) → `+10 min` (07:23, la tolerancia terminó) → cerrar la sesión (ausentes) → `Restablecer`.

## Modos: detenido y corriendo

- **Detenido** (por omisión): el tiempo no avanza solo; cada RPC ve exactamente el mismo instante hasta que alguien lo
  mueve. Es determinista, ideal para probar fronteras (07:09:59 vs 07:10).
- **Corriendo**: el instante avanza en tiempo real desde la hora que marcaba. Es el modo que necesita el **muestreo de la
  cámara**: `svc_crear_captura` es idempotente por (cámara, `marca_tiempo`), así que con el reloj detenido todas las muestras
  tendrían la misma marca y solo la primera contaría; con el reloj corriendo cada muestra (cada 15 s) lleva su marca.
  Si la sesión se deja correr más de 20 min, la tolerancia termina sola, como en la vida real: `Pausar` para congelarla.

`Avanzar` y `Fijar` conservan el modo (si corre, sigue corriendo desde el instante nuevo). `Restablecer` siempre deja el
reloj detenido en `LOCAL_FAKE_NOW`.

## Cuándo está activo

Solo con `LOCAL_FAKE_NOW` definido y distinto de `off` (`scripts/dev-all.sh` lo pone en `2026-09-14 07:12:00-06`;
`SUSAN_FAKE_NOW=off` lo apaga y usa el reloj real) **y** en modo local: sin `SUSAN_LOCAL=1` (o `NEXT_PUBLIC_SUSAN_LOCAL=1`), o con
`NODE_ENV=production`, el reloj está apagado aunque `LOCAL_FAKE_NOW` siga puesto (`configInicial` de `web/src/lib/local/reloj.js`;
la misma regla que `soloLocal()` de `/api/_local/*`). Así una variable olvidada no fecha las capturas de producción con una hora fija. Con el reloj real no hay tarjeta, `GET` responde `activo: false` y las
operaciones del `POST` responden `409 RELOJ_NO_ACTIVO`. Un archivo de estado viejo **no** enciende un reloj apagado.

Además la base debe tener `app.allow_fake_clock = 'on'` (la crean los scripts locales; nunca en Supabase real): sin eso
PostgreSQL ignora `app.fake_now` y `api_ahora().reloj_simulado` es `false`, que es la señal que usa el `AppShell` para
mostrar la tarjeta.

## Dónde vive el estado

- Archivo `${SUSAN_LOCAL_DIR}/run/fake_now` (junto a los PID y bitácoras de `dev-all.sh`; sin `SUSAN_LOCAL_DIR`, el padre de
  `LOCAL_STORAGE_DIR`; `LOCAL_CLOCK_FILE` fuerza otra ruta, útil en pruebas). En esta máquina:
  `~/.susan-local/SUSAN/run/fake_now`.
- Sin archivo rige `LOCAL_FAKE_NOW` detenido (el comportamiento de siempre). **Reiniciar Next conserva el último valor**;
  `Restablecer` (o borrar el archivo) vuelve a `LOCAL_FAKE_NOW`.
- Formato: `{"baseMs": <ms UTC>, "anclaMs": <ms UTC reales del servidor> | null, "legible": "2026-09-14 07:27:00-06"}`.
  `anclaMs = null` es detenido; con valor, el instante es `baseMs + (ahora real - anclaMs)`. También se acepta a mano una
  sola línea de texto (`echo '2026-09-14 07:03:00-06' > .../run/fake_now`): queda detenido en esa hora.
- Cada RPC local lee el estado (`web/src/lib/local/rpc.js` → `reloj.js`) con un `stat` y una caché por inodo + mtime +
  tamaño: solo vuelve a leer el archivo cuando cambió. El valor viaja a `set_config('app.fake_now', …, true)`.

## Cómo se refresca la pantalla

Tras cada cambio, la tarjeta emite el evento global `susan:reloj-cambio` (`EVENTO_RELOJ_CAMBIO` en `@/hooks/data`) y llama a
`router.refresh()`. Todo `useApiQuery` montado vuelve a pedir sus datos (sin pasar por «cargando») y los componentes del
servidor se vuelven a renderizar. Quien cargue datos con otro mecanismo debe escuchar el evento. El evento lleva en `detail` el
estado nuevo del reloj: si otra pieza lo emite (la cámara simulada pone el reloj en marcha o lo adelanta), la tarjeta lo adopta al
instante en lugar de esperar a la relectura. Mientras corre, la hora visible avanza por sí sola cada segundo y se vuelve a leer del
servidor cada 20 s (por si cambió desde otra pestaña).

## Límites

- **Solo la hora de negocio de PostgreSQL** (`app.now()`, `api_ahora`, retardos, tolerancia, cierre, jobs invocados por HTTP).
  No simula el reloj del navegador, la caducidad de la cookie de sesión (8 h reales), las URL firmadas (≤ 300 s reales), el
  limitador de capturas, ni las marcas de tiempo de las bitácoras de Next y del servicio de reconocimiento.
- **Marca de tiempo de la captura.** Con el reloj de demostración activo, `POST /api/sesiones/{id}/captura` (`ejecutarCaptura`,
  `web/src/lib/server/captura.js`) estampa cada captura con la hora de negocio (`ahoraDeNegocio()` de `@/lib/local/reloj.js`) e
  ignora la `marca_tiempo` del cliente; el navegador no manda ninguna, así que el pase de lista por cámara **sí funciona** con el
  reloj simulado (sin reloj de demostración se usa la del cliente o la real). Como `svc_crear_captura` es idempotente por (cámara,
  `marca_tiempo`), con el reloj **detenido** todas las muestras llevan la misma marca y solo la primera cuenta: para pasar lista
  por cámara hay que pulsar `Correr` (ver «Modos»). El pase manual no depende de esto.
- Saltos relativos de hasta una semana (`fijar` para ir más lejos); solo años 2000–2099.
- La zona es fija (`-06`, sede de Chiapas sin horario de verano). `fijar` interpreta la hora en esa zona; no hay selector de zona.
- Lo que se ejecuta fuera de Next con `scripts/db-psql.sh` o `scripts/test-sql.sh` **no** ve este reloj (no pasa por
  `ejecutarRpc`); las pruebas SQL siguen fijando su propio `app.fake_now`.
- Cualquier usuario con sesión puede moverlo (incluido un alumno): es una herramienta de demostración, no de administración.
  Mover el reloj afecta a todas las sesiones abiertas a la vez (es un único estado compartido).

## Piezas

| Pieza | Ruta |
|---|---|
| Estado, formato y límites | `web/src/lib/local/reloj.js` (+ `reloj.test.js`, `reloj.rpc.test.js` contra la BD local) |
| Lectura por RPC | `web/src/lib/local/rpc.js` (`valorRelojSql()`) |
| Handler | `web/src/app/api/_local/handlers/reloj.js` (+ `reloj.test.js`); ruta `web/src/app/api/%5Flocal/reloj/route.js` |
| Cliente del navegador | `web/src/lib/local/relojCliente.js` |
| Evento de recarga | `web/src/hooks/data/eventos.js`, escuchado en `useApiQuery.js` |
| Tarjeta | `web/src/components/layout/RelojDemo/` (se monta con `<RelojDemo />`) |
