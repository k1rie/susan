---
format: 1920x1080
duration: 55s
message: "Pasa lista en segundos y entiende la asistencia de tus grupos"
arc: "Odómetro de decisiones: 5 min → 4 h (el costo) → susan y un botón → 19 de 24 → 88 % (la clase de hoy) → 20.8 % → Viernes → quedan 2 (el grupo y el alumno) → la ficha firma"
audience: "docentes de la UNACH FCA C-I (producto, tono de lanzamiento)"
mode: collaborative
music: none
voice: "pendiente: ElevenLabs es-MX, se monta al final por anclas (vo_anchor)"
proposal: "C · Las cifras cuentan la historia"
---

<!-- PROPUESTA C · «Las cifras cuentan la historia» (guiada por datos)

PITCH
1. El hilo es un odómetro: siete cifras que ruedan y se asientan en golpes de sonido, cada una un punto de giro para la docente: 5 min → 4 h → 19 de 24 → 88 % → 20.8 % → Viernes → quedan 2.
2. Cada cuadro tiene UNA cifra héroe (120 a 180 px, Hanken 600 como máximo, tabular-nums) en la «ventana de la cifra» del tercio izquierdo, y a su lado el componente real de SUSAN que la produce: la barra de la clase, la tarjeta Pasar lista, la vista de cámara, el MedidorLiquido, la GraficaLinea, la TiraSemana y BarrasPildora.
3. La cifra llega antes de que la voz la nombre y se queda quieta mientras se nombra; la voz dice el número y la pantalla da la etiqueta real (texto en pantalla distinto de la locución).
4. El problema cabe en 6.8 s: una clase de 07:00 a 08:00 pierde su primer tramo de tinta, la barra se multiplica en la rejilla del semestre (16 semanas por Lun · Mié · Vie) y el odómetro cuenta de 5 a 240 min hasta «4 h».
5. susan aparece a los 7.3 s ocupando la ventana de la cifra y rueda a «24»: un solo botón abre la sesión, la tarjeta se vuelve la cámara y el contador arranca en cero; tres lecturas lo llevan a 19 de 24 y los retardos a 88 %.
6. La analítica se lleva 21.0 s (cuadros 5 a 7): la guía lee la semana como un odómetro hasta 20.8 % (sin la marca «Límite 20 %»), la misma ventana gira como tragamonedas de días hasta «Viernes» y cuenta hacia atrás de 9 a 2 faltas restantes de Iván.
7. Cierra la ficha redonda de tinta del botón central «Pasar lista»: cae con estela, squash de volumen constante sin rebote y se resuelve en el wordmark «SUSAN» con subrayado dorado y el lema.
8. Tres familias de transición (relevo con elemento compartido ×3, push-slide LEFT ×2, blur-crossfade ×2, sin zoom-through), 2 sobreimpulsos, 2 poses 3D suaves, 2 apariciones del cielo, oro solo en 2 cuadros, solo SFX.
9. 8 cuadros, 55.0 s, 104 palabras de voz (cobertura ≈ 75 %), sin cursor, sin serif.

SCRIPT (ElevenLabs es-MX, eleven_multilingual_v2, stability 0.35, similarity 0.8, style 0.45, semilla 1037, −17 LUFS por línea; «susan» en minúsculas; cifras con letra; anclas con holgura ±0.3 s; ventanas en segundos locales del cuadro y absolutos)
L1 · Frame 1 · local 1.20-6.55 s · abs 1.20-6.55 s · ancla «cuatro» @ 4.45 (abs 4.45) · Cinco minutos por sesión solo para nombrar alumnos… cuatro horas por grupo al semestre. (14)
L2 · Frame 2 · local 0.70-5.45 s · abs 7.50-12.25 s · ancla «veinticuatro» @ 3.35 (abs 10.15) · Con susan, abres la sesión de tus veinticuatro alumnos con un solo botón. (13)
L3 · Frame 3 · local 0.40-6.40 s · abs 13.80-19.80 s · ancla «diecinueve» @ 5.95 (abs 19.35) · La cámara del aula pasa lista mientras das clase… tres lecturas, y ya van diecinueve. (15)
L4 · Frame 4 · local 1.10-6.50 s · abs 21.30-26.70 s · ancla «ochenta» @ 2.00 (abs 22.20) · Con retardos, ochenta y ocho por ciento… y lo dudoso, lo decides tú. (13)
L5 · Frame 5 · local 0.70-6.95 s · abs 27.90-34.15 s · ancla «veinte» @ 3.70 (abs 30.90) · Con cada sesión, susan analiza tu grupo: veinte punto ocho por ciento… y al alza. (15)
L6 · Frame 6 · local 0.40-5.45 s · abs 35.40-40.45 s · ancla «viernes» @ 5.00 (abs 40.00) · Y te muestra el patrón: el día que más faltan… el viernes. (12)
L7 · Frame 7 · local 0.65-6.30 s · abs 41.85-47.50 s · ancla «dos» @ 2.70 (abs 43.90) · A Iván Cruz… le quedan dos faltas. Todavía estás a tiempo de hablar con él. (15)
L8 · Frame 8 · local 1.70-4.55 s · abs 49.90-52.75 s · ancla «susan» @ 2.30 (abs 50.50) · Esto es susan… pasa lista en segundos. (7)
Total: 104 palabras · ≈ 41.3 s de voz a ≈ 2.85 palabras/s hablando · cobertura ≈ 75 % · 1.2 s de silencio al abrir y 2.25 s al cerrar · costuras de voz de 0.95 a 2.4 s (la cifra entra antes que la palabra y en esos huecos caen los golpes).
-->

# STORYBOARD · SUSAN v4 · Propuesta C «Las cifras cuentan la historia»

## Video direction

**Idea.** La película es un odómetro de decisiones. Cada cuadro se ancla en una sola cifra que rueda, se asienta con un golpe de sonido y queda quieta mientras la voz la nombra: 5 min → 4 h (lo que cuesta pasar lista) → 24 → 0 de 24 → 19 de 24 → 88 % (la clase de hoy) → 20.8 % → Viernes → quedan 2 (el grupo y el alumno). La interfaz real de SUSAN enmarca a cada cifra: es el componente que la produce, no decoración. El ritmo lo ponen los aterrizajes de las cifras; la UI los explica.

**Ventana de la cifra (constante de maquetación).** La cifra héroe vive siempre en el tercio izquierdo: rótulo Hanken 500 a 32 px #6F6A65 con borde izquierdo en x 140 y tope en y ≈ 236; cifra Hanken 600 a 140-180 px, tracking −0.03em, tabular-nums, caja de cifra desde y 300; sublínea (etiqueta real, delta o meta) desde y ≈ 500. El componente que la produce ocupa la derecha (x 840-1780) o la banda baja (cuadro 1). Única excepción: en el cuadro 4 el tanque del MedidorLiquido va a la izquierda de su cifra, como en la app. Todo el contenido clave queda en y ≤ 900 y dentro de 1728 × 972. Así el ojo nunca busca: la cifra siempre aterriza en el mismo lugar y los cortes con elemento compartido son exactos.

