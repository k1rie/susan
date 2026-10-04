---
version: alpha
name: Blue Professional — Frame (video / frame layer)
description: >
  Video-first companion to Blue Professional's design.md. The unit is the frame (1920×1080). Atoms
  are identical and sacred — the warm cream canvas, a single saturated cobalt (#1e2bfa) as the only
  accent, the three-step gray text ladder, Hanken Grotesk (display/numerals/chrome) + Hanken Grotesk (body),
  soft cobalt-tinted cards (4% fill / 20% border / 10–14px radius) with NO shadows, pill chrome, and
  the cobalt progress bar. Composition + frame scale rewritten. Motion out of scope.
unit: the frame — 1920×1080 primary; 9:16 and 1:1 documented
principle: atoms are sacred · composition is free · numbers come from the script

colors:
  bg: "#f7f5f2"
  primary: "#0061fe"
  text: "#1e1919"
  text-muted: "#6f6a65"
  text-light: "#9a948d"
  accent-light: "rgba(0, 97, 254, 0.08)"
  accent-medium: "rgba(0, 97, 254, 0.15)"
  border: "#e7e2dc"
  card-bg: "#ffffff"
  positive: "#1f7a47"
  negative: "#b3261e"
  warning: "#9a6408"
  info: "#1f5fa8"
  gradient-a: "#8fb6ff"
  gradient-b: "#b79cf5"
  gradient-c: "#f5a3c7"
  gradient-d: "#ffc89a"

radii:
  pill: "999px"
  card-lg: "28px"
  card-md: "22px"
  card-sm: "16px"
  bar: "999px"
  circle: "50%"

typography:
  # — reading ramp (Hanken Grotesk body + Hanken Grotesk chrome) —
  body:    { fontFamily: "Hanken Grotesk", cqw: 0.85, weight: 400, lineHeight: 1.6, color: "text-muted" }
  h4-eyebrow:{ fontFamily: "Hanken Grotesk", cqw: 0.8, weight: 600, tracking: "0.08em", upper: true, color: "primary" }
  tag:     { fontFamily: "Hanken Grotesk", px: 12, weight: 500, color: "primary" }
  counter: { fontFamily: "Hanken Grotesk", px: 13, weight: 500, tracking: "0.05em", color: "text-muted" }
  # — display / numerical ramp (Hanken Grotesk, near-black headings / cobalt numerals) —
  h3:      { fontFamily: "Hanken Grotesk", cqw: 1.25, weight: 500, lineHeight: 1.3, tracking: "-0.02em", color: "text" }
  stat-num:{ fontFamily: "Hanken Grotesk", cqw: 1.9, weight: 700, lineHeight: 1.0, color: "primary" }
  blockquote:{ fontFamily: "Hanken Grotesk", cqw: 2.4, weight: 500, lineHeight: 1.35, color: "text" }
  h2:      { fontFamily: "Hanken Grotesk", cqw: 2.6, weight: 600, lineHeight: 1.1, tracking: "-0.02em", color: "text" }
  metric-value:{ fontFamily: "Hanken Grotesk", cqw: 3.0, weight: 700, lineHeight: 1.0, color: "primary" }
  h1:      { fontFamily: "Hanken Grotesk", cqw: 4.2, weight: 700, lineHeight: 1.08, tracking: "-0.02em", color: "text" }
  quote-mark:{ fontFamily: "Hanken Grotesk", cqw: 8.0, weight: 700, lineHeight: 0.5, color: "primary", opacity: 0.15 }

spacing:
  pad-x: "5cqw"
  pad-y-top: "5cqw"
  gap-cards: "1.4cqw"
  accent-line: "60px × 4px"

components:
  card-tinted:
    backgroundColor: "{colors.card-bg}"
    border: "1.5px solid {colors.border}"
    rounded: "{radii.card-lg}"
    shadow: "none"
    description: "Universal content card. Never solid-colored, never opaque-bordered, NO shadow."
  metric-card:
    backgroundColor: "{colors.card-bg}"
    border: "1.5px solid {colors.border}"
    rounded: "{radii.card-lg}"
    typography: "{typography.metric-value} ({colors.primary}) + {typography.metric-label} + {typography.metric-desc}"
    description: "+ optional inline ↑/↓ change chip ({colors.positive}/{colors.negative} text, no fill)."
  tag-pill:
    backgroundColor: "{colors.accent-light}"
    textColor: "{colors.primary}"
    rounded: "{radii.pill}"
    typography: "{typography.tag}"
    description: "Top-right of the slide-header."
  cta-button:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.bg}"
    rounded: "{radii.pill}"
    typography: "Hanken Grotesk 600"
    shadow: "soft cobalt on hover only — the system's only shadow"
    description: "The one solid element."
  accent-line:
    backgroundColor: "{colors.primary}"
    size: "60×4, 2px radius"
    description: "Above cover titles / eyebrow separators."
  bar-track:
    backgroundColor: "{colors.accent-light}"
    fill: "{colors.primary} (display:block so width resolves)"
    rounded: "{radii.bar}"
    description: "28px track; fill carries the value."
  step-circle:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.bg}"
    rounded: "50%"
    size: "56px"
    description: "Sequential steps fade opacity 1.0→0.85→0.7→0.55."
  split-highlight:
    backgroundColor: "{colors.accent-light}"
    borderLeft: "4px solid {colors.primary}"
    rounded: "{radii.card-md}"
    description: "Inline pull-quote callout."
  slide-header:
    typography: "{typography.h4-eyebrow} (blue) left, tag-pill right; {typography.h2} below"
    description: "Top band of every content frame."
  atmosphere:
    elements: "clipped diagonal cobalt-tint panel, 3×3 cobalt dot grid, concentric closing rings"
    description: "Cover/closing only. Never on content frames."
  progress-bar:
    backgroundColor: "{colors.primary}"
    size: "3px tall, bottom edge, width grows with index"
    description: "Persistent progress strip."
