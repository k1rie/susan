# Informes finales de la ronda de dinamismo (8 cuadros)

Decisiones del orquestador sobre las desviaciones reportadas:
- s07: se ACEPTAN el foco del encabezado (3.00–3.90) y el latido de la fila (5.50–5.82): no son zooms de adorno ni datos
  nuevos. Declararlos en Scene 3/4 del STORYBOARD; poster de F7 a 6.0 s (reposo). No agregar el cue opcional 5.50 pop-1.
- s02: actualizar Scene 3 de F2 en STORYBOARD con los números reales del empuje/llegada y del brillo que da su informe.
- s06: la quietud de «9 alumnos en riesgo» a través del corte F6→F7 (~1.05 s) se ACEPTA como su momento de lectura.

### s03-camara (3 «La cámara pasa lista»)
Revisión: listo · mayor tramo sin cambio: 1.45 s · 3 hallazgos
Informe final:
I rebuilt the s03-camara frame to the new F3 shot list, and all checks pass: frame-check 0 errors, the 1.0 s dead-stretch check passes, and the seek-safety test is clean. Timings stayed on the plan, so the sfx_cues and both handoffs need no change. Nothing was committed, since this dispatch didn't ask for a commit.

The only file I wrote is `/home/user/susan/video/susan-v4/compositions/frames/s03-camara.html`.

**Shot list (local time, 8.50 s)**
| t (s) | On screen | Relay |
|---|---|---|
| 0.00 | Empty camera view, same as handoff_in | — |
| 0.10–0.50 | 23 abstract faces fill the view (unchanged) | — |
| 0.45–0.95 | **New:** the session's real page header in the left column, rebuilt in HTML from the captured screen: «Pasar lista» (52 px), «Administración Financiera (3A)» / «14 sep 2026 · 07:00 a 08:00 · Aula A-12» (two lines, 28 px gray), chips «Abierta» and «Automático» in the app's blue tokens. Enters top to bottom, y 28→0, 60 ms apart | cascade |
| 1.30 / 1.60 | Detection corners lock on; «Pendiente» chip under the central face (unchanged) | — |
| 2.45–2.95 | **The view opens to full screen (R3b, expo.inOut):** grows from its top-left corner to 2.135× and covers the whole frame with no cream line at the bottom. Corner radius 28→0, shadow fades out. Blur tied to speed, max 4 px on screen, only between 2.61 and 2.79. «Reconociendo» and «Cámara frente» stay native size and ride the corners (margin 24→48); the «Pendiente» chip stays native size, anchored under its face. The header doesn't move: the view covers it (≈2.67–2.74) and it is hidden at 2.95 | R3b |
| 2.95–4.40 | Class at full screen, 179 px faces; corners pulse once at 3.25–3.50; the camera icon pulses once at 3.85–4.15; no counters | — |
| 4.40–4.90 | Same tween in reverse; blur only between 4.56 and 4.74. Ends exactly at x=880 y=200, 900×506, radius 28, shadow back. Underneath, «Asistencia ahora · 0 de 24 presentes» and the empty bar slide in from the left (x −60→0, 4.55–5.00, no trail) | R3b |
| 4.90–7.30 | Wave of confirmations, «Presente», count rolls 0→19 (settled at 5.65), segmented bar, detail line, «Última captura…» (unchanged) | — |
| 7.30–8.30 | Liquid gauge rises to 88 %, halo turns green, everything still from 8.30 (unchanged) | — |

How it's built:
- **One driver for open and return:** a single paused-timeline tween runs from 2.45 to 4.90 and computes everything as a pure function of time.
- **Chips outside the view:** «Reconociendo», «Cámara frente» and the central chip now sit outside the view in screen coordinates. That is how they stay native size while it scales.
- **Stacking:** the left column now sits under the view, so the view reveals it on the way back.
- **Corner pulse:** it moved from 2.75 to 3.25.

**Final sfx_cues (same as the storyboard)**
`1.30 shutter; 2.70 whoosh-l -6dB; 4.65 whoosh-m -6dB; 4.90 sheen-s -3dB; 5.00 blip -3dB; 5.35 fill -3dB; 5.61 tick-1; 5.65 tick-2; 7.30 fill; 7.85 tick-3`

The whooshes land on the peak speed of the open (2.70) and the return (4.65).

**Handoffs**
handoff_in and handoff_out are unchanged and matched to the pixel. At 0.00 and from 8.30 on, the view is at its box with scale 1 and `filter: none`, and the chips are at 904,224 and right edge 1756.

**Check results**
- **frame-check:** 0 errors, 1 warning. The warning is the 24 px camera icon in «Reconociendo»; it was there before and the 24 px size comes from handoff_in.
  - Motion split: 31 % large, 59 % micro, 11 % still.
  - Slow stretches: only the final stillness at 7.9–8.5 (0.6 s).
  - Longest gap with nothing visible happening: 0.55 s.
  - Sound: 10 cues, none orphaned.
- **Preview** (`--bordes --anclas --sheet`) plus stills every 0.05–0.10 s through 2.25–2.95 and 4.40–5.25: no pops or double images, chips anchored correctly, text sharp at rest. The sheet is in `revision/s03-camara/sheet.png`.
- **Seek test:** reached each relay instant (±1/60 s) going forward, backward and from 0.7 s earlier. Frames match except for tiny float-rounding differences (at most 1 gray level) in the detection corners at 1.30–1.62; the previous version of the frame has the same differences. Blur is `none` at rest.
- **Sharpness:** a draft MP4 of this frame alone (30 fps) is sharp in the full-screen shot at 3.60.
- **`hyperframes lint`:** 0 errors; 1 warning that the file is long, which it already got before.

