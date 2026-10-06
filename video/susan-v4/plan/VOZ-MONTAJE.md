# Montaje de la voz de la v4 (2026-10-06)

Voz «Antonio» (ElevenLabs, `htFfPSZGJwjBv1CL0aMD`), una toma elegida por línea (`datos/voz-tomas.json`), `assets/voz/01.wav…08.wav`
a 48 kHz mono y −17 LUFS. Montada con `scripts/mount-voz.mjs` por anclas, sin estirar ningún cuadro (55.000 s, mismos envoltorios y
`data-start` que antes) y sin tocar un solo archivo de voz. Pipeline completo de `scripts/README.md` §1: `assemble-index` →
`localizar-gsap` (+ `--check`) → `transitions inject` (una vez) y `verify` → `mount-sfx` → `mount-voz` → `verify-sfx` → `check`.

## Resultado en una línea

0 errores y 0 avisos de `mount-voz`; `verify-sfx` TODO OK (0 errores, 3 avisos heredados); `hyperframes@0.8.134 check` pasa (0 errores).
Habla total 34.91 s (63 % de 55 s), primera palabra a **1.092 s**, silencio final de **1.653 s**, pico de la mezcla SFX + voz
**−1.7 dBFS** (en 18.634 s), 46 de 63 SFX con ducking, 0 golpes fuertes dentro de una frase. Cifras vigentes tras la ronda 2
(re-ensamblado completo con los menores de F1 y F4 y el realce de la línea 8; ver «Ronda 2 de integración»).

## Colocación por línea

Tiempos absolutos en el video (s). «Objetivo» = inicio del cuadro + t de la ancla; «logrado» = donde cae la palabra con el clip
colocado; error = logrado − objetivo (tolerancia ±0.3 s). Clip = archivo completo (con su cola de silencio); habla = medida sobre la
señal. Hueco = silencio entre el final del habla anterior y el inicio de la siguiente.

| Línea | Cuadro | Ancla | t local | Objetivo | Logrado | Error | Clip (inicio – fin) | Habla (inicio – fin) | Hueco previo / siguiente |
|---|---|---|---|---|---|---|---|---|---|
| 01 | F1 | «cinco» | 2.05 | 2.050 | 2.117 | +0.067 | 1.002 – 6.250 | 1.092 – 5.642 | 1.09 al abrir / 2.27 |
| | | «cuatro» | 3.96 | 3.960 | 3.893 | −0.067 | | | |
| 02 | F2 | «susan» | 2.00 | 8.400 | 8.664 | +0.264 | 7.841 – 12.159 | 7.911 – 11.341 | 2.27 / 2.57 |
| | | «botón» | 4.84 | 11.240 | 10.976 | −0.264 | | | |
| 03 | F3 | «cámara» | 1.60 | 14.050 | 14.048 | −0.002 | 13.851 – 19.609 | 13.911 – 19.071 | 2.57 / 2.65 |
| | | «alumno» | 5.45 | 17.900 | 17.903 | +0.003 | | | |
| | | «presente» | 6.15 | 18.600 | 18.598 | −0.002 | | | |
| 04 | F4 | «dudoso» | 1.26 | 22.210 | 22.367 | +0.157 | 21.485 – 27.150 | 21.725 – 26.035 | 2.65 / 1.78 |
| | | «Revisión» | 3.11 | 24.060 | 24.132 | +0.072 | | | |
| | | «decides» | 4.65 | 25.600 | 25.443 | −0.157 | | | |
| 05 | F5 | «sesión» | 1.29 | 28.040 | 28.240 | +0.200 | 27.729 – 34.509 | 27.819 – 33.609 | 1.78 / 1.76 |
| | | «día» | 4.53 | 31.280 | 31.270 | −0.010 | | | |
| | | «viernes» | 6.52 | 33.270 | 33.070 | −0.200 | | | |
| 06 | F6 | «va» | 2.03 | 35.980 | 36.250 | +0.270 | 35.333 – 41.416 | 35.373 – 40.553 | 1.76 / 2.62 |
| | | «semestre» | 3.62 | 37.570 | 37.585 | +0.015 | | | |
| | | «límite» | 6.54 | 40.490 | 40.220 | −0.270 | | | |
| 07 | F7 | «Iván» | 1.98 | 43.380 | 43.378 | −0.002 | 43.099 – 48.393 | 43.169 – 47.329 | 2.62 / 3.69 |
| | | «dos» | 3.15 | 44.550 | 44.549 | −0.001 | | | |
| | | «tiempo» | 4.90 | 46.300 | 46.302 | +0.002 | | | |
| 08 | F8 | «susan» | 2.00 | 51.000 | 51.007 | +0.007 | 51.007 – 53.701 | 51.017 – 53.347 | 3.69 / 1.65 al cerrar |
| | | «segundos» | 3.79 | 52.790 | 52.783 | −0.007 | | | |