---

# Blue Professional — Frame (video / frame layer)

## Brand adaptation (READ FIRST — the frontmatter is the source of truth)

This is the **blue-professional** preset remixed onto the captured brand. The YAML frontmatter above (colors · typography · components) is **normative and already correct — use it verbatim.** The prose below is the ORIGINAL preset's intent; read it THROUGH the frontmatter:

- **Fonts** — already set to **Hanken Grotesk** (display) / **EB Garamond** (body); ignore any preset font name lingering in prose.
- **Weights** — the brand font ships `{400, 500, 600, 700}` only; every weight is clamped to these — ignore higher preset weights (e.g. 600/700) in prose.
- **Colors** — use the frontmatter hex; preset color NAMES in prose (e.g. "cobalt", "cream") mean the remapped brand values.


## Overview

Blue Professional at frame scale is a **consulting-grade system: restraint with one strong
commitment.** A warm cream canvas and a single saturated cobalt that carries every accent —
eyebrow, metric, CTA, chart fill, progress bar. No secondary brand color, no pastels, just cream,
cobalt, and a tight ladder of grays. The register is investment-research / McKinsey briefing:
measured, data-dense without crowding, executive-readable at distance.

The voice is two faces in fixed roles: **Hanken Grotesk** (display, every numeral, all chrome —
eyebrows uppercase 0.08em) and **Hanken Grotesk** (body, muted gray, line 1.6). Headlines are near-black;
cobalt is reserved for accent moments. Depth is **soft and tinted** — 4% cobalt card fills with 20%
cobalt borders and 10–14px radii — never shadowed. The lack of harsh shadows is the premium signal.

**Key characteristics at frame scale:**

- **Warm cream ground** on every frame; **single cobalt** as the only accent.
- **Hanken Grotesk** (display/numerals/chrome) + **Hanken Grotesk** (body) — near-black headlines, cobalt numerals.
- **Tinted cards** — cobalt 4% fill, cobalt 20% 1.5px border, 10–14px radius, **no shadow**.
- **Pill chrome** (100px) — tag pills + the one solid cobalt CTA; cobalt **progress bar**.
- **Soft rounded corners everywhere** (no square corners save the progress bar).
- **Atmosphere** (diagonal panel, dot grid, concentric rings) on cover/closing only.

