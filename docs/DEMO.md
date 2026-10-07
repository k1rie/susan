# Cómo probar SUSAN (guía de demostración)

Datos de prueba completos y reiniciables para recorrer SUSAN de punta a punta en el **modo local**, sin Docker ni Supabase.
Todo es ficticio y existe solo en la base y el almacenamiento locales: los scripts se niegan a correr contra otra base
(exigen el reloj de demostración habilitado, que solo crean los scripts locales) y las rutas `/api/_local/*` responden 404 en
producción.

```bash
scripts/dev-all.sh               # 1. levanta PostgreSQL, el servicio de reconocimiento y la web (http://localhost:3000)
scripts/seed-demo.sh             # 2. datos de prueba: consentimientos, plantillas, índice facial y casos de revisión (~15 s)
scripts/seed-demo.sh --reset     # 3. vuelve a empezar el escenario de hoy cuando quieras repetir la prueba
```

> **¿Quieres probar con tu propio rostro y una webcam real?** El modo por omisión usa rostros sintéticos. La guía para
> reconocer personas de verdad (InsightFace) está en la [§9](#9-probar-con-tu-rostro-real-insightface): se cambia con
> `scripts/dev-modo.sh insightface` y se vuelve con `scripts/dev-modo.sh fake`.

Las cuentas son las de siempre (`@susan.local`; la contraseña de desarrollo está en el `README.md`). El reloj de la demostración
está fijo en el **lunes 14-sep-2026, 07:12**; se mueve con la tarjeta «Reloj de demostración» (ver [`DEMO-RELOJ.md`](DEMO-RELOJ.md)). El detalle de la cámara simulada
(escenarios, cadencia, qué hace el servidor con cada fotograma) está en [`DEMO-CAMARA.md`](DEMO-CAMARA.md).

## 1. Qué trae

| Qué | Cuánto | Detalle |
|---|---|---|
| Alumnos con consentimiento vigente | 75 de 75 | La semilla trae uno revocado (E260005) y uno vencido (E260031): se les registra un consentimiento nuevo por la ruta real `POST /api/consentimientos`. El revocado anterior queda en su historial. |
| Plantilla facial activa e indexada | 75 de 75 | Foto sintética por alumno (ver §6), registrada con la RPC real `api_plantilla_registrar`. Ningún vector en tablas: solo `faiss_id`. |
| Índice FAISS en uso | `v003`, 75 vectores | Construido y activado por la ruta real `POST /api/indice/reconstruir` (como el técnico) y cargado en el servicio (`index_loaded = true`). Si detienes el servicio y lo levantas de nuevo (`scripts/dev-stop.sh` y `scripts/dev-all.sh`), el índice vuelve solo con esa versión. |
| Sesiones de hoy y mañana | 3 listas | Sesión **19**: 3A, hoy 07:00–08:00, automática (cámara del navegador del A-12). Sesión **115**: 5C, hoy 09:00–10:00, pase manual (el B-04 no tiene cámaras activas). Sesión **67**: 3B, mañana 15-sep 09:00 (docente2). Todas `programada`, sin registros. |
| Casos de revisión del docente1 | 8 pendientes + 4 justificantes | Dos clases de reposición cerradas del 3A (sáb 12 y dom 13 de sep) con detecciones y recortes de rostro coherentes (§3). |
| Documentos | PDF reales | Los consentimientos y justificantes que la semilla solo tenía como texto ahora existen en el almacenamiento: «Ver documento» abre un PDF de demostración. |
| Alumnos con aviso | 9 | Sin derecho a examen: E260014 (3A), E260064 y E260070 (5C), E260039 (3B). En el límite (9 de 9 faltas, conservan el derecho): E260001 y E260020 (3A). En baja: E260025 (3A), E260050 (3B), E260075 (5C) (§2). |
| Cámaras | A-12 frente (navegador) activa; A-12 fondo (IP) **mantenimiento**; B-04 sin cámaras activas | La IP `10.20.12.2` no existe en una máquina de desarrollo: activa, cada ciclo de muestreo esperaría 3 s y mostraría «cámara inalcanzable». El aula sigue siendo automática por la cámara del navegador. El técnico puede reactivarla desde `/tecnico` para ver ese error. |

## 2. Qué abrir con cada cuenta

| Cuenta | Abrir | Qué debe verse |
|---|---|---|
| `docente1@` | **Pasar lista** (riel lateral o tarjeta del panel; `/docente/pasar-lista`) | Las sesiones de hoy: 3A 07:00 (automática) y 5C 09:00 (manual). Con cámara: §4; pase manual del 5C: §4.3. |
| `docente1@` | **Revisión** (`/docente/revision`) | 8 pendientes, 4 justificantes por resolver y las correcciones. Detalle en §3. |
| `docente1@` | Panel (`/docente`), **Reportes**, **Analítica** | Alertas (5): E260014 y dos del 5C (E260064, E260070) sin derecho a examen; E260001 y E260020 «a una falta de perder el derecho». Analítica con tendencia, proyección y riesgo (la semilla trae deterioro, abandono, ausencias en viernes y retardos). |
| `docente2@` | Panel, Reportes, Analítica | Grupo 3B (24 inscritos), una alerta sin derecho a examen (E260039) y un justificante por resolver (E260045). Su sesión es la **67**, mañana 15-sep 09:00: con `Fijar hora` 2026-09-15 09:03 se abre con la cámara del navegador. |
| `docente3@` | Panel | Docente en licencia, sin grupos: estado vacío. |
| `e260001@` | **Mi asistencia** (`/alumno`) | **En el límite**: 9 de 9 faltas permitidas; una falta más le quita el derecho a examen (aviso). Si cierras la sesión de hoy sin que la cámara lo vea, pasa a «sin derecho a examen». |
| `e260014@` | `/alumno` | **Sin derecho a examen**: 14 faltas equivalentes, límite 9. |
| `e260025@` | `/alumno` | **Inscripción en baja**: historial solo hasta la sesión 8 (no pasa lista ni aparece como candidato de la cámara). |
| `e260016@` | `/alumno` | Justificante **pendiente** ya registrado (cita médica, falta del sábado 12). Prueba el formulario de «Justificar» con otra falta. |
| `e260007@` | `/alumno` | Un retardo del domingo 13 con justificante pendiente registrado por el docente. |
| `e260024@` | `/alumno` | Cuatro faltas justificadas y aprobadas (historial con justificantes resueltos). |
| `admin@` | `/admin` | Resumen del periodo (alumnos, grupos, sesiones, cámaras, consentimientos). `/admin/alumnos`: abre cualquier alumno y verás **Consentimiento vigente** (con documento) y **Plantilla facial activa**, indexada en `v003`, con «Ver foto». `/admin/bitacora`: cierres de sesión, consultas de recortes y fotos, correcciones y resoluciones de justificantes. Catálogos: grupos, aulas, materias, docentes, usuarios. |
| `tecnico@` | `/tecnico` | **Cámaras**: 4, con estatus, última captura y capturas de 24 h (las de la clase de reposición del domingo). **Parámetros**: 12 (umbral 0.85, mínimo 3 lecturas, límite de presente 10 min, tolerancia 20 min, intervalo 15 s…). **Índice facial**: `v003`, 75 vectores, «sincronizado», sin pendientes. |

## 3. Casos de la pantalla de Revisión (docente1)

Las dos clases de reposición se arman pasando por las mismas funciones que usa la aplicación (abrir sesión, crear captura,
registrar detecciones, cerrar), así que cada caso trae lecturas reales, con su cámara, hora, minuto de la clase, score y recorte.
El plazo para resolver es de 48 h desde `hora_fin` (RN-08): el del sábado vence **hoy a las 10:00** (quedan 2 h 48 min) y el del
domingo **mañana a las 10:00**. Si adelantas el reloj más allá, el caso pasa a «Plazo vencido».

| Clase | Alumno | Lecturas | Qué ilustra |
|---|---|---|---|
| Sáb 12 | E260003 | 2 válidas (min 2 y 8) | Sugerido **presente** |
| Sáb 12 | E260018 | 1 válida (min 5) | Sugerido **presente** con una sola lectura |
| Sáb 12 | E260012 | 2 válidas (min 11 y 14) | Sugerido **retardo** |
| Sáb 12 | E260008 | 1 válida (min 14) + 1 bajo el umbral (0.79) | Una lectura «No válida» junto a la válida |
| Dom 13 | E260002 | 2 válidas (min 2 y 5) | Sugerido **presente** |
| Dom 13 | E260015 | 1 válida en el segundo 599 (9:59) | **Límite de RN-03**: todavía presente |
| Dom 13 | E260021 | 1 válida en el segundo 600 (10:00) | **Límite de RN-03**: ya retardo |
| Dom 13 | E260009 | 1 válida (min 17) + 1 bajo el umbral (0.82) | Sugerido retardo |

Justificantes por resolver (pestaña **Justificantes**): E260020 (falta del 11-sep, la semilla), E260070 (5C, la semilla), E260016
(falta del sábado, lo registró el alumno) y E260007 (retardo del domingo, lo registró el docente). Cada uno trae su PDF.

Qué probar: resolver un pendiente con un clic (**Presente / Retardo / Ausente**, el sugerido va marcado), aprobar o rechazar un
justificante con su confirmación, abrir «Ver documento», y en **Correcciones** elegir una de las dos clases y corregir un registro
o registrar un justificante a nombre de un alumno. Cada apertura de un caso deja una fila `consulta` en la bitácora del
administrador (RF-19). Todo esto se deshace con `scripts/seed-demo.sh --reset` (los pendientes vuelven a estar pendientes, y los
justificantes pendientes de la semilla que hayas aprobado o rechazado vuelven a pendiente).

## 4. Recorrido completo: pase de lista con cámara

**Dónde se hace.** Con `docente1@`, en **Pasar lista** (riel lateral, debajo de Panel y Buscar, y la tarjeta principal del panel).
La sesión de hoy del 3A (07:00) es la que se abre con la cámara del navegador. Se entra también directo por
`/docente/pasar-lista?sesion=19`.

**Antes de empezar:** `scripts/seed-demo.sh --reset` (deja la sesión 19 en `programada`, sin registros, y el reloj en 07:12).

1. Entra como `docente1@susan.local` y abre **Pasar lista**.
2. **No hace falta tocar el reloj.** Con la hora de partida (07:12) la única sesión que se puede abrir es la del 3A, y la cámara
   simulada deja el reloj en su sitio sola (paso 4). La tarjeta «Reloj de demostración» (arriba de cada pantalla: `Fijar hora`,
   `Correr`, `+5`, `+10`, `+30 min`) queda como alternativa manual y para las pantallas de otros días.
3. **Se abre la sesión.** Pasar lista abre la del 3A por ti (en el panel, el botón de la tarjeta se llama «Abrir y pasar lista»). Como
   el aula A-12 tiene la cámara del navegador activa, la sesión queda en modo **automático** y llegas al panel **«Pase de lista con
   cámara»**; al final trae la sección **«Cámara simulada (demostración)»** (solo con el reloj de demostración activo).
4. **Cámara.** Una webcam real **no produce los rostros sintéticos** que reconoce el embedder de demostración, así que se usa el
   simulador. En la sección «Cámara simulada (demostración)»:
   - Elige el **Escenario**: «Todos llegan a tiempo» (el recomendado), «Llegan escalonados» (para ver Presente y Retardo) o
     «Casos dudosos» (para ver Pendientes).
   - Deja **Detener después de** en 5 ciclos y marcada «Empezar en el minuto 2 de la clase».
   - Activa el interruptor (pasa de *Apagada* a *Activa*). SUSAN pone el reloj en marcha y, si hace falta, lo fija en 07:02 (un
     aviso lo dice), y manda un fotograma cada **9 s** (la mitad del intervalo de 15 s más 1 s, por el limitador del servidor) por
     `POST /api/sesiones/19/captura`, la misma ruta de la cámara real. El lienzo con los rostros —un cuadrado con marco magenta y un
     color plano que codifica `semillaDeAlumno(id_alumno)`, ver §6— es la vista previa y también lo que se envía; el detector del
     servicio lo ve como una cara y la reconoce contra las plantillas del índice.
   - Si falla la cámara real (por ejemplo, sin permiso del navegador), el aviso «No se pudo usar la cámara de este dispositivo» trae el
     botón «Usar la cámara simulada», que enciende lo mismo.
   - Sin interfaz, la alternativa por terminal de §4.1 envía exactamente los mismos fotogramas por la misma ruta.
5. **Qué debe verse en el monitor.** Tras cada captura, los alumnos que aparecen ante la cámara pasan a **pendiente** (1.ª y 2.ª
   lectura válida) y, con la **3.ª lectura en capturas distintas** (`min_detecciones_validas = 3`, unos 20 s: 3 capturas, una cada
   9 s; el texto de la propia sección lo repite), se confirman como **presente** o **retardo**: el estado lo decide la **primera**
   lectura (antes del minuto 10, presente). Los rostros que nadie reclama aparecen como «sin atribuir» (el visitante, una persona
   ajena, o un alumno sin consentimiento vigente).
6. **Variantes.** Elige el escenario «Llegan escalonados»: el simulador adelanta el reloj 4 min antes de cada ciclo y la tercera
   tanda entra como **retardo** (las otras dos, como presente). «Casos dudosos» deja alumnos con 1 o 2 lecturas, que al cerrar pasan a
   Revisión. Al completar los ciclos aparece «Simulación completa» y **Reiniciar ciclos** los repite. Después de las **07:20**
   (tolerancia terminada) el muestreo se detiene solo (`FUERA_DE_VENTANA`, por ejemplo con «Sin límite» de ciclos) y se habilita
   **Cerrar pase de lista** (en el paso 3, *Revisar y cerrar*); para llegar ahí sin esperar, usa `+10 min` o `+30 min` en la tarjeta del reloj.
7. **Cerrar la sesión** (confirma en el diálogo). Los alumnos sin registro se marcan **ausente**; quien se quedó con 1 o 2 lecturas
   queda **pendiente** y pasa a Revisión. El grupo se recalcula (RN-10, RN-11): si **E260001 no apareció**, queda con 10 faltas y
   **pierde el derecho a examen** (aviso en el panel y en su `/alumno`).
8. Para repetir todo: `scripts/seed-demo.sh --reset` (borra capturas, detecciones, asistencias y recortes de la sesión, la deja
   en `programada` y restablece el reloj), o **Reiniciar ciclos** para repetir el muestreo sin tocar la base (las lecturas ya
   guardadas no se borran). Con `scripts/seed-demo.sh --abierta` la deja **abierta** y sin registros, lista para capturar.

### 4.1. Sin interfaz: simular la cámara desde la terminal

```bash
scripts/seed-demo.sh --abierta                                                # sesión 19 abierta y sin registros
scripts/seed-demo.sh --captura --alumnos 1-18 --veces 4 --cada 8 --minuto 2   # 18 alumnos + 1 ajeno, 4 fotogramas, presentes
scripts/seed-demo.sh --captura --alumnos 1-18,20 --extranos 2                 # un fotograma más, con otro grupo de rostros
scripts/seed-demo.sh --captura --help                                         # todas las opciones
```

Tras `--abierta` el reloj marca 07:12 y todos quedan en **retardo**. Para ver **presentes** agrega `--minuto 2` a la primera
ejecución (fija el reloj en 07:02 y lo echa a andar), o usa la tarjeta «Fijar hora» o
`POST /api/_local/reloj {"fijar":"2026-09-14 07:02"}`. Con `--minuto 12` salen retardos a propósito.

`--alumnos` son ordinales del grupo (1 = primer alumno por matrícula). El script entra como el docente titular, dibuja el
fotograma con los rostros sintéticos y lo manda a `POST /api/sesiones/{id}/captura`. Con el reloj detenido, lo echa a andar si pides
varios fotogramas (`--veces`) o `--minuto` (equivale a `Correr`); con un solo fotograma y el reloj detenido, repetir el comando no
registra nada (el script lo avisa). Imprime por fotograma: rostros, reconocidos, sin atribuir, marca de tiempo y los cambios de estado.

### 4.2. Privacidad: un alumno sin consentimiento (RNF-06)

Con `admin@`, abre `/admin/alumnos/5` (E260005) y **revoca** su consentimiento: la plantilla se archiva y el índice se reconstruye
solo (verás una versión nueva en `/tecnico`). Con la sesión abierta, manda un fotograma que lo incluya
(`scripts/seed-demo.sh --captura --alumnos 1-10`): E260005 deja de ser candidato del reconocimiento (24 candidatos pasan a 23), su
rostro sale **sin atribuir** y al cerrar la sesión queda **ausente**. Para devolverle consentimiento y plantilla basta
`scripts/seed-demo.sh` (registra un consentimiento nuevo, una plantilla nueva y reconstruye el índice; la versión en uso deja de
ser `v003`).

### 4.2b. Autoservicio: el alumno acepta el aviso y registra su propio rostro

El administrador ya no tiene que capturar todo: el alumno lo hace desde **Mi registro facial** (`/alumno/registro`; en el riel, bajo «Mi cuenta», y como recordatorio en `/alumno` mientras esté incompleto).
Detalle del diseño en [`docs/api/biometria.md`](api/biometria.md) §7 y [`DECISIONS.md`](DECISIONS.md) §9.

1. Entra con `e260001@` → **Mi registro facial**. Como la semilla le dejó el consentimiento que registró el administrador, verás «Tu rostro está registrado» y «Lo registró tu coordinación».
2. **Revocar consentimiento** (con confirmación): la plantilla se archiva y el índice se reconstruye solo. La pantalla vuelve al paso 1 y en `/alumno` aparece el recordatorio «Completa tu registro facial».
3. Marca la declaración y **Aceptar y continuar**. Queda como consentimiento de origen *alumno* (vigente 12 meses) y el sistema genera la **constancia PDF** (nombre, matrícula, fecha, IP, versión del aviso y huella SHA-256 del texto):
   `$SUSAN_LOCAL_DIR/storage/susan-private/consentimientos/<id_alumno>/<uuid>.pdf`. En `/admin/bitacora` aparecen `alta_consentimiento` y `revocacion_consentimiento`, con usuario, IP y origen.
4. **Registrar mi rostro** abre el asistente guiado en modo *propio*: solo cámara (sin «Subir fotos») y textos en segunda persona.

> **Con el embedder `fake` la webcam no sirve para el paso 4** (no produce los rostros sintéticos que reconoce el servicio). Dos salidas: (a) `scripts/dev-modo.sh insightface` y repetir con tu cara real (§9), o
> (b) `scripts/seed-demo.sh --autoservicio`, que ejerce de punta a punta las rutas `/api/yo/*` con rostros sintéticos y comprueba: aceptar el aviso, verificar tomas, **rechazo de la cara de otro alumno**
> (`ROSTRO_YA_REGISTRADO`, sin guardar nada y sin revelar de quién es), registro con origen *alumno* e indexado, el segundo alumno **no** puede registrar esa cara, un docente recibe 403 y el cuerpo no admite `id_alumno`.
> Opciones: `--alumno E260003 --otro E260004`. Deja al alumno con una cara sintética registrada por él mismo.

El candado de 5 registros por 24 h usa el reloj de negocio: con el reloj de demostración **detenido** se agota tras 5 registros del mismo alumno (`AUTOREGISTRO_LIMITE`); adelanta el reloj un día con
la tarjeta «Reloj de demostración» (**Fijar hora**) para volver a probar.

### 4.3. Pase manual (5C, sesión 115)

El 5C (aula B-04, sin cámaras activas) se abre solo de 09:00 a 10:00; con el reloj en 07:12 «Abrir sesión» responde
`FUERA_DE_HORARIO` y `/docente/pasar-lista` solo ofrece el 3A.

1. Con `docente1@`, en la tarjeta «Reloj de demostración» pulsa `Fijar hora` y elige 14-sep-2026 09:05 (el reloj puede quedar
   detenido: el pase manual no usa capturas).
2. Abre **Pasar lista**: la 115 es la única candidata (la 19 ya venció) y se abre sola en modo manual (la franja de pasos dice «Marcar alumnos»).
3. En la lista, toca el botón **Presente** de un alumno, **Retardo** el de otro y **Ausente** el de otro (un segundo toque lo
   desmarca; «Marcar restantes según la hora» llena el resto), y pulsa el botón secundario **Guardar** (avisa «3 registros (origen manual)»). Quien quede sin marcar será ausente al cerrar.
4. Lleva el reloj a las 09:20 o más (`+30 min` da 09:35): antes de eso el cierre responde `VENTANA_TOLERANCIA_ABIERTA`, porque la
   tolerancia es de 20 min; «Guardar y cerrar sesión de clase» antes de las 09:20 guarda pero muestra «No se pudo cerrar la sesión».
5. Con el reloj en 09:20 o más, pulsa **Guardar y cerrar sesión de clase**: los no marcados quedan ausentes (origen manual) y el
   grupo se recalcula (2 del 5C, E260064 y E260070, ya están sin derecho a examen).
6. Para repetir: `scripts/seed-demo.sh --reset` (deja la 115 programada y el reloj en 07:12).

## 5. Reiniciar y avanzar el reloj

| Quiero… | Comando |
|---|---|
| Asegurar que todo está (no destruye lo hecho a mano) | `scripts/seed-demo.sh` |
| Repetir el flujo desde cero: sesión 19 `programada` sin registros, casos de revisión nuevos, reloj en 07:12 | `scripts/seed-demo.sh --reset` |
| Lo mismo, con la sesión 19 ya **abierta** | `scripts/seed-demo.sh --abierta` |
| Fotos sintéticas para subir a mano en el alta de plantilla | `scripts/seed-demo.sh --muestras` (quedan en `~/.susan-local/SUSAN/demo/rostros/E2600NN.jpg`) |
| Mover la hora (presente/retardo, fin de tolerancia, cierre, otro día) | Tarjeta «Reloj de demostración»; guía y API en [`DEMO-RELOJ.md`](DEMO-RELOJ.md) |
| Borrar TODO (catálogos, usuarios, parámetros, bitácora) y volver a la semilla | `scripts/dev-stop.sh && scripts/db-reset.sh && scripts/dev-all.sh && scripts/seed-demo.sh` |

`--reset` y `--abierta` limpian y rehacen: las sesiones de hoy y de mañana (19, 115, 67) y cualquier otra desde hoy que hayas
abierto o cerrado probando con el reloj adelantado; las dos clases de reposición con sus 8 pendientes y 2 justificantes; los
justificantes pendientes de la semilla que resolviste; el estatus de las cámaras; el derecho a examen (recalculado con las
reglas reales); y los recortes de rostro huérfanos del almacenamiento. **No** borran la bitácora (es de solo inserción por
diseño: las acciones de tus pruebas quedan asentadas), ni deshacen cambios en catálogos, usuarios o parámetros, ni correcciones
sobre clases antiguas de la semilla.

Sin opción, el script es idempotente: lo que ya existe se respeta (no vuelve a crear los casos de revisión si la clase de
reposición ya existe, aunque ya los hayas resuelto).

## 6. Cómo está hecho (para quien toque el código)

**Reconocimiento sintético.** El embedder `fake` (`recognition-service/app/embedders/fake.py`) no mira caras: una «cara» es un
cuadrado de al menos 24 px con un marco magenta (255, 0, 255) de 4 px y un interior de color plano que codifica una **semilla de
12 bits** (cada canal vale 64 + 8·n, n en 0..15). El vector sale de un hash de la semilla: la misma semilla da el mismo vector
(score 1.000) y semillas distintas dan vectores casi ortogonales (score ~0.5).

- `semillaDeAlumno(id_alumno)` en `web/src/lib/demo/semillas.js`: `(id_alumno · 37 + 11) mod 2048`. Es una biyección para ids
  1..2048 (ningún par de alumnos comparte semilla) y deja el canal R entre 64 y 120, lejos del magenta. La usan **el script de la
  semilla** (foto de registro y recortes) y **el simulador de cámara** (para que dibuje al alumno con la semilla con la que se
  registró). `semillaDeExtrano(n)` da semillas de personas ajenas (2048..3839) para rostros que nadie debe reclamar.
- `web/src/lib/demo/rostro.js`: la geometría exacta a pintar (`rectangulosDeRostro`, `posicionesDeRostros` para repartir varios
  rostros sin que se toquen, `cssRgb` para el lienzo). Sin importaciones ni DOM: sirve en el navegador y en pruebas.
- La foto de registro (`render_rostros.py`) agrega ojos, boca y una textura de tablero de ajedrez de ±4 niveles en el interior:
  la verificación de calidad (RF-15) exige nitidez y un interior plano la da casi en cero para ciertas semillas; el tablero la sube
  por encima de 1000 sin mover el color que el detector lee.

**Qué hace `seed-demo.sh`, en orden** (cada paso es idempotente): PDF reales en las rutas de la semilla → consentimiento vigente
para quien no lo tenga (`POST /api/consentimientos` como administrador) → plantillas (foto sintética, verificación de calidad del
servicio y `api_plantilla_registrar` como administrador) → índice (`POST /api/indice/reconstruir` como técnico y sincronización
con el servicio) → con `--reset`/`--abierta`, `scripts/demo/reset_hoy.sql` → clases de reposición y justificantes del guion
(`web/src/lib/demo/casos.js`) → `scripts/demo/limites.sql` (E260001 en el límite) → recortes y documentos faltantes → verificación
con conteos (sale con código 1 si algo falla).

| Archivo | Para qué |
|---|---|
| `scripts/seed-demo.sh` | Orquestador: levanta lo que falte (`dev-all.sh`), exporta el entorno y llama a Node. Se niega fuera del modo local. |
| `scripts/demo/seed-demo.mjs`, `lib.mjs` | Las fases de arriba y la verificación final. |
| `scripts/demo/captura.mjs` | Simulador de cámara por terminal (`--captura`). |
| `scripts/demo/render_rostros.py` | Dibuja los JPEG (usa el Python del venv de `recognition-service`). |
| `scripts/demo/reset_hoy.sql`, `limites.sql` | Reinicio del escenario de hoy y ajuste de E260001. |
| `web/src/lib/demo/*.js` (+ pruebas) | Semillas, geometría del rostro, guion de los casos, PDF mínimo y lista de ordinales de `--captura`. Funciones puras. |

Privacidad (RNF-03): las fotos sintéticas van al almacenamiento local como las reales; el índice lo construye el servicio. Ninguna
tabla guarda vectores ni imágenes, solo rutas y `faiss_id`.

## 7. Problemas conocidos y lo que NO se puede probar en local

- **Reconocimiento con rostros reales.** Con el embedder `fake` una webcam real no genera rostros que se reconozcan. Con
  **InsightFace** sí: está probado en local (detección de varias caras, plantilla de un rostro real, reconocimiento y calibración
  del umbral; mediciones en [`recognition-service/README.md`](../recognition-service/README.md)) y se activa con
  `scripts/dev-modo.sh insightface`. Pasos exactos en la [§9](#9-probar-con-tu-rostro-real-insightface). Lo que **no** se probó
  aquí: una webcam física del plantel, mucha gente a la vez (la verificación usó fotos de prueba de la propia librería) ni el
  comportamiento con 20 000 plantillas reales.
- **Cámara IP real.** No hay una en la red de desarrollo; la del A-12 está en mantenimiento a propósito (ver §1).
- **Reloj detenido y muestreo.** Con el reloj detenido, varios fotogramas comparten marca y solo cuenta el primero: usa `Correr`
  (o `--captura` con `--veces` mayor que 1 o con `--minuto`, que lo hace solo; la cámara simulada de la pantalla también). Con el reloj corriendo, la tolerancia de 20 min termina sola: `Pausar` o `Restablecer`.
- **Correos y Supabase real.** «Recuperar contraseña» responde igual pero no envía correo; Auth, Storage y sus políticas son
  stubs locales. Para probar contra Supabase de verdad, ver [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md).
- **Ids de las clases de reposición.** Cambian en cada `--reset` (se recrean); no los uses como referencia fija.
- **Bitácora.** Es de solo inserción: `--reset` no la limpia, así que verás las acciones de pruebas anteriores.
- **Ajuste de E260001.** Para dejarlo en el límite se convirtieron en `ausente` sus primeras presencias de la semilla (datos de
  demostración; `limites.sql`). No cambia a nadie más.
- **E260025 no es el «sin derecho a examen».** Es la inscripción en baja de la semilla; el que no tiene derecho es E260014.
  **E260020 también está en el límite** (9 de 9), por la semilla y no por `limites.sql`, que solo ajusta a E260001. Si el docente
  aprueba el justificante pendiente de E260020 (falta del 11-sep), puede dejar de estar en el límite.

## 8. Si algo no responde

| Síntoma | Qué hacer |
|---|---|
| `409 INDEX_NOT_LOADED` al capturar, o `index_loaded: false` en `http://127.0.0.1:8000/health` | `scripts/dev-all.sh` (carga el índice en un servicio que ya corre) o `/tecnico` → Índice facial → «Sincronizar servicio». Si detienes y levantas el servicio (`dev-stop.sh` y `dev-all.sh`), el índice vuelve solo. |
| `seed-demo.sh`: «Esta base no tiene habilitado el reloj de demostración» | No es la base local de desarrollo; el script no la toca. |
| `seed-demo.sh`: error HTTP al registrar consentimientos o reconstruir el índice | La web o el servicio no responden: `scripts/dev-all.sh`; registros en `~/.susan-local/SUSAN/run/*.log`. |
| «Abrir sesión» responde `FUERA_DE_HORARIO` | La hora del reloj no cae en el horario de esa sesión: 3A (sesión 19) de 07:00 a 08:00, 5C (sesión 115) de 09:00 a 10:00, ambas del 14-sep, y 3B (sesión 67) de 09:00 a 10:00 del 15-sep. Usa `Fijar hora` dentro del horario de la sesión (`Restablecer` solo sirve para la 19). |
| Las capturas responden `FUERA_DE_VENTANA` | Pasaron 20 min desde el inicio: `Fijar hora` antes de 07:20 o `scripts/seed-demo.sh --reset`. |
| «Las capturas no suman» (aviso en el panel de la cámara) | El reloj de demostración está detenido y todas las capturas llevan la misma hora: pulsa «Poner en marcha el reloj» (botón del propio panel) o `Correr` en la tarjeta del reloj. |
| Los rostros salen «sin atribuir» | El alumno no tiene consentimiento vigente o plantilla indexada (ver `/admin/alumnos/{id}`), o no es del grupo de la sesión. |

## 9. Probar con tu rostro real (InsightFace)

Para recorrer el pase de lista con **tu cara y la webcam de tu equipo**, el servicio de reconocimiento tiene que correr con el
embedder real en lugar del sintético. Es un modo **conmutable y reversible**; la web, PostgreSQL y los datos de la demostración no
se tocan al cambiarlo.

```bash
scripts/dev-modo.sh insightface   # rostros reales (InsightFace buffalo_s). La 1.ª vez baja ~120 MB de modelos (≈ 290 MB en disco)
scripts/dev-modo.sh estado        # modo, servicio, índice cargado, umbral vigente
scripts/dev-modo.sh fake          # vuelve a la demostración sintética (cámara simulada y los 75 alumnos de prueba)
```

El modo queda guardado en `~/.susan-local/SUSAN/run/embedder`: `scripts/dev-all.sh` lo respeta, así que reiniciar no te regresa a `fake`
sin querer (la variable `RECOGNITION_EMBEDDER=fake|insightface` tiene prioridad sobre el archivo). Los modelos se guardan en
`recognition-service/.models/`, que Git ignora.

**Qué deja de funcionar en modo InsightFace**

- La **cámara simulada** y `scripts/seed-demo.sh` (incluido `--reset`, `--abierta` y `--captura`): dibujan rostros sintéticos que
  InsightFace no ve. Los scripts se niegan con un mensaje que apunta a `scripts/dev-modo.sh fake`. (`--muestras` sí funciona: solo escribe archivos.)
- Los **75 alumnos sintéticos** siguen en el índice (versión conservada tal cual) pero nadie los «reconoce»: sus vectores son ruido
  frente a una cara real (score ≈ 0.55, muy por debajo del umbral). No estorban ni producen falsos positivos; para verlos reconocidos hay que volver a `fake`.
- **Reconstrucción completa** del índice (casilla en `/tecnico` → Índice facial): **no la marques**. Reprocesa todas las fotos y las
  75 fotos sintéticas no tienen rostro real, así que el servicio rechaza la construcción (todo o nada, no se escribe nada ni se activa). Además ahora cuesta
  N veces más con las plantillas de varias fotos (cada foto se vuelve a embeber). La reconstrucción normal (sin marcar) conserva los 75 vectores y solo agrega los nuevos.

**Licencia.** El código de InsightFace es MIT, pero los **modelos que descarga (`buffalo_s`) son solo para investigación y uso no
comercial**. Aceptable para esta prueba local con tu propio rostro; un despliegue real exige otra licencia o modelos propios.
Tu foto vive en el almacenamiento local (`~/.susan-local/SUSAN/storage/`), nunca sale de tu equipo; el vector del rostro solo
existe en memoria del servicio y en el JSON del índice (RNF-03).

**Umbral.** Con rostros reales ArcFace da coseno ≈ 0.4–0.7 entre fotos distintas de la misma persona y ≤ 0.2 entre personas
distintas, y SUSAN guarda `score = (coseno + 1) / 2`. El 0.850 original (coseno 0.70) es demasiado exigente, así que
`umbral_similitud` quedó en **0.700** (coseno 0.40), aplicado como técnico por la RPC `api_parametro_actualizar` (bitácora con
valor anterior y nuevo). La demostración `fake` sigue funcionando: sus coincidencias dan score 1.000 y las no coincidencias ≈ 0.54.
Para ajustarlo o volver al original: `tecnico@` → `/tecnico` → **Parámetros** → `umbral_similitud` → `0.850`.
Si tu cara no se reconoce y quedan lecturas con score entre 0.60 y 0.70 en Revisión, baja a 0.650 (no menos de 0.600: tu coseno con otra persona rara vez pasa de 0.25, score 0.62).

### 9.1. Recorrido exacto (admin → técnico → docente)

Si ya creaste tu alumno (por ejemplo la matrícula `TEST`, id 76, que hoy ya existe con consentimiento vigente hasta 2029), búscalo en
`/admin/alumnos` y sigue desde el paso 3 (desde el 2 si aún no tiene consentimiento vigente).

1. **`admin@susan.local`** → **Alumnos** → **Nuevo alumno**. Es un asistente de 3 pasos: identidad (matrícula única, p. ej. la tuya,
   apellidos y nombres), contacto y cuenta de acceso (opcional) y revisión. Pulsa **Crear alumno** y, en la pantalla de éxito,
   **Ir a la ficha**.
2. **Consentimiento** (en la ficha) → registrar: adjunta **cualquier PDF** como documento firmado y elige la **fecha de firma
   igual o anterior al 14-sep-2026** (el reloj de la demostración). El formulario deja elegir hasta la fecha real de tu equipo, pero
   la base valida contra el reloj de la demo: una firma posterior al 14-sep se rechaza con «La fecha de firma no puede ser
   futura». La **vigencia hasta** debe ser posterior a la firma y no anterior al 14-sep (p. ej. 14-sep-2027).
3. **Plantilla facial** (en la ficha). La plantilla se arma con **3 a 8 fotos** de la misma persona (5 guiadas): SUSAN promedia sus
   vectores en uno solo para reconocer mejor con distintos ángulos y luz. Dos modos:
   - **Usar cámara** (captura guiada, por defecto): pulsa **Capturar toma K de 5** en cada paso y sigue la indicación sobre la cámara:
     1) *De frente*, 2) *Gira a la izquierda* (unos 15 grados), 3) *Gira a la derecha*, 4) *Inclina hacia arriba* (la 4 y la 5 son
     opcionales) y 5) *Otra expresión o luz* (sonríe o cambia un poco la luz o el lugar). La indicación de izquierda y derecha asume la
     vista en espejo de la cámara. Con **Repetir** rehaces solo esa toma; las demás se conservan.
   - **Subir fotos**: **Agregar fotos (JPG)** y elige de 3 a 8 fotos distintas de tu cara. Cada foto debe ser JPG y pesar hasta 15 MB; SUSAN la re-codifica a ≈ 300 KB antes de enviarla.

   Una sola persona por toma, luz pareja, sin gorra ni lentes oscuros, rostro de al menos 80 px y nítido. Cada toma muestra su estado
   (*Verificando…*, *Aceptada* o el motivo: «No se detectó ningún rostro», «Hay más de un rostro», «Giraste demasiado; vuelve a mirar hacia
   la cámara», «Falta iluminación», «La imagen está borrosa»…). Si una toma sale **«No parece la misma persona»**, el servicio midió que se
   parece poco a las demás (o es de otra persona): **Repítela o quítala**; si salen **«Las tomas no coinciden entre sí»**, revisa que todas
   sean tuyas. Un aviso «Las tomas son casi idénticas; varía el ángulo, la expresión o la luz» no bloquea. El botón **Registrar plantilla con N
   fotos** se habilita con al menos 3 tomas aceptadas y ninguna marcada. Si tu cara no supera la consistencia aunque las fotos sean tuyas, queda
   la salida **Registrar solo con esta foto (menos precisa)** con una única toma aceptada. Al registrar, SUSAN **reconstruye el índice sola**
   (tarda hasta un minuto; no cierres la ventana): aparece una versión nueva (`v004`) con los 75 vectores de antes más el tuyo, y la ficha
   muestra "Fotos: N", la consistencia entre fotos y la plantilla como indexada. **Si ya tenías plantilla, registrar de nuevo la archiva**
   (RN-12): si el alumno ya tenía una plantilla (de una foto o de varias), quedará archivada y su lugar lo toma la nueva
   (las fotos viejas no se borran del almacenamiento). El alumno TEST (id 76) aún no tiene ninguna. Esta plantilla multifoto exige el modo **InsightFace** (con `fake` ningún rostro real se detecta).
