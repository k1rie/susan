# Referencia v4: el reel de levii.motion y cómo llevar su lenguaje de movimiento a HyperFrames

> **Fuente:** 5 capturas (`referencia/ref-01…05`) del reel de Instagram «POV: After Effects is getting easier»
> (levii.motion), grabado con un teléfono mientras se reproducía en Premiere. **No son estilo:** los paneles de
> Premiere, la línea de tiempo, la interfaz de Instagram, la barra de estado del teléfono, el texto «POV», ni los
> artefactos de grabar una pantalla con un teléfono (moiré, trapecio, reflejos, dominante de color).
> **Marcas de confianza:** **[O]** se ve en la captura · **[I]** se infiere del contexto · **[E]** se estima de la línea de
> tiempo de Premiere que aparece en la foto. Los hex son aproximados porque salen de una foto de un monitor; sirven como
> intención. En el video manda la paleta de SUSAN (§1.6 y §4).
> Complemento: `plan/LECCIONES-V3.md` (lo que se hereda y lo que se corrige de la v3).

---

## 0. Datos duros

- **Duración** de la secuencia: `00:00:14:11`, ≈ 14.4 s [O]. El comp de AE es casi cuadrado (≈ 1:1) [O] y se exportó
  como un solo `main_comp_3.mov` (V1/V2) con una capa de ajuste encima (V3) [O]. Todo el movimiento ocurre dentro de AE;
  Premiere solo aporta el sonido.
- **Orden cronológico real**, según el timecode del monitor de programa:

  | t | Captura | Pantalla |
  |---|---|---|
  | ≈ 0.6 s (`00:00:00:16`) | ref-02 | «Cards» desenfocada (apertura) |
  | ≈ 1.6 s (`00:00:01:15`) | ref-03 | «Cards» enfocada, tarjeta holográfica |
  | ≈ 6.9 s (`00:00:06:23`) | ref-05 | panel de cuenta + hoja «Transactions» + cursor |
  | ≈ 9.4 s (`00:00:09:10`) | ref-04 | «My Income», barras finas + tooltip inclinado |
  | ≈ 12.2 s (`00:00:12:05`) | ref-01 | «My Expenses», líneas + guía + lista |

- **Dos mundos** [O]. El **mundo cielo** (cielo pastel, tarjeta holográfica, panel de vidrio) carga el producto y la
  emoción. El **mundo limpio** (lienzo gris muy claro, sin ilustración) carga los datos. **El reel solo tiene un corte real**,
  el cambio de mundo hacia 7.6–8.0 s [I]. Lo demás son relevos dentro de un mismo plano: la tarjeta se vuelve cabecera, la
  pantalla se vuelve panel y las barras se vuelven líneas. En la práctica son **2 escenas continuas de 7–7.5 s, con 2–3
  tiempos internos de ~2.5–3 s cada una**. Es la lección de ritmo más importante (§3).
- **Sonido** [O/E]: 10 pistas de audio (A1–A10) con ~35 clips en 14.4 s. En el bin se leen «Typing + Enter (fast)» y
  «Sparkle Whoosh». Detalle en §3.2.

---

## 1. Captura por captura (en orden cronológico)

### 1.1 ref-02 · t ≈ 0.6 s · apertura en desenfoque total (rack focus)

- **Composición [O]:** es el mismo cuadro de «Cards» que ref-03, pero la tarjeta se ve un 15–20 % más grande: ocupa ~85 %
  del ancho contra ~71 % en ref-03. La cámara arranca más cerca y se aleja mientras enfoca. Arriba está el cielo (cian a
  blanco) y la píldora «Order a card» como mancha blanca a la derecha. El título «Cards» todavía no se distingue.
- **Jerarquía [O]:** solo hay masas. La tarjeta es la única forma y el chip dorado es el único detalle de alto contraste
  que sobrevive al desenfoque: ahí se ancla el ojo.
- **Tipografía:** ilegible a propósito.
- **Color [O]:** cielo aprox. `#7EC3DF → #BFE3EF → #EEF6F7`. El holograma (rosa `#F2A7C9`, coral `#F7A48B`, ámbar
  `#F6C46B`, lila `#C8B4EE`) barre desde la esquina inferior derecha. Chip `#C9A85A`.
- **Profundidad [O]:** desenfoque gaussiano uniforme en todo el cuadro, de ~30–40 px a 1080. Es una lente fuera de foco,
  no un DoF selectivo.
- **Movimiento [I]:** en 0.0 s el desenfoque es máximo y la escala ~1.15–1.2. El foco vuelve en **0.8–1.0 s** con una curva
  de salida rápida (`expo.out`/`power3.out`): casi todo el enfoque ocurre en los primeros 0.4 s y luego afina. A la vez la
  escala baja a 1.0 en **~1.2 s** (`power3.out`). Entre 0.0 y 0.4 s arrancan 4–5 clips de sonido (§3.2): whoosh, destello
  y lecho.
- **Relevo:** no hay corte. Es el mismo plano que se enfoca y llega a ref-03.

### 1.2 ref-03 · t ≈ 1.6 s · «Cards» (tarjeta holográfica)

- **Composición [O]:** pantalla de app a cuadro completo, en columna centrada. En el tercio superior hay cielo con nubes
  cálidas pintadas, que se desvanece a blanco hacia abajo (máscara vertical). «Cards» va arriba a la izquierda y la
  píldora «Order a card» arriba a la derecha. La tarjeta (≈ 71 % del ancho, proporción 1.6:1) está en el centro óptico, a
  ~45 % del alto. Abajo, a ~90 % del alto, hay una fila de 3 iconos de acción de línea.
- **Jerarquía:** tarjeta (héroe) > «Cards» > píldora > iconos.
- **Tipografía [O]:** grotesca neutra tipo SF/Inter.
  - «Cards»: ~32 px@1080, peso 300–400, gris pizarra.
  - Píldora: 18 px regular.
  - En la tarjeta: marca 26 px semibold blanca; «Physical Card» 16 px gris; «•••• 6703» 24 px en tinta; «VISA» 22 px
    blanco translúcido.
  - Mucho aire y poco texto.
- **Color [O]:** la tarjeta es vidrio blanco escarchado (~60 % de opacidad) con un remolino holográfico en la mitad
  inferior derecha y un borde interior claro de 1 px.
- **Profundidad [O]:** los bordes superior e inferior de la tarjeta se repiten 2–3 veces en líneas paralelas, separadas
  8–12 px, con un leve fleco rosa/cian. Las líneas fantasma del borde inferior son más cortas que la tarjeta. Es el
  **desenfoque de movimiento de AE** (muestras discretas) de un asentamiento en **escala + Y**: no es una pila de tarjetas.
  La tarjeta todavía se está posando en t ≈ 1.6 s. Debajo tiene una sombra muy difusa.
- **Movimiento [I]:**
  - **Tarjeta:** escala 1.15 → 1.0 e `y` +40 → 0 px en **1.0–1.3 s**, `expo.out` (llega rápido y se posa largo).
  - **Título y píldora:** ya están nítidos, así que entraron con el rack focus o con un blur-in corto en 0.9–1.3 s.
  - **Iconos inferiores:** escalonado de 0.05–0.08 s, subida de 12–16 px.
  - Después, probablemente una flotación mínima (≤ 3 px, ≤ 1°).
- **Relevo hacia ref-05 [I]:** la tarjeta no desaparece. Su degradado reaparece en ref-05 como la cabecera «Account Number
  **** 8648 / Valid Date» del panel: es un **elemento compartido**. Además, la pantalla completa se convierte en un panel
  flotante (≈ 60 % del ancho) con cielo alrededor: un **des-zoom de cámara** (escala ~1 → 0.62, radio 0 → ~36 px).
  Ventana probable: 2.8–4.3 s (§3.1).

### 1.3 ref-05 · t ≈ 6.9 s · panel de cuenta + «Transactions» + cursor

- **Composición [O]:**
  - Panel tipo teléfono centrado (≈ 60 % del ancho, radio ~36 px) sobre un cielo a sangre, con nubes a ambos lados.
  - Arriba asoma la tarjeta holográfica, recortada por el panel. Es el patrón «billetera»: la tarjeta queda metida en la
    cabecera. Un trazo vertical oscuro a su izquierda sugiere otra tarjeta detrás.
  - Debajo, la fila «Send ↗ · Received ↙ · ⋮» y un botón circular oscuro «+» a la derecha.
  - Una hoja blanca «Transactions» con asa (grabber), icono de menú, icono de búsqueda, la sección «Yesterday», 3 filas
    completas y una cuarta («Slack») cortada bajo la barra de pestañas.
  - Barra inferior Home / Statistic / Card / Activity / Settings, con el indicador de inicio.
  - Un cursor de flecha (macOS) hace clic en «Home».
