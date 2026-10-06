# SÍNTESIS v4: lo que el storyboard DEBE respetar

Fecha: 2026-10-06. Crítica de completitud sobre los seis documentos de `plan/`: `REFERENCIA.md` (reel 1, fintech, T1–T15),
`REFERENCIA-2.md` (reel 2, running, M1–M8), `LECCIONES-V3.md`, `PLAYBOOK.md`, `CONTENIDO.md` y `DISENO-APP.md`.
**Precedencia ante conflicto:** `BRIEF.md` > esta síntesis > CONTENIDO (qué se afirma y con qué cifras) > DISENO-APP (cómo
se ve) > PLAYBOOK (cómo se construye) > REFERENCIA/REFERENCIA-2 (lenguaje de movimiento) > LECCIONES-V3 (historia).
Abreviaturas de fuente: **B** BRIEF · **R1** REFERENCIA · **R2** REFERENCIA-2 · **L** LECCIONES-V3 · **P** PLAYBOOK ·
**C** CONTENIDO · **D** DISENO-APP · **[crít.]** verificado por esta crítica.

**Enmiendas con el plan aprobado (2026-10-06):** regla 2 (costuras de voz de 0.7–1.6 s, 2.1 s antes del sting), regla 6
(sin «2/3» en Revisión), regla 8 (se retira «3 lecturas confirman»: el video no dice ni muestra cuántas lecturas, capturas
o muestras confirman a un alumno, BRIEF) y regla 21 (rack focus de apertura con blur vivo ≤ 20 px y ≤ 0.9 s; placa
opcional, PILOTO §3a).

Dato de contexto corregido: la v3 **dura 50.75 s** (`susan-presentacion/index.html:53`), no 56 s; el STORYBOARD de la v3
describe la v1 (L §1.1) [crít.].

---

## 1. Decisiones y restricciones obligatorias (24)

### Historia, guion y voz

1. **Formato y estructura.** 1920×1080, **55 s ± 2**, 7–8 cuadros (`## Frame N`) de 5–9 s, cada uno con 2–3 tiempos
   internos de 2–3 s unidos por relevo (elemento compartido o morph), no 12 microescenas. El problema dura ≤ 7.5 s y
   **la marca y la primera UI de SUSAN están en pantalla antes del segundo 8–9** (la v3 la mostró en el 16.45). *Fuente:
   B, L §4.4/§4.7/§5, R1 §3.4, R2 §4.2.* El esqueleto de C §5 pone el nombre en el 11 s: hay que adelantarlo (ver §4).
2. **Voz primero, construida «lista para voz».** Guion de **95–105 palabras (tope 110)** a ~2.6–2.7 palabras/s
   (cobertura 65–75 %). Cada cuadro lleva `voiceover` (una línea, pistas separadas por pausas) y `vo_anchor` («palabra»
   @ t local); `SCRIPT.md` lleva una sola `## Line N — … (Frame N)` por cuadro, texto con sangría de 4 espacios y
   `**Anchor:**`. Silencio de 1.0–1.5 s al abrir, **0.7–1.6 s en cada costura entre líneas (≈ 2.1 s antes del sting
   del cierre)** y ≥ 1.5 s al cerrar. *Enmienda aprobada con el plan (2026-10-06): la cifra anterior, 0.3–0.5 s, no cabe
   con 65–75 % de cobertura en 55 s y una línea por cuadro; las costuras del storyboard miden 0.72–1.56 s y 2.13 s antes
   del sting.* Las 127 palabras de C §5 se recortan con sus propios corchetes (~105). *Fuente: L §4.5/§5, R1 §3.4, P §2,
   C §5.*
3. **Reglas de escritura para ElevenLabs:** «susan» en minúsculas (en mayúsculas la deletrea; vigilar que no suene
   italiana, probar «Súsan» si hace falta), cifras con letra («veinte por ciento»), «sin papeleo» en vez de «sin escribir
   nada». Ajustes probados en la v3: `eleven_multilingual_v2`, stability 0.35, similarity 0.8, style 0.45, semilla 1037,
   −17 LUFS por línea. *Fuente: L §3.6/§5, C §5.*
