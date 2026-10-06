# PILOTO v4: costo de render y veredicto visual de las técnicas caras

Fecha: 2026-10-06. Piloto construido y medido en esta máquina antes de cerrar el storyboard. Todo vive en `piloto/`
(proyecto HyperFrames propio, no toca el proyecto real); los renders y fotogramas están en `piloto/renders/` y
`piloto/snapshots/` (ignorados por git). Rutas de este documento: relativas a `video/susan-v4/`.

**Máquina y renderer.** Linux 6.18, 4 núcleos, 16 GB, Node 22.22, `hyperframes@0.8.134`, Chrome headless shell
152.0.7977.30 con `--use-gl=angle --use-angle=swiftshader` (GL por software: «browserGpuMode probe → software (WebGL
unavailable)»). El MP4 se captura por **`beginframe`** (la ruta rápida), no por `screenshot`. La máquina es compartida:
durante la última ronda otro agente corría `frame-check.mjs` con su propio Chrome, así que las cifras tienen ±10–15 % de
ruido; las tablas usan las rondas tranquilas.

---

## 0. Resumen en 12 líneas

1. **El render no es el cuello de botella.** 6 s de piloto con las cinco técnicas caras: **9.1–9.6 s** en draft a 30 fps,
   **11.3–12.7 s** en high a 30 fps y **17.2–19.1 s** en high a 60 fps con 3 workers. Proyección para 55 s: ~1.5 min
   (draft 30), ~2 min (high 30), ~3 min (high 60); con margen ×1.5 por cuadros más densos, ≤ 5 min.
2. **GSAP por CDN no funciona aquí**: el proxy niega `cdn.jsdelivr.net` (403). El render se **bloquea** con
   `sub_timeline_script_failure` (no hay MP4). Solución obligatoria: `assets/vendor/gsap.min.js` (3.14.2, ya está en el
   proyecto) en cada cuadro y en el índice, y parchear el índice después de cada `assemble-index` (§4).
3. **Rack focus**: el blur vivo de cuadro completo (24 → 0 px en 0.85 s) se ve como un enfoque real y cuesta **+12 ms por
   cuadro** de media; las placas pre-desenfocadas cuestan **+9 ms** y a mitad del fundido se ven como doble exposición.
   Recomendación: **blur vivo para el rack** y placa solo para **fondos desenfocados sostenidos** (σ 24 sostenido vivo cuesta
   +36–42 ms por cuadro, aunque nada se mueva).
4. **Pose 3D suave**: costo **cero medible**; queda plana con `transform: translate(0px, 0px)` (2D) al terminar; sin
   `preserve-3d`, sin problemas.
5. **`zoom: 2`** da texto tan nítido como el nativo. **`transform: scale` con `will-change` sobre texto que cambia de
   escala sale borroso en el render** (no en el snapshot).
6. **`will-change: transform` en el `#root` de cada cuadro**: todo el texto sale con antialias en gris (sin franjas de
   color LCD que el MP4 sí mostraba) con el mismo costo y la misma nitidez. Recomendado.
7. **Odómetro con estela SVG ligada a la velocidad**: convincente, **+2 ms por cuadro**; con máscara de desvanecido en la
   ventana se ve mucho mejor.
8. **Ficha que cae con estela SVG + 2 fantasmas + squash**: se lee como ref2-07, **+1 ms por cuadro**.
9. **El componente `motion-blur` del registro no hace nada dentro de un cuadro** (sub-composición con `<template>`): sin
   estela y sin aviso, ni en snapshot ni en render. En una raíz independiente sí funciona. No usarlo en la v4.
10. **Sin saltos visibles en los bordes**: ni al quitar filtros (`filter:none`), ni al aplanarse el 3D, ni en los
    cortes. Solo un micro-titileo de 1 cuadro (ΔY medio 0.86/255) a mitad del fundido de placas.
11. **fps recomendados**: **60 fps para el final** (`--workers 3`, ~1.5× el tiempo de 30 fps) y **30 fps draft para
    iterar**. Fijar `--workers 3`: el modo `auto` eligió 1 worker a 60 fps (26.6 s contra 17.2 s).
12. Hallazgos colaterales: `vector-effect: non-scaling-stroke` rompe el dibujo de trazos con `pathLength`; el
    `snapshot` no sirve para juzgar nitidez del render; el render no es bit a bit idéntico con distinto número de workers
    en tramos con capas 3D/escaladas (diferencias ≤ 10/255, invisibles).