- **Jerarquía:** título de la hoja (centrado) > nombres de fila > montos > metadatos > estados.
- **Tipografía [O]:**
  - «Transactions»: 22 px regular.
  - Nombre de fila: 17 px medium (500).
  - Metadatos: 12 px gris claro («Food & Drink · ⟳ Nov 12, 26»).
  - Monto: 15 px, alineado a la derecha, con los decimales más claros.
  - Estado: 10–11 px de color (verde «Income», rojo «Transfer»).
  - Pestañas: 13 px gris; la activa, más oscura.
- **Color [O]:** el panel es blanco cálido-rosado porque el cielo y el holograma tiñen el vidrio. Hay un solo acento oscuro
  (botón «+» y cursor); el verde y el rojo solo marcan estado.
- **Profundidad [O]:** vidrio (blanco translúcido con el fondo desenfocado detrás). La hoja blanca va un plano por encima,
  con sombra suave. «Transactions» y los montos tienen eco, así que la hoja o la lista todavía se mueve en t ≈ 6.9 s.
- **Movimiento [I]:**
  1. Entre ~4.3 y ~5.9 s la hoja sube desde abajo (`yPercent` 100 → 0, ~0.6 s, `expo.out`) y las filas entran escalonadas
     (0.06–0.08 s).
  2. La lista sigue desplazándose despacio; por eso asoma «Slack».
  3. El cursor entra hacia 6.0–6.6 s con trayectoria curva y desaceleración.
  4. Hace clic en «Home» hacia 6.8–7.0 s (presión de ~0.08 s).
  5. Ese clic **dispara** el cambio de mundo hacia 7.6–8.0 s, donde hay un grupo de 3 SFX.
- **Relevo hacia ref-04 [I]:** es el único corte real. Lo más probable es un zoom-through o un empuje con desenfoque de
  0.3–0.5 s, porque nada del panel sobrevive en ref-04.

### 1.4 ref-04 · t ≈ 9.4 s · «My Income» (barras finas + tooltip inclinado)

- **Composición [O]:**
  - Lienzo gris muy claro, sin tarjetas.
  - Bloque de texto alineado a la izquierda (margen ~17 % del ancho): rótulo, cifra y delta.
  - Debajo, una banda de **~120 barras finas** (2 px de grosor, paso de ~5 px) que forman una **rampa**: ~10 px de alto a
    la izquierda y ~80 px a la derecha, con curva tipo ease-in.
  - Un **bloque oscuro sólido** entre Wed y Thu (~11 % del ancho de la gráfica, ~45 px de alto).
  - Encima del bloque, una píldora oscura **inclinada ≈ −12°** con «$2001.90».
  - Eje Sun…Sat.
  - **La mitad inferior está vacía:** es el hueco que llenará la lista en ref-01.
- **Jerarquía:** cifra > gráfica/tooltip > rótulo > delta > eje.
- **Tipografía [O]**, en proporción del ancho del comp:
  - Rótulo «My Income»: 3.2 %, medium, gris `#7A7A7A`.
  - Cifra «$2,4799.00»: 4.9 %, peso 400–500 (**no bold**), tinta, tracking apretado.
  - Delta «▲ 6.9 % From last week»: 2.3 %, medium, tinta, con un triángulo pequeño.
  - Eje: ~2 %, gris.
  - **Razón rótulo : cifra : delta ≈ 1 : 1.55 : 0.75.**
- **Color [O]:** las rayas van de gris claro `#C9C9C9` a la izquierda a `#8E8E8E` a la derecha. El bloque y el tooltip usan
  el único acento oscuro (`#2B2D31` aprox.).
- **Profundidad [O]:** plana. Las rayas de la derecha y los decimales del tooltip («.90») tienen eco: las barras siguen
  creciendo y el valor sigue rodando en t ≈ 9.4 s.
- **Movimiento [I]:**
  1. Hacia 7.8–8.4 s entra el bloque de texto: blur-in por línea (0.4–0.5 s, escalonado de 0.06–0.1 s). La cifra rueda o
     cuenta durante 0.8–1.0 s.
  2. Hacia 8.4–9.2 s las rayas barren de izquierda a derecha: ola de escala Y, 0.6–0.8 s, `power2.inOut`.
  3. Hacia 8.9–9.2 s el bloque oscuro crece desde la base (~0.3 s, `power3.out`). La píldora salta inclinada (escala
     0.6 → 1 con giro, 0.3–0.4 s, leve sobreimpulso) mientras su valor rueda.
  - El grupo de 4 clips de sonido en 8.6–9.0 s corresponde al bloque y al tooltip.
- **Relevo hacia ref-01 [I]:** como la plantilla de pantalla es la misma, es un **morph en sitio** (ventana ~10.4–11.6 s):
  - El rótulo cambia con desenfoque; por eso «My Expenses» sale borroso en ref-01.
  - La cifra rueda de $2,4799.00 a −$2,0599.00.
  - El delta se invierte (▲ 6.9 % → ▼ 4.9 %).
  - El bloque de texto sube para hacer sitio.
  - Las barras se cambian por líneas.
  - La lista sube desde abajo.

### 1.5 ref-01 · t ≈ 12.2 s · «My Expenses» (líneas entrelazadas + guía + lista)

- **Composición [O]:**
  - Mismo margen izquierdo: rótulo, cifra «−$2,0599.00» y delta «▼ 4.9 % From last week».
  - Gráfica de **3 series senoidales entrelazadas** (Jan…Jul, ~70 % del ancho).
  - Una **guía vertical** (línea de tinta de 2 px con un punto de r ≈ 7 en la cima) en «Jun». La píldora oscura «$1948.07»
    va a su **izquierda**: se volteó porque está cerca del borde derecho.
  - Abajo, una tarjeta-lista blanca (radio ~24 px, sombra muy suave) con 3 filas. Cada fila lleva un icono pastel en un
    cuadro redondeado, «Food / Healthcare / Electricity» y «+$15.75» con los decimales en gris claro.
- **Jerarquía:** cifra > gráfica + tooltip > lista > rótulo.
- **Tipografía [O]:** igual que en 1.4. La lista va en 20 px regular. Los montos tienen dos tonos: entero en tinta,
  decimales en gris claro.
- **Color [O]:** la serie principal es tinta de 3 px; las secundarias, gris medio y gris claro de 1.5 px. Los iconos de
  fila son pastel (rosa, coral).
- **Profundidad [O]:**
  - El rótulo «My Expenses» está desenfocado porque todavía entra con blur-in.
  - Las curvas claras tienen eco cerca de la guía y la píldora tiene dígitos fantasma: la guía se desplaza, el valor
    rueda y las curvas **ondulan** (la fase se mueve).
  - La tarjeta-lista tiene bordes blandos porque acaba de subir.
- **Movimiento [I]:**
  1. Hacia 10.6–11.6 s las líneas se dibujan de izquierda a derecha (~1.0 s, `power2.inOut`, series escalonadas ~0.1 s).
  2. Hacia 11.2–12.8 s la guía recorre el eje con el tooltip pegado y el valor rodando (1.5–2 s, `power1.inOut`). Las
     curvas ondulan suavemente a su paso.
  3. La lista sube (~0.6 s, `expo.out`) y sus filas entran escalonadas cada 0.06 s.
  4. De 12.7 a 14.4 s viene el cierre: el grupo final de sonido, probablemente un barrido o whoosh de vuelta al inicio
     para el loop de Instagram.

### 1.6 Constantes de estilo de la referencia y su traducción a SUSAN

| Aspecto | Referencia | SUSAN a 1920×1080 |
|---|---|---|
| Tipografía | Grotesca neutra; las cifras **nunca** en bold; tracking de −0.01 a −0.02 em en cifras | Hanken Grotesk 400/500/600, `font-variant-numeric: tabular-nums` |
| Escala UI | rótulo : cifra : delta ≈ **1 : 1.55 : 0.75**; eje ≈ 0.6 | En panel: rótulo 30, cifra 48–64, delta 22–24, eje 20 px. Cifra héroe 120–160 px (razón ~1 : 4) |
| Acento | Un solo oscuro casi negro: tooltip, bloque, serie principal, botón «+», cursor | `--primary` `#1E1919`, que ya es el botón primario de SUSAN |
| Escalera de grises | Tinta / gris medio / gris claro | `#1E1919` / `#6F6A65` / `#D8D2CA`–`#E7E2DC` |
| Lienzo de datos | Gris neutro muy claro | Crema `#F7F5F2` |
| Paneles | Blanco, radio 24–36, sombra ambiental muy difusa | Blanco, radio de la app × E: 14 × E (tarjetas; 28 px a E = 2) / 18 × E (panel; 36 px a E = 2), ver DISENO-APP §1.6. Sombra solo en el objeto **flotante** del video, nunca en las tarjetas internas (decisión abierta, ver LECCIONES-V3 §5) |
| Color semántico | Verde ingreso / rojo transferencia, diminuto y con texto | Estados de SUSAN **con etiqueta**: `presente #1F7A47`, `retardo #9A6408`, `ausente #B3261E`, `justificado #1F5FA8` |
| Momento héroe | Cielo cian + holograma rosa-coral-ámbar-lila | Cielo `tono-azul #E6EEFC` → crema. Holograma = `DEGRADADO` real de la portada «Pasar lista» (`TarjetaPortada.jsx`: `#FF6AA9 #FFB36B #8BE3B5 #6BB8FF`, DISENO-APP §1.3/§3.3). **No** los `gradient-a..d` de la v3, que no existen en la app |
| Iconos | Línea fina de 1.5 px | Lucide 1.5–1.75 (`assets/icons/`) |
| Densidad | 3–8 palabras por pantalla y una cifra protagonista | Igual: ≤ 8 palabras por bloque, una cifra por plano |

