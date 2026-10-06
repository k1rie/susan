export const meta = {
  name: 'susan-v4-menores-voz',
  description: 'Corrige los 7 menores del QA, monta la voz de ElevenLabs por anclas, mide sincronía y mezcla, renderiza 60 fps con voz y entrega',
  phases: [
    { title: 'Menores', detail: 'un worker + revisor independiente por cuadro con menores (F1, F3, F6, F7, F8)' },
    { title: 'Voz y ensamblado', detail: 'storyboard al día, pipeline completo, mount-voz, verify-sfx con ventanas reales, costuras' },
    { title: 'Render y QA con voz', detail: 'render 60 fps con voz; sincronía voz-imagen, mezcla y fotogramas; hasta 2 vueltas' },
    { title: 'Final', detail: 'render final con voz, vista ligera, commit' },
  ],
}

const P = '/home/user/susan/video/susan-v4'
const SK = '/root/.claude/skills'
const COMMIT_FOOTER = 'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01GNm8ZQGo8vSP18qjgTWPYH'
const CTX = `Project: SUSAN v4 launch video (HyperFrames, 1920x1080, 55 s, 8 frames), dir ${P}. The plan is APPROVED by the owner. Source of truth, in precedence order: ${P}/BRIEF.md (read it fully, especially the 2026-10-06 decisions and the 'Plan aprobado' block) > ${P}/STORYBOARD.md (+ its '## Video direction') > ${P}/SCRIPT.md > ${P}/frame.md (video design system) > ${P}/plan/SINTESIS.md > other ${P}/plan/*.md (DISENO-APP for exact app components, CONTENIDO §3 for data, PILOTO for render-proven recipes). Real app captures for fidelity: ${P}/capture/assets/ (flat, curated; see capture/extracted/asset-descriptions.md) and ${P}/capture/app-real/{desktop,mobile,crops,dom}/ (INVENTORY.md) — view images with the Read tool. Write prose in Spanish (Mexico). Git: branch feat/video-v4 in /home/user/susan; when told to commit, use 'git -C /home/user/susan add <paths> && git -C /home/user/susan commit -m "<msg>\n\n${COMMIT_FOOTER}" && git -C /home/user/susan push -q origin feat/video-v4' (retry push up to 3 times on network error).`

const S = `${SK}/product-launch-video/scripts`
const HF = 'npx --yes hyperframes@0.8.134'


const DYN = `OWNER'S DYNAMISM RULE (read ${P}/BRIEF.md, last block, verbatim): DYNAMISM = CONTENT CHANGE, not camera motion, IN MODERATION (owner: 'sin exagerar, que sea cada tanto, si no, se va a saturar'): something NEW appears every ~2-3 s (another real UI element, another number, another state); no composition stays the same for more than ~3 s; only ONE relay at a time; key numbers keep their reading moment; fewer, cleaner relays beat many — never saturate. Typical relay: the current element EXITS with directional motion blur (whip off to a side/up/down, velocity-tied SVG blur per PILOTO §3, filter none at rest) and the next ENTERS from the opposite side with a trail and a smooth settle (expo.out/power3.out). Zooms ONLY as TRANSITIONS (zoom-through into an element that becomes the next shot, or pull out from it to reveal context) — NO decorative slow zooms or camera drift on static content. Keep smooth + blur (long eases, rack focus and trails only on fast moves; no hard cuts, no flicker). Keep: frame durations (55 s total), voice anchors (the number the voice names stays on screen while named even if things change around it), data from CONTENIDO §3 only (never invent numbers to get 'more content' — use more REAL app pieces from ${P}/capture/assets and capture/extracted/asset-descriptions.md), and prior decisions (no cursor, no sample counts, no gold underline under SUSAN, straight tooltip, soft 3D tilt flat at reads, one gold element max).`



