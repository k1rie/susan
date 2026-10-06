# Estado del trabajo autónomo de la v4 (para reanudar tras un reinicio o al volver el límite de uso)

Actualizado por el orquestador. Rama: `feat/video-v4`. Proyecto: `video/susan-v4`.

## Objetivo de esta noche
Entregar el video final 1080p60 MÁS DINÁMICO (ver BRIEF.md, indicación del 2026-10-06 tras el borrador completo).

## Etapas
1. [hecho, 05:36] Ensamblado v1 (flujo `scripts/flujos/susan-v4-ensamblar.js`, run wf_f4d126e8-031): cambios del dueño
   (sin subrayado, gancho recentrado, energía del cuadro 5, sombra del 7) + índice + transiciones + SFX + costuras.
   El paso de render/QA de ese flujo se cancela: lo sustituye la ronda de dinamismo.
2. [hecho, 08:46] Ronda de dinamismo (DINAMISMO = CAMBIO DE CONTENIDO: salir con estela y entrar otro elemento, zooms solo como transición; ver BRIEF): director (plan/DINAMISMO.md con la gramática de cámara y el plan por cuadro) →
   4 flujos paralelos de 2 cuadros (dinamizar → revisar → corregir) → re-ensamblado → render 60 fps → QA → corrección
   (2 vueltas: r1 07:50, r2 08:46) → veredicto de la QA r2: **entregable** (0 errores, 7 menores opcionales).