---

## 2. La gramática de movimiento en 15 técnicas, traducidas a HyperFrames

Contrato común (de `hyperframes-animation/rules-index.md`): un solo timeline GSAP pausado, `fromTo` con estado inicial
explícito (`immediateRender:false` cuando se retoma un objetivo), sin `Math.random`/`Date.now`, y solo `transform`,
`opacity`, `filter`, `clip-path` y trazos SVG. Nunca `width`/`height`/`top`/`left`.

### 2.0 Resumen

| # | Técnica | Captura | Regla o blueprint HF más cercano | Pieza de registro más cercana | Coste de render |
|---|---|---|---|---|---|
| T1 | Rack focus de apertura + alejamiento | 02→03 | `depth-of-field-blur`; `transitions/css-blur.md` «Blur Through» | `focus-blur-resolve`, `focus-rack` | **Alto** (blur a cuadro completo) |
| T2 | Aterrizaje con estela de movimiento | 03, 04, 01 | `references/motion-blur.md`, `motion-blur-streak` | `motion-blur`, `gloss-sweep`, `shutter-slam` | Medio (N+1 copias por objetivo) |
| T3 | Tarjeta con pose 3D suave y flotación | 03 (+ BRIEF) | `split-tilt-cards`, `3d-page-scroll`, `sine-wave-loop` | `tilt-card`, `camera-rig-depth-stack`, `device-frame-stage` | Bajo |
| T4 | Superficie holográfica + barrido especular | 02, 03, 05 | `ambient-glow-bloom` (sheen de una pasada) | `gloss-sweep`, `shimmer-sweep`, `light-sweep-pass`, `mesh-gradient-bg` | Bajo–medio |
| T5 | Fondo de cielo pastel con paralaje (+ grano) | 03, 05 | `device-surface-showcase` («drifting mesh-gradient backdrop») | `mesh-gradient-bg`, `mk-background`, `grain-overlay` | Bajo |
| T6 | Panel de vidrio + hoja que sube + filas escalonadas | 05 | `anchored-layout-expand`, `waterfall-entry`, `grid-card-assemble` | `sheet-spring-up`, `share-sheet-carousel`, `device-frame-stage` | **Alto** con `backdrop-filter`; bajo con vidrio falso |
| T7 | ~~Cursor que llega y toca la barra de pestañas~~ → **pulso sin cursor** (BRIEF: SIN CURSOR) | 05 | `press-release-spring`, `physics-press-reaction` (solo el objetivo); ✗ `cursor-click-ripple`, ✗ `cursor-ui-demo` | `tabs-slide-indicator` | Bajo |
| T8 | Cifra protagonista con rodillo de dígitos + delta | 04, 01 | `vertical-spring-ticker`, `counting-dynamic-scale`, `dataviz-countup` | `number-wheel`, `number-pop-in`, `count-up` | Bajo |
| T9 | Texto que entra desde el desenfoque | 01 | `transitions/css-blur.md`, `techniques.md §10` | `soft-blur-in`, `blur-in`, `blur-out-up` | Bajo |
| T10 | Barras finas en rampa con barrido + bloque resaltado | 04 | `stat-bars-and-fills` | `animated-bar-chart`, `chart-story`, `data-chart` | Bajo |
| T11 | Tooltip en píldora inclinada que salta | 04, 01 | `spring-pop-entrance`, `chart-scrub-readout` | `micro-transitions`, `badge-pop` | Bajo |
| T12 | Líneas entrelazadas que se dibujan + guía con valor | 01 | `svg-path-draw`, `chart-scrub-readout` | `mk-line-graph`, `chart-story`, `decline-chart` | Bajo |
| T13 | Relevo con elemento compartido (morph de pantalla) | 03→05, 04→01 | `card-morph-anchor`, `theme-crossfade-morph`; keyframes «Shared element / FLIP» | `card-resize`, `parallax-unzoom`, `parallax-zoom` | Bajo |
| T14 | Empuje con velocidad igualada + desenfoque (cambio de mundo) | 05→04 | `cut-catalog.md` (zoom-through / cut the curve), `viewport-change` | `zoom-through-transition`, `transitions-push`, `screen-flow-carousel` | Medio (blur breve) |
| T15 | Acentos sonoros y brillo pegados al fotograma | todo | `hyperframes-audio`; `/media-use` para resolver SFX | Sin pieza de «destello» en el registro | — |

### T1 · Rack focus de apertura + alejamiento (ref-02 → ref-03)

- **Receta.** Envolver la escena en `.world` y usar dos capas: `#plate-blur` (desenfocada) y `#plate-sharp` (DOM vivo).
  - **t = 0:** plate-blur con opacidad 1 y escala 1.12; plate-sharp con opacidad 0, `--dof: 12px` y escala 1.12.
  - **0.15 → 0.75 s:** opacidad de sharp 0 → 1 (`power1.inOut`).
  - **0.15 → 1.05 s:** `--dof` de sharp 12 → 0 px (`power2.out`: enfoca rápido y afina al final).
  - **0.35 → 0.85 s:** opacidad de plate-blur 1 → 0.
  - **0 → 1.3 s:** escala de `.world` 1.12 → 1.0 (`power3.out`).
  - **0.9 → 1.3 s:** lo secundario (título, píldora) entra con blur-in de texto (T9).
- **Cómo hacer la capa desenfocada.** Lo más barato es una **imagen** pre-desenfocada:
  1. `npx hyperframes snapshot . --at <t>` del primer fotograma nítido.
  2. `ffmpeg -i snap.png -vf gblur=sigma=18 plate.png`.

  Exige que el contenido nítido no se mueva durante el fundido; si se mueve, usar un duplicado DOM con `filter: blur(24px)`
  estático. **No** tweenear el radio entre 40 y 0 px sobre el cuadro completo.
- **Coste.** El blur cuesta radio × área. En Linux el render suele ir por GL por software (`render` imprime «software
  gpu»), y la CLI advierte que las composiciones pesadas pueden atascarse ahí. La regla `depth-of-field-blur` pone el tope
  en ~24 px sobre superficies grandes y recomienda apoyarse en la atenuación de opacidad. Un `filter` estático también se
  compone en cada fotograma, porque el render es por capturas. Para medirlo:
  `npx hyperframes render -c compositions/<escena>.html --quality draft` y leer el tiempo de `capture`.
- **HyperFrames.**
  - Regla `depth-of-field-blur` (variante «rack focus»: preparar con `gsap.set` el plano pre-desenfocado antes del rack).
  - `transitions/css-blur.md` «Blur Through»; `overview.md`, energía calma: 20–30 px, 0.8–1.2 s, retención de 0.3–0.5 s.
  - Registro: `focus-blur-resolve` (componente: enfoque desde un desenfoque fuerte hasta texto nítido) y `focus-rack`
    (componente: cambio de foco entre dos tarjetas a distinta profundidad, con blur, atenuación, escala y paralaje).
  - Descartado: `rack-focus` (bloque WebGL con bokeh poligonal y un exterior nocturno propio; otro estilo y coste alto).
- **Sonido:** `soft-in` en 0.0 y `sheen-s` en el instante en que el foco se traba (~0.9 s).

### T2 · Aterrizaje con estela de movimiento (ref-03: bordes repetidos; ref-04/01: dígitos fantasma)

- **Receta.** Tarjeta con `fromTo {y: 60, scale: 1.12} → {y: 0, scale: 1}` en 0.9 s, `expo.out`. Marcar **solo** la
  tarjeta con `data-hf-motion-blur='{"shutterAngle":180,"samplesPerFrame":8}'` (componente `motion-blur`). La estela
  aparece en los primeros 0.2–0.3 s, cuando la velocidad es alta, y desaparece al posarse. Para un rodillo de cifra (T8),
  la misma marca en las columnas de dígitos con `shutterAngle` 360.
- **Cuándo no usarla** (`references/motion-blur.md`): en fundidos, blur-ins, derivas lentas, paralaje y texto que hay que
  leer en ese momento. Usarla de 1 a 3 veces por composición, en los golpes que «se clavan».
- **Coste.** Cada objetivo cuesta N+1 copias de su subárbol y N+1 seeks por fotograma (16 por defecto; con 8 se reduce a la
  mitad). Máximo ~3 objetivos por escena. La opción `motionBlur` del motor desenfoca todo el cuadro y no se ve en la vista
  previa; en la 0.8.134 no tiene bandera en `render --help` (REFERENCIA-2 §3.1): no planear con ella.
