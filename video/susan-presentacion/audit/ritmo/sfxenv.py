#!/usr/bin/env python3
"""Inicio (10 % del pico) y pico de cada efecto de assets/sfx/*.mp3 (envolvente RMS a 5 ms)."""
import subprocess, glob, os, json, numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
out = {}
for f in sorted(glob.glob(f'{ROOT}/assets/sfx/*.mp3')):
    raw = subprocess.run(['/opt/homebrew/bin/ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', '22050', '-f', 's16le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768; hop = 110
    n = len(x) // hop; env = np.sqrt((x[:n * hop].reshape(n, hop) ** 2).mean(axis=1))
    pk = env.max(); on = int(np.argmax(env > 0.1 * pk)); ipk = int(np.argmax(env))
    out[os.path.basename(f)] = {'dur': round(len(x) / 22050, 2), 'onset_s': round(on * hop / 22050, 3), 'peak_s': round(ipk * hop / 22050, 3), 'peak_dbfs': float(round(20 * np.log10(pk + 1e-9), 1))}
    print(os.path.basename(f), out[os.path.basename(f)])
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sfx-envelopes.json'), 'w'), indent=1)
