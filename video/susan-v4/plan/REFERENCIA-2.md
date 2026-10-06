# Referencia 2 (v4): el reel de running de levii.motion y cómo llevar su gramática a SUSAN

> **Fuente:** 7 capturas (`referencia/ref2-01…07`) del reel de Instagram «POV: You do your cardio and after effects»
> (levii.motion). Es una UI tipo Nike Run Club animada en After Effects y grabada con un teléfono mientras se reproducía en
> AE. **No son estilo:** los paneles de AE, la lista de capas, la línea de tiempo, la interfaz de Instagram, el texto
> «POV», la barra de estado, el **cursor de mano** (BRIEF: SIN CURSOR) ni los artefactos de grabar un monitor con un
> teléfono (moiré, el fleco rosa alrededor del verde en ref2-04, bloques de compresión).
> **Marcas de confianza:** **[O]** se ve en la captura · **[I]** se infiere · **[E]** se estima midiendo la captura
> (posiciones relativas al lienzo del comp, timecode del visor de AE, barra de progreso de Instagram). Los hex son
> aproximados: salen de la foto de un monitor, donde los blancos quedan ~10 % más oscuros.
> **Complementa** `plan/REFERENCIA.md` (reel 1, fintech, técnicas **T1–T15**) y `plan/LECCIONES-V3.md`. Aquí las técnicas se
> numeran **M1–M8** para no chocar con T1–T15.

---

## 0. Datos duros

### 0.1 El orden real es el inverso de los nombres de archivo

Los archivos van de `01` (lista) a `07` (icono), pero el reel ocurre **al revés**. Hay tres pruebas independientes que
coinciden:

| t en AE (30 fps) | Barra de IG | Captura | Qué hay en pantalla |
|---|---|---|---|
| ≈ 0.75 s (`0:00:00:2x`) | 15 % | **ref2-07** | El icono de la app cae al centro con desenfoque vertical. **Es la APERTURA**: lanzar la app |
| ≈ 1.6 s (`0:00:01:19`) | 21 % | **ref2-06** | Píldora compacta «2 Hr. 30 Min.» con lápiz |
| ≈ 2.8 s (`0:00:02:25`) | 29 % | **ref2-05** | La píldora **se desplegó** en selector de celdas «2 · Hr. · 30 · Min. · ✓» (cursor sobre el «2») |
| ≈ 4.3 s (`0:00:04:09`) | 40 % | **ref2-04** | La hora **rodó de 2 a 1**. El check se enciende en verde y se estira con desenfoque |
| ≈ 5.5 s (`0:00:05:15`) | 50 % | **ref2-03** | La pantalla START ya está armada. «1 Hr. 30 Min.» quedó como etiqueta bajo el botón |
| ≈ 8.4 s (`0:00:08:11`) | 70 % | **ref2-02** | Resumen de la carrera: «9.12» y una rejilla de 2×3 que ruedan |
| ≈ 9.7 s (`0:00:09:22`) | 80 % | **ref2-01** | «Recent Activity»: las tarjetas llegan en cascada; la 2 y la 3 aún se mueven |

- **Prueba 1 [O]:** el timecode del visor de AE crece de 07 a 01. Los fotogramas llegan a `:25`, así que el comp va a **30 fps**.
- **Prueba 2 [O/E]:** la barra de progreso de Instagram, medida en píxeles de la captura, crece en el mismo orden y a
  ritmo constante, ≈ 84 px/s. Con eso el reel dura **≈ 14 s**, el comp de AE arranca en ≈ 1.35 s del reel y llega a
  **≈ 12.5 s**.
- **Prueba 3 [O]:** el rótulo «POV: You do your cardio…» solo aparece en 05, 06 y 07. Instagram lo muestra en los primeros
  segundos del reel.

**Qué cambia respecto del encargo:**
- El icono no es un cierre: es la **apertura** (lanzar la app).
- La píldora no colapsa desde el selector: **se despliega** en el selector.
- El valor va de **2 h a 1 h**, no de 1 a 2.
- El selector colapsa después, ya convertido en la etiqueta que queda bajo START.

Todo es reversible, así que SUSAN puede usar cualquiera de las dos direcciones (ver §4). Lo valioso es el **arco**
completo: un objeto solo → la superficie se arma a su alrededor → acción → resultado → historial.

### 0.2 Otros datos

- **Comp casi cuadrado (≈ 1:1) [O].** Medidas relativas al lienzo, en píxeles equivalentes a 1080 (que también es la
  altura de nuestro 16:9):

  | Objeto | Tamaño | Posición |
  |---|---|---|
  | Icono | ≈ 185 × 160 px (ya aplastado) | centro en (50 %, 45 %) |
  | Píldora | ≈ 410 × 97 px | centro en (49 %, 47 %) |
  | Selector | ≈ 650 × 115 px | — |
  | Botón START | Ø ≈ 225 px | — |
  | Botones laterales | Ø ≈ 90 px | — |
  | Tarjeta de actividad | ≈ 515 × 188 px, radio ≈ 12 | — |

  Cifra héroe «9.12»: el dígito mide ≈ 100 px de alto, lo que equivale a un cuerpo de letra de ≈ 140 px. El **centro
  óptico** de los objetos aislados queda en el **45–48 % de la altura**, un poco arriba del centro geométrico.
- **La lista de capas de AE [O]** revela cómo está hecho:
  - ~152 capas.
  - **Una capa de texto por token** («2», «Hr.», «30», «Min.»): cada token se anima por separado, y en eso se apoya el
    morph de la píldora.
  - `apple checkmark.ai` ×2, `edit.ai` (el lápiz) y `START`.
  - Iconos **Hugeicons stroke-rounded** (`settings-01`, `music-02`, `home-07`, `workout-run`, `user-group`, `stairs-01`).
    Los iconos de la barra inferior usan **mate de pista** ("120 Shape…"): se revelan dentro de la barra.
  - 3 **capas de ajuste** (probablemente desenfoque, blur de movimiento y grade) y varios **nulls** (rigs de movimiento).
  - Capturas y grabaciones de pantalla (`Screen…png`, `Screen…mov`), con toda probabilidad de la app real, usadas como
    calco [I], y `nike run club app icon.png`.
  - Una pista **Audio Amplitude** más una canción: el movimiento está **sincronizado al ritmo** de la música.
- **Renderer «Classic 3D»** con «Draft 3D» activo [O]. Aun así, en ninguna captura se ve perspectiva ni inclinación. A
  diferencia del reel 1 (pose 3D suave), este reel es **plano**.
- **Cadencia [E].** Un estado nuevo cada **1.2–2.9 s**. El reel recorre el «bucle central» de la app en ~12 s
  **sin cortes visibles** [I]: cada estado le pasa el turno al siguiente a través de un elemento que persiste.

---

## 1. Captura por captura (orden cronológico)

### 1.1 ref2-07 · t ≈ 0.75 s · el icono de la app cae (apertura)

- **Composición [O/E]:** un solo objeto, centrado en (50 %, 45 %). El icono ocupa ≈ 17 % del ancho y deja **≈ 97 % de
  lienzo vacío**.
- **Jerarquía:** no hay; es lo único que existe.
- **Tipografía:** «RUN» y el swoosh son de la marca y no se trasladan.
- **Color [O]:** baldosa casi negra (en la foto `#4C4955`; en realidad ≈ `#111`), glifos blancos y lienzo blanco roto.
- **Profundidad [O]:** sin sombra. La única pista de profundidad es el **desenfoque de movimiento**.
- **Movimiento [O/I]:**
  - Se ve una banda fantasma sobre el borde superior y 2–3 bandas tenues debajo, y los glifos internos salen duplicados
    en vertical. En ese instante el icono se mueve **en vertical y rápido**, más de su propia altura por fotograma.
  - La baldosa es **≈ 1.15 : 1** (más ancha que alta). Es un **squash de volumen constante** al contacto: sx ≈ 1.07,
    sy ≈ 0.93 [E].
  - Se infiere una caída de 0.35–0.5 s con la velocidad máxima en el contacto (`power2.in`, gravedad, o un golpe
    `expo.out` desde arriba), un squash de 2–3 fotogramas y una recuperación de 0.25–0.3 s `power3.out` sin rebote.
- **Relevo [I]:** hacia 1.2 s el icono le cede el **mismo centro** a la píldora: se encoge y desaparece mientras la
  píldora aparece. Es el «condense» de `cta-morph-press` / `morph-swap`.

### 1.2 ref2-06 · t ≈ 1.6 s · píldora compacta «2 Hr. 30 Min.» + lápiz

- **Composición [E]:** un rectángulo gris claro de ≈ 38 % × 9 %, centrado en (49 %, 47 %), con radio pequeño (≈ 12 px, un
  «rectángulo suave», no una cápsula completa). El lápiz va a la derecha, separado.
