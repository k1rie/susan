export const meta = {
  name: 'susan-v4-cuadros',
  description: 'Construye, revisa y corrige un subconjunto de cuadros de la v4 (args.frames); se lanzan varias instancias en paralelo',
  phases: [
    { title: 'Construir', detail: 'un worker por cuadro' },
    { title: 'Revisar cuadro', detail: 'revisor independiente por cuadro' },
    { title: 'Corregir cuadro', detail: 'el worker aplica los hallazgos' },
  ],
}

const P = '/home/user/susan/video/susan-v4'
const SK = '/root/.claude/skills'
const COMMIT_FOOTER = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01GNm8ZQGo8vSP18qjgTWPYH'
const CTX = `Project: SUSAN v4 launch video (HyperFrames, 1920x1080, 55 s, 8 frames), dir ${P}. The plan is APPROVED by the owner. Source of truth, in precedence order: ${P}/BRIEF.md (read it fully, especially the 2026-10-06 decisions and the 'Plan aprobado' block) > ${P}/STORYBOARD.md (+ its '## Video direction') > ${P}/SCRIPT.md > ${P}/frame.md (video design system) > ${P}/plan/SINTESIS.md > other ${P}/plan/*.md (DISENO-APP for exact app components, CONTENIDO §3 for data, PILOTO for render-proven recipes). Real app captures for fidelity: ${P}/capture/assets/ (flat, curated; see capture/extracted/asset-descriptions.md) and ${P}/capture/app-real/{desktop,mobile,crops,dom}/ (INVENTORY.md) — view images with the Read tool. Write prose in Spanish (Mexico). Git: branch feat/video-v4 in /home/user/susan; when told to commit, use 'git -C /home/user/susan add <paths> && git -C /home/user/susan commit -m "<msg>\n\n${COMMIT_FOOTER}" && git -C /home/user/susan push -q origin feat/video-v4' (retry push up to 3 times on network error).`

const S = `${SK}/product-launch-video/scripts`
const HF = 'npx --yes hyperframes@0.8.134'

const setup = { role_path: args.role_path, video_direction_path: args.video_direction_path, frames: args.frames }
const DISPATCH = f => `${CTX}

You are the FRAME WORKER for exactly one frame of the SUSAN v4 video. First read, in full and in this order: (1) your role: ${setup.role_path}; (2) your packet: ${f.packet}; (3) the video-wide direction extract: ${setup.video_direction_path}; (4) ${P}/frame.md (design truth). These four documents are your contract; follow the role's rules exactly (HyperFrames composition contract, seek-safe single paused timeline registered on window.__timelines, full-bleed background on its own class="clip" layer, no front-loading, handoff numbers exact, determinism, local GSAP from frame.md, fonts from ${P}/assets/fonts, Lucide icons from ${P}/assets/icons inlined, abstract avatars from ${P}/assets/avatars, NO cursor, NO sample counts on screen).
Dispatch context: PROJECT_DIR=${P}; frame_id=${f.id}; frame ${f.number} «${f.title}»; duration ${f.duration}s; canvas 1920x1080; final render 60 fps (author motion for 60 fps smoothness: no stepped/linear UI moves except where specified); confirmed sketch: NO (fast mode — compose the layout yourself from the packet's Scene list and the real captures); captions: disabled (no keep-out band), but keep key content inside the title-safe box (10 % inset) and above y≈1000.
Allowed extra references (read only what your frame needs): ${P}/plan/PILOTO.md §3 (render-proven recipes: live rack focus ≤20 px, velocity-tied SVG motion blur helper, odometer columns, 3D pose + tinted shadow layer, chip drop with squash), ${P}/plan/DISENO-APP.md §2 (exact recipes of SUSAN components), and the real capture images named in your packet's asset_candidates (now staged in ${P}/assets/) or under ${P}/capture/assets/ — view them with the Read tool and match the real UI faithfully at scale E=2.
Write ONLY ${P}/${f.src}. Never edit STORYBOARD.md, frame.md, index.html or other frames.
Self-check before returning: \`node ${P}/scripts/preview-frame.mjs ${f.id} --bordes --anclas --sheet\` (stills under ${P}/revision/${f.id}/ — LOOK at them with Read: layout, fonts loaded, text correct with accents, nothing clipped, handoff poses), \`node ${P}/scripts/frame-check.mjs ${f.id}\` (fix every ERROR; warnings: fix or justify), and \`${HF} lint\` scoped to your file if possible. Iterate until clean. Final reply: what you built per Scene (with times), the handoff_in/handoff_out values you implemented, the check results, and any deviation from the packet with its reason.`

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    frame: { type: 'string' },
    verdict: { type: 'string', enum: ['listo', 'corregir'] },
    findings: { type: 'array', items: { type: 'object', properties: {
      severity: { type: 'string', enum: ['bloqueante', 'importante', 'menor'] },
      at: { type: 'string', description: 'local time or scene' },
      issue: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' },
    }, required: ['severity', 'at', 'issue', 'evidence', 'fix'] } },
  },
  required: ['frame', 'verdict', 'findings'],
}