- **Ojo en sub-composiciones** (nota de la crítica, ver REFERENCIA-2 §3.1): según el encabezado de `extended-keyframe`,
  la copia DOM de `motion-blur` no es segura dentro de clips temporizados. Antes de usarla en un cuadro, verificar con
  `snapshot` en los bordes del clip; si falla, usar `attachMotionBlurFilter` o la estela SVG ligada a la velocidad de
  REFERENCIA-2 §3.1.
- **HyperFrames.**
  - `hyperframes-animation/references/motion-blur.md` y la regla `motion-blur-streak` (forma eco/fantasma, más barata).
  - `motion-blur`: componente de obturador estilo AE, medido contra un export real.
  - `shutter-slam`: el caso de referencia AE.
  - `gloss-sweep`: la tarjeta aterriza con un golpe contenido, recibe un brillo especular diagonal y queda quieta. Es casi
    exactamente ref-03.

### T3 · Tarjeta con pose 3D suave y flotación

- **Evidencia.** Las capturas son casi frontales: la profundidad la venden la escala, el desenfoque y la sombra. La pose 3D
  la pide el BRIEF y debe ser **mínima**. Además, en la v2.3 la persona dueña **vetó la rotación y las tarjetas
  inclinadas** (LECCIONES-V3 §3.6). Hay que enseñarlo en la hoja de bocetos antes de construirlo.
- **Receta.**
  - Escena con `perspective: 1600px` y tarjeta con `transform-style: preserve-3d`.
  - Entrada: `rotationX 8 → 0`, `rotationY −10 → 0`, `z −160 → 0`, `y 40 → 0` en 1.0 s, `power3.out` (topes
    unificados con DISENO-APP §3.7: |rotationX| ≤ 8°, |rotationY| ≤ 10°).
  - La pose termina en 0° o en ≤ 3° de reposo.
  - Reposo (solo si la toma dura > 2 s sin otro movimiento): un único tween `ease: "none"` desde el final de la entrada
    hasta el corte, cuyo `onUpdate` escribe `rotationY = 1.2·sin(2πt/3.2)` e `y = 3·sin(…)` (`sine-wave-loop`, amplitud
    baja).
  - La sombra va en una capa aparte (div con `radial-gradient`, nunca `box-shadow` animado) y se desplaza en sentido
    opuesto a la inclinación (`split-tilt-cards`: la sombra sigue el sentido del giro).
- **Advertencias.**
  - `filter`, `opacity < 1`, `overflow: hidden` y `mix-blend-mode` en un ancestro **aplanan** el contexto 3D. El blur y la
    opacidad van en un wrapper exterior al escenario 3D o en hojas.
  - «La escala sola es profundidad falsa» (keyframes §3D): usar `z` y perspectiva.
  - Nada de «respiración perezosa» (`motion-language.md` Parte 2): el reposo es opcional y nunca compite con la lectura.
- **HyperFrames.**
  - Reglas `split-tilt-cards` (TILT 10–18°, perspectiva 1000–2400 px; para SUSAN usar la mitad), `3d-page-scroll` (la app
    real como tarjeta inclinada con contenido que se desplaza) y `sine-wave-loop`.
  - `tilt-card`: capas de profundidad con paralaje tipo hover.
  - `camera-rig-depth-stack`: pila de tarjetas 3D con paralaje y cambio de foco.
  - `device-frame-stage`: teléfono como utilería que sube, se asienta y flota, con una ranura de pantalla para UI
    reconstruida.

### T4 · Superficie holográfica + barrido especular (tarjeta de ref-02/03, cabecera de ref-05)

- **Receta.**
  - **Base:** `rgba(255,255,255,.62)` más un borde interior de 1 px `rgba(255,255,255,.9)`.
  - **Capa `.holo`:** al 160 % del tamaño, con 3–4 `radial-gradient` de los cortes del `DEGRADADO` de «Pasar lista»
    (`#FF6AA9 #FFB36B #8BE3B5 #6BB8FF`; receta completa en DISENO-APP §3.3) y un `conic-gradient` suave, a opacidad
    0.75.
  - **Movimiento del holograma:** rotar y trasladar la capa (`rotation 0 → 8°`, `xPercent −4 → 4`) a lo largo de la toma y
    atarlo a la pose de T3. Usar `transform`, no `background-position`.
  - **Brillo:** una banda diagonal blanca al 20–25 % (`linear-gradient`) que cruza **una vez** en 0.6–0.8 s
    (`power2.inOut`) cuando la tarjeta aterriza. Suena `sheen`.
- **Coste.** Los degradados grandes son pintura barata. Evitar `filter: blur` para suavizar el holograma: los degradados ya
  son suaves. `mix-blend-mode` dentro de `preserve-3d` aplana el 3D, así que en una tarjeta 3D usar solo opacidad.
- **HyperFrames.**
  - Regla `ambient-glow-bloom` (variante «single-pass traveling sheen») y `gradient-text-sweep` si el holograma pasa a la
    tipografía.
  - `gloss-sweep`.
  - `shimmer-sweep`: barrido con máscara de degradado.
  - `light-sweep-pass`: una luz recorre la escena y re-sombrea cada elemento.
  - `mesh-gradient-bg`: degradado de malla render-safe con capas radiales animadas. El registro lo protege porque ahí el
    color es la pieza.

### T5 · Fondo de cielo pastel con paralaje y grano

- **Receta.**
  - Fondo `linear-gradient(180deg, #CFE0FB 0%, #E6EEFC 45%, #F7F5F2 100%)`, de tono-azul a crema.
  - 4–6 «nubes» abstractas: elipses con `radial-gradient` (bordes ya suaves, sin `filter`) en 3 planos.
  - Paralaje: cada plano se traslada en `x` de forma lineal durante la toma (lejos ~10 px/s, medio ~20, cerca ~35) y se
    multiplica por la profundidad en los movimientos de cámara.
  - Grano: PNG de ruido de 256 px en mosaico, al 3–5 % de opacidad, quieto o desplazado con `tl.set` cada 2 fotogramas
    (determinista).
- **Qué no hacer.** Fotos de nubes, el estilo de nubes pintadas tipo anime de la referencia o ilustraciones con rostros.
- **Coste.** Los degradados radiales son baratos. `grain-overlay` (componente del registro) usa CSS keyframes: hay que
  verificar que el seek lo controle, porque `sine-wave-loop` advierte que la animación CSS corre con su propio reloj y
  parpadea. Si no lo controla, usar grano estático.
- **HyperFrames.**
  - Blueprint `device-surface-showcase` («drifting mesh-gradient backdrop → `sine-wave-loop`»).
  - `mesh-gradient-bg`.
  - `mk-background`: bloque de manchas suaves que derivan sobre un color base.
  - `grain-overlay`, `grain-field`.

### T6 · Panel de vidrio + hoja que sube + filas escalonadas (ref-05)

- **Receta.**
  - **Panel flotante** (radio 32–36 px) con **vidrio falso**: dentro del panel va una copia de las capas de cielo de T5,
    recortada por el panel y contra-trasladada para que coincida. Encima, un velo blanco al 72 %, un borde de 1 px blanco
    al 70 % y la sombra ambiental en una capa aparte.
  - **Hoja:** `yPercent 100 → 0` en 0.65 s, `expo.out`, con asa.
  - **Filas:** `y 28 → 0` y opacidad 0 → 1 en 0.45 s, `power3.out`, escalonadas cada 0.07 s. Con 5–6 filas el total queda
    en ≤ 0.5 s, el tope del contrato.
  - **Desplazamiento de lista:** `y` del contenedor interno dentro de un recorte.
- **Coste.** `backdrop-filter` es lo más caro de la página porque vuelve a muestrear el fondo en cada fotograma. Además solo
  «ve» hasta su *backdrop root* (cualquier ancestro con `opacity < 1`, `filter`, `mask`, `clip-path` o `will-change` crea
  uno), y las transiciones shader (html2canvas) no lo capturan. Usarlo real solo en piezas pequeñas.
- **HyperFrames.**
  - Regla `anchored-layout-expand`: máscara + deslizamiento de hoja, sin `width`/`height`.
  - Regla `waterfall-entry` y blueprint `grid-card-assemble`.
  - `device-surface-showcase` («lateral screen slide with persistent chrome», «notification banner spring-in»).
  - `sheet-spring-up`: hoja que sube con resorte muestreado de video real. Hay que **ajustarla** a un asentamiento sin
    rebote (doctrina: suave antes que rebote).
  - `share-sheet-carousel`: bloque.
  - Solo para estudiar: `liquid-glass-widgets` y `liquid-glass-notification`. Son vidrio sobre fondo shader aurora: ni el
    estilo ni el coste encajan.

### T7 · Toque en la barra de pestañas (ref-05) — **SIN CURSOR** (BRIEF 2026-10-05)