4. **Grupo**: `/admin/grupos` → **3A** → pestaña **Inscripciones** → escribe tu matrícula (mínimo 2 caracteres) → **Buscar** → **Inscribir** (pasa de 24 a 25 alumnos; el aula A-12 admite 40).
5. **`tecnico@susan.local`** → `/tecnico` → **Índice facial**: en «Versión en uso» debe decir `v004` con 76 vectores, la insignia
   «Sincronizado con el servicio» y «Índice al día». Si dice «Requiere reconstrucción» o «Servicio desincronizado»: **Reconstruir
   índice** → en el diálogo **no marques** «Reconstrucción completa» → **Reconstruir**; el botón **Sincronizar servicio** solo
   aparece cuando la insignia dice «Servicio desincronizado». Desde la terminal, `scripts/dev-modo.sh estado` muestra el mismo
   dato (`GET /v1/index`).
6. **Antes de abrir la sesión, déjala limpia.** Mientras se preparó este modo, la sesión 19 quedó **abierta** con una captura
   vacía (0 rostros) de un intento anterior, a las 07:12. Para empezar de cero: `scripts/db-psql.sh -f scripts/demo/reset_hoy.sql`
   (la deja `programada`, sin capturas ni asistencias; no borra la bitácora ni tu alumno) y, en la tarjeta «Reloj de demostración»,
   **Restablecer**. (Si no la limpias, la sesión se puede seguir usando; la captura vacía no suma.)
