#!/usr/bin/env python3
"""Verificador de sincronia sobre el MP4 RENDERIZADO (portado de la v3: video/susan-presentacion/scripts/verify-sfx-sync.py).

Cambios de la v4: lee el manifiesto que le pasa verify-sfx.mjs (datos/sfx-efectivo.json: los volumenes REALES del HTML, con ducking) y
admite entradas con "verificar": false (la voz montada): se suman a la mezcla ideal para restarlas del render, pero no se miden. La
ganancia del render se estima por separado para los SFX y para ese fondo (minimos cuadrados con dos columnas), asi un nivel de voz
distinto al esperado (p. ej. el reparto mono -> estereo del motor) no ensucia el residuo de cada cue.

Que mide: para cada <audio> montado, en que instante cae REALMENTE su golpe en el audio del MP4 y cuanto se aparta de `tCue`
(el instante visual derivado de la etiqueta del tween).
Metodo : la mezcla del motor es una SUMA LINEAL de los <audio>, asi que 1) se reconstruye la mezcla ideal (cada cue con su ancla en tCue, su volumen
            y el recorte de data-media-start / data-duration) y se estima la ganancia global g del render (regresion; ~1.0);
            2) para cada cue i se le RESTA al render todo lo demas (render - g*(ideal - ideal_i)): queda el cue aislado + ruido del codec AAC, de modo
            que un golpe quedo bajo una cola tonal fuerte (p. ej. un tecleo sobre un chime) se mide igual que uno solo;
            3) de ese residuo se calcula la FUERZA DE ATAQUE (subida positiva de la envolvente RMS de 2 ms: un golpe produce flujo) y se
            correlaciona (FFT) con la plantilla del cue [ancla-15 ms, ancla+90 ms] (whoosh/swipe: la subida hasta su pico) SOLO dentro de
            +-(tolerancia + 15 ms) alrededor de tCue; el pico se interpola (parabola) -> resolucion << 1 muestra.
            error = desfase del pico (ms; + = el render suena tarde respecto a tCue).
Falla  : si |error| > tolerancia (33.3 ms = 1 fotograma a 30 fps), o la amplitud ajustada < 0.5 (golpe ausente) o > 2.0 (no es este golpe: un
         residuo sucio que solo se le parece), o la correlacion normalizada < 0.45 (la forma no coincide). Un cue declarado mas tarde/temprano que su sonido cae fuera de la ventana de busqueda y FALLA.
Banda  : el residuo lleva el ruido del codec AAC de los cues vecinos, y en una escala de ping-notes (polifonia 4: cada nota dura 450 ms y suena
         bajo las 3-4 siguientes) ese ruido, repartido por todo el espectro, vale ~la mitad del propio golpe: la correlacion de banda ancha cae
         a 0.4 aunque el cue este exactamente en su sitio (05-camara-8: rho 0.41, ganancia 0.21, error 0.001 ms). Por eso un cue TONAL (>= 50 % de
         la energia de [ancla-15, ancla+90 ms] a +-12 % de su frecuencia dominante f0 >= 400 Hz) cuyo sonido se solapa con el de otros cues
         (algun vecino audible a +-120 ms de su ataque) si falla a banda completa se re-mide en SU BANDA: residuo y plantilla se filtran a [0.88, 1.12] x f0
         (Butterworth 4 orden, fase cero) antes del flujo. El ruido de las notas vecinas, con otro tono, cae fuera de la banda (en 05-camara-8
         el ruido pasa de 0.012 a 0.0007 RMS con el cue en 0.022). Se mide primero a banda completa; si
         pasa, ese es el resultado; si no pasa, se repite en banda y DECIDE la banda, con un criterio mas estricto que el de banda ancha
         (correlacion >= 0.70 y amplitud en [0.6, 1.6]: en la banda limpia un golpe real da ~0.99 y ~1.0). Falla solo si el golpe de verdad no esta donde
         dice tCue: un cue desplazado 80 ms falla tambien en banda, su golpe real queda fuera de la ventana de busqueda; y si TODOS los cues estan
         corridos, el residuo de cada uno lleva los golpes vecinos sin restar y la amplitud sale absurda (x15-x200), lo que tambien lo hace fallar. La columna 'modo' del JSON dice cual decidio ('correlacion-banda NNNN Hz').
Estatico: risers y 'zoom-in' (anclaje 'fin', rampa sin transiente) y cues sin ventana de analisis (pegados al inicio del video) se verifican por
         aritmetica de montaje (dataStart + ancla - mediaStart == tCue +-1 ms); el impacto que acompana al riser SI se mide.
Uso    : python3 scripts/verify-sfx-sync.py datos/sfx-efectivo.json renders/video.mp4 [--root <proyecto>] [--tol-ms 33.3] [--objetivo-ms 5] [--out datos/verify-sfx-sync.json]
         (lo llama verify-sfx.mjs --video; necesita numpy y scipy: pip install --user numpy scipy)
Salida : tabla por cue, resumen y codigo de salida 1 si algun cue falla.
"""
import json, os, subprocess, sys
import numpy as np
from scipy.io import wavfile
from scipy.signal import fftconvolve