**Odómetro (firma).** Columnas enmascaradas de alto exacto (constante de CSS, sin medir al renderizar), tira de dígitos generada una vez, sin reescribir texto por fotograma (T8, REFERENCIA-2 M2 y la regla vertical-spring-ticker con pasos sin rebote). Estela vertical ligada a la velocidad solo mientras gira (REFERENCIA-2 §3.1, filtro SVG en el área de la columna, filter none en reposo); la cifra nunca aterriza desenfocada. Un tic por columna al asentarse, nunca por entero. Las palabras también ruedan como renglones (SUSAN → 24 en el cuadro 2, días en el 6). Los rótulos cambian en sitio con blur-in (T9).

**Paleta por rol (tokens de DISENO-APP §1.10).** Lienzo #F7F5F2; paneles #FFFFFF con borde #E7E2DC de 2 px y sin sombra interna; tinta #1E1919 como único acento estructural (cifras, astillas del pase de lista, botón, guía, tooltip, ficha); grises #6F6A65 y #D8D2CA; azul #0061FE solo en el halo de foco y el enlace real «Otras sesiones de hoy (1)»; estados siempre con etiqueta y color; series de gráfica en --g-*. Oro #A8842C solo en el aro de la pulsación (cuadro 2) y en el subrayado de la marca (cuadro 8). Holograma: no se usa (el brillo blanco de una sola pasada basta).

**Escenarios.** E3 crema neutro (1) → E1 cielo crema (2, entra por blur-crossfade y se funde a E3 azul en el relevo) → E3 con halo del módulo: azul (3), azul → verde (4), violeta (5 y 6), rosa (7) → E1 aclarado (8). Cielo 2 veces, nunca bajo una gráfica. Grano estático al 4 %. Sombra solo en el objeto flotante, en capa aparte (azulada sobre cielo, de tinta sobre crema): tarjeta Pasar lista (2), tarjeta del medidor (4), tarjeta de Iván (7) y ficha (8).

**Escala y tipografía.** UI a E = 2 con zoom en un .ui (gráfica semanal a E = 1.6, casillas de TiraSemana a E = 2.5); cámara ≤ 1.3; nunca texto escalado quieto (al terminar un FLIP se cambia por su gemelo sin escala). Hanken Grotesk 400/500/600, nunca 700; ejes ≥ 22 px. Sin serif en esta propuesta: la cifra es la protagonista y la marca es la de la app (Hanken 600).

**Gramática de movimiento.** Llegadas power3.out o expo.out; viajes y morphs power3.inOut o expo.inOut de 0.5-0.9 s; la UI con los tiempos de la app (DISENO-APP §2.21). Un solo movimiento grande por tiempo interno; el odómetro y los rellenos son micro-movimiento de datos. Líneas que se dibujan antes de que la guía las recorra; la guía es el cabezal, sin puntero. Toques sin cursor: halo de foco nativo 0.15 s antes, compresión 0.96 y cambio de estado 0.04 s después (T7). Primer movimiento ≤ 0.2 s, héroe visible ≤ 0.5 s, sin respiración ni deriva lenta en la segunda mitad, sin salidas salvo el fundido final del cuadro 8.

**Revelado al ritmo de la voz.** La cifra se asienta 0.35-0.75 s antes de su palabra y queda quieta ≥ 1.2 s mientras se nombra. Nada se lee ni se ancla en los primeros 0.5-0.6 s de los cuadros con transición entrante (2, 5, 7 y 8). Texto en pantalla = cifras, etiquetas reales de la UI y rótulos de ≤ 8 palabras; la única repetición con la voz es el lema del cierre. Ninguna cola muerta ≥ 1.0 s después de la voz (salvo la retención final de la marca). Cuadro quieto deliberado: el 20.8 % del cuadro 5 (3.1-5.4 s), antes del clímax de datos.

**Transiciones (3 familias, sin zoom-through).** A · relevo con elemento compartido (cut + handoff con números idénticos, todo plano y quieto en el borde): 2→3 (ventana + vista de cámara), 3→4 (resumen + cámara), 5→6 (bloque de cifra + tarjeta de la gráfica). B · empuje: push-slide LEFT 0.5s dos veces (4→5 de la sesión a la analítica, 6→7 del patrón al alumno), siempre a la izquierda como la cinta de un contador. C · foco: blur-crossfade solo donde cambia el mundo (1→2 crema → cielo, 0.5s; 7→8 lienzo → cielo, 0.6s).

**Contabilidad (topes de SINTESIS).** Oro: 1 elemento en el cuadro 2 (aro de la pulsación) y 1 en el 8 (subrayado); ninguno en los demás (sin EMA dorada en la gráfica, oro nunca junto a un chip Retardo). Sobreimpulsos: 2 (recuperación de «Abrir y pasar lista» en el 2 y tooltip de la semana 15 en el 5); el squash del 8 no rebota. Pose 3D: solo el objeto flotante, solo en su entrada y solo dos veces (tarjeta Pasar lista en el 2: rotationX 6°, rotationY −8°; tarjeta de Iván en el 7: rotationX 5°, rotationY 8°), plana antes de cada lectura de cifra y en cada borde de cuadro; nada de rotationZ; tooltip recto. Estelas: ≤ 3 objetos por escena (columnas de odómetro, chip de lecturas, ficha). Desenfoque grande, uno a la vez: placa pre-desenfocada + rack focus de apertura (1), placa de la cámara que se aparta (4), filas del ranking a 6 px durante ≤ 1.2 s (7), y los dos blur-crossfade, nunca sumados a otro desenfoque.

**Sonido.** Solo SFX del catálogo derivado assets/sfx/CATALOG.json, ≈ 1 evento por segundo (57 en 55 s); tic o blip en el fotograma en que cada cifra se asienta, whoosh en el pico de velocidad de cada relevo, sheen en los brillos, thud en el contacto de la ficha. Transitorios fuertes en los huecos de la voz. Sin flash, sparkle, sparkle-short ni whoosh-rev. Tiempos en sfx_cues (segundos locales).

**Lista negativa.** Ni diapositiva ni salvapantallas. Sin cursor ni mano. Sin «Límite 20 %» junto a 20.8 % (la marca solo vive en la barra de faltas de Iván, cuadro 7). Sin «de 25» ni «(de 9)» junto a cifras de riesgo. Sin el cierre de la sesión de hoy, sin «Cerrar pase de lista». Sin cámara simulada, cuadros magenta, recortes de rostro ni reloj de demostración. Sin vista del alumno ni reportes. Sin cronómetros, sin «ahorra», sin «la IA aprende». Sin emojis, iconos que no sean Lucide ni «▲». Iconos que faltan y se extraen antes de construir: arrow-right (cuadro 2) y gauge (cuadro 5).

## Frame 1 — Cinco minutos, cuatro horas

