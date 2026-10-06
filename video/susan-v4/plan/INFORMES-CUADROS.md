# Informes finales de los 8 cuadros (construcción + revisión + corrección)

### s06-tendencia (6 «Hacia dónde va»)
Revisión: corregir (4 hallazgos)
Corrección final:
Fixed the important finding and the two cheap minor ones in `s06-tendencia.html`. I rejected the optional fourth one, for the reason below. `frame-check` passes with 0 errors and 0 warnings, and the stills look right.

**Changes** (only `/home/user/susan/video/susan-v4/compositions/frames/s06-tendencia.html`):

1. **[importante] «13.3» blurred at 0.90–1.46 s — fixed.** `aplicarLectura` now sets the speed to 0 outside the rolling stretch:
   `var v = (t <= PASOS[0] + 1e-4 || t >= T_TK1 - 1e-4) ? 0 : …`
   - The reviewer's exact fix was not enough on its own. GSAP rounds `tk.t` to 6 decimals, so after seeking backward the value sits just above `PASOS[0]` and the blur came back. A probe confirmed this: going 3.0 → 1.2 s still returned `url(#…mb-lect)` with the strict comparison. That is why the 1e-4 s margin is there.
   - I also moved `T_TK1` so it is defined before the first `aplicarLectura()` call.
   - Probe result: at 1.00, 1.20, 1.40 and 1.46 s, `tira.style.filter` is `'none'` and the blur is 0, both seeking forward and backward. The blur starts at 1.4667 s, the first rolling frame. The crops show «13.3» sharp.
2. **[menor] still «0 alumnos» at 5.85–6.00 s — fixed.** The column now fades in with the roll: `fromTo($('nueve'), {opacity:0}, {opacity:1, duration:0.10, ease:'power1.out'}, 6.00)`. Opacity is 0 at 5.95 and 6.00 s. At 6.0167 s it is 0.31, already rolling at −100.6 px with the blur on. No still «0» shows in the captures.
3. **[menor] hard stop at the end of the tic — fixed.** The pill goes down 0→4 px over 6.40–6.45 (`power2.out`) and comes back 4→0 over 6.45–6.50 (`power2.inOut`), so it reaches 6.50 at speed 0.
   - Measured top edge: 414.00 → 416.82 → 417.85 → 418.00 → 417.40 → 414.60 → 414.00 (6.40 to 6.50 s at 60 fps). It is exactly 414.00 from 6.50 s onward.
   - The tic is still needed to break up the still stretch for the motion meter: the 6.4 s bucket measures 0.42, against a 0.30 threshold.
4. **[menor, optional] guide head crossing the S6–S7 gap — rejected.** The crossing lasts about 0.14 s, at the slow start of `power1.inOut`, and the vertical line under the head keeps it anchored.
   - A jump to S7 would be a 74 px teleport in one frame, which reads as a glitch.
   - Changing the ease to `power1.out` would break the packet's `power1.inOut` and add a jolt of about 2200 px/s at S6.
   - Drawing the projection from S6 would undo deviation 3.

**For the assembly report:**
- Deviation 1: the 95 % band opens at 3.80–4.45 s, after «semestre», so the 3.8 s poster shows the chart with the tooltip and no band.
- Deviation 3: the projection starts at S7, as in the real app.
- STORYBOARD and the poster should be kept consistent with both.

**Final checks:**
- `node scripts/preview-frame.mjs s06-tendencia --bordes --anclas --sheet`: 11 captures, no load errors. The sheet is at `/home/user/susan/video/susan-v4/revision/s06-tendencia/sheet.png`.
- `node scripts/frame-check.mjs s06-tendencia`: 0 errors, 0 warnings, "OK sin hallazgos".
  - Slow stretches: 0.7-1.4, 2.5-3.2, 3.4-4.1, 4.3-4.9, 5.6-6.4, 6.5-7.4. None reaches 1.0 s.
  - Longest pause without a visible event: 0.95 s (6.5–7.45).
  - 7 sfx cues, none orphaned. 1 overshoot, the tooltip's `back.out(1.4)`.

**Handoffs** (unchanged):
- **handoff_in** at t=0: the days card is drawn at its final box x 140–1780, y 210–900 (640 wide). Its starting clip-path is `inset(90px 100px 80px 100px round 28px)`, which gives a visible box of x 240–1680, y 300–820, centre (960, 560), radius 28. It is white #FFFFFF with a 2 px #E7E2DC border on a layer that follows the same clip.
  - Title «Ausentismo por día de la semana»: Hanken 600 32 px, x=300, centre y=360.
  - Cells 280×190, radius 35, centred on y=590 at x=600, 960 and 1320. Figures 17.7 / 16.4 / 21.8 %, Hanken 600 44 px, centred on y=580. Lun and Mié at 55 % opacity; Vie at scale 1.06 with its ring.
  - Lun / Mié / Vie labels centred on y=725.
  - Ink pill «Día crítico: Viernes»: 28 px, height 64, centre (1320, 455).
  - Meta «32 ausencias en 6 sesiones» centred on (1320, 770).
  - PageHeader at x=140, centre y=160. Selector with its right edge at x=1780, centre y=160.
  - E3 background with the violet halo centred at (1150, 500) and grain at 4 %. Everything still.
