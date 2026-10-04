# Auditoría de sincronía del sonido — SUSAN, video de presentación

Proyecto: `video/susan-presentacion` (HyperFrames 0.8.114, 1920x1080, 30 fps, 56 s, 12 cuadros, 85 `<audio>` de efectos).
Todo lo de abajo está medido (scripts reproducibles al final); no se modificó `compositions/`, `index.html`, `STORYBOARD.md` ni `frame.md`.

---

## 1. Resumen

**La queja es correcta y la causa es mecánica, no de criterio.** Solo 15 de los 85 cues (18 %) caen a <= 40 ms de su evento visual, y 9 de esos 15 son whooshes de transición (se juzgan contra una ventana, no contra un punto). 70 de 85 (82 %) fallan; la mediana del error es **+117 ms (el sonido llega siempre tarde)** y los peores llegan a 0.4–1.05 s.

| Hipótesis | Veredicto | Evidencia medida |
|---|---|---|
| (a) los cues del storyboard se escribieron a ojo y no salen de los tweens | **Casi falsa** (explica 13 cues) | 54 de 67 cues puntuales están a <= 40 ms del inicio del tween que acompañan (cada cuadro sí usó sus propios tiempos). Los (a) reales: `10-alumno-9` typing +600 ms, `12-cierre-2` impacto +160 ms, `09-analitica-12` typing +120 ms, `05-camara-10` sparkle +100 ms, `05-camara-11` pop −80 ms, `10-alumno-8` sparkle −220 ms, `11-confianza-1` pop (cue 0.3 sin evento), y en `09-analitica` hay 8 puntos con solo 4 pops. |
| (b) cada mp3 tiene su golpe en un instante distinto y se montó siempre con el inicio del archivo | **VERDADERA — es la causa dominante** (60 de 67 cues puntuales) | Instante del golpe medido en `sfx-meta.json`: pop **117 ms**, ping **323 ms**, chime **416 ms**, typing **455 ms**, error **606 ms**, key-press 75 ms, click 51 ms, notification 86 ms, whoosh (pico) 161 ms; solo sparkle/impact (20–45 ms) están "bien". 51 cues fallan **solo** por esto. |
| (c) solape de cuadros: tiempo local != absoluto, mal calculado | **Falsa** | `data-start` real = inicio del envoltorio del cuadro + cue local con desviación máxima **0 ms** en los 85 (comprobado contra el storyboard y contra `tl.startTime()` acumulado de cada tween en el timeline `main`). |
| (d) el render introduce desfase (mp3, priming AAC, redondeos) | **Falsa** | Correlación cruzada del audio de `renders/video.mp4` contra el montaje ideal: desfase global **0.00 ms** (rho 1.000); 45 cues puros: media 0.00, desviación 0.00, máx. 0 ms (resolución 0.02 ms = 1 muestra). El video está alineado: 12 instantes de cambio rápido, **0 fotogramas** de desfase. El motor redondea `data-start` al ms (`adelay=round(start*1000)`): error de redondeo <= 0.5 ms. |

**Hallazgos adicionales graves (no eran las hipótesis, pero explican "se oye mal"):**

1. **`riser-1s.mp3` es SILENCIO** (pico −118.7 dBFS, RMS −135 dBFS): los 2 risers (cuadros 4 y 9) no suenan nunca. Además mide 1.2 s, no 1 s.
2. **7 de los 8 pings del cuadro 5 no suenan.** `mount-sfx.mjs` recorta cada archivo a "siguiente cue del mismo archivo − 20 ms" = 0.28 s, pero el ping tiene 321 ms de silencio antes de su golpe: se corta **antes** de sonar (0 % de la energía conservada, −84 dBFS medidos en el render). El bloque de la cámara que bloquea 8 rostros (el clímax) tiene 1 ping audible y **2.95 s de silencio absoluto (18.0–20.95 s)**. Los 3 pops del cuadro 6 (`data-duration 0.13`) se cortan 13 ms después del golpe (72 % de la energía).
3. **Archivos duplicados:** `click.mp3` = `click-soft.mp3` y `whoosh.mp3` = `whoosh-short.mp3` (mismo md5). Hay 13 sonidos distintos, no 15; "suave" y "corto" no existen.
4. **`impact-bass-1/2` no son golpes: son un drone de sub-grave a −3 dBFS RMS durante 2.1/2.6 s sin decaimiento** (picos decodificados +2.55 / +3.02 dBFS: fuente saturada). Cada uso pisa 2 s de lo que sigue (p. ej. el de `03-tarde` suena 11.45–14.04 s, encima de toda la intro). RMS por segundo del render: −4…−10 dBFS en 14 de los 56 segundos (los que contienen un impacto) vs −25…−35 dBFS en el resto (salto de ~25 dB). El render llega a **+1.22 dBFS (501 muestras >= 0.99, saturación)**.
5. **`typing.mp3` (1.5 s) tiene 455 ms de silencio inicial y 8 teclas irregulares** (separaciones 92/66/106/81/161/211/188 ms). El texto del video se pinta a **14–36 ms por carácter** en los cuadros 4, 5, 7, 9, 10 y 11 (~60 ms en ráfagas en el 1): el sonido nunca puede seguir el ritmo visual, y en 3 cuadros suena *después* de que el texto terminó (`10-alumno`: teclas visuales 3.00–3.58 s, primer golpe de audio a 4.06 s; `09-analitica`: 4.78–5.41 vs 5.36; `04-intro`: 3.20–3.77 vs 3.66). Los titulares tecleados de `07-revision` (3.55–4.14 s) y `11-confianza` (0.34–0.96 s) **no tienen sonido**.
6. Huecos: 15.7 s (28 %) del video están en tramos silenciosos >= 0.8 s (< −45 dBFS), incluidos 0–0.95 s (el gancho), 5.0–6.1, 14.05–14.95, **18.0–20.95**, 27.95–29.25, 29.5–30.9, 39.1–40.65. Eso, junto al sonido tardío, es parte de la sensación de "lento".

**Qué hacer (en orden de retorno):**

