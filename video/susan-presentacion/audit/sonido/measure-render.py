#!/usr/bin/env python3
"""Mide el desfase REAL del audio de renders/video.mp4 frente al montaje esperado de index.html.

Modelo: cada <audio> se decodifica con ffmpeg (mono, 48 kHz), se recorta a data-duration, se multiplica por data-volume y se coloca en
data-start; la suma es el "mix ideal". Se decodifica el audio del MP4 (AAC) a mono 48 kHz y se calcula:
  1. desfase GLOBAL: correlación cruzada (FFT) mix ideal vs render sobre toda la pista;
  2. desfase POR CUE: correlación cruzada de la señal aislada de cada cue contra la ventana del render, +-150 ms; solo se confía en
     las ventanas "puras" (>= 70 % de la energía del modelo en la ventana pertenece a ese cue) y con correlación >= 0.6.
lag > 0  => el audio del render llega TARDE respecto al modelo.
Uso: python3 audit/sonido/measure-render.py [ruta-al-mp4]   -> escribe audit/sonido/render-offset.json
"""
import json, subprocess, sys, os
import numpy as np
from scipy.signal import fftconvolve

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
MP4 = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'renders/video.mp4')
SR = 48000


def decodificar(ruta, extra=None):
    cmd = ['ffmpeg', '-v', 'error', '-i', ruta, '-vn', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, dtype=np.float32).astype(np.float64)


cues = json.load(open(os.path.join(RAIZ, 'audit/sonido/cues.json')))['filas']
render = decodificar(MP4)
n = len(render)
cache = {}
modelo = np.zeros(n)
solos = []
for c in cues:
    if c['archivo'] not in cache:
        cache[c['archivo']] = decodificar(os.path.join(RAIZ, 'assets/sfx', c['archivo']))
    x = cache[c['archivo']]
    largo = min(len(x), int(round(c['dataDuration'] * SR)))
    i0 = int(round(c['dataStart'] * SR))
    solo = np.zeros(n)
    seg = x[:largo] * c['volumen']
    seg = seg[: max(0, n - i0)]
    solo[i0:i0 + len(seg)] = seg
    solos.append(solo)
    modelo += solo

# ---- 1) desfase global ----
def xcorr_lag(a, b, max_lag):
    """lag (muestras) con el que b retrasado coincide mejor con a; a=render, b=modelo"""
    c = fftconvolve(a, b[::-1], mode='full')
    mid = len(b) - 1
    lo, hi = mid - max_lag, mid + max_lag + 1
    k = np.argmax(c[lo:hi]) + lo - mid
    num = c[mid + k]
    den = np.sqrt(np.sum(a ** 2) * np.sum(b ** 2)) + 1e-12
    return int(k), float(num / den)

lag_g, rho_g = xcorr_lag(render, modelo, int(0.5 * SR))

# ---- 2) desfase por cue ----
res = []
MAXL = int(0.150 * SR)
for c, solo in zip(cues, solos):
    if c['silencioso']:
        continue
    a = c['dataStart']
    d = min(c['dataDuration'], 1.0)
    w0 = int(max(0, (a - 0.05) * SR)); w1 = int(min(n, (a + d + 0.05) * SR))
    e_cue = np.sum(solo[w0:w1] ** 2)
    e_tot = np.sum(modelo[w0:w1] ** 2) + 1e-12
    pureza = e_cue / e_tot
    # ventana ampliada para permitir el desplazamiento
    v0 = max(0, w0 - MAXL); v1 = min(n, w1 + MAXL)
    r = render[v0:v1]
    m = solo[w0:w1]
    if np.sum(m ** 2) < 1e-9:
        continue
    cc = fftconvolve(r, m[::-1], mode='full')
    # lag 0 corresponde a que m (empezando en w0) coincida con r en r[w0 - v0:]
    centro = len(m) - 1 + (w0 - v0)
    lo = centro - MAXL; hi = centro + MAXL + 1
    lo = max(lo, 0); hi = min(hi, len(cc))
    k = int(np.argmax(cc[lo:hi]) + lo - centro)
    # correlación normalizada en el pico
    s0 = w0 - v0 + k
    if s0 < 0 or s0 + len(m) > len(r):
        continue
    rr = r[s0:s0 + len(m)]
    rho = float(np.dot(rr, m) / (np.sqrt(np.sum(rr ** 2) * np.sum(m ** 2)) + 1e-12))
    full = cache[c['archivo']]
    retenida = float(np.sum(full[:int(round(c['dataDuration'] * SR))] ** 2) / (np.sum(full ** 2) + 1e-12))
    pico_solo = float(20 * np.log10(np.max(np.abs(solo)) + 1e-9))
    rms_render = float(20 * np.log10(np.sqrt(np.mean(render[w0:w1] ** 2)) + 1e-9))
    res.append({'id': c['id'], 'archivo': c['archivo'], 'tipo': c['tipo'], 'lagMs': round(k / SR * 1000, 2), 'rho': round(rho, 3), 'pureza': round(float(pureza), 3),
                'cortado': bool(c['cortadoAntesDelGolpe']), 'energiaRetenidaPct': round(retenida * 100, 1), 'picoSoloDbFS': round(pico_solo, 1), 'rmsRenderVentanaDbFS': round(rms_render, 1)})

confiables = [r for r in res if r['pureza'] >= 0.7 and r['rho'] >= 0.85 and not r['cortado']]
lags = np.array([r['lagMs'] for r in confiables])
salida = {
    'mp4': os.path.relpath(MP4, RAIZ),
    'globalLagMs': round(lag_g / SR * 1000, 2), 'globalRho': round(rho_g, 3),
    'nCuesConfiables': len(confiables), 'nCuesMedidos': len(res),
    'sesgoMedianoMs': round(float(np.median(lags)), 2) if len(lags) else None,
    'mediaMs': round(float(lags.mean()), 2) if len(lags) else None,
    'desvEstandarMs': round(float(lags.std()), 2) if len(lags) else None,
    'minMs': float(lags.min()) if len(lags) else None, 'maxMs': float(lags.max()) if len(lags) else None,
    'p90AbsMs': round(float(np.percentile(np.abs(lags), 90)), 2) if len(lags) else None,
    'picoRenderDbFS': round(float(20 * np.log10(np.max(np.abs(render)) + 1e-9)), 2),
    'muestrasEnSaturacion(>=0.99)': int(np.sum(np.abs(render) >= 0.99)),
    'rmsTotalDbFS': round(float(20 * np.log10(np.sqrt(np.mean(render ** 2)) + 1e-9)), 1),
    'segundosSinSonido(<-60dBFS en ventanas de 100 ms)': round(float(np.mean([20 * np.log10(np.sqrt(np.mean(render[i:i + 4800] ** 2)) + 1e-9) < -60 for i in range(0, n - 4800, 4800)]) * n / SR), 1),
    'cues': res,
}
json.dump(salida, open(os.path.join(RAIZ, 'audit/sonido/render-offset.json'), 'w'), indent=1)
print(json.dumps({k: v for k, v in salida.items() if k != 'cues'}, indent=1))
for r in sorted(confiables, key=lambda r: r['id']):
    print(r['id'].ljust(22), r['archivo'].ljust(18), str(r['lagMs']).rjust(8), 'ms  rho', r['rho'], 'pureza', r['pureza'])