- **handoff_out** from 6.50 s: ink pill «9 alumnos en riesgo» at left 650, top 414, 620×112, centre (960, 470), radius 56, #1E1919.
  - «9» Hanken 600 72 px and «alumnos en riesgo» Hanken 500 36 px, white, on the same baseline with a 20 px gap, group centred.
  - scale 1, opacity 1, x/y 0, no rotation, filter `none` (both the column and the readout), still.
  - E3 background with the pink halo #FBE6E2 centred at (960, 500) and grain at 4 %.
  - Chart, readout, selector and PageHeader at opacity 0.

I did not commit anything. Another process's sweep commit `8e07686` already picked up these changes to `s06-tendencia.html`.

### s01-cinco-minutos (1 «Cinco minutos cada clase»)
Revisión: corregir (6 hallazgos)
Corrección final:
No bloqueantes llegaron en esta revisión. Corregí los tres hallazgos importantes y los tres menores, pero frame-check sigue fallando con 1 error: marca un tramo muerto de 1.1 a 3.0 s. Es el conflicto que la revisión ya preveía: «5 min» queda quieta al píxel y el medidor no ve lo que se mueve en la zona de la barra. No moví la cifra para pasarlo. Solo modifiqué `compositions/frames/s01-cinco-minutos.html` y no hice commit.

**Qué cambió**
- **[importante] Apertura:** quité el giro desde 0.20 s y la tira de centenas queda `[U+2007, 5, 6…9, 0, 1, 2]`. La columna está vacía, la barra queda sola y la cifra rueda un solo renglón, de vacío a «5», entre 0.70 y 1.65 s (power3.out, con estela solo mientras va rápido). El tic sigue en 1.65 s. El «5» empieza a asomar bajo la máscara hacia 0.78–0.80 s, cuando el desenfoque de la escena ya bajó de 1 px (0.6–0.8 px). Es la única cifra que aparece.
  - Arranco a 0.70 y no a 0.90 por el medidor. Con 0.90 y con 0.80 mide un tramo muerto de 0.0 a 1.0 s. Con 0.70 el tramo es de 0.0 a 0.9 s, pero el bin de 0.9 s mide 0.31 contra un umbral de 0.30, así que el margen es mínimo.
- **[importante] Cifra:** ahora vive en su propio rig (`#…-cifra-rig`), que solo comparte con la cámara la escala del rack (1.12 → 1, de 0.10 a 1.30 s). La cámara ya no se acerca ni regresa. Comparé la zona de la cifra a 1.65, 1.66, 1.95, 2.10, 2.40 y 2.94 s: 0 píxeles distintos.
  - La energía pasó a una capa de barra (pista, tinta y horas): scale 1 → 1.05 con origen en (360, 560) entre 1.95 y 2.40 s, y regresa a 1 dentro del pliegue (2.95–3.55 s).
- **[importante] Fusión en el disco:** el disco va siempre en tinta y opacidad 1, y crece por `clip-path: circle(r)`. Nace con 40 px a 5.74 s y llega a 168 px a 6.05 s (power2.inOut, el pop sigue en 6.05). Las astillas van encima del disco. Para cada una calculé el instante en que su centro cruza el borde actual del disco, y ahí se apaga en 0.04 s; todas desaparecen entre 5.79 y 5.97 s. El icono aparece de 5.94 a 6.20 s, cuando el disco pasa el 80 % de su radio. Conservé el anillo y la sombra de 5.95–6.20 s.
- **[menor] Pliegue:** la capa de barra quedó encima de la rejilla y de las astillas, así que al plegarse tapa S2-Lun.
- **[menor] Onda de la cuenta:** la limité a 2× (6 → 12 px). Además el barrido va un poco más rápido (0.012 s por columna en vez de 0.016); a 2× sin ese cambio aparecía un tramo muerto de 3.6 a 4.6 s.
- **[menor] Radio de las casillas:** cada astilla va dentro de una máscara con la silueta de su casilla (60 × 44, radio 10). La tinta de la casilla 0 hereda el recorte redondeado de la pista. En el recorte ampliado de 3.96 s el radio izquierdo ya es 10, igual que el derecho.

**Resultado final de frame-check: 1 error y 1 aviso**
- **ERROR, tramo muerto de 1.1 a 3.0 s.** Energía por bin con la cifra quieta:

  | Tramo | Energía |
  |---|---|
  | 1.6–1.8 s | 0 |
  | 1.9 / 2.0 / 2.1 s | 0.07 / 0.12 / 0.07 |
  | 2.3–2.8 s | 0 |

  Lo que queda en movimiento en ese tramo es poco y de bajo contraste: un relleno de 100 × 28 px y una pista #F0EDE8 sobre #F7F5F2. Calculé que ni moviéndose todo a la vez llegaría a 0.30, y engrosar el tramo de 28 a 44 px tampoco alcanza. Para quitar el error hace falta que se mueva la cifra (lo que la revisión prohíbe) o que el paquete agregue algo con más presencia visual en ese tramo.
- **AVISO, el primer movimiento llega a 0.9 s.** El rack focus empieza a 0.10 s, pero sobre esa barra tan clara el medidor solo registra 0.03–0.05. Lo provoca que la barra quede sola al principio, como pide la revisión.
- Lo demás pasa: 8 sfx_cues sin huérfanos y sin hallazgos de estructura ni de fromTo repetido.
- **Observación para el paquete:** la pista #F0EDE8 casi no se ve sobre la crema, y es el objeto del gancho. Subir su contraste mejoraría la apertura y el medidor. Es un cambio de token que no me toca.