- **Jerarquía [O]:** el valor se distingue **por color, no por tamaño**. Los números son oscuros y semibold, las unidades
  van al **mismo tamaño** en gris claro (~45 % de tinta). El lápiz es la indicación de «editable».
- **Tipografía [O]:** grotesca neutra (tipo SF Pro / Helvetica Now), números de peso ~600, unidades de peso ~400 y
  espaciado muy apretado («2Hr. 30Min.»).
- **Color [O]:** la píldora es apenas un **4–6 % más oscura** que el lienzo (foto: `#E3E1E0` sobre `#DDDFD5`). Es una
  superficie tonal, casi sin contraste.
- **Profundidad:** plana.
- **Movimiento [I]:** llegó desde el icono y se sostiene 0.5–0.8 s. La mancha punteada sobre el «30» es el cursor que
  entra; se ignora.
- **Relevo:** un toque en el lápiz despliega la píldora en selector.

### 1.3 ref2-05 · t ≈ 2.8 s · el selector desplegado

- **Composición [E]:** ≈ 60 % × 11 % a la misma altura (47 %), con **tres celdas separadas** («2 Hr.», «30 Min.» y
  «✓», de ≈ 21 %, 20 % y 11 % del ancho) y huecos de ≈ 3 %. El borde izquierdo apenas se movió (de 31 % a 26 %) y el
  derecho creció de 68 % a 87 %: la expansión es **casi anclada a la izquierda**.
- **Jerarquía:** las celdas se leen como controles; la celda del check es la confirmación.
- **Tipografía [O]:** números con mayúscula de ≈ 34 px (cuerpo ≈ 48 px a 1080) y unidades en gris claro. El check es
  negro, trazo de ~2 px.
- **Movimiento [I], de 1.6 a 2.8 s:**
  - Las celdas, que empezaron solapadas como una sola píldora, **se separan**.
  - Los tokens viajan con su celda.
  - El fondo de cada celda se ensancha con el radio fijo.
  - El lápiz se cambia por el check (cambio de icono).
  - Dura 0.45–0.6 s, con `power3.inOut` o `expo.inOut`.

### 1.4 ref2-04 · t ≈ 4.3 s · la hora rueda y el check se enciende

- **Lo que se ve [O]:**
  - Ahora dice «**1**». Su borde muestra un corrimiento vertical: acaba de **rodar un renglón**, de 2 a 1.
  - El fondo de la celda «Hr.» se está desvaneciendo: el selector empieza a colapsar.
  - El selector entero se corrió ≈ 11 % del ancho a la izquierda respecto de 2.8 s, a la misma altura.
  - La celda del check es ahora un **bloque verde vivo, el doble de alto que de ancho y muy desenfocado**. Se mueve
    rápido en vertical y se estira.
  - El fleco rosa alrededor del verde es un artefacto de color de la grabación (o una aberración cromática). **No se
    copia.**
- **Movimiento [I]:** este verde es la semilla del botón START. Ver los tiempos estimados en §1.8.
- **Cámara:** no hay un punch-in que se pueda verificar. El aislamiento existe **por construcción**: el componente vive
  solo en el lienzo y después la pantalla se arma a su alrededor.

### 1.5 ref2-03 · t ≈ 5.5 s · la pantalla START, armada alrededor del botón

- **Composición [E]:**
  - Un **mapa desenfocado** visto a través de un **disco con máscara radial** (≈ 70 % del ancho, centrado en ≈ 45 % de
    la altura) que se funde con el lienzo.
  - Un **punto azul de ubicación** con cono de dirección en la parte alta.
  - El **botón START circular** (Ø ≈ 21 %) en ≈ 60 % de la altura, con dos botones redondos blancos a los lados (Ø ≈ 8 %,
    engrane y nota musical).
  - La etiqueta «1 Hr. 30 Min.» en ≈ 76 %.
  - Una **barra inferior** (Home · Plans · Run · Club · Activity: iconos de línea y rótulos) en ≈ 90 %.
  - A la derecha, una mancha diagonal oscura y corrida, que casi seguro es el cursor entrando con desenfoque hacia START.
    Se ignora.
- **Jerarquía [O]:** START domina sobre la etiqueta, que domina sobre los botones laterales, la barra y el mapa. **Un solo
  color saturado** en todo el cuadro.
- **Tipografía [O]:** «START» va en una grotesca condensada, muy pesada y oblicua (de la marca). Los rótulos de la barra
  miden ≈ 13 px a escala de app.
- **Color [O]:**
  - START: **`#76FA6D`** en la foto, el lima neón «Volt» totalmente saturado.
  - Mapa: verdes pastel `#D3E9AF`–`#E1E6C4`.
  - Punto azul: `#3578F4`.
  - Botones laterales y barra: blancos.
- **Profundidad [O]:** es el único cuadro con capas de profundidad.
  - El mapa es una placa desenfocada (σ ≈ 10–20 px a escala de comp), es decir, DoF.
  - La máscara radial hace la caída de profundidad.
  - Los botones redondos y la barra llevan una **sombra ambiental suave**, las únicas sombras del reel.
- **Movimiento [I]:**
  - La pantalla **se construye alrededor del elemento que persiste**: el botón viene del check y la etiqueta viene del
    selector.
  - El mapa entra escalando y quizá girando; hay estrías curvas a lo largo de la calle, junto al punto.
  - Los botones laterales salen de detrás de START hacia los lados y la barra sube desde abajo, con sus iconos revelados
    por el mate.
  - Cada pieza dura 0.4–0.6 s, escalonadas cada 0.05–0.1 s, con `expo.out`. El punto azul probablemente pulsa, aunque una
    captura fija no lo puede mostrar.
- **Relevo:** se toca START (el cursor). Entre 5.5 y 8.4 s no hay captura; seguramente vienen la cuenta regresiva y la
  carrera.

### 1.6 ref2-02 · t ≈ 8.4 s · el resumen: «9.12» y la rejilla rodando

- **Composición [E]:** un bloque de texto **sin tarjeta**, alineado a la izquierda, que ocupa 20–69 % del ancho y 21–78 %
  del alto (cargado a la izquierda del centro). De arriba abajo:
  - «Today - 9:35am», pequeño y gris.
  - «Monday Morning Run» en peso medio, con el lápiz a la derecha.
  - Un filete.
  - «9.12» y el rótulo «Miles».
  - Una rejilla de 2 × 3 (Avg Pace, Time, Calories, Elevation Gain, Avg Heart Rate, Cadence).
- **Tipografía, razones medidas [E]:**
  - cifra héroe : título ≈ **3.5 : 1**
  - cifra héroe : valores de la rejilla ≈ **3.5 : 1**
  - cifra héroe : rótulos ≈ **5.5 : 1**
  - valor : rótulo ≈ **1.6 : 1**

  A 1080 de alto: héroe de cuerpo ≈ 140 px, título y valores ≈ 40 px, rótulos ≈ 24 px. **La cifra héroe va en bold o
  heavy** (~700–800) con tracking negativo; el título va en 500, los valores en 500–600 y los rótulos en 400 gris. Esto es
  distinto del reel 1, cuyas cifras nunca van en bold (REFERENCIA §1.6).
- **Color [O]:** monocromo, tinta y dos grises. Aquí no hay acento.
- **Movimiento [O]: dos ejes ortogonales en el mismo tiempo.**
  - **Los dígitos** salen duplicados en **vertical**: «88:29» son dos renglones de dígitos encimados, y «9'21"» también
    sale doble. Es un **odómetro a media vuelta con desenfoque de movimiento** (el blur de AE con pocas muestras deja
    fantasmas discretos).
  - **Los rótulos** («Avg Pace», «Elevation Gain», «Time») están corridos en **horizontal**: entran deslizándose de lado.
  - La columna izquierda está más corrida que la derecha y «159» y «167» casi se asentaron, así que el escalonado es por
    columna y la cifra héroe aterriza primero [I].
- **Tiempos estimados [E]:** ver §1.8.
- **Relevo [I]:** no está capturado. Probablemente el resumen sube o se encoge y entra la lista.

### 1.7 ref2-01 · t ≈ 9.7 s · «Recent Activity», tarjetas apiladas en cascada

- **Composición [E]:** un bloque centrado (27–75 % del ancho), con el encabezado en 21 % de la altura y tres tarjetas
  apiladas hasta el 80 %. Cada tarjeta es ≈ 2.75 : 1, con radio ≈ 12 px y separación ≈ 12 % de su altura. Queda
  ≈ 70 % de aire.
- **Anatomía de la tarjeta [O]:**
  - Arriba a la izquierda, una miniatura de mapa (verde pastel con la ruta en oscuro).
  - Fecha pequeña en bold y el nombre de la carrera en gris.
  - Una fila de tres datos: valor de peso medio y rótulo diminuto gris (valor : rótulo ≈ 1.7 : 1).
