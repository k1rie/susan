export const meta = {
  name: 'susan-v4-critico-dinamismo',
  description: 'Completa y contrasta el plan de dinamismo (el director fue cortado por el límite de uso)',
  phases: [{ title: 'Dirigir', detail: 'un director escribe DINAMISMO.md y actualiza STORYBOARD.md (único escritor)' }, { title: 'Contrastar', detail: 'un crítico reta el plan contra la regla del dueño y lo corrige' }],
}

const P = '/home/user/susan/video/susan-v4'
const SK = '/root/.claude/skills'
const COMMIT_FOOTER = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01GNm8ZQGo8vSP18qjgTWPYH'
const CTX = `Project: SUSAN v4 launch video (HyperFrames, 1920x1080, 55 s, 8 frames), dir ${P}. The plan is APPROVED by the owner. Source of truth, in precedence order: ${P}/BRIEF.md (read it fully, especially the 2026-10-06 decisions and the 'Plan aprobado' block) > ${P}/STORYBOARD.md (+ its '## Video direction') > ${P}/SCRIPT.md > ${P}/frame.md (video design system) > ${P}/plan/SINTESIS.md > other ${P}/plan/*.md (DISENO-APP for exact app components, CONTENIDO §3 for data, PILOTO for render-proven recipes). Real app captures for fidelity: ${P}/capture/assets/ (flat, curated; see capture/extracted/asset-descriptions.md) and ${P}/capture/app-real/{desktop,mobile,crops,dom}/ (INVENTORY.md) — view images with the Read tool. Write prose in Spanish (Mexico). Git: branch feat/video-v4 in /home/user/susan; when told to commit, use 'git -C /home/user/susan add <paths> && git -C /home/user/susan commit -m "<msg>\n\n${COMMIT_FOOTER}" && git -C /home/user/susan push -q origin feat/video-v4' (retry push up to 3 times on network error).`

const S = `${SK}/product-launch-video/scripts`
const HF = 'npx --yes hyperframes@0.8.134'


const DYN = `OWNER'S DYNAMISM RULE (read ${P}/BRIEF.md, last block, verbatim): DYNAMISM = CONTENT CHANGE, not camera motion, IN MODERATION (owner: 'sin exagerar, que sea cada tanto, si no, se va a saturar'): something NEW appears every ~2-3 s (another real UI element, another number, another state); no composition stays the same for more than ~3 s; only ONE relay at a time; key numbers keep their reading moment; fewer, cleaner relays beat many — never saturate. Typical relay: the current element EXITS with directional motion blur (whip off to a side/up/down, velocity-tied SVG blur per PILOTO §3, filter none at rest) and the next ENTERS from the opposite side with a trail and a smooth settle (expo.out/power3.out). Zooms ONLY as TRANSITIONS (zoom-through into an element that becomes the next shot, or pull out from it to reveal context) — NO decorative slow zooms or camera drift on static content. Keep smooth + blur (long eases, rack focus and trails only on fast moves; no hard cuts, no flicker). Keep: frame durations (55 s total), voice anchors (the number the voice names stays on screen while named even if things change around it), data from CONTENIDO §3 only (never invent numbers to get 'more content' — use more REAL app pieces from ${P}/capture/assets and capture/extracted/asset-descriptions.md), and prior decisions (no cursor, no sample counts, no gold underline under SUSAN, straight tooltip, soft 3D tilt flat at reads, one gold element max).`

phase('Contrastar')
const critica = await agent(`${CTX}

${DYN}

You are the adversarial critic of the dynamism plan ${P}/plan/DINAMISMO.md and the updated ${P}/STORYBOARD.md. IMPORTANT: the director wrote DINAMISMO.md (complete, sections 1-5) and updated STORYBOARD.md, but was CUT OFF by the usage limit before reporting — so first VERIFY COMPLETENESS and finish what is missing: every '## Frame N' block of STORYBOARD.md must reflect its DINAMISMO.md section (Scene lines, sfx_cues, handoff_in/out incl. the changed edges F4 in, F5->F6, F7 out); handle DINAMISMO §5 'Pedidos fuera de mi zona' that are documentation/storyboard work; the packets must be regenerated (\`node ${S}/frame-packets.mjs --project ${P} --storyboard ${P}/STORYBOARD.md\`, all <= 48 KB) and '## Video direction' re-extracted to ${P}/.hyperframes/frame-packets/_video-direction.md.
Check, frame by frame and second by second: (a) is there ANY stretch > 3 s where nothing new appears — and, equally important, is any frame SATURATED (changes faster than ~every 2 s, two relays overlapping, too many elements)? (b) any decorative zoom or camera drift that is not a transition? (c) every new element is real SUSAN UI or a number from CONTENIDO §3 (no invented data, no fake UI); (d) voice anchors and durations unchanged, the named number on screen while named; (e) relays read smooth (no two big moves at once, blur only on fast moves, render budget: one large blurred surface at a time); (f) seams between frames still match numerically on both sides; (g) the result will still read as a calm, professional product piece, not chaotic — content changes are meaningful steps of the story, not noise. Fix every problem directly in DINAMISMO.md and STORYBOARD.md (re-validate parser + packets + _video-direction extract), commit 'docs(video): plan de dinamismo revisado'. Final reply: what you changed.`, { label: 'critico:dinamismo', phase: 'Contrastar' })

return { critica }