---

## 1. Qué se construyó

`piloto/` = `npx --yes hyperframes@0.8.134 init piloto --non-interactive --example=blank` + fuente Hanken Grotesk variable
+ GSAP local. Un índice de 6 s (`piloto/index.html`) monta **un solo cuadro** como sub-composición, igual que lo hará el
ensamblador real: `piloto/compositions/frames/s99-piloto.html` (`<template>`, `#root`, un timeline pausado, ids con
prefijo `s99-piloto-`). Dentro, cinco clips en secuencia:

| Tramo | Tiempo | Técnica |
|---|---|---|
| (a) | 0–1.4 s | Panel del docente (E3, halo azul, UI con `zoom: 1.6`) con **rack focus por placas**: placa σ 24 encima, placa σ 6 debajo, DOM nítido al fondo; las placas se funden (0.15–0.6 s y 0.45–1.0 s) mientras el mundo escala 1.12 → 1 (1.3 s `power3.out`). Placas = `snapshot` del DOM nítido + `ffmpeg gblur` (σ 24 y σ 6, `steps=3`), JPG q2 de 37–46 KB |
| (a2) | 1.4–2.4 s | La misma escena con **`filter: blur()` vivo 24 → 0 px** sobre la capa de cuadro completo (0.85 s `power2.out`) + la misma escala 1.12 → 1 |
| (b) | 2.4–3.8 s | Cielo E1 + tarjeta «Pasar lista» flotante con **pose 3D** (`perspective: 1600px` en el padre; `rotationX 8 → 0`, `rotationY −10 → 0`, `z −160 → 0`, `y 40 → 0`, 1.0 s `power3.out`), **sombra teñida aparte**, portada **holográfica** (`#FF6AA9 #FFB36B #8BE3B5 #6BB8FF` + cónico suave) que rota 0 → 8° y un **brillo** que cruza una vez; cuerpo con texto real en `.ui { zoom: 2 }`. A la derecha, tira de prueba de nitidez: `zoom: 2` / `transform: scale 1 → 2` / `scale 1 → 2 + will-change` |
| (c) | 3.8–5.2 s | **Odómetro «0 → 88 %»** (Hanken 600, 160 px, `tabular-nums`, columnas enmascaradas de 176 px, «Presentes ahora» / «21 de 24 inscritos») con estela vertical por `feGaussianBlur stdDeviation="0 σ"` ligada a la velocidad y `filter: none` en reposo |
| (d) | 5.2–6.0 s | **Ficha redonda de tinta** (168 px, `scan-face`, anillo blanco 15 px) que cae (0.32 s `power2.in`) con estela SVG + 2 fantasmas, **squash de volumen constante** (1.07 × 0.93) sin rebote, se desliza a la izquierda y el **wordmark «SUSAN»** (Hanken 600, 136 px) se revela desde debajo de la ficha, con el subrayado dorado dibujado y el lema debajo |

Variantes de medición (generadas, no versionadas): `piloto/medicion/variantes.py` crea un host por tramo con el resto en
`data-hidden` y el timeline corrido con `tl.shiftChildren`, más variantes «sin técnica» (sin placas, sin blur, plano,
sin filtro, sin estela) para aislar el costo; `piloto/medicion/medir.sh` renderiza cada una con 1 worker y `--debug` y lee
`captureP50Ms` de `perf-summary.json`. Datos crudos: `piloto/medicion/resultados-2026-10-06.txt`. `check` del piloto: 0
errores (avisos: pista densa en el piloto y contraste en cuadros a medio desenfoque).

---

## 2. Costos medidos

### 2.1 Render completo del piloto (6 s, 1920 × 1080)

| Configuración | Workers | Tiempo total | Captura | Notas |
|---|---|---|---|---|
| draft · 30 fps | auto → 2 | **9.6 s** / 9.1 s | 8.1 s / 7.4 s | calibración p95 92–108 ms/cuadro |
| high · 30 fps | auto → 2 | 15.0 s / **12.7 s** | 11.3 s / 10.9 s | la primera corrida calibró 537 ms (atípico) y gastó 3.3 s de arranque |
| high · 30 fps | 2 / 3 / 4 | 12.1 / **11.3** / 12.2 s | 11.3 / 10.6 / 11.4 s | 4 workers no ayuda: el x264 de `high` compite por los 4 núcleos |
| high · 60 fps | auto → **1** | 26.6 s | 24.7 s | `auto` eligió 1 worker: evitarlo |
| high · 60 fps | 2 / 3 | 18.1 / **17.2 s** (19.1 s con `will-change`) | 17.3 / 16.5 s | 360 cuadros |
| draft · 60 fps | 3 | 13.1 s | 12.3 s | |
| png-sequence · 30 fps | 1 | 37.7 s | 37.1 s | usa la ruta `screenshot` (206 ms/cuadro): no sirve para medir |

