#!/usr/bin/env python3
"""Metricas por fotograma de renders/video.mp4 a 30 fps (480x270, gris): diferencia con el fotograma anterior,
luminancia media y contraste (desv. estandar). Sirve para localizar parpadeos, huecos y zonas de quietud."""
import subprocess, numpy as np, json, sys
ROOT='/Users/diegoguerrero/Developer/SUSAN/video/susan-presentacion'
W,H=480,270
p=subprocess.run(['ffmpeg','-v','error','-i',f'{ROOT}/renders/video.mp4','-vf',f'fps=30,scale={W}:{H},format=gray','-f','rawvideo','-'],capture_output=True)
a=np.frombuffer(p.stdout,dtype=np.uint8).reshape(-1,H,W).astype(np.float32)
n=len(a); print('frames',n)
diff=np.zeros(n); diff[1:]=np.abs(a[1:]-a[:-1]).mean(axis=(1,2))
mean=a.mean(axis=(1,2)); std=a.std(axis=(1,2))
np.save('/private/tmp/claude-501/-Users-diegoguerrero-Desktop-SUSAN/b557fc0b-bc6d-41ed-af52-b641a6e29ef1/scratchpad/cortes/diff.npy',diff)
np.save('/private/tmp/claude-501/-Users-diegoguerrero-Desktop-SUSAN/b557fc0b-bc6d-41ed-af52-b641a6e29ef1/scratchpad/cortes/gray.npy',a.astype(np.uint8))
json.dump({'diff':diff.tolist(),'mean':mean.tolist(),'std':std.tolist()},open(f'{ROOT}/audit/cortes/metricas.json','w'))
TR=[(1,2,4.5,0.4),(2,3,9.0,0.5),(3,4,13.0,0.6),(4,5,17.5,0.4),(5,6,23.5,0.5),(6,7,29.0,0.5),(7,8,33.5,0.5),(8,9,37.5,0.6),(9,10,43.5,0.5),(10,11,48.0,0.5),(11,12,51.5,0.6)]
print('transicion | dif max dentro | dif media dentro | dif media 0.5s antes | contraste min dentro | contraste medio antes')
for a_,b_,t,d in TR:
    i0=int(round(t*30)); i1=int(round((t+d)*30))
    inn=diff[i0:i1+1]; bef=diff[max(1,i0-15):i0]
    print(f'{a_:02d}->{b_:02d} t={t} | {inn.max():.2f} @{(i0+inn.argmax())/30:.2f}s | {inn.mean():.2f} | {bef.mean():.2f} | {std[i0:i1+1].min():.1f} @{(i0+std[i0:i1+1].argmin())/30:.2f}s | {std[max(0,i0-15):i0].mean():.1f}')