## The Frame

### Frame Craft Bar

Three eyeball tests gate every frame before any structural check:

- **Squint** — one **near-black headline or cobalt numeral** dominates at 3–6× its neighbor.
- **Silence** — content frames read **balanced, not crowded**; the **dashboard is the one dense exception**.
- **Restraint** — a **single cobalt accent** carries everything; headlines stay near-black (never cobalt); no shadows (tinted cards do the lift); positive/negative inline-text only.
- **Reference** — aim at an **investment-research / McKinsey quarterly briefing**; failure looks like a **heavy-outlined, multi-color dashboard**.

- **Primary:** 1920×1080 (16:9). Display authored in **`cqw`** (`px ÷ 1920 × 100 = cqw`).
- **Vertical:** 1080×1920 (9:16). **Square:** 1080×1080 (1:1).
- **Safe area:** `pad-x` 5cqw; bottom reserves room for the counter + progress bar.

**The container law (load-bearing).** Every frame ground sets `container-type: size`; ALL
frame-relative units are `cqw`/`cqh` against it — never `vw`. Card radii stay px (10–14px); the
pill radius stays 100px; borders stay 1–1.5px.

## Colors

Tokens identical to the source. `{colors.bg}` cream is the universal ground; `{colors.primary}`
cobalt is the **only** accent — every eyebrow, numeral, CTA, chart fill, progress bar, and the 4px
highlight left-rule. Headlines are `{colors.text}` near-black (never cobalt); body is
`{colors.text-muted}`; tertiary is `{colors.text-light}`. Cards fill `{colors.card-bg}` (4%) with
`{colors.border}` (20%) borders. `{colors.positive}`/`{colors.negative}` appear **only inline** on
directional change chips — never as fills. **No second accent color.**

## Typography

Two ramps. The **reading ramp** (Hanken Grotesk body 0.85cqw muted; Hanken Grotesk eyebrow uppercase 0.08em
cobalt) carries copy + chrome; the **display/numerical ramp** (Hanken Grotesk `h3` 1.25cqw → `h1`
4.2cqw near-black; numerals `stat-num`/`metric-value` in cobalt) carries headings and figures.

- **Legibility floor:** any load-bearing line ≥ **1.4cqw**; px chrome (tag/counter) is colophon only.
- **Fit-to-measure:** size the headline to its length. Cap the block at **≤ 78cqw**; ≤3 words → `h1`; 4–6 → `h2`; 7+ → `h3`. Cobalt numerals scale `metric-value`→`stat-num` by card size.
- **Headlines near-black, −0.02em**; **eyebrows cobalt, uppercase, 0.08em**; **numerals cobalt 600–700**; **body Hanken Grotesk 400 muted, line 1.6**. No italic, no uppercase body, no cobalt headline.

## Depth & Surface

Soft and tinted — never offset. Depth from:

- **Tinted cards** — 4% cobalt fill + 20% cobalt 1.5px border + 10–14px radius reads as lifted without offset.
- **Border-left accent** — the 4px cobalt rule on split-highlight blocks pulls a callout forward.
- **Rounded corners** — the 10–14px radius is part of the softness; square corners break it.

**Ceiling:** zero box-shadow on content (the only shadow is a soft cobalt CTA _hover_); no opaque cobalt borders; no harsh outlines.

## Shapes

- **100px** — tag pills, CTA, nav buttons (pill chrome).
- **14/12/10px** — cards by size (large metric / standard stat / detail + mini).
- **6px** — bar tracks + fills. **50%** — step circles, nav circles, dots, closing rings.
- **0** — only the progress bar. No square-cornered content.

## Components

- **card-tinted / metric-card** — the universal soft-tint content cards (no shadow).
- **tag-pill / cta-button / accent-line** — the cobalt pill chrome + the one solid CTA + the 60×4 rule.
- **bar-track / step-circle / split-highlight** — cobalt data + sequence + callout patterns.
- **slide-header** (eyebrow + tag pill) — the structural rhythm; **atmosphere** (diagonal/dots/rings) on cover/closing only; **progress-bar** on every frame.

