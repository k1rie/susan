# Lecciones de la v3 para la v4 (máquina reutilizable, defectos medidos y crítica)

Fecha: 2026-10-05. Fuente: `video/susan-presentacion` (no se modificó nada). Leí BRIEF, STORYBOARD, frame.md, los dos
README, `audit/` (sonido/REPORT.md, resultados-auditoria.json, cortes/metricas.json, ritmo/*.json), `v2/` (plan.json,
voz-*.json, sfx-mounted.json, verify-sfx*.json, resultado-produccion-1…6.json), las cabeceras de los 20 scripts y los
cuadros 01, 05, 09 y 12. **Medición nueva:** corrí `scripts/frame-check.mjs` (solo lectura) sobre los 12 cuadros
**actuales** (con los tiempos ya ajustados a la voz). Los resultados están en §3.7. Esa regresión ningún informe
anterior la registra.

## 0. Resumen en 10 líneas

1. La "v3" es la v2.4 (45.05 s, solo efectos) **alargada a 50.75 s para que cupiera la voz** (ElevenLabs «Antonio»).
   El STORYBOARD.md y la primera línea del README siguen describiendo la v1 de 56 s. La fuente de verdad real es `v2/plan.json`.
2. La máquina de **sonido** (contrato de etiquetas GSAP, biblioteca derivada, montaje, verificación sobre el MP4) es lo
   más valioso: pasó de 82 % de cues desfasados a **0 fallos en 205 cues, con error máximo de 0.006 ms**. Se reutiliza casi tal cual.
3. La máquina de **voz** (`generar-voz.mjs` + `mount-voz.mjs`, ancla por palabra y ducking) funciona, pero entró **al
   final**. Obligó a reestirar los cuadros (+5.7 s) y dejó colas muertas medidas de 1.6 a 2.6 s en 02, 04 y 09.
4. Los reportes de ritmo v1 → v2.4 se corrigieron de verdad (lento de 25.5 % a 0 tramos lentos; evento visible cada 0.62 s).
   Con la voz el video volvió a tener cuadros que **fallan su propio medidor** (3 errores y 6 avisos).
5. El estilo de la v3 (lienzo crema plano, tipografía enorme tecleada, tableros densos y 9 familias de transición) es
   casi el opuesto de la referencia v4: un objeto de UI por plano, profundidad con desenfoque, inclinación 3D suave,
   fondos de cielo o pastel y movimiento continuo y suave.
6. **Conservar:** sonido, voz, iconos, avatares, datos de demostración, el match cut del anillo y los medidores.
   **Cambiar:** la gramática visual, el número y la duración de los planos, las transiciones, la densidad de micro-eventos y el orden voz → animación.
   **Retirar:** el tecleo como recurso principal, el muestrario de transiciones, los titulares que repiten la locución y el frame.md heredado.

---

## 1. Qué es la v3

### 1.1 Historial (para no confundir cifras)

| Versión | Duración | Qué cambió | Evidencia |
|---|---|---|---|
| v1 | 56.0 s, 12 cuadros de 3.5–6.0 s | Solo efectos. Cues escritos a mano en `STORYBOARD.md` y 85 `<audio>` | `audit/sonido/REPORT.md` §1, `audit/ritmo/motion.json` |
| v2.0 → v2.4 | 45.05 s | Plan máquina `v2/plan.json`, contrato de sonido, `build-index.mjs`, cámara con helpers, 9 familias de transición, sin rotación (v2.3) y 6 renders | `v2/resultado-produccion-1…6.json` |
| **v3** (definitiva) | **50.75 s** | v2.4 más 16 frases de voz; los cuadros se alargaron +5.7 s; 205 SFX y 16 voces | `index.html:53`, `v2/voz-montada.json`; render `renders/video-v3-voz.mp4` (−17.1 LUFS, no está en esta máquina) |

### 1.2 Cuadros de la v3 (tiempos de `index.html`; "visible" = hasta el inicio del siguiente)

| # | id | Inicio (s) | Visible (s) | Δ vs v2.4 | Entra con | Qué se ve | Voz |
|---|---|---|---|---|---|---|---|
| 01 | hook | 0.00 | 2.60 | −0.60 | — | Se teclea «Pasar lista te roba / cada clase.» al ritmo de la voz; zoom a «cada clase» | «Pasar lista te roba cada clase.» |
| 02 | minutos | 2.60 | 5.18 | **+1.03** | corte en pleno zoom (zoom-in) | Anillo de 10 min, ×3 grupos, ×5 días, slam «2 h 30 / semana» | «Diez minutos por clase…» / «Dos horas y media a la semana.» |
| 03 | tarde | 7.78 | 3.10 | 0 | push arriba 0.4 | Fila de HM: barra de 6 → 21.6 % que cruza el 20 %; sello «Sin derecho a examen» | «Y las faltas se notan tarde.» |
| 04 | intro | 10.88 | 5.57 | **+1.77** | squeeze 0.4 | Degradado pastel con grano y SUSAN en cascada; eslogan (sin escudos, por pedido) | «Te presentamos a Susan.» / «Asistencia académica medida y a tiempo.» |
| 05 | cámara | 16.45 | 5.17 | +0.37 | iris 0.4 | Panel oscuro, 8 avatares con brackets (escala de ping), lista, anillo 24/24 y «Pasa lista en segundos.» tecleado | «La cámara reconoce al grupo,» / «Y pasa lista en segundos.» |
| 06 | vivo | 21.62 | 3.70 | +0.20 | **match** (anillo 24/24) | El anillo se reparte en 21/2/1, tarjetas de cifra y tanque al 88 % | «Todo en vivo y sin papeleo.» |
| 07 | revisión | 25.32 | 3.36 | +0.31 | flash 0.1 | Caso dudoso (AG, 71 %); cursor que pulsa Confirmar; Pendientes 3 → 2 | «Tú decides los casos dudosos.» |
| 08 | reportes | 28.68 | 3.65 | 0 | push izquierda 0.35 | Tabla con barras segmentadas, marca del 20 %, chips, Exportar CSV y aviso | «Reportes listos para entregar.» |
| 09 | analítica | 32.33 | 5.34 | **+1.19** | whip derecha 0.25 | Puntos S1–S8, recta, proyección que cruza el 20 % en S11 (impacto), 22.3 % y 9 en riesgo; titular en cascada | «Detecta el patrón… antes de que sea tarde.» |
| 10 | alumno | 37.67 | 3.68 | +0.23 | wipe arriba 0.35 | Teléfono: tanque al 88 %, calendario de racha, chips | «Cada alumno ve su propia asistencia.» |
| 11 | confianza | 41.35 | 4.40 | **+1.20** | push abajo 0.35 | Escudo Lucide que se dibuja y 3 píldoras con palomita | «Y tus datos, bajo control.» |
| 12 | cierre | 45.75 | 5.00 | 0 | corte seco (impact-hit) | Slam de «Pasa lista en / segundos.», SUSAN sobre malla pastel y barrido de brillo; retención de 1.65 s | «Pasa lista en segundos.» / «Esto es Susan.» |

**Arco:** PAS + demo loop (`STORYBOARD.md:5`). El problema ocupa 0–10.88 s (21 %). La marca va de 10.88 a 16.45 s (11 %).
La **primera pantalla de la app aparece en el segundo 16.45 (32 % del video)**. La demo ocupa 16.45–41.35 s (49 %, 6
cuadros); la confianza y el cierre, 41.35–50.75 s. Mensaje: «Pasa lista en segundos y entiende la asistencia de tus
grupos».

---

## 2. Qué se reutiliza y cómo

### 2.1 Activos (ya copiados a `susan-v4/assets/`, idénticos según `diff -rq`)

| Activo | Cómo reutilizarlo | Ojo |
|---|---|---|
| `fonts/` (Hanken var, EB Garamond, Geist Mono) | Usa el `@font-face` de los cuadros con `HankenGrotesk-var.woff2` y `font-weight:100 900` (`05-camara.html:3-4`) | El bloque «Font loading» de `frame.md:327-336` solo declara Hanken **Regular 400**: con él, 600 y 700 salen sintetizados. No lo copies |
| `avatars/` (24 Lorelei CC0 y `manifest.json`) | `<img src="assets/avatars/avatar-NN-xx.svg">` en círculo, con el `fondo` pastel del manifest. Docente: `avatar-16-po` (Patricia Ortega). Alumnos usados: XT, MH, VN, DR, CV, HM, SG, LB (05), AG (07) y HM (03/08) | El manifest trae los nombres sin acentos; en pantalla van con acento (Héctor, Núñez, Ramírez…) |
| `icons/` (46 SVG Lucide 1.50.0 y manifest con hash de geometría) | Mejor generar con `scripts/lucide.mjs` en vez de pegar a mano. Tabla de tamaños de `audit/resultados-auditoria.json › iconos[2]`: héroe XL disco 300–340 / icono 150–180 / trazo 1.5; tile UI 72 (r20) / icono 40 / 1.75; fila 56 / 32; en línea 32–36; check en círculo 44–52 / 26–30 / trazo 3; icono = 55–58 % del tile | Sin `sparkle`/`sparkles`/`star` (pedido de la persona dueña, v2.3) |
| `brand/` (escudos UNACH y FCA) | Solo si la persona dueña los pide | En la v3 los **quitó** de 04 y 12 (`12-cierre.html:247`, `04-intro.html:313`) |
| `sfx/derived/*.wav` (61 únicos, 48 kHz, golpe a ≤ 10 ms del inicio y pico a −6 dBFS) y `sfx/CATALOG.json` | Se nombran por catálogo en `sfx(tl, T, 'pop-2', 0.4)`. Campos: `anclaMs`, `anclaje` (hit / inicio / pico / fin), `categoria`, `volDefecto`, `gananciaDb`, `rango`, `deprecated` | Hay 14 alias heredados (pop, ping, whoosh…) y 2 obsoletos (`flash`, `sparkle-short`): no los uses. Para el «reel» faltan swish de foco, whoosh suave largo y clic de UI más fino; derívalos con `derive-sfx.sh` |
| `sfx/baked/*.wav` (01-hook-1, 03-tarde-1, 05-camara-1, 11-confianza-1) | **No sirven:** son frases tecleadas de la v3. Los regenera `mount-sfx.mjs` | Bórralos o ignóralos |
| `sfx/*.mp3` originales | Solo son la materia prima de `derive-sfx.sh` | `riser-1s.mp3` es **silencio** y `click = click-soft`, `whoosh = whoosh-short` (md5). Nunca los montes directos |

**Kit de UI de `frame.md` (líneas 340–385): sí sirve.** Tokens (`--ink #1e1919`, `--canvas #f7f5f2`, `--card #fff`,
`--muted #f0ede8`, `--mfg #6f6a65`, `--line #e7e2dc`, `--blue #0061fe`, estados ok/warn/bad/info con su `-bg`, colores
de gráfica `--g-ok #27a06a`, `--g-warn #c98100`, `--g-bad #de4d44`, `--g-blue #4a86f0`, `--g-violet #8b6fe0`). Clases
`su-card`, `su-stat`, `su-chip-i`, `su-st` (estado con punto + texto), `su-btn`, `su-pill-g`, `su-av`, `su-row`/`su-track`/`su-fill`,
`su-cursor` y `su-grain` (ruido SVG en data-URI para el pastel/holográfico) y la lista de «piezas de datos». **La regla de
escala sí vale:** la app usa 14 px y el video etiquetas de 26–30 px, cifras de 64–120 px, radio de 28 px y borde de 2 px
(≈ ×2). En la v4 los tokens se contrastan con `capture/app-real/`, que manda.
**No sirve lo de arriba (líneas 1–336):** es el preset «Blue Professional» y se contradice. Dice «cobalt #1e2bfa»
(línea 6) y el token es `#0061fe`. Pone «Hanken Grotesk + Hanken Grotesk» (líneas 7, 41 y 146). Prohíbe los pasteles
(línea 134), pero el brief los usa. Pide radios de 10–14 px (líneas 8 y 203), pero el kit usa 28. Exige una barra de
progreso en cada cuadro, y nunca se usó. Para la v4 hay que escribir un `frame.md` nuevo desde cero.

### 2.2 Scripts (`susan-presentacion/scripts/`)

Todos resuelven la raíz como `scripts/..` (o `--root`): al copiar `scripts/` a `susan-v4/` la raíz queda bien sin cambios.
Lo que hay que adaptar está en §2.3.

| Script | Qué hace | Entrada → salida | ¿Sirve para la v4 tal cual? |
|---|---|---|---|
| `frame-helpers.snippet.js` | Bloque canónico que se pega en cada cuadro: `sfx`, `sfxType` (teclas ≤ 14/s), `sfxCount` (ticks ≤ 12/s, 4 alturas), `readMark`, `camInit/camTo/camSnap/camPush/camPull/camPan/camTilt` (siempre `immediateRender:false`, `data:'hero'`, foco → x = (960−fx)·s) | — | **Sí.** Para la v4 hay que **ampliarlo** con helpers 3D (perspectiva, `rotationX/Y`, `z`) y de foco (blur por capa). `camTilt` (rotación en el plano) sigue vetado |
| `test-frame-helpers.mjs` | Prueba las funciones puras del snippet en `vm` | snippet → código 0/1 | Sí. Hay que ampliarlo con los helpers nuevos |
| `analyze-sfx.mjs` | Mide silencio, onset, hit, pico, fin90, golpes y forma de cada audio | `assets/sfx` o `--dir` → `sfx-meta.json` (+ PNG de envolventes) | Sí |
| `derive-sfx.sh` | Deriva la biblioteca con ffmpeg/lavfi (golpe ≤ 10 ms, pico −6 dBFS), luego analiza y cataloga | mp3 → `derived/*.wav`, `CATALOG.json` | Sí. Es determinista; solo hace falta correrlo si se agregan sonidos |
| `build-sfx-catalog.mjs` | Arma `CATALOG.json` con la tabla nombre → categoría / anclaje / volumen / uso | `derived/` + meta → catálogo | Sí. Los sonidos nuevos se agregan a su tabla `def(...)` |
| `extract-events.mjs` | Abre el index real (`bundleToSingleHtml` de la CLI + Chrome) y vuelca todos los tweens con su tiempo absoluto; con `--cues` saca las etiquetas `sfx:*` y `read:*` | index → `audit/sonido/events.json` o `v2/sfx-cues.json` | Sí, con cuidado: toma **el primer** `hyperframes/dist` que encuentra en `~/.npm/_npx` (aquí hay 3 cachés). Hay que fijar la versión 0.8.134 |
| `mount-sfx.mjs` (+ `bake-typing.mjs`) | data-start = t − ancla (y `data-media-start` si sale negativo); nunca recorta por el cue siguiente; hornea las frases tecleadas en un WAV; polifonía ≤ 4; baja la mezcla a ≤ −1.5 dBFS; estima LUFS | `sfx-cues.json` + catálogo → bloque `<!-- sfx:start/end -->` de index y `sfx-mounted.json` | Sí (idempotente). **Vacía** `AJUSTES_CUE` y `EXTRA_TECLEO_DB` en `lib/sfx-lib.mjs` (son de la v3) |
| `verify-sfx.mjs` (+ `verify-sfx-sync.py`) | (a) biblioteca, (b) etiqueta ↔ tween a ≤ 33.3 ms, lectura y teclas ≤ 14/s, (c) aritmética del montaje y pico, (d) correlación de ataque contra el MP4 | cues, montaje y MP4 → `verify-sfx.json` y `verify-sfx-sync.json` | Sí. Es el criterio de aceptación del sonido |
| `test-sfx-toy.mjs` | Proyecto de juguete de punta a punta con un control negativo (cue a +80 ms debe FALLAR) | — | Sí, para validar el pipeline con la CLI 0.8.134 **antes** de construir (cambia el `hyperframes@0.8.114` de su línea 201) |
| `build-index.mjs` (+ `lib/plan.mjs`) | Genera `index.html` completo desde `plan.json`: una `.scene` por cuadro (inicio_i = inicio_{i−1} + dur_{i−1} − solape), transiciones GSAP con sus etiquetas `sfx:` y un ancla de duración maestra | plan → index (conserva el bloque sfx) | Sirve como **base**, pero hay que cambiar el CSS fijo (`.scene{background:#f7f5f2}`), el vocabulario de transiciones (10 tipos 2D) y agregar perspectiva/3D y foco |
| `validate-plan.mjs` | Valida el esquema del plan y las reglas | plan → errores | **No tal cual:** exige un total de 42–54 s, cuadros de 2.6–6.2 s, «≥ 6 tipos distintos» y «ningún tipo repetido seguido». Son reglas de la v2 y empujan al muestrario de transiciones (ver §4) |
| `plan-frame.mjs` | Imprime para un trabajador las reglas y la hoja de su cuadro | plan + id → texto | Sí (cambia la ruta del plan) |
| `frame-check.mjs` (+ `lib/frame-host.mjs`, `lib/navegador.mjs`, `lib/png.mjs`) | Medidor de UN cuadro sin render: energía de movimiento a 15 fps (lento < 0.30, muerto ≥ 1.0 s), eventos visibles, cámara (deriva < 3 %/s, snaps), sonido, lectura, iconos y trampas (fromTo sin `immediateRender:false`, `repeat:-1`, CSS animado, `<audio>` dentro) | id → informe (no escribe archivos) | Sí, verificado hoy con Chrome de `~/.cache/hyperframes`. Dos salvedades. `frame-host` imita el runtime 0.8.114: hay que compararlo con `npx hyperframes snapshot --at …` de la 0.8.134. Y la métrica castiga la deriva lenta y continua (ver §4.8) |
| `preview-frame.mjs` | PNG de un cuadro en los instantes pedidos y hoja de contactos | id + `--at`/`--every`/`--sheet` → `v2/preview/<id>/` | Sí. Pesa mucho: en la v3 sumó unos 270 MB; agrega su carpeta a `.gitignore` |
| `lucide.mjs` | Iconos Lucide reales desde `web/node_modules/lucide-react` (v1.50.0, existe): `--size --stroke --tile TONO --draw`, `--verify --strict` e `--identify` | nombre → `<svg>` | **Sí tal cual:** `../../web` resuelve igual desde `video/susan-v4` |
| `generar-voz.mjs` | ElevenLabs `/text-to-speech/<voz>/with-timestamps` por línea, con el texto vecino como contexto, `loudnorm` de 2 pasadas (−17 LUFS, TP −1.5) y caché por huella. `--elegir N` genera N tomas y las califica con STT | `voz-guion.json` + `.env` → `assets/voz/NN.wav`, `voz-alineacion.json` (inicio y fin de cada carácter) | Sí. Necesita `ELEVENLABS_API_KEY` en `susan-v4/.env` (no existe; el `.gitignore` raíz ya ignora `.env`). «Antonio» exige plan de pago por API. El mensaje de error menciona la carpeta de la v3 |
| `mount-voz.mjs` | Coloca cada línea con data-start = (inicio del cuadro `ref` + `t_local`) − instante de la palabra ancla; ducking de SFX ×0.3 (impactos ×0.6), 0.1 s antes y 0.18 s después; separación ≥ 0.12 s | guion + alineación + index → bloque `<!-- voz -->` y `voz-montada.json` | Sí. Depende de que el index tenga `id="el-<id>"` (convención de build-index) |
| `audit/ritmo/motion-v2.4.py`, `camara.py`, `audit/cortes/*.py`, `audit/sonido/measure-render.py`, `check-video-sync.mjs` | Energía por 0.1 s del MP4, tiras de transición, contraste (desviación estándar de luminancia) y desfase de render | MP4 → JSON/PNG | Sirve **el método, no los archivos**: llevan rutas `/Users/diegoguerrero/...`, `/opt/homebrew/bin/ffmpeg` y tablas `STARTS`/`TRANS` de la v2. Hay que parametrizarlos para leer los inicios del index |

### 2.3 Rutas y supuestos fijos que hay que adaptar en `susan-v4`

1. **Carpeta de datos `v2/`** fija en build-index, extract-events, mount-sfx, bake-typing, verify-sfx, frame-check,
   plan-frame, validate-plan, preview-frame (`v2/preview`), generar-voz (`v2/voz-guion.json`, `v2/voz-alineacion.json`,
   `v2/voz-cache`) y mount-voz. Hay que elegir una carpeta (por ejemplo `datos/`) y sustituir el prefijo en los 11 scripts
   o centralizarlo en `scripts/lib/rutas.mjs`. `plan/` queda para los documentos.
2. **Versión de la CLI:** los mensajes de `lib/navegador.mjs:33,47`, `extract-events.mjs:55` y `test-sfx-toy.mjs:201` dicen
   `0.8.114`; la v4 fija `0.8.134` (`package.json`). Los README de la v3 usan `render --quality high`; en 0.8.134 la tabla de la CLI
   habla de `draft/looks/delivery` (compruébalo con `--help`).
3. **Calibraciones de la v3 en `lib/sfx-lib.mjs`:** `AJUSTES_CUE` (ventanas absolutas 6.3–6.5 s, 31.2–31.4 s… de la v3),
   `EXTRA_TECLEO_DB = {'01-hook': 2}` y `GANANCIA_DB` (calibrada para un video **sin voz**, −20.5 LUFS). Con voz desde el
   principio hay que recalibrar.
4. **`lib/plan.mjs`/`validate-plan.mjs`:** `TIPOS` (10 transiciones 2D), `VERBOS_CAMARA` (incluye `tilt`/`orbit`, aunque
   r = 0 obligatorio), `RANGO_DUR`, total 42–54 s y cuadro 2.6–6.2 s. Para la v4: 50–60 s, escenas de hasta ~9 s y tipos
   `focus`/`morph`/`push3d`.
5. **`build-index.mjs`:** `.scene` con fondo crema sólido, sin `perspective` en `#root` y track alterno 0/1. Para fondos de
   cielo o pastel y transiciones de foco hay que cambiar la plantilla.
6. **IDs que empiezan con dígito** (`05-camara-…`): obligaron a escribir `.\30 5-camara-…` o `[id="…"]`. Producen **480
   avisos `id_requires_css_escape`** de 567 en lint. En la v4 hay que usar un prefijo con letra (`s05-…`).
7. `.gitignore` de la v4: ignora `revision/` y `voz-cache/` a cualquier profundidad, pero no la carpeta de previews ni los binarios
   de auditoría (`audit/**/*.png|jpg|wav`). Hay que agregarlos.
8. `frame-host.mjs` sirve GSAP local (`lib/vendor/gsap.min.js` 3.14.2). Coincide con la v4 (`index.html` usa 3.14.2).

### 2.4 Cómo se construía un cuadro (patrones que sí conviene heredar)

- **Estructura:** `<template>` → `#root data-composition-id="<id>" data-start=0 data-duration=D` → fondo en su propio
  `class="clip"` → **un** `#<id>-world` con `data-camera` (cámara = `scale/x/y` del mundo; nunca `width/height`). GSAP por
  CDN dentro del template, un timeline pausado en `window.__timelines['<id>']`, cero `<audio>` en cuadros y
  `tl.set({}, {}, D)` al final para fijar la duración exacta (`05-camara.html:486`, `12-cierre.html`). Atributos
  `data-layout-ignore`, `data-layout-allow-overflow` y `data-layout-allow-overlap` para que `check` no marque los desbordes
  intencionales de cámara.
- **Un solo número para tween y sonido:** `var T = 0.45 + k*0.18; tl.fromTo(bx[k], …, T); sfx(tl, T, 'ping-note'+(k+1), 0.45);`
  (`05-camara.html:407-410`).
- **Entrada en dos tweens** (aparición de 0.10 s con ~70 % del recorrido y asentamiento con resorte que arranca 0.10 s
  después). El sonido va al asentamiento − `AVANCE_ASENT = 0.07` (`05-camara.html:363`, `09-analitica.html`,
  `12-cierre.html`): así el golpe cae entre +17 y +50 ms del primer fotograma visible.
- **Tecleo seek-safe:** tabla `K = [[t,'c'],…]`, función pura `estados()` (texto completo en cada instante), caret con
  onda cuadrada de 0.3 s que se reinicia en cada tecla y `sfxType(tl, 0, tiempos, {texto, maxPorSeg:14})`. En la v3 la
  tabla K del gancho salió de `voz-alineacion.json` (cada letra aparece cuando la voz la dice: `01-hook.html:207-244`).
  El mismo truco sirve para la **cascada de palabras** sincronizada con la voz (`09-analitica.html`, `TW9 = [2.3, 2.72, …]`).
- **Contadores:** `fromTo(num, {innerText:a}, {innerText:b, snap:{innerText:1}})` o un objeto con `onUpdate`, más
  `sfxCount` con **la misma ease**; cada tick lleva un golpecito de escala 1.07 → 1 para que el sonido tenga evento visible
  (`09-analitica.html`, función `bump`).
- **Trazos SVG:** `getTotalLength()` medido (no adivinado) y `strokeDashoffset L → 0`. En iconos Lucide: `--draw` con
  `pathLength=100` y offsets **enteros** (GSAP redondea `px`).
- **Regla anti-salto:** todo `fromTo` posterior sobre el mismo objetivo y la misma propiedad lleva `immediateRender:false`.
  Su ausencia causó el bug de 06 en la v1: entraba a 1.6× y saltaba a 1.0× en un fotograma (24.37–24.40 s).
- **Match cut con contenido idéntico** (05 → 06): 05 termina con un empuje 1 → 2 (`power3.in`) que deja el anillo «24 / 24»
  centrado a 460 px, y 06 arranca con el mismo anillo. El revisor lo midió **pixel-perfect** (459 px a ambos lados, centro
  (959, 539)). Es el mejor momento de la v3 y el modelo de transición para la v4.

### 2.5 Orden del pipeline (heredado y probado)

`derive-sfx.sh` (solo si hay sonidos nuevos) → `build-index` → `extract-events --cues` → `mount-sfx` → `verify-sfx` →
`generar-voz` → `mount-voz` → `hyperframes check` → render → `verify-sfx --video`. La voz va al final **del pipeline de
montaje** porque build-index y mount-sfx reescriben index.html. Eso **no** obliga a que entre al final del **diseño** (§4.5).

---

## 3. Lo que encontraron las auditorías y si se arregló

### 3.1 Sincronía de sonido (v1, `audit/sonido/REPORT.md`)

| Hallazgo v1 | Cifra | Arreglo | Estado final |
|---|---|---|---|
| Cues a > 40 ms de su evento | 70/85 (82 %), mediana **+117 ms** (siempre tarde) y peor caso 1055 ms (typing de 10) | Contrato v2: etiqueta `sfx:` en el mismo T que el tween y data-start = t − ancla | **Arreglado:** 205 cues medidos, **0 fallos**, error medio 0.001 ms y máximo 0.006 ms (`v2/verify-sfx-sync.json`) |
| Golpe a destiempo dentro del mp3 | pop 117, ping 323, chime 416, typing 455 y error 606 ms | Biblioteca derivada con ancla ≤ 10 ms | Arreglado |
| Riser mudo | −118.7 dBFS | `riser-1s` real (sube 50.6 dB) y `riser-s` | Arreglado |
| 7/8 pings del clímax inaudibles | `data-duration` 0.28 s < ancla 0.321 s, con 2.95 s de silencio en 18.0–20.95 s | No recortar nunca por el cue siguiente; `ping-note1..8` en escala | Arreglado |
| Impactos tipo drone | 2.1–2.6 s a −3 dBFS RMS; mezcla +1.22 dBFS con 501 muestras saturadas | `impact-hit` (0.86 s) e `impact-lite` | Pico final −3.66 dBFS y 0 muestras ≥ 0.99 |
| Tecleo desfasado | 14–36 ms por carácter contra un mp3 de 8 teclas irregulares | Horneado por frase y ≤ 14 teclas/s; el tecleo total bajó de ~12 s a ~5.6 s | Arreglado |
| Huecos de silencio | 15.7 s (28 %) en tramos ≥ 0.8 s | Regla «ningún hueco > 1.0 s» | Parcial |
| Saltos de nivel | ~25 dB entre segundos | `GANANCIA_DB` y `AJUSTES_CUE` | **No arreglado:** salto máximo de 1 s = **22.4 dB** (5 → 6 s), luego 19.7 y 18.4 dB (objetivo ≤ 12; `v2/sfx-mounted.json`) |
| Mezcla con voz | — | Ducking | **159 de 205 SFX quedaron atenuados** (152 a ×0.3 y 7 impactos a ×0.6). El diseño sonoro denso, de 4.0 SFX/s, quedó como textura bajo la voz |

Mecánica medida del motor (vale para la v4). `data-start` tiene resolución de 1 ms. `data-media-start` alinea exacto, incluso
en mp3. `data-duration` es un **corte duro**. Las capas suman en lineal. `data-fade-*` y `data-automation` funcionan. No hay
alineación automática.

### 3.2 Ritmo y movimiento

| Métrica (motion.py, 15 fps, gris 320×180, lento < 0.30) | v1 (56 s) | v2.4 (45.05 s) | Fuente |
|---|---|---|---|
| Tiempo lento | 14.3 s (25.5 %) | 0 tramos lentos; 12.4 % de bins bajo umbral | `audit/ritmo/motion.json`, `motion-v2.4.json` |
| Tramos muertos ≥ 1 s | 9.1 s (7 tramos); el más largo 2.8 s (F9, 38.0–40.8 s) | 0 | ídem |
| Eventos visibles | 53 (cada 1.07 s; máximo 3.7 s) | 70 (cada 0.62 s; máximo 1.6 s en 17.4–19.0 s) | ídem |
| Energía mediana | 0.578 | 1.421 | ídem |
| Cámara | 21 tweens: 17 empujes y 11 (22.7 s) a < 3 %/s (invisibles); 9.0 s sin cámara (47–56 s); F1 y F12 sin cámara | 6 snap-zooms, pull-backs, pans y dolly; sin rotación | `resultados-auditoria.json › ritmo[2]`, `plan.json reglas CÁMARA` |
| Arranques vacíos | caret solo 2.5 s en F10; tarjeta vacía en F8 | Regla «HÉROE legible a 0.30 s» | `cortes[6]` |

### 3.3 Cortes y transiciones

- v1: 2 BIEN, 6 MEJORABLE y 3 MAL. Disoluciones en 45 % (crossfade y blur-crossfade **lavan a crema**: la desviación
  estándar de luminancia cae de 44.4 a 6.2 a los 37.87 s). Tres push LEFT idénticos seguidos. El zoom-through enseñaba el
  borde del cuadro entrante (04 → 05, 17.57–17.77 s). Texto sobre texto a 4.65, 9.15, 17.65 y 51.75 s. Bug de cámara en 06.
- v2.1: **10 BIEN, 1 MEJORABLE y 0 MAL**; v2.4 aprobada. Once transiciones de 9 familias, ninguna disolución y el match
  pixel-perfect. Arreglado. El precio, la fragmentación, se discute en §4.4.
- La lectura (frases que salían 0.35 s después de completarse) se corrigió con `readMark` y un mínimo de 0.6–0.7 s;
  el cierre retiene 1.65 s.

### 3.4 Iconos, contraste y layout

- Iconos v1: de 63 SVG, 38 eran Lucide exactos y 25 no. Medían 22–32 px (2.1 % del alto), con tiles grises e icono gris
  (~4.4:1) y un timer de 36 px dentro de un dial de 580 px. Se arreglaron con `lucide.mjs`: `--verify --strict` da 0
  errores en 65 SVG y los tiles miden 56–150 px.
- Avatares v1: siluetas CSS con iniciales; se cambiaron por Lorelei (CC0).
- `hyperframes check` (todas las integraciones v2.x): 0 errores, **contraste 84/84 AA** y Motion 0. El lint da 0 errores
  y 567 avisos: 480 `id_requires_css_escape`, 58 `id_override_reduced_specificity`, 12 `composition_file_too_large`
  (cuadros de 24–50 KB) y otros 17.

### 3.5 Deriva de documentos

`STORYBOARD.md` (v1 de 56 s, con tiempos de escena que ya no existen), la línea 1 de `video/README.md` (56 s y pipeline v1
`assemble-index` + `transitions inject`) y los comentarios internos de los cuadros. Por ejemplo, `05-camara.html:379-385`
dice «acaba en 4.80 s» y el cuadro dura 5.17; `09-analitica.html` dice «4.5 s» y dura 5.69. Ninguno se actualizó tras
alargar los cuadros. **Lección:** una sola fuente de verdad (el plan) y comentarios sin tiempos absolutos.

### 3.6 Preferencias explícitas de la persona dueña (registradas en el código y en el plan)

Sin tropiezo ni corrección en el tecleo del gancho (`01-hook.html:209`). **Ninguna rotación de cámara ni tarjetas
inclinadas** (v2.3: la rotación entre fotogramas bajó de 2.41° a 0.12°). Sin iconos de estrella o destello; el brillo
suena con `sheen`. Cierre **solo con el nombre** (sin escudos ni píldora UNACH · FCA). Sin `whoosh-rev` antes de la voz
del cierre (`11-confianza.html:361`). 01 → 02 como zoom a «cada clase»; 02 → 03 con push en vez de un corte seco
brusco. En la voz: «sin papeleo» en lugar de «sin escribir nada» (el acento se torcía), «Susan» en minúsculas (en
mayúsculas la deletrea) y la toma B de la línea 14.

### 3.7 Regresión medida hoy: la v3 con voz falla su propio medidor

`node scripts/frame-check.mjs <id>` sobre los cuadros actuales (plan de 50.75 s). Resultado: **3 errores y 6 avisos**.

| Cuadro | Δ por la voz | Movimiento | Pausa sin evento | Máximo sin cámara |
|---|---|---|---|---|
| 02-minutos | +1.03 s | **muerto 3.7–5.6 s (1.9 s)**, lento 34 % | 1.03 s | 1.82 s |
| 04-intro | +1.77 s | **muerto 4.4–6.0 s (1.6 s)**, lento 37 %, mediana de energía 0.09 | 1.16 s | **2.33 s** |
| 09-analitica (el «clímax») | +1.19 s | **muerto 3.1–5.7 s (2.6 s)**, lento 46 % | 0.85 s | **2.64 s** |
| 11-confianza | +1.20 s | lento 41 % (0.0–0.6, 1.1–1.7, 1.8–2.4 s) | 0.35 s | **2.3 s** |
| 07 / 10 | +0.31 / +0.23 s | lento 0.7 s al final (19 % y 17 %) | — | — |
| 01-hook | −0.60 s | aviso: el timeline dura 2.8 s y el cuadro 2.6 s | — | — |
| 03, 05, 06, 08, 12 | 0 a +0.37 s | sin avisos | — | — |

En total hay ~9.9 s lentos en 53.35 s de cuadro (≈ 19 %). Las colas muertas coinciden **exactamente** con los cuadros que
la voz alargó. Ningún informe guardado midió la v3 final: los `motion-*.json` llegan solo a la v2.4 de 45 s.

---

## 4. Evaluación crítica de la v3 frente al brief v4

Referencia v4: `referencia/ref-01…05`, el reel de levii.motion. Lo que digo del reel sale de 5 fotogramas fijos; lo
que digo de la v3 está medido o tiene archivo y línea.

1. **Gramática visual opuesta.** La referencia muestra un objeto de UI por plano, en gris casi monocromo sobre un lienzo
   claro, con mucho aire. Usa profundidad real: la tarjeta desenfocada que luego se enfoca (ref-02 → ref-03), tarjetas que
   flotan con inclinación y un fondo de cielo o tarjeta holográfica. Cifras grandes con «▲ 6.9 % From last week», tooltip
   en píldora inclinada y barras finas con un bloque resaltado (ref-04).
   La v3 es plana: `grep perspective|rotateX|rotateY|preserve-3d` da **0 coincidencias en los 12 cuadros**. La única
   sombra es la del cursor (`07-revision.html:82`). El desenfoque solo aparece en transiciones y cascadas, nunca como foco
   de cámara. La regla «tarjetas SIN sombra» viene del sistema de la app (`frame.md:344`) y la v2.3 prohibió toda rotación.
2. **Pantallas densas, tipo tablero.** 05 combina panel de cámara de 1060×700, lista de 8 filas, anillo, 8 etiquetas,
   titular de 104 px y chip: **205 tweens en 5.17 s (39.7/s)**. 10-alumno tiene 189 tweens (46.9/s) y 11, 119 (27/s).
   Los estados verde, ámbar y rojo, el azul de acento y el pastel conviven en casi todos los cuadros. La referencia pone
   una sola cosa en foco y el resto en gris o desenfocado.
3. **Movimiento nervioso en lugar de fluido.** La regla v2 «un evento visual nuevo cada ≤ 0.6 s» (`plan.json reglas
   RITMO`) se cumplió a base de micro-eventos: pops, chips, ticks y escalas de ping. Las curvas que aparecen en el código de los cuadros
   (sin contar el bloque canónico) son `power2.out` 150, `none` 53, **`back.out` 52** (resortes), `power3.out` 48 y
   `expo` solo 2. Se ve «saltarín»; el look
   After Effects pide curvas largas y suaves (in-out con cola), pocos rebotes y movimientos grandes y continuos. En la v1
   el revisor ya había contado 268 entradas casi idénticas de opacidad 0 → 1 con 14–40 px.
4. **Fragmentación y muestrario de transiciones.** Doce micro-escenas de 2.6–5.6 s y 11 transiciones de **9 familias**
   (corte, push ↑ ← ↓, squeeze, iris, match, flash, whip, wipe): el lenguaje cambia cada ~4.6 s. La variedad la exigía el
   propio validador («≥ 6 tipos distintos», «ningún tipo repetido seguido», `validate-plan.mjs:12`). Una pieza profesional
   repite 2 o 3 transiciones firma de forma coherente. La única transición «de autor» de la v3, el match del anillo, es
   justo la que mejor funcionó.
5. **La voz se pegó al final y desordenó el ritmo.** Hubo que alargar +5.7 s, recolocar a mano letras y palabras sobre la
   alineación (`01-hook.html:207`, `09-analitica.html` TW9) y aceptar colas muertas de 1.6–2.6 s (§3.7). El 78 % de los
   SFX quedó atenuado. La voz cubre el **60.6 %** del video (30.74 s de 50.75): 84 palabras a **2.73 palabras/s**
   (rango 1.69–3.94), con huecos entre frases de 0.37–2.72 s (media 1.22).
6. **El texto en pantalla repite la locución.** Nueve de 12 cuadros llevan un titular de 64–190 px. Cuatro se teclean
   (01, 03, 05, 11), cuatro entran en cascada (04, 07, 09, 10) y el 12 cae de golpe (slam). Con voz, el espectador lee y oye la misma frase («Pasa lista
   en segundos» aparece en 05 y 12 y se dice dos veces; también «Tú decides…», «Detecta el patrón…», «Cada alumno…»). La
   referencia no tiene titulares: solo etiquetas de UI y cifras.
7. **Energía cargada al inicio y colas muertas.** La regla «HÉROE legible a 0.30 s» y «ningún evento durante el solape
   de entrada» hacen que cada cuadro **abra ya armado** y luego decore. Tras alargarlos, el final queda vacío: en 02, 04 y
   09 el último 27–46 % no tiene movimiento perceptible. A nivel de guion, el problema se lleva 10.88 s y la app no
   aparece hasta el segundo **16.45 (32 %)**: tarde para un lanzamiento a docentes.
8. **La cámara es un zoom de una imagen plana.** Los movimientos son `scale/x/y` de un mundo 2D: los críticos de la v1 y
   la v2 se quejaron de «zooms repetidos», y los snaps bajaron de 12 nominales a 7. Sin capas a distinta profundidad, un
   push no da sensación de espacio. El medidor de la v3 además castiga la deriva lenta (< 3 %/s = «imperceptible») y
   empujó hacia golpes de cámara cortos. El estilo de la referencia vive justo de derivas lentas y continuas con paralaje.
9. **Las gráficas no son el héroe.** En 09 los puntos miden 38 px y la recta 3 px. El medidor da energía media 0.67 y
   mediana 0.22, con 2.6 s muertos. La referencia hace de la gráfica el plano completo, con un cursor-guía que la recorre y
   un tooltip en píldora que sigue el valor (ref-01) o una barra resaltada (ref-04).
10. **El sonido está bien sincronizado pero sobrecargado.** 205 SFX en 50.75 s (4.0/s), con escalas de ping, ticks por
    entero y pops en 4 alturas. Un reel de UI suele usar pocos golpes firma por capas (swish en cada movimiento de
    cámara, clic, tic, destello) y deja espacio a la voz. Además quedan saltos de 22.4 dB.

---

## 5. Conservar / Cambiar / Retirar en la v4

### Conservar

- **Contrato de sonido completo:** `frame-helpers` (sfx/readMark/cam*) → `extract-events --cues` → `mount-sfx` →
  `verify-sfx` (+ `--video`), con la biblioteca derivada y el catálogo. Criterio de aceptación: 0 fallos a ≤ 33.3 ms y
  pico de mezcla ≤ −1 dBFS.
- **Pipeline de voz:** `generar-voz` (con-timestamps, caché, `--elegir` con STT) y `mount-voz` (ancla por palabra,
  ducking). Ajustes de la v3: `eleven_multilingual_v2`, stability 0.35, similarity 0.8, style 0.45, semilla 1037 y
  −17 LUFS por línea. «Susan» en minúsculas. La línea 05 la reconoció el STT como italiano (prob. 0.308): hay que vigilar
  la pronunciación del nombre.
- **Medidores** `frame-check` y `preview-frame` (tras adaptar rutas y versión) y `lucide.mjs --verify --strict`.
- **Avatares Lorelei, iconos Lucide con su tabla de tamaños y fuentes**, y el **kit de tokens** de frame.md (líneas
  340–385) contrastado con `capture/app-real/`.
- **Datos de demostración coherentes** (validarlos contra la captura real): 3A «Administración Financiera», Patricia
  Ortega (avatar-16), 24 inscritos, límite 20 %. 10 min × 3 grupos × 5 días = 2 h 30. 24/24 → 21 presentes + 2 retardos
  + 1 sin registro = 88 %. HM de 6 % a 21.6 % = «Sin derecho». Serie S1–S8 de 8 a 17 %, recta y = 6.9 + 1.28·S que
  cruza el 20 % en S11 y llega a 22.3 % en S12; 9 en riesgo. Alumno con 29/33 = 88 % y racha de 7. AG con 71 % de
  similitud y pendientes 3 → 2.
- **Técnicas:** match cut con contenido idéntico, `immediateRender:false`, entrada en dos tweens con el sonido al
  asentamiento, tecleo y cascada guiados por la alineación de la voz, cifra con tick y golpecito, y `readMark` con lectura
  mínima de 0.6–0.7 s.
- **Preferencias de la persona dueña de §3.6.** Excepción por confirmar: la inclinación 3D (ver abajo).

### Cambiar

- **Voz primero.** Guion con presupuesto de palabras antes de animar: a ~2.7 palabras/s y 60–70 % de cobertura, 55 s dan
  **~90–100 palabras**. Cada escena se diseña sobre el tiempo de su frase, con anclas de palabra en el plan y **ventanas
  de SFX** reservadas en los huecos. Mientras no haya clave, hay que maquetar con duraciones estimadas (o una voz
  provisional) y recalcular con la alineación real **sin estirar cuadros**: se ajusta la escena por dentro.
- **Menos planos y más largos:** 7–9 escenas de 5–8 s, cada una con **un objeto de UI héroe** y cámara continua. Cada
  escena sigue siendo una sub-composición para Studio.
- **Profundidad:** `perspective` en la escena y pose 3D suave de las tarjetas (`rotationX/Y` de 6–12°, `z`, paralaje
  entre capas), foco por capa con `filter: blur()` (rack focus) y un fondo de cielo o pastel con `su-grain`. **Hay que
  confirmarlo con la persona dueña**: en la v2.3 vetó la rotación; esto es pose 3D en perspectiva, no balanceo en el plano,
  pero conviene enseñarlo en la hoja de bocetos. La sombra suave ambiental, solo en el objeto flotante del video, también
  se desvía de la regla de la app (sin sombra): hay que decidirlo.
- **Transiciones:** 2–3 firmas usadas con coherencia: paso de foco o desenfoque, **morph/match de un elemento de UI** y
  empuje de cámara a través de la escena. Hay que quitar las reglas «≥ 6 tipos» y «sin repetir tipo» de `validate-plan`.
- **Curvas:** in-out largas (`power3/power4/expo.inOut`, `expo.out` para llegadas), con `back.out` solo en 1–2 acentos.
  El criterio de ritmo pasa de «evento cada ≤ 0.6 s» a «movimiento continuo sin cámara quieta > 1.5 s y sin colas
  muertas ≥ 1.0 s». Hay que recalibrar `frame-check` para no penalizar derivas lentas intencionales.
- **Texto en pantalla:** etiquetas, cifras y kickers cortos que **complementan** la voz. Tipografía grande solo en 2 o 3
  momentos (gancho, nombre y cierre).
- **Gráficas como plano héroe**, con cursor-guía, tooltip en píldora que sigue el valor, cifra grande y variación
  porcentual (lenguaje de ref-01 y ref-04).
- **Estructura narrativa:** el problema en ≤ 8 s y la app en pantalla hacia el segundo 6–8.
- **Sonido:** ~1–2 SFX/s, un set firma (swish de foco y cámara, clic, tic, destello y un impacto) y saltos de 1 s
  ≤ 12 dB. La mezcla se calibra **con** la voz.
- **Ingeniería:** IDs con prefijo de letra, carpeta de datos única, versión 0.8.134 en todos los scripts, `frame.md`
  nuevo sin contradicciones y comentarios sin tiempos absolutos.

### Retirar

- El **tecleo carácter a carácter como recurso principal** (como mucho en el gancho, guiado por la voz).
- El **muestrario de transiciones**: iris, squeeze, wipe, whip y flash como familias sueltas.
- Las **escalas de ping, ticks por entero y pops en 4 alturas** como relleno constante.
- Los titulares de 64–190 px que repiten la locución.
- Los tableros con los 4 colores de estado a la vez cuando no cuentan un estado.
- La prosa del preset en `frame.md` (líneas 1–336) y el bloque de fuentes Regular-only.
- `assets/sfx/baked/*` (de la v3), los 14 alias y los 2 obsoletos del catálogo, `AJUSTES_CUE` y `EXTRA_TECLEO_DB`.
- Los scripts de auditoría con rutas de macOS fijas: se reescriben parametrizados si hacen falta.
- Los escudos institucionales, salvo que la persona dueña los pida.
