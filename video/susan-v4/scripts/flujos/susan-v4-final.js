export const meta = {
  name: 'susan-v4-final',
  description: 'Integra la ronda de dinamismo, ensambla, renderiza 60 fps, revisa el MP4 con hasta 2 vueltas de corrección y deja el render final',
  phases: [
    { title: 'Integrar y ensamblar', detail: 'storyboard al día con los informes, pipeline completo, costuras' },
    { title: 'Render y QA', detail: 'render 60 fps + revisión del MP4 (dinamismo con medida, suavidad, fidelidad)' },
    { title: 'Corregir', detail: 'correcciones por cuadro y re-integración (máx. 2 vueltas)' },
    { title: 'Final', detail: 'render final, vista ligera, commit' },
  ],
}

const P = '/home/user/susan/video/susan-v4'
const SK = '/root/.claude/skills'
const COMMIT_FOOTER = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01GNm8ZQGo8vSP18qjgTWPYH'
const CTX = `Project: SUSAN v4 launch video (HyperFrames, 1920x1080, 55 s, 8 frames), dir ${P}. The plan is APPROVED by the owner. Source of truth, in precedence order: ${P}/BRIEF.md (read it fully, especially the 2026-10-06 decisions and the 'Plan aprobado' block) > ${P}/STORYBOARD.md (+ its '## Video direction') > ${P}/SCRIPT.md > ${P}/frame.md (video design system) > ${P}/plan/SINTESIS.md > other ${P}/plan/*.md (DISENO-APP for exact app components, CONTENIDO §3 for data, PILOTO for render-proven recipes). Real app captures for fidelity: ${P}/capture/assets/ (flat, curated; see capture/extracted/asset-descriptions.md) and ${P}/capture/app-real/{desktop,mobile,crops,dom}/ (INVENTORY.md) — view images with the Read tool. Write prose in Spanish (Mexico). Git: branch feat/video-v4 in /home/user/susan; when told to commit, use 'git -C /home/user/susan add <paths> && git -C /home/user/susan commit -m "<msg>\n\n${COMMIT_FOOTER}" && git -C /home/user/susan push -q origin feat/video-v4' (retry push up to 3 times on network error).`

const S = `${SK}/product-launch-video/scripts`
const HF = 'npx --yes hyperframes@0.8.134'


const DYN = `OWNER'S DYNAMISM RULE (read ${P}/BRIEF.md, last block, verbatim): DYNAMISM = CONTENT CHANGE, not camera motion, IN MODERATION (owner: 'sin exagerar, que sea cada tanto, si no, se va a saturar'): something NEW appears every ~2-3 s (another real UI element, another number, another state); no composition stays the same for more than ~3 s; only ONE relay at a time; key numbers keep their reading moment; fewer, cleaner relays beat many — never saturate. Typical relay: the current element EXITS with directional motion blur (whip off to a side/up/down, velocity-tied SVG blur per PILOTO §3, filter none at rest) and the next ENTERS from the opposite side with a trail and a smooth settle (expo.out/power3.out). Zooms ONLY as TRANSITIONS (zoom-through into an element that becomes the next shot, or pull out from it to reveal context) — NO decorative slow zooms or camera drift on static content. Keep smooth + blur (long eases, rack focus and trails only on fast moves; no hard cuts, no flicker). Keep: frame durations (55 s total), voice anchors (the number the voice names stays on screen while named even if things change around it), data from CONTENIDO §3 only (never invent numbers to get 'more content' — use more REAL app pieces from ${P}/capture/assets and capture/extracted/asset-descriptions.md), and prior decisions (no cursor, no sample counts, no gold underline under SUSAN, straight tooltip, soft 3D tilt flat at reads, one gold element max).`


const INFORMES = args.informesPath
const ASSEMBLE = (extra) => `${CTX}

${DYN}

You are the INTEGRATOR/ASSEMBLER. ${extra}
1. Reconcile ${P}/STORYBOARD.md with the workers' final reports (${INFORMES}; read in full): for each frame write its final sfx_cues line and any handoff_in/handoff_out numbers they reported (identical on both sides of each seam), and keep Scene lines consistent with what was built. Validate with the vendored parser (${S}/lib/storyboard.mjs: 0 warnings, 55 s).
2. Run the pipeline EXACTLY per ${P}/scripts/README.md §1: assemble-index → localizar-gsap (+ --check) → transitions inject (ONCE) → transitions verify → mount-sfx → verify-sfx → ${HF} check (fix every error with minimal edits; frame files may be edited minimally for lint/runtime errors only).
3. Seams: snapshots at each cut −0.1 s / +0.2 s and transition midpoints (\`${HF} snapshot . --at ...\`); LOOK; fix any pop/mismatch with minimal edits in the frame files (both sides identical).
4. Commit compositions/, index.html, STORYBOARD.md, scripts changes (not renders/snapshots/revision): 'feat(video): v4 dinámica ensamblada'.
Final reply: what you changed, check/verify-sfx results, seam verdicts.`

