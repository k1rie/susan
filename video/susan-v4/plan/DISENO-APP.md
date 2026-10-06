# DISEÑO-APP: identidad visual de SUSAN para el video v4 y su mezcla con el reel

Documento de plan (2026-10-06). Dice **cómo se ve SUSAN** con valores exactos para recrearla en HTML/SVG a 1920×1080, y
**cómo se mezcla** con el lenguaje cinematográfico del reel de levii.motion sin traicionar la identidad. Lo usan quien
escribe el `frame.md` v4, la hoja de bocetos y los workers de cada cuadro.

**Fuentes leídas (orden de precedencia):**

1. `web/src/app/globals.css` (tokens claro y `.dark`).
2. Componentes reales: `web/src/components/ui/*` (gráficas, tarjetas, chips, pills, tabs, button, avatar),
   `layout/*` (AppShell, Sidebar, BottomNav, TopbarMovil, BrandMark), `home/*` (HomeRol, Resaltado, CampoComando),
   `docente/PasarListaHero`, `sesion/VistaCamara`, `motion/*`, `lib/motion/easing.js`, `lib/graficas.js` y `lib/modulos.js`.
3. Capturas reales `capture/app-real/`:
   - Escritorio: viewport 1920×1080 a DPR 2 (PNG de 3840×2160).
   - Teléfono: 390×844 a DPR 3.
   - **Recortes `crops/` a 2×**: son la referencia píxel a píxel de la escala E = 2 (§2.0).
4. `docs/design/SISTEMA.md` y `REFERENCIAS.md`.
5. `video/susan-presentacion/frame.md` (kit v3; sus desviaciones se corrigen en §1.9).
6. `plan/REFERENCIA.md` y `plan/LECCIONES-V3.md` (no se repite su análisis del reel; aquí se fija el lado SUSAN).

---

## 0. Contrato en 12 reglas

1. **Dos capas.**
   - La **UI** (todo lo que existe en la app) es **fiel**: tokens, radios, bordes finos, sin sombra interna, Hanken
     Grotesk, Lucide y estados con texto.
   - El **escenario** (fondo, cámara, profundidad, vidrio, brillo, sombra del objeto flotante) puede ser cinematográfico,
     pero solo con colores **derivados de tokens** (§3).
2. **Lienzo crema `#F7F5F2`, panel blanco `#FFFFFF`, tinta `#1E1919`.**
   - La tinta es el **único acento oscuro**: botón primario, píldora activa, tooltip oscuro y botón central.
   - El azul `#0061FE` es solo para enlaces y foco.
   - El oro `#A8842C` es solo para acentos: subrayado del saludo, detalle de la marca y línea EMA.
3. **Estados de asistencia: siempre color + etiqueta de texto**, con `StatusChip` o leyenda con cifra. Nunca un punto de
   color solo.
4. **Escala de UI E = 2** por defecto (14 px → 28 px). Planos medios E = 1.6; primeros planos E = 2.5–3; planos
   generales de pantalla completa E ≈ 0.8–1.2, solo como contexto (§2.0).
5. **Tipografía.**
   - Hanken Grotesk (400/500/600) para todo. Las cifras son 600 en la UI y 500–600 en el héroe del video, nunca 700+,
     siempre `tabular-nums`.
   - EB Garamond (500) solo en el saludo del Home y en 1–2 titulares de acento de todo el video.
6. **Radios** (en la app → en el video con E = 2):
   - Tarjetas: 14 → 28.
   - Botones y campos: 8 → 16.
   - Panel principal y diálogos: 18 → 36.
   - Chips y filtros: píldora.
7. **Sin sombra en tarjetas.**
   - La sombra existe solo en objetos flotantes: menús, diálogos, BottomNav, botón central y la tarjeta de producto
     del login.
   - En el video, solo el **objeto de escenario** (el panel o dispositivo que flota) lleva sombra, en una capa aparte y
     teñida del color del escenario.
8. **Iconos: solo Lucide**, `stroke-width` 1.5 (navegación) o 1.75 (tarjetas, botones, chips). Nunca se engrosa el trazo
   para compensar la escala.
9. **Movimiento.**
   - La **UI se mueve como en la app**: las mismas entradas y curvas (§2.21).
   - La **cámara y el escenario se mueven como en el reel**: `power3`/`expo`, rack focus y pose 3D ≤ 8° que se posa
     en 0–3°.
10. **El holograma es el degradado de «Pasar lista»** (`TarjetaPortada portada="degradado"`, ya existe en la app).
    - Solo va en la tarjeta héroe, en el barrido de la marca y en el cielo.
    - Nunca en gráficas, chips ni datos.
11. **Nunca se muestra UI de desarrollo**: «Reloj simulado», «Cámara simulada (demostración)», «Solo desarrollo», cuadros
    magenta del simulador ni el banner `RelojDemo`. Tampoco cursor de mouse (BRIEF).
12. **Cierre solo con el nombre** (preferencia registrada en la v3). Los escudos UNACH/FCA aparecen solo dentro de la UI
    fiel (BrandMark) o en una placa institucional opcional si la persona dueña la pide (§4.6).

---

## 1. Átomos

### 1.1 Tokens de color (tema claro, el único que se muestra)

Los nombres son idénticos a `globals.css`; en el `:root` del video se copian con el mismo nombre (bloque en §1.10). El
OKLCH se calculó desde el hex (L %, C, H°).

| Token | Hex | OKLCH | Rol en la app | Uso en el video |
|---|---|---|---|---|
| `--background` | `#F7F5F2` | 97.1% 0.005 78 | Lienzo crema; también el riel (`--sidebar`) | Fondo de E3; suelo del cielo E1 |
| `--foreground` | `#1E1919` | 21.9% 0.008 18 | Tinta de texto | Texto, acento oscuro, tooltip, placa de tinta |
| `--card` / `--popover` | `#FFFFFF` | 100% 0 — | Panel flotante, tarjetas, menús | Igual |
| `--primary` | `#1E1919` | = tinta | Botón primario, píldora activa, botón central | Igual |
| `--primary-foreground` | `#FFFFFF` | — | Texto sobre tinta | Igual |
| `--primary-hover` | `#3A3433` | 33.1% 0.009 29 | Hover del primario | «Pulso» del botón sin cursor (§3.8) |
| `--muted` / `--secondary` | `#F0EDE8` | 94.7% 0.007 81 | Pistas de barra, píldora inactiva, vidrio del medidor, anillo vacío | Igual; borde del viñeteo de E3 |
| `--muted-foreground` | `#6F6A65` | 52.7% 0.010 68 | Texto secundario, meta, ejes | Igual |
| `--accent` | `#EFECE7` | 94.4% 0.007 81 | Hover y destino activo de BottomNav | Igual |
| `--sidebar-accent` | `#EBE8E3` | 93.2% 0.007 81 | Ítem activo del riel | Igual |
| `--border` | `#E7E2DC` | 91.5% 0.010 73 | Bordes de tarjetas, cuadrícula de gráficas, pestañas | Igual (2 px con E ≥ 1.6) |
| `--input` | `#D8D2CA` | 86.6% 0.013 75 | Borde de campos y del botón secundario | Igual |
| `--link` / `--ring` / `--info` / `--chart-1` | `#0061FE` | 55.3% 0.245 261 | Enlaces, foco (anillo 4 px al 30 %), serie base azul | Enlaces y el anillo de foco como «toque» (§3.8). Nunca como acento de marca |
| `--destructive` | `#B3261E` | 50.1% 0.178 29 | Límite (línea discontinua al 70–75 %), etiqueta de límite | Igual |
| `--brand-gold` / `--chart-2` / `--g-dorado` / `--tono-dorado-fg` | `#A8842C` | 63.2% 0.112 86 | Subrayado `Resaltado`, serie EMA | Subrayado de la marca y del saludo; detalle del wordmark |
| `--brand-gold-soft` | `#F6EDD3` | 94.6% 0.036 91 | Fondo dorado suave | Nube cálida del cielo E1 |
| `--brand-navy` | `#1F3A5F` | 34.7% 0.073 257 | Definido, casi sin uso | No usar |
| `--success` | `#2E7D4F` | 52.9% 0.106 155 | Semántico | (usar `--presente`) |
| `--warning` | `#B7791F` | 62.6% 0.125 70 | Semántico | (usar `--retardo`) |
| `--chart-5` | `#6F4FB3` | 51.1% 0.153 295 | Serie violeta (WMA) | Solo en gráficas |

**Estados de asistencia** (texto oscuro sobre fondo `-bg`; los `--g-*` son los vivos de gráfica):

| Estado (etiqueta) | Texto | Fondo `-bg` | Gráfica `--g-*` |
|---|---|---|---|
| Presente / Presentes | `#1F7A47` (51.4% 0.116 154) | `#E3F4EA` | `#27A06A` (62.8% 0.132 159) |
| Retardo / Retardos | `#9A6408` (54.9% 0.115 72) | `#FBEFD2` | `#C98100` (66.2% 0.143 71) |
| Ausente / Ausencias / «Sin registro» (en la sesión) | `#B3261E` (50.1% 0.178 29) | `#FBE4E1` | `#DE4D44` (61.8% 0.182 27) |
| Justificado / Justificadas | `#1F5FA8` (48.5% 0.133 255) | `#E1EDFA` | `#4A86F0` (63.3% 0.171 261) |
| Pendiente / Pendientes | `#5B5651` (45.6% 0.010 68) | `#EEEBE6` | `#8F8A82` (63.5% 0.013 80) |
| (series) azul / violeta / dorado | — | — | `#4A86F0` / `#8B6FE0` / `#A8842C` |

- `colorGrafica()` traduce el token de texto al vivo: `--presente → --g-presente`, `--chart-1 → --g-azul`, `--chart-2 →
  --g-dorado`, `--chart-3 → --g-presente`, `--chart-4 → --g-ausente` y `--chart-5 → --g-violeta`.