Error máximo 0.270 s (línea 6, ancla original sin tocar); todas las anclas dentro de ±0.3 s. Primera palabra 1.092 s (≥ 1.0 s) y
silencio final 1.653 s (≥ 1.5 s). Ninguna ancla cae dentro de una transición entrante. Los clips no se pisan (el hueco más corto entre
clips completos es 0.58 s, líneas 4 → 5; el más corto entre hablas, 1.76 s) y las pistas de voz alternan 40/41.

## Anclas que hubo que volver a medir (líneas 1, 2, 3 y 7)

La voz real habla más junta que la estimación de 2.6 palabras/s (34.9 s de habla contra ≈ 43.7 s de ventanas `**Time:**`) y sus
pausas «…» son de 0.3–0.8 s, no de 1 s. Con las anclas originales de `SCRIPT.md`, `mount-voz` (dry-run) daba 7 errores, todos por
la separación entre anclas de la misma línea (con un solo desplazamiento por clip no hay forma de cumplir ±0.3 s sin estirar la voz):

| Línea | Anclas originales y error con ellas | Anclas vigentes | Evento visual en esa palabra |
|---|---|---|---|
| 1 | «cinco» 1.97 (+0.107) · «cuatro» 3.96 (−0.107); aviso: 1.ª palabra a 0.962 s | «cinco» **2.05** · «cuatro» 3.96 | «5 min» quieto (tic a 1.65) con la tinta pintándose · «4 h» asentada a 3.75, quieta hasta 5.45 |
| 2 | «susan» 1.85 (+0.340) · «botón» 4.84 (−0.339) | «susan» **2.00** · «botón» 4.84 | la tarjeta despega los 8 px (1.95–2.40) con la marca ya escrita · halo de foco a 4.78 y toque a 4.95 |
| 3 | «cámara» 0.63 (+0.890) · «alumno» 6.00 (−0.625) · «presente» 6.96 (−0.889) | «cámara» **1.60** · «alumno» **5.45** · «presente» **6.15** | esquinas trabándose (1.30–1.90) · cifra «19» girando y asentada (5.05–5.65), marcos ya verdes · BarraSegmentada llenándose (5.65–6.45) |
| 7 | «Iván» 1.49 (+0.758) · «dos» 3.21 (+0.209) · «tiempo» 5.93 (−0.758) | «Iván» **1.98** · «dos» **3.15** · «tiempo» **4.90** | la fila de Iván abriéndose en su tarjeta (el nombre llega al encabezado a 2.06–2.20) · «2» quieto desde 2.85 (0.3 s antes) · la acción sugerida subiendo (4.55–5.05) y el texto entrando (5.20–5.60) |

Criterio: se movió solo la ancla (y las ventanas `**Time:**`/`**Video:**` de la línea), nunca la escena ni la voz, hacia el evento que ya
existía en la escena y que la voz real cubre mejor; las líneas 4, 5, 6 y 8 conservan las anclas originales. `SCRIPT.md`, `vo_anchor`
de `STORYBOARD.md` y el texto de cada Scene dicen lo mismo. Con estas anclas la voz real queda así sobre la imagen: F3 «mientras das tu
clase» suena durante la vista a pantalla completa (2.95–4.40), «…» durante el regreso de la vista y «y cada alumno queda presente»
durante la ola verde, el conteo y la barra; F7 «dos faltas» termina hacia 3.80, poco antes de que la sección de faltas salga (3.95).

## Avisos de `mount-voz` y qué se hizo

| Aviso o error | Causa | Qué se hizo |
|---|---|---|
| 7 errores de ancla (líneas 2, 3 y 7) con las anclas originales | la voz real no cabe en la separación estimada | anclas vueltas a medir (arriba); 0 errores |
| «la primera palabra suena a 0.962 s» (línea 1) | el clip arrancaba 0.04 s antes del segundo de silencio inicial | ancla «cinco» 1.97 → 2.05; clip en 1.002 s |
| «solo 1.299 s sin voz al cerrar» (línea 8) | `habla_fin` era el fin del último carácter alineado («.»), que arrastra 0.35 s de silencio del clip | `mount-voz` mide ahora el habla sobre la señal (RMS de 20 ms ≥ −40 dBFS): termina a 53.347 s y quedan **1.653 s**; la composición no cambió |
| ducking del `sheen` de F8 a ×0.3 (aviso del trabajador de F8) | el sheen (data-start 53.444) caía dentro de «fin del habla + 0.18 s» (53.527) y sonaba a −10 dB, siendo el único sonido del silencio final | el barrido holográfico y su cue se retrasaron 0.10 s (4.45 → 4.55 s locales, `s08-susan.html` y `sfx_cues`): suena entero y el tramo quieto previo sigue en 0.5 s; `frame-check s08-susan` 0 errores, 0 avisos, 0 huérfanos |

