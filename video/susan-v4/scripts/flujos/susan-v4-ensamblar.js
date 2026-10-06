export const meta = {
  name: 'susan-v4-ensamblar',
  description: 'Ensambla la v4 (index, GSAP local, transiciones, SFX, costuras), renderiza a 60 fps y revisa el MP4',
  phases: [
    { title: 'Cambios del dueño', detail: 'sin subrayado bajo SUSAN (cuadros 2 y 8) y ajustes de composición vistos en el avance' },
    { title: 'Ensamblar', detail: 'index, GSAP local, transiciones, SFX, check, costuras' },
    { title: 'Render y QA', detail: 'render 60 fps alta calidad, sincronía medida y revisión del MP4' },
  ],
}

const P = '/home/user/susan/video/susan-v4'
const SK = '/root/.claude/skills'
const COMMIT_FOOTER = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01GNm8ZQGo8vSP18qjgTWPYH'
const CTX = `Project: SUSAN v4 launch video (HyperFrames, 1920x1080, 55 s, 8 frames), dir ${P}. The plan is APPROVED by the owner. Source of truth, in precedence order: ${P}/BRIEF.md (read it fully, especially the 2026-10-06 decisions and the 'Plan aprobado' block) > ${P}/STORYBOARD.md (+ its '## Video direction') > ${P}/SCRIPT.md > ${P}/frame.md (video design system) > ${P}/plan/SINTESIS.md > other ${P}/plan/*.md (DISENO-APP for exact app components, CONTENIDO §3 for data, PILOTO for render-proven recipes). Real app captures for fidelity: ${P}/capture/assets/ (flat, curated; see capture/extracted/asset-descriptions.md) and ${P}/capture/app-real/{desktop,mobile,crops,dom}/ (INVENTORY.md) — view images with the Read tool. Write prose in Spanish (Mexico). Git: branch feat/video-v4 in /home/user/susan; when told to commit, use 'git -C /home/user/susan add <paths> && git -C /home/user/susan commit -m "<msg>\n\n${COMMIT_FOOTER}" && git -C /home/user/susan push -q origin feat/video-v4' (retry push up to 3 times on network error).`

const S = `${SK}/product-launch-video/scripts`
const HF = 'npx --yes hyperframes@0.8.134'

const frameSummary = args.frameSummary
phase('Cambios del dueño')
const cambios = await agent(`${CTX}

The 8 frames are built and individually reviewed. Per-frame outcomes:
${frameSummary}

Apply the owner's latest changes BEFORE assembly (read ${P}/BRIEF.md, the 2026-10-06 adjustment about the underline):
1. REMOVE the wavy gold underline ('subrayado dorado', the Resaltado stroke) under the «SUSAN» wordmark everywhere — owner: «no pongas esa cosa abajo de SUSAN, ese como palo en zigzag, no me gusta». In ${P}/compositions/frames/s02-un-boton.html and ${P}/compositions/frames/s08-susan.html delete the stroke and its draw tween, and re-balance the lockup: «SUSAN» stays clean (Hanken Grotesk 600, ink); in frame 8 the tagline «Pasa lista en segundos y entiende la asistencia de tus grupos» sits under the name with the spacing the underline used to occupy redistributed so the lockup is optically centered; do NOT invent any replacement ornament (no dot, no line, no other gold mark). Keep timing alive: where the underline draw filled a beat, let the existing next reveal (tagline, card, chip slide) arrive slightly earlier or let the hold breathe, respecting no dead stills >= 1.0 s. Update ${P}/STORYBOARD.md (frames 2 and 8: scene, focal, Scene lines, and remove the sfx_cues that belonged to the underline draw), ${P}/frame.md (§3 gold rule examples and §8 lockup: underline withdrawn by the owner), ${P}/plan/PLAN.md (frames 2/8 rows and the 'Topes' gold line).
2. Composition notes from the 10 s preview the owner saw (fix only if still present after the per-frame reviews): in s01-cinco-minutos the content sat in the upper half with a large empty band below — center the hero group optically in the 1920x1080 frame (title-safe), keeping the handoff_out geometry of the ink chip consistent with s02's handoff_in (if you move the chip's final position, update BOTH frames and the STORYBOARD handoff numbers identically); in s02-un-boton the 'Pasar lista' card read small for 1080p — make sure the card is the hero (roughly 40-50 % of frame width at its readable moment, UI scale E=2 or a bit larger) with «SUSAN» balanced beside it, again keeping the s02 -> s03 handoff numbers consistent on both sides.
3. Resolve EVERY request the frame workers left for the orchestrator in the per-frame outcomes above ('Pendientes para el orquestador', 'Changes needed outside my file', 'requests'): STORYBOARD.md updates (sfx_cues that lost their tween — e.g. the underline 'draw' cues in F2/F8 —, scene/focal/Scene timing lines that the workers retimed, asset_candidates), _video-direction/PLAN/frame.md gold mentions, and cross-frame handoff changes (when a handoff number must change, change it identically in the outgoing frame, the incoming frame and STORYBOARD). Re-check the 1->2 handoff now that s01 is final (pixel-compare s01 at its last frame vs s02 at 0 s).
4. ENERGY of s05-dia-critico: frame-check reports it 90 % still (dead stretches 2.4-3.8 and 4.5-7.2 s); the owner asked for a dynamic, rhythmic video. Add meaningful motion in 4.5-6.25 s that serves the story (e.g. a slow camera push toward the highlighted Viernes tile and its pill, the 'Día crítico' meta line resolving, a subtle ring pulse — never inventing data) while keeping no dead still >= 1.0 s and the approved final hold of ~0.95 s; if the push changes the final framing, update s05 handoff_out, s06 handoff_in and STORYBOARD identically. Also fix the minor finding that the pill covers the top of the Vie ring: raise the pill center to y=451 in s05 handoff_out AND s06 handoff_in together.
After editing, run for every frame you touched (at least s01, s02, s05, s06, s08): node ${P}/scripts/preview-frame.mjs <id> --bordes --anclas --sheet and node ${P}/scripts/frame-check.mjs <id>; LOOK at the stills; iterate until clean. Final reply: what changed per file and the check results.`, { label: 'cambios:sin-subrayado', phase: 'Cambios del dueño' })
phase('Ensamblar')
const SEAM_SCHEMA = {
  type: 'object',
  properties: {
    assembled: { type: 'boolean' },
    total_duration_s: { type: 'number' },
    check_ok: { type: 'boolean' },
    sfx_ok: { type: 'boolean' },
    seams: { type: 'array', items: { type: 'object', properties: {
      cut: { type: 'string' }, ok: { type: 'boolean' }, issue: { type: 'string' }, fixed: { type: 'string' },
    }, required: ['cut', 'ok', 'issue', 'fixed'] } },
    remaining: { type: 'array', items: { type: 'string' } },
    contact_sheet: { type: 'string' },
  },
  required: ['assembled', 'total_duration_s', 'check_ok', 'sfx_ok', 'seams', 'remaining', 'contact_sheet'],
}
const assembled = await agent(`${CTX}

You are the assembler. All 8 frames exist in ${P}/compositions/frames/. Per-frame outcomes:
${frameSummary}

Owner changes applied just before you (gold underline removed from frames 2 and 8, composition fixes):
${cambios || '(sin informe)'}

Run the v4 pipeline EXACTLY in the order of ${P}/scripts/README.md §1 (read it first; respect its warnings: assemble-index rewrites index.html entirely; localizar-gsap after assembling; transitions inject ONCE per assembly; never audio.mjs fetch-sfx/sync-durations): assemble-index → localizar-gsap (+ --check) → transitions inject → transitions verify → mount-sfx → verify-sfx → ${HF} check (fix every error; if a frame has a lint/runtime error, make the minimal fix in that frame file) → mark every frame '- status: animated' in STORYBOARD.md (status line only).
Then the SEAMS: for each of the 7 cuts, take snapshots at cut−0.1 s and cut+0.2 s (and the transition midpoint for push-slide/blur-crossfade) with \`${HF} snapshot . --at <times>\`, LOOK at each pair, and verify every handoff (STORYBOARD handoff_out/handoff_in: same element, same position/scale/opacity/rotation, no pop, no double image, nothing disappearing). Fix any seam with the minimal edit in the frame file(s) (frame edits do not require re-assembly unless a duration changes; if one does, redo the pipeline from assemble-index). Also take snapshots at every frame midpoint and build one contact sheet (the snapshot command writes snapshots/contact-sheet.jpg) and LOOK at it.
Finally commit compositions/, index.html, STORYBOARD.md, assets/ changes and any scripts changes (NOT renders/snapshots/revision) with message 'feat(video): cuadros animados y ensamblado de la v4'. Return the structured report.`, { label: 'ensamblar:index-sfx-costuras', phase: 'Ensamblar', schema: SEAM_SCHEMA })