**Handoffs**
- **handoff_in:** no hay; es el primer cuadro y entra por corte.
- **handoff_out:** desde 6.20 s, quieta hasta 6.40 s (0 píxeles distintos entre 6.20 y 6.37 s).
  - Disco #1E1919 de 168 px con centro en (960, 500) y `clip-path: none` desde 6.05 s.
  - Anillo blanco #FFFFFF de 15 px (diámetro exterior 198 px).
  - Icono Lucide scan-face blanco de 72 px con trazo 1.75, centrado.
  - Disco, anillo e icono en scale 1, opacity 1, filter none y sin rotación.
  - Sombra en capa aparte: 0 30px 90px rgba(30,25,25,.18).
  - Fondo E3 crema sin halo y grano estático al 4 %; nada más en pantalla.
  - En la zona de la ficha coincide con el fotograma 0.00 s del cuadro 2 (0 píxeles distintos con tolerancia del 2 %).

Archivos en `/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/s01d/`:
- p2/merge.png
- p3/fold.png
- p3/z396.png
- p4/s1.png

La hoja oficial está en `/home/user/susan/video/susan-v4/revision/s01-cinco-minutos/sheet.png`.

### s02-un-boton (2 «Te presentamos a SUSAN»)
Revisión: corregir (6 hallazgos)
Corrección final:
Corregí los dos hallazgos graves (bloqueante e importante) y los cuatro menores. frame-check pasa con 0 errores y 1 aviso, y los dos relevos coinciden con los cuadros vecinos al píxel. Solo modifiqué `/home/user/susan/video/susan-v4/compositions/frames/s02-un-boton.html`. No hice commit porque no me lo pidieron; un commit «wip» automático ya recogió parte de estos cambios (cc37c9e).

**Cambios**
- **[bloqueante] Subrayado dorado:** borré el `<svg>` del subrayado, su CSS, el tween de dashoffset y `T.subrayado`. «SUSAN» queda solo en Hanken 600 y en este cuadro ya no hay oro.
- **[importante] Brillo:** ahora vive en `#s02-un-boton-brillo-caja`, de 632 × 96 r16, dentro de `#s02-un-boton-boton` y encima de `#sup`. El tween va de xPercent −52 a 120 en 0.5 s con power2.inOut, desde 2.80. Antes de 2.80 tiene opacidad 0 (`tl.set` en 0 y en 2.80). En las fotos se ve así: a 2.783 no hay nada; a 2.80 asoma una cuña tenue en el borde izquierdo; cruza «Abrir y pasar lista» entre 2.90 y 3.05 y sale hacia 3.08, más o menos lo que dura `sheen-s` (0.26 s).
- **Chip:** el relevo va en secuencia. «Programada» sale de 5.00 a 5.04 y «Abierta» entra desde 5.04 (0.18 s, power3.out). En las fotos de 5.00 a 5.10 ya no se enciman.
- **Icono contra rótulo:** el rótulo entra a 0.52 con 0.22 s y la flecha a 0.55 con 0.20 s; ninguno pasa de 0.77. En las fotos de 0.45 a 0.60 el icono ya no toca la «A».
- **Sombra de la ficha:** ahora mide 198 × 198 (left 217, top −15) y se estira a 662/198 × 126/198, con el mismo fundido de 0.10 a 0.55. Además, scan-face ahora mide 72 px a escala 1 y baja a 40/72. Así el icono también coincide al píxel con el cuadro 1, sin perder nitidez en reposo.
- **Despegue:** empieza en 1.95 (0.45 s, power3.out).
- **Acercamiento:** dura 0.8 s con power3.inOut, entre 3.65 y 4.45. Las sombras van en un grupo `#s02-un-boton-sombras` con el mismo origen y escala que el rig, así que la tarjeta ya no sobresale de su sombra.

**Lo que no hice como sugirió la revisión**
- **Acercamiento entre 4.15 y 4.95, terminando en la compresión:** lo probé y frame-check marcó error de tramo muerto entre 3.1 y 4.4 s (1.3 s). El brillo ahora termina hacia 3.1 y el pulso apenas mueve la imagen. Lo dejé entre 3.65 y 4.45, que parte la espera en dos. Se asienta 0.33 s antes del halo de foco y de «botón», y se queda en 1.04 hasta el cambio a la cámara (5.30).

**Resultados finales**
- **frame-check:** 0 errores y 1 aviso. Tramos lentos de 2.2–2.9, 3.1–3.9 y 4.3–5.0 s; ninguno llega a 1.0 s. La pausa más larga sin evento visible es de 0.33 s. Los 8 cues de sonido tienen tween y hay 1 sobreimpulso. El reparto de movimiento no cambió: 13 % grande, 38 % micro y 48 % quieto (el dato es solo informativo).
- **El aviso:** un icono de 24 px. Es el scan-face del chip «Reconociendo», que el contrato de handoff_out fija en 24 px.
- **preview-frame** (`--bordes --anclas --sheet`): 12 fotos en `/home/user/susan/video/susan-v4/revision/s02-un-boton/` (hoja en `sheet.png`). El póster de 2.7 s muestra la marca limpia.

