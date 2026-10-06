---
version: v4
name: SUSAN v4 — Frame (capa de video)
description: >
  Verdad de diseño del video de lanzamiento de SUSAN (16:9, 1920×1080, ~55 s). UI de la app recreada fiel (crema,
  panel blanco, tinta como único acento estructural, oro como chispa única, estados con texto, Hanken Grotesk, Lucide,
  radios de la app × E, bordes finos, sin sombra interna) sobre un escenario de reel (cielo, holograma, lienzo con halo,
  inclinación 3D suave, desenfoque) hecho solo con colores derivados de tokens. Sin cursor. Base: build-frame.mjs con el
  preset blue-professional, reescrito con los valores reales de capture/app-real/tokens y plan/DISENO-APP §1.10.
unit: "1920×1080 · zona de acción 1728×972 · contenido clave en y ≤ 900"

# «canvas» debe ser la PRIMERA clave que coincide: el ensamblador pinta con ella el fondo del video.
colors:
  canvas: "#F7F5F2"            # lienzo crema
  ink: "#1E1919"               # texto, botón primario, tooltip, botón central
  card: "#FFFFFF"              # panel y tarjetas, siempre opacas
  muted: "#F0EDE8"             # pistas, píldora inactiva, vidrio del medidor, anillo vacío
  muted-foreground: "#6F6A65"  # texto secundario, ejes, lema del cierre
  border: "#E7E2DC"
  input: "#D8D2CA"             # campos y botón secundario
  hover-accent: "#EFECE7"      # hover, destino activo del BottomNav
  sidebar-accent: "#EBE8E3"    # ítem activo del riel
  primary-hover: "#3A3433"     # pulso del botón sin cursor
  brand-gold: "#A8842C"        # chispa: a lo sumo UN elemento por cuadro, nunca texto < 48 px (en la v4 no se usa: §2.3)
  brand-gold-soft: "#F6EDD3"
  info: "#0061FE"              # enlaces y halo de foco, nunca marca

# [texto, fondo -bg, trazo/área de gráfica]. Siempre con su etiqueta.
estados:
  presente: ["#1F7A47", "#E3F4EA", "#27A06A"]
  retardo: ["#9A6408", "#FBEFD2", "#C98100"]
  ausente: ["#B3261E", "#FBE4E1", "#DE4D44"]      # también «Sin registro»
  justificado: ["#1F5FA8", "#E1EDFA", "#4A86F0"]  # también el chip «Automático»
  pendiente: ["#5B5651", "#EEEBE6", "#8F8A82"]
  limite: "#B3261E"
graficas: { g-azul: "#4A86F0", g-violeta: "#8B6FE0", g-dorado: "#A8842C", observada: "#1E1919" }
# [fondo, trazo]; el fondo es también el halo del escenario E3
tonos:
  azul: ["#E6EEFC", "#1D5FD1"]     # Panel, Pasar lista, cámara
  dorado: ["#FBF1D9", "#A8842C"]   # Revisión
  verde: ["#E5F3EE", "#1F7A47"]    # Reportes, confirmación
  violeta: ["#EEE9F7", "#6F4FB3"]  # Analítica
  rosa: ["#FBE6E2", "#C2410C"]     # alertas, riesgo
escenario:
  degradado: "linear-gradient(105deg,#FF6AA9 0%,#FFB36B 28%,#8BE3B5 58%,#6BB8FF 100%)"
  sombra-crema: "0 40px 120px rgba(30,25,25,.14), 0 8px 24px rgba(30,25,25,.08)"
  sombra-cielo: "0 40px 120px rgba(29,95,209,.14), 0 8px 24px rgba(29,95,209,.08)"
  placa-tinta: ["#1E1919", "#F3F0EC", "#D9B65C"]

# app × E (E = 2): nunca radios «de reel» fijos en la UI interna
radii: { kbd: "8px", sm: "12px", md: "16px", lg: "20px", xl: "28px", 2xl: "36px", bottomnav: "56px", tanque: "48px", pill: "999px", objeto-escenario: "36–56px" }

# appPx = clase de la app (se escribe así dentro de .ui con zoom); px = resultado en video a E = 2
typography:
  body:        { fontFamily: "Hanken Grotesk", appPx: 14, px: 28, weight: 400, lineHeight: 1.5 }
  meta:        { fontFamily: "Hanken Grotesk", appPx: 12, px: 24, weight: 500, color: "muted-foreground" }
  eje:         { fontFamily: "Hanken Grotesk", appPx: 11, px: 22, weight: 400, color: "muted-foreground" }
  stat-label:  { fontFamily: "Hanken Grotesk", appPx: 13, px: 26, weight: 500, color: "muted-foreground" }
  row-title:   { fontFamily: "Hanken Grotesk", appPx: 14.5, px: 29, weight: 500, lineHeight: 1.375 }
  card-title:  { fontFamily: "Hanken Grotesk", appPx: 16, px: 32, weight: 600, tracking: "-0.025em" }
  section:     { fontFamily: "Hanken Grotesk", appPx: 20, px: 40, weight: 600, tracking: "-0.025em" }
  page-title:  { fontFamily: "Hanken Grotesk", appPx: 26, px: 52, weight: 500, tracking: "-0.025em" }
  stat-value:  { fontFamily: "Hanken Grotesk", appPx: 30, px: 60, weight: 600, lineHeight: 1, tracking: "-0.025em" }
  gauge-value: { fontFamily: "Hanken Grotesk", appPx: 36, px: 72, weight: 600, tracking: "-0.025em" }
  hero-number: { fontFamily: "Hanken Grotesk", px: "120–180", weight: "500–600", tracking: "-0.03em", unit: "0.45–0.5em gris" }
  kicker:      { fontFamily: "Hanken Grotesk", px: "30–40", weight: 500 }
  greeting:    { fontFamily: "EB Garamond", appPx: 52, px: 104, weight: 500, lineHeight: 1.05, tracking: "-0.025em" }
  wordmark:    { fontFamily: "Hanken Grotesk", px: "136 en la v4 (cuadros 2 y 8; sin subrayado)", weight: 600, lineHeight: 1, tracking: "-0.025em" }
  tagline:     { fontFamily: "Hanken Grotesk", px: 40, weight: 500, color: "muted-foreground" }
  mono:        { fontFamily: "Geist Mono", px: 24, weight: 500 }