Pares «/»: ronda 1 sin `will-change` en la raíz / ronda 2 con `will-change` (misma carga). La ronda 3 (con máscara del
odómetro, con otro agente usando la CPU) dio 10.3 / 14.3 / 22.9 s: es ruido de la máquina compartida, no de la máscara.
Renders: `piloto/renders/piloto-{draft-30,high-30,high-60-w3,high-60-w1}.mp4` (+ `ronda1-sin-will-change/`, `ronda2/`).

Lectura útil: **~3 s de render por segundo de video a 60 fps high** y ~2 s a 30 fps high, con 2–3 workers. Para 55 s:
~3 min (60 fps) o ~2 min (30 fps), más el margen de cuadros más densos (24 avatares en la cámara, gráficas).

### 2.2 Costo marginal por técnica (1 worker, draft, 30 fps, mediana `captureP50Ms` de 3 corridas)

| Variante | ms/cuadro | Diferencia | Qué aísla |
|---|---|---|---|
| Solo fondo crema | 28–29 | piso | captura + codificación de un cuadro vacío |
| Escena de UI quieta (panel completo, sin blur ni escala) | 35–38 | +8 | pintar UI estática |
| Escena + escala del mundo 1.12 → 1 | 54–56 | **+19** | **cámara** (escalar un mundo DOM de cuadro completo re-rasteriza todo) |
| (a2) rack vivo 24 → 0 (0.85 s) + escala | 67–68 | **+12** sobre la escala | blur vivo de cuadro completo, promedio del tramo |
| σ ≈ 24 sostenido + escala | 91–93 | **+36** sobre la escala | peor caso de blur vivo |
| σ 24 sostenido, sin escala (cuadro quieto) | 78–80 | **+42** sobre la escena quieta | un `filter` estático se recalcula en cada cuadro |
| (a) placas σ 24/σ 6 + escala | 62–66 | **+8–9** sobre la escala | fundido de dos imágenes de cuadro completo |
| (b) tarjeta 3D + sombra + holograma + brillo | 57–60 | **≈ 0** (plano: 63–64) | la pose 3D no cuesta |
| (c) odómetro con estela SVG | 36–40 | **+2** (sin filtro: 34–38) | estela de columnas pequeñas |
| (d) ficha con estela SVG + 2 fantasmas | 40–42 | **≈ +1** (sin estela: 38–42) | estela de un objeto de 168 px |

Además, cada worker paga ~1.4 s fijos de arranque (Chrome + carga + fuentes).

---

## 3. Técnica por técnica

### (a) Rack focus de apertura: placa pre-desenfocada contra blur vivo

- **Costo**: placas +8–9 ms/cuadro mientras se funden (≈ 0 si la placa está quieta y sola); blur vivo 24 → 0 en 0.85 s
  +12 ms/cuadro de media (pico +36 con σ 24).
- **Veredicto visual**:
  - Placas (`piloto/snapshots/render/t0.10.png`, `t0.30.png`, `t0.50.png`, `t0.60.png`, `t0.95.png`): el arranque con σ 24 es
    idéntico a un blur real, pero a mitad del fundido placa → DOM se ve **doble exposición** (bordes nítidos con halo; ver
    `piloto/snapshots/clave/frame-02-at-0.6s.png`). Con dos placas (σ 24 → σ 6 → nítido) se disimula, pero no es un enfoque.
    Un micro-titileo de 1 cuadro a 0.567 s (§5).
  - Blur vivo (`piloto/snapshots/render/t1.45.png`, `t1.60.png`, `t1.80.png`, `t2.10.png`): enfoque continuo y limpio, sin
    bandas ni bordes; termina nítido y sin salto al pasar a `filter: none`.