**Relevos implementados**
- **handoff_in (0 s):**
  - Disco #1E1919 de 168 px centrado en (960, 500), con anillo blanco de 15 px (198 px por fuera).
  - scan-face blanco de 72 px, trazo 1.75, centrado.
  - Escala 1, opacidad 1, sin rotación, filter none, quieta.
  - Sombra 0 30px 90px rgba(30,25,25,.18) en un círculo de 198 px centrado bajo la ficha.
  - Fondo E3 #F7F5F2 sin halo, grano al 4 %.
  - Diferencia contra el s01 del commit a 6.367 s: máximo 4 y ningún píxel por encima de 4.
- **handoff_out (quieto desde 5.90 s):**
  - Caja x 880, y 200, 900 × 506, radio 28, #1E1919, escala 1, opacidad 1.
  - Chip «Reconociendo» (scan-face de 24 px y texto Hanken 500 de 24 px, fondo rgba(30,25,25,.8), alto 44) con esquina en (904, 224).
  - «Cámara frente» con borde derecho en 1756 y tope en 224.
  - Sombra 0 40px 120px rgba(30,25,25,.14) con la misma caja.
  - Fondo E3 con halo #E6EEFC radial 55 % × 60 % centrado en (1330, 450), grano al 4 %. Sin cielo ni marca.
  - Diferencia contra s03 en 0 s: máximo 1.

**Pendientes para el orquestador (fuera de mi archivo)**
1. **STORYBOARD F2:**
   - Quitar «1.95 draw» de sfx_cues. frame-check no lo marca huérfano solo porque ahora el despegue empieza en 1.95, pero ya no hay trazo que dibujar.
   - Escena 2 sin subrayado.
   - «Oro: el subrayado» → «Oro: ninguno».
   - Escena 3: el brillo cruza el botón, no la tarjeta (de −52 a 120, 0.5 s).
   - El acercamiento va de 3.65 a 4.45.
   - El rótulo entra entre 0.52 y 0.77.
2. **Paleta, Topes y Locked de la dirección de video** («oro solo en los dos subrayados…»), la receta de `frame.md` §8 y los packets de s02 y s08: sin subrayado.
3. **s01 en el árbol de trabajo:** otro agente lo está editando y, en este momento, a 6.367 s pinta el anillo sin el disco ni el icono. Hay que volver a comparar el relevo 1→2 cuando lo termine.

### s05-dia-critico (5 «Qué día faltan más»)
Revisión: corregir (4 hallazgos)
Corrección final:
Corregí el hallazgo importante: cada tic (1.90, 2.40 y 2.90) y el pop-2 (4.55) ya coinciden con la llegada visible de su cifra o de la píldora. frame-check sigue marcando los mismos 3 ERROR de movimiento: son el límite del medidor en este cuadro y te toca decidir si los aceptas. Solo modifiqué `/home/user/susan/video/susan-v4/compositions/frames/s05-dia-critico.html`. No hice commit porque no se pidió.

**Qué cambió**
- **Odómetro (importante, corregido).** Las ventanas siguen en 1.20–1.90, 1.70–2.40 y 2.20–2.90, y los tiempos de sfx_cues no se movieron. Las columnas se fijan de derecha a izquierda:
  - **% y décimas:** el % se detiene en t1−0.30 y las décimas en t1−0.16.
  - **Punto y unidades:** el punto se detiene en t1−0.12; las unidades ahora dan dos vueltas en vez de una y terminan en t1.
  - **Decenas:** su último paso dura 0.20 s con `power3.out` y termina exactamente en t1. En Vie hay un paso previo, de vacío a 1 (1.28–1.60 s locales de su ventana, es decir 2.28–2.60), y el paso final es de 1 a 2.
  - Las unidades terminan en t1 por una razón: si se fijaban antes, por 4 a 6 fotogramas se leía un valor falso («7.7 %», «11.8 %»). Ahora, en el peor caso, se ve 2 o 3 fotogramas y desalineado.
- **Relleno.** El radio del círculo de tinte bajó de 176 a 162, el punto visible más lejano de la casilla redondeada. Antes el color cubría la casilla a la mitad del tramo; ahora termina de llegar casi junto con la cifra.
- **Píldora.** La entrada es ahora un golpe de 0.20 s con `power3.out`, de 4.35 a 4.55: sube 14 px y pasa de opacidad 0 a 1. Sigue dentro de la ventana 4.20–4.55, termina en el pop y no tiene sobreimpulso.

