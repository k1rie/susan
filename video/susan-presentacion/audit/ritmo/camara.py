#!/usr/bin/env python3
"""Inventario de camara (leido del codigo de cada cuadro) y huecos sin movimiento perceptible.
Perceptible = velocidad pico >= 3 %/s de escala (o traslacion fuerte) o transicion con movimiento (zoom-through / push-slide).
vel. pico = media * factor de la curva (power2.out/inOut=2, power3.inOut=2.5, power3.out=3, sine.inOut=1.57, none/power1=1..1.5)"""
import json
ST = {1: 0, 2: 4.5, 3: 9, 4: 13, 5: 17.5, 6: 23.5, 7: 29, 8: 33.5, 9: 37.5, 10: 43.5, 11: 48, 12: 51.5}
FACT = {'none': 1, 'power1.inOut': 1.5, 'power1.out': 2, 'power2.out': 2, 'power2.inOut': 2, 'power3.inOut': 2.5, 'sine.out': 1.57, 'sine.inOut': 1.57}
# (cuadro, objetivo, inicio_rel, dur, escala_de, escala_a, ease, extra)
CAM = [
 (2, 'cam', 0.0, 1.4, 1.0, 1.012, 'none', ''), (2, 'cam', 1.4, 1.6, 1.012, 1.04, 'power2.out', 'camin x 0->-44 px'), (2, 'cam', 3.0, 1.5, 1.04, 1.05, 'power2.inOut', 'camin x -44->10'),
 (3, 'stage', 0.0, 4.0, 1.0, 1.02, 'none', ''),
 (4, 'drift', 0.0, 3.8, 1.12, 1.0, 'power2.out', 'retroceso (zoom-out)'),
 (5, 'world', 3.4, 1.6, 1.0, 1.06, 'power2.inOut', 'cam y 143->0 en 3.7-4.3'),
 (6, 'cam-outer', 0.9, 2.3, 1.0, 1.025, 'sine.out', ''), (6, 'cam-outer', 3.2, 1.3, 1.025, 1.6, 'power3.inOut', 'inner x-132 y-140'), (6, 'cam-outer', 4.5, 1.0, 1.6, 1.64, 'sine.inOut', ''),
 (7, 'stage', 1.0, 0.9, 1.0, 1.1, 'power2.inOut', 'origen en el boton'), (7, 'stage', 3.2, 0.5, 1.1, 1.0, 'power2.inOut', 'retroceso + y -76'),
 (8, 'world', 0.0, 2.2, 1.0, 1.02, 'power1.inOut', ''), (8, 'world', 2.2, 1.15, 1.02, 1.1, 'power2.inOut', ''),
 (9, 'cam', 0.0, 3.3, 1.0, 1.02, 'power1.inOut', ''), (9, 'cam', 3.3, 1.4, 1.02, 1.065, 'power2.inOut', ''), (9, 'cam', 4.7, 1.3, 1.065, 1.05, 'power1.out', ''),
 (10, 'cam', 1.0, 0.9, 1.0, 1.28, 'power2.inOut', 'y 0->52'), (10, 'cam', 1.9, 1.0, 1.28, 1.30, 'sine.inOut', ''), (10, 'cam', 2.9, 0.6, 1.30, 1.0, 'power2.inOut', 'retroceso'),
 (11, 'stage', 0.0, 3.0, 1.0, 1.03, 'sine.inOut', ''),
 (12, 'lockup', 1.76, 2.7, 1.0, 1.028, 'none', ''),
]
rows = []; perc = []
for f, tg, s, d, a, b, e, x in CAM:
    avg = abs(b - a) * 100 / d; peak = avg * FACT[e]
    dx = abs(b - a) * 100
    r = {'frame': f, 'target': tg, 'abs_start': round(ST[f] + s, 2), 'abs_end': round(ST[f] + s + d, 2), 'rel': f'{s}-{round(s + d, 2)}', 'scale': f'{a}->{b}', 'delta_pct': round((b - a) * 100, 1),
         'dur': d, 'ease': e, 'avg_pct_per_s': round(avg, 1), 'peak_pct_per_s': round(peak, 1), 'edge_px_per_s_peak': round(peak / 100 * 960), 'perceptible': peak >= 3 and dx >= 2.5, 'note': x}
    rows.append(r)
    if r['perceptible']:
        end = r['abs_end']
        if f == 4 and e == 'power2.out': end = r['abs_start'] + 2.0   # la curva decae: solo >= 3 %/s en los primeros ~2.0 s
        perc.append((r['abs_start'], end, f'F{f} {tg} {a}->{b}'))
# transiciones con movimiento
for t0, d, n in [(4.5, .4, 'zoom-through 1>2'), (17.5, .4, 'zoom-through 4>5'), (23.5, .5, 'push L 5>6'), (29, .5, 'push L 6>7'), (33.5, .5, 'push L 7>8'), (43.5, .5, 'push UP 9>10')]:
    perc.append((t0, t0 + d, n))
perc.sort()
gaps = []; prev = 0.0
for s, e, n in perc:
    if s > prev: gaps.append({'from': round(prev, 2), 'to': round(s, 2), 'gap': round(s - prev, 2)})
    prev = max(prev, e)
gaps.append({'from': round(prev, 2), 'to': 56.0, 'gap': round(56 - prev, 2)})
json.dump({'camera': rows, 'perceptible_moves': [{'t0': s, 't1': e, 'what': n} for s, e, n in perc], 'gaps_without_camera': sorted(gaps, key=lambda g: -g['gap'])}, open('camara.json', 'w'), indent=1)
for r in rows: print(r)
print('--- perceptibles'); [print(p) for p in perc]
print('--- huecos'); [print(g) for g in sorted(gaps, key=lambda g: -g['gap'])]