1. Montar con `data-start = instante_visual − ancla_del_archivo` (tabla `assets/sfx/sfx-meta.json`) y **no recortar** archivos por el cue siguiente: elimina por sí solo la causa dominante (quedan 13 cues con desfase por la causa (a), a corregir con el contrato v2).
2. Reponer los archivos defectuosos: riser nuevo (receta probada), pops/pings/chime/error sin el aire inicial, impactos acortados a golpe (0.7–0.9 s), `click` ≠ `click-soft`, `whoosh` ≠ `whoosh-short`.
3. Typing: hornear cada frase como UN wav con una tecla por carácter colocada con los tiempos reales del reloj de texto (prototipo probado).
4. Adoptar el **contrato v2** (sección 7): los cues se declaran como etiquetas GSAP `sfx:*` en el MISMO instante que el tween, un script los lee y monta, y un verificador sobre el MP4 falla si algún golpe cae a > 33.3 ms del evento (prototipo: 13/13 cues a <= 0.1 ms; un cue desplazado 80 ms se detecta).

---

## 2. La biblioteca (`assets/sfx/sfx-meta.json`, generado por `scripts/analyze-sfx.mjs`)

Ventanas de 5 ms sobre PCM mono 44.1 kHz f32 (ffmpeg). `silencio` = primer instante > −45 dBFS; `onset` = primer cruce de −30 dBFS; `hit` = mayor subida de energía (afinado a muestra); `ancla` = instante que debe coincidir con el evento visual (hit; en whoosh = pico). Envolventes: `audit/sonido/sfx-envolventes.png`.

| archivo | dur s | silencio | onset | hit | pico | fin 90 % | pico dBFS | golpes | forma | consecuencia al montarlo "con el inicio del archivo" |
|---|---|---|---|---|---|---|---|---|---|---|
| chime | 2.50 | 0.416 | 0.416 | 0.416 | 0.416 | 1.53 | −9.2 | 1 | tonal con cola | suena 416 ms tarde (0.4 s de hiss a −60 dB) |
| click / click-soft | 0.366 | 0.045 | 0.045 | 0.051 | 0.051 | 0.15 | −2.4 | 0.051, 0.134 | percusivo | idénticos (md5); 51 ms tarde |
| error | 1.62 | 0.601 | 0.606 | 0.606 | 0.739 | 0.87 | −18.2 | 0.606, 0.715 | zumbido doble | **606 ms tarde**; el más bajo (−18 dBFS) |
| impact-bass-1 | 2.12 | 0.035 | 0.045 | 0.045 | 0.073 | 1.75 | +2.55 | 0.05 | sostenido (drone) | golpe bien ubicado pero 2 s de sub a −3 dB RMS |
| impact-bass-2 | 2.59 | 0.020 | 0.020 | 0.020 | 0.361 | 2.08 | +3.02 | 0.02 | sostenido (drone) | ídem, 2.6 s |
| key-press | 0.40 | 0.070 | 0.070 | 0.075 | 0.075 | 0.08 | −5.6 | 0.075 | percusivo | 75 ms tarde |
| notification | 2.46 | 0.085 | 0.085 | 0.086 | 0.227 | 0.46 | −0.4 | 0.086, 0.227 | 2 notas | 86 ms tarde |
| ping | 1.32 | 0.321 | 0.321 | 0.323 | 0.323 | 0.51 | −1.6 | 0.323 | percusivo | **323 ms tarde** |
| pop | 0.72 | 0.035 | 0.115 | 0.117 | 0.119 | 0.14 | −0.2 | 0.117 | percusivo | **117 ms tarde** (35 ms: un "tic" previo a −42 dB) |
| riser-1s | 1.20 | — | — | — | — | — | **−121.2** | — | **SILENCIO** | no suena |
| sparkle | 1.80 | 0.020 | 0.020 | 0.025 | 0.025 | 0.48 | +3.0 | 0.025 | percusivo + cola | bien ubicado; 1.8 s de cola para un destello de 0.2 s |
| typing | 1.50 | 0.436 | 0.451 | 0.455 | 0.455 | 1.36 | −6.0 | 0.455 0.547 0.613 0.719 0.800 0.961 1.172 1.360 | bucle de 8 teclas | **455 ms tarde** y ritmo propio |
| whoosh / whoosh-short | 0.575 | 0.065 | 0.085 | 0.156 | 0.161 | 0.20 | +0.7 | — | swell (ataque ~76 ms) | idénticos (md5); pico 161 ms tarde |

`inicioContenedor` (start_time del mp3: 0.023–0.025 s en chime, key-press, riser, typing) no afecta: el motor decodifica compensando el retardo del codificador (probado en el proyecto de juguete: mp3 en 2.300 s, error 0.00 ms).

---

## 3. Cue por cue: sonido vs evento visual

**Método.** `scripts/extract-events.mjs` abre el `index.html` real (`bundleToSingleHtml` del compilador de HyperFrames + Chrome headless) y recorre todos los timelines GSAP: **1 224 tweens** (23 de transiciones en `main` + 1 201 de los 12 cuadros) con inicio/fin ABSOLUTO (suma de `startTime()` hasta `main`; `globalTime()` no sirve: añade +0.02 s del reloj global de gsap), objetivos, propiedades, ease → `audit/sonido/events.json`. `audit/sonido/compare-cues.mjs` asigna a cada uno de los 85 `<audio>` su evento visual con un selector explícito (el más plausible por tipo: pop → entrada del chip/tarjeta; ping → bracket que se traba; impacto → slam; click → pulsación; chime → cambio de estado; typing → primera tecla de la ráfaga; riser → debe TERMINAR en el impacto; whoosh → ventana de la transición, error 0 si el pico cae dentro). Error = `data-start + ancla − visual`. Tabla completa en el apéndice y en `cues-tabla.md` / `cues.json`.

**Conteos** (76 cues medibles = 85 − 2 risers mudos − 7 pings cortados antes de sonar):

| umbral | medibles (76) | contando también los 9 que no suenan (85) |
|---|---|---|
| > 40 ms | **61** | **70 (82 %)** |
| > 80 ms | 51 | 60 |
| > 150 ms | 17 | 26 |
| > 300 ms | 15 | 24 |

Mediana del error (con signo): **+117 ms** (todos tardíos salvo 2 adelantados).

**Por tipo (mediana / rango del error, ms):** typing 475 (405…1055) · error 605 · chime 416 · ping 323 (323…363; 7 más inaudibles) · pop 117 (−3…117; 30 cues) · notification 86 · key-press 75 · impact 65 (45…180) · click 51 (31…101) · sparkle 25 (−195…125) · whoosh 0 dentro de la ventana en 9/9 transiciones (pico entre −39 y +161 ms respecto al centro de la transición; el `whoosh-short` de `12-cierre` a 53.5 s que no acompaña transición: +111).