**Verificación (capturas a 60 fps, comparando fotogramas por zona)**
- **Último fotograma en que algo se mueve:** Lun 1.833, Mié 2.333 y Vie 2.833 (para el fotograma siguiente ya nada se mueve). Es decir, 0.05–0.067 s antes de cada tic. El navegador mueve el texto en saltos de píxel entero, así que el último medio píxel de la curva no se ve.
- **A t1−0.1 todavía hay algo llegando:** las decenas están unos 3 px por debajo de su lugar (se ve en las capturas de 1.80, 2.30 y 2.80).
- **Píldora:** cambia mucho hasta 4.47, el último cambio de píxel es 4.533→4.55 y a 4.55 ya está quieta.
- **Quietud de Scene 2:** va de 2.85 a 3.80, o sea 0.95 s. Antes eran 0.983 s medidos y ~1.1 s percibidos. No pude bajarla a 0.90 s: ninguna llegada que desacelera puede seguir moviendo píxeles en sus últimos ~0.05 s.
- **Hoja de contactos y handoff de 7.17 s:** revisados, sin regresiones.
- **frame-check:** 3 errores y 0 avisos.
  - (d) sonido: 6 cues, ninguno huérfano. (e) lectura: 2 marcas, sin error.
  - Movimiento: grande 0 %, micro 10 %, quieto 90 %.
  - Tramos que marca como muertos: 0.0–1.3, 2.4–3.8 y 4.5–7.2. Coincide con lo que adelantó la revisión: el primero es un artefacto del host aislado, porque en el video ensamblado 0–0.5 s es el push-slide; el segundo es la quietud diseñada de 0.9 s; el tercero es micro-movimiento real más la quietud final aprobada de 0.95 s. Para darle más energía al cuadro habría que cambiar el plan.

**Hallazgos menores que no apliqué**
- **La píldora tapa la parte de arriba del anillo:** la posición de la píldora es un número del handoff compartido con s06, y la revisión pide no cambiarlo solo en s05. Si quieres arreglarlo, hay que subir el centro de la píldora a y=451 en el handoff_out de s05 y en el handoff_in de s06 al mismo tiempo.
- **Relleno X 51/47/63 contra 59/54/72 de la app:** dejé los valores del paquete (frame.md §6). Si prefieres la fidelidad a la app, hay que cambiarlos en s05 y en el handoff_in de s06 a la vez.

**Handoffs implementados (sin cambios)**
- **handoff_in:** la Analítica completa y plana desde 0.00 s.
  - Contenido: PageHeader, selector y TarjetaGrafica con tres casillas vacías que muestran «–».
  - Estado: scale 1, opacity 1, rotationX/Y 0°, velocidad 0 px/s.
  - Fondo: E3 con halo violeta #EEE9F7 centrado en x=1150, y=500.
- **handoff_out:** todo quieto desde 6.25 s.
  - **Tarjeta:** caja x=240 y=300 w=1440 h=520, radio 28, blanca, borde 2 px #E7E2DC, scale 1, filter none.
  - **Título:** 32 px 600, borde izquierdo en x=300, centro en y=360.
  - **Casillas:** 280×190, radio 35, centros en y=590 y x=600/960/1320.
  - **Cifras:** «17.7 %», «16.4 %» y «21.8 %», 44 px 600, centradas en y=580.
  - **Relleno y resalte:** relleno X 51/47/63; Lun y Mié al 55 %; Vie a scale 1.06 con anillo de 4 px rgba(179,38,30,.7).
  - **Etiquetas de día:** 24 px 500 #6F6A65, centradas en y=725.
  - **Píldora:** #1E1919, texto blanco 28 px 500, alto 64, centro x=1320 y=455 (caja 423–487).
  - **Meta:** 24 px 400 #6F6A65, centrada en x=1320 y=770.
  - **PageHeader:** 52 px 500, borde izquierdo en x=140, centro en y=160.
  - **Selector:** borde derecho en x=1780, centro en y=160.
  - **Fondo:** E3 con halo violeta y grano al 4 %.

Las capturas están en `/home/user/susan/video/susan-v4/revision/s05-dia-critico/`; la hoja de contactos es `sheet.png`.

### s07-a-tiempo (7 «Todavía a tiempo»)
Revisión: corregir (3 hallazgos)
Corrección final:
Corregí los tres hallazgos y `frame-check` da 0 errores y 0 avisos. Ningún tramo muerto llega a 1.0 s; el más largo dura 0.9 s.

**Qué cambió en `/home/user/susan/video/susan-v4/compositions/frames/s07-a-tiempo.html`**

- **[importante] Cámara.** Quité los tres movimientos y dejé dos, que salen del mismo punto:
  - El origen de la cámara es ahora el centro de la caja del «2», `transform-origin: 452px 544px`; antes era (960, 540).
  - Empuje: escala 1 → 1.07, de 3.45 a 4.35 s, `power3.inOut`, 0.9 s.
  - Regreso: escala 1.07 → 1, de 5.00 a 5.90 s, con el mismo ease y la misma duración.
  - Medido a 60 fps con el runtime 0.8.134: el centro del «2» queda fijo en (452.00, 544.00) desde 2.85 s hasta 7.6 s. Su traslación máxima es 0.2 px/s, solo a 2.85 s, cuando termina el odómetro.
  - «dos» (3.21 s) cae con todo quieto; el empuje empieza a notarse hacia 3.6 s, durante «…faltas».
  - «Cruce estimado: semana 9» termina de entrar a 4.45 s y se queda quieto hasta 5.08 s.
  - La cámara está a escala 1 y quieta desde 5.90 s, antes de «tiempo» (5.93 s). Ya no hay regreso encima de esa palabra ni reencuadre del pie.
  - Queda una sola espera a escala ≠ 1: 0.65 s a 1.07, de 4.35 a 5.00 s. Antes eran dos (0.6 s a 1.06 y 0.65 s a 1.04).