4. **Nunca estirar cuadros por la voz.** Prohibido `audio.mjs sync-durations` y `audio.mjs` (generate) mientras exista
   `SCRIPT.md`. Las anclas tienen ±0.3 s de holgura; si una frase real no cabe, se ajusta la escena por dentro o se
   recorta el texto. Ninguna palabra ancla ni lectura en los primeros `dur` segundos de un cuadro (los tapa la
   transición entrante, durante la cual el cuadro saliente está congelado). *Fuente: P §2.3/§3.5, L §3.7.*
5. **Texto en pantalla ≠ locución.** En pantalla: cifras, etiquetas reales de la UI y kickers de ≤ 8 palabras; nunca la
   frase narrada. La única repetición permitida es el lema del cierre. La cifra llega **antes** de que la voz la nombre y
   queda **quieta ≥ 1.2 s** mientras se nombra. *Fuente: L §4.6, R1 §3.4, C §5, P §4.*

### Datos y afirmaciones

6. **Una sola hoja de datos: `CONTENIDO.md` §3.** Escenario: lunes 14-sep-2026, 07:12, semana 7, Patricia Ortega
   (`avatar-16-po`), **3A · Administración Financiera**, Aula A-12, 24 alumnos, 47 sesiones, 9 faltas permitidas. Sesión
   en vivo (instantánea inventada pero coherente): **«19 de 24 presentes · 2 con retardo · 2 sin registro · 1 por
   revisar»**, medidor «Presentes ahora **88 %** · 21 de 24 inscritos» (presentes + retardos, regla verificada en la
   captura real). Panel: 8 pendientes, 4 justificantes. Revisión: Emilio Ramírez Núñez, sesión del 2026-09-12, «Quedan 2 h 48 min»,
   0.893/0.927 (sin «Lecturas válidas: 2/3»: retirado por la persona dueña el 2026-10-06), «Resolver como Presente
   (Sugerido)», 8 → 7. Analítica 3A: S1–S6 13.3 → **20.8 %** «+4.2 pp vs. semana previa», proyección S15 24.8 %,
   «Día crítico: Viernes» 21.8 %, «9 alumnos en riesgo». Alumno en riesgo: **Iván Cruz Rojas**, 7 faltas, 14.9 %, quedan
   2, Alto 64/100, cruce estimado semana 9. **Se retiran todas las cifras de la v3** (2 h 30, 21+2+1, HM 21.6 %, S1–S8,
   AG 71 %, 29/33, «listo en 6 s»). *Fuente: C §3/§6 [crít.: verificado contra `capture/app-real/dom`].*
7. **Trampas de coherencia que el storyboard no puede pisar:** solo nombres del 3A; «19.1 %» (no 19.2); «9 alumnos en
   riesgo» sin «de 25»; la marca «Límite 20 %» **nunca** junto a la tasa semanal 20.8 % (va en faltas acumuladas, barras por
   alumno o la fila de Iván); **no se muestra el cierre de la sesión de hoy** (las capturas 32–37 cierran con 24/24 = 100 %:
   solo sirven como maqueta); tira semanal solo Lun · Mié · Vie; escribir «límite» con tilde. *Fuente: C §3.4/§3.11 [crít.].*
8. **Afirmaciones:** solo las de C §1 y §4 (5 min por sesión, 4 h por grupo al semestre, «unas 20 h» con 5 grupos como
   **estimación**, ~~3 lecturas confirman~~ **[retirada por la persona dueña el 2026-10-06: el video no dice ni muestra
   cuántas lecturas, capturas o muestras confirman a un alumno; lo decidirá después]**, lo dudoso lo decide el docente,
   sin consentimiento no hay reconocimiento, sin fotos en la base de datos, bitácora). **Prohibido:** cualquier número
   de lecturas, capturas o muestras por alumno («tres lecturas», «Lecturas 1/3 → 3/3», «Lecturas válidas: 2/3»,
   cualquier x/3), cronómetros («en 6 s»), «anti-suplantación», «cifrado», «la IA aprende», «te avisa por correo»,
   «100 % preciso», «ahorra 20 h» como hecho, «app» para el alumno, módulos «Próximamente», UI de desarrollo (Reloj de
   demostración, «Reloj simulado», cámara simulada, cuadros magenta). *Fuente: C §1/§2/§4, D §3.8.*
