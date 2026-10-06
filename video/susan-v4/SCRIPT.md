# SCRIPT — susan-v4

**Voice:** ElevenLabs — por decidir con la persona dueña (la v3 usó «Antonio - Confident, Gentle and Clear», que exige plan de pago por API)
**Voice settings:** eleven_multilingual_v2 · stability 0.35 · similarity 0.8 · style 0.45 · speaker boost · seed 1037 · language_code es · loudnorm de dos pasadas a −17 LUFS por línea (TP −1.5) · texto vecino como contexto (probados en la v3)
**Voice direction:** Español de México, cálido y seguro, sin prisa: un colega que le cuenta a otro docente algo que le resuelve la mañana, con tono de lanzamiento pero nunca de anuncio gritado. Los «…» son pausas reales de media respiración; las comas, apenas un respiro. Las cifras se dicen con letra y sin énfasis exagerado; el énfasis va en las palabras ancla. «susan» siempre en minúsculas (en mayúsculas la deletrea); si en la toma suena italiana, probar «Súsan». La línea 7 baja medio tono y se vuelve cercana; la línea 8 cierra hacia abajo, firme.
**Total:** 100 palabras en 8 líneas · ≈ 38.5 s de voz a 2.6 palabras/s (≈ 70 % de cobertura de 55 s) · 1.0 s de silencio al abrir y 1.63 s al cerrar · tiempos locales de cada cuadro; las anclas marcan el inicio de la palabra (holgura ±0.3 s; nunca se estira un cuadro)

**Montaje con la voz real (2026-10-06):** las anclas de las líneas 1, 2, 3 y 7 se volvieron a medir sobre la voz de «Antonio» ya generada (`datos/voz-alineacion.json`): la locución real habla más junta que lo estimado (≈ 36 s de voz con sus pausas internas, contra ≈ 43.7 s de ventanas **Time:**) y con pausas «…» más cortas, y con las anclas originales las líneas 2, 3 y 7 no cabían en ±0.3 s con un solo desplazamiento (errores de hasta 0.89 s) y la 1 abría 0.04 s antes del segundo de silencio inicial. Se movieron solo las anclas y las ventanas **Time:**/**Video:** de esas líneas, hacia el evento visual que ya existía en la escena (sin tocar la voz ni la duración de ningún cuadro); las líneas 4, 5, 6 y 8 conservan sus anclas. Detalle por línea en `plan/VOZ-MONTAJE.md`.

---

## Line 1 — Cinco minutos cada clase (Frame 1)

**Time:** 1.00 – 6.05s
**Anchor:** «cinco» @ 2.05s · «cuatro» @ 3.96s
**Delivery:** Arranque limpio, casi de pizarrón: «Pasar lista» se dice como el nombre de un ritual conocido, coma breve. «cinco minutos cada clase» llano, y pausa de media respiración. «cuatro horas» con peso, sin dramatizar; cierra hacia abajo en «semestre». Video: 1.00 – 6.05 s.

    Pasar lista: cinco minutos cada clase… cuatro horas por grupo al semestre.

## Line 2 — Te presentamos a susan (Frame 2)

**Time:** 1.44 – 4.94s
**Anchor:** «susan» @ 2.00s · «botón» @ 4.84s
**Delivery:** El revelado: sonrisa en la voz, «susan» clara y sin acento extranjero, punto y pausa. La segunda frase es sencilla y práctica, con el énfasis en «un solo botón»; queda abierta en los «…» porque el botón se pulsa justo después. Video: 7.84 – 11.34 s.

    Te presentamos a susan. Abres la sesión con un solo botón…

## Line 3 — La cámara pasa lista (Frame 3)

**Time:** 1.40 – 6.65s
**Anchor:** «cámara» @ 1.60s · «alumno» @ 5.45s · «presente» @ 6.15s
**Delivery:** Descriptiva y tranquila, con asombro contenido: «pasa lista por ti mientras das tu clase» es la promesa, se dice cercana, con el peso en «por ti». Pausa en los «…» (ahí los marcos se vuelven verdes). «y cada alumno queda presente» llano y resuelto, cerrando hacia abajo en «presente». No se cuenta nada: ni lecturas ni capturas (decisión de la persona dueña, 2026-10-06). Video: 13.85 – 19.10 s.

    La cámara del aula pasa lista por ti mientras das tu clase… y cada alumno queda presente.

## Line 4 — Lo dudoso lo decides tú (Frame 4)

**Time:** 0.60 – 5.68s
**Anchor:** «dudoso» @ 1.26s · «Revisión» @ 3.11s · «decides» @ 4.65s
**Delivery:** Pregunta real y breve, entonación ascendente en «dudoso». «Te espera en Revisión» informativo, pausa en los «…» (ahí ocurre el toque). «y lo decides tú» con confianza y calidez, el «tú» firme y corto. Video: 21.55 – 26.63 s.

    ¿Algún caso dudoso? Te espera en Revisión… y lo decides tú.

## Line 5 — Qué día faltan más (Frame 5)

**Time:** 0.60 – 7.03s
**Anchor:** «sesión» @ 1.29s · «día» @ 4.53s · «viernes» @ 6.52s
**Delivery:** Cambio de capítulo: un poco más de aire. «Con cada sesión» abre, «susan analiza a tu grupo» explica, dos puntos con pausa breve. «qué día faltan más» como pregunta retórica, y tras la pausa de los «…», «el viernes» como remate cómplice, bajo y seguro. Video: 27.35 – 33.78 s.

    Con cada sesión, susan analiza a tu grupo: qué día faltan más… el viernes.

## Line 6 — Hacia dónde va (Frame 6)

**Time:** 0.75 – 7.27s
**Anchor:** «va» @ 2.03s · «semestre» @ 3.62s · «límite» @ 6.54s
**Delivery:** Oración completa con tres tiempos de enumeración que suben un poco: «hacia dónde va», «cómo cerraría el semestre», pausa en los «…», y «quién ya se acerca al límite» más grave, con atención. No se dice ninguna cifra. Video: 34.70 – 41.22 s.

    Ves hacia dónde va, cómo cerraría el semestre… y quién ya se acerca al límite.

## Line 7 — Todavía a tiempo (Frame 7)

**Time:** 1.70 – 5.94s
**Anchor:** «Iván» @ 1.98s · «dos» @ 3.15s · «tiempo» @ 4.90s
**Delivery:** El momento humano: medio tono más bajo y cercano. «A Iván» con nombre propio claro; «solo dos faltas» sin alarma, con un dejo de urgencia. Pausa en los «…». «Todavía estás a tiempo» se dice como buena noticia, y «de hablar con él» cierra suave. Video: 43.10 – 47.34 s.

    A Iván le quedan solo dos faltas… Todavía estás a tiempo de hablar con él.

## Line 8 — SUSAN (Frame 8)

**Time:** 2.00 – 4.37s
**Anchor:** «susan» @ 2.00s · «segundos» @ 3.79s
**Delivery:** Firma: «susan» sola, clara, con punto y pausa. «Pasa lista en segundos» paga el «Pasar lista» del inicio; firme, cerrando hacia abajo, sin subir al final. Después, silencio (el lema completo queda en pantalla). Video: 51.00 – 53.37 s.

    susan. Pasa lista en segundos.
