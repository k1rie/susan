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

## Notes

- Lenguaje de la referencia a trasladar: enfoques con desenfoque (rack focus), tarjetas con inclinación 3D suave,
  fondos de cielo/pastel y tarjeta holográfica, gráfica de líneas entrelazadas con cursor-guía y tooltip en píldora,
  gráfica de barras finas con bloque resaltado y tooltip inclinado, panel tipo teléfono con lista de movimientos,
  cifras grandes con variación porcentual. (El cursor de la referencia NO se traslada.)
- Reglas del repo: iconos Lucide, sin emojis, sin rostros reales (avatares abstractos), textos en español (México),
  datos de demostración coherentes.
- La v3 (`video/susan-presentacion`, 56 s, efectos + voz «Antonio») se conserva intacta.