9. **Funciones por prioridad.** Imprescindibles: pasar lista con cámara + sesión en vivo (clímax de producto), analítica
   (patrón + tendencia + proyección, clímax de datos), alumno en riesgo → acción (cierra el arco «a tiempo»), panel/tarjeta
   «Pasar lista» (entrada). Alta: revisión «Resolver como». Opcionales (≤ 3–4 s, o fundidas): reportes/«Exportar CSV»,
   «Mi asistencia» del alumno, confianza. Fuera: justificantes y pase manual como plano propio. *Fuente: C §2.*

### Identidad visual

10. **Dos capas.** La UI de SUSAN es **fiel** (tokens de D §1.10, radios de la app × E, bordes finos, sin sombra interna,
    Hanken Grotesk, Lucide, estados con texto + color). El **escenario** (fondo, cámara, profundidad, vidrio, brillo,
    sombra del objeto flotante) puede ser cinematográfico, pero solo con colores derivados de tokens. *Fuente: D §0/§3.1.*
11. **Escala y tipografía.** UI a **E = 2** por defecto (texto 14 → 28 px) con `zoom: var(--e)` en un `.ui` (probar contra
    `crops/` antes de construir; plan B: kit multiplicado); la cámara escala ≤ 1.3 y nunca rasteriza texto con un
    `transform: scale` sostenido. Pesos **≤ 600** (cifras de escenario 500–600, nunca 700+, aunque el reel 2 use heavy);
    `tabular-nums`; cifra héroe 120–180 px; ejes ≥ 22 px. Serif EB Garamond solo en 1–2 momentos (saludo del Home y, a lo
    sumo, un titular). *Fuente: D §1.5/§2.0, R1 §1.6, R2 §3.3 [crít.: R2 corregido de 700 a 600].*
12. **Color.** Tinta `#1E1919` = único acento estructural (botón primario, tooltip, bloque resaltado); oro `#A8842C` =
    chispa de marca, **a lo sumo un elemento de oro por cuadro** (nunca bajo «SUSAN»: BRIEF, ajuste del 2026-10-06; en la v4
    ningún cuadro lleva oro), nunca texto < 48 px ni junto a un chip «Retardo»; azul
    `#0061FE` solo enlaces y halo de foco; colores de estado solo con su etiqueta. Holograma = `DEGRADADO` real de la
    portada «Pasar lista» (`#FF6AA9 #FFB36B #8BE3B5 #6BB8FF`), solo en la tarjeta héroe y el brillo de la marca, nunca en
    datos. *Fuente: D §1.1/§1.3/§3.3, R2 §4.0 [crít.: R1 corregido, los `gradient-a..d` de la v3 no existen en la app].*
13. **Tres escenarios.** E1 «cielo crema» (máx. 3 apariciones: apertura, presentación del producto, cierre; nunca bajo una
    gráfica); E2 «holograma» (superficie, no fondo); E3 «lienzo de datos» crema con halo del tono del módulo (azul Pasar
    lista, verde confirmación/reportes, dorado revisión, rosa alertas/riesgo, violeta analítica). El cambio de halo marca el
    relevo. *Fuente: D §3.2–§3.6.*
14. **Pose 3D y rotación (decisión de bocetos).** La v2.3 vetó la rotación; el BRIEF pide «inclinación 3D suave». Regla
    única: solo el **objeto de escenario completo** se inclina; entrada con |rotationX| ≤ 8° y |rotationY| ≤ 10°, reposo en
    0–3°, **plano en cada lectura de cifra y en cada borde de cuadro** (handoffs con rotación 0); nada de giro en el plano
    (rotationZ) en cámara ni tarjetas. El tooltip inclinado es rotationZ: **por defecto recto**; la versión a −6/−8° solo
    si la persona dueña la aprueba en la hoja de bocetos, que enseña ambas. *Fuente: L §3.6/§5, D §3.7, R1 T3/T11, P §3.1
    [crít.: topes unificados en R1, L, P].*
15. **Sin cursor.** Ningún puntero ni mano (ni `mouse-pointer-2`). Un «toque» se cuenta con la UI: halo de foco nativo
    0.15–0.2 s antes, compresión `scale` 0.95–0.97 y recuperación `power3.out`, cambio de estado 0.04 s después y el
    efecto 0.1–0.2 s más tarde. Un aro de oro, como mucho una vez (botón «Pasar lista» del momento producto). Blueprints y
    reglas con ✗ en P §3.2/§3.3 (`cursor-ui-demo`, `cursor-click-ripple`, `cta-morph-press` en su variante de clic…) no se
    usan. *Fuente: B, D §2.20, R2 §3.7 [crít.: R1 T7 y §5 reescritos sin cursor].*
