# scripts/ de la v4: sonido, voz y revisión

Herramientas de la v4 del video de SUSAN para montar los efectos de sonido, la locución (más adelante) y revisar cada cuadro sin
renderizar. Son el port de la máquina de la v3 (`video/susan-presentacion/scripts/`, que no se tocó) adaptado a la v4:

- los SFX salen de `sfx_cues` de `STORYBOARD.md`, no de etiquetas GSAP;
- el índice lo ensamblan los scripts de la skill `product-launch-video` (`assemble-index.mjs` + `transitions.mjs`), no `build-index.mjs`;
- la CLI queda fijada en `hyperframes@0.8.134` y los ids de cuadro llevan letra (`sNN-nombre`);
- hay una sola carpeta de datos, `datos/`, y las rutas viven en un solo lugar (`lib/rutas.mjs`).

Todos los comandos se corren desde `video/susan-v4/` y aceptan `--root <proyecto>`, que es lo que usan las pruebas con el proyecto de
juguete. Ver también `plan/SINTESIS.md` (reglas 2–4 y 22–24), `plan/PLAYBOOK.md` §1–§2 y §5, y `frame.md` §1.

## 1. Orden del pipeline

```bash
S=/root/.claude/skills/product-launch-video/scripts
HF="npx --yes hyperframes@0.8.134"

# --- video (con SFX, sin voz)
#  0. cuadros: compositions/frames/sNN-nombre.html (workers). Opcional, por cuadro y en cualquier momento:
node scripts/frame-check.mjs s05-tendencia            # medidor (runtime real 0.8.134); --todos para todos
node scripts/preview-frame.mjs s05-tendencia --bordes --anclas --sheet   # fotogramas en revision/s05-tendencia/
#  1. ensamblar                                                         REESCRIBE index.html COMPLETO
node $S/assemble-index.mjs --storyboard ./STORYBOARD.md --hyperframes .
#  2. GSAP local (el ensamblador vuelve a poner el CDN, que da 403)       reescribe el <script> de GSAP de index.html
node scripts/localizar-gsap.mjs && node scripts/localizar-gsap.mjs --check
#  3. transiciones, UNA sola vez por ensamblado                         reescribe index.html y ALARGA los cuadros salientes
node $S/transitions.mjs inject --storyboard ./STORYBOARD.md --hyperframes .
node $S/transitions.mjs verify --storyboard ./STORYBOARD.md --index ./index.html
#  4. efectos de sonido                                                 reescribe el bloque <!-- sfx --> de index.html
node scripts/mount-sfx.mjs
node scripts/verify-sfx.mjs                           # biblioteca + cues contra tweens + reglas + montaje (regenera datos/eventos.json)
#  5. comprobación, fotogramas, vista previa y render
$HF check
$HF snapshot . --at "$AT"                              # AT: mitades de cuadro y cada corte -0.1/+0.2 (PLAYBOOK 1.6)
$HF preview --background --port 3017 && $HF preview --status
$HF render --quality draft --fps 30 --output renders/susan-v4-draft.mp4    # solo con aprobación
node scripts/verify-sfx.mjs --video renders/susan-v4-draft.mp4            # sincronía medida sobre el MP4

# --- después: la voz (con ELEVENLABS_API_KEY y red hacia api.elevenlabs.io)
node scripts/generar-voz.mjs --seco                    # valida SCRIPT.md y estima créditos (sin clave ni red)
node scripts/generar-voz.mjs                           # assets/voz/NN.wav + datos/voz-alineacion.json
node scripts/mount-voz.mjs                             # reescribe el bloque <!-- voz --> y el data-volume de los SFX (ducking)
node scripts/verify-sfx.mjs                            # ahora con las ventanas REALES de la voz
$HF check && $HF render ... && node scripts/verify-sfx.mjs --video renders/...
```

Ante cualquier cambio en un cuadro o en el storyboard se repite desde el paso 1: `assemble-index` borra los bloques de sonido y de
voz, así que hay que volver a correr `mount-sfx` y, si ya hay voz, `mount-voz`. `mount-sfx` vuelve a aplicar el ducking por su
cuenta cuando encuentra la voz montada y `datos/voz-montada.json`. Nunca corras `transitions inject` dos veces sobre el mismo índice,
ni `audio.mjs fetch-sfx`, `audio.mjs` (generate) o `audio.mjs sync-durations` (SINTESIS 4 y 22).

