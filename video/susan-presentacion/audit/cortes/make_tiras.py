#!/usr/bin/env python3
"""Genera hojas de contacto de las 11 transiciones (15 fps, -0.6s/+0.6s) y de los tramos internos (4 fps).
Uso: python3 make_tiras.py   (lee renders/video.mp4; escribe en audit/cortes/tiras/)"""
import subprocess, os, glob, shutil, json
from PIL import Image, ImageDraw, ImageFont
ROOT='/Users/diegoguerrero/Developer/SUSAN/video/susan-presentacion'
VID=f'{ROOT}/renders/video.mp4'
OUT=f'{ROOT}/audit/cortes/tiras'
TMP='/private/tmp/claude-501/-Users-diegoguerrero-Desktop-SUSAN/b557fc0b-bc6d-41ed-af52-b641a6e29ef1/scratchpad/cortes'
os.makedirs(TMP,exist_ok=True)
FONT=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',20)
# (de, a, inicio, duracion, tipo)
TR=[(1,2,4.5,0.4,'zoom-through'),(2,3,9.0,0.5,'crossfade'),(3,4,13.0,0.6,'blur-crossfade'),(4,5,17.5,0.4,'zoom-through'),
    (5,6,23.5,0.5,'push LEFT'),(6,7,29.0,0.5,'push LEFT'),(7,8,33.5,0.5,'push LEFT'),(8,9,37.5,0.6,'blur-crossfade'),
    (9,10,43.5,0.5,'push UP'),(10,11,48.0,0.5,'crossfade'),(11,12,51.5,0.6,'blur-crossfade')]
FR=[(1,0,4.9),(2,4.5,5),(3,9,4.6),(4,13,4.9),(5,17.5,6.5),(6,23.5,6),(7,29,5),(8,33.5,4.6),(9,37.5,6.5),(10,43.5,5),(11,48,4.1),(12,51.5,4.5)]
def extract(t0,t1,fps,tag,w=384,h=216):
    d=f'{TMP}/{tag}'; shutil.rmtree(d,ignore_errors=True); os.makedirs(d)
    subprocess.run(['ffmpeg','-v','error','-ss',f'{t0:.3f}','-t',f'{t1-t0:.3f}','-i',VID,'-vf',f'fps={fps},scale={w}:{h}',f'{d}/f_%04d.png'],check=True)
    return sorted(glob.glob(f'{d}/f_*.png'))
def sheet(files,t0,fps,path,cols,marks=None,w=384,h=216,title=''):
    rows=(len(files)+cols-1)//cols
    S=Image.new('RGB',(cols*w,rows*h+(28 if title else 0)),(30,30,30))
    off=28 if title else 0
    d=ImageDraw.Draw(S)
    if title: d.text((6,3),title,fill=(255,255,255),font=FONT)
    for i,f in enumerate(files):
        im=Image.open(f).convert('RGB'); x=(i%cols)*w; y=(i//cols)*h+off
        S.paste(im,(x,y)); t=t0+i/fps
        col=(255,255,255)
        if marks:
            col=(255,80,80) if marks[0]<=t<marks[1]-1e-6 else (255,255,255)
        d.rectangle([x,y,x+98,y+24],fill=(0,0,0)); d.text((x+4,y+1),f'{t:6.2f}s',fill=col,font=FONT)
        d.rectangle([x,y,x+w-1,y+h-1],outline=(70,70,70))
    S.save(path,quality=88)
if __name__=='__main__':
    for a,b,t,dur,ty in TR:
        t0=max(0,t-0.6); t1=t+dur+0.6
        fs=extract(t0,t1,15,f'tr{a:02d}')
        sheet(fs,t0,15,f'{OUT}/{a:02d}-a-{b:02d}.jpg',5,marks=(t,t+dur),title=f'{a:02d} -> {b:02d}  {ty}  T={t}s dur={dur}s  (rojo = dentro de la transicion, 15 fps)')
    for n,s,d in FR:
        t0=s; t1=min(56,s+d)
        fs=extract(t0,t1,4,f'in{n:02d}')
        sheet(fs,t0,4,f'{OUT}/internos-{n:02d}.jpg',5,title=f'cuadro {n:02d}  {s}s -> {t1:.2f}s  (4 fps, cada tile = 0.25 s)')
    print('ok')