> Corrección de la crítica: la primera versión de esta técnica usaba un cursor. El BRIEF lo prohíbe («lo del cursor no
> es necesario»). Lo que se traslada es solo la **causa → efecto** del clic; el toque se cuenta con estados de la propia
> UI (DISENO-APP §2.20, REFERENCIA-2 §3.7).

- **Receta (sin puntero).**
  - **Anticipación:** el destino recibe el halo de foco nativo de la app (`ring-4 ring-ring/30`, 8 px a E = 2) 0.15–0.2 s
    antes del «toque».
  - **Presión:** el destino se comprime (`scale` 0.95–0.97 en 0.08–0.09 s) y se recupera en 0.3 s `power3.out`
    (`press-release-spring`).
  - **Pestaña activa:** cambia en el instante de la presión + 0.04 s (fondo `#EFECE7`, icono a tinta con trazo 2, etiqueta a
    600) y el indicador se desliza en 0.3 s (`power3.out`).
  - **Onda opcional y sobria:** un anillo, escala 3, 0.5 s (`power2.out`), opacidad 0.25 → 0.
  - **La presión dispara el relevo** (T13/T14) 0.1–0.2 s después: causa y efecto.
- **HyperFrames.**
  - Reglas `press-release-spring` y `physics-press-reaction` (solo la mitad «objetivo»).
  - ✗ `cursor-click-ripple`, ✗ blueprint `cursor-ui-demo`, ✗ `press-ripple`, ✗ `oversized-cursor`: dependen de un
    puntero visible. Sus tiempos (0.5 s de llegada, toque +0.2 s, presión 0.08 s) sirven solo como referencia de ritmo.
  - `tabs-slide-indicator`: píldora que se desliza entre pestañas.
- **Sonido:** `click-soft2` (pestaña) o `tap`, exactamente al presionar; `whoosh-s` en el pico de velocidad del relevo.

### T8 · Cifra protagonista con rodillo de dígitos + delta (ref-04, ref-01)

- **Receta.**
  - Un dígito por columna enmascarada (alto = 1.2 × cuerpo, `overflow: hidden`), con `y` hasta su dígito.
  - El rodillo va de derecha a izquierda (las unidades dan más vueltas): 0.9–1.2 s, `power3.out`, escalonado de 0.04 s,
    con `tabular-nums`.
  - Sufijo y decimales en `--muted-foreground` (dos tonos, como «.75»).
  - Delta: chip con Lucide `trending-up`/`trending-down` + el texto real de la app («+4.2 pp vs. semana previa»,
    CONTENIDO §2.2/§3.7). Entra 0.2 s después con blur-in (T9). Nunca «▲» como texto.
  - En un morph (T13) el rodillo va del valor viejo al nuevo; no reinicia desde 0.
- **HyperFrames.**
  - Regla `vertical-spring-ticker`: columna enmascarada, items de alto exacto, `tabular-nums`. Usar pasos sin rebote.
  - Regla `counting-dynamic-scale` y blueprint `dataviz-countup`.
  - `number-wheel`: contador de dígitos rodantes.
  - `number-pop-in`: dígitos con blur, elevación y escalonado.
  - `count-up`: cuenta y aterriza con un pulso de escala contenido.
  - `slot-machine-roll`.
- **Sonido:** `tick-1…4` vía `sfxCount` a volumen bajo y solo en el número héroe; o un solo `blip` al aterrizar. La v3 se
  saturó de ticks (LECCIONES-V3 §4.10).

### T9 · Texto que entra desde el desenfoque (ref-01, rótulo borroso)

- **Receta.**
  - Entrada por línea o palabra: `fromTo {opacity: 0, y: 10, filter: "blur(8px)"} → {opacity: 1, y: 0, filter:
    "blur(0px)"}` en 0.5 s, `power3.out`, escalonado de 0.06 s.
  - Cambio de rótulo («My Income» → «My Expenses»): la salida dura 0.25 s (`power2.in`; blur 0 → 8, y 0 → −8, opacidad → 0)
    y se solapa 0.1 s con la entrada.
- **Límites.** Pico de 10 px en texto (`cut-catalog.md`, «Blur Logic»: a 20 px el texto se vuelve papilla). Es barato
  porque las cajas son pequeñas.
- **HyperFrames.**
  - `transitions/css-blur.md`, `css-dissolve.md` y `techniques.md §10` (transiciones con velocidad igualada).
  - `soft-blur-in`: opacidad + blur + elevación para titulares y llamadas de UI.
  - `blur-in`, `focus-blur-resolve` y `blur-out-up` (salidas).

### T10 · Barras finas en rampa con barrido + bloque resaltado (ref-04)

- **Receta barata (una sola capa):**
  - Rayas: `repeating-linear-gradient(90deg, #1E1919 0 2px, transparent 2px 6px)`.
  - Rampa (forma) y aclarado de izquierda a derecha: `mask-image`.
  - Barrido de izquierda a derecha: `clip-path: inset(0 100% 0 0) → inset(0 0 0 0)` en 0.8 s, `power2.inOut`.
  - Ola de altura: `scaleY` del contenedor 0.6 → 1 con origen abajo.
- **Receta con datos reales:** el 3A solo tiene clase Lun · Mié · Vie (CONTENIDO §3.7), p. ej. 3 días × 40 barras = 120 `<rect>` SVG con `scaleY` escalonado (`{each: 0.005}`, 0.6 s). Es
  un barrido intencional, no un grupo que llega, así que el tope de 0.5 s se puede pasar a propósito.
- **Bloque resaltado:** `scaleY 0 → 1` con origen abajo, 0.35 s, `power3.out`, 0.1 s después de que termina el barrido.
  Después va el tooltip (T11).
- **Ejes:** las etiquetas «Lun · Mié · Vie» entran con un fundido de 0.3 s (Sáb/Dom de reposición no se muestran).
- **HyperFrames.**
  - Regla `stat-bars-and-fills` (`scaleY` escalonado y barrido con `clip-path`) y blueprint `dataviz-countup`.
  - `animated-bar-chart`.
  - `chart-story`: construye en orden de lectura y aterriza en los valores exactos.
  - `data-chart`: bloque de barras + línea con tipografía estilo NYT.
- **Sonido:** `draw` o `fill` bajo el barrido; `pop-2` en el bloque.

### T11 · Tooltip en píldora inclinada que salta (ref-04; recto y volteado en ref-01)

- **Receta.**
  - Píldora en tinta `#1E1919`, texto blanco 600 con `tabular-nums`, `min-width` fija y `transform-origin: 50% 100%` (que
    apunte al bloque).
  - Keyframes: `{scale .6, rotation −16, y 14, opacity 0}` → `{scale 1.04, rotation −5, opacity 1, 0.22 s power3.out}` →
    `{scale 1, rotation −8, 0.25 s power2.out}`.
  - El valor de dentro rueda (T8) en paralelo.
- **Decisión pendiente.** ¿Queda inclinado a −8° como rasgo de estilo o se endereza a 0° en 0.3 s? La v2.3 vetó las
  rotaciones (LECCIONES-V3 §3.6): proponer las dos variantes en la hoja de bocetos. Es el **único «pop» con sobreimpulso**
  permitido (la v3 limitaba los resortes a chips e insignias).
- **HyperFrames.**
  - Reglas `spring-pop-entrance` (que ahora empieza con un asentamiento suave) y `chart-scrub-readout` (`TIP_DX/DY`;
    voltear el tooltip cerca del borde derecho, como en ref-01; `min-width` para que no «respire»).
  - `micro-transitions`: paquete con tooltip.
  - `badge-pop`.
- **Sonido:** `pop-3`.

### T12 · Líneas entrelazadas que se dibujan + guía con valor (ref-01)

- **Receta.**
  1. **Trazos:** 3 `<path>` generados a partir de los datos (Catmull-Rom → Bézier), con `pathLength="1"`,
     `stroke-dasharray: 1` y `stroke-dashoffset 1 → 0` en 1.0 s, `power2.inOut`, escalonados 0.12 s. La serie principal
     (3 px, tinta) va primero; las secundarias, 1.5 px en `#6F6A65` y `#D8D2CA`.
  2. **Guía:** una línea vertical de 2 px en tinta, con un punto de r = 7 arriba, recorre el eje movida por **un solo
     driver** `p` (`power1.inOut`, 1.6–2.2 s).
  3. **Marcador y tooltip:** el marcador va sobre la serie principal. El texto del tooltip solo se reescribe cuando cambia
     el índice, y el tooltip se voltea a la izquierda cerca del borde derecho.
  4. **Aterrizaje:** quedarse ≥ 0.8 s en el valor final.
  - **Opcional («ola viva»):** desplazar la fase de las curvas en un `onUpdate` determinista (`sin`), con amplitud ≤ 2 %,
    mientras pasa la guía. Eso producía el eco de ref-01. Cuidar que no estorbe la lectura.
