#!/usr/bin/env python3
"""Energia de movimiento de el MP4 de v2 (15 fps, 320x180, gris): diferencia media absoluta entre
fotogramas consecutivos, promediada por cada 0.1 s. Salidas: audit/ritmo/motion-v2.4.json y motion-v2.4.png.
Uso: PYLIB=<ruta con matplotlib> python3 audit/ritmo/motion-v2.py"""
import json, subprocess, sys, os
import numpy as np
P = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(P))
if os.environ.get('PYLIB'): sys.path.insert(0, os.environ['PYLIB'])
VIDEO = sys.argv[1] if len(sys.argv) > 1 else f'{ROOT}/renders/video-v2.2.mp4'   # entrada: el MP4 a medir
W, H, FPS = 320, 180, 15
THR = 0.30      # "lento": < 0.30  (~ un elemento de 56x56 px apareciendo por cada 0.1 s; mediana del video = 0.58)
FROZEN = 0.05   # "congelado"
STARTS = [0, 3.2, 7.35, 10.45, 14.25, 19.05, 22.55, 25.6, 29.25, 33.4, 36.85, 40.05, 45.05]
TOTAL = 45.05
TRANS = {3.2: 'zoom in', 7.35: 'cut', 10.45: 'squeeze', 14.25: 'iris', 19.05: 'match', 22.55: 'flash', 25.6: 'push', 29.25: 'whip', 33.4: 'wipe', 36.85: 'push down', 40.05: 'cut'}
def frame_of(t):
    for i in range(12):
        if STARTS[i] <= t < STARTS[i + 1]: return i + 1
    return 12
raw = subprocess.run(['/opt/homebrew/bin/ffmpeg', '-v', 'error', '-i', VIDEO, '-vf',
    f'fps={FPS},scale={W}:{H},format=gray', '-f', 'rawvideo', '-'], capture_output=True, check=True).stdout
a = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
dd = np.abs(a[1:] - a[:-1])
d = dd.mean(axis=(1, 2)); chg = (dd > 12).mean(axis=(1, 2)) * 100   # % de pixeles que cambian > 12 niveles
t = (np.arange(len(d)) + 1) / FPS
nb = int(np.ceil(t[-1] * 10))
def binned(x):
    s = np.zeros(nb); c = np.zeros(nb)
    for ti, xi in zip(t, x):
        k = min(int((ti - 1e-6) * 10), nb - 1); s[k] += xi; c[k] += 1
    return s / np.maximum(c, 1)
e = binned(d); ch = binned(chg)
# tramos lentos / muertos
runs = []; i = 0
while i < nb:
    if e[i] < THR:
        j = i
        while j < nb and e[j] < THR: j += 1
        runs.append((i / 10, j / 10)); i = j
    else: i += 1
slow = []
for a0, b0 in runs:
    dur = round(b0 - a0, 1)
    if dur >= 0.6:
        f = frame_of(a0 + 1e-6); nxt = STARTS[f]
        slow.append({'t0': a0, 't1': b0, 'dur': dur, 'frame': f, 'rel0': round(a0 - STARTS[f - 1], 1), 'rel1': round(b0 - STARTS[f - 1], 1),
                     'mean_energy': round(float(e[int(a0 * 10):int(b0 * 10)].mean()), 3), 'dead': dur >= 1.0,
                     'frozen_frac': round(float((e[int(a0 * 10):int(b0 * 10)] < FROZEN).mean()), 2),
                     'tail_of_frame': bool(abs(b0 - nxt) <= 0.15 or b0 >= nxt)})
slow_total = sum(s['dur'] for s in slow); dead_total = sum(s['dur'] for s in slow if s['dead'])
# rafagas (eventos de movimiento): tramos con e >= 0.5 separados por >= 0.2 s bajo 0.3
bursts = []; i = 0
while i < nb:
    if e[i] >= 0.5:
        j = i
        while j < nb and (e[j] >= 0.3 or (j + 1 < nb and e[j + 1] >= 0.5) or (j + 2 < nb and e[j + 2] >= 0.5)): j += 1
        bursts.append((i / 10, j / 10, float(e[i:j].max()))); i = j
    else: i += 1
onsets = [b[0] for b in bursts]
from scipy.signal import find_peaks
pk, _ = find_peaks(e, height=0.5, prominence=0.3, distance=2)   # 'eventos visuales nuevos' vistos en el video real
pk_t = pk / 10; pk_gaps = np.diff(pk_t)
gaps = np.diff(onsets)
longest = max(slow, key=lambda s: s['dur']) if slow else None
longest_any = max((round(b0 - a0, 1) for a0, b0 in runs), default=0.0)   # tramo bajo el umbral mas largo aunque dure < 0.6 s
slow_bins_pct = round(100 * float((e < THR).mean()), 1)   # % de ventanas de 0.1 s bajo el umbral (sin minimo de duracion)
per_frame = []
for f in range(1, 13):
    a0, b0 = int(STARTS[f - 1] * 10), int(STARTS[f] * 10)
    seg = e[a0:b0]
    sl = sum(s['dur'] for s in slow if s['frame'] == f)
    per_frame.append({'frame': f, 'dur': STARTS[f] - STARTS[f - 1], 'mean_energy': round(float(seg.mean()), 2), 'median_energy': round(float(np.median(seg)), 2),
                      'slow_s': round(sl, 1), 'slow_pct': round(100 * sl / (STARTS[f] - STARTS[f - 1]), 0),
                      'bursts': sum(1 for o in onsets if STARTS[f - 1] <= o < STARTS[f]), 'visual_events': int(((pk_t >= STARTS[f - 1]) & (pk_t < STARTS[f])).sum())})