- Áreas y trazos se pintan con `--g-*`; el texto, con los oscuros.

**Portadas pastel `tono-*`** (fondo y trazo del icono). Mapa real de módulos según `lib/modulos.js`:

| Tono | Fondo | Trazo `-fg` | Módulos del docente |
|---|---|---|---|
| azul | `#E6EEFC` (94.7% 0.021 262) | `#1D5FD1` (51.5% 0.188 261) | Mi panel, **Pasar lista** (+ portada `degradado`), Mi asistencia |
| dorado | `#FBF1D9` (96.0% 0.033 88) | `#A8842C` | Revisión de registros, Tutorías |
| verde | `#E5F3EE` (95.2% 0.016 173) | `#1F7A47` | Reportes, Calificaciones |
| violeta | `#EEE9F7` (94.2% 0.019 302) | `#6F4FB3` | Analítica de ausentismo, Asistente SUSAN |
| rosa | `#FBE6E2` (94.1% 0.024 30) | `#C2410C` (55.3% 0.174 38) | Comunicados |

### 1.2 Paleta oscura (`.dark`): definida pero **no se muestra**

La app no tiene interruptor de tema; enseñar la UI oscura sería mostrar algo que el docente no verá. Valores para
referencia y para la placa de tinta (§3.6):

| Token | Hex | | Token | Hex |
|---|---|---|---|---|
| background | `#141110` | | brand-gold | `#D9B65C` (8.9:1 sobre tinta) |
| foreground | `#F3F0EC` | | presente / retardo / ausente | `#5FD69A` / `#F0C05C` / `#F48F88` |
| card | `#1C1918` | | justificado / pendiente | `#82B8F2` / `#B9B3AB` |
| muted / accent | `#262221` / `#2C2827` | | g-presente / g-retardo / g-ausente | `#4CC38A` / `#E0A63A` / `#F0746C` |
| muted-foreground | `#A39D96` | | g-azul / g-violeta / g-dorado | `#6AA3FF` / `#A58DF0` / `#D9B65C` |
| link / ring | `#6AA3FF` | | tono-azul / -fg | `#1B2A45` / `#8DB4FF` |
| border / input | `rgba(255,255,255,.10)` / `.16` | | tono-dorado / -fg | `#3A3118` / `#E2C26F` |
| tono-verde / -fg | `#17302A` / `#6FD1A0` | | tono-violeta / -fg | `#2A2340` / `#B7A2E3` |
| tono-rosa / -fg | `#3B211D` / `#F4A584` | | shadow-lift | `0 10px 30px rgba(0,0,0,.45)` |

### 1.3 Valores crudos que sí existen en el código (y por eso son identidad)

| Dónde | Valor | Uso en el video |
|---|---|---|
| `TarjetaPortada` `DEGRADADO` (portada del módulo destacado = **Pasar lista**) | `linear-gradient(105deg, #FF6AA9 0%, #FFB36B 28%, #8BE3B5 58%, #6BB8FF 100%)` | **Base del holograma** (E2). Sustituye a `gradient-a..d` de la v3 (`#8FB6FF #B79CF5 #F5A3C7 #FFC89A`), que no existían en la app |
| `Avatar` `TINTES` (iniciales blancas 600) | `#E5501E #0B6BCB #1F7A47 #6F4FB3 #B4551A #0E7490 #A21CAF #475569` | Avatares de iniciales en listas fieles (Patricia Ortega = «PO» `#1F7A47` en las capturas) |
| `--shadow-soft` | `0 1px 2px rgba(30,25,25,.04)` | Invisible en video; ignorar |
| `--shadow-lift` | `0 10px 30px rgba(30,25,25,.12)` | Base de la sombra del objeto de escenario (×2–4, §3.8) |
| Ficha de icono de `TarjetaPortada` | `border: 1px solid rgba(0,0,0,.05)` + `0 1px 2px rgba(30,25,25,.08)` | Única micro-sombra dentro de una tarjeta; se conserva |
| `.textura-grano` | SVG `feTurbulence fractalNoise baseFrequency .9 numOctaves 2`, alfa .55, tesela 160 px, `opacity .22`, `multiply` | **Grano de los escenarios** (§3), con otra opacidad |
| `.tesela-flota` | Deriva de 30–60 s, `translate(12px, -16px) rotate(+4°)` alterno | Precedente de flotación lenta. Usar solo como deriva del escenario, nunca como «respiración» de la UI |
| Login `PanelProducto` | Tarjeta `rounded-2xl border bg-card p-5 shadow-lift` sobre placa `bg-muted/60` | **Precedente nativo de «la app flotando con sombra»** |
| `BottomNav` | `bg-card/90` + `backdrop-blur-xl` + `border-border/70` + `shadow-lift` | **Precedente nativo de vidrio** |
| `VistaCamara` chips | `bg-foreground/80` + `backdrop-blur-sm` + texto blanco 12/500 | **Precedente nativo de la píldora oscura** del reel |

### 1.4 Contrastes medidos (para decidir tamaños)

| Par | Ratio | Consecuencia |
|---|---|---|
| Tinta `#1E1919` sobre crema | 15.97:1 | Libre |
| Blanco sobre tinta | 17.38:1 | Libre (tooltip, botón) |
| `#6F6A65` sobre blanco / crema | 5.35 / 4.92 | Texto secundario OK a cualquier tamaño de video |
| `#6F6A65` sobre `tono-azul` | 4.59 | OK |
| **Oro `#A8842C` sobre crema / blanco** | **3.22 / 3.50** | Solo en trazos y en texto ≥ 48 px. **Nunca texto dorado pequeño** |
| Oro sobre `brand-gold-soft` | 2.99 | Nunca texto |
| Oro oscuro `#D9B65C` sobre tinta | 8.93 | Oro permitido en la placa de tinta |
| `tono-azul-fg` sobre `tono-azul` | 4.99 | Iconos y textos de ficha OK |

### 1.5 Tipografía

**Familias y archivos** (`assets/fonts/`, verificados):

- **Hanken Grotesk**:
  - `HankenGrotesk-var.woff2` es **variable** (`fvar` + `gvar`).
  - `HankenGrotesk-Regular.woff2` es el mismo archivo.
  - Declarar `font-weight: 100 900`.
- **EB Garamond**:
  - `EBGaramond-Regular.woff2` es **estático 400** y `-Italic` también.
  - La app usa **500**.
  - Hay que **conseguir EB Garamond 500** (Google Fonts, OFL; la variable cubre `wght 400–800`) y guardarla como
    `assets/fonts/EBGaramond-var.woff2`.
  - Si no se consigue, usar 400: se ve un punto más ligero, pero es aceptable a 96–110 px.
  - **No usar la EB Garamond 700 que trae HyperFrames**: es demasiado pesada frente a la app.
  - La skill `hyperframes-creative` marca EB Garamond como «monocultivo»; aquí la marca manda.
- **Geist Mono**: `GeistMono-var.woff2` es variable. Solo para datos técnicos (no aparece en las pantallas del docente).

**Escala real de la app → video (E = 2).** Tailwind: `tracking-tight` = −0.025em, `leading-tight` = 1.25,
`leading-snug` = 1.375, `leading-none` = 1. El cuerpo lleva `letter-spacing: -0.003em`.

| Pieza | Fuente / peso | App (px) | Video E=2 (px) | Detalle |
|---|---|---|---|---|
| Texto base | Hanken 400 | 14, lh 1.5 | 28 | `antialiased` |
| Meta, leyendas, hint, chip sm | Hanken 400–500 | 12 | 24 | Hint de StatCard en 500 y color del tono |
| Ejes de gráfica, chip de límite | Hanken 400 / 500 | 11 | 22 | Mínimo absoluto de lectura en el video |
| Etiqueta StatCard, subtítulo TarjetaFila | Hanken 500 / 400 | 13 | 26 | Gris |
| Título TarjetaFila / TarjetaPortada | Hanken 500 | 14.5 | 29 | `leading-snug`, 2 líneas como máximo |
| Título TarjetaGrafica / Card | Hanken 600, tight | 16 | 32 | |
| Título de sección, título de PasarListaHero | Hanken 600, tight | 20 | 40 | |
| Título de página (PageHeader h1) | Hanken 500, tight | 26 | 52 | |
| BrandMark «SUSAN» | Hanken 600, tight | 22 | 44 | |
| Cifra StatCard | Hanken 600, tight, lh 1, tabular | 30 | 60 | Unidad 14/500 gris → 28 |
| Centro AnilloEstados | Hanken 600, tabular | 16–30 | 32–60 | Etiqueta 12 gris → 24 |
| Cifra MedidorLiquido | Hanken 600, tight | 36 | 72 | |
| **Saludo del Home** | **EB Garamond 500**, lh 1.05, tight | **52** (41.6 en teléfono) | **104** | El nombre lleva `Resaltado` dorado |
| Titular de acceso (login) | EB Garamond 500 | 48 | 96 | «Pasa lista en segundos» |
| Cifra héroe del video (no existe en la app) | Hanken 500–600, −0.03em, tabular | — | 120–180 | Del reel: cifras **nunca bold**; unidad al 0.45–0.5em en gris |
| Kicker o rótulo del video | Hanken 500 | — | 30–40 | Proporción rótulo : cifra : delta ≈ 1 : 1.55 : 0.75 (REFERENCIA §1.4) |

**Reglas de uso:**

- Una sola grotesca para todo. **La serif solo aparece en 1–2 momentos** de todo el video: el saludo «Buenos días,
  Patricia» si sale el Home, y un titular de acento (gancho o cierre).
- Nunca serif en la UI de datos.
- Nunca mayúsculas sostenidas en el cuerpo (la app no las usa). El riel usa títulos de sección en minúscula con mayúscula
  inicial.
- Pesos máximos de la app: 600. El 700 solo aparece en las iniciales de avatar. En el video no se pasa de 600.
- Tracking: UI con el de la app; display ≥ 80 px con −0.025 a −0.03em.