const REVIEW = (f, built) => `${CTX}

You are an INDEPENDENT, adversarial reviewer of one finished frame: ${P}/${f.src} (frame_id ${f.id}, frame ${f.number} «${f.title}», ${f.duration}s). Its contract: ${f.packet} (read it), ${setup.video_direction_path}, ${P}/frame.md, and the owner's decisions in ${P}/BRIEF.md. Worker's report:
${built || '(el worker no devolvió informe)'}
Do your own measurements; do not trust the report: run \`node ${P}/scripts/preview-frame.mjs ${f.id} --bordes --anclas --sheet\` and \`node ${P}/scripts/frame-check.mjs ${f.id}\`, take extra stills with \`${HF} snapshot\` or the preview tool at each Scene boundary and at every vo_anchor time, and LOOK at them with the Read tool. Compare the UI against the real captures named in the packet (fidelity: tokens, fonts/weights ≤600, radii app×E, hairline borders, icon geometry, state chips with labels, real copy/numbers from the packet with accents). Check timing against the packet's Scene list and anchors (key number arrives before its anchor and holds still ≥1.2 s while named; no dead still ≥1.0 s; no front-loading; reveals paced across the frame), the handoff poses at both edges (exact numbers, flat 3D at edges and at reads), motion quality for a professional, fluid result at 60 fps (eases per frame.md, no jitter/pops, max overshoot budget, motion blur only on fast moves), render-budget rules (one large blur at a time ≤24 px), and the owner rules (NO cursor, NO sample counts like 1/3 or 'lecturas', straight tooltip, one gold element, no forbidden claims). Return 'listo' only if there is nothing bloqueante or importante.`

const FIX = (f, review) => `${CTX}

You are the FRAME WORKER for ${f.id} (frame ${f.number} «${f.title}»), revising your composition ${P}/${f.src} after an independent review. Your contract is unchanged: ${setup.role_path}, ${f.packet}, ${setup.video_direction_path}, ${P}/frame.md (re-read the parts you need). Review findings:
${review ? review.findings.map(x => `- [${x.severity}] @${x.at}: ${x.issue} — evidencia: ${x.evidence} — arreglo: ${x.fix}`).join('\n') : '(sin hallazgos estructurados: vuelve a correr preview-frame y frame-check y corrige lo que encuentres)'}
Fix every bloqueante and importante finding and the cheap menores (justify any you reject). Write ONLY ${P}/${f.src}. Re-run \`node ${P}/scripts/preview-frame.mjs ${f.id} --bordes --anclas --sheet\` and \`node ${P}/scripts/frame-check.mjs ${f.id}\`, LOOK at the stills, iterate until clean. Final reply: what changed, final check results, and the exact handoff_in/handoff_out values implemented.`


phase('Construir')
const frameResults = await pipeline(
  setup.frames,
  f => agent(DISPATCH(f), { label: `construir:${f.id}`, phase: 'Construir' }),
  (built, f) => agent(REVIEW(f, built), { label: `revisar:${f.id}`, phase: 'Revisar cuadro', schema: REVIEW_SCHEMA }).then(r => ({ built, review: r })),
  (st, f) => {
    const needsFix = !st.review || st.review.verdict === 'corregir' || st.review.findings.some(x => x.severity !== 'menor')
    if (!needsFix) return { ...st, fixed: '(sin correcciones necesarias)' }
    return agent(FIX(f, st.review), { label: `corregir:${f.id}`, phase: 'Corregir cuadro' }).then(fixed => ({ ...st, fixed }))
  },
)
return setup.frames.map((f, i) => {
  const r = frameResults[i]
  if (!r) return `### ${f.id}: FALLÓ`
  const nf = r.review ? r.review.findings.length : '?'
  return `### ${f.id} (${f.number} «${f.title}»)\nRevisión: ${r.review ? r.review.verdict : '?'} (${nf} hallazgos)\nCorrección final:\n${r.fixed || r.built || ''}`
}).join('\n\n')
