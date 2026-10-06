export const meta = {
  name: 'susan-v4-dinamizar',
  description: 'Aplica el plan de dinamismo a un subconjunto de cuadros (args.frames): dinamizar, revisar y corregir',
  phases: [{ title: 'Dinamizar', detail: 'un worker por cuadro edita el HTML actual' }, { title: 'Revisar', detail: 'revisor independiente' }, { title: 'Corregir', detail: 'aplica hallazgos' }],
}

const P = '/home/user/susan/video/susan-v4'
const SK = '/root/.claude/skills'
const COMMIT_FOOTER = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01GNm8ZQGo8vSP18qjgTWPYH'
const CTX = `Project: SUSAN v4 launch video (HyperFrames, 1920x1080, 55 s, 8 frames), dir ${P}. The plan is APPROVED by the owner. Source of truth, in precedence order: ${P}/BRIEF.md (read it fully, especially the 2026-10-06 decisions and the 'Plan aprobado' block) > ${P}/STORYBOARD.md (+ its '## Video direction') > ${P}/SCRIPT.md > ${P}/frame.md (video design system) > ${P}/plan/SINTESIS.md > other ${P}/plan/*.md (DISENO-APP for exact app components, CONTENIDO §3 for data, PILOTO for render-proven recipes). Real app captures for fidelity: ${P}/capture/assets/ (flat, curated; see capture/extracted/asset-descriptions.md) and ${P}/capture/app-real/{desktop,mobile,crops,dom}/ (INVENTORY.md) — view images with the Read tool. Write prose in Spanish (Mexico). Git: branch feat/video-v4 in /home/user/susan; when told to commit, use 'git -C /home/user/susan add <paths> && git -C /home/user/susan commit -m "<msg>\n\n${COMMIT_FOOTER}" && git -C /home/user/susan push -q origin feat/video-v4' (retry push up to 3 times on network error).`

const S = `${SK}/product-launch-video/scripts`
const HF = 'npx --yes hyperframes@0.8.134'


const DYN = `OWNER'S DYNAMISM RULE (read ${P}/BRIEF.md, last block, verbatim): DYNAMISM = CONTENT CHANGE, not camera motion, IN MODERATION (owner: 'sin exagerar, que sea cada tanto, si no, se va a saturar'): something NEW appears every ~2-3 s (another real UI element, another number, another state); no composition stays the same for more than ~3 s; only ONE relay at a time; key numbers keep their reading moment; fewer, cleaner relays beat many — never saturate. Typical relay: the current element EXITS with directional motion blur (whip off to a side/up/down, velocity-tied SVG blur per PILOTO §3, filter none at rest) and the next ENTERS from the opposite side with a trail and a smooth settle (expo.out/power3.out). Zooms ONLY as TRANSITIONS (zoom-through into an element that becomes the next shot, or pull out from it to reveal context) — NO decorative slow zooms or camera drift on static content. Keep smooth + blur (long eases, rack focus and trails only on fast moves; no hard cuts, no flicker). Keep: frame durations (55 s total), voice anchors (the number the voice names stays on screen while named even if things change around it), data from CONTENIDO §3 only (never invent numbers to get 'more content' — use more REAL app pieces from ${P}/capture/assets and capture/extracted/asset-descriptions.md), and prior decisions (no cursor, no sample counts, no gold underline under SUSAN, straight tooltip, soft 3D tilt flat at reads, one gold element max).`

const frames = args.frames
const WORK = f => `${CTX}

${DYN}

You are the FRAME WORKER for ${f.id} (frame ${f.number} «${f.title}», ${f.duration}s) in the DYNAMISM round. Read first: ${P}/plan/DINAMISMO.md (the global relay grammar + YOUR frame's section — that is your spec), your frame's section of ${P}/STORYBOARD.md (already updated by the director; read only your '## Frame ${f.number}' block, its handoff_in/out, sfx_cues and vo_anchor), the worker role ${P}/.hyperframes/frame-packets/_role.md, ${P}/frame.md, ${P}/plan/PILOTO.md §3 (velocity-tied motion blur helper, odometer, 3D pose), and the CURRENT composition ${P}/${f.src} (edit it; reuse what works; do not start over unless the plan requires).
Implement the new shot list exactly: content changes every ~2-3 s with the planned relays (never busier than the plan) (exits with directional motion blur, entries with trail and smooth settle, zooms only as transitions), new elements reproducing the real SUSAN UI from the named capture assets (view them with Read; match tokens, fonts, radii app x E, Lucide icons from ${P}/assets/icons), voice anchors respected, edges matching the handoffs. Keep the composition seek-safe and deterministic (single paused timeline; tl.set for state; filter none at rest).
Write ONLY ${P}/${f.src}. Do NOT edit STORYBOARD.md (other workers run in parallel) — if your final timings need different sfx_cues or handoff numbers, report them precisely.
Self-check: \`node ${P}/scripts/preview-frame.mjs ${f.id} --bordes --anclas --sheet\` plus extra stills every 0.25 s around each relay (LOOK at them: smooth trails, no pops, no double images, readable at rest), and \`node ${P}/scripts/frame-check.mjs ${f.id}\` (fix structure/timing errors; its 'dead stretch' check should pass; sound-cue (d) errors may come from cues you retimed — list your final cues instead). Final reply: the implemented shot list with times, final sfx_cues line, handoffs, check results.`