**Causas por cue** (`a` = cue − tween, `b` = ancla del mp3): solo (b) 51 · (a)+(b) 9 · solo (a) 4 · recorte `data-duration` < ancla 7 · archivo silencioso 2 · <= 40 ms 12 (la etiqueta usa los componentes a/b por separado; 3 cues más quedan a <= 40 ms por compensación entre a y b).

### Los 20 peores (cues medibles)

| # | cue | archivo | error ms | (a) cue−tween | (b) ancla mp3 | causa | evento visual de referencia |
|--|--|--|--|--|--|--|--|
| 1 | 10-alumno-9 | typing | 1055 | 600 | 455 | a+b | primera letra del titular tecleado (10-alumno-ch) |
| 2 | 03-tarde-3 | error | 605 | -1 | 606 | b (golpe no está al inicio del mp3) | 03-tarde-fill (set backgroundColor, fn) |
| 3 | 09-analitica-12 | typing | 575 | 120 | 455 | a+b | primera letra del titular tecleado (09-analitica-ch) |
| 4 | 01-hook-1 | typing | 495 | 40 | 455 | b (golpe no está al inicio del mp3) | primera tecla "P" de la línea 1 (tabla K1) |
| 5 | 01-hook-4 | typing | 475 | 20 | 455 | b (golpe no está al inicio del mp3) | primera tecla "c" de "cada clase." (K2) |
| 6 | 04-intro-6 | typing | 455 | 0 | 455 | b (golpe no está al inicio del mp3) | primera letra de la tagline tecleada (04-intro-c) |
| 7 | 05-camara-12 | typing | 455 | 0 | 455 | b (golpe no está al inicio del mp3) | primera letra del titular tecleado (05-camara-ch0) |
| 8 | 07-revision-4 | chime | 416 | 0 | 416 | b (golpe no está al inicio del mp3) | 07-revision-st-ok (fromTo opacity, none) |
| 9 | 12-cierre-5 | chime | 416 | 0 | 416 | b (golpe no está al inicio del mp3) | 12-cierre-gloss (fromTo x, power2.inOut) |
| 10 | 01-hook-2 | typing | 405 | -50 | 455 | a+b | primera tecla de la palabra equivocada "quita" (K1) |
| 11 | 09-analitica-9 | ping | 363 | 40 | 323 | b (golpe no está al inicio del mp3) | 09-analitica-chx (fromTo opacity/scale/y, expo.out) |
| 12 | 05-camara-9 | ping | 323 | 0 | 323 | b (golpe no está al inicio del mp3) | bracket #8 se traba (05-camara-bx7 scale 0.82->1 back.out) |
| 13 | 11-confianza-2 | ping | 323 | 0 | 323 | b (golpe no está al inicio del mp3) | 11-confianza-pill-1 (fromTo opacity, none) |
| 14 | 11-confianza-3 | ping | 323 | 0 | 323 | b (golpe no está al inicio del mp3) | 11-confianza-pill-2 (fromTo opacity, none) |
| 15 | 11-confianza-4 | ping | 323 | 0 | 323 | b (golpe no está al inicio del mp3) | 11-confianza-pill-3 (fromTo opacity, none) |
| 16 | 10-alumno-8 | sparkle | -195 | -220 | 25 | a (cue escrito a ojo) | 10-alumno-star (fromTo scale/rotation/opacity, power3.out) |
| 17 | 12-cierre-2 | impact-bass-2 | 180 | 160 | 20 | a (cue escrito a ojo) | 12-cierre-l2 (fromTo opacity, power1.out) |
| 18 | 05-camara-10 | sparkle | 125 | 100 | 25 | a (cue escrito a ojo) | 05-camara-glow (fromTo opacity/scale, power2.out) |
| 19 | 02-minutos-3 | pop | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | 02-minutos-chip1 (fromTo scale/opacity/x, power3.out) |
| 20 | 02-minutos-4 | pop | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | 02-minutos-chip2 (fromTo scale/opacity/x, power3.out) |

### Eventos visuales importantes SIN sonido

Detectados por `compare-cues.mjs` (tweens de entrada sin ningún golpe de audio a ±120 ms):

| cuadro | tiempo local | qué |
|--|--|--|
| 04-intro | 2.62 s | pill UNACH · FCA C-I (04-intro-pill) |
| 05-camara | 1.19 s | fila de pase de lista (se solapa con ping) (05-camara-row0) |
| 05-camara | 5.246 s | chip "listo en 6 s" (05-camara-chip) |
| 06-vivo | 0.8 s | chip "Sesión en curso" (06-vivo-chip) |
| 08-reportes | 1.72 s | chips "En el límite" / "Sin derecho" (08-reportes-chip-5) |
| 09-analitica | 3.35 s | tarjetas de cifras (cuenta 24.6 %) (09-analitica-sc-1) |
| 10-alumno | 3.6 s | chips "Aviso de límite" / "Proyección" (10-alumno-chip-2) |
| 11-confianza | 0.8 s | ojo de cerradura / cierre del candado (11-confianza-kh) |
| 11-confianza | 0.84 s | anillo de pulso del candado (11-confianza-ring) |
| 12-cierre | 0.14 s | slam de "Pasa lista en" (12-cierre-l1) |
| 12-cierre | 1.76 s | cascada de letras de SUSAN (12-cierre-c0) |
| 12-cierre | 1.83 s | cascada de letras de SUSAN (12-cierre-c1) |
| 12-cierre | 1.889 s | cascada de letras de SUSAN (12-cierre-c2) |
| 07-revision | 3.759 s | subrayado azul del titular (07-revision-hl) |

Además (visto en los tweens, no listado arriba): los **titulares tecleados** de `07-revision` (3.55–4.14 s) y `11-confianza` (0.34–0.96 s) no tienen sonido; **ningún contador (count-up) tiene sonido** (`02` 0.1–1.25 s y 3.0 s, `03` 1.3–2.4 s, `05` 3.5–4.45 s, `06` 1.35–2.35 s, `09` 3.5–4.2 s, `10` 1.25–2.45 s); los **empujes de cámara** (`02` 1.4 s, `05` 3.4 s, `06` 3.2 s, `07` 1.0 s, `09` 0–4.7 s, `10` 1.0 s/1.9 s) y los **trazos SVG que se dibujan** (anillo `02`, línea de ajuste `09` 1.5 s, candado `11`, palomitas `07/08/11`) tampoco; de los 8 puntos observados de `09` solo 4 llevan pop (cues a 0.8/1.0/1.2/1.4 vs puntos a 0.80/0.88/1.00/1.08/1.20/1.28/1.40/1.48).

