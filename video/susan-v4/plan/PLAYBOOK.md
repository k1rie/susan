# PLAYBOOK técnico v4: HyperFrames + product-launch-video

> Para quienes escriben el storyboard/guion y para quienes construyen los cuadros de la v4. **Reemplaza la lectura de las
> skills**: todo lo que sigue sale de `/root/.claude/skills/{product-launch-video, hyperframes, hyperframes-core,
> hyperframes-animation, hyperframes-keyframes, hyperframes-creative, hyperframes-cli, media-use}` y de leer el código de
> los scripts (no solo su documentación). Precedencia ante conflicto: `BRIEF.md` (decisiones de la persona dueña) > este
> playbook > skills. Las marcas **[conv. v4]** son convenciones propuestas para este proyecto (no existen en las skills);
> las marcas **[código]** son comportamientos verificados en el código de los scripts que la documentación no menciona.

## 0. Rutas, variables y mapa de pasos

```bash
P=/home/user/susan/video/susan-v4                 # raíz del proyecto (todos los comandos se corren DESDE aquí)
S=/root/.claude/skills/product-launch-video       # scripts del flujo: $S/scripts/*.mjs
A=/root/.claude/skills/hyperframes-animation      # rules/<id>.md, blueprints/<id>.md
HF="npx --yes hyperframes@0.8.134"                # CLI fijado por package.json (funciona sin red desde la caché de npx)
cd "$P"
```

| Paso | Produce | Quién | Gate |
|---|---|---|---|
| 1 Captura | `capture/extracted/{tokens.json,visible-text.txt,asset-descriptions.md}` + `capture/assets/` | orquestador | inventario de activos utilizable |
| 2 Diseño | `frame.md` (+ `.hyperframes/caption-skin.html`) | `build-frame.mjs` | sale con código 0 |
| 3 Story | `STORYBOARD.md` (+ `SCRIPT.md`) | orquestador | plan aprobado en el chat (modo `collaborative`) |
| 3.1 Audio | `audio_meta.json` | `audio.mjs` | v4: **solo SFX**; la voz, después (§2.3) |
| 4 Visual | `storyboard.html` (bocetos) + `STORYBOARD.md` enriquecido + `assets/` | orquestador | hoja de bocetos confirmada |
| 5 Cuadros | `compositions/frames/NN-*.html` + `index.html` | 1 sub-agente por cuadro + `assemble-index.mjs` | todos `animated` |
| 6 Final | transiciones, check, snapshots, vista previa, `renders/*.mp4` | orquestador | aprobación de la persona dueña |

Modo: `BRIEF.md` tiene `flow: automation` + `storyboard: yes`, de donde se deriva **`mode: collaborative`**: hay pausa en el
plan (§1 del review loop), en la hoja de bocetos y en la vista final. Nada se renderiza sin aprobación.

**Precondiciones de la v4 (no hubo `hyperframes capture`)**: la captura propia vive en `capture/app-real/` y **ningún script
la lee**. Antes del paso 3 hay que crear a mano la ruta "sin captura" que exigen las skills:
`capture/extracted/tokens.json` (`{ "title","description","colors":[],"fonts":[] }` con los tokens reales de SUSAN),
`capture/extracted/visible-text.txt` (textos reales de la app y el brief), `capture/extracted/asset-descriptions.md`
(inventario canónico: una línea por archivo, `nombre.png — qué muestra, tamaño`) y **copiar a `capture/assets/` (plano, sin
subcarpetas) los recortes elegidos de `capture/app-real/crops/`**: `stage-assets.mjs` solo busca en `capture/assets`,
`capture/assets/videos`, `capture/assets/svgs` y `capture/screenshots` **[código]**. Paso 2:
`node $S/scripts/build-frame.mjs --preset <nombre> --hyperframes .` (los presets están en el Apéndice A; lee
`capture/extracted/tokens.json`; **sobrescribe `frame.md`**). El ensamblador pinta el fondo base del video con el color
`canvas` de `frame.md` (primera clave de `colors:` que coincida con `cream|paper|canvas|white|bg|ground|surface|base|…`;
el orden de las claves importa) **[código]**.

---

## 1. `STORYBOARD.md`: formato exacto que leen los scripts

Hay **dos lectores distintos** y el archivo debe satisfacer a los dos:

- `lib/storyboard.mjs` (`parseStoryboard`, lo usan `assemble-index`, `transitions`, `stage-assets`, `audio`, `captions`):
  es tolerante y acepta encabezados `##`/`###` que empiecen con `Frame`/`Beat`/`Scene`.
- `lib/frame-packets-core.mjs` (lo usa `frame-packets.mjs`): es **estricto**. Corta los cuadros con `^## Frame\s+`
  (solo H2 y `Frame` con mayúscula) y lee los campos con `^-\s+<clave>:\s*(.+)$` (guion en la columna 0).

### 1.1 Frontmatter (YAML plano, una línea `clave: valor` por línea)

| Clave | Valor v4 | Efecto |
|---|---|---|
| `format` | `1920x1080` | lienzo para todos los scripts; si falta o está mal escrito se usa 1920x1080 |
| `duration` | `55s` | expectativa: el ensamblador avisa si el total se desvía más de 10 % (no bloquea) |
| `message` | `"Pasa lista en segundos y entiende la asistencia de tus grupos"` | tesis; consulta de BGM si falta `music` |
| `arc` | p. ej. `"PAS + Demo Loop: …"` | informativo |
| `audience` | `"docentes de la UNACH FCA C-I"` | informativo |
| `mode` | `collaborative` | comportamiento de las pausas |
| `music` | `none` | **apaga la BGM**. `music: none` + sin `SCRIPT.md` es la marca de "proyecto silencioso": `audio.mjs` (generate) **borra** `audio_meta.json` y no genera nada. `fetch-sfx` funciona aparte, pero si después corre generate con esa marca, se pierden los SFX **[código]** |

Las claves desconocidas se guardan en `globals.extra`. No uses listas, bloques multilínea ni anidación: una línea sin `:`
solo produce un aviso y se ignora.

### 1.2 Secciones antes del primer `## Frame` (en este orden)

`## Video direction` (una sola vez: sistema de paleta por rol desde `frame.md`, gramática de movimiento y modelo de
revelado al ritmo de la voz, asignación de cuadros quietos para el ritmo, lista negativa con los dos modos de falla:
diapositiva y salvapantallas), y después `## Changes from vN`, `## Still open`, `## Locked`, el hilo conductor, las
prohibiciones y el cuadro quieto (storyboard-recipe §1). **Nada después del último cuadro**: `frame-packets` toma desde un
`## Frame` hasta el siguiente o hasta el final del archivo, así que una sección final se cuela en el paquete del último
cuadro **[código]**. **`## Video direction` NO llega a los workers** (el paquete solo lleva el bloque del cuadro y el
worker solo lee además `frame.md`) **[código]**: el orquestador debe pegar un extracto en el contexto de cada dispatch
(§5, paso 5, punto 3).

### 1.3 Claves por cuadro (`- clave: valor`, una sola línea, guion en la columna 0)