---

# SUSAN v4 — frame.md (léelo completo antes de construir)

## 0. Cómo se lee

El frontmatter es **normativo** (hex, familias, pesos, radios tal cual); la prosa da reglas e intención. Solo el BRIEF y el
paquete de tu cuadro (qué pasa, cuándo, con qué cifras) mandan sobre este archivo. En pantalla: palabras reales de la UI,
cifras de §10 y kickers ≤ 8 palabras; nunca la frase de la locución; español de México; sin emojis.

## 1. Infraestructura obligatoria (probada en snapshot y render el 2026-10-06)

**GSAP local, nunca CDN.** Desde esta máquina `cdn.jsdelivr.net` y `unpkg.com` dan **403** (política de red): el render
avisa «Failed to download CDN script» y el cuadro queda sin animación. `assets/vendor/gsap.min.js` es GSAP 3.14.2 byte a
byte (mismo sha384 que el `integrity` del ensamblador); `assets/vendor/CustomEase.min.js` es opcional (preferir
`power4.out`). En el `<template>`: `<script src="assets/vendor/gsap.min.js"></script>`. Tras **cada** `assemble-index.mjs`
(que vuelve a escribir el CDN en `index.html`), antes de `transitions inject`:

```bash
sed -i 's#<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"[^>]*></script>#<script src="assets/vendor/gsap.min.js"></script>#' index.html
grep -c 'cdn.jsdelivr' index.html compositions/frames/*.html   # 0 en todos
```

**Fuentes** (rutas desde la raíz; el render no tiene fuentes del sistema; declara solo las que uses):

```css
@font-face{font-family:"Hanken Grotesk";font-weight:100 900;font-style:normal;font-display:block;src:url("assets/fonts/HankenGrotesk-var.woff2") format("woff2");}
@font-face{font-family:"EB Garamond";font-weight:400 800;font-style:normal;font-display:block;src:url("assets/fonts/EBGaramond-var.woff2") format("woff2");}
@font-face{font-family:"Geist Mono";font-weight:100 900;font-style:normal;font-display:block;src:url("assets/fonts/GeistMono-var.woff2") format("woff2");}
```

**Escala E con `zoom`** (verificada: texto, bordes y SVG nítidos; una StatCard recreada empata con
`assets/analitica-statcard-ausentismo-20-8.png`). La UI se escribe en **px de la app** dentro de `.ui{zoom:var(--e)}`.
- `left/top/x/y` en el propio elemento con zoom **se multiplican por E**: posiciona y anima un **rig padre sin zoom**.
- Cámara (GSAP `x/y/scale/rotationX/Y`), perspectiva y sombra del objeto flotante viven en el rig, nunca en `.ui`.
- La cámara escala ≤ 1.3; para leer de cerca sube E (1.6 → 2 → 2.5), nunca un `transform: scale` sostenido.
- Mide solo una vez tras `document.fonts.ready`, sobre el rig; mejor constantes en CSS. Plan B: el kit con px × E a mano.

**Contrato** (el paquete trae el completo): un `<template>`; `#root` con `data-composition-id` = `frame_id` (`sNN-nombre`);
ids y clases con prefijo `<frame_id>-`; fondo en un `class="clip"` de la pista 0 (nunca `background` en `#root`); un
timeline pausado registrado al final en `window.__timelines["<frame_id>"]`; `fromTo` con estado inicial e
`immediateRender:false` al retomar un objetivo; `tl.set({}, {}, D)` fija la duración; sin `Math.random`, `Date.now`, CSS
`transition`/`@keyframes`, `repeat:-1`, `<audio>`, ni CSS `transform` en lo que GSAP mueve.

## 2. Identidad

1. **Dos capas**: UI fiel (lo que existe en la app) + escenario cinematográfico con colores del frontmatter.
2. **Tinta** = único acento estructural (botón primario, píldora activa, tooltip, bloque resaltado, botón central).
   Titulares en tinta, nunca de color. **Azul** solo enlaces («Otras sesiones de hoy (1)») y halo de foco.
3. **Oro = a lo sumo un elemento por cuadro** (subrayado del saludo «Patricia», aro de la pulsación de «Pasar lista», línea
   EMA). **Nunca bajo el wordmark «SUSAN»**: la persona dueña retiró el subrayado dorado ondulado de la marca («no pongas esa
   cosa abajo de SUSAN», BRIEF, ajuste del 2026-10-06) y nada lo reemplaza; en la v4 ningún cuadro lleva oro. Nunca texto
   dorado < 48 px (3.22:1 sobre crema), nunca junto a un chip «Retardo» ni sobre datos de asistencia.
