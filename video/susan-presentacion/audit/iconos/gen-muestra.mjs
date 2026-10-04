import fs from 'fs';import {execFileSync} from 'child_process';
const P='/Users/diegoguerrero/Developer/SUSAN/video/susan-presentacion';
const S='/private/tmp/claude-501/-Users-diegoguerrero-Desktop-SUSAN/b557fc0b-bc6d-41ed-af52-b641a6e29ef1/scratchpad/ic/';
const ic=(n,...a)=>execFileSync('node',[P+'/scripts/lucide.mjs',n,...a]).toString().trim();
const av=JSON.parse(fs.readFileSync(P+'/assets/avatars/manifest.json')).avatares;
const avimg=(i,s)=>`<img src="file://${P}/assets/avatars/${av[i].archivo}" width=${s} height=${s} style="border-radius:50%;display:block">`;
const tile=(n,tono,size=72,isz=40,st=1.75)=>ic(n,'--size',isz,'--stroke',st,'--tile',tono,'--tile-size',size);
const css=`@font-face{font-family:H;src:url("file://${P}/assets/fonts/HankenGrotesk-var.woff2");font-weight:100 900}
body{margin:0;background:#f7f5f2;font-family:H,system-ui,sans-serif;color:#1e1919;width:1920px}
h2{font-size:26px;margin:0 0 6px;font-weight:700}p.n{margin:0 0 14px;color:#6f6a65;font-size:17px}
.sec{padding:26px 40px;border-bottom:2px solid #e7e2dc}.row{display:flex;gap:30px;align-items:flex-start}
.lab{font-size:15px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px}.antes{color:#b3261e}.desp{color:#1f7a47}
.card{background:#fff;border:1.5px solid #e7e2dc;border-radius:28px}
.stat{width:340px;height:200px;padding:28px;box-sizing:border-box;border-radius:28px;background:#fff;border:1.5px solid #e7e2dc;display:flex;flex-direction:column;justify-content:space-between}
.stat .t{display:flex;align-items:center;gap:16px;font-size:26px;color:#6f6a65;font-weight:500}.stat b{font-size:76px;line-height:1;font-weight:700}
.g{display:flex;flex-wrap:wrap;gap:16px}.ci{width:132px;text-align:center;font-size:13px;color:#6f6a65}.ci div{margin:0 auto 6px}
`;
let h=`<style>${css}</style><body>`;
// A stats
const stats=[['users','azul','Inscritos','24'],['circle-check','verde','Presentes','21'],['clock','dorado','Retardos','2'],['user-x','rosa','Sin registro','1']];
h+=`<div class=sec><h2>A. Tarjetas de cifra (cuadro 6): tile 72 px, icono 40 px, trazo 1.75</h2><p class=n>Antes: icono 28-30 px en tile 52 px, tintes 8 %. Despues: mismo recurso que StatCard de la app, escalado x2.3 para 1080p.</p>
<div class=lab><span class=antes>Antes (fotograma real, 26 s)</span></div><img src="file://${S}crop-stats.png" width=1440 style="display:block;border-radius:12px">
<div class=lab style="margin-top:16px"><span class=desp>Despues (propuesta)</span></div><div class=row style="gap:26px">`;
for(const [n,t,l,v] of stats)h+=`<div class=stat><div class=t>${tile(n,t,72,40)}${l}</div><b>${v}</b></div>`;
h+=`</div></div>`;
// B hero 11
h+=`<div class=sec><h2>B. Heroe del cuadro 11: candado-escudo</h2><p class=n>Antes: escudo con candado dibujado a mano (trazo 1.3, no existe en Lucide). Despues: tres opciones 100 % Lucide.</p><div class=row>
<div><div class=lab><span class=antes>Antes</span></div><img src="file://${S}crop-hero11.png" width=520></div>`;
const disc=(inner,sz=260)=>`<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:#e1ebfd;border:2px solid rgba(0,97,254,.22);display:grid;place-items:center;color:#0061fe">${inner}</div>`;
h+=`<div><div class=lab><span class=desp>Op. 1 (recomendada): shield-check 150 px</span></div>${disc(ic('shield-check','--size',150,'--stroke',1.5))}</div>`;
h+=`<div><div class=lab><span class=desp>Op. 2: shield + lock-keyhole</span></div>${disc(`<div style="position:relative;width:150px;height:150px">${ic('shield','--size',150,'--stroke',1.5)}<div style="position:absolute;left:47px;top:45px">${ic('lock-keyhole','--size',56,'--stroke',1.75)}</div></div>`)}</div>`;
h+=`<div><div class=lab><span class=desp>Op. 3: shield-lock</span></div>${disc(ic('shield-lock','--size',150,'--stroke',1.5))}</div></div></div>`;
// C cam
h+=`<div class=sec><h2>C. Cuadro 5: recuadros de reconocimiento con avatares ilustrados</h2><p class=n>Antes: silueta generica con las iniciales encima de la cabeza. Despues: avatar DiceBear lorelei (CC0) con el nombre ya en la lista.</p><div class=row>
<div><div class=lab><span class=antes>Antes</span></div><img src="file://${S}crop-cam.png" width=700></div><div><div class=lab><span class=desp>Despues</span></div>
<div style="background:#1b1816;border-radius:28px;padding:26px;display:grid;grid-template-columns:repeat(4,160px);gap:16px;width:fit-content">`;
for(let i=0;i<8;i++)h+=`<div style="position:relative;height:170px;border-radius:16px;background:rgba(255,255,255,.06);display:grid;place-items:center;border:3px solid ${i<4?'#fff':'rgba(255,255,255,.25)'}"><div>${avimg(i,112)}</div><span style="position:absolute;top:-16px;background:#0061fe;color:#fff;border-radius:8px;padding:3px 10px;font-weight:600;font-size:20px">9${7+i%3} %</span>${i<4?`<span style="position:absolute;right:6px;bottom:6px;width:38px;height:38px;border-radius:50%;background:#27a06a;display:grid;place-items:center;color:#fff">${ic('check','--size',24,'--stroke',3)}</span>`:''}</div>`;
h+=`</div></div></div></div>`;
// D icon set
const roles=[['Interfaz: tile 72 / icono 40 / 1.75',72,40,1.75],['Fila: tile 56 / icono 32 / 1.75',56,32,1.75]];
const set=[['timer','dorado'],['hourglass','dorado'],['clipboard-list','azul'],['users','azul'],['users-round','azul'],['calendar-days','azul'],['calendar-check','verde'],['scan-face','verde'],['video','neutro'],['camera','neutro'],['circle-check','verde'],['badge-check','verde'],['clock','dorado'],['user-x','rosa'],['user-round-x','rosa'],['ban','rosa'],['triangle-alert','rosa'],['layers','neutro'],['user-check','verde'],['activity','neutro'],['chart-line','azul'],['trending-up','dorado'],['download','tinta'],['qr-code','tinta'],['bell','neutro'],['bell-ring','dorado'],['flame','azul'],['house','tinta'],['book-open','neutro'],['user-round','neutro'],['image-off','neutro'],['scroll-text','neutro'],['file-spreadsheet','verde'],['fingerprint','azul'],['graduation-cap','azul'],['sparkles','azul'],['sparkle','azul'],['shield-check','azul'],['shield-lock','azul'],['lock-keyhole','azul']];
h+=`<div class=sec><h2>D. Iconos Lucide reales (v1.50.0) en tiles de la app</h2><p class=n>Fondo y color por tono: azul / verde / dorado / rosa / neutro / tinta (mismos tokens de StatCard).</p><div class=g>`;
for(const [n,t] of set)h+=`<div class=ci><div style="width:72px">${tile(n,t,72,40)}</div>${n}</div>`;
h+=`</div></div>`;
// E hero sizes + sparkle
h+=`<div class=sec><h2>E. Heroes: sparkle (cuadro 4) y timer (cuadro 2)</h2><div class=row style="align-items:center;gap:50px"><div class=lab>Antes<br><img src="file://${S}crop-f4.png" width=300 style="border-radius:8px"></div>
<div style="color:#0061fe">${ic('sparkle','--size',120,'--stroke',1.5,'--fill','#ffffff')}</div><div style="color:#0061fe">${ic('sparkles','--size',120,'--stroke',1.5)}</div>
<div class=lab>Antes<br><img src="file://${S}crop-f2.png" width=300 style="border-radius:8px"></div>
<div style="width:132px;height:132px;border-radius:50%;background:#fbefd2;display:grid;place-items:center;color:#9a6408">${ic('timer','--size',76,'--stroke',1.75)}</div>
<div style="width:176px;height:176px;border-radius:50%;background:#fbefd2;display:grid;place-items:center;color:#9a6408">${ic('timer','--size',104,'--stroke',1.5)}</div></div></div>`;
// F avatars
h+=`<div class=sec style="border:0"><h2>F. 24 avatares DiceBear lorelei (CC0 1.0): 120 px, 96 px y 64 px</h2><div class=g style="gap:14px">`;
for(let i=0;i<24;i++)h+=`<div class=ci style="width:120px">${avimg(i,120)}<div style="margin-top:4px">${av[i].iniciales} ${av[i].nombre}</div></div>`;
h+=`</div><div class=row style="margin-top:14px;gap:12px;align-items:center;flex-wrap:wrap">`;
for(let i=0;i<8;i++)h+=avimg(i,96);for(let i=8;i<22;i++)h+=avimg(i,64);
h+=`</div></div>`;
fs.writeFileSync(S+'muestra.html',h);