const QA_SCHEMA = { type: 'object', properties: {
  mp4: { type: 'string' }, duration_s: { type: 'number' }, fps: { type: 'number' },
  longest_unchanged_s: { type: 'number' }, saturated_spots: { type: 'array', items: { type: 'string' } },
  issues: { type: 'array', items: { type: 'object', properties: { frame: { type: 'string', description: 'frame id sNN-nombre' }, at_s: { type: 'number' }, severity: { type: 'string', enum: ['bloqueante', 'importante', 'menor'] }, issue: { type: 'string' }, fix: { type: 'string' } }, required: ['frame', 'at_s', 'severity', 'issue', 'fix'] } },
  verdict: { type: 'string', enum: ['entregable', 'corregir'] }, notes: { type: 'string' },
}, required: ['mp4', 'duration_s', 'fps', 'longest_unchanged_s', 'saturated_spots', 'issues', 'verdict', 'notes'] }

const QA = (n) => `${CTX}

${DYN}

You render and QA cut #${n}. 1) \`cd ${P} && ${HF} render --quality high --fps 60 --workers 3 --skill=product-launch-video --output renders/susan-v4-r${n}.mp4\` (if it fails, apply the minimal fix and retry once). 2) \`node ${P}/scripts/verify-sfx.mjs --video renders/susan-v4-r${n}.mp4\`; ffprobe it. 3) Watch it through stills: one every 0.5 s into ${P}/revision/qa-r${n}/ tiled 4x3 with timestamps, plus dense 60 fps bursts (0.3 s) around every cut and every within-frame relay; LOOK at all of them. 4) Judge as a demanding motion designer and as a teacher seeing it in a feed: dynamism IN MODERATION (longest stretch with no new content ≤ ~3 s, nothing saturated: no changes faster than ~2 s, no overlapping relays), smooth + blur quality (trails only on fast moves, no pops/flicker/double images/jumps at seams), faithful SUSAN UI, readable numbers at their anchors, owner rules (no cursor, no sample counts, no gold underline, straight tooltip). Verdict 'entregable' only with no bloqueante/importante issues. Return the structured report with frame ids.`

phase('Integrar y ensamblar')
let integ = await agent(ASSEMBLE('The dynamism round just finished: the 8 frames were rebuilt per plan/DINAMISMO.md.'), { label: 'integrar:r1', phase: 'Integrar y ensamblar' })

let qa = null
for (let n = 1; n <= 3; n++) {
  qa = await agent(QA(n), { label: `qa:r${n}`, phase: 'Render y QA', schema: QA_SCHEMA })
  if (!qa) break
  const serious = qa.issues.filter(x => x.severity !== 'menor')
  log(`QA r${n}: ${qa.verdict} · mayor tramo sin cambio ${qa.longest_unchanged_s}s · ${serious.length} hallazgos serios`)
  if (qa.verdict === 'entregable' || serious.length === 0 || n === 3) break
  const byFrame = {}
  for (const x of qa.issues) { (byFrame[x.frame] = byFrame[x.frame] || []).push(x) }
  const fixes = await parallel(Object.keys(byFrame).map(id => () => agent(`${CTX}

${DYN}

You fix frame ${id} (${P}/compositions/frames/${id}.html) after QA of the assembled cut #${n} (renders/susan-v4-r${n}.mp4, stills in ${P}/revision/qa-r${n}/). Spec: ${P}/plan/DINAMISMO.md (this frame's section) and its STORYBOARD block. Issues (times are ABSOLUTE in the video; the frame's absolute start is in index.html data-start of its host):
${byFrame[id].map(x => `- [${x.severity}] @${x.at_s}s: ${x.issue} — arreglo: ${x.fix}`).join('\n')}
Fix bloqueante/importante and cheap menores. Edit ONLY that frame file; do not change its duration; do not edit STORYBOARD.md (report any sfx_cues/handoff change precisely). Verify with preview-frame + frame-check and LOOK. Final reply: changes + final sfx_cues line + handoffs.`, { label: `corregir:r${n}:${id}`, phase: 'Corregir' })))
  const fixText = Object.keys(byFrame).map((id, i) => `### ${id}\n${fixes[i] || '(falló)'}`).join('\n\n')
  integ = await agent(ASSEMBLE(`QA round ${n} found issues; per-frame fixes were applied. Fix reports (they override ${INFORMES} where they differ):\n${fixText}`), { label: `integrar:r${n + 1}`, phase: 'Corregir' })
}

phase('Final')
const fin = await agent(`${CTX}

Finalize the delivery. Last QA report: ${JSON.stringify(qa)}
1. Copy the last QA'd render to ${P}/renders/susan-v4.mp4 (it is already the final 1080p60 high render; re-render only if files changed after it). 2) Make a light preview ${P}/renders/susan-v4-preview.mp4 (H.264 1280x720 30 fps, AAC, ~8-12 MB). 3) Make ${P}/plan/entrega-contacto.jpg (one still every 2 s, tiled, 2000 px wide, < 1.5 MB, versioned). 4) Update ${P}/plan/ESTADO.md: stage 2 done, stage 3 'render final listo, pendiente de enviar a la persona dueña' with the final duration and any remaining menores. 5) Commit (plan/, STORYBOARD.md, compositions/, index.html, scripts/ — not renders) 'feat(video): render final de la v4 dinámica' and push. Final reply: paths, duration, fps, size, and the list of remaining minor issues.`, { label: 'final:entrega', phase: 'Final' })

return { integ, qa, fin }