- **Color [O]:** las tarjetas son apenas más claras que el lienzo (+6 % de luminancia en la foto) y tienen una sombra
  mínima en el borde inferior. El único verde está en las miniaturas.
- **Profundidad / estado [O]:**
  - La tarjeta 1 está nítida.
  - La tarjeta 2 está nítida salvo «19:55», que sale doble: todavía está rodando.
  - **La tarjeta 3 está desenfocada por completo**, con los rótulos ilegibles.

  Como ya está alineada en su sitio, lo que se ve es su **llegada con desenfoque de movimiento**, no un DoF [I].
- **Movimiento [I]:**
  - Primero entra el encabezado.
  - Después las tarjetas, en cascada de arriba abajo, cada una desde abajo (y + 40–80 px), con desenfoque vertical.
    Escalonado de ≈ 0.12–0.2 s y `expo.out` de 0.5–0.6 s.
  - **Las cifras de cada tarjeta ruedan cuando la tarjeta se asienta** (+0.1–0.2 s).
  - La lista se sostiene hasta el final (≈ 12.5 s).

### 1.8 Tiempos y curvas estimados del reel

| Movimiento | Duración | Curva | Evidencia |
|---|---|---|---|
| Caída del icono | 0.35–0.5 s, squash 0.07 s, recuperación 0.25–0.3 s | `power2.in` (gravedad) o `expo.out`; recuperación `power3.out` | [O] estela vertical y proporción 1.15 : 1 |
| Píldora → selector | 0.45–0.6 s | `power3.inOut` / `expo.inOut`, casi anclado a la izquierda | [E] ancho de 38 % a 60 % |
| Lápiz → check | 0.2–0.3 s | escala + desenfoque | [I] |
| Hora 2 → 1 (un renglón) | 0.3–0.45 s | `expo.out` + desenfoque vertical | [O] borde vertical corrido |
| Check → botón START | 0.5–0.7 s | `expo.inOut` en el viaje; desenfoque partido (sube y baja) | [O] bloque verde de 2 : 1 desenfocado |
| Selector → etiqueta | 0.4–0.5 s | `power3.inOut` | [I] |
| Armado de la pantalla START | 0.4–0.6 s por pieza, escalonado de 0.05–0.1 s | `expo.out` | [I] |
| Cifra héroe (odómetro) | 0.6–0.8 s | `expo.out` | [O] fantasmas verticales |
| Rejilla de 2 × 3 | 0.5–0.7 s por dato, escalonado de 0.05–0.08 s | `power3.inOut` / `expo.out` | [O] la columna izquierda sigue corrida |
| Rótulos deslizados | 0.35–0.45 s, x de 30–60 px | `expo.out` + desenfoque horizontal | [O] corrimiento horizontal |
| Tarjetas en cascada | 0.5–0.6 s, escalonado de 0.12–0.2 s | `expo.out` + desenfoque vertical | [O] la tarjeta 3 sigue desenfocada |

### 1.9 Constantes de estilo y su traducción a SUSAN

| Aspecto | Reel 2 | SUSAN a 1920 × 1080 |
|---|---|---|
| Lienzo | Blanco roto neutro, **60–97 % vacío** | Crema `--background #F7F5F2`. El vacío **es** el estilo |
| Superficies | Grises tonales casi sin contraste, radio ~12 | `bg-card` blanco con `border-border #E7E2DC` de un pixel, `rounded-xl`; píldoras en `bg-muted #F0EDE8`. Sin sombra en la UI interna |
| Sombra | Solo en los botones redondos flotantes y la barra inferior | Solo en el objeto flotante del video (decisión abierta, igual que en LECCIONES §5) |
| Tinta | Casi negro y dos grises | `#1E1919` / `--muted-foreground #6F6A65` / `#D8D2CA` |
| **Acento** | **Un solo verde neón**, solo en la acción (START, check confirmado) | **`--brand-gold #A8842C`** como «chispa» (§4.0); el botón principal sigue en tinta, como en la app |
| Secundario | Punto azul diminuto | Ícono `camera` en `presente` **con su texto** «Cámara del aula lista», como en la app real |
| Tipografía | Cifra héroe heavy; valores 500–600; rótulos 400 gris; unidades del mismo tamaño en gris claro | Hanken Grotesk 600 (héroe; **tope de la app**, nunca 700+, DISENO-APP §1.5) / 500 / 400, con `tabular-nums`. El peso del reel no se traslada |
| Escala a 1080 | Héroe ≈ 140, título y valores ≈ 40, rótulos ≈ 24 px | Igual. En panel, REFERENCIA §1.6 (rótulo 30, cifra 48–64) |
| Iconos | Hugeicons stroke-rounded | Lucide de 1.5–1.75 (`assets/icons/`). **Falta `pencil.svg`**: hay que agregarlo con el script de Lucide de la v3 |
| Densidad | Un componente por plano en el aislamiento; superficie completa una sola vez | Igual |

---

## 2. La gramática de movimiento en 8 técnicas (y cómo dialogan con el reel 1)

### 2.0 Resumen

| # | Técnica | Capturas | Frente al reel 1 (`REFERENCIA.md`) |
|---|---|---|---|
| M1 | **Desenfoque de movimiento direccional** | 07, 04, 02, 01, 03 | El reel 1 usa el desenfoque como **lente** (T1 rack focus: «adónde mirar»). El reel 2 lo usa como **velocidad**: el desenfoque significa «se movió rápido y se clavó». Se complementan: rack focus para aperturas y cambio de mundo, estela para los golpes. Nunca los dos en el mismo elemento al mismo tiempo |
| M2 | **Odómetro**: dígitos que ruedan con desenfoque vertical, rótulos que se deslizan en horizontal | 02, 04, 01 | T8 hace rodar **una** cifra héroe. Aquí rueda **todo lo numérico** (héroe, rejilla, cifras de tarjeta, la hora del selector), con rótulos en el eje ortogonal |
| M3 | **Aislamiento de componente** sobre el lienzo vacío | 07, 06, 05, 04 | El reel 1 aísla con un panel sobre cielo y DoF. El reel 2 aísla **por borrado**: un control solo, sin fondo ni marco |
| M4 | **Morph de componente**: píldora ⇄ selector ⇄ etiqueta; check → botón | 06 → 05 → 04 → 03 | T13 relevaba pantallas completas (tarjeta → cabecera). Aquí el relevo es **del tamaño de un control**, con tokens que persisten |
| M5 | **Cascada de tarjetas apiladas** con estela y cifras que ruedan al asentarse | 01 | T6 escalona filas dentro de una hoja de vidrio. Aquí son tarjetas sueltas sobre el lienzo, encadenadas con M2 |
| M6 | **Sting del icono de app**: caída con estela y squash | 07 | Las 5 capturas del reel 1 no muestran un sting de marca. Este aporta la «llave de entrada» del producto |
| M7 | **Superficie de acción armada alrededor del botón héroe**: placa desenfocada con máscara radial, botones satélite, barra inferior y punto con pulso | 03 | T5 (cielo pastel) y T6 (hoja) son fondos «de mundo». Aquí el fondo es una **placa desenfocada del propio producto** y el héroe es UN botón |
| M8 | **Relevo encadenado sin cortes** (un elemento persiste de estado en estado) | todo | El reel 1 tenía un solo corte, el cambio de mundo (T14). El reel 2 no tiene ninguno visible en 12 s. Es el mismo principio que T13, llevado a toda la secuencia |

### 2.1 Qué sale de cada técnica (resumen)

- **M1.** El blur es **función de la velocidad**: es máximo a velocidad máxima y vuelve a 0 al asentarse. Su eje es el de
  la trayectoria: vertical en caídas y odómetros, horizontal en rótulos que se deslizan. **El texto nunca aterriza
  desenfocado.**
- **M2.** Cada columna es una tira de 0–9 recortada por una ventana. Las columnas se escalonan, la cifra héroe aterriza
  primero y los rótulos entran en el eje contrario. Una cifra de estado (2 → 1) **rueda un solo renglón**, no cuenta.
- **M3.** El componente queda en el **centro óptico** (45–48 % de la altura), al tamaño que tendría en la superficie final.
  El aislamiento se construye de dos formas:
  - **construir alrededor** (lo que muestra el reel): el componente existe solo y el contexto llega después;
  - **punch-in**: el contexto se borra y la cámara centra el componente.
- **M4.** Las celdas que forman la píldora **se separan** (los huecos se abren y el radio no se deforma) y el icono se
  cambia. Al confirmar, la celda del check **viaja y crece** hasta volverse el botón héroe, mientras el selector **se
  comprime** en la etiqueta que va bajo el botón.