- **[menor] Ranking que asomaba.** De 2.40 a 2.70 s se apagan las siete filas que no son la de Iván, el subtítulo y la leyenda (de 0.35 a 0). Detrás de la tarjeta solo queda el panel con el título «Mayor riesgo».
- **[menor] Ficha de «Acción sugerida».** Ahora sigue el kit `.su-ficha` a E = 2: 72 × 72, radio 20, `calendar-check` de 40 px con trazo 1.75 y `top: 2px`. Moví el rótulo a `left: 92px` y «Contactar al alumno esta semana» a `left: 160px` para conservar los 20 px de separación.

**Desviaciones que dejé a propósito**

- **La espera de 0.65 s a 1.07 no la pude quitar.** El «2» no puede trasladarse de 2.85 a 4.05 s y tampoco puede haber un tramo muerto de 1.0 s o más. Lo único que da movimiento sin mover el «2» es una escala con origen en él. Por eso el «2» crece 7 % en su lugar entre 3.45 y 4.35 s.
- **Usé 1.07 y no el 1.06 de la revisión.** Probé 12 variantes y 1.07 deja el último tramo lento en 0.8 s en vez de 0.9 s.
- **La superficie blanca del ranking sigue al 34 %.** El contenido (el título) queda al 12 %, como pidió la revisión al decir «conserva el contrato de 12 % y 0.97». Si la superficie bajara al 12 %, el panel dejaría de verse.

**Resultados finales**

- `node scripts/preview-frame.mjs s07-a-tiempo --bordes --anclas --sheet` (más los instantes 2.40, 3.80, 4.50, 5.30, 5.60 y 6.55): 18 capturas y hoja de contactos en `/home/user/susan/video/susan-v4/revision/s07-a-tiempo/`. Las revisé: en 7.57 s ya no hay letras cortadas, la ficha mide 72 y el texto a 1.07 se ve nítido.
- `node scripts/frame-check.mjs s07-a-tiempo`:

| Medida | Resultado |
|---|---|
| Tramos lentos | 2.8–3.7 · 4.3–5.1 · 5.8–6.6 · 6.7–7.6 (máximo 0.9 s, ninguno muerto) |
| Movimiento | grande 7 % · micro 33 % · quieto 61 % (solo informativo) |
| Pausa más larga sin evento | 0.95 s (6.65–7.6) |
| Cámara | 3 tweens perceptibles (2 de cámara + el rig), 0 snaps |
| Sonido | 7 cues, 0 huérfanos |
| Iconos y trampas | OK |

- Hacia 6.6 s ya no queda cámara; la energía de ese tramo la pone el halo (6.45–6.65 s, `power3.in`), así que el cierre no necesita un tercer movimiento.

**Handoffs implementados**

- **handoff_in (t = 0):**
  - Píldora de tinta «9 alumnos en riesgo»: centro (960, 470), 620 × 112, radio 56, fondo `#1E1919`.
  - Texto: «9» en Hanken 600 de 72 px y «alumnos en riesgo» en 500 de 36 px, ambos blancos, misma línea base, 20 px entre ellos.
  - scale 1, opacity 1, rotationX/Y 0°, filter none, quieta.
  - Cámara en identidad.
  - Fondo E3 `#F7F5F2` con halo `#FBE6E2` centrado en (960, 500) y grano al 4 %.
- **handoff_out (todo quieto desde 6.65 s; la tarjeta ya lo está desde 5.82 s y la cámara desde 5.90 s):**
  - Tarjeta de Iván: centro (960, 540), 1200 × 600, radio 36, scale 1, opacity 1, rotationX/Y 0°, filter none.
  - Acción sugerida con su halo de foco (`0 0 0 8px rgba(0,97,254,.3)`, fondo `#EFECE7`).
  - Ranking detrás: rig con opacity 0.3429 y scale 0.97 (origen 960, 520). El título queda al 12 %, la superficie al 34 % y las filas, el subtítulo y la leyenda en 0.
  - Fondo E3 con halo rosa `#FBE6E2` en (960, 500).

**Git:** el commit `bfd93cd` del orquestador ya incluyó a media tarea los arreglos de la ficha y del ranking. Lo que falta sin commit en el árbol es solo el cambio de cámara, porque esta tarea no pedía hacer commit.

### s04-revision (4 «Lo dudoso lo decides tú»)
Revisión: corregir (4 hallazgos)
Corrección final:
**s04-revision revisado: frame-check da 0 errores y 1 aviso, y el preview se ve limpio.** Corregí los dos hallazgos importantes y los dos menores. Para el segundo agregué el aviso «Resuelto como Presente», que no está en el paquete y necesita tu visto bueno.

**Qué cambió (solo `/home/user/susan/video/susan-v4/compositions/frames/s04-revision.html`)**

1. **[importante] Hoja fantasma en la llegada.** La sombra ahora hace el mismo tween 3D que la tarjeta: rotationX 5→0, rotationY −8→0, z −160→0, y 40→0, 0.65 s power3.out desde 0.50. Su opacidad sube de 0 a 1 solo entre 0.80 y 1.15 s (power2.out). Revisé el DOM en 0.00, 0.62 y 1.15 s, y en cada uno la caja de la sombra coincide con la de la tarjeta. En los recortes de 0.62, 0.70, 0.80 y 0.95 s ya no aparece el doble borde. El desplazamiento de la sombra «contra la inclinación» ahora viene solo del offset propio del box-shadow (0 40px).
   - **Aviso para el orquestador:** F7 usa la misma receta de PILOTO §3b (sombra con x 40, y 70, scale 0.9) y puede tener el mismo defecto. Conviene corregir la receta en PILOTO §3b.