Estado final: sin errores y sin avisos de `mount-voz`.

## SFX bajo la voz

- 46 de 63 efectos con ducking (×0.3; ×0.6 si fueran impactos, y ninguno lo es): 12 texturas, 11 ticks, 10 whooshes, 7 pops, 4 clicks y
  2 ui. Los 17 sin ducking caen antes de la primera palabra, en los huecos entre líneas o tras la última. Detalle por efecto en
  `datos/voz-montada.json` (`ducking`).
- `verify-sfx`: 0 golpes fuertes (impact, snap, alert, chime, check) dentro de una frase; densidad 1.145 SFX/s; mayor subida de nivel
  entre segundos 9.23 dB (tope 12); mezcla SFX + voz con pico −1.7 dBFS y 0 muestras ≥ 0.99; montaje con error máximo 0 ms.
- Los 3 avisos de `verify-sfx` son los heredados «sonido sin evento visible» bajo el umbral de percepción (soft-in F1 2.00, pop-1 F5
  6.15, soft-in F7 5.20), sin cambio.
- Hueco más largo sin SFX: 3.157 s (46.722–49.879 s, entre el último SFX de F7 y el whoosh de F8): es el silencio previo al sting; la voz de F7 termina a 47.329 s.

## Ronda de audio del QA del corte 1 (renders/susan-v4-voz-r1.mp4)

| Hallazgo | Causa | Qué se hizo |
|---|---|---|
| [importante] la línea 8 suena ≈ 5 LU más baja (LUFS-M máx −16.8 contra −11.5…−12.3 de las líneas 1–7) | `assets/voz/08.wav` mide −22.6 LUFS integrados (las demás, −17.0): el loudnorm por línea es lineal y un solo golpe, la «P» de «Pasa» (pico −1.5 dBFS a 1.19 s del clip), le frena la ganancia | copia derivada `assets/voz/derived/08.wav` (+5 dB y `alimiter` con límite 0.84, ataque 2 ms, relajación 40 ms), configurada en `VOZ.mezcla.realce_por_linea` (`scripts/lib/voz-lib.mjs`) y montada por `mount-voz`. El WAV original no se toca: la colocación por anclas, el habla (ducking, silencio final) y la duración salen de él, así que no cambia ningún tiempo |
| [menor] tras la voz solo suena el sheen de 53.55 s y quedan ≈ 1.0 s de silencio absoluto | el sheen es la firma sonora del cierre y va con el barrido holográfico (4.55–5.25 s locales) | se deja como está. La exigencia de SINTESIS 2 (≥ 1.5 s de silencio final) es sobre la voz y se cumple (1.653 s). Adelantar el sheen lo mete en la ventana de ducking de la última «s» (hasta 53.527 s), que es lo que se corrigió en la ronda anterior; acortar su cola no llega ni a 1.5 s de silencio total. Para tenerlo habría que quitar el sheen, y con él la firma del cierre |

Resultado con el realce (mezcla simulada SFX + voz con el mezclador de referencia y `ffmpeg ebur128`; el mismo método reproduce los números
del QA antes del cambio): la línea 8 queda en −17.84 LUFS integrados (antes −22.57) con pico verdadero −1.46 dBTP, y su LUFS-M máximo
en la ventana de la línea pasa de −16.7 a −11.7 (p90 −12.8), dentro del rango de las líneas 1–7 (−11.5…−12.2; p90 −12.2…−13.0). Las
líneas 1–7 no cambian. Pico de la mezcla −1.70 dBFS (en 18.634 s, igual que antes; tope −1). El sheen sigue a 53.544 s, fuera del
ducking (volumen 0.56 sin `data-vol-orig`) y como único sonido tras la voz: RMS −23 dBFS contra −50 dBFS de la cola de sala de la línea 8.
`sfx_cues` no cambia: F8 sigue en `0.98 whoosh-s; 1.00 thud; 2.50 soft-in -6dB; 4.55 sheen`.

## Ronda 2 de integración (menores de F1 y F4, realce de la línea 8)

Re-ensamblado completo, en el orden de `scripts/README.md` §1: `assemble-index` → `localizar-gsap` (+ `--check`) → `transitions inject`
(una sola vez) y `verify` → `mount-sfx` → `mount-voz` → `verify-sfx` → `hyperframes@0.8.134 check`. No se tocó ningún archivo de voz
(solo se agregó la copia derivada `assets/voz/derived/08.wav`) ni se estiró ningún cuadro (55.000 s, mismos envoltorios y `data-start`).