16. **Sombra y vidrio.** Tarjetas internas sin sombra. Solo el objeto flotante del video lleva sombra, en una capa aparte
    (nunca `box-shadow` animado), teñida (azul `rgba(29,95,209,.14)` sobre cielo, tinta sobre crema). Vidrio **falso**
    (copia recortada del cielo + velo blanco 72 %); `backdrop-filter` solo en piezas pequeñas y estáticas. *Fuente: D §1.7/§3.7,
    R1 T6, P §4.*
17. **Marca sin logo.** Cierre por defecto: wordmark **A** «SUSAN» Hanken 600 (136 px en la v4), **sin subrayado** (el
    subrayado dorado de `Resaltado` lo retiró la persona dueña: BRIEF, ajuste del 2026-10-06; nada lo reemplaza); llegada opcional **C** (la ficha circular de tinta con `scan-face`, el botón central del BottomNav, cae con
    estela y squash de volumen constante, sin rebote, y se resuelve en A). B (serif) solo como alternativa en la hoja.
    Cierre **solo con el nombre** (lema opcional, a decidir); sin escudos UNACH/FCA salvo dentro de la UI fiel. *Fuente: D
    §4, R2 M6, L §3.6.*

### Movimiento, transiciones y sonido

18. **Doctrina de movimiento.** Llegadas `power3.out`/`expo.out`, viajes y morphs `power3.inOut`/`expo.inOut`, 0.5–0.9 s
    (cámara/escenario) y los tiempos propios de la app para la UI (D §2.21). **Máximo 2 sobreimpulsos en todo el video**
    (tooltip pop o la pulsación de «Pasar lista»); el squash del sting no es rebote. Nunca dos movimientos grandes a la vez;
    sin respiración ni deriva lenta en la segunda mitad (solo vibración finita de baja amplitud); primer movimiento ≤ 0.2 s;
    héroe visible ≤ 0.5 s; ~~sin salidas salvo el último cuadro~~ **sustituido para la v4 (BRIEF, indicación tras el borrador
    completo, 2026-10-06): dinamismo con medida, algo nuevo cada ~2–3 s, un solo relevo a la vez, salidas con estela dentro de
    los cuadros y zooms solo como transición (`plan/DINAMISMO.md` §2)**; revelado secuencial al ritmo de la voz, nunca todo en
    el primer 25 %. Objetivo: ~25–30 % de movimiento grande, ~50 % micro-movimiento de datos, ~20–25 % lectura quieta, sin colas
    muertas ≥ 1.0 s. *Fuente: P §3.1, R1 §3.3/§3.4, L §4.3/§5, R2 §3.10.*
19. **Gramática de datos.** Cifras con odómetro (columna enmascarada, `tabular-nums`, sin reescribir texto por fotograma,
    un tic por columna al asentarse); líneas que se dibujan **antes** de que la guía las recorra (`svg-path-draw` →
    `chart-scrub-readout`, guía = cabezal, sin puntero); barras con `stat-bars-and-fills`; estela direccional en los relevos y
    odómetros (≤ 3 objetos a la vez; antes «1–3 golpes por escena», sustituido por `plan/DINAMISMO.md` §2.0) y nunca en texto
    que se lee quieto; el rack focus de lente solo en aperturas y cambio de mundo. Gráficas
    con la familia de la app (GraficaLinea rectas entre puntos, nunca suavizadas; TiraSemana; BarrasPildora; AnilloEstados;
    MedidorLiquido solo en sesión en vivo/alumno). *Fuente: R1 T8–T12, R2 M1/M2, D §2.13–§2.18.*
