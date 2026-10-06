# DINAMISMO v4: gramática de relevos y plan por cuadro

Director de la ronda de dinamismo, 2026-10-06. Este documento es la especificación de los cuatro flujos que editan los cuadros
(`scripts/flujos/susan-v4-dinamizar.js`). Los workers editan el HTML actual de `compositions/frames/`, no empiezan de cero.
`STORYBOARD.md` ya trae estos tiempos en sus `Scene`, `sfx_cues` y `handoff_*`, con la revisión del crítico (§6) incorporada. Si algo de aquí choca con el storyboard, gana el
storyboard; si choca con el BRIEF, gana el BRIEF.

**La regla de la persona dueña (BRIEF, último bloque), en una línea.** Dinamismo = cambio de CONTENIDO, no movimiento de cámara, y
con medida («sin exagerar, que sea cada tanto, si no, se va a saturar»):
- algo nuevo cada ~2–3 s y ninguna composición igual más de ~3 s;
- un solo relevo a la vez; mejor pocos relevos limpios que muchos;
- lo que sale se va con estela direccional y lo nuevo entra desde el lado opuesto y se asienta suave;
- zooms solo como transición;
- se conservan duraciones, anclas de voz, datos de CONTENIDO §3 y las decisiones previas.

**Qué queda sustituido.** Estas reglas anteriores dejan de valer para la v4:
- «sin salidas salvo F8» (SINTESIS 18, `frame.md` §5.1, extracto de dispatch);
- los acercamientos de cámara sostenidos de adorno: F1 capa de barra 1.05, F2 1.04, F4 1.03, F5 → F6 1.05, F7 1.07;
- la advertencia de la regla `motion-blur-streak` del registro («never a mid-composition exit»): aquí las salidas con estela
  son el recurso principal.

Siguen vigentes: tramo muerto < 1.0 s (frame-check), lectura ≥ 1.2 s de toda cifra nombrada, pose 3D plana al leer y en los
bordes, 2 sobreimpulsos, sin cursor, sin número de lecturas, sin subrayado, tooltip recto y el presupuesto de render (SINTESIS 21).

---

## 1. Diagnóstico del corte actual

Render `renders/actual-draft.mp4` (draft, 30 fps, 55.0 s, 2026-10-06 05:37). Hay un fotograma cada 0.5 s en
`revision/dinamismo/actual/t-*.png` y una hoja por cuadro en `revision/dinamismo/actual/sheet-F1.png … sheet-F8.png`.

| Cuadro | Tramo del video (local) | Dura | Lo que se ve igual |
|---|---|---|---|
| F2 | 7.90–11.35 s (1.50–4.95) | 3.45 s | «SUSAN» + tarjeta Pasar lista. Solo cambian el despegue de 8 px, el brillo, el pulso del icono y el acercamiento 1.04 |
| F3 | 12.95–17.35 s (0.50–4.90) | **4.40 s** | «0 de 24 presentes» + la cámara con 23 rostros. Solo las esquinas, el chip «Pendiente» y dos latidos |
| F4 | 22.10–26.75 s (1.15–5.80) | 4.65 s | La misma tarjeta del caso. Le entran piezas (barras, botones, chip, aviso), pero el encuadre no cambia; acercamiento 1.03 de adorno |
| F5 | 27.30–33.95 s (0.55–7.20) | **6.65 s** | La misma tarjeta de días. Es el peor tramo del video; acercamiento 1.05 de adorno |
| F6 | 34.70–38.80 s (0.75–4.85) | 4.10 s | La gráfica semanal. La lectura es continua (guía, cifra, proyección, tooltip, banda), pero el encuadre es fijo |
| F7 | 43.80–49.00 s (2.40–7.60) | **5.20 s** | La tarjeta de Iván, con acercamiento 1.07 y regreso de adorno |

- **F1** no tiene tramos de más de 3 s: el más largo es «4 h» + rejilla, 3.65–5.45 s (1.8 s). Su capa de barra hace un
  acercamiento 1 → 1.05 (1.95–2.40 s) que es adorno.
- **F8** sostiene el lockup 2.9 s (51.5–54.4 s) antes del fundido. Es la firma y se acepta.

---

## 2. Gramática de relevos (5 tipos)

### 2.0 Reglas comunes (valen para los cinco)

1. **Medida.**
   - Un solo relevo a la vez. Si dos piezas tienen que dejar la pantalla en el mismo tramo, la de abajo NO viaja: la tapa
     la que se mueve (una sola estela, un solo desenfoque) y se apaga con `tl.set autoAlpha 0` ya cubierta.
   - Entre los inicios de dos relevos de composición pasan ≥ 1.5 s (el push-slide de entrada cuenta como uno); el objetivo
     es 2–3 s.
   - Dentro de una toma, la pieza que entró puede «armarse» con los tiempos de la app (cascada, odómetro, barras, trazo). Eso
     no es un relevo y es lo que mantiene la quietud < 1.0 s que mide frame-check.
2. **Anclas.** Toda cifra que la voz nombra está nítida, plana y quieta desde ≥ 0.3 s antes de la palabra hasta ≥ 0.3 s
   después. Ningún relevo empieza mientras se nombra.
3. **Dirección única.**
   - Lateral: lo que sale se va hacia la IZQUIERDA y lo nuevo entra desde la DERECHA, como el push-slide LEFT.
   - Vertical: lo viejo sale por ARRIBA y lo nuevo sube desde ABAJO, como una lista que se desplaza.
   - La única caída desde arriba es la de la ficha de F8.
4. **Estela = velocidad.** Usa el helper `conRastro` de `piloto/compositions/frames/s99-piloto.html` (PILOTO §3c), con:
   - σ = 0.29 · v · OBT, con OBT = 1/60 s, aplicada en un solo eje (`stdDeviation "σ 0"` o `"0 σ"`).
   - `filter: none` cuando σ < 0.3.
   - v = 0 cuando p ≤ 1e-4 o p ≥ 1 − 1e-4. Es el margen que encontró s06: GSAP redondea a 6 decimales.

   Topes de σ: 16 px en paneles grandes, 12 px en piezas, 10 px en secciones dentro de una tarjeta. Lo que se lee aterriza con
   σ = 0.
5. **Presupuesto.**
   - Como máximo 3 objetos con estela a la vez.
   - Una sola superficie grande desenfocada a la vez: ≤ 8 px en relevos, ≤ 20 px en el rack de F1.
   - Ningún desenfoque coincide con un push-slide ni con la blur-crossfade.
   - Cámara ≤ 1.3 y nunca sostenida fuera de 1. La toma siguiente siempre queda a escala 1.
   - Sin `will-change` en lo que escala (PILOTO §3b).