const MENORES = [
  { id: 's01-cinco-minutos', number: 1, title: 'Cinco minutos cada clase', src: 'compositions/frames/s01-cinco-minutos.html', duration: 6.4,
    items: [
      "Opening contrast (0.0-1.0 s): the hook opens almost empty — a pale #E7E2DC track on cream #F7F5F2 with 22 px labels, blurred; in a feed the first second reads blank and this first frame is the implicit thumbnail. Fix: bring the odometer's «5» in earlier (~0.45 s; it must still settle BEFORE the voice says «cinco», which is now measured from datos/voz-alineacion.json line 01) and/or darken the track to ~#D8D2CA during the rack focus and ease it back to #E7E2DC as the ink paints. No data or anchor changes.",
      "Densest beat of the video (2.95-3.65 s): the fold bars->grid, the wave over the 48 cells, S1..S16 and the 3-column odometer 5->240 coincide and show fragments of intermediate numbers (9·6, 17, 128, 139...); «240 min» is legible only ~0.2 s before changing to «4 h». Fix: fewer spins in the odometer columns (the hundreds column does not spin or spins a single row 0->2) and delay the unit change 240 min->4 h by ~0.1 s. «4 h» must still settle before the voice says «cuatro» (line 01)."
    ] },
  { id: 's03-camara', number: 3, title: 'La cámara pasa lista', src: 'compositions/frames/s03-camara.html', duration: 8.5,
    items: [
      "Overloaded stretch after the view returns (local 4.90-6.15 s ≈ abs 17.35-18.60): the green wave, chip Pendiente->Presente, odometer 0->19 and the BarraSegmentada fill chain within 1.25 s. Fix: start the BarraSegmentada when the «19» settles (local 5.65 instead of 5.35) so each piece has its own time. The 'fill' sfx cue moves from 5.35 to the new start — report the new cue exactly.",
      "Corner pulse at full screen (local 3.25: scale 1->1.06 in 0.08 s over 22 frames at 2.135x) is the biggest per-frame change outside the cuts (measured peak 5.1 vs median 1.4) and reads as a dry jolt, not a soft beat. Fix: rise over 0.14 s with power2.out and/or peak 1.04 instead of 1.06; the return stays as is."
    ] },
  { id: 's06-tendencia', number: 6, title: 'Hacia dónde va', src: 'compositions/frames/s06-tendencia.html', duration: 7.45,
    items: [
      "Opening day-tile->chart (abs ~34.35 s, local ~0.4 s): the «Día crítico: Viernes» pill drops its text and crosses ~0.3 s over the still-empty card as an abstract black dash that shrinks down-left to the guide head; in that stretch you cannot tell what it is. Fix: shrink the pill into a circle (pill radius -> dot) before 40 % of its travel so it reads as the guide's dot and not as a bar. Keep the handoff numbers (edges) and cues."
    ] },
  { id: 's07-a-tiempo', number: 7, title: 'Todavía a tiempo', src: 'compositions/frames/s07-a-tiempo.html', duration: 7.6,
    items: [
      "When Iván's row opens into the card (abs 43.38-43.55 s, local ~1.98-2.15 s) the growing surface is a beige slab #EFECE7 (the row highlight) carrying only the name for ~0.17 s; then it turns white and the card stays empty with avatar and name ~0.1 s longer before the cascade; it reads for an instant as a gray placeholder. Fix: fade the #EFECE7 tint to white within the first 30 % of the clip-path growth (before abs ~43.30) so what grows is already the white card. Keep handoffs and cues."
    ] },
  { id: 's08-susan', number: 8, title: 'SUSAN', src: 'compositions/frames/s08-susan.html', duration: 6.0,
    items: [
      "The lockup + tagline holds 1.8 s with no perceptible change (abs 51.83-53.63 s; the sky step at local 3.30-4.00 is under the perception threshold) before the holographic sweep — the longest still stretch of the video. Now the REAL voice exists (datos/voz-alineacion.json line 08 + its mounted position): decide with the measured end of «segundos». Options: make the sky step more visible (e.g. a noticeably lighter/cream step over 0.8 s), and/or advance the sweep up to 0.3 s ONLY if it does not start while the voice is still speaking (otherwise keep it where it is). The tagline-fade-to-cream end must stay."
    ] },
]

const VOZ_CTX = `The owner uploaded the real ElevenLabs voice (commit 'feat(video): voz de la v4'): ${P}/assets/voz/01.wav..08.wav (48 kHz mono, -17 LUFS per line, already chosen takes: see ${P}/datos/voz-tomas.json) and ${P}/datos/voz-alineacion.json (per-character timings of each line). Line durations: 5.25, 4.32, 5.76, 5.67, 6.78, 6.08, 5.29, 2.69 s. SCRIPT.md anchors are the contract; mount-voz.mjs places each line so its anchor word lands at frame_start + t (error <= 0.3 s; never stretch a frame).`

const SCHEMA = { type: 'object', properties: { frame: { type: 'string' }, verdict: { type: 'string', enum: ['listo', 'corregir'] }, findings: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['bloqueante', 'importante', 'menor'] }, at: { type: 'string' }, issue: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'at', 'issue', 'evidence', 'fix'] } } }, required: ['frame', 'verdict', 'findings'] }