## Frame Treatments

> Recipe: ground · container · composes · focal · chrome · accent · silence · Fixed/Free · density.
> Atmosphere only on cover/closing; content frames carry the slide-header rhythm.

### 1 · Cover (identity · move: diagonal accent · left)

**Ground** cream + the clipped diagonal cobalt-tint panel (right ~36%) + a 3×3 cobalt dot grid.
**Composes** accent-line, meta, h1, body sub. **Focal** a 2-line Hanken Grotesk `h1` near-black, left,
under a cobalt accent-line + meta. **Chrome** counter + progress bar. **Accent** the cobalt line +
diagonal panel. **Silence** the diagonal panel holds the right third. **Fixed** near-black h1, cobalt
accents, atmosphere here only. **Free** title, meta. **Density** low.

### 2 · Dashboard (data · move: 3-up metric grid · the dense frame)

**Ground** cream, `pad-x`. **Composes** slide-header (eyebrow + tag-pill), h2, 3× metric/tinted card.
**Focal** a row of tinted cards — cobalt `metric-value` + Hanken Grotesk label + muted desc + optional
green/red change chip. **Chrome** eyebrow left, tag-pill right; progress bar. **Accent** the cobalt
numerals. **Silence** tight — the density exception. **Fixed** 4% tint cards, 20% borders, no shadow,
cobalt numerals. **Free** figures (from script), labels. **Density** dense-exception.

### 3 · Bar Ranking (data · move: cobalt bars · left)

**Ground** cream, `pad-x`. **Composes** eyebrow, h2, bar-track rows. **Focal** 3–5 labeled
cobalt-fill bars on cobalt-8% tracks with cobalt percentages. **Chrome** eyebrow; progress bar.
**Accent** the cobalt fills + figures. **Silence** moderate. **Fixed** 6px tracks, cobalt fills.
**Free** rows, values (from script). **Density** standard.

### 4 · Pull Quote (quote · move: concentric rings · centered)

**Ground** cream, centered, with faint concentric closing-rings behind. **Composes** quote-mark,
blockquote, cite. **Focal** a Hanken Grotesk `blockquote` near-black under a 15%-opacity cobalt
quote-mark; an uppercase cobalt-muted cite beneath. **Accent** the faint rings + quote-mark. **Silence**
~55%. **Fixed** near-black quote, soft rings. **Free** quote, cite. **Density** low.

### 5 · Split + Highlight (content · move: asymmetric split · left)

**Ground** cream, two columns. **Composes** eyebrow, h2, body, split-highlight block. **Focal** an
Hanken Grotesk body column beside a cobalt-8% highlight block (4px cobalt left rule) carrying an inline pull
quote. **Accent** the highlight's left rule. **Silence** generous gutter. **Fixed** tinted highlight,
4px cobalt rule. **Free** body, callout. **Density** standard.

### 6 · Closing / CTA (closer · move: centered rings + CTA)

**Ground** cream + concentric closing-rings. **Composes** accent-line, h1, body, cta-button. **Focal**
a Hanken Grotesk `h1` near-black, centered, with the one solid cobalt `cta-button` pill below. **Accent**
the CTA + rings. **Silence** ~60%. **Fixed** one CTA, near-black h1, soft rings. **Free** sign-off, CTA
label. **Density** low.

## Composition Rules

### Do

- Start every frame on **warm cream**; let **cobalt carry every accent** (eyebrow, numeral, CTA, bar, progress).
- Set headlines **near-black, −0.02em**; eyebrows **cobalt uppercase 0.08em**; numerals **cobalt 600–700**.
- Use **tinted cards** (4% fill, 20% border, 10–14px radius, no shadow); body Hanken Grotesk 400 muted, line 1.6.
- Keep all chrome **pill-shaped (100px)**; one solid cobalt CTA per closing frame.
- Reserve **atmosphere** (diagonal panel, dots, rings) for cover/closing; content frames keep the slide-header rhythm.
- Lean left on cover/dashboard/split, centered on quote/closer.