4. **Estados siempre con etiqueta + color**; no pintes los cuatro a la vez si no cuentas un estado.
5. **Holograma** = `escenario.degradado` (portada real de «Pasar lista»): solo superficie héroe, ficha o barrido de la marca;
   nunca en gráficas, chips o datos; una superficie holográfica por cuadro.
6. **Tarjetas sin sombra**, blancas, opacas, con borde. Solo el objeto de escenario (ventana, teléfono, tarjeta héroe, ficha
   del cierre) lleva sombra, en capa aparte y teñida.
7. **Hanken Grotesk** para todo, pesos ≤ 600, `tabular-nums`; **EB Garamond 500 solo 1–2 veces** (saludo «Buenos días,
   Patricia» y a lo sumo un titular). Sin mayúsculas sostenidas. Delta siempre con texto y `trending-up` («+4.2 pp vs.
   semana previa»), nunca «▲». Proporción rótulo : cifra : delta ≈ 1 : 1.55 : 0.75; display ≥ 80 px a −0.025/−0.03em.
8. **Lucide** de `assets/icons/` (§7); **sin cursor**; **sin UI de desarrollo** («Reloj simulado», «Cámara simulada»,
   cuadros magenta, «Próximamente», UI oscura); **sin rostros reales** (avatares Lorelei; iniciales en listas fieles).

## 3. Radios, bordes, sombras, foco, vidrio

Radios: `radii` (tarjeta 28, panel 36, botón/campo 16, ficha 20, chips y pistas píldora). Borde de 1 px de la app = 2 px en
video (zoom); panel principal `rgba(231,226,220,.6)`. Única micro-sombra interna: la ficha blanca de `TarjetaPortada`
(`1px solid rgba(0,0,0,.05)` + `0 1px 2px rgba(30,25,25,.08)`). **Foco** `0 0 0 4px rgba(0,97,254,.3)` (8 px en video) = el
«toque». **Sombra del objeto flotante**: div aparte (nunca `box-shadow` animado), `sombra-crema` o `sombra-cielo`,
desplazada contra la inclinación. **Vidrio falso**: copia recortada del cielo + velo `rgba(255,255,255,.72)` + borde
interior 2 px `rgba(255,255,255,.8)`; `backdrop-filter` real solo en piezas pequeñas y quietas.

## 4. Escenarios (fondos de clip, no UI)

**E1 «cielo crema»** — apertura, producto y cierre; **máx. 3 apariciones**, nunca bajo una gráfica.

```css
.esc-cielo{background:linear-gradient(180deg,#C6D8F7 0%,#D2E0F9 22%,#E6EEFC 48%,#EFF2F7 72%,#F7F5F2 100%)}
.nube-fria{background:radial-gradient(closest-side,rgba(255,255,255,.9),rgba(255,255,255,0))}
.nube-calida{background:radial-gradient(closest-side,rgba(246,237,211,.8),rgba(246,237,211,0))}
.nube-rubor{background:radial-gradient(closest-side,rgba(251,230,226,.6),rgba(251,230,226,0))}
```
Nubes: elipses 2:1 de 30–60 % del ancho, mitad superior, 3 planos con paralaje 8/18/32 px/s (no como deriva de segunda
mitad). Sin `filter`.

**E2 «holograma»** — una superficie (tarjeta héroe 1.6:1 con portada al 55 %, ficha del cierre), nunca fondo.

```css
.holo-base{background:rgba(255,255,255,.66);box-shadow:inset 0 0 0 2px rgba(255,255,255,.9)}
.holo{position:absolute;inset:-30%;opacity:.75;
 background:radial-gradient(40% 50% at 78% 72%,#FF6AA9 0%,rgba(255,106,169,0) 70%),
  radial-gradient(35% 45% at 60% 90%,#FFB36B 0%,rgba(255,179,107,0) 70%),
  radial-gradient(40% 40% at 94% 50%,#8BE3B5 0%,rgba(139,227,181,0) 70%),
  radial-gradient(45% 45% at 70% 38%,#6BB8FF 0%,rgba(107,184,255,0) 70%),
  conic-gradient(from 200deg at 75% 70%,#FFD5E5,#FFE9D4,#DEF7E9,#D4EAFF,#E0D9F1,#FFD5E5);
 -webkit-mask-image:radial-gradient(70% 80% at 80% 80%,#000 35%,transparent 75%)}
.brillo{background:linear-gradient(105deg,transparent 42%,rgba(255,255,255,.55) 50%,transparent 58%)}
```
El holograma se mueve con `transform` en su capa recortada (rotation 0→8°, `xPercent −4→4`), nunca `background-position`.
El brillo cruza **una vez** (`xPercent −120→120`, 0.7 s `power2.inOut`, SFX `sheen`). Texto encima en tinta 500/600. Sin
`mix-blend-mode`/`filter` dentro de `preserve-3d`.

**E3 «lienzo de datos con halo»** — toda la demostración de la app.