2. **[importante] La cámara movía texto después de «decides».**
   - Acercamiento de 1→1.03 entre 1.40 y 2.10 s (power3.inOut).
   - Alejamiento entre 3.30 y 3.80 s (0.5 s power3.inOut), que termina justo cuando empieza el halo de foco. La cámara está en 1 desde 3.80 s.
   - En el DOM, el chip «Presente» queda quieto en (1416.1, 392.4) desde 4.33 s y «(7)» desde 4.40 s. Nada de la estación se mueve después.
   - La escala sostenida bajó de 2.6 s a 1.2 s (de 2.10 a 3.30 s).
   - Pendiente menor: «89 %» y «93 %» quedan quietos 1.10 s y 1.01 s antes del reencuadre de 3 %, que empieza lento, y luego otra vez desde 3.80 s.

3. **El aviso de la cola, que necesita tu visto bueno.** Es el Toast real de ColaRevision con «Resuelto como Presente» y su «Cerrar» gris, a E = 2. Entra a 4.80 s: y 16→0 (los 8 px de la app) y opacidad, 0.3 s expo.out. Respecto a la app tiene tres desviaciones:
   - Va arriba a la derecha (x 1012–1780, y 84–216), centrado con el título. En su lugar de la app, abajo a la derecha, caería en y 920–1048, por debajo del límite de y ≤ 900. La versión de prueba del revisor también quedaba fuera de ese límite.
   - Va sin sombra, porque solo el objeto flotante la lleva.
   - El mensaje va centrado verticalmente con «Cerrar»; la app lo alinea arriba y en video parece un error.
   - Si no lo apruebas, hay que escalar el conflicto entre el paquete y SINTESIS 18: sin el aviso, frame-check da un tramo muerto de 4.2 a 5.8 s.

4. **[menor] Cambio de chip.** Ahora es secuencial: «Pendiente» se apaga de 4.00 a 4.08 s (power2.out, y 0→−3) y «Presente» entra de 4.08 a 4.33 s (power3.out, y 6→0). Revisé los fotogramas de 4.017 a 4.083 s y ya no hay doble exposición.

5. **[menor] Pestañas.** Ahora miden 44 px de alto con 2 px de relleno inferior, como las Tabs reales, y el texto queda a 22 px de la app sobre el subrayado. El texto queda centrado en y≈256, no en 250. Es una desviación aceptada: a 250 las pestañas quedan a 16 px del subtítulo y se leen como una línea más de párrafo.

**Resultados finales**
- `frame-check`: 0 errores y 1 aviso, que ya existía: el icono clock mide 26 px en pantalla.
- Reparto del movimiento: 7 % grande, 33 % micro y 60 % quieto.
  - No hay tramo muerto; los tramos lentos son 2.0–2.6, 4.2–4.8 y 4.9–5.8 s, todos de menos de 1.0 s.
  - La energía del aviso a 4.8 s es 0.47 (el umbral es 0.30).
  - 7 cues de sonido sin huérfanos y 5 marcas de lectura correctas.
- `preview-frame --bordes --anclas --sheet`: hoja en `/home/user/susan/video/susan-v4/revision/s04-revision/sheet.png`. Revisé el último fotograma: la tarjeta queda centrada en (1010, 610).
- Tu commit `8e07686` ya incluye esta versión; yo no hice commit.