- **M5.** Primero el encabezado, después las tarjetas de arriba abajo desde abajo, con escalonado ≤ 0.5 s en total. Cada
  tarjeta, al asentarse, dispara su M2.
- **M6.** Caída, contacto (squash de volumen constante), recuperación sin rebote y quietud. El acento llega **al final**.
- **M7.** El héroe ya está ahí (vino de M4). Los satélites salen **de detrás** del héroe, la barra sube y la placa de fondo
  se funde con un ligero alejamiento. Un pulso finito marca que algo está «vivo».
- **M8.** No hay disoluciones entre estados. Cada estado le hereda al siguiente un objeto: el icono deja el centro, la
  píldora deja sus tokens, el check se vuelve el botón y el selector se vuelve la etiqueta.

---

## 3. Implementación en HyperFrames (seek-safe)

### 3.0 Contrato común

El de `hyperframes-animation/rules-index.md` (ya resumido en REFERENCIA §2):
- un solo timeline GSAP pausado;
- `fromTo` con estado inicial explícito, e `immediateRender:false` cuando se retoma un objetivo;
- sin `Math.random` ni `Date.now`;
- solo `transform`, `opacity`, `filter`, `clip-path` y atributos SVG, **nunca** `width`/`height`/`top`/`left`;
- sin `transition` de CSS;
- **sin rotación en el plano** (`rotation`/rotationZ: la persona dueña la vetó en la v2.3; LECCIONES §3.6). La pose 3D
  suave de tarjetas flotantes (`rotationX/Y` ≤ 8–10°, reposo 0–3°) es otra cosa: la pide el BRIEF y se decide en la hoja
  de bocetos (SINTESIS).

Los IDs llevan prefijo de letra por escena (LECCIONES §5), porque los filtros SVG se referencian por `id` y las
sub-composiciones comparten documento.

Los fragmentos siguen el estilo del repo (4 espacios, comillas simples, punto y coma).

### 3.1 Utilidad base: desenfoque ligado a la velocidad (M1, M2, M5, M6)

Esta es la pieza que hace que todo el reel «se sienta After Effects». El desenfoque se calcula a partir de la **derivada
de la misma curva** que mueve el elemento, así que es una función pura del tiempo y sirve en ambos sentidos de búsqueda.

```html
<!-- un filtro por elemento que se mueve; región generosa para que la estela no se recorte -->
<svg width="0" height="0" aria-hidden="true" style="position:absolute">
    <filter id="b-mb-ficha" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
        <feGaussianBlur id="b-mb-ficha-g" stdDeviation="0 0" />
    </filter>
</svg>
```

```js
const FPS = 30;

// Mueve el elemento sobre un eje con la curva dada y escribe un blur SOLO en ese eje,
// con sigma proporcional a lo recorrido en un fotograma (k ≈ 0.29 equivale a un obturador de 360°).
function llegadaConRastro(tl, el, nodo, { at, dur, desde, eje = 'y', curva = 'expo.out', k = 0.3, max = 24 }) {
    const ease = gsap.parseEase(curva);
    const h = 1 / (FPS * dur);
    const filtro = `url(#${nodo.parentNode.id})`;
    const st = { p: 0 };
    const aplicar = () => {
        const p = st.p;
        const e = ease(p);
        const v = Math.abs(desde) * (ease(Math.min(1, p + h / 2)) - ease(Math.max(0, p - h / 2)));
        const s = p >= 1 ? 0 : Math.min(max, k * v);      // con curvas «in» la velocidad final no es 0: se corta al tocar
        gsap.set(el, { [eje]: desde * (1 - e) });
        nodo.setAttribute('stdDeviation', eje === 'y' ? `0 ${s.toFixed(2)}` : `${s.toFixed(2)} 0`);
        el.style.filter = s < 0.3 ? 'none' : filtro;       // en reposo no se rasteriza el filtro
    };
    aplicar();                                             // siembra el estado de t = 0
    tl.fromTo(st, { p: 0 }, { p: 1, duration: dur, ease: 'none', onUpdate: aplicar, immediateRender: false }, at);
}
```

- **Por qué no `filter: blur()` de CSS:** no es direccional. Un blur simétrico en un movimiento lateral se lee como
  desenfoque de lente (`motion-blur-streak`, «Directional axis»).
- **Topes:**
  - σ ≤ 24 en un elemento y ≤ 18 en un envoltorio de cámara.
  - Duración del movimiento de 0.25–0.6 s; más de ~0.7 s se lee como un cambio de foco.
  - El elemento se queda nítido ≥ 1 s después de asentarse.
- **Viajes `inOut`** (por ejemplo, check → botón): con la misma función el pico cae a media pierna. Es la variante
  «Camera-Travel Carve-Out» de la regla, ya resuelta por la derivada.
- **Las otras rutas del registro, y cuándo usarlas:**
  - **`motion-blur`**: el obturador estilo AE medido contra un export real. Se pega el snippet y se marca
    `data-hf-motion-blur='{"shutterAngle":360,"samplesPerFrame":8}'`. Integra traslación, escala y rotación juntas, así que
    es la mejor opción para el sting (caída + squash).
    - **Coste:** N+1 copias del subárbol y N+1 seeks por fotograma por objetivo; ≤ 3 objetivos por escena.
    - **Copias:** heredan las clases, así que después de adjuntarlo el elemento se direcciona por `id`.
    - **Clips:** el encabezado de `extended-keyframe` advierte que la copia DOM **no es segura dentro de clips
      temporizados**. Antes de usarlo en una sub-composición hay que verificarlo con `snapshot` en los bordes del clip.
  - **`extended-keyframe`**: incluye `attachMotionBlurFilter`, un desenfoque de obturador con `feOffset` (240°, 32 muestras)
    que **sí es seguro en clips** pero solo sirve para traslación. Es la alternativa si `motion-blur` falla en las
    sub-composiciones.
  - **Fantasmas** (regla `motion-blur-streak`, ruta B): 2 siluetas **sin texto** (`aria-hidden`,
    `data-layout-allow-overlap`) con opacidad ∝ velocidad. Es la opción más barata cuando hay muchos objetos que se mueven
    a la vez.
  - **`motionBlur` del motor:** existe en el motor (`job.config.motionBlur`, 180° y 16 muestras por defecto), pero **no
    tiene bandera** en `render --help` de la 0.8.134 y no se ve en la vista previa. No hay que planear con él.

### 3.2 M2 · Odómetro con desenfoque vertical

```html
<!-- «19 de 24 presentes» (formato real de la app; dato canónico de CONTENIDO §3.4): solo ruedan las columnas de «19»;
     «de 24» y el rótulo son estáticos -->
<span class="odo" style="--h: 112px">
    <span class="odo-col"><span class="odo-tira" id="e-odo-d">0<br>1<br>…<br>9<br>0<br>…</span></span>
    <span class="odo-col"><span class="odo-tira" id="e-odo-u">…</span></span>
    <span class="odo-fija">/ 24</span>
</span>
```

```css
.odo { font-variant-numeric: tabular-nums; font-weight: 600; letter-spacing: -0.03em; }
.odo-col { display: inline-block; height: var(--h); overflow: hidden; line-height: var(--h); vertical-align: top; }
.odo-tira { display: block; will-change: transform; }
```

```js
// Una columna: la tira repite 0–9 (vueltas + 1) veces y viaja del renglón «de» al renglón «vueltas·10 + a».
function rodarColumna(tl, tira, nodo, { at, dur, de, a, vueltas = 1, H, curva = 'expo.out', k = 0.3, max = 16 }) {
    const ease = gsap.parseEase(curva);
    const r0 = de;
    const r1 = vueltas * 10 + a;
    const h = 1 / (FPS * dur);
    const filtro = `url(#${nodo.parentNode.id})`;
    const st = { p: 0 };
    const aplicar = () => {
        const p = st.p;
        const v = Math.abs(r1 - r0) * H * (ease(Math.min(1, p + h / 2)) - ease(Math.max(0, p - h / 2)));
        const s = p >= 1 ? 0 : Math.min(max, k * v);
        gsap.set(tira, { y: -(r0 + (r1 - r0) * ease(p)) * H });
        nodo.setAttribute('stdDeviation', `0 ${s.toFixed(2)}`);
        tira.style.filter = s < 0.3 ? 'none' : filtro;
    };
    aplicar();
    tl.fromTo(st, { p: 0 }, { p: 1, duration: dur, ease: 'none', onUpdate: aplicar, immediateRender: false }, at);
}