### 1.6 Radios

| Token / pieza | App (px) | Video E=2 | Dónde |
|---|---|---|---|
| `rounded` (sin sufijo) | 4 | 8 | `kbd ⌘ K` |
| `--radius-sm` | 6 | 12 | Ficha de 24 px del riel («Próximamente») |
| `--radius-md` | 8 | 16 | **Botones, campos, CampoComando**, pastilla de icono de StatCard |
| `--radius-lg` | 10 | 20 | Ítems del riel, fichas de icono de 36–40 px (TarjetaFila, Portada, PasarListaHero), tooltip de GraficaLinea, ítems de menú |
| `--radius-xl` | 14 | 28 | **Tarjetas** (Card, TarjetaGrafica, StatCard, Portada, Fila, PasarListaHero), casilla de TiraSemana, marco de cámara, menú de cuenta |
| `--radius-2xl` | 18 | 36 | **Panel principal flotante**, diálogos, tarjeta del login, destino de BottomNav, paleta ⌘K |
| BottomNav (píldora) | 28 | 56 | |
| Columnas de BarrasPildora (recorte) | 12 | 24 | |
| Tanque MedidorLiquido | 24 | 48 | |
| `rounded-full` | — | — | StatusChip, Pills, chips oscuros, pistas y barras, puntos, avatares, botón central |
| Objeto de escenario (dispositivo o ventana) | — | 36–56 | Libre dentro de ese rango (no es UI) |

### 1.7 Bordes, sombras y foco

- **Borde estándar**: `1px solid #E7E2DC`; en el video `2px` con E ≥ 1.6 (1 px desaparece con la compresión de YouTube).
- **Variantes de borde**:
  - Panel principal: `border-border/60` = `rgba(231,226,220,.6)`.
  - BottomNav: `/70`.
  - Campos y botón secundario: `#D8D2CA`.
  - Hover: el borde pasa a `#D8D2CA` y el fondo a `accent/30–40`.
- **Regla sin sombra**: tarjetas, StatCard, TarjetaGrafica, Fila, Portada y gráficas **nunca** llevan sombra; Dash separa
  con bordes. `--shadow-lift` aparece solo en Modal, Toast, MenuCuenta, paleta ⌘K, cajón del riel en teléfono,
  BottomNav, botón central y tarjeta del login.
- **Foco**: `ring-4 ring-ring/30` = halo de 4 px `rgba(0,97,254,.30)` (8 px con E = 2). Es útil para contar un «toque»
  sin cursor (§3.8).

### 1.8 Iconos (Lucide, `lucide-react` 1.50.0)

- **Trazo**:
  - 1.5 en navegación: riel, búsqueda, topbar, CampoComando, flechas de menú.
  - 1.75 en tarjetas, botones, chips, StatCard y BottomNav.
  - BottomNav activo: 2 (única excepción).
  - Siempre `fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"`, viewBox 24.
- **Escalado**: el trazo **escala con el icono**. Un icono de 40 px (20 × 2) con 1.75 se ve de ~2.9 px; nunca subir el
  `stroke-width` a mano.
- **Tamaños en la app → ×2**:

  | Tamaño app (px) | ×2 | Dónde |
  |---|---|---|
  | 14 | 28 | Chips oscuros, Lock, ficha del riel |
  | 16 | 32 | StatCard, flechas de botón, cámara de PasarListaHero |
  | 18 | 36 | Ficha de Portada, CampoComando |
  | 20 | 40 | Riel, TarjetaFila, PasarListaHero, BottomNav |
  | 24 | 48 | Botón central |

- **Iconos que ya están en `assets/icons/`**: scan-face, camera, users, user-check, user-x, clock, calendar-check,
  chart-line, trending-up, triangle-alert, circle-check, check, lock, shield-check, bell-ring, graduation-cap,
  clipboard-list, file-spreadsheet, house, timer y otros.
- **Faltan para la UI fiel** (sacarlos de `web/node_modules/lucide-react` con el `lucide.mjs` de la v3 y verificar con
  `--verify --strict`): `layout-dashboard` (Panel), `search`, `clipboard-check` (Revisión), `file-chart-column`
  (antes `file-bar-chart`, Reportes), `layout-grid` (Módulos), `arrow-right`, `arrow-up-right`, `chevrons-up-down`,
  `menu`, `ellipsis`, `gauge` (StatCard «Ausentismo actual»), `trending-down`, `calendar-clock`, `file-text`,
  `camera-off`, `pause`, `timer-off`, `user-pen`.
- **Prohibido**: SVG de icono a mano, emojis, `▲ → ✓` como icono (usar `trending-up/down`, `arrow-right`, `check`) e
  iconos de estrella o destello como adorno (preferencia v3).
  - El riel real muestra «Asistente SUSAN» con `sparkles` en «Próximamente».
  - Al enseñar el riel, encuadrar por encima de «Próximamente» o dejarlo fuera de foco.

### 1.9 Desviaciones del kit v3 (`susan-presentacion/frame.md`) que la v4 corrige

| Kit v3 | Correcto (app) |
|---|---|
| `--g-gold: #c9a13a` | `#A8842C` (se oscureció en la app por contraste 3:1) |
| Prosa con «cobalt `#1e2bfa`» como acento único | La tinta `#1E1919` es el acento; el azul `#0061FE` solo para enlaces y foco |
| `gradient-a..d` `#8FB6FF #B79CF5 #F5A3C7 #FFC89A` | Holograma = `DEGRADADO` de Pasar lista (§1.3) y pasteles `tono-*` |
| Bloque de fuentes con Hanken Regular 400 | `HankenGrotesk-var.woff2` con `font-weight: 100 900` |
| `.su-btn` con radio 20 y peso 600 | Radio **16** (8 × 2) y peso **500** |
| `.su-av` «tinta sobre pastel» | App: círculo de color `TINTES` sólido con iniciales **blancas** 600. Las caras reconocidas en la cámara usan los avatares Lorelei (`assets/avatars/`) |
| `.su-st` 24 px / 600 | StatusChip md = 14/**500** → **28/500**, padding 8×20, punto de 12 |
| `.su-stat-v` 88 px | La cifra de StatCard es 30 → **60**. Las cifras de 120–180 son de escenario, no de la tarjeta |
| `.su-pill-g` (degradado + sombra violeta) | No existe en la app. Solo puede usarse como objeto de escenario y con el holograma de §3.4 |
| Cursor de mouse | Fuera (BRIEF) |

### 1.10 Bloque `:root` para el `frame.md` v4 (copiar tal cual)

```css
@font-face{font-family:"Hanken Grotesk";font-weight:100 900;font-style:normal;font-display:block;src:url("assets/fonts/HankenGrotesk-var.woff2") format("woff2");}
@font-face{font-family:"EB Garamond";font-weight:400;font-style:normal;font-display:block;src:url("assets/fonts/EBGaramond-Regular.woff2") format("woff2");}
/* cuando exista: @font-face{font-family:"EB Garamond";font-weight:400 800;…src:url("assets/fonts/EBGaramond-var.woff2")…} */
#root{
 --background:#F7F5F2;--foreground:#1E1919;--card:#FFFFFF;--primary:#1E1919;--primary-hover:#3A3433;
 --muted:#F0EDE8;--muted-foreground:#6F6A65;--accent:#EFECE7;--sidebar-accent:#EBE8E3;
 --border:#E7E2DC;--input:#D8D2CA;--link:#0061FE;--destructive:#B3261E;
 --brand-gold:#A8842C;--brand-gold-soft:#F6EDD3;
 --presente:#1F7A47;--presente-bg:#E3F4EA;--retardo:#9A6408;--retardo-bg:#FBEFD2;--ausente:#B3261E;--ausente-bg:#FBE4E1;
 --pendiente:#5B5651;--pendiente-bg:#EEEBE6;--justificado:#1F5FA8;--justificado-bg:#E1EDFA;
 --g-presente:#27A06A;--g-retardo:#C98100;--g-ausente:#DE4D44;--g-justificado:#4A86F0;--g-pendiente:#8F8A82;
 --g-azul:#4A86F0;--g-violeta:#8B6FE0;--g-dorado:#A8842C;
 --tono-azul:#E6EEFC;--tono-azul-fg:#1D5FD1;--tono-dorado:#FBF1D9;--tono-dorado-fg:#A8842C;--tono-verde:#E5F3EE;
 --tono-verde-fg:#1F7A47;--tono-violeta:#EEE9F7;--tono-violeta-fg:#6F4FB3;--tono-rosa:#FBE6E2;--tono-rosa-fg:#C2410C;
 --degradado:linear-gradient(105deg,#FF6AA9 0%,#FFB36B 28%,#8BE3B5 58%,#6BB8FF 100%);
 --shadow-lift:0 10px 30px rgba(30,25,25,.12);
 --e:2; /* escala de UI del cuadro (§2.0) */
 font-family:"Hanken Grotesk",system-ui,sans-serif;color:var(--foreground);
 font-variant-numeric:tabular-nums;letter-spacing:-0.003em;-webkit-font-smoothing:antialiased}
