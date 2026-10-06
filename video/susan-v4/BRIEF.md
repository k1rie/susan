---
workflow: product-launch-video
flow: automation
storyboard: yes
message: "Pasa lista en segundos y entiende la asistencia de tus grupos"
destination: youtube
aspect: 1920x1080
language: es
audience: "docentes de la UNACH FCA C-I (producto, tono de lanzamiento)"
length: 55s
angle: "Del pase de lista que roba clase al análisis que detecta el ausentismo a tiempo, contado con el lenguaje de motion graphics de un reel de UI hecho en After Effects"
---

## Intent

Versión 4 del video de SUSAN (2026-10-05). Video de motion graphics 16:9, de 50 a 60 s, con look profesional:
transiciones suaves, ritmo, dinámico en general y animaciones con buen timing y con sentido respecto de lo que se
muestra (palabras de la persona dueña). Es un video de producto para docentes: el problema del pase de lista, la app
en acción y el beneficio. La locución de ElevenLabs se conecta al final; primero el video, construido ya «listo para
voz» (guion con tiempos amarrados a cada escena).

## Assets

- referencia/ref-01…05 — capturas del reel de Instagram de referencia (levii.motion, «POV: After Effects is getting
  easier»): UI fintech animada en After Effects. Los paneles de Premiere/After Effects que se ven son del editor, NO
  forman parte del estilo.
- referencia/ref2-01…07 — segunda referencia que también le gustó a la persona dueña (levii.motion, «POV: You do your
  cardio and after effects»): UI tipo app de running sobre lienzo blanco roto casi vacío — tarjetas de «Recent
  Activity» que entran escalonadas, una cifra gigante «9.12» y una rejilla de datos que ruedan con desenfoque de
  movimiento direccional, mapa desenfocado con botón circular verde «START», un selector «1 Hr. 30 Min.» que cambia a
  «2 Hr.» y se compacta en una píldora con lápiz (morph de componente), y un cierre con el icono de la app que cae
  con desenfoque de movimiento. El cursor de mano que aparece NO se traslada.
- assets/ (fonts, avatars, icons, sfx, brand) — copiados de la v3 (`video/susan-presentacion`).
- capture/app-real/ — capturas de la app real de SUSAN en modo demostración (pantallas, DOM, tokens).

## Customizations

- Pantallas: recreaciones o capturas reales, la que se vea mejor (la persona dueña lo deja a criterio). Decisión:
  híbrido — la app real se captura como fuente de verdad visual y las piezas que se animan se reconstruyen en HTML
  con sus tokens y estructura reales.
- Sin logo de SUSAN todavía: wordmark tipográfico «SUSAN».
- SIN CURSOR (indicación de la persona dueña, 2026-10-05: «lo del cursor no es necesario»). Ningún puntero de mouse
  ni mano que haga clic; las interacciones se cuentan con la propia interfaz (estados que cambian, resaltados,
  pulsos en el botón, cámara que se acerca) en lugar de un cursor visible.
- Sonido: solo efectos por ahora (diseño sonoro tipo reel: whooshes, clics, tecleo, destellos). Sin música. La voz
  (ElevenLabs) y una posible música se deciden después.
- Revisión: plan en chat → hoja de bocetos → construcción → vista final antes del render.
- Decisiones de la persona dueña (2026-10-06):
  - Inclinación 3D SÍ, suave: solo la pieza flotante entra con perspectiva (|rotX| ≤ 8°, |rotY| ≤ 10°) y se aplana
    antes de que se lea cualquier cifra y en cada borde de cuadro. El tooltip de la gráfica va RECTO (sin rotación en
    el plano). Esto levanta, solo para la v4, el veto a la rotación que se dio en la v3.
  - Cierre: la ficha redonda de tinta del botón central «Pasar lista» (barra móvil real) cae con estela y squash sin
    rebote y se resuelve en el wordmark «SUSAN» (Hanken Grotesk 600, SIN subrayado: ver ajuste posterior) con el lema debajo: «Pasa lista
    en segundos y entiende la asistencia de tus grupos». La ficha funciona como propuesta de logo.
  - Sin tramo extra (ni vista del alumno ni reportes): ese tiempo se le da a la analítica para que las cifras y las
    gráficas se lean con calma.
- Plan aprobado (2026-10-06) con estos ajustes:
  - NO decir ni mostrar cuántas muestras/lecturas/capturas usa la cámara para confirmar a un alumno («eso aún lo
    decidiré»): fuera «tres lecturas», «Lecturas 1/3 → 3/3», «2/3» y cualquier contador equivalente, en voz y en
    pantalla. La confirmación se cuenta sin número (el marco se vuelve verde y el alumno queda presente).
  - Gancho con la barra de la clase que se pliega en el semestre (no la píldora «5 min»).
  - Sin «unas 20 h con 5 grupos»: queda «4 h por grupo al semestre».
  - Voz recomendada: «Antonio» (la de la v3), a confirmar cuando se genere.
- Ajuste tras ver el avance de los primeros 10 s (2026-10-06): SIN el subrayado dorado ondulado bajo «SUSAN» (cuadros 2
  y 8) — «ese como palo en zigzag, no me gusta». El wordmark va limpio: «SUSAN» en Hanken Grotesk 600, sin trazo
  debajo; en el cierre, el lema queda bajo el nombre sin subrayado intermedio. Nada lo reemplaza (no inventar otro
  adorno dorado); el oro deja de ser obligatorio en esos cuadros.

## Notes

- Lenguaje de la referencia a trasladar: enfoques con desenfoque (rack focus), tarjetas con inclinación 3D suave,
  fondos de cielo/pastel y tarjeta holográfica, gráfica de líneas entrelazadas con cursor-guía y tooltip en píldora,
  gráfica de barras finas con bloque resaltado y tooltip inclinado, panel tipo teléfono con lista de movimientos,
  cifras grandes con variación porcentual. (El cursor de la referencia NO se traslada.)
- Reglas del repo: iconos Lucide, sin emojis, sin rostros reales (avatares abstractos), textos en español (México),
  datos de demostración coherentes.
- La v3 (`video/susan-presentacion`, 56 s, efectos + voz «Antonio») se conserva intacta.
- Indicación tras ver el borrador completo (2026-10-06, la persona dueña se fue a dormir; modo autónomo hasta la entrega):
  «el video está bien en sí, solo que hazlo más dinámico, muchas veces solo se queda estático con la misma escena varios
  segundos; me gustaría que fuera más dinámico sin perder el efecto smooth y blur (recuerda que hoy en día casi no hay
  retención)». Esto SUSTITUYE las reglas anteriores que pedían lecturas quietas largas y prohibían la deriva de cámara: ahora
  ninguna escena se queda igual más de ~0.6 s; la cámara siempre viaja (empujes, paneos, punch-ins a la cifra, rack focus
  con desenfoque y estela en los movimientos rápidos), cada cuadro se parte en 2-3 planos y el ritmo se sostiene hasta el
  final. Se conservan: duración (55 s), anclas de voz, datos, decisiones previas (sin cursor, sin número de muestras, sin
  subrayado, tooltip recto, inclinación suave plana al leer) y suavidad (eases largas, sin saltos ni parpadeos).