// Odómetro clásico: las unidades giran más que las decenas y las dos columnas aterrizan casi juntas.
rodarColumna(tl, tiraD, nodoD, { at: T, dur: 0.75, de: 0, a: 1, vueltas: 1, H: 112 });
rodarColumna(tl, tiraU, nodoU, { at: T + 0.04, dur: 0.75, de: 0, a: 9, vueltas: 2, H: 112 });
// Cambio de estado de UN renglón (el «2 → 1» del selector): de: 2, a: 1, vueltas: 0, dur 0.35.
```

- **Rótulos en el eje contrario:** `llegadaConRastro(tl, rotulo, nodo, { eje: 'x', desde: -48, dur: 0.4 })`, 0.05–0.1 s
  después de que arranque su número.
- **Rejilla de 2 × 3:** escalonado de 0.05–0.08 s por dato, con la cifra héroe 0.15 s antes. Para no tener 18 filtros, se
  puede usar **un filtro por dato** que lea la velocidad de la columna que más viaja, o fantasmas.
- **Trampas** (`vertical-spring-ticker`):
  - la ventana mide **exactamente** H y la tira tiene renglones de H;
  - **nunca** se cambia `innerHTML` entre pasos (la tira se genera una vez, antes de registrar el timeline);
  - `tabular-nums` obligatorio;
  - H va como **constante** de CSS, sin medir al renderizar.
- **Ruido a evitar:** un `count-up` que reescribe el texto cada fotograma se lee como «tic por entero», el ruido que
  LECCIONES §5 manda retirar. El sonido va **un tic por columna al asentarse**, no por dígito.
- **HyperFrames:**
  - **Regla** `vertical-spring-ticker`, variante numérica. Su `back.out` se cambia por `expo.out`/`power3.inOut`; el rebote
    queda, como mucho, en una cifra clímax.
  - **Reglas** `counting-dynamic-scale` y `motion-blur-streak` (variación «Vertical streak»).
  - **Blueprint** `dataviz-countup`.
  - **Registro:**
    - `number-wheel`: contador de dígitos que ruedan, con variables `spin` single/double/triple, `spacing` y `tone`,
      `power3.out`, **sin desenfoque**.
    - `slot-machine-roll`: un carrete por carácter mediante la variable CSS `--hf-slot-y`, `power3.inOut` de 0.52 s y
      escalonado 0.06, **sin desenfoque**.
    - `number-pop-in`: dígitos con desenfoque y elevación.
    - `count-up`: el contador de texto, que no se usa aquí.

  Sirven como base estructural a la que se le agrega el blur de §3.1.
- **Coste:** bajo. Las columnas son áreas pequeñas.

### 3.3 M3 · Aislamiento de componente

**Forma A, construir alrededor (la del reel).** El componente vive solo en el centro óptico; el contexto ya está
maquetado en su sitio y llega después.

```js
// El contexto entra desde el componente hacia afuera (center-outward-expansion), sin fundir la llegada.
const piezas = ['#d-sat-izq', '#d-sat-der', '#d-etiqueta', '#d-barra'];
const desde = { '#d-sat-izq': { x: 140 }, '#d-sat-der': { x: -140 }, '#d-etiqueta': { y: -40 }, '#d-barra': { y: 140 } };
piezas.forEach((sel, i) => {
    tl.set(sel, { opacity: 1 }, T + i * 0.07);
    tl.fromTo(sel, { ...desde[sel], scale: 0.9 }, { x: 0, y: 0, scale: 1, duration: 0.55, ease: 'expo.out', immediateRender: false }, T + i * 0.07);
});
```

**Forma B, punch-in desde una superficie completa.** Se usa la regla `viewport-change` sobre el mundo (con
`transform-origin` al centro: `x = (960 − fx)·S`, el mismo helper `camTo` de la v3) y el contexto se desvanece.

```js
tl.to('#d-mundo', { scale: 1.25, x: (960 - FX) * 1.25, y: (540 - FY) * 1.25, duration: 0.9, ease: 'expo.inOut' }, T);
tl.to('#d-mundo .contexto', { opacity: 0, duration: 0.45, ease: 'power2.in' }, T);
```

- **Escala:** la cámara se queda en **S ≤ 1.3**. Un zoom de 2–3× sobre DOM ensancha los filetes de un pixel y los radios.
  El componente se maqueta **a su tamaño de video** (píldora ≈ 410 × 97, selector ≈ 650 × 115) y se aísla borrando el
  contexto, no ampliando.
- **16:9:** el reel es 1:1. Un componente aislado ocupa ≈ 21–34 % del ancho y las alas quedan vacías. Si acompaña a la
  voz, se corre a un tercio y en el otro va un kicker corto.
- **HyperFrames:**
  - **Reglas** `center-outward-expansion`, `viewport-change`, `coordinate-target-zoom` y `depth-of-field-blur` (solo si el
    contexto debe quedar presente y desenfocado).
  - **Blueprints:**
    - `cta-morph-press`, variante Hook «widget-morph-on-blank-field»: un widget solo en un campo plano que se transforma
      en su sitio. **Es el blueprint más cercano a ref2-06 → 05 → 04.**
    - `zoom-out-workspace-reveal`, la forma inversa: abrir en el detalle y revelar el todo.
  - **Registro:** `ui-focus-zoom` (la superficie se establece y la cámara hace zoom y paneo hacia una región anclada, con
    halo de foco opcional) y `focus-rack`.
- **Coste:** bajo (transform y opacity).

### 3.4 M4 · Morph de componente (FLIP con constantes y `clip-path` de radio fijo)

**Píldora → selector.** El layout se maqueta **desplegado** en CSS (`anchored-layout-expand`: el estado final es el real
y el compacto se finge).
- Cada celda es un envoltorio que se mueve en `x`, con un fondo propio recortado por `clip-path: inset(… round 14px)`.
  **El radio no se deforma**, cosa que sí pasa con `scaleX`.
- En el estado compacto, las celdas se **solapan** con el mismo gris y se leen como una sola píldora. Al desplegar se
  separan y los huecos se abren.

```js
// dx y recortes compactos: constantes que salen del CSS (no se mide al renderizar en un montaje multi-escena).
const CELDAS = [
    { id: '#c-c1', dx: 0,    recorte: 'inset(0px 24px 0px 0px round 14px)' },
    { id: '#c-c2', dx: -70,  recorte: 'inset(0px 30px 0px 0px round 14px)' },
    { id: '#c-c3', dx: -132, recorte: 'inset(0px 0px 0px 0px round 14px)' },
];
CELDAS.forEach(({ id, dx, recorte }) => {
    tl.fromTo(id, { x: dx }, { x: 0, duration: 0.55, ease: 'power3.inOut', immediateRender: false }, T);
    tl.fromTo(`${id} .celda-fondo`, { clipPath: recorte },
        { clipPath: 'inset(0px 0px 0px 0px round 14px)', duration: 0.55, ease: 'power3.inOut', immediateRender: false }, T);
});
// lápiz → check: sale con escala y blur (SIN giro: rotación vetada), entra con escala
tl.to('#c-c3 .ico-lapiz', { scale: 0.6, opacity: 0, filter: 'blur(4px)', duration: 0.2, ease: 'power2.in' }, T + 0.15);
tl.fromTo('#c-c3 .ico-check', { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'power3.out', immediateRender: false }, T + 0.3);
```

**Check → botón héroe** (`card-morph-anchor` con viaje):

```js
const S = 224 / 96;                                    // celda de 96 px → botón redondo de Ø 224 px
const INK = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
tl.to('#c-c3', { x: DX, y: DY, scale: S, borderRadius: 112 / S, backgroundColor: INK, duration: 0.6, ease: 'expo.inOut' }, T2);
// desenfoque vertical ligado al viaje: llegadaConRastro sobre un envoltorio que mueve SOLO y, o un rastro partido
// 0 → pico → 0 (power3.in / power3.out) con el pico a media pierna
// relevo: en el último 15 % se funde sobre el botón real (pixel-idéntico) y el check cambia a scan-face
```

**Selector → etiqueta** bajo el botón:
- El envoltorio `#c-sel` viaja y se encoge (FLIP: `x`, `y`, `scale` ≈ 0.55, `power3.inOut` de 0.5 s).
- Las celdas vuelven a sus `dx` compactos y la celda del check sale (ya es el botón).
- **Al final se funde con una etiqueta real, pixel-idéntica y sin escala**, para no dejar texto escalado en pantalla.

**Detalles:**
- **Constantes:** se miden una vez en la hoja de bocetos y se escriben como constantes. La regla prohíbe medir el DOM en
  un montaje multi-escena.
- **Curvas:** el `clip-path` se interpola porque las dos cadenas tienen la misma estructura. `power3.inOut` o
  `expo.inOut` para el morph; **nunca** `back`/`elastic` (la regla `card-morph-anchor`: el rebote pelea con el cambio de
  forma).
- **Orden:** no se anima un `clip-path` grande mientras la misma superficie viaja y escala (skill de keyframes,
  «Timing»). Primero se despliega y después viaja.