```

---

## 2. Escala y recetas de componentes

### 2.0 Escala recomendada

| Plano | E | Texto base | Qué cabe | Regla |
|---|---|---|---|---|
| General (AppShell completo de 1920×1080 css o teléfono entero) | 0.8–1.2 | 11–17 px | Toda la pantalla | **No se lee**. Contexto ≤ 1.5 s, o de fondo con rack focus hacia un componente |
| Medio | 1.6 | 22 px | 1 TarjetaGrafica (~600 css → 960 px) o 2 tarjetas lado a lado | Borde de 2 px |
| **Estándar** | **2.0** | **28 px** | Un componente héroe con su contexto inmediato | **Por defecto**. Coincide con los recortes 2× de `capture/app-real/crops/`: un snapshot del cuadro debe empatar con el recorte |
| Primer plano | 2.5–3.0 | 35–42 px | Una cifra, el anillo, un chip o un tooltip | Usar trazos de 2–3 px; nada de hairlines de 1 px |

**Implementación**: la UI se escribe con los px de la app (copiados de las clases Tailwind) dentro de un `.ui`.

- **Opción A (preferida)**: `zoom: var(--e)` en `.ui`.
  - El `zoom` estándar de Chromium escala layout, bordes, SVG y texto nítidos.
  - El **rig de cámara** (GSAP `x/y/scale/rotationX/Y`, `perspective`) va en un contenedor **padre sin zoom**: dentro del
    zoom, un `x: 10` mueve 20 px.
  - Verificar con `hyperframes snapshot` contra el recorte.
- **Opción B (si `zoom` da guerra en el render)**: un kit ya multiplicado (px × E), como el de la v3.
- **No escalar la UI con `transform: scale` sostenido**: rasteriza el texto borroso cuando hay `will-change` y
  complica el 3D.

### 2.1 Armazón de escritorio (AppShell + Sidebar)

- **Lienzo**: `#F7F5F2` a sangre.
- **Riel** de 232 px (`14.5rem`), sin borde ni fondo propio:
  - **Marca** (`px 20, pt 20, pb 12`): escudo UNACH de 32 × 32 + «SUSAN» 22/600 tight, separación 10.
  - **Lista** (`px 12`): «Panel» (`layout-dashboard`), «Buscar» (`search`, con `kbd` «⌘ K» 12 gris a la derecha) y
    «Pasar lista» (`scan-face`, sin grupo, justo debajo de Buscar).
  - **Grupos** con título 14/500 gris (`pt 20, pb 4, px 12`): «Asistencia» (Revisión `clipboard-check`, Reportes
    `file-chart-column`) y «Análisis» (Analítica `chart-line`). Después, «Próximamente» con fichas de 24 px `tono-*`,
    radio 6, icono 14/1.75 y `lock` 14 gris.
  - **Pie**: «Módulos» (`layout-grid`) y la cuenta: avatar 28 «PO» `#1F7A47`, nombre 14, «Docente» 12 gris y
    `chevrons-up-down` 16.
- **Ítem del riel**:
  - `min-height 40`, `padding 0 12`, separación 12, radio 10, texto 14, icono 20/1.5.
  - **Activo**: fondo `#EBE8E3` y peso 500, sin barra lateral.
  - Separación entre ítems: 2 px.
- **Panel principal**:
  - Blanco, margen 8 arriba, derecha y abajo, 0 a la izquierda (pegado al riel).
  - Radio 18, borde `rgba(231,226,220,.6)`, sin sombra.
  - Contenido centrado de `max-width 1088` con `padding 40 48`.
- **En el video**: el AppShell completo es un **objeto de escenario** (ventana) a E ≈ 0.8–1.0 con radio exterior 36 y la
  sombra de §3.8. Para leer, se empuja la cámara hacia un componente (E 2) en vez de recortar la pantalla.

### 2.2 Teléfono: TopbarMovil + BottomNav flotante

- **Pantalla**: 390 × 844 css. La topbar es crema; el contenido va sobre **blanco a sangre** (sin radio en el
  teléfono).
- **Topbar**: alto 56, `bg rgba(247,245,242,.95)` + blur, borde inferior `/70`, `padding 0 8`. Botones de 44 con icono
  20/1.5 (`menu`, `search`), marca (escudo + SUSAN) y avatar 36 «PO».
- **BottomNav**:
  - Píldora flotante a 12 px de los bordes, `max-width 448`, radio 28, borde `rgba(231,226,220,.7)`,
    **`rgba(255,255,255,.9)` + `backdrop-blur 24px` + `shadow-lift`**, padding 6, separación 2.
  - **Destino**: `min-height 52`, radio 18, icono 20/1.75 (activo 2), etiqueta 11/500 (activa 600). Activo con fondo
    `#EFECE7` y tinta; inactivo gris.
  - **Botón central del docente** («Pasar lista», `scan-face`):
    - Círculo de 56 de tinta con anillo blanco de 5 px y `shadow-lift`.
    - Sobresale −20 px; icono 24/1.75 blanco.
    - Etiqueta «Pasar lista» 11/600 debajo.
  - **Orden**: Panel · Revisión · [Pasar lista] · Reportes · Analítica.
- **Con E = 2**: píldora de ≤ 896 de ancho, radio 56, botón de 112, icono 48.

### 2.3 Saludo del Home (HomeRol + Resaltado + CampoComando)

- **Cabecera**: columna con separación 12.
  1. Eyebrow «Docente · FCA C-I» 14/500 gris.
  2. **h1 EB Garamond 500 52 px**, lh 1.05, tight: «Buenos días,» + «Patricia».
  3. Lema 16 gris (máx. 576 px): «Pasa lista en segundos y entiende la asistencia de tus grupos.»
  4. CampoComando.
- **Resaltado**: SVG `viewBox 0 0 100 12`, `preserveAspectRatio="none"`, ancho = palabra, alto 0.32em, bajo de −0.12em.
  - Trazado: `M2 8 C 22 3, 40 10, 60 5 S 90 4, 98 7`.
  - Trazo `#A8842C`, opacidad .75, `stroke-width 4`, extremos redondos, `pathLength=1`.
- **CampoComando**:
  - Alto 44, ancho máx. 448, radio 8, borde `#D8D2CA`, fondo blanco, `padding 0 12`, separación 10.
  - Lupa 18/1.5 gris; placeholder 14 gris «¿Qué quieres hacer hoy?».
  - `kbd` «⌘ K» 12, borde `#E7E2DC`, radio 4, `padding 2 6`.
- **Movimiento en la app**:
  - `BlurText` por palabra: blur 10 → 0, `y −0.5em → 0`, 0.7 s, +90 ms por palabra, `EASE.salida`.
  - El subrayado se dibuja en 0.9 s con 0.5 s de retraso.
  - Lema con `Reveal` (`y 16`, 0.6 s, retraso 0.2 s); campo con `Reveal`, retraso 0.3 s.
- **Con E = 2**: h1 104, eyebrow 28, lema 32, campo 88 × 896.

### 2.4 Card y TarjetaGrafica (contenedor de toda gráfica)

- **Card**: `rounded-xl` (14), borde 1 px, blanco, sin sombra.
  - Cabecera `padding 16 20 0` con título 16/600 tight.
  - Cuerpo `padding 12 20 20` (con cabecera) o `20` (sin ella).
- **TarjetaGrafica**: `figure`, radio 14, borde, `padding 20`.
  - Título 16/600 tight; descripción 14 gris (`mt 2`); acciones a la derecha.
  - Gráfica `mt 16`; pie 12 gris `mt 12`.
  - Con E = 2: `padding 40`, título 32, descripción 28.

### 2.5 PasarListaHero (la tarjeta de acción principal; equivale a «Order a card»)

- **Contenedor**: radio 14, borde, blanco, `padding 24`.
- **Fila superior**:
  - Izquierda: ficha 36 radio 10 `#E6EEFC` con `scan-face` 20/1.75 `#1D5FD1` + «Pasar lista» 14/500 gris.
  - Derecha: StatusChip «Programada» (tokens pendiente) o «Abierta» (tokens justificado).
- **Cuerpo** (`mt 16`):
  - Título 20/600 tight «Administración Financiera (3A)».
  - Detalle 14 gris «07:00 - 08:00 · Aula A-12».
  - «Cámara del aula lista» 14 con `camera` 16/1.75 `#1F7A47`.
- **Botón**: primario de alto 48 y ancho mínimo 256, «Abrir y pasar lista» con `scan-face` 20 y `arrow-right` 16.
  En teléfono va a todo el ancho.
- **Enlace**: «Otras sesiones de hoy (1)» + flecha, 14/500 `#0061FE`.
- **Con E = 2**: ficha 72, título 40, botón de 96 de alto.

### 2.6 StatCard (+ Sparkline)

- **Caja**: `min-height 120`, `padding 16`, radio 14, borde.
- **Cabecera**:
  - Pastilla 28 radio 8 con icono 16/1.75. Colores por tono:
    - neutral: `#F0EDE8` / `#6F6A65`
    - success: `#E3F4EA` / `#1F7A47`
    - warning: `#FBEFD2` / `#9A6408`
    - danger: `#FBE4E1` / `#B3261E`
  - Etiqueta 13/500 gris (2 líneas como máximo).
  - `arrow-up-right` 16 al 60 % si es enlace.
- **Pie** (`mt auto, pt 16`):
  - Cifra 30/600 tight lh 1 tabular en tinta; unidad `ml 4` 14/500 gris.
  - Hint 12/500 en el color del tono, `mt 8`.
  - Sparkline 80 × 28 a la derecha (como máximo el 45 % del ancho).
- **Ejemplo real**: «Ausentismo actual · 20.8 % · +4.2 pp vs. semana previa» (danger, `gauge`).
- **Movimiento**: `CountUp` de 1.1 s `easeOutCubic`, formato es-MX.
- **Con E = 2**: 240 de alto, pastilla 56/16, cifra 60, hint 24, sparkline 160 × 56.
- **Sparkline**: lienzo `ancho × alto`, margen 3.
  - Curva **suave** (es decorativa; es la única curva suave del sistema).
  - Trazo 2 con extremos redondos.
  - Área con degradado `currentColor` .28 → 0.
  - Punto final r 3.
  - Entrada: trazo `dashoffset 1 → 0` en 1.1 s `EASE.salida`; área con fundido de 0.9 s (retraso 0.2 s); punto con
    fundido de 0.4 s (retraso 0.9 s).
  - Solo con **serie real** de ≥ 2 puntos.

### 2.7 TarjetaPortada (componente firma, «Stacks» de Dash)

- **Caja**: ~196 × ≥ 196, radio 14, borde, `overflow hidden`.
- **Portada**: 72 de alto, en `tono-*` plano o `DEGRADADO`.
- **Ficha de icono**: 36, radio 10, en `left 16 / top 16`.
  - Blanca con borde `rgba(0,0,0,.05)` y sombra `0 1px 2px rgba(30,25,25,.08)`.
  - Icono 18/1.75 en `tono-fg`.