```css
.esc-datos{background:radial-gradient(55% 60% at var(--hx,62%) var(--hy,48%),var(--halo) 0%,rgba(247,245,242,0) 72%),
  radial-gradient(120% 90% at 50% 40%,#F7F5F2 55%,#F3F1ED 100%)}
```
`--halo` = fondo del tono del módulo (`tonos`: azul Pasar lista y cámara · verde confirmación/reportes · dorado revisión ·
rosa alertas/riesgo/Iván · violeta analítica). El cambio de halo (fundido 0.6–0.8 s) marca el relevo junto con el elemento
compartido. Profundidad opcional: 1–2 tarjetas reales detrás a escala 0.5–0.7, `blur(8–14px)`, opacidad .5–.7.

**Grano**: imagen estática (nunca `<filter>` vivo sobre el cuadro), opacidad .10 en E1 y .04–.05 en E3; vida solo con
`tl.set` de posición cada 2 fotogramas.

```css
.grano{position:absolute;inset:0;pointer-events:none;mix-blend-mode:multiply;opacity:.05;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
```
**Placa de tinta** (opcional, ≤ 1.5 s, un golpe): `placa-tinta` (fondo, texto, oro claro). No es UI oscura.

## 5. Movimiento

**5.1 Doctrina.** Primer movimiento ≤ 0.2 s; héroe visible ≤ 0.5 s. Revelado al ritmo de la voz (`vo_anchor`), nunca todo
en el primer 25 %; la cifra llega **antes** de que la voz la nombre y queda quieta ≥ 1.2 s. Nunca dos movimientos grandes a
la vez. **Dinamismo con medida (BRIEF, indicación tras el borrador completo, 2026-10-06; sustituye el antiguo «sin salidas
salvo el último cuadro»):** algo nuevo (otra pieza real de la app, otra cifra, otro estado) cada ~2–3 s, ninguna composición
igual más de ~3 s, un solo relevo a la vez y ≥ 1.5 s entre los inicios de dos relevos de composición; las salidas dentro de un
cuadro están permitidas y son el relevo (R1–R5 de `plan/DINAMISMO.md` §2: lo viejo sale con estela hacia la izquierda o hacia
arriba y lo nuevo entra desde el lado opuesto); zooms solo como transición, cámara ≤ 1.3 y nunca sostenida; el cierre de F8
sigue siendo el único fundido a crema. Sin respiración, deriva lenta ni acercamientos de adorno (solo vibración finita de baja
amplitud); sin colas muertas ≥ 1.0 s; nada de lectura ni ancla en los primeros `dur`
segundos (los tapa la transición entrante). Meta: ~25–30 % movimiento grande, ~50 % micro-movimiento de datos, ~20–25 %
lectura quieta.

**5.2 Doble velocidad.** La UI se porta como la app; cámara y escenario, como el reel.
- Escenario: llegar `power3.out`/`expo.out` 0.5–0.9 s (tarjeta que aterriza 1.0–1.3 s); viajar, morph y FLIP
  `power3.inOut`/`expo.inOut` 0.6–0.9 s.
- UI: `EASE.salida` = `power4.out`, `EASE.suave` = `power2.inOut`, CountUp `power2.out`; duraciones .2 / .5 / .9 s.
  `Reveal` y 16→0 0.6 s · `StaggerList` y 14→0 0.5 s +60 ms (tope .6 s) · `BlurText` blur 10→0 + y −.5em 0.7 s +90 ms por
  palabra · datos vivos 0.5 s sin reiniciar.

**5.3 Sobreimpulso: máximo 2 en todo el video** (`back.out(1.4)`): el tooltip que salta y/o la pulsación de «Pasar lista».
Sin `bounce`/`elastic`. El squash del sting no es rebote.

**5.4 Inclinación 3D suave (BRIEF 2026-10-06).** Solo el **objeto de escenario completo** entra con perspectiva:
`perspective:1600–2000px` en un padre quieto, `rotationX` ≤ 8°, `rotationY` ≤ 10°, `z −160→0`, 1.0–1.3 s
`power3.out`/`expo.out`. **0° antes de que se lea cualquier cifra y en cada borde de cuadro** (todo `handoff` plano);
reposo 0–3° solo mientras no se lee nada. Nunca `rotationZ` (el tooltip va **recto**); nada dentro gira por su cuenta. Sin
`filter`, `opacity < 1`, `overflow`, `clip-path`, `mask` ni `mix-blend-mode` en el elemento `preserve-3d` o sus ancestros:
fundidos y desenfoques en hojas o en un envoltorio exterior.

**5.5 Toque sin cursor.** Halo de foco 0.15–0.2 s antes → `scale .97` en 0.08–0.09 s y recuperación 0.3 s `power3.out`
(primario a `#3A3433`, flecha +2 px) → cambio de estado +0.04 s → efecto +0.1–0.2 s. SFX `click-soft2` o `tap`. Aro de oro
(`scale 1→1.7`, opacidad .6→0, 0.6 s) **una sola vez**, en «Abrir y pasar lista» o el botón central.

