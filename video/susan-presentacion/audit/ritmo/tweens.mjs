#!/usr/bin/env node
// Extrae los tweens reales de cada cuadro: carga el <script> del cuadro en Chrome headless con GSAP local,
// recorre su timeline y vuelca (inicio, duracion, objetivo, propiedades, ease, t90) a tweens.json.
// Uso: node audit/ritmo/tweens.mjs   (CHROME=/ruta/a/chrome-headless-shell opcional)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const CHROME = process.env.CHROME || `${process.env.HOME}/.cache/hyperframes/chrome/chrome-headless-shell/mac_arm-152.0.7977.30/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const TMP = process.env.TMPDIR_AUDIT || path.join(HERE, '.tmp');
fs.mkdirSync(TMP, { recursive: true });
const gsapSrc = fs.readFileSync(path.join(HERE, 'vendor/gsap.min.js'), 'utf8');

const files = fs.readdirSync(path.join(ROOT, 'compositions/frames')).filter(f => f.endsWith('.html')).sort();
const out = {};
const dump = `
<script>
(function(){
  function walk(tl){
    var rows=[];
    tl.getChildren(false,true,true).forEach(function(c){
      var v=c.vars||{}; var tg=[];
      try{ tg=c.targets? c.targets():[]; }catch(e){}
      var names=tg.slice(0,4).map(function(t){ if(!t) return '?'; if(t.id) return t.id; if(t.className&&t.className.baseVal!==undefined) return t.className.baseVal; if(t.className) return String(t.className).split(' ')[0]; return 'obj'; });
      var props=Object.keys(v).filter(function(k){return ['ease','duration','delay','immediateRender','onUpdate','stagger','overwrite','snap','paused','data','keyframes','repeat','yoyo','startAt'].indexOf(k)<0;});
      var from={};
      if(c.data!=='x'){}
      var d=c.duration(); var e=v.ease; var easeName=(typeof e==='string')?e:(e?'fn':'power1.out');
      var f=gsap.parseEase(easeName==='fn'?'none':easeName);
      var t90=d; if(d>0){ var lo=0,hi=1; for(var i=0;i<30;i++){var m=(lo+hi)/2; if(f(m)<0.9) lo=m; else hi=m;} t90=hi*d; }
      var vars={}; props.forEach(function(k){ var x=v[k]; vars[k]=(typeof x==='number'||typeof x==='string')?x:'~'; });
      rows.push({ s:+c.startTime().toFixed(3), d:+d.toFixed(3), t90:+t90.toFixed(3), n:tg.length, tg:names, ease:easeName, props:props, to:vars, from:(c.vars&&c.vars.startAt)||null, isFromTo: !!(c._fromTo||false) });
    });
    return rows;
  }
  var ids=Object.keys(window.__timelines);
  var res={}; ids.forEach(function(id){ var tl=window.__timelines[id]; res[id]={ duration: tl.duration(), tweens: walk(tl) }; });
  var pre=document.createElement('pre'); pre.id='__out'; pre.textContent=JSON.stringify(res); document.body.appendChild(pre);
})();
</script>`;

for (const f of files) {
    let html = fs.readFileSync(path.join(ROOT, 'compositions/frames', f), 'utf8');
    html = html.replace(/<template>/, '').replace(/<\/template>\s*$/, '');
    html = html.replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/gsap[^"]*"><\/script>/g, '');
    const doc = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>${gsapSrc}</script><script>window.__timelines={};</script>${html}${dump}</body></html>`;
    const p = path.join(TMP, f);
    fs.writeFileSync(p, doc);
    const dom = execFileSync(CHROME, ['--headless', '--disable-gpu', '--no-sandbox', '--virtual-time-budget=4000', '--allow-file-access-from-files', '--dump-dom', 'file://' + p], { maxBuffer: 1 << 28 }).toString();
    const m = dom.match(/<pre id="__out">([\s\S]*?)<\/pre>/);
    if (!m) { console.error('sin salida', f); continue; }
    const txt = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    Object.assign(out, JSON.parse(txt));
}
fs.writeFileSync(path.join(HERE, 'tweens.json'), JSON.stringify(out, null, 1));
for (const k of Object.keys(out)) console.log(k, 'dur', out[k].duration.toFixed(2), 'tweens', out[k].tweens.length);