- **Cuerpo** (`padding 14 16 16`, separación 4):
  - Título 14.5/500 snug (2 líneas).
  - Meta 12 gris.
  - Pie 13 gris (`arrow-up-right` + «Abrir», o `lock` + «Próximamente»).
- **Hover**: la ficha sube 2 px y el fondo pasa a `accent/30`.
- **Con E = 2**: 392 × 400, portada 144, ficha 72, título 29.

### 2.8 TarjetaFila (componente firma, «Apps» de Dash)

- **Caja**: `min-height 72`, `padding 16`, separación 16, radio 14, borde.
- **Ficha**: 40 radio 10 en `tono-*`, icono 20/1.75 en `tono-fg`.
- **Textos**: título 14.5/500 tight truncado; subtítulo 13 gris (`mt 2`).
- **Acción**: circular a la derecha.
- **Con E = 2**: alto 144, ficha 80, título 29.

### 2.9 StatusChip

- **md**: `padding 4 10`, 14/500, separación 6, píldora, punto de 6 `currentColor`.
- **sm**: `padding 2 8`, 12/500.
- **Pares de texto y fondo**: §1.1.
- **Etiquetas reales**:
  - asistencia: Presente, Retardo, Ausente, Pendiente, Justificado, Sin lecturas
  - sesión: Programada, Abierta, Cerrada, Suspendida
  - origen: Automático (azul), Manual (gris), Corrección (ámbar)
  - consentimiento: Vigente, Revocado, Vencido
- **Con E = 2**: 28/500, `padding 8 20`, punto de 12.

### 2.10 Pills y Tabs

- **Pills**:
  - Separación 8; cada una `min-height 36`, `padding 0 16`, 14, píldora.
  - **Activa**: fondo `#1E1919`, **texto `#F7F5F2`** (es `text-background`, no blanco puro), 500.
  - Inactiva: `#F0EDE8` con tinta.
  - Contador: `min-width 20`, `padding 0 6`, 12, píldora. En la activa, `rgba(247,245,242,.2)` y texto crema; en la
    inactiva, blanco y gris.
- **Tabs**:
  - Fila con separación 24 y `border-bottom 1px #E7E2DC`.
  - Pestaña: `min-height 44`, 14/500.
  - **Activa**: tinta + subrayado de 2 px de tinta en `bottom −1`. Inactiva: gris. Contador «(n)» 12 gris.
- **Con E = 2**: pill de 72 de alto y subrayado de 4 px.

### 2.11 Button

- **Base**: radio 8, 500, separación 8, transiciones de 150 ms.
  - md: `min-height 40`, `padding 0 16`, 14.
  - sm: `min-height 32`, `padding 0 12`, 13.
- **Variantes**:
  - Primario: `#1E1919` con texto blanco (hover `#3A3433`).
  - Secundario: blanco, borde `#D8D2CA` (hover `#EFECE7`).
  - Ghost: transparente.
- **Flecha**: `arrow` = `arrow-right` 16/1.75 que se desplaza +2 px en hover.
- **Con E = 2**: 80–96 de alto, radio 16, 28/500.

### 2.12 Avatar

- **Tamaños** (círculo):
  - sm: 28 con 11 px.
  - md: 36 con 12 px.
  - lg: 56 con 18 px.
- **Color**: `TINTES` sólido (§1.3) con iniciales blancas 600 (dos primeras palabras).
- En listas fieles (tabla de sesión, login) se usan estas iniciales.
- Las **caras** de la cámara son Lorelei (`assets/avatars/`, CC0); nunca fotos.

### 2.13 AnilloEstados

- **Geometría** (SVG `viewBox 0 0 120 120`, rotado −90°: empieza a las 12 y gira en sentido horario):
  - `r 46`, `stroke-width 9`.
  - Pista `#F0EDE8`; arcos con extremos redondos.
  - **Hueco entre arcos de 12 unidades** (mayor que el grosor por los remates).
  - Un valor pequeño se dibuja como punto centrado en su tramo.
- **Lado**: `clamp(120, alto − 88, 196)` px (en la sesión, ~120).
- **Centro**:
  - Cifra 16–30/600 tabular tight; por defecto el total.
  - Etiqueta 12 gris `mt 6` («Inscritos», «Total» o «Asistencia»).
- **Leyenda** (separación vertical 6):
  - Por fila: punto de 10 + etiqueta 14 gris + cifra 500 tabular + % 12 gris (ancho 36, alineado a la derecha).
  - Estados en 0 al 55 % de opacidad; un valor positivo menor a 1 % se escribe «<1 %».
- **Colores en la sesión**:
  - Presentes `#27A06A`, Retardos `#C98100`, **Sin registro** `#DE4D44`, Pendientes `#8F8A82`.
  - En reportes: Ausencias y Justificadas `#4A86F0`.
- **Movimiento**:
  - Entrada: `stroke-dasharray 0 → largo`, 0.9 s `EASE.salida`, +0.09 s por arco.
  - **Datos vivos**: 0.5 s `dasharray` + `dashoffset`, sin reiniciar.
  - Escena nativa perfecta para el video, del recorte 31 → 32: anillo gris «24 Inscritos / Pendientes 24» → verde
    «Presentes 24». El arco gris se encoge mientras el verde crece en horario, en 3–4 pasos de 0.5 s. **Con los datos
    canónicos** (CONTENIDO §3.4) el anillo no llega a 24: termina en Presentes 19 · Retardos 2 · Pendientes 1 · Sin
    registro 2.
- **Con E = 2**: lado 240–392, cifra 60, leyenda 28.

### 2.14 BarrasPildora

- **Filas (ranking)**:
  - Rejilla `[nombres min(110px, 42%)] [pista 1fr] [cifra]`, separación entre columnas 12, entre filas 12.
  - **Nombre**: 13, `leading-tight`, 2 líneas como máximo.
  - **Pista**: 10 de alto, píldora `#F0EDE8`.
  - **Relleno**: píldora en `--g-*`, inset de 1 px por lado, mínimo 4 px.
  - **Cifra**: 14/500 tabular a la derecha.
- **Límite**:
  - Línea vertical discontinua de 1 px `rgba(179,38,30,.7)` a toda la altura.
  - Chip arriba: píldora `rgba(179,38,30,.1)`, 11/500 `#B3261E`, `padding 2 8`, «Límite 20 %».
- **Ejemplo real** (analítica 3A): «Alto» `#DE4D44` 70/66/64 y «Medio» `#C98100` 51…42, con leyenda de puntos de 10 y
  12 gris.
- **Columnas**:
  - `alto 260`, plano con margen superior 24 (cifras) e inferior 28 (categorías).
  - Barra de ≤ 48 de ancho (≤ 28 si hay varias series, separación 4), recorte con radio 12.
  - Cifra 12/500 a 6 px de la punta; categoría 12 gris; separación entre columnas 12.
- **Movimiento**:
  - Revelado con `clip-path` (filas de izquierda a derecha, columnas de abajo arriba), 0.85 s `EASE.salida`, +60 ms
    por fila.
  - La cifra aparece con fundido de 0.4 s a +350 ms (filas) o +450 ms (columnas). La cifra nunca aparece antes que su
    barra.
- **Con E = 2**: pista 20, nombres 26, cifra 28.

### 2.15 BarraSegmentada

- **Geometría**: alto 12 (grosor), separación 2 entre segmentos, segmentos en píldora proporcionales (`flex-grow`
  = %). Ancho mínimo por segmento: `max(4, alto/2)`.
- **Leyenda** (`mt 12`): 14, punto de 10, etiqueta gris, cifra 500, % 12 gris.
- **Movimiento**: revelado de izquierda a derecha con `clip-path`, 0.8 s, +80 ms por segmento; las actualizaciones
  mueven `flex-grow` en 0.5 s.
- **Con E = 2**: alto 24, separación 4.

### 2.16 TiraSemana (mapa de calor semanal)

- **Rejilla**: hasta 7 casillas, separación 8, cada casilla de ≤ 112 de ancho (7rem).
- **Casilla**:
  - `min-height 72`, radio 14, `padding 12 4`.
  - Cifra **arriba** 11–16/600 tabular con la unidad al 0.7em (500).
  - Día debajo, 10–12 en tinta.
- **Color**: `color-mix(in oklab, #DE4D44 X%, #F0EDE8)` con `X = round(min(1, valor / (1.25 · límite)) · 72)`.
  - Con límite 20: 12.5 % → X 36 → `#F0B7AC`; 17.7 % → 51 → `#EEA094`; 21.8 % → 63 → `#EB8D81`; tope 72 → `#E97F72`.
  - Si llega al límite: anillo de 2 px `rgba(179,38,30,.7)`.
  - Sin dato: `#F0EDE8` con «-».
- **Ejemplo real**: Lun 17.7 · Mié 16.4 · **Vie 21.8 (anillo)** · Sáb 12.5 · Dom 12.5.
- **Movimiento**: opacidad 0 → 1 + `scale .92 → 1`, 0.5 s `EASE.salida`, +70 ms por casilla.
- **Con E = 2**: casilla de 144 de alto, radio 28, cifra 32, anillo de 4 px.

### 2.17 GraficaLinea (+ tooltip y límite)

- **Lienzo**: SVG en px reales, sin `viewBox`, alto 280.
  - **Solo cuadrícula horizontal**: 1 px `#E7E2DC` al 80 %, `crispEdges`, sin líneas de eje.
  - Marcas Y: 11 gris, alineadas a la derecha en `izq − 8`.
  - Marcas X: 11 gris en `abajo + 18`.
- **Series**:
  - `linea`: trazo 2 con uniones y remates redondos. **Rectas entre puntos, nunca suavizadas.**
  - `puntos`: r 4 con relleno del color y **aro de 2 px blanco** (`--card`).
  - `banda`: degradado vertical del color, .34 → .10.
  - `discontinua`: `6 4`.