### Don't

- No second accent color; no cobalt headlines.
- No drop shadows on content (only the soft cobalt CTA hover); no opaque cobalt borders.
- No square corners (save the progress bar); no font substitutes; no uppercase body.
- Don't use the green/red change chips as general accents — directional comparisons only.
- Don't fill space with heavier borders — add substance; don't blow a headline edge-to-edge.

## Aspect-Ratio Behavior

| Treatment         | 16:9                       | 9:16                           | 1:1                      |
| ----------------- | -------------------------- | ------------------------------ | ------------------------ |
| Cover             | title left, diagonal right | title top, diagonal band below | title upper, dots corner |
| Dashboard         | 3 cards across             | 3 stacked                      | 2×2                      |
| Bar Ranking       | 3–5 bars                   | 3–5 bars (tighter)             | 3 bars                   |
| Pull Quote        | centered, rings behind     | centered, taller               | centered                 |
| Split + Highlight | side-by-side               | stacked                        | stacked                  |
| Closing / CTA     | centered + CTA             | centered + CTA                 | centered + CTA           |

`pad-x` holds on the short edge; re-step display above the 1.4cqw floor. The diagonal cover panel
becomes a top/bottom band on 9:16. Numerals stay Latin Arabic digits in CJK builds.

## Approved Entities

No real customers, logos, or vendors are defined in the source — render any such mark as a
placeholder. Figures, metrics, and quotes are content; the system supplies cream + cobalt + grays.

## Numerals & Claims (hard rule)

Never invent figures, financials, percentages, or dates at frame scale. Render slots as `— figure —`,
`{metric}`, `+NN%`, `↑ —`. Metric cards, bar values, and stat cells especially carry placeholders
until the script supplies them. Directional chips require a real comparison from the script.

## Pre-Render Self-Audit

- **Squint** — one near-black headline or cobalt numeral dominates per frame.
- **Silence** — content frames balanced, not crowded; only the dashboard runs dense.
- **Single accent** — cobalt only; headlines near-black; positive/negative inline only.
- **Type** — Hanken Grotesk headings −0.02em near-black, cobalt eyebrows 0.08em + numerals; Hanken Grotesk body muted line 1.6; ≥1.4cqw floor.
- **Depth** — tinted cards (no shadow), soft rounded corners, 20% cobalt borders; no square content corners.
- **Anchor** — left on cover/dashboard/split, centered on quote/closer; atmosphere on cover/closing only.
- **Fabrication** — every numeral traces to the script, else placeholder.

## Known Gaps

- **Motion intentionally out of scope.** frame.md specifies composition only; the source's 500ms translateX transitions + bar-fill animations are deck mechanics.
- **Hanken Grotesk + Hanken Grotesk via Google Fonts.** CJK pairing (Noto Sans SC 700 display / Noto Serif SC 400 body) carries over; the eyebrow's uppercase+tracking signal weakens in CJK — pair it with the accent-line.
- **9:16 / 1:1 are guidance**; verify the floor and that the diagonal panel reflows to a band.
- Diagonal panel (clip-path), dot grid, concentric rings, and bars are CSS-only; no external imagery is required.


## Font loading (auto-generated)

The brand font ships as local files in `assets/fonts/` — do NOT link Google Fonts for it. Paste this `<style>` into every frame's `<head>`/`<template>` (captions use the same files) so `font-family` resolves in preview, snapshot, and render alike:

```html
<style>
@font-face{font-family:"EB Garamond";font-weight:400;font-style:italic;font-display:block;src:url("assets/fonts/EBGaramond-Regular-Italic.woff2") format("woff2");}
@font-face{font-family:"EB Garamond";font-weight:400;font-style:normal;font-display:block;src:url("assets/fonts/EBGaramond-Regular.woff2") format("woff2");}
@font-face{font-family:"Geist Mono";font-weight:400;font-style:normal;font-display:block;src:url("assets/fonts/GeistMono-Regular.woff2") format("woff2");}
@font-face{font-family:"Hanken Grotesk";font-weight:400;font-style:normal;font-display:block;src:url("assets/fonts/HankenGrotesk-Regular.woff2") format("woff2");}
</style>
```