6. **Seek-safe.**
   - Un solo timeline pausado.
   - Cada tramo de movimiento lleva su propio envoltorio: interno = entrada, externo = salida. Así los `aplicar()` de arranque
     de dos drivers no se pisan; el piloto los llama al construir.
   - El filtro va en una hoja interior. Nunca en el padre con `perspective` ni en la cámara.
   - Los intercambios de capa van con `tl.set(..., {autoAlpha})` en el instante exacto.
   - Los desenfoques de capa usan drivers puros (`desenfoque` y su inverso, abajo); nunca `tl.set(filter:'none')`.
   - Prueba obligatoria: buscar hacia delante y hacia atrás t − 1/60, t y t + 1/60 alrededor de cada relevo. Tiene que dar el
     mismo fotograma y `filter: none` en reposo.
7. **Sonido.**
   - Cada relevo suena en su pico de velocidad, con anclaje `pico` en whoosh.
   - Dentro de una frase de voz, −3 a −6 dB.
   - Nada fuerte (impact, snap, check, chime) sobre la voz.

Driver inverso de `desenfoque`, para la capa que se va (mismo patrón que PILOTO §3a):

```js
function desenfocar(el, at, dur, hasta, curva) {            // 0 → hasta px; none mientras < 0.05
    var st = { d: 0 };
    function aplicar() { el.style.filter = st.d < 0.05 ? 'none' : 'blur(' + st.d.toFixed(2) + 'px)'; }
    aplicar();
    tl.fromTo(st, { d: 0 }, { d: hasta, duration: dur, ease: curva, onUpdate: aplicar, immediateRender: false }, at);
}
```

### 2.1 R1 · Látigo (lateral)

**Para qué.** Cambiar un panel, una lista o una tarjeta por otra del mismo nivel. Es el relevo típico de la persona dueña.

**Salida.**
- x 0 → −(560…900) px, o lo que haga falta para dejar el cuadro más 80 px.
- 0.35–0.40 s con `power2.in`: la velocidad máxima llega al final.
- Opacidad 1 → 0 en el último 40 % (`power1.in`) y `tl.set autoAlpha 0` al terminar.
- Estela horizontal, tope 16.

**Entrada.**
- x +(320…640) → 0.
- 0.50–0.60 s con `power3.out`. Para piezas ≤ 400 px vale `expo.out`, con la estela topada en 12.
- Opacidad 0 → 1 en los primeros 0.15–0.18 s.
- La estela se apaga (σ < 0.3) antes del último 35 % del tramo.
- Si la pieza es el objeto flotante, la pose suave viaja en el mismo tween: rotationY −8 → 0 y rotationX 5 → 0, plana al
  terminar. La sombra hace el mismo tween 3D y aparece en los últimos 0.25 s (PILOTO §3b corregido).

**Solape.** La entrada arranca cuando la salida va al 65–75 %, unos 0.1 s antes de que termine. Los dos picos de velocidad
coinciden en el «instante de cambio».

**Sonido.** `whoosh-s` (pieza ≤ 600 px) o `whoosh-m` (panel o tarjeta) en el instante de cambio. Sin golpe al aterrizar; si lo
que llega es una cifra o un chip, como mucho un `pop-*` a −6 dB.

### 2.2 R2 · Relevo vertical (sube y sube)

**Para qué.** Reemplazar algo en la misma columna o dentro de la misma tarjeta: secciones de una ficha, una unidad («240 min» →
«4 h»), un aviso que llega.

**Salida.**
- y 0 → −(80…160) px, 0.30–0.35 s con `power2.in`.
- Opacidad → 0 en el último 40 %.
- Recortada por la caja que la contiene, con un desvanecido de 24 px arriba y abajo (la máscara del odómetro de PILOTO §3c).
- Estela vertical, tope 10–12.

**Entrada.** y +(80…160) → 0, 0.45–0.50 s con `power3.out`, opacidad 0 → 1 en 0.15 s, estela tope 10.

**Solape.** 0.10–0.15 s.

**Sonido.** `whoosh-s` a −6 dB en el cambio. Si lo que entra es un chip o un renglón, `pop-2`/`pop-3` a −6 dB al iniciar la
entrada. Si es un odómetro, su `tick-*` al asentarse.

### 2.3 R3 · Atravesar (zoom solo como transición)

Dos formas. Ninguna se queda en una escala ≠ 1: el zoom ES el cambio de toma.

**(a) Atravesar con corte bajo desenfoque.** El elemento destino se vuelve la toma siguiente.
1. **Empuje.** Lo hace la cámara de la capa de contenido; nunca el fondo ni el halo.
   - scale 1 → 1.25–1.30, con origen en el elemento destino.
   - Traslación que lleva ese elemento al lugar que ocupa en la toma siguiente.
   - 0.45 s con `power2.in`.
   - `desenfocar(capa, …)` de 0 → 6–8 px en los últimos 0.25 s.
2. **Corte.** En el pico, `tl.set` intercambia la capa por la toma siguiente; si hace falta, un fundido de ≤ 0.08 s.
3. **Llegada.** La toma siguiente ya está maquetada a su E final (`zoom`, nítida).
   - Entra de scale 0.88–0.94 → 1 con origen en el mismo punto.
   - Desenfoque 6–8 → 0 en 0.50–0.55 s con `expo.out` (driver `desenfoque`).

Los números están calculados para que, en el corte, el elemento destino tenga el mismo centro y casi el mismo tamaño en las dos
capas (±5 %). Por eso el corte no se ve.

**Todo lo visible coincide en el corte, no solo el destino.** Si la toma siguiente maqueta otra pieza visible (una píldora, un
rótulo) en otra proporción que la capa del empuje, esa pieza no llega con la escala común: llega en su propia capa desde el
centro y la escala exactos que tenía en el último fotograma del empuje (medidos en el HTML) hasta su lugar final, con la misma
curva, la misma duración y el mismo desenfoque que la toma. Un salto hacia atrás de 2–3 fotogramas de recorrido se ve como un
tropiezo aunque vaya desenfocado.

**(b) Abrir a pantalla completa y volver.** El elemento mismo crece desde su caja hasta cubrir el cuadro.
- `transform-origin: 0 0`, x/y/scale, 0.5 s con `expo.inOut`.
- El radio baja a 0 por `clip-path`.
- Su cromo (chips, rótulos) NO escala: viaja con las esquinas o con su punto de anclaje a tamaño nativo, con el mismo ease y
  la misma duración.
- La vuelta («salir para revelar el contexto») es el mismo tween al revés y termina exactamente en la caja original.
- Desenfoque ligero ≤ 4 px solo en el tercio rápido, a la ida y a la vuelta.
- La escala cubre el cuadro con holgura (≥ 1 px por lado): sin hilo de fondo en los bordes.
- La pieza que se abre va por encima (z) de lo que tapa; lo tapado no viaja (§2.0.1).
- La toma abierta dura ≤ 2 s. El escalado sin `will-change` es nítido (PILOTO §3b), pero se revisa en un cuadro del MP4.

