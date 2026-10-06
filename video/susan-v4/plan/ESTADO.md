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