- **Límite**: horizontal `4 4`, 1.25 px, `#B3261E` al 75 %. Etiqueta en chip píldora `rgba(179,38,30,.1)` 11/500, o en
  la leyenda.
- **Marca vertical**: `#B3261E` al 55 %.
- **Configuración real de Analítica**:
  - Observada: puntos de **tinta** `#1E1919`.
  - Ajuste: línea `#4A86F0`.
  - Proyección: `#4A86F0` discontinua.
  - Intervalo 95 %: banda `#4A86F0`.
  - EMA: línea **dorada** `#A8842C`.
  - Límite 20 %.
- **Fila activa** (la guía del reel):
  - Línea vertical de 1 px `#6F6A65` al 55 %.
  - Puntos activos r 4.5 con aro blanco de 2.5.
  - **Tooltip fiel**: tarjeta **blanca**, borde, radio 10, `padding 8 12`, 12; título 500; por fila muestra de forma +
    etiqueta gris + valor 500 tabular; ancho mínimo 160; sin sombra ni pico.
- **Leyenda**: 12 gris. Muestras: punto de 10, línea de 16 × 2, discontinua de 16 con borde de 2, banda de 16 × 10
  radio 3 al 30 %.
- **Movimiento**:
  - Líneas que se dibujan en 1.2 s `EASE.salida` (retraso .05).
  - Bandas con fundido de 0.8 s (retraso .3).
  - **Puntos que brotan** (`scale .3 → 1`, 0.45 s) en ola de izquierda a derecha: retraso `.2 + .8·fracción_x`.
- **Con E = 2**: alto 560, trazo 4, puntos r 8, marcas 22.

### 2.18 MedidorLiquido (solo sesión en vivo y vista del alumno)

- **Tanque**: 84 × 168, radio 24, vidrio `#F0EDE8`.
  - Líquido en el tono: presente `#27A06A`, azul `#4A86F0` (la sesión de la captura usa **azul**), retardo, ausente o
    violeta.
  - Recortado con `clip-path` (polígono con la superficie inclinada).
  - 5 marcas a la derecha (22 % del ancho) en `currentColor` al 22 %.
- **Texto a la derecha** (separación 20):
  - Cifra 36/600 tight con `CountUp` de 1.3 s («100 %»).
  - Etiqueta 14/500 «Presentes ahora».
  - Descripción 14 gris «24 de 24 inscritos» en la captura; en el video, «21 de 24 inscritos» · 88 % (presentes +
    retardos, CONTENIDO §3.4).
  - Límite opcional: línea discontinua de tinta al 70 % + etiqueta 11/500 gris.
- **Física apta para seek**:
  - `nivel(t) = N·(1 − e^(−t/0.35)·cos(2π·t/0.9))`
  - `desnivel(t) = A·e^(−t/0.5)·sin(2π·t/0.6)` con A ≈ 6 % del ancho.
  - Se pinta con un tween `ease:"none"` cuyo `onUpdate` escribe el `clip-path`. Sin `requestAnimationFrame` propio.
- **Con E = 2**: tanque 168 × 336 radio 48, cifra 72.

### 2.19 VistaCamara (chips oscuros: el puente con el reel)

- **Marco**: 16:9, radio 14, fondo de tinta, `overflow hidden`.
- **Chips** (en `inset 12`):
  - Píldora `rgba(30,25,25,.8)` + `backdrop-blur 4px`, `padding 4 10`, texto blanco 12/500, separación 6.
  - Icono 14/1.75: `scan-face` con latido en «Reconociendo»; `pause` en «En pausa»; `timer-off` en «Fuera de la
    ventana».
  - A la derecha, «Cámara frente».
- **El simulador real dibuja cuadros magenta: no se copian.**
- **En el video** (decisión de escenario, sacada de los tokens):
  - Detección = esquinas de 2 px (× E) blancas con radio 8.
  - Al confirmar, las esquinas pasan a `#27A06A` y aparece debajo un StatusChip sm «Presente».
  - Nunca vectores, puntajes ni rostros reales.

### 2.20 Pulso sin cursor (cómo se cuenta un toque con la UI de la app)

Feedback nativo:

- Hover: botón `#1E1919 → #3A3433` y flecha +2 px.
- Foco: halo de 4 px `rgba(0,97,254,.3)`.
- Pill: inactiva → activa (tinta).
- Ítem del riel o destino del BottomNav: fondo `#EBE8E3`/`#EFECE7` + 500/600 + trazo 2.

**Receta**: `scale 1 → .97 → 1` (0.18 s) + cambio de color de hover y halo de foco de 8 px (× E) que entra en 0.15 s y
sale en 0.4 s. Suena `click-soft2` o `tap` (nombres de `assets/sfx/CATALOG.json`; el `click` crudo no se monta,
LECCIONES-V3 §2.1).

### 2.21 Movimiento de la app → GSAP

| App (`lib/motion`) | Definición | GSAP |
|---|---|---|
| `EASE.salida` | `cubic-bezier(0.22,1,0.36,1)` (≈ easeOutQuint) | `"power4.out"` (o `CustomEase` exacta) |
| `EASE.suave` | `cubic-bezier(0.4,0,0.2,1)` | `"power2.inOut"` (aprox.) |
| `EASE.resorte` | `cubic-bezier(0.34,1.56,0.64,1)` (= easeOutBack) | `"back.out(1.7)"`. Solo checks e insignias; en el video, 1–2 acentos como mucho |
| `salidaCubica` (CountUp) | easeOutCubic | `"power2.out"` |
| `DURACION` | rápida .2 · media .5 · lenta .9 s | Igual |
| `Reveal` | opacidad + `y 16`, 0.6 s | Igual (×E en px) |
| `BlurText` | blur 10 → 0 + `y −.5em`, 0.7 s, +90 ms por palabra | Igual; es el «blur-in» del rótulo del reel |
| `StaggerList` | `y 14`, 0.5 s, +60 ms, tope de .6 s | Igual (filas de la lista de asistencia) |
| Datos vivos | 0.5 s, sin reiniciar la entrada | Igual |

**Regla de la doble velocidad**: el micro-movimiento de la UI conserva estos tiempos (la app «se porta como la app») y
el escenario o cámara usa los del reel (`power3.out`/`expo.out` para llegar y `power3/expo.inOut` para viajar,
0.5–1.3 s). Nunca dos movimientos grandes a la vez.

---

## 3. La mezcla: cine del reel con identidad de SUSAN

### 3.1 Principio

El reel se ve caro por el **escenario**: cielo pastel, holograma, desenfoque, pose 3D, vidrio y píldora oscura. Su UI
es plana y sobria, igual que SUSAN. Por eso la mezcla es limpia:

- **La UI de SUSAN entra intacta** (§2).
- **El escenario se construye con la paleta de SUSAN.** SUSAN ya tiene un precedente para cada cualidad del reel:

| Cualidad del reel | Precedente nativo en SUSAN | Versión v4 | Límite |
|---|---|---|---|
| Cielo pastel | Portadas `tono-*`, sobre todo `tono-azul` | E1 «Cielo crema» | Solo en momentos héroe |
| Tarjeta holográfica | `DEGRADADO` de la portada de **Pasar lista** | E2 «Holograma Pasar lista» | Tarjeta héroe, marca y cielo. Nunca en datos |
| Grano | `.textura-grano` | Grano de 4–12 % en todos los escenarios | Estático o con salto determinista |
| Panel de vidrio flotante | BottomNav (`card/90` + blur + `shadow-lift`) | Dispositivo o ventana de vidrio en E1 | Vidrio solo en el marco; el contenido es opaco |
| Sombra suave | `shadow-lift`, tarjeta del login | Sombra del objeto de escenario (§3.8) | Nunca en tarjetas internas |
| Píldora oscura (tooltip) | Chips de VistaCamara, Pill activa | Tooltip de tinta `rgba(30,25,25,.88)` | Uno por escena; inclinación opcional (§3.8) |
| Desenfoque y rack focus | `BlurText` (blur 10 → 0) | Rack focus de cuadro y planos de fondo desenfocados | Nunca desenfocar lo que la voz está nombrando |
| Pose 3D | (no existe: vetada en la v2.3) | ≤ 8° de entrada, reposo en 0–3° | Mostrar en la hoja de bocetos con alternativa plana |
| Cifra grande con delta | StatCard (cifra + hint de tono + sparkline) | Cifra de escenario de 120–180 + chip de StatusChip o `trending-up` | El delta siempre con texto («+4.2 pp vs. semana previa») |

### 3.2 E1 «Cielo crema» (momentos héroe)

Cielo de `tono-azul` que baja a la crema, con nubes abstractas de blanco, oro suave y rosa (mezclas OKLab calculadas
desde los tokens).

```css
/* capa base (clip de fondo a pantalla completa) */
.esc-cielo{background:linear-gradient(180deg,
  #C6D8F7 0%,   /* tono-azul-fg 16 % en tono-azul */
  #D2E0F9 22%,  /* tono-azul-fg 10 % en tono-azul */
  #E6EEFC 48%,  /* --tono-azul */
  #EFF2F7 72%,  /* tono-azul 50 % en crema */
  #F7F5F2 100%)}/* --background */
/* nubes: un div por nube en 3 planos (lejos, medio, cerca), sin filter */
.nube-fria {background:radial-gradient(closest-side,rgba(255,255,255,.9),rgba(255,255,255,0))}
.nube-calida{background:radial-gradient(closest-side,rgba(246,237,211,.8),rgba(246,237,211,0))} /* brand-gold-soft */
.nube-rubor {background:radial-gradient(closest-side,rgba(251,230,226,.6),rgba(251,230,226,0))} /* tono-rosa */
/* grano: el SVG de .textura-grano (baseFrequency .9, 2 octavas, tesela 220 px), opacity .10, multiply */
```

