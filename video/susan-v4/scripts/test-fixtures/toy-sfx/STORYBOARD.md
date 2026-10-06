---
format: 960x540
duration: 9s
message: "Proyecto de juguete para probar el montaje de SFX y de voz de la v4"
arc: "prueba"
audience: "scripts de la v4"
mode: collaborative
music: none
---

## Video direction

Proyecto de juguete de scripts/test-sfx-toy.mjs y scripts/test-voz-dry.mjs. Tres cuadros sin texto (el render no tiene fuentes del
sistema) cuyos tweens caen en los mismos instantes que sus `sfx_cues`. No es un cuadro del video.

## Frame 1 — Tarjeta que aterriza

- scene: Una tarjeta entra por la izquierda, aparecen dos chips, se pulsa el boton y un peso cae con squash
- voiceover: "Una tarjeta llega y se asienta."
- vo_anchor: «tarjeta» @ 0.60s
- duration: 3s
- transition_in: cut
- status: animated
- src: compositions/frames/s01-tarjeta.html
- type: hook
- sfx_cues: 0.10 whoosh-s; 0.35 soft-in; 1.00 pop-1; 1.30 pop-3 -4dB; 1.90 tap; 2.50 riser-s -3dB; 2.50 thud

Scene 1 (0.0–3.0s): tarjeta, chips, toque y caida del peso.

## Frame 2 — Linea que se dibuja

- scene: Empuje a la izquierda; una linea se dibuja, dos columnas se asientan y un chip aparece con un brillo
- voiceover: "La línea se dibuja sola."
- vo_anchor: «línea» @ 0.80s; «dibuja» @ 1.25s
- duration: 3s
- transition_in: push-slide LEFT 0.5s
- status: animated
- src: compositions/frames/s02-linea.html
- type: feature_showcase
- sfx_cues: 0.25 whoosh-m -2dB; 0.70 draw; 1.60 tick-2; 1.75 tick-4; 2.20 blip; 2.20 sheen-s

Scene 1 (0.0–3.0s): push, trazo, columnas y chip.

## Frame 3 — Cierre

- scene: Fundido con desenfoque; un panel entra, el tanque se llena y llega la palomita
- voiceover: "Y todo cuadra."
- vo_anchor: «todo» @ 0.40s
- duration: 3s
- transition_in: blur-crossfade 0.5s
- status: animated
- src: compositions/frames/s03-cierre.html
- type: cta
- sfx_cues: 0.30 soft-in; 0.90 fill -3dB; 1.60 impact-lite -6dB; 1.60 check

Scene 1 (0.0–3.0s): panel, llenado y palomita; silencio final.