const FIXW = (f) => `${CTX}

${DYN}

${VOZ_CTX}

You are the FRAME WORKER for ${f.id} (frame ${f.number} «${f.title}», ${f.duration}s). The video was delivered and QA'd (verdict 'entregable'); the owner now asks to CORRECT the optional minor findings below. Edit ONLY ${P}/${f.src} (its current composition is the starting point; change as little as needed; durations, voice anchors, handoff edges and the data stay exactly as they are; keep it smooth and seek-safe, filter none at rest). Do NOT edit STORYBOARD.md (another agent owns it) — report precisely any sfx_cues or Scene-time change. Read the frame's block in ${P}/STORYBOARD.md and its section in ${P}/plan/DINAMISMO.md for context, and ${P}/frame.md for the design contract.
Minor findings to fix:
${f.items.map((x, i) => `${i + 1}. ${x}`).join('\n')}
Verify: \`node ${P}/scripts/preview-frame.mjs ${f.id} --bordes --anclas --sheet\` plus extra stills every 0.05-0.1 s around each change (LOOK at them with Read: the fix is visible and smooth, no pops, nothing else changed) and \`node ${P}/scripts/frame-check.mjs ${f.id}\` (0 errors; same or fewer warnings as before). Final reply: what changed (with times), the final sfx_cues line for this frame (or 'unchanged'), the handoff values (unchanged unless stated), and the check results.`

const REVW = (f, built) => `${CTX}

${DYN}

You are an INDEPENDENT adversarial reviewer of ${P}/${f.src} after the minor-fix round. The fixer's report:
${built || '(sin informe)'}
The findings that had to be fixed:
${f.items.map((x, i) => `${i + 1}. ${x}`).join('\n')}
Measure yourself (\`node ${P}/scripts/preview-frame.mjs ${f.id} --bordes --anclas --sheet\` + extra stills; \`node ${P}/scripts/frame-check.mjs ${f.id}\`); LOOK at the stills and compare with the previous version (git show HEAD:video/susan-v4/${f.src} rendered if needed). Is each finding genuinely fixed? Did the fix break anything (handoff edges identical to STORYBOARD, voice-anchor visibility, no new dead stretch >= 1.0 s, no saturation, smoothness, filter none at rest, data/accents intact)? 'listo' only if nothing bloqueante/importante.`

const FIXW2 = (f, r) => `${CTX}

${DYN}

You are the FRAME WORKER for ${f.id}, correcting ${P}/${f.src} after an independent review of the minor-fix round. Findings:
${r ? r.findings.map(x => `- [${x.severity}] @${x.at}: ${x.issue} — evidencia: ${x.evidence} — arreglo: ${x.fix}`).join('\n') : '(sin hallazgos estructurados: vuelve a medir y corrige)'}
Edit ONLY ${P}/${f.src}; do not edit STORYBOARD.md. Re-run preview-frame + frame-check, LOOK, iterate. Final reply: changes, final sfx_cues line, handoffs, check results.`

phase('Menores')
const menoresRes = await pipeline(
  MENORES,
  f => agent(FIXW(f), { label: `menores:${f.id}`, phase: 'Menores' }),
  (built, f) => agent(REVW(f, built), { label: `revisar:${f.id}`, phase: 'Menores', schema: SCHEMA }).then(r => ({ built, r })),
  (st, f) => (!st.r || st.r.verdict === 'corregir' || st.r.findings.some(x => x.severity !== 'menor'))
    ? agent(FIXW2(f, st.r), { label: `corregir:${f.id}`, phase: 'Menores' }).then(fixed => ({ ...st, fixed }))
    : { ...st, fixed: null },
)
const menoresTxt = MENORES.map((f, i) => { const x = menoresRes[i]; return `### ${f.id}\n${x ? (x.fixed || x.built) : '(FALLÓ: revisa el archivo del cuadro y vuelve a medir)'}` }).join('\n\n')
log(`Menores corregidos: ${menoresRes.filter(Boolean).length}/${MENORES.length}`)