- **HyperFrames.**
  - Reglas `svg-path-draw` y `chart-scrub-readout` (la gráfica ya existe cuando empieza el scrub; dibujar ANTES de
    recorrer y no mezclarlos).
  - Blueprints `dataviz-countup` (variante «dark-scrub-montage») y `panel-edit-live-sync`.
  - `mk-line-graph`: 1–2 series que se dibujan con las etiquetas montadas en el frente del trazo.
  - `chart-story`.
  - `decline-chart`: una línea baja mientras el valor cuenta hacia abajo y el fondo se oscurece en sincronía. Sirve para
    «el ausentismo baja».
  - `data-chart`.
- **Sonido:** `draw` al empezar el trazo, `scan` muy bajo bajo la guía y `blip` al aterrizar.

### T13 · Relevo con elemento compartido (ref-03 → ref-05, ref-04 → ref-01)

- **Receta.**
  - **Mismo sub-composition.** La identidad no cruza el límite de una escena salvo con un ancla **idéntica al píxel** en el
    corte (`card-morph-anchor`).
  - **FLIP manual:** declarar la caja de origen y la de destino como **constantes** (no medir el DOM en multi-escena).
    Tween de `x, y, scale` en 0.7–0.9 s, `power3.inOut` (o `expo.inOut` si el viaje es grande). El radio y el fondo se
    animan como canales de pintura.
  - **Contenidos internos:** se cruzan; los viejos salen antes del 40 % del viaje y los nuevos entran después del 60 %.
  - **Pantalla → panel:** `scale 1 → 0.62` y radio aparente 0 → 36 px (compensado por la escala). El cielo aparece
    alrededor con paralaje.
  - **Barras → líneas:** las barras colapsan a su línea de cima (`scaleY → 0.02`, 0.3 s, `power2.in`) mientras la línea se
    dibuja desde la izquierda (0.8 s). Luego la lista sube (T6) y el rótulo y la cifra cambian en sitio (T9 + T8).
- **HyperFrames.**
  - Reglas `card-morph-anchor` (escala uniforme en lugar de `width`/`height`; `borderRadius`/`background`/`boxShadow` solo
    como pintura; nunca `back`/`elastic`), `theme-crossfade-morph` y `scale-swap-transition`.
  - `hyperframes-keyframes`, mecanismo «Shared element / FLIP».
  - `card-resize`: una tarjeta compacta se expande a panel de detalle.
  - `parallax-unzoom`: una tarjeta a pantalla completa se encoge mientras las hermanas entran con paralaje. Es casi
    exactamente ref-03 → ref-05.
  - `parallax-zoom` (el inverso) y `page-slide`.

### T14 · Empuje con velocidad igualada + desenfoque (cambio de mundo, ref-05 → ref-04)

> Nota de la crítica: «cut the curve», «zoom-through» e «inverse zoom» de `cut-catalog.md` son **costuras dentro de un
> cuadro** (las construye el worker). Entre cuadros solo valen los 5 `transition_in` del registro
> (`crossfade`, `blur-crossfade`, `push-slide`, `zoom-through`, `squeeze`; PLAYBOOK §3.5) o un corte con
> `handoff_out`/`handoff_in` idénticos. Si el cambio de mundo debe verse como esta receta, va **dentro** de un cuadro.

- **Receta (`cut-catalog.md`).**
  - **Cut the curve:** salida en `power4.in` (0.3 s, `y 0 → −230` o `scale 1 → 1.35`), entrada en `power4.out` con la
    misma distancia y duración, y el corte en el pico de velocidad.
  - **Opacidad:** la de salida termina al 25–30 % del recorrido.
  - **Blur en el wrapper:** el mismo pico a ambos lados, **18–20 px** en superficies de cuadro completo y **10 px** si el
    sujeto es texto.
  - **Cuál usar:** zoom-through para un cambio de capítulo e inverse zoom para una llegada o remate.
- **Coste.** Un blur de cuadro completo durante ~0.3 s (≈ 9 fotogramas) es aceptable si no se alarga. Preferir
  transiciones CSS a las shader, porque html2canvas no captura `backdrop-filter` ni `var()` y exige fondos explícitos
  (`transitions/overview.md`). Las disoluciones lavan a crema (auditoría v3, LECCIONES-V3 §3.3): evitar los crossfades
  largos.
- **HyperFrames.**
  - `product-launch-video/references/cut-catalog.md`.
  - `transitions/overview.md`: energía media 0.3–0.5 s con `power2/3`; momentos héroe 0.15–0.3 s.
  - Reglas `viewport-change`, `coordinate-target-zoom` y `nudge-curve` (lento-rápido-lento para reposicionar un grupo).
  - `zoom-through-transition`.
  - Muestrarios para estudiar: `transitions-push`, `transitions-blur` y `transitions-scale`.
  - `screen-flow-carousel`: pantallas en un riel con lanzamiento de velocidad igualada.

### T15 · Acentos sonoros y brillo pegados al fotograma («Typing + Enter», «Sparkle Whoosh»)

- **Visual.** El «destello» de la referencia se traduce en **brillo** (T4): un barrido de luz sobre la tarjeta o la cifra
  en 3–4 momentos héroe. **Sin iconos de estrella o destello**, por preferencia de la persona dueña (LECCIONES-V3 §3.6).
  La búsqueda «sparkle» del registro no devuelve nada útil (solo `stop-motion-cadence`).
- **Sonido.** Equivalencias con el catálogo `assets/sfx/CATALOG.json`; cada efecto se ancla a su `picoMs`:

  | Pieza de la referencia | Equivalente en el catálogo |
  |---|---|
  | «Sparkle Whoosh» | `whoosh-s` (pico de velocidad, 101 ms) seguido 60–90 ms después de `sheen-s` |
  | «Typing + Enter» | `key-*` vía `sfxType` + `key-enter`/`type-enter` (solo si se teclea algo) |
  | Llegadas | `soft-in` (panel), `pop-1…4` alternando alturas (chips), `thud` (peso) |
  | Interacción | `click-soft2`/`tap` |
  | Datos | `draw`/`fill`/`scan`/`blip` |
  | Cambio de capítulo | `whoosh-m`/`whoosh-l`; `riser-s` termina **en** el impacto |

  `sparkle-short` está obsoleto: usar `sheen`. Nada de `whoosh-rev` antes de la voz del cierre.
- **HyperFrames.** `/media-use` para resolver o generar los SFX que falten y `/hyperframes-audio` para fades y ducking
  contra la voz. La regla `particle-burst` (≤ 40 partículas) solo si hiciera falta una ráfaga; en principio, no.

### 2.16 Costes y trampas transversales (leer antes de construir)

1. **Presupuesto de desenfoque:** como máximo una superficie grande desenfocada a la vez, ≤ 24 px y ≤ 1.2 s. Más allá,
   usar imagen pre-desenfocada (T1).
2. **`backdrop-filter`** solo en elementos pequeños; los paneles grandes llevan vidrio falso (T6).
3. **3D:** perspectiva en un padre estable. Sin `filter`, `opacity`, `overflow` ni `mix-blend` en ancestros con
   `preserve-3d`.
4. **Desenfoque de movimiento:** ≤ 3 objetivos por escena con `samplesPerFrame` 8.
5. **Sin CSS `transition` ni `@keyframes` infinitos;** todo dentro del timeline.
6. **Medir cada escena pesada** con `render -c … --quality draft` (`capture` en la línea de resumen) y el proyecto con
   `npx hyperframes benchmark`.
7. **Verificar poses** con `npx hyperframes keyframes . --selector … --shot …` y `snapshot --at` (keyframes, «CLI Proof»).

### 2.17 Búsquedas hechas en el registro (`npx hyperframes@latest catalog --query … --json`, sin instalar)

Todas devolvieron coincidencia por palabras (`tier: words`).