**HyperFrames:**
- **Reglas:** `anchored-layout-expand` (variante X), `card-morph-anchor`, `scale-swap-transition` y la skill de keyframes
  («Shared element / FLIP»).
- **Blueprint:** `cta-morph-press`, variante Hook: el menú «snap-collapses back to the pill carrying the new value + a
  checkmark pop».
- **Registro:**
  - `morph-swap`: A → B en un centro compartido; *condense* o *reshape* con `scaleX`/`scaleY`.
  - `modal-morph`: tarjeta → panel estilo FLIP, con hijos con clave contra-escalados. Mide al montar, así que dentro de
    un montaje hay que pasarle constantes.
  - `card-resize`, `icon-swap` (cambio de icono con escala y desenfoque), `icon-morph-beat` (icono que cambia de silueta,
    toma un color de acento y da un pulso de terminado), `menu-morph` y `tabs-slide-indicator`.

**Coste:** bajo. `clip-path` es solo de pintura y las áreas son pequeñas.

### 3.5 M5 · Cascada de tarjetas apiladas

```js
['#f-t1', '#f-t2', '#f-t3'].forEach((sel, i) => {
    const at = T + 0.2 + i * 0.12;                        // 3 × 0.12 = 0.36 s ≤ 0.5 s: se lee como una sola ola
    tl.set(sel, { opacity: 1 }, at);                      // llegada binaria, sin fundido (waterfall-entry)
    llegadaConRastro(tl, document.querySelector(sel), nodos[i], { at, dur: 0.55, desde: 110 });
    rodarCifrasDeTarjeta(sel, at + 0.18);                 // M2 en pequeño, con amplitud corta
});
```

- **Orden:** el encabezado entra 0.2 s antes, con un deslizamiento corto en x y estela horizontal.
- **Con más de 3 tarjetas:** se cambia el filtro por fantasmas (ruta B) o por un solo filtro en el envoltorio de la pila
  mientras se mueve.
- **HyperFrames:**
  - **Reglas** `waterfall-entry`, `motion-blur-streak` (variación «Staggered grid streak-in») y `spring-pop-entrance`
    (sin rebote).
  - **Blueprint** `grid-card-assemble` (variante Benefits vertical-list).
  - **Registro:** `stagger-cascade` (cuadrícula de tarjetas con escalonado uniforme), `notification-cascade` (banners que
    se apilan empujando la pila) y `mk-specs-list` (filas escalonadas).
- **Coste:** bajo a medio.

### 3.6 M6 · Sting del icono (caída, estela y squash)

```js
// Envoltorio externo = caída (y); interno = squash (escala), con transform-origin abajo.
tl.set('#b-ficha', { opacity: 1 }, T);
llegadaConRastro(tl, document.querySelector('#b-ficha'), nodoFicha,
    { at: T, dur: 0.42, desde: -640, eje: 'y', curva: 'power2.in', k: 0.3, max: 26 });
tl.fromTo('#b-ficha-escala', { scaleX: 1, scaleY: 1 }, {
    keyframes: [
        { scaleX: 1.07, scaleY: 0.93, duration: 0.07, ease: 'power2.out' },   // volumen constante, como el reel
        { scaleX: 1, scaleY: 1, duration: 0.3, ease: 'power3.out' },          // recuperación sin rebote
    ],
    immediateRender: false,
}, T + 0.42);
// el acento de oro llega AL FINAL (subrayado tipo «marcador» de la app), después quietud ≥ 1.2 s
tl.fromTo('#b-subrayado', { scaleX: 0 }, { scaleX: 1, duration: 0.35, ease: 'expo.out', immediateRender: false }, T + 0.62);
```

- **Variante con mejor estela:** marcar el envoltorio con el componente `motion-blur` (`shutterAngle` 360), que integra
  caída y squash juntas. Es una sola pieza por escena, así que el coste es aceptable.
- **HyperFrames:**
  - **Reglas** `spring-pop-entrance` (icono que cae desde arriba) y `motion-blur-streak` (vertical).
  - **Blueprint** `logo-assemble-lockup` (variantes Brand_Outro parts-arrive, «icon drops in from above», y
    Product_Intro).
  - **Registro:**
    - `logo-sting`: el wordmark se clava en su escala con un aro de acento y un cuadro blanco de impacto. Se toma **solo
      el aro**, en oro suave, sin el destello blanco.
    - `logo-brand-close`: las letras entran en cascada y el punto de acento de la marca llega al final.
    - `shutter-slam`: el caso de referencia de AE.
    - `hw-box-label`: caída con squash de contacto de volumen constante; sirve como referencia de las matemáticas del
      squash.
    - `beat-accent` y `extended-keyframe`.
- **Coste:** bajo. Con `motion-blur`, medio.

### 3.7 M7 · Superficie de acción armada alrededor del botón (placa desenfocada, satélites, pulso)

- **Placa desenfocada:** debe ser una **imagen pre-desenfocada**, nunca un blur animado a pantalla completa (mismo
  procedimiento que REFERENCIA T1):
  1. `npx hyperframes snapshot . --at <t>` del estado nítido (o una captura de `capture/app-real/`).
  2. `ffmpeg -i in.png -vf gblur=sigma=18 placa.png`.
  3. Máscara radial estática: `mask-image: radial-gradient(closest-side, #000 55%, transparent 100%)`.

  Entra con `opacity` 0 → 1 y `scale` 1.06 → 1 en 0.8 s `power3.out`.
- **Satélites:** salen de detrás del botón (Forma A de §3.3, `x` ± 140 → 0).
- **Barra inferior:** sube desde abajo (`y` 140 → 0, `expo.out` 0.6 s). Sus iconos se revelan con `clip-path` dentro de
  la barra (el «mate de pista» del reel), escalonados 0.04 s.
- **Pulso finito** (no hay pieza de registro para un «pin que pulsa»: `map pin pulse` solo devuelve mapas coropléticos):

```js
['#d-pulso-1', '#d-pulso-2'].forEach((sel, i) => {
    tl.fromTo(sel, { scale: 1, opacity: 0.4 }, { scale: 2.6, opacity: 0, duration: 1.2, ease: 'power2.out', repeat: 2, immediateRender: false }, T + i * 0.6);
});
```

- **La pulsación sin cursor** (BRIEF) se cuenta con estados reales de la UI:
  1. Aparece el **anillo de foco de la app** (`focus-visible:ring-4 ring-ring/30`) 0.2 s antes.
  2. El botón se comprime de forma lineal (`scale` 0.93 en 0.09 s) y se recupera con `power3.out` (0.35 s). Aquí se
     admite **uno** de los 1–2 `back.out(1.4)` del video.
  3. Un **aro de oro** se expande (`scale` 1 → 1.7, `opacity` 0.6 → 0 en 0.6 s).
- **HyperFrames:**
  - **Reglas** `press-release-spring` (variante «release burst»), `ambient-glow-bloom` y `sine-wave-loop` (pulso finito),
    `center-outward-expansion` y `depth-of-field-blur` (solo como referencia; se prefiere la placa).
  - **Blueprint** `device-surface-showcase`, variante «stepwise-flow»: flujo completo sin cursor (preparar → acción →
    éxito) dentro de la superficie, con un push-in leve solo en el commit. **Es el arco entero del reel.**
  - **Registro:** `success-check` (aro que aparece, trazo que se dibuja y un leve giro con desenfoque; el giro se
    quita), `conic-progress-ring` y `state-chip-rail` (estados Programada → En curso → Cerrada).
  - **Descartados:**
    - `gesture-tap`: un círculo de contacto toca la píldora, y eso es un puntero, que el BRIEF prohíbe.
    - `press-ripple` y `beat-pulse-background`.
- **Coste:**
  - Placa: bajo. Es una imagen; su `opacity` y su `scale` se componen sin re-rasterizar el desenfoque.
  - Pulso: bajo.
  - `backdrop-filter`: **alto**, así que no se usa.

### 3.8 M8 · Relevo encadenado (el esqueleto)

No es una receta nueva: es **la regla de montaje** de M3–M7. Cada estado termina con un objeto que el siguiente
reutiliza, en el mismo DOM o en un gemelo pixel-idéntico al que se pasa con un fundido de ≤ 0.1 s.

- **Cadena del reel:** icono → píldora (mismo centro) → selector (los mismos tokens) → check → botón, y selector →
  etiqueta.
- **Dentro de una escena:** un solo timeline, sin disoluciones.
- **Entre escenas:** las 2–3 transiciones firma de REFERENCIA (T13 elemento compartido, T14 empuje con velocidad
  igualada, T1 rack focus en el cambio de mundo).