- **Receta para los workers** (copiar de `s99-piloto.html`, función `desenfoque`):
  - Capa de cuadro completo `.escena` dentro de `.mundo`; el blur va en la escena y la escala de cámara en el mundo.
  - Driver puro del tiempo: `st.d` de 24 → 0 con `fromTo(..., immediateRender:false)` y `onUpdate` que escribe
    `filter = d < 0.05 ? 'none' : 'blur(' + d.toFixed(2) + 'px)'`. Así se puede buscar hacia atrás y queda `none` en reposo
    (no usar `tl.set(..., {filter:'none'})`: al rebobinar deja `blur(0px)` en línea y pisa la variable).
  - Parámetros: σ inicial ≤ 24 px, 0.8–0.9 s `power2.out`, mundo 1.12 → 1.0 en 1.0–1.3 s `power3.out`; solo en la apertura y
    en un cambio de mundo; nada se lee hasta que σ < 1.
  - **Placa** solo para un **fondo desenfocado que se queda** detrás del héroe más de ~1 s (σ 24 vivo sostenido cuesta
    +36–42 ms/cuadro aunque nada se mueva): `npx hyperframes snapshot . --at <t>` del estado nítido →
    `ffmpeg -i s.png -vf "format=rgb24,gblur=sigma=18:steps=3" -q:v 2 placa.jpg`, como `<img>` de 1920 × 1080 dentro del
    mismo mundo que el DOM (así escalan juntos).
- **Evitar**: animar blur a cuadro completo > 24 px; sostener blur vivo en pantalla; juntar un rack vivo con un
  `blur-crossfade` o `zoom-through` en el mismo instante (dos blurs de cuadro completo); confiar en que la placa es
  «gratis» (el fundido de dos imágenes de 1080p cuesta casi lo mismo que el blur).
- **Propuesta para SINTESIS regla 21** (no la edito yo): «rack focus vivo ≤ 24 px y ≤ 1.2 s; placa pre-desenfocada para
  fondos desenfocados sostenidos». El motivo de la regla actual (costo) no se confirmó en esta máquina.

### (b) Tarjeta flotante con pose 3D, sombra teñida, holograma y `zoom: 2`

- **Costo**: ≈ 0 frente a la misma tarjeta sin rotación (57–60 contra 63–64 ms, dentro del ruido).
- **Veredicto visual**: `piloto/snapshots/render/t2.50.png`, `t2.70.png` (inclinada, texto legible), `t2.95.png`, `t3.25.png`
  (brillo cruzando), `t3.75.png` (plana). Al terminar el tween GSAP deja `transform: translate(0px, 0px)` (2D, verificado
  escribiendo el valor en pantalla), la sombra queda en `translate(0px, 0px)` y nada queda en 3D. La tarjeta asentada es
  igual de nítida que una que nunca rotó: la única diferencia era el tipo de antialias (gris contra LCD,
  `piloto/snapshots/nitidez/tarjeta-3d-vs-plana.png`), que se resuelve con `will-change` en la raíz (abajo).
- **Nitidez de `zoom: 2`**: idéntica al texto nativo y a `transform: scale` **sin** `will-change`
  (`piloto/snapshots/nitidez/zoom-vs-scale.png`). Con **`will-change: transform` en un elemento que escala 1 → 2**, el render
  (no el snapshot) rasteriza a escala 1 y amplía: texto **borroso y pixelado** (`piloto/snapshots/nitidez/mp4-zoom-scale-wc.png`,
  tercera fila).