| Consulta | Ids relevantes (qué hacen) | Veredicto |
|---|---|---|
| rack focus blur transition | `focus-rack`; `focus-blur-resolve`; `transitions-blur` (muestrario de 20 s); `rack-focus` (WebGL con bokeh); `focus-swap` (foco entre dos tarjetas lado a lado) | Estudiar los 2 primeros; descartar `rack-focus` |
| depth of field | `camera-rig-depth-stack` (pila 3D con paralaje y cambio de foco) | Estudiar |
| 3d card tilt / iridescent card | `tilt-card`; `split-tilt-cards`; `spotlight-card` (cursor con borde iluminado) | `tilt-card` sí; las demás no aplican |
| holographic gradient | `mesh-gradient-bg`; `shimmer-sweep`; `mk-background` | Usar como base del holograma y del cielo |
| glassmorphism panel / frosted glass / liquid glass | `card-resize`; `panel-reveal`; `page-slide`; `liquid-glass-widgets`; `liquid-glass-notification`; `ios26-liquid-glass` (iPhone 3D GLTF) | Vidrio falso propio; `card-resize` para el relevo |
| line chart draw tooltip / chart scrub readout | `mk-line-graph`; `chart-story`; `decline-chart`; `data-chart`; `svg-line-draw-loader` | `mk-line-graph`/`chart-story` como guía; la guía, con la regla `chart-scrub-readout` |
| bar chart ticks | `animated-bar-chart`; `chart-story`; `bar-chart-race` | Guía; la rampa de rayas se hace a mano (T10) |
| cursor click | `press-ripple`; `oversized-cursor`; `cursor-glyph-trail` (cursor tutorial con rastro punteado) | `press-ripple` como timing |
| tab bar | `tabs-slide-indicator` | Usar como patrón |
| sky gradient clouds | Sin cielo propiamente dicho: `mesh-gradient-bg`, `mk-background` | Cielo hecho a mano (T5) |
| number count up / digit roll ticker | `number-wheel`; `number-pop-in`; `count-up`; `slot-machine-roll`; `apple-money-count` (contador financiero con estallido de iconos) | `number-wheel`/`number-pop-in`; descartar `apple-money-count` |
| sparkle / twinkle star / particle burst | Nada útil (`stop-motion-cadence`, `star-rating-fill`); `confetti` | Brillo, no partículas |
| whoosh transition / camera push zoom | Muestrarios `transitions-*`; `zoom-through-transition`; `parallax-zoom`; `push-in`; `cinematic-zoom` (shader) | `zoom-through-transition` + `cut-catalog` |
| film grain / noise texture overlay | `grain-overlay` (CSS keyframes); `grain-field`; `organic-light-leak-overlay` | Grano estático si `grain-overlay` no respeta el seek |
| motion blur / shutter slam | `motion-blur`; `shutter-slam`; `soft-blur-in`; `blur-out-up`; `gloss-sweep` | `motion-blur` + `gloss-sweep` |
| phone mockup app screen / screen carousel | `device-frame-stage`; `parallax-device-dive` (el teléfono sube y la cámara atraviesa la pantalla); `screen-flow-carousel`; `app-showcase` | `device-frame-stage` y `parallax-device-dive` para el panel |
| bottom sheet slide up | `sheet-spring-up`; `share-sheet-carousel` | Sí, quitándole el rebote |
| pill tooltip | `micro-transitions`; `lt-soft-pill`; `badge-pop` | Patrón para T11 |
| glint shine sweep / light leak | `gloss-sweep`; `light-sweep-pass`; `shimmer-sweep`; `light-leak` (shader) | Brillo con `gloss-sweep` |
| card stack parallax | `camera-rig-depth-stack`; `parallax-unzoom`; `parallax-zoom` | `parallax-unzoom` para ref-03 → 05 |

---

## 3. Ritmo

### 3.1 Planos estimados del reel (≈ 14.4 s)

| Tiempo | Mundo | Pantalla / tiempo interno | Dura | Evidencia |
|---|---|---|---|---|
| 0.0–2.8 s | cielo | **A1** rack focus + tarjeta que aterriza | ~2.8 s | ref-02 @0.6, ref-03 @1.6; SFX en 0.0–0.4 y 2.2–2.8 |
| 2.8–5.8 s | cielo | **A2** des-zoom a panel; la tarjeta se vuelve cabecera; sube la hoja; entran las filas | ~3.0 s | Capas largas desde 2.8; SFX en 4.3 y 5.7–5.9 |
| 5.8–7.8 s | cielo | **A3** lista desplazándose; cursor → clic en «Home» | ~2.0 s | ref-05 @6.9; SFX en 7.6–8.0 |
| 7.8–10.5 s | limpio | **B1** «My Income»: texto, rodillo, barrido de barras, bloque + tooltip | ~2.7 s | ref-04 @9.4; SFX en 8.6–9.0 |
| 10.5–14.4 s | limpio | **B2** morph a «My Expenses»: líneas, guía + valor, lista, cierre | ~3.9 s | ref-01 @12.2; SFX en 11.2–11.6 y 12.0–12.7 |

- **Tiempo interno:** ~2.9 s de media, con 2–3 sub-eventos cada uno (~0.8–1.2 s entre sí).
- **Escenas reales:** 2 (A ≈ 7.8 s y B ≈ 6.6 s) y un solo corte.
- **Relevos:** duran ~0.4–0.9 s y nunca dejan la pantalla vacía.

### 3.2 Diseño sonoro (línea de tiempo de Premiere)

Escala sacada de ref-04: ≈ 64 px/s, con el cabezal en x ≈ 755 = 9.43 s, coherente con `00:00:09:10`. Precisión ±0.3 s,
porque la foto está en perspectiva.

| t [E] | Capas que arrancan | Evento visual probable |
|---|---|---|
| 0.0–0.4 | A4, A9 (larga, 0–4.1), A10 (lecho de 0 a 14.4), A2, A7 | Apertura: rack focus |
| 1.3 | A5 (oleaje largo, 1.3–5.9) | Colchón bajo la tarjeta y el relevo |
| 2.2–2.8 | A7, A4, A1 (larga, 2.8–6.6), A6 | La tarjeta se asienta y arranca el des-zoom |
| 4.3 | A7 | Sube la hoja «Transactions» |
| 5.7–5.9 | A4, A2 | Filas, lista y entrada del cursor |
| 7.6–8.0 | A5 (oleaje 7.6–10.6), A7 ×2 | Clic + cambio de mundo |
| 8.6–9.0 | A3, A8 (larga), A1, A2 | Barrido de barras + bloque + tooltip |
| 10.4 | A6 | Arranca el morph Income → Expenses |
| 11.2–11.6 | A2, A3, A4 | Las líneas se dibujan y sube la lista |
| 12.0–12.7 | A3, A7, A2 | Guía + valor; cierre |
| 14.2–14.7 | Colas de A2 y A7 | Loop |

Patrones:
1. **Cada evento son 2–4 capas cortas apiladas** (transitorio + cuerpo + cola o brillo) que arrancan en ±0.1 s. Hay ~10–11
   eventos en 14.4 s, ≈ **0.75 eventos/s**, aunque se cuentan ~2.4 clips/s.
2. **Dos oleajes largos** (A5) cubren cada mitad y «pegan» los tiempos internos de cada escena.
3. **Un lecho continuo** (A10) de principio a fin, posiblemente música o ambiente.
4. El golpe cae en el fotograma en que el movimiento **llega o alcanza su máxima velocidad**: foco que se traba, tarjeta
   que se asienta, hoja que llega, clic, bloque que crece, tooltip que salta, trazo que empieza.

### 3.3 Quietud contra movimiento

En **5 de 5** capturas algo se mueve (eco de desenfoque de movimiento o blur de entrada). Estimación: **~40 % del tiempo hay
un movimiento grande** (relevo, entrada, barrido) y **~60 % micro-movimiento de datos** (rodillo, guía, lista, flotación).
La quietud total es casi nula. El ojo siempre tiene **un** punto activo: nunca hay dos movimientos grandes simultáneos en
zonas distintas.

### 3.4 Qué implica para 55 s narrados (dinámico pero legible para docentes)

- **Estructura.** No hay que copiar «un plano cada 2.9 s». Hay que copiar «**escenas continuas con relevos internos**»:
  6–8 escenas (sub-composiciones) de 5–8 s, cada una con 2–3 tiempos internos de 2.5–3 s unidos por morph o elemento
  compartido (T13). La cadencia del reel queda **dentro** de la escena. Así hay pocas transiciones reales (5–7) con 2–3
  firmas: rack focus en la apertura y un momento héroe, relevo con elemento compartido como recurso principal, y empuje con
  velocidad igualada para los cambios de capítulo (coincide con LECCIONES-V3 §5).
- **Voz.**
  - Cálculo: ~2.7 palabras/s (medido en la v3) con 60–75 % de cobertura, **~90–110 palabras**.
  - Dejar 1.0–1.5 s sin voz en la apertura (el rack focus es el gancho visual), pausas de 0.3–0.5 s en cada costura de
    escena (ahí caen los grupos de SFX) y ≥ 1.5 s de cierre en silencio con el wordmark.
  - **Listo para voz:** cada tiempo interno lleva una etiqueta GSAP (`tl.addLabel('e3-cifra', t)`) y una ventana de
    locución. Las costuras tienen ±0.3 s de holgura para re-amarrarse a la alineación real **sin estirar escenas**.
- **Duraciones (≈ 1.2–1.5× la referencia):**
  - Entradas 0.5–0.9 s; relevos 0.6–0.9 s; transiciones 0.4–0.6 s.
  - Rodillos 0.9–1.2 s; trazos 1.0–1.4 s; recorrido de la guía 1.8–2.4 s.
  - Toda cifra clave queda **≥ 1.2 s quieta**, legible, mientras algo vive en otra zona: guía, lista o deriva lenta de
    cámara ≤ 1.5 % de escala. Eso evita las colas muertas ≥ 1.0 s que hundieron a la v3 con voz (LECCIONES-V3 §3.7).