### Sonidos sin evento visual claro

`02-minutos-2` click-soft a 0.3 s (lo más cercano: icono del cronómetro a 0.25 s), `02-minutos-6` click a 3.05 s (duplica el slam de 3.0 s), `03-tarde-2` click-soft a 1.5 s (línea de límite que se dibuja a 1.45 s: débil), `11-confianza-1` pop a 0.3 s (no hay evento a 0.3 s; el más cercano es el trazo del cuerpo del candado a 0.42 s), `05-camara-10` sparkle a 3.7 s (el brillo florece a 3.60 s) y `10-alumno-8` sparkle a 3.2 s (la estrella aparece a 3.42 s); los 2 risers (mudos). El resto se corresponde con un tween real.

---

## 4. Typing: cadencia visual vs audio

Teclas visuales (tablas K1/K2 del cuadro 1 y tweens `*-ch`/`*-c` instantáneos de los demás) vs golpes de audio (golpes medidos de `typing.mp3` desplazados por `data-start`, recortados por `data-duration`):

| cuadro | teclas visuales | ventana visual (s local) | ms/carácter | golpes de audio | ventana de audio | mediana de distancia tecla→golpe más cercano |
|---|---|---|---|---|---|---|
| 01-hook | 40 | 0.46–3.65 | ~60 (ráfagas) | 23 | 0.96–4.36 | 65 ms |
| 04-intro | 39 | 3.20–3.77 | 14.5 | 8 | 3.66–4.56 | 202 ms |
| 05-camara | 22 | 4.40–5.20 | 36 | 8 | 4.86–5.76 | 95 ms |
| 07-revision | 29 | 3.55–4.14 | 20 | **0** | — | — |
| 09-analitica | 34 | 4.78–5.41 | 18 | 8 | 5.36–6.26 | 271 ms |
| 10-alumno | 34 | 3.00–3.58 | 17 | 8 | **4.06–4.96** | **773 ms** (suena después del texto) |
| 11-confianza | 24 | 0.34–0.96 | 26 | **0** | — | — |

Teclas visuales con un golpe a <= 40 ms (casual, no sincronizado): 01 15/40 · 04 9/39 · 05 10/22 · 09 5/34 · 10 0/34.

---

## 5. Render real: ¿hay desfase global? (hipótesis d)

`audit/sonido/measure-render.py` decodifica el audio de `renders/video.mp4` (AAC, 48 kHz) y lo correlaciona con el mix ideal (cada mp3 recortado a `data-duration`, × `data-volume`, en `data-start`):

- Desfase global (FFT sobre los 56 s): **0.00 ms**, rho = 1.000.
- Por cue (ventana ±150 ms; 45 cues con pureza >= 0.7 y rho >= 0.85; los 8 whooshes entre ellos): media 0.00, mediana 0.00, desviación **0.00 ms**, mín/máx 0/0 (resolución 1 muestra = 0.021 ms).
- Ganancia: el render es ×0.83 respecto al modelo ideal en todo el programa (residuo −47 dB), constante: no afecta a la sincronía. (Prueba aparte con el motor 0.8.114: ganancia 1.000 en fuentes estéreo y mono, con 3 y con 85 pistas; el ×0.83 del render existente no se pudo atribuir.)
- Saturación: pico del mix +1.22 dBFS, 501 muestras >= 0.99.
- Video: `audit/sonido/check-video-sync.mjs` compara el fotograma N del MP4 con una captura de Chrome del mismo instante N/30 en 12 momentos de cambio rápido (4.6, 7.55, 11.4, 14.95, 17.7, 21.1, 23.8, 30.0, 35.75, 40.7, 52.2, 53.3 s): mejor coincidencia a **0 fotogramas** en los 12.
- Los 7 pings recortados: RMS de ventana en el render −83.6/−85.6 dBFS (inaudibles); energía conservada 0 %.

**Conclusión: el render no desplaza nada. Todo el desfase está en el montaje (archivos + cues).**

---

## 6. Mecánica de audio de HyperFrames 0.8.114 (proyecto de juguete, render real de 8.5 s)

Impulsos de 4 ms (2.5 kHz, hann) en WAV y MP3, medidos con correlación + interpolación parabólica en el MP4; plus lectura del código del mezclador (`mixAudioTracks` / `buildTrackInputFilter` en el motor).

| Prueba | Esperado | Medido |
|---|---|---|
| `data-start="0.5"` | golpe a 0.8000 s | 0.8000 (error 0.00 ms) |
| `data-start="1.0037"` (fraccionario) | 1.3037 | 1.3040 (+0.30 ms): el motor usa `adelay = round(data-start*1000)` ms |
| `data-start` 7.0 / 7.05 / 7.1123 / 7.1666 | +0.3 s cada uno | 0.00 / 0.00 / −0.30 / +0.40 ms: **resolución real = 1 ms** |
| `data-media-start="0.2"` (golpe en 0.3 del archivo, `data-start=1.5`) | 1.600 | 1.6000: **recorta el inicio y alinea el golpe** (exacto) |
| mp3 con retardo de codificador, `data-start=2.0` | 2.300 | 2.3000 (sin desfase de priming) |
| mp3 + `data-media-start=0.25`, `data-start=4.5` | 4.550 | 4.5500 |
| `data-volume="0.5"` | amplitud ×0.5 | ×0.5 exacto (lineal) |
| 2 `<audio>` solapados en pistas 2 y 3 (0.4 + 0.4) | suma 0.8 | suma lineal exacta (la pista no se lee en el render) |
| `data-duration="0.25"` con el golpe en 0.30 | silencio | pico 0.000: **corte duro, el golpe desaparece** (la causa de los 7 pings) |
| `data-duration="0.31"` con el golpe en 0.30 | suena | suena |
| `data-fade-in="0.5"` / `data-fade-out="0.5"` | rampa lineal | −24.8 → −6 dB en 0.5 s / simétrico (lineal) |
| `data-automation` carril `volume` (1 → 0.25 entre 0.5 y 0.6 s) | −12 dB | −6.0 → −18.1 dBFS |
| engine: ganancia maestra | — | 1.000 (amix ×N compensado), 85 pistas igual que 3 |

