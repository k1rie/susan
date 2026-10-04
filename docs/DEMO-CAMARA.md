# Cámara simulada: pasar lista con rostros de prueba (solo desarrollo local)

Una cámara web real **no produce los rostros sintéticos** que reconoce el servicio de reconocimiento en el modo local
(`EMBEDDER=fake`: un «rostro» es un cuadrado de color con marco magenta, ver [`DEMO.md`](DEMO.md) §6). Por eso, sin ayuda, el pase
de lista automático **no se puede probar** en una máquina de desarrollo. La **cámara simulada** dibuja a tus alumnos con esos
rostros, los manda por la misma ruta de captura que la cámara real (`POST /api/sesiones/{id}/captura`) y deja ver todo el proceso:
quién se reconoce, cuándo pasa a Presente o Retardo, qué queda pendiente y cómo se cierra.

> **Solo con el embedder `fake`.** Con `scripts/dev-modo.sh insightface` (rostros reales con tu webcam, [`DEMO.md` §9](DEMO.md#9-probar-con-tu-rostro-real-insightface))
> el simulador no funciona: dibuja rostros sintéticos que InsightFace no detecta. La pantalla no detecta el modo; vuelve con `scripts/dev-modo.sh fake`.

Esta guía es el recorrido exacto con el simulador. Los datos de prueba, las cuentas y cómo repetir todo están en
[`DEMO.md`](DEMO.md); la hora, en [`DEMO-RELOJ.md`](DEMO-RELOJ.md).

## Cuándo aparece (y cuándo nunca)

La tarjeta **«Cámara simulada (demostración)»** vive dentro del panel de pase de lista y se pinta **solo si** `api_ahora()` informa
`reloj_simulado: true`. Esa bandera solo es verdadera con `LOCAL_FAKE_NOW` definido **y** la base con
`app.allow_fake_clock = 'on'`, que únicamente crean los scripts locales (nunca Supabase real). En producción:

- la tarjeta no existe en el DOM y el interruptor no se puede accionar ni por código (el hook no hace nada si `habilitado` es falso);
- nunca se llama a `/api/_local/reloj` (que además responde 404 fuera del modo local);
- el panel usa solo la cámara real o las cámaras IP.

Tampoco aparece disponible si el aula no tiene una **cámara de navegador activa**: el servidor no admite una imagen subida para una
cámara IP (`VALIDACION`), así que el interruptor queda deshabilitado y la tarjeta lo explica.

## Antes de empezar

```bash
scripts/dev-all.sh               # PostgreSQL, servicio de reconocimiento (EMBEDDER=fake) y web en http://localhost:3000
scripts/seed-demo.sh --reset     # plantillas faciales de los 75 alumnos y la sesión 19 (3A, hoy 07:00) en «programada», reloj en 07:12
```

La cuenta es `docente1@susan.local` (contraseña de desarrollo en el `README.md`). El 3A tiene **24 alumnos activos** (E260025 está en
baja y no aparece ante la cámara). No hace falta tocar el reloj a mano: el simulador lo prepara (ver «Qué hace con el reloj»).

## Recorrido exacto: «Todos llegan a tiempo»

1. Entra como `docente1@` y pulsa **Pasar lista** (riel lateral, botón central de la barra inferior en el móvil o tarjeta de arriba
   del panel). La sesión de las 07:00 del 3A se abre y llegas a `/docente/sesiones/19?pasar-lista=1`.
   Si no se abrió sola, la pantalla muestra la tarjeta **«Abrir sesión y pasar lista»**: pulsa ese único botón.
2. Verás arriba el título **Pasar lista** (materia y grupo, hora, aula y los chips «Abierta» y «Automático»), la **guía de 3 pasos**
   (puedes ocultarla con la X) y, justo debajo, el **panel de pase de lista**: la vista de cámara con el chip **«En pausa»**
   (la webcam espera permiso; no hace falta darlo), la cifra **«0 de 24 presentes»** y los botones **Cerrar pase de lista**
   (deshabilitado, con los minutos que faltan) y **Registrar manualmente**.
3. Baja al final del panel: la tarjeta **Cámara simulada (demostración)** con el distintivo «Solo desarrollo». Déjala como está
   (escenario «Todos llegan a tiempo», «Detener después de 5 ciclos», visitante y «Empezar en el minuto 2» marcados) y **activa el
   interruptor**.
4. Pasa esto, en este orden:
   - La tarjeta dice «Preparando el reloj de demostración…» (un segundo). Con el reloj de partida, un aviso azul cuenta lo que hizo:
     *«El reloj de demostración estaba detenido: lo pusimos en marcha… Reloj puesto en el minuto 2 de la clase (07:02)…»*. En la
     pantalla de la sesión el «minuto de la clase» ya es el 2, y la tarjeta del reloj de arriba muestra al instante 07:02 y «en marcha».
   - La webcam se apaga: en su lugar, la vista de cámara muestra el **lienzo simulado** (fondo gris con 24 cuadrados de color con
     marco magenta y las iniciales de cada alumno debajo) y el chip de arriba a la derecha dice **«Cámara simulada»**. El chip de
     la izquierda pasa a **«Reconociendo»**.
   - Sale el 1.er fotograma. «Última captura: **24 rostros · 24 válidos** · +24 registros · hace N s» (los «registros» son los alumnos
     que se crearon o se confirmaron con esa captura: el 2.º fotograma no suma ninguno). En la tabla de abajo, los alumnos pasan a
     **Pendiente** con lecturas **1/3** (los números del monitor se refrescan cada 5 s).
   - 2.º fotograma (~10 s): 25 rostros (apareció un **visitante**, rótulo «Visita»): «25 rostros · 24 válidos». Lecturas **2/3**.
   - **3.er fotograma (~20 s)**: lecturas **3/3** («+24 registros»). Todos pasan a **Presente**; la cifra grande dice **«24 de 24 presentes»**, las
     cuatro tarjetas de arriba se actualizan (Presentes 24, Sin registro 0) y el anillo se llena.
   - Los fotogramas 4.º y 5.º suman lecturas (el 5.º trae otro visitante). Después, la tarjeta dice **«Simulación completa:
     5 ciclos enviados»** y el chip pasa a «En pausa» (ya no se mandan fotogramas).
5. **Cerrar.** La tolerancia (20 min) todavía no termina: en la tarjeta del reloj pulsa **`+30 min`**. El chip pasa a **«Fuera de la
   ventana»**, el botón **Cerrar pase de lista** se habilita («La tolerancia terminó: ya puedes cerrar»). Púlsalo y confirma.
6. La pantalla pasa al **resumen de la sesión cerrada**: Presentes 24, ausentes 0. Para volver a empezar:
   `scripts/seed-demo.sh --reset`.

## Escenarios

Los tres usan los **mismos rostros** que en el registro de cada alumno (`semillaDeAlumno(id_alumno)`), así que el servicio los
reconoce con score 1.0. Todo es **determinista**: el fotograma sale del número de ciclo, el escenario y los ids; repetir el
escenario da exactamente lo mismo. Con 24 alumnos (ordenados por id):

| Escenario | Qué dibuja | Qué verás | Cómo cerrar |
|---|---|---|---|
| **Todos llegan a tiempo** | Los 24 en cada ciclo, desde el primero. | ~20 s: 24 Presentes. | `+30 min` y cerrar: 0 ausentes, 0 pendientes. |
| **Llegan escalonados** | Un tercio por ciclo (índice `% 3`): 8 en el 1.er fotograma, 16 en el 2.º, 24 desde el 3.º. **Adelanta el reloj 4 min antes de cada ciclo** (salvo el primero): 07:02 → 07:06 → 07:10 → 07:14 → 07:18. | Tanda 1 confirma al 3.er fotograma (~20 s); tanda 2 al 4.º (~30 s); tanda 3 al 5.º (~40 s). Las tandas 1 y 2 quedan **Presente** (su 1.ª lectura cayó antes del minuto 10) y la **tanda 3 queda Retardo** (su 1.ª lectura fue en el minuto ~10,3). Resultado: 16 Presentes · 8 Retardos. | Termina en el minuto ~18; `+5 min` pasa los 20 y habilita el cierre. |
| **Casos dudosos** | Casi todos en cada ciclo, pero 1 de cada 6 solo aparece en el **1.er** fotograma (índices 3, 9, 15, 21) y otro de cada 6 solo en los **2 primeros** (5, 11, 17, 23). | ~20 s: 16 Presentes. Los otros 8 se quedan en lecturas **1/3** o **2/3**, sin confirmar. | `+30 min` y cerrar: **8 quedan Pendientes de revisión** (no ausentes). Ver «Casos dudosos en Revisión». |

El **visitante** (casilla «Que pase un visitante de vez en cuando») pasa en los fotogramas 2.º, 5.º, 8.º… Sube el total de
rostros pero el servicio no lo atribuye a nadie: es la prueba de que un rostro ajeno **no cuenta** (`rostros` > `válidos`).

Si cambias de escenario con la simulación encendida, los ciclos **se reinician desde 0**; las lecturas que el servidor ya guardó no se
borran. Para probar un escenario limpio: `scripts/seed-demo.sh --reset` y elige el escenario **antes** de activar el interruptor.

### Controles de la tarjeta

| Control | Qué hace |
|---|---|
| Interruptor «Cámara simulada (demostración)» | Activa o apaga la simulación (apagada, vuelve la cámara real). |
| Escenario | Los tres de arriba. |
| Detener después de | 3, 5, 8, 12 ciclos o «Sin límite». Al llegar, no se envían más fotogramas y la tarjeta dice «Simulación completa». Con 5 (por omisión) alcanza para todos los escenarios. |
| Visitante | Incluye o quita al rostro ajeno. |
| Empezar en el minuto 2 de la clase | Ver abajo. Se fija antes de activar. |
| Reiniciar ciclos | Vuelve al fotograma 1 del escenario (sin borrar lo ya guardado). |

La línea de estado de la tarjeta (se anuncia con `aria-live`) dice cuántos ciclos van y qué traerá el siguiente fotograma.

## Qué hace con el reloj

Al **activar** el interruptor, y **antes de mandar el primer fotograma**, el simulador deja el reloj de demostración listo:

1. **Lo pone en marcha** si estaba detenido. Con el reloj detenido todas las capturas llevarían la misma hora y, como
   `svc_crear_captura` es idempotente por (cámara, hora), solo contaría la primera (ver `DEMO-RELOJ.md`, «Modos»). El servidor
   estampa cada captura con la hora de negocio (`web/src/lib/server/captura.js`); el navegador **ya no manda la hora del equipo**.
2. **Lo lleva al minuto 2 de la clase (07:02)** si hace falta: siempre en «Llegan escalonados», y en los demás solo si la clase aún no
   empieza o ya no queda margen para que la 1.ª lectura sea antes del minuto 10 (con el reloj de partida, 07:12, todos habrían
   salido **Retardo**: el estado lo decide la **primera** lectura válida). Si quieres ver Retardo a propósito, desmarca «Empezar en el
   minuto 2» y deja el reloj donde esté.

Ambos cambios se anuncian en un aviso azul de la tarjeta y se propagan a la pantalla (evento `susan:reloj-cambio`: el monitor vuelve a
pedir sus datos). Apagar el simulador **no** detiene el reloj: usa `Pausar` en su tarjeta. Si dejas el reloj corriendo más de 20 min
desde el inicio de la clase, la tolerancia termina sola, como en la vida real.

## Cuánto tarda y por qué 9 s y no 5 s

La sesión muestrea cada `intervalo_muestreo_seg` = 15 s. Con la cámara simulada el cliente acorta el ritmo a **9 s** para que la
demostración dure segundos, no minutos. No puede bajar a 5 s: el servidor deja pasar **una captura por cámara cada ≥ intervalo/2**
(`web/src/lib/server/rateLimit.js`: 7,5 s con 15 s, medido con el **reloj real** del servidor) y respondería `429`
(`DEMASIADOS_INTENTOS`) a cada segunda captura. El mínimo seguro es intervalo/2 + 1 s de holgura para la latencia del reconocimiento:
`intervaloDemoSeg(15) = 9` (`simuladorCamara.utils.js`). Si el servidor aun así responde 429, el panel lo anota en una línea discreta
(«El servidor pidió espaciar las capturas…») y el siguiente ciclo sale bien; no hay alerta ni aviso emergente.

| Fotograma | Segundo aproximado | Qué pasa (a tiempo) |
|---|---|---|
| 1.º | 0 | Lecturas 1/3, Pendiente |
| 2.º | ~10 | 2/3 (+ visitante) |
| 3.º | ~20 | 3/3: **Presente** |
| 4.º, 5.º | ~30, ~40 | Más lecturas; fin de la simulación |

El «~» incluye lo que tarda el reconocimiento (1–2 s por fotograma). Las cifras del monitor tardan hasta 5 s más (sondeo).

## Cómo avanzar el reloj

Con la tarjeta **Reloj de demostración** (arriba de cada pantalla): `+5 min`, `+10 min`, `+30 min`, `Correr`/`Pausar`,
`Restablecer` (07:12 detenido) y `Fijar hora` (p. ej. `2026-09-14 07:02`). Detalle y API en `DEMO-RELOJ.md`. Las reglas que importan
aquí: Presente hasta el minuto 10, Retardo hasta el 20, y a partir de las 07:20 las capturas responden `FUERA_DE_VENTANA` (el panel
se detiene solo y se habilita el cierre). **No pases de las 08:00**: un trabajo del sistema cierra por su cuenta las sesiones cuya hora
de fin ya pasó.

> Cada cambio que hace el simulador (poner el reloj en marcha, fijarlo en el minuto 2, adelantarlo en «Llegan escalonados») se anuncia
> con el evento `susan:reloj-cambio`: el monitor vuelve a pedir sus datos y la tarjeta del reloj adopta al instante la hora que trae
> el evento. Además la tarjeta se vuelve a leer sola cada 20 s, por si el reloj cambió desde otra pestaña.

## Casos dudosos en Revisión

1. Elige **«Casos dudosos»**, activa el interruptor y espera a «Simulación completa» (~45 s). En la tabla, 16 alumnos están en
   **Presente** y 8 se quedaron en lecturas 1/3 o 2/3 (estado Pendiente, sin confirmar).
2. En la tarjeta del reloj pulsa `+30 min` (pasa de las 07:20) y en el panel **Cerrar pase de lista** → confirma. El mensaje dice
   «0 ausentes creados, 8 pendientes»: quien tiene 1 o 2 lecturas **no es ausente**, queda **pendiente de revisión** (RN-07).
3. En el resumen de la sesión cerrada aparece la tarjeta **«Pendientes»** (8, con la nota «Resolver en Revisión»); pulsa para ir a
   `/docente/revision?pestana=pendientes` (o entra por **Revisión** en el riel).
4. Cada pendiente trae sus lecturas (con el recorte del rostro, su hora y el minuto de la clase) y un estado **sugerido** según la 1.ª
   lectura (minuto 2 → Presente). Resuélvelo con un clic: **Presente / Retardo / Ausente**. El plazo es de 48 h desde `hora_fin` (RN-08).
5. Se mezclan con los 8 pendientes que trae la semilla (clases de reposición del 12 y 13 de septiembre, ver `DEMO.md` §3): los de
   esta sesión son los del 14-sep, minuto 2.

## Avisos que puedes ver

| Aviso | Qué significa | Qué hacer |
|---|---|---|
| «Las capturas no suman» (amarillo, solo con reloj simulado) | El servidor ya tenía esas capturas: el reloj está detenido y todas llevan la misma hora. | **Poner en marcha el reloj** (botón del aviso) o `Correr`. |
| «La hora de la captura no es válida» | El servidor rechazó la captura con `MARCA_FUTURA` (la hora con la que se estampó va más de 5 min adelantada respecto a la de la base) u otro error de hora. **El muestreo se detiene** (un solo aviso, sin reintento en bucle ni avisos repetidos). | `Restablecer` o `Correr` en la tarjeta del reloj: al cambiar el reloj se reintenta solo; o el botón **Reintentar**. |
| «Reconocimiento no disponible» | El servicio de reconocimiento no responde (503). | `scripts/dev-all.sh`; mientras, **Registrar manualmente**. Se reintenta en cada ciclo. |
| «Muestreo detenido (FUERA_DE_VENTANA)» | Terminó la tolerancia: ya no se toman capturas. | Normal; cierra la sesión. Si el reloj vuelve a un minuto dentro de la ventana (`Restablecer` o `Fijar hora`), el panel retoma el muestreo y el aviso desaparece. |
| «No se pudo preparar el reloj de demostración (…)» | La ruta del reloj falló al activar. | Revisa que el reloj esté activo (`scripts/dev-all.sh`) y usa `Correr`. |
| Chip **«Fuera de la ventana»** | La sesión ya pasó su tolerancia. | `Fijar hora` antes de las 07:20 si quieres seguir capturando, o cierra. |

## Sin acceso a la cámara (el mensaje real)

Si la cámara del dispositivo falla (permiso negado, sin cámara, página no segura), el panel muestra **«No se pudo usar la cámara de
este dispositivo»** con las salidas que existen: **Reintentar con la cámara**, **Seguir con las cámaras IP del aula** (si las hay),
**Registrar manualmente** y —solo con el reloj simulado— **Usar la cámara simulada**.

## Cómo está hecho (para quien toque el código)

| Pieza | Ruta |
|---|---|
| Tarjeta de controles (presentacional) | `web/src/components/sesion/SimuladorCamara/SimuladorCamara.jsx` |
| Estado, reloj y envío (`capturar()` → Blob JPEG) | `.../SimuladorCamara/useSimuladorCamara.js` |
| Escenarios, reparto, dibujo, textos (funciones puras) | `.../SimuladorCamara/simuladorCamara.utils.js` |
| Lienzo (vista previa y fotograma) | `.../LienzoSimulado/` |
| Panel que lo integra | `.../CapturaContinua/CapturaContinua.jsx` |
| Bucle de muestreo y manejo de errores | `.../CapturaContinua/useMuestreoSesion.js` |
| Semillas y geometría del rostro (no se editan aquí) | `web/src/lib/demo/semillas.js`, `rostro.js` |

El lienzo mide 960 × 540. Cada rostro es el cuadrado de `rectangulosDeRostro(semilla, …)` (marco magenta de 4 px y el interior con
`colorDeSemilla`), con el lado más grande en que caben todos (88 px con 24 alumnos y un visitante; nunca menos de 40 px, el detector exige ≥ 24).
Los rótulos van **debajo** del cuadrado, nunca sobre el marco. El fondo es gris con ruido reproducible (`rellenarRuido`: 128 ± 6, sin
`Math.random`). Se envía como JPEG de calidad 0,92 con `canvas.toBlob`. El mismo lienzo es la vista previa del panel, así que lo que ves
es lo que recibe el servidor.

Verificación: los fotogramas se generaron fuera del navegador para los tres escenarios (24 alumnos, con y sin visitante), se
comprimieron como JPEG (calidad 92 y 75) y se pasaron por `FakeEmbedder.detect`: **todos los rostros se detectaron y cada vector
coincidió con el de su semilla (coseno > 0,99)**.

Pruebas: `cd web && npx vitest run src/components/sesion`.

## Límites

- Solo simula la **cámara del navegador**; las cámaras IP siguen su camino normal (el servidor jala su instantánea).
- Una sesión **manual** (sin cámaras activas) no admite capturas: no hay simulador para ella (el pase manual se prueba a mano).
- Los alumnos sin consentimiento vigente o sin plantilla (con `--reset` no hay ninguno) salen en el fotograma como rostros «sin
  atribuir»: es el caso para probar el **Registrar manualmente**.
- Es solo la hora de negocio de PostgreSQL: no simula el reloj del navegador ni el limitador de capturas (que usa el reloj real).