### Qué escribe cada script

| Script | Escribe | ¿Toca `index.html`? |
|---|---|---|
| `assemble-index.mjs` (skill) | `index.html` completo | **sí, entero** (borra transiciones, SFX y voz) |
| `localizar-gsap.mjs` | el `<script>` de GSAP | **sí** (solo esa línea); `--check` no escribe |
| `transitions.mjs inject` (skill) | envoltorios `el-*` y el bloque de transiciones; alarga el `data-duration` de los cuadros salientes | **sí** |
| `mount-sfx.mjs` | bloque `<!-- sfx:start/end -->`, `datos/sfx-cues.json`, `datos/sfx-montado.json` | **sí** (solo su bloque; reaplica el ducking) |
| `mount-voz.mjs` | bloque `<!-- voz:start/end -->`, `data-volume`/`data-vol-orig` de los SFX, `datos/voz-montada.json`, `assets/voz/derived/NN.wav` (solo líneas con realce) | **sí** (su bloque y el ducking) |
| `generar-voz.mjs` | `assets/voz/NN.wav`, `datos/voz-alineacion.json`, `voz-cache/`, `datos/voz-tomas.json` (`--elegir`) | no |
| `extract-events.mjs` | `datos/eventos.json` | no |
| `verify-sfx.mjs` | `datos/verify-sfx.json`, `datos/sfx-efectivo.json` y `datos/verify-sfx-sync.json` (con `--video`) | no |
| `frame-check.mjs` | nada (informe por consola o `--json`) | no |
| `preview-frame.mjs` | `revision/<frame_id>/t-*.png` y `sheet.png` | no |

Los cuadros (`compositions/frames/*.html`) solo los modifica `transitions inject` (alarga la cola del cuadro saliente). Ningún script
de esta carpeta los escribe.

## 2. `sfx_cues`: sintaxis exacta

Una línea por cuadro en `STORYBOARD.md`, en la columna 0, como las demás claves (PLAYBOOK 1.3):

```markdown
- sfx_cues: 0.40 whoosh-s; 1.55 tap -3dB; 2.10 pop-2; 2.10 sheen-s +2dB
```

```
sfx_cues  := 'none' | cue ( ';' cue )* [';']
cue       := tiempo ESPACIO nombre [ ESPACIO ganancia ]
tiempo    := segundos LOCALES del cuadro, decimal con punto (1.55 o 1.55s), 0 <= t <= duration del cuadro
nombre    := nombre CANÓNICO de assets/sfx/CATALOG.json, en minúsculas ([a-z0-9-])
ganancia  := +N dB | -N dB, relativa al volDefecto del catálogo (rango -24..+6 dB); opcional
```

- **Tiempo local**: 0 es el `data-start` del envoltorio `el-<frame_id>` en `index.html`. En un cuadro con `transition_in`, el 0 es el
  inicio de la transición entrante (`transitions inject` alarga el cuadro saliente y nunca mueve un `data-start`). Por eso un whoosh
  que acompaña un `push-slide LEFT 0.5s` va en el cuadro ENTRANTE, hacia `0.25` (el pico de velocidad).
- **Qué instante se escribe**: el del evento visual, que es donde debe caer el **ancla** del sonido. El ancla es el ataque **medido**
  de cada WAV derivado (`anclaMs` del catálogo):

  | `anclaje` | Sonidos | El tiempo del cue es… |
  |---|---|---|
  | `hit` | pop-1…4, tap, click-soft2, blip, tick-1…4, thud, impact-*, check, draw, sheen, sheen-s… | el fotograma del golpe: el inicio o el final (llegada) de un tween |
  | `inicio` | fill | el arranque del movimiento (textura de ataque suave) |
  | `pico` | whoosh-s, whoosh-m, whoosh-l, swipe | el pico de velocidad del movimiento (debe caer sobre un tween) |
  | `fin` | riser-s, riser-1s, zoom-in | el impacto o la llegada: el archivo TERMINA ahí |

  El montaje compensa el ataque: `data-start = t absoluto − ancla` (con `data-media-start` si queda antes de 0).