- **Receta**:
  - Padre `perspective: 1600px` (`perspective-origin` cerca del centro del objeto). **Sin `preserve-3d`**: una tarjeta es un
    solo plano y no lo necesita; así no hay ancestros que la aplanen. `overflow: hidden` y `opacity` en la propia tarjeta
    funcionan.
  - Entrada `fromTo({rotationX: 8, rotationY: -10, z: -160, y: 40}, {0, 0, 0, 0, duration: 1.0, ease: 'power3.out'})` +
    opacidad 0 → 1 en 0.3 s. Plana (0°) antes de cualquier lectura y en cada borde de cuadro.
  - Sombra: hermana detrás de la tarjeta, mismo tamaño y radio, `box-shadow` **estático** (sobre cielo
    `0 40px 120px rgba(29,95,209,.14), 0 8px 24px rgba(29,95,209,.08)`). **Corregido en la construcción (2026-10-06,
    cuadros 4 y 7)**: la receta original (`x 40 → 0`, `y 70 → 0`, `scale .9 → 1` con la opacidad en el mismo tween) deja
    un **doble borde fantasma** mientras la tarjeta está inclinada: la sombra plana no coincide con la silueta en
    perspectiva. La sombra hace **el mismo tween 3D que la tarjeta** (mismos `rotationX/Y`, `z`, `y`, `scale`, misma caja,
    mismo `transform-origin`, misma curva y duración; si la tarjeta crece por `clip-path`, la sombra crece con la misma
    curva y un origen que haga coincidir su caja con el recorte) y su opacidad sube **solo al final del aterrizaje**
    (≈ los últimos 0.25–0.35 s, `power2.out`, ya casi plana). El desplazamiento «contra la inclinación» lo da solo el
    offset propio del `box-shadow`.
  - Holograma: capa `inset: -30%` con los 4 radiales del `DEGRADADO` + cónico, `opacity .75`, movida solo con
    `rotation 0 → 8` y `xPercent −4 → 4` (`ease: 'none'`); brillo `linear-gradient(105deg, …, rgba(255,255,255,.55) 50%, …)`
    con `xPercent −120 → 120`, 0.7 s `power2.inOut`, una vez al aterrizar. Sin `mix-blend-mode` ni `filter` dentro.
  - UI en `.ui { zoom: 2 }` (radios y bordes de la app × 2). Los movimientos de cámara van en un padre sin zoom.
  - **`#root { will-change: transform }` en cada cuadro**: el render pinta con antialias LCD (franjas naranja/azul) el texto
    que no está en su propia capa y en gris el que sí; con `will-change` en la raíz todo sale en gris, sin franjas, con el
    mismo costo (11.2 s contra 11.3 s) y sin perder nitidez en el mundo escalado
    (`piloto/snapshots/nitidez/aa-lcd-vs-gris.png`: izquierda sin, derecha con). Verificarlo una vez en el índice ensamblado.
- **Evitar**: `will-change` en cualquier elemento cuya escala cambie (cámara, contadores que crecen); `transform: scale`
  sostenido para «agrandar» UI; juzgar la nitidez con `snapshot` (usa `screenshot` y búsquedas sueltas: no reproduce el
  raster del render). Revisar nitidez siempre con un cuadro sacado del MP4.

### (c) Odómetro «0 → 88 %» con estela vertical

- **Costo**: +2 ms/cuadro (dos columnas de ~95 px de ancho y hasta 3 344 px de alto, con filtro solo mientras ruedan).
- **Veredicto visual**: `piloto/snapshots/render/t3.97.png`, `t4.03.png`, `t4.10.png`, `t4.25.png`, `t4.95.png` y
  `piloto/snapshots/render/estelas-detalle.png`. Rueda con la estela direccional del reel (los trazos verticales siguen
  nítidos, los horizontales se corren), se posa limpia en «88 %» y no hay salto cuando el filtro pasa a `none` (en este
  caso entre 4.66 y 4.73 s, cuando σ < 0.3). Sin máscara, la ventana corta la estela con un borde duro; con
  `mask-image: linear-gradient(180deg, transparent 0%, #000 16%, #000 84%, transparent 100%)` en la columna se ve mucho mejor
  y la cifra en reposo no se toca (`piloto/snapshots/render/odometro-con-mascara.png`).
- **Receta** (`conRastro` en `s99-piloto.html`):
  - Ventana `.col { height: H; overflow: hidden; mask-image: … }` con H **constante en CSS** (176 px para cifra de 160 px);
    tira generada una sola vez antes de registrar el timeline (decenas «espacio de cifra U+2007, 1…8»; unidades «0…9, 0…8»).
  - Driver puro `st.p` 0 → 1 (`ease: 'none'`) y `onUpdate`: `y = -dist · ease(p)`; `v = dist · ease'(p) / dur` (diferencia
    central); **σ = 0.29 · v · OBT** con **OBT = 1/60 s** (largo de estela en segundos: igual a 30 y a 60 fps); `σ ≤ 16`;
    `stdDeviation="0 σ"`; `filter: none` si σ < 0.3.
  - Filtro por columna con región ajustada al eje: `x="-10%" width="120%" y="-6%" height="112%"`.
  - Unidades una vuelta + destino, decenas sin vuelta, desfase 0.04 s; 0.9 s.
