#!/usr/bin/env python3
"""Hojas de evidencia (fotogramas a 30 fps, 640x360) para los hallazgos concretos del REPORT.md."""
import subprocess, os
from PIL import Image, ImageDraw, ImageFont
ROOT='/Users/diegoguerrero/Developer/SUSAN/video/susan-presentacion'
VID=f'{ROOT}/renders/video.mp4'; OUT=f'{ROOT}/audit/cortes/tiras'
TMP='/private/tmp/claude-501/-Users-diegoguerrero-Desktop-SUSAN/b557fc0b-bc6d-41ed-af52-b641a6e29ef1/scratchpad/cortes'
F=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',22)
def hoja(nombre,ts,titulo,cols=3,w=640,h=360):
    ims=[]
    for t in ts:
        p=f'{TMP}/ev_{t:.3f}.png'
        subprocess.run(['ffmpeg','-v','error','-y','-ss',f'{t:.3f}','-i',VID,'-frames:v','1','-vf',f'scale={w}:{h}',p],check=True)
        ims.append((t,Image.open(p).convert('RGB')))
    rows=(len(ims)+cols-1)//cols
    S=Image.new('RGB',(cols*w,rows*h+30),(30,30,30)); d=ImageDraw.Draw(S); d.text((6,4),titulo,fill=(255,255,255),font=F)
    for i,(t,im) in enumerate(ims):
        x=(i%cols)*w; y=(i//cols)*h+30; S.paste(im,(x,y)); d.rectangle([x,y+h-28,x+120,y+h],fill=(0,0,0)); d.text((x+6,y+h-26),f'{t:.2f}s',fill=(255,255,255),font=F)
    S.save(f'{OUT}/{nombre}',quality=88)
hoja('evidencia-snap-06.jpg',[24.20,24.30,24.37,24.40,24.43,24.50],'05->06: el cuadro 06 entra con camara a 1.6x y SALTA a 1.0x en un solo fotograma (24.37 -> 24.40)')
hoja('evidencia-rectangulo-04-05.jpg',[17.53,17.57,17.63,17.67,17.70,17.77],'04->05 zoom-through: el cuadro entrante (escala 0.5->1) deja ver su borde como rectangulo y la camara oscura tapa SUSAN')
hoja('evidencia-choque-11-12.jpg',[51.63,51.70,51.77,51.83,51.90,51.97],'11->12 blur-crossfade: "Pasa lista en" encima de "Tus datos, bajo control." (texto sobre texto)')
hoja('evidencia-hueco-08-09.jpg',[37.70,37.77,37.83,37.87,37.93,38.00],'08->09 blur-crossfade: ambos cuadros a ~50 % -> el fotograma se lava (contraste 44 -> 6)')
print('ok')