| Clave | La lee | Formato / valores | La escribe |
|---|---|---|---|
| `scene` (alias `description`/`summary`/`caption`) | parser, packets | una línea de intención; **nunca** es texto visible | paso 3 |
| `voiceover` (alias `vo`/`voice_over`/`narration`) | parser (le quita las comillas), captions | la locución, en una línea; solo referencia de tiempo, **nunca se pinta** | paso 3 |
| `duration` | parser (`durationSeconds` = primer número), assemble (obligatoria y > 0), `sync-durations` | `5.5s` | paso 3 |
| `poster` | parser | segundos para la miniatura, después de la entrada: `4.8s` | paso 3/4 |
| `transition_in` (alias `transition`) | `transitions.mjs` | `crossfade` · `blur-crossfade` · `push-slide [LEFT\|RIGHT\|UP\|DOWN]` · `zoom-through` · `squeeze`, más una duración opcional (`0.4s`); `cut`/`none`/vacío = corte seco. En el cuadro 1 se ignora | paso 3 (el 4 no la toca) |
| `status` | parser, assemble | `outline` → `built` (boceto confirmado) → `animated` (HTML final). Cualquier otro valor da un aviso y se toma como `outline` | orquestador |
| `src` | todos | `compositions/frames/NN-nombre.html`; **su basename es el `frame_id`** = `data-composition-id` = clave en `window.__timelines` = `id="el-<frame_id>"` en el índice | paso 3 |
| `type` | humano, blueprints | `hook`·`pain_point`·`product_intro`·`feature_showcase`·`benefit_highlight`·`social_proof`·`branding`·`cta` | paso 3 |
| `persuasion` / `beat` | humano | movimiento concreto (Pain agitation, Show-don't-tell proof…) / emoción concreta (`tension → relief`) | paso 3 |
| `blueprint` | packets: incrusta `blueprints/<id>.md` | **exactamente** `<id>`, `<id> (Reproduce)`, `<id> (Adapt)` o `compose`. Si el id no existe, `frame-packets` falla | 3 (candidato), 4 (confirma) |
| `asset_candidates` | `stage-assets`, assemble | `assets/<archivo> — descripción; assets/<otro> — …` (separador ` — `; solo nombres que estén en `asset-descriptions.md`) | paso 3 |
| `focal` / `roles` | worker | héroe / `nombre = cutout · nombre = background (dim 30–50 %) · nombre = supporting` | paso 4 |
| `sfx` | `audio.mjs fetch-sfx` | **nombres separados por comas** de la biblioteca (Apéndice B). Sin tiempos: todos caen en el segundo 0 del cuadro y un nombre repetido en el mismo cuadro se deduplica **[código]**. `none` = sin SFX | paso 4 |
| `sfx_cues` **[conv. v4]** | orquestador | hoja de tiempos `t nombre; t nombre` (segundos locales del cuadro) para fijar `offset_s` a mano o montar con la máquina de la v3 | paso 4 |
| `handoff_out` / `handoff_in` | worker (contrato duro) | elemento + x/y + scale + opacity + dirección y velocidad al corte; todos los campos, aunque no cambien | paso 4 |
| `rules` | packets | ids separados por comas: los incrusta aunque no se mencionen en el texto | opcional |
| `vo_anchor` **[conv. v4]** | orquestador (montaje de voz) | `«palabra» @ 1.70s; «otra» @ 3.90s` (tiempo local en que debe sonar la palabra ancla) | paso 3 |

Debajo de las claves va la narrativa libre: `narrativeRole:`, `keyMessage:`, la línea de postura
(`Reproduce|Adapt|Compose: qué se conserva / qué cambia`) y la **secuencia de tomas con tiempos**
(`Scene N (a–bs): …`, en párrafos y no en encabezados). Toda línea de la narrativa que tenga forma `- palabra: texto` se
toma como **metadato** y desaparece de la narrativa **[código]**.

### 1.4 Ejemplo completo (estilo v3, contenido v4)

````markdown
## Frame 5 — Quién empieza a faltar

- scene: Una gráfica de líneas entrelazadas se dibuja en una tarjeta inclinada; la línea guía se detiene en la semana 9 y un chip "En riesgo" aparece al cruzar el límite
- voiceover: "Ves quién empieza a faltar… antes de que sea tarde."
- vo_anchor: «faltar» @ 1.70s; «tarde» @ 3.90s
- duration: 5.5s
- poster: 4.8s
- transition_in: push-slide LEFT 0.5s
- status: outline
- src: compositions/frames/05-tendencia.html
- type: benefit_highlight
- persuasion: Show-don't-tell proof
- beat: curiosity → control
- blueprint: dataviz-countup (Adapt)
- asset_candidates: assets/10-docente-home--GraficaAlertas.png — tarjeta real de la gráfica de alertas, referencia de medidas y tokens (se reconstruye en HTML); assets/avatar-09-ag.svg — avatar abstracto con iniciales
- focal: assets/10-docente-home--GraficaAlertas.png
- roles: GraficaAlertas = supporting (referencia, no se monta como imagen) · avatar-09-ag = supporting (dentro del chip)
- sfx: whoosh-short, sparkle, pop, click-soft
- sfx_cues: 0.10 whoosh-short; 0.95 sparkle; 2.35 click-soft; 3.90 pop
- handoff_in: fondo cielo pastel — capa a pantalla completa, x=0 y=0, scale 1, opacity 1, deriva hacia la izquierda a 12 px/s (sigue del cuadro 4)
- handoff_out: tarjeta de la gráfica — centro x=960 y=430, scale 1, opacity 1, rotationY 0°, quieta (0 px/s) en el último fotograma

narrativeRole: Pasar de "SUSAN pasa lista" a "SUSAN te avisa": el análisis convierte los registros en una alerta a tiempo.
keyMessage: Las faltas se ven venir antes de que sea tarde.

Adapt: se conserva la firma de dataviz-countup (la cifra héroe sobre una gráfica que la cámara recorre); en lugar del anillo, una gráfica de líneas (svg-path-draw) con cabezal de lectura y tooltip en píldora (chart-scrub-readout); el rack focus usa depth-of-field-blur. Sin cursor: la línea guía es el cabezal.
Scene 1 (0.0–0.6s): bajo el push-slide entra una tarjeta blanca (≈ 1100 px de ancho, borde fino, sin sombra) con inclinación 3D suave (rotationY −10°, rotationX 6°) sobre el cielo pastel; dos StatCards se adivinan detrás, desenfocadas. Distribución asimétrica 60/40, tarjeta a la izquierda, 3 capas de profundidad.
Scene 2 (0.6–2.0s): cuando la voz dice «quién empieza a faltar», la línea del grupo 3A se dibuja de izquierda a derecha y la línea de faltas se entrelaza con ella (dos trazos y dos tokens de color); asentamiento largo power3.
Scene 3 (2.0–3.4s): la línea guía vertical se desliza hasta la semana 9 y la píldora del tooltip avanza "Semana 7 · 12 %" → "Semana 9 · 18 %" (solo cambia el texto al cambiar de índice); las StatCards de atrás pasan de 0 a 8 px de desenfoque con atenuación al 70 % y la tarjeta queda nítida.
Scene 4 (3.4–4.4s): en «tarde», la línea punteada del límite de 20 % se enciende y aparece el chip "En riesgo · 4 alumnos" (etiqueta + color de estado, asentamiento suave sin rebote) junto a la cifra "+6 %".
Scene 5 (4.4–5.5s): la tarjeta se endereza a plano (rotationY → 0) entre 4.4 y 4.8 s para entregar el corte; después, quietud. Sin deriva ni respiración.
````

Comprobado con los dos lectores: se parsea sin avisos y su paquete **mide 43 141 bytes** (blueprint dataviz-countup +
svg-path-draw + chart-scrub-readout + depth-of-field-blur, incrustadas porque se mencionan). Queda cerca del límite de
48 KB: una regla más de ~5 KB lo rompería (ver el punto 9 de §1.5).

### 1.5 Trampas que rompen el parseo o el pipeline

1. Encabezado distinto de `## Frame N — Título` (H3, `Beat`, `Cuadro`, `frame` en minúscula): el parser lo acepta, pero
   **`frame-packets` no lo ve** y el cuadro se queda sin paquete. Los números de cuadro deben ser enteros únicos: voz y SFX
   se asocian por número.
2. Cualquier encabezado `##`/`###` que empiece con `Scene`, `Beat` o `Frame` **abre un cuadro nuevo** (y `sync-durations`
   también lo cuenta). Las líneas `Scene N (…)` van como párrafos, nunca como encabezados.
3. Las claves deben ir en la columna 0, con `- ` (no `* `, sin sangría); el parser tolera más, pero `frame-packets` no.
   Clave ASCII (`[A-Za-z_][\w-]*`): `- duración:` no se reconoce. Valor no vacío: `- sfx:` sin nada pasa a la narrativa.
4. Una clave por línea: los valores multilínea se pierden (`voiceover` se colapsa al guardarse). Si una clave se repite,
   gana la última en el parser, pero `frame-packets` (`field()`) toma la primera.
5. `blueprint:` con texto de más (`dataviz-countup (Adapt) — mantener el anillo`) toma todo como id, no encuentra el
   archivo y `frame-packets` **falla para todo el lote**.
6. `- scene: …` dentro de la narrativa sobrescribe el `scene`; cualquier viñeta `- Algo: texto` en la prosa se convierte en
   metadato. Escribe la prosa sin viñetas con dos puntos.
7. `status` fuera de `outline|built|animated` se toma como `outline`. Un cuadro `built`/`animated` sin `src` o sin archivo
   en disco **detiene** `assemble-index`: no ensambles durante la etapa de bocetos (ahí se marca `built` sin HTML).
8. `asset_candidates` se parte en cada `;`, **también dentro de la descripción**: «(medidas; se reconstruye)» crea un
   activo fantasma llamado `se reconstruye)` (comprobado). En las descripciones usa comas. Con subcarpeta
   (`assets/avatars/x.svg`), la ruta se aplana al nombre base y `stage-assets` informa una anomalía no fatal aunque el
   archivo exista (el worker usa la ruta tal como está escrita). Un nombre de archivo con ` - ` (guion entre espacios) se
   corta en el separador.
9. **Límite de 48 000 bytes por paquete** (bloque + blueprint + reglas citadas): si se pasa, `frame-packets` falla. Toda
   mención de un id de regla en el bloque (aunque sea "sin motion-blur-streak") incrusta la receta completa. Pesos en KB en
   §3.2 y §3.3: kinetic-type-beats (29) o logo-assemble-lockup (26) admiten como mucho 1 o 2 reglas pequeñas. Alternativa:
   `blueprint: compose`.
10. `sfx:` con tiempos al estilo v3 (`0.5 typing; 1.55 pop`) se lee como **un solo** nombre inexistente y se descarta. Los
    tiempos van en `sfx_cues` **[conv. v4]**.

### 1.6 Validación rápida (solo lectura)

```bash
# 1) volcado del parseo + tiempos para snapshot (mitades de cuadro y cada corte −0.1/+0.2)
node -e 'import("/root/.claude/skills/product-launch-video/scripts/lib/storyboard.mjs").then(({parseStoryboard})=>{
 const m=parseStoryboard(require("fs").readFileSync("STORYBOARD.md","utf8"));
 for(const f of m.frames) console.log([f.number,f.title,f.src,f.durationSeconds,f.transitionIn,f.status].join(" · "));
 console.log("warnings:",JSON.stringify(m.warnings));
 let t=0;const at=[];for(const f of m.frames){const d=f.durationSeconds||0;at.push(+(t+d/2).toFixed(2));
 if(t>0)at.push(+(t-0.1).toFixed(2),+(t+0.2).toFixed(2));t+=d;}
 console.log("total",t.toFixed(2));console.log("AT="+at.sort((a,b)=>a-b).join(","));});'
# 2) prueba de paquetes sin tocar el proyecto (detecta los >48 KB y los blueprints inexistentes)
node $S/scripts/frame-packets.mjs --project . --storyboard ./STORYBOARD.md --out-dir /tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/pk
```

---

## 2. `SCRIPT.md` y una locución que se pueda sumar después

### 2.1 Formato (lo lee `audio.mjs` → `parseScript`)

````markdown
# SCRIPT — susan-v4

**Voice:** (pendiente) ElevenLabs — voz masculina es-MX (v3: «Antonio»)
**Voice settings:** stability 0.40 · similarity 0.75 · style 0.15
**Voice direction:** Cálida, segura, sin prisa; lanzamiento de producto para docentes.

---

## Line 5 — Quién empieza a faltar (Frame 5)

**Time:** 0.5 – 4.2s (local del cuadro 5)
**Anchor:** «faltar» @ 1.70s · «tarde» @ 3.90s
**Delivery:** Pausa breve tras «faltar»; cierra hacia abajo en «tarde».

    Ves quién empieza a faltar… antes de que sea tarde.
````

Reglas del parser **[código]**: una línea se abre con un encabezado `##`/`###` que contenga `(Frame N)` (sin importar
mayúsculas); se ignoran las líneas que empiezan con `**` (así que puedes añadir `**Anchor:**` o `**Window:**` sin riesgo);
**solo el texto con sangría de 4 espacios o tabulador** llega al TTS (el texto sin sangría se pierde en silencio). Con
el pipeline de la skill va **una línea por cuadro**: dos líneas con el mismo `(Frame N)` generan dos audios, pero el
ensamblador conserva solo el último. Los cuadros mudos se omiten. `SCRIPT.md` es el texto comprometido; `voiceover` del
storyboard es la guía, y deben coincidir.

### 2.2 Cómo planear los tiempos ahora (video primero, voz después)

- **Ritmo**: ElevenLabs en español rinde ≈ **2.7 palabras/s** (medido en la v3 con «Antonio»: 84 palabras a 2.73 p/s, con
  un rango de 1.69–3.94 por frase; los huecos entre frases fueron de 0.37–2.72 s, con media de 1.22). Planea con
  `segundos de voz ≈ palabras / 2.6` (deja margen) y comprueba la cobertura: 60–70 % de 55 s da **≈ 90–100 palabras en
  total**, de 6 a 20 por cuadro.
- **Presupuesto por cuadro**: `duration ≥ entrada (≥ 0.3–0.5 s, la duración de la transición entrante) + voz + cola
  (≥ 0.6–1.0 s de lectura y respiración)`. La transición entrante tapa los primeros 0.4–0.6 s del cuadro: que la voz no
  empiece ahí.
- **Anclas**: por cada frase, 1 o 2 palabras ancla (sustantivo o cifra acentuada) amarradas a un revelado visual
  (`vo_anchor`). El cuadro se anima con esos tiempos **ahora**; cuando llegue la voz real se coloca la línea para que la
  palabra ancla caiga en su tiempo (`data-start = inicio del cuadro + t_ancla − t_palabra_en_el_audio`). No se estiran
  los cuadros: si una frase real dura más, se ajusta la escena por dentro o se recorta el texto.
- **Frases en pistas, no corridas**: escribe cada `voiceover` como pistas separadas por pausas («Ves quién empieza a
  faltar… antes de que sea tarde»). Cada pista es un revelado.
- **Huecos para SFX**: los golpes (impacto, pop) van en los silencios entre frases; bajo la voz solo van texturas suaves.
- **Escritura para TTS** (lecciones de la v3): cifras con letra cuando importa el tiempo («veinte por ciento»), «Susan»
  en minúsculas (en mayúsculas lo deletrea), evitar palabras que tuercen el acento («sin papeleo» funcionó mejor que «sin
  escribir nada»).
- **Texto en pantalla ≠ locución**: en pantalla, cifras, etiquetas y una palabra clave; nunca la oración narrada (regla
  del worker y lección de la v3).

### 2.3 Sumar ElevenLabs al final (sin romper lo construido)

- **No corras `audio.mjs sync-durations`** en la v4: reescribe cada `- duration:` con la duración exacta del audio y
  desincroniza las animaciones ya construidas **[código]**.
- El pipeline de la skill (`audio.mjs` → `assemble-index`) monta cada voz **al inicio de su cuadro** y con
  `data-duration` = duración del cuadro (si el audio es más largo, se corta), sin ancla. Para amarrar por palabra hay dos
  caminos: (a) el motor de la skill con `--provider elevenlabs` (necesita `ELEVENLABS_API_KEY` y `pip install elevenlabs`;
  **no devuelve tiempos por palabra**) más `$HF transcribe <wav> --model large-v3 --language es` (en la 0.8.134 es el
único modelo multilingüe; los `*.en` y el `small.en` por omisión no sirven para español), y después
  editar el `data-start` de cada `<audio>`; o (b) la máquina de la v3, `generar-voz.mjs` (endpoint `/with-timestamps`,
  alineación por carácter y caché) + `mount-voz.mjs` (ancla por palabra y ducking), descrita en
  `plan/LECCIONES-V3.md` §2.2. Para cualquiera de los dos, la condición es que `vo_anchor` y `**Anchor:**` existan desde ya.
- Subtítulos: `captions.mjs` necesita los tiempos por palabra; sin voz, `captions: skipped` es válido. Aun así, todo el
  contenido se planea arriba de la banda de subtítulos (y ≤ 900 px), por si el destino YouTube los pide después.

---

## 3. Doctrina y vocabulario de movimiento

### 3.1 Doctrina (obligatoria) y núcleo apto para seek

1. **Suave antes que rebote**: `power3.out` por defecto (`expo.out` en llegadas rápidas). Nada de `back.out`,
   `bounce`, `elastic` como estilo: el sobrepaso es una excepción explícita y lúdica.
2. **Revelado secuencial al ritmo de la voz, sobre todo en la segunda mitad**: en t=0 solo entra lo que la voz dice en ese
   momento; cada pieza (línea, tarjeta, cifra) aparece cuando la voz la nombra. Prohibido volcar todo en el primer 25 %.
   Hay tantas ventanas como pistas de voz. Primer movimiento visible ≤ 0.2 s después del inicio del cuadro.
3. **Mejor nada que mal movimiento**: sin respiración en bucle, sin paneo ni empuje lento en la segunda mitad. La única
   vida durante una pausa es una **vibración sutil** (`sine-wave-loop` en amplitud baja, finita) o el interior vivo de un
   SVG (`svg-icon-enrichment`).
4. **Costuras internas con velocidad igualada** (cut catalog, §3.4): se corta en el pico de velocidad y con la misma
   dirección y rapidez a ambos lados.
5. **Núcleo apto para seek**: un solo timeline GSAP pausado; entradas con `fromTo`; nada de `repeat:-1`/`yoyo`
   infinitos, `Math.random`, `Date.now`, `transition` o `@keyframes` de CSS para el movimiento; **nunca una salida** en un
   cuadro que no sea el final (la transición inyectada ES la salida).

Fallas prohibidas: **diapositiva** (volcar y congelar), **salvapantallas** (muchas cosas flotando por su cuenta),
**rebote**. Cuadro quieto deliberado: sí, asignado en `## Video direction` (uno antes del clímax).

Preferencias registradas de la persona dueña que siguen vigentes: **sin cursor** (BRIEF v4), iconos Lucide, sin emojis,
sin rostros reales, es-MX. La v3 había pedido "ninguna rotación de cámara ni tarjetas inclinadas"; el BRIEF v4 pide de
forma explícita una "inclinación 3D suave". Por eso: inclinación de 6–12° como mucho, nada de giro en Z de la cámara, y
enderezar a plano antes de cada lectura importante.

### 3.2 Blueprints por papel narrativo (KB = peso que suman al paquete)

| Papel (`type`) | Blueprints (KB) |
|---|---|
| Hook (`hook`) | kinetic-type-beats (29) · typewriter-reveal (6) · spatial-pan-stations (4) · constellation-hub (7) · cta-morph-press (6; la variante Hook no lleva cursor) · ticker-takeover (3) · fixed-anchor-cycle (9) · prompt-type-submit-generate (18) · cursor-ui-demo ✗ · dataviz-countup (14) · zoom-out-workspace-reveal (14) |
| Problema (`pain_point`) | kinetic-type-beats · spatial-pan-stations · dataviz-countup · overwhelm-surround (6) |
| Presentación (`product_intro`) | kinetic-type-beats · logo-assemble-lockup (26) · cursor-ui-demo ✗ · dataviz-countup · video-text-pivot (3) · spatial-pan-stations · prompt-type-submit-generate · device-surface-showcase (17; variante de flujo por pasos sin cursor) · titlecard-reveal (7) |
| Función (`feature_showcase`) | grid-card-assemble (15) · cursor-ui-demo ✗ · device-surface-showcase · comparison-split (3) · video-text-pivot · dataviz-countup · prompt-type-submit-generate · agent-progress-theater (16) · panel-edit-live-sync (13; solo con caret) · camera-journey (13; la subforma B no lleva cursor) · transcript-scroll-artifact-reveal (11) |
| Beneficio (`benefit_highlight`) | kinetic-type-beats · grid-card-assemble · titlecard-reveal · camera-journey · zoom-out-workspace-reveal · fixed-anchor-cycle · cursor-ui-demo ✗ |
| Prueba social (`social_proof`) | constellation-hub · grid-card-assemble · titlecard-reveal · dataviz-countup |
| CTA (`cta`) | kinetic-type-beats · logo-assemble-lockup · cta-morph-press ✗ (clic con cursor) · titlecard-reveal · constellation-hub (✗ en el colapso por clic) · prompt-type-submit-generate |
| Cierre de marca (`branding`) | kinetic-type-beats · typewriter-reveal · logo-assemble-lockup · ticker-takeover · fixed-anchor-cycle |

Firmas que no se pueden quitar al adaptar: kinetic-type-beats (las palabras cambian en su sitio, en corte) ·
typewriter-reveal (caret que teclea y corrige) · spatial-pan-stations (una cámara recorre estaciones en un lienzo grande) ·
camera-journey (el viaje de cámara cuenta causa → efecto) · zoom-out-workspace-reveal (un solo alejamiento continuo) ·
constellation-hub (nodos en anillo y luego el núcleo) · grid-card-assemble (cascada escalonada a cuadrícula o lista) ·
logo-assemble-lockup (la marca llega a existir) · device-surface-showcase (dispositivo o ventana fijos como héroe con
pantallas que avanzan) · prompt-type-submit-generate (pregunta tecleada → respuesta) · agent-progress-theater (trabajo
visible → recibo que se palomea) · dataviz-countup (cifras y gráficas como héroe, con la cámara que las atraviesa) ·
titlecard-reveal (UN movimiento contenido y quietud) · comparison-split (dos alas con inclinación espejo) ·
overwhelm-surround (acumulación que rodea) · ticker-takeover (opciones que ciclan y luego un choque) · fixed-anchor-cycle
(un ancla inmóvil, lo demás cicla) · video-text-pivot (el video se hace a un lado y entra la cifra). ✗ = depende de un
cursor visible: no se usa en la v4 (BRIEF: sin cursor).

### 3.3 Reglas válidas (las 48 de `$A/rules/`; ningún otro nombre existe)

**Texto**: `hacker-flip-3d` (5) rotación 3D por carácter con glifos que se descifran ·
`vertical-spring-ticker` (5) tragamonedas vertical en una columna con máscara · `counting-dynamic-scale` (5) contador que
crece de escala con el valor (tabular-nums) · `discrete-text-sequence` (6) estados de texto por umbral: tecleo, errata,
borrado · `asr-keyword-glow` (6) brillo, escala y color en palabras clave sincronizados con los tiempos por palabra ·
`3d-text-depth-layers` (6) extrusión 3D con capas de texto desplazadas · `context-sensitive-cursor` (6) caret de tecleo
con parpadeo cuadrado por tiempo · `dynamic-content-sequencing` (8) ventanas de frases calculadas desde un guion ·
`kinetic-beat-slam` (6) frases que golpean sobre un arreglo de beats, con entradas distintas y un final fijo ·
`gradient-text-sweep` (8) degradado que recorre letras fijas (background-clip) · `chromatic-glitch` (10) separación RGB o
rebanadas por hash de tiempo cuantizado · `waterfall-entry` (4) cascada de llegada desde abajo, cada pieza empieza antes
de que se asiente la anterior.
**Datos**: `stat-bars-and-fills` (5) barras (`scaleY`), progreso (`scaleX` o anillo) y estrellas (clip-path) ·
`chart-scrub-readout` (10) cabezal o línea guía que recorre una gráfica ya dibujada con tooltip por índice (en la v4, sin
puntero).
**Cámara**: `coordinate-target-zoom` (7) · `camera-cursor-tracking` (7) cámara fija al caret de tecleo ·
`multi-phase-camera` (7) · `viewport-change` (8) · `3d-camera-flight` (18) · `depth-of-field-blur` (8) (detalle en §3.6).
**Distribución**: `avatar-cloud-network` (6) avatares en una elipse con conectores al centro · `3d-page-scroll` (7)
página como tarjeta 3D inclinada con desplazamiento interno · `center-outward-expansion` (4) del centro hacia afuera ·
`split-tilt-cards` (5) dos tarjetas con rotationY opuesta · `orbit-3d-entry` (6) giran en 3D y se asientan en órbita
(finita) · `ai-tracking-box` (6) esquinas de detección con etiqueta de confianza (recolorear a tokens; el porcentaje debe
ser determinista) · `depth-scatter-assemble` (7) nube 3D que se dispersa y se reensambla · `anchored-layout-expand` (10)
contenedor que crece en un eje con contenido que se reacomoda (sin tweens de width/height).
**SVG**: `svg-icon-enrichment` (7) partes internas vivas de un icono (con `setAttribute('transform')`) · `svg-path-draw`
(5) trazo que se dibuja (`getTotalLength` al montar; anillos girados −90°).
**Ambiente**: `sine-wave-loop` (6) vibración o respiración finita (solo amplitud baja) · `ambient-glow-bloom` (9)
resplandor radial detrás del héroe (opacidad ≤ 0.45) o un barrido de brillo de una sola pasada.
**Transición y respuesta**: `reactive-displacement` (6) el que entra empuja al que sale · `press-release-spring` (7)
presión del botón: compresión y recuperación (el "pulso del botón" del BRIEF) · `physics-press-reaction` (6) clic que
comprime cursor y objetivo (en la v4, solo el objetivo) · `cursor-click-ripple` (6) ✗ · `cursor-drag` (10) ✗ ·
`multi-cursor-choreography` (10) ✗ · `control-target-sync` (10) control y objetivo cambian en el mismo beat ·
`scale-swap-transition` (5) relevo de escala en el mismo centro · `card-morph-anchor` (7) contenedor que cambia de
tamaño, radio y superficie y revela el destino · `theme-crossfade-morph` (9) cambio de tema completo bajo un ancla fija ·
`spring-pop-entrance` (6) entrada canónica (asentamiento suave; sobrepaso solo si es lúdico) · `motion-blur-streak` (16)
desenfoque de velocidad direccional en llegadas rápidas · `particle-burst` (9) partículas balísticas deterministas (≤ 40) ·
`nudge-curve` (2) deslizamiento lento-rápido-lento de un grupo.
**Recetas**: `gsap-effects` (6) bloques GSAP listos (tecleo, visualizador) · `css-marker-patterns` (5) subrayado, círculo,
estallido, garabato o contorno trazados.

### 3.4 Costuras dentro del cuadro (`$S/references/cut-catalog.md`; el worker las construye y **no** son `transition_in`)

| Técnica | Cuándo | Números |
|---|---|---|
| zoom-through | cambio de estado (gancho → contexto) | salida 0.2 s: escala 1→1.2, desenfoque 0→10 px (texto) o 18–20 px (superficie completa), `power3.in`, opacidad 1→0.15 lineal en un tween aparte · corte con `tl.set` · entrada 0.5 s: 0.75→1, desenfoque 10→0, `expo.out` |
| zoom-through inverso | llegada o remate | salida 1→0.8; entra en 1.25→1 |
| cut-the-curve | escena → escena; idea sin terminar | misma dirección; `power4.in`/`power4.out`, mismo recorrido (±230 px) y duración (0.3 s); el desvanecimiento termina al 25–30 % del trayecto; recorridos parciales, nunca fuera de pantalla |
| waterfall | texto → texto | por palabra: salida −230 px en 0.34 s `power4.in` + desvanecimiento de 0.18 s, escalonado de 0.022 s; entrada +230→0 en 0.3 s con huecos que se encogen (0.05 × 0.84ⁿ); fija todas las palabras de antemano |

El desenfoque va en el envoltorio, nunca en los hijos; nunca dos textos visibles en un zoom-through; nada de zoom-through
sobre texto corrido.

### 3.5 `transition_in`: el registro inyectable (`$S/scripts/lib/transitions.json`; solo estos cinco)

| Nombre | Energía | Duración por omisión | Qué hace | Carácter |
|---|---|---|---|---|
| `crossfade` | any | 0.5 s | disolución de opacidad `power2.inOut` | **suave**, neutra: mismo mundo visual |
| `blur-crossfade` | calm | 0.6 s | disolución con desenfoque de 10 px y escala 1.03/0.97 | **suave**: esconde el choque cuando los fondos difieren |
| `push-slide LEFT\|RIGHT\|UP\|DOWN` | medium | 0.5 s | el saliente se va todo un lienzo (1920 px) y el entrante empuja desde el lado opuesto, `power3.inOut`; `LEFT` = todo se mueve a la izquierda | **rítmica**: "siguiente punto", corridas de tarjetas |
| `zoom-through` | high | 0.4 s | el saliente escala 2.5 + desenfoque 8 px `power3.in`; el entrante 0.5→1 `power3.out` | **enérgica (punchy)**: cambio de sección |
| `squeeze` | medium | 0.4 s | el saliente se comprime en X hacia la izquierda y el entrante se expande desde la derecha | **enérgica y mecánica**, fría |

Sintaxis: `tipo [DIR] [N s]` (por ejemplo `push-slide LEFT 0.45s`; la duración máxima es 2.0 s). Un nombre desconocido
se reemplaza por `blur-crossfade` con un aviso: no falla, pero no es lo que pediste **[código]**. Las demás transiciones
del catálogo compartido (iris, persianas, luz, glitch, whip…) **no se inyectan**: si se quieren, se construyen dentro de
los cuadros como costura o se resuelven con un `handoff`.
Mecánica **[código]**: "extender solo el saliente". El inicio de los cuadros no se mueve (la voz, los SFX y los subtítulos
siguen en su sitio); el saliente se alarga `dur` segundos y **se queda congelado en su último estado** mientras el
entrante (que empieza en T = su inicio) aparece encima. Consecuencias: (1) los primeros `dur` segundos de cada cuadro
pasan bajo la transición, así que no pongas ahí lecturas ni palabras ancla; (2) un match cut entre cuadros se hace con
`transition_in: cut` (o un `crossfade 0.2s`) más `handoff_out`/`handoff_in` con números idénticos.
Receta v4 (suave, rítmica, profesional): una primaria al 60–70 % (`push-slide LEFT 0.5s` para la corrida de la demo, o
`blur-crossfade` cuando cambia el fondo), 1 o 2 acentos (`zoom-through` en los cambios de sección problema → producto →
análisis) y `blur-crossfade` o `crossfade` de 0.6 s para el cierre. Una sola dirección en toda la película (hacia la
izquierda), y las costuras internas siguen esa dirección (cut-the-curve hacia la izquierda).

### 3.6 Cámara: técnicas y qué es apto para seek

| Técnica | Mecanismo | Restricciones duras | Seek |
|---|---|---|---|
| `viewport-change` | un solo envoltorio `.world` con `translate(x,y) scale(S)`; objeto `cam` + `applyCamera()` como único escritor; contra-traslación `T = −offset × S` | `overflow:hidden` y el fondo en `.scene` (no en `.world`); `transform-origin:50% 50%`; maquetar el mundo a 1× y **abrir acercado** (nunca escalar hacia abajo a 0.1–0.25: el texto queda ilegible); medir el objetivo una vez, después de `fonts.ready` | sí, con un `fromTo` inicial + `applyCamera()` al montar |
| `coordinate-target-zoom` | el exterior escala y el interior traslada (`T = −offset`) | escala y traslación con la misma duración y ease en la misma posición; offset medido una vez y fijado; el objetivo ≤ ~88 % del lienzo en el pico | sí |
| `multi-phase-camera` | fases (alejar → enfocar → empujar) más una micro-deriva sinusoidal finita (relación de frecuencias ≈ 1.3) | la cámara envuelve TODO; un solo escritor; el héroe se revela después del primer alejamiento | sí (deriva finita, nunca en la segunda mitad como "vida") |
| 3D / perspectiva (`3d-camera-flight`, `split-tilt-cards`, `3d-page-scroll`, `orbit-3d-entry`) | `perspective` (800–1200 px) en un `.stage` estático, `preserve-3d` en `.world`, orden `translate3d → rotateX → rotateY`; una tarjeta inclinada = `rotationX/Y` en la tarjeta | **nada de `filter`, `opacity < 1`, `overflow`, `clip-path` ni `mask` en `.world` ni en los envoltorios intermedios** (aplanan el 3D): el DoF va en las tarjetas hoja y los fundidos en los hijos; \|rx\| ≤ 65°, \|ry\| ≤ 30° (v4: 6–12°); se lee en las llegadas, casi en plano; `data-layout-allow-overflow` en `.world` | sí; poses fijadas, la primera etapa con `fromTo` |
| Rack focus (`depth-of-field-blur`) | `filter: blur(var(--dof))` + atenuación por capa; se interpola `--dof` en el timeline | desenfocar capas chicas o agrupadas, ≤ ~24 px en superficies grandes; la atenuación hace la mitad del trabajo; el foco en 0 y por encima (z-index); `will-change: filter` solo mientras anima; **volver a nitidez antes de entregar el corte** | sí |
| `motion-blur-streak` / motion blur | desenfoque o estela direccional que culmina en la velocidad máxima | solo en 1 a 3 golpes (llegada, barrido); nunca en texto que se debe leer; no en derivas lentas | sí |

Pruebas: `$HF keyframes . --selector "<sel>" --shot /tmp/…png` y `$HF snapshot . --at …` en las poses clave y en la
final. Medir con `getBoundingClientRect` **solo una vez al montar** (después de `fonts.ready`, y registrando el timeline
después). En una composición de muchas escenas conviene fijar constantes iguales al CSS: nunca medir durante el tween.

### 3.7 Lenguaje de la referencia → vocabulario válido

Enfoques con desenfoque → `depth-of-field-blur` · tarjetas con inclinación 3D suave → `split-tilt-cards`, la inclinación
estática de `3d-page-scroll` o un vuelo corto de `3d-camera-flight` que se endereza · fondo de cielo pastel y tarjeta
holográfica → capa de fondo propia (clip) + `ambient-glow-bloom` (barrido) o `gradient-text-sweep` · gráfica de líneas
entrelazadas con guía y tooltip en píldora → `svg-path-draw` + `chart-scrub-readout` (la guía hace de cabezal, sin
cursor) · barras finas con un bloque resaltado y tooltip inclinado → `stat-bars-and-fills` + `depth-of-field-blur` sobre
las barras no resaltadas · panel tipo teléfono con lista de movimientos → `device-surface-showcase` (variante sin cursor) o
la lista acumulativa de `grid-card-assemble` · cifras grandes con variación porcentual → `counting-dynamic-scale` · pulso
de botón → `press-release-spring`. Antes de construir a mano un look con nombre: `$HF catalog --query "<look en inglés>"
--json` (por ejemplo "rack focus depth of field", "holographic card shimmer", "line chart tooltip"); si un bloque sirve, va
en `focal` y se instala antes del dispatch.

---

## 4. Contrato del worker (lo esencial)

**Entrada**: `_role.md` + su paquete (`.hyperframes/frame-packets/<frame_id>.md`) + `frame.md` + el contexto del
dispatch. El worker **no** abre `STORYBOARD.md` ni las skills. **Salida**: solo `compositions/frames/<frame_id>.html`; no
toca el storyboard, no crea audio y no corre la CLI (lint y check validan el proyecto ensamblado, y su falso verde no
cuenta).

Forma del archivo (esqueleto mínimo):

```html
<template>
<style>
@font-face{font-family:"Hanken Grotesk";font-weight:400 700;font-display:block;src:url("assets/fonts/HankenGrotesk-var.woff2") format("woff2");}
#root{position:absolute;inset:0;overflow:hidden;font-family:"Hanken Grotesk",sans-serif}
[id="05-tendencia-bg"]{position:absolute;inset:0;background:/* token canvas de frame.md, en hex */}
</style>
<div id="root" data-composition-id="05-tendencia" data-start="0" data-duration="5.5" data-width="1920" data-height="1080">
  <div id="05-tendencia-bg" class="clip" data-start="0" data-duration="5.5" data-track-index="0"></div>
  <div id="05-tendencia-world"><!-- contenido animado: SIN atributos de tiempo -->
    <div id="05-tendencia-card">…</div>
  </div>
</div>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<script>
  (function () {
    var tl = gsap.timeline({ paused: true });
    var card = document.getElementById("05-tendencia-card");
    tl.fromTo(card, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, 0.1);
    // …una fase por Scene, cada revelado en su tiempo de voz…
    window.__timelines["05-tendencia"] = tl;   // registrar AL FINAL (también si se construye dentro de fonts.ready)
  })();
</script>
</template>
```

- **Un solo fragmento `<template>…</template>`**: sin doctype, `<html>`, `<head>` ni `<body>`. Todo `<style>` y todo
  `<script>` (incluida la carga de GSAP) **dentro** del template; lo de afuera se descarta y el cuadro sale sin estilos.
- La raíz lleva `data-composition-id` = `frame_id` (el basename de `src`). **Se estiliza con `#root`, nunca con una clase**
  (con una clase se renderiza sin estilos, aunque Studio se vea bien). `width/height:100%`, nunca 1920px fijos en `#root`.
  Si faltan `data-width`/`data-height`, el ensamblador los inyecta **[código]**.
- **Ids y clases con el prefijo `<frame_id>-`**. Como el prefijo empieza con un dígito, `#05-tendencia-card` no es un
  selector válido ni en CSS ni en GSAP: usa `[id="05-tendencia-card"]`, `getElementById`, o escapes CSS
  (`#\30 5-tendencia-card`; la v3 usaba `.\0000304-intro-…`).
- **Un timeline pausado**, registrado en `window.__timelines["<frame_id>"]` cuando ya está completo. Nunca `tl.play()`,
  nunca anidar los timelines a mano (el runtime lo hace).
- **Fondo a pantalla completa en una capa `class="clip"`** que dura todo el cuadro, en la pista más baja; **nunca** como
  `background` del `#root` (la raíz se recorta a su ventana de tiempo y el contenido oscuro cae sobre el `body` negro).
- Todo `class="clip"` lleva `data-start`, `data-duration` y `data-track-index`. Todo elemento con esos tres atributos y sin
  `class="clip"` **detiene el ensamblado**, igual que dos clips que se traslapan en la misma pista **[código]**. Lo que
  anima GSAP durante todo el cuadro no lleva atributos de tiempo. Nunca se interpolan `display`, `visibility` ni
  `autoAlpha` sobre un `.clip`: se anima un hijo.
- **Sin `<audio>`** (lo monta el orquestador). Un `<video>` solo si está aprobado: `data-frame-video="approved"` + tiempos +
  `data-frame-video-x/y/width/height` numéricos (el ensamblador lo sube a la raíz); cualquier otro medio detiene el
  ensamblado.
- **Duración fija** (`duration` del paquete): no se estira ni se rellena. Cuando hay transición saliente,
  `transitions.mjs` alarga la raíz y los clips de cola del archivo; el worker no se preocupa por eso.
- **Sin salidas** salvo en el cuadro final (fundido a `canvas` en sus últimos ~0.3 s). Entradas con `fromTo` (nunca un
  estado oculto por CSS). El héroe es visible antes de t ≤ 0.5 s.
- **Sin precarga visual**: cada Scene es una fase del timeline y cada revelado cae en su tiempo de voz (`vo_anchor`). La
  firma del blueprint debe reconocerse. Cada movimiento nombrado se reproduce desde la receta incrustada: no se adivina por
  el nombre.
- **Nada de CSS `transform` en un elemento al que GSAP le anima `x`, `y`, `scale` o `rotation`**
  (`gsap_css_transform_conflict`): se centra con flex o `inset`, o se usan `xPercent`/`yPercent` o `fromTo`.
- **Solo transforms y opacidad** para mover cosas; nunca `top`, `left`, `width`, `height`, `margin`, `fontSize`,
  `letterSpacing` ni `roundProps` (tiemblan a baja velocidad). `filter`, `clipPath`, trazos SVG y variables CSS sí se
  permiten.
- **Determinismo**: nada de `Math.random`, `Date.now` o `performance.now`, eventos ni red en tiempo de render; las
  variaciones salen del índice; las repeticiones son finitas.
- **Banda reservada**: el contenido importante va en el 83 % superior (y ≤ 900 px), aunque no haya subtítulos. Los fondos
  a pantalla completa sí ocupan todo.
- **Texto visible**: copy corto de motion graphics (cifra, etiqueta, palabra clave), en es-MX, sacado del `scene` o de la
  narrativa; nunca la frase de la locución y nunca palabras tomadas de `frame.md`. Estados: siempre etiqueta + color.
- **Fuentes y activos**: rutas relativas a la raíz del proyecto (`assets/fonts/…`, `assets/…`), nunca `../`; cada familia
  con su `@font-face` **en el mismo archivo** hacia un `.woff2` que exista (en `assets/fonts/` hay HankenGrotesk-var,
  HankenGrotesk-Regular, EBGaramond-{Regular,Italic,Regular-Italic}, GeistMono-{var,Regular}); el render no tiene
  fuentes del sistema. Iconos: los SVG Lucide de `assets/icons/` (no se dibujan a mano).
- **Handoffs**: `handoff_in`/`handoff_out` son contrato duro: posición, escala, opacidad, dirección y velocidad exactas en
  el límite. El cuadro vecino lo construye otro worker con los mismos números.
- **Boceto confirmado** (`storyboard.html#frame-NN`): se conserva la composición (ubicación, jerarquía y copy) y se
  "viste" (activos reales y movimiento). No se redibuja.
- **Autorrevisión** (códigos de lint que puede devolver el orquestador): `missing_template_wrapper`,
  `missing_composition_id`, `subcomposition_root_styled_by_class`, `clip_missing_data_attrs`, `timeline_not_paused`,
  `timeline_not_registered`, `gsap_timeline_registered_before_async_build`, `css_transition_used`,
  `gsap_css_transform_conflict`, `gsap_animates_clip_element`, `exit_animation_on_non_final_scene`,
  `font_family_without_font_face`, `gsap_non_transform_motion`, `gsap_infinite_repeat`.

**Rendimiento y advertencias de render**:
- El costo del desenfoque crece con el radio × el área. Desenfoca capas chicas, con ≤ 24 px en superficies grandes y
  `will-change` solo en lo que anima. No juntes un desenfoque interno pesado con una transición `blur-crossfade` o
  `zoom-through` (que desenfocan el cuadro completo) en el mismo instante **[recomendación]**.
- `backdrop-filter`: ninguna skill lo cubre como movimiento seguro. Si se usa para un panel de vidrio, que sea estático,
  pequeño y no se anime; la opción preferida es un relleno translúcido más una copia desenfocada horneada
  **[recomendación]**. Verifícalo siempre en `snapshot`.
- 3D: un `filter`, una opacidad < 1 o un `overflow` en un envoltorio aplana el `preserve-3d`.
- Muchas capas: un solo tween con `stagger` es mejor que N tweens; el escalonado de un grupo dura ≤ ~0.5 s.
- Render: lee la segunda línea del resumen. `screenshot capture · software gpu` en Linux es la ruta lenta. Cada worker
  arranca un Chrome de ~256 MB. `--browser-timeout` sirve para composiciones pesadas. GSAP se carga desde jsDelivr (en el
  índice y en cada cuadro), así que el render necesita red o una copia local.
- Un error de lint apaga las auditorías de layout y contraste (`0 samples` no significa que esté limpio). Si el id del
  anfitrión no coincide con el interno, el render espera 45 s por escena y saca fotogramas estáticos.

---

## 5. Secuencia de comandos, del paso 3 al 6 (desde `$P`)

**Paso 3: Storyboard y guion** (sin CLI). Escribe `STORYBOARD.md` (§1) y `SCRIPT.md` (§2) y valida con §1.6. Presenta la
propuesta en el chat: «Este video le dice a [audiencia] que [mensaje]», una tabla de cuadros (cuadro · beat (tipo,
duración) · en pantalla · por qué) y dos preguntas: (a) ¿se aprueba o qué cambia?, (b) ¿bocetos primero (recomendado) o
construir directo? Itera hasta la aprobación.

**Paso 3.1: Audio** (v4 fase 1). Sin voz y sin música: `music: none`. **No** corras `audio.mjs` (modo generate) mientras
exista `SCRIPT.md`, porque intentaría sintetizar la voz. La voz se suma en §5-bis.

**Paso 4: Bocetos y diseño visual.**
1. Hoja `storyboard.html` en la raíz (storyboard-recipe §3): encabezado con versión (`v1`), una línea de entrada y una
   etiqueta (`1920×1080 · 55 s · N cuadros`); una cuadrícula de 3 columnas de celdas 16:9 (`aspect-ratio:16/9`,
   `container-type:inline-size`, medidas en `cqw`) en orden; cada celda con `id="frame-NN"` y el momento clave dibujado con
   las palabras, fuentes y colores reales y bloques lisos donde irán paneles, gráficas y medios; una fila de etiqueta
   (`NN · NOMBRE` / `id · inicio–fin`), una nota (qué se mueve primero y hacia dónde va la costura) y un chip con la
   costura; al final, una celda con el mapa de costuras y otra con los tokens y prohibiciones. **Sin scripts, sin
   movimiento, sin activos externos** (`@font-face` local); debe abrir desde `file://`. Marca cada cuadro `built` y pregunta
   una sola cosa: ¿está bien la hoja o qué cuadros cambian? Revisa solo los que se nombren y sube la versión.
2. Enriquece `STORYBOARD.md` en su lugar: `## Video direction`, y por cuadro `blueprint (Reproduce|Adapt)|compose`,
   `focal`, `roles`, `sfx`, `sfx_cues`, `handoff_*` y las líneas `Scene` con tiempos (diseño y movimiento en línea, sin px,
   ms ni ease). No cambies la historia, la voz, los activos ni `transition_in`.
3. Busca en el catálogo los looks con nombre: `$HF catalog --query "<look in English>" --json`.
4. Prepara los activos: `node $S/scripts/stage-assets.mjs --storyboard ./STORYBOARD.md --hyperframes .` (copia
   `capture/{assets,assets/videos,assets/svgs,screenshots}/<nombre>` → `assets/<nombre>`; nunca sobrescribe y una
   ausencia es solo una anomalía).

**Paso 5: Cuadros.**
1. Bloques del catálogo (una vez, antes del dispatch): `for b in <bloques>; do $HF add "$b"; done` (se instalan en
   `compositions/`, según `hyperframes.json`).
2. Paquetes: `node $S/scripts/frame-packets.mjs --project "$P" --storyboard "$P/STORYBOARD.md"` → escribe
   `.hyperframes/frame-packets/<frame_id>.md` + `_role.md` (**los sobrescribe**). Falla si falta `src`, si el blueprint no
   existe o si un paquete pasa de 48 KB.
3. Dispatch: un sub-agente por cuadro, en paralelo (u olas si hay tope). Su prompt = el contenido completo de `_role.md`
   + el de su paquete (o las dos rutas para que las lea primero) + este bloque, copiado tal cual:
   ```
   ## Dispatch context
   - PROJECT_DIR: /home/user/susan/video/susan-v4
   - frame_id: 05-tendencia   (archivo: compositions/frames/05-tendencia.html)
   - Confirmed sketch: storyboard.html#frame-05 (sí|no)
   - Canvas: 1920×1080 · Captions: disabled (keep-out igual: contenido ≤ 900 px)
   - Cut catalog: /root/.claude/skills/product-launch-video/references/cut-catalog.md
   - Video direction (extracto): <paleta por rol, gramática, prohibiciones>
   - Reglas del repo: iconos Lucide (assets/icons), sin emojis, sin cursor, sin rostros reales, es-MX, datos demo coherentes
   ```
   Espera a que **exista el archivo** (no basta el aviso de "terminado"); si falta, se re-despacha una vez con el mismo
   prompt. Por cada archivo que llega, el orquestador cambia `- status: animated`.
4. SFX (camino de la skill): `node $S/scripts/audio.mjs fetch-sfx --storyboard ./STORYBOARD.md --hyperframes .` →
   **reescribe** `audio_meta.json` desde `audio_engine_meta.json` (pierde las ediciones manuales) y copia los archivos a
   `assets/sfx/` (no pisa los existentes; si difieren, escribe `-2`). Todos los cues quedan con `offset_s: 0` y uno por
   nombre en cada cuadro. Después, edita `audio_meta.json` → `sfx[]` (`{frame, file, offset_s, duration_s, volume}`) con
   los tiempos de `sfx_cues`, duplicando entradas para los repetidos. Sin credencial de HeyGen usa la biblioteca local
   (Apéndice B). Para sincronía fina (anclas, polifonía, techo de pico) está la máquina de la v3 (`mount-sfx.mjs`,
   LECCIONES-V3 §2.2), que reescribe su propio bloque `<!-- sfx:start/end -->` en `index.html`. Hay que adaptarla antes de
   usarla: tiene rutas fijas y espera el índice del `build-index.mjs` de la v3 (LECCIONES-V3 §2.3). Iría **después** de
   assemble e inject, y se vuelve a correr cada vez que se reensambla.
5. Ensamblado: `node $S/scripts/assemble-index.mjs --storyboard ./STORYBOARD.md --hyperframes .` → **reescribe
   `index.html` completo**: cuadros en la pista 1 con inicios acumulados, voz en la 10, BGM en la 11, subtítulos en la 2,
   SFX en la 20+i, el fondo `canvas` de `frame.md` en `#root` y `__timelines["main"]`. También repara en su lugar los
   cuadros sin dimensiones. Se detiene si algo viola los guardas (§4) y avisa si la duración se desvía más de 10 %.
   Subtítulos (solo con voz): `node $S/scripts/captions.mjs build --storyboard ./STORYBOARD.md --audio-meta
   ./audio_meta.json --hyperframes . --out ./caption_groups.json`, **antes** de ensamblar.

**Paso 6: Cierre.**
```bash
node $S/scripts/transitions.mjs inject --storyboard ./STORYBOARD.md --hyperframes .   # índice + archivos de cuadro (alarga la raíz y los clips de cola)
node $S/scripts/transitions.mjs verify --storyboard ./STORYBOARD.md --index ./index.html
$HF lint                       # rápido; corrige todos los errores antes de check
$HF check                      # gate final (= npm run check); --snapshots escribe cuadros anotados y recortes por hallazgo
$HF snapshot . --at "$AT"      # AT = la línea que imprime §1.6; también arma la hoja de contacto en snapshots/
$HF preview --background --port 3017 && $HF preview --status   # entregar http://localhost:3017/#project/susan-v4
# ...una pregunta: ¿render ahora o qué cambia? Solo con aprobación:
$HF render --quality draft --fps 30 --output renders/susan-v4-draft.mp4          # iteración
$HF render --quality high --fps 60 --output renders/susan-v4.mp4                  # final (60 fps suaviza los push de 1920 px; tarda el doble)
ffprobe -v error -show_entries format=duration:stream=width,height,r_frame_rate -of default=nw=1 renders/susan-v4.mp4
$HF preview --stop             # al terminar la revisión
```
Revisa en la hoja de contacto las mitades de cuadro (layout) y cada par de corte (−0.1/+0.2): el elemento que continúa debe
conservar la posición, escala, opacidad y dirección prometidas. Si un comando falla, muestra el stderr, haz el arreglo más
barato en `compositions/frames/NN-*.html` y vuelve a correr **solo** lo que falló. `--fps`: 24/25/30/50/60 (por omisión,
`data-fps` de la raíz o 30); `--quality`: draft/looks/delivery (= high). Al entregar, da la ruta del MP4, la duración real,
la hoja de contacto y los ids de cuadro.

**§5-bis Sumar la voz después**: genera las tomas (§2.3, camino a o b) → coloca cada `<audio>` por ancla → con BGM, carve o
ducking (`/hyperframes-audio`) → `captions.mjs` si hay subtítulos → `assemble-index` (si usaste el camino de la skill) →
`transitions inject` → `check` → `snapshot` → vista previa. **No** corras `sync-durations`.

**Qué sobrescribe cada comando y cuándo repetirlo**

| Comando | Escribe | Idempotente | Notas |
|---|---|---|---|
| `build-frame.mjs` | `frame.md`, `.hyperframes/caption-skin.html`, fuentes | sí (pisa) | perder `frame.md` a mano = rehacer los ajustes |
| `stage-assets.mjs` | `assets/<nombre>` | sí (la primera copia gana) | no busca en `capture/app-real/` |
| `frame-packets.mjs` | `.hyperframes/frame-packets/*` | sí (pisa) | volver a correrlo si cambia el storyboard |
| `audio.mjs fetch-sfx` | `audio_meta.json`, `audio_engine_meta.json`, `audio_request.json`, `assets/sfx/*` | pisa `audio_meta.json` | rehacer la edición de `offset_s` después |
| `audio.mjs` (generate) | lo mismo + `assets/voice/*.wav` | — | `music: none` + sin `SCRIPT.md` → **borra** `audio_meta.json` |
| `audio.mjs sync-durations` | `STORYBOARD.md` (`- duration:`) | — | **no en la v4** |
| `assemble-index.mjs` | `index.html` (completo), `assets/`, raíz de los cuadros (dimensiones), `*.loop.mp3` | sí | **borra** las transiciones inyectadas y cualquier edición manual del índice |
| `transitions.mjs inject` | `index.html` + archivos de cuadro | **NO** sobre un índice ya inyectado (duplica tweens y alarga dos veces) | siempre `assemble-index` → `inject`, en ese orden |
| `snapshot` / `check --snapshots` | `snapshots/` | sí | ignorado por git |
| `render` | `renders/…` | — | sin `--output`, usa un nombre con marca de tiempo |

Orden canónico ante cualquier cambio: (cuadro editado) → `assemble-index` → `inject` → `verify` → `check` → `snapshot`.

---

## Apéndice A: presets de `frame.md` (`/root/.claude/skills/hyperframes-creative/frame-presets/<nombre>/`)

- `biennale-yellow`: catálogo editorial con fondo pergamino, una tinta índigo, amarillo solar como resplandor, Instrument
  Serif + Archivo, sin esquinas redondeadas ni sombras.
- `blockframe`: neobrutalista maximalista, bordes negros de 4 px, sombras duras desplazadas y cinco pasteles caramelo en
  Inter 900 mayúsculas.
- `blue-professional`: sobriedad de consultoría, lienzo crema con un solo acento cobalto, tarjetas teñidas sin sombra,
  cromo en píldora y Space Grotesk + Inter. Es la base del `frame.md` de la v3.
- `bold-poster`: póster editorial populista, Shrikhand inclinada, Baskerville, solo cuatro colores y bordes dobles.
- `broadside`: póster de protesta en negro y naranja fuego, Barlow 900 en minúsculas gigantes e IBM Plex Mono.
- `capsule`: editorial lúdico donde todo es píldora con contorno de 2 px, lienzo crema, nueve acentos caramelo y Bodoni +
  Space Grotesk.
- `cartesian`: catálogo de museo, retícula de líneas finas topo, cinco tonos de piedra cálida, Playfair + Inter, sin
  sombra.
- `cobalt-grid`: risografía modernista en crema y cobalto con papel milimétrico permanente, Newsreader + **Hanken
  Grotesk** + DM Mono, a 0°.
- `code-editorial`: libro de marca cálido, papel crema, coral terracota escaso, EB Garamond + Inter + JetBrains Mono y una
  superficie de código.
- `coral`: revista audaz con coral, negro y crema en bordes duros, rayado a 45° y Bebas Neue.
- `creative-mode`: neobrutalista editorial en crema, bordes de 4 px, sombras duras, Archivo Black y JetBrains Mono.
- `daisy-days`: libro ilustrado alegre, contornos de 3 px, pasteles de jardín, Fredoka y ornamentos dibujados a mano.
- `editorial-forest`: editorial literario en verde, rosa y crema, Source Serif 4 + JetBrains Mono, papel plano.

(`build-frame.mjs` cambia los colores y las familias del preset por los tokens de `capture/extracted/tokens.json`: Hanken
Grotesk y EB Garamond si están ahí. Cada preset trae `frame-showcase.html` para verlo, y nunca se incluye en el proyecto.)

## Apéndice B: SFX de la biblioteca local (nombres válidos en `sfx:` sin HeyGen)

`chime` (2.5 s) · `click-soft` (0.37) · `click` (0.37) · `error` (1.62) · `glitch-1` (2.64) · `glitch-2` (3.5) ·
`glitch-3` (3.1) · `impact-bass-1` (2.12) · `impact-bass-2` (2.59) · `key-press` (0.4) · `notification` (2.46) · `ping`
(1.32) · `pop` · `riser` · `sparkle` · `typing` · `whoosh-cinematic` · `whoosh-short` · `whoosh`. Volumen por omisión:
0.35. En `assets/sfx/` ya están los SFX de la v3 (`CATALOG.json`, `derived/`, `baked/`, `riser-1s.mp3`…), que usa la
máquina de la v3.