- **Evitar**: reescribir el texto por cuadro (`count-up`), medir H en tiempo de render, `back.out`. La cola de `expo.out`
  deja ~0.15 s de avance sub-píxel que avanza a saltos de 1 px (diferencia entre cuadros alternando 0.08/0.004): si se nota,
  `power4.out` o 0.75 s.

### (d) Ficha que cae con estela y squash → wordmark «SUSAN»

- **Costo**: ≈ +1 ms/cuadro.
- **Veredicto visual**: `piloto/snapshots/render/t5.40.png`, `t5.47.png` (estela), `t5.52.png`, `t5.57.png` (contacto y
  squash), `t5.70.png`, `t5.80.png`, `t5.98.png` (lockup con lema) y `piloto/snapshots/render/ficha-30-vs-60.png`. La caída se
  lee como ref2-07: bandas fantasma arriba y el icono estirado en vertical; a 30 fps son 3 cuadros con estela, a 60 fps 7.
  El anillo blanco desenfocado ensucia un poco el borde: aceptable a esa velocidad. El squash sin rebote se siente como
  contacto. El revelado del nombre «desde debajo de la ficha» funciona si la ficha cubre el borde izquierdo de la palabra
  (la primera versión dejaba asomar la «S» por la izquierda: se corrigió soltando la ficha en x = 900 y no en el centro).
- **Receta**:
  - Envoltorio externo = caída (`y`) y desplazamiento (`x`); interno = squash (`transform-origin: 50% 100%`); el filtro va
    en la ficha (hija), no en el que se mueve.
  - Caída `power2.in` 0.32 s desde y = −620 (velocidad máxima en el contacto); σ = 0.29 · v · OBT, tope 26;
    2 fantasmas (círculo + anillo, `aria-hidden`) en la posición de hace 1/60 y 2/60 s, opacidad .32 y .16 × min(1, v/2500);
    todo a 0 al posarse.
  - Squash `scaleX 1.07 / scaleY 0.93` en 0.06 s `power2.out` y vuelta a 1 en 0.24 s `power3.out` (producto ≈ 1, sin
    rebote); deslizamiento lateral `power3.inOut` 0.34 s (no necesita estela: viaja menos de su ancho por cuadro).
  - Palabra debajo de la ficha (z-index menor), revelada con `clip-path: inset(0 100% 0 0) → inset(0 0 0 0)` + `x −30 → 0`.
  - Subrayado dorado: SVG con `viewBox` en px del tamaño real (440 × 40), `pathLength="100"`, `stroke-dasharray="100"`,
    `stroke-dashoffset 100 → 0`. **No** usar `vector-effect: non-scaling-stroke` con `preserveAspectRatio="none"`: el trazo
    se ve punteado antes de dibujarse (`piloto/snapshots/clave/frame-17-at-5.3s.png`).
  - En el video real el cierre necesita ~2.5–3 s (en el piloto se comprimió a 0.8 s y el lema entra apresurado).
- **Componente `motion-blur` del registro (probado como alternativa)**: dentro del cuadro (sub-composición con
  `<template>`) **no se adjunta**: la ficha sale nítida y no hay aviso en el log del render ni en el snapshot
  (`piloto/snapshots/estela/comparacion-svg-vs-registro.png`, fila de abajo; `registro-en-subcomposicion.png`). En una raíz
  independiente sí funciona y deja una escalera de 8 copias muy visible (`registro-raiz-independiente.png`). Tampoco vería
  movimientos escritos en un `onUpdate` (busca el timeline con los eventos apagados). Conclusión: **no usarlo**; la estela
  SVG ligada a la velocidad es la ruta de la v4.

---

## 4. GSAP: copia local obligatoria

- `curl https://cdn.jsdelivr.net/...` → `CONNECT tunnel failed, response 403` (política de salida de esta sesión).
- `hyperframes check` lo detecta: `request_failed … net::ERR_TUNNEL_CONNECTION_FAILED` + `page_error: Cannot read
  properties of undefined (reading 'timeline')`.
- `hyperframes render`: el compilador intenta descargar el script para incrustarlo («Failed to download CDN script … HTTP
  403»), el cuadro no registra su timeline y el render **falla a los 15 s** con `sub_timeline_script_failure` (no escribe
  MP4). No es silencioso, pero bloquea.
- Con `<script src="assets/vendor/gsap.min.js"></script>` (GSAP 3.14.2, `assets/vendor/` ya lo tiene) todo funciona; el
  compilador incrusta también las fuentes locales como data URI.