const ASSEMBLE_V = (extra) => `${CTX}

${DYN}

${VOZ_CTX}

You are the INTEGRATOR/ASSEMBLER (owner of STORYBOARD.md in this step). ${extra}
1. Update ${P}/STORYBOARD.md with the minor-fix reports below: each frame's final sfx_cues line (e.g. F3's 'fill' cue moves with the BarraSegmentada start) and any Scene-time change they report; Scene text must match what was built. Parser: 0 warnings, 55 s.
2. Run the pipeline EXACTLY per ${P}/scripts/README.md §1 INCLUDING THE VOICE: assemble-index → localizar-gsap (+ --check) → transitions inject (ONCE) → transitions verify → mount-sfx → mount-voz (reads SCRIPT.md anchors + datos/voz-alineacion.json; fix any error it reports by adjusting the scene or the cues — NEVER stretch a frame, NEVER regenerate/alter the voice) → verify-sfx (now with the REAL voice windows: strong transients inside voice windows are errors — retime the cue in STORYBOARD or swap to a soft sound, then re-run from assemble-index) → ${HF} check (0 errors).
3. Voice placement report (write plan/VOZ-MONTAJE.md): per line: frame, anchor word(s), target absolute time, achieved time, error (<=0.3 s required), absolute start/end of the clip in the video, gap to the previous/next line; first word >= 1.0 s; final silence >= 1.5 s; warnings of mount-voz and what you did about each; SFX ducked count.
4. Seams (cut −0.1 s/+0.2 s and transition midpoints with \`${HF} snapshot . --at ...\`): LOOK; fix any pop/mismatch minimally in the frame files (identical on both sides).
5. Commit compositions/, index.html, STORYBOARD.md, plan/VOZ-MONTAJE.md, scripts changes (not renders/snapshots/revision): 'feat(video): v4 con voz montada y menores corregidos'.
Final reply: what you changed, mount-voz/verify-sfx/check results, the voice placement table, seam verdicts.`

phase('Voz y ensamblado')
let integ = await agent(ASSEMBLE_V(`Minor-fix reports (they override the old cues/Scenes where they differ):\n${menoresTxt}`), { label: 'integrar:voz', phase: 'Voz y ensamblado' })

const QA_SCHEMA = { type: 'object', properties: {
  mp4: { type: 'string' }, duration_s: { type: 'number' }, fps: { type: 'number' }, has_audio: { type: 'boolean' },
  integrated_lufs: { type: 'number' }, true_peak_dbfs: { type: 'number' },
  voice_anchor_checks: { type: 'array', items: { type: 'object', properties: { line: { type: 'string' }, word: { type: 'string' }, spoken_at_s: { type: 'number' }, visual_expected: { type: 'string' }, visual_ok: { type: 'boolean' }, note: { type: 'string' } }, required: ['line', 'word', 'spoken_at_s', 'visual_expected', 'visual_ok', 'note'] } },
  issues: { type: 'array', items: { type: 'object', properties: { frame: { type: 'string', description: 'frame id sNN-nombre, or "audio" or "global"' }, at_s: { type: 'number' }, severity: { type: 'string', enum: ['bloqueante', 'importante', 'menor'] }, issue: { type: 'string' }, fix: { type: 'string' } }, required: ['frame', 'at_s', 'severity', 'issue', 'fix'] } },
  verdict: { type: 'string', enum: ['entregable', 'corregir'] }, notes: { type: 'string' },
}, required: ['mp4', 'duration_s', 'fps', 'has_audio', 'integrated_lufs', 'true_peak_dbfs', 'voice_anchor_checks', 'issues', 'verdict', 'notes'] }

const QA = (n) => `${CTX}

${DYN}

${VOZ_CTX}

You render and QA cut #${n} WITH VOICE. 1) \`cd ${P} && ${HF} render --quality high --fps 60 --workers 3 --skill=product-launch-video --output renders/susan-v4-voz-r${n}.mp4\` (if it fails apply the minimal fix and retry once). 2) \`node ${P}/scripts/verify-sfx.mjs --video renders/susan-v4-voz-r${n}.mp4\`; ffprobe (duration 55 s, 60 fps, audio stream present).
3) AUDIO measurements with ffmpeg on the MP4: integrated loudness and true peak (ebur128/ loudnorm print; target around -16 to -14 LUFS integrated, true peak <= -1 dBFS, no clipping), the voice present in each line window (volumedetect/astats on each [start,end] from ${P}/plan/VOZ-MONTAJE.md), SFX not masking the voice (compare short-term loudness of the mix during voice vs the voice-only stem if you can rebuild it from assets/voz and the mounted offsets; SFX under voice should be clearly lower), silence at the start (>= 1.0 s before the first word) and at the end (>= 1.5 s), no level jumps > 12 dB between consecutive seconds, no pops at clip boundaries.
4) VOICE-IMAGE SYNC: for EVERY anchor word of SCRIPT.md (all lines), take its absolute spoken time (mounted offset from VOZ-MONTAJE.md/datos/voz-montada.json + word time from datos/voz-alineacion.json), extract stills at t-0.25, t, t+0.25 s, LOOK, and verify the visual the storyboard promises for that anchor (e.g. «cinco» -> '5 min' on screen and still; «cuatro» -> '4 h'; «susan» -> wordmark; «botón» -> the button; «cámara»/«alumno»/«presente» -> the camera / the chips / the 19 and the meter after «presente»; «dudoso»/«Revisión»/«decides»; «día»/«viernes»; «va»/«semestre»/«límite»; «Iván»/«dos»/«tiempo»; «segundos»). Report each in voice_anchor_checks.
5) VISUALS: one still per 0.5 s tiled with timestamps + dense 60 fps bursts around every cut and relay; LOOK. Confirm the 7 minor fixes landed (F1 opening contrast + denser beat, F3 bar timing + corner pulse, F6 pill, F7 beige slab, F8 hold) and nothing regressed; dynamism in moderation, smooth+blur, owner rules (no cursor, no sample counts, no gold underline, straight tooltip).
Verdict 'entregable' only with no bloqueante/importante issue (audio issues included; frame 'audio' for those). Return the structured report.`