const SCHEMA = { type: 'object', properties: { frame: { type: 'string' }, verdict: { type: 'string', enum: ['listo', 'corregir'] }, longest_unchanged_s: { type: 'number' }, findings: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['bloqueante', 'importante', 'menor'] }, at: { type: 'string' }, issue: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'at', 'issue', 'evidence', 'fix'] } } }, required: ['frame', 'verdict', 'longest_unchanged_s', 'findings'] }

const REVIEW = (f, built) => `${CTX}

${DYN}

You are an INDEPENDENT adversarial reviewer of ${P}/${f.src} (frame ${f.number} «${f.title}», ${f.duration}s) after the dynamism round. Spec: ${P}/plan/DINAMISMO.md (its section for this frame + grammar) and the frame's block in ${P}/STORYBOARD.md. Worker report:
${built || '(sin informe)'}
Measure yourself: preview-frame stills every 0.25 s (\`node ${P}/scripts/preview-frame.mjs ${f.id} --bordes --anclas --sheet\` plus extra times) and \`node ${P}/scripts/frame-check.mjs ${f.id}\`; LOOK at the stills. Judge: longest stretch with no new content (must be <= ~3 s; report it) and whether it feels saturated (changes faster than ~2 s, overlapping relays), relays smooth with convincing directional blur and no pops/double images/flicker, zooms only as transitions, every new element faithful to the real SUSAN UI (compare against the capture assets), no invented data, voice anchors (named number visible while named), handoff edges exact, professional calm feel (not chaotic). 'listo' only if nothing bloqueante or importante.`

const FIX = (f, r) => `${CTX}

${DYN}

You are the FRAME WORKER for ${f.id}, fixing ${P}/${f.src} after an independent review in the dynamism round (spec: ${P}/plan/DINAMISMO.md + your STORYBOARD block). Findings:
${r ? r.findings.map(x => `- [${x.severity}] @${x.at}: ${x.issue} — evidencia: ${x.evidence} — arreglo: ${x.fix}`).join('\n') : '(sin hallazgos estructurados: vuelve a medir y corrige)'}
Fix all bloqueante/importante and cheap menores. Write ONLY ${P}/${f.src}; do not edit STORYBOARD.md (report cue/handoff changes). Re-run preview-frame + frame-check, LOOK, iterate. Final reply: changes, final sfx_cues line, handoffs, check results.`

phase('Dinamizar')
const res = await pipeline(
  frames,
  f => agent(WORK(f), { label: `dinamizar:${f.id}`, phase: 'Dinamizar' }),
  (built, f) => agent(REVIEW(f, built), { label: `revisar:${f.id}`, phase: 'Revisar', schema: SCHEMA }).then(r => ({ built, r })),
  (st, f) => (!st.r || st.r.verdict === 'corregir' || st.r.findings.some(x => x.severity !== 'menor'))
    ? agent(FIX(f, st.r), { label: `corregir:${f.id}`, phase: 'Corregir' }).then(fixed => ({ ...st, fixed }))
    : { ...st, fixed: '(sin correcciones necesarias)' },
)
return frames.map((f, i) => { const x = res[i]; if (!x) return `### ${f.id}: FALLÓ`; return `### ${f.id} (${f.number} «${f.title}»)\nRevisión: ${x.r ? x.r.verdict : '?'} · mayor tramo sin cambio: ${x.r ? x.r.longest_unchanged_s : '?'} s · ${x.r ? x.r.findings.length : '?'} hallazgos\nInforme final:\n${x.fixed && x.fixed !== '(sin correcciones necesarias)' ? x.fixed : x.built}` }).join('\n\n')