- **Movimiento.** Objetivo: ~25–30 % de movimiento grande, ~50 % de micro-movimiento de datos y ~20–25 % de lectura con
  la cifra quieta. Un movimiento grande por tiempo interno; nunca mientras la voz dice la palabra clave de esa cifra (la
  cifra llega **antes** de nombrarse y se queda quieta mientras se nombra).
- **Texto.** ≤ 8 palabras por bloque, que complementen la voz (etiquetas, cifras, kickers) y no la repitan. Cifra héroe de
  120–160 px; etiquetas UI ≥ 26 px. El contenido clave queda en y ≤ 900 px (banda reservada del contrato del worker, PLAYBOOK §4) para dejar sitio a
  subtítulos futuros.
- **Sonido.**
  - ~0.8–1 evento/s de 2–3 capas (≈ 1–2 SFX/s en total, frente a los 4.0/s de la v3) y grupos de 3–4 capas solo en las
    costuras.
  - Con voz: SFX entre −8 y −12 dB y transitorios fuertes solo en los huecos de la voz; whooshes graves o medios, no
    agudos, sobre las palabras.
  - No hay lecho continuo (no hay música). La voz llena; en la apertura y el cierre, un `soft-in` o un oleaje bajo hacen
    de colchón.
- **Densidad de cortes.** Ningún corte real antes de 2.5 s desde el anterior, salvo una sola ráfaga de montaje (3 × ~1.8 s)
  sin texto crítico, si el guion la pide.

---

## 4. Qué NO copiar (y con qué sustituirlo)

**Fuera por completo:**
- Paneles y línea de tiempo de Premiere y AE, interfaz de Instagram, barra de estado del teléfono, el texto «POV…» y los
  artefactos de grabar una pantalla (moiré, trapecio, reflejos, dominante cian).
- Marcas reales: Starbucks, Netflix, Apple, VISA, Zenvest, el chip EMV y el ícono de pago sin contacto. También el lenguaje
  de dinero ($, ingresos, gastos, transferencias).
- Las nubes pintadas tipo anime y cualquier foto de cielo; los rostros reales (avatares abstractos de
  `assets/avatars/`).
- **Cualquier cursor o mano** (BRIEF: SIN CURSOR; ni la flecha macOS ni `mouse-pointer-2`), el «▲/▼» como texto (usar Lucide `trending-up`/`down`) y
  los iconos de línea que no sean Lucide.
- El fleco cromático y los bordes repetidos tal cual: son artefactos del desenfoque de AE con pocas muestras y de la
  foto. Si hay estela, que sea la del componente `motion-blur`, limpia.
- La composición cuadrada con un teléfono al centro: el 16:9 se re-maqueta (abajo).
- La velocidad del reel aplicada al video entero: es un loop sin voz ni texto que leer.
- La «flotación» como relleno: la doctrina prohíbe la respiración perezosa (`motion-language.md` Parte 2).

**Choques con la identidad de SUSAN a decidir en la hoja de bocetos** (ver también LECCIONES-V3 §3.6 y §5):
- **Inclinación 3D y tooltip girado.** La persona dueña vetó la rotación en la v2.3, pero ahora pide este lenguaje. Mostrar
  la pose 3D ≤ 8° y el tooltip inclinado con su alternativa recta.
- **Sombra suave.** La app es «sin sombra» (Dash). Proponer sombra solo en el objeto flotante del video.
- **Radios.** 24–36 px en la referencia contra 14/18 px en SUSAN. Interior de la app con los radios de SUSAN; el «panel
  dispositivo» del video puede usar 28–36 px.
- **Botones.** «Order a card» es una píldora; en SUSAN los botones son `rounded-md` de 8 px (las píldoras son para chips y
  filtros).

**Traducción de elementos (referencia → SUSAN):**

| Referencia | SUSAN (datos canónicos: `CONTENIDO.md` §3; corregido por la crítica, ver `SINTESIS.md`) |
|---|---|
| Pantalla «Cards» + tarjeta holográfica «Zenvest» | Tarjeta del grupo «3A · Administración Financiera · 24 inscritos». Holograma = `DEGRADADO` de la portada «Pasar lista» (`#FF6AA9 #FFB36B #8BE3B5 #6BB8FF`, DISENO-APP §3.3). Wordmark «SUSAN» en lugar del logo; ficha de icono Lucide (`scan-face`/`users`) en lugar del chip |
| «Order a card» | Botón primario real «Abrir y pasar lista» (tinta, radio 8 × E, Lucide `scan-face` + `arrow-right`; DISENO-APP §2.5) |
| Panel de cuenta + «Send / Received» + «+» | Cabecera del grupo con «Presentes / Ausentes» y acción circular |
| Hoja «Transactions», filas con logo + monto + estado | Lista de asistencia: avatar abstracto + nombre + hora + `StatusChip` (Presente / Retardo / Ausente, siempre con texto) |
| Barra de pestañas Home / Statistic / Card… | Barra inferior móvil real: **Panel · Revisión · [Pasar lista] · Reportes · Analítica**, con el botón central circular de tinta `scan-face` (`capture/app-real/mobile/10-docente-home.png`; DISENO-APP §2.2) |
| «My Income» con barras Sun…Sat + bloque + tooltip | Patrón semanal (`ui/TiraSemana`): solo **Lun · Mié · Vie** (horario del 3A); el bloque marca el día crítico; tooltip «Vie · 21.8 %» / «Día crítico: Viernes» (CONTENIDO §3.7) |
| «My Expenses» con 3 líneas + guía + tooltip | `ui/GraficaLinea` real de Analítica 3A: Observada S1–S6 (13.3 → 20.8 %), Ajuste, Proyección a S15 (24.8 %) con banda del 95 % y EMA dorada; la guía lee «Semana N · x %». **Sin** la marca «Límite 20 %» en esta gráfica (es tasa semanal, no faltas acumuladas: trampa 4 de CONTENIDO §3.11) |
| Cifra «$2,4799.00» + «▲ 6.9 % From last week» | Cifra «20.8 %» con chip `trending-up` «+4.2 pp vs. semana previa» (Analítica), o «88 %» «Presentes ahora» (sesión en vivo), o «9 alumnos en riesgo» |
| Lista Food / Healthcare / Electricity | Top de alumnos o grupos en riesgo (`ui/TarjetaFila`), con icono en una ficha pastel `tono-*` |
| Cielo cian | Cielo `tono-azul` → crema; solo en los momentos héroe (apertura, tarjeta del grupo, cierre) |
| Lienzo gris de datos | Lienzo crema `#F7F5F2` con el panel blanco de la app |

**Maquetación 16:9.**
- La referencia es una columna centrada en ~1:1. En 1920×1080, el objeto de UI héroe va a 45–60 % del ancho, en un tercio,
  y el otro tercio queda para la cifra o el kicker que acompaña a la voz.
- Las gráficas sí aprovechan el ancho: la rampa de barras y las líneas pueden ocupar 70–80 % del ancho, con el bloque de
  cifra arriba a la izquierda (mismo margen ~10–12 %).
- Zona segura de acción: 90 % del cuadro (1728×972).

---

## 5. Look & feel objetivo (párrafo para pegar en «Video direction»)

Motion graphics de UI limpia y luminosa, con el pulso de un reel de After Effects. Las pantallas de SUSAN se reconstruyen
en HTML y flotan sobre el lienzo crema; en tres momentos héroe (la apertura, la tarjeta del grupo y el cierre) flotan
sobre un cielo pastel que va del azul tenue a la crema, con el degradado holográfico rosa-durazno-menta-azul de la portada «Pasar lista»
reservado para la tarjeta. Cada escena es un plano continuo. El rack focus abre desde el desenfoque total mientras la cámara se aleja; la
tarjeta aterriza con una estela breve y un solo destello de luz; la pantalla se encoge a panel; la hoja sube; sin cursor,
la pestaña se enciende (halo de foco y compresión) y ese pulso provoca el siguiente estado; las barras se vuelven líneas. Los relevos se hacen con elementos
compartidos y empujes con velocidad igualada, no con disoluciones, y se usan 2–3 transiciones firma en todo el video. Las
curvas son largas y suaves (`power3`/`expo.out` para llegar, `power3/expo.inOut` para viajar, 0.5–0.9 s), sin rebotes,
salvo la píldora del tooltip. Los datos se mueven con sentido: las cifras ruedan, las líneas se dibujan y una guía las
lee con un tooltip de tinta, las barras finas barren y un bloque de tinta marca el día con más faltas. Hay un solo acento
oscuro (la tinta de SUSAN) para lo importante, los grises en tres escalones y los estados de asistencia con su color y su
etiqueta. La profundidad sale del enfoque selectivo, sombras amplias y muy suaves solo en el objeto flotante, y una pose
3D apenas perceptible. El ritmo es de reel pero legible: escenas de 5–8 s con tiempos internos de 2.5–3 s, cada cifra
clave quieta al menos 1.2 s, nunca dos movimientos grandes a la vez, y un diseño sonoro de golpes breves en capas (whoosh,
clic, tic, brillo) pegado al fotograma exacto en que el movimiento llega, con huecos para la voz.