phase('Render y QA con voz')
let qa = null
for (let n = 1; n <= 3; n++) {
  qa = await agent(QA(n), { label: `qa-voz:r${n}`, phase: 'Render y QA con voz', schema: QA_SCHEMA })
  if (!qa) break
  const serious = qa.issues.filter(x => x.severity !== 'menor')
  log(`QA voz r${n}: ${qa.verdict} · ${qa.integrated_lufs} LUFS · pico ${qa.true_peak_dbfs} dBTP · ${serious.length} hallazgos serios`)
  if (qa.verdict === 'entregable' || serious.length === 0 || n === 3) break
  const byFrame = {}
  for (const x of qa.issues) { (byFrame[x.frame] = byFrame[x.frame] || []).push(x) }
  const ids = Object.keys(byFrame)
  const fixes = await parallel(ids.map(id => () => agent(`${CTX}

${DYN}

${VOZ_CTX}

Fix issues of '${id}' found by QA of cut #${n} (renders/susan-v4-voz-r${n}.mp4). ${id === 'audio' || id === 'global' ? `These are AUDIO/global issues: fix them with the minimal change in STORYBOARD.md sfx_cues (retime/soften/remove cues; never touch the voice files) or in ${P}/scripts mixing parameters if the cause is a script setting; then the integrator re-runs the pipeline.` : `Edit ONLY ${P}/compositions/frames/${id}.html (never its duration; do not edit STORYBOARD.md; report cue/handoff changes precisely). Times are ABSOLUTE in the video; the frame's absolute start is in index.html. Verify with preview-frame + frame-check and LOOK.`}
Issues:
${byFrame[id].map(x => `- [${x.severity}] @${x.at_s}s: ${x.issue} — arreglo: ${x.fix}`).join('\n')}
Final reply: changes + final sfx_cues line + handoffs.`, { label: `corregir-voz:r${n}:${id}`, phase: 'Render y QA con voz' })))
  const fixText = ids.map((id, i) => `### ${id}\n${fixes[i] || '(falló)'}`).join('\n\n')
  integ = await agent(ASSEMBLE_V(`QA round ${n} (with voice) found issues; per-frame fixes were applied. Fix reports (they override earlier cues/Scenes where they differ):\n${fixText}`), { label: `integrar-voz:r${n + 1}`, phase: 'Render y QA con voz' })
}

phase('Final')
const fin = await agent(`${CTX}

Finalize the delivery with voice. Last QA report: ${JSON.stringify(qa)}
1. Copy the last QA'd render to ${P}/renders/susan-v4-voz.mp4 (re-render only if files changed after it; verify with cmp). 2) Light preview ${P}/renders/susan-v4-voz-preview.mp4 (H.264 1280x720 30 fps, AAC 128k, faststart, ~8-12 MB). 3) ${P}/plan/entrega-voz-contacto.jpg (one still every 2 s tiled, 2000 px wide, < 1.5 MB). 4) Update ${P}/plan/ESTADO.md (voice mounted, QA verdict, loudness, remaining minors) and ${P}/scripts/README.md if you changed anything about the voice pipeline. 5) Commit (plan/, STORYBOARD.md, compositions/, index.html, scripts/; not renders) 'feat(video): render final de la v4 con voz' and push. Final reply: paths, duration, fps, size, loudness, and remaining minor issues.`, { label: 'final:entrega-voz', phase: 'Final' })

return { menoresTxt, integ, qa, fin }