- **HyperFrames:**
  - **Skill de keyframes:** «Shared element / FLIP» y «Preserve object identity when continuity matters».
  - **Reglas:** `card-morph-anchor` y `scale-swap-transition`.
  - **Blueprints:** `device-surface-showcase` (stepwise-flow) y `cta-morph-press`.

### 3.9 Búsquedas hechas en el registro

Todas con `npx --yes hyperframes@latest catalog --query "…" --json`, desde `video/susan-v4`, **sin instalar nada**. El
catálogo tiene 386 piezas. Las búsquedas pedidas son las 8 primeras; se añadieron 9 más.

| Búsqueda | Piezas relevantes (qué hacen) | Descartadas |
|---|---|---|
| `motion blur` | `motion-blur` (desenfoque de obturador estilo AE por copias DOM; traslación, escala, rotación y skew), `shutter-slam` (caso de referencia AE en 6 golpes), `extended-keyframe` (llegada que «nunca termina de aterrizar» + `attachMotionBlurFilter`, seguro en clips), `focus-rack`, `per-word-rise`, `soft-blur-in`, `focus-blur-resolve` | `cinematic-zoom` (transición shader), `transitions-blur` (muestrario), `ink-bleed-reveal` |
| `odometer number roll` | `number-wheel` (dígitos que ruedan, sin blur), `slot-machine-roll` (carrete vertical por carácter, sin blur), `number-pop-in` (dígito con blur y elevación), `count-up` | `perspective-marquee`, `ticker-takeover`, `kinetic-type-swap` (son de palabras) |
| `slot machine counter` | las mismas + `state-chip-rail` (máquina de estados de chips) | `apple-money-count` (dinero, destello verde, iconos de billetes), `camcorder-hud`, `carousel-orbit-*` |
| `morph button` | `morph-swap`, `icon-morph-beat`, `menu-morph`, `modal-morph` | `gesture-tap` (puntero de contacto), `cross-warp-morph` (shader), `morph-text` (gooey), `signup-flow` |
| `shared element transition` | ninguna FLIP real: `shared-axis-z` y `shared-axis-y` son de texto; la FLIP real es `modal-morph` / `card-resize` (salieron en otras búsquedas) | `transitions-*` (muestrarios de bloque) |
| `staggered cards` | `stagger-cascade` (vía `list rows cascade`), `card-resize`, `camera-rig-depth-stack` | tarjetas sociales (`x-post`, `reddit-post`, `spotify-card`…), `tilt-card` (es del reel 1) |
| `app icon logo sting` | `logo-sting`, `logo-brand-close`, `icon-swap`, `beat-accent`, `social-proof-card` | `app-showcase` (3 teléfonos flotantes de una app fitness), `ios26-liquid-glass` (WebGPU), `logo-outro`, `yt-logo-intro` |
| `map pin pulse` | **ninguna**: se construye a mano (§3.7) | `us-map-*`, `world-map`, `spain-map` (coropléticos), `beat-pulse-background` |
| extra: `number counter` | `number-wheel`, `number-pop-in`, `count-up` | — |
| extra: `shutter slam` | `shutter-slam`, `motion-blur`, `extended-keyframe` | `headline-slam`, `char-slam-explode` (golpes de titular) |
| extra: `pill expand` | `card-resize`, `tabs-slide-indicator`, `modal-morph` | `lt-soft-pill`, `caption-pill-karaoke` |
| extra: `list rows cascade` | `stagger-cascade`, `notification-cascade`, `mk-specs-list` | `pull-to-refresh`, `carousel-vision-*` |
| extra: `pulse ring location` | `success-check`, `conic-progress-ring` | `carousel-vision-*` |
| extra: `checkmark confirm` | `success-check`, `micro-transitions` (paquete de micro-transiciones: badge, dropdown, modal, tabs, tooltip, check) | `press-ripple` (cursor) |
| extra: `drop squash bounce` | `hw-box-label` (squash de volumen constante), `native-notification-pop` (resorte de caída) | `caption-gradient-fill` (rebote elástico) |
| extra: `focus rack depth` | `focus-rack`, `ui-focus-zoom`, `focus-swap` | `rack-focus` (bokeh WebGL) |
| extra: `camera punch in` | `ui-focus-zoom`, `yt-camera-move` | `whip-pan` (shader), `camera-shake` |

### 3.10 Costes y trampas transversales

- **Los filtros SVG se rasterizan en CPU en cada fotograma en que cambia σ, y el coste es área × σ.** En Linux el render
  va por GL de software (REFERENCIA T1). Hay que:
  - mover áreas pequeñas (columnas, tarjetas, la ficha);
  - limitarse a **≤ 3 objetos desenfocados a la vez**;
  - escribir `filter:none` en reposo;
  - medir con `npx hyperframes render -c compositions/<escena>.html --quality draft`.
- **Escala:** el filtro se aplica antes del `transform`, así que en un elemento escalado la σ efectiva se multiplica por
  la escala.
- **El desenfoque no es un relleno:** se usa en 1–3 golpes por escena (`references/motion-blur.md`, «Do not blur»), nunca
  en fundidos, derivas lentas ni texto que haya que leer en ese instante.
- **Texto escalado:** no se deja quieto en pantalla. Al terminar un FLIP se cambia por su gemelo sin escala.
- **Constantes:** las medidas del morph y la altura H del odómetro van como constantes de CSS (montaje multi-escena).
- **Rotación en el plano:** vetada. El cambio de icono va con escala y desenfoque, sin giro. (La pose 3D suave de
  tarjetas es una decisión aparte, ver SINTESIS.)
- **Sonido:**
  - un whoosh corto por cada movimiento desenfocado (en el pico de velocidad);
  - un tic por columna al asentarse;
  - un clic suave en cada morph;
  - un golpe grave en el contacto del sting.

  Densidad de ~1–2 SFX/s (LECCIONES §5). En el reel el movimiento va al ritmo de la música («Audio Amplitude»); en SUSAN,
  sin música, los golpes se amarran a la voz y a los SFX.

---

## 4. SUSAN: uso de cada técnica con su propio contenido

### 4.0 El acento: el oro de marca hace el papel del verde

**Recomendación:** `--brand-gold #A8842C` (suave: `--brand-gold-soft #F6EDD3`) es la «chispa» del reel, con **un solo
elemento de oro por cuadro**. El botón principal **sigue en tinta**, como en la app real; el verde `presente` solo aparece
donde significa «presente», con su texto.

Por qué:
1. **En el reel, el verde es marca y acción, nunca dato** (START y check confirmado). El equivalente de SUSAN que no es
   semántico es el oro: ya es la marca de la app real (el subrayado tipo marcador bajo «Patricia» en
   `capture/app-real/mobile/10-docente-home.png`).
2. **`presente` es semántico.** Por regla (CLAUDE.md, `StatusChip`), un estado lleva siempre texto y color. Un botón
   «Pasar lista» verde se leería como «presente/OK» y rompería esa regla.
3. **Contraste (calculado):**
   - tinta sobre oro **≈ 5.0 : 1** (AA para texto);
   - blanco sobre oro ≈ 3.5 : 1 (solo texto grande);
   - oro sobre crema ≈ 3.2 : 1 (bien como gráfico: aro, disco, subrayado).

   Por eso, si una superficie es de oro, lo que va encima es tinta.
4. **Riesgo:** el oro se parece al ámbar de `retardo` (`#9A6408`). **Nunca** va junto a un chip de Retardo ni sobre datos
   de asistencia.

En la práctica, el oro es el aro de la pulsación, el subrayado del sting, el destello del check confirmado y, como mucho,
una cifra resaltada de cierre. Con la tinta como acento estructural del reel 1 (REFERENCIA §1.6), el sistema queda así:
**tinta para la estructura, oro como chispa única y colores de estado solo con etiqueta**.

### 4.1 Técnica por técnica