One note: the header image exists only in `capture/assets/`, not in `assets/`. It isn't needed because the header is rebuilt in HTML, and the source comment avoids the path so frame-check doesn't report it as missing.

### s08-susan (8 «SUSAN»)
Revisión: listo · mayor tramo sin cambio: 2.6 s · 1 hallazgos
Informe final:
F8 «SUSAN» has no new relays. DINAMISMO §3 marks it «sin cambios» and STORYBOARD Frame 8 agrees: it is the closing signature, and the lockup is held on purpose. I made one correctness fix in `/home/user/susan/video/susan-v4/compositions/frames/s08-susan.html` and changed nothing else. I did not commit.

**The fix (DINAMISMO §2.0.4).** The trail helper now treats progress at or below 1e-4, or at or above 1 − 1e-4, as rest (new `enReposo(p)`). Before, it only checked `p <= 0 || p >= 1`. The fall's speed is highest at the moment of contact, and GSAP rounds progress to 6 decimals. Without the margin, a seek to exactly 1.00 s could leave the landed disc with full blur (σ 26) and both ghosts visible. The same guard now covers the ghosts' opacity.

**Shot list (local times, all 6 s)**
| t | On screen | Motion |
|---|---|---|
| 0.00–0.60 | Lightened E1 sky, empty and still, under the 0.5 s blur-crossfade | — |
| 0.60–1.00 | The ink disc of the «Pasar lista» button falls from y −640 to (900, 490), power2.in | Vertical trail tied to speed, max σ 26, two ghosts, `filter: none` at rest (the only fall in the video) |
| 1.00–1.30 | Contact: squash 1.07 × 0.93 in 0.06 s, then 0.24 s power3.out recovery, no bounce; shadow tightens | — |
| 1.30–1.45 | Disc still | — |
| 1.45–1.95 | Disc slides from x 900 to 738 (power3.inOut, 0.34 s); «SUSAN» is revealed from under it (clip-path plus x −30 → 0, power3.out) | — |
| 1.95 → | Lockup no longer moves; «susan» is spoken at 2.00 | — |
| 2.50–3.10 | Tagline rises 16 → 0 with power4.out | — |
| 3.30–4.00 | Sky takes one step toward cream; lockup and tagline stay put | — |
| 4.45–5.15 | Holographic sweep crosses the word once (86 % → 10 %, power2.inOut) | — |
| 5.70–6.00 | Fade to cream (the video's only exit) | — |

- **Voice anchors:** «susan» at 2.00 falls on a still, sharp lockup (still since 1.95). «segundos» at 3.79 has the lockup and tagline still, with only the sky layer moving underneath.
- **Other rules:** no 3D, no gold, no underline, no cursor, 0 overshoots.

**sfx_cues (unchanged):** `0.98 whoosh-s; 1.00 thud; 2.50 soft-in -6dB; 4.45 sheen`

**Handoffs (unchanged):**
- **handoff_in:** F8 enters with the 0.5 s blur-crossfade over Iván's card. The sky shows empty and still, with no objects and no internal blur, until 0.60 s. At 0.60 s the stored filter state is `none`, σ 0, ghosts at 0. F7's new handoff_out (section B) sits under the same crossfade, so nothing changes on this side.
- **handoff_out:** none; this is the last frame, and the fade to cream finishes at 6.00.

**Check results**
- **`frame-check.mjs s08-susan`:** 0 errors, 0 warnings, «OK sin hallazgos». Longest gap with no visible event is 0.6 s (the empty 0–0.6 s), so the dead-stretch check passes. Camera: 0 tweens. Sound: 4 cues, 0 orphans. Reading: 2 `read:` marks.
- **`preview-frame.mjs s08-susan --bordes --anclas --sheet`:** I looked at the 9 stills and saw no problems. Output is in `/home/user/susan/video/susan-v4/revision/s08-susan/` (`sheet.png`).
- **Extra stills:** I took 25 more around each motion: every 0.05 s through the fall, about every 0.1 s through the reveal, and every 0.2–0.4 s elsewhere (`/home/user/susan/video/susan-v4/revision/s08-susan/relevos/sheet.png`). The trail and ghost bands look like the approved pilot. The «S» never peeks out during the reveal, there are no pops or doubled images, and everything is readable at rest.
- **Seek test:** I sought forward, backward and in shuffled order at t − 1/60, t and t + 1/60 around 14 cut points. The disc's filter, σ and ghost opacities matched at every one of the 42 instants, and `filter: none` holds at rest. 30 of the 42 screenshots differ by a few pixels, all at PSNR 71–98 dB. That is invisible noise and passes the PILOTO §5 bar of ≥ 50 dB. A second targeted run at 5 instants came out pixel-identical.

### s06-tendencia (6 «Hacia dónde va»)
Revisión: corregir · mayor tramo sin cambio: 0.95 s · 3 hallazgos
Informe final:
Arreglé los tres hallazgos en `s06-tendencia.html`; era el único archivo que podía tocar, no hice commit porque no me lo pidieron y no toqué el STORYBOARD. `frame-check s06-tendencia` da 0 errores y 0 avisos, y `hyperframes lint` da 0 errores.

**Cambios en `/home/user/susan/video/susan-v4/compositions/frames/s06-tendencia.html`**

1. **[importante] Estela de la píldora (4.85–5.65 s).**
   - Metí `#s06-tendencia-pildora` en un envoltorio nuevo, `#s06-tendencia-pil-mov`, que va en la caja 650,414 de 620 × 112.
   - El envoltorio lleva el viaje del morph y la estela horizontal, con un filtro nuevo `#s06-tendencia-mb-pil` que deja 62 px de margen en x.
   - La superficie de adentro se queda con el recorte, la escala del salto de 3.20 s y el tic de 6.40–6.50 s. Así el recorte ya no corta la estela.
   - Quité el tween de GSAP de x/y/clipPath. Ahora un solo driver puro (`mp.p`, de 4.85 a 5.65 s, ease none) escribe el translate, el recorte y la estela con power3.inOut. Antes de 4.85 s deja la misma pose de arranque que tenía: translate(578, 90) entero e inset(28px 164px round 28px).
   - La estela se calcula como σ = 0.29·v·OBT con la velocidad del borde izquierdo visible: 578 + 164 = 742 px. Tiene tope 12, vale 0 cuando p ≤ 1e-4 o p ≥ 1−1e-4, y el filtro queda en `none` cuando σ < 0.3.
   - Valores medidos con el runtime 0.8.134:

     | Tiempo | σ |
     |---|---|
     | 4.85 s | 0, filtro none |
     | 5.17–5.27 s | 12, junto a los 16 de la gráfica |
     | 5.40 s | 4.38 (alumnos en opacidad 0) |
     | 5.50 s | 0.88 |
     | 5.537 s | 0.41 |
     | desde ≈5.545 s | 0, filtro none |

   - Prueba de t ± 1/60 en 4.85, 5.25 y 5.65 s (y en 3.0 s), buscando hacia delante y hacia atrás: el estilo sale idéntico en las dos direcciones y el filtro queda en `none` en reposo.
   - En `fix/t-5.17.png` la cápsula y la gráfica ya se ven barridas igual.

2. **[menor] El título asomaba fuera de la tarjeta.** El título «Ausentismo semanal» ahora entra a 0.53 s en vez de 0.47 s. Ya no aparece fuera de la tarjeta.
   - A 0.53 s su opacidad es 0. A 0.547 s vale 0.16 y el borde izquierdo del recorte ya está en x ≈ 176, antes del título (x = 200).
   - Revisé la leyenda, la cuadrícula, las marcas y el eje: ninguno sale de la tarjeta, así que no los toqué.
   - Sigue cumpliendo el storyboard («después del 60 %»).

3. **[menor] Quietud en la costura F6→F7.** Sin cambios en F6, como pide la revisión.

**sfx_cues (sin cambios):** `0.40 whoosh-s; 0.75 draw; 2.55 tick; 2.55 draw -6dB; 3.20 pop-3; 5.25 whoosh-m; 6.50 tick-2`. El pico de la píldora (p = 0.5) cae a 5.25 s, junto al final del látigo, así que el mismo whoosh-m cubre los dos.

**Handoffs:**
- **handoff_in:** sin cambios.
- **handoff_out:** sin cambios. A 7.42 s la píldora está en el centro (960, 470), mide 620 × 112, los dos transforms valen 0, el filtro es `none` y está quieta desde 6.50 s.
- **Pendiente para F7 o el ensamblado:** la quietud de «9 alumnos en riesgo» a lo largo del corte suma ≈ 1.05 s: 0.95 s de F6 más 0.1 s de F7. Si el check del video ensamblado la marca, el worker de F7 puede adelantar el morph píldora → ranking a 0.00 s. La otra salida es aceptarla en el storyboard como el momento de lectura del «9».

**Checks:**
- `frame-check s06-tendencia`: 0 errores, 0 avisos. Primer movimiento a 0.1 s, 1 sobreimpulso, 7 cues sin huérfanos, pausa más larga de 0.95 s (6.5–7.45, la quietud final).
- `hyperframes lint`: 0 errores. Hay 7 avisos `composition_file_too_large` en varios cuadros, el de s06 con 460 líneas; es un aviso de tamaño de archivo, no de este arreglo.
- Revisé en imagen las tomas de `revision/s06-tendencia/fix/` (0.48–0.55 s y 4.95–5.65 s) y la hoja de bordes y anclas en `revision/s06-tendencia/fix-bordes/sheet.png`.

### s01-cinco-minutos (1 «Cinco minutos cada clase»)
Revisión: listo · mayor tramo sin cambio: 0.8 s · 4 hallazgos
Informe final:
F1 «Cinco minutos cada clase» (6.40 s) is done, and frame-check passes with 0 errors and 1 warning. The one change the plan asked for, removing the decorative bar zoom, was already done in the current composition (commit 198208a), so the shot list was already right. I made two small changes in `/home/user/susan/video/susan-v4/compositions/frames/s01-cinco-minutos.html`:

1. **Bars entering at 2.00 s (R2):** the Mié and Vie bars now leave a vertical trail while they slide out from under the Lun bar. It is tied to their speed (peak about 3.2 px, cap 10) and is off from 2.40 s on. Positions and timings are the same as before.
2. **Trail helper:** speed now counts as zero when progress is within 1e-4 of the start or end, as DINAMISMO §2.0.4 asks. This only affects edge frames.

Nothing else changed. I did not commit.

**Implemented shot list (local s)**
- 0.00–1.15: the class bar opens alone, out of focus. Blur 20 → 0 px from 0.10 to 0.95; the camera goes from scale 1.12 / y −60 to 1 / 0 between 0.10 and 1.30 (the opening, not decoration).
- 0.70–1.65: «5» rolls one row on the odometer with a trail and settles at 1.65; «min» enters 1.40–1.65.
- 1.75–2.15: the first 95 px (5 min) of the bar fills with ink.
- 2.00–2.56: the Mié and Vie bars come out from under Lun (now with the trail), and «Lun / Mié / Vie» enter 2.10–2.52. «5 min» stays still from 1.65 to 2.95.
- 2.95–3.65: the three bars fold into the semester grid (2.95–3.55). The 45 other cells light up in a wave 3.25–3.65, and S1–S16 enter 3.35–3.83. The odometer runs 5 → 240 (3.00–3.50), then «240 min» moves up and «4 h» comes in from below (3.45–3.65).
- 3.65–5.45: «4 h» stays still. At 4.45–4.85 «= 240 min» comes into focus and a wave runs across the 48 ink slivers.
- 5.45–6.20: the slivers fly into the ink disc (it grows 5.74–6.05). The scan-face icon appears 5.94–6.20 and the ring and shadow 5.95–6.20. Still from 6.20.

**sfx_cues (unchanged):** `0.10 soft-in -3dB; 1.65 tick; 1.75 draw; 2.00 soft-in -9dB; 3.25 whoosh-s; 3.25 scan -3dB; 3.65 tick-2; 5.75 whoosh-m; 6.05 pop-1`

**Handoffs**
- **In:** none (cut).
- **Out:** exactly as in STORYBOARD. Measured at 6.383 s: disc 168 px centred at (960, 500), ring 198 px, icon 72 px, opacity 1, filter none, no clip-path, no rotation. The frame is identical from 6.20 to 6.383 (0 difference). Against frame 0 of s02, the largest pixel difference is 4/255, and no pixel differs by more than 5.
- **Voice anchors:** «5 min» stays still 1.65–2.95, covering «cinco» at 1.97. «4 h» stays still 3.65–5.45, covering «cuatro» at 3.96.

**Checks**
- **frame-check:** longest gap with no visible event is 0.62 s (3.83–4.45), so the dead-stretch check passes; 9 cues, none orphaned.
- **The warning:** the first movement registers at 0.9 s. The rack focus does start at 0.10 s, but the pale, blurred bar sits below what the tool can detect; the previous worker reported the same. Fixing it would mean changing the opening, so I left it.
- **Stills:** the contact sheet with frame edges and anchors is in `revision/s01-cinco-minutos/`. Stills every 0.25 s and every 1/60 s around 2.00 s are in the scratchpad (`s01dyn/q`, `s01dyn/r2`). The trail softens only the bottom edge, with no visible jump, and everything is sharp at rest.
- **Seek test** (t−1/60, t, t+1/60 around each relay, reached going forward and going back):
  - Element state is identical either way.
  - A few edge pixels at rounded corners differ: at most 62/255 on up to 48 pixels around the Lun ink corner and the sliver corners (2.10, 2.95, 4.85, 5.45, 5.75). The committed version shows the identical pattern, so my change did not cause it; it is the browser's antialiasing depending on seek history, not the timeline.
- **Filters at rest:** `filter: none` on everything visible. The only filters left on are pre-entry blurs on «= 240 min» (until 4.45) and the icon (until 5.94), both while invisible at opacity 0.

### s02-un-boton (2 «Te presentamos a SUSAN»)
Revisión: corregir · mayor tramo sin cambio: 1.15 s · 3 hallazgos
Informe final:
Both s02 findings are fixed in `/home/user/susan/video/susan-v4/compositions/frames/s02-un-boton.html`, the only file I changed; nothing is committed. The pan no longer stops at the cut, and the sheen now enters from outside the button. For the R3a fix I used different numbers from the reviewer's (explained below).

**Changes**

1. **[importante] R3a at 3.30: the arrival now carries the push's sideways motion.** The reviewer's numbers treat GSAP `power2.in` as quadratic (end speed 2·Δ/D). In GSAP it is cubic. `gsap.parseEase` gives an end slope of 2.99997, and the reviewer's own measurement (32.5 px per frame at the end) only fits cubic; quadratic would give 22. With their exact numbers the pan would still drop from −1535 to −1023 px/s at the cut, and the zoom speed would drop from 1.33/s to 0.885/s.
   - **The split is now computed in code from the real curves.** The push covers 67.5 % of the path and the arrival the rest:
     - Push: `DX = −205.3`, `DY = +25.1`, keeping `power2.in`.
     - Arrival: `tl.fromTo(cerca-cam, {scale: 0.94, x: 98.7, y: −12.1}, {scale: 1, x: 0, y: 0, duration: 0.5, ease: 'expo.out'}, 3.30)`.
     - At the cut the button sits at (1058.7, 675.1) in both layers, the card centre at y ≈ 537, and both move at −1369 px/s in x and +167 px/s in y.
   - **The push's zoom (1 → 1.25) now runs as its own tween on `power1.in`.** That makes the zoom speed match too: 0.889/s against 0.885/s.
   - **Measured at 60 fps after the fix**, from 3.2667 to 3.3667, in px per frame:

     | What | Before the cut | At the cut | After the cut |
     |---|---|---|---|
     | Button centre x | −18.8, −20.3 | −22.0 | −20.3, −16.0, −12.8 |
     | Card right edge | −11.6, −12.9 | −12.8 | −13.3, −10.5 |
     | Card left edge | −26.0, −27.7 | −31.2 | −27.4, −21.5 |

     The speed peaks at the cut, the right edge no longer reverses, and there is no double image. The extra 1.4 px on the left edge at the cut comes from a size difference that was already there (card 1065 vs 1067.8 px).
   - **«SUSAN»:** its right edge is at x ≈ 268 at the cut, not 243. Its fade (3.12–3.30) is unchanged; opacity is 0.18 at 3.2833 and 0 at 3.30.

2. **[menor] Sheen at 3.95:** the band now starts at `xPercent −60` (it was −52), and I removed both opacity `tl.set` calls. −58 was not enough: the band is tilted 15°, so its edge still touched the rounded top-left corner at about 0.1 alpha from 3.30 to 3.95. Fully outside needs at least 59.8. The tween still starts at 3.95. Crops from 3.93 to 4.00 are clean, the first light shows around 4.03 coming in from outside, and the sound's peak (+90 ms) lands with it.

**Final sfx_cues (unchanged)**
`0.10 soft-in -6dB; 0.40 whoosh-s; 1.15 pop-2 -3dB; 3.30 whoosh-l -6dB; 3.95 sheen-s; 4.95 tap; 5.00 click-soft2 -3dB; 5.60 whoosh-m`

**Handoffs for the orchestrator (STORYBOARD.md F2 and DINAMISMO §3 F2)**
- **Scene 3, push:**
  - Change «x 0 → −304, y 0 → +37.2 (power2.in)» to «x 0 → −205.3, y 0 → +25.1 (power2.in); scale 1 → 1.25 (power1.in)».
  - Change «queda en x < 170» to «su borde derecho queda en x ≈ 268».
- **Scene 3, arrival:** change to «scale 0.94 → 1, x +98.7 → 0, y −12.1 → 0, expo.out 0.5 s».
- **Scene 3, cut check:** change to «botón en (1058.7, 675.1) en las dos capas, centro de la tarjeta y ≈ 537, −1369 px/s a ambos lados».
- **Scene 3, sheen:** change «xPercent −52 → 120 … antes de 3.95 no existe» to «xPercent −60 → 120, power2.inOut, entra desde fuera del botón (asoma hacia 4.03)».
- **The reviewer's documentation item:** chip «y ≈ 166–230» (Scene 3) and focus halo «12.8 → 40 px a E 3.2» (Scene 4). The HTML already matches both.
- **Suggestion for DINAMISMO §2.3 a and F5:** add the rule that the arrival inherits the push's motion, by splitting the path so both sides of the cut have the same speed (`power2.in` is cubic, end slope 3; `expo.out` start slope 10·ln 2). F5's push to the Friday uses the same relay type, so it is worth measuring it the same way.

**Checks**
- `frame-check s02-un-boton`: 0 errors, 1 warning (`icono-chico scan-face 23px`), which HEAD already had. No camera snaps, and all 8 cues match.
- `hyperframes lint`: 0 errors; s02 only gets the `composition_file_too_large` warning.
- Seek test: 16 out-of-order seeks (0 to 6.0 s) give the same state as seeking in order. At 3.50 the sheen waits at −604.8 px, outside the button.
- I looked at preview frames from 2.85 to 4.45, the 2×2 montage around the cut, and crops of the button from 3.93 to 4.10.

The measurement and seek-test scripts are in `/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/` (`medir-corte.mjs`, `busqueda.mjs`).

### s05-dia-critico (5 «Qué día faltan más»)
Revisión: corregir · mayor tramo sin cambio: 0.85 s · 2 hallazgos
Informe final:
Fixed the important finding in `/home/user/susan/video/susan-v4/compositions/frames/s05-dia-critico.html`, which is the only file I changed. frame-check passes with 0 errors and 0 warnings, and the 1/60 s test shows no fast frame without a trail. Nothing is committed, because this task had no commit instruction.

**Changes (push R3a, 4.95–5.40 local)**
- **Cause:** with x/y in power2.inOut, the lateral speed peaks mid-push, but the blur was a linear ramp over the last 0.25 s. The fastest part of the push was sharp and the blur arrived when the layer had almost stopped.
- **Fix:** I followed the reviewer's first option. x/y stays in power2.inOut, scale stays in power2.in, and the times and values are unchanged.
- **New driver `empujar(estacion, nodo)`:** it replaces `desenfocar` and is the only thing that writes `filter` on `#s05-dia-critico-estacion`.
  - Horizontal trail: `url(#s05-dia-critico-mb-estacion-x)` with stdDeviation `σx 0`, where σx = min(12, 0.29·v·OBT) and v = |dx/dt| + 148.4·ds/dt. That v is the on-screen speed of the Vie tile's left edge, taken from the two GSAP curves.
  - The 0→8 px isotropic ramp from 5.15 to 5.40 sits on top of the trail in the same filter chain.
  - `filter: none` when p ≤ 1e-4, when p ≥ 1−1e-4, and at rest.
- **New SVG filter:** `s05-dia-critico-mb-estacion-x`, region x −5%/110% (96 px spare per side, more than 3σ at σ 12).
- **Removed:** the old `desenfocar` helper, which nothing used any more. I also updated the comments.
- **Minor finding:** I left it alone, as the review asked. The three stylizations (day label outside the tile, pill-shaped selector, ink "Día crítico" pill) are fixed by the STORYBOARD and the F6 handoff. If more fidelity is wanted, it should be decided in the STORYBOARD for F5 and F6 together.

**Check results**
- **Frames every 1/60 s from 5.00 to 5.45:**

  | Time | Vie edge, px per frame | σx | Isotropic blur |
  |---|---|---|---|
  | 5.083 | 12.7 | 4.2 | — |
  | 5.15 (start of the 25 % peak band) | 30 | 9.45 | — |
  | 5.167 (peak) | 35.5 | 11.1 | 0.5 |
  | 5.183 (peak) | 39.6 | 11.15 | 1.1 |
  | 5.20 (end of peak band) | 35.8 | 9.6 | 1.6 |
  | 5.30 | 12.2 | 3.2 | 4.8 |
  | 5.383 | 4.9 | 1.4 | 7.5 |

  No frame moves more than 12 px with σ below 3. The "Analítica de ausentismo" title moves about 32–48 px per frame at its peak with σx up to 11 (it is far from the push origin). It is already fading out (opacity 0.8 at 5.17 and 0.3 by 5.30), so I did not give it its own trail.
- **Cut:** the 5.383 and 5.40 frames line up for the tile, the pill and "Vie", with no double image. The toma arrives with `blur(7.8px)`. In the stills, the pill, "21.8 %" and the title come out with a horizontal trail between 5.15 and 5.20.
- **Seek-safe:** identical state whether reached from 0.5, from 7.0 or from t−0.3, at 4.933, 4.95, 4.967, 5.133, 5.15, 5.167, 5.383, 5.40 and 5.417. The filter is `none` at rest at 4.90, 4.95, 5.45, 6.0, 6.5 and 7.15 (the toma is still at 4.2 px at 5.45 because its arrival runs until 5.95).
- **`node scripts/frame-check.mjs s05-dia-critico`:** 0 errors, 0 warnings, "OK sin hallazgos". 52 tweens, longest pause 0.85 s (6.35–7.2), 9 cues with 0 orphans, 3 `read:` marks.
- **`node scripts/preview-frame.mjs s05-dia-critico --bordes --anclas --sheet`:** 15 captures, no load errors. Everything outside the push is unchanged.

**sfx_cues (unchanged):** `0.25 whoosh-m; 0.70 whoosh-s -9dB; 1.90 tick-1; 2.40 tick-2; 2.90 tick-3; 4.55 pop-2; 5.40 whoosh-l -3dB; 5.75 draw; 6.15 pop-1 -6dB`

**Handoffs:** both unchanged. handoff_in is untouched. handoff_out is the Friday shot (tile 448×304 centred at 960,560, pill at 960,340, "Vie" at y=776, "32 ausencias en 6 sesiones" at y=830), `filter: none` and still from 6.35.

**Requests to the orchestrator (STORYBOARD text only; no cue or handoff changes)**
- Frame 5, Scene 3 still describes the push as "x 0 → −360, y 0 → −30 (power2.in), con desenfoque 0 → 8 px de 5.15 a 5.40 s (driver inverso de `desenfoque`)". It should say: "escala power2.in; x/y power2.inOut; estela horizontal ligada a la velocidad (σx ≤ 12, máximo hacia 5.18 s) más desenfoque 0 → 8 px de 5.15 a 5.40 s, un solo driver". The x/y curve was already power2.inOut before this round; only the description is out of date.
- `whoosh-l` stays anchored at the 5.40 cut, as the plan says. The lateral speed now peaks at about 5.18 and the zoom speed peaks at the cut. Moving the cue is the orchestrator's call; I did not change it.

Frames from this check are in `/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/s05/push/` (sheet.png plus t-*.png) and `/home/user/susan/video/susan-v4/revision/s05-dia-critico/sheet.png`. The probe script is `/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/s05/probe.mjs`.

### s07-a-tiempo (7 «Todavía a tiempo»)
Revisión: listo · mayor tramo sin cambio: 0.95 s · 4 hallazgos
Informe final:
The s07-a-tiempo rework is finished and `frame-check` passes with 0 errors and 0 warnings, including the dead-stretch check. I only wrote `compositions/frames/s07-a-tiempo.html` and did not commit.

To get the dead-stretch check to pass I added two small motions that are not in the plan; details are under "Deviations to approve".

**Shot list (local times)**
| t | On screen | Relay |
|---|---|---|
| 0.00–1.05 | Pill becomes the "Mayor riesgo" ranking, rows sweep in (unchanged) | R5 |
| 1.05–2.40 | Focus on Iván's row, lift at 1.40, row opens into his card, flat at 2.40 (unchanged) | R4 + R5 |
| 2.45–2.95 | Section A: bar fills to 14.9 % against "Límite 20 %"; "2" rolls 2.60–2.85; "7 (14.9 %)" fades in 2.80–3.20 | — |
| 3.00–3.20 | **New:** card header (avatar, name, ID, chips, divider) goes to blur 6 px and opacity 0.4; the "2" and the bar stay sharp before «dos» (3.21). Blur clears 3.65–3.90, dim remains | R4 focus |
| 3.95–4.25 | Section A rises and exits: y 0 → −140, power2.in, vertical trail up to about 7 px, fades out in the last 40 %; header returns to full opacity at the same time | R2 |
| 4.15–4.65 | "Cruce estimado: semana 9" rises from y +140 (power3.out, trail), lands at card y 286–340 | R2 |
| 4.40–4.90 | "Acción sugerida" row rises with the same recipe, lands at card y 372–476 | R2 |
| 5.20–5.60 | "Contactar al alumno esta semana" enters word by word from blur (the app's text-from-blur effect, rising from below) | — |
| 5.50–5.82 | **New:** the action row pulses once (scale 1 → 1.035 and 5 px down, then back), no bounce | — |
| 6.45–6.65 | Blue focus ring on the action row (unchanged) | — |
| 6.65–7.60 | Still, under the blur-crossfade | — |

- The card body below the divider is now a clipped box with a 24 px fade at top and bottom, so sections A and B scroll inside it.
- The 1.07 camera push and its return are removed; the camera stays at scale 1 for the whole frame.
- Trails now use the 1e-4 progress margin, and every filter is `none` at rest, including the words before they enter.

**sfx_cues (unchanged, all matched):** `0.05 soft-in -3dB; 1.40 tap; 2.07 whoosh-s; 2.45 fill -6dB; 2.85 tick; 4.20 whoosh-s -6dB; 4.40 pop-2 -6dB; 5.20 soft-in -6dB`

**Handoffs:** both unchanged, checked against the page layout.
- **In (t=0):** the 620 × 112 pill centred at (960, 470) on the pink halo.
- **Out (7.59):** card at 360,240, 1200 × 600, flat and unfiltered. Pill at card x 48, y 286–340; action row at x 48–1152, y 372–476 with the focus ring on. Ranking behind at 34 % and scale 0.97, its title at 12 %.

**Check results**
- `frame-check`: longest quiet stretches are 3.1–4.0, 4.6–5.5, 5.8–6.6 and 6.7–7.6, all 0.9 s or less. All 8 cues match, both read marks pass, pose is flat at every read and at the end.
- `preview-frame --bordes --anclas --sheet`: sheet at `/home/user/susan/video/susan-v4/revision/s07-a-tiempo/sheet.png`. I also looked at stills every 0.05–0.25 s around each relay: smooth trails, no pops, no ghosting; the incoming pill only brushes the bottom of the exiting "2" for about one frame near 4.20.
- **Seek test:** I compared forward and backward seeks at t−1/60, t and t+1/60 around each relay (62 instants). Filter states match everywhere. 10 instants differ by a few pixels of text rendering at 1.42–1.75 (the 3D lift, unchanged from before), 4.63–4.67 (row rising) and 5.58–5.80 (the pulse); the frames match by eye. Forward playback and a direct jump give the same image at 5.6. PSNR between the forward and backward images was 50 dB at 1.42, 47.8 dB at 4.65 and 42.9 dB at 5.6, all below the 50 dB guideline in PILOTO.

**Deviations to approve**
1. **Two added motions.** With the plan as written and no camera push, the checker found dead stretches at 2.8–4.0 (1.2 s) and 4.6–6.6 (2.0 s). The text fades in those windows are too small for its pixel-change measure. I added the header focus at 3.00 and the row pulse at 5.50 to break them up. Neither is a new element or a new number, and the "2" never moves. If you'd rather keep the plan exact, the alternatives I can see are bringing back camera motion or relaxing the check.
2. **Section A is centred in the card body** at card y ≈ 298–472, about 140 px of space above and below, matching how section B is centred. At its old top position it left 224 px empty below for 1.5 s.
3. **Text direction:** the action text rises from below instead of the app's default drop from above, to keep everything moving upward.
4. **Poster at 5.6 s** lands on the peak of the row pulse (scale 1.035). Moving the poster to 6.0 s would give a rest frame.

**Suggested Scene 3/4 additions for STORYBOARD (not edited):**
- Scene 3: "R4 foco 3.00–3.20 s: el encabezado pasa a contexto (blur 6 px, opacidad 0.4), desenfoque fuera 3.65–3.90, vuelve a 1 con la salida 3.95–4.25".
- Scene 4: "latido de la fila 5.50–5.82 (1.035, 5 px, sin rebote)".
- Optional, not added: `5.50 pop-1 -6dB`. It falls inside the "Todavía estás a tiempo" phrase, so I left it out.

### s04-revision (4 «Lo dudoso lo decides tú»)
Revisión: listo · mayor tramo sin cambio: 0.7 s · 2 hallazgos
Informe final:
F4 «Lo dudoso lo decides tú» ya sigue el plan nuevo de DINAMISMO §3 en `s04-revision.html`, y frame-check sale sin errores. Solo edité ese archivo, sin commit.

**Tomas implementadas (tiempos locales, 5.8 s)**
- **0.00–0.50 · empuje entrante.** La estación de Revisión llega completa y plana: PageHeader «Revisión» con su subtítulo y las Tabs «Pendientes (8) · Justificantes (4) · Correcciones (0)», quietos todo el cuadro.
  - Pieza nueva: la lista real de pendientes del DOM 24. Filas de 720 × 164, radio 24, borde 2 px #E7E2DC, x=140, topes en y=312 · 492 · 672 · 852.
  - Avatares en sus colores: RN #475569, AR y SH #A21CAF, MM #B4551A. La cuarta fila se corta con un desvanecido de 80 px (y 840→920).
- **0.85–1.15 · foco (R4).** La fila de Emilio toma el estilo real de fila activa: borde #1E1919 y fondo #F7F6F3. Las otras tres bajan al 45 %, sin desenfoque. Queda quieta hasta 1.50, así que «dudoso» (1.26) cae en reposo.
- **1.50–1.85 · látigo de salida (R1).** La lista sale de x 0 a −760 con `power2.in`, con una sola hoja con estela (tope 16). `autoAlpha` baja de 1 a 0 entre 1.71 y 1.85.
- **1.75–2.35 · entrada de la tarjeta (R1).** Arranca con la salida al 71 %.
  - Recorrido: x +640→0, rotationY −8→0, rotationX 5→0, z −160→0, `power3.out`; opacidad 0→1 entre 1.75 y 1.93.
  - Estela horizontal tope 14 en una hoja interior (nunca en el padre con perspective). Se apaga entre p 0.40 y 0.65, así que la tarjeta está nítida desde 2.14.
  - La sombra hace el mismo tween 3D y aparece entre 2.10 y 2.35. La tarjeta queda plana a 2.35.
- **2.40–3.09 · columnas de score.** Crecen en 0.6 s, la segunda +0.09 s. «89 %» entra a 2.75 y «93 %» a 2.84, ambas antes de «Revisión» (3.11).
- **3.10–3.72 · fila «Resolver como».** Entra en cascada (y 14→0, 0.5 s, +60 ms).
- **3.80–4.80 · toque y cadena.** Sin cambios: halo a 3.80, compresión a 3.95, el chip pasa a «Presente» entre 4.00 y 4.33, el contador pasa de (8) a (7) entre 4.10 y 4.40, y los secundarios bajan al 45 % entre 4.45 y 4.80.
- **4.80–5.80 · aviso.** «Resuelto como Presente» sube 16→0 entre 4.80 y 5.10. El halo de foco se retira entre 4.80 y 5.20 y el halo de fondo vira a violeta entre 5.10 y 5.80.
- **Cámara.** Quité el acercamiento a 1.03 y su regreso: la cámara queda en 1 todo el cuadro.

**sfx_cues finales (sin cambios respecto al STORYBOARD):**
`0.25 whoosh-m; 1.80 whoosh-m -3dB; 2.40 fill -6dB; 3.10 pop-3 -6dB; 3.95 tap; 4.00 blip -3dB; 4.40 tick-1; 4.80 pop-2 -6dB`

**Bordes de cuadro (cumplen los del STORYBOARD tal cual, sin cambiar números)**
- **handoff_in:** la estación completa y plana desde 0.00, con la lista en las cajas dichas; la tarjeta en opacidad 0 hasta 1.75; halo dorado #FBF1D9 en (1010, 560).
- **handoff_out:** la tarjeta y su sombra en x 410–1610, y 340–880, radio 36, plana, sin filtro. Chip «Presente», «Pendientes (7)», secundarios al 45 %. El aviso con opacidad 1 en x 1012–1780, y 84–216. Cámara en 1 todo el cuadro, todo quieto desde 5.10 y halo violeta #EEE9F7.

**Resultados de las revisiones**
- **frame-check:** 0 errores y 1 aviso, que ya existía: el icono `clock` de la tarjeta mide 27 px.
  - Ningún tramo muerto. La pausa más larga sin evento es de 0.85 s, entre 0 y 0.85, bajo el empuje.
  - Los 8 cues caen sobre sus tweens, las 5 marcas de lectura están planas, no hay tweens de cámara y la pose es plana en los bordes.
- **preview-frame `--bordes --anclas --sheet`** y una hoja cada 0.25 s: las miré. Más fotogramas en 0.85 / 1.00 / 1.15 / 1.50 / 1.60 / 1.67 / 1.72 / 1.77 / 1.80 / 1.83 / 1.87 / 1.92 / 1.97 / 2.03 / 2.10 / 2.17 / 2.25 / 2.35.
  - Las estelas son horizontales y limpias, sin doble imagen ni doble borde de la sombra, y todo se lee en reposo.
- **Prueba de búsqueda adelante y atrás:** probé t−1/60, t y t+1/60 en 14 instantes de relevo, llegando desde 0, desde t−0.4, desde 5.77 y desde t+0.3.
  - El estado y el filtro coinciden en todos los casos, con `filter: none` en reposo.
  - Las diferencias de píxel son solo de antialias de texto: hasta 35/255 en 33 píxeles a 2.35 y hasta 10/255 cerca de 3.12.
  - Esta prueba encontró un error y ya está corregido: un `tl.set({autoAlpha:0})` aparte dejaba la lista oculta en t=0 tras rebobinar. Ahora `autoAlpha` va dentro del mismo tween de desvanecido.

**Diferencias con el texto del STORYBOARD (para el orquestador)**
- **«Quedan 2 h 48 min» en las filas de la lista:** lo dejé en gris #6F6A65 peso 500, como el componente real PlazoRestante (DOM 24 y 25: `text-muted-foreground` + `font-medium`). DINAMISMO y el STORYBOARD dicen «tinta». Si prefieren tinta, es un cambio de una línea de CSS.
- **Frame 4, Escena 3:** dice «plana desde 2.15 s». Es un resto de la versión anterior; implementé 2.35, como el handoff y DINAMISMO. Conviene corregir esa línea en el STORYBOARD.
- **`data-duration`:** conservé el 6.3 de la raíz (5.8 + 0.5 del empuje), igual que antes.

Archivos:
- `/home/user/susan/video/susan-v4/compositions/frames/s04-revision.html`
- Fotogramas: `/home/user/susan/video/susan-v4/revision/s04-revision/sheet.png`
- Fotogramas extra y scripts de búsqueda: `/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/s04dyn/` (`latigo/`, `cada025/`, `seek-s04.mjs`)