**5.6 Desenfoque y estela.** Una superficie grande desenfocada a la vez, ≤ 24 px, ≤ 1.2 s. Rack focus de apertura con
**blur vivo ≤ 20 px durante ≤ 0.9 s** (driver `desenfoque` de PILOTO §3a: blur en la `.escena`, escala de cámara en el
`.mundo`, `power2.out`, `filter: none` en reposo; nada se lee hasta que baja de 1 px). La **placa pre-desenfocada** (snapshot
o `assets/pantalla-*` + `ffmpeg -vf gblur=sigma=18`) es opcional: solo para un fondo desenfocado que se queda más de ~1 s
detrás del héroe (aprobado con el plan, 2026-10-06; el piloto midió que la placa a mitad del fundido se ve como doble
exposición). Fondos 8–14 px; **texto que se lee: 0 px** y ningún texto aterriza desenfocado.
Estela direccional (feGaussianBlur en un eje, ligada a la velocidad, `filter:none` en reposo) en cada relevo y odómetro, con
≤ 3 objetos con estela a la vez (topes de σ y receta en `plan/DINAMISMO.md` §2.0; sustituye el antiguo «1–3 golpes por
escena»). No sumar un blur interno pesado a un `blur-crossfade`/`zoom-through` simultáneo.

**5.7 Gramática de datos.**
- **Cifras**: odómetro (columna enmascarada de 1.2 × cuerpo, rueda derecha→izquierda 0.9–1.2 s `power3.out`, escalonado
  0.04 s), sin reescribir texto por fotograma; un tic por columna o un solo `blip`. Un estado (8 → 7) rueda un renglón.
- **Líneas**: rectas entre puntos (nunca suavizadas); se dibujan **antes** de que la guía las recorra (trazo 1.2 s
  `power4.out`, banda .8 s a +.3, puntos `scale .3→1` 0.45 s en ola `.2 + .8·x`). Guía = cabezal con un solo driver
  (`power1.inOut`, 1.6–2.2 s); el tooltip cambia de texto solo al cambiar de índice, ancho fijo, se voltea cerca del borde;
  quieta ≥ 0.8 s al final.
- **Barras**: `clip-path` izquierda→derecha 0.85 s `power4.out`, +60 ms por fila; la cifra 0.4 s a +350 ms, **nunca antes que
  su barra**. **Anillo**: `stroke-dasharray 0→largo` 0.9 s, +0.09 s por arco; vivo 0.5 s. **TiraSemana**: opacidad +
  `scale .92→1` 0.5 s, +70 ms. **Medidor**: el nivel sube y **se asienta sin sobreimpulso**, monótono y nunca por encima
  de N: `nivel(p)=N·(1−(1−p)³)` (`power3.out` sobre el tramo, p de 0 a 1); la vida la pone solo la inclinación de la
  superficie, `desnivel(t)=A·e^(−t/0.5)·sin(2πt/0.6)` (A ≈ 6 % del ancho), que se apaga sola. Las dos en el `onUpdate` de
  un tween `ease:"none"`. (La fórmula oscilante anterior pasaba un 28 % sobre la marca: era un sobreimpulso más.)

**5.8 Bordes de cuadro.** Relevo con elemento compartido (`cut` + `handoff` con números idénticos, pieza plana y quieta),
`push-slide LEFT` 0.45–0.5 s (una sola dirección), `blur-crossfade` 0.5 s solo al cambiar de mundo, `zoom-through` ≤ 1 vez
como `transition_in`; nunca `squeeze` ni disoluciones largas. Dentro de los cuadros van los relevos R1–R5 de
`plan/DINAMISMO.md` §2 (látigo, vertical, atravesar, foco, morph); el «atravesar» (R3) es un cambio de toma dentro del cuadro y
no cuenta como `zoom-through`.

## 6. Kit de UI (px de la app dentro de `.ui`; cambia `su-` por `<frame_id>-`)

Corrige el kit v3: oro `#A8842C`; sin «cobalto»; botón radio 8 (16) y peso **500**; StatusChip **500** con punto 6; cifra de
StatCard 30 (60), no 88; avatar = círculo `TINTES` con iniciales **blancas**; Hanken variable `100 900`; sin `.su-pill-g`
ni `.su-cursor`.