- scene: En el lienzo crema vacío la cifra 5 min se enfoca sobre la barra de una clase de 07:00 a 08:00 cuyo primer tramo de tinta es el pase de lista, la barra se pliega en la rejilla del semestre (16 semanas por Lun · Mié · Vie), el odómetro cuenta hasta 240 min y rueda a 4 h
- duration: 6.8s
- poster: 4.6s
- transition_in: cut
- status: outline
- src: compositions/frames/s01-cinco-minutos.html
- type: hook
- beat: rutina → peso del tiempo perdido
- blueprint: dataviz-countup (Adapt)
- voiceover: "Cinco minutos por sesión solo para nombrar alumnos… cuatro horas por grupo al semestre."
- vo_anchor: «Cinco» @ 1.20s; «cuatro» @ 4.45s
- sfx_cues: 0.05 soft-in; 0.85 sheen-s; 1.00 draw; 2.30 whoosh-s; 2.55 fill; 3.45 tick-1; 3.60 click-soft2; 3.75 blip
- asset_candidates: assets/30-pasar-lista-inicio--BarraSegmentada.png — BarraSegmentada real, referencia de alto, separación y remates de la barra de la clase (se reconstruye en HTML); assets/21-analitica-3a--StatCard.png — StatCard real, referencia de la cifra 600 tabular con la unidad gris; assets/21-analitica-3a--TiraSemana.png — casillas reales, referencia de radio y gris muted de las celdas de la rejilla del semestre; assets/icons/clock.svg — Lucide clock del rótulo Pase de lista

narrativeRole: Gancho y problema en una sola cuenta: el pase de lista verbal se ve como minutos que se acumulan clase tras clase hasta volverse horas.
keyMessage: Cinco minutos por sesión son cuatro horas de clase por grupo al semestre.

Adapt: se conserva la firma de dataviz-countup (la cifra héroe que cuenta sobre su propia gráfica, variante Hook de una sola estadística); en lugar de iconos que estallan, la barra real de la app que se multiplica en la rejilla del semestre; sin cursor y sin serif.

Scene 1 (0.0-1.1s): apertura T1 sobre E3 crema sin halo y grano estático: placa pre-desenfocada (snapshot del estado nítido a 1.2 s pasado por gblur σ 18) que se funde sobre la capa viva, la capa viva enfoca con depth-of-field-blur de 12 px a 0 y el mundo baja de escala 1.12 a 1 en 1.3 s power3.out; el foco se traba a 0.85 s. Distribución tipo ref-04: ventana de la cifra arriba a la izquierda (rótulo «Pase de lista» con Lucide clock, cifra «5 min» a 160 px con «min» al 0.45em en gris) y banda de datos abajo a todo lo ancho (x 140-1780): la barra de una clase, alta 24 px, con «07:00» y «08:00» en los extremos a 22 px.
Scene 2 (1.0-2.3s): cuando la voz dice «Cinco minutos», el primer tramo de la barra (5 de 60 minutos) se rellena en tinta de izquierda a derecha con stat-bars-and-fills (clip-path, 0.5 s); el resto de la barra queda en muted. La cifra lleva quieta desde 0.85 s y sigue quieta mientras se nombra.
Scene 3 (2.3-3.45s): morph de componente M4 con constantes: la barra se pliega en la primera casilla de una rejilla de 16 columnas (S1 … S16, marcas a 22 px) por 3 filas (Lun · Mié · Vie, el horario real del 3A), y las casillas se encienden en una ola de izquierda a derecha de ≤ 0.6 s, cada una con su astilla de tinta de 5 minutos al inicio. A la derecha de la cifra entran deslizándose en x dos chips de multiplicador, «× 3 por semana» y «× 16 semanas» (rótulos en el eje ortogonal, M2). A la vez la cifra corre como odómetro con vertical-spring-ticker (3 columnas, expo.out, estela vertical solo mientras gira) de 5 a 240 min y se asienta a 3.45 s con un solo tic.
Scene 4 (3.45-3.75s): cambio de unidad en sitio: las columnas de «240» ruedan a «4», «min» sale con blur-out corto y entra «h» con blur-in (T9); debajo aparece en gris «= 240 min», la cuenta que la voz no dice.
Scene 5 (3.75-6.8s): «4 h» quieto 3 s mientras la voz dice «cuatro horas por grupo al semestre»; la rejilla de 48 sesiones con sus astillas de tinta queda como prueba. Sin salida: el cuadro termina quieto y lo cubre el blur-crossfade del cuadro 2.

## Frame 2 — susan y un solo botón

- scene: Sobre el cielo crema aterriza la tarjeta real Pasar lista del 3A con pose 3D suave, el nombre SUSAN ocupa la ventana de la cifra y rueda a 24 inscritos, la pulsación sin cursor de Abrir y pasar lista cambia Programada por Abierta y la tarjeta se transforma en la vista de cámara mientras el contador queda en 0 de 24 presentes
- duration: 6.6s
- poster: 1.9s
- transition_in: blur-crossfade 0.5s
- status: outline
- src: compositions/frames/s02-un-boton.html
- type: product_intro
- beat: alivio → curiosidad
- blueprint: cta-morph-press (Adapt)
- voiceover: "Con susan, abres la sesión de tus veinticuatro alumnos con un solo botón."
- vo_anchor: «susan» @ 1.05s; «veinticuatro» @ 3.35s; «botón» @ 5.10s
- sfx_cues: 0.10 soft-in; 0.60 blip; 1.45 sheen; 2.30 whoosh-s; 2.75 tick-1; 4.95 tap; 5.40 whoosh-m; 6.05 click-soft2
- asset_candidates: assets/10-docente-home--PasarListaHero.png — tarjeta Pasar lista real con sus textos, chip Programada y botón de tinta, referencia de tokens (se reconstruye en HTML en su versión móvil); assets/10-docente-home.mobile.clean.png — captura móvil real, referencia de la tarjeta a todo el ancho y del botón a todo el ancho (copiar desde capture/app-real/mobile/10-docente-home.clean.png con este nombre); assets/30-pasar-lista-inicio--VistaCamara.png — marco real de la vista de cámara con sus chips oscuros, solo maquetación (el lienzo simulado no se calca); assets/icons/scan-face.svg — Lucide scan-face de la ficha, del botón y del chip Reconociendo; assets/icons/camera.svg — Lucide camera de Cámara del aula lista; assets/icons/arrow-right.svg — Lucide arrow-right del botón (falta en assets/icons, extraer con lucide.mjs); assets/avatars/avatar-01-xr.svg — avatares Lorelei abstractos para los rostros de la cámara (usar la serie de assets/avatars)
- handoff_out: ventana de la cifra — rótulo «Asistencia ahora» Hanken 500 32 px #6F6A65 con borde izquierdo x=140 y tope y=236, cifra «0» Hanken 600 160 px tabular-nums con borde izquierdo x=140 y caja de y=300 a y=476, «de 24 presentes» Hanken 500 48 px #6F6A65 en la misma línea base a 24 px de la cifra · vista de cámara — caja x=880 y=200 w=900 h=506 radio 28 fondo #1E1919, 23 avatares Lorelei al 100 % sin marcos, chip «Reconociendo» con scan-face con esquina superior izquierda en x=904 y=224 y chip «Cámara frente» con esquina superior derecha en x=1756 y=224 · fondo E3 #F7F5F2 con halo #E6EEFC centrado en x=1330 y=450 · todo con scale 1, opacity 1, rotationX 0, rotationY 0, quieto (0 px/s) desde 6.05s

narrativeRole: Presentar la marca y la primera pantalla real antes del segundo 8, y convertir el grupo (24) en el contador que la cámara va a llenar.
keyMessage: Con susan, el pase de lista empieza con un solo botón.

Adapt: se conserva la firma de cta-morph-press en su variante Hook sin cursor (un widget solo que, al pulsarse, se transforma en su sitio y entrega su carga); el widget es la tarjeta real Pasar lista y la carga es la vista de cámara; la marca rueda en la ventana de la cifra en vez de condensarse.

