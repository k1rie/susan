---
format: 1920x1080
duration: 55s
message: "Pasa lista en segundos y entiende la asistencia de tus grupos"
arc: "Un solo mundo continuo: una píldora (el problema) se condensa en un botón (marca y producto), el botón abre la cámara, el caso dudoso se vuelve cifra, la cifra gráfica, la gráfica patrón, el patrón un nombre, y la misma ficha cae para firmar"
audience: "docentes de la UNACH FCA C-I (producto, tono de lanzamiento)"
mode: collaborative
music: none
voice: "pendiente: ElevenLabs es-MX, se monta al final por anclas (vo_anchor)"
proposal: "A · Un solo mundo continuo"
---

<!-- PROPUESTA A · «Un solo mundo continuo»

PITCH
1. La película es una sola cámara que nunca corta de verdad: cada tiempo le hereda al siguiente una pieza que persiste (REFERENCIA-2 M8, REFERENCIA T13).
2. Abre con un objeto solo en el lienzo crema, la píldora «5 min», que entra por rack focus, se despliega en selector × 3 × 16 y rueda a «4 h por grupo al semestre»: el problema cabe en una pieza que se transforma, no en diapositivas.
3. Esas cuatro horas se condensan en la ficha redonda de tinta del botón central «Pasar lista»; la ficha presenta «SUSAN» (marca en pantalla a los 7.1 s) y se estira en el botón «Abrir y pasar lista» mientras la tarjeta se arma a su alrededor.
4. La pulsación sin cursor convierte la tarjeta en la cámara en vivo (19 de 24 presentes, 88 %); un único empuje a la izquierda lleva al caso dudoso de Emilio, que se resuelve con un gesto (8 → 7).
5. La tarjeta resuelta se vuelve la cifra 20.8 %, la cifra la gráfica semanal con su proyección, la gráfica la tira Lun · Mié · Vie, la tira el ranking y la fila de Iván su tarjeta: 23 s de analítica encadenada, para leer con calma.
6. Cierra donde empezó: la misma ficha de tinta cae con estela y squash sin rebote y se resuelve en el wordmark «SUSAN» con el lema; la rima inicio-cierre la propone como logo.
7. Tres familias de transición (5 relevos invisibles con elemento compartido, 1 push-slide LEFT, 1 blur-crossfade al cielo final), 2 sobreimpulsos, 2 inclinaciones 3D, 2 apariciones del cielo y oro solo en los dos subrayados de la marca.
8. 8 cuadros, 55.0 s, 96 palabras de voz (≈ 66 % de cobertura), solo SFX.

SCRIPT (ElevenLabs es-MX, eleven_multilingual_v2, stability 0.35, similarity 0.8, style 0.45, semilla 1037, −17 LUFS por línea; «susan» en minúsculas; cifras con letra; anclas con holgura ±0.3 s; ventana = segundos locales del cuadro y absolutos)
L1 · Frame 1 · local 1.10-5.95 s · abs 1.10-5.95 s · ancla «sesión» @ 2.30 · Cinco minutos por sesión… para nombrar a cada alumno, uno por uno. (12)
L2 · Frame 2 · local 0.60-4.00 s · abs 7.40-10.80 s · ancla «susan» @ 0.95 · Con susan, abres la sesión con un solo botón. (9)
L3 · Frame 3 · local 0.90-7.60 s · abs 13.50-20.20 s · ancla «Tres» @ 5.05 · La cámara del aula pasa lista mientras das tu clase… Tres lecturas, y el alumno queda presente. (17)
L4 · Frame 4 · local 0.70-4.20 s · abs 21.50-25.00 s · ancla «resuelves» @ 2.35 · ¿Algún caso dudoso? Lo resuelves tú, con un clic. (9)
L5 · Frame 5 · local 0.90-7.90 s · abs 26.30-33.30 s · ancla «semestre» @ 7.60 · Y con cada sesión, susan analiza a tu grupo: hacia dónde va… y cómo cerraría el semestre. (17)
L6 · Frame 6 · local 0.90-6.00 s · abs 34.70-39.80 s · ancla «más» @ 2.50 · Ves qué día faltan más… y quiénes ya se acercan al límite. (12)
L7 · Frame 7 · local 0.70-6.60 s · abs 42.10-48.00 s · ancla «dos» @ 2.60 · A Iván le quedan solo dos faltas… Todavía estás a tiempo de hablar con él. (15)
L8 · Frame 8 · local 2.20-4.30 s · abs 50.60-52.70 s · ancla «susan» @ 2.30 · susan. Pasa lista en segundos. (5)
Total: 96 palabras · ≈ 36.5 s de voz a 2.65 palabras/s · cobertura ≈ 66 % · silencio de 1.1 s al abrir y 2.3 s al cerrar.
-->

# STORYBOARD · SUSAN v4 · Propuesta A «Un solo mundo continuo»

## Video direction

**Idea.** La película es una sola cámara que recorre el mundo de SUSAN sin cortes visibles (REFERENCIA-2 M8 y T13 de REFERENCIA). Abre con un objeto solo en el lienzo crema y la pantalla se arma a su alrededor; cada tiempo hereda una pieza del anterior. Hilo conductor: píldora «5 min» → selector → celda «4 h» → ficha de tinta → marca → botón «Abrir y pasar lista» → tarjeta Pasar lista → marco de cámara → (empuje a la izquierda) → tarjeta del caso → StatCard 20.8 % → gráfica semanal → tira Lun · Mié · Vie → ranking → fila de Iván → tarjeta de Iván → (foco al cielo) → la misma ficha cae y firma.

**Paleta por rol (tokens de DISENO-APP §1.10).** Lienzo #F7F5F2; paneles #FFFFFF con borde #E7E2DC de 2 px y sin sombra interna; tinta #1E1919 como único acento estructural (ficha, botón, celda de 4 h, punto observado, guía y tooltip); grises #6F6A65 y #D8D2CA; azul #0061FE solo en el halo de foco; oro #A8842C solo en el subrayado de la marca (cuadros 2 y 8); estados siempre con etiqueta y color; series de gráfica en --g-*. El holograma DEGRADADO solo en el barrido final de la marca.

**Escenarios.** E3 crema neutro (cuadro 1) → E1 cielo (cuadro 2 y primera mitad del 3: presentación) → E3 con halo del módulo: azul → verde (3), dorado (4), violeta (5), violeta → rosa (6), rosa (7) → E1 aclarado (8). El cielo aparece 2 veces y nunca bajo una gráfica. Grano estático al 4 %. Solo el objeto flotante lleva sombra, en capa aparte (azulada sobre cielo, de tinta sobre crema).