- **Nubes**: elipses de 30–60 % del ancho, 2:1, en la mitad superior. Paralaje lineal de lejos 8 px/s, medio 18 px/s y
  cerca 32 px/s.
- **Grano**: estático, o con `tl.set` de posición cada 2 cuadros (determinista).
- **Sombra sobre el cielo**: teñida de azul, `rgba(29,95,209,.14)` (sale de `tono-azul-fg`), nunca gris de tinta (sobre
  azul ensucia).
- **Dónde va**:
  - Apertura y gancho (rack focus con placa pre-desenfocada o blur animado ≤ 24 px, `scale 1.15 → 1`; §3.7).
  - Presentación del producto (la tarjeta Pasar lista aterriza sobre el cielo).
  - Cierre (la marca sobre el cielo, que se aclara hacia la crema).
  - Un máximo de **3 apariciones**, y nunca bajo una gráfica.

### 3.3 E2 «Holograma Pasar lista» (superficie, no fondo)

Se aplica a una **superficie de escenario**:

- La tarjeta héroe: la anatomía de `TarjetaPortada` del módulo Pasar lista promovida a 1.6:1, con la portada al 55 % del
  alto. Ficha blanca con `scan-face` `#1D5FD1`, título «Pasar lista» y meta «Administración Financiera (3A) · 24
  inscritos».
- El fondo de la ficha de la marca (§4.4).
- Un barrido de brillo sobre el wordmark.

```css
.holo-base{background:rgba(255,255,255,.66);box-shadow:inset 0 0 0 2px rgba(255,255,255,.9)}
.holo{position:absolute;inset:-30%;opacity:.75;  /* se mueve con transform, nunca con background-position */
 background:
  radial-gradient(40% 50% at 78% 72%,#FF6AA9 0%,rgba(255,106,169,0) 70%),
  radial-gradient(35% 45% at 60% 90%,#FFB36B 0%,rgba(255,179,107,0) 70%),
  radial-gradient(40% 40% at 94% 50%,#8BE3B5 0%,rgba(139,227,181,0) 70%),
  radial-gradient(45% 45% at 70% 38%,#6BB8FF 0%,rgba(107,184,255,0) 70%),
  conic-gradient(from 200deg at 75% 70%,#FFD5E5,#FFE9D4,#DEF7E9,#D4EAFF,#E0D9F1,#FFD5E5);
 -webkit-mask-image:radial-gradient(70% 80% at 80% 80%,#000 35%,transparent 75%);}
.brillo{background:linear-gradient(105deg,transparent 42%,rgba(255,255,255,.55) 50%,transparent 58%)}
```

- **Tonos claros del cónico**: son las mezclas al 30 % con blanco de `DEGRADADO` + violeta: `#FFD5E5`, `#FFE9D4`,
  `#DEF7E9`, `#D4EAFF` y `#E0D9F1` (`#8B6FE0` al 10 % en `tono-violeta`).
- **Versión suave** para áreas grandes: los cinco `tono-*` (`#E6EEFC #EEE9F7 #FBE6E2 #FBF1D9 #E5F3EE`).
- **Movimiento**: el holograma rota de 0 a 8° y se traslada `xPercent −4 → 4` a lo largo de la toma, atado a la pose. El
  **brillo cruza una sola vez** (`xPercent −120 → 120`, 0.7 s, `power2.inOut`) al aterrizar, con `sheen` de sonido.
- **No usar** `mix-blend-mode` ni `filter` dentro de `preserve-3d`: aplanan el 3D.
- **Reglas**:
  - Nunca más de una superficie holográfica en el cuadro.
  - El texto sobre el holograma va en tinta con 500/600 y se verifica el contraste (≥ 4.5:1 sobre la mezcla más clara).
  - En reposo, la marca **vuelve a tinta**: el holograma solo pasa por encima.

### 3.4 E3 «Lienzo de datos con halo de módulo» (demostraciones de UI y gráficas)

Es el «mundo limpio» del reel: crema plana con un halo pastel del **tono del módulo** que se está mostrando. El color
del escenario cuenta en qué parte de SUSAN estamos, igual que las portadas.

```css
.esc-datos{background:
  radial-gradient(55% 60% at var(--hx,62%) var(--hy,48%), var(--halo) 0%, rgba(247,245,242,0) 72%),
  radial-gradient(120% 90% at 50% 40%, #F7F5F2 55%, #F3F1ED 100%);} /* viñeteo hacia muted 50 % en crema */
```

| Módulo o momento | `--halo` |
|---|---|
| Pasar lista, Panel, cámara en vivo | `#E6EEFC` (tono-azul) |
| Confirmación «24 de 24 presentes», Reportes | `#E5F3EE` (tono-verde) |
| Revisión, justificantes | `#FBF1D9` (tono-dorado) |
| Alertas, quién empieza a faltar (ausentismo) | `#FBE6E2` (tono-rosa) |
| Analítica: tendencia, proyección y riesgo | `#EEE9F7` (tono-violeta) |

- **Grano**: 4–5 %.
- **Profundidad opcional**: 1–2 tarjetas reales de la app (StatCard, TarjetaFila) detrás del componente héroe a escala
  0.5–0.7, `blur(8–14px)` y opacidad .5–.7, con paralaje contrario a la cámara. Desenfocar una capa precompuesta, no el
  cuadro entero.
- **Cambio de halo**: un `crossfade` del halo de 0.6–0.8 s al pasar de un módulo a otro. Ese cambio de color marca el
  relevo junto con el elemento compartido.
- **Dónde va**:
  - Toda la demostración de la app: Home, PasarListaHero, cámara y anillo, medidor, alertas con BarrasPildora,
    TiraSemana, GraficaLinea con guía y StatCards.
  - El problema, si no se usa la placa de tinta.

### 3.5 Recurso de transición opcional: placa de tinta

- Cuadro `#1E1919` con texto `#F3F0EC` y oro `#D9B65C` (8.9:1).
- Uso: 1 golpe de contraste como mucho (la cifra del problema, «10 minutos por clase») o un barrido de tinta que cruza
  entre mundos.
- No es un escenario: dura ≤ 1.5 s. La UI oscura de la app **no** se muestra.

### 3.6 Mapa de escenarios por papel narrativo

| Papel (el storyboard decide los tiempos) | Escenario | Objeto héroe | Notas |
|---|---|---|---|
| Gancho / apertura | E1 + rack focus | Saludo en serif o tarjeta holográfica | Única serif junto con el cierre |
| Problema (pase de lista lento) | E3 neutro (sin halo) o placa de tinta | Cifra grande | Sin UI aún, o una lista de papel abstracta |
| Producto: aparece SUSAN | E1 → E3 | Tarjeta Pasar lista (E2) que se vuelve PasarListaHero | Relevo con elemento compartido |
| Pasar lista en vivo | E3 halo azul → verde | VistaCamara + AnilloEstados + MedidorLiquido | Chips oscuros nativos; anillo gris → verde |
| Quién empieza a faltar | E3 halo rosa | BarrasPildora con límite, TiraSemana | El límite 20 % siempre con su etiqueta |
| Tendencia y proyección | E3 halo violeta | GraficaLinea con guía + tooltip de tinta | Tooltip fiel (blanco) o de tinta, uno por escena |
| Beneficio / resumen | E3 o E1 claro | StatCards + BottomNav de vidrio | |
| Cierre | E1 que se aclara a crema | Wordmark (§4) | Solo el nombre |

### 3.7 Reglas numéricas del escenario

- **Sombra del objeto flotante**: capa aparte (div con `radial-gradient` o `box-shadow` estático; **nunca** se anima
  `box-shadow`).
  - Sobre crema: `0 40px 120px rgba(30,25,25,.14), 0 8px 24px rgba(30,25,25,.08)`. Es `--shadow-lift` × 3–4 y suma
    contacto.
  - Sobre cielo: `0 40px 120px rgba(29,95,209,.14), 0 8px 24px rgba(29,95,209,.08)`.
  - La sombra se desplaza en sentido contrario a la inclinación.
- **Pose 3D**:
  - `perspective` 1600–2000 px en el padre.
  - Entrada `rotationX ≤ 8°`, `rotationY ≤ 10°`, `z −160 → 0`, 1.0–1.3 s `power3.out`/`expo.out`.
  - **Reposo en 0° (o ≤ 3°)**.
  - Solo el objeto de escenario completo se inclina; nada dentro gira por su cuenta (excepto el tooltip, abajo).
  - Sin pose en los momentos de lectura de cifras.
  - La persona dueña vetó la rotación en la v2.3: hay que enseñarla en bocetos con alternativa plana.
- **Desenfoque**:
  - Rack focus de cuadro: animado ≤ 24 px → 0 en superficies grandes (tope de la regla `depth-of-field-blur`), o placa
    pre-desenfocada (σ 18–32, imagen) que se funde sobre la capa nítida (REFERENCIA T1), 0.8–1.0 s `expo.out` (solo
    apertura y un cambio de mundo).
  - Planos de fondo: 8–14 px.
  - Texto que se va a leer: 0 px.
  - El `filter: blur` a pantalla completa es caro: usarlo ≤ 1.2 s por toma.
- **Vidrio**: solo el marco del dispositivo o ventana sobre E1, BottomNav y chips de cámara.
  - Receta: `rgba(255,255,255,.72)`, borde interior de 2 px `rgba(255,255,255,.8)` y desenfoque **falso** (copia de las
    capas del cielo, recortada y desenfocada).
  - `backdrop-filter` real solo en piezas pequeñas.
  - Las tarjetas internas siempre son `#FFFFFF` opaco con borde `#E7E2DC`.
- **Tooltip de tinta** (versión del reel):
  - Píldora `rgba(30,25,25,.88)`, texto blanco 24/500 tabular (E = 2), `padding 8 20`, sin pico.
  - Unidad al 0.7em; icono Lucide opcional de 28.
  - Entrada: `scale .6 → 1`, 0.35 s `back.out(1.4)` (uno de los 1–2 rebotes del video).
  - Inclinación opcional de −6° con alternativa recta (veto v2.3).
  - Se voltea al otro lado de la guía cerca del borde (como `posicionTooltip`).