7. **`docente1@susan.local`** → **Pasar lista** (sesión 19, 3A). Para que salgas **Presente** y no Retardo, usa antes la tarjeta
   «Reloj de demostración» → `Fijar hora` 14-sep-2026 **07:02** (a las 07:12 la primera lectura cuenta como retardo). Se abre la
   sesión en modo automático: deja marcada **«Usar la cámara de este dispositivo»**, concede el permiso de cámara al navegador y
   **no uses** la sección «Cámara simulada». El reloj debe correr (botón **Poner en marcha el reloj** si aparece «Las capturas no
   suman»). Mira a la cámara: se toma un fotograma cada 15 s y hacen falta **3 lecturas válidas en capturas distintas** (≈ 45 s) para
   pasar de Pendiente a **Presente**. El resto del 3A (alumnos sintéticos) saldrá «sin atribuir»/ausente al cerrar: es lo esperado.
8. Para repetir el pase de lista **sin salir de este modo**: `scripts/db-psql.sh -f scripts/demo/reset_hoy.sql` (deja la sesión 19
   en `programada`; `seed-demo.sh` no corre con InsightFace) y `Restablecer` en la tarjeta del reloj.

### 9.2. Volver al modo de prueba (y regresar)

`scripts/dev-modo.sh fake` y listo: el índice en uso (`v004`, con tu vector) se sigue cargando en modo `fake` (el servicio acepta
el modelo del otro modo al **leer** un índice, variable `INDEX_ACCEPT_MODELS`), así que no hay que reconstruir nada. En modo `fake` ya
puedes usar `scripts/seed-demo.sh --reset`, la cámara simulada y todo lo de §4; tu alumno y tu plantilla no se borran. Para volver:
`scripts/dev-modo.sh insightface` (instantáneo: los modelos ya están en disco). Para dejar el umbral como estaba: `0.850` en `/tecnico`.