3. [render final listo, pendiente de enviar a la persona dueña] Entrega.
   - Final: `renders/susan-v4.mp4` (copia byte a byte de `renders/susan-v4-r2.mp4`, el render que pasó la QA r2; ningún
     archivo fuente cambió después). H.264 High, yuv420p, 1920×1080, **60 fps**, 3300 fotogramas, **55.000 s**, AAC LC
     48 kHz estéreo, 24.0 MB (~3.66 Mb/s). verify-sfx --video: 63/63 cues dentro de ±33.3 ms.
   - Vista ligera: `renders/susan-v4-preview.mp4` (H.264 1280×720, 30 fps, AAC 128 kb/s, 9.4 MB, dos pasadas).
   - Hoja de contacto versionada: `plan/entrega-contacto.jpg` (un fotograma cada 2 s, 0–54 s, 4×7, 2000 px, con tiempo y
     cuadro en cada miniatura).
   - Hecho: commit + push de `feat(video): render final de la v4 dinámica` (los MP4 no se versionan: `renders/` está en
     .gitignore).
   - Pendiente: mandar el MP4 (o la vista ligera) a la persona dueña y desactivar la rutina de reanudación.
   - Menores que quedan (todos opcionales, ninguno toca datos ni anclas de voz; detalle y arreglo propuesto en el informe de
     la QA r2):
     1. F1 0.0–1.0 s: el gancho abre con muy poco contraste (pista #E7E2DC sobre crema, desenfocada); el primer cuadro se
        lee casi vacío y es la miniatura implícita. Arreglo: adelantar el «5» a ~0.45 s o oscurecer la pista durante el rack.
     2. F1 2.95–3.65 s: el beat más denso (pliegue barras→rejilla, ola de 48 casillas, S1…S16 y odómetro 5→240 con cifras
        intermedias); «240 min» legible solo ~0.2 s. Arreglo: menos vueltas en el odómetro y atrasar 0.1 s el paso a «4 h».
     3. F3 17.35–18.60 s: ola verde, chip Pendiente→Presente, odómetro 0→19 y BarraSegmentada encadenados en 1.25 s.
        Arreglo: arrancar la BarraSegmentada al asentarse el «19» (local 5.65; mover el cue fill 5.35).
     4. F3 15.72 s: el latido de las esquinas a pantalla completa (escala 1→1.06 en 0.08 s) se siente como respingo seco.
        Arreglo: subida de 0.14 s con power2.out y/o pico 1.04.
     5. F7 43.38–43.55 s: al abrirse la fila de Iván, lo que crece es la losa beige del resaltado y se lee un instante como
        placeholder. Arreglo: pasar el tinte a blanco en el primer 30 % del recorte.
     6. F6 ~34.35 s: la píldora «Día crítico: Viernes» cruza ~0.3 s la tarjeta vacía como un guion negro antes de volverse
        la cabeza de la guía. Arreglo: encogerla a punto antes del 40 % del viaje.
     7. F8 51.83–53.63 s: el lockup con el lema queda 1.8 s sin cambio perceptible antes del barrido holográfico (firma
        aceptada en DINAMISMO; es el tramo quieto más largo). Arreglo: adelantar el sheen 0.3 s o hacer más visible el paso
        del cielo.
     Avisos heredados bajo umbral de verify-sfx («sonido sin evento visible»): soft-in F1 2.00, pop-1 F5 6.15, soft-in F7 5.20.

## Cómo reanudar
- Mira `git log` de la rama y este archivo. Los flujos guardados están en `scripts/flujos/`. Los informes de cuadros en
  `plan/INFORMES-CUADROS.md`. Si un flujo murió a medias, reanúdalo con `resumeFromRunId` si la sesión es la misma; si no,
  relánzalo: los cuadros ya escritos en `compositions/frames/` son el punto de partida.
- Orden del pipeline de ensamblado: `scripts/README.md` §1 (assemble-index → localizar-gsap → transitions inject UNA vez →
  verify → mount-sfx → verify-sfx → check → snapshot → render).

## Flujos de la ronda de dinamismo (scripts/flujos/)
- `susan-v4-director.js` → plan/DINAMISMO.md + STORYBOARD.md actualizado (único escritor).
- `susan-v4-dinamizar.js` ×4 en paralelo (args.frames con 2 cuadros cada uno; mismo reparto que la construcción:
  [s03,s08] [s07,s04] [s06,s01] [s02,s05]); sus informes se juntan en plan/INFORMES-DINAMISMO.md.
- `susan-v4-final.js` (args.informesPath = plan/INFORMES-DINAMISMO.md) → integra, ensambla, render 60 fps, QA (≤3
  vueltas), render final renders/susan-v4.mp4 + preview.

## Bitácora
- 06:00 UTC: el director escribió plan/DINAMISMO.md y actualizó STORYBOARD.md, pero el límite de uso lo cortó antes de
  reportar (y canceló al crítico). 06:21 UTC: uso reiniciado; se lanza `susan-v4-critico.js` (completa lo faltante del
  director y contrasta el plan). Siguiente: 4× `susan-v4-dinamizar.js` y luego `susan-v4-final.js`.
- 06:40 UTC: crítico terminado (commit 87943ee, plan de dinamismo revisado). Lanzados 4× `susan-v4-dinamizar.js`:
  [s03,s08] wf_bf618df1-df0 · [s07,s04] wf_5535526d-523 · [s06,s01] wf_2e623188-150 · [s02,s05] wf_c97556cb-004.
  Al terminar: juntar sus informes en plan/INFORMES-DINAMISMO.md y lanzar `susan-v4-final.js`
  con args {"informesPath": "/home/user/susan/video/susan-v4/plan/INFORMES-DINAMISMO.md"}.
- 07:23 UTC: los 4 flujos de dinamizar terminaron; informes en plan/INFORMES-DINAMISMO.md; se lanza susan-v4-final.js.
  Run del flujo final: wf_15f3ee4a-411 (scratchpad/susan-v4-final.js; copia en scripts/flujos/).
- 08:46 UTC: QA r2 sobre `renders/susan-v4-r2.mp4` → **entregable** (7 menores opcionales; fotogramas en revision/qa-r2/).
- 09:10 UTC: entrega preparada: `renders/susan-v4.mp4` (= r2), `renders/susan-v4-preview.mp4` y `plan/entrega-contacto.jpg`;
  commit `feat(video): render final de la v4 dinámica` + push. Falta enviarlo a la persona dueña.
- 09:10 UTC: ENTREGADO. renders/susan-v4.mp4 (1080p60, 55 s, 25.2 MB) y renders/susan-v4-preview.mp4 enviados a la persona dueña; rutina «Reanudar video SUSAN v4» desactivada. Pendiente al despertar: sus comentarios, los 7 menores opcionales del QA r2 y la voz de ElevenLabs (scripts/generar-voz.mjs → mount-voz.mjs).

## Ronda 3: menores del QA + voz de ElevenLabs (la persona dueña subió la voz; commit ac49d20)
- Orden de la persona dueña: «corrige los menores y monta la voz».
- Flujo: `scripts/flujos/susan-v4-menores-voz.js` (menores F1/F3/F6/F7/F8 con revisor → integración con mount-voz →
  QA con voz hasta 3 renders → entrega). Salida: renders/susan-v4-voz.mp4 (+ preview), plan/VOZ-MONTAJE.md.
- La versión sin voz (renders/susan-v4.mp4, entregada) no se toca.

### Resultado de la ronda 3 (2026-10-06, entrega con voz) — veredicto de la QA: **entregable** (0 errores, 5 menores opcionales)
- Voz: «Antonio» (ElevenLabs), 8 líneas montadas con `scripts/mount-voz.mjs` por anclas, sin estirar ningún cuadro (detalle,
  anclas medidas y tolerancias en `plan/VOZ-MONTAJE.md`). El pipeline de voz no cambió en esta entrega: `scripts/README.md`
  sigue vigente tal cual.
- Render que pasó la QA: `renders/susan-v4-voz-r2.mp4` (`hyperframes@0.8.134 render --quality high --fps 60 --workers 3`, 3 min 58 s).
  Ningún archivo fuente cambió después del render (solo salidas ignoradas de `datos/verify-*`), así que la entrega es copia
  byte a byte (`cmp` idéntico).
- Final: `renders/susan-v4-voz.mp4`, H.264 High yuv420p bt709, 1920×1080, **60 fps**, 3300 fotogramas, **55.000 s**, AAC LC
  48 kHz estéreo, 24.7 MiB (25.9 MB; ~3.6 Mb/s de video).
- Vista ligera: `renders/susan-v4-voz-preview.mp4`, H.264 High 1280×720, 30 fps, AAC 128 kb/s, faststart, 8.9 MiB (9.3 MB), dos pasadas
  (video a 1250 kb/s). Misma sonoridad que el original (−15.3 LUFS, −1.6 dBTP medidos sobre la vista ligera).
- Hoja de contacto versionada: `plan/entrega-voz-contacto.jpg` (un fotograma cada 2 s, 0–54 s, 4×7, 2000×2018 px, 380 KiB,
  con tiempo y cuadro en cada miniatura; sale del MP4 final, leyendo desde el inicio con `select='not(mod(n,120))'`).
- Sonoridad medida sobre el MP4 final: **−15.3 LUFS integrados** (EBU R128, LRA 6.2 LU; objetivo −16…−14), **pico verdadero
  −1.6 dBTP**, 0 muestras ≥ 0.99. Voz presente en las 8 ventanas de habla (mezcla −17.2…−18.3 dBFS RMS); SFX 22–28 dB bajo la voz.
  Primera palabra a 1.09 s; silencio final de voz 1.65 s. `verify-sfx --video`: 63/63 cues dentro de ±33 ms.
- Sincronía voz-imagen: las 21 anclas de `SCRIPT.md` revisadas a t−0.25, t y t+0.25 s; todas cumplen lo que promete el storyboard.
  Siete cortes y todos los relevos revisados en ráfagas de 60 fps, sin saltos ni parpadeos.
- Menores de la ronda 2 corregidos y verificados en el render (nada regresó): F1 apertura (el fotograma 0 ya trae el «1» y
  la barra), F1 pliegue denso («240 min» legible, «4 h» asentada antes de la voz), F3 barra (arranca al asentarse el «19»),
  F3 latido de esquinas (suave), F6 píldora (se cierra a punto antes de viajar), F7 losa beige (la fila pasa a blanco antes de
  crecer), F8 paso de cielo (visible), F4 látigo 0.10 s más tarde y línea 8 realzada.
- Menores que quedan (todos opcionales, ninguno es un error):
  1. Audio, 53.55–53.96 s: el sheen del cierre suena dentro del silencio final, así que el silencio absoluto de la mezcla es de
     1.05 s (el de la voz sola, 1.65 s). Es la firma sonora del cierre (decisión registrada en `VOZ-MONTAJE.md`). Para ≥ 1.5 s
     de silencio total habría que quitar el sheen o acortar el cuadro final.
  2. Audio, entradas desde pausas: tres subidas > 12 dB entre segundos consecutivos medidas con RMS de 1 s completo (0→1 s,
     42→43 s, 48→49 s). Son entradas desde silencio, no saltos dentro de material continuo; con la métrica de `verify-sfx`
     la mayor subida es 9.2 dB (tope 12).
  3. F7, 47.34–49.7 s: es el hueco más largo sin voz ni SFX (≈ 2.4 s) y la imagen casi no cambia (tarjeta de Iván en reposo, solo
     el halo de foco a 48.05 s). Es el cuadro quieto deliberado antes del sting; con la voz real pasó de 0.95 s a ≈ 1.9 s.
     Arreglo opcional: un SFX suave en el halo de 48.05 s o recortar la quietud.
  4. F8, 51.83–53.73 s: el paso del cielo se ve (52.25–53.05 s) pero a la altura del lockup cambia solo 2 niveles; 1.9 s sin otro
     movimiento que el lema. Arreglo opcional: paso de cielo más marcado, sin pisar la cola de «segundos» (habla hasta 53.35 s).
  5. F3, 19.4 s: bajo la cámara dice «Última captura: 23 rostros · 22 válidos» (24 px gris, x=880, y=730 en
     `compositions/frames/s03-camara.html`). El storyboard lo permite (cuenta rostros de la toma, no lecturas por alumno), pero
     la persona dueña dijo que aún decidirá lo de las muestras. Si se quiere cero conteos de capturas, se retira esa línea.
  Avisos heredados bajo umbral de `verify-sfx` («sonido sin evento visible»): soft-in F1 2.00, pop-1 F5 6.15, soft-in F7 5.20.
- Receta de la entrega ligera (sin script propio; se rehace en un minuto): vista ligera con ffmpeg en dos pasadas
  (`scale=1280:720:flags=lanczos,fps=30,format=yuv420p`, `-c:v libx264 -profile:v high -preset slow -b:v 1250k -maxrate 2500k
  -bufsize 5000k`, `-c:a aac -b:a 128k -ar 48000 -ac 2 -movflags +faststart`); hoja de contacto con `select='not(mod(n,120))'`
  sobre el MP4 de 60 fps, miniaturas de 480×270 con `drawtext` y `tile=4x7:padding=16:margin=16`. No uses `-ss` + `fps=2` para
  etiquetar fotogramas: `revision/qa-voz-r1/audio/tile.sh` lo hace y el fotograma etiquetado 18.0 s muestra el de ≈ 18.2 s.
- Pendiente: mandar `renders/susan-v4-voz.mp4` (o la vista ligera) a la persona dueña y que decida sobre los menores 1, 3, 4 y 5.
- 16:05 UTC (ronda 3, cierre): se retiró la línea «Última captura: 23 rostros · 22 válidos» de F3 (ningún contador de capturas en pantalla,
  por la regla de la persona dueña) y se re-renderizó: renders/susan-v4-voz.mp4 (1080p60, 55 s, −15.3 LUFS, pico −1.6 dBTP, 63/63 SFX en
  ±33 ms) + renders/susan-v4-voz-preview.mp4. Menores que quedan (opcionales): F7 47.3–49.7 s con ~2.4 s casi quietos antes del cierre;
  F8 paso de cielo sutil; silencio total final de 1.05 s por el sheen del cierre. Pendiente: comentarios de la persona dueña.