20. **Transiciones: tres familias como máximo, con mecánica válida.** Entre cuadros solo existen los 5 `transition_in` del
    registro (`crossfade`, `blur-crossfade`, `push-slide`, `zoom-through`, `squeeze`) o `cut`. Mapa de firmas:
    **A — relevo con elemento compartido** (recurso principal): `transition_in: cut` + `handoff_out`/`handoff_in` con números
    idénticos y la pieza en reposo plano (modelo: el match pixel-perfect del anillo de la v3). **B — empuje**:
    `push-slide LEFT 0.45–0.5s`, una sola dirección en todo el video. **C — foco**: `blur-crossfade 0.5s` solo donde cambia
    el mundo (cielo ↔ lienzo) o rack focus construido dentro del cuadro. `zoom-through` como mucho 1 vez (problema →
    producto); **nunca** `squeeze` ni disoluciones largas (lavan a crema). «Cut the curve», «zoom-through» del catálogo de
    cortes, morphs y rack focus son costuras **dentro** de un cuadro. *Fuente: P §3.4/§3.5, L §3.3/§4.4/§5, R1 §3.4/T13/T14
    [crít.: R1 T14 anotado].*
21. **Presupuesto de render.** Como máximo **una superficie grande desenfocada a la vez, ≤ 24 px y ≤ 1.2 s**; rack focus
    de apertura con **blur vivo ≤ 20 px durante ≤ 0.9 s** (driver `desenfoque`, `filter: none` en reposo; PILOTO §3a
    midió +12 ms por cuadro y un enfoque limpio), y **placa pre-desenfocada** (snapshot + `ffmpeg gblur`) **opcional**,
    solo para fondos desenfocados sostenidos más de ~1 s (enmienda aprobada con el plan, 2026-10-06); ≤ 3 objetos con
    estela por escena (filtro SVG en áreas chicas, `filter:none` en reposo); grano como imagen estática (PNG o data-URI)
    movida solo por `transform`/`tl.set`, nunca un `<filter>` vivo sobre el cuadro; no sumar un blur interno pesado con
    un `blur-crossfade`/`zoom-through` en el mismo instante; nada de `filter`/`opacity < 1`/`overflow`/`mask` en
    ancestros con `preserve-3d`. *Fuente: R1 §2.16/T1, R2 §3.10, P §4, D §3.7 [crít.: D corregido de 32 px a ≤ 24 px].*
22. **Sonido: solo SFX, sin música.** ~0.8–1 evento/s de 2–3 capas (≈ 1–2 SFX/s, frente a 4.0/s de la v3), golpes en el
    fotograma en que el movimiento llega o alcanza su pico; transitorios fuertes solo en los huecos de la voz; saltos de
    nivel ≤ 12 dB entre segundos; sin `whoosh-rev` antes de la voz del cierre; sin ticks por entero. Nombres **del catálogo
    derivado `assets/sfx/CATALOG.json`** (p. ej. `whoosh-s`, `whoosh-m`, `sheen`, `soft-in`, `click-soft2`, `tap`, `pop-1…4`,
    `draw`, `fill`, `blip`, `tick-1…4`, `thud`, `riser-s`); obsoletos prohibidos: `flash`, `sparkle-short`, `sparkle`, y los
    `.mp3` crudos. Los tiempos van en `sfx_cues` (segundos locales); `audio.mjs fetch-sfx` **no** se usa (pone todo en 0 s).
    *Fuente: R1 §3.2/§3.4/T15, L §2.1/§3.1/§5, P §1.3 [crít.: `sparkle` también está marcado `deprecated` en el catálogo].*

### Ingeniería del storyboard

23. **Formato que no rompe el pipeline.** `## Frame N — Título` (H2, «Frame» con mayúscula, N entero único); claves
    `- clave: valor` en la columna 0, una por línea; `blueprint:` exactamente `<id>`, `<id> (Adapt|Reproduce)` o `compose`;
    sin `;` dentro de las descripciones de `asset_candidates`; nada después del último cuadro; prosa sin viñetas `- X: …`;
    paquetes ≤ 48 KB (mencionar un id de regla lo incrusta; `kinetic-type-beats` y `logo-assemble-lockup` dejan poco
    margen). `## Video direction` no llega a los workers: se pega su extracto en cada dispatch. *Fuente: P §1.*
24. **Identificadores con letra.** `src: compositions/frames/sNN-nombre.html` → `frame_id` `sNN-nombre` (los scripts no
    exigen dígito inicial; evita los 480 avisos `id_requires_css_escape` de la v3). CLI fijada en `hyperframes@0.8.134`.
    Orden ante cualquier cambio: cuadro → `assemble-index` → `transitions inject` (nunca dos veces sobre el mismo índice) →
    `verify` → `check` → `snapshot`. *Fuente: L §2.3, P §1.3/§5 [crít.: verificado en las pruebas de los scripts; P
    corregido].*

