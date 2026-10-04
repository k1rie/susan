#!/usr/bin/env python3
"""VERIFICADOR v2 (prototipo): mide en el MP4 renderizado dónde cae realmente el golpe de cada cue y lo compara con el instante visual.

Entrada : sfx-mounted.json (lo escribe mount-sfx-v2.mjs: por cue {t, archivo, vol, ancla, dataStart, mediaStart}) y el MP4.
Método  : por cue, plantilla = fuerza de ataque (subida de la envolvente RMS de 2 ms) del fragmento del archivo [ancla-15 ms, ancla+90 ms]; se correlaciona (FFT) contra la del audio del MP4
          en [t-tol-15 ms, t+tol+15 ms] y se toma el pico (interpolación parabólica) -> golpeMedido.  error = golpeMedido - t.
Falla   : si |error| > TOL (por defecto 33.3 ms = 1 fotograma a 30 fps) o si la correlación normalizada < 0.6 (golpe ausente/enterrado).
Salida  : tabla por cue + resumen; código de salida 1 si algún cue falla (apto para CI).
Uso     : python3 verify-sfx-sync.py sfx-mounted.json video.mp4 [--tol-ms 33.3]
"""
import json, subprocess, sys
import numpy as np
from scipy.signal import fftconvolve
SR = 48000
man = json.load(open(sys.argv[1])); mp4 = sys.argv[2]
tol = float(sys.argv[sys.argv.index('--tol-ms') + 1]) if '--tol-ms' in sys.argv else 1000 / 30 + 0.0
def dec(path):
    return np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vn', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout, dtype=np.float32).astype(float)
render = dec(mp4)
def flujo(x, ms=2.0):
    # fuerza de ataque: subida positiva de la envolvente (RMS móvil de 2 ms). Una cola tonal que decae NO produce flujo; un golpe sí.
    w = max(1, int(SR * ms / 1000))
    env = np.sqrt(np.convolve(x ** 2, np.ones(w) / w, mode='same'))
    d = np.diff(env, prepend=env[0])
    return np.maximum(d, 0)
FR = flujo(render)
lib = man['libreria']
fallos = 0
print(f"{'cue':8s} {'archivo':20s} {'t visual':>9s} {'medido':>9s} {'error ms':>9s} {'rho':>5s}  estado")
for c in man['cues']:
    # verificación ESTÁTICA (aritmética de montaje) para lo que no tiene ataque medible: risers (rampa sin transiente; su fin se ancla al
    # impacto, que sí se verifica) y cues pegados al inicio del render (t < 50 ms: el flujo no tiene historia previa)
    if c['archivo'].startswith('riser') or c['t'] < 0.05:
        esperado_ms = (c['dataStart'] + c['ancla'] - c.get('mediaStart', 0) - c['t']) * 1000
        ok = abs(esperado_ms) <= tol
        fallos += (not ok)
        print(f"{c['id']:8s} {c['archivo']:20s} {c['t']:9.3f} {'—':>9s} {esperado_ms:9.2f} {'—':>5s}  {'OK (estático)' if ok else 'FALLA (estático)'}")
        continue
    x = dec(f"{lib}/{c['archivo']}") * c['vol']
    a0 = int(max(0, c['ancla'] - 0.015, c.get('mediaStart', 0)) * SR); a1 = int((c['ancla'] + 0.09) * SR)
    tpl = flujo(x[a0:a1 + int(0.02 * SR)])[: a1 - a0]
    VENT = tol / 1000 + 0.015  # solo se busca dentro de la tolerancia (+15 ms): un golpe fuera de ella NO se 'encuentra' en otro sitio
    e0 = max(0, int((c['t'] - VENT) * SR)); e1 = int((c['t'] + VENT + (c['ancla'] - a0 / SR) + 0.105) * SR)
    seg = FR[e0:e1]
    cc = fftconvolve(seg, tpl[::-1], mode='valid')
    ac = np.abs(cc)
    # picos locales fuertes (>= 50 % del máximo); se elige el MÁS CERCANO al instante visual (dos usos del mismo archivo en la ventana no se confunden)
    cand = [i for i in range(1, len(ac) - 1) if ac[i] >= ac[i - 1] and ac[i] >= ac[i + 1] and ac[i] >= 0.5 * ac.max()] or [int(np.argmax(ac))]
    esperado = int(round((c['t'] - (c['ancla'] - a0 / SR)) * SR)) - e0
    k = min(cand, key=lambda i: abs(i - esperado))
    y0, y1, y2 = abs(cc[max(k - 1, 0)]), abs(cc[k]), abs(cc[min(k + 1, len(cc) - 1)])
    d = 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2) if (y0 - 2 * y1 + y2) != 0 else 0
    # el inicio de la plantilla (ancla-15 ms) está en seg[k+d]; el golpe está 15 ms después
    t_inicio_tpl = (e0 + k + d) / SR
    golpe = t_inicio_tpl + (c['ancla'] - (a0 / SR))
    rho = float(abs(cc[k]) / (np.sqrt(np.sum(tpl ** 2) * np.sum(seg[k:k + len(tpl)] ** 2)) + 1e-12))  # correlación del FLUJO de energía (ataque)
    err = (golpe - c['t']) * 1000
    ok = abs(err) <= tol and rho >= 0.6
    fallos += (not ok)
    print(f"{c['id']:8s} {c['archivo']:20s} {c['t']:9.3f} {golpe:9.3f} {err:9.2f} {rho:5.2f}  {'OK' if ok else 'FALLA'}")
print(f"\n{len(man['cues']) - fallos}/{len(man['cues'])} cues dentro de ±{tol:.1f} ms")
sys.exit(1 if fallos else 0)