out = {'fps': FPS, 'bin_s': 0.1, 'thr_slow': THR, 'frames_starts': STARTS,
       'summary': {'mean': round(float(e.mean()), 3), 'median': round(float(np.median(e)), 3), 'p25': round(float(np.percentile(e, 25)), 3),
                   'slow_total_s': round(slow_total, 1), 'slow_pct': round(100 * slow_total / TOTAL, 1), 'dead_total_s': round(dead_total, 1),
                   'dead_pct': round(100 * dead_total / TOTAL, 1), 'longest_slow': longest, 'longest_run_below_thr_s': longest_any, 'slow_bins_pct': slow_bins_pct, 'n_runs_below_thr': len(runs), 'bursts': len(bursts),
                   'mean_interval_between_bursts_s': round(float(gaps.mean()), 2), 'median_interval_s': round(float(np.median(gaps)), 2),
                   'max_interval_s': round(float(gaps.max()), 2),
                   'visual_events': len(pk_t), 'visual_event_mean_interval_s': round(float(pk_gaps.mean()), 2),
                   'visual_event_median_interval_s': round(float(np.median(pk_gaps)), 2), 'visual_event_max_interval_s': round(float(pk_gaps.max()), 2),
                   'visual_event_max_interval_at': [float(pk_t[pk_gaps.argmax()]), float(pk_t[pk_gaps.argmax() + 1])]},
       'slow_runs': slow, 'per_frame': per_frame, 'bursts_onsets': [round(o, 1) for o in onsets], 'visual_event_times': [float(x) for x in pk_t],
       'energy_per_0.1s': [round(float(x), 3) for x in e], 'changed_px_pct_per_0.1s': [round(float(x), 2) for x in ch],
       'diff_per_frame': [round(float(x), 3) for x in d]}
json.dump(out, open(f'{P}/motion-v2.4.json', 'w'))
print(json.dumps(out['summary'], indent=1)); print(json.dumps(per_frame))
for s in slow: print(s)
# grafica
try:
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    fig, ax = plt.subplots(2, 1, figsize=(20, 7.5), gridspec_kw={'height_ratios': [3, 1]}, sharex=True)
    x = np.arange(nb) / 10 + 0.05
    ax[0].bar(x, np.minimum(e, 8), width=0.1, color='#0061fe', linewidth=0)
    ax[0].axhline(THR, color='#de4d44', lw=1.2, ls='--'); ax[0].text(0.1, THR + 0.15, f'umbral lento = {THR}', color='#de4d44', fontsize=9)
    for s in slow:
        ax[0].axvspan(s['t0'], s['t1'], color='#de4d44' if s['dead'] else '#f2b34a', alpha=0.28, lw=0)
    for k, v in TRANS.items():
        ax[0].axvline(k, color='#444', lw=0.8); ax[0].text(k + 0.05, 7.4, v, rotation=90, va='top', fontsize=8, color='#444')
    for f in range(12): ax[0].text((STARTS[f] + STARTS[f + 1]) / 2, 7.9, f'F{f + 1}', ha='center', fontsize=11, weight='bold')
    ax[0].set_ylim(0, 8.3); ax[0].set_ylabel('energia (dif. media abs., recortada a 8)')
    ax[0].set_title('SUSAN video-v2.4.mp4 - energia de movimiento por 0.1 s  (rojo = tramo muerto >= 1.0 s, ambar = lento >= 0.6 s)')
    ax[1].bar(x, np.minimum(e, 1.5), width=0.1, color='#0061fe', linewidth=0); ax[1].axhline(THR, color='#de4d44', lw=1.2, ls='--')
    for s in slow: ax[1].axvspan(s['t0'], s['t1'], color='#de4d44' if s['dead'] else '#f2b34a', alpha=0.28, lw=0)
    for k in TRANS: ax[1].axvline(k, color='#444', lw=0.8)
    ax[1].set_ylim(0, 1.5); ax[1].set_ylabel('zoom 0-1.5'); ax[1].set_xlabel('segundos'); ax[1].set_xticks(range(0, 46, 2)); ax[1].set_xlim(0, TOTAL)
    plt.tight_layout(); plt.savefig(f'{P}/motion-v2.4.png', dpi=75)
except Exception as ex:
    print('sin matplotlib:', ex)