```css
#root{--e:2;--ink:#1E1919;--canvas:#F7F5F2;--muted:#F0EDE8;--mfg:#6F6A65;--line:#E7E2DC;--input:#D8D2CA;
 --ok:#1F7A47;--ok-bg:#E3F4EA;--warn:#9A6408;--warn-bg:#FBEFD2;--bad:#B3261E;--bad-bg:#FBE4E1;--info:#1F5FA8;--info-bg:#E1EDFA;
 --pen:#5B5651;--pen-bg:#EEEBE6;font-family:"Hanken Grotesk",system-ui,sans-serif;color:var(--ink);
 font-variant-numeric:tabular-nums;letter-spacing:-0.003em;-webkit-font-smoothing:antialiased}
.su-ui{zoom:var(--e);position:relative}   /* sin left/top: van en el rig */
.su-card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px}
.su-tg-t{font-size:16px;font-weight:600;letter-spacing:-.025em} .su-tg-d{font-size:14px;color:var(--mfg);margin-top:2px}
.su-stat{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px;min-height:120px;display:flex;flex-direction:column}
.su-stat-h{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:500;color:var(--mfg);line-height:1.25}
.su-pst{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;flex:none;background:var(--muted);color:var(--mfg)}
.su-pst svg{width:16px;height:16px}.su-pst.ok{background:var(--ok-bg);color:var(--ok)}.su-pst.warn{background:var(--warn-bg);color:var(--warn)}.su-pst.bad{background:var(--bad-bg);color:var(--bad)}
.su-stat-v{margin-top:auto;padding-top:16px;font-size:30px;font-weight:600;letter-spacing:-.025em;line-height:1}
.su-stat-u{font-size:14px;font-weight:500;color:var(--mfg);margin-left:4px;letter-spacing:0}
.su-hint{margin-top:8px;font-size:12px;font-weight:500}.su-hint.bad{color:var(--bad)}.su-hint.ok{color:var(--ok)}.su-hint.warn{color:var(--warn)}
.su-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:14px;font-weight:500}
.su-chip::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}.su-chip.sm{padding:2px 8px;font-size:12px}
.su-chip.presente{background:var(--ok-bg);color:var(--ok)}.su-chip.retardo{background:var(--warn-bg);color:var(--warn)}
.su-chip.ausente{background:var(--bad-bg);color:var(--bad)}.su-chip.justificado,.su-chip.auto{background:var(--info-bg);color:var(--info)}
.su-chip.pendiente,.su-chip.programada{background:var(--pen-bg);color:var(--pen)}
.su-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 16px;border-radius:8px;font-size:14px;font-weight:500;background:var(--ink);color:#fff}
.su-btn.lg{min-height:48px;min-width:256px}.su-btn.sec{background:#fff;color:var(--ink);border:1px solid var(--input)}
.su-btn svg{width:16px;height:16px}.su-focus{box-shadow:0 0 0 4px rgba(0,97,254,.3)}
.su-ficha{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;flex:none;background:#E6EEFC;color:#1D5FD1}
.su-ficha svg{width:20px;height:20px}
.su-av{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:12px;font-weight:600}
.su-pill{min-height:36px;padding:0 16px;border-radius:999px;font-size:14px;background:var(--muted);display:inline-flex;align-items:center}
.su-pill.on{background:var(--ink);color:var(--canvas);font-weight:500}
.su-tab{min-height:44px;font-size:14px;font-weight:500;color:var(--mfg);border-bottom:2px solid transparent}.su-tab.on{color:var(--ink);border-bottom-color:var(--ink)}
.su-track{height:10px;border-radius:999px;background:var(--muted);position:relative;overflow:hidden}
.su-fill{position:absolute;inset:1px auto 1px 1px;border-radius:999px;min-width:4px}
.su-lim{position:absolute;top:0;bottom:0;border-left:1px dashed rgba(179,38,30,.7)}
.su-lim-chip{border-radius:999px;background:rgba(179,38,30,.1);color:var(--bad);font-size:11px;font-weight:500;padding:2px 8px}
.su-camchip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:rgba(30,25,25,.8);color:#fff;font-size:12px;font-weight:500}
.su-tip{background:#fff;border:1px solid var(--line);border-radius:10px;padding:8px 12px;font-size:12px;min-width:160px}
.su-tip-ink{background:rgba(30,25,25,.88);color:#fff;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:500}
.su-casilla{min-height:72px;border-radius:14px;padding:12px 4px;display:grid;place-items:center;text-align:center}
.su-casilla.critica{box-shadow:inset 0 0 0 2px rgba(179,38,30,.7)}
```

**Recetas** (todas a E = 2 vía zoom; calcos en `capture/extracted/asset-descriptions.md`):
- **PasarListaHero** (p 24): ficha azul `scan-face` + «Pasar lista» 14/500 gris, chip «Programada» (o «Abierta» en tokens
  justificado); mt 16: «Administración Financiera (3A)» 20/600, «07:00 - 08:00 · Aula A-12» 14 gris, `camera` 16 `#1F7A47`
  + «Cámara del aula lista»; `.su-btn.lg` «Abrir y pasar lista» con `scan-face` 20 y `arrow-right` 16; enlace azul 14/500.
- **TarjetaPortada** (≈196 × 200): portada 72 (`tono` o `degradado`), ficha blanca 36/r10 en (16,16) con micro-sombra; cuerpo
  p 14 16 16: título 14.5/500, meta 12 gris, pie 13 gris `arrow-up-right` «Abrir».
- **AnilloEstados**: SVG `viewBox 0 0 120 120` rotado −90°, `r 46`, trazo 9, pista `#F0EDE8`, remates redondos, hueco de
  12 unidades; centro cifra 600 + etiqueta 12 gris; leyenda punto 10 + etiqueta 14 gris + cifra 500 + % 12 gris; estados en
  0 al 55 %. Sesión: Presentes `#27A06A`, Retardos `#C98100`, Sin registro `#DE4D44`, Pendientes `#8F8A82`.
- **GraficaLinea** (alto 280): solo cuadrícula horizontal 1 px `#E7E2DC` .8; marcas 11 gris; observada = puntos de tinta r 4
  con aro blanco 2; ajuste `#4A86F0` 2; proyección `#4A86F0` `6 4`; intervalo 95 % banda azul .34→.10; EMA `#A8842C`
  (el oro del cuadro); guía 1 px `#6F6A65` .55; punto activo r 4.5 aro 2.5. Sin «Límite 20 %» en la tasa semanal.
- **TiraSemana**: casillas ≤ 112 de ancho, separación 8, cifra arriba 16/600 (unidad .7em), día 12; color
  `color-mix(in oklab,#DE4D44 X%,#F0EDE8)`, X = round(min(1, v/25)·72): Lun 17.7 → `#EEA094`, Mié 16.4 → X 47, Vie 21.8 →
  `#EB8D81` + `.critica`. Solo Lun · Mié · Vie.