**Escala y tipografía.** UI a E = 2 con zoom en un .ui; primeros planos a E = 2.5-3 (StatCard del 5, tira del 6); gráfica a E = 1.6. Cámara ≤ 1.3 y nunca texto escalado quieto: al terminar un FLIP se cambia por su gemelo sin escala. Hanken Grotesk 400/500/600 (nunca 700), tabular-nums, cifra de escenario 120-160 px, ejes ≥ 22 px. Sin serif en esta propuesta: la marca es la de la app (Hanken 600) ampliada.

**Gramática de movimiento.** Llegadas power3.out o expo.out; viajes y morphs power3.inOut o expo.inOut de 0.5-0.9 s; la UI con los tiempos de la app (DISENO-APP §2.21). Un solo movimiento grande a la vez. Relevos con constantes (FLIP sin medir el DOM en el render), contenido viejo fuera antes del 40 % del viaje y nuevo después del 60 % (card-morph-anchor). Cifras con odómetro (M2, vertical-spring-ticker), líneas que se dibujan antes de recorrerse (svg-path-draw → chart-scrub-readout), barras con stat-bars-and-fills, toques sin cursor con halo de foco + compresión (press-release-spring). Sin respiración, sin deriva lenta, sin salidas salvo el fundido final del cuadro 8.

**Revelado al ritmo de la voz.** Cada pista de voz tiene su revelado; la cifra llega antes de que la voz la nombre y queda quieta ≥ 1.2 s mientras se nombra; nada se lee en los primeros 0.5-0.6 s de los cuadros 4 y 8 (transición entrante). Texto en pantalla = cifras, etiquetas reales de la UI y rótulos de ≤ 8 palabras; la única repetición de la voz es el lema del cierre. Cuadros quietos asignados: el 20.8 % solo en el cuadro 5 (2.3-3.4 s, antes del clímax) y la acción sugerida del cuadro 7 (lectura emocional).

**Transiciones (3 familias, sin zoom-through).** A · relevo con elemento compartido (cut + handoff con números idénticos y la pieza plana y quieta): 1→2, 2→3, 4→5, 5→6 y 6→7. B · empuje: push-slide LEFT 0.5s una sola vez (3→4, la cámara pasa a la estación siguiente del mismo mundo). C · foco: blur-crossfade 0.6s una sola vez (7→8, lienzo → cielo).

**Contabilidad (topes de SINTESIS).** Oro: 1 elemento en el cuadro 2 y 1 en el 8, ninguno en los demás (la EMA dorada se apaga con «Medias móviles» sin marcar, estado real de la app). Sobreimpulsos: 2 (pulsación de «Abrir y pasar lista» en el 3 y tooltip en el 5); la pulsación del 4 y el squash del 8 no rebotan. Inclinación 3D: solo el objeto flotante y solo dos veces (tarjeta Pasar lista en el 2, pico 4° y −6°; tarjeta de Iván en el 7, entrada 5° y 8°), plana en cada lectura de cifra y en cada borde de cuadro; nada de rotationZ; tooltip recto. Estelas: 1 objeto por escena (odómetros del 1, 3, 5, 6 y 7, y la caída del 8). Desenfoque grande: placa pre-desenfocada en el 1, filas del 6 a 6 px durante ≤ 1.2 s y el blur-crossfade del 8; nunca dos a la vez.

**Sonido.** Solo SFX del catálogo derivado assets/sfx/CATALOG.json, ≈ 1-1.3 por segundo, golpe en el fotograma en que el movimiento llega o alcanza su velocidad máxima; transitorios fuertes (tap, thud, whoosh-m) en los huecos de la voz; sin flash, sparkle ni whoosh-rev; sin ticks por entero. Tiempos en sfx_cues (segundos locales).

**Lista negativa.** Ni diapositiva (volcar y congelar) ni salvapantallas (cosas flotando por su cuenta). Sin cursor ni mano. Sin «Límite 20 %» cerca de 20.8 % (la marca solo vive en la tarjeta de Iván). Sin el cierre de la sesión de hoy ni el botón «Cerrar pase de lista». Sin cámara simulada, cuadros magenta, recortes sintéticos ni reloj de demostración. Sin «de 25» (nueve alumnos en riesgo, sin denominador). Sin vista del alumno ni reportes. Sin emojis, iconos que no sean Lucide ni «▲». Iconos que faltan y se extraen antes de construir: gauge (cuadro 5) y arrow-right (cuadros 2 y 3).

## Frame 1 — La píldora de cinco minutos

- scene: Una píldora sola en el lienzo crema entra por rack focus, se despliega en el selector 5 min × 3 × 16, rueda a 4 h por grupo al semestre y todo se condensa en la ficha redonda de tinta del botón Pasar lista
- duration: 6.8s
- poster: 4.9s
- transition_in: cut
- status: outline
- src: compositions/frames/s01-minutos.html
- type: hook
- beat: rutina → peso del tiempo perdido
- blueprint: cta-morph-press (Adapt)
- voiceover: "Cinco minutos por sesión… para nombrar a cada alumno, uno por uno."
- vo_anchor: «Cinco» @ 1.15s; «sesión» @ 2.30s; «alumno» @ 4.50s
- sfx_cues: 0.10 soft-in; 0.95 sheen-s; 2.42 click-soft2; 3.10 whoosh-s; 4.40 tick-2; 5.95 whoosh-m; 6.40 pop-1
- asset_candidates: assets/icons/clock.svg — Lucide clock de la píldora 5 min; assets/icons/calendar-days.svg — Lucide calendar-days de la celda de 16 semanas; assets/icons/scan-face.svg — Lucide scan-face blanco que aparece en la ficha al condensarse; assets/10-docente-home.mobile.clean.png — captura móvil real con el botón central Pasar lista de la barra inferior, referencia de la ficha (copiar desde capture/app-real/mobile/10-docente-home.clean.png con este nombre)
- handoff_out: ficha de tinta (botón central Pasar lista) — centro x=960 y=500, diámetro 168 px con anillo blanco de 15 px, scan-face blanco de 72 px, scale 1, opacity 1, rotationX 0, rotationY 0, quieta (0 px/s) desde 6.65s, sombra de tinta en capa aparte, fondo crema #F7F5F2 sin halo