---

# SUSAN — kit de recreación de interfaz para el video (LÉELO ANTES DE DIBUJAR CUALQUIER PANTALLA)

La interfaz de SUSAN NO se captura: se **recrea en HTML/CSS** dentro de cada cuadro con estos componentes, para que todos los cuadros se vean como la misma app. Todo está ya escalado para un lienzo de **1920×1080** (la app real usa 14 px; aquí las etiquetas miden 26–30 px y las cifras 64–88 px). Copia los fragmentos DENTRO del `<style>` de tu `<template>` y cámbiales el prefijo `su-` por `<frame_id>-` (colisiones entre cuadros).

**Identidad (no inventes otra):** lienzo crema `#f7f5f2`, tarjetas blancas con borde fino `#e7e2dc` y SIN sombra, tinta casi negra `#1e1919`, un solo acento azul `#0061fe`, estados con color + texto (presente verde, retardo ámbar, ausente rojo, justificado azul, pendiente gris). Tipografía: **Hanken Grotesk** (todo), **EB Garamond** solo en un titular de acento por escena como mucho, **Geist Mono** para cifras técnicas pequeñas. Iconos: SOLO trazos estilo Lucide (SVG inline `stroke="currentColor" stroke-width="1.75" fill="none" stroke-linecap="round" stroke-linejoin="round"`, viewBox 24); nada de emojis. Rostros: NUNCA fotos ni caras realistas; avatares = círculo de color con iniciales (tinta sobre pastel). Datos de demostración creíbles (grupo 3A "Administración Financiera", docente Patricia Ortega, alumnos con nombres mexicanos de ejemplo, 24 inscritos).

**Atmósfera del video (referencias de estilo: lanzamientos de producto limpios):** fondo crema con una mancha de degradado suave y grano (azul `gradient-a` → violeta `gradient-b` → rosa `gradient-c` → durazno `gradient-d`) SOLO en momentos de énfasis (apertura, "Run", cierre); texto enorme que se escribe con cursor parpadeante; palabra de acento en azul que se intercambia; un cursor de mouse que se mueve y hace clic; acercamientos de cámara a un detalle de la interfaz; píldoras con degradado suave; transiciones rápidas.

