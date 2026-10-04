---
format: 1920x1080
duration: 56s
message: "Pasa lista en segundos y entiende la asistencia de tus grupos"
arc: "PAS + Demo Loop: Hook → Pain → Pain → Product intro → Demo (cámara, vivo, revisión, reportes, analítica, alumno) → Trust → CTA"
audience: "docentes, alumnos y coordinación académica de la UNACH FCA C-I"
mode: autonomous
music: none
---

## Video direction

**Palette system (from `frame.md`, never invented).** Cream canvas `bg` on every frame; white cards with the hairline `border` and NO shadow; ink `text` for headlines; ONE accent, `primary` blue, for the accent word / key number / cursor highlight; state colors only where a state is being told (positive = presente, warning = retardo / en el límite, negative = ausente / sin derecho, info = justificado), always with a text label. The soft pastel gradient (`gradient-a` → `gradient-b` → `gradient-c` → `gradient-d`) with film grain appears ONLY on three hero moments (frame 4 intro, frame 12 close, a glow on frame 5's "listo") — never as a decorative wallpaper elsewhere.

**Motion grammar.** Two lenses of reference, both product-launch pieces: (1) big typography that types itself with a blinking caret and swaps an accent word; (2) reconstructed UI driven by a visible cursor, with the camera pushing into the detail being discussed. Long-tail eases (`power3.out` default; smooth over bouncy), springs only for chips / badges (`spring-pop-entrance`) and button presses (`press-release-spring`). Camera = scale/translate of a `.world` wrapper (`viewport-change`, `coordinate-target-zoom`), never `width/height` tweens. Every reveal lands on its Scene time — nothing is on screen before its Scene window (no front-loading), reveals keep arriving across the back half of each frame, and a frame ends on a held read (stillness beats lazy breathing). Only the final frame has an exit (a fade to cream in its last 0.3 s). Typing cadence is human (hold 60–90 ms per character, one deliberate correction in frame 1).

**Rhythm / held-frame allocation.** Fast cuts overall (3.5–6 s per frame, 56 s total). Frame 3 (the late-faults line) and frame 11 (trust) are the breathers — calmer, one idea each. Frames 5 and 9 are the climaxes (largest motion, camera pushes). Frame 12 lands slow and still.

**Scale.** Everything is authored for 1920×1080: hero lines 150–230 px, UI labels 26–30 px, UI numbers 64–120 px (see the kit in `frame.md`). Keep important content above y = 1000 (no captions in this film, but keep a quiet bottom margin).

**Copy.** All on-screen text is Spanish (México), short motion-graphics copy — a hero line, a number, a chip. Demo data is plausible and consistent: group 3A "Administración Financiera", docente Patricia Ortega, 24 inscritos, limit 20 %.

**Negative list.** No photographs or realistic faces (the facial recognition is dramatized with abstract avatars: pastel circles with initials and detection brackets). No emojis (Lucide-style stroke icons only). No stock UI chrome (browser bars, nav bars) unless the Scene asks for the app's own pieces. No purple "AI" bokeh. No PowerPoint dump (everything arriving at t = 0 then frozen) and no screensaver (many things floating independently). No exits on non-final frames. No text from this file's prose rendered as visible copy: only the quoted copy in each Scene.

**Sound.** The film has NO voice and NO music; sound effects only, mounted at the root by the orchestrator (frames never contain `<audio>`). The `sfx:` line of each frame is the cue sheet the orchestrator mounts: `time-in-frame sfx-name`.

---

## Frame 1 — Hook

- scene: A caret types "Pasar lista te roba cada clase." on a bare cream field
- duration: 4.5s
- poster: 3.4s
- transition_in: cut
- status: outline
- src: compositions/frames/01-hook.html
- type: hook
- persuasion: Pain validation
- beat: recognition → tension
- blueprint: typewriter-reveal (Adapt)
- sfx: 0.5 typing; 1.55 typing; 2.55 key-press; 3.0 typing; 3.95 click-soft

narrativeRole: Name the everyday pain in one typed line so the viewer feels seen before any product appears.
keyMessage: Pasar lista te roba tiempo de clase.

Adapt: keep the typewriter signature (a live caret that types, edits and holds); the payoff is not a brand pop but the accent phrase highlighted, then the cut to the numbers.
Scene 1 (0.0–0.5s): bare cream field; a small blue caret blinks at the left-third, vertically at ~0.42 of the height; a soft blue→violet haze blooms in the lower-right corner and holds (ambient-glow-bloom). Layout: left-aligned text block, ~70% of the width, generous margins.
Scene 2 (0.5–2.6s): the caret types the first line "Pasar lista te roba" in ink at ~170 px with a human cadence and ONE correction (types a wrong word, backspaces, retypes) via discrete-text-sequence with a context-sensitive-cursor (square-wave blink). Hierarchy: size + weight 700; the caret is the only color.
Scene 3 (2.6–3.9s): the caret drops to a second line and types "cada clase." in the blue accent at the same size; a marker highlight sweep (css-marker-patterns highlight, soft blue 15%) draws under it as the last character lands.
Scene 4 (3.9–4.5s): everything holds still for the read (the caret blinks, the haze stays); no drift.

## Frame 2 — Minutos

- scene: A thin ring fills while "10 min" counts up, multiplies by groups and days, and lands on "2 h 30 / semana"
- duration: 4.5s
- poster: 4.2s
- transition_in: zoom-through
- status: outline
- src: compositions/frames/02-minutos.html
- type: pain_point
- persuasion: Statistical proof
- beat: tension → overwhelm
- blueprint: dataviz-countup (Adapt)
- sfx: 0.2 whoosh-short; 0.3 click-soft; 1.5 pop; 2.1 pop; 3.0 impact-bass-1; 3.05 click

narrativeRole: Quantify the cost of manual attendance so "tiempo de clase" stops being abstract.
keyMessage: Diez minutos por clase se vuelven horas.

Adapt: keep the count-up ring + hero number signature and the push toward one hero metric; one ring (not a stat grid), two multiplier chips, one final metric.
Scene 1 (0.0–1.4s): a thin SVG ring (about 560 px) seated left of center draws on from 12 o'clock (svg-path-draw, 6 px stroke, rounded caps, `bg` track); the hero number inside counts 0 → 10 with "min" small beside it (counting-dynamic-scale, tabular figures); a small timer icon sits above the number and the label "por clase" fades under it. Layout: asymmetric 55/45, ring at the left.
Scene 2 (1.4–3.0s): two multiplier chips spring in one after the other on the right as a vertical stack — "× 3 grupos" then "× 5 días" (spring-pop-entrance, white card chips with hairline border, ink text, blue "×"); the ring takes a soft pulse on each pop. Camera eases a 4% push toward the stack (coordinate-target-zoom, long-tail).
Scene 3 (3.0–4.5s): the ring completes a full turn and its stroke turns warning amber; the hero number slams from 10 to "2 h 30" (counting-dynamic-scale chord, scale up then settle) with the label "a la semana" replacing "por clase"; the chips dim to 40%. Hold the final read.

## Frame 3 — Faltas tardías

- scene: A student's absence bar creeps past the 20% limit and a red "Sin derecho a examen" chip slams in
- duration: 4.0s
- poster: 3.6s
- transition_in: crossfade
- status: outline
- src: compositions/frames/03-tarde.html
- type: pain_point
- persuasion: Pain agitation
- beat: dread → urgency
- blueprint: compose
- sfx: 0.4 pop; 1.5 click-soft; 2.15 error; 2.45 impact-bass-2

narrativeRole: Second pain: absences are noticed when it is already too late. This frame is the breather — calmer, one idea.
keyMessage: Las faltas se notan tarde.

Compose: a headline whose last words swap in place (the motion IS the words changing) while one UI object carries the proof.
Scene 1 (0.0–1.2s): the headline "…y las faltas" types in ink at ~130 px in the upper third, left-aligned; below it a single student row card enters centered (avatar "HM" in pastel, name "Mendoza Ríos Héctor", a pill track with a 16 px bar at the right of the name). Layout: headline upper third, card centered, ~55% of the width.
Scene 2 (1.2–2.4s): the pill fill grows from 6% to 21.6% (stat-bars-and-fills) and passes the dashed limit marker at 20% labelled "Límite 20 %"; the fill turns negative red the instant it crosses; the % figure at the right counts 6.0 → 21.6 (counting-dynamic-scale).
Scene 3 (2.4–4.0s): the headline's last words land in the accent — "se notan tarde." (hard-cut swap, the word "tarde" in negative red); a red "Sin derecho a examen" status chip slams onto the card's corner (spring-pop-entrance, then one quick snap) and the card shakes once. Hold still.

## Frame 4 — Presentamos SUSAN

- scene: The wordmark SUSAN blooms on a grainy pastel gradient with the UNACH shield and a tagline typing under it
- duration: 4.5s
- poster: 3.6s
- transition_in: blur-crossfade
- status: outline
- src: compositions/frames/04-intro.html
- type: product_intro
- persuasion: Authority by association
- beat: relief → curiosity
- blueprint: compose
- asset_candidates: assets/brand/unach-escudo.png — escudo de la UNACH con transparencia, 320x289; assets/brand/fca-escudo.png — escudo de la FCA con transparencia, 309x320
- focal: assets/brand/unach-escudo.png
- roles: unach-escudo = supporting (small, beside the pill, ~120 px tall) · fca-escudo = unused here
- sfx: 0.1 whoosh; 0.9 riser; 1.9 impact-bass-1; 2.0 sparkle; 3.0 pop; 3.2 typing

narrativeRole: Release the tension: name the product with a premium, calm brand moment.
keyMessage: SUSAN, asistencia académica con inteligencia.

Compose: the lockup builds itself (letters cascade, then the supporting marks assemble around the wordmark) on a soft gradient hero moment.
Scene 1 (0.0–0.9s): the field turns from cream into a full-bleed grainy pastel gradient (`gradient-a` → `gradient-b` → `gradient-c` → `gradient-d`, grain overlay, as its own full-duration background clip); the small line "Presentamos" blur-sweeps in at the upper-center in ink at ~64 px (blur-in).
Scene 2 (0.9–2.6s): the wordmark "SUSAN" (~320 px, weight 700, tight tracking, ink) cascades in letter by letter from below (waterfall-entry); one gradient-text-sweep passes through the letters as the last letter lands; the headline sits dead-center. Centered layout, ≥ 45% of the frame.
Scene 3 (2.6–3.8s): the pill "UNACH · FCA C-I" (white, hairline border) spring-pops under the wordmark and the UNACH shield spring-pops to its left; a tagline types under them, "Asistencia académica, medida y a tiempo", ~54 px.
Scene 4 (3.8–4.5s): hold; the glow stays, nothing else moves.

## Frame 5 — Cámara reconoce

- scene: A classroom camera view locks detection brackets onto eight abstract avatars while the roll call fills itself
- duration: 6.0s
- poster: 4.4s
- transition_in: zoom-through
- status: outline
- src: compositions/frames/05-camara.html
- type: feature_showcase
- persuasion: Show-don't-tell proof
- beat: curiosity → delight
- blueprint: compose
- sfx: 0.2 whoosh-short; 1.05 ping; 1.35 ping; 1.65 ping; 1.95 ping; 2.25 ping; 2.55 ping; 2.85 ping; 3.15 ping; 3.7 sparkle; 4.1 pop; 4.4 typing

narrativeRole: The core promise: the camera takes attendance. Climax of the product demo.
keyMessage: Pasa lista en segundos.

Compose from the motion vocabulary: a camera view with AI-style detection brackets (ai-tracking-box) locking one by one, a roll-call list populating in step, a headline typed over the finish.
Scene 1 (0.0–1.0s): the camera view (a rounded 36 px ink-dark panel, ~1020×690, with a subtle grid of eight abstract avatars: pastel circles with initials, two rows of four, slightly different sizes for depth) scales in from the left half; a pill "Cámara del aula" with a recording dot sits in its top-left corner; one scan line sweeps top → bottom once. Layout: asymmetric 58/42, the camera view at the left.
Scene 2 (1.0–3.4s): yellow-free detection brackets (white corner L-brackets with a blue label chip "98 %") lock onto the eight avatars one after another every 0.3 s (ai-tracking-box, deterministic confidence values 96–99); in step, each locked student's row spring-pops into the roll-call list on the right (avatar + name + "Presente" green chip, rows 96 px tall, spring-pop-entrance), and a counter above the list ticks 0 → 8 of "24".
Scene 3 (3.4–5.0s): the camera panel pushes in 6% (viewport-change) as the counter races to "24 / 24" (counting-dynamic-scale) and a green ring completes around it (svg-path-draw); a soft pastel glow blooms behind the counter — the only gradient accent of this frame.
Scene 4 (5.0–6.0s): the headline "Pasa lista en segundos." types large across the lower area of the right column (~96 px, "segundos" in the blue accent) with a Geist Mono chip "listo en 6 s" beside it; hold.

## Frame 6 — Sesión en vivo

- scene: The live monitor window counts up presents, fills a ring and a liquid gauge, and the camera settles on the gauge
- duration: 5.5s
- poster: 4.6s
- transition_in: push-slide LEFT
- status: outline
- src: compositions/frames/06-vivo.html
- type: feature_showcase
- persuasion: Feature-to-benefit translation
- beat: control → ease
- blueprint: device-surface-showcase (Adapt)
- sfx: 0.2 whoosh; 1.2 pop; 1.35 pop; 1.5 pop; 1.65 pop; 2.0 click-soft; 2.6 click-soft; 3.3 sparkle; 3.8 pop

narrativeRole: Show the teacher's view while the camera works: the whole group, live.
keyMessage: Todo en vivo, sin escribir nada.

Adapt: keep one app window held as the hero while its content cycles states; replace the device mockup with the app's own window card.
Scene 1 (0.0–1.2s): the app window (a white 36 px card, ~1500×820, header with "Administración Financiera (3A)" and a green "Sesión en curso" status chip) rises from the bottom with a slight scale-up; four stat cards enter in a staggered row below the header (Inscritos 24, Presentes 0, Retardos 0, Sin registro 24) using the kit's stat-card with icon in a pill (users, check-circle, clock, user-x). Layout: window centered, ~78% of the width.
Scene 2 (1.2–3.2s): the numbers move on their cues — Presentes counts 0 → 21, Retardos 0 → 2, Sin registro 24 → 1 (counting-dynamic-scale) while, in the lower area of the window, a thin state ring draws its colored segments (svg-path-draw, rounded caps, gaps) and a liquid gauge on its right fills to 88% (stat-bars-and-fills proxy via scaleY of the fill layer inside a rounded tank).
Scene 3 (3.2–4.6s): the camera pushes onto the ring + gauge pair (coordinate-target-zoom) and a label "Presentes ahora" with "88 %" counts up beside the gauge (counting-dynamic-scale); the other stat cards dim to 45% opacity.
Scene 4 (4.6–5.5s): hold; the "En vivo" dot pulses once.

## Frame 7 — Tú decides

- scene: A cursor confirms a dudoso case; the pending counter drops from 3 to 2
- duration: 4.5s
- poster: 3.4s
- transition_in: push-slide LEFT
- status: outline
- src: compositions/frames/07-revision.html
- type: benefit_highlight
- persuasion: Risk reversal
- beat: trust → control
- blueprint: cursor-ui-demo (Adapt)
- sfx: 0.2 whoosh-short; 1.9 click; 2.0 pop; 2.6 chime; 3.1 click-soft

narrativeRole: The system flags doubtful matches; the teacher has the last word.
keyMessage: Tú decides los casos dudosos.

Adapt: keep the cursor-drives-reconstructed-UI signature with the state flip on click; one card, one click, one result.
Scene 1 (0.0–1.0s): a case card (white 28 px, ~900×560) enters centered (a quick scale 0.96 → 1 with a fade): top row "Caso por revisar" label + gray status chip "Pendiente"; avatar "AG" (pastel), "García Luna Ana", a Geist Mono line "similitud 71 % · 2 lecturas"; below, two buttons — ink primary "Confirmar presente" and outline "Rechazar". A small counter chip at the card's top-right reads "Pendientes 3".
Scene 2 (1.0–2.6s): the cursor (kit's su-cursor SVG) glides in from the lower-right with a slightly curved human path and rests over "Confirmar presente" (hover: button lifts 2%), then presses (press-release-spring on the cursor and the button together) with a click ripple (cursor-click-ripple).
Scene 3 (2.6–3.8s): the card flips state — the gray chip becomes a green "Presente" chip with a drawn check (svg-path-draw); the counter swaps 3 → 2 with a quick vertical slide; the avatar ring turns green.
Scene 4 (3.8–4.5s): the line "Tú decides los casos dudosos." types under the card at ~64 px (ink, "decides" in blue accent); hold.

## Frame 8 — Reportes

- scene: A report table assembles with segmented attendance bars, flags two students, and a cursor exports the CSV
- duration: 4.0s
- poster: 3.3s
- transition_in: push-slide LEFT
- status: outline
- src: compositions/frames/08-reportes.html
- type: feature_showcase
- persuasion: Friction reduction
- beat: ease → confidence
- blueprint: grid-card-assemble (Adapt)
- sfx: 0.15 whoosh-short; 0.5 pop; 0.7 pop; 0.9 pop; 1.1 pop; 1.3 pop; 2.2 click; 2.3 notification

narrativeRole: Reports per group and period, ready to export — the coordination view.
keyMessage: Reportes listos para entregar.

Adapt: keep the self-assembling list/grid; the items are the report's student rows, and the payoff is the export click.
Scene 1 (0.0–1.4s): a report card (white, ~1380×760, centered) enters; its header carries two filter pills ("Periodo 2026-2", "Grupo 3A") and an ink "Exportar CSV" button at the right; five student rows then assemble top → bottom as a staggered cascade (waterfall-entry), each row = pastel initials avatar, name, a segmented attendance bar (green/amber/red segments with rounded gaps) that fills left → right as it lands, and the faltas figure at the right.
Scene 2 (1.4–2.4s): a dashed vertical marker "20 %" fades onto the table; the two rows past it are highlighted — one amber chip "En el límite", one red chip "Sin derecho" (spring-pop-entrance on the chips).
Scene 3 (2.4–3.4s): the cursor travels to "Exportar CSV" and presses it (press-release-spring + cursor-click-ripple); a toast "CSV listo" with a drawn check springs up in the card's lower-right.
Scene 4 (3.4–4.0s): hold.

## Frame 9 — Analítica

- scene: A weekly absenteeism line is drawn, projected past the 20% limit with a band, and the crossing week is flagged
- duration: 6.0s
- poster: 5.0s
- transition_in: blur-crossfade
- status: outline
- src: compositions/frames/09-analitica.html
- type: feature_showcase
- persuasion: Future pacing
- beat: clarity → urgency-to-act
- blueprint: dataviz-countup (Adapt)
- sfx: 0.2 whoosh; 0.6 pop; 0.8 pop; 1.0 pop; 1.2 pop; 1.4 pop; 2.2 riser; 3.1 impact-bass-1; 3.2 ping; 4.0 pop; 4.2 pop; 4.9 typing

narrativeRole: The numerical-methods promise — see the pattern, project it, act before the limit is crossed. Climax of the film.
keyMessage: Detecta el patrón antes de que sea tarde.

Adapt: keep numbers and one chart as hero, pushed toward one hero metric; here the chart is a weekly line with projection, the hero metric is the week the limit is crossed.
Scene 1 (0.0–1.5s): a large chart card (left ~64%, white, hairline) enters; its y axis labels (0, 10, 20, 30 %) and x labels S1–S12 appear and a dashed negative-red horizontal line draws at 20% with a chip "Límite 20 %"; the observed weekly points (S1–S8, rising slowly from 8% to 17%) spring in one by one as blue dots with a card-colored ring (spring-pop-entrance, stagger within 0.5 s).
Scene 2 (1.5–3.3s): the fit line (straight, blue, 3 px) draws across the points (svg-path-draw) and continues as a dashed projection to S12 while a soft blue confidence band opens around it (stat-bars-and-fills: scaleY/opacity of a band layer); riser builds; the dashed line crosses the red limit at S11 and a glowing marker pulses there with a chip "Cruza el límite en S11" (spring-pop-entrance).
Scene 3 (3.3–4.7s): in the right column two stat cards assemble with count-up (kit stat cards: "Proyección al cierre 24.6 %" warning, "Alumnos en riesgo 9" negative with icons); the camera pushes 8% toward the crossing marker.
Scene 4 (4.7–6.0s): the headline "Detecta el patrón antes de que sea tarde." types across the top band of the right column (~72 px, "antes de que sea tarde" in blue); hold.

## Frame 10 — El alumno también ve

- scene: A phone shows the student's attendance gauge and a filling streak calendar
- duration: 4.5s
- poster: 3.8s
- transition_in: push-slide UP
- status: outline
- src: compositions/frames/10-alumno.html
- type: benefit_highlight
- persuasion: Status seeking
- beat: pride → motivation
- blueprint: device-surface-showcase (Adapt)
- sfx: 0.2 whoosh-short; 1.1 pop; 1.7 pop; 1.9 pop; 2.1 pop; 2.3 pop; 2.5 pop; 3.2 sparkle; 3.6 typing

narrativeRole: Close the loop for the student: their own attendance, streak and alerts.
keyMessage: Cada alumno ve su propia asistencia.

Adapt: keep a device held as the hero while its screen content fills in; the device is a clean phone silhouette, no bezel art.
Scene 1 (0.0–1.0s): a phone (rounded 72 px, ~470×960, white screen, ink 6 px outline) rises at the left-center; at its bottom, the floating navigation pill (white, hairline, a black round center button) is already seated. Layout: phone left, headline right (asymmetric 40/60).
Scene 2 (1.0–3.0s): inside the phone a hero card "Tu asistencia" with a liquid tank filling to 88% (stat-bars-and-fills) and "88 %" counting; below it a streak calendar (5 rows × 7 weeks of small rounded squares) populates column by column with state colors (spring-pop-entrance, stagger capped within 0.5 s per group, three groups) and a chip "Racha de 7" pops at its top-right.
Scene 3 (3.0–4.5s): at the right the headline types "Cada alumno ve su propia asistencia." (3 lines, ~100 px, "propia" in blue), then two small chips spring in beneath it — "Aviso de límite" and "Proyección" (spring-pop-entrance); hold.

## Frame 11 — Confianza

- scene: A lock icon draws itself and three trust pills check in
- duration: 3.5s
- poster: 3.0s
- transition_in: crossfade
- status: outline
- src: compositions/frames/11-confianza.html
- type: social_proof
- persuasion: Risk reversal
- beat: confidence → peace of mind
- blueprint: grid-card-assemble (Adapt)
- sfx: 0.3 pop; 1.0 ping; 1.5 ping; 2.0 ping

narrativeRole: The privacy and control answer, in three lines. Breather frame.
keyMessage: Tus datos, bajo control.

Adapt: keep the staggered self-assembly of a short list; three pills with drawn checks, one icon hero.
Scene 1 (0.0–1.0s): a lock-shield icon (Lucide-style stroke, ~200 px, blue) draws itself at the upper-center (svg-path-draw) and the headline "Tus datos, bajo control." types under it (~110 px, ink, "bajo control" in blue). Centered layout.
Scene 2 (1.0–3.0s): three white pills assemble in a vertical stack, one every 0.5 s, each with a stroke-drawn check at the left — "Sin imágenes ni vectores en la base de datos", "Cuatro roles, cada uno con sus permisos", "Bitácora de cada consulta" (spring-pop-entrance + svg-path-draw on the checks). Hold the last 0.5 s still.

## Frame 12 — Cierre

- scene: A serif-italic closing line resolves into the SUSAN lockup with both institutional shields
- duration: 4.5s
- poster: 3.6s
- transition_in: blur-crossfade
- status: outline
- src: compositions/frames/12-cierre.html
- type: branding
- persuasion: Authority by association
- beat: confidence → closure
- blueprint: compose
- asset_candidates: assets/brand/unach-escudo.png — escudo de la UNACH con transparencia, 320x289; assets/brand/fca-escudo.png — escudo de la FCA con transparencia, 309x320
- focal: assets/brand/unach-escudo.png
- roles: unach-escudo = supporting (~130 px tall in the lockup) · fca-escudo = supporting (~130 px tall in the lockup)
- sfx: 0.2 whoosh; 0.8 impact-bass-2; 2.0 whoosh-short; 2.4 sparkle; 3.0 chime

narrativeRole: Land the promise once more, then sign off with the institutional lockup.
keyMessage: SUSAN · Pasa lista en segundos.

Compose: a relaxed beat relay that resolves on a long-held end card — line, then lockup.
Scene 1 (0.0–1.5s): on cream, the line "Pasa lista en" slams in on the first beat in ink (~190 px, kinetic-beat-slam, scale-slam entrance) and "segundos." lands on the second beat in EB Garamond italic in the blue accent at the same visual size; layout centered, two lines.
Scene 2 (1.5–3.2s): the line clears by a quick blur-and-lift (cut-the-curve) and the wordmark "SUSAN" (~260 px, weight 700) assembles dead-center (letter cascade); the two shields (UNACH left, FCA right, ~130 px tall) fade-scale in on either side of the pill "UNACH · FCA C-I" beneath the wordmark; a soft pastel gradient mesh (gradient-a → gradient-d with grain) blooms from the bottom edge and holds.
Scene 3 (3.2–4.5s): hold the end card; in the last 0.3 s the whole frame fades to the cream ground (this is the final frame, so this exit is allowed).