- **Capas**: varios cues en el mismo instante son las capas de un evento (`2.10 pop-2; 2.10 sheen-s`). Lo normal son 2–3 capas;
  4 solo en las costuras.
- **Ids**: el orden dentro de la línea da `sfx-<frame_id>-<n>`, que es el id del `<audio>` (los ids con letra no necesitan escape).
- **Volumen**: `volDefecto` del catálogo (ya trae la ganancia de su categoría) × la ganancia del cue, con tope de 0.80 por cue. Después
  se aplica el bus (`--bus-db N` o `--objetivo-lufs X`), la polifonía (más de 4 sonidos a la vez: los de menor rango ×0.5) y el
  techo de la mezcla (−1.5 dBFS).
- **Detienen el montaje** (no se escribe nada): sintaxis (coma decimal, `@vol`, mayúsculas), nombre desconocido, **alias heredado** de
  la v3 (`pop`, `whoosh`, `click`… → se sugiere el canónico), **obsoleto** (`flash`, `sparkle-short`, `sparkle`), ganancia fuera de
  rango, cue fuera de `[0, duration]`, cuadro con cues que no está en `index.html` y `<audio>` ajenos en el índice (p. ej. de
  `audio_meta.json`). Un cuadro sin `sfx_cues` produce un aviso; escribe `none` si es a propósito.

`sfx_cues` es la única fuente del sonido: la clave `sfx:` de la skill (nombres sin tiempo) no se usa, y las etiquetas `sfx:` de GSAP de
la v3 ya no se montan (`frame-check` avisa si un cuadro las tiene).

## 3. Reglas de sonido (SINTESIS 22) y quién las aplica

| Regla | `mount-sfx` | `verify-sfx` |
|---|---|---|
| Nombre canónico, sin alias ni obsoletos | error | error (b) y (c) |
| Golpe en el fotograma del evento: inicio o final de un tween a ≤ 33.3 ms; whoosh sobre un movimiento (±66 ms); tick dentro de un tween | — | error (b) |
| Sonido de golpe (tap, pop, blip, soft-in, check…) sin un cambio perceptible en su fotograma | — | aviso (b) |
| ~1–2 SFX/s; ~0.8–1 eventos/s; 2–3 capas por evento (4 en costura) | aviso | aviso (b) |
| Sin ticks por entero (más de 4 `tick-*` en 1 s) | aviso | **error** (b) |
| Sin `whoosh-rev` en el cuadro final ni antes de la voz del cierre | aviso | **error** (b) |
| Golpes fuertes (impact, snap, alert, chime, check) fuera de las frases | — | aviso con ventanas estimadas (`**Time:**` de SCRIPT.md); **error** con la voz montada |
| Subidas de nivel ≤ 12 dB entre segundos que suenan | aviso | **error** (c), sobre la mezcla SFX + voz |
| Pico de la mezcla ≤ −1 dBFS, sin saturar | techo automático a −1.5 dBFS | error (c) |
| Montaje: `data-start + ancla − media-start = t` (±1 ms), `data-duration` ≥ ancla + 0.15 s | — | error (c) |
| Sincronía medida en el MP4 (correlación de ataque, ±33.3 ms) | — | error (d), con `--video` |

**Nivel por segundo.** Se mide como el RMS máximo en ventanas de 100 ms dentro de cada segundo, no como el RMS de 1 s de la v3. Con
1–2 SFX/s, el RMS de un segundo depende sobre todo de cuánto dura el sonido y no de lo fuerte que suena. Solo cuentan las SUBIDAS
entre dos segundos que suenan (≥ −45 dBFS): el defecto medido en la v3 era un golpe que llegaba muy por encima del segundo anterior.
La salida desde silencio y la cola que se apaga no cuentan. El ajuste se hace con la ganancia de cada cue (`-3dB`); `AJUSTES_CUE` de
la v3 se retiró.

## 4. Voz (ElevenLabs, para después)

`SCRIPT.md` sigue el formato de PLAYBOOK 2.1: una `## Line N — etiqueta (Frame N)` por cuadro y el texto con sangría de 4 espacios.
Ese texto es lo único que llega al TTS. Lleva también `**Anchor:** «palabra» @ 1.70s · «otra» @ 3.90s`, en tiempo local del cuadro.
Opciones por línea, que el `parseScript` de la skill ignora:

- `**Time:** 0.5 – 4.2s`: ventana estimada de la frase, que sirve para reservar huecos de SFX antes de tener voz.
- `**Seed:** 1101`
- `**Settings:** stability 0.45 · style 0.3`
- `**Speed:** 1.1`: atempo después de generar.
- `**Context:** none`: sin texto vecino, para un inicio limpio.
- `**Take:** <huella>`: fija una toma de la caché.

En la cabecera va `**Voice id:** <id>`.

- **Ajustes probados en la v3** (`lib/voz-lib.mjs`): `eleven_multilingual_v2`, stability 0.35, similarity 0.8, style 0.45, speaker
  boost, semilla 1037, `language_code: es`, texto vecino como contexto, loudnorm de dos pasadas a −17 LUFS (TP −1.5) por línea. La
  salida es `assets/voz/NN.wav`, a 48 kHz, mono y 16 bit.
- **Clave**: `ELEVENLABS_API_KEY` del entorno o de `video/susan-v4/.env`, que el `.gitignore` raíz ignora. Nunca se imprime. La voz
  sale de `**Voice id:**`; si falta, de `ELEVENLABS_VOICE_ID`; si tampoco está, se usa «Antonio» de la v3 con un aviso (exige plan de
  pago).
- **Caché**: `voz-cache/<NN>-<huella>.json` (gitignored). La huella cubre la voz y el cuerpo de la petición: lo ya generado no se vuelve
  a pagar salvo con `--forzar`. `--elegir N --solo 05` genera N semillas, las califica con Speech to Text y guarda la elegida en
  `datos/voz-tomas.json` (SCRIPT.md no se reescribe).
- **Sin red**: `--seco` valida y estima créditos. `--fixture <carpeta>` usa una alineación falsa con la forma exacta de la respuesta
  `/with-timestamps` y sintetiza un tono por carácter. Recorre todo lo demás (caché, loudnorm, alineación) y marca la caché como
  `fixture` para no confundirla con tomas reales.
- **Avisos del guion**: texto distinto de `voiceover` o anclas distintas de `vo_anchor` en el storyboard; «SUSAN» en mayúsculas (lo
  deletrea); cifras con dígitos; frase que no cabe en su `**Time:**` a 2.6 palabras/s; más de 110 palabras en total.
- **Montaje por anclas** (`mount-voz.mjs`):
  - Cada línea se coloca de modo que su palabra ancla suene en `inicio del cuadro + t`.
  - Con varias anclas se usa el desplazamiento que minimiza el error máximo. Si un ancla queda a más de 0.3 s, es error: se ajusta la
    escena o se recorta el texto. **Nunca se estira un cuadro**; el script comprueba que la duración y los envoltorios no cambien.
  - Errores: clip antes de 0 o después del final, frases separadas por menos de 0.12 s, texto cambiado sin regenerar y palabra ancla
    ausente.
  - `habla_ini`/`habla_fin` (el habla de cada línea) se miden sobre la señal (RMS de 20 ms ≥ −40 dBFS) y no con el último carácter
    alineado: «.» y «…» arrastran la cola de silencio del clip (hasta ~1 s con la voz de la v4). Con ellos se calculan los huecos entre
    frases, el silencio final, el ducking y las ventanas de `verify-sfx`; la alineación queda en `habla_ini_alineacion`/
    `habla_fin_alineacion` de `datos/voz-montada.json`.
  - Las anclas de `SCRIPT.md` son estimaciones hasta que existe la voz. Si la voz real habla más junta y una línea no cabe en la
    holgura (v4: líneas 2, 3 y 7, errores de hasta 0.89 s con las originales; la línea 1 solo se corrió 0.08 s para que la primera palabra suene a ≥ 1.0 s), se vuelven a medir sobre `voz-alineacion.json` hacia
    el evento visual que ya existe en la escena, y `SCRIPT.md`, `vo_anchor` de `STORYBOARD.md` y el texto de la escena dicen lo mismo.
    Nunca se estira un cuadro ni se toca la voz.
  - Avisos: costura de menos de 0.3 s, primera palabra antes de 1.0 s, menos de 1.5 s de silencio final, ancla dentro de la transición
    entrante del cuadro y pico de SFX + voz por encima de −1 dBFS.