- **Para el pipeline**:
  1. En el contrato del worker (PLAYBOOK §4): la carga de GSAP dentro del `<template>` es
     `<script src="assets/vendor/gsap.min.js"></script>`, no jsDelivr.
  2. `assemble-index.mjs` escribe el CDN con `integrity` y `crossorigin` (línea 729 del script de la skill). Después de cada
     ensamblado, y antes de `transitions inject`:
     `sed -i -E 's#<script src="https://cdn\.jsdelivr\.net/npm/gsap@3\.14\.2/dist/gsap\.min\.js"[^>]*></script>#<script src="assets/vendor/gsap.min.js"></script>#' index.html`
     (y lo mismo en `captions.mjs` si se usan subtítulos).
  3. `hyperframes check` debe quedar sin `request_failed`.

---

## 5. Bordes, determinismo y saltos

- **Curva de energía entre cuadros** (`piloto/medicion/energia.sh`, diferencia absoluta de luma por cuadro, 60 fps):
  - Quitar filtros en reposo (odómetro entre 4.66 y 4.73 s, ficha al posarse, blur vivo en 2.27 s): sin picos.
  - Aplanado del 3D (3.42 s): 0.055 contra 0.015 de fondo, imperceptible.
  - Cortes entre tramos (1.4, 2.4, 3.8, 5.2 s): son cortes duros por diseño.
  - **Micro-titileo de 1 cuadro** en 0.567 s (0.86/255 contra ~0.2): un cuadro rasterizado distinto a mitad del fundido de
    placas con el mundo escalando. Las colas de escala muy largas (`power3.out` de 1.0–1.3 s) dan alternancias pequeñas
    (0.05–0.08). No se perciben a velocidad normal; la regla «cámara quieta durante la lectura» ya las evita.
- **Determinismo entre workers**: con 1, 2 y 3 workers los cuadros salen idénticos bit a bit en (a), (a2), (c) y (d); en (b)
  (capas 3D, opacidad y escalas) difieren hasta 10/255 (PSNR ≥ 54 dB) según dónde empieza el tramo de cada worker. Invisible;
  pero cualquier prueba de regresión debe comparar por PSNR (≥ 50 dB), no por md5.
- **`snapshot` ≠ render**: el snapshot usa `screenshot` y búsquedas sueltas; no reproduce el borroso de `will-change` ni el
  antialias del render. Úsalo para composición y tiempos; la nitidez y los saltos se revisan en el MP4.
- `data-start` negativo en el host no recorta el inicio (se ignora): para medir un tramo se usa un host con `data-hidden`
  y `tl.shiftChildren`, como en `piloto/medicion/variantes.py`.

---

## 6. Presupuesto

Costo convertido a **segundos de render final** (60 fps, high, 3 workers ≈ 2.5 núcleos efectivos) por cada segundo de
efecto en pantalla, y cuántos segundos de efecto caben por cada **+30 s** de render. El tope real lo ponen las reglas de
estilo (SINTESIS), no la máquina.

| Técnica | Costo marginal | +render por s de efecto | s de efecto por +30 s de render | Tope recomendado en los 55 s |
|---|---|---|---|---|
| Rack focus vivo ≤ 24 px → 0 (0.8–0.9 s) | +12 ms/cuadro promedio (pico +36) | ~0.3 s por rack | ~100 racks | **2–3 racks** (apertura, cambio de mundo), ≤ 1.2 s c/u: ≈ 3 s |
| Blur vivo sostenido σ 24 (cuadro completo) | +36–42 ms | ~0.9 s | ~33 s | **≤ 1.2 s seguidos**; más largo → placa |
| Placa pre-desenfocada (fundido) / quieta | +8–9 ms / ≈ 0 | ~0.2 s / ≈ 0 | sin tope | fondos desenfocados sostenidos (cielo, tarjetas de fondo) |
| Cámara: escala/traslado del mundo DOM | +19 ms | ~0.45 s | ~65 s (más que el video) | 25–30 % del video en movimiento grande (regla 18) |
| Pose 3D + sombra + holograma + brillo | ≈ 0 | ≈ 0 | sin tope | 1 objeto flotante por cuadro, solo entradas (regla 14) |
| Estela SVG direccional (odómetro, ficha, columnas) | +1–2 ms | ~0.05 s | sin tope | 1–3 golpes por escena, ≤ 3 objetos a la vez (regla 21) |
| `motion-blur` del registro | — | — | — | **no usar** (no funciona en cuadros) |