- **MedidorLiquido** (solo en vivo y alumno): tanque 84 × 168 r 24 `#F0EDE8`, líquido `#4A86F0`, 5 marcas a la derecha;
  texto a 20: cifra 36/600, «Presentes ahora» 14/500, «21 de 24 inscritos» 14 gris.
- **VistaCamara**: 16:9 r 14 fondo tinta; `.su-camchip` en inset 12 («Reconociendo» `scan-face`, «En pausa» `pause`, «Fuera
  de la ventana» `timer-off`; a la derecha «Cámara frente»). Detección = esquinas blancas 2 px r 8 → `#27A06A` al confirmar +
  chip sm «Presente». Caras = avatares Lorelei; nunca puntajes sobre la cara ni cuadros magenta.
- **BottomNav** (390 css): píldora a 12 de los bordes, r 28, `rgba(255,255,255,.9)` + blur 24 + `0 10px 30px
  rgba(30,25,25,.12)`, p 6; destino min-h 52 r 18, icono 20/1.75 (activo 2), etiqueta 11/500 (activa 600 sobre `#EFECE7`);
  botón central: círculo 56 de tinta, anillo blanco 5, sobresale −20, `scan-face` 24 blanco, «Pasar lista» 11/600. Orden:
  Panel · Revisión · [Pasar lista] · Reportes · Analítica.
- **Saludo**: «Docente · FCA C-I» 14/500 gris; EB Garamond 500 52 «Buenos días, Patricia»; `Resaltado` bajo «Patricia»: SVG
  `viewBox 0 0 100 12` `preserveAspectRatio="none"`, `M2 8 C 22 3, 40 10, 60 5 S 90 4, 98 7`, trazo `#A8842C` .75, ancho 4,
  remates redondos, alto .32em a −.12em, dibujo 0.9 s con retraso 0.5 s; lema 16 gris.

## 7. Iconos (`assets/icons/`, 73 Lucide 1.50.0 verificados contra lucide-react y lucide-static)

Navegación: `layout-dashboard` (Panel) · `search` · `scan-face` (Pasar lista) · `clipboard-check` (Revisión) ·
`file-chart-column-increasing` (Reportes: el `FileBarChart` real; `file-chart-column` también existe) · `chart-line`
(Analítica) · `layout-grid` · `menu` · `ellipsis` · `chevrons-up-down` · `chevron-right` · `chevron-down` · `arrow-right` ·
`arrow-left` · `arrow-up-right` · `lock` · `lock-keyhole` · `house`. Sesión: `camera` · `camera-off` · `video` · `pause` ·
`timer` · `timer-off` · `clock` · `hourglass` · `calendar-clock` · `calendar-check` · `calendar-days` · `users` ·
`users-round` · `user-check` · `user-x` · `user-pen` · `user-round` · `user-round-x` · `check` · `circle-check` ·
`badge-check` · `x` · `pencil` · `clipboard-list`. Datos: `gauge` (Ausentismo actual) · `trending-up` · `trending-down` ·
`chart-column` · `activity` · `shield-alert` (Alumnos en riesgo) · `triangle-alert` · `octagon-alert` · `circle-alert` ·
`info` · `bell` · `bell-ring` · `flame` · `layers`. Confianza: `shield-check` · `shield` · `shield-lock` ·
`fingerprint-pattern` · `image-off` · `scroll-text` · `file-text` · `file-spreadsheet` · `download` · `qr-code` · `book-open`
· `graduation-cap` · `ban`. **No usar** `mouse-pointer-2`, `sparkle`, `sparkles`. Trazo 1.5 navegación, 1.75 resto (activo 2),
escala con el icono. App → video: 14→28 chips · 16→32 StatCard, flechas · 18→36 portada · 20→40 riel, fila, BottomNav ·
24→48 botón central. Pegar: `node scripts/lucide.mjs <nombre> --size 40 [--stroke 1.5] [--tile azul] [--draw]`.

## 8. Marca y cierre (BRIEF)

Sin logo: wordmark **«SUSAN»** = el BrandMark de la app ampliado, sin escudo. Hanken 600, −0.025em, lh 1, tinta; en la v4,
136 px en los cuadros 2 y 8 (tinta de ≈ 401 px de ancho, mayúsculas de 95 px; medido en snapshot). **Sin subrayado**: el trazo
dorado `Resaltado` bajo la palabra se retiró por indicación de la persona dueña (BRIEF, ajuste del 2026-10-06: «ese como palo
en zigzag, no me gusta») y no se reemplaza con ningún otro adorno (ni punto, ni línea, ni otra marca dorada); la palabra va
limpia. **Lema** directamente debajo del nombre: «Pasa lista en segundos y entiende la asistencia de tus grupos», Hanken 500
40 px `#6F6A65`, una línea; el espacio que ocupaba el subrayado se reparte para que el bloque ficha + nombre + lema quede
centrado ópticamente (en el cuadro 8: ficha y mayúsculas centradas en y = 490, mayúsculas del lema en y ≈ 650–678, bloque
centrado en y ≈ 539). **Llegada decidida**: la ficha
redonda de tinta del botón central (círculo 168, `scan-face` blanco 72 trazo 1.75, anillo blanco 15, sombra
`0 30px 90px rgba(30,25,25,.18)`) cae con estela vertical (0.35–0.45 s), squash de volumen constante al contacto
(`scaleX 1.07 · scaleY .93`, 0.07 s, origen abajo) y recuperación 0.3 s `power3.out` **sin rebote**; luego se resuelve en
el wordmark (se desliza 0.5 s `power3.inOut` mientras la palabra entra con `BlurText` por letra, o le cede su centro). Si
la ficha se queda: lockup ficha 168 + «SUSAN» 136, separación 44. Fondo E1 aclarado a crema; brillo holográfico opcional que
termina en tinta. Sin escudos; ≥ 1.5 s de quietud final; único cuadro que funde a crema.