---

## 2. Macroestructura recomendada (orientativa; el storyboard decide)

Cumple las decisiones 1, 2, 9 y 20. Tiempos absolutos aproximados; agrupar en 7–8 cuadros fusionando tramos contiguos.

| Tramo | ~Tiempo | Contenido (datos de C §3) | Escenario | Firma de entrada |
|---|---|---|---|---|
| Gancho + problema | 0–7.5 s | Apertura en rack focus; «5 min por sesión» → «4 h por grupo al semestre» (odómetro/morph de píldora, R2 M4); «unas 20 h» como estimación | E1 o E3 neutro | — |
| Marca → producto | 6.5–13 s | Sting/wordmark (C → A) en la bisagra; saludo «Buenos días, Patricia» (serif) y tarjeta «Pasar lista» (E2) que se vuelve PasarListaHero; pulso en «Abrir y pasar lista» | E1 → E3 azul | `zoom-through` o C |
| Pasar lista en vivo | 13–22 s | Cámara con avatares Lorelei, esquinas blancas → verdes en una ola, chip «Pendiente» → «Presente» (sin contador de lecturas, 2026-10-06), «19 de 24 presentes», medidor 88 % | E3 azul → verde | A |
| Revisión | 22–26 s | Caso de Emilio (sesión del 12-sep, «Quedan 2 h 48 min», 89 % y 93 %; sin «2/3»), «Resolver como Presente (Sugerido)», pestaña 8 → 7 | E3 dorado | A o B |
| Analítica | 26–35 s | «20.8 %» + «+4.2 pp», línea S1–S6 + proyección S15 con guía y tooltip de tinta; relevo a la tira Lun · Mié · Vie con «Día crítico: Viernes» | E3 violeta | B |
| A tiempo (Iván) | 35–41 s | Ranking BarrasPildora con «Límite 20 %»; rack focus a Iván: Alto 64, «quedan 2 faltas», cruce semana 9, acción sugerida | E3 rosa | A |
| Alumno / reportes (opcional) | 41–45 s | «Te quedan 2 faltas antes del límite.» en teléfono, o «Exportar CSV» | E3 verde | B |
| Confianza | 45–49 s | «Sin consentimiento, no hay reconocimiento» + 2 chips | E3 neutro | A o B |
| Cierre | 49–55 s | Wordmark A (+ lema opcional), ≥ 1.5 s de silencio final | E1 aclarado | C |

---

## 3. Riesgos abiertos

