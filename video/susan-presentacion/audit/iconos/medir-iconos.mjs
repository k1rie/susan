import puppeteer from 'puppeteer-core';import fs from 'fs';
const P='/Users/diegoguerrero/Developer/SUSAN/video/susan-presentacion';
const exe=process.env.HOME+'/.cache/puppeteer/chrome-headless-shell/mac_arm-143.0.7499.192/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const b=await puppeteer.launch({executablePath:exe,args:['--allow-file-access-from-files']});
const out=[];
for(const f of fs.readdirSync(P+'/compositions/frames').sort()){
  let h=fs.readFileSync(P+'/compositions/frames/'+f,'utf8');
  const t=h.match(/<template>([\s\S]*)<\/template>/)[1].replace(/<script[\s\S]*?<\/script>/g,'');
  const html=`<!doctype html><html><head><base href="file://${P}/"><meta charset=utf-8></head><body style="margin:0;width:1920px;height:1080px;position:relative">${t}</body></html>`;
  const tmp=P+'/.tmp-measure.html';
  fs.writeFileSync('/private/tmp/claude-501/-Users-diegoguerrero-Desktop-SUSAN/b557fc0b-bc6d-41ed-af52-b641a6e29ef1/scratchpad/ic/m.html',html);
  const pg=await b.newPage();await pg.setViewport({width:1920,height:1080});
  await pg.goto('file:///private/tmp/claude-501/-Users-diegoguerrero-Desktop-SUSAN/b557fc0b-bc6d-41ed-af52-b641a6e29ef1/scratchpad/ic/m.html',{waitUntil:'load'});
  const r=await pg.evaluate(()=>{
    return [...document.querySelectorAll('svg')].filter(s=>s.getAttribute('viewBox')==='0 0 24 24'||s.classList.length).map(s=>{
      const cs=getComputedStyle(s);const r=s.getBoundingClientRect();
      const vb=s.viewBox.baseVal;
      const p=s.parentElement;const pr=p.getBoundingClientRect();
      const kid=s.firstElementChild;const kc=kid?getComputedStyle(kid):null;
      const sw=parseFloat(s.getAttribute('stroke-width')||(kc&&kc.strokeWidth)||0);
      return {id:s.id||'',cls:(s.getAttribute('class')||'').slice(0,30),w:Math.round(r.width*10)/10,h:Math.round(r.height*10)/10,vb:vb?vb.width:0,
        sw, effStroke: vb&&vb.width? Math.round(sw*r.width/vb.width*100)/100:0,
        color:cs.color,stroke:(kc&&kc.stroke)||cs.stroke,fill:(kc&&kc.fill)||cs.fill,
        parent:(p.id||p.className&&p.className.baseVal||p.className||p.tagName).toString().slice(0,34),pw:Math.round(pr.width),ph:Math.round(pr.height),pbg:getComputedStyle(p).backgroundColor,
        d:(s.firstElementChild?.getAttribute('d')||s.firstElementChild?.tagName||'').slice(0,28)};
    });});
  for(const x of r)out.push({f,...x});
  await pg.close();
}
await b.close();
fs.writeFileSync('measure.json',JSON.stringify(out,null,1));
for(const x of out)console.log(x.f.slice(0,2),x.w+'x'+x.h,'sw'+x.sw,'eff'+x.effStroke,'tile'+x.pw+'x'+x.ph,x.pbg.replace('rgba','a'),'|',x.parent,'|',x.d);