phase('Render y QA')
const QA_SCHEMA = {
  type: 'object',
  properties: {
    mp4: { type: 'string' }, duration_s: { type: 'number' }, fps: { type: 'number' }, size_mb: { type: 'number' },
    render_seconds: { type: 'number' },
    sfx_sync: { type: 'string' },
    contact_sheets: { type: 'array', items: { type: 'string' } },
    issues: { type: 'array', items: { type: 'object', properties: {
      at_s: { type: 'number' }, frame: { type: 'string' }, severity: { type: 'string', enum: ['bloqueante', 'importante', 'menor'] },
      issue: { type: 'string' }, fix: { type: 'string' },
    }, required: ['at_s', 'frame', 'severity', 'issue', 'fix'] } },
    verdict: { type: 'string' },
  },
  required: ['mp4', 'duration_s', 'fps', 'size_mb', 'render_seconds', 'sfx_sync', 'contact_sheets', 'issues', 'verdict'],
}
const qa = await agent(`${CTX}

You render and QA the first full cut. Assembler report: ${JSON.stringify(assembled)}
1. Render: \`cd ${P} && ${HF} render --quality high --fps 60 --workers 3 --skill=product-launch-video --output renders/susan-v4-v1.mp4\` (time it). If it fails, read the error, apply the minimal fix, retry once.
2. \`node ${P}/scripts/verify-sfx.mjs --video renders/susan-v4-v1.mp4\` (measured SFX sync) and ffprobe the result (duration, fps, size, audio stream).
3. Watch it as a viewer would, through stills: extract a frame every 0.5 s with ffmpeg into ${P}/revision/v1-qa/ and tile them into contact sheets of 4x3 (ffmpeg tile filter) with the timestamp drawn on each tile; ALSO extract dense bursts (every 1/60 s for 0.3 s) around each of the 7 cuts and around the fastest moves (rack focus, odometers, chip drop) to catch pops, flicker, double images or smear. LOOK at every sheet with the Read tool.
4. Judge it against the brief: professional, fluid, rhythmic, meaningful motion, faithful SUSAN UI, readable numbers, owner rules (no cursor, no sample counts, straight tooltip, soft tilt flat at reads, closing chip -> SUSAN + tagline). List concrete issues with timestamps and the fix.
Also save a light preview copy for the owner: ${P}/renders/susan-v4-v1-preview.mp4 (H.264, 1280x720, 30 fps, ~6-10 MB, AAC audio). Return the structured report (contact_sheets = absolute paths).`, { label: 'render-qa:v1', phase: 'Render y QA', schema: QA_SCHEMA })

return { assembled, qa }