narrativeRole: Gancho y problema en una sola pieza: el tiempo del pase de lista se ve como una cuenta que crece y, al final, se condensa en el objeto que lo resuelve.
keyMessage: Cinco minutos por sesión se vuelven cuatro horas por grupo al semestre.

Adapt: se conserva la firma de cta-morph-press en su variante Hook sin cursor (un widget solo en un campo vacío que se transforma en su sitio); cambia el remate: en lugar de volver a la píldora, el selector se condensa en la ficha de tinta que hereda el cuadro 2 (M3 + M4 + M8).

Scene 1 (0.0-1.2s): Lienzo crema #F7F5F2 vacío, sin halo, grano estático al 4 %. Un solo objeto en el centro óptico (960, 500): la píldora «5 min» (fondo muted #F0EDE8, alto 96, radio de píldora, Lucide clock gris de 40 a la izquierda, «5» en tinta 600 y «min» en gris #6F6A65 al mismo tamaño, 56 px, tabular-nums). Entra por rack focus de apertura (T1) con placa pre-desenfocada de la píldora (snapshot + gblur σ 18, área chica): la placa se ve desde 0.05, la píldora nítida sube de 0 a 1 entre 0.15 y 0.75 con depth-of-field-blur de 12 a 0 px hasta 1.05, la placa se funde entre 0.35 y 0.85 y el grupo escala de 1.12 a 1 en 1.2 s (power3.out). Primer movimiento a los 0.05 s, héroe legible a los 0.75 s. Sin voz hasta 1.1 s.

Scene 2 (1.2-3.0s): La voz dice «Cinco minutos por sesión» (1.10-2.60) con la píldora quieta (lectura de 1.05 a 2.40). En 2.40-2.95 la píldora se despliega en selector (M4, anchored-layout-expand en X, anclado a la izquierda, fondos de celda recortados con clip-path de radio fijo, power3.inOut): tres celdas separadas «5 min» · «× 3 por semana» · «× 16 semanas» (Lucide calendar-days en la tercera); los tokens viajan con su celda y el selector queda centrado en 960. Clic suave al desplegarse.

Scene 3 (3.0-5.8s): En 3.05-3.45 una celda de tinta sale de detrás de la última hacia la derecha (power3.out) y el conjunto se recentra; su odómetro (M2 con vertical-spring-ticker sin rebote, columna enmascarada con estela vertical ligada a la velocidad, el único objeto con estela del cuadro) rueda de 0 a «4» entre 3.40 y 4.40 con «h» en gris; un tic al asentarse. En 4.50 entra desde el desenfoque (T9) el rótulo «por grupo al semestre» bajo la celda de tinta (28 px, gris). La voz sigue con «para nombrar a cada alumno, uno por uno» (2.95-5.95): la cifra 4 h llega antes y queda quieta de 4.40 a 5.90 (1.5 s); la voz nunca la nombra.

Scene 4 (5.8-6.8s): Condensación sin salida (M4 + M8): en 5.90-6.35 las celdas grises se deslizan bajo la celda de tinta y el rótulo se pliega con ellas (power3.inOut); en 6.10-6.55 la celda de tinta viaja al centro (960, 500) y su recorte pasa de rectángulo de radio 16 a círculo de 168 px; en 6.35-6.60 «4 h» cede su lugar al scan-face blanco de 72 px (cambio de icono con escala 0.6 y desenfoque de 4 px, sin giro); en 6.45-6.65 aparecen el anillo blanco de 15 px y la sombra de tinta en su capa. Es la ficha del botón central Pasar lista de la barra móvil real. Quieta desde 6.65 para el relevo.

## Frame 2 — Un botón

- scene: La ficha presenta la marca SUSAN con su subrayado dorado sobre un cielo que amanece, se estira en el botón Abrir y pasar lista y la tarjeta Pasar lista se arma a su alrededor con una pose 3D suave que vuelve a plano
- duration: 5.8s
- poster: 1.6s
- transition_in: cut
- status: outline
- src: compositions/frames/s02-un-boton.html
- type: product_intro
- beat: curiosidad → alivio
- blueprint: compose
- voiceover: "Con susan, abres la sesión con un solo botón."
- vo_anchor: «susan» @ 0.95s; «botón» @ 3.70s
- sfx_cues: 0.20 whoosh-s; 0.30 soft-in; 1.00 sheen; 2.45 whoosh-m; 2.95 pop-2; 4.45 sheen-s; 4.90 blip
- asset_candidates: assets/10-docente-home--PasarListaHero.png — recorte 2x de la tarjeta real Pasar lista, referencia de medidas, textos y tokens (se reconstruye en HTML); assets/10-docente-home--Resaltado.png — trazo dorado real del saludo, referencia del subrayado de la marca; assets/10-docente-home--BrandMark.png — BrandMark real SUSAN en Hanken 600 que el wordmark amplía; assets/icons/scan-face.svg — icono de la ficha y del botón; assets/icons/camera.svg — icono verde de Cámara del aula lista
- handoff_in: ficha de tinta (botón central Pasar lista) — centro x=960 y=500, diámetro 168 px con anillo blanco de 15 px, scan-face blanco de 72 px, scale 1, opacity 1, rotationX 0, rotationY 0, quieta (0 px/s), sombra de tinta en capa aparte, fondo crema #F7F5F2 sin halo (sigue del cuadro 1)
- handoff_out: tarjeta Pasar lista (PasarListaHero, objeto flotante) — centro x=960 y=500, 1040 × 520 px, radio 28, scale 1, opacity 1, rotationX 0, rotationY 0, quieta (0 px/s) desde 5.50s; botón Abrir y pasar lista con centro x=788 y=616 y 600 × 96 px; chip Programada arriba a la derecha; fondo cielo E1 a pantalla completa; sombra azulada en capa aparte

narrativeRole: Bisagra problema → producto: la ficha presenta la marca y se estira en la acción principal del docente; la pantalla se arma alrededor del botón.
keyMessage: SUSAN cabe en un botón: «Abrir y pasar lista».

Compose: lockup de marca C de DISENO-APP §4.4 (ficha + palabra), relevo de escala en el mismo centro y construcción alrededor del objeto (M3 forma A, M7). Sin cursor, sin serif.