Scene 1 (0.0-0.55s): bajo el blur-crossfade aparece E1 cielo crema (degradado tono-azul → crema, nubes radiales sin filter en 3 planos con paralaje lento, grano estático) y la tarjeta PasarListaHero real en su versión móvil a E = 2 (716 px de ancho, a la derecha en x 1000-1716 y y 200-840: ficha scan-face en tono-azul, «Pasar lista», chip «Programada», «Administración Financiera (3A)», «07:00 - 08:00 · Aula A-12», «Cámara del aula lista», botón primario de tinta «Abrir y pasar lista» a todo el ancho con scan-face y arrow-right, enlace azul «Otras sesiones de hoy (1)») entra como objeto de escenario con split-tilt-cards en su forma de una sola tarjeta: rotationX 6° y rotationY −8° → 0, z −160 → 0, y 40 → 0 en 1.4 s power3.out desde 0.1 s, sombra azulada en capa aparte.
Scene 2 (0.55-2.2s): en la ventana de la cifra entra «SUSAN» en Hanken 600 a 140 px, tinta, tracking −0.025em, con el blur-in de la app (T9, BlurText por palabra) justo antes de que la voz diga «susan» (la marca en pantalla a 7.35 s absolutos); la tarjeta queda plana a 1.5 s y un brillo blanco la cruza una sola vez (T4, 0.7 s).
Scene 3 (2.2-4.8s): la ventana es un rodillo: «SUSAN» sube un renglón y rueda a su lugar «24» (dos columnas con vertical-spring-ticker sin rebote, estela vertical solo mientras gira) con «inscritos» en gris a 48 px en la misma línea base; «24» se asienta a 2.75 s y queda quieto mientras la voz dice «veinticuatro alumnos».
Scene 4 (4.8-5.2s): pulsación sin cursor (T7): halo de foco de la app (8 px rgba(0,97,254,.3)) en el botón a 4.8 s, compresión a 0.96 a 4.95 s y recuperación con press-release-spring y un sobreimpulso corto (el primero de los dos del video); el chip pasa de «Programada» a «Abierta» 0.04 s después y un aro de oro se abre desde el botón (escala 1 → 1.7, opacidad .6 → 0, 0.6 s): el único oro del cuadro.
Scene 5 (5.2-6.05s): relevo con card-morph-anchor (constantes, power3.inOut 0.85 s, escala uniforme más recorte con clip-path de radio fijo, el fondo blanco → tinta como pintura, contenido viejo fuera antes del 40 % y nuevo después del 60 %): la tarjeta viaja y se vuelve la vista de cámara (x 880-1780, y 200-706, radio 28) con sus chips oscuros nativos «Reconociendo» y «Cámara frente» y 23 avatares Lorelei sin marcos; el cielo se funde a E3 crema con halo azul; en la ventana «24» se encoge con FLIP hasta la etiqueta «de 24 presentes» (al final se cambia por su gemelo sin escala), un «0» sube al lugar de la cifra y entra el rótulo real «Asistencia ahora».
Scene 6 (6.05-6.6s): todo quieto, plano y nítido para el corte.

## Frame 3 — Tres lecturas, diecinueve presentes