## 9. Activos

Inventario canónico: `capture/extracted/asset-descriptions.md` (67 capturas reales en `capture/assets/`, se copian con
`stage-assets.mjs`). Avatares `assets/avatars/` (Patricia `avatar-16-po.svg`, Iván `avatar-15-cr.svg`), SFX por nombre de
`assets/sfx/CATALOG.json`. Las capturas son calco y placa; la UI que se anima se reconstruye con este kit. Subtítulos:
desactivados; la piel `.hyperframes/caption-skin.html` (del preset) pintaría la palabra activa sobre oro: si se activan,
su `--cap-accent` pasa a tinta.

## 10. Cifras canónicas (de `plan/CONTENIDO.md` §3; nada fuera de aquí)

Lun 14-sep-2026 07:12, semana 7 · Patricia Ortega («PO» `#1F7A47`) · **3A · Administración Financiera** · Aula A-12 ·
07:00 - 08:00 · 24 alumnos · 47 sesiones · 9 faltas permitidas. Panel: 8 pendientes · 4 justificantes · «3 sin derecho ·
2 al límite». En vivo: «**19** de 24 presentes» · «2 con retardo · 2 sin registro · 1 por revisar» · «Presentes ahora
**88 %** · 21 de 24 inscritos» · «Última captura: 23 rostros · 22 válidos · +1 registro · hace 4 s» · «Minuto 12.0 ·
Retardo» · presente tipo «0.94 · Automático · 07:02:15»; no se muestra el cierre. Revisión: Ramírez Núñez Emilio ·
E260003 · 0.893/0.927 (89 %/93 %) · «Sesión del 2026-09-12, 09:00 a 10:00» · «Quedan 2 h 48 min» · «Resolver como
Presente (Sugerido)» · Pendientes 8 → 7 · lista real de pendientes (DOM 24, todas «Administración Financiera · 3A · 12 sep
09:00 · Quedan 2 h 48 min · Pendiente»): Ramírez Núñez Emilio (RN `#475569`), Aguilar Ramos Luis (AR `#A21CAF`), Sánchez Herrera
Daniel (SH `#A21CAF`), Morales Montes Laura (MM `#B4551A`). Encabezado de la sesión: «Pasar lista · Administración Financiera
(3A) · 14 sep 2026 · 07:00 a 08:00 · Aula A-12» con «Abierta» y «Automático». Analítica 3A: «20.8 % · +4.2 pp vs. semana previa» · S1–S6 13.3 · 20.0 · 22.0 ·
15.3 · 16.7 · 20.8 % · «Proyección al cierre 24.8 % · Semana 15» · «+0.59 pp por semana» · «Día crítico: Viernes» Lun
17.7 · Mié 16.4 · Vie 21.8 % («32 ausencias en 6 sesiones», renglón real de «Ver cifras por día») · «9 alumnos en riesgo» (Alto 3 · Medio 6 · Bajo 16). Iván Cruz Rojas · E260017 · 7 faltas
· 14.9 % · quedan 2 · Alto 64 / 100 · Al alza · cruce estimado semana 9 · «Contactar al alumno esta semana y acordar un
plan de asistencia» · «Te quedan 2 faltas antes del límite.».
**Trampas**: ningún número de lecturas, capturas o muestras por alumno, ni en voz ni en pantalla («tres lecturas»,
«Lecturas 1/3 → 3/3», «Lecturas válidas: 2/3» y cualquier x/3 quedan fuera: BRIEF, 2026-10-06); solo nombres del 3A;
«19.1 %» (no 19.2); «9» sin «de 25»; «Límite 20 %» nunca junto a la tasa semanal 20.8 % (va en faltas acumuladas, barras
por alumno o la fila de Iván); «límite» con tilde; ningún cronómetro; «unas 20 h» solo como estimación.

## 11. Autoauditoría antes de entregar

1. ¿Un héroe por plano, legible a 0.5 s, cifra quieta ≥ 1.2 s mientras se nombra?
2. ¿Tokens exactos, radios app × E, bordes 2 px, sin sombras internas, iconos de `assets/icons/`?
3. ¿A lo sumo un oro (y ninguno bajo «SUSAN»); estados con etiqueta; ningún «Límite 20 %» junto a 20.8 %; cifras solo de §10; ningún número de
   lecturas, capturas o muestras por alumno?
4. ¿Tilt solo en el objeto completo, 0° al leer y en ambos bordes; `handoff` con números idénticos; ≤ 2 sobreimpulsos?
5. ¿GSAP y fuentes locales; `zoom` solo en `.ui` y posiciones en el rig; sin `filter`/opacidad en ancestros 3D?
6. ¿Desenfoque en presupuesto y nada borroso al leerse; sin cursor, sin UI de desarrollo; salidas solo como relevo (con
   estela, un relevo a la vez, `plan/DINAMISMO.md` §2) y ningún acercamiento de adorno?
