# Estado del trabajo autónomo de la v4 (para reanudar tras un reinicio o al volver el límite de uso)

Actualizado por el orquestador. Rama: `feat/video-v4`. Proyecto: `video/susan-v4`.

## Objetivo de esta noche
Entregar el video final 1080p60 MÁS DINÁMICO (ver BRIEF.md, indicación del 2026-10-06 tras el borrador completo).

## Etapas
1. [en curso] Ensamblado v1 (flujo `scripts/flujos/susan-v4-ensamblar.js`, run wf_f4d126e8-031): cambios del dueño
   (sin subrayado, gancho recentrado, energía del cuadro 5, sombra del 7) + índice + transiciones + SFX + costuras.
   El paso de render/QA de ese flujo se cancela: lo sustituye la ronda de dinamismo.
2. [pendiente] Ronda de dinamismo: director (plan/DINAMISMO.md con la gramática de cámara y el plan por cuadro) →
   4 flujos paralelos de 2 cuadros (dinamizar → revisar → corregir) → re-ensamblado → render 60 fps → QA → corrección
   (máx. 2 vueltas) → render final `renders/susan-v4.mp4` + vista ligera `renders/susan-v4-preview.mp4`.
3. [pendiente] Entrega: commit + push, mandar el MP4 a la persona dueña, desactivar la rutina de reanudación.

## Cómo reanudar
- Mira `git log` de la rama y este archivo. Los flujos guardados están en `scripts/flujos/`. Los informes de cuadros en
  `plan/INFORMES-CUADROS.md`. Si un flujo murió a medias, reanúdalo con `resumeFromRunId` si la sesión es la misma; si no,
  relánzalo: los cuadros ya escritos en `compositions/frames/` son el punto de partida.
- Orden del pipeline de ensamblado: `scripts/README.md` §1 (assemble-index → localizar-gsap → transitions inject UNA vez →
  verify → mount-sfx → verify-sfx → check → snapshot → render).