Estimación total: ~3 min a 60 fps high y ~2 min a 30 fps high para 55 s; ×1.5 de margen por la cámara con 24 avatares y
las gráficas ⇒ ≤ 5 min y ≤ 3 min. Si un cuadro real resulta pesado, medirlo solo: host con ese cuadro +
`render -c <host>.html --workers 1 --debug` y leer `captureP50Ms` del `perf-summary.json` que indica el log.

### fps del render

- **Final: 60 fps** — `npx hyperframes@0.8.134 render --quality high --fps 60 --workers 3`. La ficha muestra 7 cuadros de
  caída en lugar de 3, el odómetro y los empujes laterales de 1920 px se ven continuos, y el costo es ~1.5× el de 30 fps
  (17–19 s contra 11–13 s por 6 s). La estela usa obturador en segundos (1/60 s): a 60 fps es 360°, a 30 fps 180°, el
  mismo largo de estela en ambos.
- **Iteración: 30 fps draft** — `render --quality draft --fps 30 --workers 3` (~1.5 s de render por segundo de video).
- **Siempre `--workers 3`** en esta máquina de 4 núcleos: `auto` calibra con 5 cuadros y a veces elige 1 worker (60 fps:
  26.6 s contra 17.2 s); 4 workers no mejora porque el codificador de `high` usa los mismos núcleos.

---

## 7. Lista de «no hacer» para los workers (derivada del piloto)

1. GSAP desde jsDelivr (bloquea el render).
2. `will-change` en un elemento que cambia de escala; `transform: scale` sostenido sobre UI con texto (usar `zoom`).
3. Blur vivo de cuadro completo > 24 px, o sostenido > 1.2 s (usar placa); `tl.set(el, {filter: 'none'})` para quitar un
   blur animado por variable (usar el driver `desenfoque`).
4. El componente `motion-blur` del registro dentro de un cuadro.
5. `vector-effect: non-scaling-stroke` con trazos que se dibujan por `pathLength`/`dasharray`.
6. `preserve-3d` para una tarjeta plana (no hace falta, y `filter`/`opacity`/`overflow` en sus ancestros la aplanan).
7. Juzgar nitidez o saltos con `snapshot`: siempre con cuadros del MP4 (`ffmpeg -ss <t> -i video.mp4 -frames:v 1`).
8. Selectores `[id="…"]` cuando el id empieza con letra: `lint` avisa `id_override_reduced_specificity`; usar `#id`.
9. Dejar hosts de medición (`medicion-*.html`) en la raíz del proyecto: `check` falla con `multiple_root_compositions`.
10. Oro `#A8842C` como texto pequeño (el «Revisión» de 12 px × 1.6 dio 3.47:1 en `check`): confirma la regla 12.

---

## 8. Reproducir

```bash
cd video/susan-v4/piloto
npx --yes hyperframes@0.8.134 check                                   # 0 errores
npx --yes hyperframes@0.8.134 render . --quality draft --fps 30 --workers 3 --output renders/piloto-draft-30.mp4
npx --yes hyperframes@0.8.134 render . --quality high  --fps 60 --workers 3 --output renders/piloto-high-60-w3.mp4
# costo por técnica (1 worker): generar variantes, medir, limpiar
python3 medicion/variantes.py .
bash medicion/medir.sh . 30 draft 3 vacio a a-sin-placas a2 a2-sin-blur a2-max a2-max-quieto a2-quieto b b-plano c c-sin-filtro d d-sin-estela
rm -f medicion-*.html && rm -rf compositions/frames/med
# curva de saltos y nitidez
bash medicion/energia.sh renders/piloto-high-60-w3.mp4 | awk '$2 > 0.5'
bash medicion/nitidez.sh <recorte.png>
```

Placas: `npx --yes hyperframes@0.8.134 snapshot . --at 1.35 --no-end -o snapshots/placa` y
`ffmpeg -i snapshots/placa/frame-00-at-1.35s.png -vf "format=rgb24,gblur=sigma=24:steps=3" -q:v 2 assets/piloto/plate-s24.jpg`
(ídem σ 6). Variante con el componente del registro: `python3 medicion/variante_mb.py . 30` (crea
`compositions/frames/s99-piloto-mb.html` y `medicion-full-mb.html`; borrarlos después).