| Riesgo | Por qué | Mitigación (antes de despachar los cuadros) |
|---|---|---|
| **Costo de render del desenfoque y el 3D** | En Linux el render va por GL de software; el blur cuesta radio × área y los filtros SVG se rasterizan en CPU cada vez que cambia σ; `motion-blur` multiplica copias DOM × seeks | Construir **un cuadro piloto** con lo más caro (rack focus con placa + tarjeta 3D + holograma + una estela) y medir `npx hyperframes@0.8.134 render -c compositions/frames/<piloto>.html --quality draft` (tiempo de `capture`) y `benchmark`; fijar el presupuesto por escena con ese número |
| **`motion-blur` dentro de clips** | Según `extended-keyframe`, su copia DOM no es segura en clips temporizados | Probar con `snapshot` en los bordes del clip; plan B: `attachMotionBlurFilter` o la estela SVG de R2 §3.1 |
| **Tiempos de la voz** | 2.73 p/s de media, pero 1.69–3.94 por frase en la v3; la voz real llega al final | Anclas por palabra + holgura ±0.3 s; presupuesto de palabras por cuadro; frases cortas; recorte de texto antes que estirar; reservar ventanas de SFX; si se puede, una voz provisional para validar tiempos |
| **Pronunciación y cuenta de ElevenLabs** | «susan» detectada como italiano en la v3; «Antonio» exige plan de pago por API; no hay `ELEVENLABS_API_KEY` en `susan-v4/.env` | Tomas de prueba «susan»/«Súsan»; confirmar voz y plan con la persona dueña |
| **Fidelidad de la UI reconstruida** | `zoom: 2` puede comportarse distinto en el render; EB Garamond 500 no está (solo 400); 19 iconos Lucide faltan | Snapshot contra `crops/21-analitica-3a--StatCard.png` (D §5.8); conseguir EB Garamond variable (OFL) o aceptar 400; extraer iconos con `lucide.mjs --verify --strict` |
| **3D aplanado por transiciones** | `blur-crossfade`/`zoom-through` aplican `filter` y `opacity` al envoltorio `#el-<id>` | Poses planas en los bordes de cuadro (decisión 14); comprobar los pares de corte (−0.1/+0.2 s) en la hoja de contacto |
| **Sincronía y mezcla de SFX** | La máquina de la v3 (0 fallos a ≤ 33 ms) no está copiada en `susan-v4/scripts/` (solo hay `capture-app.mjs`) y espera el índice de `build-index.mjs` de la v3, la carpeta `v2/` y la CLI 0.8.114; `AJUSTES_CUE`/`EXTRA_TECLEO_DB` son de la v3 | Copiar y adaptar (`lib/rutas.mjs`, 0.8.134, catálogo sin alias) y validar con `test-sfx-toy.mjs` **antes** de construir; plan B: `audio_meta.json` editado a mano con los WAV derivados (golpe ≤ 10 ms del inicio) |
| **GSAP por CDN en el render** | Cada cuadro carga jsDelivr; el render necesita red | Verificar en el piloto; si falla, copia local de GSAP 3.14.2 (ya existe en `susan-presentacion/scripts/lib/vendor/`) |
| **Veto de la persona dueña** | Inclinación 3D, tooltip girado, sombra del objeto flotante y la ficha C son desviaciones de preferencias registradas | Enseñar cada una con su alternativa plana en la hoja de bocetos; no construir antes de la respuesta |
| **Medidor de ritmo de la v3** | `frame-check` castiga la deriva lenta intencional y mide con el runtime 0.8.114 | Recalibrar o usar solo como aviso; validar con `snapshot` de la 0.8.134 |

---

## 4. Lo que falta para escribir el storyboard

**Decisiones a pedir a la persona dueña (en la presentación del plan, paso 3):**
1. ¿Inclinación 3D suave (≤ 8–10°, plano al leer) sí o no? ¿Tooltip inclinado o recto?
2. Cierre: wordmark A solo, C → A (ficha que cae), o B serif; ¿lema «Pasa lista en segundos y entiende la asistencia de
   tus grupos» bajo el nombre o solo el nombre?
3. Voz: ¿otra vez «Antonio» (plan de pago) u otra voz es-MX?; ¿clave de ElevenLabs disponible?
4. ¿Incluir el tramo opcional (alumno o reportes) o dejar más aire a analítica?

**Prerrequisitos técnicos (orquestador, antes o durante el paso 3):**
5. Ruta «sin captura» de la skill: `capture/extracted/{tokens.json, visible-text.txt, asset-descriptions.md}` y copiar
   **plano** a `capture/assets/` los recortes elegidos de `capture/app-real/crops/` (ningún script lee `app-real/`). P §0.
6. `frame.md` v4 nuevo: tokens de D §1.10, `canvas: #F7F5F2` como **primera** clave de color que coincida (el ensamblador
   pinta el fondo con ella). Si se usa `build-frame.mjs`, sobrescribe `frame.md`: correrlo antes y retocar después. P §0, L §2.1.
7. Iconos faltantes en `assets/icons/`: `layout-dashboard`, `search`, `clipboard-check`, `file-chart-column`,
   `layout-grid`, `arrow-right`, `arrow-up-right`, `chevrons-up-down`, `menu`, `ellipsis`, `gauge`, `trending-down`,
   `calendar-clock`, `file-text`, `camera-off`, `pause`, `timer-off`, `user-pen`, `pencil` [crít.: verificados en disco].
8. Copiar y adaptar los scripts de la v3 (SFX, voz, medidores, `lucide.mjs`) según L §2.2–§2.3; derivar los SFX nuevos
   que pide el reel (swish de foco, whoosh suave largo, clic de UI fino).
9. EB Garamond 500 (variable OFL) o aceptar 400.