- **Radios**: UI con los de la app × E (tarjeta 14 × E = 28 a E = 2; panel 18 × E = 36). Objeto de escenario: 36–56.
  Nunca radios «de reel» fijos (24–36 px independientes de E) en tarjetas internas: siempre el de la app × E.
- **Densidad**: ≤ 8 palabras por bloque en pantalla, una cifra protagonista por plano y cada cifra clave quieta ≥ 1.2 s
  (REFERENCIA §5).

### 3.8 No mostrar nunca

- UI de desarrollo:
  - «Reloj simulado: …» (está en las capturas del Home).
  - La tarjeta «Cámara simulada (demostración)» con «Solo desarrollo».
  - Los cuadros magenta y las iniciales del lienzo simulado.
  - El aviso azul «El reloj de demostración estaba detenido…».
  - «Reiniciar ciclos».
- La UI oscura, recharts o cualquier gráfica que no sea la familia de §2.
- Columnas de bitácora o de vectores.
- Cursor o mano.
- Marcas reales del reel, dinero o «$».
- Iconos no Lucide; `▲▼` como texto; estrellas o destellos como adorno.

---

## 4. Wordmark de SUSAN (no hay logo)

### 4.1 Lo que ya existe (BrandMark)

- **Compacto** (riel y topbar): escudo UNACH de 32 × 32 + «SUSAN» Hanken **600**, 22 px, `tracking-tight`, separación
  10.
- **Completo** (login): añade «Registro de asistencia» 12 gris debajo y el escudo FCA de 32 a la derecha.

Todo wordmark del video debe poder leerse como **esta misma marca, ampliada**.

### 4.2 A · «Marca de la app» (recomendado como lockup final)

- **Texto**: «SUSAN» en Hanken Grotesk 600, **200 px**, `letter-spacing −0.025em`, `line-height 1`, `#1E1919`,
  centrado. Mide ~640–660 px de ancho (medir en snapshot).
- **Firma dorada**: el trazo de `Resaltado` bajo la palabra completa.
  - Mismo trazado `M2 8 C 22 3, 40 10, 60 5 S 90 4, 98 7`, ancho = palabra, alto 64 px, a −24 px de la línea base.
  - `stroke #A8842C`, opacidad .8, `vector-effect: non-scaling-stroke`, **14 px** (≈ 0.07em), extremos redondos.
  - Se dibuja en 0.9 s `power4.out` 0.15 s después de que la palabra se posa. Suena `sheen` suave.
- **Lema opcional** (solo si el guion lo pide; por defecto, solo el nombre):
  - Hanken 500 40 px `#6F6A65`, 40 px bajo el subrayado, en una línea.
  - Texto: «Pasa lista en segundos y entiende la asistencia de tus grupos.»
- **Entrada** (sin rebote): letras con `BlurText` por letra (blur 12 → 0, `y 0.3em → 0`, 0.7 s, +45 ms por letra,
  `power4.out`), o la palabra entera desde `scale 1.06` + blur.
- **Brillo**: el holograma E2 cruza las letras una vez (máscara de texto con `background-clip:text` en una copia
  encima, que se desvanece); al final queda tinta.
- **Fondo**: E1 aclarado (de 70 % hacia abajo, crema) o crema E3 con halo azul. Zona segura de 1728 × 972.

### 4.3 B · «Serif institucional» (alternativa para bocetos)

- **B1**:
  - «SUSAN» en EB Garamond 500 (400 si no hay 500), mayúsculas, **184 px**, `letter-spacing +0.06em`, tinta.
  - Encima, filete dorado de 120 × 4 px `#A8842C` con radio 2.
  - Debajo, «REGISTRO DE ASISTENCIA» en Hanken 500 26 px, `letter-spacing .14em`, `#6F6A65` (es el subtítulo real del
    BrandMark).
  - Dialoga con las capitulares serif grabadas del escudo UNACH («AUTONOMA»): se ve académico.
- **B2**:
  - «Susan» en EB Garamond 500, **190 px**, mayúscula inicial, con el `Resaltado` dorado (14 px), como el saludo
    «Buenos días, Patricia».
  - Es cálido y personal, y cuadra con la voz, que dice «Susan».
  - Cambia la caja del nombre (la app escribe «SUSAN»): **solo con aprobación**.
- **Riesgo de B**: crea una segunda marca distinta de la del riel. Si se elige, la serif deja de usarse en el gancho
  para no gastarla.

### 4.4 C · «Ficha Pasar lista + marca» (icono de app, para el cierre tipo ref2-07)

- **Ficha**: el **botón central del BottomNav** a escala de marca.
  - Círculo de **168 px** `#1E1919` con `scan-face` blanco de 72 px (trazo 1.75), anillo blanco de 15 px y sombra
    `0 30px 90px rgba(30,25,25,.18)`.
  - Es el elemento más reconocible de SUSAN en el teléfono y la acción principal del docente.
- **C2 holográfica**:
  - Escuadra redondeada de 200 px, radio 48, con portada E2.
  - Ficha blanca interior de 112 px, radio 24, borde `rgba(0,0,0,.05)`, con `scan-face` 56 px `#1D5FD1` (es la ficha de
    `TarjetaPortada` × 3.1).
- **Lockup**: ficha + «SUSAN» (receta A) a **136 px**, separación 44, centrados en la altura de las mayúsculas.
- **Coreografía**:
  1. La ficha cae desde arriba con estela (`motion-blur` del registro, sin fleco cromático), 0.6 s `expo.out`, y se
     posa sin rebote.
  2. Se desliza a la izquierda (0.5 s `power3.inOut`) mientras la palabra se escribe a su derecha.
  3. Se dibuja el subrayado dorado.
- **Uso**: la ficha sirve también como sello en una tarjeta final de YouTube.

### 4.5 Recomendación

- **Cierre por defecto: A**, que es fiel a la marca existente.
- **C como coreografía de llegada que se resuelve en A**: la ficha cae y se posa, la palabra se escribe y la ficha se
  queda o sale. Da el «momento icono» de ref2-07 sin inventar un logo.
- **B, solo en la hoja de bocetos** como alternativa institucional.

**Tamaños resumidos a 1920 × 1080:**

| Variante | Tamaño | Gold |
|---|---|---|
| A sola | 200 px | 14 px |
| A con lema | 176 px + lema de 40 | 14 px |
| C | Ficha de 168 + marca de 136 | 12 px |
| B1 | 184 px | Filete de 120 × 4 |
| B2 | 190 px | 14 px |

### 4.6 Escudos UNACH y FCA (`assets/brand/`)

**Material:**

- `unach-escudo.png`: 320 × 289, RGBA con fondo transparente, **dorado oliva metálico** (~`#696640`–`#898558`).
- `fca-escudo.png`: 309 × 320, RGBA, dibujo de línea **negro**.
- Resolución baja: **no mostrarlos a más de ~200 px de alto** (se ablandan). Nunca recolorear ni recortar.

**Dónde sí:**

1. **Dentro de la UI fiel**, como en la app: riel y topbar (UNACH de 32 × E) y login (UNACH + FCA de 32 × E). Ahí son
   parte de la pantalla y no se tocan.
2. **Placa institucional opcional**, solo si la persona dueña la pide (la v3 registró «cierre solo con el nombre»):
   - Va **después** del lockup, ≥ 1.2 s, sobre crema E3 sin halo.
   - UNACH de 150 px de alto + filete vertical de 2 × 120 px `#E7E2DC` + FCA de 150 px, separados 56 px.
   - Debajo, Hanken 500 26 px `#6F6A65`: «Universidad Autónoma de Chiapas · Facultad de Contaduría y Administración,
     Campus I».
   - Entrada: solo opacidad + `y 12` (0.6 s `power4.out`).

**Dónde no:**

- Sobre el cielo E1 o el holograma E2: el oliva se ensucia y la línea negra vibra.
- Con brillo, inclinación, estela o rebote.
- Junto al oro de la marca en el mismo plano: son **dos dorados distintos** (`#A8842C` frente al oliva del escudo) y
  chocan.
- Dentro del lockup A, B o C.

---

## 5. Decisiones abiertas para la hoja de bocetos

1. **Pose 3D** (≤ 8° y reposo en 0–3°) y **tooltip inclinado −6°**, frente a sus alternativas planas (veto v2.3).
2. **Wordmark**: A (recomendado) / C → A / B1 / B2. Lema sí o no.
3. **Placa institucional** con escudos sí o no (por defecto, no).
4. **Sombra del objeto de escenario**: se desvía de la regla «sin sombra» de la app, aunque tiene el precedente de
   `shadow-lift` en el login y el BottomNav.
5. **Conseguir EB Garamond 500** (variable OFL) o aceptar 400.
6. **Un solo juego de datos** (resuelto por la crítica): el DOM de escritorio y el de teléfono dicen lo mismo
   («Registros pendientes de revisión 8», `dom/10-docente-home.html` y `.mobile.html`); el «3» venía de un PNG tomado a
   mitad del `CountUp` (0 → 8). La hoja canónica es `CONTENIDO.md` §3 (semilla real + instantánea de las 07:12); las
   cifras de LECCIONES-V3 §5 se retiraron.
   - Ocultar «Reloj simulado: …» y la tarjeta «Reloj de demostración (solo desarrollo)». La línea «Hoy: 2026-09-14» sí
     es UI real (`PanelDocente.jsx`) y puede quedarse.
7. **Iconos que faltan** en `assets/icons/` (§1.8): extraerlos y verificarlos antes de construir.
8. **Implementación de la escala**: probar `zoom: 2` contra el recorte `crops/21-analitica-3a--StatCard.png` en un
   snapshot. Si no empata, pasar al kit multiplicado.