Scene 1 (0.0-2.2s): Corte invisible: la ficha sigue idéntica. En 0.10-1.00 el fondo pasa de la crema al cielo E1 (capa de fondo, fundido de opacidad power2.inOut; el cielo termina en crema abajo y no hay nubes cerca de la ficha). En 0.20-0.70 la ficha se desliza a la izquierda hasta x=713 (power3.inOut) mientras «SUSAN» se escribe a su derecha letra por letra (desenfoque 12 → 0 px, y 0.3em → 0, 0.7 s, +45 ms por letra, power4.out, 0.30-1.00): Hanken Grotesk 600, 136 px, −0.025em, tinta, separación de 44 px, bloque centrado en 960. En 1.00-1.90 se dibuja debajo el trazo de Resaltado (svg-path-draw, #A8842C al 80 %, 12 px, extremos redondos, power4.out): el único oro del cuadro. La voz dice «Con susan» con la palabra ya escrita (ancla 0.95, 7.75 s del video) y la marca queda quieta hasta 2.20 (lectura de 1.2 s).

Scene 2 (2.2-4.4s): Relevo en el mismo centro (scale-swap-transition): en 2.20-2.50 la palabra y su trazo se condensan hacia la ficha (escala 1 → 0.9, opacidad → 0, power2.in) y en 2.40-3.00 la ficha se estira en el botón primario «Abrir y pasar lista» (card-morph-anchor con constantes: viaja a (788, 616) y su recorte pasa de círculo a rectángulo de 600 × 96 con radio 16, power3.inOut); el scan-face queda como icono inicial a 40 px y la etiqueta 28/500 blanca con arrow-right entra desde el desenfoque en 2.85-3.20. En 2.95-3.80 la tarjeta Pasar lista se arma alrededor del botón (center-outward-expansion, piezas escalonadas 0.06 s, expo.out): superficie blanca de 1040 × 520 con borde de 2 px y radio 28, ficha 72 tono-azul con scan-face azul y «Pasar lista», chip «Programada» a la derecha, título «Administración Financiera (3A)» 40/600, «07:00 - 08:00 · Aula A-12» y «Cámara del aula lista» con Lucide camera verde. La tarjeta es el objeto flotante: en 3.00-3.60 el grupo entero toma una pose suave (rotationX 4°, rotationY −6°, power2.out) y en 3.60-4.40 vuelve a plano (power3.inOut), con su sombra azulada en capa aparte desplazada en sentido contrario. La voz dice «abres la sesión con un solo botón» (ancla «botón» 3.70, botón visible desde 3.00).

Scene 3 (4.4-5.8s): Lectura en plano: un solo brillo blanco cruza la tarjeta de izquierda a derecha en 4.45-5.05 (T4, una pasada, power2.inOut) y el icono de «Cámara del aula lista» da un pulso finito de dos anillos verdes en 4.90-5.50 (el punto vivo de la superficie, M7). Quietud desde 5.50; la tarjeta queda plana y sin escala para el relevo.

## Frame 3 — La cámara pasa lista

- scene: Sin cursor, el botón se presiona, la tarjeta se transforma en la vista de cámara, tres capturas confirman al grupo en oleadas y la cifra rueda a 19 de 24 presentes con el medidor en 88 por ciento
- duration: 8.2s
- poster: 6.6s
- transition_in: cut
- status: outline
- src: compositions/frames/s03-camara.html
- type: feature_showcase
- beat: expectativa → asombro → confianza
- blueprint: compose
- voiceover: "La cámara del aula pasa lista mientras das tu clase… Tres lecturas, y el alumno queda presente."
- vo_anchor: «cámara» @ 1.20s; «clase» @ 4.40s; «Tres» @ 5.05s; «presente» @ 7.30s
- sfx_cues: 0.30 tap; 0.36 blip; 0.62 whoosh-m; 1.00 soft-in; 1.70 scan; 1.72 ping-note1; 2.72 ping-note3; 3.72 ping-note5; 3.80 check; 4.50 tick-3; 4.90 fill; 6.40 sheen-s
- asset_candidates: assets/30-pasar-lista-inicio--VistaCamara.png — marco real de la vista de cámara y sus chips oscuros, solo maqueta (la cámara simulada no se calca); assets/39-escalonados-final--ResumenPaseLista.png — formato real de la cifra N de 24 presentes y su línea de detalle (sus cifras no se usan); assets/39-escalonados-final--MedidorLiquido.png — medidor Presentes ahora real (sus cifras no se usan); assets/avatars/avatar-01-xr.svg — avatar abstracto Lorelei CC0, se usan avatar-01 a avatar-23 como los 23 rostros; assets/icons/scan-face.svg — icono del chip Reconociendo
- handoff_in: tarjeta Pasar lista (PasarListaHero, objeto flotante) — centro x=960 y=500, 1040 × 520 px, radio 28, scale 1, opacity 1, rotationX 0, rotationY 0, quieta (0 px/s); botón Abrir y pasar lista con centro x=788 y=616 y 600 × 96 px; chip Programada arriba a la derecha; fondo cielo E1 a pantalla completa; sombra azulada en capa aparte (sigue del cuadro 2)

narrativeRole: Clímax de producto: la pulsación abre la sesión y la cámara confirma al grupo en oleadas mientras la clase sigue.
keyMessage: La cámara pasa lista sola; tres lecturas confirman a cada alumno.

Compose: pulsación sin cursor (T7) que dispara un morph de tarjeta a panel (T13), una oleada por captura y odómetro (M2) con el medidor líquido al final. La sesión de hoy no se cierra.

Scene 1 (0.0-1.5s): Pulsación sin cursor (press-release-spring, solo el objetivo): halo de foco nativo de 8 px rgba(0,97,254,.3) en el botón en 0.12-0.27, compresión a 0.96 en 0.30-0.39 y recuperación con back.out(1.4) en 0.39-0.74 (sobreimpulso 1 de 2 del video); el chip pasa de «Programada» a «Abierta» en 0.34. En 0.50-1.30 la tarjeta se transforma en el marco de VistaCamara (card-morph-anchor, power3.inOut): el contenido viejo sale antes del 40 % del viaje, la superficie viaja a centro (656, 475), pasa a 1120 × 630 con radio 28 y fondo de tinta (canal de pintura) y el contenido nuevo entra después del 60 %. En 0.60-1.40 el cielo se funde al lienzo crema con halo tono-azul (capa de fondo). En 1.00-1.50 entran 23 avatares abstractos en tres filas (escalonado ≤ 0.5 s) y los chips oscuros «Reconociendo» (scan-face) y «Cámara frente»; a la derecha aparece la columna «Asistencia ahora» con «0 de 24 presentes». La voz empieza en 0.90 (ancla «cámara» 1.20, con el marco ya formado).

Scene 2 (1.5-4.6s): Tres capturas, tres oleadas (ai-tracking-box recoloreado a tokens: esquinas blancas de 2 px × E con radio 8, sin porcentajes ni puntajes): en 1.70 se traban las esquinas en los 23 rostros (escalonado 0.4 s) y el rostro destacado del centro muestra el chip oscuro «Lecturas 1/3»; en 2.70 las esquinas laten otra vez y el chip pasa a «2/3»; en 3.70 las esquinas de 21 rostros pasan al verde #27A06A, el chip llega a «3/3» y bajo el rostro destacado aparece el StatusChip «Presente» (texto + color). Dos rostros conservan las esquinas blancas (la alumna por revisar y una visita), sin explicarlo. En 3.70-4.50 la cifra rueda de 0 a «19» (M2, vertical-spring-ticker por columna, «de 24 presentes» fijo en gris, un tic al asentarse) y en 4.60 entra la línea «2 con retardo · 2 sin registro · 1 por revisar» (24 px). La voz dice «La cámara del aula pasa lista mientras das tu clase» (0.90-4.60).

Scene 3 (4.6-8.2s): En 4.70-5.50 el halo pasa de azul a tono-verde. En 4.90-6.20 el medidor líquido «Presentes ahora» sube a «88 %» con «21 de 24 inscritos» (física determinista del medidor, cifra de 72 px). En 6.40 entra desde el desenfoque «Última captura: 23 rostros · 22 válidos · +1 registro · hace 4 s» (24 px). El icono del chip «Reconociendo» late tres veces (svg-icon-enrichment, finito) entre 6.60 y 8.20 como única vida mientras se leen 19 y 88 %, quietas desde 4.50 y 6.20. La voz dice «Tres lecturas, y el alumno queda presente» (5.00-7.60; «Tres» en 5.05 con el 3/3 visible desde 3.70). El último estado se congela bajo el empuje de salida.

## Frame 4 — El caso dudoso

- scene: La cámara se desplaza a la estación de Revisión, el caso de Emilio muestra dos lecturas válidas con sus scores y se resuelve como Presente con un gesto mientras la pestaña de pendientes baja de 8 a 7
- duration: 4.6s
- poster: 3.2s
- transition_in: push-slide LEFT 0.5s
- status: outline
- src: compositions/frames/s04-revision.html
- type: feature_showcase
- beat: duda → control
- blueprint: compose
- voiceover: "¿Algún caso dudoso? Lo resuelves tú, con un clic."
- vo_anchor: «dudoso» @ 1.50s; «resuelves» @ 2.35s; «clic» @ 3.90s
- sfx_cues: 0.25 whoosh-m; 0.62 draw; 2.28 tap; 2.33 check; 2.55 tick-2
- asset_candidates: assets/25-revision-caso--CasoPendiente.png — tarjeta real del caso de Emilio, los recortes magenta del simulador NO se calcan; assets/25-revision-caso--Tabs.png — pestañas reales Pendientes (8) Justificantes (4) Correcciones (0); assets/25-revision-caso--ResolverComo.png — botones reales Resolver como; assets/25-revision-caso--BarrasPildora.png — columnas reales de score por lectura 89 y 93 por ciento; assets/icons/clock.svg — icono de Quedan 2 h 48 min
- handoff_out: tarjeta del caso de Emilio — en pantalla centro x=960 y=560 y 1277 × 618 px (tarjeta de 1240 × 600 con cámara a 1.03), radio 28 × 1.03, scale 1, opacity 1, rotationX 0, rotationY 0, quieta (0 px/s) desde 4.40s; chip Presente arriba a la derecha; fondo E3 crema con halo tono-dorado

narrativeRole: Confianza: una lectura dudosa no se decide sola; el docente la resuelve con evidencia en un gesto.
keyMessage: Lo dudoso lo decides tú.

Compose: el caso real de la semilla (Emilio Ramírez Núñez), columnas de score que se llenan, pulsación sin cursor sin sobreimpulso y un contador que rueda un renglón (M2).

Scene 1 (0.0-1.6s): El push-slide LEFT (0.5 s) trae la estación de Revisión con halo tono-dorado: título «Revisión» (52 px) arriba a la izquierda, pestañas «Pendientes (8) · Justificantes (4) · Correcciones (0)» con la activa subrayada en tinta, y la tarjeta del caso (centro 960, 560; 1240 × 600): avatar de iniciales «RN», «Ramírez Núñez Emilio», «E260003 · Administración Financiera · 3A», chip «Pendiente», Lucide clock + «Quedan 2 h 48 min», «Lecturas válidas: 2/3» con su barra y, a la derecha, las dos columnas de «Score por lectura» vacías. Nada se lee bajo el empuje. En 0.60-1.45 las columnas se llenan de abajo arriba (stat-bars-and-fills con clip-path, +60 ms) hasta «89 %» y «93 %» en el verde de válida, con la cifra 0.35 s después de su barra. Sin recortes de rostro. La voz pregunta «¿Algún caso dudoso?» (0.70-1.80).

Scene 2 (1.6-3.2s): Pulsación sin cursor del botón «Resolver como Presente (Sugerido)» (press-release-spring, solo el objetivo, SIN sobreimpulso): halo de foco en 2.10-2.25, compresión a 0.97 en 2.28-2.37 y recuperación power3.out de 0.3 s; el chip pasa de «Pendiente» a «Presente» en 2.32 y en 2.50-2.85 el contador de la pestaña rueda un renglón de «(8)» a «(7)» (M2, vertical-spring-ticker de un solo paso); los botones «Resolver como Retardo» y «Resolver como Ausente» se atenúan a 0.45 en 2.60-2.90. La voz dice «Lo resuelves tú, con un clic» (2.00-4.20; ancla «resuelves» 2.35 con el cambio de estado).

Scene 3 (3.2-4.6s): La cámara se acerca a la tarjeta de 1.00 a 1.03 con nudge-curve (lento-rápido-lento, 3.20-4.40) y la entrega quieta al corte; «Presente» y «(7)» se leen quietos desde 2.85 (1.75 s).

## Frame 5 — Hacia dónde va

- scene: La tarjeta resuelta se transforma en la cifra Ausentismo actual 20.8 por ciento, la cifra se abre en la gráfica semanal S1 a S6 con su proyección a S15 y una guía de tinta sin puntero lee Semana 15 24.8 por ciento
- duration: 8.4s
- poster: 7.4s
- transition_in: cut
- status: outline
- src: compositions/frames/s05-tendencia.html
- type: feature_showcase
- beat: atención → comprensión
- blueprint: dataviz-countup (Adapt)
- voiceover: "Y con cada sesión, susan analiza a tu grupo: hacia dónde va… y cómo cerraría el semestre."
- vo_anchor: «susan» @ 2.10s; «va» @ 5.30s; «semestre» @ 7.60s
- sfx_cues: 0.10 whoosh-s; 0.60 soft-in; 1.95 blip; 2.05 pop-3; 3.42 whoosh-m; 4.20 draw; 5.40 draw; 6.00 pop-2; 6.15 scan; 7.00 blip
- asset_candidates: assets/21-analitica-3a--StatCard.png — StatCard real Ausentismo actual 20.8 con su delta, referencia de medidas y tokens; assets/21-analitica-3a--GraficaSerie.png — tarjeta real Ausentismo semanal (en el video sin la línea Límite 20 y sin EMA); assets/21-analitica-3a--GraficaLinea.png — geometría real de la gráfica de líneas, rectas entre puntos; assets/icons/trending-up.svg — icono del delta +4.2 pp
- handoff_in: tarjeta del caso de Emilio — en pantalla centro x=960 y=560 y 1277 × 618 px (tarjeta de 1240 × 600 con cámara a 1.03), radio 28 × 1.03, scale 1, opacity 1, rotationX 0, rotationY 0, quieta (0 px/s); chip Presente arriba a la derecha; fondo E3 crema con halo tono-dorado (sigue del cuadro 4)
- handoff_out: TarjetaGrafica Ausentismo semanal — centro x=960 y=500, 1500 × 720 px, radio 28, scale 1, opacity 1, rotationX 0, rotationY 0, quieta (0 px/s) desde 7.30s; guía de tinta en S15 (x=1620) con el tooltip de tinta Semana 15 · 24.8 % a su izquierda; fondo E3 crema con halo tono-violeta

narrativeRole: Clímax de datos, primer tiempo: lo que se registró se vuelve tendencia y proyección.
keyMessage: SUSAN muestra hacia dónde va el ausentismo del grupo antes del cierre del semestre.

Adapt: se conserva la firma de dataviz-countup (la cifra héroe se vuelve gráfica y una lectura la recorre); cambia que el relevo es un morph de tarjeta (T13) y que la lectura la hace una guía sin puntero con tooltip de tinta recto (T11 + T12). Esta gráfica no lleva la marca «Límite 20 %» (es tasa semanal) y la EMA dorada va apagada.

Scene 1 (0.0-3.4s): Corte invisible y morph (card-morph-anchor, 0.0-0.9, power3.inOut): la tarjeta del caso suelta su contenido antes del 40 % y se reconforma en la StatCard «Ausentismo actual» en primer plano a E = 3 (centro 960, 470; 840 × 360); el halo pasa de dorado a tono-violeta en 0.1-0.9. Entran la pastilla con Lucide gauge en tonos danger y la etiqueta (0.6-0.9); la cifra «20.8 %» rueda como odómetro (M2 y T8, columnas de derecha a izquierda, decimal y % en gris, 0.95-1.95) y en 2.05 el chip con trending-up «+4.2 pp vs. semana previa» entra desde el desenfoque (T9). De 2.3 a 3.4 la cifra queda sola y quieta: el cuadro quieto deliberado antes del clímax. La voz dice «Y con cada sesión, susan analiza a tu grupo» (0.90-4.20) sin nombrar la cifra.

Scene 2 (3.4-5.6s): Tarjeta → gráfica (card-morph-anchor con constantes, 3.40-4.20, power3.inOut): la StatCard se abre en la TarjetaGrafica «Ausentismo semanal» (centro 960, 500; 1500 × 720; E = 1.6) y la cifra 20.8 % viaja y se condensa en el punto observado S6, de tinta. Entran el subtítulo «Tendencia al alza: +0.59 pp por semana», la cuadrícula horizontal 0-60 % y las marcas S1 … S15 (22 px); los puntos observados S1-S5 (13.3 · 20.0 · 22.0 · 15.3 · 16.7) brotan en ola de izquierda a derecha (4.10-4.70) y la recta de ajuste azul se dibuja (svg-path-draw, 4.20-5.20, rectas entre puntos, nunca suavizadas). La voz dice «hacia dónde va» (4.50-5.60; ancla «va» 5.30) mientras la recta sube.

Scene 3 (5.6-8.4s): La proyección discontinua azul se dibuja de S6 a S15 (svg-path-draw, 5.40-6.20) y la banda del intervalo de 95 % se abre por opacidad (5.60-6.40). En 6.00 aparece la guía vertical de tinta en S6 y el tooltip de tinta RECTO salta (escala 0.6 → 1 en 0.35 s con back.out(1.4): sobreimpulso 2 de 2) con «Semana 6 · 20.8 %»; en 6.15-7.00 la guía recorre hasta S15 con un solo driver (chart-scrub-readout, sin puntero, power1.inOut) y el tooltip no muestra valores intermedios (no hay dato canónico): al llegar, su texto rueda a «Semana 15 · 24.8 %» y se voltea a la izquierda de la guía. Leyenda «Observada · Ajuste · Proyección · Intervalo 95 %». La voz dice «y cómo cerraría el semestre» (6.00-7.90; ancla «semestre» 7.60): la cifra llega en 7.00 y queda quieta 1.4 s.

## Frame 6 — Qué día y quiénes

- scene: La gráfica colapsa y se reconforma en la tira semanal Lun Mié Vie con Viernes como día crítico, la cámara baja por la misma página a los alumnos en riesgo y un rack focus deja sola la fila de Iván
- duration: 7.6s
- poster: 2.4s
- transition_in: cut
- status: outline
- src: compositions/frames/s06-patron-riesgo.html
- type: feature_showcase
- beat: comprensión → foco en una persona
- blueprint: compose
- voiceover: "Ves qué día faltan más… y quiénes ya se acercan al límite."
- vo_anchor: «más» @ 2.50s; «quiénes» @ 3.50s; «límite» @ 5.70s
- sfx_cues: 0.20 whoosh-s; 1.00 pop-2; 1.50 blip; 3.00 whoosh-m; 3.85 draw; 4.95 tick-2; 5.60 whoosh-s
- asset_candidates: assets/21-analitica-3a--PatronSemanal.png — tarjeta real Ausentismo por día de la semana, en el video solo Lun Mié Vie; assets/21-analitica-3a--TiraSemana.png — casillas reales con el anillo del día crítico; assets/21-analitica-3a--TablaRiesgo.png — ranking real Mayor riesgo, el subtítulo con 25 no se muestra; assets/21-analitica-3a--BarrasPildora.png — barras píldora reales del ranking por puntaje
- handoff_in: TarjetaGrafica Ausentismo semanal — centro x=960 y=500, 1500 × 720 px, radio 28, scale 1, opacity 1, rotationX 0, rotationY 0, quieta (0 px/s); guía de tinta en S15 (x=1620) con el tooltip de tinta Semana 15 · 24.8 % a su izquierda; fondo E3 crema con halo tono-violeta (sigue del cuadro 5)
- handoff_out: fila de Cruz Rojas Iván en Mayor riesgo — centro x=1220 y=560, 984 × 56 px (nombre 26 px a la izquierda, pista de 560 × 20 px con relleno rojo Alto al 64 %, cifra 64 a la derecha), scale 1, opacity 1, filter none, rotationX 0, rotationY 0, quieta (0 px/s) desde 6.80s; resto de filas y bloque del 9 a opacity 0.35 sin desenfoque; fondo E3 crema con halo tono-rosa

narrativeRole: Clímax de datos, segundo tiempo: del promedio al patrón (qué día) y del patrón a las personas (quiénes).
keyMessage: Viernes es el día crítico y nueve alumnos ya están en riesgo.

Compose: la gráfica colapsa en su base y se reconforma en la tira semanal (T13), la cámara baja por la misma página hasta la estación de riesgo (viewport-change) y un rack focus aísla una fila (depth-of-field-blur).

Scene 1 (0.0-2.9s): La guía y el tooltip se recogen en el punto S15 (0.0-0.2) y el área de la gráfica colapsa a su línea base (scaleY → 0.02, 0.2-0.5, power2.in) mientras la tarjeta se reconforma (card-morph-anchor, 0.4-1.1) en la TarjetaGrafica «Ausentismo por día de la semana» (centro 960, 430; 1200 × 440) y el halo pasa de violeta a tono-rosa (0.3-1.1). Las casillas de TiraSemana Lun · Mié · Vie (solo el horario del 3A, E = 2.5) aparecen con opacidad y escala 0.92 → 1 (1.0-1.5, +70 ms) con «17.7 %», «16.4 %» y «21.8 %» en su color de mezcla; la de Vie dibuja su anillo de 4 px (1.5-1.8) y en 1.60 entra «Día crítico: Viernes» desde el desenfoque (T9). La voz dice «Ves qué día faltan más» (0.90-2.80; ancla «más» 2.50, con Viernes visible desde 1.60).

Scene 2 (2.9-5.4s): La cámara baja por la misma página (viewport-change sobre un solo envoltorio, 3.00-3.90, power3.inOut): la tira sale por arriba y llega la estación «Alumnos en riesgo». A la derecha, la tarjeta «Mayor riesgo» (centro 1220, 540; 1080 × 640) con cinco filas de BarrasPildora que se revelan de izquierda a derecha en cascada (M5 con stat-bars-and-fills por clip-path, 3.80-4.70, +60 ms; cada cifra 0.35 s después de su barra): González Campos Mauricio 70 · Mendoza Ríos Héctor 66 · Cruz Rojas Iván 64 en rojo Alto, Díaz Castro Miguel 51 · Aguilar Ramos Luis 49 en ámbar Medio, con la leyenda «Alto · Medio». A la izquierda, la cifra de escenario «9» (160 px, 600) rueda como odómetro (M2, 4.40-5.00) sobre «alumnos en riesgo» (32 px, gris), sin denominador. La voz dice «y quiénes ya se acercan al límite» (3.20-6.00; «quiénes» 3.50, «límite» 5.70).

Scene 3 (5.4-7.6s): Rack focus a la fila de Iván (depth-of-field-blur sobre el grupo de las otras filas y el bloque del 9, nunca sobre la fila de Iván): en 5.60-6.00 ese grupo se atenúa a 0.35 y se desenfoca de 0 a 6 px; en 6.40-6.80 el desenfoque vuelve a 0 y solo queda la atenuación (desenfoque total ≤ 1.2 s, filter none en reposo). La fila de Iván queda nítida, plana y quieta desde 6.00 para el relevo.

## Frame 7 — Todavía a tiempo

- scene: La fila de Iván se despega del ranking y se abre en su tarjeta, su barra de faltas crece a 14.9 por ciento frente a la marca Límite 20 por ciento, le quedan 2 faltas, el cruce estimado es la semana 9 y entra la acción sugerida
- duration: 7.0s
- poster: 3.0s
- transition_in: cut
- status: outline
- src: compositions/frames/s07-a-tiempo.html
- type: benefit_highlight
- beat: alarma → esperanza
- blueprint: compose
- voiceover: "A Iván le quedan solo dos faltas… Todavía estás a tiempo de hablar con él."
- vo_anchor: «Iván» @ 0.85s; «dos» @ 2.60s; «tiempo» @ 4.70s
- sfx_cues: 0.10 whoosh-m; 0.60 soft-in; 1.00 draw; 1.95 tick-2; 3.00 pop-1; 4.90 soft-in
- asset_candidates: assets/21-analitica-3a--TablaRiesgo.png — fila real de Cruz Rojas Iván con Alto 64; assets/19-reportes-grupo-3a--BarrasPildora.png — barras reales de faltas por alumno con la marca Límite 20 (Iván 14.9), referencia del trazo discontinuo y del chip; assets/icons/trending-up.svg — icono de Al alza; assets/icons/calendar-days.svg — icono de Cruce estimado
- handoff_in: fila de Cruz Rojas Iván en Mayor riesgo — centro x=1220 y=560, 984 × 56 px (nombre 26 px a la izquierda, pista de 560 × 20 px con relleno rojo Alto al 64 %, cifra 64 a la derecha), scale 1, opacity 1, filter none, rotationX 0, rotationY 0, quieta (0 px/s); resto de filas y bloque del 9 a opacity 0.35 sin desenfoque; fondo E3 crema con halo tono-rosa (sigue del cuadro 6)

narrativeRole: Cierre del arco «a tiempo»: un nombre, un margen y qué hacer esta semana.
keyMessage: A Iván le quedan dos faltas y todavía hay tiempo de intervenir.

Compose: la fila se despega del ranking y se abre en la tarjeta del alumno (T13 + T3), su barra de faltas crece contra la marca de límite y la acción sugerida entra al final. Es la vista del docente en Analítica, no la del alumno.

Scene 1 (0.0-2.4s): La fila de Iván se despega como objeto flotante (card-morph-anchor, 0.0-0.9, power3.inOut) y se abre en su tarjeta (centro 960, 500; 1240 × 640; radio 28) con pose 3D suave de entrada (rotationX 5° → 0, rotationY 8° → 0, z −120 → 0 en 0.0-1.0, power3.out; plana desde 1.0) y sombra de tinta en capa aparte; el ranking y el 9 retroceden (escala 0.97, opacidad 0.35 → 0.12, 0.0-0.6). El contenido entra después del 60 %: avatar de iniciales «CR», «Cruz Rojas Iván» 40/600, «E260017 · 3A», StatusChip «Alto · 64 / 100» (tokens de ausente) y Lucide trending-up «Al alza» (0.6-1.0). Fila «Faltas»: pista de 900 px con la línea discontinua y el chip «Límite 20 %» (la única aparición de esta marca, lejos de la tasa semanal), relleno que crece a 14.9 % (stat-bars-and-fills, 1.00-1.70, power4.out) y «7 faltas · 14.9 %» 0.35 s después; en 1.50-2.00 la cifra «2» de «Faltas restantes» rueda como odómetro (vertical-spring-ticker, 120 px). La voz dice «A Iván le quedan solo dos faltas» (0.70-3.30; «dos» 2.60, con el 2 quieto desde 2.00).

Scene 2 (2.4-4.6s): En 3.00 la píldora «Cruce estimado: semana 9» (Lucide calendar-days) entra deslizándose desde la izquierda bajo la barra (0.5 s, power3.out). La voz dice «Todavía estás a tiempo de hablar con él» (3.60-6.60; «tiempo» 4.70).

Scene 3 (4.6-7.0s): En 4.90 entra desde el desenfoque (T9) el bloque «Acción sugerida» (gris, 24 px) · «Contactar al alumno esta semana» (tinta, 32/500), antes de que la voz diga «hablar». Lectura quieta hasta el final con la tarjeta plana; el último estado se congela bajo el blur-crossfade de salida.

## Frame 8 — SUSAN

- scene: Sobre el cielo aclarado, la ficha redonda de tinta del botón Pasar lista cae con estela y squash sin rebote y se resuelve en el wordmark SUSAN con su subrayado dorado y el lema debajo
- duration: 6.6s
- poster: 5.6s
- transition_in: blur-crossfade 0.6s
- status: outline
- src: compositions/frames/s08-cierre.html
- type: branding
- beat: calma → recordación
- blueprint: compose
- voiceover: "susan. Pasa lista en segundos."
- vo_anchor: «susan» @ 2.30s; «segundos» @ 4.00s
- sfx_cues: 0.25 whoosh-m; 0.98 whoosh-s; 1.00 thud; 1.55 soft-in; 2.30 sheen; 4.60 sheen-s
- asset_candidates: assets/icons/scan-face.svg — icono blanco de la ficha de tinta; assets/10-docente-home--BrandMark.png — BrandMark real SUSAN en Hanken 600 que el wordmark amplía, sin escudo en el cierre; assets/10-docente-home--Resaltado.png — trazo dorado real del subrayado; assets/10-docente-home.mobile.clean.png — captura móvil real con el botón central Pasar lista, referencia de la ficha (copiar desde capture/app-real/mobile/10-docente-home.clean.png con este nombre)

narrativeRole: Marca y lema: la misma ficha que nació del problema cae y firma la película.
keyMessage: SUSAN: pasa lista en segundos y entiende la asistencia de tus grupos.

Compose: sting de icono (M6) que se resuelve en el lockup de marca (DISENO-APP §4.4, C → A) con el lema debajo y un barrido holográfico de una sola pasada. Es el único cuadro con salida.

Scene 1 (0.0-1.4s): El blur-crossfade (0.6 s) cambia de mundo al cielo E1 aclarado (crema desde el 70 % hacia abajo), vacío; ningún desenfoque interno durante la transición. En 0.58 la ficha de tinta (168 px, anillo blanco de 15 px, scan-face blanco de 72 px) cae desde arriba (y −640 → 0 en 0.42 s, power2.in) con estela vertical ligada a la velocidad (motion-blur-streak sobre la ficha sola, filter none al posarse: el único objeto con estela) y toca en 1.00 en (960, 440); squash de volumen constante (scaleX 1.07, scaleY 0.93 en 0.07 s, origen abajo) y recuperación de 0.30 s power3.out, SIN rebote; la sombra azulada se contrae al contacto. Quieta en 1.37.

Scene 2 (1.4-3.4s): En 1.50-2.00 la ficha se desliza a la izquierda hasta x=713 (power3.inOut) mientras «SUSAN» se escribe a su derecha (Hanken Grotesk 600, 136 px, −0.025em, tinta, letra por letra con desenfoque 12 → 0 y +45 ms, power4.out, 1.60-2.45). En 2.30-3.20 se dibuja el trazo de Resaltado bajo la palabra (svg-path-draw, #A8842C al 80 %, 12 px): el único oro del cuadro. La voz dice «susan» (2.30) y en 2.90-3.60 el lema «Pasa lista en segundos y entiende la asistencia de tus grupos» (Hanken 500, 40 px, #6F6A65, una línea centrada en y=640) entra palabra por palabra desde el desenfoque (T9), antes de que la voz diga «Pasa lista en segundos» (3.10-4.30): es la única repetición permitida entre pantalla y voz.

Scene 3 (3.4-6.6s): En 4.60-5.30 el holograma DEGRADADO (#FF6AA9 #FFB36B #8BE3B5 #6BB8FF) cruza una sola vez la palabra en una copia recortada al texto (gradient-text-sweep, power2.inOut) y la marca vuelve a tinta. Quietud con 2.3 s de silencio tras la voz; en 6.30-6.60 todo se funde al lienzo (la única salida del video).