- scene: La vista de cámara del aula marca a los alumnos en tres oleadas de lectura, el chip de lecturas rueda 1/3, 2/3 y 3/3, los marcos pasan a verde con su etiqueta, se revela la barra real del resumen y el contador de la ventana rueda de 0 a 19 de 24 presentes
- duration: 6.8s
- poster: 5.6s
- transition_in: cut
- status: outline
- src: compositions/frames/s03-diecinueve.html
- type: feature_showcase
- beat: expectativa → confianza
- blueprint: dataviz-countup (Adapt)
- voiceover: "La cámara del aula pasa lista mientras das clase… tres lecturas, y ya van diecinueve."
- vo_anchor: «cámara» @ 0.75s; «tres» @ 4.00s; «diecinueve» @ 5.95s
- sfx_cues: 0.20 scan; 1.90 blip; 3.45 check; 3.70 fill; 5.20 tick-2; 5.50 soft-in
- asset_candidates: assets/33-pasar-lista-presentes--VistaCamara.png — marco y chips oscuros reales de la vista de cámara, solo maquetación (no se calcan los cuadros magenta del lienzo simulado); assets/33-pasar-lista-presentes--ResumenPaseLista.png — resumen real Asistencia ahora con su cifra, su barra y su línea de detalle; assets/33-pasar-lista-presentes--BarraSegmentada.png — barra segmentada real del resumen; assets/avatars/avatar-01-xr.svg — avatares Lorelei abstractos para los 23 rostros (usar la serie de assets/avatars); assets/icons/scan-face.svg — Lucide scan-face del chip Reconociendo
- handoff_in: ventana de la cifra — rótulo «Asistencia ahora» Hanken 500 32 px #6F6A65 con borde izquierdo x=140 y tope y=236, cifra «0» Hanken 600 160 px tabular-nums con borde izquierdo x=140 y caja de y=300 a y=476, «de 24 presentes» Hanken 500 48 px #6F6A65 en la misma línea base a 24 px de la cifra · vista de cámara — caja x=880 y=200 w=900 h=506 radio 28 fondo #1E1919, 23 avatares Lorelei al 100 % sin marcos, chip «Reconociendo» con scan-face con esquina superior izquierda en x=904 y=224 y chip «Cámara frente» con esquina superior derecha en x=1756 y=224 · fondo E3 #F7F5F2 con halo #E6EEFC centrado en x=1330 y=450 · todo con scale 1, opacity 1, rotationX 0, rotationY 0, quieto (0 px/s) en 0.0s
- handoff_out: ventana de la cifra — rótulo «Asistencia ahora» en x=140 y=236, cifra «19» Hanken 600 160 px en x=140 caja y=300 a y=476, «de 24 presentes» 48 px en la misma línea base, BarraSegmentada x=140 y=516 w=680 h=24 (Presentes 19 #27A06A, Retardos 2 #C98100, Pendientes 1 #8F8A82, Sin registro 2 #DE4D44, separación 4), línea «2 con retardo · 2 sin registro · 1 por revisar» Hanken 400 28 px #6F6A65 en x=140 y=566 · vista de cámara en la misma caja x=880 y=200 w=900 h=506 con 19 marcos verdes #27A06A, 2 marcos ámbar #C98100 con StatusChip «Retardo», 1 marco blanco con StatusChip «Pendiente», la visita al 30 %, chip «Lecturas 3/3» con esquina inferior izquierda en x=904 y=682 y los dos chips superiores como al entrar · meta «Última captura: 23 rostros · 22 válidos» Hanken 400 24 px #6F6A65 en x=880 y=730 · halo #E6EEFC centrado en x=1330 y=450 · todo con scale 1, opacity 1, rotationX 0, rotationY 0, quieto (0 px/s) desde 5.9s

narrativeRole: El clímax de producto contado como cifra: la cámara confirma con tres lecturas y el contador se llena solo mientras la clase sigue.
keyMessage: La cámara pasa lista mientras das clase y ya van diecinueve de veinticuatro.

Adapt: se conserva la firma de dataviz-countup (la cifra cuenta a la vista del instrumento que la produce); el instrumento es la vista de cámara con marcos de detección por oleadas y el resumen real de la sesión. Sin cursor, sin puntajes ni porcentajes de reconocimiento en pantalla.

Scene 1 (0.0-0.2s): mismo fotograma que el final del cuadro 2 (handoff), quieto.
Scene 2 (0.2-1.9s): primera oleada (una captura = una oleada, CONTENIDO §2.1): ai-tracking-box recoloreado a tokens, esquinas blancas de 2 px × E con radio 8 que se fijan sobre 22 rostros en ≤ 0.4 s con escalonado por índice (determinista); el rostro 23, la visita con su avatar atenuado, recibe esquinas que se apagan al 30 %: sin marco válido, sin decirlo. Abajo a la izquierda del marco entra un chip oscuro nativo «Lecturas 1/3». La voz empieza con «La cámara del aula».
Scene 3 (1.9-3.45s): segunda oleada: las esquinas parpadean una vez y el chip rueda un solo renglón a «2/3» (M2, sin contar); el contador de la ventana sigue en 0, porque nadie es presente con dos lecturas.
Scene 4 (3.45-4.3s): tercera oleada en el hueco de la voz: el chip rueda a «3/3» y se asienta a 3.55 s, antes de «tres»; las esquinas pasan a verde #27A06A en 19 rostros en una ola de ≤ 0.45 s, a ámbar #C98100 con StatusChip «Retardo» en 2 y quedan blancas con «Pendiente» en 1. En la ventana se revela la BarraSegmentada real (Presentes 19, Retardos 2, Pendientes 1, Sin registro 2) con stat-bars-and-fills de izquierda a derecha (0.8 s) y debajo entra con blur-in la línea real «2 con retardo · 2 sin registro · 1 por revisar».
Scene 5 (4.3-5.2s): el odómetro de la ventana rueda de 0 a 19 con vertical-spring-ticker (expo.out 0.9 s, decenas una vuelta y unidades dos, 2 columnas con estela vertical solo mientras giran) y se asienta a 5.2 s con un tic.
Scene 6 (5.2-6.8s): «19 de 24 presentes» quieto mientras la voz dice «y ya van diecinueve»; a 5.5 s entra bajo la cámara la meta real «Última captura: 23 rostros · 22 válidos» (blur-in corto, 24 px gris) y desde 5.9 s todo queda quieto y plano para el corte.

## Frame 4 — Ochenta y ocho por ciento

- scene: La cámara baja un piso por el mismo mundo de la sesión hasta el medidor líquido real, el 19 de la etiqueta rueda a 21 al sumar los dos retardos, la cifra rueda a 88 % Presentes ahora y al final sube la fila de Renata en Pendiente con lecturas 2/3, el único caso por revisar
- duration: 7.0s
- poster: 3.0s
- transition_in: cut
- status: outline
- src: compositions/frames/s04-ochenta-y-ocho.html
- type: feature_showcase
- beat: confianza → control
- blueprint: dataviz-countup (Adapt)
- voiceover: "Con retardos, ochenta y ocho por ciento… y lo dudoso, lo decides tú."
- vo_anchor: «retardos» @ 1.45s; «ochenta» @ 2.00s; «dudoso» @ 4.90s
- sfx_cues: 0.25 whoosh-s; 0.60 soft-in; 0.70 fill; 1.35 tick-1; 1.55 tick-3; 3.85 pop-1; 4.40 click-soft2
- asset_candidates: assets/33-pasar-lista-presentes--MedidorLiquido.png — MedidorLiquido real con tanque, cifra, Presentes ahora e inscritos (se reconstruye con los datos canónicos 88 % y 21 de 24); assets/33-pasar-lista-presentes--TablaAlumnosSesion.png — tabla real de la sesión, referencia de la fila con avatar de iniciales, lecturas y StatusChip; assets/33-pasar-lista-presentes--StatusChip.png — StatusChip real, referencia de los chips Retardo y Pendiente
- handoff_in: ventana de la cifra — rótulo «Asistencia ahora» en x=140 y=236, cifra «19» Hanken 600 160 px en x=140 caja y=300 a y=476, «de 24 presentes» 48 px en la misma línea base, BarraSegmentada x=140 y=516 w=680 h=24 (Presentes 19 #27A06A, Retardos 2 #C98100, Pendientes 1 #8F8A82, Sin registro 2 #DE4D44, separación 4), línea «2 con retardo · 2 sin registro · 1 por revisar» Hanken 400 28 px #6F6A65 en x=140 y=566 · vista de cámara en la misma caja x=880 y=200 w=900 h=506 con 19 marcos verdes #27A06A, 2 marcos ámbar #C98100 con StatusChip «Retardo», 1 marco blanco con StatusChip «Pendiente», la visita al 30 %, chip «Lecturas 3/3» con esquina inferior izquierda en x=904 y=682 y los dos chips superiores como al entrar · meta «Última captura: 23 rostros · 22 válidos» Hanken 400 24 px #6F6A65 en x=880 y=730 · halo #E6EEFC centrado en x=1330 y=450 · todo con scale 1, opacity 1, rotationX 0, rotationY 0, quieto (0 px/s) en 0.0s

narrativeRole: Traducir el conteo en la cifra que la docente revisa en vivo (presentes más retardos) y dejar claro que lo dudoso no lo decide la cámara.
keyMessage: Ochenta y ocho por ciento ya está en clase y el caso dudoso espera tu decisión.

Adapt: se conserva la firma de dataviz-countup (la cámara se desplaza de un instrumento a otro y la cifra cuenta al llegar); el instrumento es el MedidorLiquido real, que la app reserva para la sesión en vivo. Sin cierre de sesión, sin «Cerrar pase de lista».

Scene 1 (0.0-0.2s): quieto, idéntico al final del cuadro 3.
Scene 2 (0.2-0.9s): el único movimiento grande del cuadro: viewport-change baja la cámara ≈ 560 px (power3.inOut 0.7 s, un solo escritor de cámara) por el mismo mundo de la sesión; el resumen y la vista de cámara quedan recortados arriba como contexto y el halo pasa de azul a verde #E5F3EE con un fundido de 0.6 s. Abajo esperaba la fila del MedidorLiquido real a escala de escenario: tanque 168 × 336 (radio 48, vidrio #F0EDE8, líquido azul #4A86F0 como en la captura, 5 marcas) con borde izquierdo en x 140 y, a su derecha, la cifra en «0 %» a 150 px, «Presentes ahora» Hanken 500 32 px y «19 de 24 inscritos» 28 px gris.
Scene 3 (0.6-1.55s): el líquido sube a 88 % con el oleaje amortiguado apto para seek de DISENO-APP §2.18 (tween lineal que escribe el clip-path) y la cifra rueda de 0 a 88 % con vertical-spring-ticker (expo.out 0.95 s, 2 columnas con estela vertical solo en movimiento). A 1.25 s entra junto a la etiqueta un StatusChip «Retardo» con «2» y el «19» de «19 de 24 inscritos» rueda a «21» (un renglón por paso, 0.3 s) justo cuando la voz dice «Con retardos»: el medidor cuenta presentes más retardos, como la app. La cifra se asienta a 1.55 s.
Scene 4 (1.55-3.8s): «88 %» quieto 2.25 s mientras la voz dice «ochenta y ocho por ciento»; la única vida es el oleaje del líquido que termina de amortiguarse (micro).
Scene 5 (3.8-4.6s): en el hueco de la voz sube a la derecha (x 1000-1780, y 640-784) la fila real de la tabla de la sesión (y 28 → 0, 0.45 s power3.out) bajo el rótulo «1 por revisar»: avatar de iniciales «GM», «Gómez Medina Renata», «Lecturas 2/3» y StatusChip «Pendiente»; a 4.4 s el chip recibe el halo de foco de la app, sin cursor, antes de «dudoso».
Scene 6 (4.6-7.0s): quieto mientras la voz cierra «lo decides tú» (termina a 6.5 s); el cuadro queda plano para el empuje del cuadro 5.

## Frame 5 — Veinte punto ocho

- scene: Analítica del 3A: los seis puntos semanales brotan y la recta de ajuste se dibuja, una guía recorre S1 a S6 y la cifra héroe la lee como odómetro hasta asentarse en 20.8 % con +4.2 pp vs. semana previa, después la proyección punteada llega a la semana 15 con su banda del 95 % y un tooltip recto de tinta marca 24.8 %
- duration: 7.8s
- poster: 4.4s
- transition_in: push-slide LEFT 0.5s
- status: outline
- src: compositions/frames/s05-veinte-punto-ocho.html
- type: feature_showcase
- beat: control → preocupación informada
- blueprint: dataviz-countup (Adapt)
- voiceover: "Con cada sesión, susan analiza tu grupo: veinte punto ocho por ciento… y al alza."
- vo_anchor: «susan» @ 1.95s; «veinte» @ 3.70s; «alza» @ 6.60s
- sfx_cues: 0.15 whoosh-m; 0.50 draw; 1.50 scan; 3.10 tick-1; 3.30 blip; 5.40 draw; 6.45 pop-3
- asset_candidates: assets/21-analitica-3a--GraficaSerie.png — gráfica real Ausentismo semanal del 3A, referencia de ejes, puntos, ajuste, proyección y banda (en el video se omiten la línea Límite 20 % y la EMA); assets/21-analitica-3a--StatCard.png — StatCard real Ausentismo actual 20.8 % con su delta, referencia del rótulo, la pastilla y el tono danger; assets/icons/trending-up.svg — Lucide trending-up del chip de delta; assets/icons/gauge.svg — Lucide gauge de la pastilla de la StatCard (falta en assets/icons, extraer con lucide.mjs)
- handoff_out: ventana de la cifra — pastilla danger 56 × 56 radio 16 #FBE4E1 con gauge #B3261E en x=140 y=228 y rótulo «Ausentismo actual» Hanken 500 32 px #6F6A65 a 20 px a su derecha, cifra «20.8 %» Hanken 600 160 px (el % al 0.45em en #6F6A65) con borde izquierdo x=140 y caja y=300 a y=476, chip «+4.2 pp vs. semana previa» con trending-up, Hanken 500 30 px #B3261E en x=140 y=500 · TarjetaGrafica x=840 y=150 w=940 h=730 radio 28 borde 2 px #E7E2DC sin sombra con título «Ausentismo semanal», área de trazado x=920-1700 y=260-760 (0 % a 60 %), puntos S1-S6, ajuste, proyección hasta S15 y banda del 95 % · guía vertical en x=1700 de y=260 a y=760 · tooltip píldora recta rgba(30,25,25,.88) «Semana 15 · 24.8 %» en blanco 24 px con borde derecho en x=1684 y centro en y=490 · halo #EEE9F7 centrado en x=1310 y=500 · todo con scale 1, opacity 1, rotation 0, rotationX 0, rotationY 0, quieto (0 px/s) desde 6.8s

narrativeRole: Pasar de la clase de hoy al grupo en el tiempo: la misma ventana que contó presentes ahora lee la tendencia semana por semana.
keyMessage: susan analiza cada sesión y muestra hacia dónde va el ausentismo del grupo.

Adapt: se conserva la firma de dataviz-countup (la cifra héroe rueda sobre la gráfica que la produce); la guía es el cabezal, sin puntero, y la cifra es su lectura; svg-path-draw dibuja antes de que chart-scrub-readout recorra. Se omiten la marca «Límite 20 %» (es tasa semanal, no faltas acumuladas, CONTENIDO §3.11.4) y la EMA dorada (oro reservado).

Scene 1 (0.0-0.5s): entra con el empuje a la izquierda sobre E3 crema con halo violeta #EEE9F7 y grano al 4 %: en la ventana la pastilla danger de la StatCard real (icono gauge) y el rótulo «Ausentismo semanal»; a la derecha la TarjetaGrafica «Ausentismo semanal» a E = 1.6 (x 840-1780, y 150-880, borde 2 px, sin sombra) con su cuadrícula horizontal, eje Y 0 % a 60 %, eje X S1 … S15 a 22 px y la leyenda real «Observada · Ajuste · Proyección · Intervalo 95 %».
Scene 2 (0.45-1.5s): los puntos observados S1-S6 brotan en ola de izquierda a derecha (tinta con aro blanco, escala .3 → 1) y la recta de ajuste azul #4A86F0 se dibuja con svg-path-draw (1.0 s) mientras la voz dice «Con cada sesión»; en la ventana aparece «13.3 %» con «Semana 1» en gris debajo.
Scene 3 (1.5-3.1s): chart-scrub-readout sin puntero: una guía vertical de tinta de 2 px con su punto recorre S1 → S6 movida por un solo driver (power1.inOut 1.6 s) y la cifra héroe es su lectura: rueda por índice con vertical-spring-ticker (0.25 s por cambio, 3 columnas con estela solo al girar, el texto solo cambia al cambiar de índice) 13.3 → 20.0 → 22.0 → 15.3 → 16.7 → 20.8 %, con «Semana N» cambiando sin estela; se asienta en S6 a 3.1 s con un tic.
Scene 4 (3.1-5.4s): el rótulo cambia en sitio a «Ausentismo actual» (T9) y «Semana 6» se vuelve el chip real «+4.2 pp vs. semana previa» con trending-up en tono danger (T8, blur-in a 3.3 s); la cifra queda quieta 2.3 s mientras la voz dice «veinte punto ocho por ciento». Cuadro quieto deliberado del video.
Scene 5 (5.4-6.45s): la proyección punteada S6 → S15 se dibuja con svg-path-draw (1.0 s), la banda del intervalo de 95 % se abre con un fundido de 0.8 s y la guía viaja hasta S15 (power1.inOut 1.0 s); la cifra héroe no se mueve.
Scene 6 (6.45-7.8s): en «alza» el tooltip recto de tinta (píldora rgba(30,25,25,.88), texto blanco 24 px 500 tabular, sin inclinación y volteado a la izquierda de la guía por el borde derecho) «Semana 15 · 24.8 %» salta con el segundo y último sobreimpulso del video (escala .6 → 1.04 → 1 en 0.35 s); desde 6.8 s todo queda quieto y plano para el corte.

## Frame 6 — Viernes

- scene: El bloque de la cifra se queda y la gráfica semanal se transforma en el patrón por día, tres casillas Lun · Mié · Vie se llenan una por una mientras la ventana gira como tragamonedas de días y se detiene en Viernes, la casilla de 21.8 % recibe su anillo real y aparece 32 ausencias en 6 sesiones
- duration: 6.2s
- poster: 5.2s
- transition_in: cut
- status: outline
- src: compositions/frames/s06-viernes.html
- type: benefit_highlight
- beat: curiosidad → revelación
- blueprint: dataviz-countup (Adapt)
- voiceover: "Y te muestra el patrón: el día que más faltan… el viernes."
- vo_anchor: «patrón» @ 1.80s; «viernes» @ 5.00s
- sfx_cues: 0.25 whoosh-s; 0.95 soft-in; 2.50 tick-1; 3.05 tick-2; 3.70 tick-3; 4.50 blip; 4.60 draw
- asset_candidates: assets/21-analitica-3a--PatronSemanal.png — tarjeta real Ausentismo por día de la semana del 3A (en el video solo Lun, Mié y Vie); assets/21-analitica-3a--TiraSemana.png — casillas reales con su color por valor y el anillo de Vie
- handoff_in: ventana de la cifra — pastilla danger 56 × 56 radio 16 #FBE4E1 con gauge #B3261E en x=140 y=228 y rótulo «Ausentismo actual» Hanken 500 32 px #6F6A65 a 20 px a su derecha, cifra «20.8 %» Hanken 600 160 px (el % al 0.45em en #6F6A65) con borde izquierdo x=140 y caja y=300 a y=476, chip «+4.2 pp vs. semana previa» con trending-up, Hanken 500 30 px #B3261E en x=140 y=500 · TarjetaGrafica x=840 y=150 w=940 h=730 radio 28 borde 2 px #E7E2DC sin sombra con título «Ausentismo semanal», área de trazado x=920-1700 y=260-760 (0 % a 60 %), puntos S1-S6, ajuste, proyección hasta S15 y banda del 95 % · guía vertical en x=1700 de y=260 a y=760 · tooltip píldora recta rgba(30,25,25,.88) «Semana 15 · 24.8 %» en blanco 24 px con borde derecho en x=1684 y centro en y=490 · halo #EEE9F7 centrado en x=1310 y=500 · todo con scale 1, opacity 1, rotation 0, rotationX 0, rotationY 0, quieto (0 px/s) en 0.0s

narrativeRole: Del cuánto al cuándo: el patrón por día convierte la tendencia en algo que la docente puede atender en su horario.
keyMessage: El viernes es el día que más faltan en el 3A.

Adapt: se conserva la firma de dataviz-countup (la cifra héroe gira sobre su instrumento); la cifra aquí es una palabra que rueda como renglón de odómetro y el instrumento es la TiraSemana real (bloque resaltado de T10 con el anillo propio de la app, sin tooltip).

Scene 1 (0.0-0.2s): quieto, idéntico al final del cuadro 5.
Scene 2 (0.2-1.8s): relevo en sitio con card-morph-anchor (power3.inOut): el contenido de la gráfica sale antes del 40 % (los puntos caen a la base, guía, banda y tooltip se apagan), la tarjeta se recorta en alto con clip-path de radio fijo de 730 a 520 px anclada arriba y el título cambia en sitio a «Ausentismo por día de la semana» (T9); el chip de delta se apaga y la cifra «20.8 %» sigue con su rótulo; a 0.9 s suben tres casillas vacías de TiraSemana a E = 2.5 (Lun · Mié · Vie, #F0EDE8 con «-», 280 × 180, radio 28) con el movimiento real (opacidad y escala .92 → 1, +70 ms por casilla) y a 1.4 s se escriben sus días debajo; Sáb y Dom no se muestran. La voz dice «Y te muestra el patrón».
Scene 3 (1.8-2.4s): micro-pausa de lectura: casillas listas, «20.8 %» todavía en la ventana.
Scene 4 (2.4-4.5s): el rótulo cambia en sitio a «Día crítico» y la ventana se vuelve rodillo de días (vertical-spring-ticker con renglones de palabra, Hanken 600 a 140 px, expo.out, estela vertical solo al girar): «20.8 %» sube y pasan «Lunes» (2.5 s), «Miércoles» (3.05 s) y «Viernes» (3.7 s, con asentamiento largo hasta 4.5 s); cada paso enciende su casilla con su color real (mezcla de #DE4D44 con #F0EDE8 según DISENO-APP §2.16) y su cifra: Lun 17.7 %, Mié 16.4 %, Vie 21.8 %.
Scene 5 (4.5-5.45s): «Viernes» quieto; alrededor de la casilla Vie se traza su anillo real de 4 px rgba(179,38,30,.7) en 0.4 s, su resaltado; la voz dice «el viernes».
Scene 6 (5.45-6.2s): bajo la cifra entra en gris la meta real «32 ausencias en 6 sesiones» (blur-in corto, 30 px); todo queda quieto y plano para el empuje del cuadro 7.

## Frame 7 — Quedan dos

- scene: Ranking real Mayor riesgo del 3A, la fila de Cruz Rojas Iván se enfoca y se levanta como tarjeta flotante con su barra de faltas frente a la marca Límite 20 %, la ventana cuenta hacia atrás de 9 a 2 faltas restantes, aparece Cruce estimado semana 9 y la acción sugerida Contactar al alumno esta semana
- duration: 7.0s
- poster: 5.2s
- transition_in: push-slide LEFT 0.5s
- status: outline
- src: compositions/frames/s07-quedan-dos.html
- type: benefit_highlight
- beat: alarma → oportunidad
- blueprint: dataviz-countup (Adapt)
- voiceover: "A Iván Cruz… le quedan dos faltas. Todavía estás a tiempo de hablar con él."
- vo_anchor: «Iván» @ 0.90s; «dos» @ 2.70s; «tiempo» @ 4.75s
- sfx_cues: 0.15 whoosh-m; 0.30 fill; 0.50 soft-in; 1.10 whoosh-s; 1.50 draw; 2.00 tick-2; 3.45 blip; 4.30 click-soft2
- asset_candidates: assets/21-analitica-3a--BarrasPildora.png — ranking real Mayor riesgo con los 8 puntajes en Alto y Medio; assets/21-analitica-3a--TablaRiesgo.png — tabla real de riesgo, referencia de Cruz Rojas Iván Alto 64 / 100, 7 faltas, 2 restantes y cruce semana 9; assets/19-reportes-grupo-3a--BarrasPildora.png — barras reales por alumno con la marca discontinua y su chip Límite 20 %, referencia de la barra de faltas de Iván

narrativeRole: Cerrar el arco «a tiempo»: del grupo a un nombre, un margen y una acción para esta semana.
keyMessage: A Iván le quedan dos faltas y todavía estás a tiempo de hablar con él.

Adapt: se conserva la firma de dataviz-countup (la cifra héroe cuenta a la vista del instrumento); el instrumento es el ranking real que se enfoca en una fila con depth-of-field-blur y la fila se vuelve tarjeta con card-morph-anchor; la cifra cuenta hacia atrás, de las 9 faltas permitidas a las 2 que le quedan.

Scene 1 (0.0-0.5s): entra con el empuje a la izquierda sobre E3 con halo rosa #FBE6E2: en la ventana el rótulo real «Faltas restantes» y la cifra «9» a 180 px (el margen completo del periodo); a la derecha la TarjetaGrafica «Mayor riesgo» (x 860-1780, y 150-880, sin el subtítulo con denominador) con BarrasPildora a E = 2 y sus 8 filas reales: González Campos Mauricio 70, Mendoza Ríos Héctor 66 y Cruz Rojas Iván 64 en Alto #DE4D44, Díaz Castro Miguel 51, Aguilar Ramos Luis 49, Hernández Peña Paola 47, Rodríguez Domínguez Daniela 43 y Flores Cortés Sofía 42 en Medio #C98100, leyenda «Alto · Medio»; las barras se revelan con clip-path de izquierda a derecha (+60 ms por fila, 0.85 s) desde 0.1 s y cada cifra aparece después de su barra.
Scene 2 (0.45-1.0s): rack focus con depth-of-field-blur: las otras 7 filas pasan a 6 px y opacidad .45 y la fila de Cruz Rojas Iván queda nítida con fondo #EFECE7 justo cuando la voz dice «Iván».
Scene 3 (1.0-1.55s): relevo con card-morph-anchor (constantes, power3.inOut 0.55 s): la fila se levanta y se vuelve la tarjeta flotante del alumno (x 900-1740, y 220-760, radio 28, sombra de tinta en capa aparte) con pose 3D suave solo en la entrada (rotationX 5° y rotationY 8° → 0, z −120 → 0), plana a 1.55 s; el ranking queda detrás al 25 % y escala .96 y su desenfoque vuelve a 0 (1.15 s de desenfoque en total). Contenido fiel a E = 2: avatar de iniciales «CR», «Cruz Rojas Iván», «E260017», StatusChip «Alto · 64 / 100» en tokens de ausente, rótulo «Faltas» y una pista de barra a todo lo ancho (escala 0 a 30 % como la gráfica real) con la marca discontinua vertical y su chip «Límite 20 %».
Scene 4 (1.5-2.0s): la barra de Iván se llena de 0 a 14.9 % hacia la marca (clip-path, 0.5 s) y la ventana cuenta hacia atrás 9 → 2 con vertical-spring-ticker (una columna, power3.out, estela vertical solo al girar), asentada a 2.0 s con un tic; «7 (14.9 %)» aparece después de su barra.
Scene 5 (2.0-3.4s): «2» quieto mientras la voz dice «le quedan dos faltas»; el hueco entre la punta de la barra y la marca del límite es el «2» hecho espacio.
Scene 6 (3.4-4.3s): bajo la cifra entra con blur-in la meta real «Cruce estimado: semana 9» (30 px gris): hoy es la semana 7.
Scene 7 (4.3-7.0s): en el pie de la tarjeta entra la acción sugerida real, recortada a «Contactar al alumno esta semana» (Hanken 500 28 px, tinta), con un halo de foco breve antes de «tiempo»; después, lectura quieta mientras la voz termina (6.3 s) y el blur-crossfade del cierre la cubre.

## Frame 8 — La ficha firma

- scene: Sobre el cielo crema aclarado cae la ficha redonda de tinta del botón central Pasar lista de la barra móvil real, con estela vertical y squash de volumen constante sin rebote, se corre a la izquierda mientras se escribe SUSAN, se traza el subrayado dorado y aparece el lema
- duration: 6.8s
- poster: 5.0s
- transition_in: blur-crossfade 0.6s
- status: outline
- src: compositions/frames/s08-la-ficha-firma.html
- type: branding
- beat: claridad → confianza
- blueprint: logo-assemble-lockup (Adapt)
- voiceover: "Esto es susan… pasa lista en segundos."
- vo_anchor: «susan» @ 2.30s
- sfx_cues: 0.10 soft-in; 0.95 whoosh-s; 1.00 thud; 1.30 click-soft2; 2.00 sheen; 4.90 sheen-s
- asset_candidates: assets/10-docente-home.mobile.clean.png — captura móvil real con el botón central redondo de tinta Pasar lista de la barra inferior, referencia de la ficha (copiar desde capture/app-real/mobile/10-docente-home.clean.png con este nombre); assets/10-docente-home--Resaltado.png — subrayado dorado real bajo Patricia, referencia del trazo de la marca; assets/icons/scan-face.svg — Lucide scan-face blanco de la ficha

narrativeRole: Firmar con el objeto que abrió la sesión: el botón que pasa lista se vuelve la marca y el lema resume la promesa.
keyMessage: susan pasa lista en segundos y te ayuda a entender la asistencia de tus grupos.

Adapt: se conserva la firma de logo-assemble-lockup en su variante Brand_Outro con el icono que cae desde arriba (la marca llega a existir); la caída es la de REFERENCIA-2 M6 con estela M1, el lockup es el C de DISENO-APP §4.4 resuelto en el wordmark A. Sin escudos, sin destello blanco de impacto, sin rebote.

Scene 1 (0.0-0.6s): bajo el blur-crossfade aparece E1 cielo aclarado (degradado tono-azul que llega a crema al 70 % de la altura, nubes quietas porque ya es la segunda mitad, grano estático); el lienzo queda vacío.
Scene 2 (0.6-1.0s): la ficha (círculo de 168 px #1E1919, anillo blanco de 15 px, scan-face blanco de 72 px con trazo 1.75: el botón central de la barra móvil a escala de marca) cae desde fuera de cuadro al centro óptico (x 960, y 470) en 0.4 s con aceleración de gravedad y estela vertical ligada a la velocidad (REFERENCIA-2 §3.1, filtro SVG en el área de la ficha, σ ≤ 24, filter none en reposo): el único objeto con estela; toca a 1.0 s.
Scene 3 (1.0-1.35s): contacto con squash de volumen constante (escala X 1.07 y Y 0.93 en 0.07 s, origen abajo) y recuperación de 0.28 s power3.out sin rebote; la sombra en capa aparte (0 30px 90px rgba(30,25,25,.18)) se contrae al tocar.
Scene 4 (1.2-1.9s): la ficha se corre a la izquierda (power3.inOut 0.55 s) y a su derecha se escribe «SUSAN» letra por letra (blur 12 → 0, y 0.3em → 0, +45 ms por letra, power4.out) en Hanken 600 a 136 px, tinta, tracking −0.025em; el lockup queda centrado (ficha 168 + 44 + palabra).
Scene 5 (1.95-2.9s): el subrayado de Resaltado (#A8842C, opacidad .8, trazo 12 px con extremos redondos, trazado M2 8 C 22 3, 40 10, 60 5 S 90 4, 98 7) se dibuja bajo «SUSAN» con svg-path-draw en 0.9 s power4.out: el único oro del cuadro; la voz dice «Esto es susan» con la marca ya completa.
Scene 6 (3.0-4.9s): el lema real «Pasa lista en segundos y entiende la asistencia de tus grupos» (Hanken 500 40 px #6F6A65, una línea, 40 px bajo el subrayado) entra como bloque con blur-in (T9) justo antes de que la voz diga «pasa lista»: la única repetición permitida entre pantalla y voz.
Scene 7 (4.9-6.5s): con la voz ya terminada, un único brillo blanco cruza el lockup una vez (T4, 0.7 s) y la marca queda quieta y nítida en silencio de voz (2.25 s en total).
Scene 8 (6.5-6.8s): fundido final al lienzo crema #F7F5F2: la única salida del video.
