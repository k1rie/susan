| # | cue | archivo | data-start | ancla | golpe real | visual | error (ms) | (a) cue−visual | (b) ancla | causa | evento visual |
|--|--|--|--|--|--|--|--|--|--|--|--|
| 1 | 01-hook-1 | typing.mp3 | 0.5 | 0.455 | 0.955 | 0.46 | 495 | 40 | 455 | b (golpe no está al inicio del mp3) | primera tecla "P" de la línea 1 (tabla K1) |
| 2 | 01-hook-2 | typing.mp3 | 1.55 | 0.455 | 2.005 | 1.6 | 405 | -50 | 455 | a+b | primera tecla de la palabra equivocada "quita" (K1) |
| 3 | 01-hook-3 | key-press.mp3 | 2.55 | 0.075 | 2.625 | 2.55 | 75 | 0 | 75 | b (golpe no está al inicio del mp3) | Enter: el caret cae a la 2ª línea (ENTER) |
| 4 | 01-hook-4 | typing.mp3 | 3 | 0.455 | 3.455 | 2.98 | 475 | 20 | 455 | b (golpe no está al inicio del mp3) | primera tecla "c" de "cada clase." (K2) |
| 5 | 01-hook-5 | click-soft.mp3 | 3.95 | 0.051 | 4.001 | 3.97 | 31 | -20 | 51 | b (golpe no está al inicio del mp3) | marcador azul termina de dibujarse (01-hook-bar 3.55+0.42) |
| 6 | 02-minutos-1 | whoosh-short.mp3 | 4.7 | 0.161 | 4.861 | 4.5-4.9 | 0 | — | 161 | ok (<= 40 ms) | transición de entrada de 02-minutos (scale/opacity/filter, power3.out) 4.5-4.9 |
| 7 | 02-minutos-2 | click-soft.mp3 | 4.8 | 0.051 | 4.851 | 4.75 | 101 | 50 | 51 | a+b | 02-minutos-icon (fromTo scale/opacity, power3.out) |
| 8 | 02-minutos-3 | pop.mp3 | 6 | 0.117 | 6.117 | 6 | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | 02-minutos-chip1 (fromTo scale/opacity/x, power3.out) |
| 9 | 02-minutos-4 | pop.mp3 | 6.6 | 0.117 | 6.717 | 6.6 | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | 02-minutos-chip2 (fromTo scale/opacity/x, power3.out) |
| 10 | 02-minutos-5 | impact-bass-1.mp3 | 7.5 | 0.045 | 7.545 | 7.5 | 45 | 0 | 45 | b (golpe no está al inicio del mp3) | 02-minutos-numrow (fromTo scale, power3.out) |
| 11 | 02-minutos-6 | click.mp3 | 7.55 | 0.051 | 7.601 | 7.5 | 101 | 50 | 51 | a+b | 02-minutos-numrow (fromTo scale, power3.out) |
| 12 | 03-tarde-1 | pop.mp3 | 9.4 | 0.117 | 9.517 | 9.4 | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | 03-tarde-card (fromTo opacity/y/scale, power3.out) |
| 13 | 03-tarde-2 | click-soft.mp3 | 10.5 | 0.051 | 10.551 | 10.45 | 101 | 50 | 51 | a+b | 03-tarde-ln (fromTo scaleY, power3.out) |
| 14 | 03-tarde-3 | error.mp3 | 11.15 | 0.606 | 11.756 | 11.151 | 605 | -1 | 606 | b (golpe no está al inicio del mp3) | 03-tarde-fill (set backgroundColor, fn) |
| 15 | 03-tarde-4 | impact-bass-2.mp3 | 11.45 | 0.02 | 11.47 | 11.4 | 70 | 50 | 20 | a (cue escrito a ojo) | 03-tarde-chip (fromTo scale/opacity/y, expo.out) |
| 16 | 04-intro-1 | whoosh.mp3 | 13.1 | 0.161 | 13.261 | 13-13.6 | 0 | — | 161 | ok (<= 40 ms) | transición de entrada de 04-intro (filter/scale/opacity, power2.inOut) 13-13.6 |
| 17 | 04-intro-2 | riser-1s.mp3 | 13.9 | — | — | 14.9 | — | -1000 | — | archivo silencioso — ARCHIVO SILENCIOSO | el riser debe TERMINAR en el impacto del wordmark (04-intro-word 1.90) |
| 18 | 04-intro-3 | impact-bass-1.mp3 | 14.9 | 0.045 | 14.945 | 14.9 | 45 | 0 | 45 | b (golpe no está al inicio del mp3) | 04-intro-word (fromTo scale, power2.out) |
| 19 | 04-intro-4 | sparkle.mp3 | 15 | 0.025 | 15.025 | 15 | 25 | 0 | 25 | ok (<= 40 ms) | 04-intro-sp1 (fromTo scale/rotation/opacity, power3.out) |
| 20 | 04-intro-5 | pop.mp3 | 16 | 0.117 | 16.117 | 16 | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | 04-intro-badge (fromTo scale/opacity/y, power3.out) |
| 21 | 04-intro-6 | typing.mp3 | 16.2 | 0.455 | 16.655 | 16.2 | 455 | 0 | 455 | b (golpe no está al inicio del mp3) | primera letra de la tagline tecleada (04-intro-c) |
| 22 | 05-camara-1 | whoosh-short.mp3 | 17.7 | 0.161 | 17.861 | 17.5-17.9 | 0 | — | 161 | ok (<= 40 ms) | transición de entrada de 05-camara (scale/opacity/filter, power3.out) 17.5-17.9 |
| 23 | 05-camara-2 | ping.mp3 | 18.55 | 0.323 | 18.873 | 18.55 | 323 | 0 | 323 | recorte data-duration < ancla (+ b) — CORTADO antes del golpe (dur 0.28s < ancla) | bracket #1 se traba (05-camara-bx1 scale 0.82->1 back.out) |
| 24 | 05-camara-3 | ping.mp3 | 18.85 | 0.323 | 19.173 | 18.85 | 323 | 0 | 323 | recorte data-duration < ancla (+ b) — CORTADO antes del golpe (dur 0.28s < ancla) | bracket #2 se traba (05-camara-bx5 scale 0.82->1 back.out) |
| 25 | 05-camara-4 | ping.mp3 | 19.15 | 0.323 | 19.473 | 19.15 | 323 | 0 | 323 | recorte data-duration < ancla (+ b) — CORTADO antes del golpe (dur 0.28s < ancla) | bracket #3 se traba (05-camara-bx0 scale 0.82->1 back.out) |
| 26 | 05-camara-5 | ping.mp3 | 19.45 | 0.323 | 19.773 | 19.45 | 323 | 0 | 323 | recorte data-duration < ancla (+ b) — CORTADO antes del golpe (dur 0.28s < ancla) | bracket #4 se traba (05-camara-bx6 scale 0.82->1 back.out) |
| 27 | 05-camara-6 | ping.mp3 | 19.75 | 0.323 | 20.073 | 19.75 | 323 | 0 | 323 | recorte data-duration < ancla (+ b) — CORTADO antes del golpe (dur 0.28s < ancla) | bracket #5 se traba (05-camara-bx2 scale 0.82->1 back.out) |
| 28 | 05-camara-7 | ping.mp3 | 20.05 | 0.323 | 20.373 | 20.05 | 323 | 0 | 323 | recorte data-duration < ancla (+ b) — CORTADO antes del golpe (dur 0.28s < ancla) | bracket #6 se traba (05-camara-bx4 scale 0.82->1 back.out) |
| 29 | 05-camara-8 | ping.mp3 | 20.35 | 0.323 | 20.673 | 20.35 | 323 | 0 | 323 | recorte data-duration < ancla (+ b) — CORTADO antes del golpe (dur 0.28s < ancla) | bracket #7 se traba (05-camara-bx3 scale 0.82->1 back.out) |
| 30 | 05-camara-9 | ping.mp3 | 20.65 | 0.323 | 20.973 | 20.65 | 323 | 0 | 323 | b (golpe no está al inicio del mp3) | bracket #8 se traba (05-camara-bx7 scale 0.82->1 back.out) |
| 31 | 05-camara-10 | sparkle.mp3 | 21.2 | 0.025 | 21.225 | 21.1 | 125 | 100 | 25 | a (cue escrito a ojo) | 05-camara-glow (fromTo opacity/scale, power2.out) |
| 32 | 05-camara-11 | pop.mp3 | 21.6 | 0.117 | 21.717 | 21.68 | 37 | -80 | 117 | a+b | 05-camara-rb (fromTo opacity/scale, power3.out) |
| 33 | 05-camara-12 | typing.mp3 | 21.9 | 0.455 | 22.355 | 21.9 | 455 | 0 | 455 | b (golpe no está al inicio del mp3) | primera letra del titular tecleado (05-camara-ch0) |
| 34 | 06-vivo-1 | whoosh.mp3 | 23.7 | 0.161 | 23.861 | 23.5-24 | 0 | — | 161 | ok (<= 40 ms) | transición de entrada de 06-vivo (x/opacity, power3.inOut) 23.5-24 |
| 35 | 06-vivo-2 | pop.mp3 | 24.7 | 0.117 | 24.817 | 24.7 | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | 06-vivo-pill-1 (fromTo scale, power2.out) |
| 36 | 06-vivo-3 | pop.mp3 | 24.85 | 0.117 | 24.967 | 24.85 | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | 06-vivo-pill-2 (fromTo scale, power2.out) |
| 37 | 06-vivo-4 | pop.mp3 | 25 | 0.117 | 25.117 | 25 | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | 06-vivo-pill-3 (fromTo scale, power2.out) |
| 38 | 06-vivo-5 | pop.mp3 | 25.15 | 0.117 | 25.267 | 25.15 | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | 06-vivo-pill-4 (fromTo scale, power2.out) |
| 39 | 06-vivo-6 | click-soft.mp3 | 25.5 | 0.051 | 25.551 | 25.5 | 51 | 0 | 51 | b (golpe no está al inicio del mp3) | 06-vivo-lg-warn (fromTo scale/opacity, back.out(1.8)) |
| 40 | 06-vivo-7 | click-soft.mp3 | 26.1 | 0.051 | 26.151 | 26.1 | 51 | 0 | 51 | b (golpe no está al inicio del mp3) | 06-vivo-lg-bad (fromTo scale/opacity, back.out(1.8)) |
| 41 | 06-vivo-8 | sparkle.mp3 | 26.8 | 0.025 | 26.825 | 26.8 | 25 | 0 | 25 | ok (<= 40 ms) | 06-vivo-glint (fromTo x/rotation, power2.inOut) |
| 42 | 06-vivo-9 | pop.mp3 | 27.3 | 0.117 | 27.417 | 27.3 | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | 06-vivo-r-p (fromTo y/opacity/scale, back.out(1.8)) |
| 43 | 07-revision-1 | whoosh-short.mp3 | 29.2 | 0.161 | 29.361 | 29-29.5 | 0 | — | 161 | ok (<= 40 ms) | transición de entrada de 07-revision (x/opacity, power3.inOut) 29-29.5 |
| 44 | 07-revision-2 | click.mp3 | 30.9 | 0.051 | 30.951 | 30.88 | 71 | 20 | 51 | b (golpe no está al inicio del mp3) | 07-revision-cursor (to scale, power1.in) |
| 45 | 07-revision-3 | pop.mp3 | 31 | 0.117 | 31.117 | 31 | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | 07-revision-prim (to backgroundColor, none) |
| 46 | 07-revision-4 | chime.mp3 | 31.6 | 0.416 | 32.016 | 31.6 | 416 | 0 | 416 | b (golpe no está al inicio del mp3) | 07-revision-st-ok (fromTo opacity, none) |
| 47 | 07-revision-5 | click-soft.mp3 | 32.1 | 0.051 | 32.151 | 32.1 | 51 | 0 | 51 | b (golpe no está al inicio del mp3) | 07-revision-count-col (to y, power3.inOut) |
| 48 | 08-reportes-1 | whoosh-short.mp3 | 33.65 | 0.161 | 33.811 | 33.5-34 | 0 | — | 161 | ok (<= 40 ms) | transición de entrada de 08-reportes (x/opacity, power3.inOut) 33.5-34 |
| 49 | 08-reportes-2 | pop.mp3 | 34 | 0.117 | 34.117 | 34 | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | fila 1 del reporte entra (08-reportes-row-1 y 42->0) |
| 50 | 08-reportes-3 | pop.mp3 | 34.2 | 0.117 | 34.317 | 34.2 | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | fila 2 del reporte entra (08-reportes-row-2 y 42->0) |
| 51 | 08-reportes-4 | pop.mp3 | 34.4 | 0.117 | 34.517 | 34.4 | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | fila 3 del reporte entra (08-reportes-row-3 y 42->0) |
| 52 | 08-reportes-5 | pop.mp3 | 34.6 | 0.117 | 34.717 | 34.6 | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | fila 4 del reporte entra (08-reportes-row-4 y 42->0) |
| 53 | 08-reportes-6 | pop.mp3 | 34.8 | 0.117 | 34.917 | 34.8 | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | fila 5 del reporte entra (08-reportes-row-5 y 42->0) |
| 54 | 08-reportes-7 | click.mp3 | 35.7 | 0.051 | 35.751 | 35.7 | 51 | 0 | 51 | b (golpe no está al inicio del mp3) | 08-reportes-cu (to scale, power2.in) |
| 55 | 08-reportes-8 | notification.mp3 | 35.8 | 0.086 | 35.886 | 35.8 | 86 | 0 | 86 | b (golpe no está al inicio del mp3) | 08-reportes-ti (fromTo opacity/y/scale, power3.out) |
| 56 | 09-analitica-1 | whoosh.mp3 | 37.7 | 0.161 | 37.861 | 37.5-38.1 | 0 | — | 161 | ok (<= 40 ms) | transición de entrada de 09-analitica (filter/scale/opacity, power2.inOut) 37.5-38.1 |
| 57 | 09-analitica-2 | pop.mp3 | 38.1 | 0.117 | 38.217 | 38.1 | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | 09-analitica-chl (fromTo opacity/scale, expo.out) |
| 58 | 09-analitica-3 | pop.mp3 | 38.3 | 0.117 | 38.417 | 38.3 | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | punto observado S1 (09-analitica-pt); los otros 4 puntos no tienen sonido |
| 59 | 09-analitica-4 | pop.mp3 | 38.5 | 0.117 | 38.617 | 38.5 | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | punto observado S3 (09-analitica-pt); los otros 4 puntos no tienen sonido |
| 60 | 09-analitica-5 | pop.mp3 | 38.7 | 0.117 | 38.817 | 38.7 | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | punto observado S5 (09-analitica-pt); los otros 4 puntos no tienen sonido |
| 61 | 09-analitica-6 | pop.mp3 | 38.9 | 0.117 | 39.017 | 38.9 | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | punto observado S7 (09-analitica-pt); los otros 4 puntos no tienen sonido |
| 62 | 09-analitica-7 | riser-1s.mp3 | 39.7 | — | — | 40.58 | — | -880 | — | archivo silencioso — ARCHIVO SILENCIOSO | el riser debe TERMINAR en el cruce del límite (09-analitica-core 3.08) |
| 63 | 09-analitica-8 | impact-bass-1.mp3 | 40.6 | 0.045 | 40.645 | 40.58 | 65 | 20 | 45 | b (golpe no está al inicio del mp3) | 09-analitica-core (fromTo opacity/scale, power3.out) |
| 64 | 09-analitica-9 | ping.mp3 | 40.7 | 0.323 | 41.023 | 40.66 | 363 | 40 | 323 | b (golpe no está al inicio del mp3) | 09-analitica-chx (fromTo opacity/scale/y, expo.out) |
| 65 | 09-analitica-10 | pop.mp3 | 41.5 | 0.117 | 41.617 | 41.5 | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | 09-analitica-sp-1 (fromTo opacity/scale, expo.out) |
| 66 | 09-analitica-11 | pop.mp3 | 41.7 | 0.117 | 41.817 | 41.7 | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | 09-analitica-sp-2 (fromTo opacity/scale, expo.out) |
| 67 | 09-analitica-12 | typing.mp3 | 42.4 | 0.455 | 42.855 | 42.28 | 575 | 120 | 455 | a+b | primera letra del titular tecleado (09-analitica-ch) |
| 68 | 10-alumno-1 | whoosh-short.mp3 | 43.7 | 0.161 | 43.861 | 43.5-44 | 0 | — | 161 | ok (<= 40 ms) | transición de entrada de 10-alumno (y/opacity, power3.inOut) 43.5-44 |
| 69 | 10-alumno-2 | pop.mp3 | 44.6 | 0.117 | 44.717 | 44.6 | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | 10-alumno-hero (fromTo opacity/scale/y, power3.out) |
| 70 | 10-alumno-3 | pop.mp3 | 45.2 | 0.117 | 45.317 | 45.2 | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | 10-alumno-cal (fromTo opacity/scale/y, power3.out) |
| 71 | 10-alumno-4 | pop.mp3 | 45.4 | 0.117 | 45.517 | 45.4 | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | 10-alumno-ce (escalonado, el más cercano a 1.9) |
| 72 | 10-alumno-5 | pop.mp3 | 45.6 | 0.117 | 45.717 | 45.6 | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | 10-alumno-ce (escalonado, el más cercano a 2.1) |
| 73 | 10-alumno-6 | pop.mp3 | 45.8 | 0.117 | 45.917 | 45.8 | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | 10-alumno-ok (fromTo scale/opacity, power3.out) |
| 74 | 10-alumno-7 | pop.mp3 | 46 | 0.117 | 46.117 | 46 | 117 | 0 | 117 | b (golpe no está al inicio del mp3) | 10-alumno-rc (fromTo scale/opacity, power3.out) |
| 75 | 10-alumno-8 | sparkle.mp3 | 46.7 | 0.025 | 46.725 | 46.92 | -195 | -220 | 25 | a (cue escrito a ojo) | 10-alumno-star (fromTo scale/rotation/opacity, power3.out) |
| 76 | 10-alumno-9 | typing.mp3 | 47.1 | 0.455 | 47.555 | 46.5 | 1055 | 600 | 455 | a+b | primera letra del titular tecleado (10-alumno-ch) |
| 77 | 11-confianza-1 | pop.mp3 | 48.3 | 0.117 | 48.417 | 48.42 | -3 | -120 | 117 | a+b | cue 0.3 sin evento exacto; el más cercano es el trazo del cuerpo del candado (11-confianza-bd 0.42); el icono entra en 0.00 (disc) |
| 78 | 11-confianza-2 | ping.mp3 | 49 | 0.323 | 49.323 | 49 | 323 | 0 | 323 | b (golpe no está al inicio del mp3) | 11-confianza-pill-1 (fromTo opacity, none) |
| 79 | 11-confianza-3 | ping.mp3 | 49.5 | 0.323 | 49.823 | 49.5 | 323 | 0 | 323 | b (golpe no está al inicio del mp3) | 11-confianza-pill-2 (fromTo opacity, none) |
| 80 | 11-confianza-4 | ping.mp3 | 50 | 0.323 | 50.323 | 50 | 323 | 0 | 323 | b (golpe no está al inicio del mp3) | 11-confianza-pill-3 (fromTo opacity, none) |
| 81 | 12-cierre-1 | whoosh.mp3 | 51.7 | 0.161 | 51.861 | 51.5-52.1 | 0 | — | 161 | ok (<= 40 ms) | transición de entrada de 12-cierre (filter/scale/opacity, power2.inOut) 51.5-52.1 |
| 82 | 12-cierre-2 | impact-bass-2.mp3 | 52.3 | 0.02 | 52.32 | 52.14 | 180 | 160 | 20 | a (cue escrito a ojo) | 12-cierre-l2 (fromTo opacity, power1.out) |
| 83 | 12-cierre-3 | whoosh-short.mp3 | 53.5 | 0.161 | 53.661 | 53.55 | 111 | -50 | 161 | a+b | 12-cierre-mesh (fromTo opacity, power2.out) |
| 84 | 12-cierre-4 | sparkle.mp3 | 53.9 | 0.025 | 53.925 | 53.92 | 5 | -20 | 25 | ok (<= 40 ms) | 12-cierre-unach (fromTo opacity, power1.out) |
| 85 | 12-cierre-5 | chime.mp3 | 54.5 | 0.416 | 54.916 | 54.5 | 416 | 0 | 416 | b (golpe no está al inicio del mp3) | 12-cierre-gloss (fromTo x, power2.inOut) |
