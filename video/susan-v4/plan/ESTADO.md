# Estado del trabajo autónomo de la v4 (para reanudar tras un reinicio o al volver el límite de uso)

Actualizado por el orquestador. Rama: `feat/video-v4`. Proyecto: `video/susan-v4`.

## Objetivo de esta noche
Entregar el video final 1080p60 MÁS DINÁMICO (ver BRIEF.md, indicación del 2026-10-06 tras el borrador completo).

## Etapas
1. [hecho, 05:36] Ensamblado v1 (flujo `scripts/flujos/susan-v4-ensamblar.js`, run wf_f4d126e8-031): cambios del dueño
   (sin subrayado, gancho recentrado, energía del cuadro 5, sombra del 7) + índice + transiciones + SFX + costuras.
   El paso de render/QA de ese flujo se cancela: lo sustituye la ronda de dinamismo.
2. [en curso] Ronda de dinamismo (DINAMISMO = CAMBIO DE CONTENIDO: salir con estela y entrar otro elemento, zooms solo como transición; ver BRIEF): director (plan/DINAMISMO.md con la gramática de cámara y el plan por cuadro) →
   4 flujos paralelos de 2 cuadros (dinamizar → revisar → corregir) → re-ensamblado → render 60 fps → QA → corrección
   (máx. 2 vueltas) → render final `renders/susan-v4.mp4` + vista ligera `renders/susan-v4-preview.mp4`.
3. [pendiente] Entrega: commit + push, mandar el MP4 a la persona dueña, desactivar la rutina de reanudación.

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