- **Realce por línea** (`VOZ.mezcla.realce_por_linea` en `lib/voz-lib.mjs`): el loudnorm por línea es lineal, así que un transitorio
  aislado (la «P» de «Pasa» en la línea 8 de la v4, pico −1.5 dBFS) frena la ganancia y deja la línea por debajo de −17 LUFS. Para esas
  líneas `mount-voz` monta una copia derivada, `assets/voz/derived/NN.wav` (ganancia en dB + `alimiter` con `limite` lineal, `ataque_ms`,
  `relajacion_ms`; con la v4: `'08': { db: 5, limite: 0.84, ataque_ms: 2, relajacion_ms: 40 }` → −22.6 a −17.8 LUFS, pico −1.5 dBFS). El
  WAV original no se toca y la colocación por anclas, el habla (ducking, silencio final) y la duración salen de él: el realce cambia el
  nivel, nunca un tiempo. `mount-voz` informa el LUFS y el pico verdadero de la copia y avisa si quedan a más de 1 LU del objetivo o por
  encima de −1 dBTP. Si se regenera la voz de una línea con realce (`generar-voz.mjs`), `mount-voz` la vuelve a derivar sola.
- **Ducking**: los SFX que suenan durante una frase (−0.1/+0.18 s) bajan a ×0.3, y los impactos a ×0.6. El volumen original queda en
  `data-vol-orig`, así que el proceso es idempotente; `--sin-ducking` lo revierte.
- **Red**: `api.elevenlabs.io` está bloqueado por la política de red de esta máquina (2026-10-06). Detrás de un proxy, Node necesita
  `NODE_USE_ENV_PROXY=1` para que `fetch` lo use.

## 5. Revisión por cuadro

`frame-check.mjs` y `preview-frame.mjs` alojan UN cuadro con el **runtime real** de la CLI 0.8.134. Lo montan en un proyecto temporal
que solo contiene ese cuadro en 0 s (`lib/runtime-host.mjs`). Cada instante se busca con `window.__player.renderSeek`, igual que en
`snapshot` y `render`, así que no imitan el runtime como el arnés de la v3.

- `frame-check` revisa:
  - (a) Energía de movimiento, con muertos ≥ 1.0 s como error y el reparto grande/micro/quieto.
  - (b) Pausas sin evento visible.
  - (c) Cámara y pose 3D: |rotX| ≤ 8, |rotY| ≤ 10, sin giro en el plano, y plano en el último fotograma, tras un corte y en cada
    `read:`.
  - (d) Los `sfx_cues` de su Frame contra sus tweens (tiempo local).
  - (e) Lectura: ≥ 1.2 s desde cada `read:` hasta el final.
  - (f) Iconos Lucide; un cursor es error.
  - (g) Trampas: GSAP del CDN, transform CSS sobre lo que anima GSAP, ancestros que aplanan el 3D, blur de más de 24 px, sobreimpulsos
    (con `--todos`, más de 2 en el video es error), salida en un cuadro no final, `fromTo` repetido y determinismo.

  Lee la duración, `transition_in`, `sfx_cues` y `vo_anchor` de `STORYBOARD.md`.
- `preview-frame` saca PNG al tamaño del video en `revision/<id>/` (ignorada por git). `--bordes` agrega 0, el fin de la transición
  entrante y el fotograma del handoff. `--anclas` agrega cada `vo_anchor` y cada `sfx_cues`. `--sheet` arma la hoja de contactos.
- `frame-helpers.snippet.js` es un bloque opcional para pegar en un cuadro. Incluye `readMark` (marca de lectura que revisan los
  medidores), cámara seek-safe (`camPush/camPull/camPan/camSnap`, escala ≤ 1.3) y pose 3D con topes (`camPose`, que lanza un error
  fuera de ±8/±10, y `camPlano`). No trae `sfx()`: el sonido va en `sfx_cues`.

## 6. Pruebas