| Cambio | Dónde | Efecto en la voz y el sonido |
|---|---|---|
| F1: el «1» ya está en el fotograma 0 (la cuenta rueda 1 → 5 desde 0.40 s, cuatro renglones) y la pista abre en `#C9C2B8` | `s01-cinco-minutos.html`, Scene 1 y 2 de `STORYBOARD.md` | ninguno: el «5» se asienta a 1.65 s como antes, ancla de «cinco» (2.05 s) intacta, `sfx_cues` sin cambio |
| F4: el látigo arranca 0.10 s más tarde (salida 1.60–1.95 s, entrada 1.85–2.45 s, tarjeta plana a 2.45 s) para no empezar con «dudoso» recién dicha | `s04-revision.html`, Scene 1 y 2 y `handoff_in` de `STORYBOARD.md` | `sfx_cues` de F4: `1.80 whoosh-m -3dB` → `1.90 whoosh-m -3dB`; `sfx-s04-revision-2` pasa de `data-start` 22.631 a 22.731 (pico del whoosh a 22.85 s, entre el fin de la salida y el inicio de la entrada) y su ducking (×0.3, dentro de la frase de la línea 4) se reaplica; ancla «dudoso» 22.367 s (+0.157) sin cambio |
| Línea 8 con realce de +5 dB y limitador | `assets/voz/derived/08.wav`, `voz-lib.mjs`, `mount-voz.mjs` | `<audio id="voz-08">` apunta a la copia; `data-start` 51.007 y duración 2.714 s idénticos; habla, ducking y silencio final salen del original |

Resultado de la corrida: `mount-voz` 0 errores y 0 avisos (informa «08 realzada +5 dB con limitador 0.84: −22.571 → −17.841 LUFS, pico
verdadero −1.456 dBTP»); `verify-sfx` TODO OK (a: 0 errores; b: 0 errores y los 3 avisos heredados; c: 0 errores, pico −1.7 dBFS en
18.634 s, mayor subida entre segundos 9.23 dB; 0 golpes fuertes dentro de una frase); `check` pasa (0 errores en lint, runtime, layout
y motion; 2 avisos de contraste de `s03-camara` a 15.278 s, heredados). Los tiempos de las ocho líneas coinciden con la tabla de arriba al
milisegundo, así que el montaje por anclas no cambió.

**Costuras** (`hyperframes snapshot`, fotogramas en `snapshots/`, que no se versiona): cortes F1→F2, F2→F3, F5→F6 y F6→F7 vistos a
−0.1/+0.2 s y a ±0.02 s del corte (SSIM entre los fotogramas a ±0.02 s: 1.0000, 0.99999, 0.9999, 0.9999; PSNR 90, 72, 54 y 54 dB), sin salto;
empujes F3→F4 y F4→F5 vistos a −0.1 s, a la mitad y a +0.6 s (el estado de borde coincide con `handoff_out` y `handoff_in`); desenfoque
cruzado F7→F8 a −0.1, 0.25 y 0.6 s (el lienzo se desenfoca y sube el cielo, sin parpadeo); y el látigo de F4 con los tiempos nuevos
(22.45 a 23.40 s). Sin correcciones en los cuadros.

## Cambios de scripts

- `scripts/mount-voz.mjs`: `habla_ini`/`habla_fin` se miden sobre la señal (antes eran el inicio y el fin de los caracteres alineados);
  la alineación se conserva en `habla_ini_alineacion`/`habla_fin_alineacion`. Alimenta huecos, silencio final, ducking y las ventanas
  de `verify-sfx`. `scripts/test-voz-dry.mjs` pasa completo (fixtures, controles negativos, render con voz).
- `scripts/README.md` §4: documenta esa medición y la regla de volver a medir las anclas con la voz real.
- `scripts/lib/voz-lib.mjs`: `VOZ.mezcla.realce_por_linea` y `derivarRealce()` (ffmpeg, PCM 16 bit mono 48 kHz, sin metadatos: el mismo archivo
  byte a byte al repetir). `scripts/mount-voz.mjs`: monta la copia derivada de las líneas con realce (`src` del `<audio>`), mide el habla
  sobre el original, informa LUFS y pico verdadero resultantes y avisa si quedan a más de 1 LU de −17 o por encima de −1 dBTP; con
  `--dry` la copia se deriva en una carpeta temporal y no se escribe nada. `datos/voz-montada.json` guarda `archivo`, `archivo_origen`
  y `realce` por línea. `scripts/test-voz-dry.mjs` prueba `derivarRealce` (nivel, techo, formato, determinismo).

## Lectura para la persona dueña

La voz cubre el 63 % del video (lo planeado era ≈ 70 %) y deja 1.8–3.7 s de silencio entre líneas (F2→F3→F4 y F6→F7→F8 son los más
largos). Es lo que da la toma real con sus pausas «…» naturales; si se quisiera más continuidad, las opciones son regenerar con pausas más largas o una cama musical (decisión pendiente), no mover las anclas.