Conclusiones prácticas: (1) `data-media-start` permite alinear golpe **sin** tocar el archivo; (2) la precisión de `data-start` es 1 ms; (3) `data-duration` es un corte duro: nunca por debajo de `ancla + 150 ms`; (4) `data-fade-out` (y carriles `data-automation`) sirven para que una cola termine con gracia en lugar de cortarse; (5) no hay "automatic waveform sync": la alineación es 100 % responsabilidad del montador.

---

## 7. CONTRATO DE SINCRONÍA v2

**Principio:** el instante de un sonido no se escribe nunca a mano; se *deriva* del tween que acompaña y del golpe medido del archivo. Cuatro piezas:

### 7.1 Declaración: etiquetas GSAP junto al tween (misma variable de tiempo)

En cada cuadro, un helper de 3 líneas registra el cue como **etiqueta del timeline** en el MISMO instante `T` que el tween (probado: el runtime conserva `tl.labels` del timeline anidado y se obtiene el absoluto con la cadena de `startTime()`; p. ej. `sfx:ping-note1` en 1.05 del cuadro 5 → 18.55 s):

```js
var SFXN = 0;
function sfx(tl, pos, nombre, vol) { tl.addLabel('sfx:' + nombre + '@' + (vol == null ? '' : vol) + '#' + (SFXN++), pos); }
// ...
var T = 1.05 + k * 0.3;                       // un solo número para tween y sonido
tl.fromTo(bx[k], { opacity: 0, scale: 0.82 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(1.7)' }, T);
sfx(tl, T, 'ping-note' + (k + 1), 0.5);
```

Las transiciones de `index.html` hacen lo mismo con el tiempo del punto de máxima velocidad (mitad en `inOut`, fin en `.in`, inicio en `.out`). Las líneas `sfx:` del storyboard pasan a ser *intención* (qué sonido), no tiempo.

### 7.2 Montaje: `data-start = golpe visual − ancla`

`scripts/extract-events.mjs --cues` (extensión del actual) lee las etiquetas `sfx:*` → `sfx-cues.json` (`t` absoluto). El montador v2 (prototipo `audit/sonido/proto/mount-sfx-v2.mjs`) escribe, por cue:

- `data-start = round(t − ancla, 3)`; si es < 0: `data-start = 0` y `data-media-start = ancla − t`;
- `data-duration = max(ancla + 0.15, duración − mediaStart)`: **nunca se recorta un archivo por el cue siguiente** (dos usos del mismo archivo se solapan); si hay que cortar, `data-fade-out`;
- `data-volume` por categoría (7.5); `data-track-index` es solo de Studio.

### 7.3 Reglas de anclaje por tipo de sonido

| sonido | se ancla a… | ancla |
|---|---|---|
| pop / click / ping / key / tick | inicio del tween de entrada (primer fotograma en que el elemento es visible); si el ease arranca lento, al 10 % del progreso | hit |
| impacto / slam | inicio del tween de escala/slam (máxima velocidad) | hit |
| whoosh | **pico** del whoosh en el punto de máxima velocidad de la transición/desplazamiento | pico |
| riser | **su FIN** coincide con el impacto: `data-start = t_impacto − pico` | pico (final) |
| chime / notification / check / error | el fotograma del cambio de estado | hit |
| sparkle | arranque del brillo | hit |
| contador | un `tick` por cambio de entero, <= 12/s, con 4 alturas crecientes; el último = acento | hit |
| tecleo | frase horneada: una tecla por carácter en el instante de su `tl` (7.4) | primera tecla |
| trazo SVG (draw) / líquido (fill) / escaneo | inicio del tween del trazo / del llenado / de la barrida | hit |

### 7.4 Teclas: horneado por frase

`audit/sonido/proto/bake-typing.mjs`: un solo WAV por frase mezclando muestras sueltas `key-1..8` (cortadas del `typing.mp3` en sus golpes medidos con `atrim`, NO con `-ss`: `-ss` cuenta desde `start_time=0.025` del contenedor y desplaza la tecla), rotación `(i*5)%8` (nunca la misma dos veces seguidas), volumen 0.8–1.0 y tono ±2.4 % por tecla; `adelay` al ms exacto de cada carácter. Los tiempos de carácter salen del reloj de texto del cuadro (tabla K1/K2, o `K.map(k => k[0])`), registrados también como etiquetas `sfx:key`. Reglas: si el texto se pinta más rápido de 14 teclas/s (los cuadros 4, 5, 7, 9, 10 y 11 hoy van a 28–69 teclas/s) se **decima** (1 tecla cada ~70 ms, acento en inicios de palabra) pero siempre se suena la primera y la última; Enter = `key-enter`; las 5 correcciones del cuadro 1 = `key-back`.

### 7.5 Biblioteca y mezcla (reglas verificables)

- Todo archivo percusivo con **ancla <= 10 ms** (recortado en la fuente, no por `data-media-start`, que queda solo para casos límite).
- Sin duplicados (md5), sin archivos < −40 dBFS de pico, sin sostenidos > 0.9 s en "impacto".
- Pico de cada archivo normalizado a −6 dBFS (`volumedetect`); `data-volume`: impacto 0.8, whoosh 0.5, pop/click 0.45–0.5, ping 0.45, tecla 0.35, tick 0.4, riser 0.55, sparkle/chime 0.4.
- Pico del mix <= −1 dBFS (hoy +1.22), sin muestras >= 0.99; polifonía <= 4 simultáneos (hoy 4: ok); objetivo de lectura: ninguna ventana de 1 s con RMS > −12 dBFS ni ventanas de 1 s con salto > 12 dB respecto a la anterior (hoy 25 dB).
- Densidad: cada tween "hero" (entrada de un elemento principal, cambio de estado, contador, empuje de cámara, trazo) lleva cue; el micro-escalonado se limita a >= 70 ms entre golpes. Ningún hueco > 1.0 s sin al menos una textura (`soft-in`, `fill`, `scan`, tick).

### 7.6 Verificación automática (falla el build)