**Prohibido.**
- Acercamientos de más de 0.6 s sin cambio de contenido.
- Respiración y deriva.
- Cámara sostenida a 1.03–1.07.
- Atravesar dos veces seguidas en el mismo cuadro sin una toma de ≥ 1.4 s en medio.

**Sonido.** `whoosh-l` en el pico: −3 dB en un hueco de voz, −6 dB dentro de una frase. En la vuelta de (b), `whoosh-m` a −6 dB.

### 2.4 R4 · Cambio de foco (rack-swap)

**Para qué.** Lo viejo se queda como contexto y lo nuevo pasa al frente sin viajar: de una lista a la fila elegida.

**Lo viejo.** Blur 0 → 4–6 px, opacidad → 0.35–0.45 y scale 1 → 0.97, en 0.30–0.35 s con `power2.out`. El desenfoque vuelve a
`none` antes de que se lea algo encima, y el desenfoque total dura ≤ 1.0 s.

**Lo nuevo.** Se queda nítido y se ilumina (#EFECE7, borde de tinta) o se despega (scale 1.03–1.04, z +40) en 0.30 s con
`power3.out`.

**Sonido.** `tap` o `click-soft2` a −6 dB si se lee como selección; nada si es solo foco.

### 2.5 R5 · Morph (un componente se vuelve el siguiente)

**Receta.** La de siempre (card-morph-anchor):
- la superficie se maqueta en su caja final;
- `clip-path: inset(… round R)` desde la caja de origen, 0.55–0.8 s con `power3.inOut`;
- el contenido viejo sale antes del 40 % y el nuevo entra después del 60 %;
- el fondo cambia como pintura;
- nunca escala no uniforme ni tweens de `width`/`height`.

**Sonido.** `whoosh-s` en la mitad del tween, o `soft-in` al inicio si es lento.

### 2.6 Dónde se usa cada uno

| Relevo | Cuadros |
|---|---|
| R1 látigo | F4 (lista → tarjeta del caso), F5 (las tres casillas entran juntas, solo entrada), F6 (la gráfica sale) |
| R2 vertical | F1 (las barras de la semana suben; «240 min» → «4 h»), F4 (aviso), F7 (sección «Faltas» → «Cruce + Acción»), F8 (la ficha cae) |
| R3 atravesar | F2 (a) al botón, F3 (b) la cámara a pantalla completa y de vuelta, F5 (a) al viernes |
| R4 foco | F4 (fila de Emilio), F7 (fila de Iván) |
| R5 morph | F1 (barras → rejilla, astillas → ficha), F2 (ficha → botón, botón → cámara), F6 (casilla → gráfica, tooltip → píldora), F7 (píldora → ranking, fila → tarjeta) |

---

## 3. Plan por cuadro

Los tiempos son locales del cuadro. «As is» quiere decir que se conserva lo construido. Las duraciones, el `voiceover` y el
`vo_anchor` no cambian.

### F1 · Cinco minutos cada clase (6.40 s): sin cambios de fondo

F1 ya cambia de contenido cada ~1 s.

| t | En pantalla | Relevo | Voz |
|---|---|---|---|
| 0.00–1.15 | barra de una clase (rack de apertura) | — | silencio hasta 1.00 |
| 1.15–2.00 | «5 min» rueda y se pintan 5 min de tinta (1.75) | — | «cinco» 1.97 |
| 2.00–2.95 | suben las barras Lun/Mié/Vie | R2 | «cada clase» |
| 2.95–3.65 | barras → rejilla del semestre; «240 min» → «4 h» | R5 + R2 | «cuatro» 3.96 |
| 3.65–5.45 | «4 h» + rejilla; a 4.45 «= 240 min» y la onda | — | «horas por grupo al semestre» |
| 5.45–6.20 | astillas → ficha (handoff) | R5 | — |

**Único cambio.** Quitar el acercamiento de adorno de la capa de barra (scale 1 → 1.05 de 1.95–2.40 y su regreso dentro del
pliegue). Las barras de la semana que suben ya son el evento de ese tramo.

Si frame-check vuelve a marcar el tramo 1.1–3.0 s, se acepta como en la construcción: lo que se mueve tiene bajo contraste.
**No se reemplaza por otra escala.**

`sfx_cues` sin cambios: `0.10 soft-in -3dB; 1.65 tick; 1.75 draw; 2.00 soft-in -9dB; 3.25 whoosh-s; 3.25 scan -3dB; 3.65 tick-2; 5.75 whoosh-m; 6.05 pop-1`.

### F2 · Te presentamos a susan (6.05 s)

| t | En pantalla | Relevo | Voz |
|---|---|---|---|
| 0.00–1.30 | ficha → botón; la tarjeta se arma alrededor (as is) | R5 | «Te presentamos…» |
| 1.15–1.83 | «SUSAN» se escribe; despegue de 8 px a 1.95–2.40 (as is) | — | «susan» 1.85 |
| 2.85–3.30 | **empuje hacia el botón** | R3a | «Abres la sesión» |
| 3.30–3.80 | **toma de cerca**: la tarjeta a E = 3.2 llega y se asienta | R3a | — |
| 3.95–4.45 | el brillo cruza el botón grande | — | «con un solo» |
| 4.78–5.22 | halo → toque → «Programada» → «Abierta» (as is) | — | «botón» 4.84 |
| 5.30–5.90 | **botón → marco de la cámara** | R5 | — |

**Empuje (2.85–3.30, R3a).**
- La cámara (rig, sombras y la capa de la marca) va de scale 1 → 1.25 con origen (1264, 650).
- x 0 → −304 y y 0 → +37.2, con `power2.in`.
- La capa de escena se desenfoca 0 → 6 px entre 3.05 y 3.30.
- «SUSAN» sale por la izquierda con el empuje: para este tramo la marca va con la cámara y queda en x < 170. No desaparece de
  golpe en el corte (a 3.30 todavía asoma su «N»): su opacidad baja 1 → 0 entre 3.12 y 3.30 (`power1.in`), mientras viaja
  rápido y desenfocada.

**Toma de cerca (3.30–3.80).** A 3.30 se intercambia la capa por la tarjeta PasarListaHero maquetada a E = 3.2:
- tarjeta de 1136 × 928 px, x 392–1528, y 76–1004, radio 44.8;
- botón de 1008 × 153.6 con centro (960, 687.2) y radio 25.6;
- el chip «Programada» queda visible arriba a la derecha, y ≈ 127–170.

Llega de scale 0.94 → 1, con origen (960, 687.2), y desenfoque 6 → 0, entre 3.30 y 3.80 con `expo.out`.

Comprobación del corte: el botón mide 945 px en las dos capas y el centro de la tarjeta queda en y ≈ 549 en las dos. La
sombra-cielo va en su capa con la misma caja y el mismo tween.

**Morph a la cámara (5.30–5.90, R5).** El botón de tinta se vuelve el marco de la cámara, también de tinta:
- `clip-path` desde la caja del botón (x 456–1464, y 610.4–764, r 25.6) hasta la de la cámara (x 880–1780, y 200–706, r 28);
- 5.30–5.52: se apagan la superficie blanca, su contenido y la sombra-cielo (antes del 40 %);
- 5.30–5.48: salen el rótulo y la flecha del botón;
- 5.66–5.90: entran «Reconociendo» y «Cámara frente»;
- 5.30–5.90: el mundo pasa de cielo a E3 con halo azul (la capa nueva encima);
- 5.60–5.90: aparece la sombra de tinta de la cámara.

El handoff_out no cambia.

**Se quita.** El acercamiento 1.04 (3.65–4.45) y el pulso del icono camera (3.50–4.05). Es por medida: la toma de cerca ya es
el cambio de ese tramo.

**Activos.** `assets/home-pasar-lista-hero.png` (a 2x, la referencia de la toma de cerca) y `assets/sesion-camara-en-pausa.png`.

`sfx_cues`: `0.10 soft-in -6dB; 0.40 whoosh-s; 1.15 pop-2 -3dB; 3.30 whoosh-l -6dB; 3.95 sheen-s; 4.95 tap; 5.00 click-soft2 -3dB; 5.60 whoosh-m`

### F3 · La cámara pasa lista (8.50 s)

| t | En pantalla | Relevo | Voz |
|---|---|---|---|
| 0.10–0.50 | 23 rostros pueblan la cámara (as is) | — | «La cámara» 0.63 |
| 0.45–0.95 | **NUEVO: encabezado real de la sesión** en la columna izquierda | cascada | «del aula» |
| 1.30 / 1.60 | detección (as is); chip «Pendiente» del rostro central (as is) | — | «pasa lista» |
| 2.45–2.95 | **la cámara se abre a pantalla completa** y, al crecer, tapa el encabezado (que no viaja) | R3b | «por ti» |
| 2.95–4.40 | **la clase a pantalla completa** | — | «mientras das tu clase» |
| 4.40–4.90 | **vuelta a la caja**, que revela la columna «Asistencia ahora · 0 de 24 presentes» | R3b | «…» |
| 4.90–7.30 | ola, «Presente», 0 → 19, BarraSegmentada, línea, «Última captura…» (as is) | — | «alumno» 6.00, «presente» 6.96 |
| 7.30–8.30 | MedidorLiquido 88 %, halo verde, quieto desde 8.30 (as is) | — | — |

**Encabezado (0.45–0.95, nuevo).** Es el PageHeader real de la sesión, en StaggerList (y 14 → 0, 0.5 s, +60 ms):
- «Pasar lista»: Hanken 500, 52 px, borde izquierdo x = 140, tope y = 236;
- «Administración Financiera (3A)» y «14 sep 2026 · 07:00 a 08:00 · Aula A-12»: 28 px #6F6A65, en dos renglones;
- chips «Abierta» y «Automático»: StatusChip md a E = 2 con tokens `justificado`/`auto`.

Activo: `assets/sesion-encabezado-abierta-automatico.png` (sin «Volver al panel»). Recoge el «Abierta» con el que termina F2.

**Abrir la cámara (2.45–2.95, R3b).**
- La vista y su sombra: `transform-origin 0 0`, x 0 → −880, y 0 → −200 y scale 1 → 2.135, con `expo.inOut`. Cubre 1921.5 ×
  1080.3 px: sin hilo crema abajo (con 2.134 quedaba 1079.8).
- El radio baja de 28 a 0 por `clip-path`; la sombra se apaga.
- «Reconociendo» y «Cámara frente» no escalan: viajan con sus esquinas y el margen pasa de 24 a 48 px.
- El chip «Pendiente» va anclado bajo su rostro a tamaño nativo, con el mismo ease.
- Desenfoque de la vista ≤ 4 px solo entre 2.60 y 2.80.
- **El encabezado no viaja** (corrección del crítico: un látigo con estela al mismo tiempo que la vista que se abre y se
  desenfoca eran dos movimientos grandes y dos superficies con filtro a la vez). La vista va por encima de la columna (z) y,
  al crecer hacia la izquierda, lo tapa como una cortinilla; a 2.95, ya cubierto, `tl.set autoAlpha 0`. Se lee de 0.95 a
  ≈ 2.60 s (más de 1.6 s).

**La clase a pantalla completa (2.95–4.40).**
- Rostros de 179 px con sus esquinas; esquinas y avatares escalan con la vista.
- 3.25–3.50: las esquinas laten (scale 1.06 → 1).
- 3.85–4.15: late el scan-face de «Reconociendo».
- Ningún contador.

**Vuelta (4.40–4.90, R3b).** Es el mismo tween al revés, con su desenfoque ≤ 4 px solo de 4.55 a 4.75: termina exacto en x
880, y 200, 900 × 506, radio 28 y la sombra vuelve. Mientras tanto, la columna real se revela por debajo, no encima: entra
desde la izquierda (x −60 → 0 y opacidad, `power3.out` 0.45 s, 4.55–5.00, sin estela). La columna es «Asistencia ahora» con «0» y «de 24 presentes», más la pista vacía de la
BarraSegmentada. Activo: `assets/sesion-resumen-0-de-24.png`.

**Desde 4.90, as is.** El «0» se ve quieto unos 0.15 s antes de rodar; nunca hay un contador de lecturas. El handoff_in y el
handoff_out no cambian.

`sfx_cues`: `1.30 shutter; 2.70 whoosh-l -6dB; 4.65 whoosh-m -6dB; 4.90 sheen-s -3dB; 5.00 blip -3dB; 5.35 fill -3dB; 5.61 tick-1; 5.65 tick-2; 7.30 fill; 7.85 tick-3`

### F4 · Lo dudoso lo decides tú (5.80 s)

| t | En pantalla | Relevo | Voz |
|---|---|---|---|
| 0.00–0.50 | entra con el push-slide: Revisión + **NUEVO: la lista real de pendientes** | push | — |
| 0.85–1.15 | foco en la fila de Emilio; quieta hasta 1.50 | R4 | «¿Algún caso dudoso?» 1.26 |
| 1.50–1.85 | la lista sale por la izquierda | R1 | — |
| 1.75–2.35 | la tarjeta del caso entra desde la derecha con la pose suave; plana a 2.35 | R1 | «Te espera…» |
| 2.40–3.09 | columnas de score 89 % y 93 % (cifras a 2.75 y 2.84) | — | «…en Revisión» 3.11 |
| 3.10–3.65 | fila «Resolver como» en cascada | — | — |
| 3.80–4.80 | halo, toque, «Presente», (8) → (7), secundarios al 45 % (as is) | — | «decides» 4.65 |
| 4.80–5.80 | aviso «Resuelto como Presente» (R2, as is); el halo vira a violeta | R2 | «tú» |

**Corrección del crítico: el látigo pasa de 1.30 a 1.50.** Con 1.30 la lista solo se leía 0.8 s tras el push, el látigo
arrancaba 0.15 s después de que se asentara el foco y justo sobre «dudoso», y entre el inicio del push y el del látigo había
1.30 s (la regla pide ≥ 1.5). Con 1.50, «dudoso» cae con la fila elegida quieta y el resto del cuadro se recorre +0.20 s
hasta las columnas, que siguen leyéndose antes de «Revisión». La fila «Resolver como» y la cadena del toque no se mueven.

**La lista (nueva).** Es la columna izquierda real de Revisión (`assets/pantalla-revision-caso.jpg`, DOM 24):
- 3 filas completas y la 4.ª cortada por un desvanecido de 80 px;
- filas a E = 2 de 720 × 164 px (82 px en la app), radio 24 (`rounded-xl`), borde 2 px #E7E2DC, fondo blanco; paso de 180 px
  (`gap-2` = 16 px);
- borde izquierdo x = 140 y topes en y = 312, 492, 672 y 852;
- 720 px de ancho en lugar de los 640 de la app para que la meta no se trunque («12 sep 09…» en la app).

Cada fila lleva, como en la app:
- avatar de iniciales de 72 px (`size-9`) con su color exacto del DOM 24: RN #475569, AR #A21CAF, SH #A21CAF, MM #B4551A,
  iniciales blancas 600;
- en el primer renglón, el nombre (28 px 500) y, a la derecha, el StatusChip «Pendiente»;
- debajo, «Administración Financiera · 3A · 12 sep 09:00» (24 px gris) y «Quedan 2 h 48 min» (24 px 500, tinta).

Nombres, en orden: Ramírez Núñez Emilio, Aguilar Ramos Luis, Sánchez Herrera Daniel y Morales Montes Laura. Son datos REALES
de la semilla (todos 3A), ya registrados en `plan/CONTENIDO.md` §3.5 y `frame.md` §10.

**Foco (0.85–1.15, R4).** La fila de Emilio toma el estilo real de la fila activa (`border-foreground bg-accent/50`): borde
#1E1919 de 2 px y fondo #EFECE7 al 50 % (≈ #F7F6F3 sobre blanco). Las otras bajan al 45 %, sin desenfoque. Queda quieta hasta
1.50. El PageHeader y las Tabs no se mueven en todo el cuadro.

**Salida (1.50–1.85, R1).** La lista entera va de x 0 → −760 con `power2.in`. Lleva una sola hoja con estela ≤ 16 para el grupo,
opacidad → 0 entre 1.71 y 1.85, y `autoAlpha 0` a 1.85.

**Entrada (1.75–2.35, R1).** Arranca con la salida al 71 %. La tarjeta del caso, el objeto flotante, entra con `power3.out`:
- x +640 → 0, rotationY −8 → 0, rotationX 5 → 0 y z −160 → 0;
- estela horizontal ≤ 14 solo mientras va rápida, en una hoja interior: nada de filtro en el padre con `perspective`;
- opacidad 0 → 1 entre 1.75 y 1.93;
- la sombra hace el mismo tween 3D y su opacidad sube entre 2.10 y 2.35;
- caja final como ahora, centro (1010, 610). Contenido as is.

**Columnas (2.40–3.09).** Como ahora (0.6 s, +0.09 s), recorridas +0.10 s: cifras «89 %» a 2.75 y «93 %» a 2.84, 0.35 s después
de su barra.

**Se quita.** El acercamiento 1.03 (1.40–2.10) y su regreso (3.30–3.80): la cámara queda en 1 todo el cuadro.

**Handoffs.** El handoff_in cambia (la lista ya está bajo el push; la tarjeta en opacidad 0 hasta 1.75). El handoff_out solo
corrige «cámara en scale 1 todo el cuadro».

`sfx_cues`: `0.25 whoosh-m; 1.80 whoosh-m -3dB; 2.40 fill -6dB; 3.10 pop-3 -6dB; 3.95 tap; 4.00 blip -3dB; 4.40 tick-1; 4.80 pop-2 -6dB`

### F5 · Qué día faltan más (7.20 s)

| t | En pantalla | Relevo | Voz |
|---|---|---|---|
| 0.00–0.50 | push-slide; título con BlurText 0.45–1.08 (as is) | push | «Con cada» |
| 0.70–1.40 | **las tres casillas entran juntas desde la derecha** (escalonadas 0.10 s) | R1 (entrada) | «sesión» 1.29 |
| 1.20–2.90 | sus cifras ruedan y se tiñen una tras otra (as is) | — | «susan analiza a tu grupo» |
| 2.90–3.55 | lectura de las tres cifras | — | — |
| 3.55–4.55 | resaltado del viernes y píldora «Día crítico: Viernes» (as is) | — | «qué día» 4.53 |
| 4.95–5.40 | **empuje hacia el viernes** | R3a | «faltan más» |
| 5.40–5.95 | **toma del viernes** | R3a | «…» |
| 5.55–6.35 | «32 ausencias en 6 sesiones», anillo trazado y latido | — | — |
| 6.35–7.20 | quieto (0.85 s), handoff_out | — | «viernes» 6.52 |

**Casillas (0.70–1.40, R1 de entrada, un solo relevo).** Las tres casillas de la TiraSemana entran juntas, cada una con su día
debajo, como una sola fila que llega:
- Lun 0.70–1.20, Mié 0.80–1.30, Vie 0.90–1.40 (escalonado 0.10 s, de izquierda a derecha);
- x +320 → 0, `power3.out` 0.5 s, estela ≤ 12 (σ < 0.3 antes del último 35 % de cada tramo), opacidad 0 → 1 en 0.15 s;
- llegan vacías con «–» y su odómetro y su relleno corren como ahora, uno tras otro: Lun 1.20–1.90, Mié 1.70–2.40, Vie
  2.20–2.90. Mié y Vie esperan con «–»: se lee como el análisis que avanza día por día.

Esto reemplaza la aparición en su lugar de 0.60–1.24. **Corrección del crítico:** el director las hacía entrar una por una
(Lun 0.70, Mié 1.20, Vie 1.70), cada entrada encimada con el odómetro de la anterior: tres látigos en 1.5 s, algo nuevo cada
0.5 s y, a 1.70–1.90, tres estelas en movimiento justo después del push. Era la saturación que la persona dueña pidió evitar.
Ahora es un solo relevo y, después, una cifra a la vez.

**Empuje hacia el viernes (4.95–5.40, R3a).**
- La capa de la estación (PageHeader, selector y tarjeta; no el fondo) va de scale 1 → 1.3 con origen (1320, 590).
- x 0 → −360 y y 0 → −30, con `power2.in`.
- Desenfoque 0 → 8 px entre 5.15 y 5.40.

**Toma del viernes (5.40–5.95).** A 5.40 se intercambia la capa por la toma maquetada. Llega de scale 0.88 → 1, con origen (960,
560), y desenfoque 8 → 0, con `expo.out`:
- la casilla Vie de la TiraSemana real a E = 4: 448 × 304, radio 56, centro (960, 560);
- su relleno, por la fórmula de `frame.md` §6 con X = 63;
- «21.8 %» en Hanken 600, 70 px, tabular, con el «%» al 0.7em, centrada en y = 544;
- «Vie» debajo, Hanken 500 38 px #6F6A65, centro y = 776;
- encima, la píldora de tinta «Día crítico: Viernes»: alto 82, texto blanco 36 px 500, centro (960, 340).

Comprobación: en el corte la casilla mide 386 × 262 px en el empuje y 394 × 268 px al llegar, con el mismo centro (960, 560).

**La píldora y «Vie» llegan en su propia capa** (§2.3, corrección del crítico). La toma las maqueta en otra proporción que la
estación (la píldora mide 64 px de alto sobre una casilla de 190 en la estación y 82 sobre 304 en la toma), así que con la escala
común de llegada saltarían en el corte: la píldora 13 px hacia abajo (de y ≈ 379 a 366) y 13 % más chica, contra su propio
movimiento, y «Vie» 14 px. Por eso cada una llega en su capa, de 5.40 a 5.95 con el mismo `expo.out` y el mismo desenfoque
8 → 0 que la toma:
- la píldora, de centro (960, ≈ 379) y scale ≈ 1.015 a centro (960, 340) y scale 1;
- «Vie», de centro (960, ≈ 735) y scale ≈ 0.82 a centro (960, 776) y scale 1.

Los valores de partida son los que esas piezas tienen en el último fotograma del empuje (calculados con la píldora de la estación
en (1320, 451), alto 64, y «Vie» de 24 px en y = 725 sin levantar); el worker los mide en el HTML y los usa tal cual.

**Lo que sigue en la toma.**
- 5.55–5.85: «32 ausencias en 6 sesiones» (Hanken 400 30 px #6F6A65, centro y = 830) entra desde el desenfoque. Es el renglón
  real de «Ver cifras por día» (DOM 21: «Viernes 21.8 % (32 ausencias en 6 sesiones, día crítico)»). En la
  construcción ya estaba, bajo «Vie» en la estación (5.20 s); ahora llega en la toma.
- 5.75–6.15: se traza el anillo real de la casilla, 6.4 px rgba(179,38,30,.7).
- 6.15–6.35: la casilla late (scale 1 → 1.04 → 1, origen en su centro).

**Se quita.** El acercamiento 1 → 1.05 de 4.55–6.15 (adorno).

**Handoff_out nuevo.** Es la toma del viernes; F6 la recibe idéntica.

`sfx_cues`: `0.25 whoosh-m; 0.70 whoosh-s -9dB; 1.90 tick-1; 2.40 tick-2; 2.90 tick-3; 4.55 pop-2; 5.40 whoosh-l -3dB; 5.75 draw; 6.15 pop-1 -6dB`

### F6 · Hacia dónde va (7.45 s)

| t | En pantalla | Relevo | Voz |
|---|---|---|---|
| 0.00–0.75 | **la casilla del viernes se abre en la gráfica semanal** | R5 | «Ves» |
| 0.65–2.90 | puntos, ajuste, guía S1 → S6, cifra 13.3 → «20.8 %», «Ausentismo actual» + hint (as is) | — | «va» 2.03 |
| 2.55–4.55 | proyección, guía a S15, tooltip recto 3.20–3.55, banda 3.80–4.45, subtítulo 4.15–4.55 (as is) | — | «semestre» 3.62 |
| 4.85–5.25 | **la gráfica sale por la izquierda** mientras el tooltip viaja al centro como píldora (4.85–5.65) | R1 + R5 | «y quién ya» |
| 5.40–6.50 | «alumnos en riesgo» y luego el «9» (as is); quieto desde 6.50 | — | «límite» 6.54 |

**Apertura (0.00–0.75, R5).** Corte invisible sobre la toma del viernes (handoff_in).
- La superficie se maqueta en la caja de la TarjetaGrafica «Ausentismo semanal» (x 140–1780, y 210–900).
- Va de `clip-path: inset(198px 596px 188px 596px round 56px)` a `inset(0 0 0 0 round 28px)`, entre 0.05 y 0.75 con
  `power3.inOut`. El borde de 2 px va en una capa que sigue el mismo recorte.
- 0.05–0.45: el relleno pasa de salmón a blanco como pintura.
- 0.05–0.30: se apagan «21.8 %», «Vie», el anillo y «32 ausencias en 6 sesiones».
- La píldora (centro 960, 340) suelta su texto antes del 40 % y se condensa en la cabeza de la guía (punto de tinta r 7) sobre
  S1.
- Después del 60 %: título, leyenda, marcas y cuadrícula como ahora. El PageHeader «Analítica de ausentismo» y el selector
  vuelven con opacidad (0.45–0.75).
- La cámara queda a 1 todo el cuadro: se quita la vuelta 1.05 → 1.

**Relevo final (4.85–5.25, R1).** Antes la gráfica se apagaba quieta; ahora la capa de la gráfica sale por la izquierda:
- la capa lleva la tarjeta, la lectura, el PageHeader y el selector, pero no el tooltip;
- x 0 → −900 con `power2.in` 0.4 s y estela horizontal ≤ 16;
- opacidad → 0 en el último 40 % y `autoAlpha 0` a 5.25.

El tooltip se despega antes y hace su morph a la píldora como ahora; el halo pasa a rosa. «20.8 %» queda en opacidad 0 desde
5.25, antes de «límite».

**Handoffs.** El handoff_in cambia (la toma del viernes). El handoff_out no cambia.

`sfx_cues`: `0.40 whoosh-s; 0.75 draw; 2.55 tick; 2.55 draw -6dB; 3.20 pop-3; 5.25 whoosh-m; 6.50 tick-2`

### F7 · Todavía a tiempo (7.60 s)

| t | En pantalla | Relevo | Voz |
|---|---|---|---|
| 0.00–1.05 | píldora → ranking «Mayor riesgo» (as is) | R5 | — |
| 1.05–2.40 | foco en Iván, la fila se despega y se abre en su tarjeta (as is) | R4 + R5 | «A Iván» 1.49 |
| 2.40–3.95 | sección A: «Faltas restantes 2», barra a 14.9 % frente a «Límite 20 %», «7 (14.9 %)» (as is) | — | «dos» 3.21, «faltas» |
| 3.95–4.25 | sale la sección A hacia arriba, ya en la pausa «…» | R2 | «…» |
| 4.15–4.90 | sube la sección B: «Cruce estimado: semana 9» y la fila «Acción sugerida» | R2 | «…» |
| 5.20–5.60 | «Contactar al alumno esta semana» entra desde el desenfoque | — | «tiempo» 5.93 |
| 6.45–6.65 | halo de foco en la fila de la acción (as is) | — | «de hablar con él» |
| 6.65–7.60 | quieto 0.95 s, bajo la blur-crossfade | — | — |

**Corrección del crítico: la sección A sale a 3.95, no a 3.80.** «dos» empieza a 3.21 y la frase «dos faltas» termina hacia
3.85; con 3.80 la barra se iba mientras la voz aún decía «faltas» y, con la holgura de ±0.3 s de las anclas, el «2» podía no
cumplir su lectura de 0.3 s después de la palabra. A 3.95 el relevo cae en la pausa «…» (≈ 3.9–4.9). La sección B se recorre
+0.15 s y «Contactar al alumno esta semana» no se mueve.

**Sección A sale (3.95–4.25, R2).** Las coordenadas son locales de la tarjeta (1200 × 600; en pantalla, tope en y = 240).
- El cuerpo de la tarjeta, bajo el divisor (y local 162–600), se vuelve una caja recortada con desvanecido de 24 px arriba y
  abajo.
- Fijos: el encabezado (avatar «CR», «Cruz Rojas Iván», «E260017 · 3A», «Alto · 64 / 100», «Al alza») y el divisor.
- La sección A («Faltas restantes» + «2» + barra + «7 (14.9 %)») va de y 0 → −140 con `power2.in` 0.3 s, estela vertical ≤ 10
  y opacidad → 0 en el último 40 %.
- El «2» está quieto desde 2.85 hasta 3.95 (1.1 s), así que «dos» (3.21) cae con él quieto y con margen.

**Sección B sube (4.15–4.90, R2), centrada en el cuerpo.** Corrección del crítico: con la píldora en y local 200 y la fila en
288–392, la tarjeta de 600 px quedaba con 208 px vacíos abajo (la construcción dejaba 48). La sección B mide ≈ 190 px (píldora
≈ 54 + 32 de aire + fila 104) y se centra en el cuerpo (y local 162–600), con 124 px arriba y abajo:
- 4.15–4.65: la píldora «Cruce estimado: semana 9» (calendar-days, fondo #F0EDE8, x local 48) llega a y local 286–340 desde y
  +140, con `power3.out` y estela ≤ 10.
- 4.40–4.90: la fila «Acción sugerida» sube con la misma receta hasta y local 372–476 (x 48–1152, fondo #F7F5F2, radio 20). Lleva
  la ficha `.su-ficha` a E = 2 con calendar-check y el rótulo «Acción sugerida» (24 px gris).
- 5.20–5.60: «Contactar al alumno esta semana» (32 px 500 tinta) entra con BlurText.

**Se quita.** El acercamiento 1 → 1.07 (3.45–4.35) y su regreso (5.00–5.90).

**Handoffs.** El handoff_out cambia: la tarjeta queda con la sección B (píldora en y local 286, fila en 372–476), por debajo
de una blur-crossfade, así que F8 no cambia.

`sfx_cues`: `0.05 soft-in -3dB; 1.40 tap; 2.07 whoosh-s; 2.45 fill -6dB; 2.85 tick; 4.20 whoosh-s -6dB; 4.40 pop-2 -6dB; 5.20 soft-in -6dB`

### F8 · SUSAN (6.00 s): sin cambios

| t | En pantalla | Relevo |
|---|---|---|
| 0.00–0.60 | cielo aclarado bajo la blur-crossfade | — |
| 0.60–1.45 | la ficha cae con estela y squash | R2, la única caída |
| 1.45–1.95 | la ficha se corre y «SUSAN» se revela | — |
| 2.50–3.10 | lema | — |
| 3.30–4.00 | paso del cielo | — |
| 4.45–5.15 | barrido holográfico | — |
| 5.70–6.00 | fundido | — |

Es la firma: el lockup se sostiene a propósito.

`sfx_cues` sin cambios: `0.98 whoosh-s; 1.00 thud; 2.50 soft-in -6dB; 4.45 sheen`.

---

## 4. Resumen de medida

Un «cambio de contenido» es un elemento, una cifra o un estado nuevos, o una toma nueva; los latidos y los brillos no cuentan.
«Sin cambio» es el tramo más largo entre que un cambio se asienta y empieza el siguiente.

| Cuadro | Cambios de contenido | Tramo más largo sin cambio | Relevos de composición | Inicios de relevo (s locales) |
|---|---|---|---|---|
| F1 | 8 | 0.6 s (3.83–4.45) | barras → rejilla → ficha | 2.95 · 5.45 |
| F2 | 6 | 1.15 s (3.80–4.95, con el brillo en medio) | tarjeta + marca → toma de cerca → cámara | 0.10 · 2.85 · 5.30 |
| F3 | 12 | 1.45 s (2.95–4.40, con dos latidos) | encabezado → clase a pantalla completa → columna con conteo → medidor | 2.45 · 4.40 |
| F4 | 7 | 0.70 s (5.10–5.80) | lista → tarjeta del caso → decisión → aviso | 0.00 (push) · 1.50 · 4.80 |
| F5 | 10 | 0.85 s (6.35–7.20, quietud final) | casillas → viernes resaltado → toma del viernes | 0.00 (push) · 4.95 |
| F6 | 10 | 0.95 s (6.50–7.45, quietud final) | casilla → gráfica → proyección → píldora | 0.05 · 4.85 |
| F7 | 8 | 0.95 s (6.65–7.60, quietud final) | ranking → tarjeta (sección A) → sección B | 0.05 · 1.75 · 3.95 |
| F8 | 6 | 1.35 s (3.10–4.45, con el paso del cielo) | ficha → lockup → lema | 0.60 (caída y revelado: un solo gesto de firma, as is) |

Lectura de la última columna: ningún par de inicios está a menos de 1.5 s (el más corto, F7 0.05 → 1.75, 1.70 s), y del
último relevo de un cuadro al primero del siguiente pasan ≥ 2 s. La entrada de las casillas de F5 (0.70) no es un relevo
aparte: es el contenido que llega detrás de su contenedor, en la misma dirección que el push, y no reemplaza nada. Lo mismo
el aviso de F4 (4.80), que es un R2 corto de una pieza chica.

**Topes, revisados:**
- Sobreimpulsos: 2 (botón de F2 y tooltip de F6).
- Pose 3D: tarjeta del caso en F4 (entra con el látigo, plana a 2.35) y fila de Iván en F7; ninguna más.
- Estelas a la vez: ≤ 3. Las tres casillas de F5 son el tope (entran juntas, 0.70–1.40) y en ese tramo nada más lleva estela;
  el látigo de F3 se retiró.
- Desenfoques grandes: el rack de F1, los atravesar de F2 y F5 (≤ 8 px, ≤ 0.6 s) y la vista de F3 al abrirse y al volver (≤ 4 px,
  0.2 s cada vez); uno a la vez y nunca junto a un push-slide ni a la blur-crossfade.
- Cámara ≤ 1.3 y nunca sostenida.

---

## 5. Pedidos fuera de mi zona (para el orquestador)

**Estado (crítico, 2026-10-06):** los pedidos 1 y 2 ya están hechos en los documentos (ver al final de cada uno); el 3 está
verificado (los bordes cuadran al número en los dos lados del STORYBOARD); el 4 no pide nada.

1. **`frame.md` §5.1, §5.6 y §5.8, y `plan/SINTESIS.md` regla 18.** Siguen diciendo «sin salidas salvo el último cuadro» y
   limitan la estela a «1–3 golpes». El BRIEF los sustituye para la v4. Conviene alinear esos textos con §2 de este documento
   para que los revisores no los citen. No los edité: no son de mi zona.
   **Hecho (crítico):** `frame.md` §5.1, §5.6, §5.8 y §11.6 y `plan/SINTESIS.md` reglas 18 y 19 ya remiten a la regla de
   dinamismo del BRIEF y a §2 de este documento.
2. **`plan/CONTENIDO.md` §3.5.** Agregar como REAL (DOM `24-revision-pendientes.html`) las cuatro primeras filas de la lista
   de Revisión:
   - Ramírez Núñez Emilio, Aguilar Ramos Luis, Sánchez Herrera Daniel y Morales Montes Laura;
   - todas «Administración Financiera · 3A · 12 sep 09:00 · Quedan 2 h 48 min · Pendiente».

   Agregar también, en §3.7, el renglón real «Viernes 21.8 % (32 ausencias en 6 sesiones)» de «Ver cifras por día» (ya estaba
   como «32 en 6»).

   **Hecho (crítico):** `plan/CONTENIDO.md` §3.4 (encabezado real de la sesión), §3.5 (lista de pendientes, con los colores de
   avatar) y §3.7 (renglón de «Ver cifras por día»), y `frame.md` §10 con las mismas cifras y textos.
3. **Bordes que cambian.** F5 → F6 (toma del viernes; F5 la entrega y F6 la recibe con números idénticos), el handoff_in de F4
   (lista bajo el push) y el handoff_out de F7 (sección B). Los flujos [s02, s05] y [s06, s01] corren en paralelo, así que el
   contrato es el handoff del storyboard al píxel.
4. **frame-check.** Su regla `exit` solo marca la opacidad → 0 de capas ≥ 80 % del cuadro en el último 1.2 s, así que no choca
   con estos relevos. La «deriva lenta» solo avisa. No hace falta tocarlo.

---

## 6. Revisión del crítico (2026-10-06, tras el corte del director)

El director dejó este documento y las `Scene`, `sfx_cues` y `handoff_*` del STORYBOARD completos para los 8 cuadros; faltaban
los paquetes, el extracto de dirección y los pedidos de §5. El crítico los completó y contrastó el plan segundo a segundo contra
la regla de la persona dueña (algo nuevo cada ~2–3 s, sin saturar, un relevo a la vez, zoom solo como transición). Cambios, ya
reflejados arriba y en el STORYBOARD:

| # | Dónde | Problema | Arreglo |
|---|---|---|---|
| 1 | F3 2.45–2.95 | El encabezado salía con látigo y estela mientras la vista se abría y se desenfocaba: dos movimientos grandes y dos superficies con filtro a la vez | El encabezado no viaja: la vista, por encima en z, lo tapa al crecer y se apaga ya cubierto. Regla nueva en §2.0.1 y §2.3 b |
| 2 | F3 2.45 | scale 2.134 dejaba 1079.8 px de alto: un hilo crema abajo durante 1.45 s | scale 2.135 (1921.5 × 1080.3) |
| 3 | F3 4.40–4.90 | La vuelta no decía su desenfoque | ≤ 4 px de 4.55 a 4.75, simétrico a la ida |
| 4 | F4 1.30 | Látigo 0.15 s después de asentarse el foco, sobre «dudoso», y a 1.30 s del push (regla: ≥ 1.5 s) | Látigo a 1.50–1.85, tarjeta 1.75–2.35 (plana a 2.35), columnas 2.40–3.09 (cifras 2.75 y 2.84, antes de «Revisión»); sfx 1.80 y 2.40 |
| 5 | F4 lista | Fila activa con #EFECE7 lleno, colores de avatar sin valor, alto 162 | Estilo real `border-foreground bg-accent/50` (≈ #F7F6F3), avatares RN #475569, AR y SH #A21CAF, MM #B4551A, chip a la derecha del nombre, 164 px (82 en la app) |
| 6 | F5 0.70–2.20 | Tres látigos de entrada en 1.5 s encimados con los odómetros: algo nuevo cada 0.5 s y tres estelas a la vez justo tras el push (saturación) | Una sola entrada de la fila (0.70–1.40, escalonada 0.10 s); los rellenos siguen uno por uno, como el análisis que avanza |
| 7 | F5 5.40 | En el corte del atravesar, la píldora saltaba 13 px hacia atrás y 13 % de tamaño y «Vie» 14 px | Regla nueva en §2.3 a: todo lo visible coincide en el corte; la píldora y «Vie» llegan en su propia capa desde su posición del empuje |
| 8 | F2 3.30 | «SUSAN» desaparecía de golpe en el corte con su «N» todavía en pantalla | Opacidad 1 → 0 de 3.12 a 3.30 mientras viaja |
| 9 | F7 3.80 | La sección A salía mientras la voz decía «faltas» y sin margen para la holgura de ±0.3 s de «dos» | Sale a 3.95, en la pausa «…»; sección B 4.15–4.90; sfx 4.20 y 4.40 |
| 10 | F7 sección B | Arriba (y local 200–392) dejaba 208 px vacíos al pie de la tarjeta | Centrada en el cuerpo: píldora 286–340, fila 372–476 (124 px arriba y abajo); handoff_out actualizado |
| 11 | §4 | Faltaba ver el ritmo de relevos | Columna de inicios de relevo por cuadro: ningún par a menos de 1.5 s |
| 12 | §5 | Pedidos 1 y 2 sin hacer | `frame.md` §5.1, §5.6, §5.8, §10 y §11; `plan/SINTESIS.md` 18–19; `plan/CONTENIDO.md` §3.4, §3.5 y §3.7 |

Se verificó y no cambia: duraciones (55.0 s), `voiceover` y `vo_anchor`; cada cifra nombrada quieta ≥ 0.3 s antes y después
de su palabra; ningún zoom fuera de R3 (el rack de F1 es la apertura; el latido de F5 y las esquinas de F3 son latidos, no
acercamientos); toda pieza nueva es UI real (DOM 24, encabezado de la sesión, «Ver cifras por día») con cifras de CONTENIDO §3;
costuras 1→2, 2→3, 5→6 y 6→7 idénticas al número en los dos lados; ninguna composición igual más de ~3 s sin un cambio de
contenido; ningún tramo quieto de 1.0 s.