```css
/* —— tokens (en #root del cuadro) —— */
#root{--ink:#1e1919;--canvas:#f7f5f2;--card:#fff;--muted:#f0ede8;--mfg:#6f6a65;--lt:#9a948d;--line:#e7e2dc;--blue:#0061fe;
 --ok:#1f7a47;--ok-bg:#e3f4ea;--warn:#9a6408;--warn-bg:#fbefd2;--bad:#b3261e;--bad-bg:#fbe4e1;--info:#1f5fa8;--info-bg:#e1edfa;
 --g-ok:#27a06a;--g-warn:#c98100;--g-bad:#de4d44;--g-blue:#4a86f0;--g-violet:#8b6fe0;--g-gold:#c9a13a;
 font-family:'Hanken Grotesk',system-ui,sans-serif;color:var(--ink);font-feature-settings:'tnum' 1}
/* —— tarjeta —— */
.su-card{background:var(--card);border:2px solid var(--line);border-radius:28px;padding:32px}
/* —— tarjeta de cifra (icono en pastilla + etiqueta, cifra, estado en color) —— */
.su-stat{background:var(--card);border:2px solid var(--line);border-radius:28px;padding:30px 32px;display:flex;flex-direction:column;gap:22px;min-height:230px}
.su-stat-h{display:flex;align-items:center;gap:16px;color:var(--mfg);font-size:26px;font-weight:500;line-height:1.2}
.su-chip-i{width:56px;height:56px;border-radius:16px;display:grid;place-items:center;background:var(--muted);color:var(--mfg);flex:none}
.su-chip-i.ok{background:var(--ok-bg);color:var(--ok)}.su-chip-i.warn{background:var(--warn-bg);color:var(--warn)}.su-chip-i.bad{background:var(--bad-bg);color:var(--bad)}.su-chip-i.info{background:var(--info-bg);color:var(--info)}
.su-chip-i svg{width:30px;height:30px}
.su-stat-v{font-size:88px;font-weight:600;letter-spacing:-0.03em;line-height:1}
.su-stat-v small{font-size:34px;font-weight:500;color:var(--mfg);margin-left:6px;letter-spacing:0}
.su-stat-s{font-size:24px;font-weight:500;color:var(--mfg)}.su-stat-s.ok{color:var(--ok)}.su-stat-s.warn{color:var(--warn)}.su-stat-s.bad{color:var(--bad)}
/* —— estado de asistencia (texto + color, nunca solo color) —— */
.su-st{display:inline-flex;align-items:center;gap:10px;padding:8px 20px;border-radius:999px;font-size:24px;font-weight:600}
.su-st::before{content:'';width:12px;height:12px;border-radius:50%;background:currentColor}
.su-st.ok{background:var(--ok-bg);color:var(--ok)}.su-st.warn{background:var(--warn-bg);color:var(--warn)}.su-st.bad{background:var(--bad-bg);color:var(--bad)}.su-st.info{background:var(--info-bg);color:var(--info)}.su-st.mut{background:var(--muted);color:var(--mfg)}
/* —— botón primario (tinta) y pastilla de degradado suave —— */
.su-btn{display:inline-flex;align-items:center;gap:14px;padding:22px 40px;border-radius:20px;background:var(--ink);color:#fff;font-size:30px;font-weight:600}
.su-pill-g{display:inline-flex;align-items:center;gap:16px;padding:22px 48px;border-radius:999px;font-size:34px;font-weight:600;color:var(--ink);
 background:linear-gradient(120deg,#cfe0ff 0%,#e4d8ff 45%,#ffd9e8 100%);border:2px solid rgba(255,255,255,.9);box-shadow:0 18px 50px rgba(120,100,230,.22)}
/* —— avatar (iniciales sobre pastel; JAMÁS rostros reales) —— */
.su-av{width:72px;height:72px;border-radius:50%;display:grid;place-items:center;font-size:26px;font-weight:700;color:var(--ink)}
/* —— fila de lista con barra de píldora —— */
.su-row{display:grid;grid-template-columns:72px 1fr auto;align-items:center;gap:22px;padding:18px 0;border-bottom:2px solid var(--line);font-size:28px}
.su-track{height:16px;border-radius:999px;background:var(--muted);position:relative;overflow:hidden}.su-fill{position:absolute;inset:0 auto 0 0;border-radius:999px}
/* —— cursor de mouse (SVG propio; ver patrón de clic con cursor-click-ripple) —— */
.su-cursor{position:absolute;width:54px;height:54px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.25))}
/* —— grano suave sobre fondos de degradado —— */
.su-grain{position:absolute;inset:0;opacity:.18;mix-blend-mode:multiply;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
```

**Piezas de datos de SUSAN que puedes dibujar** (todas con SVG/CSS propios, animadas con transform/opacity/stroke-dashoffset): anillo fino de estados (círculo r=46, trazo 9, segmentos de colores `--g-ok/--g-warn/--g-bad/--g-blue` con extremos redondeados y huecos entre ellos, cifra grande al centro); barras de píldora horizontales con marca discontinua de límite (20 %); mapa de calor de semana (5 casillas Lun–Vie teñidas de rojo suave según el valor); calendario de racha (cuadrícula semanas×días con cuadros verdes/ámbar/rojos); medidor de líquido (tanque redondeado con nivel que sube y borde ondulado leve); línea de tendencia semanal con banda de proyección y línea discontinua horizontal del límite 20 % con etiqueta; barra de navegación móvil flotante (píldora blanca con borde, 4 destinos con icono+etiqueta y un botón negro redondo central que sobresale). Nada de pantallas "recortadas de captura": todo nace en el cuadro.