1. **Biblioteca** (`analyze-sfx.mjs`): ancla <= 10 ms (percusivos), pico > −40 dBFS, sin md5 repetidos, sin pico decodificado > 0 dBFS. (Hoy fallaría riser, click/click-soft, whoosh/whoosh-short, impactos, pop, ping, chime, error, typing.)
2. **Etiqueta ↔ tween**: cada `sfx:*` debe tener un tween del mismo cuadro cuyo inicio (o fin/mitad según 7.3) esté a <= 1 fotograma (33.3 ms); etiqueta huérfana = error; tween de entrada "hero" sin etiqueta = aviso (`extract-events.mjs` ya produce `events.json` con los absolutos).
3. **Montaje estático**: para cada `<audio>`: `data-start + ancla − media-start == t_cue` (±1 ms), `data-duration >= ancla + 0.15`, archivo no mudo.
4. **Render** (`audit/sonido/proto/verify-sfx-sync.py <sfx-mounted.json> <video.mp4>`, `--tol-ms 33.3`): plantilla = fuerza de ataque (subida de la envolvente RMS de 2 ms) del fragmento [ancla−15, ancla+90 ms] del archivo; correlación contra la del MP4 solo dentro de ±(tolerancia+15 ms) del instante visual; falla si |error| > 33.3 ms o la correlación < 0.6; risers y cues pegados al inicio se verifican de forma estática (la rampa no tiene transiente; su fin se ancla al impacto, que sí se mide). Sale con código 1 (apto CI). **Prueba**: proyecto de juguete de 8 s con 13 cues (pops, 4 pings en escala, click, impacto + riser que termina en él, whoosh, chime, 2 ticks superpuestos del mismo archivo, frase horneada de 12 teclas, un caso con `data-media-start`): **13/13 a <= 0.1 ms** (error máximo 0.08 ms); control negativo (un cue declarado 80 ms más tarde que su sonido): FALLA con correlación 0.23.
5. **Video** (`check-video-sync.mjs`): confirma 0 fotogramas de desfase del render (para descartar la hipótesis d en cada release).

Tolerancia: aprobado <= 33.3 ms (1 fotograma); objetivo <= 10 ms; la aritmética de montaje deja <= 1 ms. (Referencia de percepción, ITU-R BT.1359: el audio adelantado > ~45 ms o atrasado > ~125 ms respecto a la imagen se detecta; en golpes secos molesta antes que en voz.)

---

## 8. Biblioteca que falta y cómo derivarla (`audit/sonido/derive-sfx.sh`, probado: 40 WAV 48 kHz estéreo en `audit/sonido/derived/`, con su `sfx-meta.json` y `derived-envolventes.png`)

Todas las recetas son ffmpeg (sin tocar los originales); cada archivo empieza con su golpe a <= 10 ms (ancla medida con el mismo analizador).

| necesidad | archivos derivados | receta resumida | dónde se usa |
|---|---|---|---|
| pop sin aire inicial + 4 alturas | `pop-1..4` (ancla 3–5 ms) | `atrim=start=0.113` + `asetrate=48000*{0.84,1,1.19,1.41}` | chips, tarjetas (30 cues hoy idénticos) |
| ping sin 320 ms de silencio, **escala de 8 notas** | `ping-note1..8` | `atrim=0.318` + `asetrate` a 0,2,4,7,9,12,14,16 semitonos | los 8 brackets del cuadro 5 (en vez de 8 pings iguales y cortados) |
| teclas sueltas | `key-1..8`, `key-enter`, `key-back` | `atrim` por golpe medido de typing.mp3 (6 ms de pre-roll, 110 ms) | tecleo horneado, Enter, borrado |
| chime / error / notification sin cola muda | `chime-trim`, `error-trim`, `notification-trim` | `atrim=start=0.412 / 0.60 / 0.082` | 07 (3), 12 (1), 08, 03 |
| click distintos | `click-hard`, `click-soft2`, `tick` | recorte 0.044 s; `lowpass 3200`; pitch ×1.6 + `highpass 900` 50 ms | pulsaciones, contadores |
| whoosh corto / largo-grave / inverso | `whoosh-s` (pico 0.10), `whoosh-l` (0.15), `whoosh-rev` | `atrim`, `asetrate=0.72`+`aecho`, `areverse` | cortes, push-slides, pre-swell |
| impacto como golpe (no drone) | `impact-hit` (0.87 s), `impact-lite` (0.69 s, sin sub) | `afade=out:curve=exp` + `highpass 70` | slams (5 usos) |
| **riser real** | `riser-1s` (pico en 0.98 s) | ruido rosa + chirp 180→1700 Hz, ganancia `t^3`, corte seco en 1.0 s | cuadros 4 y 9 (hoy mudos) |
| sparkle corto | `sparkle-short` (0.88 s) | `atrim` + fade | destellos |
| **faltantes** | `check` (dos notas 880→1320), `draw` (trazo de ruido filtrado), `fill` (líquido que sube, pico al final), `scan` (barrida fina), `soft-in` (entrada suave de panel) | síntesis `lavfi` (`aevalsrc`, `anoisesrc`) + filtros | palomitas, anillos/líneas, tanques `06`/`10`, escaneo `05`, tarjetas que entran |

---

## 9. Reproducir

```bash
cd video/susan-presentacion
node scripts/analyze-sfx.mjs --ascii --png audit/sonido/sfx-envolventes.png   # -> assets/sfx/sfx-meta.json
node scripts/extract-events.mjs                                              # -> audit/sonido/events.json (1224 tweens)
node audit/sonido/compare-cues.mjs                                           # -> cues.json, cues-tabla.md
python3 audit/sonido/measure-render.py                                       # -> render-offset.json
node audit/sonido/check-video-sync.mjs                                       # desfase visual en fotogramas
bash audit/sonido/derive-sfx.sh && node scripts/analyze-sfx.mjs --dir audit/sonido/derived --out audit/sonido/derived/sfx-meta.json
# prototipo v2:  proto/bake-typing.mjs, proto/mount-sfx-v2.mjs, proto/verify-sfx-sync.py (ver cabeceras)
```

Archivos: `scripts/analyze-sfx.mjs`, `scripts/extract-events.mjs`, `assets/sfx/sfx-meta.json`, y en `audit/sonido/`: `REPORT.md`, `events.json`, `cues.json`, `cues-tabla.md`, `render-offset.json`, `compare-cues.mjs`, `measure-render.py`, `check-video-sync.mjs`, `derive-sfx.sh`, `derived/`, `proto/`, `sfx-envolventes.png`, `derived-envolventes.png`. Los proyectos de prueba (`toy`, `toy3`…`toy5`) están en el scratchpad de la sesión.