**handoff_in implementado:** la estación completa y plana desde 0.00 s (PageHeader, Tabs y fondo crema con halo dorado #FBF1D9 en x=1010 y=560). La cámara está en scale 1 y no hay rotaciones en la estación. La tarjeta tiene opacidad 0 hasta 0.50 s.

**handoff_out implementado (5.7667 s):**
- Tarjeta y sombra en x 410–1610, y 340–880 (1200 × 540, centro x=1010 y=610), radio 36, scale 1, opacidad 1, rotationX 0 y rotationY 0, sin filtro.
- Chip «Presente», pestaña «Pendientes (7)» y botones secundarios al 45 %.
- Aviso «Resuelto como Presente» con opacidad 1 en x 1012–1780, y 84–216.
- Todo quieto: la cámara en 1 desde 3.80 s y el último movimiento, el del aviso, termina en 5.10 s.
- Halo violeta #EEE9F7 en x=1010 y=560, al 99.6 % (llega a 1 en 5.80 s).

### s03-camara (3 «La cámara pasa lista»)
Revisión: listo (2 hallazgos)
Corrección final:
(sin correcciones necesarias)

### s08-susan (8 «SUSAN»)
Revisión: corregir (4 hallazgos)
Corrección final:
Revised `/home/user/susan/video/susan-v4/compositions/frames/s08-susan.html`; it is the only file I wrote. Against the current STORYBOARD, frame-check still fails with 3 sound-cue errors. The composition is clean (0 errors, 0 warnings) once the cue changes requested below are applied to STORYBOARD.md. I did not commit.

**Changes per finding**
- **[bloqueante] gold underline:** removed the underline `<svg>`, its path, its draw tween and the `subrayado` key in `T`. Nothing replaces it, so there is no gold in this frame. I re-centred the lockup vertically: ficha and «SUSAN» capitals centred at y≈490 (`#s08-susan-mov` top 406, `#s08-susan-marca` top 423). The lema's capitals now sit at 649–677, with descenders ending at 684. Measured on the 4.20 s poster, the block from the top of the ring (391) to the foot of the lema (684) is centred at y≈538. The poster shows the clean lockup.
- **[importante] lockup rising 30 px:** removed `SUBE`, `gsap.set(lockup,{y:30})` and the lift tween. The ficha falls straight to (900, 490) and slides to (738, 490). Nothing in the lockup moves after 1.95 s.
- **Lema timing:** the lema now enters 2.50–3.10 (y 16→0 plus opacity, power4.out). That is just after «susan.» and before «Pasa lista…». A start at 2.85, as the review suggested, does not work: frame-check already counts the frame as still from 1.8 s, because the end of the «SUSAN» reveal is too small to register, so 2.85 leaves a 1.0 s still stretch. The lema also only registers as motion at certain start times; 2.55 and 2.45 failed, 2.50 passes.
- **[menor] sky layer, kept and justified:** without the layer, only the lema and the sweep move between 1.8 and 5.7 s. Across about a dozen timing combinations, the 1.0 s rule always failed somewhere unless there was a third visible event. I tried advancing the sweep, as the review suggested, but that only moves the long still stretch to after the sweep. So the layer stays, moved and shortened: 3.30–4.00 s (0.7 s, power1.inOut, one step, never undone), while the voice says «…lista en segundos». It is now meant as frame.md §8's «Fondo E1 aclarado a crema»: the sky stepping toward cream to prepare the final fade. It needs declaring in Scene 4 of the STORYBOARD (requested below).
- **[menor] holographic sweep:** the band is now 20% of the gradient (40–60%), and the sweep runs 86%→10% with power2.inOut, 4.45–5.15 s, starting after the voice ends at 4.37. At 86% the blue edge is already on the «S» on the first frame of the cue; at 10% the band has fully left the «N». Before the cue the holo layer stays at its CSS 100% (`immediateRender: false`), so the word shows no colour at rest. I kept the packet's power2.inOut rather than power1.inOut because power1.inOut registered as motion in only one bin and left a 1.1 s still stretch.

**Final checks**
- `preview-frame --bordes --anclas --sheet` (plus extra instants at 1.95, 2.50, 2.62, 3.30, 3.65, 4.00, 4.20, 4.45, 4.75, 4.95, 5.15, 5.70): 22 stills plus `sheet.png` in `/home/user/susan/video/susan-v4/revision/s08-susan/`. I looked at them. There is no underline and no lockup movement after 1.95 s. The colour shows from 4.45 s, the word is back to ink at 5.15 s, and the 4.20 s poster is clean.
- `frame-check s08-susan` against the current STORYBOARD: 3 errors, 0 warnings, all orphaned sound cues the STORYBOARD still lists: «2.05 draw», «3.20 soft-in», «4.60 sheen».
- The same check against a scratch copy of the STORYBOARD with cues `0.98 whoosh-s; 1.00 thud; 2.50 soft-in -6dB; 4.45 sheen`: 0 errors, 0 warnings.
- Still stretches as frame-check reports them: 0.0–0.8, 1.8–2.6, 2.7–3.5, 3.8–4.7, 4.9–5.7; the longest is 0.9 s. The margins are small: the lema and the sky step only just clear the motion threshold. The no-camera-tween, lema read-mark and sound-cue results above are from the scratch-STORYBOARD run.

**Handoffs implemented**
- handoff_in: under the blur-crossfade (0.5 s), the lightened E1 sky (#D2E0F9 at the top to cream #F7F5F2 from 70% down, two still clouds, static grain at 10%) is empty and still, with no objects and no internal blur, until 0.60 s. The first movement is the ficha entering from y −640 at 0.60 s.
- handoff_out: none, since this is the final frame. The cream veil `#s08-susan-velo` (#F7F5F2) fades in 5.70–6.00 s (power1.inOut) to opacity 1 at 6.00 s; it is the only exit in the video.

**Changes needed outside my file (requests)**
1. STORYBOARD.md, Frame 8:
   - `sfx_cues`: `0.98 whoosh-s; 1.00 thud; 2.50 soft-in -6dB; 4.45 sheen` (remove «2.05 draw»).
   - scene / focal / asset_candidates: drop the gold underline and `home-resaltado-patricia.png`.
   - Scene 2: the ficha lands at (900, 490).
   - Scene 3: «SUSAN» and the ficha centred at y=490; no underline; lema at 2.50–3.10 with its capitals at y≈649–677.
   - Scene 4: declare the sky step at 3.30–4.00 as the move toward cream that prepares the final fade; sweep at 4.45–5.15 with the 86→10% band.
2. frame.md §2.3 and §8: no gold in F2/F8 (BRIEF, 2026-10-06), and remove the underline from §8. The review mentions §3 for the gold rule, but that rule is in §2.3.
3. `.hyperframes/frame-packets/s08-susan.md`, `_video-direction.md` (gold cap and «Locked»), and plan/PLAN.md: remove the gold underline in F8.
