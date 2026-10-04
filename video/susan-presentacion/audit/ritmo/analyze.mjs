#!/usr/bin/env node
// Densidad de eventos por cuadro a partir de tweens.json (salida de tweens.mjs).
// Evento = grupo de tweens "salientes" cuyo inicio cae a menos de 0.12 s del anterior (un stagger o una
// entrada multi-propiedad cuenta una sola vez). Actividad = intervalo [inicio, inicio + t90] de un tween saliente.
// Ambiente/deriva (parpadeos, olas, sway de avatares, camara < 3 %/s) NO cuenta como evento ni como actividad.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const J = JSON.parse(fs.readFileSync(path.join(HERE, 'tweens.json'), 'utf8'));
const FR = [
 ['01-hook',0,4.5],['02-minutos',4.5,4.5],['03-tarde',9,4.0],['04-intro',13,4.5],['05-camara',17.5,6.0],['06-vivo',23.5,5.5],
 ['07-revision',29,4.5],['08-reportes',33.5,4.0],['09-analitica',37.5,6.0],['10-alumno',43.5,4.5],['11-confianza',48,3.5],['12-cierre',51.5,4.5]];
const SAL = new Set(['opacity','scale','x','y','rotation','strokeDashoffset','innerText','v','value','clipPath','scaleX','scaleY','backgroundColor','color','borderColor','filter','skewX','backgroundPosition']);
const AMB = /(^|-)(cr|caret|idle|dot|wave|wave-f|wave-b|w1|w2|glint|drift|haze|mesh|s[0-7])$/;
const CAMN = /(cam|world|stage|outer|inner|camin|lockup|drift)$/;
const res = {};
for (const [id, off, len] of FR) {
  const T = J[id].tweens; const lastTo = {};
  const ev = []; const act = []; const typing = [];
  for (const t of T) {
    const tg = t.tg[0] || '';
    const props = t.props.filter(p => SAL.has(p));
    const from = t.from || {};
    const key = tg + '|scale';
    let ds = null;
    if (t.to.scale !== undefined && typeof t.to.scale === 'number') { const f0 = from.scale ?? lastTo[key] ?? 1; ds = Math.abs(t.to.scale - f0); }
    for (const p of Object.keys(t.to)) if (typeof t.to[p] === 'number') lastTo[tg + '|' + p] = t.to[p];
    if (!props.length) continue;
    if (t.d <= 0.002) { // fijados en seco: tecleo / parpadeo
      if (/(ch\d*|c\d|char|ch)$/.test(tg) || /^(\d+-)?[a-z]+-ch/.test(tg) || t.n >= 1 && /ch/.test(tg)) typing.push(t.s);
      continue;
    }
    if (AMB.test(tg)) continue;
    // camara: solo cuenta si se mueve >= 3 %/s (o salto total >= 6 %)
    const isCam = CAMN.test(tg) && props.every(p => ['scale','x','y'].includes(p));
    if (isCam) {
      const dx = Math.abs((t.to.x ?? 0) - (from.x ?? lastTo[tg + '|x'] ?? 0));
      const speed = ((ds ?? 0) * 100) / t.d;
      if (speed < 3 && (ds ?? 0) < 0.06 && dx < 30) continue;
    }
    ev.push({ s: t.s, e: t.s + t.t90, tg, props: props.join('+'), cam: isCam });
  }
  // tecleo = una "actividad" continua
  const typeRuns = [];
  typing.sort((a, b) => a - b);
  let run = null;
  for (const s of typing) { if (run && s - run.e < 0.35) run.e = s; else { run = { s, e: s }; typeRuns.push(run); } }
  for (const r of typeRuns) if (r.e - r.s >= 0.15) ev.push({ s: r.s, e: r.e + 0.05, tg: 'TECLEO', props: 'type', cam: false });
  ev.sort((a, b) => a.s - b.s);
  // grupos de eventos
  const groups = [];
  for (const e of ev) { const g = groups[groups.length - 1]; if (g && e.s - g.s < 0.12) { g.n++; g.e = Math.max(g.e, e.e); } else groups.push({ s: e.s, e: e.e, n: 1, tg: e.tg }); }
  // huecos entre inicios de evento
  const starts = groups.map(g => g.s);
  const gapsStart = []; for (let i = 1; i < starts.length; i++) gapsStart.push({ from: starts[i - 1], to: starts[i], gap: +(starts[i] - starts[i - 1]).toFixed(2) });
  // huecos de actividad (nada se mueve): rejilla de 0.05 s
  const N = Math.round(len / 0.05); const on = new Array(N).fill(false);
  for (const e of ev) { for (let i = Math.floor(e.s / 0.05); i <= Math.min(N - 1, Math.floor(e.e / 0.05)); i++) on[i] = true; }
  const still = []; let i = 0;
  while (i < N) { if (!on[i]) { let j = i; while (j < N && !on[j]) j++; if ((j - i) * 0.05 >= 0.4) still.push({ from: +(i * 0.05).toFixed(2), to: +(j * 0.05).toFixed(2), dur: +((j - i) * 0.05).toFixed(2) }); i = j; } else i++; }
  const lastEv = groups.length ? Math.max(...groups.map(g => g.e)) : 0;
  res[id] = { abs_start: off, len, groups: groups.length, ev_per_s: +(groups.length / len).toFixed(2), mean_interval: +(len / Math.max(1, groups.length)).toFixed(2),
    max_gap_between_starts: gapsStart.sort((a, b) => b.gap - a.gap)[0] || null, still, last_activity_end: +lastEv.toFixed(2), tail_hold: +(len - lastEv).toFixed(2),
    starts: starts.map(x => +x.toFixed(2)), typing: typeRuns.map(r => [+r.s.toFixed(2), +r.e.toFixed(2)]) };
}
fs.writeFileSync(path.join(HERE, 'events.json'), JSON.stringify(res, null, 1));
for (const [k, v] of Object.entries(res)) {
  console.log(`${k} len=${v.len} eventos=${v.groups} ev/s=${v.ev_per_s} int.medio=${v.mean_interval}s maxGapInicios=${v.max_gap_between_starts ? v.max_gap_between_starts.gap + 's@' + v.max_gap_between_starts.from + '-' + v.max_gap_between_starts.to : '-'} colaQuieta=${v.tail_hold}s`);
  console.log('   quietos>=0.4s:', v.still.map(s => `${s.from}-${s.to}(${s.dur})`).join(' ') || '-');
  console.log('   inicios:', v.starts.join(' '));
}