**Huecos de contenido que el storyboard debe resolver con los datos existentes:**
10. **Vista del alumno para Iván:** no hay captura de E260017; reconstruir sobre el layout de `50-alumno-e260001-limite`
    con las cifras de Iván y el texto real «Te quedan 2 faltas antes del límite.» (`alumno.utils.js`). C §2.8.
11. **Historial de sesiones** (si se usa la cascada M5 de R2): solo hay una sesión cerrada con cifras verificadas
    (vie 11-sep, 3A: 15 presentes · 1 retardo · 8 ausencias · 67 %, `dom/29-sesion-cerrada-18.html`); las demás hay que
    leerlas de la semilla o del reporte antes de ponerlas en pantalla.
12. **El gancho visual** no está decidido: rack focus sobre la tarjeta holográfica (R1/D), lista de nombres que se repite
    (C B1) o morph de la píldora «5 min por sesión» (R2 M4). Elegir uno y mantener la serif para un solo momento.
13. Las ventanas de C §5 deben moverse para cumplir la decisión 1 (nombre ≈ 6.5–8 s, no 11 s): fundir B1 y B2 en ≤ 7.5 s
    y quitar la segunda frase de B2 (la cifra «4 h por grupo» queda en pantalla).

---

## 5. Correcciones aplicadas por esta crítica (en los documentos fuente)

- **REFERENCIA.md:** T7 y §5 reescritos **sin cursor** (BRIEF); §4 «qué no copiar» prohíbe todo cursor; holograma
  `gradient-a..d` → `DEGRADADO` real de la app (§1.6, T4, §4, §5); radios de la tabla §1.6 a «app × E»; T3 con topes
  rotationX ≤ 8°/rotationY ≤ 10° y reposo ≤ 3°; T2 con la advertencia de `motion-blur` en clips y sin bandera `motionBlur`;
  T8 con el texto real del delta («+4.2 pp vs. semana previa»); T10 con Lun · Mié · Vie; T14 con la nota de que
  cut-the-curve/zoom-through del catálogo son costuras dentro del cuadro; §3.4 banda de contenido y ≤ 900 px; tabla de
  traducción con datos canónicos (botón «Abrir y pasar lista», barra móvil real Panel · Revisión · Pasar lista · Reportes ·
  Analítica, tira semanal, GraficaLinea S1–S6/S15 sin «Límite 20 %», cifras 20.8 %/88 %/9).
- **REFERENCIA-2.md:** «21 / 24 presentes» → «19 de 24 presentes» (formato y dato canónicos), resumen sin cierre de sesión,
  píldora del problema con 5 min × 3 × 16 = 4 h (fuera la cifra 2 h 30 de la v3), historial con la sesión cerrada real del
  11-sep, peso de cifra 700 → 600, «sin rotación» precisado como rotación en el plano.
- **LECCIONES-V3.md:** las cifras de demostración de la v3 en §5 marcadas como retiradas y remitidas a CONTENIDO §3; §0.6
  aclara que se conserva el escenario, no sus cifras; tope de inclinación unificado.
- **PLAYBOOK.md:** `src` con prefijo de letra (`sNN-nombre.html`) y nota de selectores; aviso de «solo formato» sobre el
  ejemplo de §1.4 (sus cifras, `sparkle` y el `src` numérico no son canónicos); ajustes de voz del ejemplo de `SCRIPT.md`
  → los probados en la v3; `@font-face` del esqueleto con `font-weight:100 900`; tope de inclinación unificado.
- **CONTENIDO.md:** §7 actualizado con las capturas nuevas (sesión en vivo 30–39, pase manual 45, portal del alumno 50–56,
  barra móvil) y la advertencia de que sus cifras son de la cámara simulada; regla del medidor «Presentes ahora»
  (presentes + retardos) verificada en `dom/39-escalonados-final.html` y anotada en §3.4.
- **DISENO-APP.md:** §5.6 resuelto (el «3 pendientes» del teléfono era un `CountUp` a medias; el DOM de ambos dice 8; la
  línea «Hoy: …» es UI real, solo se oculta «Reloj simulado» y la tarjeta del reloj); anillo y medidor con los datos
  canónicos; contradicción de radios de §3.7 resuelta (siempre app × E); rack focus de 32 px → ≤ 24 px animado o placa
  pre-desenfocada; SFX `click` → `click-soft2`/`tap` del catálogo.