**Límites de la medición.** (1) El "evento visual más plausible" de cada cue es una decisión explícita (selector en `compare-cues.mjs`); para pops/clicks se usó el *inicio* del tween (en una tira de fotogramas el chip del pop empieza a verse a +33 ms, es legible a +67–100 ms y está completo a ~200 ms; el golpe a +117 ms cae cuando ya se ve casi entero, por eso el error de los pops es "tarde" pero menos grave que el de ping/chime/typing). (2) El orden de causas (a)/(b) se calcula por cue con esos mismos selectores. (3) La ganancia ×0.83 del render existente frente al modelo no se pudo atribuir (el motor de prueba da 1.000); no afecta a la sincronía. (4) `hyperframes keyframes --json` (sólo lectura) corroboró los tiempos locales de los tweens.

---

## Apéndice — los 85 cues

Error = `data-start + ancla − visual` (ms; + = tarde). Los whooshes se juzgan contra la ventana de la transición. Más columnas (ancla, (a), (b), evento visual) en `cues-tabla.md`.

| # | cue | archivo | data-start | golpe real | visual | error ms | causa |
|--|--|--|--|--|--|--|--|
| 1 | 01-hook-1 | typing | 0.5 | 0.955 | 0.46 | 495 | b (golpe no está al inicio del mp3) |
| 2 | 01-hook-2 | typing | 1.55 | 2.005 | 1.6 | 405 | a+b |
| 3 | 01-hook-3 | key-press | 2.55 | 2.625 | 2.55 | 75 | b (golpe no está al inicio del mp3) |
| 4 | 01-hook-4 | typing | 3 | 3.455 | 2.98 | 475 | b (golpe no está al inicio del mp3) |
| 5 | 01-hook-5 | click-soft | 3.95 | 4.001 | 3.97 | 31 | b (golpe no está al inicio del mp3) |
| 6 | 02-minutos-1 | whoosh-short | 4.7 | 4.861 | 4.5–4.9 | 0 | ok (<= 40 ms) |
| 7 | 02-minutos-2 | click-soft | 4.8 | 4.851 | 4.75 | 101 | a+b |
| 8 | 02-minutos-3 | pop | 6 | 6.117 | 6 | 117 | b (golpe no está al inicio del mp3) |
| 9 | 02-minutos-4 | pop | 6.6 | 6.717 | 6.6 | 117 | b (golpe no está al inicio del mp3) |
| 10 | 02-minutos-5 | impact-bass-1 | 7.5 | 7.545 | 7.5 | 45 | b (golpe no está al inicio del mp3) |
| 11 | 02-minutos-6 | click | 7.55 | 7.601 | 7.5 | 101 | a+b |
| 12 | 03-tarde-1 | pop | 9.4 | 9.517 | 9.4 | 117 | b (golpe no está al inicio del mp3) |
| 13 | 03-tarde-2 | click-soft | 10.5 | 10.551 | 10.45 | 101 | a+b |
| 14 | 03-tarde-3 | error | 11.15 | 11.756 | 11.151 | 605 | b (golpe no está al inicio del mp3) |
| 15 | 03-tarde-4 | impact-bass-2 | 11.45 | 11.47 | 11.4 | 70 | a (cue escrito a ojo) |
| 16 | 04-intro-1 | whoosh | 13.1 | 13.261 | 13–13.6 | 0 | ok (<= 40 ms) |
| 17 | 04-intro-2 | riser-1s | 13.9 | — | 14.9 | — | archivo silencioso |
| 18 | 04-intro-3 | impact-bass-1 | 14.9 | 14.945 | 14.9 | 45 | b (golpe no está al inicio del mp3) |
| 19 | 04-intro-4 | sparkle | 15 | 15.025 | 15 | 25 | ok (<= 40 ms) |
| 20 | 04-intro-5 | pop | 16 | 16.117 | 16 | 117 | b (golpe no está al inicio del mp3) |
| 21 | 04-intro-6 | typing | 16.2 | 16.655 | 16.2 | 455 | b (golpe no está al inicio del mp3) |
| 22 | 05-camara-1 | whoosh-short | 17.7 | 17.861 | 17.5–17.9 | 0 | ok (<= 40 ms) |
| 23 | 05-camara-2 | ping | 18.55 | 18.873 | 18.55 | 323 | recorte data-duration < ancla (+ b) (dur 0.28) |
| 24 | 05-camara-3 | ping | 18.85 | 19.173 | 18.85 | 323 | recorte data-duration < ancla (+ b) (dur 0.28) |
| 25 | 05-camara-4 | ping | 19.15 | 19.473 | 19.15 | 323 | recorte data-duration < ancla (+ b) (dur 0.28) |
| 26 | 05-camara-5 | ping | 19.45 | 19.773 | 19.45 | 323 | recorte data-duration < ancla (+ b) (dur 0.28) |
| 27 | 05-camara-6 | ping | 19.75 | 20.073 | 19.75 | 323 | recorte data-duration < ancla (+ b) (dur 0.28) |
| 28 | 05-camara-7 | ping | 20.05 | 20.373 | 20.05 | 323 | recorte data-duration < ancla (+ b) (dur 0.28) |
| 29 | 05-camara-8 | ping | 20.35 | 20.673 | 20.35 | 323 | recorte data-duration < ancla (+ b) (dur 0.28) |
| 30 | 05-camara-9 | ping | 20.65 | 20.973 | 20.65 | 323 | b (golpe no está al inicio del mp3) |
| 31 | 05-camara-10 | sparkle | 21.2 | 21.225 | 21.1 | 125 | a (cue escrito a ojo) |
| 32 | 05-camara-11 | pop | 21.6 | 21.717 | 21.68 | 37 | a+b |
| 33 | 05-camara-12 | typing | 21.9 | 22.355 | 21.9 | 455 | b (golpe no está al inicio del mp3) |
| 34 | 06-vivo-1 | whoosh | 23.7 | 23.861 | 23.5–24 | 0 | ok (<= 40 ms) |
| 35 | 06-vivo-2 | pop | 24.7 | 24.817 | 24.7 | 117 | b (golpe no está al inicio del mp3) |
| 36 | 06-vivo-3 | pop | 24.85 | 24.967 | 24.85 | 117 | b (golpe no está al inicio del mp3) |
| 37 | 06-vivo-4 | pop | 25 | 25.117 | 25 | 117 | b (golpe no está al inicio del mp3) |
| 38 | 06-vivo-5 | pop | 25.15 | 25.267 | 25.15 | 117 | b (golpe no está al inicio del mp3) |
| 39 | 06-vivo-6 | click-soft | 25.5 | 25.551 | 25.5 | 51 | b (golpe no está al inicio del mp3) |
| 40 | 06-vivo-7 | click-soft | 26.1 | 26.151 | 26.1 | 51 | b (golpe no está al inicio del mp3) |
| 41 | 06-vivo-8 | sparkle | 26.8 | 26.825 | 26.8 | 25 | ok (<= 40 ms) |
| 42 | 06-vivo-9 | pop | 27.3 | 27.417 | 27.3 | 117 | b (golpe no está al inicio del mp3) |
| 43 | 07-revision-1 | whoosh-short | 29.2 | 29.361 | 29–29.5 | 0 | ok (<= 40 ms) |
| 44 | 07-revision-2 | click | 30.9 | 30.951 | 30.88 | 71 | b (golpe no está al inicio del mp3) |
| 45 | 07-revision-3 | pop | 31 | 31.117 | 31 | 117 | b (golpe no está al inicio del mp3) |
| 46 | 07-revision-4 | chime | 31.6 | 32.016 | 31.6 | 416 | b (golpe no está al inicio del mp3) |
| 47 | 07-revision-5 | click-soft | 32.1 | 32.151 | 32.1 | 51 | b (golpe no está al inicio del mp3) |
| 48 | 08-reportes-1 | whoosh-short | 33.65 | 33.811 | 33.5–34 | 0 | ok (<= 40 ms) |
| 49 | 08-reportes-2 | pop | 34 | 34.117 | 34 | 117 | b (golpe no está al inicio del mp3) |
| 50 | 08-reportes-3 | pop | 34.2 | 34.317 | 34.2 | 117 | b (golpe no está al inicio del mp3) |
| 51 | 08-reportes-4 | pop | 34.4 | 34.517 | 34.4 | 117 | b (golpe no está al inicio del mp3) |
| 52 | 08-reportes-5 | pop | 34.6 | 34.717 | 34.6 | 117 | b (golpe no está al inicio del mp3) |
| 53 | 08-reportes-6 | pop | 34.8 | 34.917 | 34.8 | 117 | b (golpe no está al inicio del mp3) |
| 54 | 08-reportes-7 | click | 35.7 | 35.751 | 35.7 | 51 | b (golpe no está al inicio del mp3) |
| 55 | 08-reportes-8 | notification | 35.8 | 35.886 | 35.8 | 86 | b (golpe no está al inicio del mp3) |
| 56 | 09-analitica-1 | whoosh | 37.7 | 37.861 | 37.5–38.1 | 0 | ok (<= 40 ms) |
| 57 | 09-analitica-2 | pop | 38.1 | 38.217 | 38.1 | 117 | b (golpe no está al inicio del mp3) |
| 58 | 09-analitica-3 | pop | 38.3 | 38.417 | 38.3 | 117 | b (golpe no está al inicio del mp3) |
| 59 | 09-analitica-4 | pop | 38.5 | 38.617 | 38.5 | 117 | b (golpe no está al inicio del mp3) |
| 60 | 09-analitica-5 | pop | 38.7 | 38.817 | 38.7 | 117 | b (golpe no está al inicio del mp3) |
| 61 | 09-analitica-6 | pop | 38.9 | 39.017 | 38.9 | 117 | b (golpe no está al inicio del mp3) |
| 62 | 09-analitica-7 | riser-1s | 39.7 | — | 40.58 | — | archivo silencioso |
| 63 | 09-analitica-8 | impact-bass-1 | 40.6 | 40.645 | 40.58 | 65 | b (golpe no está al inicio del mp3) |
| 64 | 09-analitica-9 | ping | 40.7 | 41.023 | 40.66 | 363 | b (golpe no está al inicio del mp3) |
| 65 | 09-analitica-10 | pop | 41.5 | 41.617 | 41.5 | 117 | b (golpe no está al inicio del mp3) |
| 66 | 09-analitica-11 | pop | 41.7 | 41.817 | 41.7 | 117 | b (golpe no está al inicio del mp3) |
| 67 | 09-analitica-12 | typing | 42.4 | 42.855 | 42.28 | 575 | a+b |
| 68 | 10-alumno-1 | whoosh-short | 43.7 | 43.861 | 43.5–44 | 0 | ok (<= 40 ms) |
| 69 | 10-alumno-2 | pop | 44.6 | 44.717 | 44.6 | 117 | b (golpe no está al inicio del mp3) |
| 70 | 10-alumno-3 | pop | 45.2 | 45.317 | 45.2 | 117 | b (golpe no está al inicio del mp3) |
| 71 | 10-alumno-4 | pop | 45.4 | 45.517 | 45.4 | 117 | b (golpe no está al inicio del mp3) |
| 72 | 10-alumno-5 | pop | 45.6 | 45.717 | 45.6 | 117 | b (golpe no está al inicio del mp3) |
| 73 | 10-alumno-6 | pop | 45.8 | 45.917 | 45.8 | 117 | b (golpe no está al inicio del mp3) |
| 74 | 10-alumno-7 | pop | 46 | 46.117 | 46 | 117 | b (golpe no está al inicio del mp3) |
| 75 | 10-alumno-8 | sparkle | 46.7 | 46.725 | 46.92 | -195 | a (cue escrito a ojo) |
| 76 | 10-alumno-9 | typing | 47.1 | 47.555 | 46.5 | 1055 | a+b |
| 77 | 11-confianza-1 | pop | 48.3 | 48.417 | 48.42 | -3 | a+b |
| 78 | 11-confianza-2 | ping | 49 | 49.323 | 49 | 323 | b (golpe no está al inicio del mp3) |
| 79 | 11-confianza-3 | ping | 49.5 | 49.823 | 49.5 | 323 | b (golpe no está al inicio del mp3) |
| 80 | 11-confianza-4 | ping | 50 | 50.323 | 50 | 323 | b (golpe no está al inicio del mp3) |
| 81 | 12-cierre-1 | whoosh | 51.7 | 51.861 | 51.5–52.1 | 0 | ok (<= 40 ms) |
| 82 | 12-cierre-2 | impact-bass-2 | 52.3 | 52.32 | 52.14 | 180 | a (cue escrito a ojo) |
| 83 | 12-cierre-3 | whoosh-short | 53.5 | 53.661 | 53.55 | 111 | a+b |
| 84 | 12-cierre-4 | sparkle | 53.9 | 53.925 | 53.92 | 5 | ok (<= 40 ms) |
| 85 | 12-cierre-5 | chime | 54.5 | 54.916 | 54.5 | 416 | b (golpe no está al inicio del mp3) |