### 9.3. Si algo falla

| Síntoma | Qué hacer |
|---|---|
| «No se detectó ningún rostro» al registrar la plantilla | Comprueba el modo: `scripts/dev-modo.sh estado` debe decir `embedder: insightface`. Con `fake` ningún rostro real se detecta (y la plantilla multifoto exige `insightface`). |
| «Algunas fotos no sirven: repite las tomas marcadas» (`FOTOS_RECHAZADAS`, 422) | Alguna toma no pasó calidad o consistencia y no se subió nada. Mira el estado de cada toma, repite o quita las marcadas y vuelve a registrar. Si tu cara no supera el filtro con fotos tuyas, usa **Registrar solo con esta foto (menos precisa)** o baja `TEMPLATE_OUTLIER_COSINE` a 0.30 en el servicio (`recognition-service/README.md`). |
| «Giraste demasiado; vuelve a mirar hacia la cámara» en una toma | El giro pasó de unos 36 grados (`TEMPLATE_MAX_YAW_RATIO`, 0.40). Repite la toma con un giro de unos 15 grados sin perder de vista la cámara. |
| «Hay fotos repetidas: usa tomas distintas» (`FOTOS_DUPLICADAS`, 422) o toma «Igual a la toma K» | Subiste dos archivos de bytes idénticos. Quita la copia o elige otra foto. |
| «Se necesitan al menos 3 fotos» (`FOTOS_INSUFICIENTES`, 422) | Faltan tomas aceptadas; el mínimo es 3 y el máximo 8. |
| `INDICE_CONSTRUCCION_FALLIDA` con `SIN_MUESTRAS_UTILIZABLES` en `details.errores` | Ninguna de las fotos de una plantilla es utilizable (objeto ausente, ilegible, sin rostro o con varios). Registra de nuevo esa plantilla (archiva la defectuosa) y reconstruye. |
| «La foto está desenfocada» con una foto buena | El umbral de nitidez (`MIN_SHARPNESS`, 40) mide la varianza del laplaciano y castiga las imágenes re-escaladas o muy suavizadas. Prueba con una foto directa de la cámara o reinicia el servicio con un umbral menor: `MIN_SHARPNESS=15 scripts/dev-modo.sh insightface --reiniciar` (la variable pasa al servicio; el reinicio normal con `dev-all.sh` vuelve a 40). |
| `INDICE_INVALIDO` (422) al reconstruir o sincronizar | El servicio no se reinició con `scripts/dev-modo.sh` (sin `INDEX_ACCEPT_MODELS`) y el índice trae vectores de otro modelo: `scripts/dev-modo.sh insightface` (o `fake`) lo reinicia bien. |
| `INDICE_CONSTRUCCION_FALLIDA` | Lo más probable: marcaste «Reconstrucción completa»; desmárcala (no se perdió nada, no se activó ninguna versión). Si no la marcaste, mira `details.errores` (ver la fila `SIN_MUESTRAS_UTILIZABLES`). |
| `index_loaded: false` | `/tecnico` → Índice facial → **Sincronizar servicio**, o `scripts/dev-modo.sh insightface`. |
| El servicio tarda al cambiar de modo la 1.ª vez | Descarga los modelos (~120 MB, 5–60 s según la red); `dev-modo.sh` muestra el progreso y avisa si no hay red o disco. |