```bash
export TMPDIR=<carpeta temporal>          # las pruebas trabajan en copias, nunca dentro de test-fixtures/
node scripts/test-frame-helpers.mjs       # 13 pruebas en vm, sin navegador
node scripts/test-sfx-toy.mjs             # juguete de 3 cuadros: ensamblado real, montaje, controles negativos, render y desfases
node scripts/test-voz-dry.mjs             # voz sin red con alineación falsa, montaje por anclas, ducking, controles y render con voz
node scripts/test-frame-check.mjs         # frame-check/preview-frame en el juguete y en un borrador roto a propósito
```

- `test-fixtures/toy-sfx/` es un proyecto mínimo: `STORYBOARD.md` con `sfx_cues`, `SCRIPT.md` con anclas, tres cuadros de 960×540 sin
  texto y `voz-falsa/NN.json`. `test-fixtures/frame-check/s02-linea-trampas.html` es un borrador con 12 errores y 4 avisos plantados.
- Cifras de referencia (2026-10-06, CLI 0.8.134):
  - `test-sfx-toy`: 17 cues, montaje idempotente, `lint` sin errores, 0 desfases en el MP4 (error máximo 0.004 ms). Los controles de
    ±5 y ±20 ms pasan con el desplazamiento medido a < 1 ms; los de +40 y ±80 ms fallan.
  - `test-voz-dry`: anclas simples exactas y dobles a ±0.053 s; con voz y ducking, los SFX siguen 17/17 en el MP4.
  - Las cuatro pruebas suman unos 90 s.

## 7. Datos, dependencias y diferencias con la v3

`datos/`:

| Archivo | Lo escribe | Contenido |
|---|---|---|
| `sfx-cues.json` | `mount-sfx` | cues con su t absoluto |
| `sfx-montado.json` | `mount-sfx` | un registro por `<audio>` y el informe de mezcla |
| `eventos.json` | `extract-events` | tweens con su t absoluto y la comprobación de que el runtime posiciona cada cuadro en `data-start + t` |
| `verify-sfx*.json`, `sfx-efectivo.json` | `verify-sfx` | informes y volúmenes reales para la medición sobre el MP4 |
| `voz-alineacion.json`, `voz-montada.json`, `voz-tomas.json` | `generar-voz` y `mount-voz` | alineación, montaje y tomas elegidas |

Dependencias:

- Node 22, `ffmpeg`/`ffprobe`.
- La CLI `hyperframes@0.8.134` en la caché de npx: aporta el compilador, `puppeteer-core` y el Chrome de `~/.cache/hyperframes`.
- `assets/vendor/gsap.min.js`.
- Para `verify-sfx --video`: `python3` con `numpy` y `scipy` (`pip install --user numpy scipy`, o `SUSAN_PYTHON=/ruta/python`).

| v3 | v4 |
|---|---|
| Cues en etiquetas GSAP `sfx(tl, t, nombre, vol)` + `extract-events --cues` | Cues en `sfx_cues` de STORYBOARD.md; `extract-events` solo vuelca tweens para verificar |
| `build-index.mjs` + `v2/plan.json` | `assemble-index.mjs` + `transitions.mjs` de la skill; tiempos de STORYBOARD.md |
| Timelines de cuadro anidados en `main` (0.8.114) | En 0.8.134 no cuelgan de `main`: t absoluto = `data-start` + t local (lo comprueba `extract-events`) |
| `frame-host.mjs` imitaba el runtime | `runtime-host.mjs` usa el runtime real (`bundleToSingleHtml` + `renderSeek`) |
| `AJUSTES_CUE`, `EXTRA_TECLEO_DB`, tecleo horneado | Retirados; ganancia por cue en `sfx_cues`; las teclas se montan sueltas (el tecleo dejó de ser recurso) |
| Alias y obsoletos aceptados con aviso | Rechazados al montar |
| `v2/voz-guion.json` | `SCRIPT.md` (+ `datos/voz-tomas.json` para las tomas elegidas) |
| Rotación prohibida | Pose 3D acotada (±8/±10, plana en lecturas y bordes); el giro en el plano sigue prohibido |

Se copiaron sin cambios `analyze-sfx.mjs`, `derive-sfx.sh` y `build-sfx-catalog.mjs`. Sirven para derivar sonidos nuevos;
`build-sfx-catalog` reproduce el `CATALOG.json` actual entrada por entrada.