| Técnica | Uso en SUSAN (datos de la v3, a validar con el guion y `capture/app-real/`) |
|---|---|
| **M1** desenfoque direccional | En todas las llegadas rápidas: el sting, el check que viaja y se vuelve el botón, las columnas del odómetro, las tarjetas de la pila y el relevo entre dos componentes aislados. Máximo 3 por escena; ningún titular o cifra aterriza desenfocado |
| **M2** odómetro | **Sesión en vivo:** «**19** de 24 presentes» (datos canónicos de CONTENIDO §3.4; corregido por la crítica). Solo rueda «19», con «de 24» fijo y el rótulo «presentes» en `muted-foreground` con un punto `presente`; puede ir junto al `ui/MedidorLiquido`, que la app reserva para la sesión en vivo. **Resumen en vivo (sin cerrar la sesión, CONTENIDO §3.4):** héroe «**88 %**» «Presentes ahora» (= 21 de 24: 19 presentes + 2 retardos) y rejilla de 2 × 3 con Inscritos 24 · Presentes 19 · Retardos 2 · Sin registro 2 · Por revisar 1 · «Minuto 12.0» de la ventana de tolerancia. Nada de «hora de cierre» ni «tiempo de pase de lista» (no hay cronómetro con respaldo). **Estado de un renglón:** «Pendiente → Presente» en una fila |
| **M3** aislamiento | Componentes solos en el centro óptico: (1) la píldora de la sesión «3A · 07:00 · A-12» con lápiz; (2) el botón redondo «Pasar lista»; (3) un `StatusChip` «Presente»; (4) el chip «Sin derecho» de la analítica; (5) la ficha del wordmark. Uno por plano y ≥ 60 % de lienzo vacío |
| **M4** morph | **Producto:** la píldora «3A · 07:00 ✎» se despliega en un selector `[Administración Financiera (3A)] [07:00 – 08:00] [Aula A-12] [✓]`. Al confirmar, el check viaja hacia abajo y **se vuelve el botón redondo central «Pasar lista»** de la barra móvil real, mientras el selector se comprime en la etiqueta «3A · 07:00–08:00 · A-12» bajo el botón. **Alternativa para el gancho del problema:** la píldora «5 min por sesión» se despliega en `[5 min] × [3 sesiones] × [16 semanas]` y rueda a «4 h por grupo al semestre» (spec §1.1; la cifra de la v3 «10 min × 3 × 5 = 2 h 30» se retiró, CONTENIDO §6). No inventar «la cifra de SUSAN» en minutos |
| **M5** cascada | «Sesiones recientes» (o «Todas las sesiones de hoy»): 3 tarjetas `TarjetaFila` blancas con filete. La **miniatura de mapa se cambia por un `AnilloEstados` mini**; después van fecha y grupo y tres datos **reales de sesiones cerradas** (p. ej. `dom/29-sesion-cerrada-18.html`: «vie 11 sep · 3A · 15 presentes · 1 retardo · 8 ausencias · 67 %», un viernes, el día crítico). Las cifras de cada tarjeta ruedan al asentarse. Variante: «Alumnos en riesgo» en la analítica, con avatares abstractos |
| **M6** sting | El **wordmark «SUSAN»** en una ficha redondeada de tinta (radio ≈ 22 % del lado, ≈ 180 px), en Hanken 600 crema, con el **subrayado de oro** que llega al final. Se usa en la **bisagra entre el problema y el producto**, a los ~6–8 s («lanzar la app», como en el reel) y se **repite en el cierre** como lockup con el mensaje. Como no hay logo, la ficha es una **propuesta que decide la persona dueña**; si no se aprueba, cae el wordmark solo con la misma estela y el mismo squash |
| **M7** superficie de acción | La pantalla móvil «Pasar lista» se arma alrededor del botón redondo central. Es **UI real**: la barra inferior de la captura móvil (**Panel · Revisión · Pasar lista · Reportes · Analítica**) ya tiene el botón circular de tinta con `scan-face`, el análogo exacto de «Run/START». Satélites: `camera` «Cámara del aula lista» (en `presente`, con texto y pulso; hace de punto azul) y `users-round` «24 inscritos». Placa: el Home real pre-desenfocado, con máscara radial. **Se recorta el banner «Reloj de demostración»**, que es solo de desarrollo. Pulsación sin cursor: anillo de foco, compresión y aro de oro |
| **M8** relevo | Es el esqueleto del tramo de producto: sting → píldora → selector → botón → contador en vivo → resumen → historial, sin cortes dentro del tramo |

### 4.2 Secuencia sugerida del «bucle central» (orientativa; la decide el storyboard)

El reel hace el bucle en ~12 s. Con voz y para docentes conviene ~1.6× más lento:

| Tiempo | Dur. | Técnicas | Contenido |
|---|---|---|---|
| A | 1.6 s | M6 + M1 | La ficha «SUSAN» cae y se aplasta; llega el subrayado de oro; quietud |
| B | 2.4 s | M3 + M4 | Mismo centro: la ficha cede el lugar a la píldora de la sesión, que se despliega en el selector |
| C | 2.0 s | M4 + M1 | Confirmar: el check viaja y se vuelve el botón «Pasar lista»; el selector se vuelve la etiqueta |
| D | 2.6 s | M7 | La superficie móvil se arma; anillo de foco, compresión y aro de oro |
| E | 4–5 s | M2 (+ T1 en el cambio de mundo) | Sesión en vivo: «19 de 24 presentes» rueda; avatares abstractos en `StatusChip` |
| F | 3.0 s | M2 | Resumen en vivo: «88 %» «Presentes ahora» y la rejilla de 2 × 3 (sin cerrar la sesión); los rótulos entran en el eje contrario |
| G | 3.0 s | M5 | Historial: 3 tarjetas en cascada con sus cifras rodando |

Total: ≈ 19–20 s. Encaja con LECCIONES §5: 7–9 escenas de 5–8 s con tiempos internos de 2–3 s, la app en pantalla hacia
los 6–8 s y las cifras clave quietas ≥ 1.2 s.

### 4.3 Qué no copiar

- El cursor de mano y cualquier «contacto» que haga de puntero (`gesture-tap`, `press-ripple`).
- La paleta Volt/Nike, la tipografía condensada oblicua y el swoosh.
- El mapa real y el punto de GPS.
- El fleco rosa del verde y los fantasmas discretos del blur de AE con pocas muestras: la estela de SUSAN es la limpia de
  §3.1.
- La velocidad del reel aplicada al video entero.
- El comp cuadrado.
- Los iconos Hugeicons (se usa Lucide).
- La rotación en el plano (el cambio de icono va sin giro).
- El destello blanco de impacto de `logo-sting`.

### 4.4 Cruces con `plan/REFERENCIA.md` (notas; ese archivo no se tocó)

- **§5 (look & feel) y T7** describían «un cursor toca la pestaña» (ya corregido por la crítica en REFERENCIA.md). El BRIEF (2026-10-05) dice **SIN CURSOR**. La
  pulsación se cuenta como en §3.7: anillo de foco, compresión y aro.
- **T2** recomienda el componente `motion-blur` sin advertir que, según el encabezado de `extended-keyframe`, la copia DOM
  no es segura dentro de clips temporizados. Hay que verificarlo en las sub-composiciones o usar `attachMotionBlurFilter`
  o la ruta SVG de §3.1.
- **§4 («Barra de pestañas»)** pide tomar la barra móvil de la captura: es **Panel · Revisión · Pasar lista (botón
  circular de tinta con `scan-face`) · Reportes · Analítica** (`capture/app-real/mobile/10-docente-home.png`).
- **Acento:** REFERENCIA usa la tinta como acento único. Este documento añade el **oro** como chispa única (§4.0). No se
  contradicen: la tinta es la estructura y el oro marca la acción y la marca.

---

## 5. Look & feel objetivo (las dos referencias juntas; párrafo para «Video direction»)

Motion graphics de UI limpia sobre el lienzo crema de SUSAN, con el pulso de un reel de After Effects y sin cursor. Cada
plano tiene un solo objeto de UI. A veces está **completamente solo** en el centro óptico, con el resto del cuadro vacío
(la píldora de la sesión, el botón redondo «Pasar lista», la ficha del wordmark); otras veces es la superficie entera, que
se arma a su alrededor. Los estados se encadenan sin cortes gracias a un elemento que persiste: la píldora se despliega en
selector, el check viaja y se convierte en el botón, el selector se comprime en la etiqueta que queda debajo y el
resultado cae a la pila del historial. Las cifras ruedan como odómetros con un desenfoque vertical que acompaña a la
velocidad, mientras sus rótulos entran deslizándose en el eje contrario. Las llegadas rápidas dejan una estela
direccional breve y se clavan nítidas. El desenfoque de lente (rack focus del reel 1) se reserva para las aperturas y el
cambio de mundo, y el cielo pastel con la tarjeta holográfica, para 2–3 momentos héroe. La pose 3D suave solo la llevan
las tarjetas flotantes; los controles aislados van planos. La paleta es tinta casi negra para la estructura, tres
escalones de gris, **un solo toque de oro de marca por cuadro** para la acción y la marca, y los estados de asistencia
siempre con su color y su texto. Las curvas son largas y limpias (`expo.out` para llegar, `power3/expo.inOut` para
transformar y viajar, 0.4–0.8 s), sin rebotes salvo el squash del sting y una sola pulsación. El ritmo es de reel pero
legible para docentes: un estado nuevo cada 2–3 s dentro de escenas de 5–8 s, y cada cifra clave quieta al menos 1.2 s.
El sonido son golpes cortos en capas pegados al fotograma: whoosh en el pico de cada estela, tic al asentarse cada
columna, clic en cada morph y un golpe grave cuando aterriza la marca, con huecos para la voz.
