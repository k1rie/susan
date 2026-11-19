import fs from 'fs'; import path from 'path';
const DIR = path.dirname(new URL(import.meta.url).pathname);
const img = (f) => `data:image/png;base64,${fs.readFileSync(path.join(DIR, f)).toString('base64')}`;
const NAVY = '#0B2461';
const INT = [['Casanova Pérez Gabriela','100043465'],['Escobar Domínguez Josué Gabriel','100045009'],['Gómez Delgado Ades Yasir','100046136'],['González Guerrero Diego Enrique','100043425'],['Peña Morales José Manuel','100047221'],['Pérez Hernández Alan Eduardo','100046111']];
fs.writeFileSync(path.join(DIR,'portada-integrador.html'), `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: Letter; margin: 0 } body { margin:0; font-family: Arial, Helvetica, sans-serif; color:#111 }
.pg { position: relative; width: 8.5in; height: 11in; overflow: hidden }
.fondo { position:absolute; inset:0; width:100%; height:100% }
.escudo { position:absolute; left:.5in; top:.55in; width:1.4in } .jaguar { position:absolute; left:.47in; top:9.5in; width:1.27in }
.uni { position:absolute; left:4.45in; top:.28in; width:3.9in; font-size:23pt; font-weight:700; line-height:1.12 }
.lema { font-size:11pt; font-style:italic; margin-top:8px; padding-left:.08in }
.datos { position:absolute; left:1.45in; top:2.05in; width:6.7in; text-align:center; font-size:11.5pt; line-height:1.55 }
.datos p { margin:0 0 12px }
</style></head><body><div class="pg">
<svg class="fondo" viewBox="0 0 850 1100" preserveAspectRatio="none"><rect width="850" height="1100" fill="${NAVY}"/>
<path d="M850,0 L408,0 C420,40 432,120 428,150 C420,185 395,190 330,190 L210,190 Q108,190 108,292 L108,1100 L850,1100 Z" fill="#fff"/>
<path d="M185,1100 C200,1030 300,1022 520,1026 C700,1030 820,1050 850,1100 Z" fill="${NAVY}"/>
<circle cx="120" cy="125" r="96" fill="#fff"/><circle cx="110" cy="1015" r="78" fill="#fff"/></svg>
<img class="escudo" src="${img('unach.png')}"><img class="jaguar" src="${img('jaguar.png')}">
<div class="uni">Benemérita Universidad<br>Autónoma de Chiapas<div class="lema">Por La Conciencia De La Necesidad De Servir</div></div>
<div class="datos">
<p><b>FACULTAD y LICENCIATURA:</b><br>Escuela de Tecnologías Digitales Aplicadas, Campus I<br>(Ingeniería en Desarrollo y Tecnologías de Software)</p>
<p><b>NOMBRE DEL PROYECTO:</b><br><b style="color:${NAVY}">SUSAN</b> · Sistema Universitario de Seguimiento y Análisis de Asistencia</p>
<p><b>NOMBRE DE LA ACTIVIDAD:</b><br>Informe del Proyecto Integrador</p>
<p><b>INTEGRANTES DEL EQUIPO (MATRÍCULA):</b><br>${INT.map(([n,m])=>`${n} (${m})`).join('<br>')}</p>

<p><b>SEMESTRE:</b> 3° <b>| GRADO:</b> “N”</p>

<p><b>FECHA Y LUGAR DE ENTREGA:</b><br>Noviembre, 2026. Tuxtla Gutiérrez, Chiapas, México</p>
</div></div></body></html>`);