SR = 48000
def arg(n, d=None):
    return sys.argv[sys.argv.index(n) + 1] if n in sys.argv else d
if len(sys.argv) < 3:
    print(__doc__); sys.exit(2)
mounted_path, mp4 = sys.argv[1], sys.argv[2]
root = os.path.abspath(arg('--root', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')))
tol = float(arg('--tol-ms', 1000 / 30))
objetivo = float(arg('--objetivo-ms', 5))
out_path = arg('--out', os.path.join(os.path.dirname(os.path.abspath(mounted_path)), 'verify-sfx-sync.json'))
man = json.load(open(mounted_path))

def decodificar_mp4(path):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vn', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32).astype(np.float64)

_cache = {}
def wav_mono(ruta):
    """Mismo downmix que ffmpeg al decodificar el MP4 a mono (0.7071 por canal): un archivo dual-mono sale x1.414."""
    if ruta not in _cache:
        sr, d = wavfile.read(os.path.join(root, ruta))
        d = d.astype(np.float64) / 32768.0 if d.dtype == np.int16 else d.astype(np.float64)
        if d.ndim > 1: d = d.sum(axis=1) * np.sqrt(0.5)
        if sr != SR: raise SystemExit(f'{ruta}: {sr} Hz (se esperaban {SR})')
        _cache[ruta] = d
    return _cache[ruta]

render = decodificar_mp4(mp4)
n = len(render)

def colocar(c, a, b):
    """Muestras [a, b) del cue c aislado (ancla en tCue, volumen y recorte del montaje)."""
    w = wav_mono(c['file'])
    lo = int(round(c['mediaStart'] * SR)); hi = min(len(w), int(round((c['mediaStart'] + c['dataDuration']) * SR)))
    pos0 = int(round((c['tCue'] - (c['ancla'] - c['mediaStart'])) * SR)) - lo        # indice de render que corresponde a la muestra 0 del archivo
    out = np.zeros(b - a)
    i0, i1 = max(a, pos0 + lo), min(b, pos0 + hi)
    if i1 > i0: out[i0 - a: i1 - a] = w[i0 - pos0: i1 - pos0] * c['volume']
    return out

medibles = [c for c in man['cues'] if c.get('verificar', True)]
fondo_cues = [c for c in man['cues'] if not c.get('verificar', True)]
ideal = np.zeros(n)
for c in medibles:
    ideal += colocar(c, 0, n)
fondo = np.zeros(n)
for c in fondo_cues:
    fondo += colocar(c, 0, n)
if fondo_cues:
    # render ~ g * ideal + gf * fondo (minimos cuadrados): la voz se resta con su propia ganancia
    A = np.array([[np.dot(ideal, ideal), np.dot(ideal, fondo)], [np.dot(ideal, fondo), np.dot(fondo, fondo)]])
    b = np.array([np.dot(render, ideal), np.dot(render, fondo)])
    g, gf = (float(x) for x in np.linalg.solve(A + np.eye(2) * 1e-12, b))
    render = render - gf * fondo
    print(f'fondo (voz): {len(fondo_cues)} clips restados del render con ganancia {gf:.3f}')
else:
    g = float(np.dot(render, ideal) / max(np.dot(ideal, ideal), 1e-18))
if not (0.5 < g < 2.0):
    print(f'AVISO: ganancia global del render respecto a la mezcla ideal = {g:.3f} (se esperaba ~1.0)')

def flujo(x, ms=2.0):
    w = max(1, int(SR * ms / 1000))
    cs = np.concatenate([[0.0], np.cumsum(x * x)])
    idx = np.arange(len(x))
    lo, hi = np.clip(idx - w // 2, 0, len(x)), np.clip(idx + w // 2 + 1, 0, len(x))
    env = np.sqrt((cs[hi] - cs[lo]) / np.maximum(hi - lo, 1))
    return np.maximum(np.diff(env, prepend=env[0]), 0)

from scipy.signal import butter, sosfiltfilt

VECINO_S = 0.120          # un cue audible a +-120 ms del ataque aporta su ruido de codec al residuo
TONAL_MIN = 0.50          # fraccion de energia del ataque dentro de la banda de la nota para considerarlo tonal
F0_MIN = 400.0            # por debajo de 400 Hz la banda (+-12 %) tiene tan poca resolucion temporal que no aporta
BANDA = (0.88, 1.12)      # +-12 % de la frecuencia dominante
GAN_MIN, GAN_MAX = 0.5, 2.0   # amplitud ajustada: 1.0 = el golpe suena como se espera; > 2 es otra cosa (un residuo sucio) que se parece a la plantilla
RHO_BANDA_MIN = 0.70      # el rescate en banda es mas exigente: en la banda limpia un golpe de verdad correlaciona ~0.99
GAN_BANDA = (0.6, 1.6)

def aprueba(err, rho, gan, rescate=False):
    if rescate:
        return bool(abs(err) <= tol and rho >= RHO_BANDA_MIN and GAN_BANDA[0] <= gan <= GAN_BANDA[1])
    return bool(abs(err) <= tol and rho >= 0.45 and GAN_MIN <= gan <= GAN_MAX)
PAD_FILTRO = int(0.05 * SR)

def tonalidad(x):
    """(f0, fraccion) del ataque x: frecuencia dominante (> 150 Hz) y energia dentro de BANDA respecto al total."""
    if len(x) < 64 or np.max(np.abs(x)) < 1e-7: return 0.0, 0.0
    N = 1 << 16
    X = np.abs(np.fft.rfft(x * np.hanning(len(x)), N)) ** 2
    f = np.fft.rfftfreq(N, 1 / SR)
    X[f < 150] = 0
    if X.sum() <= 0: return 0.0, 0.0
    f0 = float(f[int(np.argmax(X))])
    return f0, float(X[(f >= f0 * BANDA[0]) & (f <= f0 * BANDA[1])].sum() / X.sum())

def en_banda(x, f0):
    sos = butter(4, [f0 * BANDA[0], min(f0 * BANDA[1], 0.45 * SR)], btype='band', fs=SR, output='sos')
    return sosfiltfilt(sos, x)

def correlacionar(c, a0, L, V, pad, p0, p1, e0, e1, f0):
    """Correlacion de ataque del cue c contra el render en [e0, e1). f0=None: banda completa; f0=Hz: solo la banda de esa nota.
    Devuelve (error ms, rho, ganancia, lag s) o None si la plantilla no tiene ataque medible."""
    q0, q1 = max(0, p0 - PAD_FILTRO), min(n, p1 + PAD_FILTRO)       # margen: el filtro de banda no debe meter transitorios en los bordes
    aislado = colocar(c, q0, q1)
    residuo = render[q0:q1] - g * (ideal[q0:q1] - aislado)           # el render sin los demas cues
    o = p0 - q0
    aislado = g * aislado                                            # plantilla: el cue aislado con la ganancia del render
    ms = 2.0
    if f0:
        residuo, aislado = en_banda(residuo, f0), en_banda(aislado, f0)
        ms = max(2.0, 2500.0 / f0)                                   # el flujo necesita ~2.5 periodos para no rizar con tonos graves
    seg = flujo(residuo, ms)[o + pad: o + pad + (e1 - e0)]
    tpl = flujo(aislado, ms)[o + pad + V: o + pad + V + L]
    if tpl.max() < 1e-7:
        return None
    cc = fftconvolve(seg, tpl[::-1], mode='valid')                  # cc[k]: plantilla colocada en seg[k:k+L]
    cs = np.concatenate([[0.0], np.cumsum(seg * seg)])
    en = np.sqrt(np.maximum(cs[L:L + len(cc)] - cs[:len(cc)], 0) * np.sum(tpl * tpl)) + 1e-18
    nc = cc / en
    amp = cc / np.sum(tpl * tpl)                                    # amplitud ajustada: 1.0 = el golpe suena como se espera
    k = int(np.argmax(amp * (nc > 0.3)))                            # pico de la amplitud entre las posiciones con forma parecida
    y0, y1, y2 = amp[max(k - 1, 0)], amp[k], amp[min(k + 1, len(amp) - 1)]
    den = y0 - 2 * y1 + y2
    d = max(-1.0, min(1.0, 0.5 * (y0 - y2) / den if den != 0 else 0.0))
    lag = (k + d - V) / SR                                          # desfase del render respecto a tCue (k = V <=> sin desfase)
    return float(lag * 1000), float(nc[k]), float(amp[k]), float(lag)

filas, fallos = [], 0
print(f"ganancia global del render respecto a la mezcla ideal: {g:.3f}")
print(f"{'cue':26s} {'archivo':26s} {'tCue':>8s} {'medido':>8s} {'error ms':>9s} {'rho':>5s} {'gan':>5s}  estado")
for c in medibles:
    nombre = os.path.basename(c['file'])
    t = c['tCue']
    aritm_ms = (c['dataStart'] + c['ancla'] - c['mediaStart'] - t) * 1000
    fila = {'id': c['id'], 'file': c['file'], 'tCue': t, 'anclaje': c.get('anclaje')}
    def estatico(motivo, modo):
        global fallos
        ok = abs(aritm_ms) <= 1.0 + 1e-6
        fallos += (not ok)
        fila.update(modo=modo, errorMs=round(aritm_ms, 3), ok=ok)
        print(f"{c['id'][:26]:26s} {nombre:26s} {t:8.3f} {'-':>8s} {aritm_ms:9.2f} {'-':>5s} {'-':>5s}  {('OK (estatico: ' + motivo + ')') if ok else 'FALLA (estatico)'}")
        filas.append(fila)
    if c.get('anclaje') == 'fin':
        estatico('anclaje fin', 'estatico'); continue
    # ventana de la plantilla segun anclaje
    if c.get('anclaje') == 'pico':
        pre, post = min(c['ancla'], 0.14) + 0.02, 0.04
    else:
        pre, post = 0.015, 0.09
    a0 = int(round((t - pre) * SR)); L = int(round((pre + post) * SR))
    V = int((tol / 1000 + 0.015) * SR)
    e0, e1 = a0 - V, a0 + L + V
    if e0 < 1 or e1 > n:
        estatico('sin ventana de analisis: pegado al inicio/fin del video', 'estatico-sin-ventana'); continue
    pad = int(0.01 * SR)
    p0, p1 = e0 - pad, e1 + pad
    f0, frac = tonalidad(colocar(c, a0, a0 + L))
    vecinos = [o for o in medibles if o is not c and o['tCue'] - o['ancla'] <= t + VECINO_S and o['tCue'] - o['ancla'] + o['dataDuration'] >= t - VECINO_S]
    probar_banda = bool(vecinos) and frac >= TONAL_MIN and f0 >= F0_MIN
    m = correlacionar(c, a0, L, V, pad, p0, p1, e0, e1, None)
    if m is None:
        estatico('sin ataque medible', 'estatico-sin-ataque'); continue
    err, rho, ganancia, lag = m
    ok = aprueba(err, rho, ganancia)
    modo = 'correlacion'
    if probar_banda and not ok:       # solo se rescata lo que la banda ancha no pudo confirmar: lo que ya pasa conserva su medida
        mb = correlacionar(c, a0, L, V, pad, p0, p1, e0, e1, f0)
        if mb is not None:
            errb, rhob, ganb, lagb = mb
            fila['ancho'] = {'errorMs': round(err, 3), 'rho': round(rho, 3), 'ganancia': round(ganancia, 3)}
            err, rho, ganancia, lag = errb, rhob, ganb, lagb       # la banda es la medida mas limpia: decide aunque tambien falle
            ok = aprueba(err, rho, ganancia, rescate=True)
            modo = f'correlacion-banda {f0:.0f} Hz'
    fallos += (not ok)
    fila.update(modo=modo, errorMs=round(err, 3), rho=round(rho, 3), ganancia=round(ganancia, 3), medido=round(t + lag, 4), ok=ok)
    print(f"{c['id'][:26]:26s} {nombre:26s} {t:8.3f} {t + lag:8.3f} {err:9.2f} {rho:5.2f} {ganancia:5.2f}  {'OK' if ok else 'FALLA'}{' [' + modo.split(' ', 1)[1] + ']' if ' ' in modo else ''}")
    filas.append(fila)

med = [f for f in filas if f['modo'].startswith('correlacion')]
ae = np.array([abs(f['errorMs']) for f in med]) if med else np.array([0.0])
resumen = {
    'cues': len(filas), 'medidos': len(med), 'estaticos': len(filas) - len(med), 'fallos': fallos, 'toleranciaMs': round(tol, 3),
    'errorMedioAbsMs': round(float(ae.mean()), 3), 'errorMaxAbsMs': round(float(ae.max()), 3),
    'decididosEnBanda': sum(1 for f in med if f['modo'] != 'correlacion'),
    'dentroObjetivo': int((ae <= objetivo).sum()), 'objetivoMs': objetivo, 'gananciaGlobal': round(g, 3),
}
print(f"\n{len(filas) - fallos}/{len(filas)} cues dentro de +-{tol:.1f} ms  (medidos por correlacion: {len(med)}; error medio {resumen['errorMedioAbsMs']} ms, maximo {resumen['errorMaxAbsMs']} ms; {resumen['dentroObjetivo']}/{len(med)} a <= {objetivo:g} ms)")
json.dump({'resumen': resumen, 'cues': filas}, open(out_path, 'w'), indent=1)
sys.exit(1 if fallos else 0)
